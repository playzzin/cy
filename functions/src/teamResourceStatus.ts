import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { protectedRegion, requireCallableAuth } from './auth';
import { isPreviewIdentity } from './devPreviewPolicy';
import { resolvedRoleNames } from './teamExpenseRequests';
import { isTeamLeader, text } from './teamReadPolicy';

const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const validId = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value === value.trim() && value.length <= 200 && !value.includes('/') && !['.', '..'].includes(value);
const activeWorker = (row: any) => row && row.isActive !== false && !/퇴사|출입금지/.test(text(row.status))
    && !['inactive', 'retired', 'resigned', 'archived', 'blocked'].includes(text(row.status).toLowerCase());

const validEmploymentDate = (value: unknown) => typeof value === 'string' && (!value || (/^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value));

export function workerEmploymentPatch(before: any, input: any, today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())) {
    const joinDate = input.joinDate ?? before.joinDate ?? '';
    const retirementDate = input.status === '퇴사'
        ? input.retirementDate ?? (before.retirementDate || (activeWorker(before) ? today : '')) : '';
    if (!validEmploymentDate(joinDate) || !validEmploymentDate(retirementDate)
        || (input.status === '퇴사' && input.retirementDate === '')
        || (joinDate && retirementDate && joinDate > retirementDate)) {
        fail('invalid-argument', '입사일과 퇴사일을 확인해 주세요. 퇴사일은 입사일보다 빠를 수 없습니다.');
    }
    return { status: input.status, isActive: input.status === '재직', joinDate, retirementDate };
}

export async function saveTeamResourceStatus(input: any, context: functions.https.CallableContext) {
    if (isPreviewIdentity(context.auth?.uid, context.auth?.token || {})) fail('permission-denied', '미리보기에서는 상태를 변경할 수 없습니다.');
    const auth = requireCallableAuth(context)!;
    const kind = input?.kind;
    if (!['site', 'worker'].includes(kind) || !validId(input?.id)
        || !(kind === 'site' ? ['active', 'completed'] : ['재직', '퇴사']).includes(input?.status)
        || !(input.expectedStatus === null || typeof input.expectedStatus === 'string')
        || !(input.expectedIsActive === null || typeof input.expectedIsActive === 'boolean')) {
        fail('invalid-argument', '대상과 변경할 상태를 확인해 주세요.');
    }
    const db = admin.firestore();
    return db.runTransaction(async tx => {
        const [profile, menu] = await tx.getAll(db.doc(`users/${auth.uid}`), db.doc('settings/menus_v12'));
        const user = profile.data();
        if (user?.status !== 'active' || !resolvedRoleNames(user, menu.data()).some(isTeamLeader)) fail('permission-denied', '활성 팀장 계정이 필요합니다.');
        const links: unknown[] = [...new Set(Array.isArray(user!.linkedWorkerIds) ? user!.linkedWorkerIds : [])];
        if (!links.length || links.length > 30 || !links.every(validId)) fail('permission-denied', '팀장 작업자 연결을 확인해 주세요.');
        const anchors = (await tx.getAll(...(links as string[]).map(id => db.collection('workers').doc(id))))
            .filter(doc => doc.exists && activeWorker(doc.data()));
        const teamIds = [...new Set(anchors.map(doc => text(doc.data()?.teamId)).filter(Boolean))];
        if (!teamIds.length || !teamIds.every(validId)) fail('permission-denied', '현재 소속 팀을 확인해 주세요.');
        const direct = await tx.getAll(...teamIds.map(id => db.collection('teams').doc(id)));
        const legacy = await tx.get(db.collection('teams').where('legacyId', 'in', teamIds));
        const allowedTeams = new Set([...direct, ...legacy.docs].filter(doc => doc.exists && doc.data()?.isActive !== false)
            .flatMap(doc => [doc.id, text(doc.data()?.legacyId)]).filter(Boolean));
        const ref = db.collection(kind === 'site' ? 'sites' : 'workers').doc(input.id);
        const snapshot = await tx.get(ref);
        const before = snapshot.data();
        // Participation in another team's site or matching a team name never grants write access.
        const owner = kind === 'site' ? text(before?.responsibleTeamId ?? before?.responsibleTeam?.id ?? before?.teamId ?? before?.team?.id) : text(before?.teamId);
        if (!before || !allowedTeams.has(owner)) fail('permission-denied', '담당 현장 또는 현재 소속 팀원만 상태를 변경할 수 있습니다.');
        if (kind === 'worker' && (/출입금지/.test(text(before!.status)) || ['blocked', 'archived'].includes(text(before!.status).toLowerCase()))) {
            fail('permission-denied', '출입금지·보관 상태는 사무실에서 변경해 주세요.');
        }
        if ((before!.status ?? null) !== input.expectedStatus || (kind === 'worker' && (before!.isActive ?? null) !== input.expectedIsActive)) {
            fail('failed-precondition', '다른 사용자가 상태를 변경했습니다. 새로고침 후 다시 확인해 주세요.');
        }
        if (kind === 'worker' && (('expectedJoinDate' in input && (before!.joinDate ?? null) !== input.expectedJoinDate)
            || ('expectedRetirementDate' in input && (before!.retirementDate ?? null) !== input.expectedRetirementDate))) {
            fail('failed-precondition', '다른 사용자가 재직 기간을 변경했습니다. 새로고침 후 다시 확인해 주세요.');
        }
        if (kind === 'worker' && input.status === '퇴사' && anchors.some(doc => doc.id === ref.id)
            && !anchors.some(doc => doc.id !== ref.id && allowedTeams.has(text(doc.data()?.teamId)))) {
            fail('failed-precondition', '팀장 본인의 퇴사 처리는 사무실에 요청해 주세요. 팀장 계정의 마지막 재직 연결은 유지해야 합니다.');
        }
        const patch = kind === 'worker' ? workerEmploymentPatch(before, input) : { status: input.status };
        const result = { id: ref.id, ...patch };
        if (Object.entries(patch).every(([key, value]) => before![key] === value)) return result;
        const now = Timestamp.now();
        tx.update(ref, { ...patch, updatedAt: now });
        // Only status and employment dates belong in this audit payload.
        const log = db.collection('database_logs').doc();
        const fieldChanges = Object.entries(patch).filter(([key, value]) => before![key] !== value)
            .map(([field, after]) => ({ field, label: ({ status: '상태', isActive: '사용 여부', joinDate: '입사일', retirementDate: '퇴사일' } as Record<string, string>)[field], before: before![field] ?? null, after }));
        const summary = `${kind === 'site' ? '현장' : '작업자'} 상태 변경: ${text(before!.name)} → ${input.status}`;
        tx.create(log, { id: log.id, action: 'updated', actionLabel: '수정', entityType: kind, entityLabel: kind === 'site' ? '현장' : '작업자',
            entityId: ref.id, entityName: text(before!.name), actor: { uid: auth.uid, name: text(user!.displayName || user!.name) || '팀장', email: null },
            source: 'teamResourceStatus', before: Object.fromEntries(Object.keys(patch).map(key => [key, before![key] ?? null])),
            after: patch, fieldChanges, changeCount: fieldChanges.length, summaryLines: [summary], summaryText: summary, createdAt: now, createdAtIso: now.toDate().toISOString() });
        return result;
    });
}

// Preserve the deployed memory allocation when publishing this endpoint.
export const updateTeamResourceStatus = protectedRegion.runWith({ memory: '1GB' }).https.onCall(saveTeamResourceStatus);
