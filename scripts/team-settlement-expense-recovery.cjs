const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, filename);
const { SETTLEMENT_EXPENSE_ORIGINS, compareTeamSettlementExpenses } = require('../src/utils/teamSettlementExpenses.ts');
const { TeamSettlementDocumentSchema } = require('../src/types/teamSettlement.ts');
const isExpense = row => row.source === 'auto' && SETTLEMENT_EXPENSE_ORIGINS.includes(row.origin);
const sumAuto = rows => rows.filter(row => row.source === 'auto').reduce((sum, row) => sum + row.amount, 0);
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

function protectedContent(doc) {
  const copy = JSON.parse(JSON.stringify(doc));
  copy.deductions = copy.deductions.filter(row => !isExpense(row));
  copy.additions = (copy.additions || []).filter(row => !isExpense(row));
  delete copy.updatedAt;
  if (copy.sourceSnapshot) for (const key of ['deductions', 'additions', 'net']) delete copy.sourceSnapshot.totals[key];
  return stable(copy);
}

function buildRepair(raw, entries, appliedAt) {
  const parsed = TeamSettlementDocumentSchema.parse(raw);
  if (parsed.confirmedAt) return { skip: 'confirmed' };
  const difference = compareTeamSettlementExpenses(parsed, entries);
  if (!difference.missing.length && !difference.changed.length && !difference.unexpected.length && !difference.duplicate.length) return { skip: 'unchanged' };
  const candidate = JSON.parse(JSON.stringify(raw));
  let manualAmountMatches = 0;
  for (const direction of ['deduction', 'addition']) {
    const key = direction === 'deduction' ? 'deductions' : 'additions';
    const rows = raw[key] || [];
    const current = new Map(rows.filter(isExpense).map(row => [row.id, row]));
    const expected = entries.filter(entry => entry.direction === direction).map(entry => entry.item);
    for (const entry of difference.missing.filter(entry => entry.direction === direction)) {
      const oldTotal = rows.filter(row => isExpense(row) && row.origin === entry.item.origin).reduce((sum, row) => sum + row.amount, 0);
      const newTotal = expected.filter(row => row.origin === entry.item.origin).reduce((sum, row) => sum + row.amount, 0);
      if (newTotal > oldTotal && rows.some(row => row.source === 'manual' && row.amount === entry.item.amount)) manualAmountMatches++;
    }
    const replacement = expected.map(item => {
      const old = current.get(item.id);
      return old?.amount === item.amount ? old : { ...old, ...item };
    });
    const first = rows.findIndex(isExpense);
    const kept = rows.filter(row => !isExpense(row));
    const insertAt = first < 0 ? kept.length : rows.slice(0, first).filter(row => !isExpense(row)).length;
    kept.splice(insertAt, 0, ...replacement);
    candidate[key] = kept;
  }
  if (manualAmountMatches) return { skip: 'manual-review', manualAmountMatches };
  if (candidate.sourceSnapshot) {
    const totals = candidate.sourceSnapshot.totals;
    totals.deductions = sumAuto(candidate.deductions);
    totals.additions = sumAuto(candidate.additions);
    totals.net = totals.sales - totals.purchases - totals.deductions + totals.additions;
  }
  candidate.updatedAt = appliedAt;
  TeamSettlementDocumentSchema.parse(candidate);
  if (protectedContent(raw) !== protectedContent(candidate)) throw new Error('protected-content-changed');
  const remaining = compareTeamSettlementExpenses(candidate, entries);
  if (Object.values(remaining).some(rows => rows.length)) throw new Error('repair-incomplete');
  return { candidate, difference, hasSnapshot: Boolean(candidate.sourceSnapshot) };
}
module.exports = { buildRepair, protectedContent, stable };
