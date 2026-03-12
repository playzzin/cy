import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

type Cfg = {
  col: string;
  list: string;
  get: string;
  ins: string;
  upd: string;
  del: string;
  prefix: string;
};

const DEFAULT_LIST_VARS = { limit: 1000, offset: 0 } as const;

const C = {
  company: { col: 'companies', list: 'companies', get: 'company', ins: 'company_insert', upd: 'company_update', del: 'company_delete', prefix: 'company' },
  team: { col: 'teams', list: 'teams', get: 'team', ins: 'team_insert', upd: 'team_update', del: 'team_delete', prefix: 'team' },
  worker: { col: 'workers', list: 'workers', get: 'worker', ins: 'worker_insert', upd: 'worker_update', del: 'worker_delete', prefix: 'worker' },
  site: { col: 'sites', list: 'sites', get: 'site', ins: 'site_insert', upd: 'site_update', del: 'site_delete', prefix: 'site' },
  position: { col: 'positions', list: 'positions', get: 'position', ins: 'position_insert', upd: 'position_update', del: 'position_delete', prefix: 'position' },
  dailyReport: { col: 'daily_reports', list: 'dailyReports', get: 'dailyReport', ins: 'dailyReport_insert', upd: 'dailyReport_update', del: 'dailyReport_delete', prefix: 'daily-report' },
  dailyReportWorker: { col: 'daily_report_workers', list: 'dailyReportWorkers', get: 'dailyReportWorker', ins: 'dailyReportWorker_insert', upd: 'dailyReportWorker_update', del: 'dailyReportWorker_delete', prefix: 'daily-report-worker' },
  appUser: { col: 'users', list: 'appUsers', get: 'appUser', ins: 'appUser_insert', upd: 'appUser_update', del: 'appUser_delete', prefix: 'app-user' },
  menuConfig: { col: 'menu_configs', list: 'menuConfigs', get: 'menuConfig', ins: 'menuConfig_insert', upd: 'menuConfig_update', del: 'menuConfig_delete', prefix: 'menu-config' },
  systemLog: { col: 'system_logs', list: 'systemLogs', get: 'systemLog', ins: 'systemLog_insert', upd: 'systemLog_update', del: 'systemLog_delete', prefix: 'system-log' },
  setting: { col: 'settings', list: 'settings', get: 'setting', ins: 'setting_insert', upd: 'setting_update', del: 'setting_delete', prefix: 'setting' },
  systemConfig: { col: 'system_configs', list: 'systemConfigs', get: 'systemConfig', ins: 'systemConfig_insert', upd: 'systemConfig_update', del: 'systemConfig_delete', prefix: 'system-config' },
  accommodation: { col: 'accommodations', list: 'accommodations', get: 'accommodation', ins: 'accommodation_insert', upd: 'accommodation_update', del: 'accommodation_delete', prefix: 'accommodation' },
  utilityRecord: { col: 'accommodationUtilityRecords', list: 'utilityRecords', get: 'utilityRecord', ins: 'utilityRecord_insert', upd: 'utilityRecord_update', del: 'utilityRecord_delete', prefix: 'utility-record' },
  accommodationAssignment: { col: 'accommodationAssignments', list: 'accommodationAssignments', get: 'accommodationAssignment', ins: 'accommodationAssignment_insert', upd: 'accommodationAssignment_update', del: 'accommodationAssignment_delete', prefix: 'accommodation-assignment' },
  accommodationBillingDocument: { col: 'accommodation_billing_documents', list: 'accommodationBillingDocuments', get: 'accommodationBillingDocument', ins: 'accommodationBillingDocument_insert', upd: 'accommodationBillingDocument_update', del: 'accommodationBillingDocument_delete', prefix: 'accommodation-billing' },
  accommodationBillingLineItem: { col: 'accommodation_billing_line_items', list: 'accommodationBillingLineItems', get: 'accommodationBillingLineItem', ins: 'accommodationBillingLineItem_insert', upd: 'accommodationBillingLineItem_update', del: 'accommodationBillingLineItem_delete', prefix: 'accommodation-line-item' },
  advancePayment: { col: 'advance_payments', list: 'advancePayments', get: 'advancePayment', ins: 'advancePayment_insert', upd: 'advancePayment_update', del: 'advancePayment_delete', prefix: 'advance-payment' },
  smartMemoCategory: { col: 'smart_memo_categories', list: 'smartMemoCategories', get: 'smartMemoCategory', ins: 'smartMemoCategory_insert', upd: 'smartMemoCategory_update', del: 'smartMemoCategory_delete', prefix: 'smart-memo-category' },
  smartMemo: { col: 'smart_memos', list: 'smartMemos', get: 'smartMemo', ins: 'smartMemo_insert', upd: 'smartMemo_update', del: 'smartMemo_delete', prefix: 'smart-memo' },
  vehicle: { col: 'vehicles', list: 'vehicles', get: 'vehicle', ins: 'vehicle_insert', upd: 'vehicle_update', del: 'vehicle_delete', prefix: 'vehicle' },
  vehicleAssignment: { col: 'vehicleAssignments', list: 'vehicleAssignments', get: 'vehicleAssignment', ins: 'vehicleAssignment_insert', upd: 'vehicleAssignment_update', del: 'vehicleAssignment_delete', prefix: 'vehicle-assignment' },
  vehicleExpense: { col: 'vehicleExpenses', list: 'vehicleExpenses', get: 'vehicleExpense', ins: 'vehicleExpense_insert', upd: 'vehicleExpense_update', del: 'vehicleExpense_delete', prefix: 'vehicle-expense' },
  vehicleBillingDocument: { col: 'vehicle_billing_documents', list: 'vehicleBillingDocuments', get: 'vehicleBillingDocument', ins: 'vehicleBillingDocument_insert', upd: 'vehicleBillingDocument_update', del: 'vehicleBillingDocument_delete', prefix: 'vehicle-billing' },
  dailyDispatch: { col: 'daily_dispatches', list: 'dailyDispatches', get: 'dailyDispatch', ins: 'dailyDispatch_insert', upd: 'dailyDispatch_update', del: 'dailyDispatch_delete', prefix: 'daily-dispatch' },
  payment: { col: 'payments', list: 'payments', get: 'payment', ins: 'payment_insert', upd: 'payment_update', del: 'payment_delete', prefix: 'payment' },
  taxInvoice: { col: 'tax_invoices', list: 'taxInvoices', get: 'taxInvoice', ins: 'taxInvoice_insert', upd: 'taxInvoice_update', del: 'taxInvoice_delete', prefix: 'tax-invoice' },
  receivable: { col: 'receivables', list: 'receivables', get: 'receivable', ins: 'receivable_insert', upd: 'receivable_update', del: 'receivable_delete', prefix: 'receivable' },
  agent: { col: 'agents', list: 'agents', get: 'agent', ins: 'agent_insert', upd: 'agent_update', del: 'agent_delete', prefix: 'agent' },
  agentConversation: { col: 'agent_conversations', list: 'agentConversations', get: 'agentConversation', ins: 'agentConversation_insert', upd: 'agentConversation_update', del: 'agentConversation_delete', prefix: 'agent-conversation' },
  auditLog: { col: 'audit_logs', list: 'auditLogs', get: 'auditLog', ins: 'auditLog_insert', upd: 'auditLog_update', del: 'auditLog_delete', prefix: 'audit-log' },
  card: { col: 'cards', list: 'cards', get: 'card', ins: 'card_insert', upd: 'card_update', del: 'card_delete', prefix: 'card' },
  cardAssignment: { col: 'cardAssignments', list: 'cardAssignments', get: 'cardAssignment', ins: 'cardAssignment_insert', upd: 'cardAssignment_update', del: 'cardAssignment_delete', prefix: 'card-assignment' },
  cardTransaction: { col: 'cardTransactions', list: 'cardTransactions', get: 'cardTransaction', ins: 'cardTransaction_insert', upd: 'cardTransaction_update', del: 'cardTransaction_delete', prefix: 'card-transaction' },
  cardBillingDocument: { col: 'cardBillings', list: 'cardBillingDocuments', get: 'cardBillingDocument', ins: 'cardBillingDocument_insert', upd: 'cardBillingDocument_update', del: 'cardBillingDocument_delete', prefix: 'card-billing' },
  freelancer: { col: 'freelancers', list: 'freelancers', get: 'freelancer', ins: 'freelancer_insert', upd: 'freelancer_update', del: 'freelancer_delete', prefix: 'freelancer' },
  freelancerPayment: { col: 'freelancerPayments', list: 'freelancerPayments', get: 'freelancerPayment', ins: 'freelancerPayment_insert', upd: 'freelancerPayment_update', del: 'freelancerPayment_delete', prefix: 'freelancer-payment' }
} satisfies Record<string, Cfg>;

