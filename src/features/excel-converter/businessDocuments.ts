import { blankMapping, ConversionPlan, DataRow, DataTable, Field, Scalar, SheetInfo, WorkbookFile } from './types';
import { columnName, columnNumber, extractTable, normalizeLabel } from './workbook';
import { createPlan, suggestMapping } from './planning';
import { decimalSum, numberValue } from './transform';
import { createTwoRowLaborPlan, readTwoRowLabor } from './laborTwoRow';

export type DocumentKind = 'delegation' | 'labor' | 'general';
export interface SourceDocument { kind: DocumentKind; label: string; table: DataTable; sheetName: string; headerRow: number; notes: string[] }
const normalize = (text: string) => normalizeLabel(text).replace(/[:：]/g, '');
const labels: Record<string, string[]> = {
  worker_name: ['성명', '이름', '작업자명', '근로자명', '위임인', '위임인성명'],
  resident_id: ['주민번호', '주민등록번호', '식별번호'],
  contact: ['전화번호', '연락처', '휴대전화'], address: ['주소', '거주지', '현주소'],
  man_days: ['공수', '총공수', '출역', '출역공수', '총출역'], unit_price: ['단가', '노임단가', '일당'],
  gross_amount: ['금액', '노임금액', '노무비', '지급액', '총액', '보수총액', '지급총액'],
  billing_price: ['청구단가'], billing_amount: ['공급가액', '청구금액'],
  bank_name: ['은행', '은행명'], account_number: ['계좌번호', '입금계좌'], account_holder: ['예금주'], pay_type: ['지급구분'],
  site_name: ['현장명', '공사명'], month: ['대상월', '귀속월', '작업월'],
  trustee_name: ['수임인성명', '수임인'], trustee_contact: ['수임인연락처'], trustee_address: ['수임인주소'],
  trustee_bank: ['수임인은행'], trustee_account: ['수임인계좌', '수임인계좌번호'], trustee_holder: ['수임인예금주'],
};
const semanticLabels = new Map(Object.entries(labels).flatMap(([key, names]) => names.map(name => [normalize(name), key] as const)));
export const semanticKey = (label: string) => semanticLabels.get(normalize(label));
const valueAt = (sheet: SheetInfo, row: number, col: number): Scalar => sheet.cells.find(c => c.row === row && c.col === col)?.value ?? null;
const display = (value: Scalar) => value === null || value === '-' ? '' : String(value);
const nameFor = (key: string) => labels[key]?.[0] || key;
const field = (key: string, index: number): Field => ({ key, col: index + 1, label: nameFor(key), kind: /days|price|amount/.test(key) ? 'number' : 'text' });
function labelDestination(sheet: SheetInfo, cell: SheetInfo['cells'][number]): string | null {
  const merge = sheet.merges.find(m => m.split(':')[0] === cell.address);
  const end = merge?.split(':')[1]; const col = end ? columnNumber(end.replace(/\d/g, '')) + 1 : cell.col + 1;
  if (col > sheet.columnCount) return null;
  return `${columnName(col)}${cell.row}`;
}
function commonValues(sheet: SheetInfo, before: number): Record<string, Scalar> {
  const result: Record<string, Scalar> = {};
  for (const cell of sheet.cells.filter(c => c.row < before && typeof c.value === 'string')) {
    const key = semanticKey(String(cell.value)); if (!key || (!['site_name', 'month'].includes(key) && !key.startsWith('trustee_'))) continue;
    const address = labelDestination(sheet, cell); const value = sheet.cells.find(c => c.address === address)?.value;
    if (value !== undefined && value !== null && value !== '') result[key] = value;
  }
  return result;
}
export function readSourceDocument(file: WorkbookFile, selectedSheet = file.sheets[0]?.name): SourceDocument {
  const sheet = file.sheets.find(s => s.name === selectedSheet); if (!sheet) throw new Error('원본 시트를 찾을 수 없습니다.');
  // Existing SupportPaymentExcelGenerator: each worker occupies two rows.
  if (valueAt(sheet, 3, 2) === '성명' && valueAt(sheet, 3, 22) === '청구단가' && valueAt(sheet, 4, 22) === '공급가액' && valueAt(sheet, 4, 3) === '전화번호') {
    const keys = ['worker_name', 'resident_id', 'contact', 'address', 'man_days', 'billing_price', 'billing_amount', 'bank_name', 'account_holder', 'account_number', 'pay_type', 'site_name', ...Array.from({ length: 31 }, (_, i) => `day${i + 1}`)];
    const fields = keys.map(field).map(f => f.key.startsWith('day') ? { ...f, label: `${f.key.slice(3).padStart(2, '0')}일`, kind: 'number' as const } : f);
    const rows: DataRow[] = []; const warnings: string[] = []; const skipped: DataTable['skipped'] = [];
    for (let r = 5; r <= sheet.rowCount; r += 2) {
      const origin = `${file.name} / ${sheet.name} / ${r}~${r + 1}행`;
      if (/합계/.test(normalize(display(valueAt(sheet, r, 1))))) { skipped.push({ origin, reason: '합계 행' }); break; }
      if (!display(valueAt(sheet, r, 2))) continue;
      const account = display(valueAt(sheet, r, 24)).split('\n'); const parts = (account.slice(1).join(' ') || '').split(' / ');
      if (parts.length > 0 && parts.length !== 3 && account.length > 1) warnings.push(`${r}행의 계좌 정보를 은행·예금주·계좌번호로 나눌 수 없습니다.`);
      const values: Record<string, Scalar> = { worker_name: valueAt(sheet, r, 2), resident_id: valueAt(sheet, r, 3), contact: valueAt(sheet, r + 1, 3), address: valueAt(sheet, r, 4), man_days: valueAt(sheet, r, 21), billing_price: valueAt(sheet, r, 22), billing_amount: valueAt(sheet, r + 1, 22), bank_name: parts[0] || null, account_holder: parts[1] || null, account_number: parts[2] || null, pay_type: account[0] || null, site_name: display(valueAt(sheet, 2, 1)).replace(/^현장명\s*:\s*/, '') };
      for (let day = 1; day <= 31; day++) values[`day${day}`] = numberValue(valueAt(sheet, day <= 16 ? r : r + 1, 5 + (day <= 16 ? day - 1 : day - 17))) ?? 0;
      const total = decimalSum(Array.from({ length: 31 }, (_, i) => Number(values[`day${i + 1}`])));
      if (total !== numberValue(values.man_days)) warnings.push(`${r}행의 일별 공수 합계와 출역 공수가 다릅니다.`);
      rows.push({ id: `${file.id}:${r}`, values, origins: [origin] });
    }
    return { kind: 'labor', label: '현재 노임명세서 · 한 사람 두 줄', table: { fields, rows, warnings, skipped }, sheetName: sheet.name, headerRow: 3, notes: ['전화번호·일별 공수·청구단가·공급가액·계좌를 두 줄에서 함께 읽었습니다.'] };
  }
  const twoRow = readTwoRowLabor(file, sheet); if (twoRow) return twoRow;
  const candidateRows = new Map<number, number>();
  for (const c of sheet.cells) if (semanticKey(String(c.value ?? ''))) candidateRows.set(c.row, (candidateRows.get(c.row) || 0) + 1);
  const header = Array.from(candidateRows).filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] || sheet.headerRow;
  const table = extractTable(file, sheet.name, header);
  const common = commonValues(sheet, header);
  if (valueAt(sheet, 3, 1) === '수임인' && valueAt(sheet, 3, 2) === '주민등록번호') {
    Object.assign(common, { trustee_name: valueAt(sheet, 4, 1), trustee_address: valueAt(sheet, 3, 5), trustee_contact: valueAt(sheet, 4, 3), trustee_bank: valueAt(sheet, 8, 2), trustee_account: valueAt(sheet, 8, 4), trustee_holder: valueAt(sheet, 8, 7) });
  }
  const last = sheet.cells.find(c => c.row > header && /^(합계|총계|소계)$/.test(normalize(display(c.value))))?.row;
  if (last) table.rows = table.rows.filter(row => Number(row.id.split(':').pop()) < last);
  for (const [key, value] of Object.entries(common)) { table.fields.push(field(key, table.fields.length)); table.rows.forEach(row => { row.values[key] = value; }); }
  const title = sheet.cells.filter(c => c.row < header).map(c => display(c.value)).join('');
  const kind = /위임/.test(title) ? 'delegation' : /노임|노무비|급여/.test(title) ? 'labor' : 'general';
  return { kind, label: kind === 'delegation' ? '위임장 · 작업자 목록과 수임인 정보' : kind === 'labor' ? '노임명세서' : '일반 엑셀', table, sheetName: sheet.name, headerRow: header, notes: Object.keys(common).length ? ['현장·수임인 등 문서 공통 정보를 함께 읽었습니다.'] : [] };
}
export function businessMapping(label: string, col: number, fields: Field[]) {
  const mapping = suggestMapping(label, col, fields); const key = semanticKey(label);
  const matches = fields.filter(f => key && (f.key === key || semanticKey(f.label) === key));
  if (matches.length === 1) return { ...mapping, mode: 'copy' as const, sourceKeys: [matches[0].key], confirmed: true, format: /id|account|contact/.test(key || '') ? 'text' as const : 'keep' as const, reason: `${matches[0].label} 항목으로 연결했습니다.` };
  if (/^(번호|순번)$/.test(normalize(label))) { const match = fields.find(f => /^(번호|순번)$/.test(normalize(f.label))); if (match) return { ...mapping, mode: 'copy' as const, sourceKeys: [match.key], confirmed: true }; }
  if (/^(서명|날인|서명날인|서명또는인)$/.test(normalize(label))) return { ...blankMapping(label, col), confirmed: true, reason: '서명란은 비워 둡니다.' };
  return mapping;
}
export function createDocumentPlan(target: WorkbookFile, source: SourceDocument, sheetName = target.sheets[0].name): ConversionPlan {
  const sheet = target.sheets.find(s => s.name === sheetName)!;
  const twoRow = createTwoRowLaborPlan(target, source, sheet); if (twoRow) return twoRow;
  const hits = sheet.cells.filter(c => typeof c.value === 'string' && semanticKey(c.value));
  const hasTable = hits.some(c => hits.filter(other => other.row === c.row).length >= 3);
  let plan = createPlan(target, sheetName, source.table.fields);
  if (hasTable) {
    const header = hits.slice().sort((a, b) => hits.filter(c => c.row === b.row).length - hits.filter(c => c.row === a.row).length || a.row - b.row)[0].row;
    plan = createPlan(target, sheetName, source.table.fields, {}, header);
    plan.mappings = plan.mappings.map(m => {
      const mapped = businessMapping(m.label, m.targetColumn, source.table.fields);
      return m.reason.includes('수식') ? { ...m, verifyKey: mapped.sourceKeys[0] || '' } : mapped;
    });
  } else if (hits.length >= 3) { plan.headerRow = 1; plan.startRow = 2; plan.endRow = 2; plan.mappings = []; plan.overflow = 'files'; }
  for (const cell of hits.filter(c => !hasTable || c.row < plan.headerRow)) {
    const address = labelDestination(sheet, cell); if (!address) continue;
    const original = sheet.cells.find(c => c.address === address); if (original?.value !== null && original?.value !== undefined && !original.formula) continue;
    const mapping = businessMapping(String(cell.value), columnNumber(address.replace(/\d/g, '')), source.table.fields);
    if (original?.formula) { mapping.verifyKey = mapping.sourceKeys[0] || ''; mapping.mode = 'blank'; mapping.sourceKeys = []; mapping.confirmed = true; mapping.reason = '기존 수식과 원본 금액을 비교합니다.'; }
    plan.fixedCells.push({ address, mapping });
  }
  plan.summary = [hasTable ? '작업자별 내용을 표에 차례로 작성합니다.' : '작업자 한 명당 문서 한 개를 만듭니다.'];
  return plan;
}
export function documentTotals(table: DataTable): { people: number; manDays?: number; amount?: number; amountLabel?: string } {
  const find = (keys: string[]) => table.fields.find(f => keys.includes(f.key) || keys.includes(semanticKey(f.label) || ''));
  const sum = (f?: Field) => { const values = f ? table.rows.map(r => numberValue(r.values[f.key])) : []; return values.length && values.every(v => v !== null) ? decimalSum(values as number[]) : undefined; };
  const amount = find(['billing_amount', 'gross_amount']);
  return { people: table.rows.length, manDays: sum(find(['man_days'])), amount: sum(amount), amountLabel: amount?.label };
}
export function validateAutomaticPlan(base: ConversionPlan, proposed: ConversionPlan): void {
  if (base.headerRow !== proposed.headerRow || base.startRow !== proposed.startRow || base.endRow !== proposed.endRow) throw new Error('양식의 입력 범위가 임의로 바뀌었습니다. 기존 양식을 유지하도록 다시 분석해 주세요.');
  if (proposed.rules.filters.length || proposed.rules.groupBy.length || proposed.rules.sums.length) throw new Error('요청하지 않은 인원 제외·합산이 감지됐습니다. 원본 그대로 다시 분석해 주세요.');
  const check = (before: typeof base.mappings[number], after?: typeof base.mappings[number]) => {
    if (!before.confirmed || before.mode !== 'copy' || !before.sourceKeys.length) return;
    if (!after || after.mode !== 'copy' || JSON.stringify(after.sourceKeys) !== JSON.stringify(before.sourceKeys) || after.scale !== before.scale || after.decimals !== before.decimals) throw new Error(`${before.label}: 확인된 원본 연결이나 계산이 바뀌었습니다. 상세 설정에서 확인해 주세요.`);
  };
  base.mappings.forEach(m => check(m, proposed.mappings.find(p => p.targetColumn === m.targetColumn && (p.rowOffset || 0) === (m.rowOffset || 0))));
  base.fixedCells.forEach(f => check(f.mapping, proposed.fixedCells.find(p => p.address === f.address)?.mapping));
}
