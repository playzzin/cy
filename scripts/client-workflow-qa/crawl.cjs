const fs = require('node:fs');
const path = require('node:path');
const { launch, pageFor, output, origin } = require('./browser.cjs');
const root = path.resolve(__dirname, '../..');
const inventory = fs.readFileSync(path.join(root, 'docs/client-mobile-route-design-inventory.md'), 'utf8').split('\n')
  .filter(line => /^\|\//.test(line) || /^\|\*/.test(line)).map(line => {
    const [, route, component, category] = line.split('|');
    return { route, component, category };
  });
const parameters = { planId: 'qa-plan', drawingId: 'qa-drawing', snapshotId: 'qa-snapshot', recordId: 'qa-record', requestId: 'qa-request' };
const toPath = route => route.replace(/:(\w+)/g, (_, name) => parameters[name] || `qa-${name}`);
const resultsFile = path.join(output, 'route-results.json');
const only = process.argv[2];
const recheck = only === '--recheck';
const prior = recheck ? JSON.parse(fs.readFileSync(resultsFile)) : [];
const reviewComponents = new Set(prior.filter(row => row.fatal || row.horizontalOverflow || row.clipped?.length || row.errors?.length || row.state === 'failed').map(row => row.component));
for (const component of (process.env.QA_REVIEW_COMPONENTS || '').split(',').filter(Boolean)) reviewComponents.add(component);
if (recheck && !fs.existsSync(path.join(output, 'route-baseline.json'))) fs.copyFileSync(resultsFile, path.join(output, 'route-baseline.json'));
(async () => {
  const browser = await launch();
  const results = prior;
  const dir = path.join(output, 'routes'); fs.mkdirSync(dir, { recursive: true });
  try {
    for (const width of [390, 1366]) {
      const { page, context, errors } = await pageFor(browser, 'office', width);
      await page.locator('#main-content').waitFor({ timeout: 45000 });
      for (let index = 0; index < inventory.length; index++) {
        const item = inventory[index];
        if (recheck ? !reviewComponents.has(item.component) : only && !item.route.includes(only)) continue;
        const name = `${String(index + 1).padStart(3, '0')}-${width}`;
        const previousIndex = results.findIndex(row => row.screenshot === `routes/${name}.png`);
        if (previousIndex >= 0) results.splice(previousIndex, 1);
        const initialErrors = errors.length;
        try {
          // Real React Router navigation keeps the authenticated app shell mounted.
          await page.evaluate(route => { history.pushState(null, '', route); dispatchEvent(new PopStateEvent('popstate')); }, toPath(item.route));
          await page.waitForTimeout(recheck ? 1800 : 900);
          await page.locator('.app-intro--runtime').waitFor({ state: 'hidden', timeout: 12000 }).catch(() => {});
          const metrics = await page.evaluate(() => {
            const main = document.querySelector('#main-content') || document.body;
            const text = main.innerText || '';
            const clipped = [...main.querySelectorAll('button,input,select')].filter(node => {
              const r = node.getBoundingClientRect();
              if (!r.width || !r.height || r.top > innerHeight || r.bottom < 0) return false;
              let parent = node.parentElement;
              while (parent && parent !== main) {
                if (/auto|scroll/.test(getComputedStyle(parent).overflowX)) return false;
                parent = parent.parentElement;
              }
              return r.right > innerWidth + 3 || r.left < -3;
            }).slice(0, 8).map(node => ({ text: node.innerText?.slice(0, 45) || node.getAttribute('placeholder') || node.tagName, right: Math.round(node.getBoundingClientRect().right) }));
            return { title: document.title, heading: main.querySelector('h1,h2')?.textContent?.trim(), text: text.slice(0, 1600), horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 3,
              viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, clipped,
              fatal: /화면을 불러오지 못했습니다|오류가 발생했습니다.*새로고침/s.test(text),
              unavailable: /권한이 없|권한이 필요|불러오지 못|찾을 수 없|존재하지 않|설정되지 않|API 키|접근이 제한/.test(text),
              hasMain: !!document.querySelector('#main-content'), scrollHeight: document.documentElement.scrollHeight };
          });
          await page.screenshot({ path: path.join(dir, `${name}.png`) });
          results.push({ ...item, width, rechecked: recheck, url: page.url().replace(origin, ''), screenshot: `routes/${name}.png`, ...metrics, errors: errors.slice(initialErrors), state: metrics.fatal ? 'error' : metrics.unavailable ? 'unavailable' : item.route.includes(':') ? 'parameterized-fixture-review' : 'rendered' });
        } catch (error) { results.push({ ...item, width, state: 'failed', reason: error.message }); }
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        if ((index + 1) % 20 === 0) console.log(`Routes ${width}px: ${index + 1}/${inventory.length}`);
      }
      await context.close();
    }
  } finally { await browser.close(); }
  const failures = results.filter(row => row.state === 'failed' || row.fatal || row.horizontalOverflow || row.errors?.length);
  console.log(JSON.stringify({ conditions: results.length, failures: failures.map(row => ({ route: row.route, width: row.width, state: row.state, overflow: row.horizontalOverflow, errors: row.errors })) }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
