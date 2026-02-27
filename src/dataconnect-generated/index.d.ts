import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export enum Status {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
};



export interface AccommodationAssignment_Key {
  id: UUIDString;
  __typename?: 'AccommodationAssignment_Key';
}

export interface AccommodationBillingDocument_Key {
  id: UUIDString;
  __typename?: 'AccommodationBillingDocument_Key';
}

export interface AccommodationBillingLineItem_Key {
  id: UUIDString;
  __typename?: 'AccommodationBillingLineItem_Key';
}

export interface Accommodation_Key {
  id: UUIDString;
  __typename?: 'Accommodation_Key';
}

export interface AdvancePayment_Key {
  id: string;
  __typename?: 'AdvancePayment_Key';
}

export interface AgentConversation_Key {
  id: string;
  __typename?: 'AgentConversation_Key';
}

export interface Agent_Key {
  id: string;
  __typename?: 'Agent_Key';
}

export interface AppUser_Key {
  id: string;
  __typename?: 'AppUser_Key';
}

export interface AuditLog_Key {
  id: string;
  __typename?: 'AuditLog_Key';
}

export interface Company_Key {
  id: UUIDString;
  __typename?: 'Company_Key';
}

export interface CreateAccommodationAssignmentData {
  accommodationAssignment_insert: AccommodationAssignment_Key;
}

export interface CreateAccommodationAssignmentVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  accommodationId: UUIDString;
  teamId?: UUIDString | null;
  teamName?: string | null;
  workerId?: UUIDString | null;
  workerName?: string | null;
  startDate: string;
  endDate?: string | null;
  status?: string | null;
  source?: string | null;
  memo?: string | null;
}

export interface CreateAccommodationBillingDocumentData {
  accommodationBillingDocument_insert: AccommodationBillingDocument_Key;
}

export interface CreateAccommodationBillingDocumentVariables {
  id?: UUIDString | null;
  yearMonth: string;
  teamId?: UUIDString | null;
  teamName?: string | null;
  issuedToType: string;
  issuedToWorkerId?: UUIDString | null;
  issuedToWorkerName?: string | null;
  status?: string | null;
  memo?: string | null;
  confirmedAt?: TimestampString | null;
  postedAdvancePaymentId?: string | null;
}

export interface CreateAccommodationBillingLineItemData {
  accommodationBillingLineItem_insert: AccommodationBillingLineItem_Key;
}

export interface CreateAccommodationBillingLineItemVariables {
  id?: UUIDString | null;
  billingDocumentId: UUIDString;
  label: string;
  amount: number;
  targetField: string;
}

export interface CreateAccommodationData {
  accommodation_insert: Accommodation_Key;
}

export interface CreateAccommodationVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  name: string;
  address: string;
  type: string;
  status: string;
  ownership?: string | null;
  electricityMode?: string | null;
  gasMode?: string | null;
  waterMode?: string | null;
  internetMode?: string | null;
  maintenanceMode?: string | null;
  fixedElectricity?: number | null;
  fixedGas?: number | null;
  fixedWater?: number | null;
  fixedInternet?: number | null;
  fixedMaintenance?: number | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  deposit?: number | null;
  monthlyRent?: number | null;
  paymentDay?: number | null;
  landlordName?: string | null;
  landlordContact?: string | null;
  isReported?: boolean | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  rentPayDate?: number | null;
  isAutoTransfer?: boolean | null;
  transferDay?: number | null;
  transferAccountInfo?: string | null;
  billingTargetType?: string | null;
  billingTargetTeamId?: string | null;
  billingTargetTeamName?: string | null;
  billingTargetWorkerId?: string | null;
  billingTargetWorkerName?: string | null;
  currentOccupantName?: string | null;
  currentOccupantPhone?: string | null;
  memo?: string | null;
}

export interface CreateAdvancePaymentData {
  advancePayment_insert: AdvancePayment_Key;
}

export interface CreateAdvancePaymentVariables {
  id: string;
  workerId?: UUIDString | null;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  yearMonth: string;
  items?: string | null;
  prevMonthCarryover?: number | null;
  accommodation?: number | null;
  privateRoom?: number | null;
  gloves?: number | null;
  deposit?: number | null;
  fines?: number | null;
  electricity?: number | null;
  gas?: number | null;
  internet?: number | null;
  water?: number | null;
  totalDeduction?: number | null;
  memo?: string | null;
  updatedAt?: TimestampString | null;
}

export interface CreateAgentConversationData {
  agentConversation_insert: AgentConversation_Key;
}

export interface CreateAgentConversationVariables {
  id: string;
  mainAgentId?: string | null;
  userId?: string | null;
  messages?: string | null;
}

export interface CreateAgentData {
  agent_insert: Agent_Key;
}

export interface CreateAgentVariables {
  id: string;
  name?: string | null;
  type?: string | null;
  role?: string | null;
  capabilities?: string | null;
  systemPrompt?: string | null;
  status?: string | null;
}

export interface CreateAppUserData {
  appUser_insert: AppUser_Key;
}

export interface CreateAppUserVariables {
  id: string;
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
  photoUrl?: string | null;
  linkedWorkerIds?: string | null;
  role?: string | null;
  lastLogin?: TimestampString | null;
}

export interface CreateAuditLogData {
  auditLog_insert: AuditLog_Key;
}

export interface CreateAuditLogVariables {
  id: string;
  action?: string | null;
  category?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  targetId?: string | null;
  details?: string | null;
  timestamp?: TimestampString | null;
}

export interface CreateCompanyData {
  company_insert: Company_Key;
}

export interface CreateCompanyVariables {
  name: string;
  code: string;
  legacyId?: string | null;
  businessNumber?: string | null;
  ceoName?: string | null;
  type?: string | null;
  status?: Status | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  ceoResidentNumber?: string | null;
  color?: string | null;
}

export interface CreateDailyDispatchData {
  dailyDispatch_insert: DailyDispatch_Key;
}

export interface CreateDailyDispatchVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  date: string;
  workerId: UUIDString;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  siteId?: UUIDString | null;
  siteName?: string | null;
  status?: string | null;
}

export interface CreateDailyReportData {
  dailyReport_insert: DailyReport_Key;
}

export interface CreateDailyReportVariables {
  date: DateString;
  legacyId?: string | null;
  teamId: UUIDString;
  siteId?: UUIDString | null;
  siteName?: string | null;
  status?: string | null;
  totalManDay?: number | null;
  totalAmount?: number | null;
  weather?: string | null;
  writerUid?: string | null;
  companyName?: string | null;
  responsibleTeamName?: string | null;
  responsibleTeamLegacyId?: string | null;
  workContent?: string | null;
}

export interface CreateDailyReportWorkerData {
  dailyReportWorker_insert: DailyReportWorker_Key;
}

export interface CreateDailyReportWorkerVariables {
  dailyReportId: UUIDString;
  workerId: UUIDString;
  gongsu: number;
  unitPrice: number;
  amount: number;
  workDescription?: string | null;
  legacyWorkerId?: string | null;
  legacyTeamId?: string | null;
  workerName?: string | null;
  role?: string | null;
  status?: string | null;
  manDay?: number | null;
  payType?: string | null;
  salaryModel?: string | null;
  workContent?: string | null;
}

export interface CreateMenuConfigData {
  menuConfig_insert: MenuConfig_Key;
}

export interface CreateMenuConfigVariables {
  id: string;
  config: string;
}

export interface CreatePaymentData {
  payment_insert: Payment_Key;
}

export interface CreatePaymentVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  date: string;
  amount: number;
  type?: string | null;
  method?: string | null;
  memo?: string | null;
}

export interface CreatePositionData {
  position_insert: Position_Key;
}

export interface CreatePositionVariables {
  name: string;
  legacyId?: string | null;
  rank?: number | null;
  color?: string | null;
  icon?: string | null;
  isDefault?: boolean | null;
}

export interface CreateReceivableData {
  receivable_insert: Receivable_Key;
}

export interface CreateReceivableVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  date: string;
  amount: number;
  companyName?: string | null;
  status?: string | null;
}

export interface CreateSettingData {
  setting_insert: Setting_Key;
}

export interface CreateSettingVariables {
  id: string;
  data: string;
}

export interface CreateSiteData {
  site_insert: Site_Key;
}

export interface CreateSiteVariables {
  name: string;
  legacyId?: string | null;
  code?: string | null;
  address?: string | null;
  startDate?: DateString | null;
  endDate?: DateString | null;
  status?: Status | null;
}

export interface CreateSmartMemoCategoryData {
  smartMemoCategory_insert: SmartMemoCategory_Key;
}

export interface CreateSmartMemoCategoryVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  userId: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  order?: number | null;
}

export interface CreateSmartMemoData {
  smartMemo_insert: SmartMemo_Key;
}

export interface CreateSmartMemoVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  userId: string;
  scope: string;
  type: string;
  title: string;
  content?: string | null;
  checklistItems?: string | null;
  color?: string | null;
  order?: number | null;
  isPinned?: boolean | null;
  tags?: string | null;
  categoryId?: UUIDString | null;
  categoryLegacyId?: string | null;
  priority?: string | null;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  isCollapsed?: boolean | null;
  prevW?: number | null;
  prevH?: number | null;
}

export interface CreateSystemConfigData {
  systemConfig_insert: SystemConfig_Key;
}

export interface CreateSystemConfigVariables {
  id: string;
  data: string;
}

export interface CreateSystemLogData {
  systemLog_insert: SystemLog_Key;
}

export interface CreateSystemLogVariables {
  category: string;
  action: string;
  userEmail?: string | null;
  details?: string | null;
}

export interface CreateTaxInvoiceData {
  taxInvoice_insert: TaxInvoice_Key;
}

export interface CreateTaxInvoiceVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  date: string;
  amount: number;
  tax: number;
  total: number;
  companyName?: string | null;
  status?: string | null;
}

export interface CreateTeamData {
  team_insert: Team_Key;
}

export interface CreateTeamVariables {
  name: string;
  legacyId?: string | null;
  companyId?: UUIDString | null;
  leaderId?: UUIDString | null;
  type?: string | null;
  status?: Status | null;
  totalManDay?: number | null;
}

export interface CreateUtilityRecordData {
  utilityRecord_insert: UtilityRecord_Key;
}

export interface CreateUtilityRecordVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  accommodationId: UUIDString;
  yearMonth: string;
  accommodationName?: string | null;
  costs?: string | null;
  paymentDate?: string | null;
  paymentStatus: string;
  memo?: string | null;
  isAnomaly?: boolean | null;
}

export interface CreateVehicleAssignmentData {
  vehicleAssignment_insert: VehicleAssignment_Key;
}

export interface CreateVehicleAssignmentVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  vehicleId: UUIDString;
  workerId?: UUIDString | null;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  startDate: string;
  endDate?: string | null;
  status?: string | null;
  memo?: string | null;
}

export interface CreateVehicleBillingDocumentData {
  vehicleBillingDocument_insert: VehicleBillingDocument_Key;
}

export interface CreateVehicleBillingDocumentVariables {
  id?: UUIDString | null;
  yearMonth: string;
  vehicleId: UUIDString;
  licensePlate: string;
  amount: number;
  status?: string | null;
  memo?: string | null;
}

export interface CreateVehicleData {
  vehicle_insert: Vehicle_Key;
}

export interface CreateVehicleExpenseData {
  vehicleExpense_insert: VehicleExpense_Key;
}

export interface CreateVehicleExpenseVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  vehicleId: UUIDString;
  date: string;
  type: string;
  amount: number;
  odometer?: number | null;
  memo?: string | null;
}

export interface CreateVehicleVariables {
  id?: UUIDString | null;
  legacyId?: string | null;
  licensePlate: string;
  model?: string | null;
  type?: string | null;
  owner?: string | null;
  status?: string | null;
  memo?: string | null;
}

export interface CreateWorkerData {
  worker_insert: Worker_Key;
}

export interface CreateWorkerVariables {
  name: string;
  legacyId?: string | null;
  teamId?: UUIDString | null;
  role?: string | null;
  payType?: string | null;
  unitPrice?: number | null;
  residentNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  isActive?: boolean | null;
  joinDate?: DateString | null;
}

export interface DailyDispatch_Key {
  id: UUIDString;
  __typename?: 'DailyDispatch_Key';
}

export interface DailyReportWorker_Key {
  dailyReportId: UUIDString;
  workerId: UUIDString;
  __typename?: 'DailyReportWorker_Key';
}

export interface DailyReport_Key {
  id: UUIDString;
  __typename?: 'DailyReport_Key';
}

export interface DeleteAccommodationAssignmentData {
  accommodationAssignment_delete?: AccommodationAssignment_Key | null;
}

export interface DeleteAccommodationAssignmentVariables {
  id: UUIDString;
}

export interface DeleteAccommodationBillingLineItemData {
  accommodationBillingLineItem_delete?: AccommodationBillingLineItem_Key | null;
}

export interface DeleteAccommodationBillingLineItemVariables {
  id: UUIDString;
}

export interface DeleteAccommodationData {
  accommodation_delete?: Accommodation_Key | null;
}

export interface DeleteAccommodationVariables {
  id: UUIDString;
}

export interface DeleteAdvancePaymentData {
  advancePayment_delete?: AdvancePayment_Key | null;
}

export interface DeleteAdvancePaymentVariables {
  id: string;
}

export interface DeleteAppUserData {
  appUser_delete?: AppUser_Key | null;
}

export interface DeleteAppUserVariables {
  id: string;
}

export interface DeleteCompanyData {
  company_delete?: Company_Key | null;
}

export interface DeleteCompanyVariables {
  id: UUIDString;
}

export interface DeleteDailyDispatchData {
  dailyDispatch_delete?: DailyDispatch_Key | null;
}

export interface DeleteDailyDispatchVariables {
  id: UUIDString;
}

export interface DeleteDailyReportData {
  dailyReport_delete?: DailyReport_Key | null;
}

export interface DeleteDailyReportVariables {
  id: UUIDString;
}

export interface DeleteDailyReportWorkerData {
  dailyReportWorker_delete?: DailyReportWorker_Key | null;
}

export interface DeleteDailyReportWorkerVariables {
  dailyReportId: UUIDString;
  workerId: UUIDString;
}

export interface DeleteMenuConfigData {
  menuConfig_delete?: MenuConfig_Key | null;
}

export interface DeleteMenuConfigVariables {
  id: string;
}

export interface DeletePaymentData {
  payment_delete?: Payment_Key | null;
}

export interface DeletePaymentVariables {
  id: UUIDString;
}

export interface DeletePositionData {
  position_delete?: Position_Key | null;
}

export interface DeletePositionVariables {
  id: UUIDString;
}

export interface DeleteReceivableData {
  receivable_delete?: Receivable_Key | null;
}

export interface DeleteReceivableVariables {
  id: UUIDString;
}

export interface DeleteSiteData {
  site_delete?: Site_Key | null;
}

export interface DeleteSiteVariables {
  id: UUIDString;
}

export interface DeleteSmartMemoCategoryData {
  smartMemoCategory_delete?: SmartMemoCategory_Key | null;
}

export interface DeleteSmartMemoCategoryVariables {
  id: UUIDString;
}

export interface DeleteSmartMemoData {
  smartMemo_delete?: SmartMemo_Key | null;
}

export interface DeleteSmartMemoVariables {
  id: UUIDString;
}

export interface DeleteTaxInvoiceData {
  taxInvoice_delete?: TaxInvoice_Key | null;
}

export interface DeleteTaxInvoiceVariables {
  id: UUIDString;
}

export interface DeleteTeamData {
  team_delete?: Team_Key | null;
}

export interface DeleteTeamVariables {
  id: UUIDString;
}

