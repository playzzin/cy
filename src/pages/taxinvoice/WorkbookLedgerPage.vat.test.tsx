import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Swal from 'sweetalert2';
import type { QuarterVatPaymentRecord } from '../../services/quarterVatPaymentService';

const mockPayments: QuarterVatPaymentRecord[] = [];
const mockGetPayments = jest.fn();
const mockAddPayment = jest.fn();
const mockDeletePayment = jest.fn();
const mockAddEntries = jest.fn();
const mockSaveAs = jest.fn();
const mockXlsxWrite = jest.fn(() => new Uint8Array());
const mockVatService = { getPayments: mockGetPayments, addPayment: mockAddPayment, deletePayment: mockDeletePayment };
const mockInvoice = (id: string, date: string, taxAmount: number) => ({
    id, date, taxAmount, transactionType: '매출', partnerName: '검증 거래처', siteName: '검증 현장',
    description: '합성 검증 자료', supplyAmount: taxAmount * 10, totalAmount: taxAmount * 11, paymentAmount: 0,
});
const mockLedgerService = {
    getEntries: async () => [mockInvoice('q1', '2026-02-01', 100000), mockInvoice('q3', '2026-08-01', 200000)],
    addEntries: mockAddEntries,
};
jest.mock('sweetalert2', () => ({ __esModule: true, default: { fire: jest.fn(async () => ({ isConfirmed: true })) } }));
jest.mock('file-saver', () => ({ saveAs: (...args: unknown[]) => mockSaveAs(...args) }));
jest.mock('xlsx-js-style', () => ({
    ...jest.requireActual('xlsx-js-style'), write: (...args: unknown[]) => (mockXlsxWrite as jest.Mock)(...args),
}));
jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'vat-test' } }) }));
jest.mock('../../services/companyService', () => ({ companyService: { getActiveCompanies: async () => [] } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: async () => [] } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: async () => [] } }));
jest.mock('../../services/accountDirectoryService', () => ({ accountDirectoryService: { getEntriesByCategory: async () => [] } }));
jest.mock('../../services/aiSettingsService', () => ({ aiSettingsService: {} }));
jest.mock('../../services/quarterVatPaymentService', () => ({ createQuarterVatPaymentService: () => mockVatService }));
jest.mock('../../services/taxInvoiceBulkImportService', () => ({ createTaxInvoiceDuplicateFingerprint: () => '' }));
jest.mock('./components/TaxInvoiceBulkImportModal', () => () => null);
jest.mock('../../components/common/AppIntroScreen', () => () => <div>조회 중</div>);
jest.mock('../../services/workbookLedgerService', () => ({
    ...jest.requireActual('../../services/workbookLedgerService'), createWorkbookLedgerService: () => mockLedgerService,
}));
const { default: WorkbookLedgerPage } = require('./WorkbookLedgerPage') as typeof import('./WorkbookLedgerPage');
const mount = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><WorkbookLedgerPage /></MemoryRouter>);
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const queryQuarter = async (quarter: string) => {
    change('부가세 조회연도', '2026');
    change('부가세 조회분기', quarter);
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '납부 내역 등록' })).toBeEnabled());
};
const balanceRow = (quarter: string) => within(screen.getByRole('table', { name: '분기별 납부 현황' }))
    .getByRole('row', { name: new RegExp(`^${quarter} `) });

beforeEach(() => {
    jest.clearAllMocks();
    (Swal.fire as jest.Mock).mockResolvedValue({ isConfirmed: true });
    window.sessionStorage.clear();
    window.sessionStorage.setItem('workbook-ledger:cheongyeon:active-tab', 'vat');
    mockPayments.splice(0);
    mockGetPayments.mockReset().mockImplementation(async (year) => mockPayments.filter((payment) => payment.year === year));
    mockAddPayment.mockReset().mockImplementation(async (input) => {
        const payment = { ...input, id: `payment-${mockPayments.length + 1}`, createdAt: new Date().toISOString() };
        mockPayments.push(payment);
        return payment;
    });
    mockDeletePayment.mockResolvedValue(undefined);
});

