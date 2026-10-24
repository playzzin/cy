import { getDocs, query, where } from 'firebase/firestore';
import { accountLinkService } from './accountLinkService';
import { manpowerService, Worker } from './manpowerService';
import { officeStaffService, OfficeStaff } from './officeStaffService';
import { workerFirestoreService } from './workerFirestoreService';
import type { UserData } from './userService';
import type { AccountLink } from '../types/accountLink';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { devWorkers, devOfficeStaff } from '../utils/devAdminFixtures';

export interface ProfileConnections {
    workers: Worker[];
    officeStaff: OfficeStaff[];
    links: AccountLink[];
    unavailable: string[];
}

type RecordIdentity = { id?: string; legacyId?: string | null; name: string; uid?: string | null };
const uniqueIds = (ids: unknown[]): string[] => Array.from(new Set(ids.map(id => String(id ?? '').trim()).filter(Boolean)));

async function loadLinkedRecords<T extends RecordIdentity>(
    ids: string[],
    readOwn: () => Promise<T[]>,
    readId: (id: string) => Promise<T | null>,
    readLegacyId: (id: string) => Promise<T[]>,
): Promise<{ rows: T[]; incomplete: boolean }> {
    const rows = new Map<string, T>();
    let incomplete = false;
    const add = (row: T) => { if (row.id) rows.set(row.id, row); };
    try { (await readOwn()).forEach(add); } catch { incomplete = true; }
    const known = new Set(Array.from(rows.values()).flatMap(row => [row.id, row.legacyId]));
    const unresolved = ids.filter(id => !known.has(id));
    // Bound concurrent reads; never fall back to a full employee collection.
    for (let offset = 0; offset < unresolved.length; offset += 8) {
        const results = await Promise.allSettled(unresolved.slice(offset, offset + 8).map(async id => {
            const direct = await readId(id);
            return direct ? [direct] : readLegacyId(id);
        }));
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.length > 0) result.value.forEach(add);
            else incomplete = true;
        }
    }
    return { rows: Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')), incomplete };
}

export const profileConnectionService = {
    async load(user: UserData): Promise<ProfileConnections> {
        const unavailable: string[] = [];
        const development = isDevAdminSessionEnabled();
        let links: AccountLink[] = [];
        if (!development) {
            try { links = (await accountLinkService.getLinksByUid(user.uid)).filter(link => link.uid === user.uid); }
            catch { unavailable.push('계정 연결 상태'); }
        }
        const activeLinks = links.filter(link => link.status === 'active');
        const workerIds = uniqueIds([
            ...(user.linkedWorkerIds || []),
            ...activeLinks.filter(link => link.entityType === 'worker').map(link => link.entityId),
        ]);
        const officeIds = uniqueIds([
            ...(user.linkedOfficeStaffIds || []),
            ...activeLinks.filter(link => link.entityType === 'office' && link.entityId !== 'office').map(link => link.entityId),
        ]);
        const needsWorkers = workerIds.length > 0 || user.accountType === 'worker' || !user.accountType;
        const needsOffice = officeIds.length > 0 || user.accountType === 'office';
        const [workers, officeStaff] = await Promise.all([
            needsWorkers ? loadLinkedRecords<Worker>(workerIds,
                async () => development ? devWorkers.filter(row => row.uid === user.uid) :
                    (await getDocs(query(workerFirestoreService.getCollection(), where('uid', '==', user.uid)))).docs.map(doc => doc.data() as Worker),
                id => manpowerService.getWorker(id),
                async id => development ? devWorkers.filter(row => row.legacyId === id) :
                    (await getDocs(query(workerFirestoreService.getCollection(), where('legacyId', '==', id)))).docs.map(doc => doc.data() as Worker),
            ) : Promise.resolve({ rows: [] as Worker[], incomplete: false }),
            needsOffice ? loadLinkedRecords<OfficeStaff>(officeIds,
                async () => development ? devOfficeStaff.filter(row => row.uid === user.uid) :
                    (await getDocs(query(officeStaffService.getCollection(), where('uid', '==', user.uid)))).docs.map(doc => doc.data()),
                id => officeStaffService.getOfficeStaffMember(id),
                async id => development ? devOfficeStaff.filter(row => row.legacyId === id) :
                    (await getDocs(query(officeStaffService.getCollection(), where('legacyId', '==', id)))).docs.map(doc => doc.data()),
            ) : Promise.resolve({ rows: [] as OfficeStaff[], incomplete: false }),
        ]);
        if (workers.incomplete) unavailable.push('작업자 상세 정보');
        if (officeStaff.incomplete) unavailable.push('사무실 직원 상세 정보');
        return { workers: workers.rows, officeStaff: officeStaff.rows, links, unavailable };
    },
};
