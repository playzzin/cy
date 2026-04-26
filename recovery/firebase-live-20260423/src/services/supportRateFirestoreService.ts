import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp,
    query,
    where
} from 'firebase/firestore';
import { SupportRate } from './supportRateService';
import { SupportRateSchema } from '../types/zod/supportRateSchema';

const COLLECTION_NAME = 'supportRates';

export const supportRateFirestoreService = {
    // 모든 현장 단가 조회
    async getAllRates(): Promise<SupportRate[]> {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as SupportRate));
    },

    // 특정 현장 단가 조회
    async getRateBySite(siteId: string): Promise<SupportRate | null> {
        const docRef = doc(db, COLLECTION_NAME, siteId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as SupportRate;
        }
        return null;
    },

    // 단가 저장 (단일)
    async saveRate(rate: SupportRate): Promise<void> {
        const validated = SupportRateSchema.parse(rate);
        const docRef = doc(db, COLLECTION_NAME, validated.siteId);
        await setDoc(docRef, {
            ...validated,
            updatedAt: serverTimestamp()
        }, { merge: true });
    },

    // 데이터 커넥트에서 마이그레이션
    async migrateLegacyRates(legacyRates: SupportRate[]): Promise<number> {
        const batch = writeBatch(db);
        let count = 0;

        for (const rate of legacyRates) {
            const docRef = doc(db, COLLECTION_NAME, rate.siteId);
            batch.set(docRef, {
                ...rate,
                updatedAt: serverTimestamp()
            }, { merge: true });
            count++;

            if (count % 500 === 0) {
                await batch.commit();
            }
        }

        if (count % 500 !== 0) {
            await batch.commit();
        }

        return count;
    }
};
