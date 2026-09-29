import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import JSZip from 'jszip';
import { readWorkbook } from './workbook';
import { createDocumentPlan, readSourceDocument } from './businessDocuments';
import { convertWorkbook } from './writer';
import { verifyConversion, planProblems } from './verification';
import { clonePlan, compareVersions, editSelectedCell, explainSelection, ResultVersion, sourceLocation } from './review';
import { explainRequest, isExplanationRequest, preserveUnrequestedRules, selectedRequest } from './chatActions';
import { restoreChatSession } from './chatStorage';
import { ConversionPlan, ENGINE_VERSION } from './types';
Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const load = async(name:string) => {const bytes=fs.readFileSync(path.join(process.cwd(),'public/excel-converter/examples',name));const buffer=new ArrayBuffer(bytes.length);new Uint8Array(buffer).set(bytes);return readWorkbook(buffer,name);};
let source:Awaited<ReturnType<typeof load>>,target:Awaited<ReturnType<typeof load>>,document:ReturnType<typeof readSourceDocument>,initial:ResultVersion;
async function version(plan:ConversionPlan,number=1,parentId?:string):Promise<ResultVersion>{
 const result=await convertWorkbook(target,plan,document.table);
 const verified=await verifyConversion(target,plan,document.table,result);
 expect(result.issues.filter(i=>i.level==='error')).toEqual([]);expect(verified.issues.filter(i=>i.level==='error')).toEqual([]);
 return {id:`v${number}`,number,parentId,plan:clonePlan(plan),createdAt:Date.now(),history:[],request:'검증 요청',reused:false,result,verification:verified.summary};
}
beforeAll(async()=>{source=await load('20_현재노임명세서_2026-09_가상원본.xlsx');target=await load('30_병합셀_타회사노임양식.xlsx');document=readSourceDocument(source);initial=await version(createDocumentPlan(target,document));});

test('변경 설명은 실제 차이를 답하며 정렬해서 보여달라는 요청은 수정으로 처리한다',async()=>{
 expect(isExplanationRequest('주소를 변경해서 보여줘')).toBe(false);
 expect(isExplanationRequest('이름순으로 정렬해서 보여줘')).toBe(false);
 expect(isExplanationRequest('주소를 수정하고 보여줘')).toBe(false);
 expect(isExplanationRequest('경고가 있어?')).toBe(true);
 expect(isExplanationRequest('문제 확인해줘')).toBe(true);
 expect(isExplanationRequest('이전 결과에서 뭐가 바뀌었어?')).toBe(true);
 const plan=clonePlan(initial.plan);plan.rules.sort=[{key:'worker_name',direction:'desc'}];const sorted=await version(plan,2,initial.id);
 const explanation=explainRequest('이전 결과와 무엇이 달라졌어?',sorted,document.table,undefined,initial);
 expect(explanation).toContain('행 이동 2행');expect(explanation).not.toContain('값 변경');
 const edited=await version(editSelectedCell(initial,{revision:initial.id,outputIndex:0,sheet:initial.plan.sheetName,address:'B7',scope:'cell'},'변경된 가상주소','text'),2,initial.id);
 expect(explainRequest('변경 내역 알려줘',edited,document.table,undefined,initial)).toContain('예시시 가상로 1 → 변경된 가상주소');
});

test('정렬은 값 변경 없이 행 이동으로 비교하고 수정과 계산 변화는 구분한다',async()=>{
 const plan=clonePlan(initial.plan);plan.rules.sort=[{key:'worker_name',direction:'desc'}];
 const sorted=await version(plan,2,initial.id),diff=compareVersions(sorted,initial);
 expect(diff.filter(c=>c.kind==='changed')).toHaveLength(0);expect(diff.filter(c=>c.kind==='moved')).toHaveLength(2);
 const selection={revision:sorted.id,outputIndex:0,sheet:sorted.plan.sheetName,address:'B7',scope:'cell' as const};
 const edited=await version(editSelectedCell(sorted,selection,'수정한 가상주소','text'),3,sorted.id);
 expect(compareVersions(edited,sorted).filter(c=>c.kind==='changed')).toHaveLength(1);
 const next=clonePlan(edited.plan);next.rules.sort=[{key:'worker_name',direction:'asc'}];
 const resorted=await version(next,4,edited.id);
 expect(resorted.result.outputs[0].sheets[0].cells.find(c=>c.address==='B11')?.value).toBe('수정한 가상주소');
});

