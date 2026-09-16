import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import { readWorkbook } from './workbook';
import { createDocumentPlan, documentTotals, readSourceDocument, validateAutomaticPlan } from './businessDocuments';
import { convertWorkbook } from './writer';
import { makePlannerRequest } from './plannerRequest';
import { validatePlanReferences } from './planning';
import { buildLaborStatementWorkbook } from '../../utils/excel/SupportPaymentExcelGenerator';
import { planSchema } from './types';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
const directory = path.join(process.cwd(),'public/excel-converter/examples');
const array = (bytes: Uint8Array) => { const data = new ArrayBuffer(bytes.length); new Uint8Array(data).set(bytes); return data; };
const read = (name: string) => readWorkbook(array(fs.readFileSync(path.join(directory,name))),name);
const outputDir = path.join(process.cwd(),'outputs/excel-converter/business/verified');
beforeAll(()=>fs.mkdirSync(outputDir,{recursive:true}));
test('현재 노임명세서 두 줄 구조에서 공수·전화·계좌·17/31일 값을 함께 읽는다',async()=>{
 const file=await read('20_현재노임명세서_2026-09_가상원본.xlsx');const source=readSourceDocument(file);
 expect(source.kind).toBe('labor');expect(source.table.warnings).toEqual([]);expect(documentTotals(source.table)).toMatchObject({people:3,manDays:7,amount:1270000});
 expect(source.table.rows[1].values.day31).toBe(1);expect(source.table.rows[0].values.day17).toBe(1);expect(source.table.rows[1].values.account_holder).toBe('가상반장');expect(source.table.rows[0].values.contact).toBe('010-0000-0001');
});
test('실제 기존 노임명세서 생성 함수의 출력도 같은 인식기로 처리한다',async()=>{
 const workbook=buildLaborStatementWorkbook([{siteName:'가상현장',settlementName:'테스트',direction:'out',rows:[{workerName:'가상인원',idNumber:'900101-1******',contact:'010-0000-0000',address:'가상주소',bankName:'가상은행',accountHolder:'가상인원',accountNumber:'000-001',payType:'direct',days:Array.from({length:31},(_,i)=>i===30?0.5:0),totalManDay:0.5,unitPrice:100000,totalAmount:50000,billingUnitPrice:120000,billingAmount:60000,vatAmount:0,issuedAmount:60000}]}],'2026-09');
 const source=readSourceDocument(await readWorkbook(array(new Uint8Array(await workbook.xlsx.writeBuffer())),'실제생성함수.xlsx'));
 expect(source.table.rows).toHaveLength(1);expect(source.table.rows[0].values.day31).toBe(0.5);expect(source.table.rows[0].values.billing_amount).toBe(60000);expect(source.table.warnings).toEqual([]);
});
test('노임명세서 변환 결과의 입력·합계 영역이 독립 정답과 일치한다',async()=>{
 const source=readSourceDocument(await read('20_현재노임명세서_2026-09_가상원본.xlsx'));const target=await read('21_타회사노임명세서_한줄양식.xlsx');const plan=createDocumentPlan(target,source);
 expect(validatePlanReferences(plan,source.table.fields)).toEqual([]);const result=await convertWorkbook(target,plan,source.table);expect(result.issues).toEqual([]);expect(result.outputs).toHaveLength(1);
 const expected=await read('22_노임명세서_정답예시.xlsx');for(const c of expected.sheets[0].cells.filter(c=>(c.row>=8&&c.row<=11)||c.address==='B4'))expect(result.outputs[0].sheets[0].cells.find(a=>a.address===c.address)?.value??null).toEqual(c.value);
 fs.writeFileSync(path.join(outputDir,'노임명세서_변환완료.xlsx'),Buffer.from(result.outputs[0].bytes));
});
test('위임인 목록과 수임인을 구분해 개인별 위임장 3개로 만든다',async()=>{
 const source=readSourceDocument(await read('10_현재위임장_가상원본.xlsx'));expect(source.table.rows).toHaveLength(3);expect(source.table.rows[0].values.trustee_name).toBe('가상반장');
 const target=await read('11_타회사위임장_개인별양식.xlsx');const plan=createDocumentPlan(target,source);expect(plan.mappings).toHaveLength(0);expect(plan.fixedCells).toHaveLength(13);expect(validatePlanReferences(plan,source.table.fields)).toEqual([]);
 const result=await convertWorkbook(target,plan,source.table);expect(result.issues).toEqual([]);expect(result.outputs).toHaveLength(3);const expected=await read('12_위임장_정답예시.xlsx');
 result.outputs.forEach((out,i)=>{for(const f of plan.fixedCells)expect(out.sheets[0].cells.find(c=>c.address===f.address)?.value??null).toEqual(expected.sheets[i].cells.find(c=>c.address===f.address)?.value??null);fs.writeFileSync(path.join(outputDir,`위임장_${i+1}_변환완료.xlsx`),Buffer.from(out.bytes));});
});
test('개인별 양식의 본문 아래쪽 필드도 AI에게 제공하고 원본 행은 보내지 않는다',async()=>{
 const source=readSourceDocument(await read('10_현재위임장_가상원본.xlsx'));const target=await read('11_타회사위임장_개인별양식.xlsx');const plan=createDocumentPlan(target,source);const request=makePlannerRequest('원본대로 변환',plan,source.table,target);
 expect(request.target.cells.some(c=>c.address==='A18'&&c.text==='수임인 계좌')).toBe(true);expect(JSON.stringify(request)).not.toContain('가상작업자 가');expect(JSON.stringify(request)).not.toContain('010-0000-0099');
 fs.writeFileSync(path.join(outputDir,'위임장_AI요청.json'),JSON.stringify(request,null,2));
 const labor=readSourceDocument(await read('20_현재노임명세서_2026-09_가상원본.xlsx'));const t=await read('21_타회사노임명세서_한줄양식.xlsx');fs.writeFileSync(path.join(outputDir,'노임명세서_AI요청.json'),JSON.stringify(makePlannerRequest('모든 작업자를 원본대로 변환. 세금이나 공제 추가 금지.',createDocumentPlan(t,labor),labor.table,t),null,2));
});
test.each([
 ['위임장','10_현재위임장_가상원본.xlsx','11_타회사위임장_개인별양식.xlsx','12_위임장_정답예시.xlsx'],
 ['노임명세서','20_현재노임명세서_2026-09_가상원본.xlsx','21_타회사노임명세서_한줄양식.xlsx','22_노임명세서_정답예시.xlsx'],
])('실제 Gemini 응답 회귀 검증: %s의 생성 파일이 독립 정답과 일치한다',async(label,sourceName,targetName,expectedName)=>{
 const recorded=JSON.parse(fs.readFileSync(path.join(process.cwd(),'fixtures/excel-converter-preview/recorded-plans.json'),'utf8'))[label];
 const source=readSourceDocument(await read(sourceName)),target=await read(targetName),expected=await read(expectedName);
 const base=createDocumentPlan(target,source);const plan=planSchema.parse({...recorded.plan,targetId:target.id,mappings:recorded.plan.mappings.map((m:any)=>({...m,verifyKey:base.mappings.find(b=>b.targetColumn===m.targetColumn)?.verifyKey||''}))});
 const result=await convertWorkbook(target,plan,source.table);expect(result.issues).toEqual([]);expect(result.outputCount).toBe(3);expect(result.outputs.length).toBe(label==='위임장'?3:1);
 result.outputs.forEach((out,i)=>{const addresses=label==='위임장'?plan.fixedCells.map(f=>f.address):expected.sheets[0].cells.filter(c=>(c.row>=8&&c.row<=11)||c.address==='B4').map(c=>c.address);for(const address of addresses)expect(out.sheets[0].cells.find(c=>c.address===address)?.value??null).toEqual(expected.sheets[i].cells.find(c=>c.address===address)?.value??null);fs.writeFileSync(path.join(outputDir,`${label}_Gemini검증_${i+1}.xlsx`),Buffer.from(out.bytes));});
});
test('자동 변환은 알려진 개인정보 연결·금액 계산 변경과 누락을 막고 개인별 파일 분리는 허용한다',async()=>{
 const source=readSourceDocument(await read('10_현재위임장_가상원본.xlsx'));const target=await read('11_타회사위임장_개인별양식.xlsx');const base=createDocumentPlan(target,source);
 expect(()=>validateAutomaticPlan(base,{...base,rules:{...base.rules,splitBy:'c2'}})).not.toThrow();
 expect(()=>validateAutomaticPlan(base,{...base,endRow:999})).toThrow('입력 범위');
 expect(()=>validateAutomaticPlan(base,{...base,fixedCells:base.fixedCells.filter(f=>f.address!=='C13')})).toThrow('수임인');
 const wrong=planSchema.parse(base);wrong.fixedCells.find(f=>f.address==='C13')!.mapping.sourceKeys=['c2'];expect(()=>validateAutomaticPlan(base,wrong)).toThrow('원본 연결');
});
