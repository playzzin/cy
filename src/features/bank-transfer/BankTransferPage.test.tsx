import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import * as XLSX from 'xlsx-js-style';
import BankTransferPage from './BankTransferPage';
import { loadAccountTransferCandidates, loadRentTransferCandidates, loadSupportTransferCandidates } from './transferSources';
import { createTransferRow } from './transferModel';
import { loadTransferDrafts, saveTransferDraft } from './transferDraftStorage';
import { storeTransferHandoff } from './transferHandoff';
import { buildPayrollTransferDetail } from './payrollTransferDetail';
import { monthlyPayrollSettlementService } from '../../services/monthlyPayrollSettlementService';
import type { SupportTransferDetail, TransferCandidate, TransferDraft, TransferLoadResult } from './types';

let mockUid = 'qa-user';
type PickerCallbacks = { period: string; onLoad: (result: TransferLoadResult) => void; onInvalidate: () => void };
let mockLatestPayrollPicker: PickerCallbacks;
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: mockUid } }) }));
jest.mock('../../services/monthlyPayrollSettlementService', () => ({ monthlyPayrollSettlementService: { getSettlementsByYear: jest.fn() } }));
jest.mock('./transferSources', () => ({ loadAccountTransferCandidates: jest.fn(), loadRentTransferCandidates: jest.fn(), loadSupportTransferCandidates: jest.fn(async () => ({ candidates: [], warnings: [] })) }));
jest.mock('../../pages/payroll/MonthlyWageDraftPage', () => ({ __esModule: true, default: ({ transferPicker }: { transferPicker: PickerCallbacks }) => {
    mockLatestPayrollPicker = transferPicker;
    return (
    <div>
        <button onClick={() => transferPicker.onLoad({ candidates: [{ id: `payroll:${transferPicker.period}:qa`, sourceId: 'qa', source: 'payroll', category: 'worker', name: '직접조회급여', groupName: '검증팀', bankName: '국민은행', bankCode: '004', accountNumber: '00123456789', accountHolder: '검증예금주', amount: 96700, period: transferPicker.period, detail: '직접 조회 급여' }], warnings: [] })}>급여 불러오기</button>
        <button onClick={transferPicker.onInvalidate}>조회 조건 변경</button>
    </div>
); } }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('xlsx-js-style', () => ({ ...jest.requireActual('xlsx-js-style'), writeFile: jest.fn() }));
const candidate = (patch: Partial<TransferCandidate> = {}): TransferCandidate => ({ id: 'account:worker:w1', source: 'account', sourceId: 'w1', name: '가상작업자', groupName: '검증팀', category: 'worker', bankName: '국민은행', bankCode: '004', accountNumber: '00123456789', accountHolder: '가상작업자', amount: 0, period: '', detail: '등록 계좌', ...patch });
const second = candidate({ id: 'account:company:c1', sourceId: 'c1', name: '가상회사', groupName: '검증회사', category: 'company', accountNumber: '00987654321', accountHolder: '가상회사' });
const view = () => <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><BankTransferPage /></MemoryRouter>;
const confirmReview = () => { const button = screen.queryByRole('button', { name: '내용 확인 후 검토 완료' }); if (button) fireEvent.click(button); };
const addWorker = async () => { fireEvent.click(await screen.findByRole('button', { name: '가상작업자 담기' })); };
const recoveredSupport = (patch: Partial<TransferCandidate> = {}): TransferCandidate => candidate({
    id: 'support:2026-09:w1', source: 'support', category: 'team', period: '2026-09', amount: 315000,
    supportDetail: { capturedAt: '2026-10-15T01:00:00Z', originalAmount: 315000, billingAmount: 300000, additionalAmount: 5000, expenseAmount: 10000, totalManDay: 1.5, siteCount: 1, adjustmentScope: 'team',
        workEntries: [{ date: '2026-09-10', siteName: '복원 검증현장', targetTeamName: '검증 담당팀', workerName: '복원 검증작업자', manDay: 1.5, unitPrice: 200000, amount: 300000, rateSource: '현장 설정단가' }],
        expenseEntries: [{ date: '2026-09-10', siteName: '복원 검증현장', category: '식비', description: '복원 검증식대', amount: 10000, status: 'charged' }] }, ...patch,
});
const oldSupportDraft = (id = 'saved-support'): TransferDraft => ({
    version: 1, id, title: id, period: '2026-10', receiverDisplay: '저장표시', memoRule: '{이름}', updatedAt: '2026-10-15T00:00:00Z',
    rows: [createTransferRow(recoveredSupport({ supportDetail: undefined, amount: 310000, accountNumber: '00987654321', accountHolder: '변경예금주', senderMemo: '보관메모' }), '저장표시', '{이름}')],
});

beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); mockUid = 'qa-user';
    let sequence = 0;
    Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => `qa-draft-${++sequence}` } });
    (loadAccountTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [candidate(), second], warnings: [] });
    (loadRentTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [], warnings: [] });
    (loadSupportTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [], warnings: [] });
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockResolvedValue([]);
    (XLSX.writeFile as jest.Mock).mockReset();
});

it('퇴사자 숨김은 검색·전체선택에 적용하고 다른 분류와 상태 미확인 작업자를 유지한다', async () => {
    const retired = candidate({ id: 'account:worker:retired', sourceId: 'retired', name: '퇴사 검증자' });
    const unknown = candidate({ id: 'account:worker:unknown', sourceId: 'unknown', name: '상태없는 검증자' });
    (loadAccountTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [candidate(), retired, unknown, second], warnings: [], workerEmployment: { w1: 'active', retired: 'retired' } });
    render(view());
    const picker = within(screen.getByRole('region', { name: '송금 대상 찾기' }));
    expect(await picker.findByText('재직중')).toBeVisible();
    expect(picker.getByText('퇴사자')).toBeVisible();
    expect(picker.getByText('상태 미확인')).toBeVisible();
    fireEvent.click(picker.getByLabelText('퇴사 검증자 선택'));
    fireEvent.click(picker.getByLabelText('퇴사자 숨김'));
    expect(picker.queryByText('퇴사 검증자')).not.toBeInTheDocument();
    expect(picker.getByText('숨긴 퇴사자 1명')).toBeVisible();
    fireEvent.click(picker.getByLabelText('검색 결과 전체 선택'));
    fireEvent.click(picker.getByRole('button', { name: /선택 3건 담기/ }));
    const basket = within(screen.getByRole('region', { name: '송금 목록' }));
    expect(basket.getByText('가상회사')).toBeVisible();
    expect(basket.getByText('상태없는 검증자')).toBeVisible();
    expect(basket.queryByText('퇴사 검증자')).not.toBeInTheDocument();
    fireEvent.click(picker.getByLabelText('퇴사자 숨김'));
    expect(picker.getByText('퇴사 검증자')).toBeVisible();
});

