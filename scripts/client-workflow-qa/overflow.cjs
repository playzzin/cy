const { launch, pageFor, origin } = require('./browser.cjs');
(async () => {
  const browser = await launch();
  try {
    const { page } = await pageFor(browser, 'office', 390);
    await page.goto(origin + process.argv[2]); await page.waitForTimeout(2500);
    console.log(JSON.stringify(await page.evaluate(() => {
      const results = [];
      for (const node of document.querySelectorAll('body *')) {
        if (node.scrollWidth <= node.clientWidth + 3 || !node.getBoundingClientRect().width) continue;
        const before = document.documentElement.scrollWidth;
        const old = node.style.overflow;
        node.style.overflow = 'hidden';
        const after = document.documentElement.scrollWidth;
        node.style.overflow = old;
        if (after < before) results.push({ tag: node.tagName, class: node.className, text: node.innerText?.slice(0, 70), before, after, width: node.clientWidth, scrollWidth: node.scrollWidth });
      }
      const pseudo = [];
      for (const node of document.querySelectorAll('body *')) for (const side of ['::before', '::after']) {
        const css = getComputedStyle(node, side);
        if (!['none', 'normal'].includes(css.content)) pseudo.push({ tag: node.tagName, class: node.className, side, content: css.content, width: css.width, position: css.position });
      }
      const main = document.querySelector('#main-content');
      const hidden = [];
      for (const node of main.querySelectorAll('*')) {
        const before = document.documentElement.scrollWidth;
        const old = node.style.display; node.style.display = 'none'; const after = document.documentElement.scrollWidth; node.style.display = old;
        if (after < before) hidden.push({ tag: node.tagName, class: node.className, text: node.textContent?.slice(0, 50), after });
      }
      results.push({ hidden: hidden.slice(-12) });
      const probes = [];
      for (const node of main.children) {
        for (const [prop, value] of [['display', 'none'], ['position', 'relative'], ['overflow', 'clip']]) {
          const old = node.style[prop]; node.style[prop] = value; probes.push({ prop, width: document.documentElement.scrollWidth }); node.style[prop] = old;
        }
      }
      return { results, probes, pseudo: pseudo.slice(0, 25), direct: [...main.children].map(node => ({ tag: node.tagName, class: node.className, width: node.clientWidth, scrollWidth: node.scrollWidth, position: getComputedStyle(node).position, margin: getComputedStyle(node).margin })) };
    }), null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
