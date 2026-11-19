import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { AuthProvider, useAuth } from './AuthContext';
import { loginLogService } from '../services/loginLogService';
import { loginAccessTracker } from '../services/loginAccessTracker';
import { rememberGoogleLoginRedirect, readGoogleLoginRedirect } from '../utils/googleLoginRedirect';

jest.mock('../config/firebaseAuth', () => ({ auth: { currentUser: null } }));
jest.mock('../services/loginLogService', () => ({ loginLogService: { safeCreateLog: jest.fn() } }));
jest.mock('../services/userService', () => ({ userService: { saveUser: jest.fn() } }));
jest.mock('../utils/devAdminSession', () => ({ createDevAdminUser: () => null, isDevAdminSessionEnabled: () => false, disableDevAdminSession: jest.fn() }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(), signInWithEmailAndPassword: jest.fn(), createUserWithEmailAndPassword: jest.fn(), signInWithRedirect: jest.fn(),
  getRedirectResult: jest.fn(), setPersistence: jest.fn(), browserLocalPersistence: { type: 'LOCAL' }, browserSessionPersistence: { type: 'SESSION' },
  GoogleAuthProvider: jest.fn(() => ({ setCustomParameters: jest.fn() })),
}));

let current: ReturnType<typeof useAuth>;
let observe: (user: any) => void;
const user = { uid: 'test-user', email: 'test@example.test', displayName: '테스트', photoURL: null, providerData: [{ providerId: 'password' }] } as any;
const Probe = () => { current = useAuth(); return null; };
const open = async () => {
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(onAuthStateChanged).toHaveBeenCalled());
  return view;
};

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  (setPersistence as jest.Mock).mockResolvedValue(undefined);
  (getRedirectResult as jest.Mock).mockResolvedValue(null);
  (signInWithRedirect as jest.Mock).mockResolvedValue(undefined);
  loginAccessTracker.observe(null);
  window.history.replaceState({}, '', '/admin/login-logs');
  (loginLogService.safeCreateLog as jest.Mock).mockResolvedValue(true);
  (GoogleAuthProvider as unknown as jest.Mock).mockImplementation(() => ({ setCustomParameters: jest.fn() }));
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, listener) => { observe = listener; listener(null); return jest.fn(); });
});

it('records an existing login when the app opens, once despite repeated auth callbacks', async () => {
  await open();
  await act(async () => { observe(user); observe(user); });
  await waitFor(() => expect(loginLogService.safeCreateLog).toHaveBeenCalledTimes(1));
  expect(loginLogService.safeCreateLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'session_access', user: expect.objectContaining({ uid: 'test-user' }) }));
});

it.each(['password', 'signup'] as const)('records %s authentication without duplicating it as an app re-entry', async (method) => {
  await open();
  const signIn = method === 'password' ? signInWithEmailAndPassword : createUserWithEmailAndPassword;
  (signIn as jest.Mock).mockImplementation(async () => { observe(user); return { user }; });
  await act(async () => {
    if (method === 'password') await current.login('test@example.test', 'synthetic-password');
    else await current.signup('test@example.test', 'synthetic-password');
  });
  await waitFor(() => expect(loginLogService.safeCreateLog).toHaveBeenCalledTimes(1));
  expect(loginLogService.safeCreateLog).toHaveBeenCalledWith(expect.objectContaining({ action: method === 'signup' ? 'signup_success' : 'login_success' }));
  expect(JSON.stringify((loginLogService.safeCreateLog as jest.Mock).mock.calls)).not.toContain('synthetic-password');
});

it.each(['/', '/login'])('restores the saved session immediately on %s without the previous five-second timer', async path => {
  window.history.replaceState({}, '', path);
  (onAuthStateChanged as jest.Mock).mockImplementation((_auth, listener) => { listener(user); return jest.fn(); });
  await open();
  expect(current.currentUser).toBe(user);
  expect(current.loading).toBe(false);
  expect(getRedirectResult).not.toHaveBeenCalled();
  expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
});

it.each([true, false])('applies remember=%s before email authentication', async remember => {
  await open();
  (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({ user });
  await act(async () => current.login('test@example.test', 'synthetic-password', remember));
  expect(setPersistence).toHaveBeenCalledWith(expect.anything(), remember ? browserLocalPersistence : browserSessionPersistence);
  expect((setPersistence as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((signInWithEmailAndPassword as jest.Mock).mock.invocationCallOrder[0]);
});

it('starts Google in the same tab and preserves the destination without logging a premature success', async () => {
  await open();
  await act(async () => current.loginWithGoogle({ returnPath: '/payroll?month=11', remember: true }));
  expect(setPersistence).toHaveBeenCalledWith(expect.anything(), browserLocalPersistence);
  expect(signInWithRedirect).toHaveBeenCalledTimes(1);
  expect(readGoogleLoginRedirect()?.returnPath).toBe('/payroll?month=11');
  expect(loginLogService.safeCreateLog).not.toHaveBeenCalled();
});

it('records a completed Google redirect once across StrictMode mounts', async () => {
  rememberGoogleLoginRedirect('/dashboard');
  (getRedirectResult as jest.Mock).mockImplementation(async () => { await Promise.resolve(); observe(user); return { user }; });
  render(<React.StrictMode><AuthProvider><Probe /></AuthProvider></React.StrictMode>);
  await waitFor(() => expect(current.currentUser).toBe(user));
  await waitFor(() => expect(loginLogService.safeCreateLog).toHaveBeenCalledTimes(1));
  expect(loginLogService.safeCreateLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'login_success', method: 'redirect' }));
  expect(readGoogleLoginRedirect()).toBeNull();
});

it('clears redirect state and permits retry if redirect startup fails', async () => {
  await open();
  (signInWithRedirect as jest.Mock).mockRejectedValueOnce({ code: 'auth/network-request-failed' });
  await act(async () => { await expect(current.loginWithGoogle()).rejects.toMatchObject({ code: 'auth/network-request-failed' }); });
  expect(readGoogleLoginRedirect()).toBeNull();
  expect(loginLogService.safeCreateLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'login_failed', method: 'redirect' }));
});

it('does not block successful login on an unresolved audit write', async () => {
  await open();
  (loginLogService.safeCreateLog as jest.Mock).mockReturnValue(new Promise(() => undefined));
  (signInWithEmailAndPassword as jest.Mock).mockImplementation(async () => { observe(user); return { user }; });
  await act(async () => { await current.login('test@example.test', 'synthetic-password'); });
  expect(current.currentUser?.uid).toBe('test-user');
});
