import type { SourceDocument } from './businessDocuments';
import { blankMapping, ConversionPlan, DataRow, Field, planSchema, Scalar, SheetInfo, WorkbookFile } from './types';
import { decimalSum, numberValue } from './transform';
import { normalizeLabel } from './workbook';
import { mergeBounds } from './mergedLayout';

const valueAt = (sheet: SheetInfo, row: number, col: number): Scalar => sheet.cells.find(c => c.row === row && c.col === col)?.value ?? null;
const labelAt = (sheet: SheetInfo, row: number, col: number) => normalizeLabel(String(valueAt(sheet, row, col) ?? ''));
const dayAt = (sheet: SheetInfo, row: number, col: number) => Number(String(valueAt(sheet, row, col) ?? '').match(/^\s*(\d{1,2})(?:\D|$)/)?.[1]);
const basicFields: [string, string, number][] = [
  ['worker_name', '성명', 2], ['resident_id', '주민등록번호', 3], ['address', '주소', 4],
  ['man_days', '공수', 21], ['unit_price', '단가', 22], ['gross_amount', '총액', 23],
  ['bank_name', '은행', 24], ['account_holder', '예금주', 25], ['account_number', '계좌번호', 26], ['pay_type', '지급구분', 27],
];

// The original ledger splits days at 16/17; this is different from the
// recipient's 15/16 split. Detect structure, never a filename or a person's data.
export function readTwoRowLabor(file: WorkbookFile, sheet: SheetInfo): SourceDocument | undefined {
  const header = sheet.cells.find(c => c.col === 2 && labelAt(sheet, c.row, 2) === '성명' && labelAt(sheet, c.row, 22) === '단가' && labelAt(sheet, c.row, 23) === '총액' && labelAt(sheet, c.row + 1, 3) === '전화번호')?.row;
  if (!header || dayAt(sheet, header, 5) !== 1 || dayAt(sheet, header, 20) !== 16 || dayAt(sheet, header + 1, 5) !== 17 || dayAt(sheet, header + 1, 19) !== 31) return undefined;
  const common = sheet.cells.filter(c => c.row < header && typeof c.value === 'string').map(c => String(c.value));
  const period = common.find(s => /^기간\s*[:：]/.test(s));
  const dates = Array.from(period?.matchAll(/(\d{4})-(\d{2})-\d{2}/g) || []);
  if (!dates.length || dates.some(d => d[1] !== dates[0][1] || d[2] !== dates[0][2])) throw new Error('원본의 작업 기간이 한 달인지 확인해 주세요. 여러 달의 날짜를 한 달 양식에 합칠 수 없습니다.');
  const site = common.find(s => /^현장명\s*[:：]/.test(s))?.replace(/^현장명\s*[:：]\s*/, '') || null;
  const fields: Field[] = [...basicFields.map(([key, label, col]) => ({ key, label, col, kind: ['man_days', 'unit_price', 'gross_amount'].includes(key) ? 'number' as const : 'text' as const })),
    ...[['contact', '전화번호'], ['site_name', '현장명'], ['year', '연도'], ['month_number', '월']].map(([key, label], i) => ({ key, label, col: 28 + i, kind: key === 'year' || key === 'month_number' ? 'number' as const : 'text' as const })),
    ...Array.from({ length: 31 }, (_, i) => ({ key: `day${i + 1}`, label: `${i + 1}일`, col: 32 + i, kind: 'number' as const }))];
  const rows: DataRow[] = [], warnings: string[] = [];
  for (let r = header + 2; r <= sheet.rowCount; r += 2) {
    if (!valueAt(sheet, r, 2)) continue;
    if (!Number.isInteger(numberValue(valueAt(sheet, r, 1)))) throw new Error(`${r}행의 작업자 번호를 확인해 주세요. 합계나 설명 행을 작업자로 읽을 수 없습니다.`);
    const values: Record<string, Scalar> = Object.fromEntries(basicFields.map(([key, , col]) => [key, valueAt(sheet, r, col)]));
    Object.assign(values, { contact: valueAt(sheet, r + 1, 3), site_name: site, year: Number(dates[0][1]), month_number: Number(dates[0][2]) });
    for (let day = 1; day <= 31; day++) {
      const raw = valueAt(sheet, day <= 16 ? r : r + 1, 5 + (day <= 16 ? day - 1 : day - 17));
      if (raw !== null && raw !== '' && numberValue(raw) === null) throw new Error(`${r}행 ${day}일 공수가 숫자가 아닙니다.`);
      values[`day${day}`] = numberValue(raw) ?? 0;
    }
    const total = decimalSum(Array.from({ length: 31 }, (_, i) => Number(values[`day${i + 1}`])));
    const rate = numberValue(values.unit_price), amount = numberValue(values.gross_amount), days = numberValue(values.man_days);
    if (rate === null || amount === null || days === null) throw new Error(`${r}행의 공수·단가·총액이 비어 있습니다. 원본을 Excel에서 계산 후 저장해 주세요.`);
    if (Math.abs(total - days) > 1e-7 || Math.abs(Math.round(total * rate) - amount) > 1e-7) throw new Error(`${r}행의 날짜별 공수·단가와 원본 총액이 다릅니다. 원본을 확인해 주세요.`);
    rows.push({ id: `${file.id}:${r}`, values, origins: [`${file.name} / ${sheet.name} / ${r}~${r + 1}행`] });
  }
  const missingBank = rows.filter(r => !r.values.bank_name || !r.values.account_holder || !r.values.account_number).length;
  if (missingBank) warnings.push(`${missingBank}명의 은행·예금주·계좌 정보가 일부 비어 있습니다. 원본의 빈칸을 유지합니다.`);
  return { kind: 'labor', label: '노무내역서 · 한 사람 두 줄', table: { fields, rows, warnings: [], skipped: [] }, sheetName: sheet.name, headerRow: header, notes: ['1~16일과 17~31일의 공수를 작업자별로 함께 읽었습니다.', ...warnings] };
}

