import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaxInvoiceIssueListPage from './TaxInvoiceIssueListPage';
import { taxInvoiceListService as service } from '../../services/taxInvoiceListService';
import type { TaxInvoiceIssue } from '../../types/taxInvoiceList';
import { showConfirmAlert, toast } from '../../utils/swal';
import { exportIssuesToExcel } from '../../utils/taxInvoiceExcelUtils';
import { reserveImageClipboardWrite } from '../../utils/taxInvoiceClipboard';
import html2canvas from 'html2canvas';
import { IssueBatchWriteError, IssueDeleteConflictError, IssueSaveConflictError } from '../../utils/taxInvoiceIssueDraft';
import userEvent from '@testing-library/user-event';

jest.mock('../../services/taxInvoiceListService', () => ({ taxInvoiceListService: {
    getIssuesByMonth: jest.fn(), getDeferredIssuesByMonth: jest.fn(), updateIssuesBatch: jest.fn(),
    deleteIssue: jest.fn(), deleteIssuesBatch: jest.fn(), renumberIssuesByMonth: jest.fn(),
    deleteIssuesWithConflictCheck: jest.fn(),
    addIssue: jest.fn(), importDeferredIssue: jest.fn(), fetchMonthlySiteData: jest.fn(), saveIssuesWithConflictCheck: jest.fn(),
} }));
jest.mock('../../utils/taxInvoiceExcelUtils', () => ({ exportIssuesToExcel: jest.fn() }));
jest.mock('../../utils/swal', () => ({ showConfirmAlert: jest.fn(), toast: {
    success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn(),
} }));
jest.mock('html2canvas', () => jest.fn());
jest.mock('../../utils/taxInvoiceClipboard', () => ({ reserveImageClipboardWrite: jest.fn() }));

const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
const row = (id: string, no = 1, yearMonth = month): TaxInvoiceIssue => ({
    id, no, yearMonth, isNew: '', issueDate: `${yearMonth}-01`, recipient: `합성 ${id}`,
    item: '', supplyAmount: 100, note: '', manDays: 1, teamName: '', remark: '',
    issueStatus: 'pending', scanCompleted: false,
});
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const mount = () => render(
    <MemoryRouter initialEntries={['/payroll/taxinvoice/issue-list']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
            <Route path="/payroll/taxinvoice/issue-list" element={<TaxInvoiceIssueListPage />} />
            <Route path="/payroll/support-team" element={<div>다른 화면</div>} />
        </Routes>
    </MemoryRouter>
);
const ready = () => screen.findByRole('button', { name: '공급받는자 값 편집, 현재 합성 A' });
const startEdit = (field: string, value: string, index = 0) => {
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(`^${field} 값 편집`) })[index]);
    const input = screen.getByRole('textbox', { name: `${field} 값 편집` });
    fireEvent.change(input, { target: { value } });
    return input;
};
const edit = (field: string, value: string, index = 0) => fireEvent.blur(startEdit(field, value, index));
beforeEach(() => {
    jest.clearAllMocks();
    (service.getIssuesByMonth as jest.Mock).mockImplementation(async ym => [row('A', 1, ym), row('B', 2, ym)]);
    (service.getDeferredIssuesByMonth as jest.Mock).mockResolvedValue([]);
    (service.updateIssuesBatch as jest.Mock).mockResolvedValue(undefined);
    // Existing assertions inspect the submitted patch; conflict behavior is tested separately below.
    (service.saveIssuesWithConflictCheck as jest.Mock).mockImplementation(updates => service.updateIssuesBatch(updates));
    (exportIssuesToExcel as jest.Mock).mockResolvedValue(undefined);
    (service.deleteIssue as jest.Mock).mockResolvedValue(undefined);
    (service.deleteIssuesBatch as jest.Mock).mockResolvedValue(undefined);
    (service.deleteIssuesWithConflictCheck as jest.Mock).mockResolvedValue(undefined);
    (service.renumberIssuesByMonth as jest.Mock).mockResolvedValue([]);
    (service.addIssue as jest.Mock).mockResolvedValue('NEW');
    (service.importDeferredIssue as jest.Mock).mockImplementation(async data => ({ issue: { ...data, id: 'CARRYOVER' }, created: true }));
    (showConfirmAlert as jest.Mock).mockResolvedValue({ isConfirmed: true });
});
afterEach(() => jest.restoreAllMocks());

