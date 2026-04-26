import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    writeBatch,
    serverTimestamp,
    Timestamp as FirestoreTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Freelancer, FreelancerPayment } from '../types/freelancer';
import { FreelancerSchema, FreelancerPaymentSchema } from '../types/zod/freelancerSchema';
import {
    listFreelancers,
    listFreelancerPayments
} from './firestoreCrudCompat';
const FREELANCERS_COLLECTION = 'freelancers';
const PAYMENTS_COLLECTION = 'freelancerPayments';

export const freelancerFirestoreService = {
    // --- Freelancers ---

    async getFreelancers(): Promise<Freelancer[]> {
        const q = query(collection(db, FREELANCERS_COLLECTION), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Freelancer));
    },

    async getFreelancer(id: string): Promise<Freelancer | null> {
        const docRef = doc(db, FREELANCERS_COLLECTION, id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Freelancer) : null;
    },

    async createFreelancer(data: Omit<Freelancer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const validatedData = FreelancerSchema.parse(data);
        const docRef = doc(collection(db, FREELANCERS_COLLECTION));
        await setDoc(docRef, {
            ...validatedData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    },

    async updateFreelancer(id: string, data: Partial<Freelancer>): Promise<void> {
        const docRef = doc(db, FREELANCERS_COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    },

    async deleteFreelancer(id: string): Promise<void> {
        // ?꾨━?쒖꽌 ??젣 ??愿???댁뿭????젣?좎? ?щ????뺤콉???곕씪 寃곗젙 (?ш린???꾨━?쒖꽌留??곗꽑 ??젣)
        await deleteDoc(doc(db, FREELANCERS_COLLECTION, id));
    },

    // --- Payments ---

    async getPayments(freelancerId?: string, year?: number, month?: number): Promise<FreelancerPayment[]> {
        let q = query(collection(db, PAYMENTS_COLLECTION));

        if (freelancerId) {
            q = query(q, where('freelancerId', '==', freelancerId));
        }
        if (year) {
            q = query(q, where('year', '==', year));
        }
        if (month) {
            q = query(q, where('month', '==', month));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FreelancerPayment));
    },

    async createPayment(data: Omit<FreelancerPayment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const validatedData = FreelancerPaymentSchema.parse(data);
        const docRef = doc(collection(db, PAYMENTS_COLLECTION));
        await setDoc(docRef, {
            ...validatedData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    },

    async updatePayment(id: string, data: Partial<FreelancerPayment>): Promise<void> {
        const docRef = doc(db, PAYMENTS_COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    },

    async deletePayment(id: string): Promise<void> {
        await deleteDoc(doc(db, PAYMENTS_COLLECTION, id));
    },

    // --- Batch Operations (Highly important for cost optimization) ---

    async saveYearlyPaymentsBatch(year: number, modifiedData: any[]) {
        const batch = writeBatch(db);
        //Note: This expects freelancerId to be the new random ID from Firestore

        for (const row of modifiedData) {
            // 1. ?꾨━?쒖꽌 ?뺣낫 ?낅뜲?댄듃 (?꾩슂??寃쎌슦)
            if (row.id && !row.id.startsWith('temp_')) {
                const freelancerRef = doc(db, FREELANCERS_COLLECTION, row.id);
                batch.update(freelancerRef, {
                    unitPrice: Number(row.monthlyRate || 0),
                    updatedAt: serverTimestamp(),
                });
            }

            // 2. ?붾퀎 吏湲됱븸 ?낅뜲?댄듃
            for (let m = 1; m <= 12; m++) {
                const mk = `m${String(m).padStart(2, '0')}`;
                const amount = Number(row[mk] || 0);
                const paymentId = row[`${mk}_id`];

                if (paymentId) {
                    const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
                    batch.update(paymentRef, {
                        amount,
                        updatedAt: serverTimestamp(),
                    });
                } else if (amount > 0 && row.id) {
                    const newPaymentRef = doc(collection(db, PAYMENTS_COLLECTION));
                    batch.set(newPaymentRef, {
                        freelancerId: row.id,
                        year,
                        month: m,
                        amount,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                }
            }

            // 3. ?곌컙 ?붿빟 ?뺣낫 (12??湲곗?)
            const yearlyInfo = {
                performanceBonus: Number(row.performanceBonus || 0),
                reportingBalance: Number(row.reportingBalance || 0),
                reportableAmount: Number(row.reportableAmount || 0),
                depositDate: row.depositDate || null,
                memo: row.paymentMemo || '',
                dailyRate: Number(row.monthlyRate || 0),
            };

            const m12Id = row.m12_id;
            if (m12Id) {
                const m12Ref = doc(db, PAYMENTS_COLLECTION, m12Id);
                batch.update(m12Ref, {
                    ...yearlyInfo,
                    updatedAt: serverTimestamp(),
                });
            } else if (row.id) {
                const newM12Ref = doc(collection(db, PAYMENTS_COLLECTION));
                batch.set(newM12Ref, {
                    freelancerId: row.id,
                    year,
                    month: 12,
                    amount: 0,
                    ...yearlyInfo,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }
        }

        await batch.commit();
    },

    // --- Migration Logic ---

    async migrateLegacyData() {
        console.log('Starting Freelancer migration from legacy dataset...');

        // 1. Fetch from legacy dataset
        const freelancersRes = await listFreelancers();
        const dcFreelancers = (freelancersRes as any).data?.freelancers ?? [];

        const paymentsRes = await listFreelancerPayments();
        const dcPayments = (paymentsRes as any).data?.freelancerPayments ?? [];

        console.log(`Found ${dcFreelancers.length} freelancers and ${dcPayments.length} payments in legacy dataset.`);

        const batch = writeBatch(db);
        const uuidToFsIdMap = new Map<string, string>();

        // 2. Migrate Freelancers
        for (const df of dcFreelancers) {
            const fsRef = doc(collection(db, FREELANCERS_COLLECTION));
            const data = {
                name: df.name,
                teamId: df.team?.id || df.teamId || null,
                teamName: df.team?.name || df.teamName || null,
                residentNumber: df.residentNumber || null,
                phone: df.phone || null,
                bankName: df.bankName || null,
                accountNumber: df.accountNumber || null,
                status: df.status || 'active',
                memo: df.memo || null,
                unitPrice: Number(df.unitPrice || 0),
                legacyId: df.id, // Store original UUID
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            batch.set(fsRef, data);
            uuidToFsIdMap.set(df.id, fsRef.id);
        }

        // 3. Migrate Payments
        for (const dp of dcPayments) {
            const fsFreelancerId = uuidToFsIdMap.get(dp.freelancerId);
            if (!fsFreelancerId) {
                console.warn(`Skipping payment ${dp.id}: Freelancer ${dp.freelancerId} not found.`);
                continue;
            }

            const fsRef = doc(collection(db, PAYMENTS_COLLECTION));
            const data = {
                freelancerId: fsFreelancerId,
                year: dp.year,
                month: dp.month,
                dailyRate: dp.dailyRate || null,
                manDays: dp.manDays || null,
                amount: dp.amount || null,
                performanceBonus: dp.performanceBonus || null,
                reportingBalance: dp.reportingBalance || null,
                reportableAmount: dp.reportableAmount || null,
                depositDate: dp.depositDate || null,
                memo: dp.memo || null,
                legacyId: dp.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            batch.set(fsRef, data);
        }

        await batch.commit();
        console.log('Freelancer migration completed successfully.');
        return { freelancerCount: dcFreelancers.length, paymentCount: dcPayments.length };
    }
};


