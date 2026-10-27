import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { assertPreviewClaims, isPreviewIdentity, permitsPreviewCall, previewActorRole } from './devPreviewPolicy';

test('only active DEV and CEO memberships, including configured position IDs, enable preview', () => {
    const positions = [{ id: 'custom-dev', name: 'DEV' }, { id: 'custom-ceo', name: 'CEO' }, { id: 'teamlead', name: '팀장' }];
    for (const position of ['DEV', 'developer', '개발자', 'pos_custom-dev', 'CEO', ' ceo ', 'pos_ceo', '대표', '대표이사', '사장', 'pos_custom-ceo']) {
        assert.equal(previewActorRole({ status: 'active', position }, positions), position);
        assert.equal(previewActorRole({ status: 'suspended', position }, positions), null);
    }
    for (const field of ['role', 'position', 'systemRole', 'roles', 'additionalPositions']) {
        assert.equal(previewActorRole({ status: 'active', [field]: ['roles', 'additionalPositions'].includes(field) ? ['CEO'] : 'CEO' }), 'CEO');
    }
    assert.equal(previewActorRole({ status: 'active', role: 'admin', position: '팀장' }, positions), null);
    assert.equal(previewActorRole({ status: 'active', position: 'unknown' }, positions), null);
    assert.equal(previewActorRole({ position: 'CEO' }, positions), null);
    assert.equal(previewActorRole(null), null);
});
test('preview callable policy rejects every mutation and unknown operation', () => {
    assert.equal(permitsPreviewCall('getTeamScopedData', {}), true);
    for (const name of ['teamWorkerRequests', 'teamExpenseRequests', 'teamAccountApprovals']) {
        assert.equal(permitsPreviewCall(name, { action: 'list' }), true);
        for (const action of ['review', 'approve', 'submit', 'upload', 'analyze', 'drafts', 'discardDraft', 'save', undefined]) assert.equal(permitsPreviewCall(name, { action }), false);
    }
    for (const name of ['createDevPreviewSession', 'getDevPreviewAccounts', 'syncUserAccessClaims', 'geminiGateway', 'teamAdvanceRequests', 'teamOffDutyRequests', 'newFutureEndpoint']) assert.equal(permitsPreviewCall(name, { action: 'list' }), false);
});

test('document preview permits only listing and reading, never saving or sharing actions', () => {
    for (const action of ['list', 'read']) assert.equal(permitsPreviewCall('supportTeamDocuments', { action }), true);
    for (const action of ['save', 'upload', 'delete', 'share', 'send', 'approve', 'unknown', undefined]) {
        assert.equal(permitsPreviewCall('supportTeamDocuments', { action }), false);
    }
});
test('reserved identities cannot lose their write restriction by dropping claims', () => {
    assert.equal(isPreviewIdentity('cy-preview-reserved', {}), true);
    assert.equal(isPreviewIdentity('actual-user', { devPreview: true }), true);
    assert.equal(isPreviewIdentity('actual-user', {}), false);
    const token = { devPreview: true, previewActorUid: 'dev-a', previewTargetUid: 'leader-a', previewExpiresAt: 1500, previewDevRole: 'DEV' };
    assert.doesNotThrow(() => assertPreviewClaims('cy-preview-a', token, 1000));
    assert.throws(() => assertPreviewClaims('actual-user', token, 1000));
    assert.throws(() => assertPreviewClaims('cy-preview-a', { ...token, previewExpiresAt: 900 }, 1000));
    assert.throws(() => assertPreviewClaims('cy-preview-a', { ...token, previewTargetUid: 'cy-preview-other' }, 1000));
    assert.throws(() => assertPreviewClaims('cy-preview-a', { ...token, previewExpiresAt: 99999 }, 1000));
});
