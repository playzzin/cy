import {
    listAllAccommodationBillingDocuments,
    listAllAccommodationBillingLineItems,
    createAccommodationBillingDocument,
    updateAccommodationBillingDocument,
    createAccommodationBillingLineItem,
    deleteAccommodationBillingLineItem,
    listAllAdvancePayments,
    createAdvancePayment,
    updateAdvancePayment,
    listAllTeams,
    listAllWorkers
} from './firestoreCrudCompat';
import { Timestamp } from '../types/timestamp';
import {
    AccommodationBillingDocument,
    AccommodationBillingLineItem,
    AccommodationBillingTargetField
} from '../types/accommodationBilling';

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

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
        const teamUuid = isAllTeams ? null : await resolveTeamUuid(params.teamId);

        const filteredDocs = docs.filter((d: any) => {
            if (String(d?.yearMonth ?? '') !== String(params.yearMonth)) return false;

            // ?꾪? 議고쉶??寃쎌슦 ?붾쭔 留욎쑝硫??듦낵
            if (isAllTeams) return true;

            const dcTeamId = d?.team?.id ? String(d.team.id) : '';
            const dcTeamLegacyId = d?.team?.legacyId ? String(d.team.legacyId) : '';
            if (params.teamId && (dcTeamLegacyId === params.teamId || dcTeamId === params.teamId)) return true;
            return teamUuid ? dcTeamId === teamUuid : false;
        });

        return filteredDocs.map((d: any) => {
            const teamId = d?.team?.legacyId ? String(d.team.legacyId) : (d?.team?.id ? String(d.team.id) : String(d?.teamId ?? ''));
            const issuedToWorkerId = d?.issuedToWorker?.legacyId
                ? String(d.issuedToWorker.legacyId)
                : (d?.issuedToWorker?.id ? String(d.issuedToWorker.id) : String(d?.issuedToWorkerId ?? ''));

            const rawIssuedToType = d?.issuedToType ? String(d.issuedToType) : 'worker';
            const issuedToType = rawIssuedToType === 'team_leader' ? 'team' : rawIssuedToType;

            const lineItems = items
                .filter((li: any) => String(li?.billingDocument?.id ?? '') === String(d?.id ?? ''))
                .map((li: any) => {
                    return {
                        id: String(li?.id ?? ''),
                        label: li?.label ? String(li.label) : '',
                        amount: typeof li?.amount === 'number' && Number.isFinite(li.amount) ? li.amount : 0,
                        targetField: (li?.targetField ? String(li.targetField) : 'accommodation') as AccommodationBillingTargetField
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

    async upsertBillingDocument(docData: Omit<AccommodationBillingDocument, 'createdAt' | 'updatedAt'>): Promise<string> {
        const teamUuid = await resolveTeamUuid(docData.teamId);
        const issuedToTypeRaw = docData.issuedToType ? String(docData.issuedToType) : 'worker';
        const issuedToType = issuedToTypeRaw === 'team_leader' ? 'team' : issuedToTypeRaw;
        const shouldRequireWorker = issuedToType === 'worker';
        const workerUuid = shouldRequireWorker ? await resolveWorkerUuid(docData.issuedToWorkerId ?? '') : null;
        if (!teamUuid) throw new Error('???李얠쓣 ???놁뒿?덈떎.');
        if (shouldRequireWorker && !workerUuid) throw new Error('?묒뾽?먮? 李얠쓣 ???놁뒿?덈떎.');

        const issuedToWorkerName = issuedToType === 'team'
            ? (docData.teamName ?? '')
            : (docData.issuedToWorkerName ?? null);

        const updateRes = await updateAccommodationBillingDocument({
            id: docData.id,
            yearMonth: docData.yearMonth ?? null,
            teamId: teamUuid,
            teamName: docData.teamName ?? null,
            issuedToType: issuedToType ?? null,
            issuedToWorkerId: workerUuid,
            issuedToWorkerName,
            status: docData.status ?? null,
            memo: docData.memo ?? null,
            confirmedAt: docData.confirmedAt ? docData.confirmedAt.toDate().toISOString() : null,
            postedAdvancePaymentId: docData.postedAdvancePaymentId ?? null
        } as any);

        const updatedOk = (updateRes as any)?.data?.accommodationBillingDocument_update;
        if (!updatedOk) {
            await createAccommodationBillingDocument({
                id: docData.id,
                yearMonth: docData.yearMonth,
                teamId: teamUuid,
                teamName: docData.teamName ?? null,
                issuedToType: issuedToType ?? null,
                issuedToWorkerId: workerUuid,
                issuedToWorkerName,
                status: docData.status ?? 'draft',
                memo: docData.memo ?? null,
                confirmedAt: docData.confirmedAt ? docData.confirmedAt.toDate().toISOString() : null,
                postedAdvancePaymentId: docData.postedAdvancePaymentId ?? null
            } as any);
        }

        const listItemsRes = await listAllAccommodationBillingLineItems();
        const existingItems = (listItemsRes as any)?.data?.accommodationBillingLineItems ?? [];
        const toDelete = existingItems.filter((li: any) => String(li?.billingDocument?.id ?? '') === String(docData.id));
        await Promise.all(
            toDelete.map(async (li: any) => {
                const liId = li?.id ? String(li.id) : '';
                if (!liId) return;
                await deleteAccommodationBillingLineItem({ id: liId } as any);
            })
        );

        await Promise.all(
            (docData.lineItems ?? []).map(async (li) => {
                const id = String(li.id);
                await createAccommodationBillingLineItem({
                    id,
                    billingDocumentId: docData.id,
                    label: li.label ?? null,
                    amount: Number.isFinite(li.amount) ? li.amount : 0,
                    targetField: li.targetField ?? null
                } as any);
            })
        );

        return docData.id;
    },

    async confirmAndPostToAdvancePayment(billingId: string): Promise<void> {
        const [docsRes, itemsRes] = await Promise.all([
            listAllAccommodationBillingDocuments(),
            listAllAccommodationBillingLineItems()
        ]);
        const docs = (docsRes as any)?.data?.accommodationBillingDocuments ?? [];
        const items = (itemsRes as any)?.data?.accommodationBillingLineItems ?? [];

        const row = docs.find((d: any) => String(d?.id ?? '') === String(billingId));
        if (!row) throw new Error('泥?뎄?쒕? 李얠쓣 ???놁뒿?덈떎.');
        if (String(row?.status ?? '') === 'confirmed') return;

        const rawIssuedToType = row?.issuedToType ? String(row.issuedToType) : 'worker';
        const issuedToType = rawIssuedToType === 'team_leader' ? 'team' : rawIssuedToType;
        if (issuedToType === 'team') {
            await updateAccommodationBillingDocument({
                id: billingId,
                status: 'confirmed',
                confirmedAt: new Date().toISOString(),
                postedAdvancePaymentId: null
            } as any);
            return;
        }

        const billing: AccommodationBillingDocument = {
            id: String(row?.id ?? ''),
            yearMonth: String(row?.yearMonth ?? ''),
            teamId: row?.team?.legacyId ? String(row.team.legacyId) : (row?.team?.id ? String(row.team.id) : ''),
            teamName: row?.teamName ? String(row.teamName) : (row?.team?.name ? String(row.team.name) : ''),
            issuedToType: issuedToType as any,
            issuedToWorkerId: row?.issuedToWorker?.legacyId
                ? String(row.issuedToWorker.legacyId)
                : (row?.issuedToWorker?.id ? String(row.issuedToWorker.id) : ''),
            issuedToWorkerName: row?.issuedToWorkerName ? String(row.issuedToWorkerName) : (row?.issuedToWorker?.name ? String(row.issuedToWorker.name) : ''),
            status: (row?.status ? String(row.status) : 'draft') as any,
            memo: row?.memo ? String(row.memo) : undefined,
            lineItems: items
                .filter((li: any) => String(li?.billingDocument?.id ?? '') === String(billingId))
                .map((li: any) => {
                    return {
                        id: String(li?.id ?? ''),
                        label: li?.label ? String(li.label) : '',
                        amount: typeof li?.amount === 'number' && Number.isFinite(li.amount) ? li.amount : 0,
                        targetField: (li?.targetField ? String(li.targetField) : 'accommodation') as AccommodationBillingTargetField
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

        await updateAccommodationBillingDocument({
            id: billingId,
            status: 'confirmed',
            confirmedAt: new Date().toISOString(),
            postedAdvancePaymentId: advanceId
        } as any);
    },

    getAdvanceFieldForTargetField: mapTargetFieldToAdvanceField,

    calculateLineItemsTotal(lineItems: AccommodationBillingLineItem[]): number {
        return lineItems.reduce((sum, li) => sum + (Number.isFinite(li.amount) ? li.amount : 0), 0);
    }
};

