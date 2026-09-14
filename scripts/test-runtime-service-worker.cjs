const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const origin = 'https://cy.example';
const source = fs.readFileSync(path.join(__dirname, '../public/service-worker.js'), 'utf8');
const js = (body = 'window.loaded = true;') => new Response(body, {
  headers: { 'Content-Type': 'text/javascript' },
});
const html = (status = 200) => new Response('<!doctype html><html>app</html>', {
  status, headers: { 'Content-Type': 'text/html' },
});

function harness() {
  const handlers = {};
  const stores = new Map();
  const network = [];
  let response = () => js();
  let storageFails = false;
  let activated = false;
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    open: async (name) => {
      if (storageFails) throw new Error('Storage unavailable');
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        match: async (request) => store.get(key(request))?.clone(),
        put: async (request, value) => store.set(key(request), value.clone()),
        delete: async (request) => store.delete(key(request)),
        addAll: async () => {},
      };
    },
    match: async (request) => {
      for (const store of stores.values()) {
        if (store.has(key(request))) return store.get(key(request)).clone();
      }
    },
  };
  const context = vm.createContext({
    URL, Request, Response, Promise, console, caches,
    fetch: async (request) => { network.push(request); return response(request); },
    self: {
      location: { origin }, clients: { claim: async () => {} }, skipWaiting: async () => { activated = true; },
      addEventListener: (type, handler) => { handlers[type] = handler; },
    },
  });
  vm.runInContext(source, context);
  const assetName = vm.runInContext('ASSET_CACHE', context);
  const shellName = vm.runInContext('APP_SHELL_CACHE', context);
  return {
    caches, network, assetName, shellName,
    respond: (handler) => { response = handler; },
    failStorage: () => { storageFails = true; },
    async install() {
      let work;
      handlers.install({ waitUntil: (promise) => { work = promise; } });
      await work;
      return activated;
    },
    async activate() {
      let work;
      handlers.activate({ waitUntil: (promise) => { work = promise; } });
      await work;
    },
    async request(url, destination = 'script', mode = 'cors', method = 'GET') {
      const request = new Request(new URL(url, origin), { method });
      Object.defineProperties(request, { destination: { value: destination }, mode: { value: mode } });
      let result;
      const pending = [];
      handlers.fetch({ request, respondWith: (promise) => { result = promise; }, waitUntil: (promise) => pending.push(promise) });
      const value = await result;
      await Promise.all(pending);
      return value;
    },
  };
}

test('never persists an HTML hosting fallback as a JavaScript chunk', async () => {
  const app = harness();
  app.respond(() => html());
  await app.request('/static/js/42.deadbeef.chunk.js');
  assert.equal(await app.caches.match('/static/js/42.deadbeef.chunk.js'), undefined);
  app.respond(() => js());
  const retry = await app.request('/static/js/42.deadbeef.chunk.js');
  assert.match(retry.headers.get('Content-Type'), /javascript/);
  assert.equal(app.network.length, 2);
});

test('repairs an already poisoned cache and bypasses the browser HTTP cache', async () => {
  const app = harness();
  const cache = await app.caches.open(app.assetName);
  await cache.put('/static/js/42.deadbeef.chunk.js', html());
  const response = await app.request('/static/js/42.deadbeef.chunk.js');
  assert.match(response.headers.get('Content-Type'), /javascript/);
  assert.equal(app.network[0].cache, 'reload');
});

test('reuses valid hashed assets but refreshes scripts with stable URLs', async () => {
  const app = harness();
  await app.request('/static/js/42.deadbeef.chunk.js');
  await app.request('/static/js/42.deadbeef.chunk.js');
  assert.equal(app.network.length, 1);
  await app.request('/pwa-install-capture.js');
  app.respond(() => js('window.version = 2;'));
  assert.equal(await (await app.request('/pwa-install-capture.js')).text(), 'window.version = 2;');
  assert.equal(app.network.length, 3);
});

test('does not cache HTML as CSS or images', async () => {
  const app = harness();
  app.respond(() => html());
  await app.request('/static/css/42.deadbeef.chunk.css', 'style');
  await app.request('/logo.png', 'image');
  assert.equal(await app.caches.match('/static/css/42.deadbeef.chunk.css'), undefined);
  assert.equal(await app.caches.match('/logo.png'), undefined);
});

test('uses only a valid current shell during an outage', async () => {
  const app = harness();
  await (await app.caches.open(app.shellName)).put('/index.html', html());
  app.respond(() => html(503));
  assert.equal((await app.request('/dashboard', 'document', 'navigate')).status, 200);
  app.respond(() => { throw new Error('offline'); });
  assert.equal((await app.request('/dashboard', 'document', 'navigate')).status, 200);
});

test('storage failure does not prevent online files from loading', async () => {
  const app = harness();
  app.failStorage();
  assert.equal((await app.request('/static/js/42.deadbeef.chunk.js')).status, 200);
});

test('a full or blocked cache does not block the worker upgrade', async () => {
  const app = harness();
  app.failStorage();
  assert.equal(await app.install(), true);
});

test('activation removes legacy app caches without touching unrelated caches', async () => {
  const app = harness();
  await app.caches.open('cy-erp-pwa-v4-assets');
  await app.caches.open('unrelated-cache');
  await app.caches.open(app.assetName);
  await app.activate();
  assert.deepEqual(await app.caches.keys(), ['unrelated-cache', app.assetName]);
});

test('leaves API, authentication, cross-origin and write requests alone', async () => {
  const app = harness();
  for (const url of ['/api/lookup', '/__/auth/handler', 'https://firestore.googleapis.com/data']) {
    assert.equal(await app.request(url), undefined);
  }
  assert.equal(await app.request('/save', '', 'cors', 'POST'), undefined);
  assert.equal(app.network.length, 0);
});
