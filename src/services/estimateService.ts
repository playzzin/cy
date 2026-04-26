import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';

export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected';
export type EstimateRequestType = 'construction' | 'uxui' | 'development' | 'build' | 'modify';
export type DocumentType = 'estimate' | 'transaction';

export interface EstimateItem {
    id: string;
    category: string;
    section: string;
    label: string;
    description?: string;
    workType?: string;
    unit?: string;
    height?: number;
    quantity: number;
    point?: number;
    pointBase?: number;
    pointMultiplier?: number;
    pointUnitPrice?: number;
    pointAmount?: number;
    calculatedUnitPrice?: number;
    finalUnitPrice: number;
    unitPrice: number;
    amount: number;
    isOptional?: boolean;
    note?: string;
    install50?: number;
    remove50?: number;
    date?: string;
}

export interface Estimate {
    id?: string;
    documentType?: DocumentType;
    estimateNo?: string;
    title: string;
    projectName?: string;
    clientName: string;
    clientCompany?: string;
    clientContact?: string;
    requestType?: EstimateRequestType;
    status: EstimateStatus;
    issueDate?: string;
    validUntil?: Timestamp;
    items: EstimateItem[];
    subtotal: number;
    optionalSubtotal?: number;
    discount?: number;
    tax?: number;
    vatRate?: number;
    includeVat?: boolean;
    total: number;
    paymentTerms?: string;
    scopeNotes?: string;
    notes?: string;
    installRatio?: number;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

const COLLECTION_NAME = 'estimates';

const toNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const stripUndefined = <T extends Record<string, unknown>>(value: T): T => {
    return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== undefined)
    ) as T;
};

export const normalizeEstimateItem = (raw: Partial<EstimateItem> | any): EstimateItem => {
    const quantity = toNumber(raw?.quantity, 1);
    const height = raw?.height === undefined ? undefined : toNumber(raw.height);
    const point = raw?.point === undefined ? undefined : toNumber(raw.point);
    const pointBase = toNumber(raw?.pointBase, 4000);
    const pointMultiplier = toNumber(raw?.pointMultiplier, 1500);
    const computedPointUnitPrice =
        raw?.pointUnitPrice !== undefined
            ? toNumber(raw.pointUnitPrice)
            : height !== undefined
                ? height * pointMultiplier + pointBase
                : 0;
    const computedPointAmount =
        raw?.pointAmount !== undefined
            ? toNumber(raw.pointAmount)
            : computedPointUnitPrice * toNumber(point);
    const calculatedUnitPrice =
        raw?.calculatedUnitPrice !== undefined
            ? toNumber(raw.calculatedUnitPrice)
            : quantity > 0
                ? computedPointAmount / quantity
                : 0;
    const finalUnitPrice = toNumber(raw?.finalUnitPrice ?? raw?.unitPrice);
    const amount = finalUnitPrice * quantity;
    const label = String(raw?.label ?? raw?.section ?? raw?.description ?? '견적 항목').trim();

    return {
        id: String(raw?.id ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        category: String(raw?.category ?? '일반').trim(),
        section: String(raw?.section ?? label).trim(),
        label,
        description: raw?.description ? String(raw.description) : '',
        workType: raw?.workType ? String(raw.workType) : '',
        unit: raw?.unit ? String(raw.unit) : '식',
        height,
        quantity,
        point,
        pointBase,
        pointMultiplier,
        pointUnitPrice: computedPointUnitPrice,
        pointAmount: computedPointAmount,
        calculatedUnitPrice,
        finalUnitPrice,
        unitPrice: finalUnitPrice,
        amount,
        isOptional: Boolean(raw?.isOptional),
        note: raw?.note ? String(raw.note) : '',
        install50: raw?.install50 !== undefined ? toNumber(raw.install50) : undefined,
        remove50: raw?.remove50 !== undefined ? toNumber(raw.remove50) : undefined,
        date: raw?.date ? String(raw.date) : ''
    };
};

const normalizeEstimate = (id: string, raw: any): Estimate => {
    const items: EstimateItem[] = Array.isArray(raw?.items) ? raw.items.map(normalizeEstimateItem) : [];
    const requiredSubtotal = items
        .filter((item) => !item.isOptional)
        .reduce((sum, item) => sum + (item.amount || 0), 0);
    const optionalSubtotal = items
        .filter((item) => item.isOptional)
        .reduce((sum, item) => sum + (item.amount || 0), 0);
    const discount = toNumber(raw?.discount);
    const tax = toNumber(raw?.tax);
    const total = toNumber(raw?.total, Math.max(requiredSubtotal - discount, 0) + tax);

    return {
        id,
        estimateNo: raw?.estimateNo ? String(raw.estimateNo) : '',
        title: String(raw?.title ?? '견적서'),
        projectName: raw?.projectName ? String(raw.projectName) : '',
        clientName: String(raw?.clientName ?? ''),
        clientCompany: raw?.clientCompany ? String(raw.clientCompany) : '',
        clientContact: raw?.clientContact ? String(raw.clientContact) : '',
        requestType: (raw?.requestType ?? 'construction') as EstimateRequestType,
        status: (raw?.status ?? 'draft') as EstimateStatus,
        issueDate: raw?.issueDate ? String(raw.issueDate) : '',
        validUntil: raw?.validUntil,
        items,
        subtotal: toNumber(raw?.subtotal, requiredSubtotal),
        optionalSubtotal: toNumber(raw?.optionalSubtotal, optionalSubtotal),
        discount,
        tax,
        vatRate: toNumber(raw?.vatRate, 10),
        includeVat: raw?.includeVat !== false,
        total,
        paymentTerms: raw?.paymentTerms ? String(raw.paymentTerms) : '',
        scopeNotes: raw?.scopeNotes ? String(raw.scopeNotes) : '',
        notes: raw?.notes ? String(raw.notes) : '',
        installRatio: raw?.installRatio !== undefined ? toNumber(raw.installRatio, 50) : 50,
        createdAt: raw?.createdAt,
        updatedAt: raw?.updatedAt
    };
};

export const estimateService = {
    addEstimate: async (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), stripUndefined({
            ...estimate,
            status: estimate.status || 'draft',
            requestType: estimate.requestType || 'construction',
            items: (estimate.items || []).map(normalizeEstimateItem),
            discount: estimate.discount ?? 0,
            optionalSubtotal: estimate.optionalSubtotal ?? 0,
            tax: estimate.tax ?? 0,
            vatRate: estimate.vatRate ?? 10,
            includeVat: estimate.includeVat ?? true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }));
        return docRef.id;
    },

    updateEstimate: async (id: string, estimate: Partial<Estimate>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const payload = {
            ...estimate,
            items: estimate.items ? estimate.items.map(normalizeEstimateItem) : undefined,
            updatedAt: serverTimestamp()
        };
        await updateDoc(docRef, stripUndefined(payload));
    },

    deleteEstimate: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    },

    getEstimates: async (): Promise<Estimate[]> => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((snap) => normalizeEstimate(snap.id, snap.data()));
    }
};
