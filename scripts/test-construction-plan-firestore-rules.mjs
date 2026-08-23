import assert from 'node:assert/strict';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setLogLevel,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

setLogLevel('silent');

const projectId = process.env.GCLOUD_PROJECT || 'demo-cy-construction-plan';
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

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
const firestoreEmulator = parseEmulatorHostPort(
  process.env.FIRESTORE_EMULATOR_HOST,
  'FIRESTORE_EMULATOR_HOST',
);
initializeAdminApp({ projectId });
const adminDb = getAdminFirestore();

const createOfficeClient = async (name, profile = { role: 'office_staff' }) => {
  const app = initializeApp({ apiKey: 'demo-api-key', projectId }, name);
  const auth = getAuth(app);
  const authHost = authEmulator.host.includes(':') ? `[${authEmulator.host}]` : authEmulator.host;
  connectAuthEmulator(auth, `http://${authHost}:${authEmulator.port}`, { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(
    auth,
    `${name}-${Date.now()}@example.test`,
    'rules-test-password',
  );
  await adminDb.collection('users').doc(credential.user.uid).set({
    uid: credential.user.uid,
    ...profile,
    status: 'active',
  });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreEmulator.host, firestoreEmulator.port);
  return { db, uid: credential.user.uid };
};

const createScopedSiteClient = async (name, siteIds) => {
  const app = initializeApp({ apiKey: 'demo-api-key', projectId }, name);
  const auth = getAuth(app);
  const authHost = authEmulator.host.includes(':') ? `[${authEmulator.host}]` : authEmulator.host;
  connectAuthEmulator(auth, `http://${authHost}:${authEmulator.port}`, { disableWarnings: true });
  const credential = await createUserWithEmailAndPassword(
    auth,
    `${name}-${Date.now()}@example.test`,
    'rules-test-password',
  );
  await adminDb.collection('users').doc(credential.user.uid).set({
    uid: credential.user.uid,
    role: 'site_manager',
    status: 'active',
    assignedSiteIds: siteIds,
  });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreEmulator.host, firestoreEmulator.port);
  return { db, uid: credential.user.uid };
};

const expectDenied = async (label, operation) => {
  let denied = false;
  try {
    await operation();
  } catch (error) {
    denied = String(error?.code || '').includes('permission-denied');
  }
  assert.equal(denied, true, `${label} should be denied`);
};

const owner = await createOfficeClient('construction-owner');
const other = await createOfficeClient('construction-other');
const specialPositionAdmin = await createOfficeClient('construction-special-admin', {
  role: 'user',
  position: 'jhl2VTnk9V3C4EiZ4QQI',
});
const systemAdmin = await createOfficeClient('construction-system-admin', {
  role: 'user',
  systemRole: 'SYSTEM_ADMIN',
});
const scopedSiteUser = await createScopedSiteClient('construction-site-a', ['site-a']);
const participantOnlyUser = await createScopedSiteClient('construction-participant-only', []);
const planId = 'construction-plan-lock-rules';
const ownerRef = doc(owner.db, 'constructionPlans', planId);
const otherRef = doc(other.db, 'constructionPlans', planId);
const seriesId = 'construction-series-lock-rules';
const ownerSeriesRef = doc(owner.db, 'constructionPlanSeries', seriesId);
const ownerSeriesClaimRef = doc(owner.db, 'constructionPlanSeries', seriesId, 'idempotencyClaims', 'request-1');
const ownerMutationKeyRef = doc(owner.db, 'constructionPlanMutationKeys', 'claim-1');
const reservedConstructionPlanCollections = [
  'constructionPlanTemplates',
  'constructionPlanExportJobs',
  'constructionPlanPdfRenderOperations',
  'constructionPlanUploadSessions',
  'constructionPlanDrawingReuseJobs',
  'constructionPlanLockRequests',
  'constructionPlanLifecycleMutationReceipts',
  'constructionPlanPdfDownloadReceipts',
  'constructionPlanPdfDownloadGrants',
  'constructionPlanRecordUploadSessions',
  'constructionPlanRecordExports',
  'constructionPlanAuditEvents',
  'constructionPlanRecords',
];
const now = Date.now();

await expectDenied('browser draft creation', () => setDoc(ownerRef, {
  status: 'draft',
  title: '규칙 테스트 계획서',
  createdBy: owner.uid,
  updatedBy: owner.uid,
  updatedAt: new Date(now).toISOString(),
  lockVersion: 0,
  projectSnapshot: {
    capturedAt: new Date(now).toISOString(),
    siteName: '서버 원천 현장명',
    address: '서울시 원천로 1',
    clientName: '서버 원천 발주처',
    contractorName: '서버 원천 시공사',
    constructionPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' },
    buildings: ['101동'],
    floors: ['1층'],
    zones: ['A구간'],
    sitePhotos: [],
    emergencyContactsComplete: false,
    differsFromMaster: false,
  },
}));

