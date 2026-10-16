import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { protectedRegion, requireCallableAuth } from './auth';
import { isPreviewIdentity } from './devPreviewPolicy';
import { resolvedRoleNames } from './teamExpenseRequests';
import { isTeamLeader, text } from './teamReadPolicy';

const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const id = (value: unknown): string => {
    const result = text(value);
    if (!result || result.length > 200 || result.includes('/') || result === '.' || result === '..') fail('invalid-argument', '자재 또는 현장 정보를 확인해 주세요.');
    return result;
};
const date = (value: unknown): string => {
    const result = text(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) fail('invalid-argument', '입출고 일자를 확인해 주세요.');
    return result;
};
const number = (value: unknown, positive = false): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value === 0) || value > 1e12) fail('invalid-argument', '수량과 금액을 확인해 주세요.');
    return value as number;
};
const strings = ['materialKey', 'itemName', 'category', 'spec', 'unit', 'vehicleNumber', 'supplier', 'recipient', 'recipientPhone', 'rentalCompanyId', 'rentalCompanyName', 'invoiceNumber', 'notes', 'remarks', 'deliveryStatus'];
export function normalizeTeamMaterialTransaction(raw: any, direction: string) {
    if (!raw || typeof raw !== 'object') return fail('invalid-argument', '입출고 내용을 확인해 주세요.');
    const row: Record<string, any> = { id: id(raw.id), siteId: id(raw.siteId), materialId: id(raw.materialId), transactionDate: date(raw.transactionDate), quantity: number(raw.quantity, true) };
    for (const field of strings) if (raw[field] !== undefined) {
        if (typeof raw[field] !== 'string' || raw[field].length > 2000) fail('invalid-argument', '입력 내용이 너무 깁니다.');
        row[field] = raw[field].trim();
    }
    if (!row.itemName) fail('invalid-argument', '자재명을 확인해 주세요.');
    if (raw.deliveryStatus && !['pending', 'in-transit', 'delivered'].includes(raw.deliveryStatus)) fail('invalid-argument', '배송 상태를 확인해 주세요.');
    if (direction === 'inbound') { row.unitPrice = number(raw.unitPrice ?? 0); row.amount = number(row.quantity * row.unitPrice); }
    if (raw.photoBatchId) row.photoBatchId = id(raw.photoBatchId);
    return row;
}

async function currentTeamActor(tx: FirebaseFirestore.Transaction, uid: string, db: FirebaseFirestore.Firestore) {
    const [profile, menu] = await tx.getAll(db.doc('users/' + uid), db.doc('settings/menus_v12'));
    const user = profile.data();
    if (user?.status !== 'active' || !resolvedRoleNames(user, menu.data()).some(isTeamLeader)) fail('permission-denied', '활성 팀장 계정이 필요합니다.');
    const links: string[] = [...new Set<string>((Array.isArray(user!.linkedWorkerIds) ? user!.linkedWorkerIds : []).map(id))];
    if (!links.length || links.length > 30) fail('permission-denied', '팀장 작업자 연결을 확인해 주세요.');
    const workers = await tx.getAll(...links.map(link => db.collection('workers').doc(link)));
    const teamIds: string[] = [...new Set(workers.filter(worker => worker.exists && worker.data()?.isActive !== false && !['퇴사', 'inactive', 'retired', 'archived'].includes(text(worker.data()?.status)))
        .map(worker => text(worker.data()?.teamId)).filter(Boolean))];
    if (!teamIds.length) fail('permission-denied', '담당 팀을 확인해 주세요.');
    const docs = await tx.getAll(...teamIds.map(teamId => db.collection('teams').doc(id(teamId))));
    const legacy = await tx.get(db.collection('teams').where('legacyId', 'in', teamIds));
    const teams = [...docs, ...legacy.docs].filter(team => team.exists && team.data()?.isActive !== false);
    return { uid, name: text(user!.displayName || user!.name) || '팀장', teamIds: new Set(teams.flatMap(team => [team.id, text(team.data()?.legacyId)]).filter(Boolean)) };
}
function checkSite(site: FirebaseFirestore.DocumentSnapshot, teamIds: Set<string>) {
    const data = site.data();
    const owner = text(data?.responsibleTeamId ?? data?.responsibleTeam?.id ?? data?.teamId ?? data?.team?.id);
    if (!site.exists || !owner || !teamIds.has(owner)) fail('permission-denied', '담당 현장의 입출고만 등록·수정할 수 있습니다.');
    return data!;
}