export interface DeleteUtilityRecordData {
  utilityRecord_delete?: UtilityRecord_Key | null;
}

export interface DeleteUtilityRecordVariables {
  accommodationId: UUIDString;
  yearMonth: string;
}

export interface DeleteVehicleAssignmentData {
  vehicleAssignment_delete?: VehicleAssignment_Key | null;
}

export interface DeleteVehicleAssignmentVariables {
  id: UUIDString;
}

export interface DeleteVehicleBillingDocumentData {
  vehicleBillingDocument_delete?: VehicleBillingDocument_Key | null;
}

export interface DeleteVehicleBillingDocumentVariables {
  id: UUIDString;
}

export interface DeleteVehicleData {
  vehicle_delete?: Vehicle_Key | null;
}

export interface DeleteVehicleExpenseData {
  vehicleExpense_delete?: VehicleExpense_Key | null;
}

export interface DeleteVehicleExpenseVariables {
  id: UUIDString;
}

export interface DeleteVehicleVariables {
  id: UUIDString;
}

export interface DeleteWorkerData {
  worker_delete?: Worker_Key | null;
}

export interface DeleteWorkerVariables {
  id: UUIDString;
}

export interface GetCompanyData {
  company?: {
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code: string;
    businessNumber?: string | null;
    ceoName?: string | null;
    type?: string | null;
    status: Status;
    createdAt: TimestampString;
  } & Company_Key;
}

export interface GetCompanyVariables {
  id: UUIDString;
}

export interface GetSiteData {
  site?: {
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code?: string | null;
    address?: string | null;
    startDate?: DateString | null;
    endDate?: DateString | null;
    status: Status;
    createdAt: TimestampString;
  } & Site_Key;
}

export interface GetSiteVariables {
  id: UUIDString;
}

export interface GetTeamData {
  team?: {
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    company?: {
      id: UUIDString;
      name: string;
    } & Company_Key;
      leader?: {
        id: UUIDString;
        name: string;
      } & Worker_Key;
        type?: string | null;
        status: Status;
        totalManDay?: number | null;
        createdAt: TimestampString;
  } & Team_Key;
}

export interface GetTeamVariables {
  id: UUIDString;
}

export interface GetWorkerData {
  worker?: {
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    role?: string | null;
    team?: {
      id: UUIDString;
      name: string;
      company?: {
        id: UUIDString;
        name: string;
      } & Company_Key;
    } & Team_Key;
      payType?: string | null;
      unitPrice?: number | null;
      phone?: string | null;
      residentNumber?: string | null;
      address?: string | null;
      isActive?: boolean | null;
      joinDate?: DateString | null;
      createdAt: TimestampString;
  } & Worker_Key;
}

export interface GetWorkerVariables {
  id: UUIDString;
}

export interface ListAgentConversationsData {
  agentConversations: ({
    id: string;
    mainAgentId?: string | null;
    userId?: string | null;
    messages?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & AgentConversation_Key)[];
}

export interface ListAgentsData {
  agents: ({
    id: string;
    name?: string | null;
    type?: string | null;
    role?: string | null;
    capabilities?: string | null;
    systemPrompt?: string | null;
    status?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Agent_Key)[];
}

export interface ListAllAccommodationAssignmentsData {
  accommodationAssignments: ({
    id: UUIDString;
  } & AccommodationAssignment_Key)[];
}

export interface ListAllAccommodationAssignmentsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllAccommodationBillingDocumentsData {
  accommodationBillingDocuments: ({
    id: UUIDString;
  } & AccommodationBillingDocument_Key)[];
}

export interface ListAllAccommodationBillingDocumentsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllAccommodationBillingLineItemsData {
  accommodationBillingLineItems: ({
    id: UUIDString;
  } & AccommodationBillingLineItem_Key)[];
}

export interface ListAllAccommodationBillingLineItemsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllAccommodationsData {
  accommodations: ({
    id: UUIDString;
  } & Accommodation_Key)[];
}

export interface ListAllAccommodationsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllAdvancePaymentsData {
  advancePayments: ({
    id: string;
  } & AdvancePayment_Key)[];
}

export interface ListAllAdvancePaymentsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllAgentConversationsData {
  agentConversations: ({
    id: string;
    mainAgentId?: string | null;
    userId?: string | null;
    messages?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & AgentConversation_Key)[];
}

export interface ListAllAgentConversationsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllAgentsData {
  agents: ({
    id: string;
    name?: string | null;
    type?: string | null;
    role?: string | null;
    capabilities?: string | null;
    systemPrompt?: string | null;
    status?: string | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Agent_Key)[];
}

export interface ListAllAgentsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllAppUsersData {
  appUsers: ({
    id: string;
    uid?: string | null;
    email?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
    linkedWorkerIds?: string | null;
    role?: string | null;
    lastLogin?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & AppUser_Key)[];
}

export interface ListAllAppUsersVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllAuditLogsData {
  auditLogs: ({
    id: string;
    action?: string | null;
    category?: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
    targetId?: string | null;
    details?: string | null;
    timestamp?: TimestampString | null;
    createdAt: TimestampString;
  } & AuditLog_Key)[];
}

export interface ListAllAuditLogsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllCompaniesData {
  companies: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code: string;
    businessNumber?: string | null;
    ceoName?: string | null;
    type?: string | null;
    status: Status;
    createdAt: TimestampString;
  } & Company_Key)[];
}

export interface ListAllCompaniesVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllDailyDispatchesData {
  dailyDispatches: ({
    id: UUIDString;
  } & DailyDispatch_Key)[];
}

export interface ListAllDailyDispatchesVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllDailyReportWorkersData {
  dailyReportWorkers: ({
    id: UUIDString;
    dailyReport: {
      id: UUIDString;
      legacyId?: string | null;
      date: DateString;
    } & DailyReport_Key;
      worker: {
        id: UUIDString;
        legacyId?: string | null;
        name: string;
      } & Worker_Key;
        gongsu: number;
        unitPrice: number;
        amount: number;
        workDescription?: string | null;
        legacyWorkerId?: string | null;
        legacyTeamId?: string | null;
        workerName?: string | null;
        role?: string | null;
        status?: string | null;
        manDay?: number | null;
        payType?: string | null;
        salaryModel?: string | null;
        workContent?: string | null;
        createdAt: TimestampString;
  })[];
}

export interface ListAllDailyReportWorkersVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllDailyReportsData {
  dailyReports: ({
    id: UUIDString;
    legacyId?: string | null;
    date: DateString;
    writerUid?: string | null;
    companyName?: string | null;
    responsibleTeamName?: string | null;
    responsibleTeamLegacyId?: string | null;
    team: {
      id: UUIDString;
      legacyId?: string | null;
      name: string;
    } & Team_Key;
      site?: {
        id: UUIDString;
        legacyId?: string | null;
        name: string;
      } & Site_Key;
        siteName?: string | null;
        status?: string | null;
        totalManDay?: number | null;
        totalAmount?: number | null;
        weather?: string | null;
        workContent?: string | null;
        createdAt: TimestampString;
  } & DailyReport_Key)[];
}

export interface ListAllDailyReportsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllMenuConfigsData {
  menuConfigs: ({
    id: string;
    config: string;
    updatedAt: TimestampString;
  } & MenuConfig_Key)[];
}

export interface ListAllMenuConfigsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllPaymentsData {
  payments: ({
    id: UUIDString;
  } & Payment_Key)[];
}

export interface ListAllPaymentsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllPositionsData {
  positions: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    rank?: number | null;
    color?: string | null;
    icon?: string | null;
    isDefault?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Position_Key)[];
}

export interface ListAllPositionsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllReceivablesData {
  receivables: ({
    id: UUIDString;
  } & Receivable_Key)[];
}

export interface ListAllReceivablesVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllSettingsData {
  settings: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & Setting_Key)[];
}

export interface ListAllSettingsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllSitesData {
  sites: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code?: string | null;
    address?: string | null;
    startDate?: DateString | null;
    endDate?: DateString | null;
    status: Status;
    createdAt: TimestampString;
  } & Site_Key)[];
}

export interface ListAllSitesVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllSmartMemoCategoriesData {
  smartMemoCategories: ({
    id: UUIDString;
  } & SmartMemoCategory_Key)[];
}

export interface ListAllSmartMemoCategoriesVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllSmartMemosData {
  smartMemos: ({
    id: UUIDString;
  } & SmartMemo_Key)[];
}

export interface ListAllSmartMemosVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllSystemConfigsData {
  systemConfigs: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & SystemConfig_Key)[];
}

export interface ListAllSystemConfigsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllSystemLogsData {
  systemLogs: ({
    id: UUIDString;
    category: string;
    action: string;
    userEmail?: string | null;
    details?: string | null;
    createdAt: TimestampString;
  } & SystemLog_Key)[];
}

export interface ListAllSystemLogsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllTaxInvoicesData {
  taxInvoices: ({
    id: UUIDString;
  } & TaxInvoice_Key)[];
}

export interface ListAllTaxInvoicesVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllTeamsData {
  teams: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    company?: {
      id: UUIDString;
      name: string;
    } & Company_Key;
      leader?: {
        id: UUIDString;
        name: string;
      } & Worker_Key;
        type?: string | null;
        status: Status;
        totalManDay?: number | null;
        createdAt: TimestampString;
  } & Team_Key)[];
}

export interface ListAllTeamsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllUtilityRecordsData {
  utilityRecords: ({
    id: UUIDString;
  })[];
}

export interface ListAllUtilityRecordsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllVehicleAssignmentsData {
  vehicleAssignments: ({
    id: UUIDString;
  } & VehicleAssignment_Key)[];
}

export interface ListAllVehicleAssignmentsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllVehicleBillingDocumentsData {
  vehicleBillingDocuments: ({
    id: UUIDString;
  } & VehicleBillingDocument_Key)[];
}

export interface ListAllVehicleBillingDocumentsVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllVehicleExpensesData {
  vehicleExpenses: ({
    id: UUIDString;
  } & VehicleExpense_Key)[];
}

export interface ListAllVehicleExpensesVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllVehiclesData {
  vehicles: ({
    id: UUIDString;
  } & Vehicle_Key)[];
}

export interface ListAllVehiclesVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAllWorkersData {
  workers: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    role?: string | null;
    team?: {
      id: UUIDString;
      name: string;
      company?: {
        id: UUIDString;
        name: string;
      } & Company_Key;
    } & Team_Key;
      payType?: string | null;
      unitPrice?: number | null;
      phone?: string | null;
      residentNumber?: string | null;
      address?: string | null;
      isActive?: boolean | null;
      joinDate?: DateString | null;
      createdAt: TimestampString;
  } & Worker_Key)[];
}

export interface ListAllWorkersVariables {
  limit?: number | null;
  offset?: number | null;
}

export interface ListAppUsersData {
  appUsers: ({
    id: string;
    uid?: string | null;
    email?: string | null;
    displayName?: string | null;
    photoUrl?: string | null;
    linkedWorkerIds?: string | null;
    role?: string | null;
    lastLogin?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & AppUser_Key)[];
}

export interface ListAuditLogsData {
  auditLogs: ({
    id: string;
    action?: string | null;
    category?: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
    targetId?: string | null;
    details?: string | null;
    timestamp?: TimestampString | null;
    createdAt: TimestampString;
  } & AuditLog_Key)[];
}

export interface ListCompaniesData {
  companies: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code: string;
    businessNumber?: string | null;
    ceoName?: string | null;
    type?: string | null;
    status: Status;
    createdAt: TimestampString;
  } & Company_Key)[];
}

export interface ListDailyReportWorkersData {
  dailyReportWorkers: ({
    id: UUIDString;
    dailyReport: {
      id: UUIDString;
      legacyId?: string | null;
      date: DateString;
    } & DailyReport_Key;
      worker: {
        id: UUIDString;
        legacyId?: string | null;
        name: string;
      } & Worker_Key;
        gongsu: number;
        unitPrice: number;
        amount: number;
        workDescription?: string | null;
        legacyWorkerId?: string | null;
        legacyTeamId?: string | null;
        workerName?: string | null;
        role?: string | null;
        status?: string | null;
        manDay?: number | null;
        payType?: string | null;
        salaryModel?: string | null;
        workContent?: string | null;
        createdAt: TimestampString;
  })[];
}

export interface ListDailyReportsData {
  dailyReports: ({
    id: UUIDString;
    legacyId?: string | null;
    date: DateString;
    writerUid?: string | null;
    companyName?: string | null;
    responsibleTeamName?: string | null;
    responsibleTeamLegacyId?: string | null;
    team: {
      id: UUIDString;
      legacyId?: string | null;
      name: string;
    } & Team_Key;
      site?: {
        id: UUIDString;
        legacyId?: string | null;
        name: string;
      } & Site_Key;
        siteName?: string | null;
        status?: string | null;
        totalManDay?: number | null;
        totalAmount?: number | null;
        weather?: string | null;
        workContent?: string | null;
        createdAt: TimestampString;
  } & DailyReport_Key)[];
}

export interface ListMenuConfigsData {
  menuConfigs: ({
    id: string;
    config: string;
    updatedAt: TimestampString;
  } & MenuConfig_Key)[];
}

export interface ListPositionsData {
  positions: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    rank?: number | null;
    color?: string | null;
    icon?: string | null;
    isDefault?: boolean | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Position_Key)[];
}

export interface ListSettingsData {
  settings: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & Setting_Key)[];
}

export interface ListSitesData {
  sites: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    code?: string | null;
    address?: string | null;
    startDate?: DateString | null;
    endDate?: DateString | null;
    status: Status;
    createdAt: TimestampString;
  } & Site_Key)[];
}

export interface ListSystemConfigsData {
  systemConfigs: ({
    id: string;
    data: string;
    updatedAt: TimestampString;
  } & SystemConfig_Key)[];
}

export interface ListSystemLogsData {
  systemLogs: ({
    id: UUIDString;
    category: string;
    action: string;
    userEmail?: string | null;
    details?: string | null;
    createdAt: TimestampString;
  } & SystemLog_Key)[];
}

export interface ListTeamsData {
  teams: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    company?: {
      id: UUIDString;
      name: string;
    } & Company_Key;
      leader?: {
        id: UUIDString;
        name: string;
      } & Worker_Key;
        type?: string | null;
        status: Status;
        totalManDay?: number | null;
        createdAt: TimestampString;
  } & Team_Key)[];
}

export interface ListWorkersData {
  workers: ({
    id: UUIDString;
    legacyId?: string | null;
    name: string;
    role?: string | null;
    team?: {
      id: UUIDString;
      name: string;
      company?: {
        id: UUIDString;
        name: string;
      } & Company_Key;
    } & Team_Key;
      payType?: string | null;
      unitPrice?: number | null;
      phone?: string | null;
      residentNumber?: string | null;
      address?: string | null;
      isActive?: boolean | null;
      joinDate?: DateString | null;
      createdAt: TimestampString;
  } & Worker_Key)[];
}

export interface MenuConfig_Key {
  id: string;
  __typename?: 'MenuConfig_Key';
}

export interface Payment_Key {
  id: UUIDString;
  __typename?: 'Payment_Key';
}

export interface Position_Key {
  id: UUIDString;
  __typename?: 'Position_Key';
}

export interface Receivable_Key {
  id: UUIDString;
  __typename?: 'Receivable_Key';
}

export interface Setting_Key {
  id: string;
  __typename?: 'Setting_Key';
}

export interface Site_Key {
  id: UUIDString;
  __typename?: 'Site_Key';
}

export interface SmartMemoCategory_Key {
  id: UUIDString;
  __typename?: 'SmartMemoCategory_Key';
}

