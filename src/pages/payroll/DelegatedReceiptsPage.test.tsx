import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DelegatedReceiptsPage, { DelegatedReceiptsWorkspace } from './DelegatedReceiptsPage';
import { ClaimListEdit, DelegatedClaim } from '../../features/delegated-receipts/model';
import { delegatedReceiptService } from '../../features/delegated-receipts/service';
import { parseDelegatedWorkbook } from '../../features/delegated-receipts/workbookImport';
import { userService } from '../../services/userService';
import { workbookArchiveService } from '../../features/delegated-receipts/workbookArchiveService';
import { receiptDirectoryService } from '../../features/delegated-receipts/directoryService';
import { getDepositState } from '../../features/delegated-receipts/depositState';

jest.mock('../../features/delegated-receipts/directoryService', () => ({ receiptDirectoryService: { load: jest.fn().mockResolvedValue({ teams: [], sites: [] }) } }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'synthetic-user' }, loading: false }) }));
jest.mock('../../services/userService', () => ({ userService: { getUser: jest.fn() } }));
jest.mock('../../features/delegated-receipts/service', () => ({
  delegatedReceiptService: { list: jest.fn(), importClaims: jest.fn(), saveClaim: jest.fn(), addReceipt: jest.fn(), confirmClaims: jest.fn(), assignSiteTeam: jest.fn(), updateListField: jest.fn() },
  DelegatedReceiptImportError: class extends Error {},
}));
jest.mock('../../features/delegated-receipts/workbookImport', () => ({ parseDelegatedWorkbook: jest.fn() }));
jest.mock('../../features/delegated-receipts/workbookArchiveService', () => ({ workbookArchiveService: { listArchives: jest.fn(), listReviewRows: jest.fn(), importWorkbook: jest.fn(), downloadOriginal: jest.fn() } }));
jest.mock('xlsx', () => ({ read: jest.fn(() => ({})) }));

const base: DelegatedClaim = {
  id: 'synthetic-1', month: '2026-09', siteName: '가상현장 A', workerName: '검증작업자 가',
  delegationType: 'delegate', paymentMethod: 'transfer', grossAmount: 100000, expectedAmount: 100000,
  receipts: [{ id: 'first', amount: 40000, date: '2026-09-10', method: 'transfer', memo: '가상 분할 입금', createdAt: '2026-09-10T00:00:00Z' }],
  sourceStatus: '완료', sourceLabel: '검증용', memo: '', updatedAt: '2026-09-10T00:00:00Z',
};
const fixtures: DelegatedClaim[] = [
  base,
  { ...base, id: 'synthetic-2', workerName: '검증작업자 나', siteName: '가상현장 B', delegationType: 'direct', expectedAmount: 200000, receipts: [] },
  { ...base, id: 'synthetic-3', workerName: '검증작업자 다', delegationType: 'unknown', expectedAmount: null, receipts: [] },
];
const openFirst = () => fireEvent.click(screen.getByRole('button', { name: '검증작업자 가 입금 및 내역' }));

