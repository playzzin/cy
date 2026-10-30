import { test, TestContext } from 'node:test';
import * as assert from 'node:assert/strict';
import * as admin from 'firebase-admin';
import { guardDevPreviewEndpoint } from './devPreviewEndpoint';

type Scenario = {
    claims?: Record<string, unknown>;
    actor?: Record<string, unknown>;
    target?: Record<string, unknown>;
    invalidSignature?: boolean;
};

function previewHarness(t: TestContext, scenario: Scenario = {}) {
    const claims = {
        uid: 'cy-preview-synthetic', devPreview: true,
        previewActorUid: 'synthetic-dev', previewTargetUid: 'synthetic-leader',
        previewExpiresAt: Math.floor(Date.now() / 1000) + 600, previewDevRole: 'pos_custom-dev',
        ...scenario.claims,
    };
    // Synthetic unsigned text is only a routing hint. The mocked verifier must
    // succeed before the wrapper may forward the request to the real handler.
    const bearer = `synthetic.${Buffer.from(JSON.stringify({ sub: 'cy-preview-synthetic', devPreview: true })).toString('base64url')}.synthetic`;
    const verifyIdToken = t.mock.fn(async () => {
        if (scenario.invalidSignature) throw new Error('invalid-signature');
        return claims;
    });
    const rows: Record<string, unknown> = {
        'users/synthetic-dev': scenario.actor ?? { status: 'active', position: 'pos_custom-dev' },
        'users/synthetic-leader': scenario.target ?? { status: 'active', position: '팀장' },
        'settings/menus_v12': { admin: { positionConfig: [{ id: 'custom-dev', name: 'DEV' }] } },
    };
    const getAll = t.mock.fn(async (...paths: string[]) => paths.map(path => ({ data: () => rows[path] })));
    t.mock.getter(admin as any, 'auth', () => () => ({ verifyIdToken }));
    t.mock.getter(admin as any, 'firestore', () => () => ({ doc: (path: string) => path, getAll }));
    const endpoint = Object.assign(t.mock.fn(async () => 'forwarded'), { __endpoint: { callableTrigger: {} } });
    const guarded = guardDevPreviewEndpoint('supportTeamDocuments', endpoint);
    const response: any = {};
    response.set = t.mock.fn(() => response);
    response.status = t.mock.fn(() => response);
    response.json = t.mock.fn(() => response);
    const invoke = (action: string) => (guarded as any)({
        headers: { authorization: `Bearer ${bearer}`, origin: 'http://localhost:3000' },
        body: { data: { action, workerId: 'synthetic-worker', kind: 'identity' } },
    }, response);
    return { invoke, endpoint, guarded, response, verifyIdToken, getAll, bearer };
}

for (const action of ['list', 'read']) {
    test(`valid CEO preview forwards document ${action}`, async t => {
        const fixture = previewHarness(t, { actor: { status: 'active', position: 'CEO' }, claims: { previewDevRole: 'CEO' } });
        assert.equal(await fixture.invoke(action), 'forwarded');
        assert.equal(fixture.endpoint.mock.callCount(), 1);
    });
    test(`valid DEV preview forwards document ${action} after checking current memberships`, async t => {
        const fixture = previewHarness(t);
        assert.equal(await fixture.invoke(action), 'forwarded');
        assert.equal(fixture.endpoint.mock.callCount(), 1);
        assert.deepEqual(fixture.verifyIdToken.mock.calls[0].arguments, [fixture.bearer, true]);
        assert.deepEqual(fixture.getAll.mock.calls[0].arguments,
            ['users/synthetic-dev', 'users/synthetic-leader', 'settings/menus_v12']);
        assert.equal(fixture.response.status.mock.callCount(), 0);
        assert.equal((fixture.guarded as any).__endpoint, fixture.endpoint.__endpoint);
    });
}

for (const action of ['save', 'unknown']) {
    test(`document preview rejects ${action} without invoking the handler`, async t => {
        const fixture = previewHarness(t, { actor: { status: 'active', position: 'CEO' }, claims: { previewDevRole: 'CEO' } });
        await fixture.invoke(action);
        assert.equal(fixture.endpoint.mock.callCount(), 0);
        assert.equal(fixture.getAll.mock.callCount(), 0);
        assert.equal(fixture.response.status.mock.calls[0].arguments[0], 403);
        assert.equal(fixture.response.json.mock.calls[0].arguments[0].error.status, 'PERMISSION_DENIED');
    });
}

const revokedScenarios: Array<[string, Scenario]> = [
    ['invalid signature', { invalidSignature: true }],
    ['expired claims', { claims: { previewExpiresAt: Math.floor(Date.now() / 1000) - 60 } }],
    ['non-preview actor', { actor: { status: 'active', position: '팀장' } }],
    ['inactive DEV actor', { actor: { status: 'suspended', position: 'DEV' } }],
    ['inactive CEO actor', { actor: { status: 'suspended', position: 'CEO' }, claims: { previewDevRole: 'CEO' } }],
    ['revoked CEO membership', { actor: { status: 'active', position: '팀장' }, claims: { previewDevRole: 'CEO' } }],
    ['inactive target', { target: { status: 'suspended', position: '팀장' } }],
];
for (const [name, scenario] of revokedScenarios) {
    test(`document preview rejects ${name} before forwarding`, async t => {
        const fixture = previewHarness(t, scenario);
        await fixture.invoke('read');
        assert.equal(fixture.endpoint.mock.callCount(), 0);
        assert.equal(fixture.response.status.mock.calls[0].arguments[0], 403);
        assert.equal(fixture.response.json.mock.calls[0].arguments[0].error.status, 'PERMISSION_DENIED');
    });
}
