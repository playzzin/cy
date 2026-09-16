import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { webcrypto } from 'crypto';
import { createDocumentPlan, documentTotals, readSourceDocument, validateAutomaticPlan } from './businessDocuments';
import { columnName, readWorkbook, xml, elements, serializeXml } from './workbook';
import { convertWorkbook } from './writer';
import { inputRecordRows } from './mergedLayout';
import { validatePlanReferences } from './planning';
import { buildTraces } from './transform';
import { Scalar } from './types';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
const escapeXml = (value: Scalar) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function fixture(cells: Record<string, Scalar>, merges: string[], name: string) {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(process.cwd(), 'public/excel-converter/examples/21_타회사노임명세서_한줄양식.xlsx')));
  const rows = new Map<number, string[]>();
  Object.entries(cells).forEach(([address, value]) => {
    const row = Number(address.match(/\d+$/)![0]);
    const contents = typeof value === 'string' && value.startsWith('=') ? `<f>${escapeXml(value.slice(1))}</f>` : typeof value === 'number' ? `<v>${value}</v>` : `<is><t>${escapeXml(value)}</t></is>`;
    rows.set(row, [...(rows.get(row) || []), `<c r="${address}"${typeof value === 'number' || String(value).startsWith('=') ? '' : ' t="inlineStr"'}>${contents}</c>`]);
  });
  zip.file('xl/worksheets/sheet1.xml', `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:BE11"/><sheetData>${[...rows].sort(([a], [b]) => a - b).map(([r, c]) => `<row r="${r}">${c.join('')}</row>`).join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells></worksheet>`);
  const bytes = await zip.generateAsync({ type: 'arraybuffer' });
  if (process.env.EXCEL_QA_FIXTURE_DIR) { fs.mkdirSync(process.env.EXCEL_QA_FIXTURE_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.EXCEL_QA_FIXTURE_DIR, name), Buffer.from(bytes)); }
  return readWorkbook(bytes, name);
}
export async function sourceFixture() {
  const cells: Record<string, Scalar> = { A1: '노무내역서', A2: '기간: 2026-08-01 ~ 2026-08-31', E2: '현장명: 가상현장', B4: '성명', C4: '주민등록번호', C5: '전화번호', D4: '주소', U4: '공수', V4: '단가', W4: '총액', X4: '은행', Y4: '예금주', Z4: '계좌번호', AA4: '지급구분' };
  for (let day = 1; day <= 31; day++) cells[`${columnName(5 + (day <= 16 ? day - 1 : day - 17))}${day <= 16 ? 4 : 5}`] = `${String(day).padStart(2, '0')}\n(월)`;
  for (const r of [6, 8]) Object.assign(cells, { [`A${r}`]: (r - 4) / 2, [`B${r}`]: `가상작업자 ${r}`, [`C${r}`]: '900101-1******', [`C${r + 1}`]: '010-0000-0000', [`D${r}`]: '가상주소', [`U${r}`]: 3.5, [`V${r}`]: 200000, [`W${r}`]: 700000, [`X${r}`]: '가상은행', [`Y${r}`]: '가상예금주', [`Z${r}`]: '001-000', [`AA${r}`]: '직불', [`E${r}`]: 1.1, [`T${r}`]: 0.5, [`E${r + 1}`]: 0.7, [`S${r + 1}`]: 1.2 });
  return fixture(cells, [], '가상원본.xlsx');
}
export async function targetFixture() {
  const cells: Record<string, Scalar> = { E1: '가상회사', I1: 2026, O1: 7, C6: '성   명', D6: '주민등록번호', H6: '일 당', Y6: '총\n공수', AA6: '보수총액', AP6: 1, BD6: 15, AP7: 16, BE7: 31 };
  const merges: string[] = [];
  for (const r of [8, 10]) {
    for (const col of [3, 4, 5, 6, 7, 8, 25, 27, 33, 34, 35, 36, 37, 38, 39]) merges.push(`${columnName(col)}${r}:${columnName(col)}${r + 1}`);
    Object.assign(cells, { [`Y${r}`]: `=SUM(I${r}:X${r + 1})`, [`AA${r}`]: `=H${r}*Y${r}`, [`E${r}`]: '이전직종', [`I${r + 1}`]: 99 });
  }
  return fixture(cells, merges, '가상두줄양식.xlsx');
}
test('16/17일 원본을 15/16일 대상에 맞춰 31일·전화·계좌·금액을 보존한다', async () => {
  const source = readSourceDocument(await sourceFixture()), target = await targetFixture(), plan = createDocumentPlan(target, source);
  expect(documentTotals(source.table)).toMatchObject({ people: 2, manDays: 7, amount: 1400000 });
  expect(validatePlanReferences(plan, source.table.fields)).toEqual([]);
  expect(inputRecordRows(target.sheets[0], plan)).toEqual([8, 10]);
  const result = await convertWorkbook(target, plan, source.table);
  expect(result.issues).toEqual([]);
  const values = new Map(result.outputs[0].sheets[0].cells.map(c => [c.address, c.value]));
  for (const r of [8, 10]) {
    expect(values.get(`I${r}`)).toBe(1.1); expect(values.get(`W${r}`)).toBe(0);
    expect(values.get(`I${r + 1}`)).toBe(0.5); expect(values.get(`J${r + 1}`)).toBe(0.7); expect(values.get(`X${r + 1}`)).toBe(1.2);
    expect(values.get(`Y${r}`)).toBeCloseTo(3.5); expect(values.get(`AA${r}`)).toBeCloseTo(700000);
    expect(values.get(`AI${r}`)).toBe('001-000'); expect(values.get(`E${r}`) ?? null).toBeNull();
  }
  expect(values.get('O1')).toBe(8); expect(values.get('E2')).toBe('가상현장');
  expect(result.outputs[0].sheets[0].merges).toEqual(target.sheets[0].merges);
});
test('원본 금액 불일치와 여러 달 기간은 자동 진행하지 않는다', async () => {
  const source = await sourceFixture();
  source.sheets[0].cells.find(c => c.address === 'W6')!.value = 1;
  expect(() => readSourceDocument(source)).toThrow('원본 총액');
  source.sheets[0].cells.find(c => c.address === 'A2')!.value = '기간: 2026-08-01 ~ 2026-09-01';
  expect(() => readSourceDocument(source)).toThrow('여러 달');
});
test('계좌 누락은 안내하고 빈칸을 유지하며 변환을 막지 않는다', async () => {
  const file = await sourceFixture(); file.sheets[0].cells.find(c => c.address === 'Z6')!.value = null;
  const source = readSourceDocument(file), target = await targetFixture();
  expect(source.notes.join()).toContain('1명의');
  const result = await convertWorkbook(target, createDocumentPlan(target, source), source.table);
  expect(result.issues).toEqual([]); expect(result.outputs[0].sheets[0].cells.find(c => c.address === 'AI8')?.value ?? null).toBeNull();
});
test('공유 수식의 상대·절대 참조를 계산하면서 원래 수식 정의는 보존한다', async () => {
  const source = readSourceDocument(await sourceFixture()), target = await targetFixture();
  const zip = await JSZip.loadAsync(target.bytes), doc = xml(await zip.file(target.sheets[0].path)!.async('string'));
  for (const [first, second, formula, index] of [['Y8', 'Y10', 'SUM(I8:X9)', '0'], ['AA8', 'AA10', '$H8*Y8+$O$1*0', '1']]) {
    const master = elements(elements(doc, 'c').find(c => c.getAttribute('r') === first)!, 'f')[0];
    master.textContent = formula; master.setAttribute('t', 'shared'); master.setAttribute('si', index); master.setAttribute('ref', `${first}:${second}`);
    const child = elements(elements(doc, 'c').find(c => c.getAttribute('r') === second)!, 'f')[0];
    child.textContent = ''; child.setAttribute('t', 'shared'); child.setAttribute('si', index);
  }
  zip.file(target.sheets[0].path, serializeXml(doc));
  const file = await readWorkbook(await zip.generateAsync({ type: 'arraybuffer' }), target.name);
  const result = await convertWorkbook(file, createDocumentPlan(file, source), source.table);
  expect(result.issues).toEqual([]);
  expect(result.outputs[0].sheets[0].cells.find(c => c.address === 'AA10')?.value).toBeCloseTo(700000);
  const after = await JSZip.loadAsync(result.outputs[0].bytes); const saved = xml(await after.file(target.sheets[0].path)!.async('string'));
  expect(elements(saved, 'f').map(f => f.outerHTML)).toEqual(elements(doc, 'f').map(f => f.outerHTML));
});
test('아랫줄 직접 수정은 같은 열의 윗줄을 바꾸지 않고 잘못된 병합 위치는 막는다', async () => {
  const source = readSourceDocument(await sourceFixture()), target = await targetFixture(), plan = createDocumentPlan(target, source);
  plan.overrides = [{ originsKey: source.table.rows[0].origins.join('\n'), targetColumn: 9, rowOffset: 1, value: 0.8, kind: 'number' }];
  const traces = buildTraces(plan, source.table.rows, plan.sheetName, [8, 10]).traces;
  expect(traces.find(t => t.address === 'I8')?.value).toBe(1.1); expect(traces.find(t => t.address === 'I9')?.value).toBe(0.8);
  const bad = { ...plan, mappings: plan.mappings.map(m => m.label === '성명' ? { ...m, rowOffset: 1 } : m) };
  expect(() => inputRecordRows(target.sheets[0], bad)).toThrow('시작 칸');
  expect(() => validateAutomaticPlan(plan, { ...plan, mappings: plan.mappings.filter(m => m.label !== '16일 공수') })).toThrow('16일');
});

