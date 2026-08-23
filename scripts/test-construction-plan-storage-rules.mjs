import assert from 'node:assert/strict';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  connectStorageEmulator,
  deleteObject,
  getBytes,
  getStorage,
  listAll,
  ref,
  updateMetadata,
  uploadBytes,
} from 'firebase/storage';

const projectId = process.env.GCLOUD_PROJECT || 'demo-cy-construction-plan';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';

const parseEmulatorHostPort = (value, variableName) => {
  const match = /^(?:\[([^\]]+)\]|([^:]+)):(\d+)$/.exec(value);
  const host = match?.[1] || match?.[2] || '';
  const port = Number(match?.[3]);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${variableName} must use the host:port format.`);
  }
  return { host, port };
};

const authEmulator = parseEmulatorHostPort(
  process.env.FIREBASE_AUTH_EMULATOR_HOST,
  'FIREBASE_AUTH_EMULATOR_HOST',
);
const storageEmulator = parseEmulatorHostPort(
  process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  'FIREBASE_STORAGE_EMULATOR_HOST',
);

const storageBucket = `${projectId}.appspot.com`;
const adminApp = initializeAdminApp({ projectId, storageBucket });
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);
const adminBucket = getAdminStorage(adminApp).bucket();
const app = initializeApp({
  apiKey: 'demo-api-key',
  projectId,
  storageBucket,
}, 'construction-plan-storage-rules-client');
const auth = getAuth(app);
const authHost = authEmulator.host.includes(':') ? `[${authEmulator.host}]` : authEmulator.host;
connectAuthEmulator(auth, `http://${authHost}:${authEmulator.port}`, { disableWarnings: true });
const storage = getStorage(app);
connectStorageEmulator(storage, storageEmulator.host, storageEmulator.port);

const password = 'rules-test-password';
const signInAsRole = async (role, sequence, profile = {}) => {
  const email = `construction-${role}-${sequence}@example.test`;
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await Promise.all([
    adminAuth.setCustomUserClaims(credential.user.uid, { role }),
    adminDb.collection('users').doc(credential.user.uid).set({ role, ...profile }),
  ]);
  await signOut(auth);
  const signedIn = await signInWithEmailAndPassword(auth, email, password);
  await signedIn.user.getIdToken(true);
  return signedIn.user.uid;
};

const expectDenied = async (label, operation) => {
  let denied = false;
  try {
    await operation();
  } catch (error) {
    const code = String(error?.code || '');
    denied = code.includes('unauthorized') || code.includes('permission-denied');
  }
  assert.equal(denied, true, `${label} should be denied`);
};

