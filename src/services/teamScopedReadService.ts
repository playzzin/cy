import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db, functions } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';

const leaderRoles = new Set(['팀장', '반장', 'teamlead', 'teamleader', 'foreman']);
const roleKey = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s_-]/g, '');
const unrestricted = new Set(['admin', 'administrator', 'superadmin', 'owner', 'dev', 'developer', '관리자', '사장', '실장', 'manager', 'manager1', 'manager2', 'manager3', '매니저', '매니저1', '매니저2', '매니저3', '메니저1', '메니저2', '메니저3']);
const scopedCollections = new Set([
    'workers', 'teams', 'sites', 'companies', 'daily_reports', 'daily_dispatches',
    'schedule_confirmation_boards', 'field_schedule_requests',
    'accommodations', 'accommodationAssignments', 'accommodationUtilityRecords', 'accommodation_billing_documents', 'accommodation_billing_line_items', 'accommodation_billing_targets',
    'vehicles', 'vehicleAssignments', 'vehicleBillingTargets', 'vehicle_billing_documents', 'vehicleExpenses',
    'cards', 'cardAssignments', 'cardBillingTargets', 'cardBillings', 'cardTransactions',
    'team_expense_claims', 'system_configs', 'office_transactions',
    'materials', 'materialInbounds', 'materialOutbounds',
    'advance_payments', 'advance_requests',
]);
const decode = (value: any): any => {
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === 'object') {
        if (typeof value.__teamTimestamp === 'number') return Timestamp.fromMillis(value.__teamTimestamp);
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decode(entry)]));
    }
    return value;
};

// Cache only a positive routing decision briefly, never team or financial rows.
// The callable still checks the current account, links and membership on every
// request. An old decision can only keep using the restricted server endpoint.
let leaderRoute: { user: typeof auth.currentUser; until: number } | null = null;
let pendingProfile: { uid: string; promise: Promise<boolean> } | null = null;
export const usesTeamScopedReads = async (): Promise<boolean> => {
    if (isDevAdminSessionEnabled() || !auth?.currentUser) { leaderRoute = null; return false; }
    const user = auth.currentUser;
    if (leaderRoute?.user === user && leaderRoute.until > Date.now()) return true;
    const uid = auth.currentUser.uid;
    if (pendingProfile?.uid === uid) return pendingProfile.promise;
    const promise = (async () => {
        const profile = (await getDoc(doc(db, 'users', uid))).data();
        if (!profile) return false;
        let roles = ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions']
            .flatMap(field => Array.isArray(profile[field]) ? profile[field] : [profile[field]]);
        if (roles.some(value => unrestricted.has(roleKey(value)))) return false;
        if (!roles.some(value => leaderRoles.has(roleKey(value)))) {
            const menu = (await getDoc(doc(db, 'settings', 'menus_v12'))).data();
            const positions: Array<{ id: string; name: string }> = menu?.admin?.positionConfig || [];
            roles = roles.flatMap(value => [value, positions.find(position => value === position.id || value === `pos_${position.id}`)?.name]);
        }
        if (roles.some(value => unrestricted.has(roleKey(value)))) return false;
        const leader = roles.some(value => leaderRoles.has(roleKey(value)));
        if (leader && auth.currentUser === user) leaderRoute = { user, until: Date.now() + 10_000 };
        return leader;
    })();
    pendingProfile = { uid, promise };
    try { return await promise; } finally { if (pendingProfile?.promise === promise) pendingProfile = null; }
};