export function createTwoRowLaborPlan(target: WorkbookFile, source: SourceDocument, sheet: SheetInfo): ConversionPlan | undefined {
  if (labelAt(sheet, 6, 3) !== '성명' || labelAt(sheet, 6, 4) !== '주민등록번호' || labelAt(sheet, 6, 8) !== '일당' || labelAt(sheet, 6, 25) !== '총공수' || labelAt(sheet, 6, 27) !== '보수총액') return undefined;
  // Explicit day helpers distinguish this recipient's two-line calendar.
  if (valueAt(sheet, 6, 42) !== 1 || valueAt(sheet, 6, 56) !== 15 || valueAt(sheet, 7, 42) !== 16 || valueAt(sheet, 7, 57) !== 31) return undefined;
  const available = new Set(source.table.fields.map(f => f.key));
  if (!['worker_name', 'unit_price', 'gross_amount', 'year', 'month_number', ...Array.from({ length: 31 }, (_, i) => `day${i + 1}`)].every(k => available.has(k))) return undefined;
  const merges = sheet.merges.map(mergeBounds);
  const starts = new Set(merges.filter(m => m.start.col === 3 && m.end.col === 3 && m.end.row === m.start.row + 1).map(m => m.start.row));
  let endRow = 7;
  while (starts.has(endRow + 1)) endRow += 2;
  if (endRow < 9) throw new Error('두 줄 노임 양식의 인원 입력칸을 찾을 수 없습니다.');
  const mapping = (label: string, col: number, key: string, rowOffset = 0) => ({ ...blankMapping(label, col), rowOffset, mode: 'copy' as const, sourceKeys: [key], confirmed: true, reason: `${label}을 원본에서 그대로 옮깁니다.` });
  const mappings = [mapping('성명', 3, 'worker_name'), mapping('주민등록번호', 4, 'resident_id'), mapping('주소', 7, 'address'), mapping('일당', 8, 'unit_price'), mapping('휴대전화', 33, 'contact'), mapping('은행명', 34, 'bank_name'), mapping('계좌번호', 35, 'account_number'), mapping('예금주', 36, 'account_holder')];
  for (let day = 1; day <= 31; day++) mappings.push(mapping(`${day}일 공수`, 9 + (day <= 15 ? day - 1 : day - 16), `day${day}`, day <= 15 ? 0 : 1));
  const plan = planSchema.parse({ version: 1, targetId: target.id, sheetName: sheet.name, headerRow: 6, startRow: 8, endRow, mappings, rules: {},
    fixedCells: [{ address: 'I1', mapping: mapping('연도', 9, 'year') }, { address: 'O1', mapping: mapping('월', 15, 'month_number') }, { address: 'E2', mapping: mapping('현장명', 5, 'site_name') }], overflow: 'files',
    summary: ['1~15일은 윗줄, 16~31일은 아랫줄에 자동 배치합니다.', '회사명은 받을 양식의 값을 유지합니다. 원본에 없는 직종·팀명·체류자격 등은 기존 양식에서 확인해 주세요.', '보수총액은 원본 총액과 대조합니다. 세금·보험료·차감지급액은 받을 양식의 수식을 유지하며 Excel에서 재계산합니다.'], origin: 'local' });
  for (const [label, col, key] of [['총공수', 25, 'man_days'], ['보수총액', 27, 'gross_amount']] as const) plan.mappings.push({ ...blankMapping(label, col), confirmed: true, verifyKey: key, reason: '기존 수식과 원본 값을 대조합니다.' });
  for (const [label, col] of [['직종', 5], ['팀명칭', 6], ['E-mail', 37], ['영문성명', 38], ['체류자격', 39]] as const) plan.mappings.push({ ...blankMapping(label, col), confirmed: true, reason: '원본에 없는 정보이므로 빈칸으로 둡니다.' });
  return plan;
}
