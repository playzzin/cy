import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import * as admin from 'firebase-admin';
if(!admin.apps.length)admin.initializeApp({projectId:'demo-excel-converter'});
const {analyzeExcelStructure,generateExcelStructure,validateStructureRequest}=require('./excelStructurePlanning') as typeof import('./excelStructurePlanning');
const book={selected:'s1',sheets:[{id:'s1',rows:10,columns:5,patterns:[],hiddenRows:[],hiddenColumns:[]}]};
const input={requestId:'structure-request-001',prompt:'그대로 옮겨줘',source:book,target:book,suggestedSource:{kind:'labor'},suggestedTarget:{startRow:3}};
const decision={useSuggestedSource:true,useSuggestedTarget:true,source:null,target:null,questions:[],summary:['구조 확인']};
test('구조 분석은 로그인과 요청 크기를 검증한다',async()=>{
 await assert.rejects((analyzeExcelStructure as any).run(input,{auth:null}),(error:any)=>error.code==='unauthenticated');
 assert.throws(()=>validateStructureRequest({...input,requestId:'bad'}));assert.throws(()=>validateStructureRequest({...input,prompt:'x'.repeat(6001)}));assert.throws(()=>validateStructureRequest({...input,target:{...book,selected:'other'}}));assert.throws(()=>validateStructureRequest({...input,images:[{mimeType:'image/png',data:'not-png'}]}));
});
test('실제 Gemini 요청에 전체 구조와 닫힌 응답 스키마를 사용한다',async()=>{
 let sent:any;
 const result=await generateExcelStructure(input,{apiKey:'fixture-only',model:'test-model'},(async(_url:any,options:any)=>{sent=JSON.parse(options.body);return{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(decision)}]}}],usageMetadata:{promptTokenCount:22}})};}) as any);
 assert.equal(sent.contents[0].parts.length,1);assert.deepEqual(JSON.parse(sent.contents[0].parts[0].text).source,book);assert.equal(result.inputTokens,22);assert.equal(sent.generationConfig.responseJsonSchema.additionalProperties,false);
});
test('없는 제안을 재사용하거나 임의 코드를 반환하면 거부한다',async()=>{
 const response=(value:any)=>async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]})}) as any;
 await assert.rejects(generateExcelStructure({...input,suggestedSource:undefined},{apiKey:'fixture',model:'test'},response(decision)));
 await assert.rejects(generateExcelStructure(input,{apiKey:'fixture',model:'test'},response({...decision,script:'execute'})));
});