it('registers Q1 installments paid in Q3, preserves Q3 debt, and reloads history without creating a purchase', async () => {
    const view = mount();
    await queryQuarter('Q3');
    change('귀속분기', 'Q1');
    change('실제 납부일', '2026-08-15');
    change('납부금액', '40,000');
    fireEvent.click(screen.getByRole('button', { name: '납부 내역 등록' }));
    await waitFor(() => expect(balanceRow('1분기')).toHaveTextContent('일부 납부'));
    expect(balanceRow('1분기')).toHaveTextContent('40,000');
    expect(balanceRow('1분기')).toHaveTextContent('60,000');
    expect(balanceRow('3분기')).toHaveTextContent('미납');
    expect(mockAddPayment).toHaveBeenCalledWith(expect.objectContaining({ year: 2026, quarter: 'Q1', date: '2026-08-15', amount: 40000 }));
    expect(mockAddEntries).not.toHaveBeenCalled();
    change('실제 납부일', '2026-09-20');
    change('납부금액', '60,000');
    fireEvent.click(screen.getByRole('button', { name: '납부 내역 등록' }));
    await waitFor(() => expect(balanceRow('1분기')).toHaveTextContent('납부 완료'));
    view.unmount();
    mount();
    await queryQuarter('Q3');
    expect(balanceRow('1분기')).toHaveTextContent('납부 완료');
    expect(balanceRow('3분기')).toHaveTextContent('200,000');
    const history = within(screen.getByRole('table', { name: '부가세 납부 내역' }));
    expect(history.getAllByRole('row')).toHaveLength(6);
    expect(history.getByRole('columnheader', { name: '발생금액' })).toBeInTheDocument();
    expect(history.getByRole('columnheader', { name: '잔액' })).toBeInTheDocument();
    expect(within(history.getByRole('row', { name: /2026-08-15/ })).getAllByRole('cell').map((cell) => cell.textContent))
        .toEqual(['2', '2026년 1분기', '2026-08-15', '-', '40,000', '60,000', '-', '삭제']);
    expect(within(history.getByRole('row', { name: /2026-09-20/ })).getAllByRole('cell').map((cell) => cell.textContent))
        .toEqual(['3', '2026년 1분기', '2026-09-20', '-', '60,000', '0', '-', '삭제']);
    expect(history.getAllByRole('button', { name: '삭제' })).toHaveLength(2);
    const metrics = screen.getByLabelText('선택 분기 납부 현황');
    expect(within(metrics).getByRole('group', { name: '누적 납부금액' })).toHaveTextContent('0');
    expect(within(metrics).getByRole('group', { name: '남은 납부금액' })).toHaveTextContent('200,000');
});

it('allows registration in the annual view and accepts an earlier attribution year', async () => {
    mount();
    await queryQuarter('all');
    change('귀속연도', '2025');
    change('귀속분기', 'Q4');
    change('실제 납부일', '2026-01-20');
    change('납부금액', '10,000');
    fireEvent.click(screen.getByRole('button', { name: '납부 내역 등록' }));
    await waitFor(() => expect(screen.getByLabelText('부가세 조회연도')).toHaveValue(2025));
    expect(mockAddPayment).toHaveBeenCalledWith(expect.objectContaining({ year: 2025, quarter: 'Q4', date: '2026-01-20' }));
    await waitFor(() => expect(screen.getByRole('table', { name: '부가세 납부 내역' })).toHaveTextContent('2025년 4분기'));
});

it('shows a load failure instead of zero debt and lets the user retry', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetPayments.mockRejectedValue(new Error('unavailable'));
    mount();
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: '납부 내역 등록' })).toBeDisabled();
    expect(screen.queryByText('등록된 납부 내역이 없습니다.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('선택 분기 납부 현황')).toHaveTextContent('확인 필요');
    mockGetPayments.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: '납부 내역 다시 조회' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '납부 내역 등록' })).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    consoleError.mockRestore();
});

