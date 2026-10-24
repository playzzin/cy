import fs from 'fs';
import path from 'path';
import {webcrypto} from 'crypto';
import JSZip from 'jszip';
import {readWorkbook,xml,elements,serializeXml} from './workbook';
import {createDocumentPlan,readSourceDocument} from './businessDocuments';
import {convertWorkbook} from './writer';
import {verifyConversion} from './verification';
import {applyEditDecision} from './editRequest';
import {editDecisionSchema} from './editingTypes';
import {applyFormulaEdits,translateFormula,validateFormula} from './formulaEditing';
import {evaluateCellFormula} from './formula';
import {ResultVersion,clonePlan,compareVersions} from './review';
Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const load=async(name:string)=>readWorkbook(Uint8Array.from(fs.readFileSync(path.join(process.cwd(),'public/excel-converter/examples',name))).buffer,name);
test('수식 편집·종속 합계·선택한 사람의 정렬·원본 보존을 함께 검증한다',async()=>{
 const source=await load('20_현재노임명세서_2026-09_가상원본.xlsx'),target=await load('30_병합셀_타회사노임양식.xlsx'),table=readSourceDocument(source).table,plan=createDocumentPlan(target,readSourceDocument(source));
 const original=await convertWorkbook(target,plan,table),base={id:'1',number:1,plan,result:original} as ResultVersion;
 const selection={revision:'1',outputIndex:0,sheet:plan.sheetName,address:'E7',scope:'cell' as const};
 const next=applyEditDecision(plan,editDecisionSchema.parse({dataRequest:'',summary:[],questions:[],resetAppearance:false,edits:[],values:[],formulas:[{range:'E7',formula:'=ROUND(C7*D7*0.967,0)'}]}),base,selection);
 const result=await convertWorkbook(target,next,table),sheet=result.outputs[0].sheets[0];
 expect(result.issues.filter(i=>i.level==='error')).toEqual([]);expect(result.issues.some(i=>i.code==='manual-recalculation')).toBe(true);
 expect(sheet.cells.find(c=>c.address==='E7')).toMatchObject({formula:'ROUND(C7*D7*0.967,0)',value:609210});expect(sheet.cells.find(c=>c.address==='E13')?.value).toBe(1249210);
 const zipDebug=await JSZip.loadAsync(target.bytes),expectedDoc=xml(await zipDebug.file(target.sheets[0].path)!.async('string'));applyFormulaEdits(expectedDoc,next.formulaEdits,result.outputs[0].traces);const resultZip=await JSZip.loadAsync(result.outputs[0].bytes),actualDoc=xml(await resultZip.file(sheet.path)!.async('string'));
 expect(elements(actualDoc,'f').map(f=>f.textContent)).toEqual(elements(expectedDoc,'f').map(f=>f.textContent));
 expect((await verifyConversion(target,next,table,result)).issues.filter(i=>i.level==='error')).toEqual([]);
 const sorted=clonePlan(next);sorted.rules.sort=[{key:'worker_name',direction:'desc'}];const sortedResult=await convertWorkbook(target,sorted,table);
 expect(sortedResult.outputs[0].sheets[0].cells.find(c=>c.address==='E11')).toMatchObject({formula:'ROUND(C11*D11*0.967,0)',value:609210});
 expect((await verifyConversion(target,sorted,table,sortedResult)).issues.filter(i=>i.level==='error')).toEqual([]);
 const corrupted=await JSZip.loadAsync(result.outputs[0].bytes),doc=xml(await corrupted.file(sheet.path)!.async('string'));const corruptCell=elements(doc,'c').find(c=>c.getAttribute('r')==='E9')!;elements(corruptCell,'f')[0].textContent='1';corrupted.file(sheet.path,serializeXml(doc));
 const wrong={...result,outputs:[{...result.outputs[0],bytes:await corrupted.generateAsync({type:'arraybuffer'})}]};expect((await verifyConversion(target,next,table,wrong)).issues.some(i=>i.code==='preservation')).toBe(true);
 if(process.env.EXCEL_CODE_QA_OUTPUT)fs.writeFileSync(path.join(process.env.EXCEL_CODE_QA_OUTPUT,'formula-result.xlsx'),Buffer.from(result.outputs[0].bytes));
});
test('상대 참조는 문자열·절대 참조·함수 이름을 손상시키지 않는다',()=>{
 expect(translateFormula('IF(A1>0,LOG10($B$2)+$C3+D$4,"A1")',2,1)).toBe('IF(B3>0,LOG10($B$2)+$C5+E$4,"A1")');
 expect(translateFormula('S1!A1+\'Sheet One\'!$B2',1,0)).toBe('S1!A2+\'Sheet One\'!$B3');
 const doc=xml('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="B1"><f t="shared" si="0" ref="B1:B2">A1*2</f></c></row><row r="2"><c r="B2"><f t="shared" si="0"/></c></row></sheetData></worksheet>');
 applyFormulaEdits(doc,[{range:'B1',formula:'A1*3'}]);expect(elements(doc,'f').map(f=>f.textContent)).toEqual(['A1*3','A2*2']);expect(elements(doc,'f').every(f=>!f.hasAttribute('si'))).toBe(true);
 expect(()=>applyFormulaEdits(doc,[{range:'B1',formula:'SUM(A1'}])).toThrow('괄호');
});
test('평균·조건부 합계·다중 조건 함수가 일치하는 범위를 계산한다',()=>{
 const values:Record<string,number|string>={A1:'가',A2:'나',A3:'가',B1:100,B2:200,B3:300,C1:1,C2:1,C3:2};const calc=(f:string)=>evaluateCellFormula(f,{lookup:a=>values[a]??null});
 expect(calc('AVERAGE(B1:B3)')).toBe(200);expect(calc('SUMIF(A1:A3,"가",B1:B3)')).toBe(400);expect(calc('SUMIFS(B1:B3,A1:A3,"가",C1:C3,">1")')).toBe(300);expect(calc('COUNTIFS(A1:A3,"가",B1:B3,">100")')).toBe(1);
});

