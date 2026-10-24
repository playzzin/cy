// Local-only performance regression harness. Never connect this fixture runner to production.
const { chromium } = require('C:/Users/playz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { performance } = require('node:perf_hooks');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const baseUrl = 'http://127.0.0.1:3127';
const projectId = 'demo-dev-user-preview';
const destination = path.resolve(__dirname, '../.tmp/team-worker-performance-20261018');
const label = process.env.PERF_LABEL || 'measurement';
assert.match(label, /^[a-z0-9-]+$/);
const runs = Number(process.env.PERF_RUNS || 3);
const latencyMs = 400;
const profilePath = '/manpower/team-worker-detail';
const historyPath = '/manpower/team-worker-history';
const password = 'Preview-demo-2026!';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
fs.mkdirSync(destination, { recursive: true });

async function seedFixtures() {
  assert.equal(process.env.GCLOUD_PROJECT, projectId);
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):8080$/);
  const { initializeApp, deleteApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ projectId }, `team-perf-${Date.now()}`);
  try {
    const db = getFirestore(app);
    const batch = db.batch();
    for (const [teamId, teamName] of [['ta', '검증 A팀'], ['tb', '검증 B팀']]) {
      batch.set(db.doc(`teams/${teamId}`), { companyName: '청연이엔지', leaderId: teamId === 'ta' ? 'wa' : 'wb' }, { merge: true });
      for (let i = 1; i <= 60; i++) {
        const id = `perf-${teamId}-${i}`;
        batch.set(db.doc(`workers/${id}`), {
          name: `성능 ${teamId === 'ta' ? 'A' : 'B'} ${String(i).padStart(3, '0')}`,
          teamId, teamName, companyName: '청연이엔지', role: '작업자', status: '재직', isActive: true,
          unitPrice: 100000,
        });
      }
    }
    for (const id of ['wa', 'wb', 'wc']) batch.set(db.doc(`workers/${id}`), { companyName: '청연이엔지' }, { merge: true });
    const date = new Date();
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    for (let day = 1; day <= 20; day++) {
      for (const teamId of ['ta', 'tb']) {
        batch.set(db.doc(`daily_reports/perf-${teamId}-${day}`), {
          date: `${month}-${String(day).padStart(2, '0')}`, teamId, teamName: teamId === 'ta' ? '검증 A팀' : '검증 B팀',
          siteId: teamId === 'ta' ? 'sa' : 'sb', siteName: `검증 ${teamId === 'ta' ? 'A' : 'B'}현장`,
          workers: Array.from({ length: 60 }, (_, i) => ({ workerId: `perf-${teamId}-${i + 1}`, workerName: `성능 ${teamId === 'ta' ? 'A' : 'B'} ${String(i + 1).padStart(3, '0')}`, teamId, manDay: 1, unitPrice: 100000, amount: 100000 })),
        });
      }
    }
    const menuRef = db.doc('settings/menus_v12');
    const menu = (await menuRef.get()).data();
    assert.ok(menu?.pos_lead, 'Run the dev-preview rule fixtures first.');
    const links = [
      { id: 'perf-profile', text: '작업자정보', path: profilePath },
      { id: 'perf-history', text: '작업자 근무내역', path: historyPath },
    ];
    const old = (menu.pos_lead.menu || []).filter(item => !links.some(link => link.id === item.id));
    batch.update(menuRef, { 'pos_lead.menu': [...old, ...links] });
    await batch.commit();
  } finally {
    await deleteApp(app);
  }
}

function readCollections(request) {
  if (!request.url().includes('/getTeamScopedData')) return [];
  try {
    const data = request.postDataJSON()?.data;
    return (Array.isArray(data?.requests) ? data.requests : [data])
      .map(item => String(item?.collection || 'unknown'));
  } catch { return ['unknown']; }
}

