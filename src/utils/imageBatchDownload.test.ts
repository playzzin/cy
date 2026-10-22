import JSZip from 'jszip';
import { canSaveImageFolder, saveImageFolder, zipImageFiles } from './imageBatchDownload';

const files = [new File(['jpeg-original'], '01_테스트_신분증.jpg', { type: 'image/jpeg' }), new File(['png-original'], '02_테스트_신분증.png', { type: 'image/png' })];
const picker = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'crypto', { configurable: true, value: jest.requireActual('crypto').webcrypto });
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: picker });
});

function folderFixture() {
    const streams = files.map(() => ({ write: jest.fn().mockResolvedValue(undefined), close: jest.fn().mockResolvedValue(undefined), abort: jest.fn().mockResolvedValue(undefined) }));
    const folder = { getFileHandle: jest.fn(async (name: string) => ({ createWritable: async () => streams[files.findIndex(file => file.name === name)] })), removeEntry: jest.fn().mockResolvedValue(undefined) };
    const parent = { getDirectoryHandle: jest.fn(async (_name: string, options?: { create?: boolean }) => {
        if (!options?.create) throw new DOMException('missing', 'NotFoundError');
        return folder;
    }) };
    picker.mockResolvedValue(parent);
    return { streams, folder, parent };
}

test('명시적 폴더 선택 후 새 하위 폴더에 원본 파일들을 저장한다', async () => {
    const { streams, parent } = folderFixture();
    const operation = saveImageFolder(files, new AbortController().signal);
    expect(picker).toHaveBeenCalledWith({ mode: 'readwrite', startIn: 'downloads' });
    const result = await operation;
    expect(result.saved).toEqual(files);
    expect(result.failed).toEqual([]);
    expect(parent.getDirectoryHandle).toHaveBeenLastCalledWith(result.folderName, { create: true });
    streams.forEach((stream, index) => {
        expect(stream.write).toHaveBeenCalledWith(files[index]);
        expect(stream.close).toHaveBeenCalledTimes(1);
    });
});

test('같은 이름의 폴더가 있으면 재사용하지 않는다', async () => {
    const { folder, parent } = folderFixture();
    parent.getDirectoryHandle.mockResolvedValueOnce(folder);
    const result = await saveImageFolder(files, new AbortController().signal);
    expect(parent.getDirectoryHandle.mock.calls[0][0]).not.toBe(result.folderName);
    expect(parent.getDirectoryHandle).toHaveBeenLastCalledWith(result.folderName, { create: true });
});

test('저장 실패한 파일을 정리하고 성공한 사진과 분리해 반환한다', async () => {
    const { streams, folder } = folderFixture();
    streams[0].write.mockRejectedValue(new Error('disk-full'));
    const result = await saveImageFolder(files, new AbortController().signal);
    expect(result).toEqual({ folderName: expect.any(String), saved: [files[1]], failed: [files[0]] });
    expect(streams[0].abort).toHaveBeenCalledTimes(1);
    expect(streams[0].close).not.toHaveBeenCalled();
    expect(folder.removeEntry).toHaveBeenCalledWith(files[0].name);
});

test('폴더 선택 후 취소 신호가 있으면 파일이나 폴더를 생성하지 않는다', async () => {
    const { parent } = folderFixture();
    const controller = new AbortController();
    const operation = saveImageFolder(files, controller.signal);
    controller.abort();
    await expect(operation).rejects.toMatchObject({ name: 'AbortError' });
    expect(parent.getDirectoryHandle).not.toHaveBeenCalled();
});

test('파일 저장 중 취소하면 나머지 파일을 저장하지 않는다', async () => {
    const { streams, folder } = folderFixture();
    const controller = new AbortController();
    streams[0].write.mockImplementation(async () => { controller.abort(); });
    const result = await saveImageFolder(files, controller.signal);
    expect(result.saved).toEqual([]);
    expect(streams[0].abort).toHaveBeenCalled();
    expect(folder.getFileHandle).toHaveBeenCalledTimes(1);
    expect(streams[1].write).not.toHaveBeenCalled();
});

test('선택창 취소와 권한 오류를 숨기지 않으며 미지원 브라우저를 구분한다', async () => {
    expect(canSaveImageFolder()).toBe(true);
    picker.mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    await expect(saveImageFolder(files, new AbortController().signal)).rejects.toMatchObject({ name: 'AbortError' });
    const { parent } = folderFixture();
    parent.getDirectoryHandle.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await expect(saveImageFolder(files, new AbortController().signal)).rejects.toMatchObject({ name: 'NotAllowedError' });
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined });
    expect(canSaveImageFolder()).toBe(false);
    await expect(saveImageFolder(files, new AbortController().signal)).rejects.toThrow('folder-save-unavailable');
});

test('ZIP 압축을 풀면 각각의 원본 파일명과 바이트가 유지된다', async () => {
    const output = await zipImageFiles(files);
    const zip = await JSZip.loadAsync(output);
    expect(output.type).toBe('application/zip');
    expect(Object.keys(zip.files)).toEqual(files.map(file => file.name));
    expect(await zip.file(files[0].name)!.async('string')).toBe('jpeg-original');
    expect(await zip.file(files[1].name)!.async('string')).toBe('png-original');
});
