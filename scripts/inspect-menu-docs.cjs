const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cyee-9c1e4';
const DOCUMENT_IDS = ['menus_v12', 'menus_v11'];

function parseArgs(argv) {
  const args = { backupPath: '', fromBackupPath: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--backup') {
      args.backupPath = argv[index + 1] || '';
      index += 1;
    } else if (argv[index] === '--from-backup') {
      args.fromBackupPath = argv[index + 1] || '';
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

function stableStringify(value) {
  return JSON.stringify(sortForStableJson(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function collectMenuStats(value) {
  const stats = {
    objectMenuItems: 0,
    stringMenuItems: 0,
    newestEmbeddedMenuIdTimestamp: 0,
  };

  function visit(candidate) {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!candidate || typeof candidate !== 'object') return;

    if (typeof candidate.text === 'string' || typeof candidate.path === 'string') {
      stats.objectMenuItems += 1;
    }
    if (typeof candidate.id === 'string') {
      const match = candidate.id.match(/^menu-(\d{13})/);
      if (match) {
        stats.newestEmbeddedMenuIdTimestamp = Math.max(
          stats.newestEmbeddedMenuIdTimestamp,
          Number(match[1]),
        );
      }
    }
    Object.values(candidate).forEach(visit);
  }

  visit(value);
  return stats;
}

function summarizeSite(site) {
  if (!site || typeof site !== 'object') return { hash: sha256(site), type: typeof site };

  const surfaces = ['menu', 'headerActions', 'deletedItems', 'trash', 'positionConfig'];
  const surfaceHashes = {};
  for (const surface of surfaces) {
    if (Object.prototype.hasOwnProperty.call(site, surface)) {
      surfaceHashes[surface] = sha256(site[surface]);
    }
  }

  return {
    hash: sha256(site),
    name: typeof site.name === 'string' ? site.name : '',
    surfaceHashes,
    stats: collectMenuStats(site),
  };
}

function flattenMenu(items, parentTrail = [], parentIdentity = 'root', result = []) {
  if (!Array.isArray(items)) return result;

  items.forEach((item, index) => {
    if (typeof item === 'string') {
      const identity = `string:${parentIdentity}:${index}:${item}`;
      result.push({
        identity,
        id: '',
        text: item,
        path: '',
        parentTrail,
        parentIdentity,
        index,
        selfHash: sha256(item),
      });
      return;
    }
    if (!item || typeof item !== 'object') return;

    const identity = typeof item.id === 'string' && item.id
      ? `id:${item.id}`
      : `fallback:${parentIdentity}:${index}:${item.text || ''}:${item.path || ''}`;
    const { sub, ...self } = item;
    const entry = {
      identity,
      id: typeof item.id === 'string' ? item.id : '',
      text: typeof item.text === 'string' ? item.text : '',
      path: typeof item.path === 'string' ? item.path : '',
      parentTrail,
      parentIdentity,
      index,
      selfHash: sha256(self),
    };
    result.push(entry);
    flattenMenu(sub, [...parentTrail, entry.text || entry.id], identity, result);
  });

  return result;
}

function describeMenuEntry(entry) {
  return {
    id: entry.id,
    text: entry.text,
    path: entry.path,
    parent: entry.parentTrail.join(' > '),
    index: entry.index,
  };
}

function compareMenuTrees(v12Menu, v11Menu) {
  const v12Entries = flattenMenu(v12Menu);
  const v11Entries = flattenMenu(v11Menu);
  const v12ByIdentity = new Map(v12Entries.map((entry) => [entry.identity, entry]));
  const v11ByIdentity = new Map(v11Entries.map((entry) => [entry.identity, entry]));

  const removedFromV12 = v12Entries
    .filter((entry) => !v11ByIdentity.has(entry.identity))
    .map(describeMenuEntry);
  const addedInV11 = v11Entries
    .filter((entry) => !v12ByIdentity.has(entry.identity))
    .map(describeMenuEntry);
  const changedInV11 = v11Entries
    .filter((entry) => {
      const previous = v12ByIdentity.get(entry.identity);
      return previous && previous.selfHash !== entry.selfHash;
    })
    .map((entry) => ({
      before: describeMenuEntry(v12ByIdentity.get(entry.identity)),
      after: describeMenuEntry(entry),
    }));
  const movedInV11 = v11Entries
    .filter((entry) => {
      const previous = v12ByIdentity.get(entry.identity);
      return previous
        && previous.selfHash === entry.selfHash
        && (previous.parentIdentity !== entry.parentIdentity || previous.index !== entry.index);
    })
    .map((entry) => ({
      item: describeMenuEntry(entry),
      beforeParent: v12ByIdentity.get(entry.identity).parentTrail.join(' > '),
      beforeIndex: v12ByIdentity.get(entry.identity).index,
    }));

  return {
    v12ItemCount: v12Entries.length,
    v11ItemCount: v11Entries.length,
    removedFromV12,
    addedInV11,
    changedInV11,
    movedInV11,
  };
}

function summarizeData(id, data, metadata = {}) {
  if (!data) return { id, exists: false };
  const siteSummaries = {};
  for (const key of Object.keys(data).sort()) {
    siteSummaries[key] = summarizeSite(data[key]);
  }

  return {
    id,
    exists: true,
    createTime: metadata.createTime || null,
    updateTime: metadata.updateTime || null,
    byteLength: Buffer.byteLength(stableStringify(data)),
    hash: sha256(data),
    topLevelKeys: Object.keys(data).sort(),
    stats: collectMenuStats(data),
    siteSummaries,
  };
}

function summarizeDocument(id, snapshot) {
  return summarizeData(id, snapshot.exists ? snapshot.data() : null, {
    createTime: snapshot.createTime?.toDate().toISOString() || null,
    updateTime: snapshot.updateTime?.toDate().toISOString() || null,
  });
}

function compareSummaries(left, right, rawDocuments) {
  if (!left.exists || !right.exists) {
    return { comparable: false, identical: false, changedSites: [] };
  }

  const allSiteKeys = Array.from(new Set([
    ...left.topLevelKeys,
    ...right.topLevelKeys,
  ])).sort();

  const changedSites = allSiteKeys
    .filter((key) => left.siteSummaries[key]?.hash !== right.siteSummaries[key]?.hash)
    .map((key) => {
      const leftSite = left.siteSummaries[key];
      const rightSite = right.siteSummaries[key];
      const surfaceNames = Array.from(new Set([
        ...Object.keys(leftSite?.surfaceHashes || {}),
        ...Object.keys(rightSite?.surfaceHashes || {}),
      ])).sort();

      const menuChanged = leftSite?.surfaceHashes?.menu !== rightSite?.surfaceHashes?.menu;
      return {
        siteKey: key,
        inV12: Boolean(leftSite),
        inV11: Boolean(rightSite),
        changedSurfaces: surfaceNames.filter(
          (surface) => leftSite?.surfaceHashes?.[surface] !== rightSite?.surfaceHashes?.[surface],
        ),
        v12Name: leftSite?.name || '',
        v11Name: rightSite?.name || '',
        menuDetails: menuChanged
          ? compareMenuTrees(
            rawDocuments.menus_v12?.[key]?.menu,
            rawDocuments.menus_v11?.[key]?.menu,
          )
          : null,
      };
    });

  return {
    comparable: true,
    identical: left.hash === right.hash,
    changedSites,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.fromBackupPath) {
    const absoluteSourcePath = path.resolve(args.fromBackupPath);
    const payload = JSON.parse(fs.readFileSync(absoluteSourcePath, 'utf8'));
    const rawDocuments = payload.documents || {};
    const metadataById = new Map(
      (payload.documentMetadata || []).map((metadata) => [metadata.id, metadata]),
    );
    const summaries = DOCUMENT_IDS.map((id) => summarizeData(
      id,
      rawDocuments[id],
      metadataById.get(id) || {},
    ));
    const comparison = compareSummaries(summaries[0], summaries[1], rawDocuments);
    console.log(JSON.stringify({
      projectId: payload.projectId || PROJECT_ID,
      sourceBackupPath: absoluteSourcePath,
      summaries,
      comparison,
    }, null, 2));
    return;
  }

  const adcPath = path.join(
    process.env.APPDATA || '',
    'gcloud',
    'application_default_credentials.json',
  );

  if (!fs.existsSync(adcPath)) {
    throw new Error(`Application Default Credentials not found: ${adcPath}`);
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });

  const db = admin.firestore();
  const snapshots = await Promise.all(
    DOCUMENT_IDS.map((id) => db.collection('settings').doc(id).get()),
  );
  const rawDocuments = Object.fromEntries(
    DOCUMENT_IDS.map((id, index) => [id, snapshots[index].exists ? snapshots[index].data() : null]),
  );
  const summaries = DOCUMENT_IDS.map((id, index) => summarizeDocument(id, snapshots[index]));
  const comparison = compareSummaries(summaries[0], summaries[1], rawDocuments);

  if (args.backupPath) {
    const absoluteBackupPath = path.resolve(args.backupPath);
    fs.mkdirSync(path.dirname(absoluteBackupPath), { recursive: true });
    fs.writeFileSync(absoluteBackupPath, `${JSON.stringify({
      projectId: PROJECT_ID,
      collection: 'settings',
      capturedAt: new Date().toISOString(),
      documentMetadata: summaries.map(({ siteSummaries, ...summary }) => summary),
      documents: rawDocuments,
    }, null, 2)}\n`, 'utf8');
    console.log(`BACKUP_PATH=${absoluteBackupPath}`);
  }

  console.log(JSON.stringify({
    projectId: PROJECT_ID,
    summaries,
    comparison,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.stack || error.message || error);
    process.exit(1);
  });
