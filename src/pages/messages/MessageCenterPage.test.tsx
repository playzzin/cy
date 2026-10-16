import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import MessageCenterPage from './MessageCenterPage';
import { messageService } from '../../services/messageService';
import type { ErpMessage } from '../../types/erpMessage';

const mockInbox = { messages: [] as ErpMessage[], loading: false, error: null as Error | null, retry: jest.fn() };
jest.mock('../../hooks/useMessageInbox', () => ({ useMessageInbox: () => mockInbox }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'viewer' } }) }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [] } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [] } }));
jest.mock('../../services/messageRecipientDirectoryService', () => ({ getMessageRecipientUsers: async () => [] }));
jest.mock('../../services/userService', () => ({ userService: { getAllUsers: async () => [], getUser: async () => ({ role: 'user' }) } }));
jest.mock('../../services/messageService', () => ({ messageService: {
  isReadBy: (message: ErpMessage, uid: string) => message.readBy.includes(uid),
  getReadAt: () => undefined,
  subscribeSent: jest.fn(() => jest.fn()), subscribeAllMessages: jest.fn(() => jest.fn()),
  markAsRead: jest.fn(), markAllAsRead: jest.fn()
} }));

const message = (id: string, readBy: string[] = []): ErpMessage => ({
  id, title: `메시지 ${id}`, body: `${id} 본문`, senderId: 'sender', senderName: '보낸 사람', type: 'direct',
  category: '업무', priority: 'normal', status: 'active', recipientScope: 'users', recipientIds: ['viewer'],
  recipientNames: ['수신자'], readBy, readAtBy: {}, pinned: false,
  createdAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(1000)
});
const page = (path = '/messages') => <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><MessageCenterPage /></MemoryRouter>;

beforeEach(() => {
  jest.clearAllMocks();
  mockInbox.messages = [message('first'), message('second')]; mockInbox.loading = false; mockInbox.error = null;
  (messageService.markAsRead as jest.Mock).mockResolvedValue(undefined);
  (messageService.markAllAsRead as jest.Mock).mockResolvedValue(undefined);
  (messageService.subscribeSent as jest.Mock).mockReturnValue(jest.fn());
  (messageService.subscribeAllMessages as jest.Mock).mockReturnValue(jest.fn());
});

it('only acknowledges the message explicitly opened by the user', async () => {
  render(page());
  await screen.findByText('목록에서 메시지를 선택하세요.');
  expect(messageService.markAsRead).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /메시지 second/ }));
  await waitFor(() => expect(messageService.markAsRead).toHaveBeenCalledWith('second', 'viewer'));
  expect(screen.getByRole('heading', { name: '메시지 second' })).toBeInTheDocument();
});

it('keeps the selected body open when acknowledgement removes it from the unread filter', async () => {
  const view = render(page());
  fireEvent.click(screen.getByRole('button', { name: /안 읽음 2/ }));
  fireEvent.click(screen.getByRole('button', { name: /메시지 second/ }));
  await waitFor(() => expect(messageService.markAsRead).toHaveBeenCalledTimes(1));
  mockInbox.messages = [message('first'), message('second', ['viewer'])];
  view.rerender(page());
  expect(screen.getByRole('heading', { name: '메시지 second' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '읽음 완료' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /메시지 second/ })).not.toBeInTheDocument();
  expect(messageService.markAsRead).toHaveBeenCalledTimes(1);
});

it('does not loop or acknowledge another message when a deep link is temporarily missing', async () => {
  mockInbox.messages = [message('first')];
  const view = render(page('/messages?messageId=second'));
  await screen.findByText('목록에서 메시지를 선택하세요.');
  expect(messageService.markAsRead).not.toHaveBeenCalled();
  mockInbox.messages = [message('first'), message('second')];
  view.rerender(page('/messages?messageId=second'));
  await waitFor(() => expect(messageService.markAsRead).toHaveBeenCalledWith('second', 'viewer'));
  expect(messageService.markAsRead).toHaveBeenCalledTimes(1);
});

it('reports a failed receipt, stops automatic rollback retries and allows an explicit retry', async () => {
  (messageService.markAsRead as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));
  const view = render(page('/messages?messageId=second'));
  expect(await screen.findByRole('alert')).toHaveTextContent('읽음 상태를 저장하지 못했습니다');
  mockInbox.messages = [message('first'), message('second', ['viewer'])];
  view.rerender(page('/messages?messageId=second'));
  mockInbox.messages = [message('first'), message('second')];
  view.rerender(page('/messages?messageId=second'));
  expect(messageService.markAsRead).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '읽음 처리 다시 시도' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(messageService.markAsRead).toHaveBeenCalledTimes(2);
});

it('shows loading and retrieval errors instead of silently presenting an empty inbox', async () => {
  mockInbox.messages = []; mockInbox.loading = true;
  const view = render(page());
  expect(await screen.findByRole('status')).toHaveTextContent('불러오는 중');
  mockInbox.loading = false; mockInbox.error = new Error('offline');
  view.rerender(page());
  expect(screen.getByRole('alert')).toHaveTextContent('불러오지 못했습니다');
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
  expect(mockInbox.retry).toHaveBeenCalledTimes(1);
});