it('이전 저장 급여도 현재 퇴사 상태를 표시하고 숨김으로 송금 내역이나 엑셀을 바꾸지 않는다', async () => {
    const saved = oldSupportDraft();
    saved.rows = [createTransferRow(candidate({ source: 'payroll', sourceId: '2026-10__old-w1__team__일급제', id: 'payroll:old:totalAmount', period: '2026-10', amount: 100000 }), '', '{이름}')];
    saveTransferDraft(mockUid, saved);
    (loadAccountTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [candidate(), second], warnings: [], workerEmployment: { w1: 'retired', 'old-w1': 'retired' } });
    render(view());
    const basket = within(screen.getByRole('region', { name: '송금 목록' }));
    expect(await basket.findByText('퇴사자')).toBeVisible();
    fireEvent.click(screen.getByLabelText('퇴사자 숨김'));
    expect(basket.getByLabelText('가상작업자 이체금액')).toHaveValue(100000);
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    expect(screen.getByText('퇴사자')).toBeVisible();
    confirmReview();
    fireEvent.click(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' }));
    const workbook = (XLSX.writeFile as jest.Mock).mock.calls[0][0];
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    expect(sheet.C2.v).toBe(100000);
    expect(sheet.B2.v).toBe('00123456789');
});

it('등록계좌 조회가 끝나기 전에 급여로 이동해도 재직 상태가 연결된다', async () => {
    let resolve!: (result: TransferLoadResult) => void;
    (loadAccountTransferCandidates as jest.Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    render(view());
    await waitFor(() => expect(loadAccountTransferCandidates).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('tab', { name: '급여' }));
    await screen.findByRole('button', { name: '급여 불러오기' });
    act(() => mockLatestPayrollPicker.onLoad({ candidates: [candidate({ source: 'payroll', sourceId: '2026-10__w1__team__일급제', period: '2026-10' })], warnings: [] }));
    expect(screen.getByText('상태 미확인')).toBeVisible();
    await act(async () => resolve({ candidates: [], warnings: [], workerEmployment: { w1: 'retired' } }));
    expect(screen.getByText('퇴사자')).toBeVisible();
    fireEvent.click(screen.getByLabelText('퇴사자 숨김'));
    expect(screen.queryByRole('button', { name: '가상작업자 담기' })).not.toBeInTheDocument();
});

it('외부지원비 상세를 검색 결과와 송금 목록에 표시하고 금액 수정·저장 후에도 원본을 보존한다', async () => {
    const supportDetail: SupportTransferDetail = {
        capturedAt: '2026-10-15T01:00:00Z', originalAmount: 335000, billingAmount: 300000, additionalAmount: 25000, expenseAmount: 10000,
        totalManDay: 1.5, siteCount: 1, adjustmentScope: 'team',
        workEntries: [{ date: '2026-10-10', siteName: '검증 지원현장', targetTeamName: '검증 담당팀', workerName: '검증 지원작업자', manDay: 1.5, unitPrice: 200000, amount: 300000, rateSource: '월별 청구단가' }],
        expenseEntries: [{ date: '2026-10-12', siteName: '검증 지원현장', category: '식비', description: '검증 식대', amount: 10000, status: 'charged' }],
    };
    (loadSupportTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [candidate({ id: 'support:detail', source: 'support', category: 'team', name: '검증 외부팀', period: '2026-10', amount: 335000, supportDetail })], warnings: [] });
    const { unmount } = render(view());
    await screen.findByRole('button', { name: '가상작업자 담기' });
    fireEvent.click(screen.getByRole('tab', { name: '외부지원비' }));
    fireEvent.click(await screen.findByLabelText('검증 외부팀 외부지원비 상세보기'));
    expect(screen.getByText('검증 지원작업자')).toBeVisible();
    expect(screen.getByText('검증 담당팀')).toBeVisible();
    expect(screen.getByText('월별 청구단가')).toBeVisible();
    expect(screen.getByText('식비 · 검증 식대')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '검증 외부팀 담기' }));
    const basket = within(screen.getByRole('region', { name: '송금 목록' }));
    fireEvent.click(basket.getByLabelText('검증 외부팀 외부지원비 상세보기'));
    expect(basket.getByText('검증 지원작업자')).toBeVisible();
    fireEvent.change(basket.getByLabelText('검증 외부팀 이체금액'), { target: { value: '330000' } });
    expect(basket.getByText(/이체금액을 330,000원으로 수정/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    expect(loadTransferDrafts(mockUid)[0].rows[0].supportDetail).toEqual(supportDetail);
    unmount(); render(view());
    expect(await screen.findByLabelText('검증 외부팀 이체금액')).toHaveValue(330000);
    fireEvent.click(screen.getByLabelText('검증 외부팀 외부지원비 상세보기'));
    expect(screen.getByText('검증 지원작업자')).toBeVisible();
    screen.getAllByText('335,000원').forEach(amount => expect(amount).toBeVisible());
    expect(screen.getByText(/이체금액을 330,000원으로 수정/)).toBeVisible();
    const malformed = loadTransferDrafts(mockUid)[0];
    (malformed.rows[0].supportDetail as unknown as { expenseEntries: unknown }).expenseEntries = null;
    expect(() => saveTransferDraft(mockUid, malformed)).toThrow('초안 형식');
    expect(loadTransferDrafts(mockUid)[0].rows[0].supportDetail).toEqual(supportDetail);
});

it('이전 목록의 상세를 펼치면 행의 월로 복원하고 기존 계좌·송금액·메모를 보존하여 다시 저장한다', async () => {
    const old = oldSupportDraft();
    saveTransferDraft(mockUid, old);
    (loadSupportTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [recoveredSupport()], warnings: [] });
    const { unmount } = render(view());
    fireEvent.click(await screen.findByLabelText('가상작업자 외부지원비 상세보기'));
    expect(await screen.findByText('복원 검증작업자')).toBeVisible();
    expect(loadSupportTransferCandidates).toHaveBeenCalledWith('2026-09');
    expect(screen.getByText('식비 · 복원 검증식대')).toBeVisible();
    expect(screen.getByText(/저장된 이체금액 310,000원을 그대로 유지/)).toBeVisible();
    expect(screen.getByLabelText('가상작업자 이체금액')).toHaveValue(310000);
    expect(screen.getByLabelText('가상작업자 내통장메모')).toHaveValue('보관메모');
    expect(loadTransferDrafts(mockUid)[0]).toEqual(old);
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    const saved = loadTransferDrafts(mockUid)[0].rows[0];
    expect(saved).toEqual({ ...old.rows[0], supportDetail: { ...recoveredSupport().supportDetail, restoredFromSource: true } });
    unmount(); render(view());
    fireEvent.click(await screen.findByLabelText('가상작업자 외부지원비 상세보기'));
    expect(screen.getByText('복원 검증작업자')).toBeVisible();
    expect(loadSupportTransferCandidates).toHaveBeenCalledTimes(1);
});

