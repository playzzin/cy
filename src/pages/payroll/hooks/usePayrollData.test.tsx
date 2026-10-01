import { act, renderHook, waitFor } from '@testing-library/react';
import { usePayrollData } from './usePayrollData';
import { dailyReportService } from '../../../services/dailyReportService';

jest.mock('../../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: jest.fn() } }));
jest.mock('../../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [{
    id: 'worker', name: '검증작업자', teamId: 'team', payType: '월급제',
    bankName: '국민은행', accountNumber: 'fixture-account', accountHolder: '검증작업자',
}] } }));
jest.mock('../../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
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

beforeEach(() => jest.resetAllMocks());

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
