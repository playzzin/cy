import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdvanceSummaryPage from './AdvanceSummaryPage';
import { advanceRequestService } from '../../services/advanceRequestService';
import { advancePaymentService } from '../../services/advancePaymentService';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { userService } from '../../services/userService';
import { advancePaymentMemoService, AdvancePaymentMemoError } from '../../services/advancePaymentMemoService';
import { advancePaymentDepositAccountService, AdvancePaymentDepositAccountError } from '../../services/advancePaymentDepositAccountService';
import type { AdvancePaymentDepositAccount } from '../../types/advancePaymentDepositAccount';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../services/advancePaymentMemoService', () => ({ ...jest.requireActual('../../services/advancePaymentMemoService'), advancePaymentMemoService: { save: jest.fn() } }));
jest.mock('../../services/advancePaymentDepositAccountService', () => ({ ...jest.requireActual('../../services/advancePaymentDepositAccountService'), advancePaymentDepositAccountService: { save: jest.fn() } }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'test-admin' } }) }));
jest.mock('../../services/firestoreCrudCompat', () => ({}));
jest.mock('../../services/advanceRequestService', () => ({ advanceRequestService: { listByYearMonth: jest.fn(), setCategory: jest.fn(), setPrepayment: jest.fn() } }));
jest.mock('../../services/advancePaymentService', () => ({ advancePaymentService: { getAdvancePaymentsByYearMonth: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompaniesByType: jest.fn(), getCompanyById: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkerByUid: jest.fn(), getWorkers: jest.fn() } }));
jest.mock('../../services/userService', () => ({ userService: { getUser: jest.fn() } }));
jest.mock('react-to-print', () => ({ useReactToPrint: () => jest.fn() }));

const record = { id: 'entry', workerId: 'test-worker', workerName: '검증 작업자', teamId: 'test-team',
    yearMonth: '2026-10', category: 'first', status: 'requested', requestedAmount: 150000, memo: '검증용 비고' };
const renderPage = () => render(<MemoryRouter initialEntries={['/payroll/advance-summary?yearMonth=2026-10']}><AdvanceSummaryPage /></MemoryRouter>);
beforeEach(() => {
    jest.clearAllMocks();
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'admin' });
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'test-worker', name: '검증 작업자', teamId: 'test-team', bankName: '테스트은행', accountNumber: '000-0000-0000', accountHolder: '등록 예금주' }]);
    (teamService.getTeams as jest.Mock).mockResolvedValue([{ id: 'test-team', name: '검증 A팀', companyId: 'test-company' }]);
    (companyService.getCompaniesByType as jest.Mock).mockResolvedValue([{ id: 'test-company', name: '검증 시공사' }]);
    (advanceRequestService.listByYearMonth as jest.Mock).mockResolvedValue([record]);
    (advancePaymentMemoService.save as jest.Mock).mockResolvedValue(undefined);
    (advancePaymentDepositAccountService.save as jest.Mock).mockResolvedValue(undefined);
});

test('회차 누락을 선입금으로 합치지 않고 지정 후 해당 회차 합계에 반영한다', async () => {
    (advanceRequestService.listByYearMonth as jest.Mock).mockResolvedValue([{ ...record, category: undefined }]);
    (advanceRequestService.setCategory as jest.Mock).mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '검증 작업자 150,000원 1회차로 지정' }));
    await screen.findByText('신청 회차를 수정했습니다.');
    expect(advanceRequestService.setCategory).toHaveBeenCalledWith('entry', 'first', 'unclassified');
    const row = screen.getByRole('row', { name: /검증 작업자/ });
    expect(within(row).getAllByRole('cell').slice(1, 5).map(cell => cell.textContent)).toEqual(['150,000', '0', '0', '150,000']);
    expect(screen.queryByText(/회차 미지정 1건/)).not.toBeInTheDocument();
});

