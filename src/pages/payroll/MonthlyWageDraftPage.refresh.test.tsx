import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MonthlyWageDraftPage from './MonthlyWageDraftPage';
import { dailyReportService } from '../../services/dailyReportService';
import { monthlyPayrollSettlementService } from '../../services/monthlyPayrollSettlementService';
import { manpowerService } from '../../services/manpowerService';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

jest.mock('xlsx-js-style', () => ({ ...jest.requireActual('xlsx-js-style'), writeFile: jest.fn() }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../../hooks/usePagePrimaryAccount', () => ({ usePagePrimaryAccount: () => ({ account: null }) }));
jest.mock('../../components/accounts/PagePrimaryAccountCard', () => () => null);
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [{ id: 'team', name: '검증팀' }] } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn(async () => (
    ['월급제', '일급제', '용역팀'].map((payType, index) => ({
        id: `worker-${index}`, name: `검증${index}`, teamId: 'team', teamName: '검증팀', payType,
        bankName: '국민은행', accountNumber: 'fixture-account', accountHolder: `검증${index}`,
    }))
)) } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: jest.fn() } }));
jest.mock('../../services/advancePaymentService', () => ({ advancePaymentService: { getAdvancePaymentsByYearMonth: async () => [] } }));
jest.mock('../../services/statementOutputService', () => ({ statementOutputService: { getOutputsByMonth: async () => [] } }));
jest.mock('../../services/monthlyPayrollSettlementService', () => ({
    isFinalizedMonthlyPayrollRun: (status: string) => status === 'confirmed' || status === 'paid',
    monthlyPayrollSettlementService: { getSettlementsByYear: jest.fn(), saveSettlements: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../services/payrollConfigService', () => ({
    DEFAULT_ADVANCE_ITEM_LABELS: {
        corporateAdvance1: '법인가불1', corporateAdvance2: '법인가불2', corporateAdvance3: '법인가불3', corporateAdvance4: '법인가불4',
        laborAdvance1: '노무가불1', laborAdvance2: '노무가불2', laborAdvance3: '노무가불3', laborAdvance4: '노무가불4',
    },
    payrollConfigService: { getConfig: async () => ({
        deductionItems: [], incomeTaxRate: 0.03, residentTaxRate: 0.003,
        insuranceConfig: { thresholdDays: 8, dailyWorkerFeePerManDay: 1000 },
    }) },
}));
jest.mock('./components/PayslipTemplate', () => {
    const React = require('react');
    return { PayslipTemplate: React.forwardRef((_props: any, ref: any) => <div ref={ref} className="payslip-template-card">검증용 명세서</div>) };
});
// Keep the real page, data hook and tax calculation; expose only the table inputs.
jest.mock('./components/MonthlyAdvanceLedger', () => {
    const React = require('react');
    return { __esModule: true, default: React.forwardRef(({ rows }: any, _ref: any) => (
        <div>{rows.map((row: any) => <output key={row.rowKey} data-testid={row.workerId}>
            {JSON.stringify(row.statementTaxAmounts)}
        </output>)}</div>
    )) };
});
jest.mock('./components/SimplePayrollToolbar', () => ({ PayrollToolbar: (props: any) => (
    <div>
        <button onClick={props.fetchData}>조회</button>
        <button onClick={() => props.setPageViewMode('simple')}>간편 마감</button>
        <button onClick={() => props.setPageViewMode('ledger')}>가불대장</button>
        <button disabled={props.payrollSettlementDisabled || props.payrollSettlementSaving || props.payrollSettlementLoading} onClick={props.handleSavePayrollSettlement}>초안 저장</button>
        <button disabled={props.actionsDisabled} onClick={props.openPayslipPreview}>명세서</button>
        <button aria-pressed={props.businessIncomeApplied} onClick={() => props.applyCalculatedDeductions({
            applyInsurance: props.insuranceApplied, applyInsuranceTeamSiteOnly: props.insuranceTeamSiteOnly,
            applyBusinessIncome: !props.businessIncomeApplied, applyUtilities: true, applyDailyFee: props.dailyFeeApplied,
        })}>사업소득</button>
        <button onClick={() => { props.setFilterMode('worker'); props.setSelectedWorkerId('worker-1'); }}>작업자 변경</button>
    </div>
) }));

const month = new Date().toISOString().slice(0, 7);
const reports = (unitPrice = 110500) => [{
    id: 'report', date: `${month}-01`, teamId: 'team', teamName: '검증팀', paymentType: '계산서',
    workers: ['월급제', '일급제', '용역팀'].map((payType, index) => ({
        workerId: `worker-${index}`, name: `검증${index}`, teamId: 'team', payType, manDay: 10, unitPrice,
    })),
}];
const savedOptions = {
    insuranceApplied: false, insuranceTeamSiteOnly: false, businessIncomeApplied: true,
    utilitiesApplied: true, dailyFeeApplied: false,
};
const expectTaxes = async (income: number, resident: number, workerIds = ['worker-0', 'worker-1', 'worker-2']) => {
    await waitFor(() => {
        workerIds.forEach(id => expect(JSON.parse(screen.getByTestId(id).textContent || '{}')).toMatchObject({
            businessIncomeTax: income, businessResidentTax: resident,
        }));
    });
};
const ready = async () => {
    await screen.findByTestId('worker-0');
    await waitFor(() => expect(screen.queryByText('급여 계산을 적용하고 있습니다...')).not.toBeInTheDocument());
};

beforeEach(() => {
    jest.clearAllMocks();
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue(
        ['월급제', '일급제', '용역팀'].map((payType, index) => ({
            id: `worker-${index}`, name: `검증${index}`, teamId: 'team', teamName: '검증팀', payType,
            bankName: '국민은행', accountNumber: 'fixture-account', accountHolder: `검증${index}`,
        }))
    );
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue(reports());
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([]);
});

it('재조회와 작업자 변경 후에도 선택한 세금을 모든 급여 유형에 다시 계산한다', async () => {
    render(<MonthlyWageDraftPage />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '사업소득' }));
    await expectTaxes(33150, 3315);

    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue(reports(170000));
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await expectTaxes(51000, 5100);
    fireEvent.click(screen.getByRole('button', { name: '작업자 변경' }));
    await expectTaxes(51000, 5100, ['worker-1']);
    await waitFor(() => expect(screen.queryByTestId('worker-0')).not.toBeInTheDocument());
});

