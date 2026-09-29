import { AnalyzeEdit, EDIT_DECISION_JSON_SCHEMA, EDITING_INSTRUCTION, makeEditingContext } from '../features/excel-converter/editRequest';
import { editDecisionSchema } from '../features/excel-converter/editingTypes';
import { requestGeminiContent } from './geminiGatewayClient';
import { privateLiterals, PrivateLiteralError } from '../features/excel-converter/editPrivacy';

export const analyzeExcelEdit:AnalyzeEdit=async context=>{
  const checkCancelled=()=>{if(context.signal?.aborted)throw new DOMException('요청을 취소했습니다.','AbortError');};
  checkCancelled();
  const literals=privateLiterals(),data=makeEditingContext(context);
  for(const cell of data.sheet.cells)if(cell.formula)cell.formula=literals.mask(cell.formula);
  const wantsMacros=/매크로|메크로|VBA|모듈|사용자\s*정의\s*함수|UDF|\bModule\w*\b|\b(?:Sub|Function|Property)\s+[A-Z_]\w*\s*\(/i.test(context.request)||!!context.plan.macroEdits.length;
  const macros=wantsMacros?await (await import('../features/excel-converter/vbaEditing')).macroContext(context.target.bytes,context.plan.macroEdits):undefined;
  checkCancelled();
  if(macros)for(const module of macros.modules)module.code=literals.mask(module.code,true);
  const input=JSON.stringify({...data,macros});
  if(input.length>190000)throw new Error('편집할 양식이 너무 큽니다. 작은 시트로 나누어 주세요.');
  const response=await requestGeminiContent('document-analysis',{
    systemInstruction:{parts:[{text:EDITING_INSTRUCTION}]},contents:[{role:'user',parts:[{text:input}]}],
    generationConfig:{responseMimeType:'application/json',responseJsonSchema:EDIT_DECISION_JSON_SCHEMA,maxOutputTokens:8192},
  },context.signal);
  checkCancelled();
  const candidate=response.candidates?.[0];
  if(candidate?.finishReason!=='STOP')throw new Error('편집 제안을 끝까지 받지 못했습니다. 같은 요청을 다시 보내 주세요.');
  try{const decision=editDecisionSchema.parse(JSON.parse((candidate.content?.parts||[]).filter((p:{thought?:boolean})=>!p.thought).map((p:{text?:string})=>p.text||'').join('')));
    decision.formulas=decision.formulas.map(f=>({...f,formula:literals.restore(f.formula)}));
    if(decision.macros.length&&!macros)throw new Error('매크로 편집 요청이 없습니다.');
    decision.macros=decision.macros.map(m=>({...m,code:literals.restore(m.code)}));return decision;}
  catch(error){if(error instanceof PrivateLiteralError)throw error;throw new Error('편집 내용을 확인하지 못했습니다. 기존 결과는 유지됩니다. 다시 요청해 주세요.');}
};