describe('위임금 입금 확인 화면', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (receiptDirectoryService.load as jest.Mock).mockResolvedValue({ teams: [], sites: [] });
    (delegatedReceiptService.list as jest.Mock).mockResolvedValue(fixtures);
    (delegatedReceiptService.confirmClaims as jest.Mock).mockResolvedValue(undefined);
    (delegatedReceiptService.assignSiteTeam as jest.Mock).mockResolvedValue(undefined);
    (delegatedReceiptService.saveClaim as jest.Mock).mockResolvedValue(undefined);
    (delegatedReceiptService.addReceipt as jest.Mock).mockResolvedValue(undefined);
    (delegatedReceiptService.importClaims as jest.Mock).mockResolvedValue({ added: 2, skipped: 0 });
    (workbookArchiveService.listArchives as jest.Mock).mockResolvedValue([]);
    (workbookArchiveService.importWorkbook as jest.Mock).mockResolvedValue({ archiveId: 'synthetic-archive', added: 2, skipped: 0, reviewRows: 1 });
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'admin', status: 'active' });
  });

  it('위임·직불·미확인을 기본으로 함께 표시하고 원본 완료를 입금액으로 간주하지 않는다', () => {
    render(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('검증작업자 가')).toBeInTheDocument();
    expect(within(table).getByText('검증작업자 나')).toBeInTheDocument();
    expect(within(table).getByText('검증작업자 다')).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: '입금 요약' });
    expect(summary).toHaveTextContent('40,000원');
    expect(summary).toHaveTextContent('입금여부 확인 필요2건');
    fireEvent.change(within(screen.getByRole('region', { name: '입금 내역 필터' })).getByLabelText('입금방법', { exact: true }), { target: { value: 'direct' } });
    expect(within(table).queryByText('검증작업자 가')).not.toBeInTheDocument();
    expect(within(table).getByText('검증작업자 나')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('작업자 검색'), { target: { value: '없는이름' } });
    expect(screen.getByText('선택한 조건의 내역이 없습니다')).toBeInTheDocument();
  });

  it('사용자가 지정한 세율로 예정액을 계산하고 0%도 저장한다', async () => {
    render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
    openFirst();
    fireEvent.click(screen.getByRole('button', { name: '기준 정보 수정' }));
    fireEvent.change(screen.getByLabelText('금액 계산 방식'), { target: { value: 'tax' } });
    fireEvent.change(screen.getByLabelText('적용 세율 (%)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '기준 정보 저장' }));
    await waitFor(() => expect(delegatedReceiptService.saveClaim).toHaveBeenCalledWith(expect.objectContaining({ expectedAmount: 100000, taxAmount: 0, taxRate: 0 })));
    await screen.findByText('기준 정보가 저장되었습니다.');
  });

  it('작업자 목록을 먼저 보여주고 현장 요약에서 선택하면 해당 작업자 목록으로 돌아온다', () => {
    render(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '현장별 집계' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '자료 관리' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '현장별 요약' }));
    const sites = screen.getByRole('region', { name: '현장별 집계' });
    fireEvent.click(within(sites).getByRole('button', { name: /가상현장 B/ }));
    expect(screen.queryByRole('region', { name: '현장별 집계' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('현장', { exact: true })).toHaveValue('가상현장 B');
    expect(within(screen.getByRole('table')).getByText('검증작업자 나')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('검증작업자 가')).not.toBeInTheDocument();
  });

  it('모든 필터를 바로 보여주고 조건 초기화와 검색어 지우기를 지원한다', () => {
    render(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
    expect(screen.queryByRole('button', { name: /상세 필터/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '입금 내역 필터' })).getByLabelText('받는 계좌', { exact: true })).toBeVisible();
    expect(within(screen.getByRole('region', { name: '입금 내역 필터' })).getByLabelText('담당 팀', { exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '확인 필요' }));
    expect(within(screen.getByRole('table')).getByText('검증작업자 다')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('검증작업자 가')).not.toBeInTheDocument();
    fireEvent.change(within(screen.getByRole('region', { name: '입금 내역 필터' })).getByLabelText('받는 계좌', { exact: true }), { target: { value: 'personal' } });
    fireEvent.click(within(screen.getByRole('region', { name: '입금 내역 필터' })).getByRole('button', { name: /필터 초기화/ }));
    expect(screen.getAllByRole('row')).toHaveLength(4);
    fireEvent.change(screen.getByLabelText('작업자 검색'), { target: { value: '검증작업자 가' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '작업자 검색 지우기' }));
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('월 화살표로 이동하면 이전 달의 현장 필터를 해제한다', async () => {
    const next = { ...base, id: 'next-month', month: '2026-10', siteName: '다음 달 현장', workerName: '다음 달 작업자' };
    (delegatedReceiptService.list as jest.Mock).mockResolvedValue([next]);
    render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
    fireEvent.change(screen.getByLabelText('현장', { exact: true }), { target: { value: base.siteName } });
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    await waitFor(() => expect(within(screen.getByRole('table')).getByText(next.workerName)).toBeInTheDocument());
    expect(screen.getByLabelText('현장', { exact: true })).toHaveValue('');
  });

  it('미확정 입금과 다른 작업자의 초과 입금으로 현장 입금률을 부풀리지 않는다', () => {
    const paid = { ...base, expectedAmount: 100, receipts: [{ ...base.receipts[0], amount: 200 }] };
    const unpaid = { ...base, id: 'unpaid', workerName: '미입금 작업자', expectedAmount: 100, receipts: [] };
    const { rerender } = render(<DelegatedReceiptsWorkspace key="confirmed" initialClaims={[paid, unpaid]} />);
    fireEvent.click(screen.getByRole('button', { name: '현장별 요약' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    rerender(<DelegatedReceiptsWorkspace key="unconfirmed" initialClaims={[unpaid, { ...paid, expectedAmount: null }]} />);
    fireEvent.click(screen.getByRole('button', { name: '현장별 요약' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('전부 금액 미확정인 현장을 0원 잔액 또는 완납률로 표시하지 않는다', () => {
    render(<DelegatedReceiptsWorkspace initialClaims={[fixtures[2]]} />);
    fireEvent.click(screen.getByRole('button', { name: '현장별 요약' }));
    const site = screen.getByRole('region', { name: '현장별 집계' });
    expect(site).toHaveTextContent('입금완료0 / 1건');
    expect(within(site).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    const summary = screen.getByRole('region', { name: '입금 요약' });
    expect(summary).toHaveTextContent('입금여부 확인 필요1건');
    expect(summary).toHaveTextContent(/기록된 입금액\s*미기록/);
  });

  it('분할 입금을 실제 일자와 계좌이체로 저장하고 이중 클릭을 막는다', async () => {
    let complete: (() => void) | undefined;
    (delegatedReceiptService.addReceipt as jest.Mock).mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
    render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
    openFirst();
    fireEvent.click(screen.getByText('금액 기록 · 세금 · 원본 내역'));
    expect(screen.getByText('가상 분할 입금')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('입금액 (원)'), { target: { value: '25000' } });
    fireEvent.change(screen.getByLabelText('실제 입금일'), { target: { value: '2026-09-12' } });
    expect(screen.queryByLabelText('실제 수령수단')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: '확인한 입금 기록 저장' });
    fireEvent.click(button); fireEvent.click(button);
    expect(delegatedReceiptService.addReceipt).toHaveBeenCalledTimes(1);
    expect(delegatedReceiptService.addReceipt).toHaveBeenCalledWith(base.id, expect.objectContaining({ amount: 25000, date: '2026-09-12', method: 'transfer' }));
    complete?.();
    await screen.findByText('입금 기록을 저장했습니다. 잔액이 갱신되었습니다.');
  });

  it('입금 저장 응답 실패 후 같은 내용 재시도에 같은 식별자를 사용한다', async () => {
    (delegatedReceiptService.addReceipt as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
    openFirst();
    fireEvent.click(screen.getByText('금액 기록 · 세금 · 원본 내역'));
    fireEvent.change(screen.getByLabelText('입금액 (원)'), { target: { value: '25000' } });
    fireEvent.click(screen.getByRole('button', { name: '확인한 입금 기록 저장' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '확인한 입금 기록 저장' }));
    await waitFor(() => expect(delegatedReceiptService.addReceipt).toHaveBeenCalledTimes(2));
    const calls = (delegatedReceiptService.addReceipt as jest.Mock).mock.calls;
    expect(calls[0][1]).toEqual(calls[1][1]);
    await screen.findByText('입금 기록을 저장했습니다. 잔액이 갱신되었습니다.');
  });

  it('엑셀 미리보기에서 명시적으로 확인한 뒤 공통세율과 미확인 입금방법을 적용한다', async () => {
    const reviewRow = { id: 'synthetic-review', sourceLabel: '가상 시트!A12:C12', sourceTitle: '', workerName: '검증 분류대기', grossAmount: 10000, sourceStatus: '완료', reason: '월·현장 확인 필요', rawCells: [{ address: 'A12', value: '검증 분류대기' }] };
    const parsed = { claims: [fixtures[1], fixtures[2]], warnings: [], unclassifiedRows: [reviewRow], sheetSummaries: [{ name: '가상 시트', populatedCells: 20, claimCount: 2, reviewRowCount: 1 }] };
    (parseDelegatedWorkbook as jest.Mock).mockReturnValue(parsed);
    render(<DelegatedReceiptsWorkspace initialClaims={[]} />);
    const file = new File(['synthetic'], '가상자료.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: jest.fn().mockResolvedValue(new ArrayBuffer(4)) });
    fireEvent.change(screen.getByLabelText('입금 확인 엑셀 파일'), { target: { files: [file] } });
    const dialog = await screen.findByRole('dialog', { name: '엑셀 가져오기 확인' });
    expect(workbookArchiveService.importWorkbook).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent('분류 대기 1건');
    fireEvent.change(within(dialog).getByLabelText('공통 세율 (%) · 선택'), { target: { value: '10' } });
    fireEvent.change(within(dialog).getByLabelText('미확인 입금방법 설정'), { target: { value: 'delegate' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '원본과 전체 3건 저장' }));
    await waitFor(() => expect(workbookArchiveService.importWorkbook).toHaveBeenCalledWith(new Uint8Array(4), '가상자료.xlsx', parsed, [
      expect.objectContaining({ id: 'synthetic-2', delegationType: 'direct', taxRate: 10, taxAmount: 10000, expectedAmount: 90000 }),
      expect.objectContaining({ id: 'synthetic-3', delegationType: 'delegate', taxRate: 10, taxAmount: 10000, expectedAmount: 90000 }),
    ]));
    await screen.findByText('원본 전체 보관 완료 · 관리 2건 추가 · 기존 0건 유지 · 분류 대기 1건 보관');
    expect(delegatedReceiptService.importClaims).not.toHaveBeenCalled();
  });

  it('월별 관리 내역이 없어도 원본과 분류 대기 행을 저장할 수 있다', async () => {
    const parsed = { claims: [], warnings: [], unclassifiedRows: [{ id: 'review-only', sourceLabel: '가상!A2', sourceTitle: '', workerName: '검증 미분류', grossAmount: null, sourceStatus: '', reason: '제목 없음', rawCells: [{ address: 'A2', value: '검증 미분류' }] }], sheetSummaries: [{ name: '가상', populatedCells: 1, claimCount: 0, reviewRowCount: 1 }] };
    (parseDelegatedWorkbook as jest.Mock).mockReturnValue(parsed);
    (workbookArchiveService.importWorkbook as jest.Mock).mockResolvedValue({ archiveId: 'synthetic-only', added: 0, skipped: 0, reviewRows: 1 });
    render(<DelegatedReceiptsWorkspace initialClaims={[]} />);
    const file = new File(['synthetic'], '분류대기.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: jest.fn().mockResolvedValue(new ArrayBuffer(4)) });
    fireEvent.change(screen.getByLabelText('입금 확인 엑셀 파일'), { target: { files: [file] } });
    const save = await screen.findByRole('button', { name: '원본과 전체 1건 저장' });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(workbookArchiveService.importWorkbook).toHaveBeenCalledWith(new Uint8Array(4), '분류대기.xlsx', parsed, []));
    await screen.findByText('원본 전체 보관 완료 · 관리 0건 추가 · 기존 0건 유지 · 분류 대기 1건 보관');
  });

  it('가상 초기 데이터 화면은 원본을 자동 조회하지 않고 보관함에서 저장월로 이동한다', async () => {
    (workbookArchiveService.listArchives as jest.Mock).mockResolvedValue([{ id: 'archive-test', recordType: 'source-workbook', fileName: '가상 보관.xlsx', sha256: 'synthetic', byteLength: 10, chunkCount: 1, claimCount: 3, reviewRowCount: 0, months: ['2025-03'], status: 'complete', createdAt: '2026-09-11T00:00:00Z', sheetSummaries: [], warnings: [] }]);
    render(<DelegatedReceiptsWorkspace initialClaims={[]} />);
    expect(workbookArchiveService.listArchives).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '자료 관리' }));
    fireEvent.click(screen.getByRole('button', { name: '원본 보관함' }));
    const button = await screen.findByRole('button', { name: '2025-03 저장 내역 보기' });
    fireEvent.click(button);
    expect(screen.queryByRole('dialog', { name: '원본 보관함' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('귀속월')).toHaveValue('2025-03');
    await waitFor(() => expect(delegatedReceiptService.list).toHaveBeenCalledWith('2025-03'));
  });

  it('로딩 실패를 표시하고 다시 조회할 수 있다', async () => {
    (delegatedReceiptService.list as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(fixtures);
    render(<DelegatedReceiptsWorkspace />);
    expect(screen.getByText('입금 내역을 불러오고 있습니다')).toBeInTheDocument();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(delegatedReceiptService.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('권한 없는 사용자는 조회 서비스를 호출하지 않는다', async () => {
    (userService.getUser as jest.Mock).mockResolvedValue({ role: 'user', status: 'active' });
    render(<DelegatedReceiptsPage />);
    await screen.findByText('조회 권한이 필요합니다');
    expect(delegatedReceiptService.list).not.toHaveBeenCalled();
  });

  it('읽기 전용 화면에서는 추가·가져오기·입금저장을 노출하지 않는다', () => {
    render(<DelegatedReceiptsWorkspace initialClaims={[base]} canWrite={false} />);
    expect(within(screen.getByRole('table')).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '자료 관리' }));
    expect(screen.queryByRole('button', { name: '직접 추가' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '엑셀 가져오기' })).not.toBeInTheDocument();
    openFirst();
    expect(screen.queryByRole('button', { name: '확인한 입금 기록 저장' })).not.toBeInTheDocument();
    expect(screen.getByText('가상 분할 입금')).toBeInTheDocument();
  });
});

it('원본 공동 완료를 금액 미설정이어도 표시하고 계좌 수단은 노출하지 않는다', () => {
  render(<DelegatedReceiptsWorkspace initialClaims={[{ ...base, expectedAmount: null, receipts: [], sourceStatus: '그룹 표시 G11:G15: 이재욱 위임 입금 완료 (개별 확인 필요)' }]} />);
  const table = screen.getByRole('table');
  expect(within(table).getByText('입금완료')).toBeInTheDocument();
  expect(within(table).getByText(/이재욱팀 팀장계좌/)).toBeInTheDocument();
  expect(within(table).getByText('엑셀 공동 표시 · 금액 미기록')).toBeInTheDocument();
  expect(screen.queryByText(/수령수단/)).not.toBeInTheDocument();
});
it('선택 내역의 입금여부를 한번에 저장하고 기존 계좌 구분을 보존한다', async () => {
  (delegatedReceiptService.confirmClaims as jest.Mock).mockResolvedValue(undefined);
  (delegatedReceiptService.list as jest.Mock).mockResolvedValue(fixtures);
  render(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
  fireEvent.click(screen.getByRole('checkbox', { name: '현재 목록 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '선택 내역 입금여부 변경' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: '3건 입금완료 저장' }));
  await waitFor(() => expect(delegatedReceiptService.confirmClaims).toHaveBeenCalledWith(fixtures.map(row => row.id), expect.objectContaining({ status: 'complete' }), true));
  await screen.findByText('3건의 입금여부를 저장했습니다.');
});
it('팀 색상을 보여주고 팀 연결은 같은 귀속월 현장에만 적용한다', async () => {
  (delegatedReceiptService.assignSiteTeam as jest.Mock).mockResolvedValue(undefined);
  (delegatedReceiptService.list as jest.Mock).mockResolvedValue(fixtures);
  const directory = { teams: [{ id: 'team-test', name: '가상 담당 팀', color: '#336699' }], sites: [{ id: 'site-test', name: base.siteName, responsibleTeamId: 'team-test' }] };
  render(<DelegatedReceiptsWorkspace initialClaims={fixtures} initialDirectory={directory} />);
  expect(within(screen.getByRole('table')).queryByText('가상 담당 팀')).not.toBeInTheDocument();
  openFirst();
  fireEvent.click(screen.getByText('현장 담당 팀 · 색상 연결'));
  fireEvent.change(screen.getByLabelText('현장 담당 팀'), { target: { value: 'team-test' } });
  fireEvent.click(screen.getByRole('button', { name: '이 현장의 팀 연결 저장' }));
  await waitFor(() => expect(delegatedReceiptService.assignSiteTeam).toHaveBeenCalledWith(['synthetic-1', 'synthetic-3'], '2026-09', base.siteName, 'team-test'));
  await screen.findByText('현장 담당 팀과 색상을 연결했습니다.');
});

it('목록에서 세 항목을 바로 저장하고 PC·모바일 표시와 요약을 함께 갱신한다', async () => {
  let saved = { ...base };
  (delegatedReceiptService.updateListField as jest.Mock).mockImplementation(async (_id, edit) => {
    const change = edit.change;
    saved = change.field === 'delegation' ? { ...saved, delegationOverride: change.value }
      : { ...saved, confirmation: { ...getDepositState(saved), id: edit.id, recordedAt: edit.recordedAt, note: '', [change.field]: change.value } };
    return saved;
  });
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  fireEvent.change(screen.getByRole('combobox', { name: '검증작업자 가 입금방법' }), { target: { value: 'direct' } });
  await waitFor(() => expect(screen.getByRole('combobox', { name: '검증작업자 가 모바일 입금방법' })).toHaveValue('direct'));
  fireEvent.change(screen.getByRole('combobox', { name: '검증작업자 가 모바일 받는 계좌' }), { target: { value: 'site_leader' } });
  await waitFor(() => expect(screen.getByRole('combobox', { name: '검증작업자 가 받는 계좌' })).toHaveValue('site_leader'));
  fireEvent.change(screen.getByRole('combobox', { name: '검증작업자 가 입금여부' }), { target: { value: 'complete' } });
  await waitFor(() => expect(screen.getByRole('combobox', { name: '검증작업자 가 모바일 입금여부' })).toHaveValue('complete'));
  expect(delegatedReceiptService.updateListField).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(delegatedReceiptService.list).not.toHaveBeenCalled();
  expect(screen.getByRole('region', { name: '입금 요약' })).toHaveTextContent('40,000원');
  expect(screen.getByRole('region', { name: '입금 요약' })).toHaveTextContent('입금완료 / 조회 1/ 1건');
});

it('목록 저장 실패를 표시하고 같은 요청으로 다시 저장한다', async () => {
  (delegatedReceiptService.updateListField as jest.Mock).mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce({ ...base, delegationOverride: 'direct' });
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  const table = within(screen.getByRole('table'));
  const method = table.getByRole('combobox', { name: '검증작업자 가 입금방법' });
  fireEvent.change(method, { target: { value: 'direct' } });
  await table.findByText('저장 확인 실패');
  expect(method).toBeDisabled();
  expect(screen.getByRole('combobox', { name: '검증작업자 가 모바일 입금방법' })).toHaveValue('direct');
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 목록 변경 다시 저장' }));
  await table.findByText('저장됨');
  expect(method).toBeEnabled();
  const calls = (delegatedReceiptService.updateListField as jest.Mock).mock.calls;
  expect(calls[1]).toEqual(calls[0]);
});

it('예정 금액은 입력 후 저장하며 잘못된 금액은 거부하고 0원을 허용한다', async () => {
  (delegatedReceiptService.updateListField as jest.Mock).mockResolvedValue({ ...base, expectedAmount: 0, originalExpectedAmount: base.expectedAmount });
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  const table = within(screen.getByRole('table'));
  const input = table.getByRole('textbox', { name: '검증작업자 가 받을 예정 금액' });
  fireEvent.change(input, { target: { value: '1.5' } });
  expect(table.getByRole('button', { name: '검증작업자 가 금액 저장' })).toBeDisabled();
  expect(delegatedReceiptService.updateListField).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '0' } });
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 금액 저장' }));
  await table.findByText('저장됨');
  expect(delegatedReceiptService.updateListField).toHaveBeenCalledWith(base.id, expect.objectContaining({ change: { field: 'expectedAmount', value: 0 } }));
  expect(input).toHaveValue('0');
  expect(screen.getByRole('textbox', { name: '검증작업자 가 모바일 받을 예정 금액' })).toHaveValue('0');
  expect(screen.getByRole('region', { name: '입금 요약' })).toHaveTextContent('40,000원');
});

it('모바일 예정 금액은 취소할 수 있고 비우면 미확정으로 저장한다', async () => {
  (delegatedReceiptService.updateListField as jest.Mock).mockResolvedValue({ ...base, expectedAmount: null, originalExpectedAmount: base.expectedAmount });
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  const input = screen.getByRole('textbox', { name: '검증작업자 가 모바일 받을 예정 금액' });
  fireEvent.change(input, { target: { value: '120,000' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(input).toHaveValue('100,000');
  expect(delegatedReceiptService.updateListField).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '검증작업자 가 모바일 금액 저장' }));
  await waitFor(() => expect(delegatedReceiptService.updateListField).toHaveBeenCalledWith(base.id, expect.objectContaining({ change: { field: 'expectedAmount', value: null } })));
  await waitFor(() => expect(input).toBeEnabled());
  expect(input).toHaveValue('');
});

it('오른쪽 메모 스티커를 등록·수정·삭제·복원하고 모바일과 초안을 공유한다', async () => {
  let saved = { ...base };
  (delegatedReceiptService.updateListField as jest.Mock).mockImplementation(async (_id: string, edit: ClaimListEdit) => {
    if (edit.change.field !== 'memo') throw Error('Unexpected change');
    saved = { ...saved, memo: edit.change.value.trim(), confirmationHistory: [...(saved.confirmationHistory ?? []), { ...getDepositState(saved), id: edit.id, recordedAt: edit.recordedAt, note: '', listChange: edit.change, previousMemo: saved.memo }] };
    return saved;
  });
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  const table = within(screen.getByRole('table'));
  expect(table.getAllByRole('columnheader').at(-1)).toHaveTextContent('메모');
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 메모 등록' }));
  expect(table.getByRole('button', { name: '검증작업자 가 메모 저장' })).toBeDisabled();
  fireEvent.change(table.getByRole('textbox', { name: '검증작업자 가 메모 내용' }), { target: { value: '정산 확인\n금요일 다시 확인' } });
  expect(screen.getByRole('textbox', { name: '검증작업자 가 모바일 메모 내용' })).toHaveValue('정산 확인\n금요일 다시 확인');
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 메모 저장' }));
  const sticker = await table.findByRole('region', { name: '검증작업자 가 메모' });
  await waitFor(() => expect(within(sticker).queryByRole('textbox')).not.toBeInTheDocument());
  expect(sticker).toHaveTextContent('정산 확인 금요일 다시 확인');
  fireEvent.click(screen.getByRole('button', { name: '검증작업자 가 모바일 메모 수정' }));
  fireEvent.change(screen.getByRole('textbox', { name: '검증작업자 가 모바일 메모 내용' }), { target: { value: '취소할 초안' } });
  fireEvent.keyDown(screen.getByRole('textbox', { name: '검증작업자 가 모바일 메모 내용' }), { key: 'Escape' });
  expect(delegatedReceiptService.updateListField).toHaveBeenCalledTimes(1);
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 메모 수정' }));
  fireEvent.change(table.getByRole('textbox', { name: '검증작업자 가 메모 내용' }), { target: { value: '수정한 메모' } });
  fireEvent.keyDown(table.getByRole('textbox', { name: '검증작업자 가 메모 내용' }), { key: 'Enter', ctrlKey: true });
  await table.findByText('수정한 메모');
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 메모 삭제' }));
  fireEvent.click(await table.findByRole('button', { name: '검증작업자 가 메모 삭제 취소' }));
  await table.findByText('수정한 메모');
  expect(delegatedReceiptService.updateListField).toHaveBeenCalledTimes(4);
  expect(table.getByRole('textbox', { name: '검증작업자 가 받을 예정 금액' })).toHaveValue('100,000');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('메모 저장 실패 시 초안을 유지하며 동일 요청으로 재시도한다', async () => {
  (delegatedReceiptService.updateListField as jest.Mock).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ ...base, memo: '보존할 메모' });
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  const table = within(screen.getByRole('table'));
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 메모 등록' }));
  fireEvent.change(table.getByRole('textbox', { name: '검증작업자 가 메모 내용' }), { target: { value: '보존할 메모' } });
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 메모 저장' }));
  await table.findByText('저장 확인 실패');
  expect(table.getByRole('textbox', { name: '검증작업자 가 메모 내용' })).toHaveValue('보존할 메모');
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 목록 변경 다시 저장' }));
  await table.findByText('저장됨');
  expect(table.queryByRole('textbox', { name: '검증작업자 가 메모 내용' })).not.toBeInTheDocument();
  const calls = (delegatedReceiptService.updateListField as jest.Mock).mock.calls;
  expect(calls[1]).toEqual(calls[0]);
});

it('읽기 전용 메모는 보이되 등록·수정·삭제를 노출하지 않는다', () => {
  render(<DelegatedReceiptsWorkspace initialClaims={[{ ...base, memo: '기존 메모' }, { ...base, id: 'empty-memo', workerName: '검증작업자 나' }]} canWrite={false} />);
  expect(within(screen.getByRole('table')).getByText('기존 메모')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /메모 (등록|수정|삭제)/ })).not.toBeInTheDocument();
});
