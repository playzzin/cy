import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Login from './Login';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../utils/devAdminSession', () => ({ isDevAdminAllowed: () => false }));
const login = jest.fn();
const loginWithGoogle = jest.fn();
const mount = () => render(<MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/payroll?month=11' } }]}>
  <Routes><Route path="/login" element={<Login />} /><Route path="/payroll" element={<p>업무 화면</p>} /></Routes>
</MemoryRouter>);
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear();
  (useAuth as jest.Mock).mockReturnValue({ currentUser: null, loading: false, authError: '', login, loginWithGoogle });
});
it('does not flash the login form while restoring a session', () => {
  (useAuth as jest.Mock).mockReturnValue({ currentUser: null, loading: true });
  mount();
  expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인');
  expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
});
it('goes straight to the original page for a restored account', async () => {
  (useAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'test-user' }, loading: false });
  mount();
  expect(await screen.findByText('업무 화면')).toBeInTheDocument();
  expect(login).not.toHaveBeenCalled();
});
it('remembers the login by default and supports session-only Google login', async () => {
  mount();
  const remember = screen.getByRole('checkbox', { name: '이 브라우저에서 로그인 유지' });
  expect(remember).toBeChecked();
  fireEvent.click(remember);
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }));
  await waitFor(() => expect(loginWithGoogle).toHaveBeenCalledWith({ remember: false, returnPath: '/payroll?month=11' }));
  expect(screen.getByRole('button', { name: 'Google로 이동 중…' })).toBeDisabled();
  expect(screen.queryByText('업무 화면')).not.toBeInTheDocument();
});
it('shows a recoverable Google error instead of leaving the controls stuck', async () => {
  loginWithGoogle.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('네트워크');
  expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeEnabled();
});
it('supports password manager autofill and submits persistent email login', async () => {
  login.mockResolvedValueOnce(undefined); mount();
  expect(screen.getByLabelText('이메일')).toHaveAttribute('autocomplete', 'username');
  expect(screen.getByLabelText('비밀번호')).toHaveAttribute('autocomplete', 'current-password');
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.test' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'synthetic-password' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
  await waitFor(() => expect(login).toHaveBeenCalledWith('test@example.test', 'synthetic-password', true));
  expect(await screen.findByText('업무 화면')).toBeInTheDocument();
});
