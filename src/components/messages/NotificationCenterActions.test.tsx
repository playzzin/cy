import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import NotificationInbox from './NotificationInbox';
import NotificationPreferencesPanel from './NotificationPreferencesPanel';
import NoticeDeliveryPanel from './NoticeDeliveryPanel';
import { notificationCenterService } from '../../services/notificationCenterService';
import { messageService } from '../../services/messageService';
import { defaultNotificationPreferences } from '../../utils/notificationCenter';
import type { ErpMessage } from '../../types/erpMessage';
import type { NotificationUserState } from '../../types/notificationCenter';
const mockNavigate = jest.fn();
const mockProfile = { preferences: defaultNotificationPreferences, states: {} as Record<string, NotificationUserState>, now: Date.now(), loading: false, error: null as Error | null, retry: jest.fn() };
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a> }));
jest.mock('../../hooks/useNotificationCenter', () => ({ useNotificationCenter: () => mockProfile }));
jest.mock('../../services/messageService', () => ({ messageService: { isReadBy: (m: ErpMessage, uid: string) => m.readBy.includes(uid), markAllAsRead: jest.fn() } }));
jest.mock('../../services/notificationCenterService', () => ({ notificationCenterService: {
    confirm: jest.fn(), snooze: jest.fn(), resume: jest.fn(), savePreferences: jest.fn(), deliveryJobs: jest.fn(), deliveryRecipients: jest.fn(), retryDelivery: jest.fn(),
} }));
const message = (id: string, patch: Partial<ErpMessage> = {}): ErpMessage => ({
    id, title: '알림 ' + id, body: '전체 안내 내용', type: 'system', category: '공지', priority: 'urgent', status: 'active', senderId: 'system:notice-notification', senderName: '담당자',
    recipientScope: 'users', recipientIds: ['viewer'], recipientNames: [], readBy: [], readAtBy: {}, pinned: false, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    actionUrl: '/notices?noticeId=' + id, ...patch,
});
const props = { uid: 'viewer', loading: false, error: null, onRetry: jest.fn() };
beforeEach(() => {
    jest.clearAllMocks(); mockProfile.states = {}; mockProfile.error = null;
    mockProfile.preferences = defaultNotificationPreferences;
    (messageService.markAllAsRead as jest.Mock).mockResolvedValue(undefined);
    for (const fn of [notificationCenterService.confirm, notificationCenterService.snooze, notificationCenterService.resume, notificationCenterService.savePreferences]) (fn as jest.Mock).mockResolvedValue({ ok: true });
});
it('opens full detail and records confirmation separately from reading', async () => {
    render(<NotificationInbox {...props} messages={[message('a', { requiresConfirmation: true })]} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 a' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('전체 안내 내용')).toBeInTheDocument();
    await waitFor(() => expect(within(sheet).getByRole('button', { name: '내용 확인 완료' })).toBeEnabled());
    expect(notificationCenterService.confirm).not.toHaveBeenCalled();
    fireEvent.click(within(sheet).getByRole('button', { name: '내용 확인 완료' }));
    await waitFor(() => expect(notificationCenterService.confirm).toHaveBeenCalledWith('a'));
    expect(await within(sheet).findByRole('status')).toHaveTextContent('확인 완료를 기록');
});
it('snoozes only the selected message and keeps deferred items outside the focus list', async () => {
    const future = Timestamp.fromMillis(Date.now() + 3600000);
    mockProfile.states.b = { userId: 'viewer', messageId: 'b', snoozedUntil: future };
    render(<NotificationInbox {...props} messages={[message('a'), message('b')]} />);
    expect(screen.queryByRole('button', { name: '알림 b' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '알림 a' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '1시간 후' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '1시간 후' }));
    await waitFor(() => expect(notificationCenterService.snooze).toHaveBeenCalledWith('a', expect.any(Number)));
    fireEvent.click(screen.getByRole('button', { name: '알림 상세 닫기' }));
    fireEvent.click(screen.getByRole('button', { name: '미뤄둠', pressed: false }));
    expect(screen.getByRole('button', { name: '알림 b' })).toBeInTheDocument();
});
it('reads only selected results and resets selection after filtering', async () => {
    const a = message('a'), b = message('b');
    render(<NotificationInbox {...props} messages={[a, b]} />);
    fireEvent.click(screen.getByLabelText('알림 a 선택'));
    fireEvent.click(screen.getByRole('button', { name: '선택 읽음 처리 (1)' }));
    await waitFor(() => expect(messageService.markAllAsRead).toHaveBeenCalledWith([a], 'viewer'));
    fireEvent.change(screen.getByLabelText('알림 검색'), { target: { value: 'b' } });
    expect(screen.getByRole('button', { name: '선택 읽음 처리 (0)' })).toBeDisabled();
});
it('opens content after a failed receipt and keeps personal mutations disabled when state is unavailable', async () => {
    (messageService.markAllAsRead as jest.Mock).mockRejectedValue(new Error('offline'));
    mockProfile.error = new Error('offline');
    render(<NotificationInbox {...props} messages={[message('a', { requiresConfirmation: true })]} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 a' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('다시 시도');
    expect(screen.getByRole('button', { name: '내용 확인 완료' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '원문 열기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/notices?noticeId=a');
});
it('removes an already-read confirmed notice from focus even on its due date', () => {
    mockProfile.states.a = { userId: 'viewer', messageId: 'a', confirmedAt: Timestamp.now() };
    render(<NotificationInbox {...props} messages={[message('a', { readBy: ['viewer'], requiresConfirmation: true, dueAt: Timestamp.now() })]} />);
    expect(screen.queryByRole('button', { name: '알림 a' })).not.toBeInTheDocument();
});
it('saves personal preferences and retains edits on failed persistence', async () => {
    (notificationCenterService.savePreferences as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    render(<NotificationPreferencesPanel uid="viewer" />);
    fireEvent.click(screen.getByLabelText('새 알림 소리와 진동 켜기'));
    fireEvent.change(screen.getByLabelText('일반 알림 소리 모아 받기'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('입력한 설정을 유지');
    expect(screen.getByLabelText('새 알림 소리와 진동 켜기')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await waitFor(() => expect(notificationCenterService.savePreferences).toHaveBeenLastCalledWith(expect.objectContaining({ sound: false, digestMinutes: 15 })));
    expect(await screen.findByRole('status')).toHaveTextContent('저장했습니다');
});
it('shows delivery and confirmation separately and preserves retry failures', async () => {
    (notificationCenterService.deliveryJobs as jest.Mock).mockResolvedValue({ jobs: [{ id: 'j', noticeId: 'n', title: '안전', status: 'failed', reason: '', attempts: 8, recipientCount: 2, deliveredCount: 0, requiresConfirmation: true, createdAt: Date.now() }], hasMore: false });
    (notificationCenterService.deliveryRecipients as jest.Mock).mockResolvedValue({ recipients: [{ uid: 'a', name: '담당자', delivered: true, read: true, confirmedAt: null }] });
    (notificationCenterService.retryDelivery as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<NoticeDeliveryPanel />);
    fireEvent.click(await screen.findByRole('button', { name: '수신자 상태 보기' }));
    expect(await screen.findByText('확인 미완료', { selector: 'span' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '지금 발송 재시도' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('발송 재시도에 실패');
});
