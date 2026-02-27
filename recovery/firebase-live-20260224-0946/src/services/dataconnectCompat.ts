import * as sdk from '../dataconnect-generated';
import { executeQuery, queryRef } from 'firebase/data-connect';

export * from '../dataconnect-generated';

const asSdk = sdk as Record<string, any>;
const DEFAULT_LIST_VARS = { limit: 5000, offset: 0 } as const;

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
    } catch {
        if (vars === undefined) return null;
        try {
            // Some operations don't accept variables; retry without vars.
            return await executeQuery(queryRef(dcArg as any, operationName));
        } catch {
            return null;
        }
    }
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
            } catch {
                // ignore and continue fallback
            }
        }

        const operationName = toOperationName(name);
        for (const currentArgs of attempts) {
            try {
                const res = await runOperationFallback(operationName, currentArgs);
                if (res) return res;
            } catch {
                // ignore and continue fallback
            }
        }
    }
    return empty({ [emptyKey]: [] });
};

// --- Safety Wrappers for list* vs listAll* ---

export const listCards = async (...args: any[]): Promise<any> =>
    tryList(['listCards', 'listAllCards'], args, 'cards');

export const listCardAssignments = async (...args: any[]): Promise<any> =>
    tryList(['listCardAssignments', 'listAllCardAssignments'], args, 'cardAssignments');

export const listCardTransactions = async (...args: any[]): Promise<any> =>
    tryList(['listCardTransactions', 'listAllCardTransactions'], args, 'cardTransactions');

export const listCardBillingDocuments = async (...args: any[]): Promise<any> =>
    tryList(['listCardBillingDocuments', 'listAllCardBillingDocuments'], args, 'cardBillingDocuments');

export const listFreelancers = async (...args: any[]): Promise<any> =>
    tryList(['listFreelancers', 'listAllFreelancers'], args, 'freelancers');

export const listFreelancerPayments = async (...args: any[]): Promise<any> =>
    tryList(['listFreelancerPayments', 'listAllFreelancerPayments'], args, 'freelancerPayments');

export const listWorkers = async (...args: any[]): Promise<any> =>
    tryList(['listWorkers', 'listAllWorkers'], args, 'workers');

export const listAllWorkers = listWorkers;

export const listTeams = async (...args: any[]): Promise<any> =>
    tryList(['listTeams', 'listAllTeams'], args, 'teams');

export const listAllTeams = listTeams;

export const listCompanies = async (...args: any[]): Promise<any> =>
    tryList(['listCompanies', 'listAllCompanies'], args, 'companies');

export const listAllCompanies = listCompanies;

export const listSites = async (...args: any[]): Promise<any> =>
    tryList(['listSites', 'listAllSites'], args, 'sites');

export const listAllSites = listSites;

export const listDailyReports = async (...args: any[]): Promise<any> =>
    tryList(['listDailyReports', 'listAllDailyReports'], args, 'dailyReports');

export const listAllDailyReports = listDailyReports;

export const listDailyReportWorkers = async (...args: any[]): Promise<any> =>
    tryList(['listDailyReportWorkers', 'listAllDailyReportWorkers'], args, 'dailyReportWorkers');

export const listAllDailyReportWorkers = listDailyReportWorkers;

export const listVehicles = async (...args: any[]): Promise<any> =>
    tryList(['listVehicles', 'listAllVehicles'], args, 'vehicles');

export const listAllVehicles = listVehicles;

export const listAllVehicleAssignments = async (...args: any[]): Promise<any> =>
    tryList(['listVehicleAssignments', 'listAllVehicleAssignments'], args, 'vehicleAssignments');

export const listAllVehicleExpenses = async (...args: any[]): Promise<any> =>
    tryList(['listVehicleExpenses', 'listAllVehicleExpenses'], args, 'vehicleExpenses');

export const listAllVehicleBillingDocuments = async (...args: any[]): Promise<any> =>
    tryList(['listVehicleBillingDocuments', 'listAllVehicleBillingDocuments'], args, 'vehicleBillingDocuments');

export const listAllAccommodations = async (...args: any[]): Promise<any> =>
    tryList(['listAccommodations', 'listAllAccommodations'], args, 'accommodations');

export const listAllUtilityRecords = async (...args: any[]): Promise<any> =>
    tryList(['listUtilityRecords', 'listAllUtilityRecords'], args, 'utilityRecords');

export const listAllAccommodationAssignments = async (...args: any[]): Promise<any> =>
    tryList(['listAccommodationAssignments', 'listAllAccommodationAssignments'], args, 'accommodationAssignments');

export const listAllAccommodationBillingDocuments = async (...args: any[]): Promise<any> =>
    tryList(['listAccommodationBillingDocuments', 'listAllAccommodationBillingDocuments'], args, 'accommodationBillingDocuments');

export const listAllAccommodationBillingLineItems = async (...args: any[]): Promise<any> =>
    tryList(['listAccommodationBillingLineItems', 'listAllAccommodationBillingLineItems'], args, 'accommodationBillingLineItems');

export const listAllAdvancePayments = async (...args: any[]): Promise<any> =>
    tryList(['listAdvancePayments', 'listAllAdvancePayments'], args, 'advancePayments');

export const listAllPayments = async (...args: any[]): Promise<any> =>
    tryList(['listAllPayments', 'listPayments'], args, 'payments');

export const listAllTaxInvoices = async (...args: any[]): Promise<any> =>
    tryList(['listAllTaxInvoices', 'listTaxInvoices'], args, 'taxInvoices');

export const listAllDailyDispatches = async (...args: any[]): Promise<any> =>
    tryList(['listAllDailyDispatches', 'listDailyDispatches'], args, 'dailyDispatches');

export const listAllSettings = async (...args: any[]): Promise<any> =>
    tryList(['listAllSettings', 'listSettings'], args, 'settings');

export const listSettings = listAllSettings;

export const listAppUsers = async (...args: any[]): Promise<any> =>
    tryList(['listAppUsers', 'listAllAppUsers'], args, 'appUsers');

export const listAllAppUsers = listAppUsers;

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
