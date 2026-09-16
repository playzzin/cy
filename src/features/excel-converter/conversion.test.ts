import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import JSZip from 'jszip';
import { readWorkbook, extractTable, describeTemplateChanges, validateArchive, xml, elements } from './workbook';
import { createPlan, applyJoins, validatePlanReferences } from './planning';
import { decimalSum, mapValue, roundValue, runRules, strictDate } from './transform';
import { convertWorkbook, evaluateFormula } from './writer';
import { ConversionPlan, DataTable, emptyRules, planSchema, WorkbookFile } from './types';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
const exampleDir = path.join(process.cwd(), 'public/excel-converter/examples');
const bytes = (name: string) => { const b = fs.readFileSync(path.join(exampleDir, name)); const array = new ArrayBuffer(b.length); new Uint8Array(array).set(b); return array; };
let source: WorkbookFile; let target: WorkbookFile; let changed: WorkbookFile; let table: DataTable;
const configure = (file: WorkbookFile): ConversionPlan => {
  const p = createPlan(file, file.sheets[0].name, table.fields); p.rules = { ...emptyRules(), filters: [{ key: 'c8', op: 'neq', value: '취소' }], groupBy: ['c1', 'c7', 'c9'], sums: ['c4', 'c6'], sort: [{ key: 'c7', direction: 'asc' }] };
  p.mappings = p.mappings.map(m => m.label === '배송지' ? { ...m, mode: 'concat', sourceKeys: ['c10', 'c11'], confirmed: true } : m); return p;
};
beforeAll(async () => { fs.mkdirSync(path.join(process.cwd(), 'outputs/excel-converter/test-results'), { recursive: true }); source = await readWorkbook(bytes('01_우리회사_원본.xlsx'), '원본.xlsx'); target = await readWorkbook(bytes('02_A사_양식.xlsx'), 'A사.xlsx'); changed = await readWorkbook(bytes('03_A사_변경양식.xlsx'), '변경.xlsx'); table = extractTable(source, '주문내역', 4); });
test('머리글과 합계를 구분하고 코드 앞자리 0·날짜를 읽는다', () => { expect(table.rows).toHaveLength(6); expect(table.rows[0].values.c1).toBe('00001'); expect(table.rows[0].values.c7).toBe('2026-09-21'); expect(table.skipped[0].reason).toBe('합계 행'); expect(table.warnings).toEqual([]); });
test('양식 변경으로 추가된 항목과 이동된 열을 탐지한다', () => { const changes = describeTemplateChanges(target.sheets[0], changed.sheets[0]); expect(changes.some(c => c.includes('추가: 배송지'))).toBe(true); expect(changes.some(c => c.includes('이동: 제품코드'))).toBe(true); });
test('취소 제외·합산 후 수량46 금액156000, 원본은 변하지 않는다', () => { const before = JSON.stringify(table); const p = configure(changed); const result = runRules(table, p.rules, p.mappings.flatMap(m => m.sourceKeys)); expect(result.issues).toEqual([]); expect(result.rows).toHaveLength(4); expect(result.rows.reduce((n, r) => n + Number(r.values.c4), 0)).toBe(46); expect(result.rows.reduce((n, r) => n + Number(r.values.c6), 0)).toBe(156000); expect(JSON.stringify(table)).toBe(before); });
test('기존 양식의 3행 제한을 시트 두 개로 분할하고 수식을 재계산한다', async () => {
  const p = configure(target); expect(validatePlanReferences(p, table.fields)).toEqual([]);
  const result = await convertWorkbook(target, p, table); expect(result.issues).toEqual([]); expect(result.outputs).toHaveLength(1); const out = result.outputs[0]; expect(out.sheets).toHaveLength(2);
  expect(out.sheets[0].cells.find(c => c.address === 'A8')?.value).toBe('00001'); expect(out.sheets[0].cells.find(c => c.address === 'F11')?.value).toBe(120000); expect(out.sheets[1].cells.find(c => c.address === 'F11')?.value).toBe(36000);
  expect(out.sheets[1].cells.find(c => c.address === 'A9')?.value).toBeNull(); expect(out.traces.find(t => t.address === 'D8')?.origins).toHaveLength(2);
  fs.mkdirSync(path.join(process.cwd(), 'outputs/excel-converter/test-results'), { recursive: true }); fs.writeFileSync(path.join(process.cwd(), 'outputs/excel-converter/test-results/A사_변환결과.xlsx'), Buffer.from(out.bytes));
});
test('변경 양식 결과를 독립적으로 만든 정답 파일의 전체 입력 영역과 비교한다', async () => {
  const result = await convertWorkbook(changed, configure(changed), table); expect(result.issues).toEqual([]); const answer = await readWorkbook(bytes('04_변경양식_정답예시.xlsx'), '정답.xlsx');
  for (let r = 11; r <= 15; r++) for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) { const address = `${col}${r}`; const actual = result.outputs[0].sheets[0].cells.find(c => c.address === address)?.value ?? null; const expected = answer.sheets[0].cells.find(c => c.address === address)?.value ?? null; expect({ address, value: actual }).toEqual({ address, value: expected }); }
  const originalZip = await JSZip.loadAsync(new Uint8Array(changed.bytes)); const outputZip = await JSZip.loadAsync(new Uint8Array(result.outputs[0].bytes));
  for (const name of Object.keys(originalZip.files).filter(n => !n.endsWith('/') && !['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', '[Content_Types].xml', 'xl/styles.xml', 'xl/calcChain.xml'].includes(n) && !n.startsWith('xl/worksheets/'))) expect(await outputZip.file(name)!.async('uint8array')).toEqual(await originalZip.file(name)!.async('uint8array'));
  expect(result.outputs[0].sheets[0].merges).toEqual(changed.sheets[0].merges);
  fs.writeFileSync(path.join(process.cwd(), 'outputs/excel-converter/test-results/변경양식_변환결과.xlsx'), Buffer.from(result.outputs[0].bytes));
});
test('파일 분리와 페이지 파일 분리가 행을 누락하지 않는다', async () => { const p = configure(target); p.overflow = 'files'; p.rules.splitBy = 'c9'; const result = await convertWorkbook(target, p, table); expect(result.issues).toEqual([]); expect(result.outputs).toHaveLength(2); expect(result.outputs.reduce((n, o) => n + o.outputCount, 0)).toBe(4); });
test('양식 칸 초과 중단 설정은 데이터 잘림을 허용하지 않는다', async () => { const p = configure(target); p.overflow = 'stop'; await expect(convertWorkbook(target, p, table)).rejects.toThrow('양식에는 3건'); });
test('단가가 다른 행을 합산하면 오류를 낸다', () => { const input = JSON.parse(JSON.stringify(table)) as DataTable; input.rows[1].values.c5 = 2000; const p = configure(target); const r = runRules(input, p.rules, p.mappings.flatMap(m => m.sourceKeys)); expect(r.issues.some(i => i.code === 'group-conflict')).toBe(true); });
test('보조 코드표의 중복 키와 미연결 행을 차단한다', async () => { const lookup = await readWorkbook(bytes('05_상품코드_보조자료.xlsx'), '코드표.xlsx'); const join = { fileId: lookup.id, sheetName: '품목코드표', headerRow: 4, leftKey: 'c1', rightColumn: 1, prefix: 'lookup0_' }; const joined = applyJoins(table, [lookup], [join]); expect(joined.rows[0].values.lookup0_c2).toBe('A-001'); const bad = JSON.parse(JSON.stringify(lookup)) as WorkbookFile; bad.sheets[0].cells.find(c => c.address === 'A6')!.value = '00001'; expect(() => applyJoins(table, [bad], [join])).toThrow('중복'); const missing = JSON.parse(JSON.stringify(table)) as DataTable; missing.rows[0].values.c1 = '99999'; expect(() => applyJoins(missing, [lookup], [join])).toThrow('연결하지 못한'); });
test('필수 누락과 미확인 연결은 최종 파일을 만들지 않는다', async () => { const p = configure(changed); p.mappings[0].mode = 'blank'; p.mappings[0].required = true; await expect(convertWorkbook(changed, p, table)).rejects.toThrow('필수'); p.mappings[0].required = false; p.mappings[0].confirmed = false; await expect(convertWorkbook(changed, p, table)).rejects.toThrow('확인'); });
test('빈값은 0으로 바뀌지 않으며 실제 0은 보존된다', () => { const m = configure(changed).mappings[5]; m.format = 'number'; expect(mapValue(m, { id: '', values: { c4: null }, origins: [] }).value).toBeNull(); expect(mapValue(m, { id: '', values: { c4: 0 }, origins: [] }).value).toBe(0); });
test('날짜 오류, 모호한 숫자, 허용되지 않은 AI 연산을 차단한다', () => { expect(strictDate('2026-02-30')).toBeNull(); expect(strictDate('2024/02/29')).toBe('2024-02-29'); const p = configure(changed); expect(() => planSchema.parse({ ...p, mappings: [{ ...p.mappings[0], mode: 'execute' }] })).toThrow(); });
test('소수 합산과 음수 반올림 기준을 검증한다', () => { expect(decimalSum([0.1, 0.2])).toBe(0.3); expect(roundValue(-1.25, 1, 'round')).toBe(-1.3); expect(roundValue(-1.29, 1, 'truncate')).toBe(-1.2); });
test('수식 계산기는 합계와 산술을 처리하고 외부 실행·참조를 거부한다', () => { expect(evaluateFormula('SUM(A1:A3)*2', a => Number(a.slice(1)))).toBe(12); expect(() => evaluateFormula('WEBSERVICE("https://example.com")', () => 0)).toThrow(); expect(() => evaluateFormula('1/0', () => 0)).toThrow(); });
test('문자열 수식은 실행되지 않고 XML 특수문자는 보존된다', async () => { const p = configure(changed); const m = p.mappings[1]; m.mode = 'constant'; m.constant = '=HYPERLINK("x") & <테스트>'; const r = await convertWorkbook(changed, p, table); expect(r.issues).toEqual([]); const c = r.outputs[0].sheets[0].cells.find(c => c.address === 'B11')!; expect(c.value).toBe(m.constant); expect(c.formula).toBeUndefined(); });
test('손상 파일과 실행 기능이 포함된 파일을 거부한다', async () => { expect(() => validateArchive(new ArrayBuffer(50))).toThrow(); const zip = await JSZip.loadAsync(new Uint8Array(source.bytes)); zip.file('xl/vbaProject.bin', 'fake'); await expect(readWorkbook(await zip.generateAsync({ type: 'arraybuffer' }), 'wrong.xlsx')).rejects.toThrow('매크로'); });
test('양식 셀의 서식 id·열 너비·인쇄 요소를 보존한다', async () => { const r = await convertWorkbook(changed, configure(changed), table); const orig = await JSZip.loadAsync(new Uint8Array(changed.bytes)); const out = await JSZip.loadAsync(new Uint8Array(r.outputs[0].bytes)); const a = xml(await orig.file(changed.sheets[0].path)!.async('string')); const b = xml(await out.file(r.outputs[0].sheets[0].path)!.async('string')); expect(elements(a, 'col').map(c => c.outerHTML)).toEqual(elements(b, 'col').map(c => c.outerHTML)); expect(elements(a, 'pageSetup').map(c => c.outerHTML)).toEqual(elements(b, 'pageSetup').map(c => c.outerHTML)); });
test('양식 계산 금액과 원본 금액이 다르면 검증 오류를 낸다', async () => { const input = JSON.parse(JSON.stringify(table)) as DataTable; input.rows[0].values.c6 = 15001; const r = await convertWorkbook(target, configure(target), input); expect(r.issues.some(i => i.code === 'reconciliation')).toBe(true); });
test('직접 수정은 원본 행에 연결되며 합산 기준이 바뀌면 중단한다', async () => { const p = configure(changed); const rows = runRules(table, p.rules, []).rows; p.overrides = [{ originsKey: rows[0].origins.join('\n'), targetColumn: 2, value: '수정된 안전장갑', kind: 'text' }]; const r = await convertWorkbook(changed, p, table); expect(r.issues).toEqual([]); expect(r.outputs[0].sheets[0].cells.find(c => c.address === 'B11')?.value).toBe('수정된 안전장갑'); p.rules.groupBy = []; p.rules.sums = []; const stale = await convertWorkbook(changed, p, table); expect(stale.issues.some(i => i.code === 'stale-override')).toBe(true); });
test('대상 양식의 입력 제한을 위반하는 값은 오류로 표시한다', async () => { const zip = await JSZip.loadAsync(new Uint8Array(changed.bytes)); const doc = xml(await zip.file(changed.sheets[0].path)!.async('string')); const ns = doc.documentElement.namespaceURI; const rules = doc.createElementNS(ns, 'dataValidations'); const rule = doc.createElementNS(ns, 'dataValidation'); rule.setAttribute('type', 'list'); rule.setAttribute('sqref', 'G11:G14'); rule.setAttribute('allowBlank', '1'); const formula = doc.createElementNS(ns, 'formula1'); formula.textContent = '"박스,묶음"'; rule.appendChild(formula); rules.appendChild(rule); doc.documentElement.appendChild(rules); zip.file(changed.sheets[0].path, new XMLSerializer().serializeToString(doc)); const file = await readWorkbook(await zip.generateAsync({ type: 'arraybuffer' }), '입력제한.xlsx'); const r = await convertWorkbook(file, configure(file), table); expect(r.issues.some(i => i.code === 'validation-value')).toBe(true); expect(r.outputs).toHaveLength(0); });



