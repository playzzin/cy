import React from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useIssueNavigationGuard } from './useIssueNavigationGuard';

function Draft({ canLeave }: { canLeave: () => boolean }) {
    useIssueNavigationGuard(true, canLeave);
    return <div>입력 중</div>;
}
afterEach(() => { jest.restoreAllMocks(); window.history.replaceState(null, ''); });

test.each([false, true])('브라우저 뒤로가기는 URL 복원 후 확인 결과(%s)에 따라 이동한다', allowed => {
    window.history.replaceState({ idx: 1 }, '');
    const go = jest.spyOn(window.history, 'go').mockImplementation(() => {});
    const canLeave = jest.fn(() => allowed);
    const view = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Draft canLeave={canLeave} /></MemoryRouter>);
    const routerListener = jest.fn();
    window.addEventListener('popstate', routerListener);
    act(() => window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 0 } })));
    expect(canLeave).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith(1);
    expect(routerListener).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 1 } })));
    expect(routerListener).not.toHaveBeenCalled();
    if (allowed) {
        act(() => window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 0 } })));
    }
    expect(go.mock.calls).toEqual(allowed ? [[1], [-1]] : [[1]]);
    expect(routerListener).toHaveBeenCalledTimes(allowed ? 1 : 0);
    expect(canLeave).toHaveBeenCalledTimes(1);
    view.unmount();
    window.removeEventListener('popstate', routerListener);
});

test('브라우저 닫기 경고는 마운트 중에만 적용한다', () => {
    const view = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Draft canLeave={() => false} /></MemoryRouter>);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    view.unmount();
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after); expect(after.defaultPrevented).toBe(false);
});