test('월 변경과 새로고침은 선택을 지우며 현재 월 항목만 삭제한다', async () => {
    (service.getIssuesByMonth as jest.Mock).mockImplementation(async ym => [row(ym === month ? 'A' : 'NEW_MONTH', 1, ym)]);
    mount(); await ready();
    fireEvent.click(screen.getByRole('checkbox', { name: '1번 합성 A 항목 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 달 보기' }));
    await screen.findByRole('button', { name: '공급받는자 값 편집, 현재 합성 NEW_MONTH' });
    expect(screen.queryByRole('button', { name: /선택 삭제/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '1번 합성 NEW_MONTH 항목 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '목록 새로고침' }));
    await screen.findByRole('button', { name: '공급받는자 값 편집, 현재 합성 NEW_MONTH' });
    expect(screen.queryByRole('button', { name: /선택 삭제/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '1번 합성 NEW_MONTH 항목 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제 (1)' }));
    await waitFor(() => expect(service.deleteIssuesWithConflictCheck).toHaveBeenCalledWith(['NEW_MONTH'], [expect.objectContaining({ id: 'NEW_MONTH' })]));
});

test('저장 중 같은 행과 다른 행에 추가한 변경을 보존하고 재저장한다', async () => {
    const saving = deferred<void>();
    (service.updateIssuesBatch as jest.Mock).mockReturnValueOnce(saving.promise);
    mount(); await ready();
    edit('품목', '첫 저장');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    edit('품목', '같은 행 추가'); edit('비고', '다른 행 추가', 1);
    expect(screen.getByRole('button', { name: '변경사항 저장 (2)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음 달 보기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '목록 새로고침' })).toBeDisabled();
    await act(async () => saving.resolve());
    expect(screen.getByRole('button', { name: '변경사항 저장 (2)' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (2)' }));
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenLastCalledWith([
        { id: 'A', data: { item: '같은 행 추가' } }, { id: 'B', data: { note: '다른 행 추가' } },
    ]));
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled());
});

test('저장 중 원래 값으로 되돌린 편집도 새 저장 기준과 비교하여 남긴다', async () => {
    const saving = deferred<void>();
    (service.updateIssuesBatch as jest.Mock).mockReturnValueOnce(saving.promise);
    mount(); await ready(); edit('품목', '저장 중 값');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    edit('품목', '');
    await act(async () => saving.resolve());
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenLastCalledWith([{ id: 'A', data: { item: '' } }]));
});

test('저장 실패 시 변경 내용을 남기며 재시도할 수 있다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (service.updateIssuesBatch as jest.Mock).mockRejectedValueOnce(new Error('synthetic failure'));
    mount(); await ready(); edit('품목', '보존할 입력');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeEnabled());
    expect(screen.getByRole('button', { name: '품목 값 편집, 현재 보존할 입력' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled());
});

test('충돌 항목은 최신 값으로 바꾸고 나머지 내 입력과 서버의 다른 칸은 보존한다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const latest = { ...row('A'), supplyAmount: 300, note: '서버 비고' };
    (service.saveIssuesWithConflictCheck as jest.Mock).mockRejectedValueOnce(new IssueBatchWriteError([], new IssueSaveConflictError([{ id: 'A', current: latest, fields: ['supplyAmount'] }])));
    mount(); await ready(); edit('공급가', '200'); edit('품목', '내 품목');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    const panel = await screen.findByRole('region', { name: '동시 수정 충돌' });
    expect(within(panel).getByText('200')).toBeInTheDocument();
    expect(within(panel).getByText('300')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeDisabled();
    fireEvent.click(within(panel).getByRole('button', { name: '충돌 항목은 최신 값 사용' }));
    expect(screen.getByRole('button', { name: '공급가 값 편집, 현재 300' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '비고 값 편집, 현재 서버 비고' })).toBeInTheDocument();
    expect(service.saveIssuesWithConflictCheck).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.saveIssuesWithConflictCheck).toHaveBeenLastCalledWith([{ id: 'A', data: { item: '내 품목' } }], [latest, row('B', 2)]));
});

test('내 입력 유지로 새 편집을 보존하며 재시도 중 다시 변경되면 다시 확인한다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const request = deferred<void>();
    const latest = { ...row('A'), supplyAmount: 300 };
    const nextLatest = { ...row('A'), supplyAmount: 500 };
    (service.saveIssuesWithConflictCheck as jest.Mock).mockReturnValueOnce(request.promise)
        .mockRejectedValueOnce(new IssueBatchWriteError([], new IssueSaveConflictError([{ id: 'A', current: nextLatest, fields: ['supplyAmount'] }])));
    mount(); await ready(); edit('공급가', '200');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    startEdit('공급가', '400');
    await act(async () => request.reject(new IssueBatchWriteError([], new IssueSaveConflictError([{ id: 'A', current: latest, fields: ['supplyAmount'] }]))));
    expect(within(screen.getByRole('region', { name: '동시 수정 충돌' })).getByText('400')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '내 입력 유지' }));
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await screen.findByRole('region', { name: '동시 수정 충돌' });
    expect(service.saveIssuesWithConflictCheck).toHaveBeenLastCalledWith([{ id: 'A', data: { supplyAmount: 400 } }], [latest, row('B', 2)]);
    expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '내 입력 유지' }));
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.saveIssuesWithConflictCheck).toHaveBeenLastCalledWith([{ id: 'A', data: { supplyAmount: 400 } }], [nextLatest, row('B', 2)]));
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled());
});

