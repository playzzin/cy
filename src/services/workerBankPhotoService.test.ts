import { httpsCallable } from 'firebase/functions';
import { auth } from '../config/firebase';
import { readWorkerBankPhoto, saveWorkerBankPhoto, validateWorkerBankPhoto } from './workerBankPhotoService';
jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'test' } }, functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('./teamScopedReadService', () => ({ invalidateTeamScopedCache: jest.fn() }));
jest.mock('../utils/workerCacheRevision', () => ({ invalidateWorkerCache: jest.fn() }));
const call = jest.fn();
test('직불용 사진은 구버전 서버가 기본 사진으로 처리할 수 없는 별도 액션을 사용한다', async () => {
    call.mockResolvedValueOnce({ data: { photoId: 'new-direct' } }).mockResolvedValueOnce({ data: { photo: null } });
    const file = new File(['original-bytes'], 'raw.jpg', { type: 'image/jpeg' });
    await saveWorkerBankPhoto('one', file, 'new-direct', 'old-direct', 'directPay');
    await readWorkerBankPhoto('one', 'direct', undefined, 'directPay');
    expect(call).toHaveBeenNthCalledWith(1, { action: 'saveDirectPay', workerId: 'one', photoId: 'new-direct', expectedPhotoId: 'old-direct', base64: btoa('original-bytes') });
    expect(call).toHaveBeenNthCalledWith(2, { action: 'readDirectPay', workerId: 'one' });
});
beforeEach(() => { jest.clearAllMocks(); (auth as any).currentUser = { uid: 'test' }; (httpsCallable as jest.Mock).mockReturnValue(call); });
test('원본 바이트를 업로드하고 워커·예상 버전 외 다른 작업자 필드는 보내지 않는다', async () => {
    call.mockResolvedValue({ data: { photoId: 'new' } });
    const file = new File(['original-bytes'], 'raw.jpg', { type: 'image/jpeg' });
    expect(await saveWorkerBankPhoto('one', file, 'new', 'old')).toBe('new');
    expect(call).toHaveBeenCalledWith({ action: 'save', workerId: 'one', photoId: 'new', expectedPhotoId: 'old', base64: btoa('original-bytes') });
});
test('미등록 사진은 null이며 파일을 읽는 도중 계정이 바뀌면 폐기한다', async () => {
    call.mockResolvedValueOnce({ data: { photo: null } });
    expect(await readWorkerBankPhoto('one', '01_test')).toBeNull();
    call.mockImplementationOnce(async () => { (auth as any).currentUser = { uid: 'other' }; return { data: { photo: null } }; });
    await expect(readWorkerBankPhoto('one', 'test')).rejects.toThrow('계정이 변경');
});
test('수신한 원본은 별도 파일로 만들고 취소된 조회는 시작하지 않는다', async () => {
    call.mockResolvedValue({ data: { photo: { contentType: 'image/png', base64: btoa('original-bytes'), photoId: 'x' } } });
    const file = await readWorkerBankPhoto('one', '01_가상_계좌사진');
    expect(file?.name).toBe('01_가상_계좌사진.png'); expect(file?.size).toBe(14);
    const controller = new AbortController(); controller.abort();
    await expect(readWorkerBankPhoto('one', 'test', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(call).toHaveBeenCalledTimes(1);
    expect(() => validateWorkerBankPhoto(new File(['x'], 'x.pdf', { type: 'application/pdf' }))).toThrow();
});
