import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import { useTeamSettlementAccess } from './useTeamSettlementAccess';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/userService', () => ({ userService: { getUser: jest.fn() } }));

beforeEach(() => { jest.clearAllMocks(); });

test('프로필 확인 전·사용자 전환·조회 실패에는 기존 쓰기 권한을 재사용하지 않는다', async () => {
  jest.mocked(useAuth).mockReturnValue({ currentUser: { uid: 'first' } } as any);
  let resolve!: (profile: any) => void;
  jest.mocked(userService.getUser).mockReturnValue(new Promise(done => { resolve = done; }));
  const { result, rerender } = renderHook(() => useTeamSettlementAccess());
  expect(result.current).toEqual({ loading: true, canWrite: false });
  await act(async () => { resolve({ position: 'ceo', status: 'active' }); });
  expect(result.current.canWrite).toBe(true);
  expect(userService.getUser).toHaveBeenCalledWith('first', true);
  jest.mocked(useAuth).mockReturnValue({ currentUser: { uid: 'second' } } as any);
  jest.mocked(userService.getUser).mockRejectedValue(new Error('unavailable'));
  rerender();
  expect(result.current.canWrite).toBe(false);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.canWrite).toBe(false);
  jest.mocked(useAuth).mockReturnValue({ currentUser: null } as any);
  rerender();
  expect(result.current).toEqual({ loading: false, canWrite: false });
});
