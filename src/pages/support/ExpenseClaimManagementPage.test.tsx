import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExpenseClaimManagementPage from './ExpenseClaimManagementPage';
import { useExpenseLedgerData } from './hooks/useExpenseLedgerData';
import { teamExpenseLedgerService } from '../../services/teamExpenseLedgerService';
import { toast } from '../../utils/swal';

jest.mock('../../components/SecureExpenseReceipt', () => () => null);
jest.mock('../../components/support/SupportTeamFilterTabs', () => () => null);
jest.mock('../../services/geminiService', () => ({ geminiService: {} }));
jest.mock('../../services/storageService', () => ({ storageService: {} }));
jest.mock('../../services/teamExpenseCategoryService', () => ({ teamExpenseCategoryService: {} }));
jest.mock('../../services/officeFixedExpenseService', () => ({ officeFixedExpenseService: { getExpenses: async () => [] } }));
jest.mock('../../services/teamExpenseLedgerService', () => ({ teamExpenseLedgerService: { saveClaim: jest.fn() } }));
jest.mock('../../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('./hooks/useExpenseLedgerData', () => ({
  useExpenseLedgerData: jest.fn(),
  buildDefaultDate: (month: string) => `${month}-01`,
  formatCurrency: (amount: number) => amount.toLocaleString('ko-KR'),
  getAttendedSiteOptions: () => [],
  getCategoryLabel: () => '기타',
  getEffectiveClaimType: (claim: { claimType: string }) => claim.claimType,
  hexToRgba: () => 'rgba(0, 0, 0, 0.1)',
  normalizeColor: () => '#2563eb'
}));

const mockUseData = useExpenseLedgerData as jest.MockedFunction<typeof useExpenseLedgerData>;
const mockSave = teamExpenseLedgerService.saveClaim as jest.MockedFunction<typeof teamExpenseLedgerService.saveClaim>;

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  window.sessionStorage.setItem('cy.support-management.year-month', '2026-11');
  Element.prototype.scrollIntoView = jest.fn();
  mockSave.mockResolvedValue('saved');
  mockUseData.mockReturnValue({
    loading: false,
    teamOptions: [{ id: 'fixture-team', name: '검증팀' }],
    siteOptions: [], cardLabelOptions: [], expenseCategories: [], activeExpenseCategories: [],
    allCategoryOptions: [{ value: 'etc', label: '기타' }],
    categoryOptions: [{ value: 'etc', label: '기타' }],
    otherClaimCategoryOptions: [{ value: 'etc', label: '기타' }],
    officeExpenseCategoryOptions: [{ value: 'officeExpense', label: '사무실경비' }],
    rawDocs: { claims: [], dailyReports: [] }, loadData: jest.fn(async () => undefined)
  } as unknown as ReturnType<typeof useExpenseLedgerData>);
});

async function openOtherClaim() {
  render(<ExpenseClaimManagementPage embedded />);
  await waitFor(() => expect(screen.getByRole('button', { name: '등록' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /^기타청구 해당 팀/ }));
  fireEvent.change(screen.getByLabelText('청구팀'), { target: { value: 'fixture-team' } });
  fireEvent.change(screen.getByLabelText('내용'), { target: { value: '숙소비 차감' } });
}

it('마이너스 기호부터 입력한 기타청구를 음수 그대로 등록한다', async () => {
  await openOtherClaim();
  userEvent.type(screen.getByPlaceholderText('금액 입력'), '-100000');
  expect(screen.getByPlaceholderText('금액 입력')).toHaveValue('-100,000');
  expect(screen.getByText(/차감할 금액은 마이너스/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '등록' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
    claimType: 'otherExpense', payerTeamId: 'fixture-team', amount: -100000, status: 'charged'
  })));
  expect(toast.error).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByPlaceholderText('금액 입력')).toHaveValue(''));
});

it('기존 음수 기타청구를 불러와 수정해도 부호를 유지한다', async () => {
  const data = mockUseData('2026-11', 'all');
  mockUseData.mockReturnValue({ ...data, rawDocs: { ...data.rawDocs, claims: [{
    id: 'credit', yearMonth: '2026-11', date: '2026-11-01', claimType: 'otherExpense',
    payerTeamId: 'fixture-team', payerTeamName: '검증팀', chargeToTeamId: '', chargeToTeamName: '',
    siteName: '', category: 'etc', description: '숙소비 차감', amount: -100000, status: 'charged'
  }] } });
  render(<ExpenseClaimManagementPage embedded />);
  fireEvent.click(await screen.findByTitle('수정'));
  expect(screen.getByPlaceholderText('금액 입력')).toHaveValue('-100,000');
  fireEvent.change(screen.getByPlaceholderText('금액 입력'), { target: { value: '-50000' } });
  fireEvent.click(screen.getByRole('button', { name: '수정 저장' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'credit', amount: -50000 })));
});

it('0원은 거절하고 음수 입력 후 다른 청구 유형으로 전환하면 저장을 막는다', async () => {
  await openOtherClaim();
  fireEvent.click(screen.getByRole('button', { name: '등록' }));
  expect(toast.error).toHaveBeenLastCalledWith('0원이 아닌 금액을 입력해주세요.');
  fireEvent.change(screen.getByPlaceholderText('금액 입력'), { target: { value: '-1000' } });
  fireEvent.click(screen.getByRole('button', { name: /^사무실경비 사무실 비용/ }));
  fireEvent.click(screen.getByRole('button', { name: '등록' }));
  expect(toast.error).toHaveBeenLastCalledWith('마이너스 금액은 기타청구에서만 입력할 수 있습니다.');
  expect(mockSave).not.toHaveBeenCalled();
});

it('음수 금액만 입력해도 미저장 변경으로 알린다', async () => {
  const onDirtyChange = jest.fn();
  render(<ExpenseClaimManagementPage embedded onDirtyChange={onDirtyChange} />);
  fireEvent.click(screen.getByRole('button', { name: /^기타청구 해당 팀/ }));
  fireEvent.change(screen.getByPlaceholderText('금액 입력'), { target: { value: '-1000' } });
  await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
});
