import assert from 'node:assert/strict';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setLogLevel,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'demo-cy-card-lifecycle';
setLogLevel('silent');
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

initializeAdminApp({ projectId });
const adminDb = getAdminFirestore();
const app = initializeApp({ apiKey: 'demo-api-key', projectId }, 'card-lifecycle-rules-client');
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const credential = await createUserWithEmailAndPassword(
  auth,
  `card-support-${Date.now()}@example.test`,
  'rules-test-password',
);
await adminDb.collection('users').doc(credential.user.uid).set({
  uid: credential.user.uid,
  role: 'support',
  status: 'active',
});
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const expectDenied = async (label, operation) => {
  let denied = false;
  try {
    await operation();
  } catch (error) {
    denied = String(error?.code || '').includes('permission-denied');
  }
  assert.equal(denied, true, `${label} should be denied`);
};

const oldTimestamp = Timestamp.fromDate(new Date('2026-08-18T00:00:00.000Z'));
const baseCard = (status = 'AVAILABLE') => ({
  name: '규칙 테스트 카드',
  issuer: '테스트카드',
  cardType: 'CREDIT',
  last4: '3909',
  maskedNumber: '****-****-****-3909',
  status,
  createdAt: oldTimestamp,
  updatedAt: oldTimestamp,
});

// Existing cards do not have the new lifecycle marker fields. Normal edits and
// the first lifecycle command must remain compatible with that legacy shape.
const legacyCardId = 'legacy-card-without-lifecycle-fields';
await adminDb.collection('cards').doc(legacyCardId).set(baseCard());
await updateDoc(doc(db, 'cards', legacyCardId), {
  memo: '기존 카드 일반 수정',
  updatedAt: serverTimestamp(),
});
assert.equal((await getDoc(doc(db, 'cards', legacyCardId))).data()?.memo, '기존 카드 일반 수정');

const cardId = 'active-card';
const cardRef = doc(db, 'cards', cardId);
const assignmentRef = doc(db, 'cardAssignments', 'active-assignment');
const billingRef = doc(db, 'cardBillingTargets', 'active-billing-target');
await adminDb.collection('cards').doc(cardId).set(baseCard());

