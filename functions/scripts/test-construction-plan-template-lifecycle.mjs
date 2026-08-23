import assert from 'node:assert/strict';
import admin from 'firebase-admin';

const projectId = process.env.GCLOUD_PROJECT || 'demo-cy-construction-plan';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(firestoreHost)) {
  throw new Error('construction-plan-template-test-refuses-nonlocal-firestore');
}

if (admin.apps.length === 0) admin.initializeApp({ projectId });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const {
  initializeConstructionPlanTemplateServer,
  listConstructionPlanTemplatesServer,
  requirePublishedConstructionPlanTemplateForNewDraft,
  transitionConstructionPlanTemplateLifecycleServer,
} = await import('../lib/constructionPlans/templateLifecycle.js');

const identity = {
  shoring: {
    tradeType: 'system-shoring',
    templateId: 'system-shoring-standard',
    templateVersion: '1.0.0',
  },
  scaffold: {
    tradeType: 'system-scaffold',
    templateId: 'system-scaffold-standard',
    templateVersion: '1.0.0',
  },
};

const adminContext = {
  auth: { uid: 'template-admin', token: { role: 'admin', name: '표준관리자' } },
};
const siteContext = {
  auth: { uid: 'site-user', token: { role: 'site_manager', name: '현장사용자' } },
};

await Promise.all([
  db.collection('users').doc('template-admin').set({
    uid: 'template-admin', name: '표준관리자', role: 'admin', status: 'active',
  }),
  db.collection('users').doc('site-user').set({
    uid: 'site-user', name: '현장사용자', role: 'site_manager', status: 'active',
  }),
]);

const expectHttpsCode = async (operation, expectedCode) => {
  try {
    await operation();
    assert.fail(`Expected ${expectedCode}`);
  } catch (error) {
    assert.equal(error?.code, expectedCode);
  }
};

const initialize = (template, suffix) => initializeConstructionPlanTemplateServer.run({
  ...template,
  reason: `${suffix} exact 서버 표준 최초 등록`,
  idempotencyKey: `initialize-${suffix}`,
}, adminContext);

const transition = (template, toLifecycle, expectedLifecycleVersion, suffix, reason) => (
  transitionConstructionPlanTemplateLifecycleServer.run({
    ...template,
    toLifecycle,
    expectedLifecycleVersion,
    reason,
    idempotencyKey: `transition-${suffix}`,
  }, adminContext)
);

await expectHttpsCode(
  () => initializeConstructionPlanTemplateServer.run({
    ...identity.shoring,
    reason: '권한 없는 초기화 시도',
    idempotencyKey: 'site-user-initialize',
  }, siteContext),
  'permission-denied',
);

await expectHttpsCode(
  () => initializeConstructionPlanTemplateServer.run({
    ...identity.shoring,
    reason: '클라이언트 manifest 주입 차단',
    idempotencyKey: 'injected-manifest',
    manifest: { pages: [] },
  }, adminContext),
  'invalid-argument',
);

await expectHttpsCode(
  () => listConstructionPlanTemplatesServer.run({ includeManifest: true }, adminContext),
  'invalid-argument',
);

const initializedShoring = await initialize(identity.shoring, 'shoring');
assert.equal(initializedShoring.template.lifecycle, 'draft');
assert.equal(initializedShoring.template.lifecycleVersion, 1);
assert.equal(initializedShoring.template.selectableForNewPlan, false);
assert.match(initializedShoring.template.manifestHash, /^[a-f0-9]{64}$/);
assert.match(initializedShoring.template.templateBundleHash, /^[a-f0-9]{64}$/);

const initializationReplay = await initialize(identity.shoring, 'shoring');
assert.equal(initializationReplay.idempotent, true);
assert.deepEqual(initializationReplay.template, initializedShoring.template);

await expectHttpsCode(
  () => initializeConstructionPlanTemplateServer.run({
    ...identity.shoring,
    reason: '같은 멱등키에 다른 요청 본문',
    idempotencyKey: 'initialize-shoring',
  }, adminContext),
  'already-exists',
);

await expectHttpsCode(
  () => transition(identity.shoring, 'published', 1, 'invalid-direct-publish', '검토 없이 직접 게시 시도'),
  'failed-precondition',
);

const shoringReview = await transition(
  identity.shoring,
  'in_review',
  1,
  'shoring-review',
  '시스템동바리 표준 문구 및 페이지 계약 검토 요청',
);
assert.equal(shoringReview.template.lifecycleVersion, 2);

const shoringPublished = await transition(
  identity.shoring,
  'published',
  2,
  'shoring-publish',
  '시스템동바리 현장 신규생성 표준으로 게시 승인',
);
assert.equal(shoringPublished.template.lifecycle, 'published');
assert.equal(shoringPublished.template.isLatest, true);
assert.equal(shoringPublished.template.selectableForNewPlan, true);

const accepted = await requirePublishedConstructionPlanTemplateForNewDraft(identity.shoring);
assert.equal(accepted.key, shoringPublished.template.key);

const initializedScaffold = await initialize(identity.scaffold, 'scaffold');
await transition(
  identity.scaffold,
  'in_review',
  initializedScaffold.template.lifecycleVersion,
  'scaffold-review',
  '시스템비계 표준 문구 및 페이지 계약 검토 요청',
);
const scaffoldPublished = await transition(
  identity.scaffold,
  'published',
  2,
  'scaffold-publish',
  '시스템비계 현장 신규생성 표준으로 게시 승인',
);
const scaffoldRetired = await transition(
  identity.scaffold,
  'retired',
  scaffoldPublished.template.lifecycleVersion,
  'scaffold-retire',
  '시스템비계 표준 개편을 위한 기존 게시본 폐기',
);
assert.equal(scaffoldRetired.template.lifecycle, 'retired');
assert.equal(scaffoldRetired.template.isLatest, false);
assert.equal(scaffoldRetired.template.selectableForNewPlan, false);
await expectHttpsCode(
  () => requirePublishedConstructionPlanTemplateForNewDraft(identity.scaffold),
  'failed-precondition',
);

const siteCatalog = await listConstructionPlanTemplatesServer.run({}, siteContext);
assert.equal(siteCatalog.canManage, false);
assert.equal(siteCatalog.templates.length, 2);
assert.equal(
  siteCatalog.templates.find((template) => template.tradeType === 'system-shoring')?.isLatest,
  true,
);
assert.equal(
  siteCatalog.templates.find((template) => template.tradeType === 'system-scaffold')?.lifecycle,
  'retired',
);

const templateDocuments = await db.collection('constructionPlanTemplates').get();
assert.equal(templateDocuments.size, 2);
templateDocuments.docs.forEach((snapshot) => {
  const value = snapshot.data();
  assert.equal(value.id, snapshot.id);
  assert.equal(value.manifest.templateId, value.templateId);
  assert.equal(value.manifest.templateVersion, value.templateVersion);
  assert.match(value.manifestHash, /^[a-f0-9]{64}$/);
  assert.match(value.templateBundleHash, /^[a-f0-9]{64}$/);
});

const auditEvents = await db.collection('constructionPlanAuditEvents')
  .where('entityType', '==', 'construction-plan-template')
  .get();
assert.equal(auditEvents.size, 7);
assert.ok(auditEvents.docs.every((snapshot) => snapshot.data().reason));

const mutationClaims = await db.collection('constructionPlanMutationKeys')
  .where('scope', '==', 'construction-plan-template')
  .get();
assert.equal(mutationClaims.size, 7);

console.log('Construction-plan template lifecycle integration checks passed.');
await admin.app().delete();
