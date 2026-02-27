import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    runTransaction,
    setDoc,
    Timestamp,
    where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { TeamSettlementDocument } from '../types/teamSettlement';

export type OfficeTransactionCategory =
    // Income
    | 'TEAM_FEE'        // 팀 관리비 (Received from Teams)
    | 'SALES_GOODS'     // 물품 판매 (Gloves, etc.)
    | 'SITE_PAYBACK'    // 현장 바이백 (Kickback/Commission)
    | 'OTHER_INCOME'    // 기타 수입

    // Expense
    | 'SALARY_STAFF'    // 직원 급여
    | 'OFFICE_RENT'     // 사무실 월세
    | 'UTILITIES'       // 공과금
    | 'RENTAL_FEE'      // 렌트비 (Vehicle/Equipment)
    | 'GENERAL_EXPENSE'; // 일반 지출 (Meals, Supplies)

export interface OfficeTransaction {
    id: string;
    date: string; // YYYY-MM-DD
    type: 'income' | 'expense';
    category: OfficeTransactionCategory;
    subCategory?: string;
    amount: number;
    description: string;

    // Relations
    relatedTeamId?: string;
    relatedSiteId?: string;
    relatedStaffId?: string;

    // Meta
    createdAt: string;
    updatedAt: string;
}

const COLLECTION_NAME = 'office_transactions';

export const officeService = {
    /**
     * Add or Update a transaction
     */
    async setTransaction(transaction: OfficeTransaction): Promise<void> {
        const ref = doc(db, COLLECTION_NAME, transaction.id);
        await setDoc(ref, {
            ...transaction,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    },

    /**
     * Delete a transaction
     */
    async deleteTransaction(id: string): Promise<void> {
        const ref = doc(db, COLLECTION_NAME, id);
        await deleteDoc(ref);
    },

    /**
     * Get transactions by month (YYYY-MM)
     */
    async getTransactionsByMonth(yearMonth: string): Promise<OfficeTransaction[]> {
        const start = `${yearMonth}-01`;
        const end = `${yearMonth}-31`;
        return this.getTransactionsByRange(start, end);
    },

    /**
     * Get transactions by date range
     */
    async getTransactionsByRange(startDate: string, endDate: string): Promise<OfficeTransaction[]> {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => d.data() as OfficeTransaction);
    },

    /**
     * Get all transactions
     */
    async getAllTransactions(): Promise<OfficeTransaction[]> {
        const q = query(
            collection(db, COLLECTION_NAME),
            orderBy('date', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => d.data() as OfficeTransaction);
    },

    /**
     * Sync Team Fee from a Settlement Document
     * This is called when a team settlement is CONFIRMED.
     * It finds "Office Expense" deductions and aggregates them into a single Income transaction.
     */
    async syncTeamFeeFromSettlement(settlement: TeamSettlementDocument): Promise<void> {
        // 1. Calculate Total Office Fee
        const officeFeeTotal = (settlement.deductions || [])
            .filter((d) => d.origin === 'office_expense')
            .reduce((sum, d) => sum + (d.amount || 0), 0);

        if (officeFeeTotal <= 0) {
            // If amount is 0, we might want to remove any existing record if it exists,
            // or just do nothing. Let's try to delete if 0 to keep clean.
            await this.deleteTeamFeeTransaction(settlement.teamId, settlement.yearMonth);
            return;
        }

        // 2. Create Transaction Object
        const transactionId = `SETTLEMENT_FEE_${settlement.teamId}_${settlement.yearMonth.replace('-', '')}`;
        const transaction: OfficeTransaction = {
            id: transactionId,
            date: `${settlement.yearMonth}-25`, // Usually settlements are done around 25th? Or just use end of month? Let's use 25th as default pay day.
            type: 'income',
            category: 'TEAM_FEE',
            amount: officeFeeTotal,
            description: `${settlement.yearMonth} ${settlement.teamName || '팀'} 정산 관리비`,
            relatedTeamId: settlement.teamId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 3. Save
        await this.setTransaction(transaction);
    },

    /**
     * Remove Team Fee Transaction
     * Called when settlement is UNCONFIRMED
     */
    async deleteTeamFeeTransaction(teamId: string, yearMonth: string): Promise<void> {
        const transactionId = `SETTLEMENT_FEE_${teamId}_${yearMonth.replace('-', '')}`;
        await this.deleteTransaction(transactionId);
    }
};