it('조회 실패나 다른 팀의 동명 자료는 복원하지 않고 재시도로 상세를 가져온다', async () => {
    saveTransferDraft(mockUid, oldSupportDraft());
    (loadSupportTransferCandidates as jest.Mock)
        .mockResolvedValueOnce({ candidates: [], warnings: ['지원단가 조회에 실패했습니다.'] })
        .mockResolvedValueOnce({ candidates: [recoveredSupport({ sourceId: 'different-team' })], warnings: [] })
        .mockResolvedValueOnce({ candidates: [recoveredSupport()], warnings: [] });
    render(view());
    fireEvent.click(await screen.findByLabelText('가상작업자 외부지원비 상세보기'));
    expect(await screen.findByRole('alert')).toHaveTextContent('지원단가 조회에 실패');
    fireEvent.click(screen.getByRole('button', { name: '가상작업자 지원비 상세 다시 불러오기' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('해당 월·팀의 지원 상세내역을 찾지 못했습니다'));
    expect(screen.queryByText('복원 검증작업자')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '가상작업자 지원비 상세 다시 불러오기' }));
    expect(await screen.findByText('복원 검증작업자')).toBeVisible();
    expect(screen.getByLabelText('가상작업자 이체금액')).toHaveValue(310000);
});

it('같은 월의 여러 팀 복원은 한번 조회하고 대기 중 수정한 이체금액을 유지한다', async () => {
    const saved = oldSupportDraft();
    saved.rows.push(createTransferRow(recoveredSupport({ sourceId: 'w2', id: 'support:2026-09:w2', name: '검증 외부팀2', supportDetail: undefined }), '', '{이름}'));
    saveTransferDraft(mockUid, saved);
    let resolve!: (value: TransferLoadResult) => void;
    (loadSupportTransferCandidates as jest.Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    render(view());
    fireEvent.click(await screen.findByLabelText('가상작업자 외부지원비 상세보기'));
    fireEvent.click(screen.getByLabelText('검증 외부팀2 외부지원비 상세보기'));
    await waitFor(() => expect(screen.getAllByText(/원본에서 상세내역을 불러오고 있습니다/)).toHaveLength(2));
    expect(loadSupportTransferCandidates).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('가상작업자 이체금액'), { target: { value: '290000' } });
    await act(async () => resolve({ candidates: [recoveredSupport(), recoveredSupport({ sourceId: 'w2', id: 'support:2026-09:w2' })], warnings: [] }));
    expect(screen.getAllByText('복원 검증작업자')).toHaveLength(2);
    expect(screen.getByLabelText('가상작업자 이체금액')).toHaveValue(290000);
});