test.each([false, true])('다른 창에서 삭제하거나 이동한 행은 입력 확인 후 로컬 목록에서만 정리한다 (이동 %s)', async moved => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const current = moved ? { ...row('A'), yearMonth: '2001-01' } : null;
    (service.saveIssuesWithConflictCheck as jest.Mock).mockRejectedValueOnce(new IssueBatchWriteError([], new IssueSaveConflictError([{ id: 'A', current, fields: ['item'] }])));
    mount(); await ready();
    fireEvent.click(screen.getByRole('checkbox', { name: '1번 합성 A 항목 선택' }));
    edit('품목', '보관할 입력');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    const panel = await screen.findByRole('region', { name: '동시 수정 충돌' });
    expect(within(panel).getByText('보관할 입력')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: '내 입력 유지' })).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: '현재 목록에서 정리' }));
    expect(screen.queryByRole('button', { name: '공급받는자 값 편집, 현재 합성 A' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '선택 삭제 (1)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled();
    expect(service.deleteIssuesWithConflictCheck).not.toHaveBeenCalled(); expect(service.addIssue).not.toHaveBeenCalled();
});

test('충돌 후 되돌리기는 서버 최신 값과 이미 저장한 다른 행을 함께 복구한다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const latest = { ...row('A'), supplyAmount: 300 };
    (service.saveIssuesWithConflictCheck as jest.Mock).mockRejectedValueOnce(new IssueBatchWriteError(['B'], new IssueSaveConflictError([{ id: 'A', current: latest, fields: ['supplyAmount'] }])));
    mount(); await ready(); edit('공급가', '200'); edit('품목', '이미 저장됨', 1);
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (2)' }));
    await screen.findByRole('region', { name: '동시 수정 충돌' });
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getByRole('button', { name: '공급가 값 편집, 현재 300' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '품목 값 편집, 현재 이미 저장됨' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '동시 수정 충돌' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled();
});

test('충돌 해결은 다른 칸의 입력 오류를 지우거나 저장하지 않는다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const latest = { ...row('A'), supplyAmount: 300 };
    (service.saveIssuesWithConflictCheck as jest.Mock).mockRejectedValueOnce(new IssueBatchWriteError([], new IssueSaveConflictError([{ id: 'A', current: latest, fields: ['supplyAmount'] }])));
    mount(); await ready(); edit('공급가', '200');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await screen.findByRole('region', { name: '동시 수정 충돌' });
    edit('발행일', '2026-02-30');
    fireEvent.click(screen.getByRole('button', { name: '충돌 항목은 최신 값 사용' }));
    expect(screen.getByRole('textbox', { name: '발행일 값 편집' })).toHaveValue('2026-02-30');
    expect(screen.getByRole('textbox', { name: '발행일 값 편집' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeDisabled();
    expect(service.saveIssuesWithConflictCheck).toHaveBeenCalledTimes(1);
});

test('이전 월의 늦은 목록과 이월 응답은 현재 화면을 덮어쓰지 않는다', async () => {
    const oldList = deferred<TaxInvoiceIssue[]>(), oldCarry = deferred<TaxInvoiceIssue[]>();
    (service.getIssuesByMonth as jest.Mock).mockReturnValueOnce(oldList.promise);
    (service.getDeferredIssuesByMonth as jest.Mock).mockReturnValueOnce(oldCarry.promise);
    mount(); fireEvent.click(screen.getByRole('button', { name: '다음 달 보기' }));
    await ready();
    await act(async () => { oldList.resolve([row('OLD')]); oldCarry.resolve([row('OLD_CARRY')]); });
    expect(screen.queryByRole('button', { name: /현재 합성 OLD/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/OLD_CARRY/)).not.toBeInTheDocument();
});

test('현장 조회 중 월을 변경하면 이전 월의 가져오기 창을 열지 않는다', async () => {
    const sites = deferred<unknown[]>();
    (service.fetchMonthlySiteData as jest.Mock).mockReturnValueOnce(sites.promise);
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: '현장 데이터 가져오기' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 달 보기' })); await ready();
    await act(async () => sites.resolve([{ siteName: 'OLD_SITE' }]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('잘못된 날짜는 저장을 막고 정상 날짜와 음수 금액은 저장한다', async () => {
    mount(); await ready(); edit('품목', '품목');
    edit('발행일', '2026-02-30');
    expect(screen.getByRole('textbox', { name: '발행일 값 편집' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeDisabled();
    expect(service.updateIssuesBatch).not.toHaveBeenCalled();
    const input = screen.getByRole('textbox', { name: '발행일 값 편집' });
    fireEvent.change(input, { target: { value: '2028-02-29' } }); fireEvent.blur(input);
    edit('공급가', '-1234'); edit('공수', '1.5');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenCalledWith([{ id: 'A', data: {
        item: '품목', issueDate: '2028-02-29', supplyAmount: -1234, manDays: 1.5,
    } }]));
});

test('잘못된 날짜를 포함한 편집을 되돌리면 입력과 변경 상태가 복구된다', async () => {
    mount(); await ready(); edit('발행일', '2026-02-30');
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.queryByRole('textbox', { name: '발행일 값 편집' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDisabled();
});

test('미저장 값과 편집 중 값이 있으면 내부 메뉴 이동을 확인한다', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    mount(); await ready(); startEdit('품목', '입력 중');
    fireEvent.click(screen.getByRole('link', { name: '외부지원간곳' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: '품목 값 편집' })).toHaveValue('입력 중');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name: '외부지원간곳' }));
    expect(screen.getByText('다른 화면')).toBeInTheDocument();
});

test('공급받는자 동일 값 확정과 수정 후 복원에는 가짜 변경이 생기지 않는다', async () => {
    mount(); await ready(); edit('공급받는자', '합성 A');
    expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled();
    edit('공급받는자', '새 거래처'); edit('공급받는자', '합성 A');
    expect(screen.getByRole('button', { name: '변경 검토 (0)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled();
});

test('합계는 공급가와 공수 열 아래에 있고 필터를 반영한다', async () => {
    mount(); await ready();
    fireEvent.change(screen.getByRole('searchbox', { name: '발행리스트 통합검색' }), { target: { value: '합성 A' } });
    const table = screen.getByRole('table');
    const groups = within(table).getAllByRole('rowgroup');
    const headers = within(groups[0]).getAllByRole('columnheader');
    const totals = within(groups[groups.length - 1]).getAllByRole('cell') as HTMLTableCellElement[];
    let position = 0;
    const starts = totals.map(cell => { const start = position; position += cell.colSpan; return start; });
    expect(position).toBe(headers.length);
    expect(headers[starts[1]]).toHaveTextContent('공급가');
    expect(headers[starts[3]]).toHaveTextContent('공수');
    expect(totals[1]).toHaveTextContent('100'); expect(totals[3]).toHaveTextContent('1');
});

test('행 추가는 기존 최대 순번 다음 번호로 한 번만 저장한다', async () => {
    const adding = deferred<string>();
    (service.getIssuesByMonth as jest.Mock).mockResolvedValue([row('A', 9)]);
    (service.addIssue as jest.Mock).mockReturnValueOnce(adding.promise);
    mount(); await ready();
    fireEvent.click(screen.getByRole('button', { name: '행 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '행 추가' }));
    expect(service.addIssue).toHaveBeenCalledTimes(1);
    expect(service.addIssue).toHaveBeenCalledWith(expect.objectContaining({ no: 10, yearMonth: month }));
    await act(async () => adding.resolve('NEW'));
    expect(screen.getByRole('button', { name: '행 추가' })).toBeEnabled();
});

test('현장 가져오기의 현장 정보와 공수 및 상태를 유지한다', async () => {
    (service.fetchMonthlySiteData as jest.Mock).mockResolvedValue([{ siteId: 'site', siteName: '합성 현장',
        companyName: '합성 발주사', teamName: '합성 팀', manDays: 2.5, siteType: '지원', paymentType: '계산서', note: '' }]);
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: '현장 데이터 가져오기' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: '합성 현장 선택' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '발행리스트에 추가 (1건)' }));
    await waitFor(() => expect(service.addIssue).toHaveBeenCalledWith(expect.objectContaining({
        siteId: 'site', siteName: '합성 현장', recipient: '합성 발주사', manDays: 2.5,
        teamName: '합성 팀', siteType: '지원', paymentType: '계산서', issueStatus: 'ready',
    })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test.each(['-', '.', '-.', '9'.repeat(310)])('불완전하거나 범위를 넘는 숫자 %s는 0으로 저장되지 않는다', async value => {
    mount(); await ready(); edit('품목', '저장 대기'); edit('공급가', value);
    expect(screen.getByRole('textbox', { name: '공급가 값 편집' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeDisabled();
    expect(service.updateIssuesBatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getAllByRole('button', { name: '공급가 값 편집, 현재 100' })).toHaveLength(2);
});

test.each(['1,2', '100원', '9007199254740993'])('잘못된 숫자 %s를 이전 값이나 다른 금액으로 조용히 바꾸지 않는다', async value => {
    mount(); await ready(); edit('공급가', value);
    expect(screen.getByRole('textbox', { name: '공급가 값 편집' })).toHaveValue(value);
    expect(screen.getByRole('textbox', { name: '공급가 값 편집' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '엑셀' }));
    expect(exportIssuesToExcel).not.toHaveBeenCalled();
    expect(service.updateIssuesBatch).not.toHaveBeenCalled();
});

test('엑셀은 현재 입력을 포함하고 생성 중 중복 요청을 막으며 실패 후 다시 시도한다', async () => {
    const request = deferred<void>();
    (exportIssuesToExcel as jest.Mock).mockReturnValueOnce(request.promise);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mount(); await ready(); startEdit('공급가', '-1,234.5');
    fireEvent.click(screen.getByRole('button', { name: '엑셀' }));
    expect(exportIssuesToExcel).toHaveBeenCalledWith([expect.objectContaining({ id: 'A', supplyAmount: -1234.5 }), expect.objectContaining({ id: 'B', supplyAmount: 100 })], month);
    expect(screen.getByRole('button', { name: '엑셀 생성 중...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '엑셀 생성 중...' }));
    expect(exportIssuesToExcel).toHaveBeenCalledTimes(1);
    await act(async () => request.reject(new Error('synthetic export failure')));
    expect(toast.error).toHaveBeenCalledWith('엑셀 파일을 만들지 못했습니다. 다시 시도해주세요.');
    fireEvent.click(screen.getByRole('button', { name: '엑셀' }));
    await waitFor(() => expect(exportIssuesToExcel).toHaveBeenCalledTimes(2));
    expect(service.updateIssuesBatch).not.toHaveBeenCalled();
});

test('선택 이미지에는 검색으로 숨겨진 정상 입력도 반영하고 저장 전 상태는 유지한다', async () => {
    const complete = jest.fn();
    (reserveImageClipboardWrite as jest.Mock).mockReturnValue({ complete, cancel: jest.fn(), result: Promise.resolve({ ok: true }) });
    let capturedText = '';
    (html2canvas as jest.Mock).mockImplementation(async root => {
        capturedText = root.textContent;
        return { toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['image'], { type: 'image/png' })) };
    });
    mount(); await ready();
    fireEvent.click(screen.getByRole('checkbox', { name: '1번 합성 A 항목 선택' }));
    startEdit('공급받는자', '입력 중인 합성 공급사');
    fireEvent.change(screen.getByRole('searchbox', { name: '발행리스트 통합검색' }), { target: { value: '합성 B' } });
    fireEvent.click(screen.getByRole('button', { name: '선택 이미지 복사 (1)' }));
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(capturedText).toContain('입력 중인 합성 공급사');
    expect(capturedText).not.toContain('합성 A');
    expect((html2canvas as jest.Mock).mock.calls[0][0]).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeEnabled();
    expect(service.updateIssuesBatch).not.toHaveBeenCalled();
});

test('글자 조합 중에는 내보내기를 차단하고 완료 후 정상 입력을 사용한다', async () => {
    mount(); await ready();
    fireEvent.click(screen.getByRole('checkbox', { name: '1번 합성 A 항목 선택' }));
    const input = startEdit('품목', '한');
    fireEvent.compositionStart(input);
    expect(screen.getByRole('button', { name: '엑셀' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '선택 이미지 복사 (1)' })).toBeDisabled();
    fireEvent.compositionEnd(input);
    fireEvent.click(screen.getByRole('button', { name: '엑셀' }));
    await waitFor(() => expect(exportIssuesToExcel).toHaveBeenCalledWith([expect.objectContaining({ id: 'A', item: '한' }), expect.objectContaining({ id: 'B' })], month));
});

test('숫자 0과 명시적인 빈 값은 기존처럼 0으로 확정한다', async () => {
    mount(); await ready(); edit('공급가', ''); edit('공수', '0');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenCalledWith([{ id: 'A', data: { supplyAmount: 0, manDays: 0 } }]));
});

test('한글 조합 중 Enter와 방향키 및 Tab은 값을 확정하거나 셀을 옮기지 않는다', async () => {
    mount(); await ready(); const input = startEdit('품목', '한');
    fireEvent.compositionStart(input);
    for (const key of ['Enter', 'ArrowDown', 'Tab', 'Escape']) fireEvent.keyDown(input, { key, isComposing: true, keyCode: 229 });
    expect(screen.getByRole('textbox', { name: '품목 값 편집' })).toBe(input);
    expect(input).toHaveValue('한');
    expect(screen.getByRole('button', { name: '변경 검토 (0)' })).toBeDisabled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(screen.getByRole('textbox', { name: '품목 값 편집' })).toBe(input);
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(screen.getByRole('textbox', { name: '품목 값 편집' })).toBe(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('button', { name: '품목 값 편집, 현재 한' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '품목 값 편집' })).not.toBe(input);
});

test.each([['발행일', '2026-02-30'], ['공급가', '-']])('필터로 숨긴 %s 입력과 오류 상태를 유지하고 복원한다', async (field, value) => {
    mount(); await ready(); edit('품목', '저장 대기'); edit(field, value);
    const search = screen.getByRole('searchbox', { name: '발행리스트 통합검색' });
    fireEvent.change(search, { target: { value: '없는 항목' } });
    expect(screen.queryByRole('textbox', { name: `${field} 값 편집` })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '입력 중인 셀 보기' }));
    expect(screen.getByRole('textbox', { name: `${field} 값 편집` })).toHaveValue(value);
    expect(screen.getByRole('textbox', { name: `${field} 값 편집` })).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDisabled();
});

test('숨겨진 입력도 페이지 이동을 경고하고 새로고침 확인 후에는 제거한다', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    mount(); await ready(); edit('발행일', '2026-02-30');
    fireEvent.change(screen.getByRole('searchbox', { name: '발행리스트 통합검색' }), { target: { value: '없는 항목' } });
    fireEvent.click(screen.getByRole('link', { name: '외부지원간곳' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '목록 새로고침' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '목록 새로고침' })).toBeEnabled());
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDisabled();
});

test('목록 조회 실패 중 추가와 이월을 차단하고 재조회 후 기존 이월을 중복 가져오지 않는다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const source = { ...row('SOURCE'), yearMonth: '2026-08', issueStatus: 'deferred' };
    (service.getIssuesByMonth as jest.Mock).mockRejectedValueOnce(new Error('read failed'));
    (service.getDeferredIssuesByMonth as jest.Mock).mockResolvedValue([source]);
    mount(); await screen.findByText('목록을 확인할 수 없습니다');
    expect(screen.queryByText('데이터가 없습니다')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '행 추가' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '현장 데이터 가져오기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '전체 가져오기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '전체 가져오기' }));
    expect(service.addIssue).not.toHaveBeenCalled();
    (service.getIssuesByMonth as jest.Mock).mockResolvedValue([{ ...row('A'), carriedFromIssueId: 'SOURCE', carriedFromYearMonth: '2026-08' }]);
    fireEvent.click(screen.getByRole('button', { name: '목록 다시 불러오기' })); await ready();
    expect(screen.getByRole('button', { name: '행 추가' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '전체 가져오기' })).toBeDisabled();
});

test('현장 저장 성공 후 목록 갱신이 실패해도 성공한 행을 유지하고 재등록을 차단한다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (service.fetchMonthlySiteData as jest.Mock).mockResolvedValue([{ siteId: 'site', siteName: '합성 현장', companyName: '새 발주사', teamName: '', manDays: 1, siteType: '', paymentType: '', note: '' }]);
    (service.renumberIssuesByMonth as jest.Mock).mockRejectedValueOnce(new Error('follow-up failed'));
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: '현장 데이터 가져오기' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: '합성 현장 선택' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '발행리스트에 추가 (1건)' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '공급받는자 값 편집, 현재 새 발주사' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '현장 데이터 가져오기' })).toBeDisabled();
    expect(screen.getByText(/완료된 변경은 반영됐지만/)).toBeInTheDocument();
    expect(service.addIssue).toHaveBeenCalledTimes(1);
});

test('이월 추가 후 목록 갱신 실패가 발생해도 같은 이월을 다시 추가하지 않는다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (service.getDeferredIssuesByMonth as jest.Mock).mockResolvedValue([{ ...row('SOURCE'), yearMonth: '2026-08', issueStatus: 'deferred' }]);
    (service.renumberIssuesByMonth as jest.Mock).mockRejectedValueOnce(new Error('follow-up failed'));
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: '전체 가져오기' }));
    await screen.findByText('추가됨');
    expect(screen.getByRole('button', { name: '전체 가져오기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '전체 가져오기' }));
    expect(service.importDeferredIssue).toHaveBeenCalledTimes(1);
});

test.each([false, true])('정상 편집 중 저장 한 번으로 현재 입력까지 저장한다 (기존 변경 %s)', async hasPrevious => {
    mount(); await ready();
    if (hasPrevious) edit('비고', '먼저 입력');
    startEdit('품목', '현재 입력');
    const save = screen.getByRole('button', { name: '변경사항 저장 (1)' });
    expect(save).toBeEnabled();
    userEvent.click(save);
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenCalledWith([{ id: 'A', data: {
        item: '현재 입력', ...(hasPrevious ? { note: '먼저 입력' } : {}),
    } }]));
    expect(service.updateIssuesBatch).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled());
});

test('포커스 이동 없이 저장해도 날짜를 정규화하고 공급받는자 보호 속성을 유지한다', async () => {
    mount(); await ready(); startEdit('발행일', '2028-2-29');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenLastCalledWith([{ id: 'A', data: { issueDate: '2028-02-29' } }]));
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled());
    startEdit('공급받는자', '새 공급받는자');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenLastCalledWith([{ id: 'A', data: { recipient: '새 공급받는자', recipientManuallyEdited: true } }]));
});

test('한글 조합 중 저장을 차단하고 조합 완료 후 현재 입력을 저장한다', async () => {
    mount(); await ready(); const input = startEdit('품목', '한');
    fireEvent.compositionStart(input);
    expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeDisabled();
    fireEvent.blur(input);
    expect(service.updateIssuesBatch).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenCalledWith([{ id: 'A', data: { item: '한' } }]));
});

test('숨겨진 정상 입력도 저장에 포함하고 동일 값 표기는 쓰기 없이 정리한다', async () => {
    mount(); await ready(); startEdit('품목', '숨긴 입력');
    fireEvent.change(screen.getByRole('searchbox', { name: '발행리스트 통합검색' }), { target: { value: '없는 행' } });
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenCalledWith([{ id: 'A', data: { item: '숨긴 입력' } }]));
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled());
    fireEvent.change(screen.getByRole('searchbox', { name: '발행리스트 통합검색' }), { target: { value: '' } });
    startEdit('공급가', '100.0');
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    expect(service.updateIssuesBatch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDisabled();
});

