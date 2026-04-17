import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '..');

function loadEnvFile(filePath) {
  const env = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex < 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function normalizeKeyPart(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildDuplicateGroups(rows, keyBuilder) {
  const map = new Map();
  for (const row of rows) {
    const key = keyBuilder(row);
    const group = map.get(key) ?? [];
    group.push(row);
    map.set(key, group);
  }
  return Array.from(map.entries())
    .filter(([, group]) => group.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
}

async function main() {
  const envPath = path.join(rootDir, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found');
  }

  const env = loadEnvFile(envPath);
  const app = getApps()[0] ?? initializeApp({
    apiKey: env.REACT_APP_FIREBASE_API_KEY,
    authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.REACT_APP_FIREBASE_APP_ID,
  });

  const db = getFirestore(app);

  const materialsSnap = await getDocs(query(collection(db, 'materials'), where('isActive', '==', true)));
  const materials = materialsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const inboundsSnap = await getDocs(collection(db, 'materialInbounds'));
  const inbounds = inboundsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const materialDuplicates = buildDuplicateGroups(materials, (row) => [
    normalizeKeyPart(row.category),
    normalizeKeyPart(row.itemName),
    normalizeKeyPart(row.spec),
    normalizeKeyPart(row.unit),
  ].join('||'));

  const inboundDuplicates = buildDuplicateGroups(inbounds, (row) => [
    normalizeKeyPart(row.transactionDate),
    normalizeKeyPart(row.siteId),
    normalizeKeyPart(row.materialId),
    normalizeKeyPart(row.vehicleNumber),
    normalizeKeyPart(row.supplier),
    Number(row.quantity ?? 0),
  ].join('||'));

  console.log('=== Material Duplicate Check ===');
  console.log(`projectId: ${env.REACT_APP_FIREBASE_PROJECT_ID}`);
  console.log(`active materials: ${materials.length}`);
  console.log(`duplicate material groups: ${materialDuplicates.length}`);
  materialDuplicates.slice(0, 20).forEach(([key, group], index) => {
    const sample = group[0];
    console.log(`\n[Material Duplicate ${index + 1}] ${group.length}건`);
    console.log(`category=${sample.category || ''} | itemName=${sample.itemName || ''} | spec=${sample.spec || ''} | unit=${sample.unit || ''}`);
    group.forEach((row) => console.log(`  - id=${row.id}`));
  });

  console.log('\n=== Inbound Duplicate Check ===');
  console.log(`inbound docs: ${inbounds.length}`);
  console.log(`duplicate inbound groups: ${inboundDuplicates.length}`);
  inboundDuplicates.slice(0, 20).forEach(([key, group], index) => {
    const sample = group[0];
    console.log(`\n[Inbound Duplicate ${index + 1}] ${group.length}건`);
    console.log(`date=${sample.transactionDate || ''} | site=${sample.siteName || sample.siteId || ''} | material=${sample.itemName || sample.materialId || ''} | spec=${sample.spec || ''} | qty=${sample.quantity || 0} | vehicle=${sample.vehicleNumber || ''} | supplier=${sample.supplier || ''}`);
    group.forEach((row) => console.log(`  - id=${row.id}`));
  });
}

main().catch((error) => {
  console.error('check_material_duplicates failed:', error);
  process.exit(1);
});