it('저장된 세금 설정을 복원한 뒤 같은 조건으로 여러 번 조회해도 세금이 유지된다', async () => {
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([{
        id: 'saved', yearMonth: month, teamId: 'team', rows: [], calculationOptions: savedOptions,
    }]);
    render(<MonthlyWageDraftPage />);
    await expectTaxes(33150, 3315);
    for (const price of [170000, 110500]) {
        (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue(reports(price));
        fireEvent.click(screen.getByRole('button', { name: '조회' }));
        await expectTaxes(price * 10 * 0.03, price * 10 * 0.003);
    }
    fireEvent.click(screen.getByRole('button', { name: '사업소득' }));
    await expectTaxes(0, 0);
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await ready();
    expect(screen.getByRole('button', { name: '사업소득' })).toHaveAttribute('aria-pressed', 'false');
    await expectTaxes(0, 0);
});

it('세금 선택 직후 조회가 먼저 완료되어도 마지막 선택을 적용한다', async () => {
    render(<MonthlyWageDraftPage />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '사업소득' }));
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await expectTaxes(33150, 3315);
});

it('정산 설정이 급여 원본보다 늦게 도착해도 복원 후 재조회에 적용한다', async () => {
    let resolveSaved!: (value: unknown[]) => void;
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveSaved = resolve; }));
    render(<MonthlyWageDraftPage />);
    await screen.findByTestId('worker-0');
    await act(async () => resolveSaved([{ id: 'saved', yearMonth: month, teamId: 'team', rows: [], calculationOptions: savedOptions }]));
    await expectTaxes(33150, 3315);
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue(reports(170000));
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await expectTaxes(51000, 5100);
});

it('조회 결과가 비어 있으면 이전 급여를 다시 계산해 되살리지 않는다', async () => {
    render(<MonthlyWageDraftPage />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '사업소득' }));
    await expectTaxes(33150, 3315);
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await waitFor(() => expect(screen.queryByTestId('worker-0')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('급여 계산을 적용하고 있습니다...')).not.toBeInTheDocument());
    expect(screen.getByText(/현재 조회된 급여 0건/)).toBeInTheDocument();
});