export interface SmartMemo_Key {
  id: UUIDString;
  __typename?: 'SmartMemo_Key';
}

export interface SystemConfig_Key {
  id: string;
  __typename?: 'SystemConfig_Key';
}

export interface SystemLog_Key {
  id: UUIDString;
  __typename?: 'SystemLog_Key';
}

export interface TaxInvoice_Key {
  id: UUIDString;
  __typename?: 'TaxInvoice_Key';
}

export interface Team_Key {
  id: UUIDString;
  __typename?: 'Team_Key';
}

export interface UpdateAccommodationAssignmentData {
  accommodationAssignment_update?: AccommodationAssignment_Key | null;
}

export interface UpdateAccommodationAssignmentVariables {
  id: UUIDString;
  accommodationId?: UUIDString | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  workerId?: UUIDString | null;
  workerName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  source?: string | null;
  memo?: string | null;
}

export interface UpdateAccommodationBillingDocumentData {
  accommodationBillingDocument_update?: AccommodationBillingDocument_Key | null;
}

export interface UpdateAccommodationBillingDocumentVariables {
  id: UUIDString;
  yearMonth?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  issuedToType?: string | null;
  issuedToWorkerId?: UUIDString | null;
  issuedToWorkerName?: string | null;
  status?: string | null;
  memo?: string | null;
  confirmedAt?: TimestampString | null;
  postedAdvancePaymentId?: string | null;
}

export interface UpdateAccommodationData {
  accommodation_update?: Accommodation_Key | null;
}

export interface UpdateAccommodationVariables {
  id: UUIDString;
  name?: string | null;
  address?: string | null;
  type?: string | null;
  status?: string | null;
  ownership?: string | null;
  electricityMode?: string | null;
  gasMode?: string | null;
  waterMode?: string | null;
  internetMode?: string | null;
  maintenanceMode?: string | null;
  fixedElectricity?: number | null;
  fixedGas?: number | null;
  fixedWater?: number | null;
  fixedInternet?: number | null;
  fixedMaintenance?: number | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  deposit?: number | null;
  monthlyRent?: number | null;
  paymentDay?: number | null;
  landlordName?: string | null;
  landlordContact?: string | null;
  isReported?: boolean | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  rentPayDate?: number | null;
  isAutoTransfer?: boolean | null;
  transferDay?: number | null;
  transferAccountInfo?: string | null;
  billingTargetType?: string | null;
  billingTargetTeamId?: string | null;
  billingTargetTeamName?: string | null;
  billingTargetWorkerId?: string | null;
  billingTargetWorkerName?: string | null;
  currentOccupantName?: string | null;
  currentOccupantPhone?: string | null;
  memo?: string | null;
}

export interface UpdateAdvancePaymentData {
  advancePayment_update?: AdvancePayment_Key | null;
}

export interface UpdateAdvancePaymentVariables {
  id: string;
  workerId?: UUIDString | null;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  yearMonth?: string | null;
  items?: string | null;
  prevMonthCarryover?: number | null;
  accommodation?: number | null;
  privateRoom?: number | null;
  gloves?: number | null;
  deposit?: number | null;
  fines?: number | null;
  electricity?: number | null;
  gas?: number | null;
  internet?: number | null;
  water?: number | null;
  totalDeduction?: number | null;
  memo?: string | null;
  updatedAt?: TimestampString | null;
}

export interface UpdateAgentConversationData {
  agentConversation_update?: AgentConversation_Key | null;
}

export interface UpdateAgentConversationVariables {
  id: string;
}

export interface UpdateAgentData {
  agent_update?: Agent_Key | null;
}

export interface UpdateAgentVariables {
  id: string;
  name?: string | null;
  status?: string | null;
}

export interface UpdateAppUserData {
  appUser_update?: AppUser_Key | null;
}

export interface UpdateAppUserVariables {
  id: string;
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
  photoUrl?: string | null;
  linkedWorkerIds?: string | null;
  role?: string | null;
  lastLogin?: TimestampString | null;
}

export interface UpdateCompanyData {
  company_update?: Company_Key | null;
}

export interface UpdateCompanyVariables {
  id: UUIDString;
  name?: string | null;
  code?: string | null;
  businessNumber?: string | null;
  ceoName?: string | null;
  type?: string | null;
  status?: Status | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  ceoResidentNumber?: string | null;
  color?: string | null;
}

export interface UpdateDailyDispatchData {
  dailyDispatch_update?: DailyDispatch_Key | null;
}

export interface UpdateDailyDispatchVariables {
  id: UUIDString;
  date?: string | null;
  workerId?: UUIDString | null;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  siteId?: UUIDString | null;
  siteName?: string | null;
  status?: string | null;
}

export interface UpdateDailyReportData {
  dailyReport_update?: DailyReport_Key | null;
}

export interface UpdateDailyReportVariables {
  id: UUIDString;
  date?: DateString | null;
  teamId?: UUIDString | null;
  siteId?: UUIDString | null;
  siteName?: string | null;
  status?: string | null;
  totalManDay?: number | null;
  totalAmount?: number | null;
  weather?: string | null;
  writerUid?: string | null;
  companyName?: string | null;
  responsibleTeamName?: string | null;
  responsibleTeamLegacyId?: string | null;
  workContent?: string | null;
}

export interface UpdateDailyReportWorkerData {
  dailyReportWorker_update?: DailyReportWorker_Key | null;
}

export interface UpdateDailyReportWorkerVariables {
  dailyReportId: UUIDString;
  workerId: UUIDString;
  gongsu?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
  workDescription?: string | null;
  legacyWorkerId?: string | null;
  legacyTeamId?: string | null;
  workerName?: string | null;
  role?: string | null;
  status?: string | null;
  manDay?: number | null;
  payType?: string | null;
  salaryModel?: string | null;
  workContent?: string | null;
}

export interface UpdateMenuConfigData {
  menuConfig_update?: MenuConfig_Key | null;
}

export interface UpdateMenuConfigVariables {
  id: string;
  config: string;
}

export interface UpdatePaymentData {
  payment_update?: Payment_Key | null;
}

export interface UpdatePaymentVariables {
  id: UUIDString;
  date?: string | null;
  amount?: number | null;
  type?: string | null;
  method?: string | null;
  memo?: string | null;
}

export interface UpdateReceivableData {
  receivable_update?: Receivable_Key | null;
}

export interface UpdateReceivableVariables {
  id: UUIDString;
  date?: string | null;
  amount?: number | null;
  companyName?: string | null;
  status?: string | null;
}

export interface UpdateSettingData {
  setting_update?: Setting_Key | null;
}

export interface UpdateSettingVariables {
  id: string;
  data: string;
}

export interface UpdateSiteData {
  site_update?: Site_Key | null;
}

export interface UpdateSiteVariables {
  id: UUIDString;
  name?: string | null;
  code?: string | null;
  address?: string | null;
  startDate?: DateString | null;
  endDate?: DateString | null;
  status?: Status | null;
}

export interface UpdateSmartMemoCategoryData {
  smartMemoCategory_update?: SmartMemoCategory_Key | null;
}

export interface UpdateSmartMemoCategoryVariables {
  id: UUIDString;
  userId?: string | null;
  name?: string | null;
  color?: string | null;
  icon?: string | null;
  order?: number | null;
}

export interface UpdateSmartMemoData {
  smartMemo_update?: SmartMemo_Key | null;
}

export interface UpdateSmartMemoVariables {
  id: UUIDString;
  scope?: string | null;
  type?: string | null;
  title?: string | null;
  content?: string | null;
  checklistItems?: string | null;
  color?: string | null;
  order?: number | null;
  isPinned?: boolean | null;
  tags?: string | null;
  categoryId?: UUIDString | null;
  categoryLegacyId?: string | null;
  priority?: string | null;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  isCollapsed?: boolean | null;
  prevW?: number | null;
  prevH?: number | null;
}

export interface UpdateSystemConfigData {
  systemConfig_update?: SystemConfig_Key | null;
}

export interface UpdateSystemConfigVariables {
  id: string;
  data: string;
}

export interface UpdateTaxInvoiceData {
  taxInvoice_update?: TaxInvoice_Key | null;
}

export interface UpdateTaxInvoiceVariables {
  id: UUIDString;
  date?: string | null;
  amount?: number | null;
  tax?: number | null;
  total?: number | null;
  companyName?: string | null;
  status?: string | null;
}

export interface UpdateTeamData {
  team_update?: Team_Key | null;
}

export interface UpdateTeamVariables {
  id: UUIDString;
  name?: string | null;
  companyId?: UUIDString | null;
  leaderId?: UUIDString | null;
  type?: string | null;
  status?: Status | null;
  totalManDay?: number | null;
}

export interface UpdateUtilityRecordData {
  utilityRecord_update?: UtilityRecord_Key | null;
}

export interface UpdateUtilityRecordVariables {
  accommodationId: UUIDString;
  yearMonth: string;
  accommodationName?: string | null;
  costs?: string | null;
  paymentDate?: string | null;
  paymentStatus?: string | null;
  memo?: string | null;
  isAnomaly?: boolean | null;
}

export interface UpdateVehicleAssignmentData {
  vehicleAssignment_update?: VehicleAssignment_Key | null;
}

export interface UpdateVehicleAssignmentVariables {
  id: UUIDString;
  vehicleId?: UUIDString | null;
  workerId?: UUIDString | null;
  workerName?: string | null;
  teamId?: UUIDString | null;
  teamName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  memo?: string | null;
}

export interface UpdateVehicleBillingDocumentData {
  vehicleBillingDocument_update?: VehicleBillingDocument_Key | null;
}

export interface UpdateVehicleBillingDocumentVariables {
  id: UUIDString;
  yearMonth?: string | null;
  vehicleId?: UUIDString | null;
  licensePlate?: string | null;
  amount?: number | null;
  status?: string | null;
  memo?: string | null;
}

export interface UpdateVehicleData {
  vehicle_update?: Vehicle_Key | null;
}

export interface UpdateVehicleExpenseData {
  vehicleExpense_update?: VehicleExpense_Key | null;
}

export interface UpdateVehicleExpenseVariables {
  id: UUIDString;
  vehicleId?: UUIDString | null;
  date?: string | null;
  type?: string | null;
  amount?: number | null;
  odometer?: number | null;
  memo?: string | null;
}

export interface UpdateVehicleVariables {
  id: UUIDString;
  licensePlate?: string | null;
  model?: string | null;
  type?: string | null;
  owner?: string | null;
  status?: string | null;
  memo?: string | null;
}

export interface UpdateWorkerData {
  worker_update?: Worker_Key | null;
}

export interface UpdateWorkerVariables {
  id: UUIDString;
  name?: string | null;
  teamId?: UUIDString | null;
  role?: string | null;
  payType?: string | null;
  unitPrice?: number | null;
  phone?: string | null;
  residentNumber?: string | null;
  address?: string | null;
  isActive?: boolean | null;
}

export interface UtilityRecord_Key {
  accommodationId: UUIDString;
  yearMonth: string;
  __typename?: 'UtilityRecord_Key';
}

export interface VehicleAssignment_Key {
  id: UUIDString;
  __typename?: 'VehicleAssignment_Key';
}

export interface VehicleBillingDocument_Key {
  id: UUIDString;
  __typename?: 'VehicleBillingDocument_Key';
}

export interface VehicleExpense_Key {
  id: UUIDString;
  __typename?: 'VehicleExpense_Key';
}

export interface Vehicle_Key {
  id: UUIDString;
  __typename?: 'Vehicle_Key';
}

export interface Worker_Key {
  id: UUIDString;
  __typename?: 'Worker_Key';
}

interface CreateCompanyRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCompanyVariables): MutationRef<CreateCompanyData, CreateCompanyVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateCompanyVariables): MutationRef<CreateCompanyData, CreateCompanyVariables>;
  operationName: string;
}
export const createCompanyRef: CreateCompanyRef;

export function createCompany(vars: CreateCompanyVariables): MutationPromise<CreateCompanyData, CreateCompanyVariables>;
export function createCompany(dc: DataConnect, vars: CreateCompanyVariables): MutationPromise<CreateCompanyData, CreateCompanyVariables>;

interface CreateTeamRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateTeamVariables): MutationRef<CreateTeamData, CreateTeamVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateTeamVariables): MutationRef<CreateTeamData, CreateTeamVariables>;
  operationName: string;
}
export const createTeamRef: CreateTeamRef;

export function createTeam(vars: CreateTeamVariables): MutationPromise<CreateTeamData, CreateTeamVariables>;
export function createTeam(dc: DataConnect, vars: CreateTeamVariables): MutationPromise<CreateTeamData, CreateTeamVariables>;

interface CreateWorkerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateWorkerVariables): MutationRef<CreateWorkerData, CreateWorkerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateWorkerVariables): MutationRef<CreateWorkerData, CreateWorkerVariables>;
  operationName: string;
}
export const createWorkerRef: CreateWorkerRef;

export function createWorker(vars: CreateWorkerVariables): MutationPromise<CreateWorkerData, CreateWorkerVariables>;
export function createWorker(dc: DataConnect, vars: CreateWorkerVariables): MutationPromise<CreateWorkerData, CreateWorkerVariables>;

interface CreateSiteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSiteVariables): MutationRef<CreateSiteData, CreateSiteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateSiteVariables): MutationRef<CreateSiteData, CreateSiteVariables>;
  operationName: string;
}
export const createSiteRef: CreateSiteRef;

export function createSite(vars: CreateSiteVariables): MutationPromise<CreateSiteData, CreateSiteVariables>;
export function createSite(dc: DataConnect, vars: CreateSiteVariables): MutationPromise<CreateSiteData, CreateSiteVariables>;

interface CreateDailyReportRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDailyReportVariables): MutationRef<CreateDailyReportData, CreateDailyReportVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateDailyReportVariables): MutationRef<CreateDailyReportData, CreateDailyReportVariables>;
  operationName: string;
}
export const createDailyReportRef: CreateDailyReportRef;

export function createDailyReport(vars: CreateDailyReportVariables): MutationPromise<CreateDailyReportData, CreateDailyReportVariables>;
export function createDailyReport(dc: DataConnect, vars: CreateDailyReportVariables): MutationPromise<CreateDailyReportData, CreateDailyReportVariables>;

interface CreateDailyReportWorkerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDailyReportWorkerVariables): MutationRef<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateDailyReportWorkerVariables): MutationRef<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;
  operationName: string;
}
export const createDailyReportWorkerRef: CreateDailyReportWorkerRef;

export function createDailyReportWorker(vars: CreateDailyReportWorkerVariables): MutationPromise<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;
export function createDailyReportWorker(dc: DataConnect, vars: CreateDailyReportWorkerVariables): MutationPromise<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;

interface UpdateDailyReportWorkerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateDailyReportWorkerVariables): MutationRef<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateDailyReportWorkerVariables): MutationRef<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;
  operationName: string;
}
export const updateDailyReportWorkerRef: UpdateDailyReportWorkerRef;

export function updateDailyReportWorker(vars: UpdateDailyReportWorkerVariables): MutationPromise<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;
export function updateDailyReportWorker(dc: DataConnect, vars: UpdateDailyReportWorkerVariables): MutationPromise<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;

interface DeleteDailyReportWorkerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteDailyReportWorkerVariables): MutationRef<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteDailyReportWorkerVariables): MutationRef<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;
  operationName: string;
}
export const deleteDailyReportWorkerRef: DeleteDailyReportWorkerRef;

export function deleteDailyReportWorker(vars: DeleteDailyReportWorkerVariables): MutationPromise<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;
export function deleteDailyReportWorker(dc: DataConnect, vars: DeleteDailyReportWorkerVariables): MutationPromise<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;

