// Only removes public download tokens; object bytes and worker documents are unchanged.
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');
const projectId = 'cyee-9c1e4', bucketName = `${projectId}.firebasestorage.app`;
process.env.GOOGLE_APPLICATION_CREDENTIALS ||= path.join(process.env.APPDATA, 'gcloud/application_default_credentials.json');
function sourcePath(source) {
  if (source.startsWith(`gs://${bucketName}/`)) return source.slice(`gs://${bucketName}/`.length);
  try {
    const url = new URL(source);
    if (url.hostname !== 'firebasestorage.googleapis.com' || !url.pathname.startsWith(`/v0/b/${bucketName}/o/`)) return null;
    return decodeURIComponent(url.pathname.split('/o/')[1]);
  } catch { return null; }
}
async function main() {
  const app = admin.initializeApp({ projectId, storageBucket: bucketName });
  try {
    const bucket = app.storage().bucket(), rows = [];
    for (const prefix of ['signatures/', 'team-expense-receipts/']) {
      const [files] = await bucket.getFiles({ prefix });
      for (const file of files) rows.push({ file, metadata: (await file.getMetadata())[0] });
    }
    const objectPaths = new Set(rows.map(row => row.file.name));
    const workers = await app.firestore().collection('workers').select('signatureUrl').get();
    let referenced = 0, unresolved = 0;
    for (const worker of workers.docs) {
      const source = worker.data().signatureUrl;
      if (!source) continue;
      referenced++;
      const objectPath = sourcePath(source);
      const match = objectPath && (/^signatures\/([a-zA-Z0-9_-]+)\/[a-zA-Z0-9_.-]+\.png$/.exec(objectPath) || /^signatures\/([a-zA-Z0-9_-]+)_\d+\.png$/.exec(objectPath));
      if (!match || match[1] !== worker.id || !objectPaths.has(objectPath)) unresolved++;
    }
    const tokenized = rows.filter(row => row.metadata.metadata?.firebaseStorageDownloadTokens);
    const report = { mode: process.argv.includes('--apply') ? 'apply' : 'audit', objects: rows.length, tokenized: tokenized.length, referenced, unresolved, revoked: 0, oldLinksDenied: 0, bytesUnchanged: 0 };
    console.log(JSON.stringify(report));
    if (unresolved) throw Object.assign(new Error(), { code: 'UNRESOLVED_SIGNATURE_REFERENCES' });
    if (!process.argv.includes('--apply')) return;
    for (const { file, metadata } of tokenized) {
      const tokens = String(metadata.metadata.firebaseStorageDownloadTokens).split(',').filter(Boolean);
      await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: null } }, { ifMetagenerationMatch: Number(metadata.metageneration) });
      const [after] = await file.getMetadata();
      if (after.metadata?.firebaseStorageDownloadTokens) throw Object.assign(new Error(), { code: 'TOKEN_NOT_REMOVED' });
      report.revoked++;
      if (after.generation !== metadata.generation || after.md5Hash !== metadata.md5Hash || after.size !== metadata.size) throw Object.assign(new Error(), { code: 'OBJECT_CONTENT_CHANGED' });
      report.bytesUnchanged++;
      for (const token of tokens) {
        const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(file.name)}?alt=media&token=${encodeURIComponent(token)}`, { method: 'HEAD' });
        if (![401, 403, 404].includes(response.status)) throw Object.assign(new Error(), { code: `OLD_LINK_STATUS_${response.status}` });
        report.oldLinksDenied++;
      }
    }
    console.log(JSON.stringify(report));
  } finally { await app.delete(); }
}
main().catch(error => { console.error(`Private-file operation failed (${error.code || error.name}).`); process.exitCode = 1; });
