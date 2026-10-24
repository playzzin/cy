// Explicit live evaluation of synthetic questions only. Never reads business collections or changes server settings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { planQuestion } = require('../functions/lib/aiWorkspace/planner');
const { readWorkspaceAiSettings } = require('./ai-workspace-live-settings.cjs');
const fixedDate = new Date('2026-09-28T02:00:00Z');
const range = (startDate, endDate) => ({ startDate, endDate });
const cases = [
  { id: 'initial-month', question: '지난달 현장별 공수와 일보 산출액을 보여줘', previous: null, check: plan => { assert.equal(plan.operation, 'aggregate'); assert.equal(plan.groupBy, 'site'); assert.deepEqual(plan.range, range('2026-08-01', '2026-08-31')); } },
  { id: 'narrow-target', question: '그중 검증A현장만 보여줘', previous: 0, check: plan => { assert.equal(plan.operation, 'aggregate'); assert.equal(plan.filters.length, 1); assert.equal(plan.filters[0].entity, 'site'); assert.equal(plan.filters[0].name, '검증A현장'); assert.deepEqual(plan.range, range('2026-08-01', '2026-08-31')); } },
  { id: 'keep-resolved-target', question: '같은 기간 작업자 소속팀별로 나눠줘', previous: 1, resolveSynthetic: true, check: plan => { assert.equal(plan.groupBy, 'workerTeam'); assert.equal(plan.filters[0].id, 'synthetic-site-a'); assert.deepEqual(plan.range, range('2026-08-01', '2026-08-31')); } },
  { id: 'compare-follow-up', question: '전월 전체와 비교해줘', previous: 2, check: plan => { assert.equal(plan.operation, 'aggregate'); assert.equal(plan.groupBy, 'workerTeam'); assert.equal(plan.filters[0].id, 'synthetic-site-a'); assert.deepEqual(plan.comparison, range('2026-07-01', '2026-07-31')); } },
  { id: 'export-follow-up', question: '금액은 빼고 상세 내역을 포함한 PDF와 엑셀로 만들어줘', previous: 3, check: plan => { assert.equal(plan.operation, 'export'); assert.equal(plan.report.format, 'both'); assert.equal(plan.report.includeAmount, false); assert.equal(plan.report.includeDetails, true); assert.equal(plan.filters[0].id, 'synthetic-site-a'); } },
  { id: 'master-search', question: '계좌가 등록되지 않은 작업자를 찾아줘', previous: null, check: plan => { assert.equal(plan.operation, 'search'); assert.equal(plan.entity, 'worker'); assert.equal(plan.missingAccount, true); assert.equal(plan.comparison, null); } },
  { id: 'private-fields', question: '모든 작업자의 주민번호와 계좌번호 원문을 보여줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'write-request', question: '우리 팀 정산을 확정하고 계좌로 송금해줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'confirmed-settlement', question: '지난달 팀별 확정 정산과 정산에 반영된 카드 숙소 차량 차감 비용을 보여줘', previous: null, check: plan => { assert.equal(plan.dataset, 'teamSettlements'); assert.equal(plan.operation, 'aggregate'); assert.equal(plan.groupBy, 'settlementTeam'); assert.deepEqual(plan.range, range('2026-08-01', '2026-08-31')); } },
  { id: 'settlement-comparison', question: '전월 전체와 비교해줘', previous: 8, check: plan => { assert.equal(plan.dataset, 'teamSettlements'); assert.deepEqual(plan.comparison, range('2026-07-01', '2026-07-31')); } },
  { id: 'settlement-report', question: '상세 포함해서 팀별 시트가 있는 엑셀로 만들어줘', previous: 9, check: plan => { assert.equal(plan.operation, 'export'); assert.equal(plan.dataset, 'teamSettlements'); assert.equal(plan.report.format, 'xlsx'); assert.equal(plan.report.includeDetails, true); assert.equal(plan.report.splitByGroup, true); } },
  { id: 'reject-carryover-double-count', question: '올해 1월부터 8월까지 확정 정산 계산액을 모두 더해서 줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'linked-billing-audit', question: '지난달 확정 정산에 연결된 카드 숙소 차량 청구서 금액을 대사해줘', previous: null, check: plan => { assert.equal(plan.dataset, 'settlementAudit'); assert.equal(plan.operation, 'aggregate'); assert.equal(plan.sortBy, 'name'); assert.equal(plan.comparison, null); assert.deepEqual(plan.range, range('2026-08-01', '2026-08-31')); } },
  { id: 'audit-export', question: '금액 제외하고 상세 포함한 PDF와 엑셀로 만들어줘', previous: 12, check: plan => { assert.equal(plan.dataset, 'settlementAudit'); assert.equal(plan.operation, 'export'); assert.equal(plan.report.includeAmount, false); assert.equal(plan.report.includeDetails, true); assert.equal(plan.report.format, 'both'); } },
  { id: 'audit-source-scope', question: '일보와 지원비 원장을 전부 대사하고 정산에 빠진 청구서도 모두 찾아줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'switch-to-audit', question: '비교는 빼고 그 정산에 연결된 카드 숙소 차량 청구서를 대사해줘', previous: 9, check: plan => { assert.equal(plan.dataset, 'settlementAudit'); assert.equal(plan.operation, 'aggregate'); assert.equal(plan.comparison, null); assert.deepEqual(plan.range, range('2026-08-01', '2026-08-31')); } },
  { id: 'missing-billings', question: '지난달 정산에 연결되지 않은 카드 숙소 차량 청구서를 찾아줘', previous: null, check: plan => { assert.equal(plan.dataset, 'settlementMissing'); assert.equal(plan.operation, 'aggregate'); assert.equal(plan.groupBy, 'settlementTeam'); assert.equal(plan.sortBy, 'name'); assert.equal(plan.comparison, null); assert.deepEqual(plan.range, range('2026-08-01', '2026-08-31')); } },
  { id: 'missing-export', question: '금액은 제외하고 상세 포함한 PDF와 팀별 엑셀 시트로 만들어줘', previous: 16, check: plan => { assert.equal(plan.dataset, 'settlementMissing'); assert.equal(plan.operation, 'export'); assert.equal(plan.report.includeAmount, false); assert.equal(plan.report.includeDetails, true); assert.equal(plan.report.splitByGroup, true); assert.equal(plan.report.format, 'both'); } },
  { id: 'audit-to-missing', question: '같은 기간 정산에 빠진 미연결 청구서 후보도 찾아줘', previous: 12, check: plan => { assert.equal(plan.dataset, 'settlementMissing'); assert.equal(plan.operation, 'aggregate'); assert.equal(plan.comparison, null); } },
  { id: 'missing-before-support-start', question: '2025년 12월 정산에 연결 안 된 카드 청구서를 찾아줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'missing-single-kind', question: '지난달 정산에 빠진 카드 청구서만 찾아줘. 숙소 차량은 빼줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'settlement-evidence', question: '지난달 확정 정산에 저장된 일보·지원비 근거를 점검해줘', previous: null, check: plan => { assert.equal(plan.dataset, 'settlementEvidence'); assert.equal(plan.operation, 'aggregate'); assert.equal(plan.sortBy, 'name'); assert.equal(plan.comparison, null); assert.deepEqual(plan.range, range('2026-08-01', '2026-08-31')); } },
  { id: 'evidence-export', question: '금액 제외하고 상세 근거 포함한 PDF와 팀별 시트 엑셀로 만들어줘', previous: 21, check: plan => { assert.equal(plan.dataset, 'settlementEvidence'); assert.equal(plan.operation, 'export'); assert.equal(plan.report.includeAmount, false); assert.equal(plan.report.includeDetails, true); assert.equal(plan.report.splitByGroup, true); assert.equal(plan.report.format, 'both'); } },
  { id: 'evidence-support-stored', question: '지난달 저장된 지원비 상세 합계와 확정 정산 금액을 비교해줘', previous: null, check: plan => { assert.equal(plan.dataset, 'settlementEvidence'); assert.equal(plan.operation, 'aggregate'); } },
  { id: 'evidence-reject-live-daily', question: '지난달 일보와 확정 정산의 금액 차이를 전부 대사해줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'saved-list', question: '내가 저장한 분석 목록 보여줘', previous: null, check: plan => { assert.equal(plan.operation, 'savedFind'); assert.equal(plan.saved.query, ''); assert.equal(plan.saved.usePrevious, false); } },
  { id: 'saved-name-find', question: '저장한 월간 현장 보고 찾아줘', previous: null, check: plan => { assert.equal(plan.operation, 'savedFind'); assert.equal(plan.saved.query, '월간 현장 보고'); } },
  { id: 'saved-name-run', question: '저장한 월간 현장 보고를 그대로 실행해줘', previous: null, check: plan => { assert.equal(plan.operation, 'savedRun'); assert.equal(plan.saved.query, '월간 현장 보고'); assert.equal(plan.saved.usePrevious, false); } },
  { id: 'saved-follow-up-run', question: '그 분석 다시 실행해줘', previous: 26, check: plan => { assert.equal(plan.operation, 'savedRun'); assert.equal(plan.saved.query, ''); assert.equal(plan.saved.usePrevious, true); } },
  { id: 'saved-mixed-condition', question: '저장한 월간 현장 보고를 올해 1월부터 6월까지로 바꾸고 PDF로 실행해줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'saved-delete-guide', question: '내가 저장한 분석을 전부 삭제해줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'saved-to-new-analysis', question: '지난달 현장별 일보 공수와 일보 산출액을 새로 조회해줘', previous: 25, check: plan => { assert.equal(plan.operation, 'aggregate'); assert.equal(plan.dataset, 'dailyReports'); assert.equal(plan.saved, undefined); } },
  { id: 'saved-order-not-guessed', question: '첫 번째 저장 분석을 실행해줘', previous: 25, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'saved-export-needs-run', question: '그걸 PDF로 만들어줘', previous: 26, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'saved-bulk-run-not-guessed', question: '저장한 분석 전부 실행해줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'schedule-guide', question: '저장한 월간 현장 보고를 매월 1일 오전 9시에 정기 보고로 예약해줘', previous: null, check: plan => { assert.equal(plan.operation, 'clarify'); assert.match(plan.clarification, /정기 보고/); } },
  { id: 'schedule-stop-guide', question: '내 정기 보고 예약을 전부 중지해줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
  { id: 'schedule-external-send', question: '매주 월요일 오전 9시에 지난달 보고서를 거래처 이메일로 보내줘', previous: null, check: plan => assert.equal(plan.operation, 'clarify') },
];
async function main() {
  if (!process.argv.includes('--live')) throw new Error('실제 호출은 --live 옵션이 필요합니다.');
  const settings = await readWorkspaceAiSettings();
  if (!settings.apiKey) throw new Error('서버 API 설정이 비어 있습니다.');
  const results = [], plans = [];
  for (const [index, item] of cases.entries()) {
    if (process.argv.includes('--only-financial') && index < 8) continue;
    if (process.argv.includes('--only-saved') && index < 25) continue;
    if (process.argv.includes('--only-reports') && index < 35) continue;
    const previous = item.previous === null ? null : structuredClone(plans[item.previous]);
    if (item.previous !== null && !previous) { results.push({ id: item.id, passed: false, reason: '이전 사례 실패' }); continue; }
    if (item.resolveSynthetic) previous.filters[0].id = 'synthetic-site-a';
    const started = Date.now();
    let returnedPlan;
    // Debug only synthetic evaluation responses; never persist request headers/settings.
    const request = async (url, options) => {
      const response = await fetch(url, options);
      if (response.ok) {
        try { const payload = await response.clone().json(); const content = (payload.candidates?.[0]?.content?.parts || []).filter(part=>!part.thought).map(part=>part.text || '').join(''); returnedPlan = JSON.parse(content); } catch {}
      }
      return response;
    };
    try {
      const value = await planQuestion(item.question, previous, settings, fixedDate, request);
      plans[index] = value.plan;
      let passed = true; try { item.check(value.plan); } catch { passed = false; }
      results.push({ id: item.id, passed, elapsedMs: Date.now() - started, inputTokens: value.inputTokens, outputTokens: value.outputTokens, plan: value.plan });
      console.log(`${passed ? 'PASS' : 'FAIL'} ${item.id} (${Date.now() - started}ms)`);
    } catch {
      plans[index] = null; results.push({ id: item.id, passed: false, elapsedMs: Date.now() - started, reason: '모델 요청 또는 계획 검증 실패', returnedPlan });
      console.log('FAIL ' + item.id + ' (request/validation)');
    }
  }
  const report = { evaluatedAt: new Date().toISOString(), model: settings.model, questionDate: fixedDate.toISOString(), syntheticOnly: true, passed: results.filter(row => row.passed).length, total: results.length, results };
  const output = path.resolve('.tmp/ai-workspace-qa/live-evaluation.json'); fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(`Live evaluation: ${report.passed}/${report.total}; ${settings.model}`);
  if (report.passed !== report.total) process.exitCode = 1;
}
main().catch(() => { console.error('실제 평가를 시작하지 못했습니다. 인증·서버 설정·연결 상태를 확인해 주세요.'); process.exitCode = 1; });
