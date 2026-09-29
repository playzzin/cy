import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import JSZip from 'jszip';
import { readWorkbook, xml, elements, serializeXml } from './workbook';
import { createDocumentPlan, readSourceDocument } from './businessDocuments';
import { convertWorkbook } from './writer';
import { verifyConversion } from './verification';
import { clonePlan, compareVersions, ResultVersion } from './review';
import { applyEditDecision, makeEditingContext } from './editRequest';
import { editDecisionSchema } from './editingTypes';
import { ConversionPlan } from './types';
import { restoreChatSession } from './chatStorage';
import { isExplanationRequest } from './chatActions';
import { ENGINE_VERSION } from './types';

Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const load=async(name:string)=>{const b=fs.readFileSync(path.join(process.cwd(),'public/excel-converter/examples',name));return readWorkbook(Uint8Array.from(b).buffer,name);};
let source:Awaited<ReturnType<typeof load>>,target:Awaited<ReturnType<typeof load>>,document:ReturnType<typeof readSourceDocument>,base:ResultVersion;
const decision=(extra:object)=>editDecisionSchema.parse({dataRequest:'',summary:['요청한 서식을 적용했습니다.'],questions:[],resetAppearance:false,edits:[],values:[],...extra});
async function version(plan:ConversionPlan,number=2){const result=await convertWorkbook(target,plan,document.table),checked=await verifyConversion(target,plan,document.table,result);expect(result.issues.filter(i=>i.level==='error')).toEqual([]);expect(checked.issues.filter(i=>i.level==='error')).toEqual([]);return {id:`v${number}`,number,parentId:base?.id,plan,result,verification:checked.summary,history:[],createdAt:Date.now(),request:'서식 검증',reused:false} as ResultVersion;}
beforeAll(async()=>{source=await load('20_현재노임명세서_2026-09_가상원본.xlsx');target=await load('30_병합셀_타회사노임양식.xlsx');document=readSourceDocument(source);base=await version(createDocumentPlan(target,document),1);});

test('글꼴·색상·숫자 표시·열 너비·인쇄를 적용하면서 데이터와 수식을 보존한다',async()=>{
  const next=applyEditDecision(base.plan,decision({edits:[
    {kind:'style',range:'A2:G2',style:{fontName:'맑은 고딕',fontSize:20,bold:true,italic:true,underline:true,color:'#FFFFFF',background:'#174C63',align:'center',vertical:'center',wrap:true}},
    {kind:'style',range:'A5:G6',style:{background:'#DCECF1',bold:true,border:'medium',borderColor:'#174C63',align:'center'}},
    {kind:'style',range:'E7:E13',style:{numberFormat:'#,##0"원"'}},
    {kind:'columns',range:'B1:B15',width:28},{kind:'rows',range:'A2:G2',height:38},
    {kind:'page',orientation:'landscape',paper:'A4',fitWidth:1,fitHeight:1},
  ]}),base);
  const changed=await version(next),sheet=changed.result.outputs[0].sheets[0],get=(a:string)=>sheet.cells.find(c=>c.address===a)!;
  expect(sheet.presentation?.styles[get('A2').style]).toMatchObject({fontName:'맑은 고딕',fontSize:20,bold:true,italic:true,underline:true,color:'#FFFFFF',background:'#174C63',align:'center',vertical:'middle',wrap:true});
  expect(get('E7')).toMatchObject({formula:'C7*D7',value:630000,displayText:'630,000원'});
  expect(get('E13').value).toBe(1270000);expect(get('F7').value).toBe('000-00-000001');
  expect(sheet.presentation?.widths[2]).toBe(201);expect(sheet.presentation?.heights[2]).toBeCloseTo(38*4/3);
  expect(sheet.merges).toEqual(base.result.outputs[0].sheets[0].merges);
  expect(compareVersions(changed,base).filter(c=>c.kind==='formatted')).toHaveLength(1);
  expect(compareVersions(changed,base).filter(c=>c.kind==='changed')).toHaveLength(0);
  const zip=await JSZip.loadAsync(changed.result.outputs[0].bytes),doc=xml(await zip.file(sheet.path)!.async('string'));
  expect(elements(doc,'pageSetup')[0].getAttribute('fitToWidth')).toBe('1');expect(elements(doc,'pageSetup')[0].getAttribute('orientation')).toBe('landscape');
  if(process.env.EXCEL_EDIT_QA_OUTPUT){fs.mkdirSync(process.env.EXCEL_EDIT_QA_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.EXCEL_EDIT_QA_OUTPUT,'styled-result.xlsx'),Buffer.from(changed.result.outputs[0].bytes));}
  const restored=await version(applyEditDecision(changed.plan,decision({resetAppearance:true}),changed),3);
  expect(compareVersions(restored,base)).toEqual([]);
});