const startedAt = Date.now();
const runId = `${startedAt}-${process.pid}`;
const plan1Id = `plan-1-${runId}`;
const plan2Id = `plan-2-${runId}`;
const missingPlanId = `missing-plan-${runId}`;
await Promise.all([
  adminDb.collection('constructionPlans').doc(plan1Id).set({
    siteId: 'site-1',
    status: 'draft',
    participants: { authorIds: [], reviewerIds: [], approverIds: [] },
  }),
  adminDb.collection('constructionPlans').doc(plan2Id).set({
    siteId: 'site-2',
    status: 'changes_requested',
    participants: { authorIds: [], reviewerIds: [], approverIds: [] },
  }),
]);
const legacySourcePath = `construction-plans/${plan1Id}/drawings/d-legacy/rev-1/source.png`;
const otherLegacySourcePath = `construction-plans/${plan2Id}/drawings/d-legacy/rev-1/source.png`;
const snapshotPath = `construction-plans/site-1/${plan1Id}/snapshots/approved-hash.json`;
const otherSnapshotPath = `construction-plans/site-2/${plan2Id}/snapshots/approved-hash.json`;
const serverPreviewPath = `construction-plans/site-1/${plan1Id}/previews/d-01/${'a'.repeat(64)}/page-0001.png`;
const serverCandidatePath = `construction-plans/site-1/${plan1Id}/server-exports/candidate/rev-00/server-field-use-v1/${'b'.repeat(64)}/${'c'.repeat(64)}.pdf`;
const serverIssuedPath = `construction-plans/site-1/${plan1Id}/server-exports/issued/rev-00/server-field-use-v1/${'b'.repeat(64)}/${'d'.repeat(64)}.pdf`;
const reservedStagingPath = `construction-plan-staging/${runId}/server-only.pdf`;
const reservedRecordPath = `construction-plan-records/${runId}/server-only.png`;
const reservedRecordStagingPath = `construction-plan-record-staging/${runId}/server-only.png`;
const executionRecordId = `record-${runId}`;
const executionPhotoSha = 'e'.repeat(64);
const executionPhotoPath = `construction-plan-records/site-1/${plan1Id}/${executionRecordId}/photos/photo-1/${executionPhotoSha}.png`;
const executionAppendixPath = `construction-plan-records/site-1/${plan1Id}/${executionRecordId}/appendices/rev-00/${'f'.repeat(64)}/${'1'.repeat(64)}.pdf`;
const mismatchedPath = `construction-plans/site-2/${plan1Id}/drawings/d-mismatch/rev-1/source.png`;
const orphanPath = `construction-plans/site-1/${missingPlanId}/drawings/d-orphan/rev-1/source.png`;
const sourcePath = `construction-plans/site-1/${plan1Id}/drawings/d-01/rev-1/source.png`;
const previewPath = `construction-plans/site-1/${plan1Id}/drawings/d-01/rev-1/preview.png`;
const exportPath = `construction-plans/site-1/${plan1Id}/exports/rev-01/hash.pdf`;
const otherSourcePath = `construction-plans/site-2/${plan2Id}/drawings/d-01/rev-1/source.png`;
const otherPreviewPath = `construction-plans/site-2/${plan2Id}/drawings/d-01/rev-1/preview.jpg`;
const otherExportPath = `construction-plans/site-2/${plan2Id}/exports/rev-01/hash.pdf`;
await Promise.all([
  adminDb.collection('constructionPlanRecords').doc(executionRecordId).set({
    schemaVersion: 1,
    id: executionRecordId,
    planId: plan1Id,
    siteId: 'site-1',
    status: 'incomplete',
  }),
  adminBucket.file(sourcePath).save(Buffer.from([137, 80, 78, 71]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(previewPath).save(Buffer.from([137, 80, 78, 71, 1]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(exportPath).save(Buffer.from('%PDF-1.7'), {
    metadata: { contentType: 'application/pdf' },
  }),
  adminBucket.file(otherSourcePath).save(Buffer.from([137, 80, 78, 71, 2]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(otherPreviewPath).save(Buffer.from([255, 216, 255, 3]), {
    metadata: { contentType: 'image/jpeg' },
  }),
  adminBucket.file(otherExportPath).save(Buffer.from('%PDF-2.0'), {
    metadata: { contentType: 'application/pdf' },
  }),
  adminBucket.file(legacySourcePath).save(Buffer.from([137, 80, 78, 71, 7]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(otherLegacySourcePath).save(Buffer.from([137, 80, 78, 71, 8]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(snapshotPath).save(Buffer.from('{}'), {
    metadata: { contentType: 'application/json' },
  }),
  adminBucket.file(serverPreviewPath).save(Buffer.from([137, 80, 78, 71, 14]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(serverCandidatePath).save(Buffer.from('%PDF-candidate'), {
    metadata: { contentType: 'application/pdf' },
  }),
  adminBucket.file(serverIssuedPath).save(Buffer.from('%PDF-issued'), {
    metadata: { contentType: 'application/pdf' },
  }),
  adminBucket.file(reservedStagingPath).save(Buffer.from('%PDF-1.7'), {
    metadata: { contentType: 'application/pdf' },
  }),
  adminBucket.file(reservedRecordPath).save(Buffer.from([137, 80, 78, 71, 16]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(reservedRecordStagingPath).save(Buffer.from([137, 80, 78, 71, 17]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(executionPhotoPath).save(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(executionAppendixPath).save(Buffer.from('%PDF-record-appendix'), {
    metadata: { contentType: 'application/pdf' },
  }),
  adminBucket.file(otherSnapshotPath).save(Buffer.from('{}'), {
    metadata: { contentType: 'application/json' },
  }),
  adminBucket.file(mismatchedPath).save(Buffer.from([137, 80, 78, 71, 9]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(orphanPath).save(Buffer.from([137, 80, 78, 71, 10]), {
    metadata: { contentType: 'image/png' },
  }),
]);

const adminUid = await signInAsRole('admin', startedAt);
const sourceRef = ref(storage, sourcePath);
const previewRef = ref(storage, previewPath);
const exportRef = ref(storage, exportPath);
const otherSourceRef = ref(storage, otherSourcePath);
const otherPreviewRef = ref(storage, otherPreviewPath);
const otherExportRef = ref(storage, otherExportPath);
const legacySourceRef = ref(storage, legacySourcePath);
const otherLegacySourceRef = ref(storage, otherLegacySourcePath);
const snapshotRef = ref(storage, snapshotPath);
const serverPreviewRef = ref(storage, serverPreviewPath);
const serverCandidateRef = ref(storage, serverCandidatePath);
const serverIssuedRef = ref(storage, serverIssuedPath);
const otherSnapshotRef = ref(storage, otherSnapshotPath);
const mismatchedRef = ref(storage, mismatchedPath);
const orphanRef = ref(storage, orphanPath);
const reservedStagingRef = ref(storage, reservedStagingPath);
const reservedRecordRef = ref(storage, reservedRecordPath);
const reservedRecordStagingRef = ref(storage, reservedRecordStagingPath);
const executionPhotoRef = ref(storage, executionPhotoPath);
const executionAppendixRef = ref(storage, executionAppendixPath);
await expectDenied('admin browser canonical source create', () => uploadBytes(
  ref(storage, `construction-plans/site-1/${plan1Id}/drawings/d-direct/rev-1/source.png`),
  new Uint8Array([137, 80, 78, 71]),
  { contentType: 'image/png' },
));
await expectDenied('admin browser canonical preview create', () => uploadBytes(
  ref(storage, `construction-plans/site-1/${plan1Id}/drawings/d-direct/rev-1/preview.png`),
  new Uint8Array([137, 80, 78, 71, 1]),
  { contentType: 'image/png' },
));
assert.equal((await getBytes(sourceRef)).byteLength, 4);
assert.equal((await getBytes(legacySourceRef)).byteLength, 5);
assert.equal((await getBytes(snapshotRef)).byteLength, 2);
assert.equal((await getBytes(serverPreviewRef)).byteLength, 5);
assert.equal((await getBytes(serverCandidateRef)).byteLength, 14);
await expectDenied('admin also needs audited grant for server issued read', () => getBytes(serverIssuedRef));
await expectDenied('mismatched site/plan path read by admin', () => getBytes(mismatchedRef));
await expectDenied('orphan plan path read by admin', () => getBytes(orphanRef));
await expectDenied('construction plan drawing list', () =>
  listAll(ref(storage, `construction-plans/site-1/${plan1Id}/drawings`)));
await expectDenied('reserved construction-plan staging read', () => getBytes(reservedStagingRef));
await expectDenied('reserved construction-plan records read', () => getBytes(reservedRecordRef));
await expectDenied('reserved construction-plan record staging read', () => getBytes(reservedRecordStagingRef));
assert.equal((await getBytes(executionPhotoRef)).byteLength, 8);
assert.equal((await getBytes(executionAppendixRef)).byteLength, 20);
await expectDenied('execution record canonical list', () => listAll(
  ref(storage, `construction-plan-records/site-1/${plan1Id}/${executionRecordId}`),
));
await expectDenied('execution record photo browser overwrite', () => uploadBytes(
  executionPhotoRef,
  new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  { contentType: 'image/png' },
));
await expectDenied('execution record appendix browser delete', () => deleteObject(executionAppendixRef));
await expectDenied('reserved construction-plan staging browser create', () => uploadBytes(
  ref(storage, `construction-plan-staging/${runId}/browser-forged.pdf`),
  new TextEncoder().encode('%PDF-1.7'),
  { contentType: 'application/pdf' },
));
await expectDenied('reserved construction-plan record staging browser create', () => uploadBytes(
  ref(storage, `construction-plan-record-staging/${runId}/browser-forged.png`),
  new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  { contentType: 'image/png' },
));
const stagingSessionId = `session-${runId}`;
const stagingPath = `construction-plan-staging/${adminUid}/${stagingSessionId}/source`;
const stagingBytes = new TextEncoder().encode('%PDF-1.7');
const stagingSha = 'a'.repeat(64);
await adminDb.collection('constructionPlanUploadSessions').doc(stagingSessionId).set({
  schemaVersion: 1,
  id: stagingSessionId,
  ownerId: adminUid,
  planId: plan1Id,
  siteId: 'site-1',
  status: 'awaiting_upload',
  stagingPath,
  mimeType: 'application/pdf',
  sizeBytes: stagingBytes.byteLength,
  sha256: stagingSha,
  expiresAtEpochMs: Date.now() + 60_000,
});
const stagingRef = ref(storage, stagingPath);
await uploadBytes(stagingRef, stagingBytes, {
  contentType: 'application/pdf',
  customMetadata: { uploadSessionId: stagingSessionId, sourceSha256: stagingSha },
});
assert.equal((await adminBucket.file(stagingPath).download())[0].byteLength, stagingBytes.byteLength);
await expectDenied('staging source browser read', () => getBytes(stagingRef));
await expectDenied('staging source overwrite', () => uploadBytes(stagingRef, stagingBytes, {
  contentType: 'application/pdf',
  customMetadata: { uploadSessionId: stagingSessionId, sourceSha256: stagingSha },
}));
await expectDenied('staging source delete', () => deleteObject(stagingRef));
await expectDenied('staging source metadata update', () => updateMetadata(stagingRef, {
  customMetadata: { uploadSessionId: stagingSessionId, sourceSha256: 'b'.repeat(64) },
}));
await expectDenied('staging source wrong MIME', () => uploadBytes(
  ref(storage, `construction-plan-staging/${adminUid}/${stagingSessionId}-mime/source`),
  stagingBytes,
  { contentType: 'image/png' },
));
const expiredSessionId = `expired-${runId}`;
await adminDb.collection('constructionPlanUploadSessions').doc(expiredSessionId).set({
  schemaVersion: 1,
  id: expiredSessionId,
  ownerId: adminUid,
  status: 'awaiting_upload',
  stagingPath: `construction-plan-staging/${adminUid}/${expiredSessionId}/source`,
  mimeType: 'application/pdf',
  sizeBytes: stagingBytes.byteLength,
  sha256: stagingSha,
  expiresAtEpochMs: Date.now() - 1,
});
await expectDenied('expired staging session create', () => uploadBytes(
  ref(storage, `construction-plan-staging/${adminUid}/${expiredSessionId}/source`),
  stagingBytes,
  {
    contentType: 'application/pdf',
    customMetadata: { uploadSessionId: expiredSessionId, sourceSha256: stagingSha },
  },
));
const recordPhotoSessionId = `record-photo-${runId}`;
const recordPhotoStagingPath = `construction-plan-record-staging/${adminUid}/${recordPhotoSessionId}/source`;
const recordPhotoBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const recordPhotoSha = '9'.repeat(64);
await adminDb.collection('constructionPlanRecordUploadSessions').doc(recordPhotoSessionId).set({
  schemaVersion: 1,
  id: recordPhotoSessionId,
  ownerId: adminUid,
  recordId: executionRecordId,
  planId: plan1Id,
  siteId: 'site-1',
  status: 'awaiting_upload',
  stagingPath: recordPhotoStagingPath,
  mimeType: 'image/png',
  sizeBytes: recordPhotoBytes.byteLength,
  sha256: recordPhotoSha,
  expiresAtEpochMs: Date.now() + 60_000,
});
const recordPhotoStagingRef = ref(storage, recordPhotoStagingPath);
await uploadBytes(recordPhotoStagingRef, recordPhotoBytes, {
  contentType: 'image/png',
  customMetadata: { uploadSessionId: recordPhotoSessionId, sourceSha256: recordPhotoSha },
});
assert.equal((await adminBucket.file(recordPhotoStagingPath).download())[0].byteLength, recordPhotoBytes.byteLength);
await expectDenied('record photo staging browser read', () => getBytes(recordPhotoStagingRef));
await expectDenied('record photo staging overwrite', () => uploadBytes(recordPhotoStagingRef, recordPhotoBytes, {
  contentType: 'image/png',
  customMetadata: { uploadSessionId: recordPhotoSessionId, sourceSha256: recordPhotoSha },
}));
await expectDenied('record photo staging delete', () => deleteObject(recordPhotoStagingRef));
await expectDenied('record photo staging metadata update', () => updateMetadata(recordPhotoStagingRef, {
  customMetadata: { uploadSessionId: recordPhotoSessionId, sourceSha256: '8'.repeat(64) },
}));
const invalidRecordPhotoSessionId = `record-photo-invalid-${runId}`;
const invalidRecordPhotoStagingPath = `construction-plan-record-staging/${adminUid}/${invalidRecordPhotoSessionId}/source`;
await adminDb.collection('constructionPlanRecordUploadSessions').doc(invalidRecordPhotoSessionId).set({
  schemaVersion: 1,
  id: invalidRecordPhotoSessionId,
  ownerId: adminUid,
  status: 'awaiting_upload',
  stagingPath: invalidRecordPhotoStagingPath,
  mimeType: 'image/png',
  sizeBytes: recordPhotoBytes.byteLength,
  sha256: recordPhotoSha,
  expiresAtEpochMs: Date.now() + 60_000,
});
await expectDenied('record photo staging wrong SHA metadata', () => uploadBytes(
  ref(storage, invalidRecordPhotoStagingPath),
  recordPhotoBytes,
  { contentType: 'image/png', customMetadata: { uploadSessionId: invalidRecordPhotoSessionId, sourceSha256: '7'.repeat(64) } },
));
await expectDenied('record photo staging wrong MIME', () => uploadBytes(
  ref(storage, invalidRecordPhotoStagingPath),
  recordPhotoBytes,
  { contentType: 'image/jpeg', customMetadata: { uploadSessionId: invalidRecordPhotoSessionId, sourceSha256: recordPhotoSha } },
));
await expectDenied('record photo staging wrong UID path', () => uploadBytes(
  ref(storage, `construction-plan-record-staging/not-${adminUid}/${invalidRecordPhotoSessionId}/source`),
  recordPhotoBytes,
  { contentType: 'image/png', customMetadata: { uploadSessionId: invalidRecordPhotoSessionId, sourceSha256: recordPhotoSha } },
));
await expectDenied('reserved construction-plan records browser create', () => uploadBytes(
  ref(storage, `construction-plan-records/${runId}/browser-forged.png`),
  new Uint8Array([137, 80, 78, 71]),
  { contentType: 'image/png' },
));

await expectDenied('approved source overwrite', () =>
  uploadBytes(sourceRef, new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
await expectDenied('immutable source delete', () => deleteObject(sourceRef));
await expectDenied('immutable source metadata update', () => updateMetadata(sourceRef, { customMetadata: { forged: 'true' } }));
await expectDenied('immutable export overwrite', () =>
  uploadBytes(exportRef, new TextEncoder().encode('%PDF-forged'), { contentType: 'application/pdf' }));
await expectDenied('immutable export delete', () => deleteObject(exportRef));
await expectDenied('browser snapshot create', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-1/${plan1Id}/snapshots/browser-forged.json`),
    new TextEncoder().encode('{}'),
    { contentType: 'application/json' },
  ));
await expectDenied('browser generated preview create', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-1/${plan1Id}/previews/d-01/${'b'.repeat(64)}/page-0001.png`),
    new Uint8Array([137, 80, 78, 71, 15]),
    { contentType: 'image/png' },
  ));
await expectDenied('admin browser server candidate create', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-1/${plan1Id}/server-exports/candidate/browser-forged.pdf`),
    new TextEncoder().encode('%PDF-1.7'),
    { contentType: 'application/pdf' },
  ));
await expectDenied('admin browser server issued create', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-1/${plan1Id}/server-exports/issued/browser-forged.pdf`),
    new TextEncoder().encode('%PDF-1.7'),
    { contentType: 'application/pdf' },
  ));
await expectDenied('unexpected content type', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-1/${plan1Id}/drawings/d-01/rev-2/source.svg`),
    new TextEncoder().encode('<svg/>'),
    { contentType: 'image/svg+xml' },
  ));

await signOut(auth);
await signInAsRole('payroll_manager', startedAt + 1, { siteId: 'site-1' });
await expectDenied('payroll plan drawing read', () => getBytes(sourceRef));

await signOut(auth);
await signInAsRole('office', startedAt + 2);
assert.equal((await getBytes(sourceRef)).byteLength, 4);
assert.equal((await getBytes(otherSourceRef)).byteLength, 5);
assert.equal((await getBytes(serverCandidateRef)).byteLength, 14);
await expectDenied('central user needs audited grant for server issued read', () => getBytes(serverIssuedRef));
await expectDenied('office browser canonical drawing create', () => uploadBytes(
  ref(storage, `construction-plans/site-2/${plan2Id}/drawings/d-02/rev-1/office-source.jpg`),
  new Uint8Array([255, 216, 255]),
  { contentType: 'image/jpeg' },
));
await uploadBytes(
  ref(storage, `construction-plans/site-2/${plan2Id}/exports/rev-02/office-hash.pdf`),
  new TextEncoder().encode('%PDF-1.7'),
  { contentType: 'application/pdf' },
);

await signOut(auth);
await signInAsRole('worker', startedAt + 20, { role: 'office' });
assert.equal((await getBytes(otherSourceRef)).byteLength, 5);
assert.equal((await getBytes(otherExportRef)).byteLength, 8);
await uploadBytes(
  ref(storage, `construction-plans/site-2/${plan2Id}/exports/rev-03/profile-office.pdf`),
  new TextEncoder().encode('%PDF-1.7'),
  { contentType: 'application/pdf' },
);

await signOut(auth);
await signInAsRole('worker', startedAt + 21, { roles: ['admin'] });
assert.equal((await getBytes(sourceRef)).byteLength, 4);
assert.equal((await getBytes(otherExportRef)).byteLength, 8);
await uploadBytes(
  ref(storage, `construction-plans/site-1/${plan1Id}/exports/rev-03/profile-admin.pdf`),
  new TextEncoder().encode('%PDF-1.7'),
  { contentType: 'application/pdf' },
);

await signOut(auth);
await signInAsRole('worker', startedAt + 22, { position: 'pos_jhl2VTnk9V3C4EiZ4QQI' });
assert.equal((await getBytes(otherSourceRef)).byteLength, 5);
assert.equal((await getBytes(otherExportRef)).byteLength, 8);
await uploadBytes(
  ref(storage, `construction-plans/site-2/${plan2Id}/exports/rev-04/profile-special-position.pdf`),
  new TextEncoder().encode('%PDF-1.7'),
  { contentType: 'application/pdf' },
);

await signOut(auth);
await signInAsRole('worker', startedAt + 23, { systemRole: 'SYSTEM_ADMIN' });
assert.equal((await getBytes(sourceRef)).byteLength, 4);
assert.equal((await getBytes(otherExportRef)).byteLength, 8);
await uploadBytes(
  ref(storage, `construction-plans/site-1/${plan1Id}/exports/rev-05/profile-system-admin.pdf`),
  new TextEncoder().encode('%PDF-1.7'),
  { contentType: 'application/pdf' },
);

await signOut(auth);
await signInAsRole('site_manager', startedAt + 3, { siteId: 'site-1' });
await expectDenied('nonparticipant same-site original read', () => getBytes(sourceRef));
await expectDenied('nonparticipant same-site preview read', () => getBytes(previewRef));
await expectDenied('nonparticipant same-site issued PDF read', () => getBytes(exportRef));
await expectDenied('nonparticipant same-site legacy original read', () => getBytes(legacySourceRef));
await expectDenied('nonparticipant same-site approved snapshot read', () => getBytes(snapshotRef));
await expectDenied('nonparticipant same-site generated preview read', () => getBytes(serverPreviewRef));
await expectDenied('nonparticipant server candidate read', () => getBytes(serverCandidateRef));
await expectDenied('nonparticipant server issued read', () => getBytes(serverIssuedRef));
await expectDenied('nonparticipant execution record photo read', () => getBytes(executionPhotoRef));
await expectDenied('nonparticipant execution record appendix read', () => getBytes(executionAppendixRef));
await expectDenied('nonparticipant same-site original create', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-1/${plan1Id}/drawings/d-02/rev-1/source.jpg`),
    new Uint8Array([255, 216, 255, 4]),
    { contentType: 'image/jpeg' },
  ));
await expectDenied('nonparticipant same-site preview create', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-1/${plan1Id}/drawings/d-02/rev-1/preview.jpg`),
    new Uint8Array([255, 216, 255, 5]),
    { contentType: 'image/jpeg' },
  ));
await expectDenied('site role issued candidate create', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-1/${plan1Id}/exports/rev-01/site-forged.pdf`),
    new TextEncoder().encode('%PDF-1.7'),
    { contentType: 'application/pdf' },
  ));
await expectDenied('other-site original read', () => getBytes(otherSourceRef));
await expectDenied('other-site preview read', () => getBytes(otherPreviewRef));
await expectDenied('other-site issued PDF read', () => getBytes(otherExportRef));
await expectDenied('other-site legacy original read', () => getBytes(otherLegacySourceRef));
await expectDenied('other-site approved snapshot read', () => getBytes(otherSnapshotRef));
await expectDenied('other-site original create', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-2/${plan2Id}/drawings/d-03/rev-1/source.png`),
    new Uint8Array([137, 80, 78, 71]),
    { contentType: 'image/png' },
  ));
await expectDenied('other-site preview create', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-2/${plan2Id}/drawings/d-03/rev-1/preview.jpg`),
    new Uint8Array([255, 216, 255]),
    { contentType: 'image/jpeg' },
  ));
await expectDenied('other-site issued PDF create', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-2/${plan2Id}/exports/rev-03/site-forged.pdf`),
    new TextEncoder().encode('%PDF-1.7'),
    { contentType: 'application/pdf' },
  ));
await expectDenied('legacy unscoped drawing create', () =>
  uploadBytes(
    ref(storage, `construction-plans/${plan1Id}/drawings/d-04/rev-1/source.png`),
    new Uint8Array([137, 80, 78, 71]),
    { contentType: 'image/png' },
  ));

for (const [offset, profile] of [
  [4, { siteIds: ['site-1'] }],
  [5, { assignedSiteIds: ['site-1'] }],
]) {
  await signOut(auth);
  await signInAsRole('site_manager', startedAt + offset, profile);
  await expectDenied('site profile without plan participation', () => getBytes(sourceRef));
}

await signOut(auth);
const participantUid = await signInAsRole('worker', startedAt + 6);
await expectDenied('unscoped nonparticipant drawing read', () => getBytes(previewRef));
await adminDb.collection('constructionPlans').doc(plan1Id).update({
  participants: { authorIds: [participantUid], reviewerIds: [], approverIds: [] },
});
assert.equal((await getBytes(sourceRef)).byteLength, 4);
assert.equal((await getBytes(previewRef)).byteLength, 5);
assert.equal((await getBytes(exportRef)).byteLength, 8);
assert.equal((await getBytes(legacySourceRef)).byteLength, 5);
assert.equal((await getBytes(snapshotRef)).byteLength, 2);
assert.equal((await getBytes(serverPreviewRef)).byteLength, 5);
assert.equal((await getBytes(executionPhotoRef)).byteLength, 8);
assert.equal((await getBytes(executionAppendixRef)).byteLength, 20);
await expectDenied('participant execution record canonical write', () => uploadBytes(
  ref(storage, `construction-plan-records/site-1/${plan1Id}/${executionRecordId}/photos/browser/${'2'.repeat(64)}.png`),
  new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  { contentType: 'image/png' },
));
await expectDenied('participant pre-issue server candidate read', () => getBytes(serverCandidateRef));
await expectDenied('participant pre-issue server final read', () => getBytes(serverIssuedRef));
await expectDenied('participant other-plan original read', () => getBytes(otherSourceRef));
await expectDenied('participant browser canonical drawing create', () => uploadBytes(
  ref(storage, `construction-plans/site-1/${plan1Id}/drawings/d-05/rev-1/participant-preview.png`),
  new Uint8Array([137, 80, 78, 71, 6]),
  { contentType: 'image/png' },
));
await adminDb.collection('constructionPlans').doc(plan1Id).update({ status: 'issued' });
assert.equal((await getBytes(exportRef)).byteLength, 8);
await expectDenied('participant needs download intent grant for server issued read', () => getBytes(serverIssuedRef));
const participantDownloadGrantRef = adminDb.collection('constructionPlanPdfDownloadGrants')
  .doc(`${plan1Id}__${participantUid}`);
await participantDownloadGrantRef.set({
  planId: plan1Id,
  actorId: participantUid,
  status: 'active',
  artifactSha256: 'e'.repeat(64),
  expiresAtEpochMs: Date.now() + 60_000,
});
await expectDenied('download grant must bind the exact artifact SHA', () => getBytes(serverIssuedRef));
await participantDownloadGrantRef.update({
  artifactSha256: 'd'.repeat(64),
  expiresAtEpochMs: Date.now() - 1,
});
await expectDenied('expired download grant cannot read the issued artifact', () => getBytes(serverIssuedRef));
await participantDownloadGrantRef.update({
  actorId: 'construction-plan-other-user',
  expiresAtEpochMs: Date.now() + 60_000,
});
await expectDenied('download grant cannot be transferred to another actor', () => getBytes(serverIssuedRef));
await participantDownloadGrantRef.update({
  actorId: participantUid,
  expiresAtEpochMs: Date.now() + 60_000,
});
assert.equal((await getBytes(serverIssuedRef)).byteLength, 11);
await participantDownloadGrantRef.update({ status: 'completed', expiresAtEpochMs: 0 });
await expectDenied('completed download grant cannot be replayed', () => getBytes(serverIssuedRef));
await expectDenied('participant cannot read server candidate after issue', () => getBytes(serverCandidateRef));
await expectDenied('participant drawing create after plan issue', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-1/${plan1Id}/drawings/d-06/rev-1/issued-orphan.png`),
    new Uint8Array([137, 80, 78, 71, 11]),
    { contentType: 'image/png' },
  ));
await expectDenied('participant cannot create issued export', () =>
  uploadBytes(
    ref(storage, `construction-plans/site-1/${plan1Id}/exports/rev-02/participant-forged.pdf`),
    new TextEncoder().encode('%PDF-1.7'),
    { contentType: 'application/pdf' },
  ));

await signOut(auth);
const legacyCreatorUid = await signInAsRole('worker', startedAt + 7);
const legacyCreatorPlanId = `legacy-created-plan-${runId}`;
const legacyCreatorCanonicalPath = `construction-plans/site-3/${legacyCreatorPlanId}/drawings/d-01/rev-1/source.png`;
const legacyCreatorExportPath = `construction-plans/site-3/${legacyCreatorPlanId}/exports/rev-00/hash.pdf`;
const legacyCreatorDrawingPath = `construction-plans/${legacyCreatorPlanId}/drawings/d-legacy/rev-1/source.png`;
await adminDb.collection('constructionPlans').doc(legacyCreatorPlanId).set({
  siteId: 'site-3',
  status: 'issued',
  createdBy: legacyCreatorUid,
});
await Promise.all([
  adminBucket.file(legacyCreatorCanonicalPath).save(Buffer.from([137, 80, 78, 71, 12]), {
    metadata: { contentType: 'image/png' },
  }),
  adminBucket.file(legacyCreatorExportPath).save(Buffer.from('%PDF-1.7'), {
    metadata: { contentType: 'application/pdf' },
  }),
  adminBucket.file(legacyCreatorDrawingPath).save(Buffer.from([137, 80, 78, 71, 13]), {
    metadata: { contentType: 'image/png' },
  }),
]);
assert.equal((await getBytes(ref(storage, legacyCreatorCanonicalPath))).byteLength, 5);
assert.equal((await getBytes(ref(storage, legacyCreatorExportPath))).byteLength, 8);
assert.equal((await getBytes(ref(storage, legacyCreatorDrawingPath))).byteLength, 5);

await signOut(auth);
await expectDenied('anonymous drawing read', () => getBytes(sourceRef));
await expectDenied('anonymous issued PDF read', () => getBytes(exportRef));
await expectDenied('anonymous server candidate read', () => getBytes(serverCandidateRef));
await expectDenied('anonymous server issued read', () => getBytes(serverIssuedRef));
await expectDenied('anonymous execution record photo read', () => getBytes(executionPhotoRef));
await expectDenied('anonymous execution record appendix read', () => getBytes(executionAppendixRef));

console.log('Construction-plan Storage rule integration checks passed.');
process.exit(0);
