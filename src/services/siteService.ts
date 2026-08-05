import { siteFirestoreService } from './siteFirestoreService';
import { databaseLogService } from './databaseLogService';
import { SiteZod as Site } from '../types/zod/siteSchema';
import { db } from '../config/firebase';
import { doc, updateDoc, arrayUnion, Timestamp, collection, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';

export type { Site };

const SITE_LIST_CACHE_TTL_MS = 60 * 1000;
let siteListCache: { rows: Site[]; expiresAt: number } | null = null;

const clearSiteListCache = () => {
    siteListCache = null;
};

const snapshotRecord = (id: string, data: Record<string, unknown>): Record<string, unknown> => ({
    id,
    ...stripUndefinedFields(data),
});

const logDatabaseChange = async (
    action: 'created' | 'updated' | 'deleted',
    entityType: 'site' | 'company',
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    source = 'siteService'
): Promise<void> => {
    await databaseLogService.safeCreateLog({
        action,
        entityType,
        before,
        after,
        source,
    });
};

export const siteService = {
    addSite: async (site: Partial<Site> & Pick<Site, 'name' | 'code' | 'address' | 'status'>): Promise<string> => {
        const id = await siteFirestoreService.addSite(site as any);
        clearSiteListCache();
        await logDatabaseChange('created', 'site', null, snapshotRecord(id, site as Record<string, unknown>), 'siteService.addSite');

        // Sync: Add Site ID to Client Company (발주사) if selected
        if (site.clientCompanyId) {
            try {
                const clientCompanyRef = doc(db, 'companies', site.clientCompanyId);
                const beforeSnap = await getDoc(clientCompanyRef);
                const beforeCompany = beforeSnap.exists() ? snapshotRecord(beforeSnap.id, beforeSnap.data()) : null;
                await updateDoc(clientCompanyRef, {
                    siteIds: arrayUnion(id),
                    siteNames: arrayUnion(site.name),
                    updatedAt: Timestamp.now()
                });
                if (beforeCompany) {
                    const nextSiteIds = Array.from(new Set([
                        ...((Array.isArray(beforeCompany.siteIds) ? beforeCompany.siteIds : []) as unknown[]).map(String),
                        id,
                    ]));
                    const nextSiteNames = Array.from(new Set([
                        ...((Array.isArray(beforeCompany.siteNames) ? beforeCompany.siteNames : []) as unknown[]).map(String),
                        site.name,
                    ].filter(Boolean)));
                    await logDatabaseChange(
                        'updated',
                        'company',
                        beforeCompany,
                        { ...beforeCompany, siteIds: nextSiteIds, siteNames: nextSiteNames, updatedAt: Timestamp.now() },
                        'siteService.addSite.syncClientCompany'
                    );
                }
            } catch (err) {
                console.error("Failed to sync site to client company:", err);
            }
        }
        return id;
    },

    updateSite: async (id: string, site: Partial<Site>): Promise<void> => {
        const existing = await siteFirestoreService.getSite(id);
        const nameChanged = site.name && existing && existing.name !== site.name;
        const cleanedUpdates = stripUndefinedFields(site as Record<string, unknown>);

        await siteFirestoreService.updateSite(id, cleanedUpdates as Partial<Site>);
        clearSiteListCache();
        await logDatabaseChange(
            'updated',
            'site',
            existing ? snapshotRecord(id, existing as Record<string, unknown>) : null,
            snapshotRecord(id, { ...(existing ? existing as Record<string, unknown> : {}), ...cleanedUpdates }),
            'siteService.updateSite'
        );

        if (nameChanged && site.name) {
            try {
                const { manpowerService } = await import('./manpowerService');
                await manpowerService.updateWorkersSiteName(id, site.name);
            } catch (e) {
                console.error("Failed to sync site name to workers:", e);
            }
        }
    },

    deleteSite: async (id: string): Promise<void> => {
        const existing = await siteFirestoreService.getSite(id);
        await siteFirestoreService.deleteSite(id);
        clearSiteListCache();
        await logDatabaseChange(
            'deleted',
            'site',
            existing ? snapshotRecord(id, existing as Record<string, unknown>) : null,
            null,
            'siteService.deleteSite'
        );
    },

    updateSitesBatch: async (ids: string[], updates: Partial<Site>): Promise<void> => {
        const { writeBatch } = await import('firebase/firestore');
        const beforeRows = await Promise.all(ids.map(async (id) => {
            const site = await siteFirestoreService.getSite(id);
            return site ? snapshotRecord(id, site as Record<string, unknown>) : null;
        }));
        const cleanedUpdates = stripUndefinedFields(updates as Record<string, unknown>);
        const updatedAt = Timestamp.now();
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, 'sites', id);
            batch.update(docRef, {
                ...cleanedUpdates,
                updatedAt
            });
        });
        await batch.commit();
        clearSiteListCache();
        await Promise.all(beforeRows.map((before) =>
            before
                ? logDatabaseChange(
                    'updated',
                    'site',
                    before,
                    { ...before, ...cleanedUpdates, updatedAt },
                    'siteService.updateSitesBatch'
                )
                : Promise.resolve()
        ));
    },

    getSite: async (id: string): Promise<Site | null> => {
        return siteFirestoreService.getSite(id);
    },

    getSites: async (): Promise<Site[]> => {
        if (siteListCache && siteListCache.expiresAt > Date.now()) {
            return siteListCache.rows;
        }

        const rows = await siteFirestoreService.getSites();
        siteListCache = {
            rows,
            expiresAt: Date.now() + SITE_LIST_CACHE_TTL_MS,
        };
        return rows;
    },

    getSitesByClientCompanyIds: async (companyIds: string[]): Promise<Site[]> => {
        const ids = Array.from(new Set(companyIds.map((value) => String(value ?? '').trim()).filter(Boolean)));
        const groups = await Promise.all(ids.map((companyId) => siteFirestoreService.getSitesByClientCompany(companyId)));
        const byId = new Map<string, Site>();
        groups.flat().forEach((site) => {
            const id = String(site.id || '').trim();
            if (id) byId.set(id, site);
        });
        return Array.from(byId.values());
    },

    getSiteByName: async (name: string): Promise<Site | null> => {
        return siteFirestoreService.getSiteByCode(name); // Note: Original was getSiteByName but implementing via code/name search
    },

    getSitesPaginated: async (limitCount: number, lastDoc: any = null): Promise<{ sites: Site[], lastDoc: any }> => {
        // Since siteFirestoreService doesn't have paginated yet, I'll add it or implement here
        // For consistency, I'll update siteFirestoreService to include paginated
        const { query, collection, orderBy, limit, startAfter, getDocs } = await import('firebase/firestore');
        let q = query(collection(db, 'sites'), orderBy('createdAt', 'desc'), limit(limitCount));
        if (lastDoc) {
            q = query(collection(db, 'sites'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount));
        }
        const snap = await getDocs(q);
        return {
            sites: snap.docs.map(d => ({ id: d.id, ...d.data() } as Site)),
            lastDoc: snap.docs[snap.docs.length - 1]
        };
    },

    incrementManDay: async (siteId: string, amount: number): Promise<void> => {
        const { increment } = await import('firebase/firestore');
        const docRef = doc(db, 'sites', siteId);
        await updateDoc(docRef, {
            totalManDay: increment(amount),
            updatedAt: Timestamp.now()
        });
    },

    updateSitesColorByResponsibleTeam: async (teamId: string, color: string, teamName?: string): Promise<void> => {
        const snapshots = await Promise.all([
            query(collection(db, 'sites'), where('responsibleTeamId', '==', teamId)),
            ...(teamName ? [query(collection(db, 'sites'), where('responsibleTeamName', '==', teamName))] : [])
        ].map((siteQuery) => getDocs(siteQuery)));

        const siteRefs = new Map<string, typeof snapshots[number]['docs'][number]['ref']>();
        snapshots.forEach((snapshot) => {
            snapshot.docs.forEach((siteDoc) => {
                siteRefs.set(siteDoc.ref.path, siteDoc.ref);
            });
        });

        if (siteRefs.size === 0) return;

        const beforeRows = await Promise.all(Array.from(siteRefs.values()).map(async (siteRef) => {
            const snap = await getDoc(siteRef);
            return snap.exists() ? snapshotRecord(snap.id, snap.data()) : null;
        }));
        const updatedAt = Timestamp.now();
        const batch = writeBatch(db);
        siteRefs.forEach((siteRef) => {
            batch.update(siteRef, {
                color,
                updatedAt
            });
        });
        await batch.commit();
        clearSiteListCache();
        await Promise.all(beforeRows.map((before) =>
            before
                ? logDatabaseChange(
                    'updated',
                    'site',
                    before,
                    { ...before, color, updatedAt },
                    'siteService.updateSitesColorByResponsibleTeam'
                )
                : Promise.resolve()
        ));
    }
};
