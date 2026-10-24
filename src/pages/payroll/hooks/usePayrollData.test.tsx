import { act, renderHook, waitFor } from '@testing-library/react';
import { usePayrollData } from './usePayrollData';
import { dailyReportService } from '../../../services/dailyReportService';
import { manpowerService } from '../../../services/manpowerService';
import { siteService } from '../../../services/siteService';

jest.mock('../../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: jest.fn() } }));
jest.mock('../../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../../services/siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('../../../services/teamService', () => ({ teamService: { getTeams: async () => [{ id: 'team', name: '검증팀' }] } }));
jest.mock('../../../services/payrollConfigService', () => ({
    payrollConfigService: { getConfig: async () => ({ deductionItems: [], insuranceConfig: {} }) }, DEFAULT_ADVANCE_ITEM_LABELS: {},
}));
jest.mock('../../../services/advancePaymentService', () => ({ advancePaymentService: { getAdvancePaymentsByYearMonth: async () => [] } }));

const deferred = () => {
    let resolve!: (reports: any[]) => void;
    const promise = new Promise<any[]>(done => { resolve = done; });
    return { resolve, promise };
};
const reports = (month: string, unitPrice: number) => [{
    date: `${month}-01`, teamId: 'team', workers: [{ workerId: 'worker', payType: '월급제', manDay: 1, unitPrice }],
}];

const fixtureWorker = {
    id: 'worker', name: '검증작업자', teamId: 'team', payType: '월급제',
    bankName: '국민은행', accountNumber: 'fixture-account', accountHolder: '검증작업자',
};
beforeEach(() => {
    jest.resetAllMocks();
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([fixtureWorker]);
    (siteService.getSites as jest.Mock).mockResolvedValue([]);
});

it.each(['노무', '계산서'])('종료·퇴사·복원 전후에도 과거 공수와 급여·정산 합계를 보존한다: %s', async paymentMethod => {
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([{
        ...reports('2026-09', 200000)[0], siteId: 'site', siteName: '검증현장',
        workers: [{ workerId: 'worker', name: '검증작업자', teamId: 'team', payType: '월급제', manDay: 1.5, unitPrice: 200000 }],
    }]);
    (siteService.getSites as jest.Mock).mockResolvedValue([{ id: 'site', name: '검증현장', status: 'active', paymentMethod }]);
    const { result } = renderHook(() => usePayrollData('2026-09', '2026-09'));
    await waitFor(() => expect(result.current.paymentData).toHaveLength(1));
    const before = {
        payment: result.current.paymentData,
        base: result.current.basePaymentData,
        ledger: result.current.ledgerRowsData,
    };
    expect(before.payment[0]).toMatchObject({ totalManDay: 1.5, unitPrice: 200000, grossAmount: 300000 });
    expect(before.payment[0][paymentMethod === '노무' ? 'laborGrossAmount' : 'invoiceGrossAmount']).toBe(300000);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ ...fixtureWorker, status: '퇴사', isActive: false, unitPrice: 999999 }]);
    (siteService.getSites as jest.Mock).mockResolvedValue([{ id: 'site', name: '검증현장', status: 'completed', paymentMethod }]);
    await act(async () => { await result.current.refetch(); });
    expect({ payment: result.current.paymentData, base: result.current.basePaymentData, ledger: result.current.ledgerRowsData }).toEqual(before);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ ...fixtureWorker, status: '재직', isActive: true, unitPrice: 999999 }]);
    (siteService.getSites as jest.Mock).mockResolvedValue([{ id: 'site', name: '검증현장', status: 'active', paymentMethod }]);
    await act(async () => { await result.current.refetch(); });
    expect({ payment: result.current.paymentData, base: result.current.basePaymentData, ledger: result.current.ledgerRowsData }).toEqual(before);
});

