import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { corporateTaxService } from './corporateTaxService';
import { emptyManual } from '../pages/tax/corporateTaxModel';
import { createWorkbookLedgerService } from './workbookLedgerService';
import { accommodationService } from './accommodationService';

jest.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'test-user' } } }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn((_db, collection, id) => collection + '/' + id), getDoc: jest.fn(), runTransaction: jest.fn(), serverTimestamp: jest.fn(() => 'timestamp') }));
jest.mock('./workbookLedgerService', () => ({ createWorkbookLedgerService: jest.fn() }));
jest.mock('./accommodationService', () => ({ accommodationService: { listAllAccommodations: jest.fn(), listAllUtilityRecords: jest.fn() } }));
const getEntries = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    (doc as jest.Mock).mockImplementation((_db, collection, id) => collection + '/' + id);
    (createWorkbookLedgerService as jest.Mock).mockReturnValue({ getEntries });
    getEntries.mockResolvedValue([]);
    (accommodationService.listAllAccommodations as jest.Mock).mockResolvedValue([
        { id: 'cy', name: '청연 숙소', ownership: 'Cheongyeon' }, { id: 'dw', name: '다원 숙소', ownership: 'Dawon' },
        { id: 'person', name: '개인 숙소', ownership: 'Individual' },
    ]);
    (accommodationService.listAllUtilityRecords as jest.Mock).mockImplementation(async period => ['cy', 'dw', 'person'].map(id => ({
        id: period + id, accommodationId: id, accommodationName: id, yearMonth: period, costs: { rent: 1000, maintenance: 110, electricity: 20, total: 1130 },
    })));
});

it('없는 연도는 초기값을 사용하지만 읽기 실패를 빈 정산으로 바꾸지 않는다', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    await expect(corporateTaxService.loadManual(2026)).resolves.toEqual({ revision: 0, manual: emptyManual() });
    (getDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'));
    await expect(corporateTaxService.loadManual(2026)).rejects.toThrow('permission');
});

it('회사·연도별 문서에 수기 값을 저장하고 기존 청연 문서 경로를 보존한다', async () => {
    const documents = new Map<string, any>();
    const transaction = { get: jest.fn(async (ref: string) => ({ exists: () => documents.has(ref), data: () => documents.get(ref) })), set: jest.fn((ref: string, data: any) => documents.set(ref, data)) };
    (runTransaction as jest.Mock).mockImplementation((_db, callback) => callback(transaction));
    const manual = { ...emptyManual(), months: { 1: { amounts: { labor: 5000, salary: 2000, card: 1000 }, notes: { labor: '근거' } } } };
    await corporateTaxService.saveManual(2026, manual, 0);
    await corporateTaxService.saveManual(2026, emptyManual(), 0, 'dawon');
    await corporateTaxService.saveManual(2025, emptyManual(), 0, 'cheongyeon');
    expect(documents.get('corporate_tax_settlements/cheongyeon-2026')).toMatchObject({ company: 'cheongyeon', year: 2026, manual, revision: 1, updatedBy: 'test-user' });
    expect(documents.get('corporate_tax_settlements/dawon-2026').manual).toEqual(emptyManual());
    (getDoc as jest.Mock).mockImplementation(async ref => ({ exists: () => documents.has(ref), data: () => documents.get(ref) }));
    expect((await corporateTaxService.loadManual(2026, 'cheongyeon')).manual).toEqual(manual);
    expect((await corporateTaxService.loadManual(2026, 'dawon')).manual).toEqual(emptyManual());
    await expect(corporateTaxService.saveManual(2026, manual, 0)).rejects.toThrow('다른 화면');
    expect(transaction.set).toHaveBeenCalledTimes(3);
});

it.each(['cheongyeon', 'dawon'] as const)('%s 회사 장부와 1~12월 숙소 월세·관리비만 가져온다', async company => {
    const result = await corporateTaxService.loadSources(2026, company);
    expect(createWorkbookLedgerService).toHaveBeenCalledWith(company);
    expect(getEntries).toHaveBeenCalledWith({ startDate: '2026-01-01', endDate: '2026-12-31', force: true });
    expect(accommodationService.listAllAccommodations).toHaveBeenCalledTimes(1);
    expect(accommodationService.listAllUtilityRecords).toHaveBeenCalledTimes(12);
    expect(accommodationService.listAllUtilityRecords).toHaveBeenCalledWith('2026-01');
    expect(accommodationService.listAllUtilityRecords).toHaveBeenCalledWith('2026-12');
    expect(result.errors).toEqual({});
    expect(result.evidence).toHaveLength(12);
    expect(result.evidence.every(row => row.field === 'lodging' && row.amount === 1110 && row.label === (company === 'cheongyeon' ? '청연 숙소' : '다원 숙소'))).toBe(true);
});

it('일부 조회 실패는 정상 월을 유지하고 실패 월과 이유를 구분한다', async () => {
    getEntries.mockRejectedValue({ code: 'permission-denied' });
    (accommodationService.listAllUtilityRecords as jest.Mock).mockRejectedValueOnce({ code: 'unavailable' });
    const result = await corporateTaxService.loadSources(2026);
    expect(result.evidence).toHaveLength(11);
    expect(result.failedMonths).toEqual({ lodging: [1] });
    expect(result.errors.ledger).toContain('permission-denied');
    expect(result.errors.lodging).toContain('1월');
});

it('소유 회사 조회가 실패하면 숙소비를 0원으로 확정하지 않는다', async () => {
    (accommodationService.listAllAccommodations as jest.Mock).mockRejectedValue({ code: 'permission-denied' });
    const result = await corporateTaxService.loadSources(2026, 'dawon');
    expect(result.errors.lodging).toContain('permission-denied');
    expect(result.evidence).toEqual([]);
});

it('허용되지 않은 회사와 연도는 조회나 저장 전에 차단한다', async () => {
    await expect(corporateTaxService.loadSources(2026, 'other' as any)).rejects.toThrow('회사');
    await expect(corporateTaxService.loadManual(1999)).rejects.toThrow('연도');
    await expect(corporateTaxService.saveManual(2026, emptyManual(), 0, 'other' as any)).rejects.toThrow('회사');
    expect(doc).not.toHaveBeenCalled();
    expect(createWorkbookLedgerService).not.toHaveBeenCalled();
});
