import { strict as assert } from 'assert';
import { test } from 'node:test';
import {
    buildVehicleImportIdentityDocumentId,
    buildVehicleImportIdentityKey,
    hashVehicleImportSource,
    normalizeVehicleImportSourceSha256,
    resolveVehicleImportDuplicateExpenseId,
    isActiveVehicleImportExpense,
} from './vehicleImportIdentity';

test('cancelled and removed expenses release both semantic and source identities', () => {
    for (const data of [{ status: 'CANCELLED' }, { status: 'ACTIVE', cancelledAt: '2026-11-01' }]) {
        const snap = { exists: true, data: () => data };
        const activeIds = new Set(isActiveVehicleImportExpense(snap) ? ['old-expense'] : []);
        for (const expenseId of ['old-expense', 'changed-ai-reading']) {
            assert.equal(resolveVehicleImportDuplicateExpenseId({ expenseId, identityId: 'source',
                existingExpenseIds: activeIds, createdExpenseIds: new Set(),
                existingIdentityIds: activeIds.has('old-expense') ? new Set(['source']) : new Set(),
                existingIdentityExpenseIds: new Map([['source', 'old-expense']]), claimedIdentityExpenseIds: new Map() }), '');
        }
    }
    assert.equal(isActiveVehicleImportExpense({ exists: false, data: () => undefined }), false);
    assert.equal(isActiveVehicleImportExpense({ exists: true, data: () => ({ status: 'ACTIVE', cancelledAt: null }) }), true);
    assert.equal(isActiveVehicleImportExpense({ exists: true, data: () => ({}) }), true);
});

test('same source bytes retain one identity independently of filename or operation', () => {
    const sourceSha256 = hashVehicleImportSource(Buffer.from('same vehicle statement').toString('base64'));
    const firstKey = buildVehicleImportIdentityKey('toll', sourceSha256, 0);
    const retriedKey = buildVehicleImportIdentityKey('toll', sourceSha256.toUpperCase(), 0);

    assert.equal(firstKey, retriedKey);
    assert.equal(
        buildVehicleImportIdentityDocumentId(firstKey),
        buildVehicleImportIdentityDocumentId(retriedKey),
    );
});

test('hashes decoded file bytes instead of the base64 spelling', () => {
    const padded = Buffer.from('vehicle fine notice').toString('base64');
    const withoutPadding = padded.replace(/=+$/, '');
    assert.equal(hashVehicleImportSource(padded), hashVehicleImportSource(withoutPadding));
});

test('separates fine, toll, source and entry identities', () => {
    const firstSha256 = hashVehicleImportSource(Buffer.from('first').toString('base64'));
    const secondSha256 = hashVehicleImportSource(Buffer.from('second').toString('base64'));

    assert.notEqual(
        buildVehicleImportIdentityKey('fine', firstSha256, 0),
        buildVehicleImportIdentityKey('toll', firstSha256, 0),
    );
    assert.notEqual(
        buildVehicleImportIdentityKey('toll', firstSha256, 0),
        buildVehicleImportIdentityKey('toll', firstSha256, 1),
    );
    assert.notEqual(
        buildVehicleImportIdentityKey('fine', firstSha256, 0),
        buildVehicleImportIdentityKey('fine', secondSha256, 0),
    );
});

test('rejects malformed source hashes and invalid entry indexes', () => {
    assert.equal(normalizeVehicleImportSourceSha256('not-a-sha256'), '');
    assert.equal(buildVehicleImportIdentityKey('fine', 'not-a-sha256', 0), '');
    assert.equal(
        buildVehicleImportIdentityKey('toll', 'a'.repeat(64), -1),
        '',
    );
});

test('source identity wins when a retry produces a different semantic expense id', () => {
    const identityId = 'vehicle_import_same_source';
    const originalExpenseId = 'vehicle_fine_original_reading';
    const changedExpenseId = 'vehicle_fine_changed_ai_reading';

    assert.equal(resolveVehicleImportDuplicateExpenseId({
        expenseId: changedExpenseId,
        identityId,
        existingExpenseIds: new Set(),
        createdExpenseIds: new Set(),
        existingIdentityIds: new Set([identityId]),
        existingIdentityExpenseIds: new Map([[identityId, originalExpenseId]]),
        claimedIdentityExpenseIds: new Map(),
    }), originalExpenseId);

    assert.equal(resolveVehicleImportDuplicateExpenseId({
        expenseId: changedExpenseId,
        identityId,
        existingExpenseIds: new Set(),
        createdExpenseIds: new Set(),
        existingIdentityIds: new Set(),
        existingIdentityExpenseIds: new Map(),
        claimedIdentityExpenseIds: new Map([[identityId, originalExpenseId]]),
    }), originalExpenseId);
});

test('a dangling identity is reclaimable when its linked expense no longer exists', () => {
    const identityId = 'vehicle_import_dangling_source';
    assert.equal(resolveVehicleImportDuplicateExpenseId({
        expenseId: 'vehicle_toll_new_expense',
        identityId,
        existingExpenseIds: new Set(),
        createdExpenseIds: new Set(),
        existingIdentityIds: new Set(),
        existingIdentityExpenseIds: new Map([[identityId, 'missing-expense']]),
        claimedIdentityExpenseIds: new Map(),
    }), '');
});
