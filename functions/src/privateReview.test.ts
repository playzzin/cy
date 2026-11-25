import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as admin from 'firebase-admin';
import { OAuth2Client } from 'google-auth-library';
import { privateReviewSession } from './privateReview';

const allowedEmail = 'reviewer@example.test';
const user = { uid: 'original-uid', email: allowedEmail, emailVerified: true, disabled: false };
for (const [label, expected, override] of [
    ['approved reviewer', 200, {}],
    ['other reviewer', 403, { email: 'other@example.test' }],
    ['unverified ERP email', 403, { verified: false }],
    ['disabled Firebase user', 403, { disabled: true }],
    ['suspended ERP user', 403, { status: 'suspended' }],
    ['signed for another audience', 403, { invalid: true }],
    ['missing assertion', 403, { missing: true }],
    ['no registered position', 403, { position: 'unknown' }],
] as [string, number, Record<string, any>][]) {
    test('private review issuer: ' + label, async (t) => {
        const env = ['GCLOUD_PROJECT', 'CY_REVIEW_IAP_AUDIENCE', 'CY_REVIEW_EMAIL'].map((key) => [
            key,
            process.env[key],
        ]);
        Object.assign(process.env, {
            GCLOUD_PROJECT: 'cyee-9c1e4',
            CY_REVIEW_IAP_AUDIENCE: 'fixture-audience',
            CY_REVIEW_EMAIL: allowedEmail,
        });
        t.after(() => {
            for (const [key, value] of env) {
                if (value === undefined) delete process.env[key!];
                else process.env[key!] = value;
            }
        });
        t.mock.method(OAuth2Client.prototype, 'getIapPublicKeys', async () => ({ pubkeys: {} }));
        t.mock.method(
            OAuth2Client.prototype,
            'verifySignedJwtWithCertsAsync',
            async (jwt, _keys, audience, issuers) => {
                assert.equal(jwt, 'fixture-assertion');
                assert.equal(audience, 'fixture-audience');
                assert.deepEqual(issuers, ['https://cloud.google.com/iap']);
                if (override.invalid) throw new Error('invalid');
                return { getPayload: () => ({ sub: 'fixture-sub', email: override.email || allowedEmail }) };
            },
        );
        const mint = t.mock.fn(async (_uid: string, _claims: any) => 'fixture-readonly-token');
        t.mock.getter(admin as any, 'auth', () => () => ({
            getUserByEmail: async (email: string) => {
                assert.equal(email, allowedEmail);
                return { ...user, disabled: !!override.disabled, emailVerified: override.verified !== false };
            },
            createCustomToken: mint,
        }));
        t.mock.getter(admin as any, 'firestore', () => () => ({
            doc: (p: string) => p,
            getAll: async (...paths: string[]) => {
                assert.deepEqual(paths, ['users/original-uid', 'settings/menus_v12']);
                return [
                    {
                        data: () => ({
                            status: override.status || 'active',
                            position: override.position || '팀장',
                        }),
                    },
                    { data: () => ({ admin: { positionConfig: [{ id: 'lead', name: '팀장' }] } }) },
                ];
            },
        }));
        let status = 0;
        let payload: any;
        const req: any = {
            method: 'POST',
            get: () => (override.missing ? undefined : 'fixture-assertion'),
            body: { targetUid: 'another-user' },
        };
        const res: any = {
            set: () => {},
            sendStatus: (n: number) => {
                status = n;
            },
            json: (v: any) => {
                status = 200;
                payload = v;
            },
        };
        await privateReviewSession(req, res);
        assert.equal(status, expected);
        assert.equal(mint.mock.callCount(), expected === 200 ? 1 : 0);
        if (payload) {
            const [uid, claims] = mint.mock.calls[0].arguments;
            assert.match(uid, /^cy-preview-self-/);
            assert.equal(claims.previewSelf, true);
            assert.equal(claims.previewActorUid, user.uid);
            assert.equal(claims.previewTargetUid, user.uid);
            assert.equal(payload.target.uid, user.uid);
            assert.equal(payload.positionId, 'lead');
        }
    });
}
