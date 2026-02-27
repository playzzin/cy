import * as sdk from '../dataconnect-generated';
import { executeMutation, executeQuery, mutationRef, queryRef } from 'firebase/data-connect';

export * from '../dataconnect-generated';

const asSdk = sdk as Record<string, any>;
const DEFAULT_LIST_VARS = { limit: 5000, offset: 0 } as const;
const DATA_CONNECT_DEFAULT_LOCATION = 'asia-northeast3';

const envLocation =
    typeof process !== 'undefined' &&
    process &&
    process.env &&
    typeof process.env.REACT_APP_DATACONNECT_LOCATION === 'string'
        ? process.env.REACT_APP_DATACONNECT_LOCATION.trim()
        : '';

const effectiveDataConnectLocation =
    envLocation && envLocation !== 'us-central1'
        ? envLocation
        : DATA_CONNECT_DEFAULT_LOCATION;

if (asSdk.connectorConfig && typeof asSdk.connectorConfig === 'object') {
    asSdk.connectorConfig.location = effectiveDataConnectLocation;
}

const runOptional = async (name: string, args: any[]): Promise<any | null> => {
    const fn = asSdk[name];
    if (typeof fn !== 'function') return null;
    return await fn(...args);
};

const empty = (data: Record<string, unknown>) => ({ data } as any);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const isDataConnectLike = (value: unknown): boolean =>
    isRecord(value) && typeof (value as any)._useGeneratedSdk === 'function';

const withDefaultListVars = (vars: unknown): Record<string, unknown> => {
    if (!isRecord(vars)) return { ...DEFAULT_LIST_VARS };
    return { ...DEFAULT_LIST_VARS, ...vars };
};

const normalizeListArgs = (args: any[]): any[] => {
    if (args.length === 0) return [{ ...DEFAULT_LIST_VARS }];

    const [first, second] = args;
    if (isDataConnectLike(first)) {
        if (second === undefined || second === null) {
            return [first, { ...DEFAULT_LIST_VARS }, ...args.slice(2)];
        }
        if (isRecord(second)) {
            return [first, withDefaultListVars(second), ...args.slice(2)];
        }
        return args;
    }

    // Vars-only overload path (no DataConnect instance passed)
    if (args.length === 1 && (first === undefined || first === null || isRecord(first))) {
        return [withDefaultListVars(first)];
    }

    return args;
};

const sameArgs = (a: any[], b: any[]): boolean =>
    a.length === b.length && a.every((value, idx) => value === b[idx]);

const toOperationName = (functionName: string): string =>
    functionName ? `${functionName[0].toUpperCase()}${functionName.slice(1)}` : functionName;

const runOperationFallback = async (operationName: string, args: any[]): Promise<any | null> => {
    if (!args.length) return null;
    const dcArg = isDataConnectLike(args[0]) ? args[0] : null;
    if (!dcArg) return null;

    const vars = args[1];
    try {
        if (vars === undefined) {
            return await executeQuery(queryRef(dcArg as any, operationName));
        }
        return await executeQuery(queryRef(dcArg as any, operationName, vars));
    } catch (err) { console.error("[dataconnectCompat] Error:", err);
        if (vars === undefined) return null;
        try {
            // Some operations don't accept variables; retry without vars.
            return await executeQuery(queryRef(dcArg as any, operationName));
        } catch (err) { console.error("[dataconnectCompat] Error:", err);
            return null;
        }
    }
};

const runMutationFallback = async (operationName: string, args: any[]): Promise<any | null> => {
    if (!args.length) return null;
    const dcArg = isDataConnectLike(args[0]) ? args[0] : null;
    if (!dcArg) return null;

    const vars = args[1];
    try {
        if (vars === undefined) {
            return await executeMutation(mutationRef(dcArg as any, operationName));
        }
        return await executeMutation(mutationRef(dcArg as any, operationName, vars));
    } catch (err) { console.error("[dataconnectCompat] Error:", err);
        if (vars === undefined) return null;
        try {
            return await executeMutation(mutationRef(dcArg as any, operationName));
        } catch (err) { console.error("[dataconnectCompat] Error:", err);
            return null;
        }
    }
};

