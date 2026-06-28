import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
    StatementOutputKind,
    StatementOutputRecord,
    StatementOutputSource,
    StatementOutputStatus,
} from '../types/statementOutput';

const COLLECTION_NAME = 'statement_outputs';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

const stripUndefinedDeep = (value: unknown): unknown => {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
        return value.map((child) => {
            const cleaned = stripUndefinedDeep(child);
            return cleaned === undefined ? null : cleaned;
        });
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .map(([key, child]) => [key, stripUndefinedDeep(child)] as const)
                .filter(([, child]) => child !== undefined)
        );
    }
    return value;
};

const cleanForFirestore = <T extends Record<string, unknown>>(value: T): Record<string, unknown> =>
    stripUndefinedDeep(value) as Record<string, unknown>;

const toText = (value: unknown): string => String(value ?? '').trim();

const toNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const normalizeKind = (value: unknown): StatementOutputKind =>
    value === 'transaction' || value === 'rental' ? value : 'labor';

const normalizeStatus = (value: unknown): StatementOutputStatus =>
    value === 'afterIssue' ? 'afterIssue' : 'beforeIssue';

const normalizeSource = (value: unknown): StatementOutputSource => {
    if (value === 'progress-claims' || value === 'support-team-payment' || value === 'monthly-wage') return value;
    return 'support-client-site';
};

const encodeIdPart = (value: string): string =>
    encodeURIComponent(toText(value) || 'unknown').replace(/\./g, '%2E');

export const makeStatementOutputId = (
    source: StatementOutputSource,
    kind: StatementOutputKind,
    yearMonth: string,
    statementKey: string
): string => [source, kind, yearMonth || 'unknown-month', statementKey || 'unknown-key'].map(encodeIdPart).join('__');

const normalizeAmountSummary = (value: StatementOutputRecord['amountSummary']): StatementOutputRecord['amountSummary'] | undefined => {
    if (!value) return undefined;
    return {
        manDay: toNumber(value.manDay),
        supplyAmount: toNumber(value.supplyAmount),
        vatAmount: toNumber(value.vatAmount),
        totalAmount: toNumber(value.totalAmount),
    };
};

const normalizeOutput = (raw: Partial<StatementOutputRecord>): StatementOutputRecord => {
    const source = normalizeSource(raw.source);
    const kind = normalizeKind(raw.kind);
    const status = normalizeStatus(raw.status);
    const yearMonth = toText(raw.yearMonth);
    const statementKey = toText(raw.statementKey);

    return {
        id: toText(raw.id) || undefined,
        source,
        statementKey,
        kind,
        status,
        yearMonth,
        targetTitle: toText(raw.targetTitle),
        targetSubtitle: toText(raw.targetSubtitle) || undefined,
        siteId: toText(raw.siteId) || undefined,
        siteName: toText(raw.siteName) || undefined,
        clientCompanyName: toText(raw.clientCompanyName) || undefined,
        teamName: toText(raw.teamName) || undefined,
        documentId: toText(raw.documentId) || undefined,
        documentNo: toText(raw.documentNo) || undefined,
        documentTitle: toText(raw.documentTitle) || undefined,
        amountSummary: normalizeAmountSummary(raw.amountSummary),
        optionPreset: normalizeStatus(raw.optionPreset ?? status),
        optionSnapshot: raw.optionSnapshot,
        snapshot: raw.snapshot,
        issuedAt: toText(raw.issuedAt) || undefined,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
    };
};

const mapDocToOutput = (id: string, data: Record<string, unknown>): StatementOutputRecord =>
    normalizeOutput({ ...data, id } as Partial<StatementOutputRecord>);

export const statementOutputService = {
    async upsertOutput(record: StatementOutputRecord): Promise<string> {
        const normalized = normalizeOutput(record);
        const id = normalized.id || makeStatementOutputId(
            normalized.source,
            normalized.kind,
            normalized.yearMonth,
            normalized.statementKey
        );
        const payload = cleanForFirestore({
            ...normalized,
            id,
            issuedAt: normalized.status === 'afterIssue'
                ? normalized.issuedAt || new Date().toISOString()
                : normalized.issuedAt,
            updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, COLLECTION_NAME, id), {
            createdAt: serverTimestamp(),
            ...payload,
        }, { merge: true });
        return id;
    },

    async updateOutputStatus(id: string, status: StatementOutputStatus): Promise<void> {
        const normalizedStatus = normalizeStatus(status);
        await updateDoc(doc(db, COLLECTION_NAME, id), cleanForFirestore({
            status: normalizedStatus,
            optionPreset: normalizedStatus,
            issuedAt: normalizedStatus === 'afterIssue' ? new Date().toISOString() : undefined,
            updatedAt: serverTimestamp(),
        }));
    },

    async getOutputsByMonth(yearMonth: string): Promise<StatementOutputRecord[]> {
        const snapshot = await getDocs(query(
            collection(db, COLLECTION_NAME),
            where('yearMonth', '==', toText(yearMonth))
        ));
        return snapshot.docs
            .map((item) => mapDocToOutput(item.id, item.data()))
            .sort((a, b) =>
                a.targetTitle.localeCompare(b.targetTitle, 'ko-KR') ||
                a.kind.localeCompare(b.kind) ||
                a.source.localeCompare(b.source)
            );
    },

    async getOutputs(): Promise<StatementOutputRecord[]> {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        return snapshot.docs
            .map((item) => mapDocToOutput(item.id, item.data()))
            .sort((a, b) =>
                String(b.yearMonth).localeCompare(String(a.yearMonth)) ||
                a.targetTitle.localeCompare(b.targetTitle, 'ko-KR')
            );
    },
};
