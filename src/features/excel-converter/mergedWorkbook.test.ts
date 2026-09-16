import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import JSZip from 'jszip';
import { createDocumentPlan, readSourceDocument } from './businessDocuments';
import { readWorkbook, extractTable, elements, xml, serializeXml, workbookMime } from './workbook';
import { convertWorkbook } from './writer';
import { inputRecordRows } from './mergedLayout';
import { ConversionPlan, DataTable, WorkbookFile } from './types';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
const example = (name: string) => {
  const data = fs.readFileSync(path.join(process.cwd(), 'public/excel-converter/examples', name));
  return readWorkbook(Uint8Array.from(data).buffer, name);
};
let target: WorkbookFile, table: DataTable, plan: ConversionPlan;
beforeAll(async () => {
  const source = readSourceDocument(await example('20_현재노임명세서_2026-09_가상원본.xlsx'));
  target = await example('30_병합셀_타회사노임양식.xlsx');
  table = source.table; plan = createDocumentPlan(target, source);
});
const value = (file: { sheets: WorkbookFile['sheets'] }, address: string, sheet = 0) => file.sheets[sheet].cells.find(c => c.address === address)?.value ?? null;
const changedTarget = async (change: (zip: JSZip) => Promise<void>, name = '테스트.xlsx') => {
  const zip = await JSZip.loadAsync(target.bytes); await change(zip);
  return readWorkbook(await zip.generateAsync({type:'arraybuffer'}), name);
};
const mutateSheet = async (zip: JSZip, change: (doc: Document) => void) => {
  const doc = xml(await zip.file(target.sheets[0].path)!.async('string')); change(doc);
  zip.file(target.sheets[0].path, serializeXml(doc));
};

test('두 줄 머리글·입력칸의 병합을 유지해 3명·7공수·127만원과 수식을 대조한다', async () => {
  expect([plan.headerRow, plan.startRow, plan.endRow]).toEqual([5,7,12]);
  expect(inputRecordRows(target.sheets[0], plan)).toEqual([7,9,11]);
  const result = await convertWorkbook(target, plan, table);
  expect(result.issues).toEqual([]); expect(result.outputCount).toBe(3);
  const out = result.outputs[0], answer = await example('31_병합셀_정답예시.xlsx');
  expect(out.sheets[0].merges).toEqual(target.sheets[0].merges);
  expect(out.sheets[0].presentation?.widths).toEqual(target.sheets[0].presentation?.widths);
  expect(out.sheets[0].presentation?.heights).toEqual(target.sheets[0].presentation?.heights);
  for (const r of [7,9,11]) for (const c of ['A','B','C','D','E','F','G']) expect(value(out, `${c}${r}`)).toEqual(value(answer, `${c}${r}`));
  for (const r of [8,10,12]) for (const c of ['A','B','C','D','E','F','G']) expect(value(out, `${c}${r}`)).toBeNull();
  expect(value(out, 'C13')).toBe(7); expect(value(out, 'E13')).toBe(1270000);
  expect(out.sheets[0].cells.find(c=>c.address==='E9')?.formula).toBe('C9*D9');
  expect(value(target,'A7')).toBeNull();
  const rereadTable = extractTable(await readWorkbook(out.bytes, out.name), out.sheets[0].name, 5);
  expect(rereadTable.rows.slice(0,3).map(r=>r.values.c1)).toEqual(table.rows.map(r=>r.values.worker_name));
  const dest=path.join(process.cwd(),'outputs/excel-converter/merged');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'병합셀_실제변환결과.xlsx'),Buffer.from(out.bytes));
});

test('병합 영역의 실제 수용 인원으로 다음 페이지를 나눈다', async () => {
  const more = { ...table, rows: [...table.rows, { ...table.rows[0], id:'extra', origins:['extra'], values:{...table.rows[0].values,worker_name:'가상작업자 라'} }] };
  const result = await convertWorkbook(target, plan, more);
  expect(result.issues).toEqual([]); expect(result.outputs[0].sheets).toHaveLength(2);
  expect(value(result.outputs[0],'A7',1)).toBe('가상작업자 라');
  expect(value(result.outputs[0],'A9',1)).toBeNull();
  expect(value(result.outputs[0],'E13',1)).toBe(630000);
});

test('병합 수식도 작업자에 맞춰 검증하고 금액 차이는 차단한다', async () => {
  const rows=table.rows.map((r,i)=>i===1?{...r,values:{...r.values,billing_amount:1}}:r);
  const result=await convertWorkbook(target,plan,{...table,rows});
  expect(result.issues.some(i=>i.code==='reconciliation' && i.location?.endsWith('E9'))).toBe(true);
});

test('높이가 다른 입력칸·범위를 가로지르는 병합·어긋난 구간을 구별한다', () => {
  const sheet={...target.sheets[0],cells:[],merges:['A7:A8','A9:A11']};
  const single={...plan,mappings:[plan.mappings[0]]};
  expect(inputRecordRows(sheet,single)).toEqual([7,9,12]);
  expect(()=>inputRecordRows(sheet,{...single,startRow:8})).toThrow('중간');
  expect(()=>inputRecordRows(sheet,{...single,endRow:10})).toThrow('중간');
  expect(()=>inputRecordRows({...sheet,merges:['A7:A8','B7:B9']},plan)).toThrow('구간');
});

test('병합 아래에 다른 항목이 있으면 조용히 덮거나 버리지 않는다', () => {
  const sheet={...target.sheets[0],merges:target.sheets[0].merges.filter(m=>m!=='B7:B8'),cells:[...target.sheets[0].cells,{address:'B8',col:2,row:8,value:'별도 항목',text:'별도 항목',kind:'text' as const,style:0}]};
  expect(()=>inputRecordRows(sheet,plan)).toThrow('아래쪽 행');
});

