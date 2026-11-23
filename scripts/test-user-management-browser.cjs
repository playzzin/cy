process.env.NODE_ENV = 'development';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const webpack = require('webpack');
const { launch } = require('./client-workflow-qa/browser.cjs');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'fixtures/user-management-preview');
const output = path.join(root, 'artifacts/user-management-preview');
const origin = 'http://127.0.0.1:4197';
async function build() {
    const replacements = ['contexts/AuthContext', 'utils/devAdminSession', 'components/admin/IntegratedPositionManager',
        ...['userService', 'manpowerService', 'officeStaffService', 'companyService', 'positionService', 'userMenuPositionService', 'menuServiceV11', 'userAccessClaimsService', 'permissionAuditService', 'accountLinkService'].map(name => `services/${name}`)];
    const compiler = webpack({ mode: 'development', devtool: false, context: root, entry: path.join(fixture, 'index.tsx'),
        output: { path: output, filename: 'preview.js', publicPath: '/' }, resolve: { extensions: ['.tsx', '.ts', '.js'] },
        module: { rules: [
            { test: /\.[jt]sx?$/, exclude: /node_modules/, use: { loader: require.resolve('babel-loader'), options: { presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]] } } },
            { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader'), { loader: require.resolve('postcss-loader'), options: { postcssOptions: { plugins: [require('tailwindcss')({ content: [path.join(root, 'src/pages/admin/UserManagementPage.tsx'), path.join(root, 'src/components/admin/*.tsx')] })] } } }] },
        ] }, plugins: replacements.map(name => new webpack.NormalModuleReplacementPlugin(new RegExp(name.replaceAll('/', '[\\\\/]') + '$'), path.join(fixture, 'mocks.tsx'))) });
    await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString('errors-only'))) : resolve())));
}
(async () => {
    fs.mkdirSync(output, { recursive: true }); await build();
    const browser = await launch(); const results = [];
    try {
        for (const width of [390, 1440]) {
            const context = await browser.newContext({ viewport: { width, height: 1000 } });
            await context.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== origin) return route.abort();
                return url.pathname === '/preview.js' ? route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(output, 'preview.js')) }) : route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/preview.js"></script></html>' });
            });
            const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.goto(origin + '/admin/user-management');
            await page.getByLabel('기본 직책', { exact: true }).selectOption('총괄');
            await page.getByRole('group', { name: '시스템 권한 선택' }).getByRole('button', { name: /관리자/ }).click();
            await page.getByRole('button', { name: '직책·권한 저장' }).click();
            await page.getByRole('button', { name: '저장', exact: true }).click();
            await page.getByText('저장 완료', { exact: true }).waitFor(); await page.getByRole('button', { name: 'OK', exact: true }).click();
            await page.locator('.swal2-container').waitFor({ state: 'detached' });
            assert.equal((await page.evaluate(() => window.__qaCalls))[0][1].role, 'admin');
            await page.screenshot({ path: path.join(output, `access-${width}.png`), fullPage: true });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'access overflow');

            await page.getByRole('button', { name: '연결 관리 →' }).click();
            await page.getByRole('button', { name: '가상 관리자 연결 해제' }).click();
            await page.getByRole('button', { name: '취소', exact: true }).click();
            assert.equal((await page.evaluate(() => window.__qaCalls)).filter(row => row[0] === 'unlink').length, 0);
            await page.getByRole('button', { name: '가상 관리자 연결 해제' }).click();
            await page.getByRole('button', { name: '해제 확정' }).click();
            await page.getByText('가상 관리자 연결을 해제했습니다.', { exact: true }).waitFor();
            await page.getByRole('button', { name: '상세 닫기' }).click();

            await page.getByRole('button', { name: /^승인 요청/ }).click();
            await page.getByRole('button', { name: '연결 대상 찾기·변경' }).click();
            const candidates = page.getByRole('group', { name: '연결 대상 후보' });
            await candidates.getByRole('button', { name: /가상 신청자.*시공팀/ }).click();
            await page.getByRole('button', { name: '승인하고 연결' }).click();
            await page.screenshot({ path: path.join(output, `approval-${width}.png`), fullPage: true });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'approval overflow');
            await page.getByRole('button', { name: '연결 확정' }).click();
            await page.getByText('가상 신청자님의 가상 신청자 연결을 승인했습니다.', { exact: true }).waitFor();
            assert.deepEqual((await page.evaluate(() => window.__qaCalls)).find(row => row[0] === 'match'), ['match', 'r1', 'w2']);

            const office = page.getByRole('article', { name: '가상 사무직 사용 승인 요청' });
            await office.getByRole('button', { name: '연결 대상 지정·승인' }).click();
            await page.getByRole('button', { name: '사무실', exact: true }).waitFor();
            assert.equal(await page.getByRole('button', { name: '사무실', exact: true }).getAttribute('aria-pressed'), 'true');
            await page.locator('.um-recommendations').getByRole('button', { name: /가상 사무직/ }).click();
            await page.getByRole('button', { name: '연결', exact: true }).click();
            await page.getByRole('button', { name: '연결 확정' }).click();
            await page.getByText('가상 사무직 사무실 직원을 연결했습니다.', { exact: true }).waitFor();
            await page.screenshot({ path: path.join(output, `connection-${width}.png`), fullPage: true });
            assert.deepEqual(errors, []); results.push({ width, accessSave: true, unlinkCancelAndConfirm: true, matchedApproval: true, officeLink: true, overflow: false });
            await context.close();
        }
    } finally { await browser.close(); }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
})().catch(error => { console.error(error); process.exitCode = 1; });
