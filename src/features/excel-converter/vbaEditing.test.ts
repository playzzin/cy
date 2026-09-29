import fs from 'fs';
import path from 'path';
import { CFB } from 'xlsx';
import { readVbaProject,rewriteVbaProject,mergeVbaModuleSource } from './vbaEditing';
import {compressVba,decompressVba} from './vbaCompression';
import {privateLiterals} from './editPrivacy';
import JSZip from 'jszip';
import {webcrypto} from 'crypto';
import {readWorkbook,xml,elements,serializeXml} from './workbook';
import {createDocumentPlan,readSourceDocument} from './businessDocuments';
import {convertWorkbook} from './writer';
import {verifyConversion} from './verification';
Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const fixture=()=>Uint8Array.from(fs.readFileSync(path.join(process.cwd(),'src/features/excel-converter/fixtures/xlsxwriter-vbaProject.bin')));
test('여러 줄 선언과 한글 함수 이름의 숨은 속성을 정확히 유지한다',()=>{
 const original='Attribute VB_Name = "Module1"\r\nPublic Function 정산(ByVal x As Double) As Double\r\nAttribute 정산.VB_Description = "original $1 $2"\r\nAttribute 정산.VB_UserMemId = 0\r\n정산 = x\r\nEnd Function';
 const requested='  Attribute VB_Name = "WrongModule"\r\nPublic Static Function 정산( _\r\n ByVal x As Double) As Double\r\n 정산 = x * 2\r\nEnd Function';
 const merged=mergeVbaModuleSource({code:original},requested);
 expect(merged).toContain('Attribute VB_Name = "Module1"');expect(merged).not.toContain('WrongModule');
 expect(merged).toContain('ByVal x As Double) As Double\r\nAttribute 정산.VB_Description = "original $1 $2"\r\nAttribute 정산.VB_UserMemId = 0\r\n 정산 = x * 2');
});
test('VBA 압축을 다중 청크와 복사 토큰으로 왕복하며 잘못된 범위를 거부한다',()=>{
 for(const text of ['abc','Option Explicit\r\n'.repeat(1000),'a'.repeat(4096),'test\r\n'.repeat(800)]){const b=Uint8Array.from(Buffer.from(text));expect(decompressVba(compressVba(b))).toEqual(b);}
 expect(()=>decompressVba(Uint8Array.from([1,2,176,1,0,0]))).toThrow();
});
test('기존 VBA 모듈을 실제 프로젝트에 저장하고 오래된 실행 캐시를 제거한다',()=>{
 const before=readVbaProject(fixture());expect(before.modules.map(m=>m.name)).toContain('Module1');
 const code='Option Explicit\r\nPublic Function EditedTotal(ByVal amount As Double) As Double\r\n  EditedTotal = Round(amount * 0.967, 0)\r\nEnd Function\r\n';
 const output=rewriteVbaProject(fixture(),[{module:'Module1',code}]),after=readVbaProject(output);
 expect(after.modules.find(m=>m.name==='Module1')?.code).toContain('EditedTotal = Round(amount * 0.967, 0)');
 for(const m of before.modules.filter(m=>m.name!=='Module1'))expect(after.modules.find(a=>a.name===m.name)?.code).toBe(m.code);
 expect(after.cfb.FullPaths.some(p=>p.includes('__SRP_'))).toBe(false);
 expect(Array.from(CFB.find(after.cfb,'/VBA/_VBA_PROJECT').content)).toEqual([204,97,255,255,0,0,0]);
 if(process.env.EXCEL_CODE_QA_OUTPUT)fs.writeFileSync(path.join(process.env.EXCEL_CODE_QA_OUTPUT,'edited-vbaProject.bin'),output);
});
test('원문 문자열과 주석은 AI에 전달하지 않고 로컬에서 복원한다',()=>{
 const mask=privateLiterals(),code='Option Explicit\r\nSub X()\r\n x = "private-secret" \' private-comment\r\nEnd Sub';
 const safe=mask.mask(code,true);expect(safe).not.toContain('private');expect(mask.restore(safe)).toContain('"private-secret"');
 expect(()=>mask.restore('"__LOCAL_LITERAL_999__"')).toThrow();
 const formula=mask.mask('\'Sheet One\'!A1&"private-value"');expect(formula).not.toContain('private-value');expect(mask.restore(formula)).toBe('\'Sheet One\'!A1&"private-value"');
});
test('변환한 XLSM 안에 수정 코드를 담고 다른 네이티브 구성은 보존한다',async()=>{
 const load=async(name:string)=>readWorkbook(Uint8Array.from(fs.readFileSync(path.join(process.cwd(),'public/excel-converter/examples',name))).buffer,name);
 const source=await load('20_현재노임명세서_2026-09_가상원본.xlsx'),original=await load('30_병합셀_타회사노임양식.xlsx'),zip=await JSZip.loadAsync(original.bytes);
 // Only our harmless function is retained; every host module has no executable body.
 const project=readVbaProject(fixture()),safe=project.modules.map(m=>({module:m.name,code:m.kind==='standard'?'Option Explicit\r\nPublic Function EditedTotal(ByVal amount As Double) As Double\r\n EditedTotal = amount\r\nEnd Function':'Option Explicit'}));
 zip.file('xl/vbaProject.bin',rewriteVbaProject(fixture(),safe));
 const types=xml(await zip.file('[Content_Types].xml')!.async('string'));let main=elements(types,'Override').find(e=>e.getAttribute('PartName')==='/xl/workbook.xml');if(!main){main=types.createElementNS(types.documentElement.namespaceURI,'Override');main.setAttribute('PartName','/xl/workbook.xml');types.documentElement.appendChild(main);}main.setAttribute('ContentType','application/vnd.ms-excel.sheet.macroEnabled.main+xml');
 const override=types.createElementNS(types.documentElement.namespaceURI,'Override');override.setAttribute('PartName','/xl/vbaProject.bin');override.setAttribute('ContentType','application/vnd.ms-office.vbaProject');types.documentElement.appendChild(override);zip.file('[Content_Types].xml',serializeXml(types));
 const rels=xml(await zip.file('xl/_rels/workbook.xml.rels')!.async('string')),rel=rels.createElementNS(rels.documentElement.namespaceURI,'Relationship');rel.setAttribute('Id','rIdVbaTest');rel.setAttribute('Type','http://schemas.microsoft.com/office/2006/relationships/vbaProject');rel.setAttribute('Target','vbaProject.bin');rels.documentElement.appendChild(rel);zip.file('xl/_rels/workbook.xml.rels',serializeXml(rels));
 const book=xml(await zip.file('xl/workbook.xml')!.async('string'));let pr=elements(book,'workbookPr')[0];if(!pr){pr=book.createElementNS(book.documentElement.namespaceURI,'workbookPr');book.documentElement.insertBefore(pr,book.documentElement.firstChild);}pr.setAttribute('codeName','ThisWorkbook');zip.file('xl/workbook.xml',serializeXml(book));
 const sheet=xml(await zip.file(original.sheets[0].path)!.async('string'));let sheetPr=elements(sheet,'sheetPr')[0];if(!sheetPr){sheetPr=sheet.createElementNS(sheet.documentElement.namespaceURI,'sheetPr');sheet.documentElement.insertBefore(sheetPr,sheet.documentElement.firstChild);}sheetPr.setAttribute('codeName','Sheet1');zip.file(original.sheets[0].path,serializeXml(sheet));
 const targetBytes=await zip.generateAsync({type:'arraybuffer'}),target=await readWorkbook(targetBytes,'macro-template.xlsm'),doc=readSourceDocument(source),plan=createDocumentPlan(target,doc);
 plan.macroEdits=[{module:'Module1',code:'Option Explicit\r\nPublic Function EditedTotal(ByVal amount As Double) As Double\r\n EditedTotal = Round(amount * 0.967, 0)\r\nEnd Function\r\nPublic Sub MarkReady()\r\n ThisWorkbook.Worksheets(1).Range("A2").Value = "Macro ready"\r\nEnd Sub'}];
 const result=await convertWorkbook(target,plan,doc.table);expect(result.outputs[0].name).toMatch(/\.xlsm$/);expect(result.issues.filter(i=>i.level==='error')).toEqual([]);expect((await verifyConversion(target,plan,doc.table,result)).issues.filter(i=>i.level==='error')).toEqual([]);
 if(process.env.EXCEL_CODE_QA_OUTPUT){fs.writeFileSync(path.join(process.env.EXCEL_CODE_QA_OUTPUT,'macro-template.xlsm'),Buffer.from(targetBytes));fs.writeFileSync(path.join(process.env.EXCEL_CODE_QA_OUTPUT,'macro-result.xlsm'),Buffer.from(result.outputs[0].bytes));}
});
