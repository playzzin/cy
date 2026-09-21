// Read-only production audit; output is aggregate counts, never personal fields.
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS ||= path.join(process.env.APPDATA, 'gcloud/application_default_credentials.json');

async function main() {
  const app = admin.initializeApp({ projectId: 'cyee-9c1e4' });
  const db = app.firestore();
  try {
    const [requests, registered, menu, companies] = await Promise.all([
      db.collection('team_worker_requests').select('status', 'workerId', 'teamId', 'companyId').get(),
      db.collection('workers').where('sourceType', '==', 'team_registration_request').select('registrationRequestId', 'teamId', 'companyId').get(),
      db.doc('settings/menus_v12').get(),
      db.collection('companies').select('name', 'status', 'isActive').get()
    ]);
    const report = { requests: requests.size, statuses: {}, registeredWorkers: registered.size, missingWorkers: 0, mismatchedLinks: 0, orphanWorkers: 0, duplicateWorkers: 0, eligibleCompanies: 0, workerMenuEntries: 0, expenseMenuEntries: 0, monthlyQueryReady: false };
    const byId = new Map(registered.docs.map(doc => [doc.id, doc.data()]));
    const ids = new Set(requests.docs.map(doc => doc.id));
    for (const doc of requests.docs) {
      const row = doc.data();
      report.statuses[row.status] = (report.statuses[row.status] || 0) + 1;
      if (row.status !== 'approved') continue;
      const worker = byId.get(row.workerId);
      if (!worker) report.missingWorkers++;
      else if (worker.registrationRequestId !== doc.id || worker.teamId !== row.teamId || worker.companyId !== row.companyId) report.mismatchedLinks++;
    }
    const seen = new Set();
    registered.docs.forEach(doc => { const id = doc.data().registrationRequestId; if (!ids.has(id)) report.orphanWorkers++; if (seen.has(id)) report.duplicateWorkers++; seen.add(id); });
    report.eligibleCompanies = companies.docs.filter(doc => {
      const row = doc.data();
      const name = String(row.name || '').normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|[\s㈜]/g, '');
      return ['청연이엔지', '청연eng'].includes(name) && row.isActive !== false && !['inactive', 'archived'].includes(row.status);
    }).length;
    const walk = value => {
      if (!value || typeof value !== 'object') return;
      if (value.path === '/manpower/team-worker-requests') report.workerMenuEntries++;
      if (value.path === '/support/team-expense-requests') report.expenseMenuEntries++;
      Object.values(value).forEach(walk);
    };
    walk(menu.data());
    await db.collection('team_worker_requests').where('ownerUid', '==', '__read_only_audit__').where('yearMonth', '==', new Date().toISOString().slice(0, 7)).limit(1).get();
    report.monthlyQueryReady = true;
    report.paginationQueriesReady = false;
    for (const collection of ['team_worker_requests', 'team_expense_requests']) {
      const ref = db.collection(collection), month = new Date().toISOString().slice(0, 7);
      await Promise.all([
        ref.where('yearMonth', '==', month).orderBy(admin.firestore.FieldPath.documentId()).limit(1).get(),
        ref.where('ownerUid', '==', '__read_only_audit__').where('yearMonth', '==', month).orderBy(admin.firestore.FieldPath.documentId()).limit(1).get(),
        ref.where('status', 'in', ['uploading', 'discarding']).orderBy(admin.firestore.FieldPath.documentId()).limit(1).get()
      ]);
    }
    report.paginationQueriesReady = true;
    console.log(JSON.stringify(report, null, 2));
  } finally { await app.delete(); }
}
main().catch(error => { console.error(`Read-only audit failed (${error.code || error.name}).`); process.exitCode = 1; });