const tryMutation = async (preferredNames: string[], args: any[]): Promise<any> => {
    let lastError: unknown = null;

    for (const name of preferredNames) {
        try {
            const res = await runOptional(name, args);
            if (res) return res;
        } catch (error) {
            lastError = error;
        }

        try {
            const res = await runMutationFallback(toOperationName(name), args);
            if (res) return res;
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError) throw lastError;
    throw new Error(`Mutation not available: ${preferredNames.join(', ')}`);
};

const tryList = async (
    preferredNames: string[],
    args: any[],
    emptyKey: string
): Promise<any> => {
    const normalizedArgs = normalizeListArgs(args);
    const attempts = sameArgs(args, normalizedArgs) ? [args] : [args, normalizedArgs];

    for (const name of preferredNames) {
        for (const currentArgs of attempts) {
            try {
                const res = await runOptional(name, currentArgs);
                if (res) return res;
            } catch (err) { console.error("[dataconnectCompat] Error:", err);
                // ignore and continue fallback
            }
        }

        const operationName = toOperationName(name);
        for (const currentArgs of attempts) {
            try {
                const res = await runOperationFallback(operationName, currentArgs);
                if (res) return res;
            } catch (err) { console.error("[dataconnectCompat] Error:", err);
                // ignore and continue fallback
            }
        }
    }
    return empty({ [emptyKey]: [] });
};

// --- Safety Wrappers for list* vs listAll* ---

export const listCards = async (...args: any[]): Promise<any> =>
    tryList(['listAllCards', 'listCards'], args, 'cards');

export const listCardAssignments = async (...args: any[]): Promise<any> =>
    tryList(['listAllCardAssignments', 'listCardAssignments'], args, 'cardAssignments');

export const listCardTransactions = async (...args: any[]): Promise<any> =>
    tryList(['listAllCardTransactions', 'listCardTransactions'], args, 'cardTransactions');

export const listCardBillingDocuments = async (...args: any[]): Promise<any> =>
    tryList(['listAllCardBillingDocuments', 'listCardBillingDocuments'], args, 'cardBillingDocuments');

export const listFreelancers = async (...args: any[]): Promise<any> =>
    tryList(['listAllFreelancers', 'listFreelancers'], args, 'freelancers');

export const listFreelancerPayments = async (...args: any[]): Promise<any> =>
    tryList(['listAllFreelancerPayments', 'listFreelancerPayments'], args, 'freelancerPayments');

export const listWorkers = async (...args: any[]): Promise<any> =>
    tryList(['listAllWorkers', 'listWorkers'], args, 'workers');

export const listAllWorkers = listWorkers;

export const listTeams = async (...args: any[]): Promise<any> =>
    tryList(['listAllTeams', 'listTeams'], args, 'teams');

export const listAllTeams = listTeams;

export const listCompanies = async (...args: any[]): Promise<any> =>
    tryList(['listAllCompanies', 'listCompanies'], args, 'companies');

export const listAllCompanies = listCompanies;

export const listSites = async (...args: any[]): Promise<any> =>
    tryList(['listAllSites', 'listSites'], args, 'sites');

export const listAllSites = listSites;

export const listDailyReports = async (...args: any[]): Promise<any> =>
    tryList(['listAllDailyReports', 'listDailyReports'], args, 'dailyReports');

export const listAllDailyReports = listDailyReports;

export const listDailyReportWorkers = async (...args: any[]): Promise<any> =>
    tryList(['listAllDailyReportWorkers', 'listDailyReportWorkers'], args, 'dailyReportWorkers');

export const listAllDailyReportWorkers = listDailyReportWorkers;

export const listVehicles = async (...args: any[]): Promise<any> =>
    tryList(['listAllVehicles', 'listVehicles'], args, 'vehicles');

export const listAllVehicles = listVehicles;

export const listAllVehicleAssignments = async (...args: any[]): Promise<any> =>
    tryList(['listAllVehicleAssignments', 'listVehicleAssignments'], args, 'vehicleAssignments');

export const listAllVehicleExpenses = async (...args: any[]): Promise<any> =>
    tryList(['listAllVehicleExpenses', 'listVehicleExpenses'], args, 'vehicleExpenses');

export const listAllVehicleBillingDocuments = async (...args: any[]): Promise<any> =>
    tryList(['listAllVehicleBillingDocuments', 'listVehicleBillingDocuments'], args, 'vehicleBillingDocuments');

export const createVehicle = async (...args: any[]): Promise<any> =>
    tryMutation(['createVehicle'], args);

export const updateVehicle = async (...args: any[]): Promise<any> =>
    tryMutation(['updateVehicle'], args);

export const deleteVehicle = async (...args: any[]): Promise<any> =>
    tryMutation(['deleteVehicle'], args);

export const createVehicleAssignment = async (...args: any[]): Promise<any> =>
    tryMutation(['createVehicleAssignment'], args);

export const updateVehicleAssignment = async (...args: any[]): Promise<any> =>
    tryMutation(['updateVehicleAssignment'], args);

export const createVehicleExpense = async (...args: any[]): Promise<any> =>
    tryMutation(['createVehicleExpense'], args);

export const deleteVehicleExpense = async (...args: any[]): Promise<any> =>
    tryMutation(['deleteVehicleExpense'], args);

export const createVehicleBillingDocument = async (...args: any[]): Promise<any> =>
    tryMutation(['createVehicleBillingDocument'], args);

export const updateVehicleBillingDocument = async (...args: any[]): Promise<any> =>
    tryMutation(['updateVehicleBillingDocument'], args);

export const listAllAccommodations = async (...args: any[]): Promise<any> =>
    tryList(['listAllAccommodations', 'listAccommodations'], args, 'accommodations');

export const listAllUtilityRecords = async (...args: any[]): Promise<any> =>
    tryList(['listAllUtilityRecords', 'listUtilityRecords'], args, 'utilityRecords');

export const listAllAccommodationAssignments = async (...args: any[]): Promise<any> =>
    tryList(['listAllAccommodationAssignments', 'listAccommodationAssignments'], args, 'accommodationAssignments');

export const listAllAccommodationBillingDocuments = async (...args: any[]): Promise<any> =>
    tryList(['listAllAccommodationBillingDocuments', 'listAccommodationBillingDocuments'], args, 'accommodationBillingDocuments');

export const listAllAccommodationBillingLineItems = async (...args: any[]): Promise<any> =>
    tryList(['listAllAccommodationBillingLineItems', 'listAccommodationBillingLineItems'], args, 'accommodationBillingLineItems');

export const listAllAdvancePayments = async (...args: any[]): Promise<any> =>
    tryList(['listAllAdvancePayments', 'listAdvancePayments'], args, 'advancePayments');

export const listAllPayments = async (...args: any[]): Promise<any> =>
    tryList(['listAllPayments', 'listPayments'], args, 'payments');

export const listAllTaxInvoices = async (...args: any[]): Promise<any> =>
    tryList(['listAllTaxInvoices', 'listTaxInvoices'], args, 'taxInvoices');

export const listAllDailyDispatches = async (...args: any[]): Promise<any> =>
    tryList(['listAllDailyDispatches', 'listDailyDispatches'], args, 'dailyDispatches');

export const listAllSettings = async (...args: any[]): Promise<any> =>
    tryList(['listAllSettings', 'listSettings'], args, 'settings');

export const listSettings = listAllSettings;

export const listSystemConfigs = async (...args: any[]): Promise<any> =>
    tryList(['listAllSystemConfigs', 'listSystemConfigs'], args, 'systemConfigs');

export const listAllSystemConfigs = listSystemConfigs;

export const listAppUsers = async (...args: any[]): Promise<any> =>
    tryList(['listAllAppUsers', 'listAppUsers'], args, 'appUsers');

export const listAllAppUsers = listAppUsers;

export const createAccommodation = async (...args: any[]): Promise<any> =>
    tryMutation(['createAccommodation'], args);

export const updateAccommodation = async (...args: any[]): Promise<any> =>
    tryMutation(['updateAccommodation', 'updateAccommodation_update'], args);

export const deleteAccommodation = async (...args: any[]): Promise<any> =>
    tryMutation(['deleteAccommodation'], args);

export const createAccommodationAssignment = async (...args: any[]): Promise<any> =>
    tryMutation(['createAccommodationAssignment'], args);

export const updateAccommodationAssignment = async (...args: any[]): Promise<any> =>
    tryMutation(['updateAccommodationAssignment', 'updateAccommodationAssignment_update'], args);

export const deleteAccommodationAssignment = async (...args: any[]): Promise<any> =>
    tryMutation(['deleteAccommodationAssignment'], args);

export const createUtilityRecord = async (...args: any[]): Promise<any> =>
    tryMutation(['createUtilityRecord'], args);

export const updateUtilityRecord = async (...args: any[]): Promise<any> =>
    tryMutation(['updateUtilityRecord', 'updateUtilityRecord_update'], args);

export const createSystemConfig = async (...args: any[]): Promise<any> =>
    tryMutation(['createSystemConfig'], args);

export const updateSystemConfig = async (...args: any[]): Promise<any> =>
    tryMutation(['updateSystemConfig'], args);

// --- Safety Wrappers for get* ---

export const getFreelancer = async (...args: any[]): Promise<any> => {
    const direct = await runOptional('getFreelancer', args);
    if (direct) return direct;
    const dc = args.length >= 2 ? args[0] : undefined;
    const vars = args.length >= 2 ? (args[1] ?? {}) : (args[0] ?? {});
    const id = String(vars?.id ?? '');
    const listed = await listFreelancers(dc || {}, { limit: 5000, offset: 0 } as any);
    const rows = (listed as any)?.data?.freelancers ?? [];
    const row = Array.isArray(rows) ? rows.find((r: any) => String(r?.id ?? '') === id) : null;
    return empty({ freelancer: row ?? null });
};

export const getPayment = async (...args: any[]): Promise<any> => {
    const res = await runOptional('getPayment', args);
    if (res) return res;
    return empty({ payment: null });
};

export const getTaxInvoice = async (...args: any[]): Promise<any> => {
    const res = await runOptional('getTaxInvoice', args);
    if (res) return res;
    return empty({ taxInvoice: null });
};

export const getDailyDispatch = async (...args: any[]): Promise<any> => {
    const res = await runOptional('getDailyDispatch', args);
    if (res) return res;
    return empty({ dailyDispatch: null });
};

export const getWorker = async (...args: any[]): Promise<any> => {
    const res = await runOptional('getWorker', args);
    if (res) return res;
    return empty({ worker: null });
};

// --- Misc ---

export const getFreelancerManagerData = async (...args: any[]): Promise<any> => {
    const res = await runOptional('getFreelancerManagerData', args);
    if (res) return res;
    return empty({ freelancers: [], teams: [] });
};

export const getFreelancerPerformance = async (...args: any[]): Promise<any> => {
    const res = await runOptional('getFreelancerPerformance', args);
    if (res) return res;
    return empty({ dailyReportWorkers: [] });
};

export const getMonthlyTeamPerformance = async (...args: any[]): Promise<any> => {
    const res = await runOptional('getMonthlyTeamPerformance', args);
    if (res) return res;
    return empty({ dailyReportWorkers: [] });
};

export const getFreelancerYearlyDataRef = (...args: any[]): any => {
    const fn = asSdk.getFreelancerYearlyDataRef;
    if (typeof fn === 'function') return fn(...args);
    return { operationName: 'GetFreelancerYearlyData' } as any;
};

export const getFreelancerYearlyData = async (...args: any[]): Promise<any> => {
    const res = await runOptional('getFreelancerYearlyData', args);
    if (res) return res;
    return empty({ freelancers: [], teams: [] });
};

export const getPublicMenuSettings = async (...args: any[]): Promise<any> => {
    const res = await runOptional('getPublicMenuSettings', args);
    if (res) return res;
    return empty({ publicMenuSettings: [] });
};

// --- Types ---
export type ListCardsData = { cards: any[] };
export type ListCardAssignmentsData = { cardAssignments: any[] };
export type ListCardTransactionsData = { cardTransactions: any[] };
export type ListCardBillingDocumentsData = { cardBillingDocuments: any[] };
export type ListFreelancersData = { freelancers: any[] };
export type ListFreelancerPaymentsData = { freelancerPayments: any[] };
export type ListAllPaymentsData = { payments: any[] };
export type ListAllTaxInvoicesData = { taxInvoices: any[] };
export type ListAllDailyDispatchesData = { dailyDispatches: any[] };
export type ListAllSettingsData = { settings: any[] };
export type ListWorkersData = { workers: any[] };
export type ListAllWorkersData = { workers: any[] };
export type ListTeamsData = { teams: any[] };
export type ListSitesData = { sites: any[] };
export type ListDailyReportsData = { dailyReports: any[] };
export type ListDailyReportWorkersData = { dailyReportWorkers: any[] };
export type ListAppUsersData = { appUsers: any[] };

// --- Card Mutations ---

export const createCard = async (...args: any[]): Promise<any> =>
    tryMutation(['createCard'], args);

export const updateCard = async (...args: any[]): Promise<any> =>
    tryMutation(['updateCard'], args);

export const deleteCard = async (...args: any[]): Promise<any> =>
    tryMutation(['deleteCard'], args);

export const createCardAssignment = async (...args: any[]): Promise<any> =>
    tryMutation(['createCardAssignment'], args);

export const updateCardAssignment = async (...args: any[]): Promise<any> =>
    tryMutation(['updateCardAssignment'], args);

export const createCardTransaction = async (...args: any[]): Promise<any> =>
    tryMutation(['createCardTransaction'], args);

export const deleteCardTransaction = async (...args: any[]): Promise<any> =>
    tryMutation(['deleteCardTransaction'], args);

// --- CardBilling Mutations ---

export const createCardBillingDocument = async (...args: any[]): Promise<any> =>
    tryMutation(['createCardBillingDocument'], args);

export const updateCardBillingDocument = async (...args: any[]): Promise<any> =>
    tryMutation(['updateCardBillingDocument'], args);

export const deleteCardBillingDocument = async (...args: any[]): Promise<any> =>
    tryMutation(['deleteCardBillingDocument'], args);

// --- Freelancer Mutations ---

export const createFreelancer = async (...args: any[]): Promise<any> =>
    tryMutation(['createFreelancer'], args);

export const updateFreelancer = async (...args: any[]): Promise<any> =>
    tryMutation(['updateFreelancer'], args);

export const deleteFreelancer = async (...args: any[]): Promise<any> =>
    tryMutation(['deleteFreelancer'], args);

export const createFreelancerPayment = async (...args: any[]): Promise<any> =>
    tryMutation(['createFreelancerPayment'], args);

export const updateFreelancerPayment = async (...args: any[]): Promise<any> =>
    tryMutation(['updateFreelancerPayment'], args);

export const deleteFreelancerPayment = async (...args: any[]): Promise<any> =>
    tryMutation(['deleteFreelancerPayment'], args);

// --- Card Types ---
export type CreateCardData = { card_insert: { id: string } };
export type CreateCardVariables = {
    name: string;
    issuer: string;
    cardType: string;
    last4: string;
    maskedNumber?: string | null;
    expiry?: string | null;
    status?: string | null;
    currentAssigneeId?: string | null;
    currentAssigneeType?: string | null;
    currentAssigneeName?: string | null;
    memo?: string | null;
};
export type UpdateCardVariables = {
    id: string;
    name?: string;
    issuer?: string;
    cardType?: string;
    last4?: string;
    maskedNumber?: string | null;
    expiry?: string | null;
    status?: string;
    currentAssigneeId?: string | null;
    currentAssigneeType?: string | null;
    currentAssigneeName?: string | null;
    memo?: string | null;
};
export type DeleteCardVariables = { id: string };

export type CreateCardAssignmentVariables = {
    cardId: string;
    cardLabel: string;
    assigneeId: string;
    assigneeType: string;
    assigneeName: string;
    startDate: string;
    endDate?: string | null;
    note?: string | null;
};
export type UpdateCardAssignmentVariables = {
    id: string;
    endDate?: string | null;
    note?: string | null;
};

export type CreateCardTransactionData = { cardTransaction_insert: { id: string } };
export type CreateCardTransactionVariables = {
    cardId: string;
    cardLabel: string;
    date: string;
    yearMonth: string;
    merchant?: string | null;
    category: string;
    amount: number;
    memo?: string | null;
    evidenceUrl?: string | null;
};
export type DeleteCardTransactionVariables = { id: string };

export type CreateCardBillingDocumentVariables = {
    id: string;
    yearMonth: string;
    cardId: string;
    cardLabel?: string | null;
    assignedTeamId?: string | null;
    assignedTeamName?: string | null;
    teamId?: string | null;
    teamName?: string | null;
    issuedToType?: string | null;
    issuedToWorkerId?: string | null;
    issuedToWorkerName?: string | null;
    variableCost?: number | null;
    totalAmount?: number | null;
    status?: string | null;
    lineItems?: string | null;
    statementAttachmentPaths?: string | null;
    memo?: string | null;
    confirmedAt?: string | null;
};
export type UpdateCardBillingDocumentVariables = {
    id: string;
    yearMonth?: string | null;
    cardLabel?: string | null;
    assignedTeamId?: string | null;
    assignedTeamName?: string | null;
    teamId?: string | null;
    teamName?: string | null;
    issuedToType?: string | null;
    issuedToWorkerId?: string | null;
    issuedToWorkerName?: string | null;
    variableCost?: number | null;
    totalAmount?: number | null;
    status?: string | null;
    lineItems?: string | null;
    statementAttachmentPaths?: string | null;
    memo?: string | null;
    confirmedAt?: string | null;
};
export type DeleteCardBillingDocumentVariables = { id: string };

// --- Position Mutations ---

export const updatePosition = async (...args: any[]): Promise<any> =>
    tryMutation(['updatePosition'], args);


