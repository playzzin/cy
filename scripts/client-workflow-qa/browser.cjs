const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(process.env.APPDATA, 'npm/node_modules/openclaw/node_modules/playwright-core'));
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'artifacts/client-workflow-qa');
const origin = 'http://127.0.0.1:4195';
async function launch() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  return browser;
}
async function pageFor(browser, role = 'office', width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
  // No production or third-party network traffic can leave a QA browser context.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && ['4195', '18089', '19099', '19199', '15019'].includes(url.port)) return route.continue();
    if (['blob:', 'data:'].includes(url.protocol)) return route.continue();
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('dialog', dialog => dialog.dismiss());
  const errors = [];
  page.on('console', message => { if (/AG Grid: error #272/.test(message.text())) errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.stack || error.message));
  const client = await context.newCDPSession(page);
  await client.send('Runtime.enable');
  client.on('Runtime.exceptionThrown', event => errors.push({ url: event.exceptionDetails.url, line: event.exceptionDetails.lineNumber, description: event.exceptionDetails.exception?.description }));
  await page.goto(`${origin}/login`);
  try { await page.locator('input[inputmode=email]').fill(`${role}@qa.example.test`); }
  catch (error) {
    await page.screenshot({ path: path.join(output, 'bootstrap-error.png'), fullPage: true });
    throw new Error(JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0, 1600), reason: error.message }));
  }
  await page.locator('input[type=password]').fill('Local-QA-only-2026!');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url => !url.pathname.includes('login'), { timeout: 30000 });
  return { page, context, errors };
}
module.exports = { launch, pageFor, output, origin };
if (require.main === module) (async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await launch();
  try {
    const role = process.argv[2] || 'leader';
    const { page, errors } = await pageFor(browser, role);
    if (process.argv[3]) await page.goto(origin + process.argv[3]);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(output, `pilot-${role}.png`), fullPage: true });
    console.log(JSON.stringify({ url: page.url(), text: (await page.locator('body').innerText()).slice(0, 6500), errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
