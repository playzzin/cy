import {
    listAllAccommodationBillingDocuments,
    listAllAccommodationBillingLineItems,
    createAccommodationBillingDocument,
    updateAccommodationBillingDocument,
    deleteAccommodationBillingDocument,
    createAccommodationBillingLineItem,
    updateAccommodationBillingLineItem,
    deleteAccommodationBillingLineItem,
    listAllAdvancePayments,
    createAdvancePayment,
    updateAdvancePayment,
    listAllTeams,
    listAllWorkers
} from './firestoreCrudCompat';
import { recordSupportWriteOperationSafely } from './supportWriteOperationLogService';
import { getErrorMessage, reportSupportWriteError, SUPPORT_WRITE_RETRY_USER_MESSAGE } from '../utils/supportWriteErrorReporting';
import { Timestamp } from '../types/timestamp';
import {
    AccommodationBillingDocument,
    AccommodationBillingLineItem,
    AccommodationBillingTargetField
} from '../types/accommodationBilling';

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const OFFICE_BILLING_TEAM_ID = '__office__';
const OFFICE_BILLING_TEAM_NAME = '사무실';

const normalizeAccommodationBillingStatus = (status: unknown): string => (
    String(status ?? '').trim().toUpperCase()
);

export const isDraftAccommodationBillingStatus = (status: unknown): boolean => (
    normalizeAccommodationBillingStatus(status) === 'DRAFT'
);

export const isProtectedAccommodationBillingStatus = (status: unknown): boolean => (
    !isDraftAccommodationBillingStatus(status)
);

const isConfirmedBilling = (billing?: Pick<AccommodationBillingDocument, 'status'> | null): boolean => (
    normalizeAccommodationBillingStatus(billing?.status) === 'CONFIRMED'
);

export interface AccommodationDraftBillingUpsertResult {
    id: string;
    action: 'created' | 'replaced' | 'skipped-protected';
    protectedStatus?: string;
}

const isActiveLineItemRow = (row: any): boolean => (
    String(row?.status ?? 'active').trim().toLowerCase() !== 'cancelled' && !row?.cancelledAt
);

const normalizeBillingTargetText = (value: unknown): string => (
    String(value ?? '').trim().toLowerCase().replace(/\s+/g, '')
);

const isOfficeBillingTeam = (teamId?: unknown, teamName?: unknown): boolean => (
    normalizeBillingTargetText(teamId) === normalizeBillingTargetText(OFFICE_BILLING_TEAM_ID) ||
    normalizeBillingTargetText(teamName) === normalizeBillingTargetText(OFFICE_BILLING_TEAM_NAME)
);

const toFirestoreTimestamp = (value?: string | null): Timestamp | undefined => {
    if (!value) return undefined;
    try {
        return Timestamp.fromDate(new Date(value));
    } catch {
        return undefined;
    }
};

let dcTeamsLoaded = false;
let dcWorkersLoaded = false;

const dcTeamLegacyIdToUuid = new Map<string, string>();
const dcWorkerLegacyIdToUuid = new Map<string, string>();

const loadDcTeams = async (): Promise<void> => {
    if (dcTeamsLoaded) return;
    const res = await listAllTeams();
    const rows = (res as any)?.data?.teams ?? [];
    dcTeamLegacyIdToUuid.clear();
    rows.forEach((t: any) => {
        const id = t?.id ? String(t.id) : '';
        const legacyId = t?.legacyId ? String(t.legacyId) : '';
        if (id) dcTeamLegacyIdToUuid.set(id, id);
        if (legacyId) dcTeamLegacyIdToUuid.set(legacyId, id);
    });
    dcTeamsLoaded = true;
};

const loadDcWorkers = async (): Promise<void> => {
    if (dcWorkersLoaded) return;
    const res = await listAllWorkers();
    const rows = (res as any)?.data?.workers ?? [];
    dcWorkerLegacyIdToUuid.clear();
    rows.forEach((w: any) => {
        const id = w?.id ? String(w.id) : '';
        const legacyId = w?.legacyId ? String(w.legacyId) : '';
        if (id) dcWorkerLegacyIdToUuid.set(id, id);
        if (legacyId) dcWorkerLegacyIdToUuid.set(legacyId, id);
    });
    dcWorkersLoaded = true;
};

const resolveTeamUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcTeams();
    const found = dcTeamLegacyIdToUuid.get(raw);
    if (found) return found;
    dcTeamsLoaded = false;
    await loadDcTeams();
    return dcTeamLegacyIdToUuid.get(raw) ?? null;
};

const resolveWorkerUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcWorkers();
    const found = dcWorkerLegacyIdToUuid.get(raw);
    if (found) return found;
    dcWorkersLoaded = false;
    await loadDcWorkers();
    return dcWorkerLegacyIdToUuid.get(raw) ?? null;
};

const safeJsonParseRecord = (value: unknown): Record<string, number> => {
    if (!value) return {};
    if (typeof value !== 'string') return {};
    const raw = value.trim();
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'number' && Number.isFinite(v) ? v : 0])
        );
    } catch {
        return {};
    }
};

