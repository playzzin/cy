import {
    collection,
    getDoc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    where,
    writeBatch,
    doc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION_NAME = 'monthly_payroll_settlements';
const READ_TIMEOUT_MS = 10_000;
const WRITE_TIMEOUT_MS = 20_000;

export type MonthlyPayrollReportingType = 'labor' | 'business_income' | 'mixed';
export type MonthlyPayrollRunStatus = 'draft' | 'reviewed' | 'confirmed' | 'paid';

export interface MonthlyPayrollSavedSideInput {
    carry: number;
    carrySecond: number;
    currentAdvance: number;
    currentAdvanceSecond: number;
    lodging: number;
    electricity: number;
    gas: number;
    water: number;
    internet: number;
    management: number;
    fine: number;
    other: number;
}

export interface MonthlyPayrollSavedManualInput {
    invoice: MonthlyPayrollSavedSideInput;
    labor: MonthlyPayrollSavedSideInput;
    personalMemo: string;
    assignmentType?: 'corporate' | 'labor';
    allocationMode?: 'split' | 'corporate' | 'labor';
    itemAssignments?: Record<string, 'corporate' | 'labor'>;
}

export interface MonthlyPayrollBusinessIncomeSnapshot {
    appliedAmount: number;
    appliedManDay: number;
    incomeTax: number;
    residentTax: number;
    totalTax: number;
    incomeTaxRate: number;
    residentTaxRate: number;
}

export interface MonthlyPayrollSavedRow {
    rowKey: string;
    yearMonth: string;
    teamId: string;
    teamName: string;
    workerId: string;
    workerName: string;
    salaryModel: string;
    grossAmount: number;
    netAmount: number;
    invoiceGrossAmount?: number;
    laborGrossAmount?: number;
    invoiceNetAmount?: number;
    laborNetAmount?: number;
    totalManDay?: number;
    unitPrice?: number;
    personalDeduction?: number;
    taxDeduction?: number;
    totalDeduction?: number;
    isValid?: boolean;
    /** Full payment snapshot used after payroll confirmation. */
    paymentSnapshot?: Record<string, unknown>;
    manualInput: MonthlyPayrollSavedManualInput;
    businessIncome: MonthlyPayrollBusinessIncomeSnapshot;
}

export interface MonthlyPayrollCalculationOptions {
    insuranceApplied: boolean;
    insuranceTeamSiteOnly: boolean;
    businessIncomeApplied: boolean;
    utilitiesApplied: boolean;
    dailyFeeApplied: boolean;
}

export interface MonthlyPayrollSettlement {
    id?: string;
    year: number;
    yearMonth: string;
    teamId: string;
    teamName: string;
    reportingType: MonthlyPayrollReportingType;
    calculationOptions: MonthlyPayrollCalculationOptions;
    businessIncomeAppliedAmount: number;
    businessIncomeTaxAmount: number;
    rows: MonthlyPayrollSavedRow[];
    /** Missing on legacy records; treated as a draft. */
    runStatus: MonthlyPayrollRunStatus;
    reviewedAt?: unknown;
    reviewedByUid?: string;
    reviewedByName?: string;
    confirmedAt?: unknown;
    confirmedByUid?: string;
    confirmedByName?: string;
    paidAt?: unknown;
    paidByUid?: string;
    paidByName?: string;
    updatedByUid?: string;
    updatedByName?: string;
    updatedAt?: unknown;
}

export type MonthlyPayrollSettlementSaveInput = Omit<
    MonthlyPayrollSettlement,
    | 'id'
    | 'runStatus'
    | 'reviewedAt'
    | 'reviewedByUid'
    | 'reviewedByName'
    | 'confirmedAt'
    | 'confirmedByUid'
    | 'confirmedByName'
    | 'paidAt'
    | 'paidByUid'
    | 'paidByName'
    | 'updatedAt'
    | 'updatedByUid'
    | 'updatedByName'
>;

export interface MonthlyPayrollSettlementActor {
    uid?: string | null;
    name?: string | null;
}

const toText = (value: unknown): string => String(value ?? '').trim();

const toFiniteNumber = (value: unknown): number => {
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const cleanUndefinedDeep = (value: unknown): unknown => {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
        return value
            .map((child) => cleanUndefinedDeep(child))
            .filter((child) => child !== undefined);
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .map(([key, child]) => [key, cleanUndefinedDeep(child)] as const)
                .filter(([, child]) => child !== undefined)
        );
    }
    return value;
};