test('발행 상태에는 빈 옵션이 없고 알 수 없는 값으로 상태를 변경하지 않는다', async () => {
    (service.getIssuesByMonth as jest.Mock).mockResolvedValue([{ ...row('A'), issueStatus: 'issued' }]);
    mount(); await ready(); const select = screen.getByRole('combobox', { name: '발행 값 선택' });
    expect(within(select).queryByRole('option', { name: '-' })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: '' } });
    expect(select).toHaveValue('완료');
    expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled();
    fireEvent.change(select, { target: { value: '이월' } });
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenCalledWith([{ id: 'A', data: { issueStatus: 'deferred' } }]));
});

const importSites = [1, 2].map(index => ({ sourceKey: `team-${index}`, siteId: `site-${index}`, siteName: `현장 ${index}`,
    companyName: '발주사', teamName: '팀', manDays: index, siteType: '지원', paymentType: '계산서', note: '' }));

test.each([false, true])('현장 일부 실패 후 성공 행을 잠그고 실패한 행만 재시도한다 (갱신 실패 %s)', async refreshFailure => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const stored: TaxInvoiceIssue[] = [];
    let failSecond = true;
    (service.fetchMonthlySiteData as jest.Mock).mockResolvedValue(importSites);
    (service.addIssue as jest.Mock).mockImplementation(async data => {
        if (data.siteId === 'site-2' && failSecond) { failSecond = false; throw new Error('synthetic'); }
        const id = `NEW-${stored.length}`; stored.push({ ...data, id }); return id;
    });
    (service.renumberIssuesByMonth as jest.Mock).mockImplementation(async () => stored.slice());
    if (refreshFailure) (service.renumberIssuesByMonth as jest.Mock).mockRejectedValueOnce(new Error('follow-up'));
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: '현장 데이터 가져오기' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: '현장 1 선택' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: '현장 2 선택' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '발행리스트에 추가 (2건)' }));
    await within(dialog).findByText(/실패한 항목만 선택되어 있습니다/);
    expect(within(dialog).getByRole('checkbox', { name: '현장 1 선택' })).toBeDisabled();
    expect(within(dialog).getByRole('checkbox', { name: '현장 2 선택' })).toBeChecked();
    expect(within(dialog).getByRole('button', { name: '발행리스트에 추가 (1건)' })).toHaveProperty('disabled', refreshFailure);
    if (refreshFailure) {
        (service.getIssuesByMonth as jest.Mock).mockResolvedValue(stored.slice());
        fireEvent.click(within(dialog).getByRole('button', { name: '목록 다시 확인' }));
    }
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '발행리스트에 추가 (1건)' })).toBeEnabled());
    fireEvent.click(within(dialog).getByRole('button', { name: '발행리스트에 추가 (1건)' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(stored.map(issue => issue.siteId)).toEqual(['site-1', 'site-2']);
    expect(service.addIssue).toHaveBeenCalledTimes(3);
});

test('표시 이름이 같은 서로 다른 팀의 가져오기 선택을 독립적으로 유지한다', async () => {
    (service.fetchMonthlySiteData as jest.Mock).mockResolvedValue(importSites.map(site => ({ ...site, siteId: 'same', siteName: '같은 현장' })));
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: '현장 데이터 가져오기' }));
    const dialog = await screen.findByRole('dialog');
    const checkboxes = within(dialog).getAllByRole('checkbox', { name: '같은 현장 선택' });
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked(); expect(checkboxes[1]).not.toBeChecked();
    expect(within(dialog).getByRole('button', { name: '발행리스트에 추가 (1건)' })).toBeEnabled();
});