interface CreatePositionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePositionVariables): MutationRef<CreatePositionData, CreatePositionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreatePositionVariables): MutationRef<CreatePositionData, CreatePositionVariables>;
  operationName: string;
}
export const createPositionRef: CreatePositionRef;

export function createPosition(vars: CreatePositionVariables): MutationPromise<CreatePositionData, CreatePositionVariables>;
export function createPosition(dc: DataConnect, vars: CreatePositionVariables): MutationPromise<CreatePositionData, CreatePositionVariables>;

interface CreateAuditLogRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAuditLogVariables): MutationRef<CreateAuditLogData, CreateAuditLogVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAuditLogVariables): MutationRef<CreateAuditLogData, CreateAuditLogVariables>;
  operationName: string;
}
export const createAuditLogRef: CreateAuditLogRef;

export function createAuditLog(vars: CreateAuditLogVariables): MutationPromise<CreateAuditLogData, CreateAuditLogVariables>;
export function createAuditLog(dc: DataConnect, vars: CreateAuditLogVariables): MutationPromise<CreateAuditLogData, CreateAuditLogVariables>;

interface CreateAgentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAgentVariables): MutationRef<CreateAgentData, CreateAgentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAgentVariables): MutationRef<CreateAgentData, CreateAgentVariables>;
  operationName: string;
}
export const createAgentRef: CreateAgentRef;

export function createAgent(vars: CreateAgentVariables): MutationPromise<CreateAgentData, CreateAgentVariables>;
export function createAgent(dc: DataConnect, vars: CreateAgentVariables): MutationPromise<CreateAgentData, CreateAgentVariables>;

interface CreateAgentConversationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAgentConversationVariables): MutationRef<CreateAgentConversationData, CreateAgentConversationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAgentConversationVariables): MutationRef<CreateAgentConversationData, CreateAgentConversationVariables>;
  operationName: string;
}
export const createAgentConversationRef: CreateAgentConversationRef;

export function createAgentConversation(vars: CreateAgentConversationVariables): MutationPromise<CreateAgentConversationData, CreateAgentConversationVariables>;
export function createAgentConversation(dc: DataConnect, vars: CreateAgentConversationVariables): MutationPromise<CreateAgentConversationData, CreateAgentConversationVariables>;

interface CreateSettingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSettingVariables): MutationRef<CreateSettingData, CreateSettingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateSettingVariables): MutationRef<CreateSettingData, CreateSettingVariables>;
  operationName: string;
}
export const createSettingRef: CreateSettingRef;

export function createSetting(vars: CreateSettingVariables): MutationPromise<CreateSettingData, CreateSettingVariables>;
export function createSetting(dc: DataConnect, vars: CreateSettingVariables): MutationPromise<CreateSettingData, CreateSettingVariables>;

interface UpdateSettingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSettingVariables): MutationRef<UpdateSettingData, UpdateSettingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateSettingVariables): MutationRef<UpdateSettingData, UpdateSettingVariables>;
  operationName: string;
}
export const updateSettingRef: UpdateSettingRef;

export function updateSetting(vars: UpdateSettingVariables): MutationPromise<UpdateSettingData, UpdateSettingVariables>;
export function updateSetting(dc: DataConnect, vars: UpdateSettingVariables): MutationPromise<UpdateSettingData, UpdateSettingVariables>;

interface CreateSystemConfigRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSystemConfigVariables): MutationRef<CreateSystemConfigData, CreateSystemConfigVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateSystemConfigVariables): MutationRef<CreateSystemConfigData, CreateSystemConfigVariables>;
  operationName: string;
}
export const createSystemConfigRef: CreateSystemConfigRef;

export function createSystemConfig(vars: CreateSystemConfigVariables): MutationPromise<CreateSystemConfigData, CreateSystemConfigVariables>;
export function createSystemConfig(dc: DataConnect, vars: CreateSystemConfigVariables): MutationPromise<CreateSystemConfigData, CreateSystemConfigVariables>;

interface UpdateSystemConfigRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSystemConfigVariables): MutationRef<UpdateSystemConfigData, UpdateSystemConfigVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateSystemConfigVariables): MutationRef<UpdateSystemConfigData, UpdateSystemConfigVariables>;
  operationName: string;
}
export const updateSystemConfigRef: UpdateSystemConfigRef;

export function updateSystemConfig(vars: UpdateSystemConfigVariables): MutationPromise<UpdateSystemConfigData, UpdateSystemConfigVariables>;
export function updateSystemConfig(dc: DataConnect, vars: UpdateSystemConfigVariables): MutationPromise<UpdateSystemConfigData, UpdateSystemConfigVariables>;

interface DeletePositionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeletePositionVariables): MutationRef<DeletePositionData, DeletePositionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeletePositionVariables): MutationRef<DeletePositionData, DeletePositionVariables>;
  operationName: string;
}
export const deletePositionRef: DeletePositionRef;

export function deletePosition(vars: DeletePositionVariables): MutationPromise<DeletePositionData, DeletePositionVariables>;
export function deletePosition(dc: DataConnect, vars: DeletePositionVariables): MutationPromise<DeletePositionData, DeletePositionVariables>;

interface UpdateCompanyRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCompanyVariables): MutationRef<UpdateCompanyData, UpdateCompanyVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateCompanyVariables): MutationRef<UpdateCompanyData, UpdateCompanyVariables>;
  operationName: string;
}
export const updateCompanyRef: UpdateCompanyRef;

export function updateCompany(vars: UpdateCompanyVariables): MutationPromise<UpdateCompanyData, UpdateCompanyVariables>;
export function updateCompany(dc: DataConnect, vars: UpdateCompanyVariables): MutationPromise<UpdateCompanyData, UpdateCompanyVariables>;

interface DeleteCompanyRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteCompanyVariables): MutationRef<DeleteCompanyData, DeleteCompanyVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteCompanyVariables): MutationRef<DeleteCompanyData, DeleteCompanyVariables>;
  operationName: string;
}
export const deleteCompanyRef: DeleteCompanyRef;

export function deleteCompany(vars: DeleteCompanyVariables): MutationPromise<DeleteCompanyData, DeleteCompanyVariables>;
export function deleteCompany(dc: DataConnect, vars: DeleteCompanyVariables): MutationPromise<DeleteCompanyData, DeleteCompanyVariables>;

interface UpdateTeamRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTeamVariables): MutationRef<UpdateTeamData, UpdateTeamVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateTeamVariables): MutationRef<UpdateTeamData, UpdateTeamVariables>;
  operationName: string;
}
export const updateTeamRef: UpdateTeamRef;

export function updateTeam(vars: UpdateTeamVariables): MutationPromise<UpdateTeamData, UpdateTeamVariables>;
export function updateTeam(dc: DataConnect, vars: UpdateTeamVariables): MutationPromise<UpdateTeamData, UpdateTeamVariables>;

interface DeleteTeamRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteTeamVariables): MutationRef<DeleteTeamData, DeleteTeamVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteTeamVariables): MutationRef<DeleteTeamData, DeleteTeamVariables>;
  operationName: string;
}
export const deleteTeamRef: DeleteTeamRef;

export function deleteTeam(vars: DeleteTeamVariables): MutationPromise<DeleteTeamData, DeleteTeamVariables>;
export function deleteTeam(dc: DataConnect, vars: DeleteTeamVariables): MutationPromise<DeleteTeamData, DeleteTeamVariables>;

interface UpdateWorkerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateWorkerVariables): MutationRef<UpdateWorkerData, UpdateWorkerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateWorkerVariables): MutationRef<UpdateWorkerData, UpdateWorkerVariables>;
  operationName: string;
}
export const updateWorkerRef: UpdateWorkerRef;

export function updateWorker(vars: UpdateWorkerVariables): MutationPromise<UpdateWorkerData, UpdateWorkerVariables>;
export function updateWorker(dc: DataConnect, vars: UpdateWorkerVariables): MutationPromise<UpdateWorkerData, UpdateWorkerVariables>;

interface DeleteWorkerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteWorkerVariables): MutationRef<DeleteWorkerData, DeleteWorkerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteWorkerVariables): MutationRef<DeleteWorkerData, DeleteWorkerVariables>;
  operationName: string;
}
export const deleteWorkerRef: DeleteWorkerRef;

export function deleteWorker(vars: DeleteWorkerVariables): MutationPromise<DeleteWorkerData, DeleteWorkerVariables>;
export function deleteWorker(dc: DataConnect, vars: DeleteWorkerVariables): MutationPromise<DeleteWorkerData, DeleteWorkerVariables>;

interface UpdateSiteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSiteVariables): MutationRef<UpdateSiteData, UpdateSiteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateSiteVariables): MutationRef<UpdateSiteData, UpdateSiteVariables>;
  operationName: string;
}
export const updateSiteRef: UpdateSiteRef;

export function updateSite(vars: UpdateSiteVariables): MutationPromise<UpdateSiteData, UpdateSiteVariables>;
export function updateSite(dc: DataConnect, vars: UpdateSiteVariables): MutationPromise<UpdateSiteData, UpdateSiteVariables>;

interface DeleteSiteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteSiteVariables): MutationRef<DeleteSiteData, DeleteSiteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteSiteVariables): MutationRef<DeleteSiteData, DeleteSiteVariables>;
  operationName: string;
}
export const deleteSiteRef: DeleteSiteRef;

export function deleteSite(vars: DeleteSiteVariables): MutationPromise<DeleteSiteData, DeleteSiteVariables>;
export function deleteSite(dc: DataConnect, vars: DeleteSiteVariables): MutationPromise<DeleteSiteData, DeleteSiteVariables>;

interface UpdateDailyReportRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateDailyReportVariables): MutationRef<UpdateDailyReportData, UpdateDailyReportVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateDailyReportVariables): MutationRef<UpdateDailyReportData, UpdateDailyReportVariables>;
  operationName: string;
}
export const updateDailyReportRef: UpdateDailyReportRef;

export function updateDailyReport(vars: UpdateDailyReportVariables): MutationPromise<UpdateDailyReportData, UpdateDailyReportVariables>;
export function updateDailyReport(dc: DataConnect, vars: UpdateDailyReportVariables): MutationPromise<UpdateDailyReportData, UpdateDailyReportVariables>;

interface DeleteDailyReportRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteDailyReportVariables): MutationRef<DeleteDailyReportData, DeleteDailyReportVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteDailyReportVariables): MutationRef<DeleteDailyReportData, DeleteDailyReportVariables>;
  operationName: string;
}
export const deleteDailyReportRef: DeleteDailyReportRef;

export function deleteDailyReport(vars: DeleteDailyReportVariables): MutationPromise<DeleteDailyReportData, DeleteDailyReportVariables>;
export function deleteDailyReport(dc: DataConnect, vars: DeleteDailyReportVariables): MutationPromise<DeleteDailyReportData, DeleteDailyReportVariables>;

interface CreateAppUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAppUserVariables): MutationRef<CreateAppUserData, CreateAppUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAppUserVariables): MutationRef<CreateAppUserData, CreateAppUserVariables>;
  operationName: string;
}
export const createAppUserRef: CreateAppUserRef;

export function createAppUser(vars: CreateAppUserVariables): MutationPromise<CreateAppUserData, CreateAppUserVariables>;
export function createAppUser(dc: DataConnect, vars: CreateAppUserVariables): MutationPromise<CreateAppUserData, CreateAppUserVariables>;

interface UpdateAppUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAppUserVariables): MutationRef<UpdateAppUserData, UpdateAppUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAppUserVariables): MutationRef<UpdateAppUserData, UpdateAppUserVariables>;
  operationName: string;
}
export const updateAppUserRef: UpdateAppUserRef;

export function updateAppUser(vars: UpdateAppUserVariables): MutationPromise<UpdateAppUserData, UpdateAppUserVariables>;
export function updateAppUser(dc: DataConnect, vars: UpdateAppUserVariables): MutationPromise<UpdateAppUserData, UpdateAppUserVariables>;

interface DeleteAppUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAppUserVariables): MutationRef<DeleteAppUserData, DeleteAppUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteAppUserVariables): MutationRef<DeleteAppUserData, DeleteAppUserVariables>;
  operationName: string;
}
export const deleteAppUserRef: DeleteAppUserRef;

export function deleteAppUser(vars: DeleteAppUserVariables): MutationPromise<DeleteAppUserData, DeleteAppUserVariables>;
export function deleteAppUser(dc: DataConnect, vars: DeleteAppUserVariables): MutationPromise<DeleteAppUserData, DeleteAppUserVariables>;

interface CreateMenuConfigRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateMenuConfigVariables): MutationRef<CreateMenuConfigData, CreateMenuConfigVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateMenuConfigVariables): MutationRef<CreateMenuConfigData, CreateMenuConfigVariables>;
  operationName: string;
}
export const createMenuConfigRef: CreateMenuConfigRef;

export function createMenuConfig(vars: CreateMenuConfigVariables): MutationPromise<CreateMenuConfigData, CreateMenuConfigVariables>;
export function createMenuConfig(dc: DataConnect, vars: CreateMenuConfigVariables): MutationPromise<CreateMenuConfigData, CreateMenuConfigVariables>;

interface UpdateMenuConfigRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMenuConfigVariables): MutationRef<UpdateMenuConfigData, UpdateMenuConfigVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateMenuConfigVariables): MutationRef<UpdateMenuConfigData, UpdateMenuConfigVariables>;
  operationName: string;
}
export const updateMenuConfigRef: UpdateMenuConfigRef;

export function updateMenuConfig(vars: UpdateMenuConfigVariables): MutationPromise<UpdateMenuConfigData, UpdateMenuConfigVariables>;
export function updateMenuConfig(dc: DataConnect, vars: UpdateMenuConfigVariables): MutationPromise<UpdateMenuConfigData, UpdateMenuConfigVariables>;

interface DeleteMenuConfigRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteMenuConfigVariables): MutationRef<DeleteMenuConfigData, DeleteMenuConfigVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteMenuConfigVariables): MutationRef<DeleteMenuConfigData, DeleteMenuConfigVariables>;
  operationName: string;
}
export const deleteMenuConfigRef: DeleteMenuConfigRef;

export function deleteMenuConfig(vars: DeleteMenuConfigVariables): MutationPromise<DeleteMenuConfigData, DeleteMenuConfigVariables>;
export function deleteMenuConfig(dc: DataConnect, vars: DeleteMenuConfigVariables): MutationPromise<DeleteMenuConfigData, DeleteMenuConfigVariables>;

interface CreateSystemLogRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSystemLogVariables): MutationRef<CreateSystemLogData, CreateSystemLogVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateSystemLogVariables): MutationRef<CreateSystemLogData, CreateSystemLogVariables>;
  operationName: string;
}
export const createSystemLogRef: CreateSystemLogRef;

export function createSystemLog(vars: CreateSystemLogVariables): MutationPromise<CreateSystemLogData, CreateSystemLogVariables>;
export function createSystemLog(dc: DataConnect, vars: CreateSystemLogVariables): MutationPromise<CreateSystemLogData, CreateSystemLogVariables>;

interface CreateAccommodationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccommodationVariables): MutationRef<CreateAccommodationData, CreateAccommodationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAccommodationVariables): MutationRef<CreateAccommodationData, CreateAccommodationVariables>;
  operationName: string;
}
export const createAccommodationRef: CreateAccommodationRef;

export function createAccommodation(vars: CreateAccommodationVariables): MutationPromise<CreateAccommodationData, CreateAccommodationVariables>;
export function createAccommodation(dc: DataConnect, vars: CreateAccommodationVariables): MutationPromise<CreateAccommodationData, CreateAccommodationVariables>;

