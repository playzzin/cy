import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DEFAULT_EXCEL_MODEL, excelGenerationOptions, normalizeExcelModel, normalizeExcelThinking } from './excelConversionModel';
test('변환 권장 모델은 안정 버전 3.8 Flash이며 Gemini 3에는 sampling 설정을 보내지 않는다',()=>{
 assert.equal(DEFAULT_EXCEL_MODEL,'gemini-3.8-flash');
 assert.deepEqual(excelGenerationOptions(DEFAULT_EXCEL_MODEL,'medium'),{thinkingConfig:{thinkingLevel:'medium'},maxOutputTokens:16000});
 assert.equal((excelGenerationOptions('gemini-2.5-flash') as any).thinkingConfig,undefined);
});
test('지원하지 않는 강도와 잘못된 모델 경로를 거부한다',()=>{
 assert.equal(normalizeExcelModel('models/gemini-3.8-flash'),'gemini-3.8-flash');
 assert.throws(()=>normalizeExcelThinking('minimal'));assert.throws(()=>normalizeExcelModel('../other?key=x'));
});
