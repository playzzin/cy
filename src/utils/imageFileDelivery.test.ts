import { canShareImageFile, canShareImageFiles, imageFileFromUrl, shareImageFile, shareImageFiles } from './imageFileDelivery';

test('브라우저가 허용한다고 응답해도 사진 10장 또는 총 50MiB를 넘는 요청은 묶음에서 제외한다', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Chrome/133.0' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: jest.fn() });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    const photo = new File(['test'], 'sample.jpg', { type: 'image/jpeg' });
    Object.defineProperty(photo, 'size', { value: 5 * 1024 * 1024 });
    const extra = new File(['a'], 'extra.jpg', { type: 'image/jpeg' });
    expect(canShareImageFiles(Array(10).fill(photo))).toBe(true);
    expect(canShareImageFiles(Array(11).fill(extra))).toBe(false);
    const large = new File(['large'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(large, 'size', { value: 50 * 1024 * 1024 });
    expect(canShareImageFiles([large, extra])).toBe(false);
});

test('Chromium이 아닌 기기가 받아주는 120장과 50MiB 초과 묶음에는 앱 한도를 적용하지 않는다', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Version/18.0 Mobile Safari/605.1' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: jest.fn() });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    const file = new File(['test'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 51 * 1024 * 1024 });
    expect(canShareImageFiles(Array(120).fill(file))).toBe(true);
});

test('여러 이미지의 전체 묶음 지원 여부를 검사하고 사진 파일만 전달한다', async () => {
    const files = [new File(['a'], 'one.png', { type: 'image/png' }), new File(['b'], 'two.jpg', { type: 'image/jpeg' })];
    const share = jest.fn().mockResolvedValue(undefined);
    const canShare = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
    expect(canShareImageFiles([])).toBe(false);
    expect(canShareImageFiles(files)).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ files });
    await shareImageFiles(files);
    expect(share).toHaveBeenCalledWith({ files });
    canShare.mockImplementation(() => { throw new Error('unsupported'); });
    expect(canShareImageFiles(files)).toBe(false);
});

test('파일 공유 데이터에 주소와 텍스트를 포함하지 않는다', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    const file = new File(['image'], '검증.png', { type: 'image/png' });
    expect(canShareImageFile(file)).toBe(true);
    await shareImageFile(file);
    expect(share).toHaveBeenCalledWith({ files: [file] });
});

test('조회 실패나 이미지가 아닌 응답은 공유 파일로 만들지 않는다', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    await expect(imageFileFromUrl('/test', '검증')).rejects.toThrow('image-load-failed');
    (fetch as jest.Mock).mockResolvedValue({ ok: true, blob: async () => new Blob(['error'], { type: 'text/html' }) });
    await expect(imageFileFromUrl('/test', '검증')).rejects.toThrow('unsupported-image');
});

test('원본 이미지의 형식과 내용을 유지하고 파일명을 정리한다', async () => {
    const bytes = new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4, 5, 6, 7, 8, 255, 217]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob([bytes], { type: 'image/jpeg' }) });
    const file = await imageFileFromUrl('/test', '검증/신분증');
    expect(file.name).toBe('검증_신분증.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(file.size).toBe(bytes.length);
    expect(await readBytes(file)).toEqual(bytes);
});

const readBytes = (blob: Blob): Promise<Uint8Array> => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer)); reader.onerror = reject; reader.readAsArrayBuffer(blob);
});

test.each([
    ['image/png', [255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0], 'image/jpeg', 'jpg'],
    ['image/jpeg', [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0], 'image/png', 'png'],
    ['image/jpeg', [71, 73, 70, 56, 57, 97, 0, 0, 0, 0, 0, 0], 'image/gif', 'gif'],
    ['image/png', [71, 73, 70, 56, 55, 97, 0, 0, 0, 0, 0, 0], 'image/gif', 'gif'],
    ['application/octet-stream', [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80], 'image/webp', 'webp'],
    ['', [66, 77, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'image/bmp', 'bmp'],
    ['image/jpg', [255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0], 'image/jpeg', 'jpg'],
])('잘못된 형식 정보 %s 대신 원본 시그니처의 %s 형식을 사용한다', async (declared, content, actual, extension) => {
    const bytes = new Uint8Array(content as number[]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob([bytes], { type: declared as string }) });
    const file = await imageFileFromUrl('/synthetic', '가상 사진');
    expect(file.type).toBe(actual); expect(file.name).toBe(`가상 사진.${extension}`);
    expect(await readBytes(file)).toEqual(bytes);
});

test.each(['<html>not an image</html>', '<svg xmlns="http://www.w3.org/2000/svg"></svg>', '%PDF-1.7 document', 'RIFF0000WAVE0000', 'short'])('사진이라고 표시된 다른 내용은 전달하지 않는다: %s', async content => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob([content], { type: 'image/jpeg' }) });
    await expect(imageFileFromUrl('/synthetic', '가상 사진')).rejects.toThrow('unsupported-image');
});

test('사진을 받은 뒤 취소되면 공유 파일을 만들지 않는다', async () => {
    const controller = new AbortController();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => { controller.abort(); return new Blob([new Uint8Array(12)]); } });
    await expect(imageFileFromUrl('/synthetic', '가상 사진', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});