// Opt-in local integration. User files are never committed or uploaded.
const actualTest = process.env.EXCEL_PAIR_SOURCE && process.env.EXCEL_PAIR_TARGET ? test : test.skip;
actualTest('사용자가 제공한 실제 두 파일의 인원·공수·금액·31일 입력을 대조한다', async () => {
  const read = async (file: string) => readWorkbook(Uint8Array.from(fs.readFileSync(file)).buffer, path.basename(file));
  const source = readSourceDocument(await read(process.env.EXCEL_PAIR_SOURCE!));
  const target = await read(process.env.EXCEL_PAIR_TARGET!); const plan = createDocumentPlan(target, source);
  expect(validatePlanReferences(plan, source.table.fields)).toEqual([]);
  const result = await convertWorkbook(target, plan, source.table);
  expect(result.issues.filter(i => i.level === 'error').map(i => i.code)).toEqual([]);
  expect(result.outputCount).toBe(source.table.rows.length); expect(result.outputs).toHaveLength(1);
  const values = new Map(result.outputs[0].sheets[0].cells.map(c => [c.address, c.value]));
  source.table.rows.forEach((row, i) => {
    for (let day = 1; day <= 31; day++) expect(values.get(`${columnName(9 + (day <= 15 ? day - 1 : day - 16))}${8 + i * 2 + (day > 15 ? 1 : 0)}`)).toBe(row.values[`day${day}`]);
    expect(values.get(`Y${8 + i * 2}`)).toBeCloseTo(Number(row.values.man_days)); expect(values.get(`AA${8 + i * 2}`)).toBeCloseTo(Number(row.values.gross_amount));
  });
  fs.mkdirSync('.codex-artifacts/excel-converter/actual-pair', { recursive: true });
  fs.writeFileSync('.codex-artifacts/excel-converter/actual-pair/page-engine.xlsx', Buffer.from(result.outputs[0].bytes));
}, 180000);
