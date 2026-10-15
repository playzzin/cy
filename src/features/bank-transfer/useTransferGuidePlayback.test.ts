import { act, renderHook } from '@testing-library/react';
import useTransferGuidePlayback, { guidePhaseDuration } from './useTransferGuidePlayback';
import { DEMO_SCRIPTS } from './transferGuideSimulation';

const motion = window.matchMedia;
const hidden = Object.getOwnPropertyDescriptor(document, 'hidden');
beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
});
afterEach(() => {
    jest.useRealTimers();
    if (hidden) Object.defineProperty(document, 'hidden', hidden);
    else delete (document as unknown as { hidden?: boolean }).hidden;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: motion });
});
const advance = (milliseconds: number) => act(() => { jest.advanceTimersByTime(milliseconds); });

it('사용자가 재생하기 전에는 진행하지 않고 위치 안내, 조작, 결과 순서를 지킨다', () => {
    const { result } = renderHook(() => useTransferGuidePlayback(DEMO_SCRIPTS[4]));
    advance(30000);
    expect(result.current.phase).toBe('focus');
    act(() => result.current.toggle());
    advance(1049);
    expect(result.current.phase).toBe('focus');
    advance(1);
    expect(result.current.phase).toBe('act');
    advance(420);
    expect(result.current.phase).toBe('result');
    advance(guidePhaseDuration(DEMO_SCRIPTS[4][0], 'result'));
    expect(result.current.index).toBe(1);
    expect(result.current.phase).toBe('focus');
});

it('일시정지와 속도 변경 이후에도 이미 지난 시간을 반복하지 않는다', () => {
    const { result } = renderHook(() => useTransferGuidePlayback(DEMO_SCRIPTS[0]));
    act(() => result.current.toggle());
    advance(400);
    act(() => result.current.pause());
    advance(20000);
    act(() => { result.current.setSpeed(.75); result.current.toggle(); });
    advance(850);
    expect(result.current.phase).toBe('focus');
    advance(20);
    expect(result.current.phase).toBe('act');
});

it('다른 탭으로 이동한 시간은 시연 시간에서 제외하고 같은 지점에서 재개한다', () => {
    const { result } = renderHook(() => useTransferGuidePlayback(DEMO_SCRIPTS[0]));
    act(() => result.current.toggle()); advance(500);
    act(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    advance(60000);
    expect(result.current.phase).toBe('focus');
    act(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    advance(550);
    expect(result.current.phase).toBe('act');
});

it('마지막 결과를 읽을 시간을 준 뒤 멈추고 다시 보기는 처음부터 시작한다', () => {
    const script = DEMO_SCRIPTS[4];
    const { result } = renderHook(() => useTransferGuidePlayback(script));
    act(() => result.current.seek(script.length - 1));
    act(() => result.current.toggle());
    advance(guidePhaseDuration(script[script.length - 1], 'result'));
    expect(result.current.finished).toBe(true);
    expect(result.current.playing).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.index).toBe(0);
    expect(result.current.phase).toBe('focus');
});