test('선택한 사람의 셀 색상과 값은 정렬 뒤에도 그 사람을 따라간다',async()=>{
  const selected={revision:base.id,outputIndex:0,sheet:base.plan.sheetName,address:'B7',scope:'cell' as const};
  const edited=await version(applyEditDecision(base.plan,decision({edits:[{kind:'style',range:'B7:B8',style:{background:'#FFF1A8'}}],values:[{address:'B7',value:'수정 주소'}]}),base,selected));
  const sortedPlan=clonePlan(edited.plan);sortedPlan.rules.sort=[{key:'worker_name',direction:'desc'}];
  const sorted=await version(sortedPlan,3),sheet=sorted.result.outputs[0].sheets[0];
  const chosen=sheet.cells.find(c=>c.address==='B11')!;expect(chosen.value).toBe('수정 주소');expect(sheet.presentation?.styles[chosen.style].background).toBe('#FFF1A8');
  const other=sheet.cells.find(c=>c.address==='B7')!;expect(sheet.presentation?.styles[other.style].background).not.toBe('#FFF1A8');
});

test('제목과 공통 항목을 대화로 바꾸고 수식 값 덮어쓰기는 막는다',async()=>{
  const edited=await version(applyEditDecision(base.plan,decision({values:[{address:'A2',value:'9월 현장 노임 정산'},{address:'B4',value:'새로운 현장'}]}),base));
  const sheet=edited.result.outputs[0].sheets[0];expect(sheet.cells.find(c=>c.address==='A2')?.value).toBe('9월 현장 노임 정산');expect(sheet.cells.find(c=>c.address==='B4')?.value).toBe('새로운 현장');
  expect(()=>applyEditDecision(base.plan,decision({values:[{address:'E7',value:1}]}),base)).toThrow('수식');
});

test('다른 시트나 오래된 결과의 선택을 현재 시트의 같은 주소에 적용하지 않는다',()=>{
 const other={...base,result:{...base.result,outputs:[{...base.result.outputs[0],sheets:[...base.result.outputs[0].sheets,{...base.result.outputs[0].sheets[0],name:'다른 시트'}]}]}};
 const selection={revision:base.id,outputIndex:0,sheet:'다른 시트',address:'A2',scope:'cell' as const};
 expect(()=>makeEditingContext({request:'이 칸을 파랗게',plan:base.plan,table:document.table,target,version:other,selection,history:[]})).toThrow('변환 대상');
 expect(()=>applyEditDecision(base.plan,decision({edits:[{kind:'style',range:'A2',style:{background:'#DDEEFF'}}]}),other,selection)).toThrow('변환 대상');
 expect(()=>applyEditDecision(base.plan,decision({}),base,{...selection,sheet:base.plan.sheetName,revision:'old'})).toThrow('다시 선택');
});

test('내용을 가리는 병합은 거부하며 빈칸 병합·해제와 요청한 배치는 허용한다',async()=>{
  await expect(version(applyEditDecision(base.plan,decision({edits:[{kind:'merge',range:'A7:B8'}]}),base))).rejects.toThrow('내용');
  const unmerged=await version(applyEditDecision(base.plan,decision({edits:[{kind:'unmerge',range:'A2:G2'},{kind:'merge',range:'A2:G2'}]}),base));
  expect(unmerged.result.outputs[0].sheets[0].merges).toContain('A2:G2');
  expect(()=>applyEditDecision(base.plan,decision({edits:[{kind:'style',range:'A1:Z30000',style:{bold:true}}]}),base)).toThrow('범위');
  const corrupt=await JSZip.loadAsync(base.result.outputs[0].bytes),sheet=base.result.outputs[0].sheets[0],doc=xml(await corrupt.file(sheet.path)!.async('string'));
  elements(doc,'col')[0].setAttribute('width','70');corrupt.file(sheet.path,serializeXml(doc));
  const bytes=await corrupt.generateAsync({type:'arraybuffer'});
  const result={...base.result,outputs:[{...base.result.outputs[0],bytes}]};
  expect((await verifyConversion(target,base.plan,document.table,result)).issues.some(i=>i.code==='preservation')).toBe(true);
});

test('AI에는 문서 원본 값 대신 구조와 서식만 전달하고 보관 복원에도 편집을 유지한다',async()=>{
  const plan=applyEditDecision(base.plan,decision({edits:[{kind:'style',range:'B7',style:{bold:true}}]}),base,{revision:base.id,outputIndex:0,sheet:base.plan.sheetName,address:'B7',scope:'cell'});
  const context=JSON.stringify(makeEditingContext({request:'이 칸을 굵게',plan,table:document.table,target,version:base,selection:{revision:base.id,outputIndex:0,sheet:base.plan.sheetName,address:'B7',scope:'cell'},history:[]}));
  expect(context).not.toContain('예시시 가상로 1');expect(context).not.toContain('000-00-000001');expect(context).not.toContain('가상작업자');expect(context).not.toContain('recordKey');
  const now=Date.now();const restored=await restoreChatSession({schema:1,engine:ENGINE_VERSION,id:'edits',ownerId:'test',name:'test',updatedAt:now,expiresAt:now+86400000,files:[source,target],sheets:[source.sheets[0].name,target.sheets[0].name],messages:[],activeHistory:[],versions:[],plan,previewId:'',baseId:'',draft:'',accepted:[]},'test');
  expect(restored.plan?.edits).toEqual(plan.edits);
  expect(isExplanationRequest('제목을 크게 해서 보여줘')).toBe(false);expect(isExplanationRequest('파란색으로 깔끔하게 보여줘')).toBe(false);
});
