import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import LoginLogPage from './LoginLogPage';
import { loginLogService } from '../../services/loginLogService';
import type { LoginLog, LoginLogAction } from '../../types/loginLog';

jest.mock('../../services/loginLogService', () => ({ loginLogService: { subscribeRecentLogs: jest.fn() } }));
jest.mock('../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('date-fns/locale', () => ({ ko: undefined }));
const stop = jest.fn();
const makeLog = (id: string, action: LoginLogAction, uid = 'user-a'): LoginLog => ({
  id, action, actionLabel: action, status: action === 'login_failed' ? 'failed' : 'success', provider: 'password', method: 'session_restore',
  actor: { uid, email: `${uid}@example.test`, displayName: uid === 'user-a' ? '테스트 사용자 A' : '테스트 사용자 B' },
  email: `${uid}@example.test`, summaryLines: ['접속 기록'], summaryText: '접속 기록',
  client: { userAgent: 'test', browser: 'Chrome', os: 'Windows', platform: 'test', language: 'ko-KR', timezone: 'Asia/Seoul', path: '/dashboard', referrer: '', screen: '', viewport: '' },
  createdAt: Timestamp.now(), createdAtIso: new Date().toISOString(),
});
beforeEach(() => {
  jest.clearAllMocks();
  (loginLogService.subscribeRecentLogs as jest.Mock).mockImplementation((receive) => {
    receive([makeLog('1', 'login_success'), makeLog('2', 'session_access'), makeLog('3', 'logout'), makeLog('4', 'login_failed'), makeLog('5', 'signup_success', 'user-b')]);
    return stop;
  });
});

it('counts successful access events and distinct users, excluding failed logins and logouts', () => {
  render(<LoginLogPage />);
  expect(screen.getByRole('heading', { name: '사용자 접속 기록' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: '오늘 접속' })).toHaveTextContent('오늘 접속3');
  expect(screen.getByRole('group', { name: '오늘 접속 사용자' })).toHaveTextContent('오늘 접속 사용자2');
  fireEvent.change(screen.getByLabelText('접속 작업'), { target: { value: 'session_access' } });
  const table = within(screen.getByRole('table'));
  expect(table.getByText('앱 재접속')).toBeInTheDocument();
  expect(table.queryByText('로그인 성공')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('접속 기록 검색'), { target: { value: '없는 사용자' } });
  expect(screen.getByText('조건에 맞는 접속 기록이 없습니다.')).toBeInTheDocument();
});

it('shows live records and reconnects after a failed subscription instead of displaying a false empty history', () => {
  (loginLogService.subscribeRecentLogs as jest.Mock).mockImplementation((_receive, _limit, fail) => { fail(new Error('denied')); return stop; });
  const view = render(<LoginLogPage />);
  expect(screen.getByRole('alert')).toHaveTextContent('접속 기록을 불러오지 못했습니다');
  expect(screen.queryByText('조건에 맞는 접속 기록이 없습니다.')).not.toBeInTheDocument();
  (loginLogService.subscribeRecentLogs as jest.Mock).mockImplementation((receive) => { receive([]); return stop; });
  fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
  expect(stop).toHaveBeenCalledTimes(1);
  const receive = (loginLogService.subscribeRecentLogs as jest.Mock).mock.calls[1][0];
  act(() => receive([makeLog('live', 'session_access')]));
  expect(within(screen.getByRole('table')).getByText('앱 재접속')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  view.unmount();
  expect(stop).toHaveBeenCalledTimes(2);
});
