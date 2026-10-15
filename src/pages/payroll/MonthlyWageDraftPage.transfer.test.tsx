import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MonthlyWageDraftPage from './MonthlyWageDraftPage';
import { dailyReportService } from '../../services/dailyReportService';
import { monthlyPayrollSettlementService } from '../../services/monthlyPayrollSettlementService';
import { companyService } from '../../services/companyService';
import { teamService } from '../../services/teamService';
import { payrollConfigService } from '../../services/payrollConfigService';
import { statementOutputService } from '../../services/statementOutputService';
import type { TransferLoadResult } from '../../features/bank-transfer/types';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'fixture-user' } }) }));
jest.mock('../../hooks/usePagePrimaryAccount', () => ({ usePagePrimaryAccount: () => ({ account: null }), ensurePagePrimaryAccountReady: () => true }));
jest.mock('../../components/accounts/PagePrimaryAccountCard', () => () => null);
// The embedded picker does not render editing, statement or review interfaces.
jest.mock('./components/SimplePayrollToolbar', () => ({ PayrollToolbar: () => null }));
jest.mock('./components/SimplePayrollClosingTable', () => ({ SimplePayrollClosingTable: () => null }));
jest.mock('./components/PayrollReviewCenter', () => ({ PayrollReviewCenter: () => null }));
jest.mock('./components/PayslipTemplate', () => ({ PayslipTemplate: () => null }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [
    { id: 'team-a', name: '검증팀 A', companyId: 'company' }, { id: 'team-b', name: '검증팀 B', companyId: 'company' },
] } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [
    { id: 'worker-a', name: '검증 A', teamId: 'team-a', teamName: '검증팀 A', payType: '월급제', bankName: '국민은행', accountNumber: '000123456789', accountHolder: '검증 A' },
    { id: 'worker-b', name: '검증 B', teamId: 'team-b', teamName: '검증팀 B', payType: '일급제', bankName: '국민은행', accountNumber: '000987654321', accountHolder: '검증 B' },
] } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: jest.fn() } }));
jest.mock('../../services/advancePaymentService', () => ({ advancePaymentService: { getAdvancePaymentsByYearMonth: async () => [] } }));
jest.mock('../../services/statementOutputService', () => ({ statementOutputService: { getOutputsByMonth: jest.fn(async () => []), issueOutput: jest.fn() } }));
jest.mock('../../services/monthlyPayrollSettlementService', () => ({
    isFinalizedMonthlyPayrollRun: (status: string) => status === 'confirmed' || status === 'paid',
    monthlyPayrollSettlementService: { getSettlementsByYear: jest.fn(), saveSettlements: jest.fn(), transitionRunStatus: jest.fn() },
}));
jest.mock('../../services/payrollConfigService', () => ({
    DEFAULT_ADVANCE_ITEM_LABELS: {
        corporateAdvance1: '법인가불1', corporateAdvance2: '법인가불2', corporateAdvance3: '법인가불3', corporateAdvance4: '법인가불4',
        laborAdvance1: '노무가불1', laborAdvance2: '노무가불2', laborAdvance3: '노무가불3', laborAdvance4: '노무가불4',
    },
    payrollConfigService: {
        getConfig: async () => ({ deductionItems: [], incomeTaxRate: 0.03, residentTaxRate: 0.003, insuranceConfig: { thresholdDays: 8, dailyWorkerFeePerManDay: 1000 } }),
        saveConfig: jest.fn(),
    },
}));

