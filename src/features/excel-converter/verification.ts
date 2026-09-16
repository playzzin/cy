import JSZip from 'jszip';
import { ConversionPlan, ConversionResult, DataTable, Issue, WorkbookFile } from './types';
import { semanticKey } from './businessDocuments';
import { elements, xml } from './workbook';

export interface VerificationSummary {records:number;cells:number;identityChecked:boolean;daysChecked:number;preservationChecked:boolean;unverifiedFormulas:boolean;missingInputs:number;repairs:number}
const semantic=(label:string)=>semanticKey(label)||(/^\s*(\d{1,2})일(?:\s*공수)?\s*$/.exec(label)?`day${Number(label.match(/\d+/)![0])}`:undefined);
export function planProblems(plan:ConversionPlan,table:DataTable,baseline:ConversionPlan,userText:string):Issue[]{
 const problems:Issue[]=[];const add=(code:string,message:string)=>problems.push({level:'error',code,message});
 const fields=new Map(table.fields.map(f=>[f.key,f]));
 for(const m of [...plan.mappings,...plan.fixedCells.map(f=>f.mapping)]){
  const expected=semantic(m.label);const source=m.sourceKeys.length===1?fields.get(m.sourceKeys[0]):undefined;
  const actual=source?(semantic(source.label)||source.key):undefined;
  if(expected&&actual&&expected!==actual&&m.mode==='copy')add('meaning',`${m.label}: 원본과 받을 항목의 의미가 다릅니다. 같은 의미의 항목으로 연결해 주세요.`);
  if(m.mode==='constant'&&m.constant!==null&&!userText.includes(String(m.constant)))add('invented-constant',`${m.label}: 사용자가 지정하지 않은 값을 만들 수 없습니다.`);
 }
 if(JSON.stringify(plan.rules.filters)!==JSON.stringify(baseline.rules.filters)&&!/(제외|빼|빼고|만\s|만$|필터|미만|이상|초과|이하|없는|있는)/.test(userText))add('unrequested-filter','요청하지 않은 인원 제외 조건이 추가되었습니다. 전체 인원을 유지해 주세요.');
 if(JSON.stringify([plan.rules.groupBy,plan.rules.sums])!==JSON.stringify([baseline.rules.groupBy,baseline.rules.sums])&&!/(합산|합쳐|묶|집계|합계)/.test(userText))add('unrequested-group','요청하지 않은 합산이 추가되었습니다. 사람별 내용을 유지해 주세요.');
 for(const m of plan.mappings){
  const before=baseline.mappings.find(b=>b.targetColumn===m.targetColumn&&(b.rowOffset||0)===(m.rowOffset||0));
  if(before&&(m.scale!==before.scale||m.decimals!==before.decimals||m.rounding!==before.rounding)&&!/(반올림|절사|올림|버림|소수|배로|단위|곱|나누|계산)/.test(userText))add('unrequested-calculation',`${m.label}: 요청하지 않은 배율 또는 반올림 변경입니다. 원본 값을 유지해 주세요.`);
  if(before?.verifyKey&&m.verifyKey!==before.verifyKey)add('verification-removed',`${m.label}: 원본과 수식을 비교할 항목을 유지해 주세요.`);
 }
 for(const before of [...baseline.mappings,...baseline.fixedCells.map(f=>f.mapping)].filter(m=>m.confirmed&&(m.mode==='copy'||m.verifyKey))){
  const fixed=baseline.fixedCells.find(f=>f.mapping===before);
  const after=fixed?plan.fixedCells.find(f=>f.address===fixed.address)?.mapping:plan.mappings.find(m=>m.targetColumn===before.targetColumn&&(m.rowOffset||0)===(before.rowOffset||0));
  const requestedBlank=userText.includes(before.label)&&/(비워|빈칸|삭제|제외|빼)/.test(userText);
  if(!requestedBlank&&(!after||(before.mode==='copy'&&after.mode==='blank'&&!after.verifyKey)||(before.verifyKey&&after.verifyKey!==before.verifyKey)))add('missing-field',`${before.label}: 원본을 옮기거나 비교할 항목이 빠졌습니다. 기존 연결을 유지해 주세요.`);
 }
 return problems;
}

