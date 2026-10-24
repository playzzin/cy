// Bounded read-only production comparison. Never print names, document IDs, money, memos or credentials.
const fs = require('node:fs');
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');
const { buildSettlementResult } = require('../functions/lib/aiWorkspace/settlements');
const { settlementPlan } = require('../functions/lib/aiWorkspace/settlementFixtures');
const { calculateReference } = require('./ai-workspace-settlement-reference.cjs');
async function main() {
  const month = process.argv[2];
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('YYYY-MM 월이 필요합니다.');
  const maxRows = Number(process.argv.find(value => value.startsWith('--limit='))?.slice(8) || 50);
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 500) throw new Error('조회 상한은 1~500건입니다.');
  const projectId = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.firebaserc'), 'utf8')).projects.default;
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||= path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json');
  const app = admin.initializeApp({ projectId, credential: admin.credential.applicationDefault() });
  try {
    const prefix = `team_settlement_${month}__`;
    const snapshot = await app.firestore().collection('system_configs').orderBy(admin.firestore.FieldPath.documentId()).startAt(prefix).endBefore(prefix + '\uf8ff').select('data').limit(maxRows + 1).get();
    const report = { month, scanned: Math.min(snapshot.size, maxRows), truncated: snapshot.size > maxRows, confirmed: 0, matched: 0, mismatched: 0, excludedInvalid: 0, unconfirmed: 0, source: 'existing buildTeamStats + stripSupportOriginalLines', writes: 0 };
    const plan = settlementPlan(); plan.comparison = null;
    plan.range = { startDate: month + '-01', endDate: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10) };
    for (const source of snapshot.docs.slice(0, maxRows)) {
      let value; try { value = typeof source.get('data') === 'string' ? JSON.parse(source.get('data')) : source.get('data'); } catch { report.excludedInvalid++; continue; }
      if (!value?.confirmedAt) { report.unconfirmed++; continue; }
      report.confirmed++;
      const catalog = { worker: [], team: [{ id: value.teamId, name: value.teamName }], site: [], company: [] };
      const result = buildSettlementResult('read-only-audit', plan, [{ id: source.id, data: value }], catalog);
      if (!result.settlement.totals.documents) { report.excludedInvalid++; continue; }
      const actual = result.settlement.totals, expected = calculateReference(value);
      const pairs = { sales: 'salesTotal', purchases: 'purchasesTotal', deductions: 'deductionsTotal', additions: 'additionsTotal', prevCarryover: 'prevCarryover', deposit: 'deposit', net: 'net', payroll: 'payrollTotal' };
      if (Object.entries(pairs).every(([a, b]) => Math.abs(actual[a] - expected[b]) < 0.000001)) report.matched++; else report.mismatched++;
    }
    const target = path.resolve('.tmp/ai-workspace-qa/settlement-live-audit.json'); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
    if (report.mismatched) process.exitCode = 1;
  } finally { await app.delete(); }
}
main().catch(() => { console.error('정산 읽기 전용 대조를 완료하지 못했습니다. 인증·연결·기준 계산 코드를 확인해 주세요.'); process.exitCode = 1; });