const withTimeout = <T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string
): Promise<T> => new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
        (value) => {
            clearTimeout(timer);
            resolve(value);
        },
        (error) => {
            clearTimeout(timer);
            reject(error);
        }
    );
});

const encodeIdPart = (value: string): string =>
    encodeURIComponent(toText(value) || 'unknown').replace(/\./g, '%2E');

export const makeMonthlyPayrollSettlementId = (yearMonth: string, teamId: string): string =>
    `${encodeIdPart(yearMonth)}__${encodeIdPart(teamId)}`;

const normalizeReportingType = (value: unknown): MonthlyPayrollReportingType => {
    if (value === 'business_income' || value === 'mixed') return value;
    return 'labor';
};

const normalizeRunStatus = (value: unknown): MonthlyPayrollRunStatus => {
    if (value === 'reviewed' || value === 'confirmed' || value === 'paid') return value;
    return 'draft';
};

export const isFinalizedMonthlyPayrollRun = (status: unknown): boolean => {
    const normalized = normalizeRunStatus(status);
    return normalized === 'confirmed' || normalized === 'paid';
};

const normalizeSettlement = (id: string, raw: Record<string, unknown>): MonthlyPayrollSettlement => {
    const rows = Array.isArray(raw.rows) ? raw.rows : [];
    return {
        id,
        year: Math.floor(toFiniteNumber(raw.year)),
        yearMonth: toText(raw.yearMonth),
        teamId: toText(raw.teamId),
        teamName: toText(raw.teamName),
        reportingType: normalizeReportingType(raw.reportingType),
        calculationOptions: {
            insuranceApplied: Boolean((raw.calculationOptions as any)?.insuranceApplied),
            insuranceTeamSiteOnly: Boolean((raw.calculationOptions as any)?.insuranceTeamSiteOnly),
            businessIncomeApplied: Boolean((raw.calculationOptions as any)?.businessIncomeApplied),
            utilitiesApplied: Boolean((raw.calculationOptions as any)?.utilitiesApplied),
            dailyFeeApplied: Boolean((raw.calculationOptions as any)?.dailyFeeApplied),
        },
        businessIncomeAppliedAmount: toFiniteNumber(raw.businessIncomeAppliedAmount),
        businessIncomeTaxAmount: toFiniteNumber(raw.businessIncomeTaxAmount),
        rows: rows as MonthlyPayrollSavedRow[],
        runStatus: normalizeRunStatus(raw.runStatus),
        reviewedAt: raw.reviewedAt,
        reviewedByUid: toText(raw.reviewedByUid) || undefined,
        reviewedByName: toText(raw.reviewedByName) || undefined,
        confirmedAt: raw.confirmedAt,
        confirmedByUid: toText(raw.confirmedByUid) || undefined,
        confirmedByName: toText(raw.confirmedByName) || undefined,
        paidAt: raw.paidAt,
        paidByUid: toText(raw.paidByUid) || undefined,
        paidByName: toText(raw.paidByName) || undefined,
        updatedByUid: toText(raw.updatedByUid) || undefined,
        updatedByName: toText(raw.updatedByName) || undefined,
        updatedAt: raw.updatedAt,
    };
};

