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
            const bitmap = await createImageBitmap(blob);
            window.__copiedInvoice = { type: blob.type, size: blob.size, width: bitmap.width, height: bitmap.height };
            bitmap.close();
            window.__copiedInvoiceBlob = blob;
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
      const deductions = page.getByRole('region', { name: '공제 내역' });
      const payrollHeader = deductions.getByRole('group', { name: '대납청구비 합계', exact: true });
      const preview = payrollHeader.getByRole('button', { name: '대납청구서 보기' });
      await preview.waitFor();
      const validationToggle = page.getByRole('button', { name: /^정산 검증/ });
      const missingToggle = page.getByRole('button', { name: /^정산누락/ });
      assert.equal(await validationToggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await missingToggle.getAttribute('aria-expanded'), 'false');
      await validationToggle.click();
      const expenseMessages = await page.getByRole('status', { name: '경비 원본 검증' }).getByRole('listitem').allTextContents();
      for (const message of expenseMessages) assert.equal(await page.getByText(message, { exact: true }).count(), 1);
      await missingToggle.click();
      assert.equal(await validationToggle.getAttribute('aria-expanded'), 'false');
      await missingToggle.click();
      assert.equal(await preview.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(37, 99, 235)');
      const buttonBounds = await preview.boundingBox();
      const amountBounds = await payrollHeader.getByText('220,000원', { exact: true }).boundingBox();
      assert.ok(buttonBounds && amountBounds && (buttonBounds.x + buttonBounds.width <= amountBounds.x || buttonBounds.y + buttonBounds.height <= amountBounds.y) , '대납청구서 버튼은 공제의 청구금액 앞에 표시된다');
      assert.equal(await page.locator('#settlement-additions').getByRole('button', { name: '대납청구서 보기' }).count(), 0);
      const purchases = page.getByRole('region', { name: '매입 내역' });
      assert.doesNotMatch(await purchases.innerText(), /급여|인력소개비|대납청구서/);
      assert.equal(await page.getByLabel('매입 - 200,000원 (1공수)', { exact: true }).isVisible(), true);
      assert.equal(await page.getByRole('group', { name: '거래내역 합산 금액' }).getByText('1,200,000원', { exact: true }).isVisible(), true);
      await page.locator('.team-settlement-page__transaction-totals').screenshot({ path: path.join(output, `transaction-totals-${width}.png`) });
      const summary = page.getByRole('region', { name: '정산 요약' });
      await summary.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `settlement-equation-${width}.png`) });
      assert.equal(await summary.getByText('270,000원', { exact: true }).isVisible(), true);
      assert.equal(await summary.getByText('610,000원', { exact: true }).isVisible(), true);
      const invoiceSummary = deductions.getByRole('table', { name: '대납청구비 요약' });
      assert.equal(await invoiceSummary.getByRole('row', { name: /^인력소개비 1명 120,000원/ }).isVisible(), true);
      assert.equal(await invoiceSummary.getByRole('row', { name: /^청구금액 1공수 100,000원/ }).isVisible(), true);
      assert.equal(await invoiceSummary.getByText('가상작업자 1', { exact: true }).count(), 0, '첫 화면에는 인원별 이름을 펼치지 않는다');
      assert.equal(await deductions.getByRole('group', { name: '소개비 포함 대납청구비 합계' }).getByText('220,000원', { exact: true }).isVisible(), true);
      await invoiceSummary.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `invoice-summary-${width}.png`) });
      await invoiceSummary.getByRole('button', { name: '인력소개비 상세' }).click();
      const feeDetails = deductions.getByRole('table', { name: '인력소개비 인원별 금액' });
      assert.equal(await feeDetails.getByRole('columnheader', { name: '발생일수' }).isVisible(), true);
      assert.equal(await feeDetails.getByRole('row', { name: /가상작업자 1 2일 .*120,000원/ }).isVisible(), true);
      assert.equal(await feeDetails.getByRole('columnheader', { name: '공수', exact: true }).count(), 0);
      await feeDetails.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `recruiter-fee-${width}.png`) });
      await invoiceSummary.getByRole('button', { name: '청구금액 상세' }).click();
      const claimDetails = deductions.getByRole('table', { name: '청구금액 인원별 금액' });
      assert.equal(await claimDetails.getByRole('row', { name: '가상작업자 1 1 100,000원', exact: true }).isVisible(), true);
      assert.equal(await feeDetails.count(), 0);
      await invoiceSummary.getByRole('button', { name: '청구금액 상세' }).click();
      assert.equal(await claimDetails.count(), 0);
      await invoiceSummary.getByRole('button', { name: '인력소개비 상세' }).click();
      await validationToggle.click();
      assert.equal(await feeDetails.count(), 0, '검증을 열면 청구 상세를 닫는다');
      await validationToggle.click();
      assert.equal(await page.locator('#settlement-additions').getByRole('group', { name: '추가 총금액' }).getByText('50,000원', { exact: true }).isVisible(), true);
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
      assert.match(cells[cells.length - 2].trim(), /^120,000\s*발생 2일$/);
      assert.equal(cells[cells.length - 1].trim(), '220,000');
      assert.doesNotMatch(await invoice.innerText(), /가상작업자 2|가상 현장 A|610,000원/);
      assert.equal(await invoice.getByRole('button', { name: '화면복사' }).isEnabled(), true);
      assert.equal(await invoice.getByRole('button', { name: '인력소개비 저장' }).count(), 0);
      assert.equal(await invoice.evaluate(node => node.scrollWidth <= node.clientWidth), true, '모바일 청구서 전체가 가로 화면 안에 표시된다');
      if (width >= 1024) {
        const dialogBounds = await invoice.boundingBox();
        const statement = invoice.getByRole('table', { name: '팀 대납청구 내역' });
        const tableBounds = await statement.boundingBox();
        const lastColumn = await statement.getByRole('columnheader', { name: '청구금액', exact: true }).boundingBox();
        assert.ok(dialogBounds && tableBounds && lastColumn && dialogBounds.x + dialogBounds.width <= width && tableBounds.x >= dialogBounds.x && lastColumn.x + lastColumn.width <= width, '우측 청구 영역에 일자부터 청구금액까지 모든 열이 한 번에 보인다');
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
      const additions = page.getByRole('region', { name: '추가 내역' });
      await additions.getByRole('button', { name: '+ 수기 추가', exact: true }).click();
      const editableAmount = additions.locator('input[aria-label="금액"]:enabled');
      await editableAmount.fill('75000');
      assert.equal(await additions.getByRole('group', { name: '추가 총금액' }).getByText('125,000원', { exact: true }).isVisible(), true);
      await additions.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `additions-total-${width}.png`) });
      await additions.locator('button:not([disabled])').filter({ hasText: /^삭제$/ }).click();
      assert.equal(await additions.getByRole('group', { name: '추가 총금액' }).getByText('50,000원', { exact: true }).isVisible(), true);
      await page.goto(`${origin}/payroll/team-settlement?accommodation=1`);
      const roomRow = page.getByRole('row', { name: /숙소 숙소 전체/ });
      await roomRow.getByRole('button', { name: '상세', exact: true }).click();
      assert.equal(await roomRow.locator('input[aria-label="비고"]').inputValue(), '숙소 2개', '청구서 1건 안의 숙소 2개를 센다');
      const accommodation = page.getByRole('region', { name: '숙소 주소별 상세' });
      assert.equal(await accommodation.getByRole('columnheader', { name: '상세주소', exact: true }).count(), 0);
      assert.equal(await accommodation.getByText('검증시 첫길 1 검증 101호', { exact: true }).isVisible(), true);
      assert.equal(await accommodation.getByText('검증시 첫길 1 검증 201호', { exact: true }).isVisible(), true);
      assert.doesNotMatch(await accommodation.innerText(), /개인 301호|다른팀 401호|990,000|880,000/);
      assert.equal((await roomRow.locator('input[aria-label="금액"]').inputValue()).replace(/,/g, ''), '950000');
      const address = accommodation.getByRole('row', { name: /검증시 첫길 1 검증 101호/ });
      await address.getByText('650,000원', { exact: true }).waitFor();
      assert.equal(await accommodation.getByText('300,000원', { exact: true }).isVisible(), true);
      assert.equal(await accommodation.getByText('950,000원', { exact: true }).isVisible(), true);
      await address.getByRole('button', { name: /더상세/ }).click();
      const costs = accommodation.getByRole('table', { name: '검증시 첫길 1 검증 101호 비용 내역' });
      for (const [category, amount] of [['전기', '30,000원'], ['가스', '20,000원'], ['월세', '500,000원'], ['공과금', '100,000원']]) {
        assert.equal(await costs.getByRole('row', { name: new RegExp('^' + category + ' ') }).getByRole('cell', { name: amount, exact: true }).isVisible(), true);
      }
      await costs.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `accommodation-${width}.png`) });
      assert.equal(await costs.evaluate(table => table.scrollWidth <= table.clientWidth + 1), true, '주소별 비용 표가 모바일 폭 안에 표시된다');
      const secondAddress = accommodation.getByRole('row', { name: /검증시 첫길 1 검증 201호/ });
      await secondAddress.getByRole('button', { name: /더상세/ }).click();
      assert.equal(await costs.count(), 0, '다른 주소를 열면 이전 주소만 닫고 숙소 부모는 유지한다');
      assert.equal(await accommodation.getByRole('table', { name: '검증시 첫길 1 검증 201호 비용 내역' }).isVisible(), true);
      await address.getByRole('button', { name: /더상세/ }).click();
      await address.getByRole('button', { name: /더상세/ }).click();
      assert.equal(await costs.count(), 0);
      await page.goto(`${origin}/payroll/team-settlement?validation=1`);
      await page.getByRole('button', { name: '정산누락 1건 확인 필요' }).click();
      assert.equal(await page.getByText('정산금액 미입력', { exact: true }).count(), 1);
      assert.equal(await page.getByText(/매출의 공수는 있지만/).count(), 0);
      await page.locator('#settlement-missing').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `missing-accordion-${width}.png`) });
      await validationToggle.click();
      assert.equal(await missingToggle.getAttribute('aria-expanded'), 'false');
      const reportsToggle = page.getByRole('button', { name: /^정산 기준 출력일보 팀·현장 보기/ });
      await reportsToggle.click();
      assert.equal(await validationToggle.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('#settlement-validation').getByRole('table').isVisible(), true);
      await page.locator('#settlement-validation').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `validation-accordion-${width}.png`) });
      await missingToggle.click();
      assert.equal(await page.locator('#settlement-validation').getByRole('table').count(), 0);
      await page.goto(`${origin}/payroll/team-settlement?grouped=1`);
      const groupedAdditions = page.getByRole('region', { name: '추가 내역' });
      await groupedAdditions.getByRole('button', { name: '식대 상세' }).waitFor();
      assert.equal(await groupedAdditions.getByRole('row', { name: /^식대 2건 50,000\s*원/ }).isVisible(), true);
      assert.equal(await groupedAdditions.getByRole('group', { name: '추가 총금액' }).getByText('90,000원', { exact: true }).isVisible(), true);
      await groupedAdditions.getByRole('button', { name: '식대 상세' }).click();
      const mealDetails = groupedAdditions.getByRole('table', { name: '식대 개별 내역' });
      await mealDetails.waitFor();
      await mealDetails.locator('input[value="20,000"]').waitFor();
      await mealDetails.locator('input[value="30,000"]').waitFor();
      assert.equal(await mealDetails.locator('input[value="20,000"]').count(), 1);
      assert.equal(await mealDetails.locator('input[value="30,000"]').count(), 1);
      await groupedAdditions.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `grouped-additions-${width}.png`) });
      await groupedAdditions.getByRole('button', { name: '유류 상세' }).click();
      assert.equal(await mealDetails.count(), 0);
      assert.equal(await groupedAdditions.getByRole('table', { name: '유류 개별 내역' }).isVisible(), true);
      await page.getByRole('button', { name: '검증팀 B 선택' }).click();
      assert.equal(await groupedAdditions.getByRole('table', { name: '유류 개별 내역' }).count(), 0);

      await page.goto(`${origin}/payroll/team-settlement?shell=1&many=1`);
      await page.getByRole('button', { name: '대납청구서 보기' }).click();
      const fittedInvoice = page.getByRole('dialog', { name: '검증팀 A 청구서' });
      await fittedInvoice.getByText('가상추가인원 39', { exact: true }).waitFor();
      const fitWithinContent = async () => {
        await page.waitForFunction(() => {
          const dialog = document.querySelector('.team-workbook-statement-dialog');
          const viewport = document.querySelector('.team-workbook-statement-preview__viewport');
          const paper = document.querySelector('[data-statement-preview-paper]');
          const main = document.getElementById('main-content');
          if (!dialog || !viewport || !paper || !main) return false;
          const d = dialog.getBoundingClientRect(), v = viewport.getBoundingClientRect(), p = paper.getBoundingClientRect(), m = main.getBoundingClientRect();
          return d.left >= m.left && d.right <= m.right + 1 && d.top >= 60 && d.bottom <= window.innerHeight + 1
            && p.width > 0 && p.height > 0 && p.left >= v.left - 1 && p.right <= v.right + 1 && p.top >= v.top - 1 && p.bottom <= v.bottom + 1
            && viewport.scrollHeight <= viewport.clientHeight + 1 && viewport.scrollWidth <= viewport.clientWidth + 1;
        });
      };
      await fitWithinContent();
      await page.screenshot({ path: path.join(output, `invoice-fit-content-${width}.png`) });
      await fittedInvoice.getByRole('button', { name: '100%', exact: true }).click();
      assert.equal(await fittedInvoice.getByRole('button', { name: '100%', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.waitForFunction(() => {
        const viewport = document.querySelector('.team-workbook-statement-preview__viewport');
        return viewport.scrollHeight > viewport.clientHeight;
      });
      await fittedInvoice.getByRole('button', { name: '전체 맞춤', exact: true }).click();
      await fitWithinContent();
      await page.setViewportSize({ width, height: 700 });
      await fitWithinContent();
      await fittedInvoice.getByRole('button', { name: '화면복사', exact: true }).click();
      await page.waitForFunction(() => window.__copiedInvoice?.height > 2000);
      const copySize = await page.evaluate(() => window.__copiedInvoice);
      assert.ok(copySize.width >= 2000, '화면 맞춤 배율과 관계없이 전체 원본 너비로 복사한다');
      const copied = await page.evaluate(async () => Array.from(new Uint8Array(await window.__copiedInvoiceBlob.arrayBuffer())));
      fs.writeFileSync(path.join(output, `invoice-full-copy-${width}.png`), Buffer.from(copied));
      await fittedInvoice.getByRole('button', { name: '상세 닫기' }).click();
      await fittedInvoice.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []);
      await page.goto(`${origin}/payroll/daily-advance-workbook`);
      await page.getByRole('button', { name: '검증팀 A 선택' }).click();
      await page.getByRole('button', { name: '청구서', exact: true }).click();
      await page.getByRole('button', { name: '가상작업자 1 소개비 발생일 지정' }).click();
      const dateDialog = page.getByRole('dialog', { name: '가상작업자 1 소개비 발생일' });
      const thirdDay = dateDialog.getByRole('button', { name: /-03 소개비 발생일$/ });
      assert.equal(await thirdDay.getAttribute('aria-pressed'), 'true');
      await thirdDay.click();
      await dateDialog.getByRole('button', { name: /-04 소개비 발생일$/ }).click();
      await dateDialog.screenshot({ path: path.join(output, `fee-dates-${width}.png`) });
      await dateDialog.getByRole('button', { name: '선택 완료' }).click();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: '인력소개비 저장 (1)' }).click();
      await page.waitForFunction(() => !!localStorage.getItem('synthetic-fee-date-edits'));
      const savedFees = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('synthetic-fee-date-edits'))));
      assert.equal(savedFees.length, 1);
      assert.equal(savedFees[0].amount, 120000);
      assert.deepEqual(savedFees[0].chargeDates, [`${savedFees[0].month}-01`, `${savedFees[0].month}-04`]);
      await page.goto(`${origin}/payroll/team-settlement`);
      await page.getByRole('button', { name: '인력소개비 상세' }).click();
      assert.match(await page.getByRole('table', { name: '인력소개비 인원별 금액' }).innerText(), /2일[\s\S]*01,.*04[\s\S]*120,000원/);
      await page.goto(`${origin}/payroll/team-settlement?shell=1&service=1`);
      const serviceButton = page.getByRole('button', { name: '용역비청구 보기' });
      await serviceButton.waitFor();
      assert.equal(await serviceButton.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(37, 99, 235)');
      const serviceSummary = page.getByRole('table', { name: '대납청구비 요약' });
      assert.equal(await serviceSummary.getByRole('row', { name: /^용역비 1공수 160,000원/ }).isVisible(), true);
      assert.equal(await page.getByRole('region', { name: '정산 요약' }).getByText('450,000원', { exact: true }).isVisible(), true);
      await serviceSummary.getByRole('button', { name: '용역비 상세' }).click();
      assert.equal(await page.getByRole('table', { name: '용역비 인원별 금액' }).getByRole('row', { name: '가상용역 1 1 60,000원 160,000원' }).isVisible(), true);
      await serviceSummary.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `service-invoice-summary-${width}.png`) });
      await serviceButton.click();
      let serviceInvoice = page.getByRole('dialog', { name: '검증팀 A 용역비 청구서' });
      await serviceInvoice.getByText('가상용역 1', { exact: true }).waitFor();
      assert.doesNotMatch(await serviceInvoice.innerText(), /가상용역 2|가상작업자/);
      const serviceCells = await serviceInvoice.getByRole('row', { name: /^일자별 공수합계/ }).getByRole('cell').allTextContents();
      assert.deepEqual(serviceCells.slice(-4).map(value => value.trim()), ['1', '60,000', '160,000', '']);
      await fitWithinContent();
      const serviceTable = serviceInvoice.getByRole('table', { name: '용역비 청구 내역' });
      assert.equal(await serviceTable.evaluate(table => table.parentElement.scrollWidth <= table.parentElement.clientWidth + 1), true);
      await page.screenshot({ path: path.join(output, `service-invoice-${width}.png`) });
      await serviceInvoice.getByRole('button', { name: '화면복사' }).click();
      await page.waitForFunction(() => window.__copiedInvoice?.size > 0);
      const serviceDownloadEvent = page.waitForEvent('download');
      await serviceInvoice.getByRole('button', { name: '엑셀 다운로드' }).click();
      const serviceDownload = await serviceDownloadEvent;
      assert.match(serviceDownload.suggestedFilename(), /용역팀.*\.xlsx$/);
      const serviceWorkbook = require('xlsx-js-style').readFile(await serviceDownload.path());
      const serviceExcelRows = require('xlsx-js-style').utils.sheet_to_json(serviceWorkbook.Sheets['용역팀'], { header: 1 });
      assert.deepEqual(serviceExcelRows.at(-1).slice(-4), [1, 60000, 160000, '']);
      await serviceInvoice.getByRole('button', { name: '상세 닫기' }).click();
      await page.getByRole('button', { name: '검증팀 B 선택' }).click();
      await serviceButton.click();
      serviceInvoice = page.getByRole('dialog', { name: '검증팀 B 용역비 청구서' });
      await serviceInvoice.getByText('가상용역 2', { exact: true }).waitFor();
      assert.doesNotMatch(await serviceInvoice.innerText(), /가상용역 1|가상작업자/);
      assert.deepEqual(errors, []);
      results.push({ width, serviceInvoiceDeductionAndDetails: true, serviceInvoiceFitsContent: true, serviceInvoiceExcel: true, serviceInvoiceTeamScope: true, statementFitsContentWidthAndHeight: true, fullSizeInvoiceCopy: true, grossTransactionTotal: true, exclusivePageAccordions: true, deduplicatedValidation: true, nestedAddressAccordion: true, accommodationRoomCount: true, explicitRecruiterFeeChargeDates: true, combinedAccommodationAddress: true, excludesPersonalAndOtherTeamAccommodation: true, accommodationRoomsAtSameAddress: true, groupedAdditions: true, invoiceInDeductions: true, payrollRemovedFromPurchases: true, settlementDeductsInvoiceOnly: true, workerFeeDetails: true, collapsedInvoiceSummary: true, feeWorkerCountAndClaimManDays: true, additionsTotal: true, accommodationAddressGroups: true, accommodationCostBreakdown: true, internalCategoryIdsHidden: true, currentTeamWorkbookStatement: true, feeColumnAndTotalVisible: true, imageCopy: true, excelDownload: true, teamSwitch: true, pageErrors: errors });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