const calculateAdvanceTotal = (params: {
    prevMonthCarryover: number;
    accommodation: number;
    privateRoom: number;
    gloves: number;
    deposit: number;
    fines: number;
    electricity: number;
    gas: number;
    internet: number;
    water: number;
    items: Record<string, number>;
}): number => {
    const base =
        params.prevMonthCarryover +
        params.accommodation +
        params.privateRoom +
        params.gloves +
        params.deposit +
        params.fines +
        params.electricity +
        params.gas +
        params.internet +
        params.water;

    const dynamic = Object.values(params.items).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
    return base + dynamic;
};

type AdvancePaymentField =
    | 'prevMonthCarryover'
    | 'accommodation'
    | 'privateRoom'
    | 'gloves'
    | 'deposit'
    | 'fines'
    | 'electricity'
    | 'gas'
    | 'internet'
    | 'water'
    | 'totalDeduction';

interface AdvancePaymentDoc {
    id?: string;
    workerId: string;
    workerName: string;
    teamId: string;
    teamName: string;
    yearMonth: string;
    prevMonthCarryover: number;
    accommodation: number;
    privateRoom: number;
    gloves: number;
    deposit: number;
    fines: number;
    electricity: number;
    gas: number;
    internet: number;
    water: number;
    totalDeduction: number;
    updatedAt?: Timestamp;
}

const getFieldSumsFromLineItems = (
    lineItems: AccommodationBillingLineItem[]
): Partial<Record<AdvancePaymentField, number>> => {
    const sums: Partial<Record<AdvancePaymentField, number>> = {};

    lineItems.forEach((li) => {
        const amount = Number.isFinite(li.amount) ? li.amount : 0;
        const key = li.targetField as AdvancePaymentField;
        sums[key] = (sums[key] ?? 0) + amount;
    });

    return sums;
};

const mapTargetFieldToAdvanceField = (
    targetField: AccommodationBillingTargetField
): AdvancePaymentField => {
    if (targetField === 'accommodation') return 'accommodation';
    if (targetField === 'privateRoom') return 'privateRoom';
    if (targetField === 'electricity') return 'electricity';
    if (targetField === 'gas') return 'gas';
    if (targetField === 'internet') return 'internet';
    if (targetField === 'water') return 'water';
    if (targetField === 'fines') return 'fines';
    if (targetField === 'deposit') return 'deposit';
    return 'gloves';
};

const POSTING_FIELDS: AdvancePaymentField[] = [
    'accommodation',
    'privateRoom',
    'electricity',
    'gas',
    'internet',
    'water',
    'fines',
    'deposit',
    'gloves'
];

const getRelatedId = (row: any, relationKey: string, flatKey: string): string => {
    const relation = row?.[relationKey];
    if (relation?.legacyId) return String(relation.legacyId);
    if (relation?.id) return String(relation.id);
    if (row?.[flatKey]) return String(row[flatKey]);
    return '';
};