it.each(['same-month', 'different-month'])('이전 응답이 늦게 도착해도 최신 조회를 유지한다: %s', async mode => {
    const old = deferred();
    (dailyReportService.getReportsByRange as jest.Mock).mockReturnValueOnce(old.promise).mockResolvedValueOnce(reports('2026-09', 200000));
    const { result, rerender } = renderHook(({ month }) => usePayrollData(month, month), { initialProps: { month: mode === 'same-month' ? '2026-09' : '2026-08' } });
    await waitFor(() => expect(dailyReportService.getReportsByRange).toHaveBeenCalledTimes(1));
    if (mode === 'same-month') await act(async () => { await result.current.refetch(); });
    else rerender({ month: '2026-09' });
    await waitFor(() => expect(result.current.paymentData[0]?.grossAmount).toBe(200000));
    await act(async () => old.resolve(reports(mode === 'same-month' ? '2026-09' : '2026-08', 100000)));
    expect(result.current.paymentData[0]?.grossAmount).toBe(200000);
    expect(result.current.basePaymentData[0]?.grossAmount).toBe(200000);
    expect(result.current.ledgerRowsData[0]?.invoiceGrossAmount).toBe(200000);
    expect(result.current.loading).toBe(false);
});

it('이전 요청이 먼저 완료되어도 최신 요청이 끝날 때까지 조회 상태를 유지한다', async () => {
    const old = deferred();
    const current = deferred();
    (dailyReportService.getReportsByRange as jest.Mock).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result } = renderHook(() => usePayrollData('2026-09', '2026-09'));
    await waitFor(() => expect(dailyReportService.getReportsByRange).toHaveBeenCalledTimes(1));
    act(() => { void result.current.refetch(); });
    await waitFor(() => expect(dailyReportService.getReportsByRange).toHaveBeenCalledTimes(2));
    await act(async () => old.resolve(reports('2026-09', 100000)));
    expect(result.current.loading).toBe(true);
    expect(result.current.paymentData).toEqual([]);
    await act(async () => current.resolve(reports('2026-09', 200000)));
    expect(result.current.loading).toBe(false);
    expect(result.current.paymentData[0]?.grossAmount).toBe(200000);
});

it('새 월 조회가 실패하면 이전 월 금액을 현재 결과로 남기면 안 된다', async () => {
    const warning = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (dailyReportService.getReportsByRange as jest.Mock)
        .mockResolvedValueOnce(reports('2026-08', 100000))
        .mockRejectedValueOnce(new Error('fixture network failure'));
    const { result, rerender } = renderHook(({ month }) => usePayrollData(month, month), { initialProps: { month: '2026-08' } });
    await waitFor(() => expect(result.current.paymentData[0]?.grossAmount).toBe(100000));
    rerender({ month: '2026-09' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    warning.mockRestore();
    expect(result.current.paymentData).toEqual([]);
});

it('조회 실패 시 모든 금액을 비우고 재시도 성공 시 오류를 해제한다', async () => {
    const warning = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValueOnce(reports('2026-09', 100000))
        .mockRejectedValueOnce(new Error('fixture failure')).mockResolvedValueOnce(reports('2026-09', 200000));
    const { result } = renderHook(() => usePayrollData('2026-09', '2026-09'));
    await waitFor(() => expect(result.current.paymentData).toHaveLength(1));
    await act(async () => { await result.current.refetch(); });
    expect(result.current.paymentData).toEqual([]);
    expect(result.current.basePaymentData).toEqual([]);
    expect(result.current.ledgerRowsData).toEqual([]);
    expect(result.current.loadError).toBeTruthy();
    await act(async () => { await result.current.refetch(); });
    expect(result.current.loadError).toBeNull();
    expect(result.current.paymentData[0].grossAmount).toBe(200000);
    warning.mockRestore();
});

it('오래된 요청의 실패가 최신 성공 결과를 지우지 않는다', async () => {
    let rejectOld!: (error: Error) => void;
    const pending = new Promise((_, reject) => { rejectOld = reject; });
    (dailyReportService.getReportsByRange as jest.Mock).mockReturnValueOnce(pending)
        .mockResolvedValueOnce(reports('2026-09', 200000));
    const { result } = renderHook(() => usePayrollData('2026-09', '2026-09'));
    await waitFor(() => expect(dailyReportService.getReportsByRange).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.refetch(); });
    await act(async () => rejectOld(new Error('old fixture request')));
    expect(result.current.paymentData[0].grossAmount).toBe(200000);
    expect(result.current.loadError).toBeNull();
    expect(result.current.loading).toBe(false);
});
