import { WorkerRegistrationSaveSession } from './workerRegistrationSave';
import { deleteWorkerBankPhoto, saveWorkerBankPhoto } from './workerBankPhotoService';
jest.mock('./workerBankPhotoService', () => ({ saveWorkerBankPhoto: jest.fn(), deleteWorkerBankPhoto: jest.fn() }));
jest.mock('./aiSettingsService', () => ({ aiSettingsService: {} }));
const file = new File(['synthetic'], 'bank.png', { type: 'image/png' });
const data = { name: '가상작업자', accountNumber: '0011223344' };
beforeEach(() => { jest.resetAllMocks(); (saveWorkerBankPhoto as jest.Mock).mockImplementation(async (_id, _file, id) => id); });

test('두 사진 중 하나가 실패해도 재등록하거나 완료한 사진을 다시 저장하지 않는다', async () => {
    const session = new WorkerRegistrationSaveSession(), persist = jest.fn().mockResolvedValue({ id: 'new-worker' });
    const photos = { default: { file, id: 'basic' }, directPay: { file, id: 'direct' } };
    (saveWorkerBankPhoto as jest.Mock).mockResolvedValueOnce('basic').mockRejectedValueOnce(new Error('업로드 실패'));
    await expect(session.save(data, photos, persist)).rejects.toThrow('업로드 실패');
    expect(session.didSave).toBe(true);
    await expect(session.save(data, photos, persist)).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(saveWorkerBankPhoto).toHaveBeenCalledTimes(3);
    expect(saveWorkerBankPhoto).toHaveBeenLastCalledWith('new-worker', file, 'direct', '', 'directPay');
    await session.save({ ...data, accountNumber: '0099887766' }, photos, persist);
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ accountNumber: '0099887766' }), 'new-worker');
    expect(saveWorkerBankPhoto).toHaveBeenCalledTimes(3);
});

test('수정 시 오래된 사진 참조를 일반 저장에서 제외하고 사진 삭제는 원래 버전으로 요청한다', async () => {
    const initial = { id: 'existing', ...data, bankPhotoId: 'old-basic', directPayBankPhotoId: 'old-direct' };
    const session = new WorkerRegistrationSaveSession(initial), persist = jest.fn().mockResolvedValue({ id: 'existing' });
    await session.save({ ...initial, bankPhotoId: '', directPayBankPhotoId: '' }, { default: null, directPay: null }, persist);
    expect(persist).toHaveBeenCalledWith({ id: 'existing', ...data }, 'existing');
    expect(deleteWorkerBankPhoto).toHaveBeenNthCalledWith(1, 'existing', 'old-basic', 'default');
    expect(deleteWorkerBankPhoto).toHaveBeenNthCalledWith(2, 'existing', 'old-direct', 'directPay');
    await session.save({ ...initial, bankPhotoId: '', directPayBankPhotoId: '' }, { default: null, directPay: null }, persist);
    expect(deleteWorkerBankPhoto).toHaveBeenCalledTimes(2);
});

test('중복 등록 취소는 사진 저장을 시작하지 않는다', async () => {
    const session = new WorkerRegistrationSaveSession();
    expect(await session.save(data, { default: { file, id: 'new' } }, jest.fn().mockResolvedValue(null))).toBe(false);
    expect(session.didSave).toBe(false);
    expect(saveWorkerBankPhoto).not.toHaveBeenCalled();
});

test('중복 작업자 수정은 기존 사진 버전을 사용하고 사진 교체 후 삭제도 가능하다', async () => {
    const session = new WorkerRegistrationSaveSession(), persist = jest.fn().mockResolvedValue({ id: 'duplicate', bankPhotoId: 'old' });
    await session.save(data, { default: { file, id: 'new' } }, persist);
    expect(saveWorkerBankPhoto).toHaveBeenCalledWith('duplicate', file, 'new', 'old', 'default');
    await session.save(data, { default: null }, persist);
    expect(deleteWorkerBankPhoto).toHaveBeenCalledWith('duplicate', 'new', 'default');
});