const asFiniteNumber = (value: unknown): number => (
    typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const resetPostedAdvancePayment = async (billing: AccommodationBillingDocument): Promise<void> => {
    const advanceId = billing.postedAdvancePaymentId ? String(billing.postedAdvancePaymentId) : '';
    if (!advanceId) return;

    const advancesRes = await listAllAdvancePayments();
    const advances = (advancesRes as any)?.data?.advancePayments ?? [];
    const existing = advances.find((a: any) => String(a?.id ?? '') === advanceId);
    if (!existing) return;

    const existingLinkedBillingId = existing?.accommodationBillingDocId ? String(existing.accommodationBillingDocId) : '';
    if (existingLinkedBillingId && existingLinkedBillingId !== String(billing.id)) return;

    const items = safeJsonParseRecord(existing?.items);
    const prevMonthCarryover = asFiniteNumber(existing?.prevMonthCarryover);
    const resetFields = Object.fromEntries(POSTING_FIELDS.map((field) => [field, 0]));
    const totalDeduction = calculateAdvanceTotal({
        prevMonthCarryover,
        accommodation: 0,
        privateRoom: 0,
        gloves: 0,
        deposit: 0,
        fines: 0,
        electricity: 0,
        gas: 0,
        internet: 0,
        water: 0,
        items
    });

    const [teamUuid, workerUuid] = await Promise.all([
        resolveTeamUuid(billing.teamId),
        resolveWorkerUuid(billing.issuedToWorkerId ?? '')
    ]);

    await updateAdvancePayment({
        id: advanceId,
        yearMonth: existing?.yearMonth ?? billing.yearMonth,
        workerId: (workerUuid ?? getRelatedId(existing, 'worker', 'workerId')) || null,
        workerName: existing?.workerName ?? billing.issuedToWorkerName ?? null,
        teamId: (teamUuid ?? getRelatedId(existing, 'team', 'teamId')) || null,
        teamName: existing?.teamName ?? billing.teamName ?? null,
        items: existing?.items ?? null,
        prevMonthCarryover,
        ...resetFields,
        totalDeduction,
        itemAssignments: existing?.itemAssignments ?? null,
        assignmentType: existing?.assignmentType ?? 'labor',
        memo: existing?.memo ?? null,
        accommodationBillingDocId: null,
        updatedAt: new Date().toISOString()
    } as any);
};

const getLineItemBillingDocumentId = (row: any): string => {
    if (row?.billingDocument?.id) return String(row.billingDocument.id);
    if (row?.billingDocumentId) return String(row.billingDocumentId);
    return '';
};

const normalizeLineItemPayload = (
    billingDocumentId: string,
    lineItem: AccommodationBillingLineItem
): Record<string, unknown> => ({
    id: String(lineItem.id),
    billingDocumentId,
    label: lineItem.label ?? null,
    amount: Number.isFinite(lineItem.amount) ? lineItem.amount : 0,
    targetField: lineItem.targetField ?? null,
    sourceType: lineItem.sourceType ?? null,
    sourceAccommodationId: lineItem.sourceAccommodationId ?? null,
    sourceUtilityRecordId: lineItem.sourceUtilityRecordId ?? null,
    status: 'active',
    cancelledAt: null,
    updatedAt: new Date().toISOString()
});

const normalizeLineItemComparable = (lineItem: Partial<AccommodationBillingLineItem> | any): string => (
    JSON.stringify({
        label: String(lineItem?.label ?? ''),
        amount: Number.isFinite(Number(lineItem?.amount)) ? Number(lineItem.amount) : 0,
        targetField: String(lineItem?.targetField ?? ''),
        sourceType: String(lineItem?.sourceType ?? ''),
        sourceAccommodationId: String(lineItem?.sourceAccommodationId ?? ''),
        sourceUtilityRecordId: String(lineItem?.sourceUtilityRecordId ?? '')
    })
);

const syncAccommodationBillingLineItems = async (
    billingDocumentId: string,
    nextLineItems: AccommodationBillingLineItem[]
): Promise<void> => {
    const listItemsRes = await listAllAccommodationBillingLineItems();
    const existingRows = ((listItemsRes as any)?.data?.accommodationBillingLineItems ?? [])
        .filter((li: any) => getLineItemBillingDocumentId(li) === String(billingDocumentId));
    const existingById = new Map<string, any>();
    existingRows.forEach((row: any) => {
        const id = row?.id ? String(row.id) : '';
        if (id) existingById.set(id, row);
    });

    const nextById = new Map<string, AccommodationBillingLineItem>();
    nextLineItems.forEach((item) => {
        const id = String(item.id ?? '').trim();
        if (!id) throw new Error('accommodation-billing-line-item-id-required');
        nextById.set(id, item);
    });

    const createTasks: Promise<unknown>[] = [];
    const updateTasks: Promise<unknown>[] = [];

    nextById.forEach((item, id) => {
        const payload = normalizeLineItemPayload(billingDocumentId, item);
        const existing = existingById.get(id);
        if (!existing) {
            createTasks.push(createAccommodationBillingLineItem(payload as any));
            return;
        }

        const wasCancelled = !isActiveLineItemRow(existing);
        const changed = normalizeLineItemComparable(existing) !== normalizeLineItemComparable(item);
        if (wasCancelled || changed) {
            updateTasks.push(updateAccommodationBillingLineItem(payload as any));
        }
    });

    await Promise.all([...createTasks, ...updateTasks]);

    const now = new Date().toISOString();
    const cancelTasks = existingRows
        .filter((row: any) => isActiveLineItemRow(row))
        .filter((row: any) => {
            const id = row?.id ? String(row.id) : '';
            return Boolean(id) && !nextById.has(id);
        })
        .map((row: any) => updateAccommodationBillingLineItem({
            id: String(row.id),
            status: 'cancelled',
            cancelledAt: now,
            updatedAt: now
        } as any));

    await Promise.all(cancelTasks);
};

const mapAccommodationBillingDocument = (
    row: any,
    items: any[]
): AccommodationBillingDocument => {
    const rawIssuedToType = row?.issuedToType ? String(row.issuedToType) : 'worker';
    const issuedToType = rawIssuedToType === 'team_leader' ? 'team' : rawIssuedToType;

    return {
        id: String(row?.id ?? ''),
        yearMonth: String(row?.yearMonth ?? ''),
        teamId: getRelatedId(row, 'team', 'teamId'),
        teamName: row?.teamName ? String(row.teamName) : (row?.team?.name ? String(row.team.name) : ''),
        issuedToType: issuedToType as any,
        issuedToWorkerId: getRelatedId(row, 'issuedToWorker', 'issuedToWorkerId'),
        issuedToWorkerName: issuedToType === 'team'
            ? (row?.teamName ? String(row.teamName) : (row?.team?.name ? String(row.team.name) : ''))
            : (row?.issuedToWorkerName ? String(row.issuedToWorkerName) : (row?.issuedToWorker?.name ? String(row.issuedToWorker.name) : '')),
        status: (row?.status ? String(row.status) : 'draft') as any,
        memo: row?.memo ? String(row.memo) : undefined,
        lineItems: items
            .filter((li: any) => getLineItemBillingDocumentId(li) === String(row?.id ?? ''))
            .filter(isActiveLineItemRow)
            .map((li: any) => ({
                id: String(li?.id ?? ''),
                label: li?.label ? String(li.label) : '',
                amount: typeof li?.amount === 'number' && Number.isFinite(li.amount) ? li.amount : 0,
                targetField: (li?.targetField ? String(li.targetField) : 'accommodation') as AccommodationBillingTargetField,
                sourceType: li?.sourceType ? String(li.sourceType) as any : undefined,
                sourceAccommodationId: li?.sourceAccommodationId ? String(li.sourceAccommodationId) : undefined,
                sourceUtilityRecordId: li?.sourceUtilityRecordId ? String(li.sourceUtilityRecordId) : undefined
            } as AccommodationBillingLineItem)),
        createdAt: toFirestoreTimestamp(row?.createdAt),
        updatedAt: toFirestoreTimestamp(row?.updatedAt),
        confirmedAt: toFirestoreTimestamp(row?.confirmedAt),
        postedAdvancePaymentId: row?.postedAdvancePaymentId ? String(row.postedAdvancePaymentId) : undefined
    } as unknown as AccommodationBillingDocument;
};

const findAccommodationBillingDocumentById = async (id: string): Promise<AccommodationBillingDocument | null> => {
    if (!id) return null;
    const [docsRes, itemsRes] = await Promise.all([
        listAllAccommodationBillingDocuments(),
        listAllAccommodationBillingLineItems()
    ]);
    const docs = (docsRes as any)?.data?.accommodationBillingDocuments ?? [];
    const items = (itemsRes as any)?.data?.accommodationBillingLineItems ?? [];
    const row = docs.find((d: any) => String(d?.id ?? '') === String(id));
    return row ? mapAccommodationBillingDocument(row, items) : null;
};

export const accommodationBillingService = {
    buildBillingDocumentId: (params: {
        teamId: string;
        issuedToType: 'team' | 'team_leader' | 'worker';
        workerId?: string;
        yearMonth: string;
    }): string => {
        const workerPart = params.workerId ? params.workerId : 'none';
        return `${params.teamId}_${params.issuedToType}_${workerPart}_${params.yearMonth}`;
    },

    buildAdvancePaymentId: (params: {
        teamId: string;
        workerId: string;
        yearMonth: string;
    }): string => {
        return `${params.teamId}_${params.workerId}_${params.yearMonth}`;
    },

    async upsertDraftBillingDocument(
        docData: Omit<AccommodationBillingDocument, 'createdAt' | 'updatedAt'>,
        options: { operationId?: string } = {}
    ): Promise<AccommodationDraftBillingUpsertResult> {
        const issuedToType = docData.issuedToType === 'team_leader' ? 'team' : docData.issuedToType;
        const id = accommodationBillingService.buildBillingDocumentId({
            teamId: docData.teamId,
            issuedToType,
            workerId: issuedToType === 'worker' ? docData.issuedToWorkerId : undefined,
            yearMonth: docData.yearMonth
        });
        const existing = await findAccommodationBillingDocumentById(id);
        if (existing && isProtectedAccommodationBillingStatus(existing.status)) {
            return {
                id,
                action: 'skipped-protected',
                protectedStatus: String(existing.status ?? '')
            };
        }

        const draft: Omit<AccommodationBillingDocument, 'createdAt' | 'updatedAt'> = {
            ...docData,
            id,
            issuedToType,
            status: 'draft',
            confirmedAt: undefined,
            postedAdvancePaymentId: undefined
        };

        try {
            await accommodationBillingService.upsertBillingDocument(draft, {
                operationId: options.operationId || `accommodation-billing-draft:${draft.yearMonth}:${id}`
            });
        } catch (error) {
            const message = getErrorMessage(error);
            if (message.includes('accommodation-billing-protected-modification-blocked')) {
                const latest = await findAccommodationBillingDocumentById(id);
                return {
                    id,
                    action: 'skipped-protected',
                    protectedStatus: String(latest?.status ?? '')
                };
            }
            throw error;
        }

        return { id, action: existing ? 'replaced' : 'created' };
    },

    async getBillingDocuments(params: {
        teamId: string;
        yearMonth: string;
    }): Promise<AccommodationBillingDocument[]> {
        const [docsRes, itemsRes] = await Promise.all([
            listAllAccommodationBillingDocuments(),
            listAllAccommodationBillingLineItems()
        ]);

        const docs = (docsRes as any)?.data?.accommodationBillingDocuments ?? [];
        const items = (itemsRes as any)?.data?.accommodationBillingLineItems ?? [];

        const isAllTeams = !params.teamId || params.teamId === 'all';
        const isOfficeTeamFilter = isOfficeBillingTeam(params.teamId);
        const teamUuid = isAllTeams || isOfficeTeamFilter ? null : await resolveTeamUuid(params.teamId);

        const filteredDocs = docs.filter((d: any) => {
            if (String(d?.yearMonth ?? '') !== String(params.yearMonth)) return false;

            // ?꾪? 議고쉶??寃쎌슦 ?붾쭔 留욎쑝硫??듦낵
            if (isAllTeams) return true;

            const dcTeamId = d?.team?.id ? String(d.team.id) : (d?.teamId ? String(d.teamId) : '');
            const dcTeamLegacyId = d?.team?.legacyId ? String(d.team.legacyId) : '';
            if (isOfficeTeamFilter) return isOfficeBillingTeam(dcTeamId || dcTeamLegacyId, d?.teamName);
            if (params.teamId && (dcTeamLegacyId === params.teamId || dcTeamId === params.teamId)) return true;
            return teamUuid ? dcTeamId === teamUuid : false;
        });

        return filteredDocs.map((d: any) => {
            const teamId = getRelatedId(d, 'team', 'teamId');
            const issuedToWorkerId = getRelatedId(d, 'issuedToWorker', 'issuedToWorkerId');

            const rawIssuedToType = d?.issuedToType ? String(d.issuedToType) : 'worker';
            const issuedToType = rawIssuedToType === 'team_leader' ? 'team' : rawIssuedToType;

            const lineItems = items
                .filter((li: any) => getLineItemBillingDocumentId(li) === String(d?.id ?? ''))
                .filter(isActiveLineItemRow)
                .map((li: any) => {
                    return {
                        id: String(li?.id ?? ''),
                        label: li?.label ? String(li.label) : '',
                        amount: typeof li?.amount === 'number' && Number.isFinite(li.amount) ? li.amount : 0,
                        targetField: (li?.targetField ? String(li.targetField) : 'accommodation') as AccommodationBillingTargetField,
                        sourceType: li?.sourceType ? String(li.sourceType) as any : undefined,
                        sourceAccommodationId: li?.sourceAccommodationId ? String(li.sourceAccommodationId) : undefined,
                        sourceUtilityRecordId: li?.sourceUtilityRecordId ? String(li.sourceUtilityRecordId) : undefined
                    } as AccommodationBillingLineItem;
                });

            return {
                id: String(d?.id ?? ''),
                yearMonth: String(d?.yearMonth ?? ''),
                teamId,
                teamName: d?.teamName ? String(d.teamName) : (d?.team?.name ? String(d.team.name) : ''),
                issuedToType: issuedToType as any,
                issuedToWorkerId: issuedToWorkerId || undefined,
                issuedToWorkerName: issuedToType === 'team'
                    ? (d?.teamName ? String(d.teamName) : (d?.team?.name ? String(d.team.name) : ''))
                    : (d?.issuedToWorkerName ? String(d.issuedToWorkerName) : (d?.issuedToWorker?.name ? String(d.issuedToWorker.name) : '')),
                status: (d?.status ? String(d.status) : 'draft') as any,
                memo: d?.memo ? String(d.memo) : undefined,
                lineItems,
                createdAt: toFirestoreTimestamp(d?.createdAt),
                updatedAt: toFirestoreTimestamp(d?.updatedAt),
                confirmedAt: toFirestoreTimestamp(d?.confirmedAt),
                postedAdvancePaymentId: d?.postedAdvancePaymentId ? String(d.postedAdvancePaymentId) : undefined
            } as AccommodationBillingDocument;
        });
    },

    async upsertBillingDocument(
        docData: Omit<AccommodationBillingDocument, 'createdAt' | 'updatedAt'>,
        options: { operationId?: string } = {}
    ): Promise<string> {
        const operationId = String(options.operationId ?? '').trim() || `accommodation-billing:${docData.yearMonth}:${docData.id}`;
        const affectedDocumentIds = [
            docData.id,
            ...(docData.lineItems ?? []).map((item) => item.id)
        ].filter(Boolean);

        try {
        const isOfficeTeam = isOfficeBillingTeam(docData.teamId, docData.teamName);
        const teamUuid = isOfficeTeam ? null : await resolveTeamUuid(docData.teamId);
        const issuedToTypeRaw = docData.issuedToType ? String(docData.issuedToType) : 'worker';
        const issuedToType = issuedToTypeRaw === 'team_leader' ? 'team' : issuedToTypeRaw;
        const shouldRequireWorker = issuedToType === 'worker';
        const workerUuid = shouldRequireWorker ? await resolveWorkerUuid(docData.issuedToWorkerId ?? '') : null;
        if (!teamUuid && !isOfficeTeam) throw new Error('???李얠쓣 ???놁뒿?덈떎.');
        if (shouldRequireWorker && !workerUuid) throw new Error('?묒뾽?먮? 李얠쓣 ???놁뒿?덈떎.');

        const beforeBilling = await findAccommodationBillingDocumentById(docData.id);
        if (beforeBilling && isProtectedAccommodationBillingStatus(beforeBilling.status)) {
            throw new Error(`accommodation-billing-protected-modification-blocked:${String(beforeBilling.status ?? '')}`);
        }

        const storedTeamId = teamUuid ?? null;
        const storedTeamName = isOfficeTeam ? OFFICE_BILLING_TEAM_NAME : (docData.teamName ?? null);
        const issuedToWorkerName = issuedToType === 'team'
            ? (storedTeamName ?? '')
            : (docData.issuedToWorkerName ?? null);

        const updatePayload: Record<string, unknown> = {
            id: docData.id,
            yearMonth: docData.yearMonth ?? null,
            teamId: storedTeamId,
            teamName: storedTeamName,
            issuedToType: issuedToType ?? null,
            issuedToWorkerId: workerUuid,
            issuedToWorkerName,
            memo: docData.memo ?? null,
            lineItemIds: (docData.lineItems ?? []).map((lineItem) => lineItem.id),
        };
        const updateRes = await updateAccommodationBillingDocument(updatePayload as any);

        const updatedOk = (updateRes as any)?.data?.accommodationBillingDocument_update;
        if (!updatedOk) {
            try {
                await createAccommodationBillingDocument({
                    ...updatePayload,
                    yearMonth: docData.yearMonth,
                    status: docData.status ?? 'draft'
                } as any);
            } catch (createError) {
                // A concurrent caller may have created the same deterministic draft id
                // after our first update miss. Retry the update to make the write an upsert.
                const concurrentBilling = await findAccommodationBillingDocumentById(docData.id);
                if (concurrentBilling && isProtectedAccommodationBillingStatus(concurrentBilling.status)) {
                    throw new Error(`accommodation-billing-protected-modification-blocked:${String(concurrentBilling.status ?? '')}`);
                }
                const retryRes = await updateAccommodationBillingDocument(updatePayload as any);
                const retryOk = (retryRes as any)?.data?.accommodationBillingDocument_update;
                if (!retryOk) throw createError;
            }
        }

        // Existing draft updates intentionally do not write status/confirmation fields.
        // If another caller confirms between the first read and metadata update, the
        // confirmation therefore survives and this strict re-read stops line-item writes.
        const guardedBilling = await findAccommodationBillingDocumentById(docData.id);
        if (!guardedBilling) throw new Error('accommodation-billing-document-not-visible-after-upsert');
        if (isProtectedAccommodationBillingStatus(guardedBilling.status)) {
            throw new Error(`accommodation-billing-protected-modification-blocked:${String(guardedBilling.status ?? '')}`);
        }

        await syncAccommodationBillingLineItems(docData.id, docData.lineItems ?? []);

        const savedBilling = {
            ...docData,
            id: docData.id,
            teamId: storedTeamId ?? '',
            teamName: storedTeamName ?? '',
            issuedToType: issuedToType as any,
            issuedToWorkerId: workerUuid ?? '',
            issuedToWorkerName: issuedToWorkerName ?? '',
            lineItems: docData.lineItems ?? [],
            updatedAt: Timestamp.now()
        } as unknown as AccommodationBillingDocument;

        try {
            const { accommodationBillingLogService } = await import('./accommodationBillingLogService');
            await accommodationBillingLogService.createLog({
                action: beforeBilling ? 'updated' : 'created',
                before: beforeBilling,
                after: savedBilling,
                source: 'accommodationBillingService.upsertBillingDocument'
            });
        } catch (logError) {
            console.warn('[accommodationBillingService] accommodation billing log failed:', logError);
        }

        await recordSupportWriteOperationSafely({
            domain: 'accommodation',
            yearMonth: docData.yearMonth,
            operationId,
            status: 'success',
            affectedDocumentIds,
            metadata: {
                billingDocumentId: docData.id,
                lineItemCount: docData.lineItems?.length ?? 0,
                status: docData.status
            }
        });

        return docData.id;
        } catch (error) {
            const failedContext = {
                domain: 'accommodation' as const,
                yearMonth: docData.yearMonth,
                operationId,
                affectedDocumentIds,
                errorMessage: getErrorMessage(error),
                userMessage: SUPPORT_WRITE_RETRY_USER_MESSAGE
            };
            await recordSupportWriteOperationSafely({
                ...failedContext,
                status: 'failed'
            });
            reportSupportWriteError(error, {
                ...failedContext,
                status: 'failed'
            });
            throw error;
        }
    },

    async deleteBillingDocument(id: string): Promise<void> {
        const beforeBilling = await findAccommodationBillingDocumentById(id);
        if (beforeBilling && isProtectedAccommodationBillingStatus(beforeBilling.status)) {
            throw new Error(`accommodation-billing-protected-delete-blocked:${String(beforeBilling.status ?? '')}`);
        }
        const listItemsRes = await listAllAccommodationBillingLineItems();
        const existingItems = (listItemsRes as any)?.data?.accommodationBillingLineItems ?? [];
        const toDelete = existingItems.filter((li: any) => getLineItemBillingDocumentId(li) === String(id));
        const guardedBilling = await findAccommodationBillingDocumentById(id);
        if (guardedBilling && isProtectedAccommodationBillingStatus(guardedBilling.status)) {
            throw new Error(`accommodation-billing-protected-delete-blocked:${String(guardedBilling.status ?? '')}`);
        }
        if (guardedBilling) {
            try {
                await resetPostedAdvancePayment(guardedBilling);
            } catch (advanceError) {
                console.warn('[accommodationBillingService] advance payment reset failed:', advanceError);
            }
        }
        await Promise.all(
            toDelete.map(async (li: any) => {
                const liId = li?.id ? String(li.id) : '';
                if (!liId) return;
                await deleteAccommodationBillingLineItem({ id: liId } as any);
            })
        );
        await deleteAccommodationBillingDocument({ id } as any);
        if (beforeBilling) {
            try {
                const { accommodationBillingLogService } = await import('./accommodationBillingLogService');
                await accommodationBillingLogService.createLog({
                    action: 'deleted',
                    before: beforeBilling,
                    after: null,
                    source: 'accommodationBillingService.deleteBillingDocument'
                });
            } catch (logError) {
                console.warn('[accommodationBillingService] accommodation billing delete log failed:', logError);
            }
        }
    },

    async getBillingDocumentById(id: string): Promise<AccommodationBillingDocument | null> {
        return findAccommodationBillingDocumentById(id);
    },

    async cancelConfirmation(billingId: string): Promise<void> {
        const beforeBilling = await findAccommodationBillingDocumentById(billingId);
        if (!beforeBilling) throw new Error('청구서를 찾을 수 없습니다.');

        if (!isConfirmedBilling(beforeBilling)) return;

        await resetPostedAdvancePayment(beforeBilling);
        await updateAccommodationBillingDocument({
            id: billingId,
            status: 'draft',
            confirmedAt: null,
            postedAdvancePaymentId: null
        } as any);

        try {
            const { accommodationBillingLogService } = await import('./accommodationBillingLogService');
            await accommodationBillingLogService.createLog({
                action: 'updated',
                before: beforeBilling,
                after: {
                    ...beforeBilling,
                    status: 'draft',
                    confirmedAt: undefined,
                    postedAdvancePaymentId: undefined
                } as AccommodationBillingDocument,
                source: 'accommodationBillingService.cancelConfirmation'
            });
        } catch (logError) {
            console.warn('[accommodationBillingService] accommodation billing cancel confirmation log failed:', logError);
        }
    },

    async confirmAndPostToAdvancePayment(billingId: string): Promise<void> {
        const beforeBilling = await findAccommodationBillingDocumentById(billingId);
        const [docsRes, itemsRes] = await Promise.all([
            listAllAccommodationBillingDocuments(),
            listAllAccommodationBillingLineItems()
        ]);
        const docs = (docsRes as any)?.data?.accommodationBillingDocuments ?? [];
        const items = (itemsRes as any)?.data?.accommodationBillingLineItems ?? [];

        const row = docs.find((d: any) => String(d?.id ?? '') === String(billingId));
        if (!row) throw new Error('泥?뎄?쒕? 李얠쓣 ???놁뒿?덈떎.');
        const storedStatus = normalizeAccommodationBillingStatus(row?.status);
        if (storedStatus === 'CONFIRMED') return;
        if (storedStatus !== 'DRAFT') {
            throw new Error(`accommodation-billing-protected-confirmation-blocked:${String(row?.status ?? '')}`);
        }

        const rawIssuedToType = row?.issuedToType ? String(row.issuedToType) : 'worker';
        const issuedToType = rawIssuedToType === 'team_leader' ? 'team' : rawIssuedToType;
        if (issuedToType === 'team') {
            const confirmedAt = new Date().toISOString();
            await updateAccommodationBillingDocument({
                id: billingId,
                status: 'confirmed',
                confirmedAt,
                postedAdvancePaymentId: null
            } as any);
            if (beforeBilling) {
                try {
                    const { accommodationBillingLogService } = await import('./accommodationBillingLogService');
                    await accommodationBillingLogService.createLog({
                        action: 'updated',
                        before: beforeBilling,
                        after: {
                            ...beforeBilling,
                            status: 'confirmed',
                            confirmedAt: Timestamp.fromDate(new Date(confirmedAt)),
                            postedAdvancePaymentId: undefined
                        } as unknown as AccommodationBillingDocument,
                        source: 'accommodationBillingService.confirmAndPostToAdvancePayment'
                    });
                } catch (logError) {
                    console.warn('[accommodationBillingService] accommodation billing confirm log failed:', logError);
                }
            }
            return;
        }

        const billing: AccommodationBillingDocument = {
            id: String(row?.id ?? ''),
            yearMonth: String(row?.yearMonth ?? ''),
            teamId: getRelatedId(row, 'team', 'teamId'),
            teamName: row?.teamName ? String(row.teamName) : (row?.team?.name ? String(row.team.name) : ''),
            issuedToType: issuedToType as any,
            issuedToWorkerId: getRelatedId(row, 'issuedToWorker', 'issuedToWorkerId'),
            issuedToWorkerName: row?.issuedToWorkerName ? String(row.issuedToWorkerName) : (row?.issuedToWorker?.name ? String(row.issuedToWorker.name) : ''),
            status: (row?.status ? String(row.status) : 'draft') as any,
            memo: row?.memo ? String(row.memo) : undefined,
            lineItems: items
                .filter((li: any) => getLineItemBillingDocumentId(li) === String(billingId))
                .filter(isActiveLineItemRow)
                .map((li: any) => {
                    return {
                        id: String(li?.id ?? ''),
                        label: li?.label ? String(li.label) : '',
                        amount: typeof li?.amount === 'number' && Number.isFinite(li.amount) ? li.amount : 0,
                        targetField: (li?.targetField ? String(li.targetField) : 'accommodation') as AccommodationBillingTargetField,
                        sourceType: li?.sourceType ? String(li.sourceType) as any : undefined,
                        sourceAccommodationId: li?.sourceAccommodationId ? String(li.sourceAccommodationId) : undefined,
                        sourceUtilityRecordId: li?.sourceUtilityRecordId ? String(li.sourceUtilityRecordId) : undefined
                    } as AccommodationBillingLineItem;
                })
        };

        if (!billing.teamId || !billing.yearMonth || !billing.issuedToWorkerId) {
            throw new Error('泥?뎄???꾩닔 ?뺣낫媛 ?꾨씫?섏뿀?듬땲??');
        }

        const teamUuid = await resolveTeamUuid(billing.teamId);
        const workerUuid = await resolveWorkerUuid(billing.issuedToWorkerId);
        if (!teamUuid) throw new Error('???李얠쓣 ???놁뒿?덈떎.');
        if (!workerUuid) throw new Error('?묒뾽?먮? 李얠쓣 ???놁뒿?덈떎.');

        const advanceId = this.buildAdvancePaymentId({
            teamId: billing.teamId,
            workerId: billing.issuedToWorkerId,
            yearMonth: billing.yearMonth
        });

        const advancesRes = await listAllAdvancePayments();
        const advances = (advancesRes as any)?.data?.advancePayments ?? [];
        const existing = advances.find((a: any) => String(a?.id ?? '') === String(advanceId));

        const existingItems = safeJsonParseRecord(existing?.items);
        const prevMonthCarryover = typeof existing?.prevMonthCarryover === 'number' && Number.isFinite(existing.prevMonthCarryover)
            ? existing.prevMonthCarryover
            : 0;

        const baseAdvance: AdvancePaymentDoc = {
            id: advanceId,
            workerId: billing.issuedToWorkerId,
            workerName: billing.issuedToWorkerName ?? '',
            teamId: billing.teamId,
            teamName: billing.teamName,
            yearMonth: billing.yearMonth,
            prevMonthCarryover,
            accommodation: 0,
            privateRoom: 0,
            gloves: 0,
            deposit: 0,
            fines: 0,
            electricity: 0,
            gas: 0,
            internet: 0,
            water: 0,
            totalDeduction: 0
        };

        const fieldSums = getFieldSumsFromLineItems(billing.lineItems);
        POSTING_FIELDS.forEach((f) => {
            baseAdvance[f] = 0;
        });

        (Object.keys(fieldSums) as AdvancePaymentField[]).forEach((k) => {
            if (k === 'totalDeduction') return;
            const val = fieldSums[k] ?? 0;
            baseAdvance[k] = val;
        });

        baseAdvance.totalDeduction = calculateAdvanceTotal({
            prevMonthCarryover: baseAdvance.prevMonthCarryover,
            accommodation: baseAdvance.accommodation,
            privateRoom: baseAdvance.privateRoom,
            gloves: baseAdvance.gloves,
            deposit: baseAdvance.deposit,
            fines: baseAdvance.fines,
            electricity: baseAdvance.electricity,
            gas: baseAdvance.gas,
            internet: baseAdvance.internet,
            water: baseAdvance.water,
            items: existingItems
        });

        const payload: any = {
            id: advanceId,
            yearMonth: billing.yearMonth,
            workerId: workerUuid,
            workerName: billing.issuedToWorkerName ?? null,
            teamId: teamUuid,
            teamName: billing.teamName ?? null,
            prevMonthCarryover: baseAdvance.prevMonthCarryover,
            accommodation: baseAdvance.accommodation,
            privateRoom: baseAdvance.privateRoom,
            gloves: baseAdvance.gloves,
            deposit: baseAdvance.deposit,
            fines: baseAdvance.fines,
            electricity: baseAdvance.electricity,
            gas: baseAdvance.gas,
            internet: baseAdvance.internet,
            water: baseAdvance.water,
            totalDeduction: baseAdvance.totalDeduction,
            accommodationBillingDocId: billingId,
            updatedAt: new Date().toISOString()
        };

        const updateRes = await updateAdvancePayment(payload);
        const ok = (updateRes as any)?.data?.advancePayment_update;
        if (!ok) {
            await createAdvancePayment({
                ...payload,
                items: existing?.items ?? null
            } as any);
        }

        const confirmedAt = new Date().toISOString();
        try {
            await updateAccommodationBillingDocument({
                id: billingId,
                status: 'confirmed',
                confirmedAt,
                postedAdvancePaymentId: advanceId
            } as any);
        } catch (billingUpdateError) {
            try {
                await resetPostedAdvancePayment({
                    ...billing,
                    postedAdvancePaymentId: advanceId
                });
            } catch (rollbackError) {
                console.warn('[accommodationBillingService] advance payment rollback failed after confirm failure:', rollbackError);
            }
            throw billingUpdateError;
        }
        if (beforeBilling) {
            try {
                const { accommodationBillingLogService } = await import('./accommodationBillingLogService');
                await accommodationBillingLogService.createLog({
                    action: 'updated',
                    before: beforeBilling,
                    after: {
                        ...beforeBilling,
                        status: 'confirmed',
                        confirmedAt: Timestamp.fromDate(new Date(confirmedAt)),
                        postedAdvancePaymentId: advanceId
                    } as unknown as AccommodationBillingDocument,
                    source: 'accommodationBillingService.confirmAndPostToAdvancePayment'
                });
            } catch (logError) {
                console.warn('[accommodationBillingService] accommodation billing confirm log failed:', logError);
            }
        }
    },

    getAdvanceFieldForTargetField: mapTargetFieldToAdvanceField,

    calculateLineItemsTotal(lineItems: AccommodationBillingLineItem[]): number {
        return lineItems.reduce((sum, li) => sum + (Number.isFinite(li.amount) ? li.amount : 0), 0);
    }
};

