import { analyzeExcelEdit } from './excelEditingService';
import { requestGeminiContent } from './geminiGatewayClient';
import { planSchema } from '../features/excel-converter/types';
import { EditingContext } from '../features/excel-converter/editRequest';
import { macroContext } from '../features/excel-converter/vbaEditing';
jest.mock('./geminiGatewayClient',()=>({requestGeminiContent:jest.fn()}));
jest.mock('../features/excel-converter/vbaEditing',()=>({macroContext:jest.fn()}));
const plan=planSchema.parse({version:1,targetId:'target',sheetName:'양식',headerRow:1,startRow:2,endRow:3,mappings:[],rules:{}});
const context:EditingContext={request:'표를 깔끔하게',plan,history:[],table:{fields:[],rows:[],warnings:[],skipped:[]},target:{id:'target',name:'양식.xlsx',bytes:new ArrayBuffer(0),fingerprint:'f',warnings:[],sheets:[{name:'양식',path:'xl/worksheets/sheet1.xml',headerRow:1,rowCount:3,columnCount:2,cells:[],merges:[],warnings:[],hiddenColumns:[],hiddenRows:[]}]}};
const valid={formulas:[],macros:[],dataRequest:'',summary:['머리글을 파란색으로 변경했습니다.'],questions:[],resetAppearance:false,edits:[{kind:'style',range:'A1:B1',style:{background:'#DDEEFF'}}],values:[]};
beforeEach(()=>jest.clearAllMocks());
test('기존 인증된 서버 경로로 서식 편집을 요청하고 취소 신호를 전달한다',async()=>{
 (requestGeminiContent as jest.Mock).mockResolvedValue({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'hidden'},{text:JSON.stringify(valid)}]}}]});
 const controller=new AbortController();expect(await analyzeExcelEdit({...context,signal:controller.signal})).toEqual(valid);
 expect(requestGeminiContent).toHaveBeenCalledWith('document-analysis',expect.objectContaining({generationConfig:expect.objectContaining({responseMimeType:'application/json'})}),controller.signal);
});
test('불완전한 응답과 잘못된 서식은 성공 처리하지 않는다',async()=>{
 (requestGeminiContent as jest.Mock).mockResolvedValue({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:JSON.stringify(valid)}]}}]});
 await expect(analyzeExcelEdit(context)).rejects.toThrow('끝까지');
 (requestGeminiContent as jest.Mock).mockResolvedValue({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...valid,edits:[{kind:'style',range:'A1',style:{fontSize:999}}]})}]}}]});
 await expect(analyzeExcelEdit(context)).rejects.toThrow('확인하지');
});

test('이미 중단한 편집은 서버 요청을 만들지 않고 늦은 응답도 적용하지 않는다',async()=>{
 const controller=new AbortController();controller.abort();
 await expect(analyzeExcelEdit({...context,signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
 expect(requestGeminiContent).not.toHaveBeenCalled();
 const active=new AbortController();
 (requestGeminiContent as jest.Mock).mockImplementation(async()=>{active.abort();return {candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(valid)}]}}]};});
 await expect(analyzeExcelEdit({...context,signal:active.signal})).rejects.toMatchObject({name:'AbortError'});
});

test('AI가 바꾼 원문 문자열 참조를 설명하고 기존 파일에 적용하지 않는다',async()=>{
 (requestGeminiContent as jest.Mock).mockResolvedValue({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...valid,formulas:[{range:'A2',formula:'"prefix __LOCAL_LITERAL_0__"'}]})}]}}]});
 await expect(analyzeExcelEdit(context)).rejects.toThrow('원문 문자열의 참조가 바뀌었습니다');
});

test('Module1 함수 수정 요청도 VBA 문맥을 읽고 준비 도중 중단하면 전송하지 않는다',async()=>{
 (macroContext as jest.Mock).mockResolvedValue({codepage:1252,modules:[{name:'Module1',kind:'standard',code:'Option Explicit'}]});
 (requestGeminiContent as jest.Mock).mockResolvedValue({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(valid)}]}}]});
 await analyzeExcelEdit({...context,request:'Module1의 EditedTotal 함수를 수정해줘'});
 expect(macroContext).toHaveBeenCalledTimes(1);
 expect(JSON.parse((requestGeminiContent as jest.Mock).mock.calls[0][1].contents[0].parts[0].text).macros.modules[0].name).toBe('Module1');
 const controller=new AbortController();
 (macroContext as jest.Mock).mockImplementation(async()=>{controller.abort();return {codepage:1252,modules:[]};});
 await expect(analyzeExcelEdit({...context,request:'매크로를 수정해줘',signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
 expect(requestGeminiContent).toHaveBeenCalledTimes(1);
});
