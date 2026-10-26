import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdvanceSummaryPage from './AdvanceSummaryPage';
import { advancePaymentService } from '../../services/advancePaymentService';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { userService } from '../../services/userService';
import { DEFAULT_ADVANCE_ITEM_LABELS, payrollConfigService } from '../../services/payrollConfigService';
import { advancePaymentMemoService, AdvancePaymentMemoError } from '../../services/advancePaymentMemoService';
import { advancePaymentDepositAccountService, AdvancePaymentDepositAccountError } from '../../services/advancePaymentDepositAccountService';
import type { AdvancePaymentDepositAccount } from '../../types/advancePaymentDepositAccount';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../services/advancePaymentMemoService', () => ({ ...jest.requireActual('../../services/advancePaymentMemoService'), advancePaymentMemoService: { save: jest.fn() } }));
jest.mock('../../services/advancePaymentDepositAccountService', () => ({ ...jest.requireActual('../../services/advancePaymentDepositAccountService'), advancePaymentDepositAccountService: { save: jest.fn() } }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'test-admin' } }) }));
jest.mock('../../services/firestoreCrudCompat', () => ({}));
jest.mock('../../services/advancePaymentService', () => ({ advancePaymentService: { getAdvancePaymentsByYearMonth: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompaniesByType: jest.fn(), getCompanyById: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkerByUid: jest.fn(), getWorkers: jest.fn() } }));
jest.mock('../../services/userService', () => ({ userService: { getUser: jest.fn() } }));
jest.mock('../../services/payrollConfigService', () => ({ ...jest.requireActual('../../services/payrollConfigService'), payrollConfigService: { getConfigReadOnly: jest.fn() } }));
jest.mock('react-to-print', () => ({ useReactToPrint: () => jest.fn() }));

const record = { id: 'entry', workerId: 'test-worker', workerName: '검증 작업자', teamId: 'test-team',
    yearMonth: '2026-10', items: { corporateAdvance1: 100000, laborAdvance1: 50000 }, memo: '검증용 비고', totalDeduction: 900000 };
const renderPage = () => render(<MemoryRouter initialEntries={['/payroll/advance-summary?yearMonth=2026-10']}><AdvanceSummaryPage /></MemoryRouter>);
beforeEach(() => {
    jest.clearAllMocks();
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'admin' });
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'test-worker', bankName: '테스트은행', accountNumber: '000-0000-0000', accountHolder: '등록 예금주' }]);
    (teamService.getTeams as jest.Mock).mockResolvedValue([{ id: 'test-team', name: '검증 A팀', companyId: 'test-company' }]);
    (companyService.getCompaniesByType as jest.Mock).mockResolvedValue([{ id: 'test-company', name: '검증 시공사' }]);
    (payrollConfigService.getConfigReadOnly as jest.Mock).mockResolvedValue({ advanceItemLabels: { ...DEFAULT_ADVANCE_ITEM_LABELS, corporateAdvance1: '1차 가불' } });
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockResolvedValue([record]);
    (advancePaymentMemoService.save as jest.Mock).mockResolvedValue(undefined);
    (advancePaymentDepositAccountService.save as jest.Mock).mockResolvedValue(undefined);
});

