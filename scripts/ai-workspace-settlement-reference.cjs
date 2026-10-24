// Load only existing pure calculation declarations; never import services with read-time writes.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
function loadPure(file, names, output) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = source.statements.filter(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => names.includes(declaration.name.getText(source))));
  if (declarations.length !== names.length) throw new Error('기준 계산 함수 구성이 변경되었습니다.');
  const code = ts.transpileModule(declarations.map(value => value.getText(source)).join('\n') + `\nmodule.exports = ${output};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const sandbox = { module: { exports: {} }, exports: {} }; vm.runInNewContext(code, sandbox, { timeout: 1000 }); return sandbox.module.exports;
}
const buildTeamStats = loadPure('src/pages/payroll/TeamSettlementStatisticsPage.tsx', ['safeNumber', 'safeAverage', 'extractTotalManDayFromMemo', 'isPayrollDeduction', 'isExpenseDeduction', 'isDirectSalesLine', 'buildTeamStats'], 'buildTeamStats');
const strip = loadPure('src/services/teamSettlementService.ts', ['stripSupportOriginalLines'], 'stripSupportOriginalLines');
const supportAmountReference = loadPure('src/services/teamSettlementService.ts', ['calculateSupportLaborAmount'], 'calculateSupportLaborAmount');
module.exports = { supportAmountReference, calculateReference: doc => buildTeamStats({ id: doc.teamId, name: doc.teamName }, strip(doc)) };
