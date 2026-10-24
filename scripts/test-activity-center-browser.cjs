const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    const output = path.resolve(__dirname, '../artifacts/activity-center-preview');
    // Serve the compiled fixture inside the browser; no network access required.
    await page.route('http://127.0.0.1:42775/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = path.resolve(output, '.' + pathname);
      if (pathname.endsWith('.js') && file.startsWith(output + path.sep) && fs.existsSync(file)) {
        await route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(file) });
      } else {
        await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f8fafc;font-family:Arial,"Malgun Gothic",sans-serif}a{text-decoration:none}</style><div id="root"></div><script src="/preview.js"></script></html>' });
      }
    });
    await page.goto('http://127.0.0.1:42775/activity?source=login');
    await page.getByText('테스트 현장 50', { exact: true }).waitFor();
    const reads = () => page.locator('body').getAttribute('data-query-count');
    assert.equal(await reads(), '1');
    assert.equal(await page.getByRole('navigation').getByRole('link').count(), 1);
    await page.screenshot({ path: path.join(output, 'desktop.png') });
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByText('테스트 현장 63', { exact: true }).waitFor();
    assert.equal(await reads(), '2');
    await page.getByRole('button', { name: '이전', exact: true }).click();
    await page.getByText('테스트 현장 1', { exact: true }).waitFor();
    await page.getByLabel('시작일', { exact: true }).fill('2026-10-01');
    await page.getByLabel('현재 페이지 검색', { exact: true }).fill('테스트 현장 2');
    assert.equal(await reads(), '2');
    await page.getByLabel('기록 종류', { exact: true }).selectOption('materials');
    await page.getByText('자재 내역', { exact: true }).waitFor();
    await page.getByRole('button', { name: '수정 상세 보기' }).first().click();
    await page.getByRole('region', { name: '활동 상세' }).waitFor();
    assert.equal(await page.getByRole('region', { name: '활동 상세' }).getByRole('cell', { name: '15', exact: true }).count(), 1);
    await page.getByRole('region', { name: '활동 상세' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'detail.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'mobile.png') });
    const size = await page.evaluate(() => ({ viewport: innerWidth, body: document.documentElement.scrollWidth }));
    assert.ok(size.body <= size.viewport, 'The page must not overflow horizontally');
    await page.getByLabel('기록 종류', { exact: true }).selectOption('ai');
    await page.getByRole('heading', { name: 'Gemini 사용량·비용 로그' }).waitFor();
    assert.equal(await page.getByLabel('기록 종류', { exact: true }).inputValue(), 'ai');
    assert.deepEqual(failures, []);
    const result = { passed: true, checks: ['single menu', '50-record first page', 'cursor next page', 'cached previous page', 'no reads while editing', 'source selection', 'change details', '390px mobile width', 'lazy AI page'], pageErrors: failures };
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
