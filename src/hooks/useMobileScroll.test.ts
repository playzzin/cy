import { act, renderHook } from '@testing-library/react';
import { useMobileDetailNavigation, useMobileShellScroll } from './useMobileScroll';

beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn(() => ({ matches: true })) });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 900 });
    window.scrollTo = jest.fn();
    document.body.style.cssText = '';
});

it('긴 목록에서 상세로 이동한 뒤 돌아오면 선택 전 스크롤 위치를 복원한다', () => {
    const { result } = renderHook(() => useMobileDetailNavigation<'list' | 'detail'>('list'));
    const scrollIntoView = jest.fn();
    (result.current[2] as any).current = { scrollIntoView };
    act(() => result.current[1]('detail'));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
    // A shorter detail can shrink the document and clamp its current position.
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 200 });
    act(() => result.current[1]('list'));
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 900, left: 0, behavior: 'auto' });
});

it('데스크톱의 목록/상세 전환은 스크롤 위치를 바꾸지 않는다', () => {
    (window.matchMedia as jest.Mock).mockReturnValue({ matches: false });
    const { result } = renderHook(() => useMobileDetailNavigation<'list' | 'detail'>('list'));
    const scrollIntoView = jest.fn();
    (result.current[2] as any).current = { scrollIntoView };
    act(() => result.current[1]('detail'));
    act(() => result.current[1]('list'));
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
});

it('모바일 메뉴가 열린 동안만 배경을 고정하고 닫으면 원래 스타일과 위치를 복원한다', () => {
    document.body.style.position = 'relative';
    const { rerender, unmount } = renderHook(({ open }) => useMobileShellScroll('/workers', '', 'PUSH', open, true), { initialProps: { open: false } });
    rerender({ open: true });
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-900px');
    rerender({ open: false });
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.top).toBe('');
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 900, left: 0, behavior: 'auto' });
    unmount();
});

it('메뉴를 선택하면 잠금을 해제한 후 새 화면의 맨 위로 이동한다', () => {
    const { rerender } = renderHook(({ path, open }) => useMobileShellScroll(path, '', 'PUSH', open, true), { initialProps: { path: '/workers', open: true } });
    rerender({ path: '/sites', open: false });
    expect(document.body.style.position).toBe('');
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'auto' });
});

it('브라우저 뒤로 가기, 앵커 링크, 데스크톱 탐색을 강제로 맨 위로 옮기지 않는다', () => {
    const { rerender } = renderHook(({ path, hash, type, mobile }) => useMobileShellScroll(path, hash, type, false, mobile), {
        initialProps: { path: '/workers', hash: '', type: 'PUSH', mobile: true },
    });
    rerender({ path: '/sites', hash: '', type: 'POP', mobile: true });
    rerender({ path: '/payroll', hash: '#history', type: 'PUSH', mobile: true });
    rerender({ path: '/materials', hash: '', type: 'PUSH', mobile: false });
    expect(window.scrollTo).not.toHaveBeenCalled();
});