const rounded = value => Math.round(value);
async function measureSample(browser, scenario, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const pageErrors = [];
  const requests = [];
  let phase = 'login';
  let phaseStart = performance.now();
  page.on('pageerror', error => pageErrors.push(error.name));
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) return route.abort();
    const collections = readCollections(request);
    const isData = ['8080', '5001'].includes(url.port);
    if (collections.length) requests.push({ phase, elapsedMs: rounded(performance.now() - phaseStart), collections });
    if (isData) await sleep(latencyMs + (collections.includes('daily_reports') ? scenario.monthlyDelayMs : 0));
    await route.continue();
  });
  const begin = name => { phase = name; phaseStart = performance.now(); };
  const worker = name => page.locator('.tw-worker-item').filter({ hasText: name }).first();
  const ready = async () => {
    await page.locator('.tw-worker-item').first().waitFor({ timeout: 120000 });
    const firstListMs = rounded(performance.now() - phaseStart);
    await page.locator('.tw-worker-hero h2').waitFor({ timeout: 120000 });
    const profileMs = rounded(performance.now() - phaseStart);
    await page.waitForFunction(() => {
      const button = document.querySelector('.tw-primary-button');
      return button && !button.disabled;
    }, undefined, { timeout: 120000 });
    assert.equal(await page.locator('.tw-alert-stack').count(), 0, 'No data error is allowed.');
    assert.equal(await page.locator('.tw-worker-item').filter({ hasText: /성능 B |검증 팀장 B/ }).count(), 0, 'Other-team workers must remain excluded.');
    assert.equal(await page.locator('.tw-team-picker-button strong').innerText(), '검증 A팀', 'The accessible team must be selected.');
    const totalManDays = Number((await page.locator('.tw-kpi-grid .tw-kpi:nth-child(2) strong').innerText()).replace(/,/g, ''));
    assert.ok(totalManDays >= 1200 && totalManDays <= 1202, 'Monthly team totals must include all 60 synthetic workers and remain team-scoped.');
    return { firstListMs, profileMs, allDataMs: rounded(performance.now() - phaseStart), workerCount: await page.locator('.tw-worker-item').count() };
  };
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('admin@example.com').fill('leader-a@example.test');
    await page.getByPlaceholder('비밀번호를 입력하세요').fill(password);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.locator('#sidebar').waitFor({ timeout: 120000 });
    await page.locator('#sidebar a').filter({ hasText: '작업자정보' }).first().waitFor({ timeout: 60000 });
    begin('first-entry');
    await page.goto(`${baseUrl}${profilePath}`, { waitUntil: 'domcontentloaded' });
    const firstEntry = await ready();
    begin('worker-selection');
    await worker('성능 A 060').click();
    await page.getByRole('heading', { name: '성능 A 060', exact: true }).waitFor();
    const workerSelectionMs = rounded(performance.now() - phaseStart);
    await page.locator('#sidebar a[href="/dashboard"]').first().click();
    await page.locator('.tw-worker-item').first().waitFor({ state: 'hidden', timeout: 60000 });
    begin('revisit');
    await page.locator(`#sidebar a[href="${profilePath}"]`).first().click();
    const revisit = await ready();
    if (run === 1) {
      await page.screenshot({ path: path.join(destination, `${label}-${scenario.name}-desktop.png`), animations: 'disabled' });
      await page.setViewportSize({ width: 390, height: 844 });
      begin('mobile-worker-selection');
      await worker('성능 A 001').click();
      await page.getByRole('heading', { name: '성능 A 001', exact: true }).waitFor();
      await page.screenshot({ path: path.join(destination, `${label}-${scenario.name}-mobile.png`), animations: 'disabled' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.setViewportSize({ width: 1440, height: 1000 });
      begin('history');
      await page.locator(`#sidebar a[href="${historyPath}"]`).first().click();
      await worker('성능 A 001').waitFor({ timeout: 120000 });
      await worker('성능 A 001').click();
      await page.getByRole('heading', { name: '성능 A 001', exact: true }).waitFor();
      await page.waitForFunction(() => {
        const button = document.querySelector('.tw-primary-button');
        return button && !button.disabled;
      }, undefined, { timeout: 120000 });
      assert.equal(await page.locator('.tw-alert-stack').count(), 0);
      const history = page.getByRole('region', { name: '작업자 근무내역', exact: true });
      await history.getByText('20공수', { exact: true }).waitFor();
      assert.equal(await history.locator('.worker-history__day--worked').count(), 20);
      await history.getByRole('tab', { name: '목록보기', exact: true }).click();
      assert.equal(await history.locator('.worker-history__row').count(), 20);
      await history.locator('.worker-history__row').first().click();
      await page.getByRole('dialog').getByText('100,000원', { exact: true }).first().waitFor();
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(pageErrors, []);
    return { scenario: scenario.name, run, latencyMs, monthlyDelayMs: scenario.monthlyDelayMs, firstEntry, revisit, workerSelectionMs, requests: requests.filter(item => item.phase !== 'login') };
  } catch (error) {
    await page.screenshot({ path: path.join(destination, `${label}-${scenario.name}-failure.png`), animations: 'disabled' }).catch(() => undefined);
    // No response bodies, tokens, names from production, or raw network payloads are logged.
    fs.writeFileSync(path.join(destination, `${label}-${scenario.name}-failure.json`), JSON.stringify({ phase, pageErrors, requests }, null, 2));
    throw error;
  } finally {
    await context.close();
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : rounded((sorted[middle - 1] + sorted[middle]) / 2);
}

(async () => {
  if (process.argv.includes('--seed')) await seedFixtures();
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const samples = [];
  try {
    for (const scenario of [{ name: 'normal-network', monthlyDelayMs: 0 }, { name: 'slow-monthly-report', monthlyDelayMs: 1200 }]) {
      for (let run = 1; run <= runs; run++) {
        const sample = await measureSample(browser, scenario, run);
        samples.push(sample);
        console.log(JSON.stringify({ scenario: scenario.name, run, firstEntry: sample.firstEntry, revisit: sample.revisit, workerSelectionMs: sample.workerSelectionMs }));
      }
    }
    const summaries = [...new Set(samples.map(item => item.scenario))].map(scenario => {
      const group = samples.filter(item => item.scenario === scenario);
      return { scenario, runs: group.length, latencyMs, monthlyDelayMs: group[0].monthlyDelayMs,
        firstListMs: median(group.map(item => item.firstEntry.firstListMs)),
        firstProfileMs: median(group.map(item => item.firstEntry.profileMs)),
        firstAllDataMs: median(group.map(item => item.firstEntry.allDataMs)),
        revisitListMs: median(group.map(item => item.revisit.firstListMs)),
        workerSelectionMs: median(group.map(item => item.workerSelectionMs)),
      };
    });
    const result = { label, environment: 'local demo emulator; development bundle; synthetic fixtures', summaries, samples };
    fs.writeFileSync(path.join(destination, `${label}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ status: 'passed', summaries }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
