import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-cy-manager-claims' });
const { getRoleGroups } = require('./roleClaims') as typeof import('./roleClaims');

test('통합 매니저는 현장·지원 권한을 유지하고 관리자 권한을 얻지 않는다', () => {
    for (const role of ['매니저', 'manager']) {
        assert.deepEqual(getRoleGroups([role]), ['site', 'support']);
    }
    assert.deepEqual(getRoleGroups(['user']), ['user']);
    assert.ok(getRoleGroups(['admin', '매니저']).includes('admin'));
});
