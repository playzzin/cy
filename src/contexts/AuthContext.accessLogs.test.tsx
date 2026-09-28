import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { AuthProvider, useAuth } from './AuthContext';
import { loginLogService } from '../services/loginLogService';
import { loginAccessTracker } from '../services/loginAccessTracker';

jest.mock('../config/firebaseAuth', () => ({ auth: { currentUser: null } }));
jest.mock('../services/loginLogService', () => ({ loginLogService: { safeCreateLog: jest.fn() } }));
jest.mock('../services/userService', () => ({ userService: { saveUser: jest.fn() } }));
jest.mock('../utils/devAdminSession', () => ({ createDevAdminUser: () => null, isDevAdminSessionEnabled: () => false, disableDevAdminSession: jest.fn() }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(), signInWithEmailAndPassword: jest.fn(), createUserWithEmailAndPassword: jest.fn(), signInWithPopup: jest.fn(),
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

it.each(['password', 'google', 'signup'] as const)('records %s authentication without duplicating it as an app re-entry', async (method) => {
  await open();
  const signIn = method === 'password' ? signInWithEmailAndPassword : method === 'google' ? signInWithPopup : createUserWithEmailAndPassword;
  (signIn as jest.Mock).mockImplementation(async () => { observe(user); return { user }; });
  await act(async () => {
    if (method === 'password') await current.login('test@example.test', 'synthetic-password');
    else if (method === 'google') await current.loginWithGoogle();
    else await current.signup('test@example.test', 'synthetic-password');
  });
  await waitFor(() => expect(loginLogService.safeCreateLog).toHaveBeenCalledTimes(1));
  expect(loginLogService.safeCreateLog).toHaveBeenCalledWith(expect.objectContaining({ action: method === 'signup' ? 'signup_success' : 'login_success' }));
  expect(JSON.stringify((loginLogService.safeCreateLog as jest.Mock).mock.calls)).not.toContain('synthetic-password');
});

it('does not block successful login on an unresolved audit write', async () => {
  await open();
  (loginLogService.safeCreateLog as jest.Mock).mockReturnValue(new Promise(() => undefined));
  (signInWithEmailAndPassword as jest.Mock).mockImplementation(async () => { observe(user); return { user }; });
  await act(async () => { await current.login('test@example.test', 'synthetic-password'); });
  expect(current.currentUser?.uid).toBe('test-user');
});