await expectDenied('browser series creation', () => setDoc(ownerSeriesRef, {
  siteId: 'site-1',
  documentNo: 'CP-001',
  documentNoKey: 'cp-001',
  latestRevisionNo: 0,
  latestPlanId: planId,
}));
await expectDenied('browser mutation claim creation', () => setDoc(ownerMutationKeyRef, {
  actorId: owner.uid,
  operation: 'create_revision',
  requestFingerprint: 'forged',
}));
for (const collectionName of reservedConstructionPlanCollections) {
  await expectDenied(`browser reserved ${collectionName} creation`, () => setDoc(
    doc(owner.db, collectionName, 'browser-forged'),
    { planId, forged: true },
  ));
}
const drawingReuseJobRef = doc(owner.db, 'constructionPlanDrawingReuseJobs', 'server-only');
await expectDenied('browser drawing reuse job list', () => getDocs(
  collection(owner.db, 'constructionPlanDrawingReuseJobs'),
));
await expectDenied('browser drawing reuse job query', () => getDocs(query(
  collection(owner.db, 'constructionPlanDrawingReuseJobs'),
  where('ownerId', '==', owner.uid),
)));
await expectDenied('browser drawing reuse nested state create', () => setDoc(
  doc(owner.db, 'constructionPlanDrawingReuseJobs', 'server-only', 'state', 'forged'),
  { status: 'completed' },
));

await adminDb.collection('constructionPlans').doc(planId).set({
  status: 'draft',
  title: '규칙 테스트 계획서',
  createdBy: owner.uid,
  updatedBy: owner.uid,
  updatedAt: new Date(now).toISOString(),
  lockVersion: 0,
  projectSnapshot: {
    capturedAt: new Date(now).toISOString(),
    siteName: '서버 원천 현장명',
    address: '서울시 원천로 1',
    clientName: '서버 원천 발주처',
    contractorName: '서버 원천 시공사',
    constructionPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' },
    buildings: ['101동'],
    floors: ['1층'],
    zones: ['A구간'],
    sitePhotos: [],
    emergencyContactsComplete: false,
    differsFromMaster: false,
  },
  organizationSnapshot: {
    capturedAt: new Date(now).toISOString(),
    sourceSiteId: 'site-1',
    assignments: [],
    additionalWorkers: [],
    workerDirectoryProvenance: {
      captureKind: 'initial',
      sourceSiteId: 'site-1',
      capturedAt: new Date(now).toISOString(),
      sourceMasterHash: 'a'.repeat(64),
      sourceWorkerIds: [],
    },
  },
});
await adminDb.collection('constructionPlanSeries').doc(seriesId).set({
  siteId: 'site-1',
  documentNo: 'CP-001',
  documentNoKey: 'cp-001',
  tradeType: 'system-shoring',
  latestRevisionNo: 0,
  latestPlanId: planId,
});
await adminDb.collection('constructionPlanSeries').doc(seriesId)
  .collection('idempotencyClaims').doc('request-1').set({
    actorId: owner.uid,
    targetPlanId: planId,
  });
await adminDb.collection('constructionPlanMutationKeys').doc('claim-1').set({
  actorId: owner.uid,
  operation: 'create_revision',
  requestFingerprint: 'server-only',
});
await Promise.all(reservedConstructionPlanCollections.map((collectionName) => (
  adminDb.collection(collectionName).doc('server-only').set({ planId, serverOwned: true })
)));
await expectDenied('browser drawing reuse job update', () => updateDoc(drawingReuseJobRef, {
  status: 'completed',
  cleanupAfterEpochMs: 0,
}));
await expectDenied('browser drawing reuse job delete', () => deleteDoc(drawingReuseJobRef));
for (const collectionName of reservedConstructionPlanCollections) {
  await expectDenied(`browser reserved ${collectionName} read`, () => getDoc(
    doc(owner.db, collectionName, 'server-only'),
  ));
}

