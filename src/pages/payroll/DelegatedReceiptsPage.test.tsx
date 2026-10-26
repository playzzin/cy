import React from 'react';
import { siteTaxService } from '../../features/delegated-receipts/siteTaxService';
import { siteMemoService } from '../../features/delegated-receipts/siteMemoService';
import * as teamDirectory from '../../features/delegated-receipts/teamDirectory';
import '@testing-library/jest-dom';
import { fireEvent, render as rawRender, screen, waitFor, within } from '@testing-library/react';
import DelegatedReceiptsPage, { DelegatedReceiptsWorkspace } from './DelegatedReceiptsPage';
import { ClaimListEdit, DelegatedClaim } from '../../features/delegated-receipts/model';
import { delegatedReceiptService } from '../../features/delegated-receipts/service';
import { parseDelegatedWorkbook } from '../../features/delegated-receipts/workbookImport';
import { userService } from '../../services/userService';
import { workbookArchiveService } from '../../features/delegated-receipts/workbookArchiveService';
import { receiptDirectoryService } from '../../features/delegated-receipts/directoryService';
import { getDepositState } from '../../features/delegated-receipts/depositState';

jest.mock('../../features/delegated-receipts/siteTaxService', () => ({ siteTaxService: { list: jest.fn(), save: jest.fn() } }));
beforeEach(() => { (siteTaxService.list as jest.Mock).mockResolvedValue([]); });
jest.mock('../../features/delegated-receipts/siteMemoService', () => ({ siteMemoService: { list: jest.fn(), save: jest.fn() }, SiteMemoConflictError: class extends Error {} }));
beforeEach(() => { (siteMemoService.list as jest.Mock).mockImplementation(() => new Promise(() => {})); });
const render = (ui: React.ReactElement) => {
  const view = rawRender(ui);
  const list = screen.queryByRole('button', { name: '기본 목록' });
  if (list) fireEvent.click(list);
  const expand = screen.queryByRole('button', { name: '현장 모두 펼치기' });
  if (expand) fireEvent.click(expand);
  return view;
};

