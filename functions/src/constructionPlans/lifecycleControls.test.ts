import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';
import { constructionPlanLockFingerprint } from './lifecycleControls';

const source = readFileSync(join(__dirname, '../../src/constructionPlans/lifecycleControls.ts'), 'utf8');
const firestoreRules = readFileSync(join(__dirname, '../../../firestore.rules'), 'utf8');
const storageRules = readFileSync(join(__dirname, '../../../storage.rules'), 'utf8');

const block = (start: string, end: string): string => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0, `missing source marker: ${start}`);
    assert.ok(to > from, `missing source marker: ${end}`);
    return source.slice(from, to);
};

test('lock fingerprint is deterministic and binds plan, holder and acquisition', () => {
    const lock = {
        userId: 'holder-1', userName: '보유자', acquiredAt: '2026-08-22T01:00:00.000Z',
        expiresAt: '2026-08-22T01:02:00.000Z', expiresAtEpochMs: 1787360520000,
    };
    const first = constructionPlanLockFingerprint('plan-1', lock);
    assert.equal(first, constructionPlanLockFingerprint('plan-1', { ...lock }));
    assert.notEqual(first, constructionPlanLockFingerprint('plan-2', lock));
    assert.notEqual(first, constructionPlanLockFingerprint('plan-1', { ...lock, userId: 'holder-2' }));
    assert.notEqual(first, constructionPlanLockFingerprint('plan-1', { ...lock, acquiredAt: '2026-08-22T01:00:01.000Z' }));
    assert.match(first, /^[a-f0-9]{64}$/);
});

test('unlock request and force release are transaction-bound, fail closed and append audit', () => {
    const requestUnlock = block(
        'export const requestConstructionPlanUnlockServer',
        'const resolveLockRequest',
    );
    assert.match(requestUnlock, /runTransaction/);
    assert.match(requestUnlock, /assertParticipant\(plan, actor\)/);
    assert.match(requestUnlock, /assertExpectedVersion\(plan, expected\)/);
    assert.match(requestUnlock, /requireExactLock\(request, planId, plan\)/);
    assert.match(requestUnlock, /requesters\.find\(\(item\) => item\.actorId === actor\.uid\)/);
    assert.match(requestUnlock, /MAX_LOCK_REQUESTERS/);
    assert.match(requestUnlock, /transaction\.create\(db\(\)\.collection\(AUDIT_COLLECTION\)/);

    const force = block(
        'export const forceReleaseConstructionPlanLockServer',
        'const lifecycleReceiptId',
    );
    assert.match(force, /requiredReason\(request\.reason, 500\)/);
    assert.match(force, /actor\.access\.isAdmin.*actor\.access\.isOffice/);
    assert.match(force, /assertExpectedVersion\(plan, expected\)/);
    assert.match(force, /requireExactLock\(request, planId, plan\)/);
    assert.match(force, /lockVersion: nextLockVersion/);
    assert.match(force, /resolveLockRequest\(transaction, requestSnapshot/);
    assert.doesNotMatch(force, /transaction\.delete/);
});

test('withdrawal rejects any decision, comment or round drift and retains immutable artifacts', () => {
    const boundary = block('const assertWithdrawalBoundary', 'export const getConstructionPlanControlCapabilitiesServer');
    assert.match(boundary, /reviewDecision !== 'pending'/);
    assert.match(boundary, /completedBy !== undefined/);
    assert.match(boundary, /changesRequestedBy !== undefined/);
    assert.match(boundary, /zeroCommentSummary\(packageData\.commentSummary\)/);
    assert.match(boundary, /zeroCommentSummary\(cycle\.commentSummary\)/);
    assert.match(boundary, /zeroCommentSummary\(plan\.commentSummary\)/);
    assert.match(boundary, /Number\(cycle\.round\) !== boundary\.round/);

    const lifecycle = block(
        'export const transitionConstructionPlanLifecycleServer',
        'const cleanupExpiredLock',
    );
    assert.match(lifecycle, /isAuthor\(preflightPlan, actor\.uid\)/);
    assert.match(lifecycle, /requiredReason\(request\.reason, 1000\)/);
    assert.match(lifecycle, /requestFingerprint/);
    assert.match(lifecycle, /activeReviewSnapshotStoragePath: admin\.firestore\.FieldValue\.delete\(\)/);
    assert.doesNotMatch(lifecycle, /transaction\.update\(withdrawal!\.packageRef/);
    assert.doesNotMatch(lifecycle, /transaction\.update\(withdrawal!\.cycleRef/);
    assert.match(lifecycle, /submitted review snapshot, package and cycle are immutable/);
    assert.doesNotMatch(lifecycle, /transaction\.delete/);
    assert.doesNotMatch(lifecycle, /bucket\(\).*delete/);
});

test('archive and void are central-only expected-version transitions with no destructive delete', () => {
    const lifecycle = block(
        'export const transitionConstructionPlanLifecycleServer',
        'const cleanupExpiredLock',
    );
    assert.match(lifecycle, /actor\.access\.isAdmin \|\| actor\.access\.isOffice/);
    assert.match(lifecycle, /assertExpectedVersion\(plan, expected\)/);
    assert.match(lifecycle, /action === 'void' \? 'void' : 'archived'/);
    assert.match(lifecycle, /transaction\.create\(receiptRef/);
    assert.match(lifecycle, /transaction\.create\(planRef\.collection\('workflowEvents'\)/);
    assert.doesNotMatch(lifecycle, /transaction\.delete/);
});

test('issued download verifies immutable bytes before intent and records bounded completion metadata', () => {
    const prepare = block(
        'export const prepareConstructionPlanIssuedPdfDownloadServer',
        'export const completeConstructionPlanIssuedPdfDownloadServer',
    );
    assert.match(prepare, /assertParticipant\(plan, actor\)/);
    assert.match(prepare, /await verifyIssuedArtifactBytes\(artifact\)/);
    assert.match(prepare, /transaction\.set\(grantRef, grant\)/);
    assert.match(prepare, /artifactSha256: expectedSha256/);
    assert.match(prepare, /artifactProfile: 'issued'/);
    assert.doesNotMatch(prepare, /downloadToken|signedUrl|storagePath.*metadata/);

    const completion = source.slice(source.indexOf('export const completeConstructionPlanIssuedPdfDownloadServer'));
    assert.match(completion, /receipt\.actorId !== actor\.uid/);
    assert.match(completion, /receipt\.artifactSha256 !== downloadedSha256/);
    assert.match(completion, /artifact\.sizeBytes !== downloadedSizeBytes/);
    assert.match(completion, /grant\.receiptId === receiptId/);
    assert.match(completion, /grant\?\.status !== 'active'/);
    assert.match(completion, /Number\(grant\.expiresAtEpochMs\) <= Date\.now\(\)/);
    assert.match(completion, /receipt\.status === 'completed'/);
    assert.match(completion, /pdf_download_complete/);
    assert.match(completion, /status: 'completed'.*expiresAtEpochMs: 0/s);
    assert.doesNotMatch(completion, /storagePath:|downloadToken|signedUrl/);

    assert.match(storageRules, /hasAuditedConstructionPlanPdfGrant/);
    assert.match(storageRules, /artifactFile == grant\.get\('artifactSha256', ''\) \+ '\.pdf'/);
    assert.match(storageRules, /grant\.get\('expiresAtEpochMs', 0\) > request\.time\.toMillis\(\)/);
    assert.match(firestoreRules, /constructionPlanPdfDownloadGrants/);
});