test('전체 인원 복원과 개별 작성 전환은 허용하되 새 제외·합산은 허용하지 않는다',()=>{
 const filtered=clonePlan(initial.plan);filtered.rules.filters=[{key:'man_days',op:'gte',value:'2'}];
 const restored=clonePlan(filtered);restored.rules.filters=[];
 expect(planProblems(restored,document.table,filtered,'전체 인원을 복원해줘')).toEqual([]);
 expect(planProblems(filtered,document.table,initial.plan,'전체 인원을 복원해줘')).toEqual(expect.arrayContaining([expect.objectContaining({code:'unrequested-filter'})]));
 expect(planProblems(restored,document.table,filtered,'주소를 바꿔줘')).toEqual(expect.arrayContaining([expect.objectContaining({code:'unrequested-filter'})]));
 const grouped=clonePlan(initial.plan);grouped.rules.groupBy=['worker_name'];grouped.rules.sums=['man_days'];
 expect(planProblems(initial.plan,document.table,grouped,'다시 개별로 작성해줘')).toEqual([]);
 expect(planProblems(grouped,document.table,initial.plan,'다시 개별로 작성해줘')).toEqual(expect.arrayContaining([expect.objectContaining({code:'unrequested-group'})]));
});

test('정렬해도 현장명 같은 공통 입력칸을 추가·제외로 잘못 표시하지 않는다',async()=>{
 const base=clonePlan(initial.plan);
 const mapping={...base.mappings[0],label:'현장명',mode:'constant' as const,sourceKeys:[],constant:'검증 현장',format:'text' as const};
 base.fixedCells=[{address:'B4',mapping}];
 const before=await version(base),sortedPlan=clonePlan(base);sortedPlan.rules.sort=[{key:'worker_name',direction:'desc'}];
 const sorted=await version(sortedPlan,2,before.id);
 expect(compareVersions(sorted,before).map(c=>c.kind)).toEqual(['moved','moved']);
 sortedPlan.fixedCells[0].mapping.constant='바뀐 검증 현장';
 const changed=await version(sortedPlan,3,sorted.id);
 expect(compareVersions(changed,sorted).map(c=>[c.kind,c.label,c.before,c.after])).toEqual([['changed','현장명','검증 현장','바뀐 검증 현장']]);
});

test('선택한 셀의 자연어 변경은 선택 밖의 값과 기존 규칙을 보존한다',async()=>{
 const selection={revision:initial.id,outputIndex:0,sheet:initial.plan.sheetName,address:'B7',scope:'cell' as const};
 const next=selectedRequest(initial,selection,'이 칸을 서울로 바꿔줘');
 expect(next.overrides[0].value).toBe('서울');
 const result=await version(next,2,initial.id);
 expect(compareVersions(result,initial).map(c=>c.location.address)).toEqual(['B7']);
 expect(()=>selectedRequest(initial,{...selection,scope:'row'},'이 행을 바꿔줘')).toThrow('항목을 하나');
 expect(()=>editSelectedCell(initial,{...selection,address:'E7'},123,'number')).toThrow('수식');
});

test('수정한 입력값으로 수식이 바뀌면 계산값을 보존하고 확인 경고를 제공한다',async()=>{
 const selection={revision:initial.id,outputIndex:0,sheet:initial.plan.sheetName,address:'D7',scope:'cell' as const};
 const edited=await version(editSelectedCell(initial,selection,190000,'number'),2,initial.id);
 expect(edited.result.outputs[0].sheets[0].cells.find(c=>c.address==='E7')?.value).toBe(665000);
 expect(edited.result.issues.some(i=>i.code==='manual-recalculation'&&i.level==='warning')).toBe(true);
 expect(compareVersions(edited,initial).filter(c=>c.kind==='changed').map(c=>c.location.address)).toEqual(expect.arrayContaining(['D7','E7','E13']));
});

