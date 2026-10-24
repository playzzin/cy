import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import NoticeBoardPage from './NoticeBoardPage';
import { noticeService } from '../../services/noticeService';
import { notificationCenterService } from '../../services/notificationCenterService';
import { messageService } from '../../services/messageService';

const mockNotice = { id: 'notice', title: '안전 교육 안내', body: '안전 교육 내용을 확인하세요.', category: '안전', targetPositions: [], priority: 'normal', pinned: false,
    createdBy: { uid: 'author', name: '작성자' }, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), status: 'published', canManage: true };
const mockAccess = { isManager: true, isTeamLeader: false, teams: [{ id: 'team-a', name: 'A팀' }] };
const mockInbox = { messages: [{ id: 'linked', actionUrl: '/notices?noticeId=notice', readBy: [] }], summary: { unread: 1 }, loading: false, error: null, retry: jest.fn() };
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'viewer', displayName: '관리자' } }) }));
jest.mock('../../hooks/useMessageInbox', () => ({ useMessageInbox: () => mockInbox }));
jest.mock('../../services/noticeService', () => ({ noticeService: {
    subscribeNotices: jest.fn((next, error, access) => { access?.(mockAccess); next([mockNotice]); return jest.fn(); }),
    subscribeCategories: (next: (items: unknown[]) => void) => { next([]); return jest.fn(); },
    isAllPositionsNotice: (positions: string[]) => positions.length === 0,
    isNoticeVisibleToPositions: jest.fn(() => true), isExpired: () => false, normalizePositionKey: (value: string) => value,
    createNotice: jest.fn(async () => 'new-notice'), updateNotice: jest.fn(async () => undefined)
} }));
jest.mock('../../services/messageService', () => ({ messageService: { isReadBy: () => false, markAllAsRead: jest.fn(async () => undefined) } }));
jest.mock('../../services/systemMessageService', () => ({ systemMessageService: { notifyNoticeCreatedEvent: jest.fn(async () => 'disabled') } }));
jest.mock('../../services/positionService', () => ({ positionService: { getPositions: async () => [] } }));
jest.mock('../../services/userService', () => ({ userService: { getUser: async () => ({ role: 'admin', position: '팀장' }) } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkerByUid: async () => null } }));

beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.isManager = true; mockAccess.isTeamLeader = false;
    (noticeService.subscribeNotices as jest.Mock).mockImplementation((next, error, access) => { access?.(mockAccess); next([mockNotice]); return jest.fn(); });
    (noticeService.createNotice as jest.Mock).mockResolvedValue('new-notice');
    (noticeService.updateNotice as jest.Mock).mockResolvedValue(undefined);
    (notificationCenterService.saveNotice as jest.Mock).mockResolvedValue({ noticeId: 'new-notice', jobId: 'job', status: 'disabled' });
    Object.defineProperty(global, 'crypto', { value: { randomUUID: jest.fn(() => 'test-request') }, configurable: true });
    (messageService.markAllAsRead as jest.Mock).mockResolvedValue(undefined);
    (noticeService.isNoticeVisibleToPositions as jest.Mock).mockReturnValue(true);
});
const openPage = (path = '/notices') => render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><NoticeBoardPage /></MemoryRouter>);

it('opens a notice explicitly, acknowledges its linked alert, and keeps edit actions outside the disclosure button', async () => {
    openPage();
    const button = await screen.findByRole('button', { name: /안전 교육 안내/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(messageService.markAllAsRead).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(screen.getByText('안전 교육 내용을 확인하세요.')).toBeInTheDocument();
    await waitFor(() => expect(messageService.markAllAsRead).toHaveBeenCalledWith(mockInbox.messages, 'viewer'));
    expect(within(button).queryByRole('button')).not.toBeInTheDocument();
});

it('opens the notice targeted by a deep link', async () => {
    openPage('/notices?noticeId=notice');
    expect(await screen.findByText('안전 교육 내용을 확인하세요.')).toBeInTheDocument();
});

it('explains unavailable deep links', async () => {
    openPage('/notices?noticeId=missing');
    expect(await screen.findByRole('alert')).toHaveTextContent('삭제·만료되었거나 조회 권한');
});

it('reports saved notice and disabled notification separately', async () => {
    openPage();
    fireEvent.click(await screen.findByRole('button', { name: '새 공지' }));
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '새 안전 공지' } });
    fireEvent.change(screen.getByLabelText('본문'), { target: { value: '새 공지 내용' } });
    expect(screen.getByLabelText('저장 후 대상자에게 알림 보내기')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(notificationCenterService.saveNotice).toHaveBeenCalledWith('test-request', null, expect.objectContaining({ title: '새 안전 공지' }), true));
    expect(await screen.findByText(/공지 자동 알림이 꺼져 있어/)).toBeInTheDocument();
    expect(screen.queryByLabelText('제목')).not.toBeInTheDocument();
});

