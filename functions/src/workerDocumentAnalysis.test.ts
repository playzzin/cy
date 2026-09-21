import { strict as assert } from 'assert';
import { test } from 'node:test';
import { analyzeWorkerDocument, normalizeWorkerDocument } from './workerDocumentAnalysis';
test('신분증에 없는 연락처와 요청하지 않은 개인정보를 추출 결과에 남기지 않는다', () => {
    const result = normalizeWorkerDocument({ validDocument: true, name: '테스트 작업자', address: '테스트 주소', contact: null, residentNumber: 'not-allowed' }, 'identity');
    assert.deepEqual(result.fields, { name: '테스트 작업자', address: '테스트 주소', contact: '' });
    assert.ok(result.warnings.some(item => item.includes('직접 입력')));
    assert.deepEqual(normalizeWorkerDocument({ validDocument: false, name: '추측 금지' }, 'identity').fields, { name: '', address: '', contact: '' });
});
test('계좌번호 앞자리 0을 보존하고 가려진 번호를 거부한다', () => {
    assert.equal(normalizeWorkerDocument({ validDocument: true, accountNumber: '001-234-567890' }, 'bank').fields.accountNumber, '001234567890');
    assert.equal(normalizeWorkerDocument({ validDocument: true, accountNumber: '001-***-567890' }, 'bank').fields.accountNumber, '');
});
test('Gemini 구조화 요청과 오류를 검증하고 키와 원문을 오류에 포함하지 않는다', async () => {
    const settings = { apiKey: 'secret-fixture-key', documentModel: 'gemini-2.5-flash' };
    const file = { contentType: 'image/png', base64: 'fixture' };
    const fetcher = (async (url: any, options: any) => {
        assert.ok(!url.includes(settings.apiKey));
        assert.equal(options.headers['x-goog-api-key'], settings.apiKey);
        const body = JSON.parse(options.body);
        assert.ok(body.generationConfig.responseJsonSchema);
        assert.match(body.systemInstruction.parts[0].text, /주민등록번호/);
        return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ validDocument: true, name: '테스트', address: '테스트', contact: null }) }] } }] }) };
    }) as any;
    assert.equal((await analyzeWorkerDocument(file, 'identity', settings, fetcher)).fields.name, '테스트');
    await assert.rejects(analyzeWorkerDocument(file, 'identity', settings, (async () => { throw new Error(settings.apiKey); }) as any), (error: any) => error.code === 'unavailable' && !error.message.includes(settings.apiKey));
});
