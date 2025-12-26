import { db } from '../config/firebase';
import { toast } from '../utils/swal';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, Timestamp, query, orderBy, increment, limit, startAfter, where, getDoc } from 'firebase/firestore';

export interface Site {
    id?: string;
    name: string;
    code: string;
    address: string;
    status: 'active' | 'completed' | 'planned';
    responsibleTeamId?: string; // ID of the team managing this site
    responsibleTeamName?: string; // Denormalized name for display
    companyId?: string; // ID of the client company (건설사 등)
    companyName?: string; // Name of the client company
    constructorCompanyId?: string; // ID of the constructor company (시공사)
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    totalManDay?: number; // 누적 공수
    color?: string; // Site color for UI
}

const COLLECTION_NAME = 'sites';

export const siteService = {
    addSite: async (site: Partial<Site> & Pick<Site, 'name' | 'code' | 'address' | 'status'>): Promise<string> => {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            name: site.name,
            code: site.code,
            address: site.address,
            status: site.status,
            responsibleTeamId: site.responsibleTeamId || '',
            responsibleTeamName: site.responsibleTeamName || '',
            companyId: site.companyId || '',
            companyName: site.companyName || '',
            constructorCompanyId: site.constructorCompanyId || '',

            color: site.color || '', // Include color
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        toast.saved('현장', 1);
        return docRef.id;
    },

    updateSite: async (id: string, site: Partial<Site>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);

        // Check for name change
        let nameChanged = false;
        if (site.name) {
            const snap = await getDoc(docRef);
            if (snap.exists() && snap.data().name !== site.name) {
                nameChanged = true;
            }
        }

        await updateDoc(docRef, {
            ...site,
            updatedAt: Timestamp.now()
        });
        toast.updated('현장');

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
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        toast.deleted('현장', 1);
    },

    // Update multiple sites specific fields
    updateSitesBatch: async (ids: string[], updates: Partial<Site>): Promise<void> => {
        try {
            const { writeBatch } = await import('firebase/firestore');
            const batch = writeBatch(db);
            ids.forEach(id => {
                const docRef = doc(db, COLLECTION_NAME, id);
                batch.update(docRef, {
                    ...updates,
                    updatedAt: Timestamp.now()
                });
            });
            await batch.commit();
            toast.updated('현장');
        } catch (error) {
            console.error("Error updating sites batch:", error);
            throw error;
        }
    },

    getSites: async (): Promise<Site[]> => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Site));
    },

    // 현장명으로 조회
    getSiteByName: async (name: string): Promise<Site | null> => {
        const q = query(collection(db, COLLECTION_NAME), where('name', '==', name), limit(1));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;
        return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Site;
    },

    // Get sites (Paginated)
    getSitesPaginated: async (limitCount: number, lastDoc: any = null): Promise<{ sites: Site[], lastDoc: any }> => {
        try {
            let q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
            if (lastDoc) {
                q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount));
            }
            const querySnapshot = await getDocs(q);
            const sites = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Site));
            return {
                sites,
                lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1]
            };
        } catch (error) {
            console.error("Error fetching sites paginated:", error);
            throw error;
        }
    },

    // Increment total man-day for a site
    incrementManDay: async (siteId: string, amount: number): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, siteId);
            await updateDoc(docRef, {
                totalManDay: increment(amount),
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error(`Error incrementing man-day for site ${siteId}:`, error);
        }
    }
};
