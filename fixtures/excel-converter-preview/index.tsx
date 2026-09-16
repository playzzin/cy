import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatConversionWorkspace from '../../src/features/excel-converter/ChatConversionWorkspace';
import { makePlannerRequest, makeStructuredPlannerRequest, PlannerRequest } from '../../src/features/excel-converter/plannerRequest';
import { planSchema } from '../../src/features/excel-converter/types';
import { prepareConversion } from '../../src/features/excel-converter/preparation';
import { StructureRequest } from '../../src/features/excel-converter/structure';
const post=async(path:string,input:unknown)=>{const response=await fetch(`/api/excel-converter/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Gemini 분석에 실패했습니다.');return result;};
const analyze=async(request:PlannerRequest)=>{const result=await post('analyze',request);return{...result,plan:planSchema.parse(result.plan)};};
const checkAi=async()=>{const response=await fetch('/api/excel-converter/status');if(!response.ok)throw new Error('연결 실패');return response.json();};
createRoot(document.getElementById('root')!).render(<ChatConversionWorkspace ownerId="fixture-only-excel-converter-simple" checkAi={checkAi}
  prepare={(source,target,sourceSheet,targetSheet,prompt,progress,signal)=>prepareConversion(source,target,sourceSheet,targetSheet,prompt,'fixture-only-excel-converter-simple',(request:StructureRequest)=>post('structure',request),progress,signal)}
  analyzePrepared={(prompt,plan,prepared,target)=>analyze(makeStructuredPlannerRequest(prompt,plan,prepared,target))}
  analyze={(prompt,plan,table,target)=>analyze(makePlannerRequest(prompt,plan,table,target))}/>);
