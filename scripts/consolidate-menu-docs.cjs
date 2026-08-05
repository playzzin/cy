const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cyee-9c1e4';
const COLLECTION_NAME = 'settings';
const SOURCE_DOCUMENT_ID = 'menus_v11';
const TARGET_DOCUMENT_ID = 'menus_v12';
const REQUIRED_CONFIRMATION = 'PROMOTE_MENUS_V11_TO_V12_AND_DELETE_V11';

function parseArgs(argv) {
  const args = {
    apply: false,
    baselinePath: '',
    backupDirectory: path.join('backups', 'firestore'),
    confirmation: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') {
      args.apply = true;
    } else if (argument === '--baseline') {
      args.baselinePath = argv[index + 1] || '';
      index += 1;
    } else if (argument === '--backup-dir') {
      args.backupDirectory = argv[index + 1] || '';
      index += 1;
    } else if (argument === '--confirmation') {
      args.confirmation = argv[index + 1] || '';
      index += 1;
    }
  }

  return args;
}

function sortForStableJson(value) {
  if (Array.isArray(value)) return value.map(sortForStableJson);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = sortForStableJson(value[key]);
      return result;
    }, {});
}

function hashDocument(value) {
  const serialized = JSON.stringify(sortForStableJson(value));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function getExpectedHashes(baselinePath) {
  if (!baselinePath) throw new Error('--baseline is required');
  const absolutePath = path.resolve(baselinePath);
  const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const metadataById = new Map(
    (payload.documentMetadata || []).map((metadata) => [metadata.id, metadata]),
  );
  const v11Hash = metadataById.get(SOURCE_DOCUMENT_ID)?.hash;
  const v12Hash = metadataById.get(TARGET_DOCUMENT_ID)?.hash;

  if (!v11Hash || !v12Hash) {
    throw new Error('Baseline does not contain hashes for menus_v11 and menus_v12');
  }

  return { absolutePath, v11Hash, v12Hash };
}

function getCredentialPath() {
  const credentialPath = path.join(
    process.env.APPDATA || '',
    'gcloud',
    'application_default_credentials.json',
  );
  if (!fs.existsSync(credentialPath)) {
    throw new Error(`Application Default Credentials not found: ${credentialPath}`);
  }
  return credentialPath;
}

function snapshotMetadata(snapshot, hash) {
  return {
    id: snapshot.id,
    exists: snapshot.exists,
    createTime: snapshot.createTime?.toDate().toISOString() || null,
    updateTime: snapshot.updateTime?.toDate().toISOString() || null,
    hash,
  };
}

function writeSafetyBackup(backupDirectory, v11Snapshot, v12Snapshot, v11Hash, v12Hash) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const absoluteDirectory = path.resolve(backupDirectory);
  const backupPath = path.join(
    absoluteDirectory,
    `menu-settings-immediately-before-consolidation-${timestamp}.json`,
  );
  fs.mkdirSync(absoluteDirectory, { recursive: true });
  fs.writeFileSync(backupPath, `${JSON.stringify({
    projectId: PROJECT_ID,
    collection: COLLECTION_NAME,
    capturedAt: new Date().toISOString(),
    documentMetadata: [
      snapshotMetadata(v12Snapshot, v12Hash),
      snapshotMetadata(v11Snapshot, v11Hash),
    ],
    documents: {
      [TARGET_DOCUMENT_ID]: v12Snapshot.data(),
      [SOURCE_DOCUMENT_ID]: v11Snapshot.data(),
    },
  }, null, 2)}\n`, 'utf8');
  return backupPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const expected = getExpectedHashes(args.baselinePath);

  if (args.apply && args.confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(`Apply mode requires --confirmation ${REQUIRED_CONFIRMATION}`);
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = getCredentialPath();
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });

  const db = admin.firestore();
  const v11Ref = db.collection(COLLECTION_NAME).doc(SOURCE_DOCUMENT_ID);
  const v12Ref = db.collection(COLLECTION_NAME).doc(TARGET_DOCUMENT_ID);
  const [v11Snapshot, v12Snapshot] = await Promise.all([v11Ref.get(), v12Ref.get()]);

  if (!v11Snapshot.exists || !v12Snapshot.exists) {
    throw new Error('Both menus_v11 and menus_v12 must exist before consolidation');
  }

  const v11Hash = hashDocument(v11Snapshot.data());
  const v12Hash = hashDocument(v12Snapshot.data());
  const preflight = {
    projectId: PROJECT_ID,
    baselinePath: expected.absolutePath,
    apply: args.apply,
    source: snapshotMetadata(v11Snapshot, v11Hash),
    target: snapshotMetadata(v12Snapshot, v12Hash),
    baselineMatches: {
      menus_v11: v11Hash === expected.v11Hash,
      menus_v12: v12Hash === expected.v12Hash,
    },
  };
  console.log(JSON.stringify({ preflight }, null, 2));

  if (v11Hash !== expected.v11Hash || v12Hash !== expected.v12Hash) {
    throw new Error('Live menu documents changed after the baseline backup; inspect and back up again');
  }

  if (!args.apply) {
    console.log('DRY_RUN_OK=true');
    return;
  }

  const safetyBackupPath = writeSafetyBackup(
    args.backupDirectory,
    v11Snapshot,
    v12Snapshot,
    v11Hash,
    v12Hash,
  );
  console.log(`SAFETY_BACKUP_PATH=${safetyBackupPath}`);

  await db.runTransaction(async (transaction) => {
    const [currentV11, currentV12] = await Promise.all([
      transaction.get(v11Ref),
      transaction.get(v12Ref),
    ]);
    if (!currentV11.exists || !currentV12.exists) {
      throw new Error('Menu documents changed during consolidation preflight');
    }

    const currentV11Hash = hashDocument(currentV11.data());
    const currentV12Hash = hashDocument(currentV12.data());
    if (currentV11Hash !== expected.v11Hash || currentV12Hash !== expected.v12Hash) {
      throw new Error('Menu documents changed during consolidation preflight');
    }

    transaction.set(v12Ref, currentV11.data());
    transaction.delete(v11Ref);
  });

  const [verifiedV11, verifiedV12] = await Promise.all([v11Ref.get(), v12Ref.get()]);
  const verifiedV12Hash = verifiedV12.exists ? hashDocument(verifiedV12.data()) : '';
  const verification = {
    menus_v11Exists: verifiedV11.exists,
    menus_v12Exists: verifiedV12.exists,
    menus_v12Hash: verifiedV12Hash,
    expectedMenusV12Hash: expected.v11Hash,
    success: !verifiedV11.exists && verifiedV12.exists && verifiedV12Hash === expected.v11Hash,
  };
  console.log(JSON.stringify({ verification }, null, 2));

  if (!verification.success) {
    throw new Error('Post-consolidation verification failed; use the safety backup for recovery');
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.stack || error.message || error);
      process.exit(1);
    });
}

module.exports = {
  REQUIRED_CONFIRMATION,
  hashDocument,
  parseArgs,
  sortForStableJson,
};
