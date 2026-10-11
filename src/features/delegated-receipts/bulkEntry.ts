import { calculateExpectedAmount, DelegatedClaim, DelegationType, DepositStatus, RecipientKind } from './model';
import type { ReceiptDirectory } from './teamDirectory';

export interface BulkEntryRow {
  id: string; siteId: string; workerId: string; gross: string; expected: string; taxRate: string;
  delegation: DelegationType; recipient: RecipientKind; status: DepositStatus; memo: string;
}
export const newEntryId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function parseEntryMoney(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) throw new Error('금액은 0원 이상의 정수로 입력해 주세요.');
  const amount = Number(text.replace(/,/g, ''));
  if (!Number.isSafeInteger(amount)) throw new Error('금액이 허용 범위를 넘었습니다.');
  return amount;
}
export function entryAmounts(row: BulkEntryRow) {
  const grossAmount = parseEntryMoney(row.gross);
  if (!row.taxRate.trim()) return { grossAmount, expectedAmount: parseEntryMoney(row.expected), taxRate: null, taxAmount: null };
  if (!/^\d+(?:\.\d+)?$/.test(row.taxRate.trim())) throw new Error('세율은 0~100%로 입력해 주세요.');
  const taxRate = Number(row.taxRate);
  if (taxRate < 0 || taxRate > 100) throw new Error('세율은 0~100%로 입력해 주세요.');
  return { grossAmount, taxRate, ...(grossAmount === null ? { expectedAmount: null, taxAmount: null } : calculateExpectedAmount(grossAmount, taxRate)) };
}
export function pasteEntryAmounts(rows: BulkEntryRow[], start: number, field: 'gross' | 'expected', text: string): BulkEntryRow[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(line => line.split('\t'));
  if (start + lines.length > rows.length) throw new Error('붙여넣을 행이 부족합니다. 먼저 작업자를 추가해 주세요.');
  const columns = field === 'gross' ? 2 : 1;
  if (lines.some(line => line.length > columns)) throw new Error(field === 'gross' ? '세전·받을 예정 금액 2열까지만 붙여넣을 수 있습니다.' : '받을 예정 금액 1열만 붙여넣어 주세요.');
  lines.forEach(line => line.forEach(value => parseEntryMoney(value)));
  return rows.map((row, index) => {
    const cells = lines[index - start];
    if (!cells) return row;
    return field === 'expected' ? { ...row, expected: cells[0].trim(), taxRate: '' }
      : { ...row, gross: cells[0].trim(), ...(cells.length === 2 ? { expected: cells[1].trim(), taxRate: '' } : {}) };
  });
}
export function buildBulkClaims(rows: BulkEntryRow[], month: string, directory: ReceiptDirectory, batchId: string, recordedAt: string): DelegatedClaim[] {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('귀속월을 확인해 주세요.');
  if (!rows.length || rows.length > 100) throw new Error('한 번에 1~100행을 등록해 주세요.');
  const identities = new Set<string>();
  return rows.map((row, index) => {
    try {
      const site = directory.sites.find(site => site.id === row.siteId);
      const worker = directory.workers?.find(worker => worker.id === row.workerId);
      if (!site || !worker) throw new Error('등록된 현장과 작업자를 선택해 주세요.');
      const identity = JSON.stringify([site.id, worker.id]);
      if (identities.has(identity)) throw new Error('같은 현장의 작업자가 중복되었습니다. 행을 합치거나 현장을 변경해 주세요.');
      identities.add(identity);
      if (row.memo.length > 2000) throw new Error('메모는 2,000자까지 입력할 수 있습니다.');
      const confirmation = { id: `${row.id}-initial`, recordedAt, status: row.status, recipient: row.recipient, note: '직접 일괄 등록' };
      return { id: row.id, manualBatchId: batchId, month, siteId: site.id, siteName: site.name, workerId: worker.id, workerName: worker.name,
        delegationType: row.delegation, paymentMethod: 'transfer', ...entryAmounts(row), receipts: [], sourceStatus: '', sourceLabel: '직접 일괄 입력',
        confirmation, confirmationHistory: [confirmation], memo: row.memo.trim(), updatedAt: recordedAt };
    } catch (error) { throw new Error(`${index + 1}행: ${error instanceof Error ? error.message : '입력값을 확인해 주세요.'}`); }
  });
}
