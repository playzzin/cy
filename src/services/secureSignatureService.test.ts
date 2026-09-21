import { resolveSecureSignature, signatureStoragePath } from './secureSignatureService';
import { auth } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'owner' } }, functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
const mockedCall = httpsCallable as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); (auth as any).currentUser = { uid: 'owner' }; });
test('기존 공개 URL과 새 비공개 주소를 같은 보호 경로로 해석한다', () => {
    expect(signatureStoragePath('gs://fixture/signatures/worker/image.png')).toBe('signatures/worker/image.png');
    expect(signatureStoragePath('https://firebasestorage.googleapis.com/v0/b/fixture/o/signatures%2Fworker_123.png?alt=media&token=synthetic')).toBe('signatures/worker_123.png');
    expect(signatureStoragePath('data:image/png;base64,fixture')).toBeNull();
});
test('동시 요청만 공유하며 완료된 서명을 권한 확인 없이 재사용하지 않는다', async () => {
    const call = jest.fn().mockResolvedValue({ data: { dataUrl: 'data:image/png;base64,fixture' } });
    mockedCall.mockReturnValue(call);
    const source = 'gs://fixture/signatures/worker/image.png';
    await Promise.all([resolveSecureSignature(source), resolveSecureSignature(source)]);
    expect(call).toHaveBeenCalledTimes(1);
    await resolveSecureSignature(source);
    expect(call).toHaveBeenCalledTimes(2);
});
test('조회 중 계정이 바뀌면 이전 계정의 서명 응답을 거부한다', async () => {
    let finish!: (value: unknown) => void;
    mockedCall.mockReturnValue(() => new Promise(resolve => { finish = resolve; }));
    const pending = resolveSecureSignature('gs://fixture/signatures/worker/image.png');
    (auth as any).currentUser = { uid: 'other' };
    finish({ data: { dataUrl: 'private' } });
    await expect(pending).rejects.toThrow('로그인 계정이 변경');
});
