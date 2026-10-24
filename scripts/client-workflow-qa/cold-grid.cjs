const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { launch, pageFor, output, origin } = require('./browser.cjs');
(async () => {
  const browser = await launch();
  const results = [];
  try {
    for (const width of [390, 1366]) for (const [kind, count] of [['sites', 2], ['workers', 4], ['teams', 2], ['companies', 1]]) {
      // Each fresh page starts before DataConsolePage can register modules globally.
      const { page, context, errors } = await pageFor(browser, 'office', width);
      await page.goto(origin + '/manpower/refine-' + kind);
      await page.waitForFunction(expected => document.querySelectorAll('.ag-center-cols-container .ag-row').length === expected, count);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(output, `cold-grid-${kind}-${width}.png`) });
      results.push({ kind, width, rows: count, passed: true });
      await context.close();
    }
    const { page, errors } = await pageFor(browser, 'office', 390);
    await page.goto(origin + '/payroll/delegation-letter-v3');
    const canvas = page.getByRole('region', { name: '위임장 편집 영역' });
    await canvas.scrollIntoViewIfNeeded();
    const rect = await canvas.boundingBox();
    assert.ok(rect.width >= 300 && rect.height >= 500);
    await page.getByText('텍스트', { exact: true }).first().click();
    await canvas.scrollIntoViewIfNeeded();
    await canvas.getByText('텍스트를 입력하세요', { exact: false }).first().waitFor();
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, 'builder-mobile-canvas.png') });
    results.push({ kind: 'document-builder-canvas', width: 390, passed: true, canvasWidth: rect.width });
    fs.writeFileSync(path.join(output, 'cold-grid-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