test('표의 열 이름과 일반 문자열은 수식 참조나 외부 실행으로 오인하지 않는다',()=>{
 expect(translateFormula('SUM(Table1[[#Headers],[A1]])+SUM(Table1[B2])+A1',1,1)).toBe('SUM(Table1[[#Headers],[A1]])+SUM(Table1[B2])+B2');
 for(const formula of ['IF(A1="a|b","WEBSERVICE(","[book]Sheet!")','SUM(Table1[A1])+Sheet1!B1'])expect(validateFormula(formula)).toBe(formula);
 for(const formula of ["'[book.xlsx]Sheet One'!A1",'[1]Sheet1!A1','WEBSERVICE("https://example.com")',"'cmd'|'/c example'!A0"])expect(()=>validateFormula(formula)).toThrow('외부');
});
test('병합 셀 채우기는 보이는 기준 칸만 바꾸고 배열 수식과 외부 실행은 거부한다',()=>{
 const doc=xml('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"/><c r="B1"/></row><row r="2"><c r="A2"/></row></sheetData><mergeCells><mergeCell ref="A1:A2"/></mergeCells></worksheet>');
 expect([...applyFormulaEdits(doc,[{range:'A1:A2',formula:'B1*2'}]).keys()]).toEqual(['A1']);expect(elements(doc,'f')).toHaveLength(1);
 expect(()=>applyFormulaEdits(doc,[{range:'A2',formula:'1'}])).toThrow('병합');
 expect(()=>applyFormulaEdits(doc,[{range:'B1',formula:'WEBSERVICE("https://example.com")'}])).toThrow('외부');
 const f=elements(doc,'f')[0];f.setAttribute('t','array');f.setAttribute('ref','A1:B2');expect(()=>applyFormulaEdits(doc,[{range:'B1',formula:'1'}])).toThrow('배열');
});
