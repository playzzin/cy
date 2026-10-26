import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { handleSupportTeamDocuments } from './supportTeamDocuments';
import { bankPhotoPath } from './workerBankPhotos';

test('팀장은 지원 이력 없이 명단의 타팀 서류를 읽으며 일반 계정·목록 밖 인원은 차단한다',
    { skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST }, async () => {
        assert.equal(process.env.GCLOUD_PROJECT, 'demo-support-documents');
        const app = admin.initializeApp({ projectId: 'demo-support-documents', storageBucket: 'demo-support-documents.appspot.com' });
        const db = app.firestore(), bucket = app.storage().bucket();
        const photoId = 'a'.repeat(32), directId = 'b'.repeat(32);
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
        const fixtures = {
            'users/leader': { status: 'active', position: 'pos_lead', linkedWorkerIds: ['own-leader'] },
            'users/ordinary': { status: 'active', role: 'user', linkedWorkerIds: ['own-leader'] },
            'users/unlinked': { status: 'active', position: '팀장' },
            'settings/menus_v12': { admin: { positionConfig: [{ id: 'lead', name: '팀장' }] } },
            'companies/company': { name: '가상 회사', legacyId: 'company-old' },
            'companies/outside': { name: '다른 회사' },
            'teams/own': { name: '내 팀', legacyId: 'own-old', leaderId: 'own-leader', companyId: 'company' },
            'teams/guest': { name: '다른 팀', leaderId: 'guest-leader', companyId: 'company-old' },
            'teams/outside': { name: '외부 팀', companyId: 'outside', companyName: '가상 회사' },
            'workers/own-leader': { name: '가상 내 팀장', teamId: 'own-old', role: '팀장' },
            'workers/guest': { name: '가상 지원자', legacyId: 'guest-old', teamId: 'guest', fileNameSaved: 'id_cards/support-test.png', bankPhotoId: photoId, directPayBankPhotoId: directId, idNumber: 'PRIVATE-NUMBER' },
            'workers/guest-leader': { name: '가상 방문 팀장', teamId: 'guest' },
            'workers/absent': { name: '미투입 인원', teamId: 'guest', bankPhotoId: photoId },
            'workers/outside': { name: '다른 회사 인원', teamId: 'outside', bankPhotoId: photoId },
            'workers/retired': { name: '퇴사 인원', teamId: 'guest', status: '퇴사', bankPhotoId: photoId },
        };
        // No sites or daily reports: permissions must not require attendance.
        const call = (input: any, uid = 'leader') => handleSupportTeamDocuments(input, { auth: { uid, token: {} } } as any);
        const denied = (code: string) => (error: any) => error.code === code;
        try {
            for (const [path, row] of Object.entries(fixtures)) await db.doc(path).set(row);
            for (const path of ['id_cards/support-test.png', bankPhotoPath('guest', photoId), bankPhotoPath('guest', directId, true), bankPhotoPath('absent', photoId)]) {
                await bucket.file(path).save(png, { resumable: false, metadata: { contentType: 'image/png' } });
            }
            await assert.rejects(handleSupportTeamDocuments({ action: 'list' }, {} as any), denied('unauthenticated'));
            await assert.rejects(call({ action: 'list' }, 'ordinary'), denied('permission-denied'));
            await assert.rejects(call({ action: 'list' }, 'unlinked'), denied('permission-denied'));
            await assert.rejects(call({ action: 'save', workerId: 'guest' }), denied('invalid-argument'));
            const directory = await call({ action: 'list' });
            assert.deepEqual((directory as any).workers.map((worker: any) => worker.id).sort(), ['absent', 'guest', 'guest-leader', 'own-leader']);
            assert.deepEqual(await call({ action: 'list', yearMonth: '2026-09', siteId: 'not-visited', companyId: 'outside', teamId: 'outside' }), directory);
            assert(!JSON.stringify(directory).includes('PRIVATE-NUMBER'));
            assert(!JSON.stringify(directory).includes('id_cards'));
            for (const kind of ['identity', 'bank', 'directPayBank']) {
                const result = await call({ action: 'read', workerId: 'guest', kind }) as any;
                assert.equal(result.photo.base64, png.toString('base64'));
                assert.equal(result.photo.contentType, 'image/png');
            }
            assert.deepEqual(await call({ action: 'read', workerId: 'guest-leader', kind: 'bank' }), { photo: null });
            assert.equal((await call({ action: 'read', workerId: 'absent', kind: 'bank' }) as any).photo.base64, png.toString('base64'));
            for (const workerId of ['outside', 'retired']) await assert.rejects(call({ action: 'read', workerId, kind: 'bank' }), denied('permission-denied'));
            await db.doc('workers/guest').update({ fileNameSaved: bankPhotoPath('guest', photoId) });
            await assert.rejects(call({ action: 'read', workerId: 'guest', kind: 'identity' }), denied('failed-precondition'));
            await db.doc('workers/guest').update({ fileNameSaved: 'id_cards/support-test.png' });
            await db.doc('teams/guest').update({ companyId: 'outside' });
            await assert.rejects(call({ action: 'read', workerId: 'guest', kind: 'identity' }), denied('permission-denied'));
            await db.doc('users/leader').update({ status: 'suspended' });
            await assert.rejects(call({ action: 'list' }), denied('permission-denied'));
        } finally { await app.delete(); }
    });
