// Read-only audit. Never prints names, amounts, receipts, credentials or document IDs.
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');

async function main() {
  const app = admin.initializeApp({
    projectId: 'cyee-9c1e4',
    credential: admin.credential.applicationDefault()
  });
  const db = app.firestore();
  try {
    const [requests, claims] = await Promise.all([
      db.collection('team_expense_requests').select('status', 'claimId', 'yearMonth', 'date', 'teamId', 'chargeToTeamId', 'amount', 'category').get(),
      db.collection('team_expense_claims').where('sourceType', '==', 'team_request').select('sourceRequestId', 'yearMonth', 'date', 'payerTeamId', 'chargeToTeamId', 'amount', 'category', 'status').get(),
      // Exercise the production index without accessing any user's history.
      db.collection('team_expense_requests').where('ownerUid', '==', '__read_only_audit__').where('yearMonth', '==', new Date().toISOString().slice(0, 7)).limit(1).get()
    ]);
    const byId = new Map(claims.docs.map(doc => [doc.id, doc.data()]));
    const requestIds = new Set(requests.docs.map(doc => doc.id));
    const report = { monthlyQueryReady: true, requests: requests.size, statuses: {}, linkedClaims: claims.size, missingClaims: 0, mismatchedClaims: 0, unapprovedClaims: 0, orphanClaims: 0, duplicateClaims: 0 };
    for (const doc of requests.docs) {
      const row = doc.data();
      report.statuses[row.status] = (report.statuses[row.status] || 0) + 1;
      const claim = byId.get(row.claimId || `team-request-${doc.id}`);
      if (row.status === 'approved') {
        if (!claim) report.missingClaims++;
        else if (claim.sourceRequestId !== doc.id || claim.yearMonth !== row.yearMonth || claim.date !== row.date || claim.payerTeamId !== row.teamId || claim.chargeToTeamId !== (row.chargeToTeamId || row.teamId) || claim.amount !== row.amount || claim.category !== row.category || !['charged', 'settled'].includes(claim.status)) report.mismatchedClaims++;
      } else if (claim) report.unapprovedClaims++;
    }
    const seen = new Set();
    for (const doc of claims.docs) {
      const id = doc.data().sourceRequestId;
      if (!requestIds.has(id)) report.orphanClaims++;
      if (seen.has(id)) report.duplicateClaims++;
      seen.add(id);
    }
    console.log(JSON.stringify(report, null, 2));
  } finally { await app.delete(); }
}
process.env.GOOGLE_APPLICATION_CREDENTIALS ||= path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json');
main().catch(error => { console.error(`Read-only audit failed (${error.code || error.name}).`); process.exitCode = 1; });