await adminDb.collection('sites').doc('site-a').set({ name: 'A 현장', status: 'active' });
await adminDb.collection('sites').doc('site-b').set({ name: 'B 현장', status: 'active' });
await adminDb.collection('constructionPlans').doc('site-a-plan').set({
  siteId: 'site-a',
  status: 'draft',
  title: 'A 현장 계획서',
  createdBy: scopedSiteUser.uid,
  participants: {
    authorIds: [scopedSiteUser.uid],
    reviewerIds: [],
    approverIds: [],
  },
  updatedBy: owner.uid,
  updatedAt: new Date(now).toISOString(),
  lockVersion: 0,
});
await adminDb.collection('constructionPlans').doc('site-b-plan').set({
  siteId: 'site-b',
  status: 'draft',
  title: 'B 현장 계획서',
  createdBy: other.uid,
  updatedBy: other.uid,
  updatedAt: new Date(now).toISOString(),
  lockVersion: 0,
});
await adminDb.collection('constructionPlans').doc('site-a-other-plan').set({
  siteId: 'site-a',
  status: 'draft',
  title: 'A 현장 다른 작성자의 계획서',
  createdBy: other.uid,
  participants: {
    authorIds: [other.uid],
    reviewerIds: [],
    approverIds: [],
  },
  updatedBy: other.uid,
  updatedAt: new Date(now).toISOString(),
  lockVersion: 0,
});
await adminDb.collection('constructionPlans').doc('participant-only-plan').set({
  siteId: 'site-b',
  status: 'draft',
  title: '참여자 경계 계획서',
  createdBy: participantOnlyUser.uid,
  participants: {
    authorIds: [participantOnlyUser.uid],
    reviewerIds: [],
    approverIds: [],
  },
  updatedBy: participantOnlyUser.uid,
  updatedAt: new Date(now).toISOString(),
  lockVersion: 0,
});
await adminDb.collection('constructionPlans').doc('participant-only-plan')
  .collection('workflowEvents').doc('created-event').set({
    planId: 'participant-only-plan',
    type: 'draft_created',
    actorId: participantOnlyUser.uid,
    at: new Date(now).toISOString(),
  });
await adminDb.collection('constructionPlans').doc('participant-only-plan')
  .collection('snapshots').doc('review-snapshot').set({
    id: 'review-snapshot',
    planId: 'participant-only-plan',
    kind: 'review',
    immutable: true,
    contentHash: 'a'.repeat(64),
    storagePath: 'construction-plans/site-b/participant-only-plan/snapshots/review.json',
    createdAt: new Date(now).toISOString(),
  });
await adminDb.collection('constructionPlans').doc('participant-only-plan')
  .collection('comments').doc('review-comment').set({
    id: 'review-comment',
    planId: 'participant-only-plan',
    snapshotId: 'review-snapshot',
    status: 'open',
    body: '검토 의견',
    actorId: owner.uid,
    createdAt: new Date(now).toISOString(),
  });

assert.equal((await getDoc(ownerSeriesRef)).exists(), true, 'authorized roles should read public series metadata');
assert.ok(
  (await getDocs(collection(owner.db, 'constructionPlans'))).docs.length >= 4,
  'central office roles should retain an explicitly authorized global plan list',
);
assert.ok(
  (await getDocs(collection(specialPositionAdmin.db, 'constructionPlans'))).docs.length >= 4,
  'legacy special administrator positions should retain central plan access',
);
assert.ok(
  (await getDocs(collection(systemAdmin.db, 'constructionPlans'))).docs.length >= 4,
  'profile-only SYSTEM_ADMIN should retain central plan access',
);
await expectDenied('series idempotency claim read', () => getDoc(ownerSeriesClaimRef));
await expectDenied('mutation claim read', () => getDoc(ownerMutationKeyRef));

await expectDenied('browser series mutation', () => updateDoc(ownerSeriesRef, {
  latestRevisionNo: 99,
  latestPlanId: 'forged-plan',
}));

