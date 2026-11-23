const { launch } = require('./client-workflow-qa/browser.cjs');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
    const browser = await launch();
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
        // Isolated development session; block every external service and perform no account writes.
        await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
        const page = await context.newPage();
        await page.goto('http://localhost:3000/admin/user-management?devAdmin=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.getByRole('heading', { name: '사용자 관리', exact: true }).waitFor({ timeout: 60000 });
        const output = path.resolve(__dirname, '../artifacts/user-management-preview'); fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'localhost-3000.png'), fullPage: true });
        const result = { overview: await page.getByLabel('사용자 관리 현황').count(), roleCards: await page.getByRole('group', { name: '시스템 권한 선택' }).count(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) };
        if (result.overview !== 1 || result.roleCards !== 1 || result.overflow) throw new Error(JSON.stringify(result));
        console.log(JSON.stringify({ localhost: 3000, ...result }));
    } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