test('원본 위치와 계산식 근거를 파일의 실제 데이터에서 찾는다',()=>{
 const selection={revision:initial.id,outputIndex:0,sheet:initial.plan.sheetName,address:'B7',scope:'cell' as const};
 const trace=initial.result.outputs[0].traces.find(t=>t.address==='B7')!;
 expect(explainSelection(initial,document.table,selection)).toContain('예시시 가상로 1');
 expect(sourceLocation(trace,source,document.table,initial.plan)).toMatchObject({stage:'source',sheet:source.sheets[0].name});
 expect(explainSelection(initial,document.table,{...selection,address:'E7'})).toContain('양식의 수식');
});

test('설명 질문을 수정과 구분하고 12차례 후속 요청에도 정렬·고정값을 유지한다',()=>{
 expect(isExplanationRequest('이 금액은 왜 이렇게 나왔어?')).toBe(true);
 expect(isExplanationRequest('주소를 바꿔줘')).toBe(false);
 let plan=clonePlan(initial.plan);plan.rules.sort=[{key:'worker_name',direction:'desc'}];
 plan.fixedCells[0].mapping={...plan.fixedCells[0].mapping,mode:'constant',constant:'가상 테스트현장'};
 for(let i=0;i<12;i++){
  const proposal=clonePlan(plan);proposal.rules.sort=[];proposal.fixedCells[0].mapping.mode='copy';proposal.fixedCells[0].mapping.constant=null;
  const next=preserveUnrequestedRules(proposal,plan,'서명란을 비워줘');
  expect(next.rules.sort).toEqual([{key:'worker_name',direction:'desc'}]);
  expect(next.fixedCells[0].mapping.constant).toBe('가상 테스트현장');
  expect(planProblems(next,document.table,plan,'서명란을 비워줘').filter(i=>i.code==='invented-constant')).toHaveLength(0);plan=next;
 }
});

test('직접 수정한 인원을 필터로 제외했다 복원해도 수정값을 유지한다',async()=>{
 const edit=editSelectedCell(initial,{revision:initial.id,outputIndex:0,sheet:initial.plan.sheetName,address:'B7',scope:'cell'},'보관할 수정주소','text');
 const filtered=clonePlan(edit);filtered.rules.filters=[{key:'worker_name',op:'neq',value:'가상작업자 가'}];
 const hidden=await version(filtered,2,initial.id);expect(hidden.result.outputCount).toBe(2);
 const restored=clonePlan(hidden.plan);restored.rules.filters=[];
 const result=await version(restored,3,hidden.id);expect(result.result.outputs[0].sheets[0].cells.find(c=>c.address==='B7')?.value).toBe('보관할 수정주소');
});

test('개인별 위임장은 선택한 사람의 고정 위치만 수정하고 다른 출력은 보존한다',async()=>{
 const input=await load('10_현재위임장_가상원본.xlsx'),form=await load('11_타회사위임장_개인별양식.xlsx');
 const doc=readSourceDocument(input),plan=createDocumentPlan(form,doc),result=await convertWorkbook(form,plan,doc.table);
 const base:ResultVersion={...initial,id:'delegation',plan,result};
 const trace=result.outputs[1].traces.find(t=>t.label==='주소')!;
 const next=editSelectedCell(base,{revision:base.id,outputIndex:1,sheet:trace.sheet,address:trace.address,scope:'cell'},'서울 위임인 주소','text');
 const edited=await convertWorkbook(form,next,doc.table),checked=await verifyConversion(form,next,doc.table,edited);
 expect(edited.issues.filter(i=>i.level==='error')).toEqual([]);expect(checked.issues.filter(i=>i.level==='error')).toEqual([]);
 expect(edited.outputs[1].sheets[0].cells.find(c=>c.address===trace.address)?.value).toBe('서울 위임인 주소');
 expect(edited.outputs[0].sheets[0].cells.map(c=>c.value)).toEqual(result.outputs[0].sheets[0].cells.map(c=>c.value));
});

