const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { launch, output } = require('./browser.cjs');
(async () => {
  const browser = await launch();
  const results = [];
  try {
    for (const mode of ['unsupported', 'share', 'cancel']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 900 }, acceptDownloads: true });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.origin === 'http://127.0.0.1:4193' || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
      });
      await context.addInitScript(mode => {
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => mode !== 'unsupported' });
        Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
          window.__shareCapture = { keys: Object.keys(data), files: await Promise.all(data.files.map(async file => ({ name: file.name, type: file.type, size: file.size, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) }))) };
          if (mode === 'cancel') throw new DOMException('Cancelled', 'AbortError');
        } });
      }, mode);
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4193/?preview=photo');
      await page.getByRole('button', { name: '사진 공유·저장' }).click();
      const preview = page.getByRole('img', { name: '공유할 사진' });
      await preview.waitFor();
      const size = await preview.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
      assert.deepEqual(size, { width: 1200, height: 760 });
      if (mode === 'unsupported') {
        assert.equal(await page.getByRole('button', { name: '공유창 열기' }).count(), 0);
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: '사진 저장', exact: true }).click();
        const file = await download;
        assert.match(file.suggestedFilename(), /\.png$/);
        await file.saveAs(path.join(output, 'android-kakao-synthetic.png'));
        const bytes = fs.readFileSync(path.join(output, 'android-kakao-synthetic.png'));
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        results.push({ mode, passed: true, ...size, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
      } else {
        await page.getByRole('button', { name: '공유창 열기' }).click();
        await page.getByText(mode === 'cancel' ? '공유를 취소했습니다.' : '공유창 처리를 마쳤습니다. 전송 여부는 선택한 앱에서 확인해 주세요.', { exact: true }).waitFor();
        const capture = await page.evaluate(() => window.__shareCapture);
        assert.deepEqual(capture.keys, ['files']); assert.equal(capture.files.length, 1);
        assert.equal(capture.files[0].type, 'image/png');
        const actual = Buffer.from(capture.files[0].bytes);
        assert.deepEqual(actual, fs.readFileSync(path.join(output, 'android-kakao-synthetic.png')));
        results.push({ mode, passed: true, keys: capture.keys, type: capture.files[0].type, bytes: actual.length, nativeShareMocked: true });
      }
      await page.screenshot({ path: path.join(output, `photo-${mode}.png`) });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'photo-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