interface UpdateAccommodationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAccommodationVariables): MutationRef<UpdateAccommodationData, UpdateAccommodationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAccommodationVariables): MutationRef<UpdateAccommodationData, UpdateAccommodationVariables>;
  operationName: string;
}
export const updateAccommodationRef: UpdateAccommodationRef;

export function updateAccommodation(vars: UpdateAccommodationVariables): MutationPromise<UpdateAccommodationData, UpdateAccommodationVariables>;
export function updateAccommodation(dc: DataConnect, vars: UpdateAccommodationVariables): MutationPromise<UpdateAccommodationData, UpdateAccommodationVariables>;

interface DeleteAccommodationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAccommodationVariables): MutationRef<DeleteAccommodationData, DeleteAccommodationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteAccommodationVariables): MutationRef<DeleteAccommodationData, DeleteAccommodationVariables>;
  operationName: string;
}
export const deleteAccommodationRef: DeleteAccommodationRef;

export function deleteAccommodation(vars: DeleteAccommodationVariables): MutationPromise<DeleteAccommodationData, DeleteAccommodationVariables>;
export function deleteAccommodation(dc: DataConnect, vars: DeleteAccommodationVariables): MutationPromise<DeleteAccommodationData, DeleteAccommodationVariables>;

interface CreateAccommodationAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccommodationAssignmentVariables): MutationRef<CreateAccommodationAssignmentData, CreateAccommodationAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAccommodationAssignmentVariables): MutationRef<CreateAccommodationAssignmentData, CreateAccommodationAssignmentVariables>;
  operationName: string;
}
export const createAccommodationAssignmentRef: CreateAccommodationAssignmentRef;

export function createAccommodationAssignment(vars: CreateAccommodationAssignmentVariables): MutationPromise<CreateAccommodationAssignmentData, CreateAccommodationAssignmentVariables>;
export function createAccommodationAssignment(dc: DataConnect, vars: CreateAccommodationAssignmentVariables): MutationPromise<CreateAccommodationAssignmentData, CreateAccommodationAssignmentVariables>;

interface UpdateAccommodationAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAccommodationAssignmentVariables): MutationRef<UpdateAccommodationAssignmentData, UpdateAccommodationAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAccommodationAssignmentVariables): MutationRef<UpdateAccommodationAssignmentData, UpdateAccommodationAssignmentVariables>;
  operationName: string;
}
export const updateAccommodationAssignmentRef: UpdateAccommodationAssignmentRef;

export function updateAccommodationAssignment(vars: UpdateAccommodationAssignmentVariables): MutationPromise<UpdateAccommodationAssignmentData, UpdateAccommodationAssignmentVariables>;
export function updateAccommodationAssignment(dc: DataConnect, vars: UpdateAccommodationAssignmentVariables): MutationPromise<UpdateAccommodationAssignmentData, UpdateAccommodationAssignmentVariables>;

interface DeleteAccommodationAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAccommodationAssignmentVariables): MutationRef<DeleteAccommodationAssignmentData, DeleteAccommodationAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteAccommodationAssignmentVariables): MutationRef<DeleteAccommodationAssignmentData, DeleteAccommodationAssignmentVariables>;
  operationName: string;
}
export const deleteAccommodationAssignmentRef: DeleteAccommodationAssignmentRef;

export function deleteAccommodationAssignment(vars: DeleteAccommodationAssignmentVariables): MutationPromise<DeleteAccommodationAssignmentData, DeleteAccommodationAssignmentVariables>;
export function deleteAccommodationAssignment(dc: DataConnect, vars: DeleteAccommodationAssignmentVariables): MutationPromise<DeleteAccommodationAssignmentData, DeleteAccommodationAssignmentVariables>;

interface CreateUtilityRecordRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUtilityRecordVariables): MutationRef<CreateUtilityRecordData, CreateUtilityRecordVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUtilityRecordVariables): MutationRef<CreateUtilityRecordData, CreateUtilityRecordVariables>;
  operationName: string;
}
export const createUtilityRecordRef: CreateUtilityRecordRef;

export function createUtilityRecord(vars: CreateUtilityRecordVariables): MutationPromise<CreateUtilityRecordData, CreateUtilityRecordVariables>;
export function createUtilityRecord(dc: DataConnect, vars: CreateUtilityRecordVariables): MutationPromise<CreateUtilityRecordData, CreateUtilityRecordVariables>;

interface UpdateUtilityRecordRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUtilityRecordVariables): MutationRef<UpdateUtilityRecordData, UpdateUtilityRecordVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUtilityRecordVariables): MutationRef<UpdateUtilityRecordData, UpdateUtilityRecordVariables>;
  operationName: string;
}
export const updateUtilityRecordRef: UpdateUtilityRecordRef;

export function updateUtilityRecord(vars: UpdateUtilityRecordVariables): MutationPromise<UpdateUtilityRecordData, UpdateUtilityRecordVariables>;
export function updateUtilityRecord(dc: DataConnect, vars: UpdateUtilityRecordVariables): MutationPromise<UpdateUtilityRecordData, UpdateUtilityRecordVariables>;

interface DeleteUtilityRecordRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteUtilityRecordVariables): MutationRef<DeleteUtilityRecordData, DeleteUtilityRecordVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteUtilityRecordVariables): MutationRef<DeleteUtilityRecordData, DeleteUtilityRecordVariables>;
  operationName: string;
}
export const deleteUtilityRecordRef: DeleteUtilityRecordRef;

export function deleteUtilityRecord(vars: DeleteUtilityRecordVariables): MutationPromise<DeleteUtilityRecordData, DeleteUtilityRecordVariables>;
export function deleteUtilityRecord(dc: DataConnect, vars: DeleteUtilityRecordVariables): MutationPromise<DeleteUtilityRecordData, DeleteUtilityRecordVariables>;

interface CreateAccommodationBillingDocumentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccommodationBillingDocumentVariables): MutationRef<CreateAccommodationBillingDocumentData, CreateAccommodationBillingDocumentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAccommodationBillingDocumentVariables): MutationRef<CreateAccommodationBillingDocumentData, CreateAccommodationBillingDocumentVariables>;
  operationName: string;
}
export const createAccommodationBillingDocumentRef: CreateAccommodationBillingDocumentRef;

export function createAccommodationBillingDocument(vars: CreateAccommodationBillingDocumentVariables): MutationPromise<CreateAccommodationBillingDocumentData, CreateAccommodationBillingDocumentVariables>;
export function createAccommodationBillingDocument(dc: DataConnect, vars: CreateAccommodationBillingDocumentVariables): MutationPromise<CreateAccommodationBillingDocumentData, CreateAccommodationBillingDocumentVariables>;

interface UpdateAccommodationBillingDocumentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAccommodationBillingDocumentVariables): MutationRef<UpdateAccommodationBillingDocumentData, UpdateAccommodationBillingDocumentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAccommodationBillingDocumentVariables): MutationRef<UpdateAccommodationBillingDocumentData, UpdateAccommodationBillingDocumentVariables>;
  operationName: string;
}
export const updateAccommodationBillingDocumentRef: UpdateAccommodationBillingDocumentRef;

export function updateAccommodationBillingDocument(vars: UpdateAccommodationBillingDocumentVariables): MutationPromise<UpdateAccommodationBillingDocumentData, UpdateAccommodationBillingDocumentVariables>;
export function updateAccommodationBillingDocument(dc: DataConnect, vars: UpdateAccommodationBillingDocumentVariables): MutationPromise<UpdateAccommodationBillingDocumentData, UpdateAccommodationBillingDocumentVariables>;

interface CreateAccommodationBillingLineItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAccommodationBillingLineItemVariables): MutationRef<CreateAccommodationBillingLineItemData, CreateAccommodationBillingLineItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAccommodationBillingLineItemVariables): MutationRef<CreateAccommodationBillingLineItemData, CreateAccommodationBillingLineItemVariables>;
  operationName: string;
}
export const createAccommodationBillingLineItemRef: CreateAccommodationBillingLineItemRef;

export function createAccommodationBillingLineItem(vars: CreateAccommodationBillingLineItemVariables): MutationPromise<CreateAccommodationBillingLineItemData, CreateAccommodationBillingLineItemVariables>;
export function createAccommodationBillingLineItem(dc: DataConnect, vars: CreateAccommodationBillingLineItemVariables): MutationPromise<CreateAccommodationBillingLineItemData, CreateAccommodationBillingLineItemVariables>;

interface DeleteAccommodationBillingLineItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAccommodationBillingLineItemVariables): MutationRef<DeleteAccommodationBillingLineItemData, DeleteAccommodationBillingLineItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteAccommodationBillingLineItemVariables): MutationRef<DeleteAccommodationBillingLineItemData, DeleteAccommodationBillingLineItemVariables>;
  operationName: string;
}
export const deleteAccommodationBillingLineItemRef: DeleteAccommodationBillingLineItemRef;

export function deleteAccommodationBillingLineItem(vars: DeleteAccommodationBillingLineItemVariables): MutationPromise<DeleteAccommodationBillingLineItemData, DeleteAccommodationBillingLineItemVariables>;
export function deleteAccommodationBillingLineItem(dc: DataConnect, vars: DeleteAccommodationBillingLineItemVariables): MutationPromise<DeleteAccommodationBillingLineItemData, DeleteAccommodationBillingLineItemVariables>;

interface CreateAdvancePaymentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAdvancePaymentVariables): MutationRef<CreateAdvancePaymentData, CreateAdvancePaymentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAdvancePaymentVariables): MutationRef<CreateAdvancePaymentData, CreateAdvancePaymentVariables>;
  operationName: string;
}
export const createAdvancePaymentRef: CreateAdvancePaymentRef;

export function createAdvancePayment(vars: CreateAdvancePaymentVariables): MutationPromise<CreateAdvancePaymentData, CreateAdvancePaymentVariables>;
export function createAdvancePayment(dc: DataConnect, vars: CreateAdvancePaymentVariables): MutationPromise<CreateAdvancePaymentData, CreateAdvancePaymentVariables>;

interface UpdateAdvancePaymentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAdvancePaymentVariables): MutationRef<UpdateAdvancePaymentData, UpdateAdvancePaymentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAdvancePaymentVariables): MutationRef<UpdateAdvancePaymentData, UpdateAdvancePaymentVariables>;
  operationName: string;
}
export const updateAdvancePaymentRef: UpdateAdvancePaymentRef;

export function updateAdvancePayment(vars: UpdateAdvancePaymentVariables): MutationPromise<UpdateAdvancePaymentData, UpdateAdvancePaymentVariables>;
export function updateAdvancePayment(dc: DataConnect, vars: UpdateAdvancePaymentVariables): MutationPromise<UpdateAdvancePaymentData, UpdateAdvancePaymentVariables>;

interface DeleteAdvancePaymentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAdvancePaymentVariables): MutationRef<DeleteAdvancePaymentData, DeleteAdvancePaymentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteAdvancePaymentVariables): MutationRef<DeleteAdvancePaymentData, DeleteAdvancePaymentVariables>;
  operationName: string;
}
export const deleteAdvancePaymentRef: DeleteAdvancePaymentRef;

export function deleteAdvancePayment(vars: DeleteAdvancePaymentVariables): MutationPromise<DeleteAdvancePaymentData, DeleteAdvancePaymentVariables>;
export function deleteAdvancePayment(dc: DataConnect, vars: DeleteAdvancePaymentVariables): MutationPromise<DeleteAdvancePaymentData, DeleteAdvancePaymentVariables>;

interface CreateSmartMemoRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSmartMemoVariables): MutationRef<CreateSmartMemoData, CreateSmartMemoVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateSmartMemoVariables): MutationRef<CreateSmartMemoData, CreateSmartMemoVariables>;
  operationName: string;
}
export const createSmartMemoRef: CreateSmartMemoRef;

export function createSmartMemo(vars: CreateSmartMemoVariables): MutationPromise<CreateSmartMemoData, CreateSmartMemoVariables>;
export function createSmartMemo(dc: DataConnect, vars: CreateSmartMemoVariables): MutationPromise<CreateSmartMemoData, CreateSmartMemoVariables>;

interface UpdateSmartMemoRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSmartMemoVariables): MutationRef<UpdateSmartMemoData, UpdateSmartMemoVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateSmartMemoVariables): MutationRef<UpdateSmartMemoData, UpdateSmartMemoVariables>;
  operationName: string;
}
export const updateSmartMemoRef: UpdateSmartMemoRef;

export function updateSmartMemo(vars: UpdateSmartMemoVariables): MutationPromise<UpdateSmartMemoData, UpdateSmartMemoVariables>;
export function updateSmartMemo(dc: DataConnect, vars: UpdateSmartMemoVariables): MutationPromise<UpdateSmartMemoData, UpdateSmartMemoVariables>;

interface DeleteSmartMemoRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteSmartMemoVariables): MutationRef<DeleteSmartMemoData, DeleteSmartMemoVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteSmartMemoVariables): MutationRef<DeleteSmartMemoData, DeleteSmartMemoVariables>;
  operationName: string;
}
export const deleteSmartMemoRef: DeleteSmartMemoRef;

export function deleteSmartMemo(vars: DeleteSmartMemoVariables): MutationPromise<DeleteSmartMemoData, DeleteSmartMemoVariables>;
export function deleteSmartMemo(dc: DataConnect, vars: DeleteSmartMemoVariables): MutationPromise<DeleteSmartMemoData, DeleteSmartMemoVariables>;

interface CreateSmartMemoCategoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSmartMemoCategoryVariables): MutationRef<CreateSmartMemoCategoryData, CreateSmartMemoCategoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateSmartMemoCategoryVariables): MutationRef<CreateSmartMemoCategoryData, CreateSmartMemoCategoryVariables>;
  operationName: string;
}
export const createSmartMemoCategoryRef: CreateSmartMemoCategoryRef;

export function createSmartMemoCategory(vars: CreateSmartMemoCategoryVariables): MutationPromise<CreateSmartMemoCategoryData, CreateSmartMemoCategoryVariables>;
export function createSmartMemoCategory(dc: DataConnect, vars: CreateSmartMemoCategoryVariables): MutationPromise<CreateSmartMemoCategoryData, CreateSmartMemoCategoryVariables>;

interface UpdateSmartMemoCategoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSmartMemoCategoryVariables): MutationRef<UpdateSmartMemoCategoryData, UpdateSmartMemoCategoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateSmartMemoCategoryVariables): MutationRef<UpdateSmartMemoCategoryData, UpdateSmartMemoCategoryVariables>;
  operationName: string;
}
export const updateSmartMemoCategoryRef: UpdateSmartMemoCategoryRef;

export function updateSmartMemoCategory(vars: UpdateSmartMemoCategoryVariables): MutationPromise<UpdateSmartMemoCategoryData, UpdateSmartMemoCategoryVariables>;
export function updateSmartMemoCategory(dc: DataConnect, vars: UpdateSmartMemoCategoryVariables): MutationPromise<UpdateSmartMemoCategoryData, UpdateSmartMemoCategoryVariables>;

interface DeleteSmartMemoCategoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteSmartMemoCategoryVariables): MutationRef<DeleteSmartMemoCategoryData, DeleteSmartMemoCategoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteSmartMemoCategoryVariables): MutationRef<DeleteSmartMemoCategoryData, DeleteSmartMemoCategoryVariables>;
  operationName: string;
}
export const deleteSmartMemoCategoryRef: DeleteSmartMemoCategoryRef;