jest.mock('../../features/delegated-receipts/directoryService', () => ({ receiptDirectoryService: { load: jest.fn().mockResolvedValue({ teams: [], sites: [] }) } }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'synthetic-user' }, loading: false }) }));
jest.mock('../../services/userService', () => ({ userService: { getUser: jest.fn() } }));
jest.mock('../../features/delegated-receipts/service', () => ({
  delegatedReceiptService: { list: jest.fn(), createClaims: jest.fn(), importClaims: jest.fn(), saveClaim: jest.fn(), addReceipt: jest.fn(), confirmClaims: jest.fn(), assignSiteTeam: jest.fn(), updateListField: jest.fn(), updateListFields: jest.fn() },
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

describe('기본 목록과 엑셀형 보기 연결', () => {
  beforeEach(() => { (delegatedReceiptService.updateListField as jest.Mock).mockReset(); });

  it('현장 내역을 15개씩 이어서 표시하고 전체 선택·메모·보기 전환을 같은 현장에 연결한다', async () => {
    (siteMemoService.list as jest.Mock).mockResolvedValue([]);
    const workers = Array.from({ length: 31 }, (_, index) => ({ ...base, id: `split-${index}`, workerName: `분할${String(index + 1).padStart(2, '0')}` }));
    const invoice: DelegatedClaim = { ...base, id: 'split-invoice', workerName: '별도 계산서', entryKind: 'invoice' };
    const directory = { teams: [{ id: 'split-team', name: '검증팀', color: '#336699' }], sites: [{ id: 'split-site', name: base.siteName, responsibleTeamId: 'split-team' }] };
    render(<DelegatedReceiptsWorkspace initialClaims={[...workers, invoice, fixtures[1]]} initialDirectory={directory} />);
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    const grid = within(screen.getByRole('region', { name: '현장 4개씩 가로 목록' }));
    const sheets = [1, 2, 3].map(index => within(grid.getByRole('region', { name: `${base.siteName} 내역 (${index}/3)` })));
    expect(grid.getAllByText('검증팀')).toHaveLength(3);
    expect([1, 2, 3].map(index => within(grid.getByRole('region', { name: `${base.siteName} 내역 (${index}/3)` })).getAllByRole('article').length)).toEqual([15, 15, 2]);
    expect(grid.getAllByRole('article')).toHaveLength(33);
    expect(sheets[2].getByText('별도 계산서')).toBeVisible();
    expect(sheets[1].getByText('16–30 / 32건')).toBeVisible();
    fireEvent.click(sheets[1].getByRole('checkbox', { name: `${base.siteName} 현장 전체 선택 · 이어서 2` }));
    expect(screen.getByText('32건 선택')).toBeVisible();
    expect(sheets[0].getByRole('checkbox', { name: `${base.siteName} 현장 전체 선택` })).toBeChecked();
    expect(sheets[2].getByRole('checkbox', { name: `${base.siteName} 현장 전체 선택 · 이어서 3` })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: `${fixtures[1].workerName} 선택` })).not.toBeChecked();
    const amount = sheets[1].getByRole('textbox', { name: '분할16 세전 금액' });
    fireEvent.change(amount, { target: { value: '345678' } });
    fireEvent.click(screen.getByRole('button', { name: '기본 목록' }));
    expect(screen.getByRole('textbox', { name: '분할16 세전 금액' })).toBe(amount);
    expect(screen.getAllByRole('checkbox', { name: /현장 전체 선택/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    expect(screen.getByRole('textbox', { name: '분할16 세전 금액' })).toHaveValue('345678');
    const memo = sheets[2].getByRole('button', { name: `${base.siteName} 현장 · 이어서 3 새 메모` });
    await waitFor(() => expect(memo).toBeEnabled());
    fireEvent.click(memo);
    expect(screen.getByRole('dialog', { name: `${base.siteName} 현장 메모` })).toBeVisible();
  });

  it('15개인 현장은 한 카드에 끝나며 검색한 나머지 내역도 중복 없이 표시한다', () => {
    const claims = Array.from({ length: 15 }, (_, index) => ({ ...base, id: `limit-${index}`, workerName: `경계${String(index + 1).padStart(2, '0')}` }));
    render(<DelegatedReceiptsWorkspace initialClaims={claims} />);
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    const grid = within(screen.getByRole('region', { name: '현장 4개씩 가로 목록' }));
    expect(grid.getAllByRole('region')).toHaveLength(1);
    expect(grid.getAllByRole('article')).toHaveLength(15);
    fireEvent.change(screen.getByRole('textbox', { name: '작업자 검색' }), { target: { value: '경계15' } });
    expect(grid.getAllByRole('article')).toHaveLength(1);
    expect(grid.getByText('1–1 / 1건')).toBeVisible();
  });

  it('작업자를 펼치지 않고 입금방법·계좌를 수정하고 보기 전환에도 직접 입력 초안을 유지한다', async () => {
    let saved = { ...base };
    (delegatedReceiptService.updateListField as jest.Mock).mockImplementation(async (_id, edit) => {
      const change = edit.change;
      saved = change.field === 'delegation' ? { ...saved, delegationOverride: change.value }
        : { ...saved, confirmation: { ...getDepositState(saved), id: edit.id, recordedAt: edit.recordedAt, note: '', [change.field]: change.value } };
      return saved;
    });
    render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    const information = within(screen.getByRole('group', { name: `${base.workerName} 입금 정보` }));
    expect(information.queryByRole('button', { name: `${base.workerName} 작업자` })).not.toBeInTheDocument();
    expect(information.getAllByRole('combobox')).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: `${base.workerName} 세전 금액` })).toBeVisible();
    expect(screen.getByRole('combobox', { name: `${base.workerName} 입금여부` })).toBeVisible();
    expect(screen.getByRole('button', { name: `${base.workerName} 새 메모` })).toBeVisible();
    fireEvent.click(information.getByRole('combobox', { name: `${base.workerName} 입금방법` }));
    fireEvent.click(screen.getByRole('option', { name: '직불' }));
    await waitFor(() => expect(information.getByRole('combobox', { name: `${base.workerName} 입금방법` })).toHaveTextContent('직불'));
    await waitFor(() => expect(information.getByRole('combobox', { name: `${base.workerName} 받는 계좌` })).toBeEnabled());
    fireEvent.click(information.getByRole('combobox', { name: `${base.workerName} 받는 계좌` }));
    fireEvent.click(screen.getByRole('option', { name: '직접 입력…' }));
    const draft = information.getByRole('textbox', { name: `${base.workerName} 받는 계좌 직접 입력` });
    fireEvent.change(draft, { target: { value: '검증 팀장 별도계좌' } });
    expect(draft).toBeVisible();
    expect(information.getAllByRole('combobox')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '기본 목록' }));
    expect(screen.getByRole('textbox', { name: `${base.workerName} 받는 계좌 직접 입력` })).toBe(draft);
    expect(draft).toBeVisible();
    expect(draft).toHaveValue('검증 팀장 별도계좌');
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    expect(draft).toBeVisible();
    expect(information.getByRole('textbox', { name: `${base.workerName} 받는 계좌 직접 입력` })).toBe(draft);
    expect(draft).toHaveValue('검증 팀장 별도계좌');
    fireEvent.keyDown(draft, { key: 'Enter' });
    await waitFor(() => expect(information.getByRole('combobox', { name: `${base.workerName} 받는 계좌` })).toHaveTextContent('검증 팀장 별도계좌'));
    const paymentSummary = within(screen.getByRole('group', { name: `${base.workerName} 계좌 구분` }));
    expect(paymentSummary.getByText('직불')).toBeVisible();
    expect(paymentSummary.getByText('검증 팀장 별도계좌')).toBeVisible();
    expect(delegatedReceiptService.updateListField).toHaveBeenNthCalledWith(1, base.id, expect.objectContaining({ change: { field: 'delegation', value: 'direct' } }));
    expect(delegatedReceiptService.updateListField).toHaveBeenNthCalledWith(2, base.id, expect.objectContaining({ change: { field: 'recipient', value: 'custom:검증 팀장 별도계좌' } }));
    fireEvent.click(screen.getByRole('button', { name: `${base.workerName} 새 메모` }));
    expect(screen.getByRole('dialog', { name: `${base.workerName} 메모` })).toBeVisible();
  });

  it('읽기 전용에서도 작업자를 펼치지 않고 입금방법·받는 계좌를 확인한다', () => {
    rawRender(<DelegatedReceiptsWorkspace initialClaims={[{ ...base, delegationType: 'direct', sourceStatus: '개인통장' }]} canWrite={false} />);
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    const information = within(screen.getByRole('group', { name: `${base.workerName} 입금 정보` }));
    const summary = within(screen.getByRole('group', { name: `${base.workerName} 계좌 구분` }));
    expect(information.queryByRole('button')).not.toBeInTheDocument();
    expect(summary.getByText('직불')).toBeVisible();
    expect(summary.getByText('개인통장')).toBeVisible();
    expect(information.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it.each([true, false])('계좌 구분은 최종 확인·입금방법 수정값을 우선하며 미확인은 추정하지 않는다 (수정권한 %s)', canWrite => {
    rawRender(<DelegatedReceiptsWorkspace canWrite={canWrite} initialClaims={[
      { ...base, id: 'personal', workerName: '개인 작업자', sourceStatus: '개인통장', delegationType: 'unknown' },
      { ...base, id: 'delegated', workerName: '위임 작업자', sourceStatus: '이재욱 위임 입금완료' },
      { ...base, id: 'confirmed', workerName: '수정 작업자', sourceStatus: '개인통장', delegationOverride: 'direct', confirmation: { id: 'confirmed', recipient: 'custom:확인된 별도 계좌', status: 'pending', recordedAt: base.updatedAt, note: '' } },
      { ...base, id: 'unknown', workerName: '미확인 작업자', sourceStatus: '', delegationType: 'unknown' },
    ]} />);
    expect(screen.getByRole('heading', { name: '노무 입금 확인' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    const summary = (name: string) => within(screen.getByRole('group', { name: `${name} 계좌 구분` }));
    expect(summary('개인 작업자').getByText('개인통장')).toBeVisible();
    expect(summary('개인 작업자').getByText('미확인')).toBeVisible();
    expect(summary('위임 작업자').getByText('위임')).toBeVisible();
    expect(summary('위임 작업자').getByText('이재욱 위임')).toBeVisible();
    expect(summary('수정 작업자').getByText('직불')).toBeVisible();
    expect(summary('수정 작업자').getByText('확인된 별도 계좌')).toBeVisible();
    expect(summary('수정 작업자').queryByText('개인통장')).not.toBeInTheDocument();
    expect(summary('미확인 작업자').getByText('미확인')).toBeVisible();
    expect(within(screen.getByRole('region', { name: '현장별 작업자 내역' })).queryAllByRole('combobox', { name: /받는 계좌$/ })).toHaveLength(canWrite ? 4 : 0);
  });

  it('엑셀형을 기본으로 네 현장을 넘는 모든 내역을 표시하고 목록형 전환·검색을 유지한다', () => {
    const claims = Array.from({ length: 7 }, (_, index) => ({ ...base, id: `site-${index}`, siteName: `검증현장 ${index + 1}`, workerName: `검증인원 ${index + 1}` }));
    claims.push({ ...claims[0], id: 'invoice-grid', workerName: '검증 계산서', entryKind: 'invoice' } as DelegatedClaim);
    rawRender(<DelegatedReceiptsWorkspace initialClaims={claims} />);
    expect(screen.getByRole('button', { name: '엑셀형 · 4개씩' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '기본 목록' })).toHaveAttribute('aria-pressed', 'false');
    const grid = within(screen.getByRole('region', { name: '현장 4개씩 가로 목록' }));
    expect(grid.getAllByRole('region')).toHaveLength(7);
    expect(grid.getAllByRole('article')).toHaveLength(8);
    expect(grid.getByText('검증 계산서')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '기본 목록' }));
    expect(screen.queryByRole('article', { name: / 내역$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검증현장 1 현장' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    fireEvent.change(screen.getByRole('textbox', { name: '작업자 검색' }), { target: { value: '검증인원 7' } });
    expect(screen.getAllByRole('article', { name: / 내역$/ })).toHaveLength(1);
    fireEvent.change(screen.getByRole('textbox', { name: '작업자 검색' }), { target: { value: '검색 결과 없음' } });
    expect(screen.getByText('선택한 조건의 내역이 없습니다')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '작업자 검색 지우기' }));
    expect(screen.getByRole('button', { name: '엑셀형 · 4개씩' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('article', { name: / 내역$/ })).toHaveLength(8);
  });

  it('보기 전환에 금액 초안과 현장 선택을 유지하고 저장 결과를 같은 목록과 합계에 반영한다', async () => {
    (delegatedReceiptService.updateListField as jest.Mock).mockResolvedValue({ ...base, grossAmount: 250000 });
    render(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
    const amount = screen.getByRole('textbox', { name: `${base.workerName} 세전 금액` });
    fireEvent.change(amount, { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('checkbox', { name: `${base.siteName} 현장 전체 선택` }));
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    expect(screen.getByRole('textbox', { name: `${base.workerName} 세전 금액` })).toBe(amount);
    expect(amount).toHaveValue('250000');
    expect(screen.getByRole('checkbox', { name: `${base.siteName} 현장 전체 선택` })).toBeChecked();
    expect(screen.getByRole('button', { name: '선택 내역 일괄 수정' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: `${base.workerName} 세전 금액 저장` }));
    await waitFor(() => expect(amount).toHaveValue('250,000'));
    expect(delegatedReceiptService.updateListField).toHaveBeenCalledWith(base.id, expect.objectContaining({ change: { field: 'grossAmount', value: 250000 } }));
    fireEvent.click(screen.getByRole('button', { name: '기본 목록' }));
    expect(screen.getByRole('textbox', { name: `${base.workerName} 세전 금액` })).toBe(amount);
    expect(screen.getByRole('button', { name: `${base.siteName} 현장` })).toHaveTextContent('350,000원');
  });

  it('엑셀형 입금여부 저장 실패도 보기 전환 뒤 같은 요청으로 재시도하고 조회 권한을 지킨다', async () => {
    const updated = { ...base, confirmation: { ...getDepositState(base), status: 'pending', id: 'grid-edit', recordedAt: base.updatedAt, note: '' } } as DelegatedClaim;
    (delegatedReceiptService.updateListField as jest.Mock).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(updated);
    const { unmount } = rawRender(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    fireEvent.change(screen.getByRole('combobox', { name: `${base.workerName} 입금여부` }), { target: { value: 'pending' } });
    await screen.findByText('저장 확인 실패');
    fireEvent.click(screen.getByRole('button', { name: '기본 목록' }));
    fireEvent.click(screen.getByRole('button', { name: `${base.siteName} 현장` }));
    fireEvent.click(screen.getByRole('button', { name: `${base.workerName} 목록 변경 다시 저장` }));
    await screen.findByText('저장됨');
    const calls = (delegatedReceiptService.updateListField as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(screen.getByRole('combobox', { name: `${base.workerName} 입금여부` })).toHaveValue('pending');
    unmount();
    rawRender(<DelegatedReceiptsWorkspace initialClaims={[updated]} canWrite={false} />);
    fireEvent.click(screen.getByRole('button', { name: '엑셀형 · 4개씩' }));
    const grid = within(screen.getByRole('region', { name: '현장 4개씩 가로 목록' }));
    expect(grid.queryByRole('textbox')).not.toBeInTheDocument();
    expect(grid.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(grid.getByText('입금 전')).toBeVisible();
  });
});

it('작업자와 별도 내역을 구분하고 현장 설정에서 선택 재계산한 값을 목록에 반영한다', async () => {
  const invoice = { ...base, id: 'invoice', entryKind: 'invoice' as const, workerName: '가상 계산서', receipts: [] };
  const directory = { teams: [], sites: [{ id: 's1', name: base.siteName }] };
  const tax = { list: jest.fn(), save: jest.fn().mockResolvedValue({ setting: { key: '["id","s1"]', name: base.siteName, taxRate: 3.3, revision: 1, operationId: 'tax-op', updatedAt: base.updatedAt }, claims: [{ ...invoice, taxRate: 3.3, expectedAmount: 96700, taxAmount: 3300 }] }) };
  render(<DelegatedReceiptsWorkspace initialClaims={[base, invoice]} initialDirectory={directory} taxService={tax} />);
  expect(screen.getByRole('button', { name: base.siteName + ' 현장' })).toHaveTextContent('1명 · 별도 1건');
  expect(screen.getByText('바이백·계산서')).toBeVisible();
  expect(screen.getByRole('combobox', { name: '가상 계산서 받는 계좌' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: base.siteName + ' 현장 설정' }));
  fireEvent.change(screen.getByRole('textbox', { name: '현장 기본 세율' }), { target: { value: '3.3' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '가상 계산서 세율 재계산' }));
  fireEvent.click(screen.getByRole('button', { name: '세율 저장 · 1건 재계산' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(tax.save).toHaveBeenCalledWith(expect.objectContaining({ selected: [{ id: 'invoice', updatedAt: base.updatedAt }] }));
  expect(screen.getByRole('region', { name: '입금 요약' })).toHaveTextContent('196,700원');
  fireEvent.click(screen.getByRole('button', { name: '직접 추가' }));
  fireEvent.change(screen.getByRole('combobox', { name: '추가할 현장' }), { target: { value: 's1' } });
  fireEvent.click(screen.getByRole('button', { name: '계산서 직접 입력' }));
  expect(screen.getByRole('textbox', { name: '1행 세율' })).toHaveValue('3.3');
});

it('작업자 이름은 펼치기 없이 표시하고 현장 접기에도 입금 항목의 수정 초안을 유지한다', () => {
  const directory = { teams: [{ id: 't1', name: '가상팀', color: '#336699' }], sites: [{ id: 's1', name: base.siteName, responsibleTeamId: 't1' }] };
  rawRender(<DelegatedReceiptsWorkspace initialClaims={fixtures} initialDirectory={directory} />);
  fireEvent.click(screen.getByRole('button', { name: '기본 목록' }));
  const ledger = within(screen.getByRole('region', { name: '현장별 작업자 내역' }));
  const site = ledger.getByRole('button', { name: base.siteName + ' 현장' });
  expect(site).toHaveAttribute('aria-expanded', 'false');
  expect(ledger.queryByRole('article')).not.toBeInTheDocument();
  fireEvent.click(site);
  const worker = ledger.getByText(base.workerName);
  expect(ledger.queryByRole('button', { name: base.workerName + ' 작업자' })).not.toBeInTheDocument();
  const amount = ledger.getByRole('textbox', { name: base.workerName + ' 세전 금액' });
  expect(amount).toBeVisible();
  ['입금방법', '받는 계좌', '입금여부'].forEach(field => expect(ledger.getByRole('combobox', { name: `${base.workerName} ${field}` })).toBeVisible());
  fireEvent.change(amount, { target: { value: '250000' } });
  fireEvent.click(worker);
  expect(amount).toBeVisible();
  expect(ledger.queryByText(/기록된 입금액|받을 예정/)).not.toBeInTheDocument();
  fireEvent.click(site); fireEvent.click(site);
  expect(amount).toHaveValue('250000');
  expect(amount).toBeVisible();
  expect(ledger.getByRole('region', { name: base.siteName + ' 내역' })).toHaveStyle({ '--dr-group-color': '#336699' });
  fireEvent.click(screen.getByRole('button', { name: '모두 접기' }));
  expect(site).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: '현장 모두 펼치기' }));
  expect(site).toHaveAttribute('aria-expanded', 'true');
});

it('메모는 버튼으로 표시하고 누르면 넓은 스티커 편집창에서 확인한다', () => {
  render(<DelegatedReceiptsWorkspace initialClaims={[{ ...base, memo: '확인한 메모' }]} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('확인한 메모')).not.toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: base.workerName + ' 메모 있음' });
  expect(toggle).not.toHaveTextContent(/메모/);
  expect(toggle).toHaveClass('dr-memo-icon', 'dr-memo-toggle');
  fireEvent.click(toggle);
  const dialog = screen.getByRole('dialog', { name: base.workerName + ' 메모' });
  expect(dialog).toHaveTextContent('확인한 메모');
  expect(dialog).toHaveTextContent(base.siteName);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

describe('노무 입금 확인 화면', () => {
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
    const table = screen.getByRole('region', { name: '현장별 작업자 내역' });
    expect(within(table).getByText('검증작업자 가')).toBeInTheDocument();
    expect(within(table).getByText('검증작업자 나')).toBeInTheDocument();
    expect(within(table).getByText('검증작업자 다')).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: '입금 요약' });
    expect(summary).toHaveTextContent('40,000원');
    expect(summary).toHaveTextContent('입금여부 확인 필요2건');
    fireEvent.click(within(screen.getByRole('region', { name: '입금 내역 필터' })).getByLabelText('입금방법', { exact: true })); fireEvent.click(screen.getByRole('option', { name: '직불' }));
    expect(within(table).queryByText('검증작업자 가')).not.toBeInTheDocument();
    expect(within(table).getByText('검증작업자 나')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('작업자 검색'), { target: { value: '없는이름' } });
    expect(screen.getByText('선택한 조건의 내역이 없습니다')).toBeInTheDocument();
  });

  it('작업자 목록을 먼저 보여주고 현장 요약에서 선택하면 해당 작업자 목록으로 돌아온다', () => {
    render(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
    expect(screen.getByRole('region', { name: '현장별 작업자 내역' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '현장별 집계' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '자료 관리' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '현장별 요약' }));
    const sites = screen.getByRole('region', { name: '현장별 집계' });
    fireEvent.click(within(sites).getByRole('button', { name: /가상현장 B/ }));
    expect(screen.queryByRole('region', { name: '현장별 집계' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '현장' })).toHaveTextContent('가상현장 B');
    expect(within(screen.getByRole('region', { name: '현장별 작업자 내역' })).getByText('검증작업자 나')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '현장별 작업자 내역' })).queryByText('검증작업자 가')).not.toBeInTheDocument();
  });

  it('모든 필터를 바로 보여주고 조건 초기화와 검색어 지우기를 지원한다', () => {
    render(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
    expect(screen.queryByRole('button', { name: /상세 필터/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '입금 내역 필터' })).getByLabelText('받는 계좌', { exact: true })).toBeVisible();
    expect(within(screen.getByRole('region', { name: '입금 내역 필터' })).getByLabelText('담당 팀', { exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '확인 필요' }));
    expect(within(screen.getByRole('region', { name: '현장별 작업자 내역' })).getByText('검증작업자 다')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '현장별 작업자 내역' })).queryByText('검증작업자 가')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('region', { name: '입금 내역 필터' })).getByLabelText('받는 계좌', { exact: true })); fireEvent.click(screen.getByRole('option', { name: '개인통장' }));
    fireEvent.click(within(screen.getByRole('region', { name: '입금 내역 필터' })).getByRole('button', { name: /필터 초기화/ }));
    fireEvent.click(screen.getByRole('button', { name: '현장 모두 펼치기' }));
    expect(within(screen.getByRole('region', { name: '현장별 작업자 내역' })).getAllByRole('article')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('작업자 검색'), { target: { value: '검증작업자 가' } });
    expect(within(screen.getByRole('region', { name: '현장별 작업자 내역' })).getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '작업자 검색 지우기' }));
    expect(within(screen.getByRole('region', { name: '현장별 작업자 내역' })).getAllByRole('article')).toHaveLength(3);
  });

  it('월 화살표로 이동하면 이전 달의 현장 필터를 해제한다', async () => {
    const next = { ...base, id: 'next-month', month: '2026-10', siteName: '다음 달 현장', workerName: '다음 달 작업자' };
    (delegatedReceiptService.list as jest.Mock).mockResolvedValue([next]);
    render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
    fireEvent.click(screen.getByRole('button', { name: '현장' }));
    fireEvent.click(screen.getByRole('option', { name: base.siteName }));
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    fireEvent.click(await screen.findByRole('button', { name: next.siteName + ' 현장' }));
    expect(screen.getByText(next.workerName)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '현장' })).toHaveTextContent('전체 현장');
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
    fireEvent.click(within(dialog).getByRole('combobox', { name: '미확인 입금방법 설정' }));
    fireEvent.click(screen.getByRole('option', { name: '위임' }));
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
    expect(within(screen.getByRole('region', { name: '현장별 작업자 내역' })).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '현장별 작업자 내역' })).queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '자료 관리' }));
    expect(screen.queryByRole('button', { name: '직접 추가' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '엑셀 가져오기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /입금 및 내역|내역 보기/ })).not.toBeInTheDocument();
  });
});