test('선입금은 수기로 저장하고 신청이 없는 작업자도 추가하며 재조회로 집계한다', async () => {
    (advanceRequestService.listByYearMonth as jest.Mock).mockResolvedValue([]);
    (advanceRequestService.setPrepayment as jest.Mock).mockImplementation(async () => {
        (advanceRequestService.listByYearMonth as jest.Mock).mockResolvedValue([{ ...record, id: 'manual', source: 'manual-prepayment', category: 'other', status: 'paid', requestedAmount: 30000 }]);
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '선입금 수기 입력', exact: true }));
    const dialog = screen.getByRole('dialog', { name: '선입금 수기 입력' });
    fireEvent.change(within(dialog).getByLabelText('선입금 작업자'), { target: { value: 'test-worker' } });
    fireEvent.change(within(dialog).getByLabelText('선입금 금액'), { target: { value: '30000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '선입금 저장' }));
    await screen.findByRole('rowheader', { name: '검증 작업자' });
    expect(advanceRequestService.setPrepayment).toHaveBeenCalledWith('test-worker', '2026-10', 30000, 0);
    expect(screen.getByRole('button', { name: '검증 작업자 선입금 수기 입력' })).toHaveTextContent('30,000');
});

test('저장한 가불을 팀별로 표시하고 검색·구분 필터와 원본 링크가 동작한다', async () => {
    renderPage();
    expect(await screen.findByRole('rowheader', { name: '검증 작업자' })).toBeInTheDocument();
    expect(advanceRequestService.listByYearMonth).toHaveBeenCalledWith('2026-10');
    expect(advancePaymentService.getAdvancePaymentsByYearMonth).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: '가불 신청' })).toHaveAttribute('href', '/payroll/advance-request');
    const totals = screen.getByLabelText('조회 결과 합계');
    expect(within(totals).getAllByText('150,000')[0]).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('신청 분류'), { target: { value: 'first' } });
    expect(within(totals).getAllByText('150,000')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('이름·팀·비고 검색'), { target: { value: '존재하지 않는 검색어' } });
    expect(screen.getByRole('status')).toHaveTextContent('조회 조건에 맞는 가불내역이 없습니다');
    expect(screen.getByRole('button', { name: '인쇄 / PDF' })).toBeDisabled();
});

test('권한이 없는 계정은 가불 데이터와 설정을 조회하지 않는다', async () => {
    (userService.getUser as jest.Mock).mockResolvedValue({ role: '일반' });
    (manpowerService.getWorkerByUid as jest.Mock).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('시공사 계정과 관리자만');
    expect(advanceRequestService.listByYearMonth).not.toHaveBeenCalled();
    expect(manpowerService.getWorkers).not.toHaveBeenCalled();
});

test('보기 방식을 바꿔도 모든 내역과 합계를 유지하고 팀 바로가기로 이동한다', async () => {
    (teamService.getTeams as jest.Mock).mockResolvedValue([
        { id: 'test-team', name: '검증 A팀', companyId: 'test-company' },
        { id: 'team-b', name: '검증 B팀', companyId: 'test-company' },
    ]);
    (advanceRequestService.listByYearMonth as jest.Mock).mockResolvedValue([
        record, { ...record, id: 'entry-b', teamId: 'team-b', workerId: 'worker-b', workerName: '다른 작업자' },
    ]);
    renderPage();
    const compact = await screen.findByRole('button', { name: '엑셀형 · 4개씩' });
    expect(compact).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '한 팀씩 넓게' }));
    expect(compact).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('rowheader', { name: '검증 작업자' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '다른 작업자' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('조회 결과 합계')).getAllByText('300,000')[0]).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText('신청 분류'), { target: { value: 'first' } });
    fireEvent.change(screen.getByLabelText('이름·팀·비고 검색'), { target: { value: '없는 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '검색·필터 초기화' }));
    expect(screen.getByLabelText('팀 선택')).toHaveValue('');
    expect(screen.getByLabelText('신청 분류')).toHaveValue('all');
    expect(screen.getByLabelText('이름·팀·비고 검색')).toHaveValue('');
    expect(screen.getByLabelText('조회 월')).toHaveValue('2026-10');
    expect(screen.getByRole('rowheader', { name: '검증 작업자' })).toBeInTheDocument();
});

test('금액·입금구분·비고는 한 행에 표시하고 계좌는 바로 아래 행에서 최신 정보를 보여준다', async () => {
    renderPage();
    const account = await screen.findByRole('cell', { name: '계좌 테스트은행 000-0000-0000 예금주 등록 예금주' });
    const cells = within(screen.getByRole('row', { name: /검증 작업자/ })).getAllByRole('cell');
    expect(cells[1]).toHaveClass('as-money');
    expect(cells[5]).toHaveClass('as-deposit');
    expect(cells[6]).toHaveClass('as-memo');
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    const workerIndex = rows.indexOf(screen.getByRole('row', { name: /검증 작업자/ }));
    expect(within(rows[workerIndex + 1]).getByRole('cell')).toBe(account);
    expect(account).toHaveAttribute('colspan', '8');
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(['번호', '이름', '1회차', '2회차', '선입금', '총금액', '입금구분', '비고']);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'test-worker', bankName: '변경은행', accountNumber: '000-1111-0000', accountHolder: '변경 예금주' }]);
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(await screen.findByRole('cell', { name: '계좌 변경은행 000-1111-0000 예금주 변경 예금주' })).toBeInTheDocument();
    expect(manpowerService.getWorkers).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText('000-0000-0000')).not.toBeInTheDocument();
    expect(screen.queryByText('등록 예금주')).not.toBeInTheDocument();
});

