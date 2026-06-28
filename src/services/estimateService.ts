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
import type { StatementOutputSource } from '../types/statementOutput';

export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected';
export type EstimateRequestType = 'construction' | 'uxui' | 'development' | 'build' | 'modify';
export type DocumentType = 'estimate' | 'transaction';
export type EstimateTemplateType = 'standard' | 'detailed';

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
    itemDate?: string;

    // --- 추가 필드 (임대료 방식) ---
    laborUnitPrice?: number;    // 인건비 단가
    rentalUnitPrice?: number;   // 임대료 단가
    period?: number;            // 기 (기간)

    // --- 추가 필드 (팀별 지원 현황용) ---
    teamName?: string;
    itemType?: 'outgoing' | 'incoming';
    additionalAmount?: number;
    status?: string;
    remarks?: string;
    etc?: string;

    // --- 상세 산출 확장 필드 ---
    calculationType?: string;
    length?: number;
    width?: number;
    count?: number;
    unitMode?: string;
}

export interface Estimate {
    id?: string;
    documentType?: DocumentType;
    templateType?: EstimateTemplateType;
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
    estimateMode?: 'standard' | 'rental';

    // 공급자 정보 (청연)
    supplierCompany?: string;
    supplierBizNo?: string;
    supplierName?: string;
    supplierAddress?: string;
    supplierContact?: string;
    supplierFax?: string;
    supplierAccount?: string;
    supplierManager?: string;
    supplierManagerContact?: string;

    supportStatementKey?: string;
    supportStatementSource?: StatementOutputSource;
    supportStatementYearMonth?: string;
    supportStatementTargetTitle?: string;
    supportStatementTargetSubtitle?: string;

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

const normalizeSupportStatementSource = (value: unknown): StatementOutputSource | undefined =>
    value === 'support-client-site' || value === 'progress-claims' || value === 'support-team-payment'
        ? value
        : undefined;

export const normalizeEstimateItem = (raw: Partial<EstimateItem> | any): EstimateItem => {
    const quantity = toNumber(raw?.quantity, 1);
    const height = raw?.height !== undefined && raw?.height !== null ? toNumber(raw.height) : null;
    const point = raw?.point !== undefined && raw?.point !== null ? toNumber(raw.point) : null;
    const pointBase = toNumber(raw?.pointBase, 4000);
    const pointMultiplier = toNumber(raw?.pointMultiplier, 1500);
    
    const finalUnitPrice = toNumber(raw?.finalUnitPrice ?? raw?.unitPrice);
    const amount = raw?.amount !== undefined ? toNumber(raw.amount) : (finalUnitPrice * quantity);
    const label = String(raw?.label ?? raw?.section ?? raw?.description ?? '견적 항목').trim();

    const item: any = {
        id: String(raw?.id ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        category: String(raw?.category ?? '일반').trim(),
        section: String(raw?.section ?? label).trim(),
        label,
        description: raw?.description ? String(raw.description) : '',
        workType: raw?.workType ? String(raw.workType) : '',
        unit: raw?.unit ? String(raw.unit) : '',
        quantity,
        pointBase,
        pointMultiplier,
        pointUnitPrice: raw?.pointUnitPrice !== undefined ? toNumber(raw.pointUnitPrice) : 0,
        pointAmount: raw?.pointAmount !== undefined ? toNumber(raw.pointAmount) : 0,
        calculatedUnitPrice: raw?.calculatedUnitPrice !== undefined ? toNumber(raw.calculatedUnitPrice) : 0,
        finalUnitPrice,
        unitPrice: finalUnitPrice,
        amount,
        isOptional: Boolean(raw?.isOptional),
        note: raw?.note ? String(raw.note) : '',
        itemDate: raw?.itemDate ? String(raw.itemDate) : (raw?.date ? String(raw.date) : ''),
        date: raw?.date ? String(raw.date) : '',

        // 임대료 방식 필드
        laborUnitPrice: toNumber(raw?.laborUnitPrice, 0),
        rentalUnitPrice: toNumber(raw?.rentalUnitPrice, 0),
        period: toNumber(raw?.period, 1),

        // 추가 필드 매핑
        teamName: String(raw?.teamName || '').trim(),
        itemType: (raw?.itemType || 'outgoing') as 'outgoing' | 'incoming',
        additionalAmount: toNumber(raw?.additionalAmount, 0),
        status: String(raw?.status || '').trim(),
        remarks: String(raw?.remarks || '').trim(),
        etc: String(raw?.etc || '').trim()
    };

    if (height !== null) item.height = height;
    if (point !== null) item.point = point;
    if (raw?.calculationType) item.calculationType = String(raw.calculationType);
    if (raw?.length !== undefined && raw?.length !== null) item.length = toNumber(raw.length);
    if (raw?.width !== undefined && raw?.width !== null) item.width = toNumber(raw.width);
    if (raw?.count !== undefined && raw?.count !== null) item.count = toNumber(raw.count, 1);
    if (raw?.unitMode) item.unitMode = String(raw.unitMode);
    if (raw?.install50 !== undefined && raw?.install50 !== null) item.install50 = toNumber(raw.install50);
    if (raw?.remove50 !== undefined && raw?.remove50 !== null) item.remove50 = toNumber(raw.remove50);

    return item as EstimateItem;
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
        documentType: (raw?.documentType || 'estimate') as DocumentType,
        templateType: raw?.templateType === 'detailed' ? 'detailed' : 'standard',
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
        estimateMode: (raw?.estimateMode || 'standard') as 'standard' | 'rental',

        // 공급자 정보 매핑
        supplierCompany: raw?.supplierCompany || '',
        supplierBizNo: raw?.supplierBizNo || '',
        supplierName: raw?.supplierName || '',
        supplierAddress: raw?.supplierAddress || '',
        supplierContact: raw?.supplierContact || '',
        supplierFax: raw?.supplierFax || '',
        supplierAccount: raw?.supplierAccount || '',
        supplierManager: raw?.supplierManager || '',
        supplierManagerContact: raw?.supplierManagerContact || '',

        supportStatementKey: raw?.supportStatementKey ? String(raw.supportStatementKey) : '',
        supportStatementSource: normalizeSupportStatementSource(raw?.supportStatementSource),
        supportStatementYearMonth: raw?.supportStatementYearMonth ? String(raw.supportStatementYearMonth) : '',
        supportStatementTargetTitle: raw?.supportStatementTargetTitle ? String(raw.supportStatementTargetTitle) : '',
        supportStatementTargetSubtitle: raw?.supportStatementTargetSubtitle ? String(raw.supportStatementTargetSubtitle) : '',

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
            templateType: estimate.templateType || 'standard',
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
