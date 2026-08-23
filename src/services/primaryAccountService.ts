import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const SETTINGS_COLLECTION = 'settings';
const PRIMARY_ACCOUNT_DOCUMENT_ID = 'primary_account';

export type PrimaryAccountSourceType = 'worker' | 'team' | 'company' | 'custom';

export interface PrimaryAccountSetting {
    sourceType: PrimaryAccountSourceType;
    sourceId: string;
    sourceName: string;
    bankName: string;
    accountHolder: string;
    accountNumber: string;
}

const cleanText = (value: unknown): string => String(value ?? '').trim();

const normalizePrimaryAccount = (value: unknown): PrimaryAccountSetting | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const raw = value as Record<string, unknown>;
    const sourceType = cleanText(raw.sourceType);
    if (!['worker', 'team', 'company', 'custom'].includes(sourceType)) return null;

    const accountNumber = cleanText(raw.accountNumber);
    if (!accountNumber) return null;

    return {
        sourceType: sourceType as PrimaryAccountSourceType,
        sourceId: cleanText(raw.sourceId),
        sourceName: cleanText(raw.sourceName),
        bankName: cleanText(raw.bankName),
        accountHolder: cleanText(raw.accountHolder),
        accountNumber,
    };
};

export const primaryAccountService = {
    async getPrimaryAccount(): Promise<PrimaryAccountSetting | null> {
        const snapshot = await getDoc(doc(db, SETTINGS_COLLECTION, PRIMARY_ACCOUNT_DOCUMENT_ID));
        return snapshot.exists() ? normalizePrimaryAccount(snapshot.data()) : null;
    },

    async setPrimaryAccount(account: PrimaryAccountSetting): Promise<void> {
        const normalized = normalizePrimaryAccount(account);
        if (!normalized) {
            throw new Error('대표계좌로 설정하려면 계좌번호가 필요합니다.');
        }

        await setDoc(doc(db, SETTINGS_COLLECTION, PRIMARY_ACCOUNT_DOCUMENT_ID), {
            ...normalized,
            updatedAt: serverTimestamp(),
        });
    },
};
