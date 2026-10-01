import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import type { FirestoreError } from 'firebase/firestore';
import { db } from '../config/firebase';

const SETTINGS_COLLECTION = 'settings';
const PRIMARY_ACCOUNT_DOCUMENT_ID = 'primary_account';

export const PRIMARY_ACCOUNT_PAGES = [
    { id: 'labor-cost-statement-generator', label: '노무비 지급명세서 생성기', path: '/payroll/labor-cost-statement-generator', useCommon: true },
    { id: 'monthly-wage', label: '월급제 · 국민은행 이체', path: '/payroll/monthly-wage', useCommon: true },
    { id: 'client-site-labor', label: '건설사별 발주사/현장 노임명세서', path: '/payroll/client-site-labor', useCommon: true },
    { id: 'support-team', label: '외부지원간곳', path: '/payroll/support-team', useCommon: false },
    { id: 'support-team-incoming', label: '외부지원온곳', path: '/payroll/support-team-incoming', useCommon: false },
    { id: 'support-team-internal', label: '내부지원간곳', path: '/payroll/support-team-internal', useCommon: false },
    { id: 'support-team-internal-incoming', label: '내부지원온곳', path: '/payroll/support-team-internal-incoming', useCommon: false },
    { id: 'support-client-site', label: '지원 발주팀별 현장별', path: '/payroll/support-client-site', useCommon: false },
    { id: 'progress-claims', label: '기성관리 · 노임명세서', path: '/payroll/progress-claims', useCommon: false },
] as const;
export type PrimaryAccountPage = typeof PRIMARY_ACCOUNT_PAGES[number]['id'];
export type PrimaryAccountScope = PrimaryAccountPage | 'common';

const documentId = (scope: PrimaryAccountScope): string => {
    if (scope === 'common') return PRIMARY_ACCOUNT_DOCUMENT_ID;
    if (!PRIMARY_ACCOUNT_PAGES.some(page => page.id === scope)) throw new Error('지원하지 않는 대표계좌 페이지입니다.');
    return `${PRIMARY_ACCOUNT_DOCUMENT_ID}_${scope}`;
};

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
    subscribe(onChange: (account: PrimaryAccountSetting | null) => void, onError: (error: FirestoreError) => void, scope: PrimaryAccountScope = 'common') {
        return onSnapshot(doc(db, SETTINGS_COLLECTION, documentId(scope)), snapshot => {
            onChange(snapshot.exists() ? normalizePrimaryAccount(snapshot.data()) : null);
        }, onError);
    },

    async getPrimaryAccount(scope: PrimaryAccountScope = 'common'): Promise<PrimaryAccountSetting | null> {
        const snapshot = await getDoc(doc(db, SETTINGS_COLLECTION, documentId(scope)));
        return snapshot.exists() ? normalizePrimaryAccount(snapshot.data()) : null;
    },

    async setPrimaryAccount(account: PrimaryAccountSetting, scope: PrimaryAccountScope = 'common'): Promise<void> {
        const normalized = normalizePrimaryAccount(account);
        if (!normalized) {
            throw new Error('대표계좌로 설정하려면 계좌번호가 필요합니다.');
        }

        if (scope !== 'common' && (!normalized.bankName || !normalized.accountHolder)) {
            throw new Error('은행과 예금주를 입력해 주세요.');
        }
        await setDoc(doc(db, SETTINGS_COLLECTION, documentId(scope)), {
            ...normalized,
            updatedAt: serverTimestamp(),
        });
    },
};
