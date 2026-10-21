import { canShareImageFile, canShareImageFiles, imageFileFromUrl, shareImageFile, shareImageFiles } from './imageFileDelivery';

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
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['image'], { type: 'image/jpeg' }) });
    const file = await imageFileFromUrl('/test', '검증/신분증');
    expect(file.name).toBe('검증_신분증.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(file.size).toBe(5);
});
