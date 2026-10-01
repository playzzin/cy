import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MonthlyWageDraftPage from './MonthlyWageDraftPage';
import { dailyReportService } from '../../services/dailyReportService';
import { monthlyPayrollSettlementService } from '../../services/monthlyPayrollSettlementService';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../../hooks/usePagePrimaryAccount', () => ({ usePagePrimaryAccount: () => ({ account: null }) }));
jest.mock('../../components/accounts/PagePrimaryAccountCard', () => () => null);
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [] } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [{ id: 'team', name: '검증팀' }] } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => (
    ['월급제', '일급제', '용역팀'].map((payType, index) => ({
        id: `worker-${index}`, name: `검증${index}`, teamId: 'team', teamName: '검증팀', payType,
        bankName: '국민은행', accountNumber: 'fixture-account', accountHolder: `검증${index}`,
    }))
) } }));
jest.mock('../../services/dailyReportService', () => ({ dailyReportService: { getReportsByRange: jest.fn() } }));
jest.mock('../../services/advancePaymentService', () => ({ advancePaymentService: { getAdvancePaymentsByYearMonth: async () => [] } }));
jest.mock('../../services/statementOutputService', () => ({ statementOutputService: { getOutputsByMonth: async () => [] } }));
jest.mock('../../services/monthlyPayrollSettlementService', () => ({
    isFinalizedMonthlyPayrollRun: (status: string) => status === 'confirmed' || status === 'paid',
    monthlyPayrollSettlementService: { getSettlementsByYear: jest.fn() },
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
jest.mock('./components/PayslipTemplate', () => ({ PayslipTemplate: () => null }));
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