jest.mock('./components/SimplePayrollClosingTable', () => ({ SimplePayrollClosingTable: ({ rows }: any) => <div>{rows.map((row: any) => <output key={row.id} data-testid={'closing-' + row.id}>{JSON.stringify(row)}</output>)}</div> }));
it.each([true, false])('확정된 세금은 가불대장에서도 저장 당시 금액을 유지한다 (현재 원본 존재: %s)', async hasCurrentSource => {
    const id = `${month}__worker-0__team__월급제`;
    const empty = { standardLines: [], additionalLines: [], total: 0, hasData: false };
    const paymentSnapshot = {
        id, workerId: 'worker-0', workerName: '검증0', teamId: 'team', teamName: '검증팀', month,
        companyId: '', companyName: '', idNumber: '', unitPrice: 110500, totalManDay: 10,
        grossAmount: 1105000, invoiceGrossAmount: 1105000, laborGrossAmount: 0,
        invoiceManDay: 10, laborManDay: 0, invoiceNetAmount: 1068535, laborNetAmount: 0,
        totalDeduction: 36465, totalAmount: 1068535, workEntries: [],
        deductionBreakdown: empty,
        taxBreakdown: { ...empty, hasData: true, total: 36465, additionalLines: [
            { label: '[3.0%] 사업소득세', amount: 33150 }, { label: '[0.3%] 소득세', amount: 3315 },
        ] },
        taxRateSnapshot: {}, isValid: true, errors: {}, bankName: '국민은행', bankCode: '004',
        accountNumber: 'fixture-account', accountHolder: '검증0', displayContent: '월급',
    };
    (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue(hasCurrentSource ? reports(170000) : []);
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([{
        id: 'saved', yearMonth: month, teamId: 'team', runStatus: 'confirmed', calculationOptions: savedOptions,
        rows: [{ rowKey: id, workerId: 'worker-0', yearMonth: month, teamId: 'team', paymentSnapshot,
            grossAmount: 1105000, netAmount: 1068535, taxDeduction: 36465, totalDeduction: 36465, personalDeduction: 0 }],
    }]);
    render(<MonthlyWageDraftPage />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: '간편 마감' }));
    expect(JSON.parse(screen.getByTestId(`closing-${id}`).textContent || '{}').netAmount).toBe(1068535);
    fireEvent.click(screen.getByRole('button', { name: '가불대장' }));
    await expectTaxes(33150, 3315, ['worker-0']);
});

it('저장 설정이 늦게 도착해도 사용자의 최신 세금 선택을 유지해야 한다', async () => {
    let resolveSaved!: (value: unknown[]) => void;
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveSaved = resolve; }));
    render(<MonthlyWageDraftPage />);
    await screen.findByTestId('worker-0');
    fireEvent.click(screen.getByRole('button', { name: '사업소득' }));
    await expectTaxes(33150, 3315);
    await act(async () => resolveSaved([{
        id: 'saved', yearMonth: month, teamId: 'team', rows: [], runStatus: 'draft',
        calculationOptions: { ...savedOptions, businessIncomeApplied: false },
    }]));
    await waitFor(() => expect(screen.queryByText('급여 계산을 적용하고 있습니다...')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '사업소득' })).toHaveAttribute('aria-pressed', 'true');
    await expectTaxes(33150, 3315);
});

it('재조회가 진행 중일 때 이전 금액을 저장하면 안 된다', async () => {
    render(<MonthlyWageDraftPage />);
    await ready();
    let resolveReports!: (value: unknown[]) => void;
    (dailyReportService.getReportsByRange as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveReports = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await waitFor(() => expect(dailyReportService.getReportsByRange).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));
    // The save boundary is mocked: this test never writes payroll data.
    const calls = (monthlyPayrollSettlementService.saveSettlements as jest.Mock).mock.calls;
    await act(async () => resolveReports(reports(170000)));
    expect(calls).toHaveLength(0);
});

it('정산 조회 실패 중 저장과 출력을 막고 재조회로 복구한다', async () => {
    const warning = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockRejectedValueOnce(new Error('fixture failure'));
    render(<MonthlyWageDraftPage />);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: '초안 저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '명세서' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: '명세서' })).toBeEnabled());
    warning.mockRestore();
});

it('계좌와 세율이 없는 명세서도 확인창 없이 개별·일괄 Excel과 PDF를 출력한다', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue(
        ['월급제', '일급제', '용역팀'].map((payType, index) => ({
            id: `worker-${index}`, name: `검증${index}`, teamId: 'team', teamName: '검증팀', payType,
            bankName: '', accountNumber: '', accountHolder: '',
        }))
    );
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const print = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    try {
        render(<MonthlyWageDraftPage />);
        await ready();
        await waitFor(() => expect(screen.getByRole('button', { name: '명세서' })).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: '명세서' }));
        await waitFor(() => expect(screen.getByRole('button', { name: '명세서' })).toBeEnabled());
        expect(screen.getByText('확인 · 계좌번호가 없습니다.')).toBeInTheDocument();
        expect(screen.getByText('확인 · 세율 정보가 없습니다.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '개별 EXCEL' }));
        expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: /일괄 EXCEL/ }));
        await waitFor(() => expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/\.zip$/)));

        fireEvent.click(screen.getByRole('button', { name: '개별 PDF' }));
        await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByRole('button', { name: /일괄 PDF/ })).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: /일괄 PDF/ }));
        await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
        expect(confirm).not.toHaveBeenCalled();

        // 발행 기록에는 기존 경고 확인을 유지한다. 취소하므로 저장하지 않는다.
        fireEvent.click(screen.getByRole('button', { name: '발행 확정' }));
        expect(confirm).toHaveBeenCalledTimes(1);
    } finally {
        confirm.mockRestore();
        print.mockRestore();
    }
});