test('지수 표기의 작은 소수 합산을 보존하고 지원 정밀도 초과는 알린다', () => { expect(decimalSum([1e-7, 2e-7])).toBe(3e-7); expect(() => decimalSum([1e-9])).toThrow('소수 8자리'); });
test('엑셀 수식의 미세한 저장 오차를 합산하되 실제 추가 소수 자리는 버리지 않는다', () => {
  expect(decimalSum([14.600000000000001, 0.1 + 0.2, 1.2000000000000002])).toBe(16.1);
  expect(decimalSum([-14.600000000000001, -0.1 - 0.2])).toBe(-14.9);
  expect(decimalSum([1.23456789, 2.00000001])).toBe(3.2345679);
  expect(decimalSum([1e-8, 2e-8])).toBe(3e-8);
  for (const value of [1e-9, 1.234567891, 1000000.000000001]) expect(() => decimalSum([value])).toThrow('소수 8자리');
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => decimalSum([value])).toThrow();
});
test('단일 입력의 병합 시작 칸·범위·중복을 검증한다', async () => { const p = configure(changed); const mapping = { ...p.mappings[0], mode: 'constant' as const, constant: '테스트', sourceKeys: [] }; p.fixedCells = [{ address: 'C2', mapping }]; const merge = changed.sheets[0].merges.find(m => m.includes(':'))!; p.fixedCells[0].address = merge.split(':')[1]; await expect(convertWorkbook(changed, p, table)).rejects.toThrow('병합 셀'); p.fixedCells[0].address = 'ZZ100'; await expect(convertWorkbook(changed, p, table)).rejects.toThrow('범위'); p.fixedCells = [{ address: 'A3', mapping }, { address: 'A3', mapping }]; expect(validatePlanReferences(p, table.fields).join()).toContain('같은 단일 입력'); });