it('exports and prints the same quarterly outstanding amounts without offsetting overpayments', async () => {
    mockPayments.push({ id: 'overpaid', year: 2026, quarter: 'Q1', date: '2026-08-15', amount: 120000,
        note: '합성 검증', createdAt: '', createdBy: 'vat-test' });
    mount();
    await queryQuarter('all');
    fireEvent.click(screen.getByRole('button', { name: '엑셀' }));
    await waitFor(() => expect(mockSaveAs).toHaveBeenCalledTimes(1));
    const book = (mockXlsxWrite as jest.Mock).mock.calls[0][0];
    const XLSX = jest.requireActual('xlsx-js-style');
    const balanceRows = XLSX.utils.sheet_to_json(book.Sheets['분기별 납부현황'], { header: 1 });
    expect(balanceRows[3]).toEqual(['1분기', 100000, 120000, 0, 20000, 0, '2026-08-15', '초과 납부']);
    expect(balanceRows[5]).toEqual(['3분기', 200000, 0, 200000, 0, 0, '-', '미납']);
    const summaryRows = XLSX.utils.sheet_to_json(book.Sheets['부가세 요약'], { header: 1 });
    expect(summaryRows[4][8]).toBe(200000);
    const historyRows = XLSX.utils.sheet_to_json(book.Sheets['납부내역'], { header: 1 });
    expect(historyRows[7]).toEqual(['No', '귀속연도·분기', '실제 납부일', '발생금액', '납부금액', '잔액', '메모']);
    expect(historyRows[8]).toEqual([1, '2026년 1분기', '-', 100000, '', 100000, '납부 전 잔액']);
    expect(historyRows[9]).toEqual([2, '2026년 1분기', '2026-08-15', '', 120000, 0, '합성 검증']);
    expect(historyRows[10]).toEqual([3, '2026년 3분기', '-', 200000, '', 200000, '납부 전 잔액']);
    expect(historyRows[11]).toEqual(['', '', '합계', 300000, 120000, 200000, '']);
    const roundTrip = XLSX.read(XLSX.write(book, { bookType: 'xlsx', type: 'buffer' }), { type: 'buffer' });
    expect(roundTrip.Sheets['납부내역']['!autofilter'].ref).toBe('A8:G11');
    expect(roundTrip.Sheets['납부내역'].F10.v).toBe(0);
    expect(roundTrip.Sheets['납부내역'].F12.v).toBe(200000);
    await queryQuarter('Q3');
    fireEvent.click(screen.getByRole('button', { name: '엑셀' }));
    await waitFor(() => expect(mockSaveAs).toHaveBeenCalledTimes(2));
    const q3Book = (mockXlsxWrite as jest.Mock).mock.calls[1][0];
    const q3History = XLSX.utils.sheet_to_json(q3Book.Sheets['납부내역'], { header: 1 });
    expect(q3History[9].slice(1, 6)).toEqual(['2026년 1분기', '2026-08-15', '', 120000, 0]);
    expect(q3History[4]).toEqual([300000, '', 120000, '', '', 200000, '']);
    const write = jest.fn();
    const open = jest.spyOn(window, 'open').mockReturnValue({ document: { write, close: jest.fn() } } as unknown as Window);
    fireEvent.click(screen.getByRole('button', { name: '인쇄' }));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('분기별 납부 현황'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('2026년 1분기'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('<strong>200,000</strong>'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('<th>발생금액</th><th>납부금액</th><th>잔액</th>'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('<td class="right">120,000</td>\n                    <td class="right">0</td>'));
    open.mockRestore();
});

it('recalculates the running balance after deleting a payment, leaving opening amounts intact', async () => {
    mockPayments.push(
        { id: 'late', year: 2026, quarter: 'Q1', date: '2026-09-20', amount: 30000, note: '후속 납부', createdAt: '', createdBy: '' },
        { id: 'early', year: 2026, quarter: 'Q1', date: '2026-08-15', amount: 40000, note: '첫 납부', createdAt: '', createdBy: '' },
    );
    mount();
    await queryQuarter('all');
    const history = within(screen.getByRole('table', { name: '부가세 납부 내역' }));
    expect(history.getAllByRole('row')[2]).toHaveTextContent('첫 납부');
    fireEvent.click(within(history.getByRole('row', { name: /첫 납부/ })).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(history.queryByRole('row', { name: /첫 납부/ })).not.toBeInTheDocument());
    expect(mockDeletePayment).toHaveBeenCalledWith(2026, 'Q1', 'early');
    expect(within(history.getByRole('row', { name: /후속 납부/ })).getAllByRole('cell')[5]).toHaveTextContent('70,000');
    expect(history.getAllByText('납부 전 잔액')).toHaveLength(2);
});
