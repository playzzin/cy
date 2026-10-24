import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivityCenterPage, { ActivityBrowser } from './ActivityCenterPage';
import { ACTIVITY_SOURCES } from './activitySources';
import { fetchActivityPage, type ActivityPage } from './activityQuery';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/userService', () => ({ userService: { getUser: jest.fn() } }));
jest.mock('../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('./activityQuery', () => ({ fetchActivityPage: jest.fn(), activityErrorMessage: () => '내역을 불러오지 못했습니다.' }));
const page = (id: string, hasMore = true): ActivityPage => ({
  records: [{ id, time: Date.parse('2026-10-22T01:00:00Z'), actorId: 'user-a', actorName: '테스트 사용자', action: '로그인', target: id, outcome: 'success', summary: [], changes: [], facts: [] }],
  cursor: { id } as any, hasMore,
});
beforeEach(() => {
  jest.clearAllMocks();
  (fetchActivityPage as jest.Mock).mockResolvedValue(page('첫 기록'));
  (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'admin-a' } });
  (userService.getUser as jest.Mock).mockResolvedValue({ role: 'admin', status: 'active' });
});

it('deduplicates StrictMode reads, waits for date submission and caches previous pages', async () => {
  (fetchActivityPage as jest.Mock).mockResolvedValueOnce(page('첫 기록')).mockResolvedValueOnce(page('다음 기록', false));
  render(<React.StrictMode><ActivityBrowser source={ACTIVITY_SOURCES[0]} /></React.StrictMode>);
  await screen.findByText('첫 기록');
  expect(fetchActivityPage).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('현재 페이지 검색'), { target: { value: '테스트' } });
  expect(fetchActivityPage).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByText('다음 기록');
  fireEvent.click(screen.getByRole('button', { name: '이전' }));
  expect(screen.getByText('첫 기록')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(screen.getByText('다음 기록')).toBeInTheDocument();
  expect(fetchActivityPage).toHaveBeenCalledTimes(2);
});

it('selecting an actor queries the full selected period and stale responses cannot replace the new result', async () => {
  let finish: (result: ActivityPage) => void = () => undefined;
  (fetchActivityPage as jest.Mock).mockResolvedValueOnce(page('기존')).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<ActivityBrowser source={ACTIVITY_SOURCES[0]} />);
  await screen.findByText('기존');
  fireEvent.click(screen.getByRole('button', { name: '테스트 사용자' }));
  await waitFor(() => expect(fetchActivityPage).toHaveBeenLastCalledWith(ACTIVITY_SOURCES[0], expect.objectContaining({ actorId: 'user-a' }), null));
  view.unmount();
  await act(async () => finish(page('늦은 응답')));
  expect(screen.queryByText('늦은 응답')).not.toBeInTheDocument();
});

it('opens legacy links in the unified page and fetches only that source', async () => {
  render(<MemoryRouter initialEntries={['/materials/logs']}><ActivityCenterPage /></MemoryRouter>);
  await screen.findByText('첫 기록');
  expect(screen.getByRole('heading', { name: '활동 내역' })).toBeInTheDocument();
  expect(fetchActivityPage).toHaveBeenCalledTimes(1);
  expect((fetchActivityPage as jest.Mock).mock.calls[0][0].id).toBe('materials');
});

it('does not fetch restricted logs', async () => {
  (userService.getUser as jest.Mock).mockResolvedValue({ role: 'audit', status: 'active' });
  render(<MemoryRouter initialEntries={['/admin/login-logs']}><ActivityCenterPage /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('권한이 없습니다');
  expect(fetchActivityPage).not.toHaveBeenCalled();
});

it('clears the previous account records immediately when switching users', async () => {
  const app = <MemoryRouter initialEntries={['/activity?source=login']}><ActivityCenterPage /></MemoryRouter>;
  const view = render(app);
  await screen.findByText('첫 기록');
  (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'ordinary-user' } });
  (userService.getUser as jest.Mock).mockResolvedValue({ role: 'user', status: 'active' });
  view.rerender(<MemoryRouter initialEntries={['/activity?source=login']}><ActivityCenterPage /></MemoryRouter>);
  expect(screen.queryByText('첫 기록')).not.toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('권한이 없습니다');
  expect(fetchActivityPage).toHaveBeenCalledTimes(1);
});

it('shows query failures distinctly from empty results and retries explicitly', async () => {
  (fetchActivityPage as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page('복구', false));
  render(<ActivityBrowser source={ACTIVITY_SOURCES[0]} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
  expect(screen.queryByText('선택한 조건에 기록이 없습니다.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await screen.findByText('복구');
});

it('clears a failed next-page request when returning to cached pages', async () => {
  (fetchActivityPage as jest.Mock).mockResolvedValueOnce(page('첫째')).mockResolvedValueOnce(page('둘째'))
    .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page('셋째', false));
  render(<ActivityBrowser source={ACTIVITY_SOURCES[0]} />);
  await screen.findByText('첫째');
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByText('둘째');
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '이전' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(screen.getByText('둘째')).toBeInTheDocument();
  expect(fetchActivityPage).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await screen.findByText('셋째');
  expect(screen.getByText(/3페이지/)).toBeInTheDocument();
});