export function deleteSmartMemoCategory(vars: DeleteSmartMemoCategoryVariables): MutationPromise<DeleteSmartMemoCategoryData, DeleteSmartMemoCategoryVariables>;
export function deleteSmartMemoCategory(dc: DataConnect, vars: DeleteSmartMemoCategoryVariables): MutationPromise<DeleteSmartMemoCategoryData, DeleteSmartMemoCategoryVariables>;

interface CreateVehicleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateVehicleVariables): MutationRef<CreateVehicleData, CreateVehicleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateVehicleVariables): MutationRef<CreateVehicleData, CreateVehicleVariables>;
  operationName: string;
}
export const createVehicleRef: CreateVehicleRef;

export function createVehicle(vars: CreateVehicleVariables): MutationPromise<CreateVehicleData, CreateVehicleVariables>;
export function createVehicle(dc: DataConnect, vars: CreateVehicleVariables): MutationPromise<CreateVehicleData, CreateVehicleVariables>;

interface UpdateVehicleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateVehicleVariables): MutationRef<UpdateVehicleData, UpdateVehicleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateVehicleVariables): MutationRef<UpdateVehicleData, UpdateVehicleVariables>;
  operationName: string;
}
export const updateVehicleRef: UpdateVehicleRef;

export function updateVehicle(vars: UpdateVehicleVariables): MutationPromise<UpdateVehicleData, UpdateVehicleVariables>;
export function updateVehicle(dc: DataConnect, vars: UpdateVehicleVariables): MutationPromise<UpdateVehicleData, UpdateVehicleVariables>;

interface DeleteVehicleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteVehicleVariables): MutationRef<DeleteVehicleData, DeleteVehicleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteVehicleVariables): MutationRef<DeleteVehicleData, DeleteVehicleVariables>;
  operationName: string;
}
export const deleteVehicleRef: DeleteVehicleRef;

export function deleteVehicle(vars: DeleteVehicleVariables): MutationPromise<DeleteVehicleData, DeleteVehicleVariables>;
export function deleteVehicle(dc: DataConnect, vars: DeleteVehicleVariables): MutationPromise<DeleteVehicleData, DeleteVehicleVariables>;

interface CreateVehicleAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateVehicleAssignmentVariables): MutationRef<CreateVehicleAssignmentData, CreateVehicleAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateVehicleAssignmentVariables): MutationRef<CreateVehicleAssignmentData, CreateVehicleAssignmentVariables>;
  operationName: string;
}
export const createVehicleAssignmentRef: CreateVehicleAssignmentRef;

export function createVehicleAssignment(vars: CreateVehicleAssignmentVariables): MutationPromise<CreateVehicleAssignmentData, CreateVehicleAssignmentVariables>;
export function createVehicleAssignment(dc: DataConnect, vars: CreateVehicleAssignmentVariables): MutationPromise<CreateVehicleAssignmentData, CreateVehicleAssignmentVariables>;

interface UpdateVehicleAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateVehicleAssignmentVariables): MutationRef<UpdateVehicleAssignmentData, UpdateVehicleAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateVehicleAssignmentVariables): MutationRef<UpdateVehicleAssignmentData, UpdateVehicleAssignmentVariables>;
  operationName: string;
}
export const updateVehicleAssignmentRef: UpdateVehicleAssignmentRef;

export function updateVehicleAssignment(vars: UpdateVehicleAssignmentVariables): MutationPromise<UpdateVehicleAssignmentData, UpdateVehicleAssignmentVariables>;
export function updateVehicleAssignment(dc: DataConnect, vars: UpdateVehicleAssignmentVariables): MutationPromise<UpdateVehicleAssignmentData, UpdateVehicleAssignmentVariables>;

interface DeleteVehicleAssignmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteVehicleAssignmentVariables): MutationRef<DeleteVehicleAssignmentData, DeleteVehicleAssignmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteVehicleAssignmentVariables): MutationRef<DeleteVehicleAssignmentData, DeleteVehicleAssignmentVariables>;
  operationName: string;
}
export const deleteVehicleAssignmentRef: DeleteVehicleAssignmentRef;

export function deleteVehicleAssignment(vars: DeleteVehicleAssignmentVariables): MutationPromise<DeleteVehicleAssignmentData, DeleteVehicleAssignmentVariables>;
export function deleteVehicleAssignment(dc: DataConnect, vars: DeleteVehicleAssignmentVariables): MutationPromise<DeleteVehicleAssignmentData, DeleteVehicleAssignmentVariables>;

interface CreateVehicleExpenseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateVehicleExpenseVariables): MutationRef<CreateVehicleExpenseData, CreateVehicleExpenseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateVehicleExpenseVariables): MutationRef<CreateVehicleExpenseData, CreateVehicleExpenseVariables>;
  operationName: string;
}
export const createVehicleExpenseRef: CreateVehicleExpenseRef;

export function createVehicleExpense(vars: CreateVehicleExpenseVariables): MutationPromise<CreateVehicleExpenseData, CreateVehicleExpenseVariables>;
export function createVehicleExpense(dc: DataConnect, vars: CreateVehicleExpenseVariables): MutationPromise<CreateVehicleExpenseData, CreateVehicleExpenseVariables>;

interface UpdateVehicleExpenseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateVehicleExpenseVariables): MutationRef<UpdateVehicleExpenseData, UpdateVehicleExpenseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateVehicleExpenseVariables): MutationRef<UpdateVehicleExpenseData, UpdateVehicleExpenseVariables>;
  operationName: string;
}
export const updateVehicleExpenseRef: UpdateVehicleExpenseRef;

export function updateVehicleExpense(vars: UpdateVehicleExpenseVariables): MutationPromise<UpdateVehicleExpenseData, UpdateVehicleExpenseVariables>;
export function updateVehicleExpense(dc: DataConnect, vars: UpdateVehicleExpenseVariables): MutationPromise<UpdateVehicleExpenseData, UpdateVehicleExpenseVariables>;

interface DeleteVehicleExpenseRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteVehicleExpenseVariables): MutationRef<DeleteVehicleExpenseData, DeleteVehicleExpenseVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteVehicleExpenseVariables): MutationRef<DeleteVehicleExpenseData, DeleteVehicleExpenseVariables>;
  operationName: string;
}
export const deleteVehicleExpenseRef: DeleteVehicleExpenseRef;

export function deleteVehicleExpense(vars: DeleteVehicleExpenseVariables): MutationPromise<DeleteVehicleExpenseData, DeleteVehicleExpenseVariables>;
export function deleteVehicleExpense(dc: DataConnect, vars: DeleteVehicleExpenseVariables): MutationPromise<DeleteVehicleExpenseData, DeleteVehicleExpenseVariables>;

interface CreateVehicleBillingDocumentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateVehicleBillingDocumentVariables): MutationRef<CreateVehicleBillingDocumentData, CreateVehicleBillingDocumentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateVehicleBillingDocumentVariables): MutationRef<CreateVehicleBillingDocumentData, CreateVehicleBillingDocumentVariables>;
  operationName: string;
}
export const createVehicleBillingDocumentRef: CreateVehicleBillingDocumentRef;

export function createVehicleBillingDocument(vars: CreateVehicleBillingDocumentVariables): MutationPromise<CreateVehicleBillingDocumentData, CreateVehicleBillingDocumentVariables>;
export function createVehicleBillingDocument(dc: DataConnect, vars: CreateVehicleBillingDocumentVariables): MutationPromise<CreateVehicleBillingDocumentData, CreateVehicleBillingDocumentVariables>;

interface UpdateVehicleBillingDocumentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateVehicleBillingDocumentVariables): MutationRef<UpdateVehicleBillingDocumentData, UpdateVehicleBillingDocumentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateVehicleBillingDocumentVariables): MutationRef<UpdateVehicleBillingDocumentData, UpdateVehicleBillingDocumentVariables>;
  operationName: string;
}
export const updateVehicleBillingDocumentRef: UpdateVehicleBillingDocumentRef;

export function updateVehicleBillingDocument(vars: UpdateVehicleBillingDocumentVariables): MutationPromise<UpdateVehicleBillingDocumentData, UpdateVehicleBillingDocumentVariables>;
export function updateVehicleBillingDocument(dc: DataConnect, vars: UpdateVehicleBillingDocumentVariables): MutationPromise<UpdateVehicleBillingDocumentData, UpdateVehicleBillingDocumentVariables>;

interface DeleteVehicleBillingDocumentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteVehicleBillingDocumentVariables): MutationRef<DeleteVehicleBillingDocumentData, DeleteVehicleBillingDocumentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteVehicleBillingDocumentVariables): MutationRef<DeleteVehicleBillingDocumentData, DeleteVehicleBillingDocumentVariables>;
  operationName: string;
}
export const deleteVehicleBillingDocumentRef: DeleteVehicleBillingDocumentRef;

export function deleteVehicleBillingDocument(vars: DeleteVehicleBillingDocumentVariables): MutationPromise<DeleteVehicleBillingDocumentData, DeleteVehicleBillingDocumentVariables>;
export function deleteVehicleBillingDocument(dc: DataConnect, vars: DeleteVehicleBillingDocumentVariables): MutationPromise<DeleteVehicleBillingDocumentData, DeleteVehicleBillingDocumentVariables>;

interface UpdateAgentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAgentVariables): MutationRef<UpdateAgentData, UpdateAgentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAgentVariables): MutationRef<UpdateAgentData, UpdateAgentVariables>;
  operationName: string;
}
export const updateAgentRef: UpdateAgentRef;

export function updateAgent(vars: UpdateAgentVariables): MutationPromise<UpdateAgentData, UpdateAgentVariables>;
export function updateAgent(dc: DataConnect, vars: UpdateAgentVariables): MutationPromise<UpdateAgentData, UpdateAgentVariables>;

interface UpdateAgentConversationRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAgentConversationVariables): MutationRef<UpdateAgentConversationData, UpdateAgentConversationVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAgentConversationVariables): MutationRef<UpdateAgentConversationData, UpdateAgentConversationVariables>;
  operationName: string;
}
export const updateAgentConversationRef: UpdateAgentConversationRef;

export function updateAgentConversation(vars: UpdateAgentConversationVariables): MutationPromise<UpdateAgentConversationData, UpdateAgentConversationVariables>;
export function updateAgentConversation(dc: DataConnect, vars: UpdateAgentConversationVariables): MutationPromise<UpdateAgentConversationData, UpdateAgentConversationVariables>;

interface CreateDailyDispatchRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDailyDispatchVariables): MutationRef<CreateDailyDispatchData, CreateDailyDispatchVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateDailyDispatchVariables): MutationRef<CreateDailyDispatchData, CreateDailyDispatchVariables>;
  operationName: string;
}
export const createDailyDispatchRef: CreateDailyDispatchRef;

export function createDailyDispatch(vars: CreateDailyDispatchVariables): MutationPromise<CreateDailyDispatchData, CreateDailyDispatchVariables>;
export function createDailyDispatch(dc: DataConnect, vars: CreateDailyDispatchVariables): MutationPromise<CreateDailyDispatchData, CreateDailyDispatchVariables>;

interface UpdateDailyDispatchRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateDailyDispatchVariables): MutationRef<UpdateDailyDispatchData, UpdateDailyDispatchVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateDailyDispatchVariables): MutationRef<UpdateDailyDispatchData, UpdateDailyDispatchVariables>;
  operationName: string;
}
export const updateDailyDispatchRef: UpdateDailyDispatchRef;

export function updateDailyDispatch(vars: UpdateDailyDispatchVariables): MutationPromise<UpdateDailyDispatchData, UpdateDailyDispatchVariables>;
export function updateDailyDispatch(dc: DataConnect, vars: UpdateDailyDispatchVariables): MutationPromise<UpdateDailyDispatchData, UpdateDailyDispatchVariables>;

interface DeleteDailyDispatchRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteDailyDispatchVariables): MutationRef<DeleteDailyDispatchData, DeleteDailyDispatchVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteDailyDispatchVariables): MutationRef<DeleteDailyDispatchData, DeleteDailyDispatchVariables>;
  operationName: string;
}
export const deleteDailyDispatchRef: DeleteDailyDispatchRef;

export function deleteDailyDispatch(vars: DeleteDailyDispatchVariables): MutationPromise<DeleteDailyDispatchData, DeleteDailyDispatchVariables>;
export function deleteDailyDispatch(dc: DataConnect, vars: DeleteDailyDispatchVariables): MutationPromise<DeleteDailyDispatchData, DeleteDailyDispatchVariables>;

interface CreatePaymentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePaymentVariables): MutationRef<CreatePaymentData, CreatePaymentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreatePaymentVariables): MutationRef<CreatePaymentData, CreatePaymentVariables>;
  operationName: string;
}
export const createPaymentRef: CreatePaymentRef;

export function createPayment(vars: CreatePaymentVariables): MutationPromise<CreatePaymentData, CreatePaymentVariables>;
export function createPayment(dc: DataConnect, vars: CreatePaymentVariables): MutationPromise<CreatePaymentData, CreatePaymentVariables>;

interface UpdatePaymentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdatePaymentVariables): MutationRef<UpdatePaymentData, UpdatePaymentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdatePaymentVariables): MutationRef<UpdatePaymentData, UpdatePaymentVariables>;
  operationName: string;
}
export const updatePaymentRef: UpdatePaymentRef;

export function updatePayment(vars: UpdatePaymentVariables): MutationPromise<UpdatePaymentData, UpdatePaymentVariables>;
export function updatePayment(dc: DataConnect, vars: UpdatePaymentVariables): MutationPromise<UpdatePaymentData, UpdatePaymentVariables>;

interface DeletePaymentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeletePaymentVariables): MutationRef<DeletePaymentData, DeletePaymentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeletePaymentVariables): MutationRef<DeletePaymentData, DeletePaymentVariables>;
  operationName: string;
}
export const deletePaymentRef: DeletePaymentRef;

export function deletePayment(vars: DeletePaymentVariables): MutationPromise<DeletePaymentData, DeletePaymentVariables>;
export function deletePayment(dc: DataConnect, vars: DeletePaymentVariables): MutationPromise<DeletePaymentData, DeletePaymentVariables>;

interface CreateTaxInvoiceRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateTaxInvoiceVariables): MutationRef<CreateTaxInvoiceData, CreateTaxInvoiceVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateTaxInvoiceVariables): MutationRef<CreateTaxInvoiceData, CreateTaxInvoiceVariables>;
  operationName: string;
}
export const createTaxInvoiceRef: CreateTaxInvoiceRef;

export function createTaxInvoice(vars: CreateTaxInvoiceVariables): MutationPromise<CreateTaxInvoiceData, CreateTaxInvoiceVariables>;
export function createTaxInvoice(dc: DataConnect, vars: CreateTaxInvoiceVariables): MutationPromise<CreateTaxInvoiceData, CreateTaxInvoiceVariables>;

interface UpdateTaxInvoiceRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTaxInvoiceVariables): MutationRef<UpdateTaxInvoiceData, UpdateTaxInvoiceVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateTaxInvoiceVariables): MutationRef<UpdateTaxInvoiceData, UpdateTaxInvoiceVariables>;
  operationName: string;
}
export const updateTaxInvoiceRef: UpdateTaxInvoiceRef;

export function updateTaxInvoice(vars: UpdateTaxInvoiceVariables): MutationPromise<UpdateTaxInvoiceData, UpdateTaxInvoiceVariables>;
export function updateTaxInvoice(dc: DataConnect, vars: UpdateTaxInvoiceVariables): MutationPromise<UpdateTaxInvoiceData, UpdateTaxInvoiceVariables>;

interface DeleteTaxInvoiceRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteTaxInvoiceVariables): MutationRef<DeleteTaxInvoiceData, DeleteTaxInvoiceVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteTaxInvoiceVariables): MutationRef<DeleteTaxInvoiceData, DeleteTaxInvoiceVariables>;
  operationName: string;
}
export const deleteTaxInvoiceRef: DeleteTaxInvoiceRef;

