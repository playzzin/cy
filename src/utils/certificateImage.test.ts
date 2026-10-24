import html2canvas from 'html2canvas';
import { captureCertificateImage, certificateImageFilename } from './certificateImage';

jest.mock('html2canvas', () => jest.fn());
const capture = html2canvas as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('모바일 축소와 스크롤 컨테이너를 벗어나 원본 A4 크기로 캡처한다', async () => {
    const element = document.createElement('div');
    element.style.transform = 'scale(.3)';
    const parent = document.createElement('div');
    parent.append(element);
    capture.mockImplementation(async (_element, options) => {
        const clone = element.cloneNode(true) as HTMLElement;
        await options.onclone(document, clone);
        expect(clone.parentNode).toBe(document.body);
        expect(clone.style.width).toBe('210mm');
        expect(clone.style.transform).toBe('none');
        clone.remove();
        return { toBlob: (next: (blob: Blob) => void) => next(new Blob(['image'])) };
    });
    expect((await captureCertificateImage(element)).size).toBeGreaterThan(0);
    expect(capture).toHaveBeenCalledWith(element, expect.objectContaining({ scale: 2, allowTaint: false }));
    expect(element.parentNode).toBe(parent);
    expect(element.style.transform).toBe('scale(.3)');
});

it('직인 다운로드가 실패하면 도장 없는 이미지를 공유하지 않는다', async () => {
    const element = document.createElement('div');
    element.innerHTML = '<img src="https://example.invalid/stamp.png" alt="직인" />';
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    try {
        await expect(captureCertificateImage(element)).rejects.toThrow();
        expect(capture).not.toHaveBeenCalled();
    } finally { global.fetch = originalFetch; }
});

it.each([false, true])('글꼴 측정 이미지만 인라인으로 배치하고 캡처 후 원복한다 (실패: %s)', async fail => {
    const reset = document.createElement('style');
    reset.textContent = 'img { display: block; }';
    document.head.append(reset);
    const element = document.createElement('div');
    const stamp = document.createElement('img');
    stamp.width = 80;
    stamp.height = 80;
    document.body.append(stamp);
    const measurement = document.createElement('div');
    measurement.style.visibility = 'hidden';
    const probe = document.createElement('img');
    probe.width = 1;
    probe.height = 1;
    measurement.append(probe);
    document.body.append(measurement);
    const styleCount = document.head.querySelectorAll('style').length;
    capture.mockImplementation(async () => {
        expect(getComputedStyle(probe).display).toBe('inline-block');
        expect(getComputedStyle(stamp).display).toBe('block');
        if (fail) throw new Error('capture failed');
        return { toBlob: (next: (blob: Blob) => void) => next(new Blob(['image'])) };
    });
    try {
        const outcome = await captureCertificateImage(element).then(() => 'captured', (error: Error) => error.message);
        expect(outcome).toBe(fail ? 'capture failed' : 'captured');
        expect(document.head.querySelectorAll('style')).toHaveLength(styleCount);
        expect(getComputedStyle(probe).display).toBe('block');
        expect(getComputedStyle(stamp).display).toBe('block');
    } finally {
        reset.remove();
        measurement.remove();
        stamp.remove();
    }
});

it('파일 이름에 경로 제어 문자와 금지 문자를 넣지 않는다', () => {
    expect(certificateImageFilename('재직증명서_a/b:c\n')).toBe('재직증명서_a_b_c_.png');
});
