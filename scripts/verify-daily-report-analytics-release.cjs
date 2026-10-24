// Local release gate only. No deployment, credentials or live business data access.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sourceState, sameSourceState } = require('./release-manifest.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.tmp/ai-workspace-qa/statistics-release-gate');
fs.mkdirSync(output, { recursive: true });
const before = sourceState();
const steps = [
  ['project', ['scripts/verify-project-health.js']],
  ['lint', ['node_modules/eslint/bin/eslint.js', 'src/services/dailyReportAnalyticsClient.ts', 'src/services/dailyReportAnalyticsClient.test.ts', 'src/services/geminiAnalyticsService.ts', 'src/services/aiSettingsService.ts', 'src/services/aiSettingsService.test.ts', 'src/pages/settings/AISettingsPage.tsx', 'functions/src/dailyReportAnalyticsAi.ts', 'functions/src/dailyReportAnalyticsAi.test.ts', 'functions/src/dailyReportAnalyticsPrompts.ts', 'functions/src/roleClaims.ts']],
  ['server', ['--test', 'functions/lib/dailyReportAnalyticsAi.test.js', 'functions/lib/geminiModelPolicy.test.js']],
  ['emulator', ['scripts/run-ai-workspace-tests.mjs', '--statistics']],
  ['build', ['--max-old-space-size=8192', 'scripts/react-scripts-build.js']],
  ['manifest', ['scripts/release-manifest.cjs']],
  ['hosting', ['scripts/verify-hosting-build.js']],
];
const report = { startedAt: new Date().toISOString(), completedAt: null, localChecksPassed: false, productionValidated: false, gates: [], source: before };
for (const [name, command] of steps) {
  const log = path.join(output, `${name}.txt`), fd = fs.openSync(log, 'w'), started = Date.now();
  let result;
  try { result = spawnSync(process.execPath, typeof command === 'function' ? command() : command, { cwd: root, env: { ...process.env, CI: 'true' }, stdio: ['ignore', fd, fd] }); }
  finally { fs.closeSync(fd); }
  report.gates.push({ name, passed: result.status === 0 && !result.error, elapsedMs: Date.now() - started });
  console.log(`${result.status === 0 && !result.error ? 'PASS' : 'FAIL'} ${name}`);
  if (result.status !== 0 || result.error) break;
}
report.sourceUnchanged = sameSourceState(before, sourceState());
report.localChecksPassed = report.sourceUnchanged && report.gates.length === steps.length && report.gates.every(gate => gate.passed);
report.completedAt = new Date().toISOString();
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.localChecksPassed ? 'Local release checks passed. Production validation remains separate.' : 'Local release checks incomplete; inspect the named gate log or source changes.');
if (!report.localChecksPassed) process.exitCode = 1;
