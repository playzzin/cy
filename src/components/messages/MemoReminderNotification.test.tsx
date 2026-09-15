import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DashboardMessageWidget } from './DashboardMessageWidget';
import MessageIndicator from './MessageIndicator';
import { messageService } from '../../services/messageService';

const mockNavigate = jest.fn();
const mockInbox = { messages: [{
    id: 'notification', title: '메모 알림: 현장 확인', body: '설정한 알림 시간이 되었습니다.',
    senderId: 'system:smart-memo-reminder', senderName: '스마트메모 알림', category: '메모 알림',
    actionUrl: '/memos?memoId=site-check', type: 'system', createdAt: { toDate: () => new Date(), toMillis: () => Date.now() }
}], summary: { unread: 1, total: 1, urgentUnread: 0 }, loading: false };
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'viewer' } }) }));
jest.mock('../../hooks/useMessageInbox', () => ({ useMessageInbox: () => mockInbox, useMessageNotifications: () => mockInbox }));
jest.mock('../../services/messageService', () => ({ messageService: { isReadBy: jest.fn(() => false), markAsRead: jest.fn(), markAllAsRead: jest.fn() } }));

beforeEach(() => { jest.clearAllMocks(); });

it('shows a dashboard reminder and acknowledges it before opening the memo', async () => {
    render(<DashboardMessageWidget />);
    expect(screen.getByText('안 읽음 1건')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /메모 알림: 현장 확인/ }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/memos?memoId=site-check'));
    expect(messageService.markAsRead).toHaveBeenCalledWith('notification', 'viewer');
});

it('shows the reminder in the header notification popover', async () => {
    render(<MessageIndicator />);
    fireEvent.click(screen.getByRole('button', { name: '메시지함, 안 읽은 메시지 1건' }));
    fireEvent.click(screen.getByRole('button', { name: /메모 알림: 현장 확인/ }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/memos?memoId=site-check'));
    expect(messageService.markAsRead).toHaveBeenCalledWith('notification', 'viewer');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
