import { doc, getDocFromServer, getDocsFromServer, runTransaction, where } from 'firebase/firestore';
import { auth } from '../config/firebase';
import { officeStaffPayrollService, validatePayrollMonth } from './officeStaffPayrollService';

jest.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'synthetic-finance' } } }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn((_db, collection, id) => `${collection}/${id}`), collection: jest.fn(), query: jest.fn(), where: jest.fn(), getDocFromServer: jest.fn(), getDocsFromServer: jest.fn(), runTransaction: jest.fn(), serverTimestamp: jest.fn(() => 'timestamp') }));
const data = { grossPaySnapshot: [{ id: 'a', name: '검증 직원', grossPay: 1000, baseSalary: 900, bonus: 100, payBasis: 'gross' as const }] };
beforeEach(() => {
    jest.clearAllMocks(); Object.assign(auth, { currentUser: { uid: 'synthetic-finance' } });
    (doc as jest.Mock).mockImplementation((_db, collection, id) => `${collection}/${id}`);
});
it('서버의 월 저장본과 revision을 읽으며 미저장과 조회 실패를 구분한다', async () => {
    (getDocFromServer as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ month: '2026-01', payroll: data, revision: 3 }) });
    await expect(officeStaffPayrollService.loadMonth('2026-01')).resolves.toEqual({ data, revision: 3 });
    (getDocFromServer as jest.Mock).mockResolvedValue({ exists: () => false });
    await expect(officeStaffPayrollService.loadMonth('2026-02')).resolves.toEqual({ data: null, revision: 0 });
    (getDocFromServer as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(officeStaffPayrollService.loadMonth('2026-01')).rejects.toThrow('offline');
});
it('법인세에서 요청한 연도의 공용 총급여만 조회한다', async () => {
    (getDocsFromServer as jest.Mock).mockResolvedValue({ docs: [{ id: '2026-01', data: () => ({ month: '2026-01', payroll: data, revision: 1 }) }] });
    await expect(officeStaffPayrollService.loadYear(2026)).resolves.toEqual({ '2026-01': data });
    expect(where).toHaveBeenCalledWith('year', '==', 2026);
});
it('최초 저장 후 다른 PC의 오래된 저장 요청과 중복 이전을 거부한다', async () => {
    let current: Record<string, unknown> | undefined;
    const set = jest.fn((_ref, value) => { current = value; });
    (runTransaction as jest.Mock).mockImplementation((_db, callback) => callback({ get: async () => ({ exists: () => !!current, data: () => current }), set }));
    await expect(officeStaffPayrollService.saveMonth('2026-01', data, 0)).resolves.toBe(1);
    await expect(officeStaffPayrollService.saveMonth('2026-01', data, 0)).rejects.toThrow('다른 화면');
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('office_staff_payroll/2026-01', expect.objectContaining({ year: 2026, updatedBy: 'synthetic-finance', payroll: data, revision: 1 }));
    await expect(officeStaffPayrollService.saveMonth('2026-01', data, 1)).resolves.toBe(2);
});
it.each([NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('잘못된 총급여 %s를 저장하지 않는다', async amount => {
    await expect(officeStaffPayrollService.saveMonth('2026-01', { grossPaySnapshot: [{ ...data.grossPaySnapshot[0], grossPay: amount }] }, 0)).rejects.toThrow('형식이나 금액');
    expect(runTransaction).not.toHaveBeenCalled();
});
it('인증, 월 형식, 누락된 총급여와 중복 행을 검증한다', async () => {
    await expect(officeStaffPayrollService.loadMonth('2026-13')).rejects.toThrow('지급월');
    expect(() => validatePayrollMonth({}, true)).toThrow();
    expect(() => validatePayrollMonth({ grossPaySnapshot: [...data.grossPaySnapshot, ...data.grossPaySnapshot] })).toThrow();
    Object.assign(auth, { currentUser: null });
    await expect(officeStaffPayrollService.saveMonth('2026-01', data, 0)).rejects.toThrow('로그인');
});
