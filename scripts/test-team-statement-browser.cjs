// Render the actual pages against synthetic services. No live account or data writes.
process.env.NODE_ENV = 'development';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const webpack = require('webpack');
const { launch } = require('./client-workflow-qa/browser.cjs');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/team-statement-preview');
const output = path.join(root, 'artifacts/team-statement-preview');
const origin = 'http://127.0.0.1:4197';

async function build() {
  const compiler = webpack({
    mode: 'development', devtool: false, context: root,
    entry: path.join(fixture, 'index.tsx'),
    output: { path: output, filename: 'preview.js', publicPath: '/' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [
      { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
      { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader'), { loader: require.resolve('postcss-loader'), options: { postcssOptions: { plugins: [require('tailwindcss')({ content: [path.join(root, 'src/pages/payroll/*.tsx'), path.join(root, 'src/components/{common,payroll}/*.tsx')] })] } } }] },
    ] },
    plugins: [new webpack.NormalModuleReplacementPlugin(/(?:services[\\/][^/\\]+|hooks[\\/]useTeamSettlementAccess|utils[\\/]swal)$/, path.join(fixture, 'services.ts'))],
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => {
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString('errors-only')));
    else resolve();
  })));
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await build();
  const browser = await launch();
  const results = [];
  try {
    for (const width of [390, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      // Inspect the generated image without overwriting the user's clipboard.
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          write: async items => {
            const blob = await items[0].getType('image/png');
            window.__copiedInvoice = { type: blob.type, size: blob.size };
          },
        } });
      });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        const filename = path.basename(url.pathname);
        if (url.pathname === `/${filename}` && filename.endsWith('.js') && fs.existsSync(path.join(output, filename))) {
          return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(output, filename)) });
        }
        if (!url.pathname.startsWith('/payroll/')) return route.abort();
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/preview.js"></script></html>' });
      });
      const errors = [];
      context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
      const page = await context.newPage();
      await page.goto(`${origin}/payroll/team-settlement`);
      const payrollHeader = page.getByRole('group', { name: '급여 합계' });
      const preview = payrollHeader.getByRole('button', { name: '대납청구서 보기' });
      await preview.waitFor();
      assert.equal(await preview.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(37, 99, 235)');
      const buttonBounds = await preview.boundingBox();
      const amountBounds = await payrollHeader.getByText('420,000원', { exact: true }).boundingBox();
      assert.ok(buttonBounds && amountBounds && buttonBounds.x + buttonBounds.width <= amountBounds.x && Math.abs(buttonBounds.y + buttonBounds.height / 2 - amountBounds.y - amountBounds.height / 2) < 2, '대납청구서 버튼은 급여 합계 금액 앞의 같은 줄에 표시된다');
      assert.equal(await page.locator('#settlement-additions').getByRole('button', { name: '대납청구서 보기' }).count(), 0);
      const feeRow = page.locator('#settlement-purchase-payroll').getByRole('row', { name: /급여 인력소개비/ });
      assert.equal(await feeRow.getByRole('textbox', { name: '금액' }).inputValue(), '120,000');
      await feeRow.getByRole('button', { name: '상세', exact: true }).click();
      const feeDetails = page.getByRole('table', { name: '인력소개비 상세 내역' });
      assert.match(await feeDetails.innerText(), /가상작업자 1/);
      assert.match(await feeDetails.innerText(), /120,000원/);
      await feeDetails.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `recruiter-fee-${width}.png`) });
      assert.doesNotMatch(await page.locator('#settlement-additions').innerText(), /인력소개비|custom_/);
      assert.match(await page.locator('#settlement-additions').innerText(), /장비 대여/);
      await preview.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `settlement-${width}.png`) });
      await preview.click();
      let invoice = page.getByRole('dialog', { name: '검증팀 A 청구서' });
      await invoice.waitFor();
      assert.equal(context.pages().length, 1, '청구서는 현재 정산 화면의 미리보기로 생성한다');
      await invoice.getByRole('region', { name: '대납출력부 팀 청구서' }).waitFor();
      await invoice.getByRole('columnheader', { name: '인력소개비', exact: true }).waitFor();
      assert.match(await invoice.getByLabel('인력소개비 합계', { exact: true }).innerText(), /120,000원/);
      assert.match(await invoice.getByLabel('청구금액 합계', { exact: true }).innerText(), /220,000원/);
      const invoiceRow = invoice.getByRole('row', { name: /^1 가상작업자 1/ });
      const cells = await invoiceRow.getByRole('cell').allTextContents();
      assert.equal(cells[cells.length - 2].trim(), '120,000');
      assert.equal(cells[cells.length - 1].trim(), '220,000');
      assert.doesNotMatch(await invoice.innerText(), /가상작업자 2|가상 현장 A|410,000원/);
      assert.equal(await invoice.getByRole('button', { name: '화면복사' }).isEnabled(), true);
      assert.equal(await invoice.getByRole('button', { name: '인력소개비 저장' }).count(), 0);
      assert.equal(await invoice.evaluate(node => node.scrollWidth <= node.clientWidth), true, '모바일 청구서 전체가 가로 화면 안에 표시된다');
      if (width >= 1024) {
        const dialogBounds = await invoice.boundingBox();
        const statement = invoice.getByRole('table', { name: '팀 대납청구 내역' });
        const tableBounds = await statement.boundingBox();
        const lastColumn = await statement.getByRole('columnheader', { name: '청구금액', exact: true }).boundingBox();
        assert.ok(dialogBounds && tableBounds && lastColumn && dialogBounds.x + dialogBounds.width === width && tableBounds.x >= dialogBounds.x && lastColumn.x + lastColumn.width <= width, '우측 청구 영역에 일자부터 청구금액까지 모든 열이 한 번에 보인다');
        assert.equal(await statement.evaluate(table => table.parentElement.scrollWidth <= table.parentElement.clientWidth), true);
      }
      await page.screenshot({ path: path.join(output, `invoice-${width}.png`) });
      await invoice.getByRole('button', { name: '화면복사' }).click();
      await page.waitForFunction(() => window.__copiedInvoice?.size > 0, null, { timeout: 30000 });
      assert.equal(await page.evaluate(() => window.__copiedInvoice.type), 'image/png');
      const downloadEvent = page.waitForEvent('download');
      await invoice.getByRole('button', { name: '엑셀 다운로드' }).click();
      const download = await downloadEvent;
      assert.match(download.suggestedFilename(), /검증팀_A.*청구서.*\.xlsx$/);
      await invoice.getByRole('button', { name: '상세 닫기' }).click();
      await invoice.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: '검증팀 B 선택' }).click();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.team-settlement-page__statement-button')).backgroundColor === 'rgb(22, 163, 74)');
      await preview.click();
      invoice = page.getByRole('dialog', { name: '검증팀 B 청구서' });
      await invoice.waitFor();
      await invoice.getByRole('columnheader', { name: '인력소개비', exact: true }).waitFor();
      assert.match(await invoice.getByLabel('인력소개비 합계', { exact: true }).innerText(), /30,000원/);
      assert.match(await invoice.getByLabel('청구금액 합계', { exact: true }).innerText(), /130,000원/);
      assert.doesNotMatch(await invoice.innerText(), /가상작업자 1/);
      assert.equal(await invoice.getByText('검증팀 A', { exact: true }).count(), 0);
      await invoice.getByRole('button', { name: '상세 닫기' }).click();
      await page.goto(`${origin}/payroll/team-settlement?edit=1`);
      await page.getByRole('button', { name: '+ 수기 도급/직영 매출', exact: true }).click();
      const sales = page.getByRole('table', { name: '도급/직영 매출', exact: true });
      const manual = sales.getByRole('row').filter({ has: page.locator('input[aria-label="현장"][value="수기"]') });
      await manual.getByRole('textbox', { name: '현장', exact: true }).fill('삭제 검증 현장');
      const added = sales.getByRole('row').filter({ has: page.locator('input[aria-label="현장"][value="삭제 검증 현장"]') });
      await added.getByRole('textbox', { name: '금액', exact: true }).fill('250000');
      await added.getByRole('button', { name: '상세', exact: true }).click();
      await page.getByRole('button', { name: '수기 매출 삭제', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `manual-sale-${width}.png`) });
      await page.getByRole('button', { name: '수기 매출 삭제', exact: true }).click();
      assert.equal(await sales.locator('input[value="삭제 검증 현장"]').count(), 0);
      assert.equal(await sales.locator('input[value="가상 현장 A"]').count(), 1);
      assert.deepEqual(errors, []);
      results.push({ width, feePayrollDeduction: true, workerFeeDetails: true, internalCategoryIdsHidden: true, currentTeamWorkbookStatement: true, feeColumnAndTotalVisible: true, imageCopy: true, excelDownload: true, teamSwitch: true, pageErrors: errors });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
