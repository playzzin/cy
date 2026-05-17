import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { OfficeStaffSchema, OfficeStaffZod as OfficeStaff } from '../types/zod/officeStaffSchema';
import { createConverter } from '../utils/firestoreConverter';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { toast } from '../utils/swal';

export type { OfficeStaff };

const COLLECTION_NAME = 'office_staff';
const CACHE_TTL = 300000;
const officeStaffConverter = createConverter(OfficeStaffSchema);

let cachedOfficeStaff: OfficeStaff[] | null = null;
let lastFetchTime = 0;

const normalizeSalaryFields = (row: OfficeStaff): OfficeStaff => {
    const salaryModel = row.salaryModel || row.payType || '월급제';
    return {
        ...row,
        salaryModel,
        payType: row.payType || salaryModel,
        status: row.status || '재직',
        unitPrice: Number(row.unitPrice || 0),
    };
};

const getStaffKeys = (staffId: string, staff?: { id?: string | null; legacyId?: string | null } | null): string[] =>
    Array.from(new Set([
        String(staffId || '').trim(),
        String(staff?.id || '').trim(),
        String(staff?.legacyId || '').trim(),
    ].filter(Boolean)));

export const officeStaffService = {
    getCollection() {
        return collection(db, COLLECTION_NAME).withConverter(officeStaffConverter);
    },

    async getOfficeStaff(forceRefresh: boolean = false): Promise<OfficeStaff[]> {
        const now = Date.now();
        if (!forceRefresh && cachedOfficeStaff && now - lastFetchTime < CACHE_TTL) {
            return cachedOfficeStaff;
        }

        const q = query(this.getCollection(), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        cachedOfficeStaff = snap.docs.map((item) => normalizeSalaryFields(item.data()));
        lastFetchTime = now;
        return cachedOfficeStaff;
    },

    async getOfficeStaffMember(id: string): Promise<OfficeStaff | null> {
        const snap = await getDoc(doc(db, COLLECTION_NAME, id).withConverter(officeStaffConverter));
        return snap.exists() ? normalizeSalaryFields(snap.data()) : null;
    },

    async getOfficeStaffByEmail(email: string): Promise<OfficeStaff | null> {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('email', '==', email.trim()),
            limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return normalizeSalaryFields({ id: snap.docs[0].id, ...snap.docs[0].data() } as OfficeStaff);
    },

    async getOfficeStaffByUid(uid: string): Promise<OfficeStaff | null> {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('uid', '==', uid),
            limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return normalizeSalaryFields({ id: snap.docs[0].id, ...snap.docs[0].data() } as OfficeStaff);
    },

    async findOfficeStaffForLinking(name: string, idNumber: string): Promise<OfficeStaff | null> {
        const q = query(collection(db, COLLECTION_NAME), where('name', '==', name.trim()));
        const snap = await getDocs(q);
        const found = snap.docs.find((item) => {
            const data = item.data();
            return String(data.idNumber || '').trim() === idNumber.trim();
        });
        return found ? normalizeSalaryFields({ id: found.id, ...found.data() } as OfficeStaff) : null;
    },

    async addOfficeStaff(staff: Omit<OfficeStaff, 'id'> | Partial<OfficeStaff>): Promise<string> {
        const salaryModel = staff.salaryModel || staff.payType || '월급제';
        const data = stripUndefinedFields({
            ...staff,
            salaryModel,
            payType: staff.payType || salaryModel,
            status: staff.status || '재직',
            isActive: staff.isActive ?? true,
            unitPrice: Number(staff.unitPrice || 0),
            createdAt: serverTimestamp(),
        } as Record<string, unknown>);

        const docRef = doc(collection(db, COLLECTION_NAME)).withConverter(officeStaffConverter);
        await setDoc(docRef, data as any);
        cachedOfficeStaff = null;
        toast.saved('사무실 직원', 1);
        return docRef.id;
    },

    async updateOfficeStaff(id: string, updates: Partial<OfficeStaff>): Promise<void> {
        const salaryModel = updates.salaryModel || updates.payType;
        const data = stripUndefinedFields({
            ...updates,
            ...(salaryModel ? { salaryModel, payType: updates.payType || salaryModel } : {}),
            ...(updates.unitPrice !== undefined ? { unitPrice: Number(updates.unitPrice || 0) } : {}),
        } as Record<string, unknown>);

        await updateDoc(doc(db, COLLECTION_NAME, id).withConverter(officeStaffConverter), {
            ...data,
            updatedAt: serverTimestamp(),
        });
        cachedOfficeStaff = null;
        toast.updated('사무실 직원');
    },

    async deleteOfficeStaff(id: string): Promise<void> {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        cachedOfficeStaff = null;
        toast.deleted('사무실 직원', 1);
    },

    async resolveOfficeStaff(staffId: string): Promise<OfficeStaff | null> {
        let staff = await this.getOfficeStaffMember(staffId);
        if (!staff) {
            const rows = await this.getOfficeStaff(true);
            const keys = getStaffKeys(staffId);
            staff = rows.find((item) => keys.includes(String(item.id)) || keys.includes(String(item.legacyId))) || null;
        }
        return staff;
    },
};
