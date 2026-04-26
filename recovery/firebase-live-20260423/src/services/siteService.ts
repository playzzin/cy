import { siteFirestoreService } from './siteFirestoreService';
import { SiteZod as Site } from '../types/zod/siteSchema';
import { db } from '../config/firebase';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';

export type { Site };

export const siteService = {
    addSite: async (site: Partial<Site> & Pick<Site, 'name' | 'code' | 'address' | 'status'>): Promise<string> => {
        const id = await siteFirestoreService.addSite(site as any);

        // Sync: Add Site ID to Client Company (발주사) if selected
        if (site.clientCompanyId) {
            try {
                const clientCompanyRef = doc(db, 'companies', site.clientCompanyId);
                await updateDoc(clientCompanyRef, {
                    siteIds: arrayUnion(id),
                    siteNames: arrayUnion(site.name),
                    updatedAt: Timestamp.now()
                });
            } catch (err) {
                console.error("Failed to sync site to client company:", err);
            }
        }
        return id;
    },

    updateSite: async (id: string, site: Partial<Site>): Promise<void> => {
        const existing = await siteFirestoreService.getSite(id);
        const nameChanged = site.name && existing && existing.name !== site.name;

        await siteFirestoreService.updateSite(id, site);

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
        return siteFirestoreService.deleteSite(id);
    },

    updateSitesBatch: async (ids: string[], updates: Partial<Site>): Promise<void> => {
        const { writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, 'sites', id);
            batch.update(docRef, {
                ...updates,
                updatedAt: Timestamp.now()
            });
        });
        await batch.commit();
    },

    getSite: async (id: string): Promise<Site | null> => {
        return siteFirestoreService.getSite(id);
    },

    getSites: async (): Promise<Site[]> => {
        return siteFirestoreService.getSites();
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
    }
};
