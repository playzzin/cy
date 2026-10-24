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

let mockPreview = false;
jest.mock('../../utils/devPreviewRuntime', () => ({ get isDevPreviewFrame() { return mockPreview; } }));
beforeEach(() => { jest.clearAllMocks(); mockPreview = false; });

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

it('opens the original content even when the read receipt fails', async () => {
    (messageService.markAsRead as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    render(<MessageIndicator />);
    fireEvent.click(screen.getByRole('button', { name: '메시지함, 안 읽은 메시지 1건' }));
    fireEvent.click(screen.getByRole('button', { name: /메모 알림: 현장 확인/ }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/memos?memoId=site-check'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const warning = await screen.findByRole('button', { name: /읽음 저장 확인 필요/ });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(warning);
    expect(screen.getByRole('alert')).toHaveTextContent('읽음 상태를 저장하지 못했습니다');
    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('alert'));
    fireEvent.click(screen.getByRole('button', { name: '읽음 처리 다시 시도' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(messageService.markAsRead).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: /읽음 저장 확인 필요/ })).not.toBeInTheDocument();
});

it('disables bulk receipts in a read-only preview and still opens the message', async () => {
    mockPreview = true;
    render(<MessageIndicator />);
    fireEvent.click(screen.getByRole('button', { name: /메시지함/ }));
    expect(screen.getByText('미리보기에서는 읽음 상태를 저장하지 않습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '모든 알림 읽음 처리' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /메모 알림: 현장 확인/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/memos?memoId=site-check');
    expect(messageService.markAsRead).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('still opens dashboard content when saving the receipt fails', async () => {
    (messageService.markAsRead as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    render(<DashboardMessageWidget />);
    fireEvent.click(screen.getByRole('button', { name: /메모 알림: 현장 확인/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/memos?memoId=site-check');
    expect(await screen.findByRole('alert')).toHaveTextContent('읽음 상태를 저장하지 못했습니다');
});

it('closes the header popover on Escape and restores focus to the trigger', () => {
    render(<MessageIndicator />);
    const trigger = screen.getByRole('button', { name: '메시지함, 안 읽은 메시지 1건' });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
});