test('작업 복구는 실제 파일을 다시 읽으며 계정·버전·손상 데이터를 검사한다',async()=>{
 const raw={schema:1,engine:ENGINE_VERSION,id:'session',ownerId:'test',name:'검증작업',updatedAt:Date.now(),expiresAt:Date.now()+86400000,files:[source,target],sheets:[source.sheets[0].name,target.sheets[0].name],messages:[],activeHistory:[],versions:[initial],plan:initial.plan,previewId:initial.id,baseId:initial.id,draft:'이어서 요청',accepted:[]};
 const restored=await restoreChatSession(raw,'test');
 expect(restored.versions[0].result.outputs[0].sheets[0].cells.find(c=>c.address==='E13')?.value).toBe(1270000);
 expect(restored.draft).toBe('이어서 요청');
 await expect(restoreChatSession(raw,'other')).rejects.toThrow('계정');
 await expect(restoreChatSession({...raw,baseId:'missing'},'test')).rejects.toThrow('선택 결과');
 await expect(restoreChatSession({...raw,versions:[{...initial,plan:{}}]},'test')).rejects.toThrow('형식');
});

test('표시 형식은 날짜·백분율·금액·앞자리 0·줄바꿈을 보존한다',async()=>{
 const zip=await JSZip.loadAsync(target.bytes);
 let styles=await zip.file('xl/styles.xml')!.async('string');
 const parser=new DOMParser(),doc=parser.parseFromString(styles,'application/xml');
 const ns=doc.documentElement.namespaceURI!;let formats=doc.getElementsByTagNameNS('*','numFmts')[0];if(!formats){formats=doc.createElementNS(ns,'numFmts');doc.documentElement.prepend(formats);}
 const xfs=doc.getElementsByTagNameNS('*','cellXfs')[0];const start=xfs.children.length;
 ['yyyy.mm.dd','0.00%','#,##0"원"','000000'].forEach((format,i)=>{const num=doc.createElementNS(ns,'numFmt');num.setAttribute('numFmtId',String(210+i));num.setAttribute('formatCode',format);formats.appendChild(num);const xf=xfs.children[0].cloneNode(true) as Element;xf.setAttribute('numFmtId',String(210+i));xfs.appendChild(xf);});
 formats.setAttribute('count',String(formats.children.length));xfs.setAttribute('count',String(xfs.children.length));
 zip.file('xl/styles.xml',new XMLSerializer().serializeToString(doc));
 const sheet=parser.parseFromString(await zip.file(target.sheets[0].path)!.async('string'),'application/xml');
 const data=sheet.getElementsByTagNameNS('*','sheetData')[0];
 const row=sheet.createElementNS(ns,'row');row.setAttribute('r','20');
 [45292,.125,1234567,123].forEach((value,i)=>{const cell=sheet.createElementNS(ns,'c');cell.setAttribute('r',String.fromCharCode(65+i)+'20');cell.setAttribute('s',String(start+i));const v=sheet.createElementNS(ns,'v');v.textContent=String(value);cell.appendChild(v);row.appendChild(cell);});data.appendChild(row);
 // Native Excel displays hashes if the test's currency cell is narrower than its formatted value.
 Array.from(sheet.getElementsByTagNameNS('*','col')).filter(c=>Number(c.getAttribute('min'))<=3&&Number(c.getAttribute('max'))>=3).forEach(c=>c.setAttribute('width','20'));
 zip.file(target.sheets[0].path,new XMLSerializer().serializeToString(sheet));
 const bytes=await zip.generateAsync({type:'arraybuffer'});
 if(process.env.EXCEL_QA_FIXTURE_DIR){fs.mkdirSync(process.env.EXCEL_QA_FIXTURE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.EXCEL_QA_FIXTURE_DIR,'display-formats.xlsx'),Buffer.from(bytes));}
 const workbook=await readWorkbook(bytes,'서식검증.xlsx');
 expect(workbook.sheets[0].cells.filter(c=>c.row===20).map(c=>c.displayText)).toEqual(['2024.01.01','12.50%','1,234,567원','000123']);
 expect(workbook.sheets[0].cells.find(c=>c.address==='D20')?.value).toBe('000123');
});