// Reopen the actual ZIP output and compare preserved native parts. This check
// does not rely on the AI's explanation or its "confirmed" flag.
async function preservationIssues(target:WorkbookFile,result:ConversionResult):Promise<Issue[]>{
 const issues:Issue[]=[];const original=await JSZip.loadAsync(target.bytes);
 const native=Object.keys(original.files).filter(p=>!original.files[p].dir&&(/\/(?:drawings|media|ctrlProps|activeX|printerSettings|embeddings)\//.test(p)||/vbaProject/.test(p)));
 const parts=new Map<string,Uint8Array>();for(const p of native)parts.set(p,await original.file(p)!.async('uint8array'));
 const sheetStructure=new Map<string,string>();
 const serialize=(node:Element)=>new XMLSerializer().serializeToString(node);
 const structure=(doc:Document)=>JSON.stringify({layout:['mergeCells','cols','sheetFormatPr','pageMargins','pageSetup','printOptions','headerFooter','drawing','legacyDrawing','controls'].map(name=>elements(doc,name).map(serialize)),formulas:elements(doc,'c').filter(c=>elements(c,'f').length).map(c=>[c.getAttribute('r'),elements(c,'f').map(serialize)]),rows:elements(doc,'row').filter(r=>r.hasAttribute('ht')||r.hasAttribute('hidden')).map(r=>[r.getAttribute('r'),r.getAttribute('ht'),r.getAttribute('hidden')])});
 const names=elements(xml(await original.file('xl/workbook.xml')!.async('string')),'definedName').map(serialize);
 for(const sheet of target.sheets)sheetStructure.set(sheet.name,structure(xml(await original.file(sheet.path)!.async('string'))));
 for(const output of result.outputs){
  const zip=await JSZip.loadAsync(output.bytes);
  const savedNames=elements(xml(await zip.file('xl/workbook.xml')!.async('string')),'definedName').map(serialize);
  if(names.some(n=>!savedNames.includes(n)))issues.push({level:'error',code:'preservation',message:'양식의 인쇄 범위 또는 이름 정의가 원본과 달라졌습니다.'});
  for(const [p,expected]of parts){const entry=zip.file(p);const actual=entry?await entry.async('uint8array'):undefined;if(!actual||actual.length!==expected.length||actual.some((v,i)=>v!==expected[i]))issues.push({level:'error',code:'preservation',message:'양식의 그림·매크로·인쇄 관련 파일이 원본과 달라졌습니다.'});}
  for(const sheet of output.sheets){const before=sheetStructure.get(sheet.name);if(before&&before!==structure(xml(await zip.file(sheet.path)!.async('string'))))issues.push({level:'error',code:'preservation',message:'양식의 병합·열 너비·인쇄 설정이 원본과 달라졌습니다.'});}
 }
 return issues;
}
export async function verifyConversion(target:WorkbookFile,plan:ConversionPlan,table:DataTable,result:ConversionResult):Promise<{issues:Issue[];summary:VerificationSummary}>{
 const issues:Issue[]=[];const traces=result.outputs.flatMap(o=>o.traces.map(t=>({...t,value:o.sheets.find(s=>s.name===t.sheet)?.cells.find(c=>c.address===t.address)?.value??null})));const sourceRows=new Map(table.rows.map(r=>[r.origins.join('\n'),r]));
 const copied=traces.filter(t=>t.rule==='copy');let cells=0,daysChecked=0;const seen=new Set<string>();
 for(const trace of copied){
  const origin=trace.origins.join('\n'),row=sourceRows.get(origin);
  const mapping=[...plan.mappings,...plan.fixedCells.map(f=>f.mapping)].filter(m=>m.label===trace.label&&m.mode==='copy'&&m.sourceKeys.length===1);
  const field=mapping.length===1?table.fields.find(f=>f.key===mapping[0].sourceKeys[0]):table.fields.find(f=>(semantic(f.label)||f.key)===semantic(trace.label));
  if(!row||!field)continue;
  const independent=mapping[0]?.format!=='date'&&mapping[0]?.format!=='number';
  if(independent){cells++;if(/^day\d+$/.test(field.key)||/^\d+일/.test(field.label))daysChecked++;}
  const expected=mapping[0]?.format==='text'&&row.values[field.key]!==null?String(row.values[field.key]):row.values[field.key];
  if((expected??'')!==(trace.value??'')&&independent)issues.push({level:'error',code:'source-value',message:`${trace.label}: 원본과 저장한 값이 다릅니다.`,location:trace.address});
  if((semantic(field.label)||field.key)==='worker_name')seen.add(origin);
 }
 const identity=table.fields.find(f=>(semantic(f.label)||f.key)==='worker_name');
 const identityMapped=[...plan.mappings,...plan.fixedCells.map(f=>f.mapping)].some(m=>m.mode==='copy'&&m.sourceKeys.includes(identity?.key||''));
 if(identityMapped&&!plan.rules.groupBy.length&&seen.size!==result.outputCount)issues.push({level:'error',code:'record-coverage',message:'원본 인원과 결과 인원의 개별 대조가 일치하지 않습니다.'});
 if(!plan.rules.filters.length&&!plan.rules.groupBy.length&&(result.outputCount!==table.rows.length||result.outputs.reduce((n,o)=>n+o.outputCount,0)!==table.rows.length))issues.push({level:'error',code:'record-count',message:'누락되거나 중복된 인원이 있습니다. 전체 인원을 다시 확인해 주세요.'});
 issues.push(...await preservationIssues(target,result));
 const bank=table.fields.filter(f=>['bank_name','account_holder','account_number'].includes(semantic(f.label)||f.key));
 const missingInputs=bank.length?table.rows.filter(r=>bank.some(f=>r.values[f.key]===null||r.values[f.key]==='')).length:0;
 if(missingInputs)issues.push({level:'warning',code:'source-missing',message:`원본 ${missingInputs}건의 은행·예금주·계좌 정보가 일부 비어 있습니다. 원본의 빈칸을 유지했습니다.`});
 return{issues,summary:{records:result.outputCount,cells,identityChecked:!!identityMapped&&!plan.rules.groupBy.length&&seen.size===result.outputCount&&!issues.some(i=>i.code==='record-coverage'),daysChecked,preservationChecked:!issues.some(i=>i.code==='preservation'),unverifiedFormulas:result.issues.some(i=>i.code==='formula-recalc'),missingInputs,repairs:0}};
}

export function repairPrompt(issues:Issue[],attempt:number):string {
 // Values and filenames never appear in the repair request.
 const codes=[...new Set(issues.filter(i=>i.level==='error').map(i=>i.code))];
 const details=issues.filter(i=>i.level==='error').slice(0,12).map(i=>({code:i.code,field:semantic(i.message.split(':')[0])||'',cell:/^[A-Z]{1,3}[1-9]\d{0,4}$/.test(i.location||'')?i.location:''}));
 return `자동 검증 ${attempt}회차에서 오류가 발견되었습니다. 오류 종류: ${codes.join(', ')}. 확인할 항목: ${JSON.stringify(details)}. 이전 요청의 의미를 유지하며 항목 연결·입력 범위·rowOffset·verifyKey를 수정하세요. 인원 제외나 원본 숫자 변경으로 오류를 숨기지 마세요. 의미가 다른 항목을 복사하지 마세요. 수식 셀은 blank로 보존하고 verifyKey로 원본 값과 비교하세요. 해결할 수 없으면 questions에 필요한 확인 내용을 넣으세요.`;
}