test('다른 탭이 먼저 가져온 이월은 기존 값을 표시하고 다시 쓰지 않는다', async () => {
    (service.getDeferredIssuesByMonth as jest.Mock).mockResolvedValue([{ ...row('SOURCE'), yearMonth: '2026-08' }]);
    const existing = { ...row('EXISTING'), recipient: '다른 탭 수정값', carriedFromIssueId: 'SOURCE', carriedFromYearMonth: '2026-08' };
    (service.importDeferredIssue as jest.Mock).mockResolvedValue({ issue: existing, created: false });
    (service.renumberIssuesByMonth as jest.Mock).mockResolvedValue([row('A'), existing]);
    mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: '전체 가져오기' }));
    await screen.findByText(/이미 등록되어 기존 내용을 유지/);
    expect(screen.getByRole('button', { name: '공급받는자 값 편집, 현재 다른 탭 수정값' })).toBeInTheDocument();
    expect(service.addIssue).not.toHaveBeenCalled();
});

test.each(['단건', '일괄'])('%s 삭제 성공 후 목록 갱신 실패가 발생해도 삭제된 행을 제거한다', async mode => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (service.renumberIssuesByMonth as jest.Mock).mockRejectedValueOnce(new Error('follow-up failed'));
    mount(); await ready();
    if (mode === '단건') fireEvent.click(screen.getAllByRole('button', { name: /항목 삭제/ })[0]);
    else {
        fireEvent.click(screen.getByRole('checkbox', { name: '1번 합성 A 항목 선택' }));
        fireEvent.click(screen.getByRole('button', { name: '선택 삭제 (1)' }));
    }
    await screen.findByText(/완료된 변경은 반영됐지만/);
    expect(screen.queryByRole('button', { name: '공급받는자 값 편집, 현재 합성 A' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '공급받는자 값 편집, 현재 합성 B' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '행 추가' })).toBeDisabled();
});

