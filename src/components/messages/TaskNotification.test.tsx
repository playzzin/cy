import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DashboardMessageWidget } from './DashboardMessageWidget';
import MessageIndicator from './MessageIndicator';
import { messageService } from '../../services/messageService';

const mockNavigate = jest.fn();
const notification = {
    id: 'task-message', title: '결과 검토 요청: 다운로드 수정', body: '요청 처리가 완료되었습니다. 결과를 확인해 주세요.',
    senderId: 'system:task-notification', senderName: '할일 알림', category: '할일 알림',
    actionUrl: '/todo?taskId=download', type: 'system', readBy: [] as string[],
    createdAt: { toDate: () => new Date(), toMillis: () => Date.now() },
};
const mockInbox = { messages: [notification], summary: { unread: 1, total: 1, urgentUnread: 1 }, loading: false };
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'viewer' } }) }));
jest.mock('../../hooks/useMessageInbox', () => ({ useMessageInbox: () => mockInbox, useMessageNotifications: () => mockInbox }));
jest.mock('../../services/messageService', () => ({ messageService: {
    isReadBy: jest.fn((message, uid) => message.readBy.includes(uid)), markAsRead: jest.fn(), markAllAsRead: jest.fn(),
} }));
beforeEach(() => {
    jest.clearAllMocks(); mockInbox.messages = [notification];
    (messageService.isReadBy as jest.Mock).mockImplementation((message, uid) => message.readBy.includes(uid));
});

it('shows the unread review on the dashboard even behind three newer read messages', async () => {
    mockInbox.messages = [1, 2, 3].map(id => ({ ...notification, id: String(id), title: `읽은 메시지 ${id}`, readBy: ['viewer'] })).concat(notification);
    render(<DashboardMessageWidget />);
    expect(screen.getByText('안 읽음 1건')).toBeInTheDocument();
    expect(screen.queryByText('읽은 메시지 3')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /결과 검토 요청: 다운로드 수정/ }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/todo?taskId=download'));
    expect(messageService.markAsRead).toHaveBeenCalledWith('task-message', 'viewer');
});

it('opens a DEV new request alert from the header', async () => {
    mockInbox.messages = [{ ...notification, title: '새 요청: 다운로드 수정' }];
    render(<MessageIndicator />);
    fireEvent.click(screen.getByRole('button', { name: '메시지함, 안 읽은 메시지 1건' }));
    fireEvent.click(screen.getByRole('button', { name: /새 요청: 다운로드 수정/ }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/todo?taskId=download'));
    expect(messageService.markAsRead).toHaveBeenCalledWith('task-message', 'viewer');
});
