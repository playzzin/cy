// Production read-only inventory. Never print object names, URLs, or tokens.
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS ||= path.join(process.env.APPDATA, 'gcloud/application_default_credentials.json');
async function main() {
  const app = admin.initializeApp({ projectId: 'cyee-9c1e4', storageBucket: 'cyee-9c1e4.firebasestorage.app' });
  try {
    const report = {};
    for (const prefix of ['team-expense-receipts/', 'signatures/']) {
      const [files] = await app.storage().bucket().getFiles({ prefix });
      let tokenized = 0;
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        if (metadata.metadata?.firebaseStorageDownloadTokens) tokenized++;
      }
      report[prefix] = { objects: files.length, tokenized };
    }
    const workers = await app.firestore().collection('workers').select('signatureUrl').get();
    report.workerSignatures = { referenced: workers.docs.filter(doc => Boolean(doc.data().signatureUrl)).length };
    console.log(JSON.stringify(report, null, 2));
  } finally { await app.delete(); }
}
main().catch(error => { console.error(`Private-file audit failed (${error.code || error.name}).`); process.exitCode = 1; });