export function deleteTaxInvoice(vars: DeleteTaxInvoiceVariables): MutationPromise<DeleteTaxInvoiceData, DeleteTaxInvoiceVariables>;
export function deleteTaxInvoice(dc: DataConnect, vars: DeleteTaxInvoiceVariables): MutationPromise<DeleteTaxInvoiceData, DeleteTaxInvoiceVariables>;

interface CreateReceivableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateReceivableVariables): MutationRef<CreateReceivableData, CreateReceivableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateReceivableVariables): MutationRef<CreateReceivableData, CreateReceivableVariables>;
  operationName: string;
}
export const createReceivableRef: CreateReceivableRef;

export function createReceivable(vars: CreateReceivableVariables): MutationPromise<CreateReceivableData, CreateReceivableVariables>;
export function createReceivable(dc: DataConnect, vars: CreateReceivableVariables): MutationPromise<CreateReceivableData, CreateReceivableVariables>;

interface UpdateReceivableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateReceivableVariables): MutationRef<UpdateReceivableData, UpdateReceivableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateReceivableVariables): MutationRef<UpdateReceivableData, UpdateReceivableVariables>;
  operationName: string;
}
export const updateReceivableRef: UpdateReceivableRef;

export function updateReceivable(vars: UpdateReceivableVariables): MutationPromise<UpdateReceivableData, UpdateReceivableVariables>;
export function updateReceivable(dc: DataConnect, vars: UpdateReceivableVariables): MutationPromise<UpdateReceivableData, UpdateReceivableVariables>;

interface DeleteReceivableRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteReceivableVariables): MutationRef<DeleteReceivableData, DeleteReceivableVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteReceivableVariables): MutationRef<DeleteReceivableData, DeleteReceivableVariables>;
  operationName: string;
}
export const deleteReceivableRef: DeleteReceivableRef;

export function deleteReceivable(vars: DeleteReceivableVariables): MutationPromise<DeleteReceivableData, DeleteReceivableVariables>;
export function deleteReceivable(dc: DataConnect, vars: DeleteReceivableVariables): MutationPromise<DeleteReceivableData, DeleteReceivableVariables>;

interface ListCompaniesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListCompaniesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListCompaniesData, undefined>;
  operationName: string;
}
export const listCompaniesRef: ListCompaniesRef;

export function listCompanies(): QueryPromise<ListCompaniesData, undefined>;
export function listCompanies(dc: DataConnect): QueryPromise<ListCompaniesData, undefined>;

interface GetCompanyRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetCompanyVariables): QueryRef<GetCompanyData, GetCompanyVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetCompanyVariables): QueryRef<GetCompanyData, GetCompanyVariables>;
  operationName: string;
}
export const getCompanyRef: GetCompanyRef;

export function getCompany(vars: GetCompanyVariables): QueryPromise<GetCompanyData, GetCompanyVariables>;
export function getCompany(dc: DataConnect, vars: GetCompanyVariables): QueryPromise<GetCompanyData, GetCompanyVariables>;

interface ListTeamsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListTeamsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListTeamsData, undefined>;
  operationName: string;
}
export const listTeamsRef: ListTeamsRef;

export function listTeams(): QueryPromise<ListTeamsData, undefined>;
export function listTeams(dc: DataConnect): QueryPromise<ListTeamsData, undefined>;

interface GetTeamRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetTeamVariables): QueryRef<GetTeamData, GetTeamVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetTeamVariables): QueryRef<GetTeamData, GetTeamVariables>;
  operationName: string;
}
export const getTeamRef: GetTeamRef;

export function getTeam(vars: GetTeamVariables): QueryPromise<GetTeamData, GetTeamVariables>;
export function getTeam(dc: DataConnect, vars: GetTeamVariables): QueryPromise<GetTeamData, GetTeamVariables>;

interface ListWorkersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListWorkersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListWorkersData, undefined>;
  operationName: string;
}
export const listWorkersRef: ListWorkersRef;

export function listWorkers(): QueryPromise<ListWorkersData, undefined>;
export function listWorkers(dc: DataConnect): QueryPromise<ListWorkersData, undefined>;

interface ListPositionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListPositionsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListPositionsData, undefined>;
  operationName: string;
}
export const listPositionsRef: ListPositionsRef;

export function listPositions(): QueryPromise<ListPositionsData, undefined>;
export function listPositions(dc: DataConnect): QueryPromise<ListPositionsData, undefined>;

interface GetWorkerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetWorkerVariables): QueryRef<GetWorkerData, GetWorkerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetWorkerVariables): QueryRef<GetWorkerData, GetWorkerVariables>;
  operationName: string;
}
export const getWorkerRef: GetWorkerRef;

export function getWorker(vars: GetWorkerVariables): QueryPromise<GetWorkerData, GetWorkerVariables>;
export function getWorker(dc: DataConnect, vars: GetWorkerVariables): QueryPromise<GetWorkerData, GetWorkerVariables>;

interface ListSitesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSitesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListSitesData, undefined>;
  operationName: string;
}
export const listSitesRef: ListSitesRef;

export function listSites(): QueryPromise<ListSitesData, undefined>;
export function listSites(dc: DataConnect): QueryPromise<ListSitesData, undefined>;

interface GetSiteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSiteVariables): QueryRef<GetSiteData, GetSiteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSiteVariables): QueryRef<GetSiteData, GetSiteVariables>;
  operationName: string;
}
export const getSiteRef: GetSiteRef;

export function getSite(vars: GetSiteVariables): QueryPromise<GetSiteData, GetSiteVariables>;
export function getSite(dc: DataConnect, vars: GetSiteVariables): QueryPromise<GetSiteData, GetSiteVariables>;

interface ListDailyReportsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListDailyReportsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListDailyReportsData, undefined>;
  operationName: string;
}
export const listDailyReportsRef: ListDailyReportsRef;

export function listDailyReports(): QueryPromise<ListDailyReportsData, undefined>;
export function listDailyReports(dc: DataConnect): QueryPromise<ListDailyReportsData, undefined>;

interface ListDailyReportWorkersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListDailyReportWorkersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListDailyReportWorkersData, undefined>;
  operationName: string;
}
export const listDailyReportWorkersRef: ListDailyReportWorkersRef;

export function listDailyReportWorkers(): QueryPromise<ListDailyReportWorkersData, undefined>;
export function listDailyReportWorkers(dc: DataConnect): QueryPromise<ListDailyReportWorkersData, undefined>;

interface ListAppUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAppUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListAppUsersData, undefined>;
  operationName: string;
}
export const listAppUsersRef: ListAppUsersRef;

export function listAppUsers(): QueryPromise<ListAppUsersData, undefined>;
export function listAppUsers(dc: DataConnect): QueryPromise<ListAppUsersData, undefined>;

interface ListMenuConfigsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMenuConfigsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMenuConfigsData, undefined>;
  operationName: string;
}
export const listMenuConfigsRef: ListMenuConfigsRef;

export function listMenuConfigs(): QueryPromise<ListMenuConfigsData, undefined>;
export function listMenuConfigs(dc: DataConnect): QueryPromise<ListMenuConfigsData, undefined>;

interface ListSystemLogsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSystemLogsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListSystemLogsData, undefined>;
  operationName: string;
}
export const listSystemLogsRef: ListSystemLogsRef;

export function listSystemLogs(): QueryPromise<ListSystemLogsData, undefined>;
export function listSystemLogs(dc: DataConnect): QueryPromise<ListSystemLogsData, undefined>;

interface ListAuditLogsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAuditLogsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListAuditLogsData, undefined>;
  operationName: string;
}
export const listAuditLogsRef: ListAuditLogsRef;

export function listAuditLogs(): QueryPromise<ListAuditLogsData, undefined>;
export function listAuditLogs(dc: DataConnect): QueryPromise<ListAuditLogsData, undefined>;

interface ListAgentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAgentsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListAgentsData, undefined>;
  operationName: string;
}
export const listAgentsRef: ListAgentsRef;

export function listAgents(): QueryPromise<ListAgentsData, undefined>;
export function listAgents(dc: DataConnect): QueryPromise<ListAgentsData, undefined>;

interface ListAgentConversationsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAgentConversationsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListAgentConversationsData, undefined>;
  operationName: string;
}
export const listAgentConversationsRef: ListAgentConversationsRef;

export function listAgentConversations(): QueryPromise<ListAgentConversationsData, undefined>;
export function listAgentConversations(dc: DataConnect): QueryPromise<ListAgentConversationsData, undefined>;

interface ListSettingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSettingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListSettingsData, undefined>;
  operationName: string;
}
export const listSettingsRef: ListSettingsRef;

export function listSettings(): QueryPromise<ListSettingsData, undefined>;
export function listSettings(dc: DataConnect): QueryPromise<ListSettingsData, undefined>;

interface ListSystemConfigsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSystemConfigsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListSystemConfigsData, undefined>;
  operationName: string;
}
export const listSystemConfigsRef: ListSystemConfigsRef;

export function listSystemConfigs(): QueryPromise<ListSystemConfigsData, undefined>;
export function listSystemConfigs(dc: DataConnect): QueryPromise<ListSystemConfigsData, undefined>;

interface ListAllCompaniesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllCompaniesVariables): QueryRef<ListAllCompaniesData, ListAllCompaniesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllCompaniesVariables): QueryRef<ListAllCompaniesData, ListAllCompaniesVariables>;
  operationName: string;
}
export const listAllCompaniesRef: ListAllCompaniesRef;

export function listAllCompanies(vars?: ListAllCompaniesVariables): QueryPromise<ListAllCompaniesData, ListAllCompaniesVariables>;
export function listAllCompanies(dc: DataConnect, vars?: ListAllCompaniesVariables): QueryPromise<ListAllCompaniesData, ListAllCompaniesVariables>;

interface ListAllTeamsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllTeamsVariables): QueryRef<ListAllTeamsData, ListAllTeamsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllTeamsVariables): QueryRef<ListAllTeamsData, ListAllTeamsVariables>;
  operationName: string;
}
export const listAllTeamsRef: ListAllTeamsRef;

export function listAllTeams(vars?: ListAllTeamsVariables): QueryPromise<ListAllTeamsData, ListAllTeamsVariables>;
export function listAllTeams(dc: DataConnect, vars?: ListAllTeamsVariables): QueryPromise<ListAllTeamsData, ListAllTeamsVariables>;

interface ListAllWorkersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllWorkersVariables): QueryRef<ListAllWorkersData, ListAllWorkersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllWorkersVariables): QueryRef<ListAllWorkersData, ListAllWorkersVariables>;
  operationName: string;
}
export const listAllWorkersRef: ListAllWorkersRef;

export function listAllWorkers(vars?: ListAllWorkersVariables): QueryPromise<ListAllWorkersData, ListAllWorkersVariables>;
export function listAllWorkers(dc: DataConnect, vars?: ListAllWorkersVariables): QueryPromise<ListAllWorkersData, ListAllWorkersVariables>;

interface ListAllPositionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllPositionsVariables): QueryRef<ListAllPositionsData, ListAllPositionsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllPositionsVariables): QueryRef<ListAllPositionsData, ListAllPositionsVariables>;
  operationName: string;
}
export const listAllPositionsRef: ListAllPositionsRef;

export function listAllPositions(vars?: ListAllPositionsVariables): QueryPromise<ListAllPositionsData, ListAllPositionsVariables>;
export function listAllPositions(dc: DataConnect, vars?: ListAllPositionsVariables): QueryPromise<ListAllPositionsData, ListAllPositionsVariables>;

interface ListAllSitesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSitesVariables): QueryRef<ListAllSitesData, ListAllSitesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllSitesVariables): QueryRef<ListAllSitesData, ListAllSitesVariables>;
  operationName: string;
}
export const listAllSitesRef: ListAllSitesRef;

export function listAllSites(vars?: ListAllSitesVariables): QueryPromise<ListAllSitesData, ListAllSitesVariables>;
export function listAllSites(dc: DataConnect, vars?: ListAllSitesVariables): QueryPromise<ListAllSitesData, ListAllSitesVariables>;

interface ListAllDailyReportsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllDailyReportsVariables): QueryRef<ListAllDailyReportsData, ListAllDailyReportsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllDailyReportsVariables): QueryRef<ListAllDailyReportsData, ListAllDailyReportsVariables>;
  operationName: string;
}
export const listAllDailyReportsRef: ListAllDailyReportsRef;

export function listAllDailyReports(vars?: ListAllDailyReportsVariables): QueryPromise<ListAllDailyReportsData, ListAllDailyReportsVariables>;
export function listAllDailyReports(dc: DataConnect, vars?: ListAllDailyReportsVariables): QueryPromise<ListAllDailyReportsData, ListAllDailyReportsVariables>;

interface ListAllDailyReportWorkersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllDailyReportWorkersVariables): QueryRef<ListAllDailyReportWorkersData, ListAllDailyReportWorkersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllDailyReportWorkersVariables): QueryRef<ListAllDailyReportWorkersData, ListAllDailyReportWorkersVariables>;
  operationName: string;
}
export const listAllDailyReportWorkersRef: ListAllDailyReportWorkersRef;

export function listAllDailyReportWorkers(vars?: ListAllDailyReportWorkersVariables): QueryPromise<ListAllDailyReportWorkersData, ListAllDailyReportWorkersVariables>;
export function listAllDailyReportWorkers(dc: DataConnect, vars?: ListAllDailyReportWorkersVariables): QueryPromise<ListAllDailyReportWorkersData, ListAllDailyReportWorkersVariables>;

interface ListAllAppUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAppUsersVariables): QueryRef<ListAllAppUsersData, ListAllAppUsersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllAppUsersVariables): QueryRef<ListAllAppUsersData, ListAllAppUsersVariables>;
  operationName: string;
}
export const listAllAppUsersRef: ListAllAppUsersRef;

export function listAllAppUsers(vars?: ListAllAppUsersVariables): QueryPromise<ListAllAppUsersData, ListAllAppUsersVariables>;
export function listAllAppUsers(dc: DataConnect, vars?: ListAllAppUsersVariables): QueryPromise<ListAllAppUsersData, ListAllAppUsersVariables>;

interface ListAllMenuConfigsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllMenuConfigsVariables): QueryRef<ListAllMenuConfigsData, ListAllMenuConfigsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllMenuConfigsVariables): QueryRef<ListAllMenuConfigsData, ListAllMenuConfigsVariables>;
  operationName: string;
}
export const listAllMenuConfigsRef: ListAllMenuConfigsRef;

export function listAllMenuConfigs(vars?: ListAllMenuConfigsVariables): QueryPromise<ListAllMenuConfigsData, ListAllMenuConfigsVariables>;
export function listAllMenuConfigs(dc: DataConnect, vars?: ListAllMenuConfigsVariables): QueryPromise<ListAllMenuConfigsData, ListAllMenuConfigsVariables>;

interface ListAllSystemLogsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSystemLogsVariables): QueryRef<ListAllSystemLogsData, ListAllSystemLogsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllSystemLogsVariables): QueryRef<ListAllSystemLogsData, ListAllSystemLogsVariables>;
  operationName: string;
}
export const listAllSystemLogsRef: ListAllSystemLogsRef;

export function listAllSystemLogs(vars?: ListAllSystemLogsVariables): QueryPromise<ListAllSystemLogsData, ListAllSystemLogsVariables>;
export function listAllSystemLogs(dc: DataConnect, vars?: ListAllSystemLogsVariables): QueryPromise<ListAllSystemLogsData, ListAllSystemLogsVariables>;