it('원본 공동 완료를 금액 미설정이어도 표시하고 계좌 수단은 노출하지 않는다', () => {
  render(<DelegatedReceiptsWorkspace initialClaims={[{ ...base, expectedAmount: null, receipts: [], sourceStatus: '그룹 표시 G11:G15: 이재욱 위임 입금 완료 (개별 확인 필요)' }]} />);
  const table = screen.getByRole('region', { name: '현장별 작업자 내역' });
  expect(within(table).getByRole('combobox', { name: '검증작업자 가 입금여부' })).toHaveValue('complete');
  expect(within(table).getByText(/이재욱 위임/)).toBeInTheDocument();
  expect(within(table).queryByText(/엑셀 공동 표시|금액 미기록/)).not.toBeInTheDocument();
  expect(screen.queryByText(/수령수단/)).not.toBeInTheDocument();
});
it('현장 전체 선택은 접힌 상태에서도 동작하고 일부 선택 상태를 표시한다', () => {
  rawRender(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
  fireEvent.click(screen.getByRole('button', { name: '기본 목록' }));
  const site = screen.getByRole('checkbox', { name: base.siteName + ' 현장 전체 선택' });
  fireEvent.click(site);
  expect(site).toBeChecked();
  expect(screen.getByText('2건 선택')).toBeVisible();
  expect(screen.getByRole('button', { name: base.siteName + ' 현장' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: base.siteName + ' 현장' }));
  fireEvent.click(screen.getByRole('checkbox', { name: base.workerName + ' 선택' }));
  expect(site).toBePartiallyChecked();
  expect(screen.getByRole('checkbox', { name: '현재 목록 선택' })).toBePartiallyChecked();
  fireEvent.click(site);
  expect(site).toBeChecked();
  fireEvent.click(site);
  expect(screen.queryByText('2건 선택')).not.toBeInTheDocument();
});
it('현장 선택은 검색된 작업자만 선택한다', () => {
  render(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
  fireEvent.change(screen.getByRole('textbox', { name: '작업자 검색' }), { target: { value: base.workerName } });
  fireEvent.click(screen.getByRole('checkbox', { name: base.siteName + ' 현장 전체 선택' }));
  expect(screen.getByText('1건 선택')).toBeVisible();
});
it('현장 전체 선택이 400건을 넘으면 일부만 선택하지 않고 안내한다', () => {
  const rows = Array.from({ length: 401 }, (_, index) => ({ ...base, id: `limit-${index}`, workerName: `검증 ${index}` }));
  rawRender(<DelegatedReceiptsWorkspace initialClaims={rows} />);
  fireEvent.click(screen.getByRole('checkbox', { name: base.siteName + ' 현장 전체 선택' }));
  expect(screen.getByRole('alert')).toHaveTextContent('최대 400건');
  expect(screen.getByRole('checkbox', { name: base.siteName + ' 현장 전체 선택' })).not.toBeChecked();
  expect(screen.queryByRole('button', { name: '선택 내역 일괄 수정' })).not.toBeInTheDocument();
});
it('일괄 수정은 변경한 항목만 저장하고 실패 시 같은 식별자로 재시도한다', async () => {
  (delegatedReceiptService.updateListFields as jest.Mock).mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
  (delegatedReceiptService.list as jest.Mock).mockResolvedValue(fixtures);
  render(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
  fireEvent.click(screen.getByRole('checkbox', { name: '현재 목록 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '선택 내역 일괄 수정' }));
  const dialog = screen.getByRole('dialog');
  const save = within(dialog).getByRole('button', { name: '3건 일괄 수정' });
  expect(save).toBeDisabled();
  fireEvent.change(within(dialog).getByRole('combobox', { name: '입금여부' }), { target: { value: 'complete' } });
  fireEvent.click(save);
  await within(dialog).findByRole('alert');
  expect(delegatedReceiptService.updateListFields).toHaveBeenCalledWith(fixtures.map(row => row.id), [expect.objectContaining({ change: { field: 'status', value: 'complete' } })]);
  const first = (delegatedReceiptService.updateListFields as jest.Mock).mock.calls[0];
  fireEvent.click(save);
  await screen.findByText('3건을 일괄 수정했습니다.');
  expect((delegatedReceiptService.updateListFields as jest.Mock).mock.calls[1]).toEqual(first);
  expect(document.body.style.overflow).not.toBe('hidden');
});
it('입금방법 받는 계좌 입금여부를 한 번에 전달한다', async () => {
  (delegatedReceiptService.updateListFields as jest.Mock).mockResolvedValue(undefined);
  (delegatedReceiptService.list as jest.Mock).mockResolvedValue(fixtures);
  render(<DelegatedReceiptsWorkspace initialClaims={fixtures} />);
  fireEvent.click(screen.getByRole('checkbox', { name: base.siteName + ' 현장 전체 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '선택 내역 일괄 수정' }));
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.click(dialog.getByRole('combobox', { name: '입금방법' })); fireEvent.click(screen.getByRole('option', { name: '직불' }));
  fireEvent.click(dialog.getByRole('combobox', { name: '받는 계좌' })); fireEvent.click(screen.getByRole('option', { name: '개인통장' }));
  fireEvent.change(dialog.getByRole('combobox', { name: '입금여부' }), { target: { value: 'complete' } });
  fireEvent.click(dialog.getByRole('button', { name: '2건 일괄 수정' }));
  await waitFor(() => expect(delegatedReceiptService.updateListFields).toHaveBeenCalledWith([fixtures[0].id, fixtures[2].id], [
    expect.objectContaining({ change: { field: 'delegation', value: 'direct' } }),
    expect.objectContaining({ change: { field: 'recipient', value: 'personal' } }),
    expect.objectContaining({ change: { field: 'status', value: 'complete' } }),
  ]));
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
  fireEvent.click(screen.getByRole('combobox', { name: '검증작업자 가 입금방법' })); fireEvent.click(screen.getByRole('option', { name: '직불' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: '검증작업자 가 입금방법' })).toHaveTextContent('직불'));
  fireEvent.click(screen.getByRole('combobox', { name: '검증작업자 가 받는 계좌' })); fireEvent.click(screen.getByRole('option', { name: '현장 담당 팀장계좌' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: '검증작업자 가 받는 계좌' })).toHaveTextContent('현장 담당 팀장계좌'));
  fireEvent.change(screen.getByRole('combobox', { name: '검증작업자 가 입금여부' }), { target: { value: 'complete' } });
  await waitFor(() => expect(screen.getByRole('combobox', { name: '검증작업자 가 입금여부' })).toHaveValue('complete'));
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
  const table = within(screen.getByRole('region', { name: '현장별 작업자 내역' }));
  const method = table.getByRole('combobox', { name: '검증작업자 가 입금방법' });
  fireEvent.click(method); fireEvent.click(screen.getByRole('option', { name: '직불' }));
  await table.findByText('저장 확인 실패');
  expect(method).toBeDisabled();
  expect(screen.getByRole('combobox', { name: '검증작업자 가 입금방법' })).toHaveTextContent('직불');
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 목록 변경 다시 저장' }));
  await table.findByText('저장됨');
  expect(method).toBeEnabled();
  const calls = (delegatedReceiptService.updateListField as jest.Mock).mock.calls;
  expect(calls[1]).toEqual(calls[0]);
});

it('세전 금액은 입력 후 저장하며 잘못된 금액은 거부하고 0원을 허용한다', async () => {
  (delegatedReceiptService.updateListField as jest.Mock).mockResolvedValue({ ...base, grossAmount: 0, originalGrossAmount: base.grossAmount });
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  const table = within(screen.getByRole('region', { name: '현장별 작업자 내역' }));
  const input = table.getByRole('textbox', { name: '검증작업자 가 세전 금액' });
  fireEvent.change(input, { target: { value: '1.5' } });
  expect(table.getByRole('button', { name: '검증작업자 가 세전 금액 저장' })).toBeDisabled();
  expect(delegatedReceiptService.updateListField).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '0' } });
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 세전 금액 저장' }));
  await table.findByText('저장됨');
  expect(delegatedReceiptService.updateListField).toHaveBeenCalledWith(base.id, expect.objectContaining({ change: { field: 'grossAmount', value: 0 } }));
  expect(input).toHaveValue('0');
  expect(screen.getByRole('textbox', { name: '검증작업자 가 세전 금액' })).toHaveValue('0');
  expect(screen.getByRole('region', { name: '입금 요약' })).toHaveTextContent('40,000원');
});

it('모바일 세전 금액은 취소할 수 있고 비우면 미확정으로 저장한다', async () => {
  (delegatedReceiptService.updateListField as jest.Mock).mockResolvedValue({ ...base, grossAmount: null, originalGrossAmount: base.grossAmount });
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  const input = screen.getByRole('textbox', { name: '검증작업자 가 세전 금액' });
  fireEvent.change(input, { target: { value: '120,000' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(input).toHaveValue('100,000');
  expect(delegatedReceiptService.updateListField).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '검증작업자 가 세전 금액 저장' }));
  await waitFor(() => expect(delegatedReceiptService.updateListField).toHaveBeenCalledWith(base.id, expect.objectContaining({ change: { field: 'grossAmount', value: null } })));
  await waitFor(() => expect(input).toBeEnabled());
  expect(input).toHaveValue('');
});

it('메모를 저장·수정·삭제하고 실패 시 초안을 유지하며 같은 요청으로 다시 저장한다', async () => {
  let saved = { ...base };
  (delegatedReceiptService.updateListField as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockImplementation(async (_id, edit) => { saved = { ...saved, memo: edit.change.value }; return saved; });
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  fireEvent.click(screen.getByRole('button', { name: base.workerName + ' 새 메모' }));
  const dialog = within(screen.getByRole('dialog'));
  const input = dialog.getByRole('textbox');
  fireEvent.change(input, { target: { value: '보존할 메모' } });
  fireEvent.click(dialog.getByRole('button', { name: '메모 저장' }));
  await dialog.findByRole('alert');
  expect(input).toHaveValue('보존할 메모');
  fireEvent.click(dialog.getByRole('button', { name: '메모 저장' }));
  await dialog.findByText('저장되었습니다');
  const calls = (delegatedReceiptService.updateListField as jest.Mock).mock.calls;
  expect(calls[1][1].id).toBe(calls[0][1].id);
  fireEvent.click(dialog.getByRole('button', { name: base.workerName + ' 메모 수정' }));
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: '수정한 메모' } });
  fireEvent.keyDown(dialog.getByRole('textbox'), { key: 'Enter', ctrlKey: true });
  await dialog.findByText('수정한 메모');
  fireEvent.click(dialog.getByRole('button', { name: base.workerName + ' 메모 삭제' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: base.workerName + ' 새 메모' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: base.workerName + ' 세전 금액' })).toHaveValue('100,000');
});

it('한글 조합 중 저장 단축키를 무시하고 저장하지 않은 초안을 닫기 전에 보호한다', async () => {
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  fireEvent.click(screen.getByRole('button', { name: base.workerName + ' 새 메모' }));
  const dialog = within(screen.getByRole('dialog'));
  const input = dialog.getByRole('textbox');
  fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: '한글 작성' } });
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
  expect(delegatedReceiptService.updateListField).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  fireEvent.click(dialog.getByRole('button', { name: '메모 닫기' }));
  expect(dialog.getByText('아직 저장하지 않은 내용이 있습니다.')).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: '계속 작성' }));
  expect(input).toHaveValue('한글 작성');
  fireEvent.click(dialog.getByRole('button', { name: '메모 닫기' }));
  fireEvent.click(dialog.getByRole('button', { name: '변경 버리고 닫기' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('현장 메모는 월·현장 단위로 저장하고 작업자 메모나 금액을 변경하지 않는다', async () => {
  (siteMemoService.list as jest.Mock).mockResolvedValue([]);
  (siteMemoService.save as jest.Mock).mockImplementation(async (target, memo, revision, operationId) => ({ ...target, memo, revision: revision + 1, operationId, updatedAt: '' }));
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  const button = screen.getByRole('button', { name: base.siteName + ' 현장 새 메모' });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: '현장 전체 공지' } });
  fireEvent.click(dialog.getByRole('button', { name: '메모 저장' }));
  await dialog.findByText('저장되었습니다');
  expect(siteMemoService.save).toHaveBeenCalledWith(expect.objectContaining({ month: base.month, name: base.siteName }), '현장 전체 공지', 0, expect.any(String));
  expect(delegatedReceiptService.updateListField).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole('button', { name: '메모 닫기' }));
  fireEvent.click(screen.getByRole('button', { name: base.siteName + ' 현장 메모 있음' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('현장 전체 공지');
  fireEvent.click(screen.getByRole('button', { name: base.siteName + ' 현장 메모 삭제' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: base.siteName + ' 현장 새 메모' })).toBeEnabled();
});

it('현장 메모 조회에 실패하면 덮어쓰기를 막고 재조회한 메모와 버전으로 수정한다', async () => {
  const stored = { key: JSON.stringify([base.month, 'name', base.siteName.replace(/\s+/g, '').toLowerCase()]), month: base.month, name: base.siteName, memo: '기존 현장 메모', revision: 3, operationId: 'previous', updatedAt: '' };
  (siteMemoService.list as jest.Mock).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([stored]);
  (siteMemoService.save as jest.Mock).mockImplementation(async (target, memo, revision, operationId) => ({ ...target, memo, revision: revision + 1, operationId, updatedAt: '' }));
  render(<DelegatedReceiptsWorkspace initialClaims={[base]} />);
  await screen.findByText('현장 메모를 불러오지 못했습니다.');
  expect(screen.getByRole('button', { name: base.siteName + ' 현장 새 메모' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '현장 메모 다시 조회' }));
  const button = await screen.findByRole('button', { name: base.siteName + ' 현장 메모 있음' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('기존 현장 메모')).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: base.siteName + ' 현장 메모 수정' }));
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: '수정한 현장 메모' } });
  fireEvent.click(dialog.getByRole('button', { name: '메모 저장' }));
  await dialog.findByText('저장되었습니다');
  expect(siteMemoService.save).toHaveBeenCalledWith(expect.objectContaining({ key: stored.key }), '수정한 현장 메모', 3, expect.any(String));
});