const scopedSiteARef = doc(scopedSiteUser.db, 'constructionPlans', 'site-a-plan');
const scopedSiteBRef = doc(scopedSiteUser.db, 'constructionPlans', 'site-b-plan');
const scopedSiteOtherAuthorRef = doc(scopedSiteUser.db, 'constructionPlans', 'site-a-other-plan');
assert.equal((await getDoc(scopedSiteARef)).exists(), true, 'server-assigned author should read its plan');
const participantOnlyRef = doc(participantOnlyUser.db, 'constructionPlans', 'participant-only-plan');
assert.equal(
  (await getDoc(participantOnlyRef)).exists(),
  true,
  'server-assigned author should read a plan without denormalized user site fields',
);
assert.equal(
  (await getDocs(collection(
    participantOnlyUser.db,
    'constructionPlans',
    'participant-only-plan',
    'workflowEvents',
  ))).size,
  1,
  'plan participant should read workflow history through the parent ACL',
);
assert.equal(
  (await getDoc(doc(
    participantOnlyUser.db,
    'constructionPlans',
    'participant-only-plan',
    'snapshots',
    'review-snapshot',
  ))).exists(),
  true,
  'plan participant should read immutable review snapshot metadata through the parent ACL',
);
await expectDenied('participant direct review comment read', () => getDoc(doc(
  participantOnlyUser.db,
  'constructionPlans',
  'participant-only-plan',
  'comments',
  'review-comment',
)));
await expectDenied('central direct review comment read', () => getDoc(doc(
  owner.db,
  'constructionPlans',
  'participant-only-plan',
  'comments',
  'review-comment',
)));
await expectDenied('participant browser comment creation', () => setDoc(doc(
  participantOnlyUser.db,
  'constructionPlans',
  'participant-only-plan',
  'comments',
  'forged-comment',
), {
  planId: 'participant-only-plan',
  snapshotId: 'review-snapshot',
  status: 'open',
  body: '브라우저에서 위조한 의견',
  actorId: participantOnlyUser.uid,
  createdAt: new Date().toISOString(),
}));
await expectDenied('participant browser comment mutation', () => updateDoc(doc(
  participantOnlyUser.db,
  'constructionPlans',
  'participant-only-plan',
  'comments',
  'review-comment',
), {
  status: 'resolved',
  resolvedBy: participantOnlyUser.uid,
}));
await expectDenied('nonparticipant workflow history read', () => getDocs(collection(
  scopedSiteUser.db,
  'constructionPlans',
  'participant-only-plan',
  'workflowEvents',
)));
await expectDenied('nonparticipant review snapshot read', () => getDoc(doc(
  scopedSiteUser.db,
  'constructionPlans',
  'participant-only-plan',
  'snapshots',
  'review-snapshot',
)));
await expectDenied('nonparticipant direct review comment read', () => getDoc(doc(
  scopedSiteUser.db,
  'constructionPlans',
  'participant-only-plan',
  'comments',
  'review-comment',
)));
await expectDenied('same-site nonparticipant plan read', () => getDoc(scopedSiteOtherAuthorRef));
await expectDenied('cross-site plan read', () => getDoc(scopedSiteBRef));
await expectDenied('unscoped plan collection query', () => getDocs(collection(
  scopedSiteUser.db,
  'constructionPlans',
)));
await expectDenied('participant browser plan query', () => getDocs(query(
  collection(scopedSiteUser.db, 'constructionPlans'),
  where('participants.authorIds', 'array-contains', scopedSiteUser.uid),
)));

await updateDoc(scopedSiteARef, {
  editLock: {
    userId: scopedSiteUser.uid,
    userName: 'A 현장 담당자',
    acquiredAt: new Date(now).toISOString(),
    heartbeatAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 120_000).toISOString(),
    expiresAtEpochMs: now + 120_000,
  },
  updatedBy: scopedSiteUser.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 1,
});
await updateDoc(participantOnlyRef, {
  editLock: {
    userId: participantOnlyUser.uid,
    userName: '참여 작성자',
    acquiredAt: new Date(now).toISOString(),
    heartbeatAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 120_000).toISOString(),
    expiresAtEpochMs: now + 120_000,
  },
  updatedBy: participantOnlyUser.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 1,
});
await expectDenied('legacy plan cannot synthesize a missing project snapshot in the browser', () => updateDoc(scopedSiteARef, {
  projectSnapshot: {
    capturedAt: new Date(now).toISOString(),
    siteName: '브라우저 합성 현장',
    buildings: ['101동'],
    floors: ['1층'],
    zones: ['A구간'],
    sitePhotos: [],
    emergencyContactsComplete: false,
    differsFromMaster: false,
  },
  updatedBy: scopedSiteUser.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 2,
}));
await expectDenied('same-site non-author edit lock acquisition', () => updateDoc(scopedSiteOtherAuthorRef, {
  editLock: {
    userId: scopedSiteUser.uid,
    userName: 'A 현장 비작성자',
    acquiredAt: new Date(now).toISOString(),
    heartbeatAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 120_000).toISOString(),
    expiresAtEpochMs: now + 120_000,
  },
  updatedBy: scopedSiteUser.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 1,
}));
await expectDenied('cross-site edit lock acquisition', () => updateDoc(scopedSiteBRef, {
  editLock: {
    userId: scopedSiteUser.uid,
    userName: 'A 현장 담당자',
    acquiredAt: new Date(now).toISOString(),
    heartbeatAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 120_000).toISOString(),
    expiresAtEpochMs: now + 120_000,
  },
  updatedBy: scopedSiteUser.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 1,
}));