export async function saveTeamMaterialTransactions(input: any, context: functions.https.CallableContext) {
    if (isPreviewIdentity(context.auth?.uid, context.auth?.token || {})) fail('permission-denied', '미리보기에서는 저장할 수 없습니다.');
    const auth = requireCallableAuth(context)!;
    const direction = text(input?.direction);
    if (!['inbound', 'outbound'].includes(direction) || !Array.isArray(input?.transactions) || !input.transactions.length || input.transactions.length > 200) fail('invalid-argument', '입출고는 한 번에 200건까지 저장할 수 있습니다.');
    const rows: Record<string, any>[] = input.transactions.map((row: any) => normalizeTeamMaterialTransaction(row, direction));
    if (new Set(rows.map(row => row.id)).size !== rows.length) fail('invalid-argument', '중복된 입출고입니다.');
    const db = admin.firestore();
    const collection = direction === 'inbound' ? 'materialInbounds' : 'materialOutbounds';
    return db.runTransaction(async tx => {
        const actor = await currentTeamActor(tx, auth.uid, db);
        const existing = await tx.getAll(...rows.map(row => db.collection(collection).doc(row.id)));
        const siteIds = [...new Set([...rows.map(row => row.siteId), ...existing.filter(doc => doc.exists).map(doc => id(doc.data()?.siteId))])];
        const sites = await tx.getAll(...siteIds.map(siteId => db.collection('sites').doc(siteId)));
        const siteData = new Map(sites.map(site => [site.id, checkSite(site, actor.teamIds)]));
        rows.forEach((row, index) => { if (!row.photoBatchId && existing[index].data()?.photoBatchId) row.photoBatchId = existing[index].data()!.photoBatchId; });
        const photoIds: string[] = [...new Set(rows.map(row => text(row.photoBatchId)).filter(Boolean))];
        const photoDocs = photoIds.length ? await tx.getAll(...photoIds.map(photoId => db.collection('materialPhotoBatches').doc(photoId))) : [];
        const photos = new Map(photoDocs.filter(doc => doc.exists).map(doc => [doc.id, doc.data()!]));
        const now = Timestamp.now();
        let newPhoto: any = null;
        if (input.photoBatch) {
            const batch = input.photoBatch;
            const photoId = id(batch.id), siteId = id(batch.siteId), transactionDate = date(batch.transactionDate);
            if (!photoIds.includes(photoId) || photos.has(photoId) || !siteData.has(siteId) || batch.transactionType !== direction || !Array.isArray(batch.photos) || !batch.photos.length || batch.photos.length > 40) fail('invalid-argument', '사진 묶음 정보를 확인해 주세요.');
            const prefix = ['materials', direction, transactionDate, siteId, ''].join('/');
            const files = batch.photos.map((photo: any) => {
                const path = text(photo.path);
                if (!path.startsWith(prefix) || path.length > 1000 || path.includes('..') || path.slice(prefix.length).includes('/')) fail('permission-denied', '담당 현장에 업로드한 사진만 첨부할 수 있습니다.');
                return { path, name: text(photo.name).slice(0, 200), contentType: text(photo.contentType).slice(0, 100), size: number(photo.size ?? 0) };
            });
            newPhoto = { id: photoId, siteId, transactionDate, transactionType: direction, photos: files, photoCount: files.length, createdBy: actor.uid, createdByName: actor.name, createdAt: now, updatedAt: now };
            photos.set(photoId, newPhoto);
        }
        // All authorization and previous records are read before any write.
        const writes = rows.map((row, index) => {
            const before = existing[index].data();
            if (row.photoBatchId) {
                const photo = photos.get(row.photoBatchId);
                if (!photo || photo.siteId !== row.siteId || photo.transactionType !== direction) fail('permission-denied', '사진과 담당 현장이 일치하지 않습니다.');
                row.photoCount = photo.photoCount;
            }
            if (before?.photoBatchId && !row.photoBatchId) { row.photoBatchId = before.photoBatchId; row.photoCount = before.photoCount || 0; }
            if (before?.photoUrls) row.photoUrls = before.photoUrls;
            const after: Record<string, any> = { ...row, siteName: text(siteData.get(row.siteId)?.name), registeredBy: before?.registeredBy || actor.uid,
                registeredByName: before?.registeredByName || actor.name, createdAt: before?.createdAt || now, updatedAt: now, updatedBy: actor.uid };
            return { before, after, ref: existing[index].ref };
        });
        if (newPhoto) tx.create(db.collection('materialPhotoBatches').doc(newPhoto.id), newPhoto);
        for (const { before, after, ref } of writes) {
            tx.set(ref, after, { merge: true });
            const log = db.collection('material_logs').doc();
            const action = before ? 'updated' : 'created';
            const changes = before ? Object.keys(after).filter(key => !['createdAt', 'updatedAt', 'updatedBy'].includes(key) && JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)).map(field => ({ field, label: field, before: before[field] ?? null, after: after[field] ?? null })) : [];
            const summary = (direction === 'inbound' ? '입고' : '출고') + ' ' + (before ? '수정' : '등록') + ': ' + after.itemName;
            tx.create(log, { id: log.id, action, actionLabel: before ? '수정' : '등록', entityType: direction, entityLabel: direction === 'inbound' ? '입고' : '출고', entityId: ref.id,
                materialId: after.materialId, materialName: after.itemName, siteId: after.siteId, siteName: after.siteName, transactionDate: after.transactionDate, quantity: after.quantity,
                actor: { uid: actor.uid, name: actor.name, email: null }, source: 'teamMaterialTransactions', before: before || null, after, fieldChanges: changes,
                summaryLines: [summary], summaryText: summary, changeCount: before ? changes.length : 1, createdAt: now, createdAtIso: now.toDate().toISOString() });
        }
        return { saved: writes.length };
    });
}

export const teamMaterialTransactions = protectedRegion.https.onCall(saveTeamMaterialTransactions);
