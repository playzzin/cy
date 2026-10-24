import { reserveImageClipboardWrite } from './taxInvoiceClipboard';

const originalItem = Object.getOwnPropertyDescriptor(window, 'ClipboardItem');
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
let imagePromise: Promise<Blob>;
const write = jest.fn();
beforeEach(() => {
    write.mockReset();
    Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: class {
        constructor(items: Record<string, Promise<Blob>>) { imagePromise = items['image/png']; }
    } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
});
afterAll(() => {
    if (originalItem) Object.defineProperty(window, 'ClipboardItem', originalItem);
    else Reflect.deleteProperty(window, 'ClipboardItem');
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
});

test('렌더링 전에 권한 거부가 발생해도 미처리 거부 없이 결과를 보존한다', async () => {
    const denied = new Error('permission denied');
    write.mockRejectedValue(denied);
    const reservation = reserveImageClipboardWrite()!;
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(await reservation.result).toEqual({ ok: false, error: denied });
    reservation.cancel(denied);
    await new Promise(resolve => setTimeout(resolve, 20));
});

test('정상 복사에서는 이미지 준비를 기다려 한 번만 완료한다', async () => {
    write.mockImplementation(async () => { await imagePromise; });
    const reservation = reserveImageClipboardWrite()!;
    const blob = new Blob(['synthetic'], { type: 'image/png' });
    reservation.complete(blob); reservation.cancel(new Error('late cancel'));
    expect(await reservation.result).toEqual({ ok: true });
    expect(await imagePromise).toBe(blob); expect(write).toHaveBeenCalledTimes(1);
});

test('이미지 생성 실패와 동기식 클립보드 실패를 안전하게 처리한다', async () => {
    write.mockImplementation(async () => { await imagePromise; });
    const reservation = reserveImageClipboardWrite()!;
    const failure = new Error('render failed');
    reservation.cancel(failure);
    expect(await reservation.result).toEqual({ ok: false, error: failure });
    write.mockImplementation(() => { throw failure; });
    expect(reserveImageClipboardWrite()).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 20));
});
