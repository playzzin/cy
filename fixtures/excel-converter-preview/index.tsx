import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatConversionWorkspace from '../../src/features/excel-converter/ChatConversionWorkspace';
import { makePlannerRequest, makeStructuredPlannerRequest, PlannerRequest } from '../../src/features/excel-converter/plannerRequest';
import { planSchema } from '../../src/features/excel-converter/types';
import { prepareConversion } from '../../src/features/excel-converter/preparation';
import { StructureRequest } from '../../src/features/excel-converter/structure';
import { AnalyzeEdit } from '../../src/features/excel-converter/editRequest';
const post=async(path:string,input:unknown)=>{const response=await fetch(`/api/excel-converter/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Gemini 분석에 실패했습니다.');return result;};
const analyze=async(request:PlannerRequest)=>{const result=await post('analyze',request);return{...result,plan:planSchema.parse(result.plan)};};
const checkAi=async()=>{const response=await fetch('/api/excel-converter/status');if(!response.ok)throw new Error('연결 실패');return response.json();};
// Browser regression fixture only: deterministic decisions, no uploaded data leaves this page.
const layoutScenario=new URLSearchParams(window.location.search).get('scenario')==='layout';
const fixtureEdit:AnalyzeEdit=async({request})=>({dataRequest:'',questions:[],summary:['로컬 검증용 편집을 적용했습니다.'],resetAppearance:false,formulas:[],macros:[],
  layout:request.includes('두 줄')?[{kind:'insertRows',at:1,count:2}]:[],
  values:request.includes('두 줄')?[{address:'A4',value:'구조 편집 확인'}]:[],
  edits:request.includes('크게')?[{kind:'style',range:'A4',style:{fontSize:24,background:'#DDEEFF'}}]:[]});
createRoot(document.getElementById('root')!).render(layoutScenario?<ChatConversionWorkspace ownerId="fixture-layout-only" edit={fixtureEdit}
  analyze={async(_prompt,plan)=>({plan:planSchema.parse({...plan,questions:[],mappings:plan.mappings.map(m=>({...m,confirmed:true}))}),model:'local-fixture',elapsedMs:0,inputTokens:0,outputTokens:0})}/>:<ChatConversionWorkspace ownerId="fixture-only-excel-converter-simple" checkAi={checkAi}
  prepare={(source,target,sourceSheet,targetSheet,prompt,progress,signal)=>prepareConversion(source,target,sourceSheet,targetSheet,prompt,'fixture-only-excel-converter-simple',(request:StructureRequest)=>post('structure',request),progress,signal)}
  analyzePrepared={(prompt,plan,prepared,target)=>analyze(makeStructuredPlannerRequest(prompt,plan,prepared,target))}
  analyze={(prompt,plan,table,target)=>analyze(makePlannerRequest(prompt,plan,table,target))}/>);