test('저장한 가불을 팀별로 표시하고 검색·구분 필터와 원본 링크가 동작한다', async () => {
    renderPage();
    expect(await screen.findByRole('rowheader', { name: '검증 작업자' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가불·공제 입력' })).toHaveAttribute('href', '/payroll/advance-payment?yearMonth=2026-10&teamId=__ALL_TEAMS__');
    const totals = screen.getByLabelText('조회 결과 합계');
    expect(within(totals).getByText('150,000')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('가불 구분'), { target: { value: 'corporateAdvance1' } });
    expect(within(totals).getAllByText('100,000')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('이름·팀·비고 검색'), { target: { value: '존재하지 않는 검색어' } });
    expect(screen.getByRole('status')).toHaveTextContent('조회 조건에 맞는 가불내역이 없습니다');
    expect(screen.getByRole('button', { name: '인쇄 / PDF' })).toBeDisabled();
});

test('권한이 없는 계정은 가불 데이터와 설정을 조회하지 않는다', async () => {
    (userService.getUser as jest.Mock).mockResolvedValue({ role: '일반' });
    (manpowerService.getWorkerByUid as jest.Mock).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('시공사 계정과 관리자만');
    expect(advancePaymentService.getAdvancePaymentsByYearMonth).not.toHaveBeenCalled();
    expect(payrollConfigService.getConfigReadOnly).not.toHaveBeenCalled();
    expect(manpowerService.getWorkers).not.toHaveBeenCalled();
});

test('보기 방식을 바꿔도 모든 내역과 합계를 유지하고 팀 바로가기로 이동한다', async () => {
    (teamService.getTeams as jest.Mock).mockResolvedValue([
        { id: 'test-team', name: '검증 A팀', companyId: 'test-company' },
        { id: 'team-b', name: '검증 B팀', companyId: 'test-company' },
    ]);
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockResolvedValue([
        record, { ...record, id: 'entry-b', teamId: 'team-b', workerId: 'worker-b', workerName: '다른 작업자' },
    ]);
    renderPage();
    const compact = await screen.findByRole('button', { name: '엑셀형 · 3개씩' });
    expect(compact).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '한 팀씩 넓게' }));
    expect(compact).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('rowheader', { name: '검증 작업자' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '다른 작업자' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('조회 결과 합계')).getByText('300,000')).toBeInTheDocument();
    const target = screen.getByRole('region', { name: '검증 B팀 가불내역' });
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    const scrollTo = jest.fn();
    HTMLElement.prototype.scrollTo = scrollTo;
    try {
        fireEvent.click(screen.getByRole('button', { name: '검증 B팀 가불내역으로 이동' }));
        expect(target).toHaveFocus();
        expect(scrollTo).toHaveBeenCalled();
    } finally { HTMLElement.prototype.scrollTo = originalScrollTo; }
    expect(advancePaymentDepositAccountService.save).not.toHaveBeenCalled();
});

test('검색·팀·가불 필터를 한 번에 초기화하고 조회 월은 유지한다', async () => {
    renderPage();
    await screen.findByRole('rowheader', { name: '검증 작업자' });
    fireEvent.change(screen.getByLabelText('팀 선택'), { target: { value: 'test-team' } });
    fireEvent.change(screen.getByLabelText('가불 구분'), { target: { value: 'corporate' } });
    fireEvent.change(screen.getByLabelText('이름·팀·비고 검색'), { target: { value: '없는 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '검색·필터 초기화' }));
    expect(screen.getByLabelText('팀 선택')).toHaveValue('');
    expect(screen.getByLabelText('가불 구분')).toHaveValue('all');
    expect(screen.getByLabelText('이름·팀·비고 검색')).toHaveValue('');
    expect(screen.getByLabelText('조회 월')).toHaveValue('2026-10');
    expect(screen.getByRole('rowheader', { name: '검증 작업자' })).toBeInTheDocument();
});

test('금액과 비고 사이에 등록된 계좌와 예금주를 표시하고 새로고침하면 최신 정보를 가져온다', async () => {
    renderPage();
    const account = await screen.findByRole('cell', { name: '테스트은행 000-0000-0000 예금주 등록 예금주' });
    const cells = within(screen.getByRole('row', { name: /검증 작업자/ })).getAllByRole('cell');
    expect(cells[1]).toHaveClass('as-money');
    expect(cells[2]).toBe(account);
    expect(cells[3]).toHaveClass('as-deposit');
    expect(cells[4]).toHaveClass('as-memo');
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(['번호', '이름', '금액', '계좌번호·예금주', '입금계좌', '비고']);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'test-worker', bankName: '변경은행', accountNumber: '000-1111-0000', accountHolder: '변경 예금주' }]);
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(await screen.findByRole('cell', { name: '변경은행 000-1111-0000 예금주 변경 예금주' })).toBeInTheDocument();
    expect(manpowerService.getWorkers).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText('000-0000-0000')).not.toBeInTheDocument();
    expect(screen.queryByText('등록 예금주')).not.toBeInTheDocument();
});

test('등록된 계좌가 없으면 미등록을 표시하고 조회 오류를 미등록으로 숨기지 않는다', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole('cell', { name: '미등록 예금주 미등록' })).toBeInTheDocument();
    (manpowerService.getWorkers as jest.Mock).mockRejectedValueOnce(new Error('test account lookup failed'));
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    expect(screen.queryByRole('cell', { name: '미등록 예금주 미등록' })).not.toBeInTheDocument();
});