const period = '2026-07';
const reports = () => ['a', 'b'].map(key => ({
    id: `report-${key}`, date: `${period}-01`, teamId: `team-${key}`, teamName: `검증팀 ${key.toUpperCase()}`, paymentType: '계산서',
    workers: [{ workerId: `worker-${key}`, name: `검증 ${key.toUpperCase()}`, teamId: `team-${key}`, payType: key === 'a' ? '월급제' : '일급제', manDay: 10, unitPrice: 110500 }],
}));
const defaultOptions = { insuranceApplied: false, insuranceTeamSiteOnly: false, businessIncomeApplied: false, utilitiesApplied: true, dailyFeeApplied: false };
const emptySide = () => ({ carry: 0, carrySecond: 0, currentAdvance: 0, currentAdvanceSecond: 0, lodging: 0, electricity: 0, gas: 0, water: 0, internet: 0, management: 0, fine: 0, other: 0 });
const emptyBreakdown = { standardLines: [], additionalLines: [], total: 0, hasData: false };
const saved = (key: 'a' | 'b', runStatus = 'draft') => {
    const salaryModel = key === 'a' ? '월급제' : '일급제';
    const id = `${period}__worker-${key}__team-${key}__${salaryModel}`;
    return {
        id: `saved-${key}`, year: 2026, yearMonth: period, teamId: `team-${key}`, teamName: `검증팀 ${key.toUpperCase()}`, runStatus,
        calculationOptions: defaultOptions,
        rows: [{ rowKey: id, yearMonth: period, teamId: `team-${key}`, workerId: `worker-${key}`, workerName: `검증 ${key.toUpperCase()}`, salaryModel,
            netAmount: 555500, totalDeduction: 549500, invoiceNetAmount: 555500, laborNetAmount: 0,
            manualInput: { invoice: emptySide(), labor: emptySide(), personalMemo: '', allocationMode: 'corporate' },
            paymentSnapshot: {
                id, workerId: `worker-${key}`, workerName: `검증 ${key.toUpperCase()}`, teamId: `team-${key}`, teamName: `검증팀 ${key.toUpperCase()}`, month: period,
                companyId: 'company', companyName: '검증회사', idNumber: '', unitPrice: 110500, totalManDay: 10,
                grossAmount: 1105000, invoiceGrossAmount: 1105000, laborGrossAmount: 0, invoiceManDay: 10, laborManDay: 0,
                invoiceNetAmount: 555500, laborNetAmount: 0, totalDeduction: 549500, totalAmount: 555500, workEntries: [],
                deductionBreakdown: emptyBreakdown, taxBreakdown: emptyBreakdown, taxRateSnapshot: {},
                isValid: true, errors: {}, bankName: '국민은행', bankCode: '004', accountNumber: '000555555555', accountHolder: '검증저장계좌', displayContent: '월급',
            },
        }],
    };
};
const ready = async () => waitFor(() => expect(screen.getByRole('button', { name: '급여 불러오기' })).toBeEnabled());
const picker = () => {
    const onLoad = jest.fn<void, [TransferLoadResult]>();
    const onInvalidate = jest.fn();
    const view = render(<div id="main-content" data-testid="transfer-host" style={{ overflow: 'auto' }}><MonthlyWageDraftPage transferPicker={{ period, onLoad, onInvalidate }} /></div>);
    return { onLoad, onInvalidate, ...view };
};

beforeEach(() => {
    jest.clearAllMocks();
    (companyService.getCompanies as jest.Mock).mockResolvedValue([{ id: 'company', name: '검증회사', type: '시공사' }]);
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue(reports());
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([]);
});

it('선택 월의 실시간 급여를 계산하고 명시적으로 불러올 때만 후보를 전달한다', async () => {
    const { onLoad, onInvalidate } = picker();
    expect(screen.getByRole('button', { name: '급여 불러오기' })).toBeDisabled();
    await ready();
    expect(onLoad).not.toHaveBeenCalled();
    expect(onInvalidate).toHaveBeenCalled();
    expect(dailyReportService.getReportsByRange).toHaveBeenCalledWith(`${period}-01`, `${period}-31`);
    expect(screen.getByTestId('transfer-host')).toHaveStyle({ overflow: 'auto' });
    expect(screen.getByTestId('transfer-host')).not.toHaveClass('page-full-bleed');
    expect(screen.queryByText('팀별 정산 내역')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    expect(onLoad.mock.calls[0][0].candidates).toHaveLength(2);
    expect(onLoad.mock.calls[0][0].candidates[0]).toMatchObject({ amount: 1105000, period });
    expect(onLoad.mock.calls[0][0].candidates[0].payrollDetail).toMatchObject({
        grossAmount: 1105000, netAmount: 1105000, totalDeduction: 0, totalManDay: 10,
        originalAmount: 1105000, isFinalized: false, workEntries: [{ date: `${period}-01`, manDay: 10, amount: 1105000 }],
    });
    expect(onLoad.mock.calls[0][0].candidates[0].receiverDisplay).toBeUndefined();
    expect(onLoad.mock.calls[0][0].candidates[0].senderMemo).toBeUndefined();
    expect(monthlyPayrollSettlementService.saveSettlements).not.toHaveBeenCalled();
    expect(monthlyPayrollSettlementService.transitionRunStatus).not.toHaveBeenCalled();
    expect(payrollConfigService.saveConfig).not.toHaveBeenCalled();
    expect(statementOutputService.getOutputsByMonth).not.toHaveBeenCalled();
});

it('사업소득세 변경 시 기존 후보를 무효화하고 공제 후 금액으로 다시 불러온다', async () => {
    const { onLoad, onInvalidate } = picker();
    await ready();
    onInvalidate.mockClear();
    fireEvent.click(screen.getByText('공제 설정'));
    fireEvent.click(screen.getByRole('checkbox', { name: '사업소득세' }));
    expect(onInvalidate).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '급여 불러오기' })).toBeDisabled();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    expect(onLoad.mock.calls[0][0].candidates.map(row => row.amount)).toEqual([1068535, 1068535]);
    const detail = onLoad.mock.calls[0][0].candidates[0].payrollDetail!;
    expect(detail.totalDeduction).toBe(36465);
    expect(detail.taxes.reduce((sum, line) => sum + line.amount, 0)).toBe(36465);
});

