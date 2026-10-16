import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { assertPreviewClaims, isPreviewIdentity, permitsPreviewCall, previewDevRole } from './devPreviewPolicy';

test('only active DEV memberships, including configured position IDs, enable preview', () => {
    const positions = [{ id: 'custom-dev', name: 'DEV' }, { id: 'teamlead', name: '팀장' }];
    assert.equal(previewDevRole({ status: 'active', position: 'pos_custom-dev' }, positions), 'pos_custom-dev');
    assert.equal(previewDevRole({ status: 'active', role: 'admin', position: '팀장' }, positions), null);
    assert.equal(previewDevRole({ status: 'suspended', position: 'DEV' }, positions), null);
    assert.equal(previewDevRole({ status: 'active', additionalPositions: ['DEV'] }), 'DEV');
});
test('preview callable policy rejects every mutation and unknown operation', () => {
    assert.equal(permitsPreviewCall('getTeamScopedData', {}), true);
    for (const name of ['teamWorkerRequests', 'teamExpenseRequests', 'teamAccountApprovals']) {
        assert.equal(permitsPreviewCall(name, { action: 'list' }), true);
        for (const action of ['review', 'approve', 'submit', 'upload', 'analyze', 'drafts', 'discardDraft', 'save', undefined]) assert.equal(permitsPreviewCall(name, { action }), false);
    }
    for (const name of ['createDevPreviewSession', 'getDevPreviewAccounts', 'syncUserAccessClaims', 'geminiGateway', 'teamAdvanceRequests', 'teamOffDutyRequests', 'newFutureEndpoint']) assert.equal(permitsPreviewCall(name, { action: 'list' }), false);
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