await expectDenied('content edit without a lock', () => updateDoc(ownerRef, {
  title: '잠금 없는 수정',
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 1,
}));

const acquiredAt = new Date().toISOString();
const ownerLock = {
  userId: owner.uid,
  userName: '작성자',
  acquiredAt,
  heartbeatAt: acquiredAt,
  expiresAt: new Date(now + 120_000).toISOString(),
  expiresAtEpochMs: now + 120_000,
};
await updateDoc(ownerRef, {
  editLock: ownerLock,
  updatedBy: owner.uid,
  updatedAt: acquiredAt,
  lockVersion: 1,
});

await expectDenied('active lock theft', () => updateDoc(otherRef, {
  editLock: { ...ownerLock, userId: other.uid, userName: '다른 사용자' },
  updatedBy: other.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 2,
}));
await expectDenied('unbounded lock ttl', () => updateDoc(ownerRef, {
  editLock: {
    ...ownerLock,
    heartbeatAt: new Date().toISOString(),
    expiresAt: new Date(now + 86_400_000).toISOString(),
    expiresAtEpochMs: now + 86_400_000,
  },
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 2,
}));

await updateDoc(ownerRef, {
  title: '잠금 소유자의 정상 수정',
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 2,
});
await expectDenied('browser ERP snapshot overwrite while holding the lock', () => updateDoc(ownerRef, {
  erpSnapshot: {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    site: {
      source: 'site',
      sourceId: 'forged-site',
      capturedAt: new Date().toISOString(),
      value: { id: 'forged-site', name: '브라우저 위조 현장' },
    },
  },
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 3,
}));
await expectDenied('browser worker directory provenance overwrite while holding the lock', () => updateDoc(ownerRef, {
  organizationSnapshot: {
    capturedAt: new Date().toISOString(),
    sourceSiteId: 'site-1',
    assignments: [],
    additionalWorkers: [],
    workerDirectoryProvenance: {
      captureKind: 'refresh',
      sourceSiteId: 'site-1',
      capturedAt: new Date().toISOString(),
      sourceMasterHash: 'b'.repeat(64),
      sourceWorkerIds: ['forged-worker'],
      appliedBy: owner.uid,
      appliedAt: new Date().toISOString(),
      changeReason: '브라우저에서 위조한 작업자 명부 출처',
      auditEventId: 'forged-audit',
    },
  },
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 3,
}));
await expectDenied('lock version jump', () => updateDoc(ownerRef, {
  title: '버전 건너뛰기',
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 999,
}));
await expectDenied('browser lineage metadata mutation', () => updateDoc(ownerRef, {
  documentNo: 'FORGED-DOCUMENT-NO',
  seriesId: 'forged-series',
  lineageRootPlanId: 'forged-root',
  revisionReason: '브라우저에서 위조한 개정 사유',
  sourceRevisionNo: 998,
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 3,
}));

await expectDenied('client review submission', () => updateDoc(ownerRef, {
  status: 'in_review',
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 3,
}));
await expectDenied('client review completion', () => updateDoc(ownerRef, {
  status: 'review_completed',
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 3,
}));

await updateDoc(ownerRef, {
  projectSnapshot: {
    capturedAt: new Date(now).toISOString(),
    siteName: '서버 원천 현장명',
    address: '서울시 원천로 1',
    clientName: '서버 원천 발주처',
    contractorName: '서버 원천 시공사',
    constructionPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' },
    buildings: ['102동'],
    floors: ['3층'],
    zones: ['B구간'],
    sitePhotos: [],
    emergencyContactsComplete: true,
    differsFromMaster: false,
  },
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 3,
});
await expectDenied('browser ERP-derived project field overwrite while holding the lock', () => updateDoc(ownerRef, {
  'projectSnapshot.siteName': '브라우저 위조 현장명',
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 4,
}));
await expectDenied('browser site photo token injection while holding the lock', () => updateDoc(ownerRef, {
  'projectSnapshot.sitePhotos': ['https://storage.invalid/site.jpg?token=private-download-token'],
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 4,
}));
await expectDenied('browser organization source-site overwrite while holding the lock', () => updateDoc(ownerRef, {
  'organizationSnapshot.sourceSiteId': 'forged-site',
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 4,
}));
await updateDoc(ownerRef, {
  editLock: deleteField(),
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 4,
});

await expectDenied('client issued-for-use transition', () => updateDoc(ownerRef, {
  status: 'issued',
  updatedBy: owner.uid,
  updatedAt: new Date().toISOString(),
  lockVersion: 5,
  issuedExportId: 'forged-export',
}));

console.log('Construction-plan Firestore rule integration checks passed.');
process.exit(0);