export const monthlyPayrollSettlementService = {
    async saveSettlements(
        settlements: MonthlyPayrollSettlementSaveInput[],
        actor: MonthlyPayrollSettlementActor = {}
    ): Promise<void> {
        if (settlements.length === 0) return;
        if (settlements.length > 450) {
            throw new Error('한 번에 저장할 수 있는 팀 수를 초과했습니다.');
        }

        const docs = settlements.map((settlement) => ({
            settlement,
            id: makeMonthlyPayrollSettlementId(settlement.yearMonth, settlement.teamId),
        }));

        // Once a run leaves draft state, its saved data is the review/confirmed
        // snapshot. Refuse accidental overwrites from the normal save action.
        const existing = await Promise.all(docs.map(async ({ id }) => ({
            id,
            snapshot: await getDoc(doc(db, COLLECTION_NAME, id)),
        })));
        const locked = existing.find(({ snapshot }) => (
            snapshot.exists() && normalizeRunStatus(snapshot.data().runStatus) !== 'draft'
        ));
        if (locked) {
            throw new Error('검토·확정 또는 지급완료된 급여입니다. 저장본을 덮어쓸 수 없습니다.');
        }

        const batch = writeBatch(db);
        docs.forEach(({ settlement, id }) => {
            const payload = cleanUndefinedDeep({
                ...settlement,
                id,
                updatedByUid: toText(actor.uid),
                updatedByName: toText(actor.name),
                updatedAt: serverTimestamp(),
            }) as Record<string, unknown>;

            batch.set(doc(db, COLLECTION_NAME, id), payload, { merge: true });
        });

        await withTimeout(
            batch.commit(),
            WRITE_TIMEOUT_MS,
            '월 급여 정산 저장 응답이 지연되고 있습니다.'
        );
    },

    async transitionRunStatus(
        settlementIds: string[],
        nextStatus: Exclude<MonthlyPayrollRunStatus, 'draft'>,
        actor: MonthlyPayrollSettlementActor = {}
    ): Promise<void> {
        const ids = Array.from(new Set(settlementIds.map((id) => toText(id)).filter(Boolean)));
        if (ids.length === 0) throw new Error('상태를 변경할 급여 저장본이 없습니다. 먼저 초안을 저장해 주세요.');

        await withTimeout(
            runTransaction(db, async (transaction) => {
                const refs = ids.map((id) => doc(db, COLLECTION_NAME, id));
                const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));

                snapshots.forEach((snapshot) => {
                    if (!snapshot.exists()) {
                        throw new Error('급여 초안을 찾을 수 없습니다. 먼저 초안을 저장해 주세요.');
                    }

                    const current = normalizeRunStatus(snapshot.data().runStatus);
                    const allowed = (
                        (current === 'draft' && (nextStatus === 'reviewed' || nextStatus === 'confirmed'))
                        || (current === 'reviewed' && nextStatus === 'confirmed')
                        || (current === 'confirmed' && nextStatus === 'paid')
                    );
                    if (!allowed) {
                        throw new Error(`급여 상태를 ${current}에서 ${nextStatus}(으)로 변경할 수 없습니다.`);
                    }
                });

                const timestampFields = nextStatus === 'reviewed'
                    ? {
                        reviewedAt: serverTimestamp(),
                        reviewedByUid: toText(actor.uid),
                        reviewedByName: toText(actor.name),
                    }
                    : nextStatus === 'confirmed'
                        ? {
                            confirmedAt: serverTimestamp(),
                            confirmedByUid: toText(actor.uid),
                            confirmedByName: toText(actor.name),
                        }
                        : {
                            paidAt: serverTimestamp(),
                            paidByUid: toText(actor.uid),
                            paidByName: toText(actor.name),
                        };

                refs.forEach((ref) => {
                    transaction.update(ref, cleanUndefinedDeep({
                        runStatus: nextStatus,
                        ...timestampFields,
                        updatedByUid: toText(actor.uid),
                        updatedByName: toText(actor.name),
                        updatedAt: serverTimestamp(),
                    }) as Record<string, unknown>);
                });
            }),
            WRITE_TIMEOUT_MS,
            '급여 상태 저장 응답이 지연되고 있습니다.'
        );
    },

    async getSettlementsByYear(year: number): Promise<MonthlyPayrollSettlement[]> {
        const safeYear = Math.floor(toFiniteNumber(year));
        if (!safeYear) return [];

        const snapshot = await withTimeout(
            getDocs(query(
                collection(db, COLLECTION_NAME),
                where('year', '==', safeYear)
            )),
            READ_TIMEOUT_MS,
            '저장된 월 급여 정산 조회 응답이 지연되고 있습니다.'
        );

        return snapshot.docs
            .map((item) => normalizeSettlement(item.id, item.data()))
            .sort((a, b) =>
                a.yearMonth.localeCompare(b.yearMonth) ||
                a.teamName.localeCompare(b.teamName, 'ko-KR')
            );
    },
};
