const admin = require('firebase-admin');

const pad2 = (value) => String(value).padStart(2, '0');

const buildDateString = (year, month, day) => {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const normalizeYear = (yearToken) => {
  const year = Number(yearToken);
  if (String(yearToken).length !== 2) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
};

const normalizeLooseDateString = (value) => {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return buildDateString(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 20000) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return buildDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const compactMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    return buildDateString(Number(compactMatch[1]), Number(compactMatch[2]), Number(compactMatch[3]));
  }

  const ymdMatch = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:\s.*)?$/);
  if (ymdMatch) {
    return buildDateString(Number(ymdMatch[1]), Number(ymdMatch[2]), Number(ymdMatch[3]));
  }

  const mdyMatch = raw.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})(?:\s.*)?$/);
  if (mdyMatch) {
    return buildDateString(normalizeYear(mdyMatch[3]), Number(mdyMatch[1]), Number(mdyMatch[2]));
  }

  return null;
};

const isApplyMode = process.argv.includes('--apply');

const initApp = () => {
  if (admin.apps.length > 0) return admin.app();
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'cyee-9c1e4',
  });
};

const run = async () => {
  initApp();
  const db = admin.firestore();
  const snapshot = await db.collection('daily_reports').get();

  let changed = 0;
  let unchanged = 0;
  let invalid = 0;
  const samples = [];
  let batch = db.batch();
  let batchOps = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() || {};
    const rawDate = data.date;
    const normalizedDate = normalizeLooseDateString(rawDate);

    if (!normalizedDate) {
      invalid += 1;
      if (samples.length < 20) {
        samples.push({ id: docSnap.id, rawDate, normalizedDate: null });
      }
      continue;
    }

    if (normalizedDate === rawDate) {
      unchanged += 1;
      continue;
    }

    changed += 1;
    if (samples.length < 20) {
      samples.push({ id: docSnap.id, rawDate, normalizedDate });
    }

    if (isApplyMode) {
      batch.update(docSnap.ref, {
        date: normalizedDate,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batchOps += 1;

      if (batchOps >= 400) {
        await batch.commit();
        batch = db.batch();
        batchOps = 0;
      }
    }
  }

  if (isApplyMode && batchOps > 0) {
    await batch.commit();
  }

  console.log(JSON.stringify({
    mode: isApplyMode ? 'apply' : 'dry-run',
    total: snapshot.size,
    changed,
    unchanged,
    invalid,
    samples,
  }, null, 2));
};

run().catch((error) => {
  console.error('[backfill-daily-report-dates] failed');
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
