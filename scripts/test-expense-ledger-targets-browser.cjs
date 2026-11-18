// Builds the actual page with synthetic services. No production requests or writes.
process.env.NODE_ENV = 'development';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const webpack = require('webpack');
const { launch } = require('./client-workflow-qa/browser.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/expense-ledger-targets');

async function build() {
  const compiler = webpack({
    mode: 'development', devtool: false, context: root,
    entry: path.join(root, 'fixtures/expense-ledger-targets-preview/index.tsx'),
    output: { path: output, filename: 'preview.js' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: { rules: [
      { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: {
        presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]],
      } } },
      { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader'), {
        loader: require.resolve('postcss-loader'), options: { postcssOptions: { plugins: [require('tailwindcss')({
          content: [path.join(root, 'src/pages/support/**/*.tsx'), path.join(root, 'src/components/card/**/*.tsx'), path.join(root, 'src/components/support/**/*.tsx'), path.join(root, 'src/components/common/MonthNavigator.tsx'), path.join(root, 'src/components/support/SupportTeamFilterTabs.tsx')],
        })] } },
      }] },
    ] },
    plugins: [
      new webpack.NormalModuleReplacementPlugin(/services[\\/](?:manpowerService|officeStaffService|teamService|siteService|companyService|accommodationBillingService|accommodationBillingTargetService|cardBillingService|cardService|vehicleBillingService|teamExpenseLedgerService|teamExpenseCategoryService|dailyReportService)$/,
        path.join(root, 'fixtures/expense-ledger-targets-preview/services.ts')),
      new webpack.NormalModuleReplacementPlugin(/components[\\/]SecureExpenseReceipt$/,
        path.join(root, 'fixtures/expense-ledger-targets-preview/receipt.tsx')),
    ],
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => {
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString('errors-only')));
    else resolve();
  })));
}

(async () => {
  await build();
  const browser = await launch();
  const results = [];
  try {
    for (const width of [390, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://127.0.0.1:4196') return route.abort();
        const asset = path.join(output, path.basename(url.pathname));
        if (url.pathname.endsWith('.js') && fs.existsSync(asset)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(asset) });
        if (url.pathname !== '/') return route.abort();
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/preview.js"></script></html>' });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
      page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
      await page.goto('http://127.0.0.1:4196/?targets=old');
      await page.getByRole('tab', { name: '팀별 보기: 가상A팀', exact: true }).click().catch(async error => {
        console.error((await page.locator('body').innerText()).slice(0, 2500));
        throw error;
      });
      await page.getByRole('button', { name: '숙소비 상세 보기', exact: true }).click();
      let detail = page.getByRole('region', { name: '숙소비 아코디언 상세내역' });
      assert.match(await detail.innerText(), /1,400,000/);
      await page.goto('http://127.0.0.1:4196/');
      await page.getByRole('tab', { name: '팀별 보기: 가상A팀', exact: true }).click();
      await page.getByRole('button', { name: '숙소비 상세 보기', exact: true }).click();
      detail = page.getByRole('region', { name: '숙소비 아코디언 상세내역' });
      assert.match(await detail.innerText(), /개인청구 금액은 참고용이며 팀 합계에서 제외/);
      assert.match(await detail.innerText(), /400,000/);
      assert.match(await detail.locator('tfoot').innerText(), /1,000,000/);
      assert.doesNotMatch(await detail.locator('tfoot').innerText(), /1,400,000/);
      await page.screenshot({ path: path.join(output, `accommodation-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: '카드값 상세 보기', exact: true }).click();
      assert.match(await page.getByRole('region', { name: '카드값 아코디언 상세내역' }).innerText(), /내역이 없습니다/);
      await page.getByRole('tab', { name: '팀별 보기: 가상B팀', exact: true }).click();
      await page.getByRole('button', { name: '카드값 상세 보기', exact: true }).click();
      const cardDetail = page.getByRole('region', { name: '카드값 아코디언 상세내역' });
      assert.match(await cardDetail.innerText(), /가상카드 \(1234\)/);
      assert.match(await cardDetail.locator('tfoot').innerText(), /500,000/);
      await page.screenshot({ path: path.join(output, `card-${width}.png`), fullPage: true });
      await page.goto('http://127.0.0.1:4196/?mode=dates');
      const startDate = page.getByLabel('청구 시작일', { exact: true });
      await startDate.fill('2027-01-15');
      await page.getByRole('button', { name: '배정자에게 청구 저장', exact: true }).click();
      await page.getByRole('button', { name: '확인', exact: true }).click();
      await page.waitForFunction(() => sessionStorage.getItem('fixture.billingStartDate') === '2027-01-15');
      await page.reload();
      assert.equal(await startDate.inputValue(), '2027-01-15');
      await page.screenshot({ path: path.join(output, 'billing-dates-' + width + '.png'), fullPage: true });
      assert.deepEqual(errors, []);
      results.push({ width, personalExcluded: true, personalAmountVisible: true, cardMoved: true, billingDate2027Saved: true, consoleErrors: errors.length });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
