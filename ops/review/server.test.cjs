const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { reviewServer } = require('./server.cjs');

test('private review gates HTML and assets, and only exchanges same-origin sessions', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'review-test-'));
  t.after(() => fs.rm(directory, { recursive: true }));
  await fs.writeFile(path.join(directory, 'index.html'), '<title>ERP fixture</title>');
  await fs.writeFile(path.join(directory, 'icon.png'), 'fixture');
  let calls = 0;
  const app = reviewServer({
    directory,
    revision: 'a'.repeat(40),
    authorize: async (value) => {
      if (value !== 'fixture') throw new Error();
    },
    exchange: async () => {
      calls++;
      return { token: 'fixture-readonly' };
    },
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const headers = { 'x-goog-iap-jwt-assertion': 'fixture' };
  for (const route of ['/', '/icon.png', '/_review/session']) {
    assert.equal((await fetch(origin + route)).status, 403);
    assert.equal(
      (await fetch(origin + route, { headers: { 'x-goog-iap-jwt-assertion': 'wrong' } })).status,
      403,
    );
  }
  const page = await fetch(origin + '/dashboard', { headers });
  assert.match(await page.text(), /aaaaaaaa/);
  assert.match(page.headers.get('cache-control'), /no-store/);
  const frame = await fetch(origin + '/dashboard?devPreviewFrame=1', {
    headers: { ...headers, 'sec-fetch-dest': 'iframe' },
  });
  assert.match(await frame.text(), /ERP fixture/);
  assert.equal((await fetch(origin + '/_review/session', { method: 'POST', headers })).status, 403);
  const session = await fetch(origin + '/_review/session', {
    method: 'POST',
    headers: { ...headers, 'x-cy-review': '1', 'sec-fetch-site': 'same-origin' },
  });
  assert.equal((await session.json()).token, 'fixture-readonly');
  assert.equal(calls, 1);
});