const assignBatch = writeBatch(db);
assignBatch.update(cardRef, {
  status: 'ASSIGNED',
  currentAssigneeId: 'team-1',
  currentAssigneeType: 'TEAM',
  currentAssigneeName: '테스트팀',
  updatedAt: serverTimestamp(),
});
assignBatch.set(assignmentRef, {
  cardId,
  cardLabel: '규칙 테스트 카드 (3909)',
  assigneeId: 'team-1',
  assigneeType: 'TEAM',
  assigneeName: '테스트팀',
  startDate: '2026-08-01',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
await assignBatch.commit();

const billingBatch = writeBatch(db);
billingBatch.update(cardRef, {
  billingTargetId: 'team-1',
  billingTargetType: 'TEAM',
  billingTargetName: '테스트팀',
  billingTargetStartDate: '2026-08-01',
  billingTargetEndDate: null,
  updatedAt: serverTimestamp(),
});
billingBatch.set(billingRef, {
  cardId,
  cardLabel: '규칙 테스트 카드 (3909)',
  targetId: 'team-1',
  targetType: 'TEAM',
  targetName: '테스트팀',
  startDate: '2026-08-01',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
await billingBatch.commit();

const cancelOperationId = 'cancel_active-card_rules-test';
const cancelBatch = writeBatch(db);
cancelBatch.update(assignmentRef, { endDate: '2026-08-19', updatedAt: serverTimestamp() });
cancelBatch.update(billingRef, { endDate: '2026-08-19', updatedAt: serverTimestamp() });
cancelBatch.update(cardRef, {
  status: 'SUSPENDED',
  currentAssigneeId: null,
  currentAssigneeType: null,
  currentAssigneeName: null,
  billingTargetId: null,
  billingTargetType: null,
  billingTargetName: null,
  billingTargetStartDate: null,
  billingTargetEndDate: null,
  lastLifecycleOperationId: cancelOperationId,
  lastLifecycleOperationType: 'CANCEL',
  lastLifecycleOperationAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
cancelBatch.set(doc(db, 'support_cancellation_logs', cancelOperationId), {
  resourceType: 'card',
  resourceId: cardId,
  resourceLabel: '규칙 테스트 카드',
  reason: 'CARD_SUSPENDED',
  reasonLabel: '카드 정지',
  processedDate: '2026-08-19',
  statusBefore: 'ASSIGNED',
  statusAfter: 'SUSPENDED',
  note: '규칙 테스트',
  createdAt: serverTimestamp(),
});
await cancelBatch.commit();
assert.equal((await getDoc(cardRef)).data()?.status, 'SUSPENDED');

for (const [kind, collectionName, payload] of [
  ['assignment', 'cardAssignments', {
    cardId,
    cardLabel: '규칙 테스트 카드 (3909)',
    assigneeId: 'team-2',
    assigneeType: 'TEAM',
    assigneeName: '차단 대상팀',
    startDate: '2026-08-20',
  }],
  ['billing target', 'cardBillingTargets', {
    cardId,
    cardLabel: '규칙 테스트 카드 (3909)',
    targetId: 'team-2',
    targetType: 'TEAM',
    targetName: '차단 대상팀',
    startDate: '2026-08-20',
  }],
]) {
  await expectDenied(`inactive card open ${kind} create`, async () => {
    const blockedBatch = writeBatch(db);
    blockedBatch.update(cardRef, { updatedAt: serverTimestamp() });
    blockedBatch.set(doc(db, collectionName, `blocked-${kind.replace(' ', '-')}`), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await blockedBatch.commit();
  });
}

await expectDenied('inactive card blank endDate reopen', async () => {
  const blockedBatch = writeBatch(db);
  blockedBatch.update(cardRef, { updatedAt: serverTimestamp() });
  blockedBatch.update(assignmentRef, { endDate: '   ', updatedAt: serverTimestamp() });
  await blockedBatch.commit();
});

const restoreOperationId = 'restore_active-card_rules-test';
const restoreBatch = writeBatch(db);
restoreBatch.update(cardRef, {
  status: 'AVAILABLE',
  currentAssigneeId: null,
  currentAssigneeType: null,
  currentAssigneeName: null,
  billingTargetId: null,
  billingTargetType: null,
  billingTargetName: null,
  billingTargetStartDate: null,
  billingTargetEndDate: null,
  lastLifecycleOperationId: restoreOperationId,
  lastLifecycleOperationType: 'RESTORE',
  lastLifecycleOperationAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
restoreBatch.set(doc(db, 'support_cancellation_logs', restoreOperationId), {
  resourceType: 'card',
  resourceId: cardId,
  resourceLabel: '규칙 테스트 카드',
  reason: 'OTHER',
  reasonLabel: '카드 정지 해제',
  processedDate: '2026-08-19',
  statusBefore: 'SUSPENDED',
  statusAfter: 'AVAILABLE',
  note: '규칙 테스트',
  createdAt: serverTimestamp(),
});
await restoreBatch.commit();
assert.equal((await getDoc(cardRef)).data()?.status, 'AVAILABLE');

const closedCardId = 'closed-card';
await adminDb.collection('cards').doc(closedCardId).set(baseCard('CLOSED'));
await expectDenied('closed card restore', async () => {
  const operationId = 'restore_closed-card_rules-test';
  const blockedBatch = writeBatch(db);
  blockedBatch.update(doc(db, 'cards', closedCardId), {
    status: 'AVAILABLE',
    lastLifecycleOperationId: operationId,
    lastLifecycleOperationType: 'RESTORE',
    lastLifecycleOperationAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  blockedBatch.set(doc(db, 'support_cancellation_logs', operationId), {
    resourceType: 'card',
    resourceId: closedCardId,
    resourceLabel: '해지 카드',
    reason: 'OTHER',
    reasonLabel: '카드 정지 해제',
    processedDate: '2026-08-19',
    statusBefore: 'CLOSED',
    statusAfter: 'AVAILABLE',
    note: '차단되어야 함',
    createdAt: serverTimestamp(),
  });
  await blockedBatch.commit();
});

const orphanTargetId = 'orphan-billing-target';
await adminDb.collection('cardBillingTargets').doc(orphanTargetId).set({
  cardId: 'missing-parent-card',
  targetId: 'team-legacy',
  targetType: 'TEAM',
  targetName: '고아 레코드',
  startDate: '2025-01-01',
});
await deleteDoc(doc(db, 'cardBillingTargets', orphanTargetId));
assert.equal((await adminDb.collection('cardBillingTargets').doc(orphanTargetId).get()).exists, false);

await signOut(auth);
console.log('Card lifecycle Firestore rule integration checks passed.');