it('메모 타이핑은 작업자 목록을 다시 그리지 않고 금액 입력은 해당 작업자만 그린다', () => {
  const colorSpy = jest.spyOn(teamDirectory, 'getWorkerColor');
  render(<DelegatedReceiptsWorkspace initialClaims={Array.from({ length: 40 }, (_, index) => ({ ...base, id: 'perf-' + index, workerName: '작업자 ' + index }))} />);
  colorSpy.mockClear();
  fireEvent.change(screen.getByRole('textbox', { name: '작업자 0 세전 금액' }), { target: { value: '1234' } });
  expect(colorSpy).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '작업자 0 새 메모' })); colorSpy.mockClear();
  const input = within(screen.getByRole('dialog')).getByRole('textbox');
  ['한', '한글', '한글 입력'].forEach(value => fireEvent.change(input, { target: { value } }));
  expect(colorSpy).not.toHaveBeenCalled();
  colorSpy.mockRestore();
});

it('읽기 전용에서도 메모를 볼 수 있지만 수정이나 삭제는 노출하지 않는다', () => {
  render(<DelegatedReceiptsWorkspace initialClaims={[{ ...base, memo: '기존 메모' }]} canWrite={false} />);
  fireEvent.click(screen.getByRole('button', { name: base.workerName + ' 메모 있음' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('기존 메모');
  expect(screen.queryByRole('button', { name: /새 메모|메모 (수정|삭제)/ })).not.toBeInTheDocument();
});

it('목록은 세전 입력창만 표시하고 수정 후 PC·모바일과 현장·상단 합계를 갱신한다', async () => {
  const taxable = { ...base, grossAmount: 100000, expectedAmount: 96700, taxRate: 3.3, taxAmount: 3300 };
  (delegatedReceiptService.updateListField as jest.Mock).mockResolvedValue({ ...taxable, grossAmount: 200000, expectedAmount: 193400, taxAmount: 6600, originalGrossAmount: 100000 });
  render(<DelegatedReceiptsWorkspace initialClaims={[taxable]} />);
  const table = within(screen.getByRole('region', { name: '현장별 작업자 내역' }));
  const gross = table.getByRole('textbox', { name: '검증작업자 가 세전 금액' });
  expect(gross).toHaveValue('100,000');
  expect(screen.queryByRole('textbox', { name: /받을 예정 금액/ })).not.toBeInTheDocument();
  fireEvent.change(gross, { target: { value: '-1' } });
  expect(table.getByRole('button', { name: '검증작업자 가 세전 금액 저장' })).toBeDisabled();
  fireEvent.keyDown(gross, { key: 'Escape' });
  expect(gross).toHaveValue('100,000');
  fireEvent.change(gross, { target: { value: '200,000' } });
  expect(screen.getByRole('textbox', { name: '검증작업자 가 세전 금액' })).toHaveValue('200,000');
  fireEvent.click(table.getByRole('button', { name: '검증작업자 가 세전 금액 저장' }));
  await table.findByText('저장됨');
  expect(delegatedReceiptService.updateListField).toHaveBeenCalledWith(base.id, expect.objectContaining({ change: { field: 'grossAmount', value: 200000 } }));
  expect(gross).toHaveValue('200,000');
  expect(screen.getByRole('textbox', { name: '검증작업자 가 세전 금액' })).toHaveValue('200,000');
  expect(table.getByRole('region', { name: `${base.siteName} 내역` })).toHaveTextContent('세전 합계 200,000원');
  expect(screen.getByRole('article', { name: '조회 금액 현황' })).toHaveTextContent('200,000원');
  expect(screen.getByRole('article', { name: '조회 금액 현황' })).toHaveTextContent('193,400원');
  expect(screen.getByRole('article', { name: '조회 금액 현황' })).toHaveTextContent('40,000원');
});

it('상태별 세전·예정 합계를 표시하고 필터 변경과 미확정 금액을 정확히 반영한다', () => {
  render(<DelegatedReceiptsWorkspace initialClaims={[
    { ...base, receipts: [], sourceStatus: '입금완료', expectedAmount: 90000 },
    { ...base, id: 'pending', workerName: '대기 작업자', grossAmount: 200000, expectedAmount: 180000, receipts: [], sourceStatus: '입금 전' },
    { ...base, id: 'unknown', workerName: '확인 작업자', grossAmount: null, expectedAmount: null, receipts: [], sourceStatus: '개인통장' },
  ]} />);
  const complete = screen.getByRole('article', { name: '입금완료 현황' });
  expect(complete).toHaveTextContent('100,000원');
  expect(complete).toHaveTextContent('90,000원');
  const pending = screen.getByRole('article', { name: '입금 전·일부 현황' });
  expect(pending).toHaveTextContent('200,000원');
  expect(pending).toHaveTextContent('180,000원');
  expect(screen.getByRole('article', { name: '확인 필요 현황' })).toHaveTextContent('미확정');
  const total = screen.getByRole('article', { name: '조회 금액 현황' });
  expect(total).toHaveTextContent('300,000원');
  expect(total).toHaveTextContent('270,000원');
  expect(total).toHaveTextContent('미확정 1건 제외');
  expect(total).toHaveTextContent('미기록');
  fireEvent.change(screen.getByLabelText('작업자 검색'), { target: { value: '대기 작업자' } });
  expect(total).toHaveTextContent('200,000원');
  expect(total).not.toHaveTextContent('300,000원');
  const recipient = within(screen.getByRole('region', { name: '현장별 작업자 내역' })).getByRole('combobox', { name: '대기 작업자 받는 계좌' });
  fireEvent.click(recipient);
  expect(screen.getByRole('option', { name: '개인통장' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '작업자 개인통장' })).not.toBeInTheDocument();
});

it('현장과 팀 선택은 담당 팀 색상으로 표시하고 검색·키보드 선택·초기화를 지원한다', () => {
  const directory = { teams: [{ id: 'team-a', name: '검증 청색팀', color: '#0070C0' }, { id: 'team-b', name: '검증 보라팀', color: '#7030A0' }], sites: [{ id: 'site-a', name: base.siteName, responsibleTeamId: 'team-a' }, { id: 'site-b', name: fixtures[1].siteName, responsibleTeamId: 'team-b' }] };
  render(<DelegatedReceiptsWorkspace initialClaims={fixtures} initialDirectory={directory} />);
  const team = screen.getByRole('button', { name: '담당 팀' });
  fireEvent.click(team);
  const search = screen.getByRole('combobox', { name: '담당 팀 검색' });
  expect(search).toHaveFocus();
  fireEvent.change(search, { target: { value: '청색' } });
  expect(within(screen.getByRole('listbox', { name: '담당 팀 목록' })).getAllByRole('option')).toHaveLength(1);
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(team).toHaveFocus();
  expect(team).toHaveTextContent('검증 청색팀');
  expect(screen.getByRole('region', { name: '현장별 작업자 내역' })).not.toHaveTextContent(fixtures[1].workerName);
  fireEvent.click(screen.getByRole('button', { name: /필터 초기화/ }));
  const site = screen.getByRole('button', { name: '현장' });
  fireEvent.keyDown(site, { key: 'ArrowDown' });
  const siteSearch = screen.getByRole('combobox', { name: '현장 검색' });
  fireEvent.change(siteSearch, { target: { value: '없는 현장' } });
  expect(screen.getByText('검색 결과가 없습니다.')).toBeVisible();
  fireEvent.keyDown(siteSearch, { key: 'Escape' });
  expect(site).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(site);
  fireEvent.click(screen.getByRole('option', { name: fixtures[1].siteName }));
  expect(site).toHaveTextContent(fixtures[1].siteName);
});

it('직접 추가에서 현장·작업자를 골라 여러 행을 등록한 후 선택한 월을 조회한다', async () => {
  (delegatedReceiptService.createClaims as jest.Mock).mockResolvedValue({ added: 2, skipped: 0 });
  (delegatedReceiptService.list as jest.Mock).mockResolvedValue([]);
  render(<DelegatedReceiptsWorkspace initialClaims={fixtures} initialDirectory={{ teams: [{ id: 't1', name: '청연 소속 팀', isCheongyeon: true }], sites: [{ id: 's1', name: '선택 현장' }], workers: [{ id: 'w1', name: '선택 가', teamId: 't1' }, { id: 'w2', name: '선택 나', teamId: 't1' }] }} />);
  fireEvent.click(screen.getByRole('button', { name: '직접 추가' }));
  const dialog = screen.getByRole('dialog', { name: '직접 추가 · 일괄 등록' });
  fireEvent.change(within(dialog).getByLabelText('등록 귀속월'), { target: { value: '2026-11' } });
  fireEvent.change(within(dialog).getByRole('combobox', { name: '추가할 현장' }), { target: { value: 's1' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '검색 결과 전체 추가' }));
  fireEvent.click(within(dialog).getByRole('button', { name: '2행 한 번에 등록' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(delegatedReceiptService.createClaims).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ month: '2026-11', siteId: 's1', workerId: 'w1' }), expect.objectContaining({ month: '2026-11', workerId: 'w2' })]));
  await waitFor(() => expect(delegatedReceiptService.list).toHaveBeenCalledWith('2026-11'));
});