interface ListAllAuditLogsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAuditLogsVariables): QueryRef<ListAllAuditLogsData, ListAllAuditLogsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllAuditLogsVariables): QueryRef<ListAllAuditLogsData, ListAllAuditLogsVariables>;
  operationName: string;
}
export const listAllAuditLogsRef: ListAllAuditLogsRef;

export function listAllAuditLogs(vars?: ListAllAuditLogsVariables): QueryPromise<ListAllAuditLogsData, ListAllAuditLogsVariables>;
export function listAllAuditLogs(dc: DataConnect, vars?: ListAllAuditLogsVariables): QueryPromise<ListAllAuditLogsData, ListAllAuditLogsVariables>;

interface ListAllAgentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAgentsVariables): QueryRef<ListAllAgentsData, ListAllAgentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllAgentsVariables): QueryRef<ListAllAgentsData, ListAllAgentsVariables>;
  operationName: string;
}
export const listAllAgentsRef: ListAllAgentsRef;

export function listAllAgents(vars?: ListAllAgentsVariables): QueryPromise<ListAllAgentsData, ListAllAgentsVariables>;
export function listAllAgents(dc: DataConnect, vars?: ListAllAgentsVariables): QueryPromise<ListAllAgentsData, ListAllAgentsVariables>;

interface ListAllAgentConversationsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAgentConversationsVariables): QueryRef<ListAllAgentConversationsData, ListAllAgentConversationsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllAgentConversationsVariables): QueryRef<ListAllAgentConversationsData, ListAllAgentConversationsVariables>;
  operationName: string;
}
export const listAllAgentConversationsRef: ListAllAgentConversationsRef;

export function listAllAgentConversations(vars?: ListAllAgentConversationsVariables): QueryPromise<ListAllAgentConversationsData, ListAllAgentConversationsVariables>;
export function listAllAgentConversations(dc: DataConnect, vars?: ListAllAgentConversationsVariables): QueryPromise<ListAllAgentConversationsData, ListAllAgentConversationsVariables>;

interface ListAllSettingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSettingsVariables): QueryRef<ListAllSettingsData, ListAllSettingsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllSettingsVariables): QueryRef<ListAllSettingsData, ListAllSettingsVariables>;
  operationName: string;
}
export const listAllSettingsRef: ListAllSettingsRef;

export function listAllSettings(vars?: ListAllSettingsVariables): QueryPromise<ListAllSettingsData, ListAllSettingsVariables>;
export function listAllSettings(dc: DataConnect, vars?: ListAllSettingsVariables): QueryPromise<ListAllSettingsData, ListAllSettingsVariables>;

interface ListAllSystemConfigsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSystemConfigsVariables): QueryRef<ListAllSystemConfigsData, ListAllSystemConfigsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllSystemConfigsVariables): QueryRef<ListAllSystemConfigsData, ListAllSystemConfigsVariables>;
  operationName: string;
}
export const listAllSystemConfigsRef: ListAllSystemConfigsRef;

export function listAllSystemConfigs(vars?: ListAllSystemConfigsVariables): QueryPromise<ListAllSystemConfigsData, ListAllSystemConfigsVariables>;
export function listAllSystemConfigs(dc: DataConnect, vars?: ListAllSystemConfigsVariables): QueryPromise<ListAllSystemConfigsData, ListAllSystemConfigsVariables>;

interface ListAllAccommodationsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAccommodationsVariables): QueryRef<ListAllAccommodationsData, ListAllAccommodationsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllAccommodationsVariables): QueryRef<ListAllAccommodationsData, ListAllAccommodationsVariables>;
  operationName: string;
}
export const listAllAccommodationsRef: ListAllAccommodationsRef;

export function listAllAccommodations(vars?: ListAllAccommodationsVariables): QueryPromise<ListAllAccommodationsData, ListAllAccommodationsVariables>;
export function listAllAccommodations(dc: DataConnect, vars?: ListAllAccommodationsVariables): QueryPromise<ListAllAccommodationsData, ListAllAccommodationsVariables>;

interface ListAllAccommodationAssignmentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAccommodationAssignmentsVariables): QueryRef<ListAllAccommodationAssignmentsData, ListAllAccommodationAssignmentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllAccommodationAssignmentsVariables): QueryRef<ListAllAccommodationAssignmentsData, ListAllAccommodationAssignmentsVariables>;
  operationName: string;
}
export const listAllAccommodationAssignmentsRef: ListAllAccommodationAssignmentsRef;

export function listAllAccommodationAssignments(vars?: ListAllAccommodationAssignmentsVariables): QueryPromise<ListAllAccommodationAssignmentsData, ListAllAccommodationAssignmentsVariables>;
export function listAllAccommodationAssignments(dc: DataConnect, vars?: ListAllAccommodationAssignmentsVariables): QueryPromise<ListAllAccommodationAssignmentsData, ListAllAccommodationAssignmentsVariables>;

interface ListAllUtilityRecordsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllUtilityRecordsVariables): QueryRef<ListAllUtilityRecordsData, ListAllUtilityRecordsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllUtilityRecordsVariables): QueryRef<ListAllUtilityRecordsData, ListAllUtilityRecordsVariables>;
  operationName: string;
}
export const listAllUtilityRecordsRef: ListAllUtilityRecordsRef;

export function listAllUtilityRecords(vars?: ListAllUtilityRecordsVariables): QueryPromise<ListAllUtilityRecordsData, ListAllUtilityRecordsVariables>;
export function listAllUtilityRecords(dc: DataConnect, vars?: ListAllUtilityRecordsVariables): QueryPromise<ListAllUtilityRecordsData, ListAllUtilityRecordsVariables>;

interface ListAllAccommodationBillingDocumentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAccommodationBillingDocumentsVariables): QueryRef<ListAllAccommodationBillingDocumentsData, ListAllAccommodationBillingDocumentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllAccommodationBillingDocumentsVariables): QueryRef<ListAllAccommodationBillingDocumentsData, ListAllAccommodationBillingDocumentsVariables>;
  operationName: string;
}
export const listAllAccommodationBillingDocumentsRef: ListAllAccommodationBillingDocumentsRef;

export function listAllAccommodationBillingDocuments(vars?: ListAllAccommodationBillingDocumentsVariables): QueryPromise<ListAllAccommodationBillingDocumentsData, ListAllAccommodationBillingDocumentsVariables>;
export function listAllAccommodationBillingDocuments(dc: DataConnect, vars?: ListAllAccommodationBillingDocumentsVariables): QueryPromise<ListAllAccommodationBillingDocumentsData, ListAllAccommodationBillingDocumentsVariables>;

interface ListAllAccommodationBillingLineItemsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAccommodationBillingLineItemsVariables): QueryRef<ListAllAccommodationBillingLineItemsData, ListAllAccommodationBillingLineItemsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllAccommodationBillingLineItemsVariables): QueryRef<ListAllAccommodationBillingLineItemsData, ListAllAccommodationBillingLineItemsVariables>;
  operationName: string;
}
export const listAllAccommodationBillingLineItemsRef: ListAllAccommodationBillingLineItemsRef;

export function listAllAccommodationBillingLineItems(vars?: ListAllAccommodationBillingLineItemsVariables): QueryPromise<ListAllAccommodationBillingLineItemsData, ListAllAccommodationBillingLineItemsVariables>;
export function listAllAccommodationBillingLineItems(dc: DataConnect, vars?: ListAllAccommodationBillingLineItemsVariables): QueryPromise<ListAllAccommodationBillingLineItemsData, ListAllAccommodationBillingLineItemsVariables>;

interface ListAllAdvancePaymentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllAdvancePaymentsVariables): QueryRef<ListAllAdvancePaymentsData, ListAllAdvancePaymentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllAdvancePaymentsVariables): QueryRef<ListAllAdvancePaymentsData, ListAllAdvancePaymentsVariables>;
  operationName: string;
}
export const listAllAdvancePaymentsRef: ListAllAdvancePaymentsRef;

export function listAllAdvancePayments(vars?: ListAllAdvancePaymentsVariables): QueryPromise<ListAllAdvancePaymentsData, ListAllAdvancePaymentsVariables>;
export function listAllAdvancePayments(dc: DataConnect, vars?: ListAllAdvancePaymentsVariables): QueryPromise<ListAllAdvancePaymentsData, ListAllAdvancePaymentsVariables>;

interface ListAllSmartMemoCategoriesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSmartMemoCategoriesVariables): QueryRef<ListAllSmartMemoCategoriesData, ListAllSmartMemoCategoriesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllSmartMemoCategoriesVariables): QueryRef<ListAllSmartMemoCategoriesData, ListAllSmartMemoCategoriesVariables>;
  operationName: string;
}
export const listAllSmartMemoCategoriesRef: ListAllSmartMemoCategoriesRef;

export function listAllSmartMemoCategories(vars?: ListAllSmartMemoCategoriesVariables): QueryPromise<ListAllSmartMemoCategoriesData, ListAllSmartMemoCategoriesVariables>;
export function listAllSmartMemoCategories(dc: DataConnect, vars?: ListAllSmartMemoCategoriesVariables): QueryPromise<ListAllSmartMemoCategoriesData, ListAllSmartMemoCategoriesVariables>;

interface ListAllSmartMemosRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllSmartMemosVariables): QueryRef<ListAllSmartMemosData, ListAllSmartMemosVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllSmartMemosVariables): QueryRef<ListAllSmartMemosData, ListAllSmartMemosVariables>;
  operationName: string;
}
export const listAllSmartMemosRef: ListAllSmartMemosRef;

export function listAllSmartMemos(vars?: ListAllSmartMemosVariables): QueryPromise<ListAllSmartMemosData, ListAllSmartMemosVariables>;
export function listAllSmartMemos(dc: DataConnect, vars?: ListAllSmartMemosVariables): QueryPromise<ListAllSmartMemosData, ListAllSmartMemosVariables>;

interface ListAllVehiclesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllVehiclesVariables): QueryRef<ListAllVehiclesData, ListAllVehiclesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllVehiclesVariables): QueryRef<ListAllVehiclesData, ListAllVehiclesVariables>;
  operationName: string;
}
export const listAllVehiclesRef: ListAllVehiclesRef;

export function listAllVehicles(vars?: ListAllVehiclesVariables): QueryPromise<ListAllVehiclesData, ListAllVehiclesVariables>;
export function listAllVehicles(dc: DataConnect, vars?: ListAllVehiclesVariables): QueryPromise<ListAllVehiclesData, ListAllVehiclesVariables>;

interface ListAllVehicleAssignmentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllVehicleAssignmentsVariables): QueryRef<ListAllVehicleAssignmentsData, ListAllVehicleAssignmentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllVehicleAssignmentsVariables): QueryRef<ListAllVehicleAssignmentsData, ListAllVehicleAssignmentsVariables>;
  operationName: string;
}
export const listAllVehicleAssignmentsRef: ListAllVehicleAssignmentsRef;

export function listAllVehicleAssignments(vars?: ListAllVehicleAssignmentsVariables): QueryPromise<ListAllVehicleAssignmentsData, ListAllVehicleAssignmentsVariables>;
export function listAllVehicleAssignments(dc: DataConnect, vars?: ListAllVehicleAssignmentsVariables): QueryPromise<ListAllVehicleAssignmentsData, ListAllVehicleAssignmentsVariables>;

interface ListAllVehicleExpensesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllVehicleExpensesVariables): QueryRef<ListAllVehicleExpensesData, ListAllVehicleExpensesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllVehicleExpensesVariables): QueryRef<ListAllVehicleExpensesData, ListAllVehicleExpensesVariables>;
  operationName: string;
}
export const listAllVehicleExpensesRef: ListAllVehicleExpensesRef;

export function listAllVehicleExpenses(vars?: ListAllVehicleExpensesVariables): QueryPromise<ListAllVehicleExpensesData, ListAllVehicleExpensesVariables>;
export function listAllVehicleExpenses(dc: DataConnect, vars?: ListAllVehicleExpensesVariables): QueryPromise<ListAllVehicleExpensesData, ListAllVehicleExpensesVariables>;

interface ListAllVehicleBillingDocumentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllVehicleBillingDocumentsVariables): QueryRef<ListAllVehicleBillingDocumentsData, ListAllVehicleBillingDocumentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllVehicleBillingDocumentsVariables): QueryRef<ListAllVehicleBillingDocumentsData, ListAllVehicleBillingDocumentsVariables>;
  operationName: string;
}
export const listAllVehicleBillingDocumentsRef: ListAllVehicleBillingDocumentsRef;

export function listAllVehicleBillingDocuments(vars?: ListAllVehicleBillingDocumentsVariables): QueryPromise<ListAllVehicleBillingDocumentsData, ListAllVehicleBillingDocumentsVariables>;
export function listAllVehicleBillingDocuments(dc: DataConnect, vars?: ListAllVehicleBillingDocumentsVariables): QueryPromise<ListAllVehicleBillingDocumentsData, ListAllVehicleBillingDocumentsVariables>;

interface ListAllDailyDispatchesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllDailyDispatchesVariables): QueryRef<ListAllDailyDispatchesData, ListAllDailyDispatchesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllDailyDispatchesVariables): QueryRef<ListAllDailyDispatchesData, ListAllDailyDispatchesVariables>;
  operationName: string;
}
export const listAllDailyDispatchesRef: ListAllDailyDispatchesRef;

export function listAllDailyDispatches(vars?: ListAllDailyDispatchesVariables): QueryPromise<ListAllDailyDispatchesData, ListAllDailyDispatchesVariables>;
export function listAllDailyDispatches(dc: DataConnect, vars?: ListAllDailyDispatchesVariables): QueryPromise<ListAllDailyDispatchesData, ListAllDailyDispatchesVariables>;

interface ListAllPaymentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllPaymentsVariables): QueryRef<ListAllPaymentsData, ListAllPaymentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllPaymentsVariables): QueryRef<ListAllPaymentsData, ListAllPaymentsVariables>;
  operationName: string;
}
export const listAllPaymentsRef: ListAllPaymentsRef;

export function listAllPayments(vars?: ListAllPaymentsVariables): QueryPromise<ListAllPaymentsData, ListAllPaymentsVariables>;
export function listAllPayments(dc: DataConnect, vars?: ListAllPaymentsVariables): QueryPromise<ListAllPaymentsData, ListAllPaymentsVariables>;

interface ListAllTaxInvoicesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllTaxInvoicesVariables): QueryRef<ListAllTaxInvoicesData, ListAllTaxInvoicesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllTaxInvoicesVariables): QueryRef<ListAllTaxInvoicesData, ListAllTaxInvoicesVariables>;
  operationName: string;
}
export const listAllTaxInvoicesRef: ListAllTaxInvoicesRef;

export function listAllTaxInvoices(vars?: ListAllTaxInvoicesVariables): QueryPromise<ListAllTaxInvoicesData, ListAllTaxInvoicesVariables>;
export function listAllTaxInvoices(dc: DataConnect, vars?: ListAllTaxInvoicesVariables): QueryPromise<ListAllTaxInvoicesData, ListAllTaxInvoicesVariables>;

interface ListAllReceivablesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: ListAllReceivablesVariables): QueryRef<ListAllReceivablesData, ListAllReceivablesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: ListAllReceivablesVariables): QueryRef<ListAllReceivablesData, ListAllReceivablesVariables>;
  operationName: string;
}
export const listAllReceivablesRef: ListAllReceivablesRef;

export function listAllReceivables(vars?: ListAllReceivablesVariables): QueryPromise<ListAllReceivablesData, ListAllReceivablesVariables>;
export function listAllReceivables(dc: DataConnect, vars?: ListAllReceivablesVariables): QueryPromise<ListAllReceivablesData, ListAllReceivablesVariables>;

