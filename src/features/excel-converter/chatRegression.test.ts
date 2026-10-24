import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import JSZip from 'jszip';
import { elements, readWorkbook, serializeXml, xml } from './workbook';
import { createDocumentPlan, readSourceDocument } from './businessDocuments';
import { convertWorkbook } from './writer';
import { verifyConversion } from './verification';
import { editSelectedCell, ResultVersion } from './review';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
const read = async(name:string) => {
  const data=fs.readFileSync(path.join(process.cwd(),'public/excel-converter/examples',name));
  const bytes=new ArrayBuffer(data.length);new Uint8Array(bytes).set(data);return readWorkbook(bytes,name);
};
const cases=['기본','긴한글','줄바꿈','빈주소','앞자리0','다른이름','내림차순','인원제외','주소수정','단가수정'];
const forms=['21_타회사노임명세서_한줄양식.xlsx','30_병합셀_타회사노임양식.xlsx'];
const measurements:{scenario:string;template:string;elapsedMs:number;records:number}[]=[];

test.each(forms.flatMap(form=>cases.map(scenario=>[form,scenario])))('대표 파일 회귀: %s / %s',async(form,scenario)=>{
  const started=Date.now(),original=await read('20_현재노임명세서_2026-09_가상원본.xlsx');
  const zip=await JSZip.loadAsync(original.bytes),sheet=xml(await zip.file(original.sheets[0].path)!.async('string'));
  const changes:Record<string,[string,string]>={긴한글:['D5','가상주소 '.repeat(70)],줄바꿈:['D5','가상시\n테스트로 1\n101동 1001호'],빈주소:['D5',''],앞자리0:['X5','직불\n가상은행 / 가상작업자 가 / 000000000001'],다른이름:['B5','가상작업자 긴 이름 가나다라마']};
  const mutation=changes[scenario];
  if(mutation){const cell=elements(sheet,'c').find(c=>c.getAttribute('r')===mutation[0])!;while(cell.firstChild)cell.removeChild(cell.firstChild);cell.setAttribute('t','inlineStr');const inline=sheet.createElementNS(cell.namespaceURI,'is'),text=sheet.createElementNS(cell.namespaceURI,'t');text.setAttribute('xml:space','preserve');text.textContent=mutation[1];inline.appendChild(text);cell.appendChild(inline);}
  zip.file(original.sheets[0].path,serializeXml(sheet));
  const source=await readWorkbook(await zip.generateAsync({type:'arraybuffer'}),`가상원본_${scenario}.xlsx`),target=await read(form),document=readSourceDocument(source);
  let plan=createDocumentPlan(target,document);
  if(scenario==='내림차순')plan.rules.sort=[{key:'worker_name',direction:'desc'}];
  if(scenario==='인원제외')plan.rules.filters=[{key:'worker_name',op:'neq',value:'가상작업자 나'}];
  let result=await convertWorkbook(target,plan,document.table);
  if(scenario==='주소수정'||scenario==='단가수정'){
    const trace=result.outputs[0].traces.find(t=>t.label===(scenario==='주소수정'?'주소':'청구단가'))!;
    const base:ResultVersion={id:'base',number:1,createdAt:Date.now(),history:[],request:'회귀 검증',plan,result,reused:false,verification:(await verifyConversion(target,plan,document.table,result)).summary};
    plan=editSelectedCell(base,{revision:'base',outputIndex:0,sheet:trace.sheet,address:trace.address,scope:'cell'},scenario==='주소수정'?'직접 수정한 가상주소':190000,scenario==='주소수정'?'text':'number');
    result=await convertWorkbook(target,plan,document.table);
  }
  const checked=await verifyConversion(target,plan,document.table,result);
  expect(result.issues.filter(i=>i.level==='error')).toEqual([]);expect(checked.issues.filter(i=>i.level==='error')).toEqual([]);
  expect(result.outputCount).toBe(scenario==='인원제외'?2:3);expect(checked.summary.preservationChecked).toBe(true);
  const output=await readWorkbook(result.outputs[0].bytes,result.outputs[0].name),cells=output.sheets[0].cells;
  expect(cells.some(c=>c.value===(scenario==='인원제외'?870000:scenario==='단가수정'?1305000:1270000))).toBe(true);
  const nameColumn=plan.mappings.find(m=>m.sourceKeys.includes('worker_name'))!.targetColumn;
  const names=cells.filter(c=>c.col===nameColumn&&typeof c.value==='string'&&c.value.startsWith('가상작업자')).map(c=>c.value);
  const expectedNames=scenario==='내림차순'?['가상작업자 다','가상작업자 나','가상작업자 가']:scenario==='인원제외'?['가상작업자 가','가상작업자 다']:[scenario==='다른이름'?mutation[1]:'가상작업자 가','가상작업자 나','가상작업자 다'];
  expect(names).toEqual(expectedNames);
  const expectedValue=scenario==='앞자리0'?'000000000001':scenario==='주소수정'?'직접 수정한 가상주소':mutation?.[1]||null;
  expect(expectedValue===null||cells.some(c=>c.value===expectedValue)).toBe(true);
  expect(scenario!=='앞자리0'||cells.some(c=>c.value==='000000000001'&&c.displayText==='000000000001')).toBe(true);
  expect(output.sheets[0].merges).toEqual(target.sheets[0].merges);
  measurements.push({scenario,template:form,elapsedMs:Date.now()-started,records:result.outputCount});
});

afterAll(()=>{
  const dir=path.join(process.cwd(),'outputs/excel-converter/chat-validation');fs.mkdirSync(dir,{recursive:true});
  const times=measurements.map(m=>m.elapsedMs).sort((a,b)=>a-b);
  fs.writeFileSync(path.join(dir,'synthetic-matrix.json'),JSON.stringify({createdAt:new Date().toISOString(),scope:'20 synthetic file and request combinations; local processing only, no live AI or native Excel',medianMs:times[Math.floor(times.length/2)],p95Ms:times[Math.ceil(times.length*.95)-1],measurements},null,2));
});
