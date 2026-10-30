const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const { verifyQualityResults } = require('./verify-quality-results.cjs');
const { verificationSteps } = require('./verify-project-health.js');

const root = path.resolve(__dirname, '..');
const success = { FRONTEND_RESULT: 'success', SERVER_RESULT: 'success', RULES_RESULT: 'success' };
const workflow = () => yaml.load(fs.readFileSync(path.join(root, '.github/workflows/quality.yml'), 'utf8'));
const commands = job => (job.steps || []).filter(step => step.run).map(step => step.run.trim());

test('the real gate command succeeds only after every required job succeeds', () => {
  const execute = results => {
    const env = { ...process.env };
    for (const key of Object.keys(success)) delete env[key];
    return spawnSync(process.execPath, [path.join(__dirname, 'verify-quality-results.cjs')], {
      env: { ...env, ...results }, encoding: 'utf8', shell: false, timeout: 10000,
    });
  };
  const passed = execute(success);
  assert.equal(passed.error, undefined);
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /frontend: success\r?\nserver: success\r?\nrules: success/);

  for (const key of Object.keys(success)) {
    for (const result of ['failure', 'cancelled', 'skipped', 'in_progress', 'queued', '']) {
      const failed = execute({ ...success, [key]: result });
      assert.equal(failed.error, undefined);
      assert.equal(failed.status, 1, `${key}: ${result}`);
      assert.match(failed.stderr, /Quality Gate 실패/);
    }
    const missing = { ...success };
    delete missing[key];
    assert.equal(execute(missing).status, 1, `missing ${key}`);
  }

  const marker = 'SYNTHETIC_PRIVATE_VALUE_DO_NOT_LOG';
  const invalid = execute({ ...success, SERVER_RESULT: marker });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stdout, /server: unknown/);
  assert.ok(!`${invalid.stdout}${invalid.stderr}`.includes(marker));
});

test('gate evaluation reports all required jobs even when more than one failed', () => {
  const lines = [];
  assert.throws(() => verifyQualityResults({ FRONTEND_RESULT: 'failure', SERVER_RESULT: 'cancelled' }, line => lines.push(line)),
    /frontend, server, rules/);
  assert.deepEqual(lines, ['frontend: failure', 'server: cancelled', 'rules: missing']);
});

test('the existing verify check always waits for every independent lane and cannot ignore their failures', () => {
  const { jobs } = workflow();
  assert.deepEqual([...jobs.verify.needs].sort(), ['frontend', 'rules', 'server']);
  assert.match(jobs.verify.if, /^\$\{\{\s*always\(\)\s*\}\}$/);
  assert.notEqual(jobs.verify['continue-on-error'], true);
  const gateIndex = jobs.verify.steps.findIndex(step => step.run?.trim() === 'node scripts/verify-quality-results.cjs');
  assert.ok(gateIndex >= 0);
  assert.ok(jobs.verify.steps.slice(0, gateIndex).some(step => /^actions\/checkout@/.test(step.uses || '')));
  const gate = jobs.verify.steps[gateIndex];
  assert.equal(gate.if, undefined);
  assert.notEqual(gate['continue-on-error'], true);
  const environment = { ...jobs.verify.env, ...gate.env };
  for (const job of ['frontend', 'server', 'rules']) {
    assert.match(environment[`${job.toUpperCase()}_RESULT`], new RegExp(`^\\$\\{\\{\\s*needs\\.${job}\\.result\\s*\\}\\}$`));
    const needs = jobs[job].needs || [];
    assert.equal((Array.isArray(needs) ? needs : [needs]).some(value => ['frontend', 'server', 'rules'].includes(value)), false);
    assert.notEqual(jobs[job]['continue-on-error'], true);
  }
});

test('parallel lanes preserve full frontend, server, and rules verification', () => {
  const { jobs } = workflow();
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  const frontend = commands(jobs.frontend);
  assert.ok(frontend.some(command => /^(?:npm run verify:hosting|npm run verify:project -- --scope=hosting)$/.test(command)));
  assert.equal(scripts['verify:hosting'], 'node scripts/verify-project-health.js --scope=hosting');
  assert.equal(scripts['verify:project'], 'node scripts/verify-project-health.js');
  assert.equal(scripts['test:ci'], 'node scripts/react-scripts-test.cjs');
  assert.equal(scripts['test:functions'], 'node scripts/run-functions-tests.cjs');
  assert.deepEqual(verificationSteps('hosting').map(step => step.args), [['run', 'typecheck'], ['run', 'test:ci']]);
  for (const command of ['npm run test:release-tools', 'npm run lint:improvements', 'npm run build', 'npm run verify:hosting-build']) {
    assert.ok(frontend.includes(command), `frontend must retain ${command}`);
  }
  assert.ok(frontend.indexOf('npm run build') < frontend.indexOf('npm run verify:hosting-build'));

  const server = commands(jobs.server);
  const serverStages = ['npm ci', 'npm --prefix functions ci', 'npm run functions:build', 'npm run test:functions'];
  const positions = serverStages.map(command => server.indexOf(command));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  for (const script of ['run-smart-memo-rules-test.mjs', 'run-task-notification-rules-test.mjs', 'run-storage-manager-rules-test.mjs']) {
    assert.ok(commands(jobs.rules).includes(`node scripts/${script}`), `rules must retain ${script}`);
  }
  for (const job of [jobs.frontend, jobs.server, jobs.rules]) {
    assert.notEqual(String(job.env?.CI).toLowerCase(), 'false');
    for (const step of job.steps) {
      assert.notEqual(step['continue-on-error'], true);
      assert.notEqual(String(step.env?.CI).toLowerCase(), 'false');
    }
  }
});
