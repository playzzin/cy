const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase/app');
const firestore = require('firebase/firestore');

const root = path.resolve(__dirname, '../..');
const projectId = 'demo-taxinvoice-issue-e2e';
const host = '127.0.0.1';
const port = 18086;
const clients = [];

function createClient(name, emulatorPort = port) {
  const app = initializeApp({ projectId, apiKey: 'demo-only' }, name);
  const db = firestore.initializeFirestore(app, { ignoreUndefinedProperties: true });
  firestore.connectFirestoreEmulator(db, host, emulatorPort);
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
    const originalRequire = createRequire(filename);
    const localRequire = request => {
      if (request === '../config/firebase') return { db };
      if (request.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), request) + '.ts';
        if (fs.existsSync(target)) return load(target);
      }
      return originalRequire(request);
    };
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const execute = vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename });
    execute(localRequire, module, module.exports);
    cache.set(filename, module.exports);
    return module.exports;
  }
  const client = { db, app, service: load('src/services/taxInvoiceListService.ts').taxInvoiceListService };
  clients.push(client);
  return client;
}

function issue(id, overrides = {}) {
  return { id, yearMonth: '2080-01', no: 1, isNew: '', issueDate: '2080-01-31', recipient: '통합검증 합성 업체',
    item: '검증 품목', supplyAmount: 100, note: '', manDays: 1, teamName: '검증팀', remark: '',
    issueStatus: 'ready', scanCompleted: false, ...overrides };
}

async function seed(db, rows) {
  for (let start = 0; start < rows.length; start += 450) {
    const batch = firestore.writeBatch(db);
    rows.slice(start, start + 450).forEach(({ id, ...data }) => batch.set(firestore.doc(db, 'tax_invoice_issues', id), data));
    await batch.commit();
  }
}

async function close() {
  await Promise.all(clients.map(async ({ db, app }) => { await firestore.terminate(db); await deleteApp(app); }));
}

module.exports = { root, projectId, host, port, createClient, issue, seed, close, firestore };
