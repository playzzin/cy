import { doc, getDocFromServer, runTransaction } from 'firebase/firestore';
import { rentalQuoteCatalog } from '../data/rentalQuoteCatalog';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { loadRentalCatalog, saveRentalCatalog } from './rentalCatalogService';
import type { RentalCatalogEntry, RentalCatalogSnapshot } from './rentalCatalogService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(),
    getDocFromServer: jest.fn(),
    runTransaction: jest.fn(),
    serverTimestamp: () => 'server-time',
}));

const path = 'settings/rental_transaction_catalog_v1';
const entry: RentalCatalogEntry = {
    materialId: 'test-shoring', workType: 'shoring', category: '시스템동바리',
    itemName: '수직재', spec: 'P-1', unit: 'EA', quantity: 3, maxQuantity: 5000,
    baseFee: 100, dailyFee: 5, active: true,
};
const snapshot = (data: unknown) => ({ exists: () => data !== undefined, data: () => data });
const mockSave = (current: RentalCatalogSnapshot | undefined) => {
    const set = jest.fn();
    (runTransaction as jest.Mock).mockImplementation(async (_, update) =>
        update({ get: async () => snapshot(current), set }));
    return set;
};

beforeEach(() => {
    jest.resetAllMocks();
    (doc as jest.Mock).mockReturnValue(path);
});

it('미등록 시 두 견적서의 초기값을 제공하고 열기만으로 서버를 변경하지 않는다', async () => {
    (getDocFromServer as jest.Mock).mockResolvedValue(snapshot(undefined));
    const result = await loadRentalCatalog();
    expect(result.revision).toBe(0);
    expect(result.entries).toHaveLength(rentalQuoteCatalog.length);
    expect(result.entries.map(entry => entry.materialId)).toEqual(rentalQuoteCatalog.map(entry => entry.materialId));
    expect(doc).toHaveBeenCalledWith({}, 'settings', 'rental_transaction_catalog_v1');
    expect(runTransaction).not.toHaveBeenCalled();
});

it('저장된 공유 설정으로 기본값을 대체하며 빈 목록도 그대로 유지한다', async () => {
    for (const entries of [[entry], []]) {
        const saved = { revision: 3, entries };
        (getDocFromServer as jest.Mock).mockResolvedValue(snapshot(saved));
        expect(await loadRentalCatalog()).toEqual(saved);
    }
});

it('권한 거절과 서버 오류를 미등록으로 처리하지 않는다', async () => {
    (getDocFromServer as jest.Mock).mockRejectedValueOnce({ code: 'permission-denied' });
    await expect(loadRentalCatalog()).rejects.toThrow('불러올 권한');
    (getDocFromServer as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(loadRentalCatalog()).rejects.toThrow('offline');
    expect(runTransaction).not.toHaveBeenCalled();
});

it('명시적 최초 등록과 후속 변경은 임대 전용 문서에만 원자적으로 저장한다', async () => {
    const setInitial = mockSave(undefined);
    const saved = await saveRentalCatalog([entry], 0);
    expect(saved).toEqual({ revision: 1, entries: [entry] });
    expect(setInitial).toHaveBeenCalledWith(path, { ...saved, updatedAt: 'server-time' });
    const setUpdated = mockSave(saved);
    const updated = await saveRentalCatalog([{ ...entry, quantity: 8, dailyFee: 11 }], 1);
    expect(updated).toEqual({ revision: 2, entries: [{ ...entry, quantity: 8, dailyFee: 11 }] });
    expect(setUpdated).toHaveBeenCalledWith(path, { ...updated, updatedAt: 'server-time' });
    expect((doc as jest.Mock).mock.calls.map(call => call.slice(1))).toEqual([
        ['settings', 'rental_transaction_catalog_v1'], ['settings', 'rental_transaction_catalog_v1'],
    ]);
});

it.each([0, 2])('오래된 리비전 %i로 최초 등록이나 변경을 시도해도 최신 설정을 보존한다', async revision => {
    const set = mockSave({ revision: 3, entries: [entry] });
    await expect(saveRentalCatalog([entry], revision)).rejects.toThrow('최신 설정');
    expect(set).not.toHaveBeenCalled();
});

it('잘못된 행과 중복 ID, 미기재 단가의 활성화는 저장 전 거절한다', async () => {
    for (const entries of [
        [entry, entry], [{ ...entry, quantity: 0 }], [{ ...entry, baseFee: -1 }],
        [{ ...entry, dailyFee: Number.NaN }], [{ ...entry, itemName: ' ' }],
        [{ ...entry, dailyFeeMissing: true, dailyFee: 0 }],
    ]) await expect(saveRentalCatalog(entries, 0)).rejects.toThrow('품목·규격');
    expect(runTransaction).not.toHaveBeenCalled();
});

it('미기재 단가와 명시적으로 등록한 0원을 구분한다', async () => {
    mockSave(undefined);
    const missing = { ...entry, dailyFeeMissing: true, dailyFee: 0, active: false };
    const zero = { ...entry, materialId: 'zero', dailyFee: 0 };
    const result = await saveRentalCatalog([missing, zero], 0);
    expect(result.entries).toEqual([missing, zero]);
});

it('저장 권한이 없거나 기존 자료 형식이 손상됐을 때 초기값을 덮어쓰지 않는다', async () => {
    (runTransaction as jest.Mock).mockRejectedValueOnce({ code: 'permission-denied' });
    await expect(saveRentalCatalog([entry], 0)).rejects.toThrow('관리자 계정');
    const set = mockSave({ revision: 0, entries: [] });
    await expect(saveRentalCatalog([entry], 0)).rejects.toThrow('저장 형식');
    expect(set).not.toHaveBeenCalled();
});

it('개발 미리보기의 등록·재조회·충돌 검사는 해당 브라우저에만 적용된다', async () => {
    (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
    const request = jest.fn(async (_key, work) => work());
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
    try {
        expect((await loadRentalCatalog()).revision).toBe(0);
        const saved = await saveRentalCatalog([entry], 0);
        await expect(loadRentalCatalog()).resolves.toEqual(saved);
        await expect(saveRentalCatalog([entry], 0)).rejects.toThrow('최신 설정');
        expect(request).toHaveBeenCalledTimes(2);
        expect(runTransaction).not.toHaveBeenCalled();
        expect(getDocFromServer).not.toHaveBeenCalled();
        (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
        (getDocFromServer as jest.Mock).mockResolvedValue(snapshot(undefined));
        expect((await loadRentalCatalog()).revision).toBe(0);
    } finally {
        Reflect.deleteProperty(navigator, 'locks');
        localStorage.removeItem('cy_dev_rental_transaction_catalog_v1');
    }
});
