import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import NotificationInbox from './NotificationInbox';
import type { ErpMessage } from '../../types/erpMessage';
import { messageService } from '../../services/messageService';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../services/messageService', () => ({ messageService: {
    isReadBy: (message: ErpMessage, uid: string) => message.readBy.includes(uid), markAllAsRead: jest.fn()
} }));
const message = (id: string, patch: Partial<ErpMessage> = {}): ErpMessage => ({
    id, title: `알림 ${id}`, body: '확인할 내용', senderName: '담당자', senderId: 'sender',
    type: 'direct', category: '업무', priority: 'normal', status: 'active', recipientScope: 'users',
    recipientIds: ['viewer'], recipientNames: [], readBy: [], readAtBy: {}, pinned: false,
    createdAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(1000), ...patch
});
const props = { uid: 'viewer', loading: false, error: null, onRetry: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); (messageService.markAllAsRead as jest.Mock).mockResolvedValue(undefined); });

it('combines search, unread and type filters and marks only the matching unread results', async () => {
    const notice = message('notice', { title: '안전 교육', actionUrl: '/notices?noticeId=safety' });
    render(<NotificationInbox {...props} messages={[notice, message('read', { readBy: ['viewer'] }), message('task', { title: '안전 점검', senderId: 'system:task-notification' })]} />);
    fireEvent.click(screen.getByRole('button', { name: /^미확인 2$/, pressed: false }));
    fireEvent.change(screen.getByLabelText('알림 종류'), { target: { value: 'notice' } });
    fireEvent.change(screen.getByLabelText('알림 검색'), { target: { value: '안전' } });
    expect(screen.queryByText('안전 점검')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /조회된 알림 읽음 처리/ }));
    await waitFor(() => expect(messageService.markAllAsRead).toHaveBeenCalledWith([notice], 'viewer'));
    expect(await screen.findByRole('status')).toHaveTextContent('1건을 읽음 처리');
});

it('acknowledges a notice before navigating to the original', async () => {
    const notice = message('notice', { actionUrl: '/notices?noticeId=one' });
    render(<NotificationInbox {...props} messages={[notice]} />);
    fireEvent.click(screen.getByRole('button', { name: '원문 바로가기' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/notices?noticeId=one'));
    expect(messageService.markAllAsRead).toHaveBeenCalledWith([notice], 'viewer');
});

it('keeps the unread item available on failed acknowledgement and allows retry', async () => {
    (messageService.markAllAsRead as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    render(<NotificationInbox {...props} messages={[message('one')]} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 one 읽음 처리' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('다시 시도');
    expect(mockNavigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '알림 one 읽음 처리' }));
    expect(await screen.findByRole('status')).toHaveTextContent('1건');
});

it('distinguishes loading, retrieval failure, and empty results', () => {
    const { rerender } = render(<NotificationInbox {...props} loading messages={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    expect(screen.queryByText('아직 도착한 알림이 없습니다')).not.toBeInTheDocument();
    rerender(<NotificationInbox {...props} error={new Error('offline')} messages={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(props.onRetry).toHaveBeenCalled();
    expect(screen.queryByText('아직 도착한 알림이 없습니다')).not.toBeInTheDocument();
    rerender(<NotificationInbox {...props} messages={[]} />);
    expect(screen.getByText('아직 도착한 알림이 없습니다')).toBeInTheDocument();
});

it('shows twenty items initially and progressively reveals older items', () => {
    render(<NotificationInbox {...props} messages={Array.from({ length: 23 }, (_, index) => message(String(index)))} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: /알림 더 보기/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(23);
});

jest.mock('../../hooks/useNotificationCenter', () => ({ useNotificationCenter: () => ({ preferences: { sound: true, sources: { notice: true, memo: true, task: true, message: true }, quietEnabled: false, quietStart: '22:00', quietEnd: '08:00', digestMinutes: 0 }, states: {}, now: Date.now(), loading: false, error: null, retry: jest.fn() }) }));

jest.mock('../../services/notificationCenterService', () => ({ notificationCenterService: { saveNotice: jest.fn(async () => ({ noticeId: 'new-notice', jobId: 'job', status: 'disabled' })), confirm: jest.fn(async () => undefined), snooze: jest.fn(async () => undefined), resume: jest.fn(async () => undefined) } }));