it('does not resend notifications by default when editing a notice', async () => {
    openPage();
    fireEvent.click(await screen.findByRole('button', { name: '공지사항 수정' }));
    expect(screen.getByLabelText('저장 후 대상자에게 알림 보내기')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(notificationCenterService.saveNotice).toHaveBeenCalledWith('test-request', 'notice', expect.anything(), false));
});

it.each(['all', 'teamLeaders'])('saves the selected Cheongyeon audience: %s', async audience => {
    openPage();
    fireEvent.click(await screen.findByRole('button', { name: '새 공지' }));
    fireEvent.change(screen.getByLabelText('공개 범위'), { target: { value: audience } });
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '청연 공지' } });
    fireEvent.change(screen.getByLabelText('본문'), { target: { value: '안내 사항' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(notificationCenterService.saveNotice).toHaveBeenCalledWith('test-request', null,
        expect.objectContaining({ audience, teamId: null, targetPositions: [] }), true));
});

it('limits team leaders to their own team and saves a team audience', async () => {
    mockAccess.isManager = false; mockAccess.isTeamLeader = true;
    (noticeService.subscribeNotices as jest.Mock).mockImplementation((next, error, access) => {
        access(mockAccess); next([{ ...mockNotice, canManage: false }]); return jest.fn();
    });
    openPage();
    fireEvent.click(await screen.findByRole('button', { name: '새 공지' }));
    expect(screen.getByLabelText('공개 범위')).toHaveValue('team');
    expect(within(screen.getByLabelText('공개 범위')).getAllByRole('option')).toHaveLength(1);
    expect(screen.getByLabelText('대상 팀')).toHaveValue('team-a');
    expect(screen.queryByRole('button', { name: '공지사항 수정' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: 'A팀 공지' } });
    fireEvent.change(screen.getByLabelText('본문'), { target: { value: '팀원 안내' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(notificationCenterService.saveNotice).toHaveBeenCalledWith('test-request', null,
        expect.objectContaining({ audience: 'team', teamId: 'team-a', targetPositions: [] }), true));
});

it('does not offer authoring to ordinary members and hides unavailable deep links', async () => {
    (noticeService.subscribeNotices as jest.Mock).mockImplementation((next, error, access) => {
        access({ isManager: false, isTeamLeader: false, teams: [] }); next([{ ...mockNotice, canManage: false }]); return jest.fn();
    });
    openPage('/notices?noticeId=other-team');
    expect(await screen.findByRole('alert')).toHaveTextContent('조회 권한');
    expect(screen.queryByRole('button', { name: '새 공지' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '공지사항 수정' })).not.toBeInTheDocument();
});

it('filters the visible list by notice audience', async () => {
    (noticeService.subscribeNotices as jest.Mock).mockImplementation((next, error, access) => {
        access(mockAccess); next([
            { ...mockNotice, audience: 'all' },
            { ...mockNotice, id: 'team', title: 'A팀 전달', audience: 'team', teamId: 'team-a', teamName: 'A팀' },
        ]); return jest.fn();
    });
    openPage();
    await screen.findByRole('button', { name: /안전 교육 안내/ });
    fireEvent.click(screen.getByRole('button', { name: '팀 공지' }));
    expect(screen.queryByRole('button', { name: /안전 교육 안내/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /A팀 전달/ })).toHaveTextContent('팀 공지 · A팀만');
});

jest.mock('../../hooks/useNotificationCenter', () => ({ useNotificationCenter: () => ({ preferences: { sound: true, sources: { notice: true, memo: true, task: true, message: true }, quietEnabled: false, quietStart: '22:00', quietEnd: '08:00', digestMinutes: 0 }, states: {}, now: Date.now(), loading: false, error: null, retry: jest.fn() }) }));

jest.mock('../../services/notificationCenterService', () => ({ notificationCenterService: { saveNotice: jest.fn(async () => ({ noticeId: 'new-notice', jobId: 'job', status: 'disabled' })), confirm: jest.fn(async () => undefined), snooze: jest.fn(async () => undefined), resume: jest.fn(async () => undefined) } }));