it.each(['목록', '계정'])('%s을 바꾼 뒤 도착한 이전 상세 응답은 반영하지 않는다', async mode => {
    saveTransferDraft(mockUid, oldSupportDraft());
    let resolve!: (value: TransferLoadResult) => void;
    (loadSupportTransferCandidates as jest.Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { rerender } = render(view());
    fireEvent.click(await screen.findByLabelText('가상작업자 외부지원비 상세보기'));
    await waitFor(() => expect(loadSupportTransferCandidates).toHaveBeenCalledTimes(1));
    if (mode === '목록') {
        fireEvent.click(screen.getByRole('button', { name: '새 목록' }));
        fireEvent.click(screen.getByText('저장한 목록'));
        fireEvent.click(screen.getByRole('button', { name: 'saved-support 불러오기' }));
    } else {
        mockUid = 'different-user';
        saveTransferDraft(mockUid, oldSupportDraft());
        rerender(view());
    }
    await screen.findByLabelText('가상작업자 이체금액');
    await act(async () => resolve({ candidates: [recoveredSupport()], warnings: [] }));
    expect(screen.queryByText('복원 검증작업자')).not.toBeInTheDocument();
    expect(screen.getByText('저장 완료')).toBeInTheDocument();
});

it('StrictMode에서도 급여 미리보기의 금액·계좌를 한번만 가져오고 저장 후 복원한다', async () => {
    storeTransferHandoff(mockUid, [candidate({ id: 'payroll:w1:totalAmount', source: 'payroll', amount: 180000, period: '2026-10', receiverDisplay: '지급표시', senderMemo: '정산메모' })]);
    const { unmount } = render(<React.StrictMode>{view()}</React.StrictMode>);
    expect(await screen.findByLabelText('가상작업자 이체금액')).toHaveValue(180000);
    expect(screen.getByText('저장하지 않은 변경')).toBeInTheDocument();
    expect(screen.getAllByLabelText('가상작업자 이체금액')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    expect(loadTransferDrafts(mockUid)[0].rows).toHaveLength(1);
    unmount(); render(view());
    expect(await screen.findByLabelText('가상작업자 이체금액')).toHaveValue(180000);
    expect(screen.getByLabelText('가상작업자 받는분통장표시')).toHaveValue('지급표시');
    expect(screen.getByLabelText('가상작업자 내통장메모')).toHaveValue('정산메모');
    expect(screen.getByText('저장 완료')).toBeInTheDocument();
});

it('다른 창의 저장 변경을 알리고 현재 편집은 사본으로 안전하게 보관한다', async () => {
    const original = oldSupportDraft();
    saveTransferDraft(mockUid, original);
    render(view());
    fireEvent.change(await screen.findByLabelText('가상작업자 이체금액'), { target: { value: '290000' } });
    const newer = { ...original, title: '다른 창에서 수정한 목록', rows: original.rows.map(row => ({ ...row, amount: 320000 })) };
    saveTransferDraft(mockUid, newer);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'cy:bank-transfer:drafts:qa-user' })));
    expect(screen.getByText('다른 창에서 변경됨')).toBeInTheDocument();
    expect(screen.getByLabelText('가상작업자 이체금액')).toHaveValue(290000);
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    expect(screen.getByRole('alert')).toHaveTextContent('다른 창');
    expect(screen.queryByText(/송금 목록과 상세 내역을 저장했습니다/)).not.toBeInTheDocument();
    expect(loadTransferDrafts(mockUid)).toEqual([newer]);
    fireEvent.click(screen.getByRole('button', { name: '사본 저장' }));
    const drafts = loadTransferDrafts(mockUid);
    expect(drafts).toHaveLength(2);
    expect(drafts.find(item => item.id === original.id)).toEqual(newer);
    expect(drafts.find(item => item.id !== original.id)?.rows[0].amount).toBe(290000);
    expect(screen.getByText('저장 완료')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('다른 창의 저장 이벤트가 없어도 오래된 목록을 덮어쓰지 않는다', async () => {
    const original = oldSupportDraft();
    saveTransferDraft(mockUid, original);
    render(view());
    await screen.findByLabelText('가상작업자 이체금액');
    const newer = { ...original, title: '다른 창 최신 저장' };
    saveTransferDraft(mockUid, newer);
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    expect(screen.getByRole('alert')).toHaveTextContent('다른 창');
    expect(loadTransferDrafts(mockUid)).toEqual([newer]);
});

it('미리보기의 통장 문구와 실제 엑셀 셀을 동일하게 정리한다', async () => {
    storeTransferHandoff(mockUid, [candidate({ amount: 1000, receiverDisplay: ' 검증\t회사 ', senderMemo: ' 지급\n메모 ' })]);
    render(view());
    await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    const cells = within(screen.getByRole('row', { name: '가상작업자 엑셀 출력값' })).getAllByRole('cell');
    expect(cells[4].textContent).toBe('검증 회사');
    expect(cells[5].textContent).toBe('지급 메모');
    confirmReview();
    fireEvent.click(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' }));
    const sheet = (XLSX.writeFile as jest.Mock).mock.calls[0][0].Sheets['국민은행용'];
    expect(sheet.D2.v).toBe(cells[4].textContent);
    expect(sheet.E2.v).toBe(cells[5].textContent);
});

it('검색·선택·드래그로 담고 오류 수정 후 동일한 A~E 엑셀을 만든다', async () => {
    render(view());
    await screen.findByRole('button', { name: '가상작업자 담기' });
    fireEvent.change(screen.getByLabelText('송금 대상 검색'), { target: { value: '00987' } });
    fireEvent.click(screen.getByLabelText('검색 결과 전체 선택'));
    fireEvent.click(screen.getByRole('button', { name: /선택 1건 담기/ }));
    fireEvent.click(screen.getByLabelText('검색 지우기'));
    const values: Record<string, string> = {};
    const dataTransfer = { setData: (key: string, value: string) => { values[key] = value; }, getData: (key: string) => values[key], types: ['application/x-cy-transfer-candidate'] };
    const draggable = screen.getAllByRole('article').find(article => within(article).queryByRole('button', { name: '가상작업자 담기' }))!;
    fireEvent.dragStart(draggable, { dataTransfer });
    fireEvent.drop(screen.getByRole('region', { name: '송금 목록' }), { dataTransfer });
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    expect(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '← 송금 목록으로' }));
    fireEvent.change(screen.getByLabelText('가상작업자 이체금액'), { target: { value: '123000' } });
    fireEvent.change(screen.getByLabelText('가상회사 이체금액'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: '가상작업자 위로' }));
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    confirmReview();
    fireEvent.click(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' }));
    const workbook = (XLSX.writeFile as jest.Mock).mock.calls[0][0];
    expect(workbook.Sheets['국민은행용'].B2.v).toBe('00123456789');
    expect(workbook.Sheets['국민은행용'].C2.v).toBe(123000);
    expect(workbook.Sheets['국민은행용'].C3.v).toBe(50000);
});

it('급여 상세와 수정한 송금액을 구분하고 저장 목록에서 상세 내역까지 복원한다', async () => {
    const payrollDetail = buildPayrollTransferDetail({
        grossAmount: 100000, totalDeduction: 13300, totalAmount: 86700, totalManDay: 0.5, unitPrice: 200000,
        deductionBreakdown: { standardLines: [{ label: '전월 가불', amount: 10000 }] },
        taxBreakdown: { standardLines: [{ label: '사업소득세', amount: 3300 }] },
        workEntries: [{ date: '2026-10-01', siteName: '검증현장', manDay: 0.5, unitPrice: 200000, amount: 100000 }],
    }, { salaryLabel: '일급제', amountBasis: '현재 화면 실지급액', originalAmount: 86700, isFinalized: false });
    storeTransferHandoff(mockUid, [candidate({ source: 'payroll', id: 'payroll:detail', amount: 86700, payrollDetail })]);
    const { unmount } = render(view());
    await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByLabelText('가상작업자 급여 상세보기'));
    expect(screen.getByText('검증현장')).toBeVisible();
    expect(screen.getByText('전월 가불')).toBeVisible();
    expect(screen.getByText('사업소득세')).toBeVisible();
    fireEvent.change(screen.getByLabelText('가상작업자 이체금액'), { target: { value: '80000' } });
    expect(screen.getByText(/이체금액을 80,000원으로 수정/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('송금 목록 이름'), { target: { value: '검증 급여 목록' } });
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    expect(loadTransferDrafts(mockUid)[0].rows[0].payrollDetail).toEqual(payrollDetail);
    fireEvent.click(screen.getByRole('button', { name: '새 목록' }));
    expect(screen.queryByLabelText('가상작업자 이체금액')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('저장한 목록'));
    fireEvent.click(screen.getByRole('button', { name: '검증 급여 목록 불러오기' }));
    expect(screen.getByLabelText('가상작업자 이체금액')).toHaveValue(80000);
    unmount(); render(view());
    await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByLabelText('가상작업자 급여 상세보기'));
    expect(screen.getByText('검증현장')).toBeVisible();
    expect(screen.getByText(/이체금액을 80,000원으로 수정/)).toBeVisible();
});

it('상세 정보가 없는 이전 급여 목록에는 다시 불러오기 안내를 표시한다', async () => {
    storeTransferHandoff(mockUid, [candidate({ source: 'payroll', id: 'payroll:old', amount: 1000 })]);
    render(view());
    fireEvent.click(await screen.findByLabelText('가상작업자 급여 상세보기'));
    expect(screen.getByText(/이전에 저장한 목록에는 상세 내역이 없습니다/)).toBeVisible();
});