it('저장된 가불과 법인 배분을 동일한 가불대장 계산으로 적용한다', async () => {
    const draft = saved('a');
    draft.rows[0].manualInput.invoice.carry = 100000;
    draft.rows[0].manualInput.labor.currentAdvance = 20000;
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([draft]);
    const { onLoad } = picker();
    await ready();
    fireEvent.change(screen.getByLabelText('급여 조회 팀'), { target: { value: 'team-a' } });
    await ready();
    for (const [type, expected] of [['invoiceAdvance', 100000], ['laborAdvance', 20000], ['invoiceNet', 985000]] as const) {
        fireEvent.change(screen.getByLabelText('급여 이체금액 기준'), { target: { value: type } });
        await ready();
        fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
        const candidates = onLoad.mock.calls[onLoad.mock.calls.length - 1][0].candidates;
        expect(candidates).toHaveLength(1);
        expect(candidates[0]).toMatchObject({ amount: expected, id: `payroll:${draft.rows[0].rowKey}:${type}` });
        expect(candidates[0].payrollDetail).toMatchObject({ originalAmount: expected, grossAmount: 1105000, totalDeduction: 120000, netAmount: 985000 });
    }
});

it('지급완료된 월·팀은 제외하고 확정 급여는 저장 계좌와 금액을 유지한다', async () => {
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([saved('a', 'paid'), saved('b', 'confirmed')]);
    const { onLoad } = picker();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    expect(onLoad.mock.calls[0][0].candidates).toHaveLength(1);
    expect(onLoad.mock.calls[0][0].candidates[0]).toMatchObject({ amount: 555500, name: '검증 B', accountNumber: '000555555555' });
    expect(onLoad.mock.calls[0][0].candidates[0].payrollDetail).toMatchObject({ isFinalized: true, totalDeduction: 549500, netAmount: 555500 });
    expect(onLoad.mock.calls[0][0].warnings.join(' ')).toContain('지급완료된 급여 1건');
});

it('조회 실패는 화면에 표시하고 재조회가 완료되기 전에는 가져오기를 막는다', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (dailyReportService.getReportsByRange as jest.Mock).mockRejectedValueOnce(new Error('fixture failure'));
    try {
        const { onLoad } = picker();
        expect(await screen.findByRole('alert')).toHaveTextContent('급여 자료를 불러오지 못했습니다.');
        fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
        expect(onLoad).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
        await ready();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally { errorLog.mockRestore(); }
});

it('기초 목록이 늦게 도착하면 다른 계산이 끝나도 가져오기를 기다린다', async () => {
    let release!: (rows: unknown[]) => void;
    (companyService.getCompanies as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    picker();
    await waitFor(() => expect(monthlyPayrollSettlementService.getSettlementsByYear).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: '급여 불러오기' })).toBeDisabled();
    await act(async () => release([{ id: 'company', name: '검증회사', type: '시공사' }]));
    await ready();
});

it('전체 팀은 팀마다 저장된 공제 기준으로 계산한 급여를 한 번에 전달한다', async () => {
    const first = saved('a');
    first.calculationOptions = { ...defaultOptions, businessIncomeApplied: true };
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([first, saved('b')]);
    const { onLoad } = picker();
    await ready();
    expect(screen.getByLabelText('급여 조회 팀')).toHaveValue('');
    expect(screen.getByLabelText('급여 구분')).toHaveValue('all');
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    expect(onLoad.mock.calls[0][0].candidates.map(row => [row.name, row.amount])).toEqual([['검증 A', 1068535], ['검증 B', 1105000]]);
    expect(onLoad.mock.calls[0][0].candidates.map(row => row.payrollDetail?.totalDeduction)).toEqual([36465, 0]);
    expect(monthlyPayrollSettlementService.saveSettlements).not.toHaveBeenCalled();
    expect(monthlyPayrollSettlementService.transitionRunStatus).not.toHaveBeenCalled();
    expect(payrollConfigService.saveConfig).not.toHaveBeenCalled();
});

