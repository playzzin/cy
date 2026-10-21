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

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../services/advancePaymentMemoService', () => ({ ...jest.requireActual('../../services/advancePaymentMemoService'), advancePaymentMemoService: { save: jest.fn() } }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'test-admin' } }) }));
jest.mock('../../services/firestoreCrudCompat', () => ({}));
jest.mock('../../services/advancePaymentService', () => ({ advancePaymentService: { getAdvancePaymentsByYearMonth: jest.fn() } }));
jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompaniesByType: jest.fn(), getCompanyById: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkerByUid: jest.fn() } }));
jest.mock('../../services/userService', () => ({ userService: { getUser: jest.fn() } }));
jest.mock('../../services/payrollConfigService', () => ({ ...jest.requireActual('../../services/payrollConfigService'), payrollConfigService: { getConfigReadOnly: jest.fn() } }));
jest.mock('react-to-print', () => ({ useReactToPrint: () => jest.fn() }));

const record = { id: 'entry', workerId: 'test-worker', workerName: '검증 작업자', teamId: 'test-team',
    yearMonth: '2026-10', items: { corporateAdvance1: 100000, laborAdvance1: 50000 }, memo: '검증용 비고', totalDeduction: 900000 };
const renderPage = () => render(<MemoryRouter initialEntries={['/payroll/advance-summary?yearMonth=2026-10']}><AdvanceSummaryPage /></MemoryRouter>);
beforeEach(() => {
    jest.clearAllMocks();
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'admin' });
    (teamService.getTeams as jest.Mock).mockResolvedValue([{ id: 'test-team', name: '검증 A팀', companyId: 'test-company' }]);
    (companyService.getCompaniesByType as jest.Mock).mockResolvedValue([{ id: 'test-company', name: '검증 시공사' }]);
    (payrollConfigService.getConfigReadOnly as jest.Mock).mockResolvedValue({ advanceItemLabels: { ...DEFAULT_ADVANCE_ITEM_LABELS, corporateAdvance1: '1차 가불' } });
    (advancePaymentService.getAdvancePaymentsByYearMonth as jest.Mock).mockResolvedValue([record]);
    (advancePaymentMemoService.save as jest.Mock).mockResolvedValue(undefined);
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
