import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('deployment discovery and individual team callables retain their guarded trigger metadata', () => {
    const targets = ['teamExpenseRequests', 'teamWorkerRequests', 'getTeamScopedData'];
    for (const target of ['', ...targets]) {
        const child = spawnSync(process.execPath, ['-e', `
            const entry = require('./entry');
            const targets = ${JSON.stringify(targets)};
            const target = process.env.FUNCTION_TARGET;
            const assert = require('node:assert/strict');
            const admin = require('firebase-admin');
            assert.equal(admin.apps.length, 1);
            if (target) {
                assert.deepEqual(Object.keys(entry), [target]);
                assert.ok(!require.cache[require.resolve('./index')]);
            } else {
                for (const name of targets) assert.ok(entry[name]);
                assert.ok(Object.keys(entry).length > targets.length);
            }
            const modules = ['teamExpenseRequests', 'teamWorkerRequests', 'teamScopedRead'];
            for (const name of target ? [target] : targets) {
                const original = require('./' + modules[targets.indexOf(name)])[name];
                assert.notEqual(entry[name], original);
                assert.equal(entry[name].__endpoint, original.__endpoint);
                assert.ok(entry[name].__endpoint.callableTrigger);
            }
        `], {
            cwd: __dirname,
            env: { ...process.env, FUNCTION_TARGET: target, FUNCTION_NAME: '', GCLOUD_PROJECT: 'demo-entry',
                FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-entry', storageBucket: 'demo-entry.appspot.com' }) },
            encoding: 'utf8',
        });
        assert.equal(child.status, 0, child.stderr);
    }
});