test('입금계좌 세 가지를 색상과 함께 자동 저장하고 새로고침해도 유지하며 해제할 수 있다', async () => {
    let stored = { ...record, depositAccount: '' as AdvancePaymentDepositAccount };
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockImplementation(async () => [stored]);
    (advancePaymentDepositAccountService.save as jest.Mock).mockImplementation(async changes => { stored = { ...stored, depositAccount: changes[0].depositAccount }; });
    renderPage();
    for (const next of ['cheongyeon', 'dawon', 'personal', ''] as const) {
        const select = await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' });
        const previous = stored.depositAccount;
        fireEvent.change(select, { target: { value: next } });
        await waitFor(() => expect(select).toHaveValue(next));
        expect(select).toHaveClass(`as-deposit-${next || 'none'}`);
        expect(advancePaymentDepositAccountService.save).toHaveBeenLastCalledWith([{ id: 'entry', expectedDepositAccount: previous, depositAccount: next }]);
        expect(screen.getByText('검증용 비고')).toBeInTheDocument();
        expect(within(screen.getByLabelText('조회 결과 합계')).getByText('150,000')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
        expect(await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' })).toHaveValue(next);
    }
});

test('입금계좌 저장 중 중복 요청을 막고 실패하면 원래 선택을 유지해 재시도할 수 있다', async () => {
    let failSave: (error: Error) => void = () => {};
    (advancePaymentDepositAccountService.save as jest.Mock).mockImplementationOnce(() => new Promise((_resolve, reject) => { failSave = reject; }));
    renderPage();
    const select = await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' });
    fireEvent.change(select, { target: { value: 'dawon' } });
    expect(select).toBeDisabled();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeDisabled();
    fireEvent.change(select, { target: { value: 'personal' } });
    expect(advancePaymentDepositAccountService.save).toHaveBeenCalledTimes(1);
    await act(async () => failSave(new AdvancePaymentDepositAccountError('다른 화면에서 입금계좌가 변경되었습니다. 새로고침해 주세요.')));
    expect(await screen.findByRole('alert')).toHaveTextContent('다른 화면');
    expect(select).toHaveValue('');
    expect(select).toBeEnabled();
    fireEvent.change(select, { target: { value: 'dawon' } });
    await waitFor(() => expect(select).toHaveValue('dawon'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('합산된 내역의 입금계좌가 다르면 혼합으로 표시하고 모든 원본에 선택을 저장한다', async () => {
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockResolvedValue([
        { ...record, depositAccount: 'cheongyeon' },
        { ...record, id: 'monthly', salaryModel: '월급제', depositAccount: 'dawon' },
    ]);
    renderPage();
    const select = await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' });
    expect(select).toHaveValue('mixed');
    fireEvent.change(select, { target: { value: 'personal' } });
    await waitFor(() => expect(select).toHaveValue('personal'));
    expect(advancePaymentDepositAccountService.save).toHaveBeenCalledWith([
        { id: 'entry', expectedDepositAccount: 'cheongyeon', depositAccount: 'personal' },
        { id: 'monthly', expectedDepositAccount: 'dawon', depositAccount: 'personal' },
    ]);
});

test('이전 월의 입금계좌 저장이 늦게 끝나도 현재 월 선택을 덮어쓰지 않는다', async () => {
    let finishSave: () => void = () => {};
    (advancePaymentDepositAccountService.save as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finishSave = resolve; }));
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockImplementation(async (_year, month) =>
        [{ ...record, yearMonth: `2026-${month}`, depositAccount: month === 10 ? '' : 'dawon' }]);
    renderPage();
    fireEvent.change(await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' }), { target: { value: 'personal' } });
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    const nextMonthSelect = await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' });
    expect(nextMonthSelect).toHaveValue('dawon');
    await act(async () => finishSave());
    expect(nextMonthSelect).toHaveValue('dawon');
    expect(nextMonthSelect).toBeEnabled();
});

test('상세를 열지 않아도 가불 항목별 금액이 보이고 필터 변경도 바로 반영된다', async () => {
    renderPage();
    const items = await screen.findByLabelText('검증 작업자 항목별 금액');
    expect(within(items).getByText('1차 가불')).toBeVisible();
    expect(within(items).getByText('100,000')).toBeVisible();
    expect(within(items).getByText(DEFAULT_ADVANCE_ITEM_LABELS.laborAdvance1)).toBeVisible();
    expect(within(items).getByText('50,000')).toBeVisible();
    expect(screen.queryByText('상세')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('가불 구분'), { target: { value: 'corporateAdvance1' } });
    expect(within(items).getByText('100,000')).toBeVisible();
    expect(within(items).queryByText('50,000')).not.toBeInTheDocument();
});

test('조회 실패를 빈 결과나 0원으로 표시하지 않고 재시도할 수 있다', async () => {
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockRejectedValueOnce(new Error('test offline'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    expect(screen.queryByLabelText('조회 결과 합계')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('rowheader', { name: '검증 작업자' })).toBeInTheDocument();
});

test('월 변경 후 늦게 도착한 이전 월 응답이 최신 조회를 덮어쓰지 않는다', async () => {
    let finishOldMonth: (value: unknown) => void = () => {};
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockImplementation((_year, month) =>
        month === 10 ? new Promise(resolve => { finishOldMonth = resolve; }) : Promise.resolve([]));
    renderPage();
    await waitFor(() => expect(advancePaymentService.getAdvancePaymentsByYearMonth).toHaveBeenCalledWith(2026, 10));
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    expect(await screen.findByRole('heading', { name: '2026년 11월 가불내역' })).toBeInTheDocument();
    await act(async () => { finishOldMonth([record]); });
    expect(screen.queryByRole('rowheader', { name: '검증 작업자' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026년 11월 가불내역' })).toBeInTheDocument();
});

test('비고를 수정해 저장하면 표와 새로 조회한 화면에 반영되고 금액은 유지된다', async () => {
    let stored = { ...record };
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockImplementation(async () => [stored]);
    (advancePaymentMemoService.save as jest.Mock).mockImplementation(async changes => { stored = { ...stored, memo: changes[0].memo }; });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '검증 A팀 검증 작업자 비고 수정' }));
    fireEvent.change(screen.getByRole('textbox', { name: '비고 내용' }), { target: { value: '새 비고\n둘째 줄' } });
    fireEvent.click(screen.getByRole('button', { name: '비고 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(advancePaymentMemoService.save).toHaveBeenCalledWith([{ id: 'entry', expectedMemo: '검증용 비고', memo: '새 비고\n둘째 줄' }]);
    expect(screen.getByText('새 비고 둘째 줄')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검증 A팀 검증 작업자 비고 수정' })).toHaveClass('as-memo-filled');
    expect(within(screen.getByLabelText('조회 결과 합계')).getByText('150,000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(await screen.findByText('새 비고 둘째 줄')).toBeInTheDocument();
});

test('합산된 급여 구분의 비고를 구별하고 바꾼 원본만 저장한다', async () => {
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockResolvedValue([
        { ...record, salaryModel: '일급제' }, { ...record, id: 'monthly-entry', salaryModel: '월급제', memo: '월급 비고' },
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '검증 A팀 검증 작업자 비고 수정' }));
    expect(screen.getByRole('textbox', { name: '일급제 비고 1' })).toHaveValue('검증용 비고');
    fireEvent.change(screen.getByRole('textbox', { name: '월급제 비고 2' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '비고 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(advancePaymentMemoService.save).toHaveBeenCalledWith([{ id: 'monthly-entry', expectedMemo: '월급 비고', memo: '' }]);
    expect(screen.getByText('검증용 비고')).toBeInTheDocument();
    expect(screen.queryByText('월급 비고')).not.toBeInTheDocument();
});

test('저장 실패나 충돌 시 입력을 유지하고 다시 저장할 수 있다', async () => {
    (advancePaymentMemoService.save as jest.Mock).mockRejectedValueOnce(new AdvancePaymentMemoError('다른 화면에서 비고가 변경되었습니다.'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '검증 A팀 검증 작업자 비고 수정' }));
    fireEvent.change(screen.getByRole('textbox', { name: '비고 내용' }), { target: { value: '유지할 입력' } });
    fireEvent.click(screen.getByRole('button', { name: '비고 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('다른 화면');
    expect(screen.getByRole('textbox', { name: '비고 내용' })).toHaveValue('유지할 입력');
    expect(screen.getByRole('button', { name: '비고 저장' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '비고 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('유지할 입력')).toBeInTheDocument();
});

test('저장 전 닫기는 입력 폐기를 확인하고 저장을 호출하지 않는다', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '검증 A팀 검증 작업자 비고 수정' }));
    fireEvent.change(screen.getByRole('textbox', { name: '비고 내용' }), { target: { value: '미저장 입력' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByRole('alert')).toHaveTextContent('저장하지 않은 비고');
    fireEvent.click(screen.getByRole('button', { name: '변경 버리고 닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(advancePaymentMemoService.save).not.toHaveBeenCalled();
    expect(screen.getByText('검증용 비고')).toBeInTheDocument();
});
