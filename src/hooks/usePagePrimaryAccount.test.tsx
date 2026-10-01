import { act, renderHook } from '@testing-library/react';
import { ensurePagePrimaryAccountReady, usePagePrimaryAccount } from './usePagePrimaryAccount';
import { primaryAccountService, PrimaryAccountScope, PrimaryAccountSetting } from '../services/primaryAccountService';

jest.mock('../services/primaryAccountService', () => ({
    PRIMARY_ACCOUNT_PAGES: [{ id: 'monthly-wage', useCommon: true }, { id: 'client-site-labor', useCommon: true }, { id: 'support-team', useCommon: false }],
    primaryAccountService: { subscribe: jest.fn() },
}));

type Subscription = { scope: PrimaryAccountScope; receive: (account: PrimaryAccountSetting | null) => void; fail: () => void; stop: jest.Mock };
let subscriptions: Subscription[];
const account = (number: string): PrimaryAccountSetting => ({ sourceType: 'custom', sourceId: '', sourceName: '검증', bankName: '샘플은행', accountHolder: '테스트', accountNumber: number });
const emit = (scope: PrimaryAccountScope, value: PrimaryAccountSetting | null) => act(() => subscriptions.filter(item => item.scope === scope).forEach(item => item.receive(value)));

beforeEach(() => {
    subscriptions = [];
    (primaryAccountService.subscribe as jest.Mock).mockImplementation((receive, fail, scope = 'common') => {
        const stop = jest.fn(); subscriptions.push({ scope, receive, fail, stop }); return stop;
    });
});

it('계좌를 확인하지 못한 상태에서는 출력하지 않도록 안내한다', () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { result } = renderHook(() => usePagePrimaryAccount('monthly-wage'));
    expect(ensurePagePrimaryAccountReady(result.current)).toBe(false);
    emit('monthly-wage', account('READY'));
    expect(ensurePagePrimaryAccountReady(result.current)).toBe(true);
    act(() => subscriptions[0].fail());
    expect(ensurePagePrimaryAccountReady(result.current)).toBe(false);
    expect(alert).toHaveBeenCalledTimes(2);
    alert.mockRestore();
});

it('공통계좌가 먼저 도착해도 페이지 계좌 확인 전에는 적용하지 않는다', () => {
    const { result } = renderHook(() => usePagePrimaryAccount('monthly-wage'));
    emit('common', account('COMMON'));
    expect(result.current.loading).toBe(true);
    expect(result.current.account).toBeNull();
    emit('monthly-wage', account('PAGE'));
    expect(result.current.account?.accountNumber).toBe('PAGE');
    expect(result.current.usesCommon).toBe(false);
    emit('common', account('CHANGED-COMMON'));
    expect(result.current.account?.accountNumber).toBe('PAGE');
});

it('전용계좌가 없는 기존 페이지에서만 공통계좌를 사용한다', () => {
    const { result: monthlyResult } = renderHook(() => usePagePrimaryAccount('monthly-wage'));
    const { result: supportResult } = renderHook(() => usePagePrimaryAccount('support-team'));
    emit('common', account('COMMON')); emit('monthly-wage', null); emit('support-team', null);
    expect(monthlyResult.current.account?.accountNumber).toBe('COMMON');
    expect(monthlyResult.current.usesCommon).toBe(true);
    expect(supportResult.current.account).toBeNull();
    expect(supportResult.current.loading).toBe(false);
});

it('계좌 관리 변경을 같은 페이지 구독자에게 전달하고 다른 페이지는 유지한다', () => {
    const { result: pageResult } = renderHook(() => usePagePrimaryAccount('monthly-wage'));
    const { result: managerResult } = renderHook(() => usePagePrimaryAccount('monthly-wage'));
    const { result: otherResult } = renderHook(() => usePagePrimaryAccount('client-site-labor'));
    emit('monthly-wage', account('A')); emit('client-site-labor', account('B'));
    emit('monthly-wage', account('NEW-A'));
    expect(pageResult.current.account?.accountNumber).toBe('NEW-A');
    expect(managerResult.current.account?.accountNumber).toBe('NEW-A');
    expect(otherResult.current.account?.accountNumber).toBe('B');
});

it('읽기 오류를 미설정으로 취급하지 않고 재시도하며 페이지 전환 시 이전 계좌를 제거한다', () => {
    const { result, rerender, unmount } = renderHook(({ scope }) => usePagePrimaryAccount(scope), { initialProps: { scope: 'monthly-wage' as PrimaryAccountScope } });
    emit('common', account('COMMON'));
    act(() => subscriptions[0].fail());
    expect(result.current.error).toBeTruthy(); expect(result.current.account).toBeNull();
    act(() => result.current.retry());
    expect(subscriptions[0].stop).toHaveBeenCalled();
    emit('monthly-wage', account('A'));
    rerender({ scope: 'support-team' });
    expect(result.current.account).toBeNull(); expect(result.current.loading).toBe(true);
    emit('support-team', account('B'));
    expect(result.current.account?.accountNumber).toBe('B');
    unmount();
    expect(subscriptions.every(item => item.stop.mock.calls.length === 1)).toBe(true);
});