it('계좌를 교체해도 원래 지급금액과 메모를 보존한다', async () => {
    render(view()); await addWorker();
    fireEvent.change(screen.getByLabelText('가상작업자 이체금액'), { target: { value: '98700' } });
    fireEvent.change(screen.getByLabelText('가상작업자 내통장메모'), { target: { value: '보존메모' } });
    fireEvent.click(screen.getByRole('button', { name: '계좌 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '가상회사 입금계좌로 선택' }));
    expect(screen.getByLabelText('가상작업자 이체금액')).toHaveValue(98700);
    expect(screen.getByLabelText('가상작업자 내통장메모')).toHaveValue('보존메모');
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    expect(loadTransferDrafts(mockUid)[0].rows[0]).toMatchObject({ id: 'account:worker:w1', accountNumber: '00987654321', accountHolder: '가상회사', amount: 98700 });
});

it('작업자는 소속 팀으로 좁혀 검색·선택하며 동명 팀과 이미 담은 목록을 구분한다', async () => {
    (loadAccountTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [
        candidate({ accountTeamKey: 'team:a', accountTeamLabel: '검증팀 · 청연이엔지' }),
        candidate({ id: 'account:worker:w2', name: '다른작업자', accountTeamKey: 'team:b', accountTeamLabel: '검증팀 · 외부회사' }),
        second,
    ], warnings: [] });
    render(view()); await screen.findByRole('button', { name: '가상작업자 담기' });
    fireEvent.change(screen.getByLabelText('계좌 종류'), { target: { value: 'worker' } });
    const filter = screen.getByLabelText('작업자 소속 팀');
    expect(within(filter).getAllByRole('option')).toHaveLength(3);
    expect(within(filter).getByRole('option', { name: '검증팀 · 청연이엔지 (1명)' })).toBeInTheDocument();
    fireEvent.change(filter, { target: { value: 'team:a' } });
    expect(screen.queryByRole('button', { name: '다른작업자 담기' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('송금 대상 검색'), { target: { value: '청연이엔지' } });
    fireEvent.click(screen.getByLabelText('검색 결과 전체 선택'));
    fireEvent.click(screen.getByRole('button', { name: /선택 1건 담기/ }));
    expect(screen.getByLabelText('가상작업자 이체금액')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('검색 지우기'));
    fireEvent.change(filter, { target: { value: 'team:b' } });
    expect(screen.getByRole('button', { name: '다른작업자 담기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '가상작업자 담기' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('가상작업자 이체금액')).toBeInTheDocument();
    expect(screen.queryByLabelText('다른작업자 이체금액')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('계좌 종류'), { target: { value: 'all' } });
    expect(screen.getByRole('button', { name: '가상회사 담기' })).toBeInTheDocument();
});

it('팀은 청연이엔지·외부팀·미지정으로 나누고 소속 변경 시 숨은 선택을 해제한다', async () => {
    (loadAccountTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [
        candidate({ id: 'account:team:a', name: '검증청연팀', category: 'team', groupName: '청연이엔지', teamAffiliation: 'cheongyeon' }),
        candidate({ id: 'account:team:b', name: '검증외부팀', category: 'team', groupName: '외부회사', teamAffiliation: 'external' }),
        candidate({ id: 'account:team:c', name: '검증미지정팀', category: 'team', groupName: '회사 미지정', teamAffiliation: 'unassigned' }),
        candidate(),
    ], warnings: [] });
    render(view()); await screen.findByRole('button', { name: '가상작업자 담기' });
    fireEvent.change(screen.getByLabelText('계좌 종류'), { target: { value: 'team' } });
    const affiliation = within(screen.getByRole('group', { name: '팀 소속 구분' }));
    fireEvent.click(affiliation.getByRole('button', { name: '청연이엔지' }));
    expect(screen.getByRole('button', { name: '검증청연팀 담기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '검증외부팀 담기' })).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('팀·회사 필터')).queryByRole('option', { name: '외부회사' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('검색 결과 전체 선택'));
    fireEvent.click(affiliation.getByRole('button', { name: '외부팀' }));
    expect(screen.getByRole('button', { name: /선택 0건 담기/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '검증청연팀 담기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('검색 결과 전체 선택'));
    fireEvent.click(screen.getByRole('button', { name: /선택 1건 담기/ }));
    expect(screen.getByLabelText('검증외부팀 이체금액')).toBeInTheDocument();
    expect(screen.queryByLabelText('검증청연팀 이체금액')).not.toBeInTheDocument();
    fireEvent.click(affiliation.getByRole('button', { name: '소속 미지정' }));
    expect(screen.getByRole('button', { name: '검증미지정팀 담기' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('계좌 종류'), { target: { value: 'worker' } });
    expect(screen.queryByRole('group', { name: '팀 소속 구분' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가상작업자 담기' })).toBeInTheDocument();
});

it('계정 변경 중 초안 읽기에 실패해도 이전 사용자 목록을 노출하지 않는다', async () => {
    const saved: TransferDraft = { version: 1, id: 'saved-qa', title: '이전 계정 초안', period: '2026-10', receiverDisplay: '', memoRule: '{이름}', rows: [createTransferRow(candidate({ amount: 1 }), '', '{이름}')], updatedAt: new Date().toISOString() };
    saveTransferDraft(mockUid, saved);
    const { rerender } = render(view());
    await screen.findByLabelText('가상작업자 이체금액');
    mockUid = 'different-user';
    localStorage.setItem('cy:bank-transfer:drafts:different-user', '{broken');
    rerender(view());
    await screen.findByRole('alert');
    expect(screen.queryByLabelText('가상작업자 이체금액')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /이전 계정 초안 불러오기/ })).not.toBeInTheDocument();
});

it('조회월을 지우면 진행 중 조회를 무효화하고 다시 조회할 수 있다', async () => {
    let resolve!: (value: TransferLoadResult) => void;
    (loadRentTransferCandidates as jest.Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    render(view()); await screen.findByRole('button', { name: '가상작업자 담기' });
    fireEvent.click(screen.getByRole('tab', { name: '월세' }));
    await waitFor(() => expect(loadRentTransferCandidates).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('조회월'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: '송금 자료 새로고침' })).toBeEnabled();
    await act(async () => resolve({ candidates: [candidate({ name: '이전월 결과' })], warnings: [] }));
    expect(screen.queryByText('이전월 결과')).not.toBeInTheDocument();
});

it('다른 월에서 사라진 팀 필터를 해제해 새 조회 대상을 보여준다', async () => {
    (loadRentTransferCandidates as jest.Mock)
        .mockResolvedValueOnce({ candidates: [candidate({ name: '이전숙소', groupName: '이전팀' })], warnings: [] })
        .mockResolvedValueOnce({ candidates: [candidate({ name: '다음숙소', groupName: '다음팀' })], warnings: [] });
    render(view()); await screen.findByRole('button', { name: '가상작업자 담기' });
    fireEvent.click(screen.getByRole('tab', { name: '월세' }));
    await screen.findByRole('button', { name: '이전숙소 담기' });
    fireEvent.change(screen.getByLabelText('팀·회사 필터'), { target: { value: '이전팀' } });
    fireEvent.change(screen.getByLabelText('조회월'), { target: { value: '2026-09' } });
    expect(await screen.findByRole('button', { name: '다음숙소 담기' })).toBeInTheDocument();
    expect(screen.getByLabelText('팀·회사 필터')).toHaveValue('all');
});

it('송금 화면 안에서 직접 급여를 불러오고 금액을 담으며 조건 변경은 조회 목록만 지운다', async () => {
    render(view()); await screen.findByRole('button', { name: '가상작업자 담기' });
    fireEvent.change(screen.getByLabelText('받는분통장표시 일괄 설정'), { target: { value: '검증법인' } });
    fireEvent.change(screen.getByLabelText('내통장메모 규칙'), { target: { value: '{이름} 정산' } });
    fireEvent.click(screen.getByRole('tab', { name: '급여' }));
    fireEvent.click(await screen.findByRole('button', { name: '급여 불러오기' }));
    fireEvent.click(await screen.findByRole('button', { name: '직접조회급여 담기' }));
    expect(screen.getByLabelText('직접조회급여 이체금액')).toHaveValue(96700);
    expect(screen.getByLabelText('직접조회급여 받는분통장표시')).toHaveValue('검증법인');
    expect(screen.getByLabelText('직접조회급여 내통장메모')).toHaveValue('직접조회급여 정산');
    fireEvent.click(screen.getByRole('button', { name: '조회 조건 변경' }));
    expect(screen.queryByRole('button', { name: '직접조회급여 담기' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('직접조회급여 이체금액')).toHaveValue(96700);
    fireEvent.click(screen.getByRole('button', { name: '급여 불러오기' }));
    fireEvent.change(screen.getByLabelText('조회월'), { target: { value: '2026-09' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: '직접조회급여 담기' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('직접조회급여 이체금액')).toHaveValue(96700);
});

it('이전 탭과 이전 월의 급여 콜백은 현재 조회 결과를 바꾸지 않는다', async () => {
    render(view()); await screen.findByRole('button', { name: '가상작업자 담기' });
    fireEvent.click(screen.getByRole('tab', { name: '급여' }));
    await screen.findByRole('button', { name: '급여 불러오기' });
    const previousTab = mockLatestPayrollPicker;
    fireEvent.click(screen.getByRole('tab', { name: '등록 계좌' }));
    await screen.findByRole('button', { name: '가상작업자 담기' });
    act(() => { previousTab.onInvalidate(); previousTab.onLoad({ candidates: [candidate({ name: '오래된급여' })], warnings: [] }); });
    expect(screen.getByRole('button', { name: '가상작업자 담기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '오래된급여 담기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '급여' }));
    await screen.findByRole('button', { name: '급여 불러오기' });
    const previousMonth = mockLatestPayrollPicker;
    act(() => previousTab.onLoad({ candidates: [candidate({ name: '오래된급여' })], warnings: [] }));
    expect(screen.queryByRole('button', { name: '오래된급여 담기' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('조회월'), { target: { value: '2026-08' } });
    act(() => { previousMonth.onLoad({ candidates: [candidate({ name: '오래된급여' })], warnings: [] }); });
    expect(screen.queryByRole('button', { name: '오래된급여 담기' })).not.toBeInTheDocument();
});

const legacyPayroll = (): TransferDraft => ({ ...oldSupportDraft('이전 급여 목록'), rows: [createTransferRow(candidate({ source: 'payroll', id: 'payroll:w1:totalAmount', sourceId: 'w1', period: '2026-09', amount: 90000, senderMemo: '보존메모' }), '보존표시', '{이름}')] });
const payrollSettlement = { yearMonth: '2026-09', runStatus: 'paid', rows: [{ rowKey: 'w1', salaryModel: '일급제', netAmount: 96700, paymentSnapshot: { id: 'w1', month: '2026-09', totalAmount: 96700, grossAmount: 100000, totalDeduction: 3300, workEntries: [{ date: '2026-09-01', siteName: '복원 급여현장', manDay: 0.5, unitPrice: 200000, amount: 100000 }] } }] };

it('이전 급여 상세를 복원하며 대기 중 수정한 금액·메모를 유지하고 재접속 시 보관한다', async () => {
    saveTransferDraft(mockUid, legacyPayroll());
    let resolve!: (value: unknown) => void;
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockImplementation(() => new Promise(done => { resolve = done; }));
    const { unmount } = render(view());
    fireEvent.click(await screen.findByLabelText('가상작업자 급여 상세보기'));
    await screen.findByText(/급여 원본에서 상세내역을 불러오고 있습니다/);
    fireEvent.change(screen.getByLabelText('가상작업자 이체금액'), { target: { value: '88000' } });
    await act(async () => resolve([payrollSettlement]));
    expect(screen.getByText('복원 급여현장')).toBeVisible();
    expect(screen.getByText(/저장된 이체금액 88,000원을 그대로 유지/)).toBeVisible();
    expect(screen.getByText(/급여 원본은 지급완료 상태/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    expect(loadTransferDrafts(mockUid)[0].rows[0]).toMatchObject({ amount: 88000, senderMemo: '보존메모', payrollDetail: { originalAmount: 96700, restoredFromSource: true } });
    unmount(); render(view());
    fireEvent.click(await screen.findByLabelText('가상작업자 급여 상세보기'));
    expect(screen.getByText('복원 급여현장')).toBeVisible();
    expect(monthlyPayrollSettlementService.getSettlementsByYear).toHaveBeenCalledTimes(1);
});

it.each(['목록', '계정'])('급여 복원 중 %s 전환 후 도착한 이전 응답을 무시한다', async mode => {
    saveTransferDraft(mockUid, legacyPayroll());
    let resolve!: (value: unknown) => void;
    (monthlyPayrollSettlementService.getSettlementsByYear as jest.Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { rerender } = render(view());
    fireEvent.click(await screen.findByLabelText('가상작업자 급여 상세보기'));
    await screen.findByText(/급여 원본에서 상세내역을 불러오고 있습니다/);
    if (mode === '목록') {
        fireEvent.click(screen.getByRole('button', { name: '새 목록' }));
        fireEvent.click(screen.getByText('저장한 목록'));
        fireEvent.click(screen.getByRole('button', { name: '이전 급여 목록 불러오기' }));
    } else { mockUid = 'other-user'; saveTransferDraft(mockUid, legacyPayroll()); rerender(view()); }
    await act(async () => resolve([payrollSettlement]));
    expect(screen.queryByText('복원 급여현장')).not.toBeInTheDocument();
    expect(screen.getByText('저장 완료')).toBeInTheDocument();
});

it('자동 복원이 안 되는 급여도 같은 월·기준으로 재조회하면 기존 행의 상세만 연결한다', async () => {
    const saved = legacyPayroll(); saved.rows[0].id = 'payroll:w1:laborAdvance2';
    saveTransferDraft(mockUid, saved);
    render(view()); fireEvent.click(await screen.findByLabelText('가상작업자 급여 상세보기'));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '급여에서 다시 조회' }));
    await screen.findByRole('button', { name: '급여 불러오기' });
    expect(screen.getByLabelText('조회월')).toHaveValue('2026-09');
    const detail = buildPayrollTransferDetail(payrollSettlement.rows[0].paymentSnapshot, { salaryLabel: '일급제', amountBasis: '노무가불2', originalAmount: 100000, isFinalized: true });
    act(() => mockLatestPayrollPicker.onLoad({ candidates: [{ ...saved.rows[0], amount: 100000, payrollDetail: detail }], warnings: [] }));
    fireEvent.click(screen.getByRole('button', { name: '목록 저장' }));
    expect(loadTransferDrafts(mockUid)[0].rows[0]).toMatchObject({ amount: 90000, senderMemo: '보존메모', payrollDetail: { originalAmount: 100000 } });
    expect(loadTransferDrafts(mockUid)[0].rows).toHaveLength(1);
});

it('미리보기에서 예금주·대상 월·중복 계좌·원본 경고를 확인하고 파일에는 A~E만 내보낸다', async () => {
    storeTransferHandoff(mockUid, [candidate({ amount: 1000, period: '2026-09', warning: '자동이체 대상' }), candidate({ id: 'another', name: '검증두번째', amount: 2000, period: '2026-10' })]);
    render(view()); await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    const preview = within(screen.getByRole('region', { name: '국민은행 엑셀 미리보기' }));
    expect(preview.getAllByText('예금주 가상작업자')).toHaveLength(2);
    expect(preview.getByText('자동이체 대상')).toBeVisible();
    expect(preview.getByText(/여러 대상 월이 포함/)).toHaveTextContent('2026-09, 2026-10');
    expect(preview.getAllByText('파일 형식 확인')).toHaveLength(2);
    confirmReview();
    fireEvent.click(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' }));
    const [book, filename] = (XLSX.writeFile as jest.Mock).mock.calls[0];
    expect(filename).toContain('여러월');
    expect(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 })[0]).toHaveLength(5);
});

it('파일 생성 이력을 자동 저장하고 다시 열어도 보존하며 사본에는 원본 이력을 복사하지 않는다', async () => {
    storeTransferHandoff(mockUid, [candidate({ amount: 1000 })]);
    const { unmount } = render(view()); await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    confirmReview();
    fireEvent.click(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' }));
    expect(loadTransferDrafts(mockUid)[0].exportHistory?.[0]).toMatchObject({ rowCount: 1, totalAmount: 1000 });
    expect(screen.getByText('저장 완료')).toBeInTheDocument();
    unmount(); render(view());
    await screen.findByText(/파일 생성 이력 1건/);
    fireEvent.click(screen.getByRole('button', { name: '사본 저장' }));
    expect(loadTransferDrafts(mockUid).find(item => item.title.endsWith('사본'))?.exportHistory).toEqual([]);
});

it('파일 생성 실패는 이력을 남기지 않고 파일 생성 후 저장 충돌은 별도로 알린다', async () => {
    const saved = legacyPayroll(); saveTransferDraft(mockUid, saved);
    render(view()); await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    (XLSX.writeFile as jest.Mock).mockImplementationOnce(() => { throw Error('파일 생성 실패'); });
    confirmReview();
    fireEvent.click(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' }));
    expect(screen.getByRole('alert')).toHaveTextContent('파일 생성 실패');
    expect(loadTransferDrafts(mockUid)[0].exportHistory).toBeUndefined();
    const other = { ...saved, title: '다른 창 저장본' }; saveTransferDraft(mockUid, other);
    confirmReview();
    fireEvent.click(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' }));
    expect(screen.getByRole('alert')).toHaveTextContent('파일은 생성했지만 목록·이력을 저장하지 못했습니다');
    expect(loadTransferDrafts(mockUid)[0]).toEqual(other);
    expect(screen.getByText(/파일 생성 이력 1건/)).toBeInTheDocument();
});

it('미리보기의 상세내역을 페이지 안에서 넓게 열고 Escape로 돌아온다', async () => {
    const support = recoveredSupport(); storeTransferHandoff(mockUid, [support]);
    render(view()); await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    const trigger = screen.getByRole('button', { name: '가상작업자 상세내역 확인' }); trigger.focus(); fireEvent.click(trigger);
    const panel = screen.getByRole('region', { name: '가상작업자 상세내역 전체 보기' });
    expect(within(panel).getByText('복원 검증작업자')).toBeVisible();
    expect(panel).toHaveFocus();
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: '가상작업자 상세내역 전체 보기' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
});

it('다른 저장 목록의 동일 지원 항목을 검토 화면에 표시하고 현재 저장본은 중복으로 세지 않는다', async () => {
    const current = oldSupportDraft('현재 목록'); current.updatedAt = '2026-10-15T02:00:00Z';
    const prior = { ...oldSupportDraft('이전 지급 준비'), updatedAt: '2026-10-14T00:00:00Z' };
    saveTransferDraft(mockUid, prior); saveTransferDraft(mockUid, current);
    render(view()); await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    const preview = within(screen.getByRole('region', { name: '국민은행 엑셀 미리보기' }));
    expect(preview.getByText(/다른 저장 목록 ‘이전 지급 준비’에 같은 지급 항목/)).toBeVisible();
    expect(preview.queryByText(/다른 저장 목록 ‘현재 목록’/)).not.toBeInTheDocument();
});

it('원본 비교 결과를 미리보기까지 표시하고 금액 수정 시 이전 비교 결과를 해제한다', async () => {
    saveTransferDraft(mockUid, oldSupportDraft());
    (loadSupportTransferCandidates as jest.Mock).mockResolvedValue({ candidates: [recoveredSupport({ warning: '지원비 입금완료 표시' })], warnings: [] });
    render(view()); await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByRole('button', { name: '원본과 비교' }));
    await screen.findByText(/주의 1건/);
    expect(screen.getByLabelText('가상작업자 이체금액')).toHaveValue(310000);
    expect(screen.getByLabelText('가상작업자 내통장메모')).toHaveValue('보관메모');
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    expect(within(screen.getByRole('region', { name: '국민은행 엑셀 미리보기' })).getByText(/현재 원본 안내: 지원비 입금완료/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '← 송금 목록으로' }));
    fireEvent.change(screen.getByLabelText('가상작업자 이체금액'), { target: { value: '300000' } });
    expect(screen.getByText(/목록이 변경되어 이전 비교 결과를 해제/)).toBeVisible();
    expect(screen.queryByText(/현재 원본 안내: 지원비 입금완료/)).not.toBeInTheDocument();
    expect(loadTransferDrafts(mockUid)[0].rows[0].amount).toBe(310000);
});

it.each(['편집', '목록', '계정'])('원본 비교 중 %s이 바뀌면 늦은 결과를 표시하지 않는다', async mode => {
    saveTransferDraft(mockUid, oldSupportDraft());
    let resolve!: (value: TransferLoadResult) => void;
    (loadSupportTransferCandidates as jest.Mock).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { rerender } = render(view()); await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByRole('button', { name: '원본과 비교' }));
    await screen.findByRole('button', { name: '원본 비교 중…' });
    if (mode === '편집') fireEvent.change(screen.getByLabelText('가상작업자 이체금액'), { target: { value: '300000' } });
    else if (mode === '목록') fireEvent.click(screen.getByRole('button', { name: '새 목록' }));
    else { mockUid = 'other-user'; saveTransferDraft(mockUid, oldSupportDraft()); rerender(view()); }
    await act(async () => resolve({ candidates: [recoveredSupport({ warning: '늦게 도착한 안내' })], warnings: [] }));
    expect(screen.queryByText(/늦게 도착한 안내/)).not.toBeInTheDocument();
});


it('오류별로 목록을 좁혀 바로 수정하면 해결된 항목은 빠지고 합계가 갱신된다', async () => {
    render(view()); await addWorker();
    fireEvent.click(screen.getByRole('button', { name: '금액 확인 1' }));
    fireEvent.change(screen.getByLabelText('가상작업자 이체금액'), { target: { value: '1000' } });
    expect(screen.queryByLabelText('가상작업자 이체금액')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '파일 생성 불가 0' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }));
    expect(screen.getByLabelText('가상작업자 이체금액')).toHaveValue(1000);
    fireEvent.click(screen.getByRole('button', { name: '② 금액·계좌 검토' }));
    expect(screen.queryByRole('region', { name: '송금 대상 찾기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '① 대상 가져오기' }));
    expect(screen.getByRole('region', { name: '송금 대상 찾기' })).toBeVisible();
});

it('팀별 필터를 바꿔도 선택을 유지하며 선택한 대상에만 메모를 적용한다', async () => {
    render(view()); await addWorker(); fireEvent.click(screen.getByRole('button', { name: '가상회사 담기' }));
    fireEvent.change(screen.getByLabelText('송금 목록 팀·거래처'), { target: { value: '검증팀' } });
    fireEvent.click(screen.getByLabelText('송금 목록 전체 선택'));
    fireEvent.change(screen.getByLabelText('송금 목록 팀·거래처'), { target: { value: '검증회사' } });
    expect(screen.getByText(/선택 중인 숨겨진 항목 1건/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('통장 표시·메모 일괄 설정 · 선택 1건에 적용'));
    fireEvent.change(screen.getByLabelText('내통장메모 규칙'), { target: { value: '{이름} 정산' } });
    fireEvent.click(screen.getByRole('button', { name: '선택 1건에 적용' }));
    expect(screen.getByLabelText('가상회사 내통장메모')).toHaveValue('가상회사');
    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }));
    expect(screen.getByLabelText('가상작업자 내통장메모')).toHaveValue('가상작업자 정산');
});

it('검토·파일 생성 후 수정하면 재검토하고 이전 파일 다운로드와 실패 재송금은 당시 내역을 사용한다', async () => {
    storeTransferHandoff(mockUid, [candidate({ amount: 1000 })]);
    render(view()); await screen.findByLabelText('가상작업자 이체금액');
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    expect(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' })).toBeDisabled();
    confirmReview(); fireEvent.click(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' }));
    fireEvent.click(screen.getByRole('button', { name: '가상작업자 송금 내용 수정' }));
    fireEvent.change(screen.getByLabelText('가상작업자 이체금액'), { target: { value: '2000' } });
    expect(screen.getByText(/최근 파일 생성 이후 목록이 변경/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '엑셀 미리보기' }));
    expect(screen.getByRole('button', { name: '국민은행용 엑셀 다운로드' })).toBeDisabled();
    fireEvent.click(screen.getByText(/파일 생성 이력 1건/));
    fireEvent.click(screen.getByRole('button', { name: '생성 당시 파일 다시 다운로드' }));
    expect((XLSX.writeFile as jest.Mock).mock.calls[1][0].Sheets['국민은행용'].C2.v).toBe(1000);
    fireEvent.click(screen.getByText('이체 결과 확인 · 성공 0 / 실패 0 / 미확인 1'));
    fireEvent.click(screen.getByText('은행 내역을 보고 개별 기록하기'));
    fireEvent.change(screen.getByLabelText('가상작업자 확인한 이체 결과'), { target: { value: 'failed' } });
    fireEvent.change(screen.getByLabelText('가상작업자 결과 비고'), { target: { value: '가상 은행 실패 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '개별 확인 1건 반영' }));
    expect(loadTransferDrafts(mockUid)[0].exportHistory![0].results![0].status).toBe('failed');
    fireEvent.click(screen.getByRole('button', { name: '실패 1건으로 새 송금 목록 만들기' }));
    expect(screen.getByLabelText('가상작업자 이체금액')).toHaveValue(1000);
    expect((screen.getByLabelText('송금 목록 이름') as HTMLInputElement).value).toContain('재송금');
    expect(screen.getByText(/이전 이체 실패: 가상 은행 실패 확인/)).toBeVisible();
    expect(loadTransferDrafts(mockUid)[0].rows[0].amount).toBe(2000);
});