const isObj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const strip = (value: unknown): unknown => Array.isArray(value)
  ? value.map((entry) => strip(entry))
  : isObj(value)
    ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, strip(v)]))
    : value;
const listVars = (args: any[]) => args.length > 1 && isObj(args[1]) ? { ...DEFAULT_LIST_VARS, ...args[1] } : args.length > 0 && isObj(args[0]) ? { ...DEFAULT_LIST_VARS, ...args[0] } : { ...DEFAULT_LIST_VARS };
const mutateVars = (args: any[]) => args.length > 1 && isObj(args[1]) ? args[1] : args.length > 0 && isObj(args[0]) ? args[0] : {};
const page = <T>(rows: T[], args: any[]) => { const vars = listVars(args) as any; const offset = typeof vars.offset === 'number' ? vars.offset : 0; const limit = typeof vars.limit === 'number' ? vars.limit : rows.length; return rows.slice(offset, offset + limit); };
const readRows = async (col: string) => { const snap = await getDocs(collection(db, col)); return snap.docs.map((d) => ({ id: d.id, ...(strip(d.data()) as Record<string, unknown>) })); };
const mkId = (prefix: string) => { const c: any = typeof crypto !== 'undefined' ? crypto : undefined; return c && typeof c.randomUUID === 'function' ? c.randomUUID() : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`; };
const list = async (cfg: Cfg, args: any[]) => ({ data: { [cfg.list]: page(await readRows(cfg.col), args) } } as any);
const getOne = async (cfg: Cfg, args: any[]) => { const vars = mutateVars(args) as any; const id = typeof vars.id === 'string' ? vars.id.trim() : ''; if (!id) return { data: { [cfg.get]: null } } as any; const snap = await getDoc(doc(db, cfg.col, id)); return { data: { [cfg.get]: snap.exists() ? { id: snap.id, ...(strip(snap.data()) as Record<string, unknown>) } : null } } as any; };
const upsert = async (cfg: Cfg, mode: 'create' | 'update', args: any[]) => { const vars = mutateVars(args) as any; const inputId = typeof vars.id === 'string' ? vars.id.trim() : ''; const id = inputId || mkId(cfg.prefix); const ref = doc(db, cfg.col, id); const existing = await getDoc(ref); if (mode === 'update' && !existing.exists()) return { data: { [cfg.upd]: null } } as any; const payload = strip({ ...vars, createdAt: existing.exists() ? undefined : (vars.createdAt ?? new Date().toISOString()), updatedAt: vars.updatedAt ?? new Date().toISOString() }) as Record<string, unknown>; delete payload.id; await setDoc(ref, payload, { merge: true }); return { data: { [mode === 'create' ? cfg.ins : cfg.upd]: { id } } } as any; };
const remove = async (cfg: Cfg, args: any[]) => { const vars = mutateVars(args) as any; const id = typeof vars.id === 'string' ? vars.id.trim() : ''; if (!id) throw new Error(`[firestoreCrudCompat] Missing id for delete ${cfg.col}`); await deleteDoc(doc(db, cfg.col, id)); return { data: { [cfg.del]: { id } } } as any; };
const bindList = (cfg: Cfg) => (...args: any[]) => list(cfg, args);
const bindGet = (cfg: Cfg) => (...args: any[]) => getOne(cfg, args);
const bindCreate = (cfg: Cfg) => (...args: any[]) => upsert(cfg, 'create', args);
const bindUpdate = (cfg: Cfg) => (...args: any[]) => upsert(cfg, 'update', args);
const bindDelete = (cfg: Cfg) => (...args: any[]) => remove(cfg, args);
const empty = (data: Record<string, unknown>) => ({ data } as any);

export type CreateSettingVariables = { id: string; data: string };
export type UpdateSettingVariables = { id: string; data: string };
export type CreateSystemConfigVariables = { id: string; data: string };
export type UpdateSystemConfigVariables = { id: string; data: string };
export const listCompanies = bindList(C.company); export const listAllCompanies = listCompanies; export const getCompany = bindGet(C.company); export const createCompany = bindCreate(C.company); export const updateCompany = bindUpdate(C.company); export const deleteCompany = bindDelete(C.company);
export const listTeams = bindList(C.team); export const listAllTeams = listTeams; export const getTeam = bindGet(C.team); export const createTeam = bindCreate(C.team); export const updateTeam = bindUpdate(C.team); export const deleteTeam = bindDelete(C.team);
export const listWorkers = bindList(C.worker); export const listAllWorkers = listWorkers; export const getWorker = bindGet(C.worker); export const createWorker = bindCreate(C.worker); export const updateWorker = bindUpdate(C.worker); export const deleteWorker = bindDelete(C.worker);
export const listPositions = bindList(C.position); export const listAllPositions = listPositions; export const createPosition = bindCreate(C.position); export const updatePosition = bindUpdate(C.position); export const deletePosition = bindDelete(C.position);
export const listSites = bindList(C.site); export const listAllSites = listSites; export const getSite = bindGet(C.site); export const createSite = bindCreate(C.site); export const updateSite = bindUpdate(C.site); export const deleteSite = bindDelete(C.site);
export const listDailyReports = bindList(C.dailyReport); export const listAllDailyReports = listDailyReports; export const getDailyReport = bindGet(C.dailyReport); export const createDailyReport = bindCreate(C.dailyReport); export const updateDailyReport = bindUpdate(C.dailyReport); export const deleteDailyReport = bindDelete(C.dailyReport);
export const listDailyReportWorkers = bindList(C.dailyReportWorker); export const listAllDailyReportWorkers = listDailyReportWorkers; export const createDailyReportWorker = bindCreate(C.dailyReportWorker); export const updateDailyReportWorker = bindUpdate(C.dailyReportWorker); export const deleteDailyReportWorker = bindDelete(C.dailyReportWorker);
export const listAppUsers = bindList(C.appUser); export const listAllAppUsers = listAppUsers; export const createAppUser = bindCreate(C.appUser); export const updateAppUser = bindUpdate(C.appUser); export const deleteAppUser = bindDelete(C.appUser);
export const listAllMenuConfigs = bindList(C.menuConfig); export const createMenuConfig = bindCreate(C.menuConfig); export const updateMenuConfig = bindUpdate(C.menuConfig); export const deleteMenuConfig = bindDelete(C.menuConfig);
export const listAllSystemLogs = bindList(C.systemLog); export const createSystemLog = bindCreate(C.systemLog);
export const listSettings = bindList(C.setting); export const listAllSettings = listSettings; export const createSetting = bindCreate(C.setting); export const updateSetting = bindUpdate(C.setting);
export const listSystemConfigs = bindList(C.systemConfig); export const listAllSystemConfigs = listSystemConfigs; export const createSystemConfig = bindCreate(C.systemConfig); export const updateSystemConfig = bindUpdate(C.systemConfig);
export const listAllAccommodations = bindList(C.accommodation); export const createAccommodation = bindCreate(C.accommodation); export const updateAccommodation = bindUpdate(C.accommodation); export const deleteAccommodation = bindDelete(C.accommodation);
export const listAllUtilityRecords = bindList(C.utilityRecord); export const createUtilityRecord = bindCreate(C.utilityRecord); export const updateUtilityRecord = bindUpdate(C.utilityRecord); export const deleteUtilityRecord = bindDelete(C.utilityRecord);
export const listAllAccommodationAssignments = bindList(C.accommodationAssignment); export const createAccommodationAssignment = bindCreate(C.accommodationAssignment); export const updateAccommodationAssignment = bindUpdate(C.accommodationAssignment); export const deleteAccommodationAssignment = bindDelete(C.accommodationAssignment);
export const listAllAccommodationBillingDocuments = bindList(C.accommodationBillingDocument); export const createAccommodationBillingDocument = bindCreate(C.accommodationBillingDocument); export const updateAccommodationBillingDocument = bindUpdate(C.accommodationBillingDocument); export const deleteAccommodationBillingDocument = bindDelete(C.accommodationBillingDocument);
export const listAllAccommodationBillingLineItems = bindList(C.accommodationBillingLineItem); export const createAccommodationBillingLineItem = bindCreate(C.accommodationBillingLineItem); export const updateAccommodationBillingLineItem = bindUpdate(C.accommodationBillingLineItem); export const deleteAccommodationBillingLineItem = bindDelete(C.accommodationBillingLineItem);
export const listAllAdvancePayments = bindList(C.advancePayment); export const createAdvancePayment = bindCreate(C.advancePayment); export const updateAdvancePayment = bindUpdate(C.advancePayment); export const deleteAdvancePayment = bindDelete(C.advancePayment);
export const listAllSmartMemoCategories = bindList(C.smartMemoCategory); export const createSmartMemoCategory = bindCreate(C.smartMemoCategory); export const updateSmartMemoCategory = bindUpdate(C.smartMemoCategory); export const deleteSmartMemoCategory = bindDelete(C.smartMemoCategory);
export const listAllSmartMemos = bindList(C.smartMemo); export const createSmartMemo = bindCreate(C.smartMemo); export const updateSmartMemo = bindUpdate(C.smartMemo); export const deleteSmartMemo = bindDelete(C.smartMemo);
export const listVehicles = bindList(C.vehicle); export const listAllVehicles = listVehicles; export const createVehicle = bindCreate(C.vehicle); export const updateVehicle = bindUpdate(C.vehicle); export const deleteVehicle = bindDelete(C.vehicle);
export const listAllVehicleAssignments = bindList(C.vehicleAssignment); export const createVehicleAssignment = bindCreate(C.vehicleAssignment); export const updateVehicleAssignment = bindUpdate(C.vehicleAssignment); export const deleteVehicleAssignment = bindDelete(C.vehicleAssignment);
export const listAllVehicleExpenses = bindList(C.vehicleExpense); export const createVehicleExpense = bindCreate(C.vehicleExpense); export const updateVehicleExpense = bindUpdate(C.vehicleExpense); export const deleteVehicleExpense = bindDelete(C.vehicleExpense);
export const listAllVehicleBillingDocuments = bindList(C.vehicleBillingDocument); export const createVehicleBillingDocument = bindCreate(C.vehicleBillingDocument); export const updateVehicleBillingDocument = bindUpdate(C.vehicleBillingDocument); export const deleteVehicleBillingDocument = bindDelete(C.vehicleBillingDocument);
export const listAllDailyDispatches = bindList(C.dailyDispatch); export const getDailyDispatch = bindGet(C.dailyDispatch); export const createDailyDispatch = bindCreate(C.dailyDispatch); export const updateDailyDispatch = bindUpdate(C.dailyDispatch); export const deleteDailyDispatch = bindDelete(C.dailyDispatch);
export const listAllPayments = bindList(C.payment); export const getPayment = bindGet(C.payment); export const createPayment = bindCreate(C.payment); export const updatePayment = bindUpdate(C.payment); export const deletePayment = bindDelete(C.payment);
export const listAllTaxInvoices = bindList(C.taxInvoice); export const getTaxInvoice = bindGet(C.taxInvoice); export const createTaxInvoice = bindCreate(C.taxInvoice); export const updateTaxInvoice = bindUpdate(C.taxInvoice); export const deleteTaxInvoice = bindDelete(C.taxInvoice);
export const listAllReceivables = bindList(C.receivable); export const createReceivable = bindCreate(C.receivable); export const updateReceivable = bindUpdate(C.receivable); export const deleteReceivable = bindDelete(C.receivable);
export const listAllAgents = bindList(C.agent); export const createAgent = bindCreate(C.agent); export const updateAgent = bindUpdate(C.agent); export const deleteAgent = bindDelete(C.agent);
export const listAllAgentConversations = bindList(C.agentConversation); export const createAgentConversation = bindCreate(C.agentConversation); export const updateAgentConversation = bindUpdate(C.agentConversation); export const deleteAgentConversation = bindDelete(C.agentConversation);
export const listAllAuditLogs = bindList(C.auditLog); export const createAuditLog = bindCreate(C.auditLog);
export const listCards = bindList(C.card); export const listAllCards = listCards; export const createCard = bindCreate(C.card); export const updateCard = bindUpdate(C.card); export const deleteCard = bindDelete(C.card);
export const listCardAssignments = bindList(C.cardAssignment); export const listAllCardAssignments = listCardAssignments; export const createCardAssignment = bindCreate(C.cardAssignment); export const updateCardAssignment = bindUpdate(C.cardAssignment); export const deleteCardAssignment = bindDelete(C.cardAssignment);
export const listCardTransactions = bindList(C.cardTransaction); export const listAllCardTransactions = listCardTransactions; export const createCardTransaction = bindCreate(C.cardTransaction); export const updateCardTransaction = bindUpdate(C.cardTransaction); export const deleteCardTransaction = bindDelete(C.cardTransaction);
export const listCardBillingDocuments = bindList(C.cardBillingDocument); export const listAllCardBillingDocuments = listCardBillingDocuments; export const createCardBillingDocument = bindCreate(C.cardBillingDocument); export const updateCardBillingDocument = bindUpdate(C.cardBillingDocument); export const deleteCardBillingDocument = bindDelete(C.cardBillingDocument);
export const listFreelancers = bindList(C.freelancer); export const getFreelancer = bindGet(C.freelancer); export const listAllFreelancers = listFreelancers; export const createFreelancer = bindCreate(C.freelancer); export const updateFreelancer = bindUpdate(C.freelancer); export const deleteFreelancer = bindDelete(C.freelancer);
export const listFreelancerPayments = bindList(C.freelancerPayment); export const listAllFreelancerPayments = listFreelancerPayments; export const createFreelancerPayment = bindCreate(C.freelancerPayment); export const updateFreelancerPayment = bindUpdate(C.freelancerPayment); export const deleteFreelancerPayment = bindDelete(C.freelancerPayment);
export const getFreelancerManagerData = async (): Promise<any> => empty({ freelancers: [], teams: [] });
export const getFreelancerPerformance = async (): Promise<any> => empty({ dailyReportWorkers: [] });
export const getMonthlyTeamPerformance = async (): Promise<any> => empty({ dailyReportWorkers: [] });
export const getFreelancerYearlyDataRef = (..._args: any[]): any => ({ operationName: 'GetFreelancerYearlyData' });
export const getFreelancerYearlyData = async (): Promise<any> => empty({ freelancers: [], teams: [] });
export const getPublicMenuSettings = async (): Promise<any> => empty({ publicMenuSettings: [] });