// One screen can request more collections than the callable's instance limit.
// Keep only in-flight requests, scoped to the authenticated account, and leave
// room for other tabs/users instead of sending the whole screen at once.
const pendingReads = new Map<string, Promise<unknown[]>>();
let catalogInvalidatedUntil = 0;
export const invalidateTeamScopedCache = () => {
    leaderRoute = null;
    catalogInvalidatedUntil = Date.now() + 30_000;
};
const waitingReads: Array<() => void> = [];
let activeReads = 0;
const withReadSlot = async <T>(read: () => Promise<T>): Promise<T> => {
    await new Promise<void>(resolve => {
        const start = () => { activeReads += 1; resolve(); };
        if (activeReads < 2) start();
        else waitingReads.push(start);
    });
    try { return await read(); } finally {
        activeReads -= 1;
        waitingReads.shift()?.();
    }
};
const assertCurrentAccount = (uid: string | undefined) => {
    if (!uid || auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
};
const transientErrors = new Set(['functions/unavailable', 'functions/resource-exhausted', 'functions/deadline-exceeded', 'functions/internal']);
type ReadRequest = { collection: string; filters: Record<string, unknown> };
type ReadResult = { rows?: unknown[]; error?: { code: string; message: string } };
type QueuedRead = { uid: string | undefined; request: ReadRequest; resolve: (rows: unknown[]) => void; reject: (error: unknown) => void };
let legacyServerUntil = 0;
const rememberLegacyServer = () => { legacyServerUntil = Date.now() + 5 * 60_000; };
const legacyFilters = ({ collection, filters }: ReadRequest) => {
    if (collection !== 'accommodation_billing_line_items') return filters;
    // Old servers try to query yearMonth on line items that have no such field.
    const { yearMonth, ...rest } = filters;
    return rest;
};
const filterLegacyRows = async (item: QueuedRead, rows: unknown[]): Promise<unknown[]> => {
    assertCurrentAccount(item.uid);
    if (item.request.collection === 'accommodation_billing_line_items' && item.request.filters.yearMonth) {
        const documents = await getTeamScopedRows('accommodation_billing_documents', { yearMonth: item.request.filters.yearMonth });
        assertCurrentAccount(item.uid);
        if (documents === null) throw new Error('조회 권한이 변경되었습니다. 다시 조회해 주세요.');
        const ids = new Set(documents.map(row => String(row.id)));
        return rows.filter((row: any) => ids.has(String(row.billingDocumentId || row.billingDocument?.id || '')));
    }
    return rows;
};
const readLegacy = async (item: QueuedRead): Promise<unknown[]> => {
    const rows = await withReadSlot(async () => {
        assertCurrentAccount(item.uid);
        const response = await httpsCallable<ReadRequest, { rows: unknown[] }>(functions, 'getTeamScopedData')({
            collection: item.request.collection, filters: legacyFilters(item.request),
        });
        assertCurrentAccount(item.uid);
        if (!Array.isArray(response.data.rows)) throw new Error('팀 조회 결과가 누락되었습니다.');
        return response.data.rows;
    });
    return filterLegacyRows(item, rows);
};
const completeLegacyRead = (item: QueuedRead) => {
    void readLegacy(item).then(item.resolve, item.reject);
};
let queuedReads: QueuedRead[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
const flushReads = () => {
    flushTimer = undefined;
    const queue = queuedReads;
    queuedReads = [];
    const accounts = new Map<string | undefined, QueuedRead[]>();
    queue.forEach(item => accounts.set(item.uid, [...(accounts.get(item.uid) || []), item]));
    accounts.forEach(items => {
        for (let offset = 0; offset < items.length; offset += 20) {
            const group = items.slice(offset, offset + 20);
            if (legacyServerUntil > Date.now()) {
                group.forEach(completeLegacyRead);
                continue;
            }
            void withReadSlot(async () => {
                const uid = group[0].uid;
                assertCurrentAccount(uid);
                // Both server versions can execute this request. Old servers read
                // the first collection; new servers process the entire batch.
                const response = await httpsCallable<ReadRequest & { requests: ReadRequest[] }, { results?: ReadResult[]; rows?: unknown[] }>(functions, 'getTeamScopedData')({
                    collection: group[0].request.collection,
                    filters: legacyFilters(group[0].request),
                    requests: group.map(item => item.request),
                });
                assertCurrentAccount(uid);
                return response;
            }).then(response => {
                if (!response.data.results && Array.isArray(response.data.rows)) {
                    rememberLegacyServer();
                    void filterLegacyRows(group[0], response.data.rows).then(group[0].resolve, group[0].reject);
                    group.slice(1).forEach(completeLegacyRead);
                    return;
                }
                if (!Array.isArray(response.data.results) || response.data.results.length !== group.length) {
                    throw new Error('팀 조회 응답 형식이 올바르지 않습니다. 서버 업데이트를 확인해 주세요.');
                }
                response.data.results.forEach((result, index) => {
                    if (result.error) group[index].reject(Object.assign(new Error(result.error.message), { code: `functions/${result.error.code}` }));
                    else if (Array.isArray(result.rows)) group[index].resolve(result.rows);
                    else group[index].reject(new Error('팀 조회 결과가 누락되었습니다.'));
                });
            }).catch(error => group.forEach(item => item.reject(error)));
        }
    });
};
const enqueueRead = (uid: string | undefined, request: ReadRequest): Promise<unknown[]> => new Promise((resolve, reject) => {
    queuedReads.push({ uid, request, resolve, reject });
    // Gather parallel service calls from the current screen into one callable.
    if (!flushTimer) flushTimer = setTimeout(flushReads, 10);
});
const requestRows = async (uid: string | undefined, collection: string, filters: Record<string, unknown>): Promise<unknown[]> => {
    for (let attempt = 0; ; attempt += 1) {
        try {
            assertCurrentAccount(uid);
            return await enqueueRead(uid, { collection, filters });
        } catch (error) {
            assertCurrentAccount(uid);
            if (['functions/permission-denied', 'functions/unauthenticated', 'functions/failed-precondition'].includes(String((error as { code?: string })?.code))) leaderRoute = null;
            if (attempt >= 2 || !transientErrors.has(String((error as { code?: string })?.code))) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** attempt) + Math.floor(Math.random() * 250)));
        }
    }
};

export async function getTeamScopedRows<T = any>(collection: string, filters: Record<string, unknown> = {}): Promise<T[] | null> {
    if (!scopedCollections.has(collection)) return null;
    const uid = auth?.currentUser?.uid;
    if (!await usesTeamScopedReads()) return null;
    assertCurrentAccount(uid);
    const effectiveFilters = ['companies', 'materials'].includes(collection) && catalogInvalidatedUntil > Date.now()
        ? { ...filters, bypassCache: true } : filters;
    const normalizedFilters = Object.fromEntries(Object.entries(effectiveFilters).sort(([left], [right]) => left.localeCompare(right)));
    const key = JSON.stringify([uid, collection, normalizedFilters]);
    let pending = pendingReads.get(key);
    if (!pending) {
        pending = requestRows(uid, collection, normalizedFilters);
        pendingReads.set(key, pending);
    }
    try {
        const rows = await pending;
        assertCurrentAccount(uid);
        return decode(rows) as T[];
    } finally {
        if (pendingReads.get(key) === pending) pendingReads.delete(key);
    }
}