test('부분 저장 성공을 기준에 반영하고 실패한 항목만 재시도한다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (service.updateIssuesBatch as jest.Mock).mockRejectedValueOnce(new IssueBatchWriteError(['A'], new Error('partial')));
    mount(); await ready(); edit('품목', '저장 완료'); edit('비고', '재시도', 1);
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (2)' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '변경사항 저장 (1)' })).toBeEnabled());
    expect(screen.getByText(/1개 항목 저장 완료, 1개 항목 저장 실패/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (1)' }));
    await waitFor(() => expect(service.updateIssuesBatch).toHaveBeenLastCalledWith([{ id: 'B', data: { note: '재시도' } }]));
});

test('부분 저장 중 추가 편집을 유지하며 되돌리기는 실제 저장된 값까지 복원한다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const saving = deferred<void>();
    (service.updateIssuesBatch as jest.Mock).mockReturnValueOnce(saving.promise);
    mount(); await ready(); edit('품목', '저장 완료'); edit('비고', '저장 실패', 1);
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장 (2)' }));
    edit('품목', '추가 편집');
    await act(async () => saving.reject(new IssueBatchWriteError(['A'], new Error('partial'))));
    expect(screen.getByRole('button', { name: '변경사항 저장 (2)' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getByRole('button', { name: '품목 값 편집, 현재 저장 완료' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '비고 값 편집, 현재 저장 실패' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '변경사항 저장 (0)' })).toBeDisabled();
});

test('일괄 삭제 일부 실패 시 삭제된 항목은 제거하고 남은 선택만 재시도한다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (service.deleteIssuesWithConflictCheck as jest.Mock).mockRejectedValueOnce(new IssueBatchWriteError(['A'], new Error('partial')));
    mount(); await ready();
    fireEvent.click(screen.getByRole('checkbox', { name: '1번 합성 A 항목 선택' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '2번 합성 B 항목 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제 (2)' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '선택 삭제 (1)' })).toBeEnabled());
    expect(screen.queryByRole('button', { name: '공급받는자 값 편집, 현재 합성 A' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제 (1)' }));
    await waitFor(() => expect(service.deleteIssuesWithConflictCheck).toHaveBeenLastCalledWith(['B'], [row('B', 2)]));
});

test.each(['단건', '일괄'])('%s 삭제 충돌은 최신 값 확인과 새 삭제 요청 전까지 항목을 보존한다', async mode => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const latest = { ...row('A'), supplyAmount: 300 };
    (service.deleteIssuesWithConflictCheck as jest.Mock).mockRejectedValueOnce(new IssueBatchWriteError([], new IssueDeleteConflictError([{ id: 'A', current: latest, fields: ['supplyAmount'], operation: 'delete' }])));
    (service.renumberIssuesByMonth as jest.Mock).mockResolvedValue([row('B', 1)]);
    mount(); await ready();
    if (mode === '일괄') {
        fireEvent.click(screen.getByRole('checkbox', { name: '1번 합성 A 항목 선택' }));
        fireEvent.click(screen.getByRole('button', { name: '선택 삭제 (1)' }));
    } else fireEvent.click(screen.getByRole('button', { name: '1번 합성 A 항목 삭제' }));
    const panel = await screen.findByRole('region', { name: '동시 수정 충돌' });
    expect(within(panel).getByText('확인했던 값')).toBeInTheDocument();
    expect(within(panel).getByText('100')).toBeInTheDocument();
    expect(within(panel).getByText('300')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: '내 입력 유지' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1번 합성 A 항목 삭제' })).toBeDisabled();
    expect(service.renumberIssuesByMonth).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole('button', { name: '최신 내용 확인' }));
    expect(screen.queryByRole('button', { name: '선택 삭제 (1)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '공급가 값 편집, 현재 300' })).toBeInTheDocument();
    expect(service.deleteIssuesWithConflictCheck).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '1번 합성 A 항목 삭제' }));
    await waitFor(() => expect(service.deleteIssuesWithConflictCheck).toHaveBeenLastCalledWith(['A'], [latest, row('B', 2)]));
    await waitFor(() => expect(screen.queryByRole('button', { name: '공급받는자 값 편집, 현재 합성 A' })).not.toBeInTheDocument());
});

test('일부 삭제 후 충돌한 항목만 확인하고 되돌려도 삭제 완료 행은 복원하지 않는다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const latest = { ...row('B', 2), supplyAmount: 400 };
    (service.deleteIssuesWithConflictCheck as jest.Mock).mockRejectedValueOnce(new IssueBatchWriteError(['A'], new IssueDeleteConflictError([{ id: 'B', current: latest, fields: ['supplyAmount'], operation: 'delete' }])));
    mount(); await ready();
    fireEvent.click(screen.getByRole('checkbox', { name: '현재 조회된 항목 전체 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제 (2)' }));
    await screen.findByRole('region', { name: '동시 수정 충돌' });
    expect(screen.queryByRole('button', { name: '공급받는자 값 편집, 현재 합성 A' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택 삭제 (1)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getByRole('button', { name: '공급가 값 편집, 현재 400' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '공급받는자 값 편집, 현재 합성 A' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '동시 수정 충돌' })).not.toBeInTheDocument();
    expect(service.deleteIssuesWithConflictCheck).toHaveBeenCalledTimes(1);
});

test('삭제 확인창에서 취소하면 서버 비교와 삭제를 시작하지 않는다', async () => {
    (showConfirmAlert as jest.Mock).mockResolvedValue({ isConfirmed: false });
    mount(); await ready();
    fireEvent.click(screen.getByRole('button', { name: '1번 합성 A 항목 삭제' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '1번 합성 A 항목 삭제' })).toBeEnabled());
    expect(service.deleteIssuesWithConflictCheck).not.toHaveBeenCalled();
});