test('반복 입력과 무관한 세로 병합은 개인 문서 작성을 막지 않는다', async () => {
  const file=await changedTarget(zip=>mutateSheet(zip,doc=>elements(doc,'mergeCell').find(m=>m.getAttribute('ref')==='A2:G2')!.setAttribute('ref','A1:G2')));
  const fixed={...plan,targetId:file.id,startRow:2,endRow:2,headerRow:1,mappings:[],fixedCells:[{address:'A7',mapping:plan.mappings[0]}],overflow:'files' as const};
  const result=await convertWorkbook(file,fixed,table);
  expect(result.issues).toEqual([]); expect(result.outputs).toHaveLength(3);
  expect(value(result.outputs[1],'A7')).toBe('가상작업자 나');
});

async function macroTarget() {
  return changedTarget(async zip=>{
    const ct=xml(await zip.file('[Content_Types].xml')!.async('string'));
    const type=ct.createElementNS(ct.documentElement.namespaceURI,'Override');type.setAttribute('PartName','/xl/workbook.xml');type.setAttribute('ContentType','application/vnd.ms-excel.sheet.macroEnabled.main+xml');ct.documentElement.appendChild(type);
    zip.file('[Content_Types].xml',serializeXml(ct));
    // Opaque preservation sentinel only. Not an executable macro workbook.
    zip.file('xl/vbaProject.bin',new Uint8Array([0,255,19,27,128]));
    zip.file('xl/activeX/activeX1.bin',new Uint8Array([1,2,3]));
    zip.file('xl/drawings/vmlDrawing1.vml','<xml>preservation sentinel</xml>');
    const rel=xml(await zip.file('xl/_rels/workbook.xml.rels')!.async('string'));
    const node=rel.createElementNS(rel.documentElement.namespaceURI,'Relationship');node.setAttribute('Id','rIdVBA');node.setAttribute('Type','http://schemas.microsoft.com/office/2006/relationships/vbaProject');node.setAttribute('Target','vbaProject.bin');rel.documentElement.appendChild(node);zip.file('xl/_rels/workbook.xml.rels',serializeXml(rel));
  },'매크로양식.xlsm');
}

test('xlsm의 바이너리·관계·형식은 보존하고 병합 칸의 값만 변환한다', async () => {
  const macro=await macroTarget();expect(macro.format).toBe('xlsm');expect(macro.hasMacros).toBe(true);
  const result=await convertWorkbook(macro,{...plan,targetId:macro.id},table);
  expect(result.issues).toEqual([]);expect(result.outputs[0].name).toMatch(/\.xlsm$/);
  expect(workbookMime(result.outputs[0].name)).toBe('application/vnd.ms-excel.sheet.macroEnabled.12');
  const before=await JSZip.loadAsync(macro.bytes),after=await JSZip.loadAsync(result.outputs[0].bytes);
  for(const part of ['xl/vbaProject.bin','xl/activeX/activeX1.bin','xl/drawings/vmlDrawing1.vml']) expect(await after.file(part)!.async('uint8array')).toEqual(await before.file(part)!.async('uint8array'));
  expect(await after.file('xl/_rels/workbook.xml.rels')!.async('string')).toContain('rIdVBA');
  expect(await after.file('[Content_Types].xml')!.async('string')).toContain('macroEnabled.main+xml');
  expect(value(result.outputs[0],'E13')).toBe(1270000);
});

test('매크로 양식의 초과 인원은 시트 복제 없이 파일로 나눈다', async () => {
  const macro=await macroTarget();const more={...table,rows:[...table.rows,{...table.rows[0],id:'extra',origins:['extra']}]};
  const result=await convertWorkbook(macro,{...plan,targetId:macro.id},more);
  expect(result.issues).toEqual([]);expect(result.outputs).toHaveLength(2);
  expect(result.outputs.every(o=>o.name.endsWith('.xlsm') && o.sheets.length===1)).toBe(true);
});

test('원본 xlsm의 매크로는 xlsx 대상 파일로 옮겨지지 않는다', async () => {
  const macro=await macroTarget();const filled=await convertWorkbook(macro,{...plan,targetId:macro.id},table);
  const source=readSourceDocument(await readWorkbook(filled.outputs[0].bytes,filled.outputs[0].name));
  expect(source.table.rows).toHaveLength(3);
  const result=await convertWorkbook(target,createDocumentPlan(target,source),source.table);const zip=await JSZip.loadAsync(result.outputs[0].bytes);
  expect(zip.file('xl/vbaProject.bin')).toBeNull();expect(result.outputs[0].name).toMatch(/\.xlsx$/);
});

test('매크로 없는 정상 xlsm도 형식과 병합을 유지한다', async () => {
  const file=await changedTarget(async zip=>{
    const doc=xml(await zip.file('[Content_Types].xml')!.async('string'));
    elements(doc,'Default').find(e=>e.getAttribute('Extension')==='xml')!.setAttribute('ContentType','application/vnd.ms-excel.sheet.macroEnabled.main+xml');
    zip.file('[Content_Types].xml',serializeXml(doc));
  },'병합양식.xlsm');
  const result=await convertWorkbook(file,{...plan,targetId:file.id},table);
  expect(file.hasMacros).toBe(false);expect(file.format).toBe('xlsm');expect(result.issues).toEqual([]);
  const dest=path.join(process.cwd(),'outputs/excel-converter/merged');
  fs.writeFileSync(path.join(dest,'병합양식_매크로없는형식검증.xlsm'),Buffer.from(file.bytes));
  expect(result.outputs[0].name).toMatch(/\.xlsm$/);
});
