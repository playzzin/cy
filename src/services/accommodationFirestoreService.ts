import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    limit as firestoreLimit
} from 'firebase/firestore';
import { createConverter } from '../utils/firestoreConverter';
import { accommodationSchema, utilityRecordSchema } from '../types/zod/accommodationSchema';
import { Accommodation, UtilityRecord } from '../types/accommodation';

const ACCOMMODATION_COLLECTION = 'accommodations';
const UTILITY_RECORD_COLLECTION = 'accommodationUtilityRecords';
const ASSIGNMENT_COLLECTION = 'accommodationAssignments';

export const accommodationFirestoreService = {
    /**
     * 숙소 목록 조회
     */
    listAccommodations: async (status?: 'active' | 'inactive') => {
        let q = query(collection(db, ACCOMMODATION_COLLECTION).withConverter(createConverter(accommodationSchema)));
        if (status) {
            q = query(q, where('status', '==', status));
        }
        q = query(q, orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Accommodation);
    },

    /**
     * 단일 숙소 상세 조회
     */
    getAccommodation: async (id: string) => {
        const ref = doc(db, ACCOMMODATION_COLLECTION, id).withConverter(createConverter(accommodationSchema));
        const snapshot = await getDoc(ref);
        return snapshot.exists() ? (snapshot.data() as Accommodation) : null;
    },

    /**
     * 숙소 저장 (생성/수정)
     */
    saveAccommodation: async (data: Partial<Accommodation> & { id: string }) => {
        const ref = doc(db, ACCOMMODATION_COLLECTION, data.id).withConverter(createConverter(accommodationSchema));
        await setDoc(ref, {
            ...data,
            updatedAt: Timestamp.now()
        }, { merge: true });
    },

    /**
     * 숙소 삭제
     */
    deleteAccommodation: async (id: string) => {
        const ref = doc(db, ACCOMMODATION_COLLECTION, id);
        await deleteDoc(ref);
    },

    /**
     * 공과금 기록 목록 조회 (연월 기준)
     */
    listUtilityRecords: async (yearMonth?: string) => {
        let q = query(collection(db, UTILITY_RECORD_COLLECTION).withConverter(createConverter(utilityRecordSchema)));
        if (yearMonth) {
            q = query(q, where('yearMonth', '==', yearMonth));
        }
        q = query(q, orderBy('yearMonth', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as UtilityRecord);
    },

    /**
     * 공과금 기록 저장
     */
    saveUtilityRecord: async (data: Partial<UtilityRecord> & { id: string }) => {
        const ref = doc(db, UTILITY_RECORD_COLLECTION, data.id).withConverter(createConverter(utilityRecordSchema));
        await setDoc(ref, {
            ...data,
            updatedAt: Timestamp.now()
        }, { merge: true });
    },

    /**
     * 공과금 기록 완전 교체 (저장-자동청구 중 확정 충돌 롤백에만 사용)
     *
     * 일반 저장은 merge가 맞지만 롤백은 새 저장에서 추가된 필드까지 제거해야
     * 하므로 기존 스냅샷으로 문서를 교체한다.
     */
    replaceUtilityRecord: async (data: UtilityRecord) => {
        const normalizedId = String(data.id ?? '').trim();
        if (!normalizedId) throw new Error('공과금 대장 교체 ID가 필요합니다.');
        const ref = doc(db, UTILITY_RECORD_COLLECTION, normalizedId).withConverter(createConverter(utilityRecordSchema));
        await setDoc(ref, {
            ...data,
            id: normalizedId,
            updatedAt: Timestamp.now()
        });
    },

    /**
     * 공과금 기록 삭제 (저장-자동청구 중 확정 충돌 롤백에만 사용)
     */
    deleteUtilityRecord: async (id: string) => {
        const normalizedId = String(id ?? '').trim();
        if (!normalizedId) throw new Error('공과금 대장 삭제 ID가 필요합니다.');
        await deleteDoc(doc(db, UTILITY_RECORD_COLLECTION, normalizedId));
    },

    /**
     * 특정 숙소의 최근 공과금 기록 조회
     */
    getLatestUtilityRecord: async (accommodationId: string) => {
        const q = query(
            collection(db, UTILITY_RECORD_COLLECTION).withConverter(createConverter(utilityRecordSchema)),
            where('accommodationId', '==', accommodationId),
            orderBy('yearMonth', 'desc'),
            firestoreLimit(1)
        );
        const snapshot = await getDocs(q);
        return snapshot.empty ? null : (snapshot.docs[0].data() as UtilityRecord);
    }
};