test('등록된 계좌가 없으면 미등록을 표시하고 조회 오류를 미등록으로 숨기지 않는다', async () => {
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole('cell', { name: '계좌 미등록 예금주 미등록' })).toBeInTheDocument();
    (manpowerService.getWorkers as jest.Mock).mockRejectedValueOnce(new Error('test account lookup failed'));
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    expect(screen.queryByRole('cell', { name: '미등록 예금주 미등록' })).not.toBeInTheDocument();
});

test('입금계좌 세 가지를 색상과 함께 자동 저장하고 새로고침해도 유지하며 해제할 수 있다', async () => {
    let stored = { ...record, depositAccount: '' as AdvancePaymentDepositAccount };
    (advanceRequestService.listByYearMonth as jest.Mock).mockImplementation(async () => [stored]);
    (advancePaymentDepositAccountService.save as jest.Mock).mockImplementation(async changes => { stored = { ...stored, depositAccount: changes[0].depositAccount }; });
    renderPage();
    for (const next of ['corporate', 'personal', 'other', ''] as const) {
        const select = await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' });
        const previous = stored.depositAccount;
        fireEvent.change(select, { target: { value: next } });
        await waitFor(() => expect(select).toHaveValue(next));
        expect(select).toHaveClass(`as-deposit-${next || 'none'}`);
        const depositTotals = screen.getByLabelText('입금계좌별 합계');
        for (const [value, label] of [['corporate', '법인입금'], ['personal', '개인입금'], ['other', '기타입금']]) {
            expect(within(select).getByRole('option', { name: label })).toBeInTheDocument();
            const card = within(depositTotals).getByRole('group', { name: `${label} 총액` });
            expect(within(card).getByText(next === value ? '150,000' : '0')).toBeInTheDocument();
        }
        expect(advancePaymentDepositAccountService.save).toHaveBeenLastCalledWith([{ id: 'entry', expectedDepositAccount: previous, depositAccount: next }], 'advance_requests');
        expect(screen.getByText('검증용 비고')).toBeInTheDocument();
        expect(within(screen.getByLabelText('조회 결과 합계')).getAllByText('150,000')[0]).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
        expect(await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' })).toHaveValue(next);
    }
});

test('입금계좌 저장 중 중복 요청을 막고 실패하면 원래 선택을 유지해 재시도할 수 있다', async () => {
    let failSave: (error: Error) => void = () => {};
    (advancePaymentDepositAccountService.save as jest.Mock).mockImplementationOnce(() => new Promise((_resolve, reject) => { failSave = reject; }));
    renderPage();
    const select = await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' });
    fireEvent.change(select, { target: { value: 'other' } });
    expect(select).toBeDisabled();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeDisabled();
    fireEvent.change(select, { target: { value: 'personal' } });
    expect(advancePaymentDepositAccountService.save).toHaveBeenCalledTimes(1);
    await act(async () => failSave(new AdvancePaymentDepositAccountError('다른 화면에서 입금계좌가 변경되었습니다. 새로고침해 주세요.')));
    expect(await screen.findByRole('alert')).toHaveTextContent('다른 화면');
    expect(select).toHaveValue('');
    expect(select).toBeEnabled();
    fireEvent.change(select, { target: { value: 'other' } });
    await waitFor(() => expect(select).toHaveValue('other'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('합산된 내역의 입금계좌가 다르면 혼합으로 표시하고 모든 원본에 선택을 저장한다', async () => {
    (advanceRequestService.listByYearMonth as jest.Mock).mockResolvedValue([
        { ...record, depositAccount: 'cheongyeon' },
        { ...record, id: 'monthly', category: 'second', depositAccount: 'dawon' },
    ]);
    renderPage();
    const select = await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' });
    expect(select).toHaveValue('mixed');
    fireEvent.change(select, { target: { value: 'personal' } });
    await waitFor(() => expect(select).toHaveValue('personal'));
    expect(advancePaymentDepositAccountService.save).toHaveBeenCalledWith([
        { id: 'entry', expectedDepositAccount: 'cheongyeon', depositAccount: 'personal' },
        { id: 'monthly', expectedDepositAccount: 'dawon', depositAccount: 'personal' },
    ], 'advance_requests');
});

test('이전 월의 입금계좌 저장이 늦게 끝나도 현재 월 선택을 덮어쓰지 않는다', async () => {
    let finishSave: () => void = () => {};
    (advancePaymentDepositAccountService.save as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finishSave = resolve; }));
    (advanceRequestService.listByYearMonth as jest.Mock).mockImplementation(async yearMonth =>
        [{ ...record, yearMonth, depositAccount: yearMonth === '2026-10' ? '' : 'dawon' }]);
    renderPage();
    fireEvent.change(await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' }), { target: { value: 'personal' } });
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    const nextMonthSelect = await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' });
    expect(nextMonthSelect).toHaveValue('dawon');
    await act(async () => finishSave());
    expect(nextMonthSelect).toHaveValue('dawon');
    expect(nextMonthSelect).toBeEnabled();
});

test('회차별 금액을 별도 열과 팀 소계에 표시하고 분류 필터를 입금 총액에도 적용한다', async () => {
    (advanceRequestService.listByYearMonth as jest.Mock).mockResolvedValue([
        { ...record, depositAccount: 'corporate' }, { ...record, id: 'second', category: 'second', requestedAmount: 50000, depositAccount: 'personal' },
    ]);
    renderPage();
    const row = await screen.findByRole('row', { name: /검증 작업자/ });
    for (const name of ['1회차', '2회차', '선입금', '총금액']) expect(screen.getByRole('columnheader', { name })).toBeVisible();
    expect(within(row).getAllByRole('cell').slice(1, 5).map(cell => cell.textContent)).toEqual(['150,000', '50,000', '0', '200,000']);
    const subtotal = screen.getByRole('row', { name: /팀 소계/ });
    expect(within(subtotal).getAllByRole('cell').slice(0, 4).map(cell => cell.textContent)).toEqual(['150,000', '50,000', '0', '200,000']);
    const personalTotal = screen.getByRole('group', { name: '개인입금 총액' });
    expect(within(personalTotal).getByText('50,000')).toBeVisible();
    fireEvent.change(screen.getByLabelText('신청 분류'), { target: { value: 'first' } });
    expect(within(row).getAllByRole('cell').slice(1, 3).map(cell => cell.textContent)).toEqual(['150,000', '150,000']);
    expect(screen.queryByRole('columnheader', { name: '2회차' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '선입금' })).not.toBeInTheDocument();
    expect(within(personalTotal).getByText('0')).toBeVisible();
});

test('목록의 회차 버튼은 조회 조건과 동기화되고 빈 분류에서도 다른 회차로 전환할 수 있다', async () => {
    (advanceRequestService.listByYearMonth as jest.Mock).mockResolvedValue([
        record, { ...record, id: 'second', workerId: 'second-worker', workerName: '2회차 작업자', category: 'second', requestedAmount: 50000 },
    ]);
    renderPage();
    await screen.findByRole('rowheader', { name: '검증 작업자' });
    const filters = screen.getByRole('group', { name: '목록 신청 분류' });
    fireEvent.click(within(filters).getByRole('button', { name: '2회차' }));
    expect(screen.getByLabelText('신청 분류')).toHaveValue('second');
    expect(screen.queryByRole('rowheader', { name: '검증 작업자' })).not.toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '2회차 작업자' })).toBeInTheDocument();
    expect(within(filters).getByRole('button', { name: '2회차' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(filters).getByRole('button', { name: '선입금' }));
    expect(screen.getByRole('status')).toHaveTextContent('조회 조건에 맞는 가불내역이 없습니다');
    fireEvent.click(within(filters).getByRole('button', { name: '전체' }));
    expect(screen.getByRole('rowheader', { name: '검증 작업자' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '2회차 작업자' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('신청 분류'), { target: { value: 'first' } });
    expect(within(filters).getByRole('button', { name: '1회차' })).toHaveAttribute('aria-pressed', 'true');
});

test('기존 입금 구분은 임의로 바꾸지 않고 새 구분 선택 시 원본과 총액을 갱신한다', async () => {
    (advanceRequestService.listByYearMonth as jest.Mock).mockResolvedValue([{ ...record, depositAccount: 'cheongyeon' }]);
    renderPage();
    const select = await screen.findByRole('combobox', { name: '검증 A팀 검증 작업자 입금계좌' });
    expect(within(select).getByRole('option', { name: '기존: 청연결제' })).toBeDisabled();
    expect(select).toHaveValue('cheongyeon');
    expect(screen.getByRole('group', { name: '미선택·기존 구분' })).toHaveTextContent('150,000');
    expect(advancePaymentDepositAccountService.save).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: 'corporate' } });
    await waitFor(() => expect(select).toHaveValue('corporate'));
    expect(advancePaymentDepositAccountService.save).toHaveBeenCalledWith([
        { id: 'entry', expectedDepositAccount: 'cheongyeon', depositAccount: 'corporate' },
    ], 'advance_requests');
    expect(screen.getByRole('group', { name: '법인입금 총액' })).toHaveTextContent('150,000');
});

test('조회 실패를 빈 결과나 0원으로 표시하지 않고 재시도할 수 있다', async () => {
    (advanceRequestService.listByYearMonth as jest.Mock).mockRejectedValueOnce(new Error('test offline'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    expect(screen.queryByLabelText('조회 결과 합계')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('rowheader', { name: '검증 작업자' })).toBeInTheDocument();
});

test('월 변경 후 늦게 도착한 이전 월 응답이 최신 조회를 덮어쓰지 않는다', async () => {
    let finishOldMonth: (value: unknown) => void = () => {};
    (advanceRequestService.listByYearMonth as jest.Mock).mockImplementation(yearMonth =>
        yearMonth === '2026-10' ? new Promise(resolve => { finishOldMonth = resolve; }) : Promise.resolve([]));
    renderPage();
    await waitFor(() => expect(advanceRequestService.listByYearMonth).toHaveBeenCalledWith('2026-10'));
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    expect(await screen.findByRole('heading', { name: '2026년 11월 가불내역' })).toBeInTheDocument();
    await act(async () => { finishOldMonth([record]); });
    expect(screen.queryByRole('rowheader', { name: '검증 작업자' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026년 11월 가불내역' })).toBeInTheDocument();
});

test('비고를 수정해 저장하면 표와 새로 조회한 화면에 반영되고 금액은 유지된다', async () => {
    let stored = { ...record };
    (advanceRequestService.listByYearMonth as jest.Mock).mockImplementation(async () => [stored]);
    (advancePaymentMemoService.save as jest.Mock).mockImplementation(async changes => { stored = { ...stored, memo: changes[0].memo }; });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '검증 A팀 검증 작업자 비고 수정' }));
    fireEvent.change(screen.getByRole('textbox', { name: '비고 내용' }), { target: { value: '새 비고\n둘째 줄' } });
    fireEvent.click(screen.getByRole('button', { name: '비고 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(advancePaymentMemoService.save).toHaveBeenCalledWith([{ id: 'entry', expectedMemo: '검증용 비고', memo: '새 비고\n둘째 줄' }], 'advance_requests');
    expect(screen.getByText('새 비고 둘째 줄')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검증 A팀 검증 작업자 비고 수정' })).toHaveClass('as-memo-filled');
    expect(within(screen.getByLabelText('조회 결과 합계')).getAllByText('150,000')[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(await screen.findByText('새 비고 둘째 줄')).toBeInTheDocument();
});

test('합산된 신청 분류의 비고를 구별하고 바꾼 원본만 저장한다', async () => {
    (advanceRequestService.listByYearMonth as jest.Mock).mockResolvedValue([
        { ...record, category: 'first' }, { ...record, id: 'monthly-entry', category: 'second', memo: '월급 비고' },
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '검증 A팀 검증 작업자 비고 수정' }));
    expect(screen.getByRole('textbox', { name: '1회차 비고 1' })).toHaveValue('검증용 비고');
    fireEvent.change(screen.getByRole('textbox', { name: '2회차 비고 2' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '비고 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(advancePaymentMemoService.save).toHaveBeenCalledWith([{ id: 'monthly-entry', expectedMemo: '월급 비고', memo: '' }], 'advance_requests');
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
