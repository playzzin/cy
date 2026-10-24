const fs = require('node:fs');
const path = require('node:path');
const { launch, pageFor, output, origin } = require('./browser.cjs');
(async () => {
  const browser = await launch();
  const results = [];
  try {
    const { page } = await pageFor(browser, 'office', 390);
    for (const route of process.argv.slice(2)) {
      await page.goto(origin + route); await page.waitForTimeout(2000);
      results.push({ route, outer: await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, main: document.querySelector('#main-content')?.getBoundingClientRect().toJSON(), nodes: [...document.body.querySelectorAll('*')].filter(node => !node.closest('#main-content') && node.getBoundingClientRect().right > innerWidth + 3).slice(0, 12).map(node => ({ tag: node.tagName, class: node.className, right: node.getBoundingClientRect().right, text: node.innerText?.slice(0, 45) })) })), layout: await page.evaluate(() => [...document.querySelectorAll('#main-content *')].filter(node => {
        let parent = node.parentElement;
        while (parent && parent.id !== 'main-content') { if (/auto|scroll/.test(getComputedStyle(parent).overflowX)) return false; parent = parent.parentElement; }
        const rect = node.getBoundingClientRect(); return rect.width > innerWidth || rect.right > innerWidth + 3 || rect.left < -3;
      }).slice(0, 16).map(node => ({ tag: node.tagName, class: node.className, text: node.innerText?.slice(0, 60), width: Math.round(node.getBoundingClientRect().width), left: Math.round(node.getBoundingClientRect().left), min: getComputedStyle(node).minWidth, overflow: getComputedStyle(node).overflowX, display: getComputedStyle(node).display }))) });
      await page.screenshot({ path: path.join(output, `diagnose-${route.replace(/\W/g, '_')}.png`) });
    }
    fs.writeFileSync(path.join(output, 'diagnosis.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
