import { ENGINE_VERSION, WorkbookFile, planSchema, ConversionPlan } from './types';
import { extractionSchema, extractWithLayout, planWithLayout, PreparedConversion, renderStructureImage, structuralText, structureOnlyPlan, StructureDecision, StructureRequest, StructureResult, structureResultSchema, suggestedDocuments, workbookAtlas } from './structure';

interface RememberedStructure {version:string;signature:string;at:number;decision:StructureDecision;plan:ConversionPlan}
const key=(owner:string)=>`excel-structures-v2:${encodeURIComponent(owner)}`;
function readMemory(owner:string):RememberedStructure[]{try{return JSON.parse(localStorage.getItem(key(owner))||'[]').filter((m:RememberedStructure)=>m.version===ENGINE_VERSION&&Date.now()-m.at<30*86400000);}catch{return[];}}
export function clearStructureMemory(owner:string){try{localStorage.removeItem(key(owner));}catch{/* Optional browser storage. */}}
export function rememberStructure(owner:string,prepared:PreparedConversion,plan:ConversionPlan){
  // Keep coordinates and field links only. No file bytes, row values, prompts,
  // filter values, user constants, explanations, or manual overrides are saved.
  const clean=(m:ConversionPlan['mappings'][number])=>({...m,constant:null,reason:'',...(m.mode==='constant'?{mode:'blank' as const,confirmed:false}: {})});
  const safePlan=planSchema.parse({...plan,targetId:'remembered',sheetName:'template',mappings:plan.mappings.map(clean),fixedCells:plan.fixedCells.map(f=>({...f,mapping:clean(f.mapping)})),rules:{},summary:[],questions:[],overrides:[]});
  const decision:StructureDecision={useSuggestedSource:!prepared.sourceLayout,useSuggestedTarget:!prepared.targetLayout,source:prepared.sourceLayout,target:prepared.targetLayout,questions:[],summary:[]};
  const entry:RememberedStructure={version:ENGINE_VERSION,signature:prepared.structureSignature,at:Date.now(),decision,plan:safePlan};
  try{localStorage.setItem(key(owner),JSON.stringify([entry,...readMemory(owner).filter(m=>m.signature!==entry.signature)].slice(0,12)));}catch{/* Conversion does not depend on storage availability. */}
}
export class StructureQuestions extends Error {constructor(public questions:string[]){super(questions.join('\n'));}}
export async function prepareConversion(source:WorkbookFile,target:WorkbookFile,sourceSheet:string,targetSheet:string,prompt:string,owner:string,analyze:(request:StructureRequest)=>Promise<StructureResult>,progress:(text:string)=>void,signal:AbortSignal):Promise<PreparedConversion>{
  const active=()=>{if(signal.aborted)throw new Error('변환을 중단했습니다.');};
  active();progress('두 파일의 전체 시트와 병합 구조를 확인하고 있어요');
  const sourceAtlas=workbookAtlas(source,sourceSheet),targetAtlas=workbookAtlas(target,targetSheet);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({version:ENGINE_VERSION,sourceAtlas,targetAtlas})));
  const signature=Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');active();
  const suggested=suggestedDocuments(source,target,sourceSheet,targetSheet);
  const verifiedReader=!!suggested.document&&['현재 노임명세서 · 한 사람 두 줄','노무내역서 · 한 사람 두 줄','위임장 · 작업자 목록과 수임인 정보'].includes(suggested.document.label);
  const build=(decision:StructureDecision,reused:boolean,cachedPlan?:ConversionPlan):PreparedConversion=>{
    if(decision.questions.length)throw new StructureQuestions(decision.questions);
    const document=decision.useSuggestedSource?suggested.document:decision.source?extractWithLayout(source,sourceSheet,extractionSchema.parse(decision.source)):undefined;
    if(!document?.table.rows.length)throw new Error('원본 데이터 구조를 확인하지 못했습니다.');
    if(verifiedReader&&!decision.useSuggestedSource){
      const known=suggested.document!.table;
      if(known.rows.length!==document.table.rows.length||known.rows.some((r,i)=>known.fields.some(f=>(r.values[f.key]??'')!==(document.table.rows[i].values[f.key]??''))))throw new Error('확인된 원본 추출값과 새 구조가 다릅니다. 합쳐진 계좌정보 분리와 공통 현장명 추출을 보존하도록 useSuggestedSource=true를 사용하세요.');
    }
    const plan=cachedPlan?planSchema.parse({...cachedPlan,targetId:target.id,sheetName:targetSheet}):decision.useSuggestedTarget?suggested.plan:decision.target?planWithLayout(target,document,targetSheet,decision.target):undefined;
    if(!plan)throw new Error('받을 양식의 입력 구간을 확인하지 못했습니다.');
    return{document,plan,reused,structureSignature:signature,sourceLayout:decision.useSuggestedSource?null:decision.source,targetLayout:decision.useSuggestedTarget?null:decision.target,sourceAtlas,targetAtlas};
  };
  const saved=readMemory(owner).find(m=>m.signature===signature);
  if(saved){try{const prepared=build(structureResultSchema.parse(saved.decision),true,saved.plan);progress('이전에 검증한 같은 양식을 찾았어요. 이번 요청을 반영합니다');return prepared;}catch{/* Re-analyze if a saved rule cannot be applied. */}}
  progress('Gemini가 원본의 반복 구간과 받을 양식의 입력칸을 분석하고 있어요');
  const images=[source.sheets.find(s=>s.name===sourceSheet)!,target.sheets.find(s=>s.name===targetSheet)!].map(renderStructureImage).filter((im):im is NonNullable<typeof im>=>!!im);
  let feedback='';
  for(let attempt=0;attempt<=2;attempt++){
    const response=await analyze({requestId:crypto.randomUUID(),prompt:prompt+feedback,source:sourceAtlas,target:targetAtlas,...(suggested.document?{suggestedSource:{verifiedReader,kind:suggested.document.kind,headerRow:suggested.document.headerRow,records:suggested.document.table.rows.length,fields:suggested.document.table.fields.map(({key,label,kind},i)=>({key,label:structuralText(label)||`항목 ${i+1}`,kind}))}}:{}),...(suggested.plan?{suggestedTarget:structureOnlyPlan(suggested.plan)}:{}),...(images.length?{images}:{})});active();
    try{return build(structureResultSchema.parse(response),false);}catch(error){
      if(error instanceof StructureQuestions||attempt===2)throw error;
      progress(`원본·양식의 입력 범위를 다시 확인하고 있어요 (${attempt+1}/2)`);
      feedback='\n구조를 적용하는 검사에서 실패했습니다. 전체 인원, 반복 줄 수, 병합 시작 칸, 입력 범위를 다시 확인하세요. 이전 구조: '+JSON.stringify(response)+'\n검사 내용: '+(error instanceof Error?error.message:'잘못된 구조');
      if(prompt.length+feedback.length>6000)feedback='\n구조 검사 실패: 반복 줄 수·전체 인원 범위·병합 시작 칸을 다시 분석하세요.';
    }
  }
  throw new Error('양식 구조 확인을 완료하지 못했습니다.');
}
