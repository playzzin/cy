import { savedCommandPlan } from './savedCommandFixtures';
import { strict as assert } from 'assert';
import { test } from 'node:test';
import { planQuestion } from './planner';
import { fixturePlan } from './fixtures';
test('planner sends only user conditions, honors Seoul date and rejects invalid output', async () => {
  let body: any;
  const request = async (_url: string, options: any) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(fixturePlan()) }] } }], usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 20 } }) }; };
  const result = await planQuestion('같은 기간 팀별로', fixturePlan(), { apiKey: 'synthetic-key', model: 'gemini-test' }, new Date('2026-08-31T16:00:00Z'), request);
  const input = JSON.parse(body.contents[0].parts[0].text);
  assert.equal(input.today, '2026-09-01'); assert.deepEqual(input.previousPlan, fixturePlan());
  assert.deepEqual(Object.keys(input).sort(), ['previousPlan', 'question', 'today']);
  assert.equal(result.inputTokens, 15); assert.equal(body.generationConfig.responseMimeType, 'application/json');
});
test('missing key, quota error and truncated model response do not trigger data queries', async () => {
  await assert.rejects(planQuestion('질문', null, { model: 'test' }), /서버 AI 설정/);
  await assert.rejects(planQuestion('질문', null, { apiKey: 'test', model: 'test' }, new Date(), async () => ({ ok: false, status: 429 })), /한도/);
  await assert.rejects(planQuestion('질문', null, { apiKey: 'test', model: 'test' }, new Date(), async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS' }] }) })), /완료되지/);
});

test('follow-up prompts replace resolved database names and IDs with server-owned references', async () => {
  const previous = fixturePlan(); previous.filters = [{ entity: 'worker', name: 'DB에서 찾은 이름', id: 'private-db-id' }];
  const request = async (_url: string, options: any) => {
    assert.equal(options.body.includes('DB에서 찾은 이름'), false); assert.equal(options.body.includes('private-db-id'), false);
    const prior = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text).previousPlan;
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(prior) }] } }] }) };
  };
  const value = await planQuestion('같은 대상을 다시 보여줘', previous, { apiKey: 'test', model: 'test' }, new Date(), request);
  assert.deepEqual(value.plan.filters, previous.filters);
});

test('saved lookup plans preserve literal query and never receive the saved catalog', async () => {
  let body: any;
  const plan = savedCommandPlan('savedRun', '', true);
  const request = async (_url: string, options: any) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(plan) }] } }] }) }; };
  const actual = await planQuestion('그 분석 실행해줘', savedCommandPlan('savedFind', '현장'), { apiKey: 'synthetic-key', model: 'gemini-test' }, new Date('2026-09-28'), request);
  assert.equal(actual.plan.saved!.usePrevious, true);
  const data = JSON.parse(body.contents[0].parts[0].text);
  assert.deepEqual(Object.keys(data).sort(), ['previousPlan', 'question', 'today']);
  assert.equal(data.previousPlan.saved.query, '현장');
});
