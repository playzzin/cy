import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TodoPage from './TodoPage';
import { taskService } from '../../services/taskService';
import { userService } from '../../services/userService';
import type { Task } from '../../types/task';

let mockSearch = '';
const mockTasks: Task[] = [];
jest.mock('react-router-dom', () => ({ useLocation: () => ({ search: mockSearch }) }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'requester', displayName: '요청자' } }) }));
jest.mock('../../services/userService', () => ({ userService: { getAllUsers: jest.fn().mockResolvedValue([]) } }));
jest.mock('../../utils/swal', () => ({ toast: { success: jest.fn(), warning: jest.fn() } }));
jest.mock('../../services/taskService', () => ({ taskService: {
    subscribe: jest.fn(callback => { callback(mockTasks); return jest.fn(); }), addTask: jest.fn().mockResolvedValue('new-task'),
} }));
const task = (id: string, overrides: Partial<Task> = {}): Task => ({
    id, title: `요청 ${id}`, assignee: '개발팀', createdBy: '이전 이름', createdById: 'requester', status: '완료',
    priority: '보통', createdAt: '2026-09-16', dueDate: '', comments: [], description: `상세 내용 ${id}`, ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks(); mockSearch = ''; mockTasks.splice(0);
    (userService.getAllUsers as jest.Mock).mockResolvedValue([]);
    (taskService.addTask as jest.Mock).mockResolvedValue('new-task');
    (taskService.subscribe as jest.Mock).mockImplementation(callback => { callback(mockTasks); return jest.fn(); });
});

it('opens the notification target even with a mine filter and clears an existing search on the next link', async () => {
    mockTasks.push(task('one'), task('two', { createdById: 'other' }));
    mockSearch = '?taskId=two&filter=mine';
    const { rerender } = render(<TodoPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /전체/ })).toHaveAttribute('aria-selected', 'true'));
    expect(within(screen.getAllByRole('article').find(article => within(article).queryByRole('heading', { name: '요청 two' }))!).getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no results' } });
    mockSearch = '?taskId=one';
    rerender(<TodoPage />);
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(within(screen.getAllByRole('article').find(article => within(article).queryByRole('heading', { name: '요청 one' }))!).getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true');
});

it('explains a missing notification target', async () => {
    mockSearch = '?taskId=deleted';
    render(<TodoPage />);
    expect(await screen.findByRole('status')).toHaveTextContent('알림에 연결된 요청을 찾을 수 없습니다');
});

it('stores the requester account ID with a newly submitted request', async () => {
    render(<TodoPage />);
    fireEvent.click(screen.getByRole('button', { name: '새 요청' }));
    fireEvent.change(screen.getByLabelText(/요청 제목/), { target: { value: '새 요청 테스트' } });
    fireEvent.click(screen.getByRole('button', { name: '요청 등록' }));
    await waitFor(() => expect(taskService.addTask).toHaveBeenCalledWith(expect.objectContaining({ title: '새 요청 테스트', createdById: 'requester', createdBy: '요청자' })));
});

it('my requests use account IDs despite renamed and duplicate names, while retaining legacy requests', async () => {
    mockTasks.push(task('renamed'), task('duplicate', { createdById: 'other', createdBy: '요청자' }), task('legacy', { createdById: undefined, createdBy: '요청자' }));
    render(<TodoPage />);
    fireEvent.click(screen.getByRole('tab', { name: /내 요청/ }));
    expect(screen.getByRole('heading', { name: '요청 renamed' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '요청 legacy' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '요청 duplicate' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('tab', { name: /내 요청/ })).toHaveTextContent('2'));
});
