import { canShareImageFile, imageFileFromUrl, shareImageFile } from './imageFileDelivery';

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
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image'], { type: 'image/jpeg' }) });
    const file = await imageFileFromUrl('/test', '검증/신분증');
    expect(file.name).toBe('검증_신분증.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(file.size).toBe(5);
});