it('급여 구분 전체는 월급제·일급제·용역팀을 모두 담고 특정 구분으로도 좁힌다', async () => {
    const serviceReport = { ...reports()[1], id: 'report-service', workers: [{ ...reports()[1].workers[0], payType: '용역팀' }] };
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([...reports(), serviceReport]);
    const first = saved('a');
    first.calculationOptions = { ...defaultOptions, businessIncomeApplied: true };
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([first, saved('b')]);
    const { onLoad } = picker();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    expect(onLoad.mock.calls[0][0].candidates.map(row => row.payrollDetail?.salaryLabel).sort()).toEqual(['용역팀', '월급제', '일급제'].sort());
    fireEvent.change(screen.getByLabelText('급여 구분'), { target: { value: 'service' } });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(2));
    expect(onLoad.mock.calls[1][0].candidates).toHaveLength(1);
    expect(onLoad.mock.calls[1][0].candidates[0].payrollDetail?.salaryLabel).toBe('용역팀');
});

it('상위·하위 팀을 중복으로 담지 않고 이전 팀 ID의 공제 설정도 복원한다', async () => {
    const teamSpy = jest.spyOn(teamService, 'getTeams').mockResolvedValue([
        { id: 'team-a', legacyId: 'old-team-a', name: '검증팀 A', companyId: 'company', type: '시공팀' },
        { id: 'team-b', parentTeamId: 'team-a', name: '검증팀 B', companyId: 'company', type: '시공팀' },
    ]);
    const first = saved('a');
    first.teamId = 'old-team-a';
    first.calculationOptions = { ...defaultOptions, businessIncomeApplied: true };
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([first, saved('b')]);
    const { onLoad } = picker();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    expect(onLoad.mock.calls[0][0].candidates.map(row => [row.name, row.amount])).toEqual([['검증 A', 1068535], ['검증 B', 1105000]]);
    teamSpy.mockRestore();
});

it('팀별 전체 조회에서도 확정 금액을 유지하고 지급완료 팀은 제외한다', async () => {
    const first = saved('a');
    first.calculationOptions = { ...defaultOptions, businessIncomeApplied: true };
    const paid = saved('b', 'paid');
    paid.teamId = 'paid-team';
    paid.rows[0].rowKey = `${period}__worker-b__paid-team__일급제`;
    paid.rows[0].teamId = 'paid-team';
    paid.rows[0].paymentSnapshot.id = paid.rows[0].rowKey;
    paid.rows[0].paymentSnapshot.teamId = 'paid-team';
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([first, saved('b', 'confirmed'), paid]);
    const { onLoad } = picker();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    expect(onLoad.mock.calls[0][0].candidates.map(row => row.amount)).toEqual([1068535, 555500]);
    expect(onLoad.mock.calls[0][0].warnings.join(' ')).toContain('지급완료된 급여 1건');
});

it('전체 조회 도중 한 팀이 실패하면 일부 결과를 전달하지 않고 재시도할 수 있다', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const first = saved('a');
    first.calculationOptions = { ...defaultOptions, businessIncomeApplied: true };
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([first, saved('b')]);
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValueOnce(reports()).mockResolvedValueOnce(reports()).mockRejectedValueOnce(new Error('fixture failure'));
    const { onLoad } = picker();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('전체 결과를 가져오지 않았습니다.'));
    expect(onLoad).not.toHaveBeenCalled();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    expect(onLoad.mock.calls[0][0].candidates).toHaveLength(2);
    errorLog.mockRestore();
});

it('전체 조회 중 구분을 바꾸면 이전 작업 결과를 폐기한다', async () => {
    const first = saved('a');
    first.calculationOptions = { ...defaultOptions, businessIncomeApplied: true };
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([first, saved('b')]);
    let release!: (value: ReturnType<typeof reports>) => void;
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValueOnce(reports()).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const { onLoad } = picker();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    await waitFor(() => expect(release).toBeDefined());
    fireEvent.change(screen.getByLabelText('급여 구분'), { target: { value: 'daily' } });
    await act(async () => release(reports()));
    await ready();
    expect(onLoad).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    expect(onLoad.mock.calls[0][0].candidates.map(row => row.name)).toEqual(['검증 B']);
});

it('급여 구분·금액 기준 변경을 무효화하고 0원 이하를 제외한다', async () => {
    const { onLoad, onInvalidate } = picker();
    await ready();
    onInvalidate.mockClear();
    fireEvent.change(screen.getByLabelText('급여 구분'), { target: { value: 'daily' } });
    expect(onInvalidate).toHaveBeenCalled();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    expect(onLoad.mock.calls[0][0].candidates.map(row => row.name)).toEqual(['검증 B']);
    fireEvent.change(screen.getByLabelText('급여 이체금액 기준'), { target: { value: 'invoiceAdvance' } });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    expect(onLoad.mock.calls[1][0].candidates).toEqual([]);
    expect(onLoad.mock.calls[1][0].warnings.join(' ')).toContain('0원 이하인 1건');
});
