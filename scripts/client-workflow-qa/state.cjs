const path = require('node:path');
const root = path.resolve(__dirname, '../..');
if (process.env.GCLOUD_PROJECT !== 'demo-client-workflow'
  || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18089'
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') throw new Error('QA requires the isolated local demo emulators.');
const admin = require(path.join(root, 'functions/node_modules/firebase-admin'));
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-client-workflow', storageBucket: 'demo-client-workflow.appspot.com' });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
const password = 'Local-QA-only-2026!';
const accounts = { office: 'qa-office', leader: 'qa-leader', member: 'qa-member', outside: 'qa-outside' };
module.exports = { root, admin, db, password, accounts };
