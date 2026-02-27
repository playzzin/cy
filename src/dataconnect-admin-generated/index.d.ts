import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export enum Status {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
}

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

/** Generated Node Admin SDK operation action function for the 'CreateCompany' Mutation. Allow users to execute without passing in DataConnect. */
export function createCompany(dc: DataConnect, vars: CreateCompanyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCompanyData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCompany' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCompany(vars: CreateCompanyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCompanyData>>;

/** Generated Node Admin SDK operation action function for the 'CreateTeam' Mutation. Allow users to execute without passing in DataConnect. */
export function createTeam(dc: DataConnect, vars: CreateTeamVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTeamData>>;
/** Generated Node Admin SDK operation action function for the 'CreateTeam' Mutation. Allow users to pass in custom DataConnect instances. */
export function createTeam(vars: CreateTeamVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTeamData>>;

/** Generated Node Admin SDK operation action function for the 'CreateWorker' Mutation. Allow users to execute without passing in DataConnect. */
export function createWorker(dc: DataConnect, vars: CreateWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateWorkerData>>;
/** Generated Node Admin SDK operation action function for the 'CreateWorker' Mutation. Allow users to pass in custom DataConnect instances. */
export function createWorker(vars: CreateWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateWorkerData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSite' Mutation. Allow users to execute without passing in DataConnect. */
export function createSite(dc: DataConnect, vars: CreateSiteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSiteData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSite' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSite(vars: CreateSiteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSiteData>>;

/** Generated Node Admin SDK operation action function for the 'CreateDailyReport' Mutation. Allow users to execute without passing in DataConnect. */
export function createDailyReport(dc: DataConnect, vars: CreateDailyReportVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDailyReportData>>;
/** Generated Node Admin SDK operation action function for the 'CreateDailyReport' Mutation. Allow users to pass in custom DataConnect instances. */
export function createDailyReport(vars: CreateDailyReportVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDailyReportData>>;

/** Generated Node Admin SDK operation action function for the 'CreateDailyReportWorker' Mutation. Allow users to execute without passing in DataConnect. */
export function createDailyReportWorker(dc: DataConnect, vars: CreateDailyReportWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDailyReportWorkerData>>;
/** Generated Node Admin SDK operation action function for the 'CreateDailyReportWorker' Mutation. Allow users to pass in custom DataConnect instances. */
export function createDailyReportWorker(vars: CreateDailyReportWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDailyReportWorkerData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateDailyReportWorker' Mutation. Allow users to execute without passing in DataConnect. */
export function updateDailyReportWorker(dc: DataConnect, vars: UpdateDailyReportWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateDailyReportWorkerData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateDailyReportWorker' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateDailyReportWorker(vars: UpdateDailyReportWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateDailyReportWorkerData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteDailyReportWorker' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteDailyReportWorker(dc: DataConnect, vars: DeleteDailyReportWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteDailyReportWorkerData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteDailyReportWorker' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteDailyReportWorker(vars: DeleteDailyReportWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteDailyReportWorkerData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePosition' Mutation. Allow users to execute without passing in DataConnect. */
export function createPosition(dc: DataConnect, vars: CreatePositionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePositionData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePosition' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPosition(vars: CreatePositionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePositionData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAuditLog' Mutation. Allow users to execute without passing in DataConnect. */
export function createAuditLog(dc: DataConnect, vars: CreateAuditLogVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAuditLogData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAuditLog' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAuditLog(vars: CreateAuditLogVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAuditLogData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAgent' Mutation. Allow users to execute without passing in DataConnect. */
export function createAgent(dc: DataConnect, vars: CreateAgentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAgentData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAgent' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAgent(vars: CreateAgentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAgentData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAgentConversation' Mutation. Allow users to execute without passing in DataConnect. */
export function createAgentConversation(dc: DataConnect, vars: CreateAgentConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAgentConversationData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAgentConversation' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAgentConversation(vars: CreateAgentConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAgentConversationData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSetting' Mutation. Allow users to execute without passing in DataConnect. */
export function createSetting(dc: DataConnect, vars: CreateSettingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSettingData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSetting' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSetting(vars: CreateSettingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSettingData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateSetting' Mutation. Allow users to execute without passing in DataConnect. */
export function updateSetting(dc: DataConnect, vars: UpdateSettingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSettingData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateSetting' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateSetting(vars: UpdateSettingVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSettingData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSystemConfig' Mutation. Allow users to execute without passing in DataConnect. */
export function createSystemConfig(dc: DataConnect, vars: CreateSystemConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSystemConfigData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSystemConfig' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSystemConfig(vars: CreateSystemConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSystemConfigData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateSystemConfig' Mutation. Allow users to execute without passing in DataConnect. */
export function updateSystemConfig(dc: DataConnect, vars: UpdateSystemConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSystemConfigData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateSystemConfig' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateSystemConfig(vars: UpdateSystemConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSystemConfigData>>;

/** Generated Node Admin SDK operation action function for the 'DeletePosition' Mutation. Allow users to execute without passing in DataConnect. */
export function deletePosition(dc: DataConnect, vars: DeletePositionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletePositionData>>;
/** Generated Node Admin SDK operation action function for the 'DeletePosition' Mutation. Allow users to pass in custom DataConnect instances. */
export function deletePosition(vars: DeletePositionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletePositionData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateCompany' Mutation. Allow users to execute without passing in DataConnect. */
export function updateCompany(dc: DataConnect, vars: UpdateCompanyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCompanyData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateCompany' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateCompany(vars: UpdateCompanyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCompanyData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteCompany' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteCompany(dc: DataConnect, vars: DeleteCompanyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCompanyData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteCompany' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteCompany(vars: DeleteCompanyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCompanyData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateTeam' Mutation. Allow users to execute without passing in DataConnect. */
export function updateTeam(dc: DataConnect, vars: UpdateTeamVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateTeamData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateTeam' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateTeam(vars: UpdateTeamVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateTeamData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteTeam' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteTeam(dc: DataConnect, vars: DeleteTeamVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteTeamData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteTeam' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteTeam(vars: DeleteTeamVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteTeamData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateWorker' Mutation. Allow users to execute without passing in DataConnect. */
export function updateWorker(dc: DataConnect, vars: UpdateWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateWorkerData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateWorker' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateWorker(vars: UpdateWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateWorkerData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteWorker' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteWorker(dc: DataConnect, vars: DeleteWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteWorkerData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteWorker' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteWorker(vars: DeleteWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteWorkerData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateSite' Mutation. Allow users to execute without passing in DataConnect. */
export function updateSite(dc: DataConnect, vars: UpdateSiteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSiteData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateSite' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateSite(vars: UpdateSiteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSiteData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteSite' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteSite(dc: DataConnect, vars: DeleteSiteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSiteData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteSite' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteSite(vars: DeleteSiteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSiteData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateDailyReport' Mutation. Allow users to execute without passing in DataConnect. */
export function updateDailyReport(dc: DataConnect, vars: UpdateDailyReportVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateDailyReportData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateDailyReport' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateDailyReport(vars: UpdateDailyReportVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateDailyReportData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteDailyReport' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteDailyReport(dc: DataConnect, vars: DeleteDailyReportVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteDailyReportData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteDailyReport' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteDailyReport(vars: DeleteDailyReportVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteDailyReportData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAppUser' Mutation. Allow users to execute without passing in DataConnect. */
export function createAppUser(dc: DataConnect, vars: CreateAppUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAppUserData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAppUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAppUser(vars: CreateAppUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAppUserData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAppUser' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAppUser(dc: DataConnect, vars: UpdateAppUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAppUserData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAppUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAppUser(vars: UpdateAppUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAppUserData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteAppUser' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteAppUser(dc: DataConnect, vars: DeleteAppUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAppUserData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteAppUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteAppUser(vars: DeleteAppUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAppUserData>>;

/** Generated Node Admin SDK operation action function for the 'CreateMenuConfig' Mutation. Allow users to execute without passing in DataConnect. */
export function createMenuConfig(dc: DataConnect, vars: CreateMenuConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMenuConfigData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMenuConfig' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMenuConfig(vars: CreateMenuConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMenuConfigData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateMenuConfig' Mutation. Allow users to execute without passing in DataConnect. */
export function updateMenuConfig(dc: DataConnect, vars: UpdateMenuConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMenuConfigData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateMenuConfig' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateMenuConfig(vars: UpdateMenuConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateMenuConfigData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteMenuConfig' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteMenuConfig(dc: DataConnect, vars: DeleteMenuConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteMenuConfigData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteMenuConfig' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteMenuConfig(vars: DeleteMenuConfigVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteMenuConfigData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSystemLog' Mutation. Allow users to execute without passing in DataConnect. */
export function createSystemLog(dc: DataConnect, vars: CreateSystemLogVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSystemLogData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSystemLog' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSystemLog(vars: CreateSystemLogVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSystemLogData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAccommodation' Mutation. Allow users to execute without passing in DataConnect. */
export function createAccommodation(dc: DataConnect, vars: CreateAccommodationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccommodationData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAccommodation' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAccommodation(vars: CreateAccommodationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccommodationData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAccommodation' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAccommodation(dc: DataConnect, vars: UpdateAccommodationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAccommodationData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAccommodation' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAccommodation(vars: UpdateAccommodationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAccommodationData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteAccommodation' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteAccommodation(dc: DataConnect, vars: DeleteAccommodationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAccommodationData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteAccommodation' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteAccommodation(vars: DeleteAccommodationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAccommodationData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAccommodationAssignment' Mutation. Allow users to execute without passing in DataConnect. */
export function createAccommodationAssignment(dc: DataConnect, vars: CreateAccommodationAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccommodationAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAccommodationAssignment' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAccommodationAssignment(vars: CreateAccommodationAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccommodationAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAccommodationAssignment' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAccommodationAssignment(dc: DataConnect, vars: UpdateAccommodationAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAccommodationAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAccommodationAssignment' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAccommodationAssignment(vars: UpdateAccommodationAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAccommodationAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteAccommodationAssignment' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteAccommodationAssignment(dc: DataConnect, vars: DeleteAccommodationAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAccommodationAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteAccommodationAssignment' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteAccommodationAssignment(vars: DeleteAccommodationAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAccommodationAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'CreateUtilityRecord' Mutation. Allow users to execute without passing in DataConnect. */
export function createUtilityRecord(dc: DataConnect, vars: CreateUtilityRecordVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUtilityRecordData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUtilityRecord' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUtilityRecord(vars: CreateUtilityRecordVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUtilityRecordData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateUtilityRecord' Mutation. Allow users to execute without passing in DataConnect. */
export function updateUtilityRecord(dc: DataConnect, vars: UpdateUtilityRecordVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUtilityRecordData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateUtilityRecord' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateUtilityRecord(vars: UpdateUtilityRecordVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateUtilityRecordData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteUtilityRecord' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteUtilityRecord(dc: DataConnect, vars: DeleteUtilityRecordVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUtilityRecordData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteUtilityRecord' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteUtilityRecord(vars: DeleteUtilityRecordVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteUtilityRecordData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAccommodationBillingDocument' Mutation. Allow users to execute without passing in DataConnect. */
export function createAccommodationBillingDocument(dc: DataConnect, vars: CreateAccommodationBillingDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccommodationBillingDocumentData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAccommodationBillingDocument' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAccommodationBillingDocument(vars: CreateAccommodationBillingDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccommodationBillingDocumentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAccommodationBillingDocument' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAccommodationBillingDocument(dc: DataConnect, vars: UpdateAccommodationBillingDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAccommodationBillingDocumentData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAccommodationBillingDocument' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAccommodationBillingDocument(vars: UpdateAccommodationBillingDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAccommodationBillingDocumentData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAccommodationBillingLineItem' Mutation. Allow users to execute without passing in DataConnect. */
export function createAccommodationBillingLineItem(dc: DataConnect, vars: CreateAccommodationBillingLineItemVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccommodationBillingLineItemData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAccommodationBillingLineItem' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAccommodationBillingLineItem(vars: CreateAccommodationBillingLineItemVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAccommodationBillingLineItemData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteAccommodationBillingLineItem' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteAccommodationBillingLineItem(dc: DataConnect, vars: DeleteAccommodationBillingLineItemVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAccommodationBillingLineItemData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteAccommodationBillingLineItem' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteAccommodationBillingLineItem(vars: DeleteAccommodationBillingLineItemVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAccommodationBillingLineItemData>>;

/** Generated Node Admin SDK operation action function for the 'CreateAdvancePayment' Mutation. Allow users to execute without passing in DataConnect. */
export function createAdvancePayment(dc: DataConnect, vars: CreateAdvancePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAdvancePaymentData>>;
/** Generated Node Admin SDK operation action function for the 'CreateAdvancePayment' Mutation. Allow users to pass in custom DataConnect instances. */
export function createAdvancePayment(vars: CreateAdvancePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateAdvancePaymentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAdvancePayment' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAdvancePayment(dc: DataConnect, vars: UpdateAdvancePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAdvancePaymentData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAdvancePayment' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAdvancePayment(vars: UpdateAdvancePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAdvancePaymentData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteAdvancePayment' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteAdvancePayment(dc: DataConnect, vars: DeleteAdvancePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAdvancePaymentData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteAdvancePayment' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteAdvancePayment(vars: DeleteAdvancePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteAdvancePaymentData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSmartMemo' Mutation. Allow users to execute without passing in DataConnect. */
export function createSmartMemo(dc: DataConnect, vars: CreateSmartMemoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSmartMemoData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSmartMemo' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSmartMemo(vars: CreateSmartMemoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSmartMemoData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateSmartMemo' Mutation. Allow users to execute without passing in DataConnect. */
export function updateSmartMemo(dc: DataConnect, vars: UpdateSmartMemoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSmartMemoData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateSmartMemo' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateSmartMemo(vars: UpdateSmartMemoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSmartMemoData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteSmartMemo' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteSmartMemo(dc: DataConnect, vars: DeleteSmartMemoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSmartMemoData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteSmartMemo' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteSmartMemo(vars: DeleteSmartMemoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSmartMemoData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSmartMemoCategory' Mutation. Allow users to execute without passing in DataConnect. */
export function createSmartMemoCategory(dc: DataConnect, vars: CreateSmartMemoCategoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSmartMemoCategoryData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSmartMemoCategory' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSmartMemoCategory(vars: CreateSmartMemoCategoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSmartMemoCategoryData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateSmartMemoCategory' Mutation. Allow users to execute without passing in DataConnect. */
export function updateSmartMemoCategory(dc: DataConnect, vars: UpdateSmartMemoCategoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSmartMemoCategoryData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateSmartMemoCategory' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateSmartMemoCategory(vars: UpdateSmartMemoCategoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateSmartMemoCategoryData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteSmartMemoCategory' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteSmartMemoCategory(dc: DataConnect, vars: DeleteSmartMemoCategoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSmartMemoCategoryData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteSmartMemoCategory' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteSmartMemoCategory(vars: DeleteSmartMemoCategoryVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteSmartMemoCategoryData>>;

/** Generated Node Admin SDK operation action function for the 'CreateVehicle' Mutation. Allow users to execute without passing in DataConnect. */
export function createVehicle(dc: DataConnect, vars: CreateVehicleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateVehicleData>>;
/** Generated Node Admin SDK operation action function for the 'CreateVehicle' Mutation. Allow users to pass in custom DataConnect instances. */
export function createVehicle(vars: CreateVehicleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateVehicleData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateVehicle' Mutation. Allow users to execute without passing in DataConnect. */
export function updateVehicle(dc: DataConnect, vars: UpdateVehicleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateVehicleData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateVehicle' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateVehicle(vars: UpdateVehicleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateVehicleData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteVehicle' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteVehicle(dc: DataConnect, vars: DeleteVehicleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteVehicleData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteVehicle' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteVehicle(vars: DeleteVehicleVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteVehicleData>>;

/** Generated Node Admin SDK operation action function for the 'CreateVehicleAssignment' Mutation. Allow users to execute without passing in DataConnect. */
export function createVehicleAssignment(dc: DataConnect, vars: CreateVehicleAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateVehicleAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'CreateVehicleAssignment' Mutation. Allow users to pass in custom DataConnect instances. */
export function createVehicleAssignment(vars: CreateVehicleAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateVehicleAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateVehicleAssignment' Mutation. Allow users to execute without passing in DataConnect. */
export function updateVehicleAssignment(dc: DataConnect, vars: UpdateVehicleAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateVehicleAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateVehicleAssignment' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateVehicleAssignment(vars: UpdateVehicleAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateVehicleAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteVehicleAssignment' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteVehicleAssignment(dc: DataConnect, vars: DeleteVehicleAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteVehicleAssignmentData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteVehicleAssignment' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteVehicleAssignment(vars: DeleteVehicleAssignmentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteVehicleAssignmentData>>;

/** Generated Node Admin SDK operation action function for the 'CreateVehicleExpense' Mutation. Allow users to execute without passing in DataConnect. */
export function createVehicleExpense(dc: DataConnect, vars: CreateVehicleExpenseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateVehicleExpenseData>>;
/** Generated Node Admin SDK operation action function for the 'CreateVehicleExpense' Mutation. Allow users to pass in custom DataConnect instances. */
export function createVehicleExpense(vars: CreateVehicleExpenseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateVehicleExpenseData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateVehicleExpense' Mutation. Allow users to execute without passing in DataConnect. */
export function updateVehicleExpense(dc: DataConnect, vars: UpdateVehicleExpenseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateVehicleExpenseData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateVehicleExpense' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateVehicleExpense(vars: UpdateVehicleExpenseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateVehicleExpenseData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteVehicleExpense' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteVehicleExpense(dc: DataConnect, vars: DeleteVehicleExpenseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteVehicleExpenseData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteVehicleExpense' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteVehicleExpense(vars: DeleteVehicleExpenseVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteVehicleExpenseData>>;

/** Generated Node Admin SDK operation action function for the 'CreateVehicleBillingDocument' Mutation. Allow users to execute without passing in DataConnect. */
export function createVehicleBillingDocument(dc: DataConnect, vars: CreateVehicleBillingDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateVehicleBillingDocumentData>>;
/** Generated Node Admin SDK operation action function for the 'CreateVehicleBillingDocument' Mutation. Allow users to pass in custom DataConnect instances. */
export function createVehicleBillingDocument(vars: CreateVehicleBillingDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateVehicleBillingDocumentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateVehicleBillingDocument' Mutation. Allow users to execute without passing in DataConnect. */
export function updateVehicleBillingDocument(dc: DataConnect, vars: UpdateVehicleBillingDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateVehicleBillingDocumentData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateVehicleBillingDocument' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateVehicleBillingDocument(vars: UpdateVehicleBillingDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateVehicleBillingDocumentData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteVehicleBillingDocument' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteVehicleBillingDocument(dc: DataConnect, vars: DeleteVehicleBillingDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteVehicleBillingDocumentData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteVehicleBillingDocument' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteVehicleBillingDocument(vars: DeleteVehicleBillingDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteVehicleBillingDocumentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAgent' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAgent(dc: DataConnect, vars: UpdateAgentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAgentData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAgent' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAgent(vars: UpdateAgentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAgentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateAgentConversation' Mutation. Allow users to execute without passing in DataConnect. */
export function updateAgentConversation(dc: DataConnect, vars: UpdateAgentConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAgentConversationData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateAgentConversation' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateAgentConversation(vars: UpdateAgentConversationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateAgentConversationData>>;

/** Generated Node Admin SDK operation action function for the 'CreateDailyDispatch' Mutation. Allow users to execute without passing in DataConnect. */
export function createDailyDispatch(dc: DataConnect, vars: CreateDailyDispatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDailyDispatchData>>;
/** Generated Node Admin SDK operation action function for the 'CreateDailyDispatch' Mutation. Allow users to pass in custom DataConnect instances. */
export function createDailyDispatch(vars: CreateDailyDispatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateDailyDispatchData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateDailyDispatch' Mutation. Allow users to execute without passing in DataConnect. */
export function updateDailyDispatch(dc: DataConnect, vars: UpdateDailyDispatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateDailyDispatchData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateDailyDispatch' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateDailyDispatch(vars: UpdateDailyDispatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateDailyDispatchData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteDailyDispatch' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteDailyDispatch(dc: DataConnect, vars: DeleteDailyDispatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteDailyDispatchData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteDailyDispatch' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteDailyDispatch(vars: DeleteDailyDispatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteDailyDispatchData>>;

/** Generated Node Admin SDK operation action function for the 'CreatePayment' Mutation. Allow users to execute without passing in DataConnect. */
export function createPayment(dc: DataConnect, vars: CreatePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePaymentData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePayment' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPayment(vars: CreatePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePaymentData>>;

/** Generated Node Admin SDK operation action function for the 'UpdatePayment' Mutation. Allow users to execute without passing in DataConnect. */
export function updatePayment(dc: DataConnect, vars: UpdatePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePaymentData>>;
/** Generated Node Admin SDK operation action function for the 'UpdatePayment' Mutation. Allow users to pass in custom DataConnect instances. */
export function updatePayment(vars: UpdatePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdatePaymentData>>;

/** Generated Node Admin SDK operation action function for the 'DeletePayment' Mutation. Allow users to execute without passing in DataConnect. */
export function deletePayment(dc: DataConnect, vars: DeletePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletePaymentData>>;
/** Generated Node Admin SDK operation action function for the 'DeletePayment' Mutation. Allow users to pass in custom DataConnect instances. */
export function deletePayment(vars: DeletePaymentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeletePaymentData>>;

/** Generated Node Admin SDK operation action function for the 'CreateTaxInvoice' Mutation. Allow users to execute without passing in DataConnect. */
export function createTaxInvoice(dc: DataConnect, vars: CreateTaxInvoiceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTaxInvoiceData>>;
/** Generated Node Admin SDK operation action function for the 'CreateTaxInvoice' Mutation. Allow users to pass in custom DataConnect instances. */
export function createTaxInvoice(vars: CreateTaxInvoiceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateTaxInvoiceData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateTaxInvoice' Mutation. Allow users to execute without passing in DataConnect. */
export function updateTaxInvoice(dc: DataConnect, vars: UpdateTaxInvoiceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateTaxInvoiceData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateTaxInvoice' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateTaxInvoice(vars: UpdateTaxInvoiceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateTaxInvoiceData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteTaxInvoice' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteTaxInvoice(dc: DataConnect, vars: DeleteTaxInvoiceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteTaxInvoiceData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteTaxInvoice' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteTaxInvoice(vars: DeleteTaxInvoiceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteTaxInvoiceData>>;

/** Generated Node Admin SDK operation action function for the 'CreateReceivable' Mutation. Allow users to execute without passing in DataConnect. */
export function createReceivable(dc: DataConnect, vars: CreateReceivableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateReceivableData>>;
/** Generated Node Admin SDK operation action function for the 'CreateReceivable' Mutation. Allow users to pass in custom DataConnect instances. */
export function createReceivable(vars: CreateReceivableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateReceivableData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateReceivable' Mutation. Allow users to execute without passing in DataConnect. */
export function updateReceivable(dc: DataConnect, vars: UpdateReceivableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateReceivableData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateReceivable' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateReceivable(vars: UpdateReceivableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateReceivableData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteReceivable' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteReceivable(dc: DataConnect, vars: DeleteReceivableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteReceivableData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteReceivable' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteReceivable(vars: DeleteReceivableVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteReceivableData>>;

/** Generated Node Admin SDK operation action function for the 'ListCompanies' Query. Allow users to execute without passing in DataConnect. */
export function listCompanies(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCompaniesData>>;
/** Generated Node Admin SDK operation action function for the 'ListCompanies' Query. Allow users to pass in custom DataConnect instances. */
export function listCompanies(options?: OperationOptions): Promise<ExecuteOperationResponse<ListCompaniesData>>;

/** Generated Node Admin SDK operation action function for the 'GetCompany' Query. Allow users to execute without passing in DataConnect. */
export function getCompany(dc: DataConnect, vars: GetCompanyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCompanyData>>;
/** Generated Node Admin SDK operation action function for the 'GetCompany' Query. Allow users to pass in custom DataConnect instances. */
export function getCompany(vars: GetCompanyVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCompanyData>>;

/** Generated Node Admin SDK operation action function for the 'ListTeams' Query. Allow users to execute without passing in DataConnect. */
export function listTeams(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListTeamsData>>;
/** Generated Node Admin SDK operation action function for the 'ListTeams' Query. Allow users to pass in custom DataConnect instances. */
export function listTeams(options?: OperationOptions): Promise<ExecuteOperationResponse<ListTeamsData>>;

/** Generated Node Admin SDK operation action function for the 'GetTeam' Query. Allow users to execute without passing in DataConnect. */
export function getTeam(dc: DataConnect, vars: GetTeamVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTeamData>>;
/** Generated Node Admin SDK operation action function for the 'GetTeam' Query. Allow users to pass in custom DataConnect instances. */
export function getTeam(vars: GetTeamVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTeamData>>;

/** Generated Node Admin SDK operation action function for the 'ListWorkers' Query. Allow users to execute without passing in DataConnect. */
export function listWorkers(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListWorkersData>>;
/** Generated Node Admin SDK operation action function for the 'ListWorkers' Query. Allow users to pass in custom DataConnect instances. */
export function listWorkers(options?: OperationOptions): Promise<ExecuteOperationResponse<ListWorkersData>>;

/** Generated Node Admin SDK operation action function for the 'ListPositions' Query. Allow users to execute without passing in DataConnect. */
export function listPositions(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListPositionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListPositions' Query. Allow users to pass in custom DataConnect instances. */
export function listPositions(options?: OperationOptions): Promise<ExecuteOperationResponse<ListPositionsData>>;

/** Generated Node Admin SDK operation action function for the 'GetWorker' Query. Allow users to execute without passing in DataConnect. */
export function getWorker(dc: DataConnect, vars: GetWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWorkerData>>;
/** Generated Node Admin SDK operation action function for the 'GetWorker' Query. Allow users to pass in custom DataConnect instances. */
export function getWorker(vars: GetWorkerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetWorkerData>>;

/** Generated Node Admin SDK operation action function for the 'ListSites' Query. Allow users to execute without passing in DataConnect. */
export function listSites(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSitesData>>;
/** Generated Node Admin SDK operation action function for the 'ListSites' Query. Allow users to pass in custom DataConnect instances. */
export function listSites(options?: OperationOptions): Promise<ExecuteOperationResponse<ListSitesData>>;

/** Generated Node Admin SDK operation action function for the 'GetSite' Query. Allow users to execute without passing in DataConnect. */
export function getSite(dc: DataConnect, vars: GetSiteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSiteData>>;
/** Generated Node Admin SDK operation action function for the 'GetSite' Query. Allow users to pass in custom DataConnect instances. */
export function getSite(vars: GetSiteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetSiteData>>;

/** Generated Node Admin SDK operation action function for the 'ListDailyReports' Query. Allow users to execute without passing in DataConnect. */
export function listDailyReports(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDailyReportsData>>;
/** Generated Node Admin SDK operation action function for the 'ListDailyReports' Query. Allow users to pass in custom DataConnect instances. */
export function listDailyReports(options?: OperationOptions): Promise<ExecuteOperationResponse<ListDailyReportsData>>;

/** Generated Node Admin SDK operation action function for the 'ListDailyReportWorkers' Query. Allow users to execute without passing in DataConnect. */
export function listDailyReportWorkers(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListDailyReportWorkersData>>;
/** Generated Node Admin SDK operation action function for the 'ListDailyReportWorkers' Query. Allow users to pass in custom DataConnect instances. */
export function listDailyReportWorkers(options?: OperationOptions): Promise<ExecuteOperationResponse<ListDailyReportWorkersData>>;

/** Generated Node Admin SDK operation action function for the 'ListAppUsers' Query. Allow users to execute without passing in DataConnect. */
export function listAppUsers(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAppUsersData>>;
/** Generated Node Admin SDK operation action function for the 'ListAppUsers' Query. Allow users to pass in custom DataConnect instances. */
export function listAppUsers(options?: OperationOptions): Promise<ExecuteOperationResponse<ListAppUsersData>>;

/** Generated Node Admin SDK operation action function for the 'ListMenuConfigs' Query. Allow users to execute without passing in DataConnect. */
export function listMenuConfigs(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMenuConfigsData>>;
/** Generated Node Admin SDK operation action function for the 'ListMenuConfigs' Query. Allow users to pass in custom DataConnect instances. */
export function listMenuConfigs(options?: OperationOptions): Promise<ExecuteOperationResponse<ListMenuConfigsData>>;

/** Generated Node Admin SDK operation action function for the 'ListSystemLogs' Query. Allow users to execute without passing in DataConnect. */
export function listSystemLogs(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSystemLogsData>>;
/** Generated Node Admin SDK operation action function for the 'ListSystemLogs' Query. Allow users to pass in custom DataConnect instances. */
export function listSystemLogs(options?: OperationOptions): Promise<ExecuteOperationResponse<ListSystemLogsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAuditLogs' Query. Allow users to execute without passing in DataConnect. */
export function listAuditLogs(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAuditLogsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAuditLogs' Query. Allow users to pass in custom DataConnect instances. */
export function listAuditLogs(options?: OperationOptions): Promise<ExecuteOperationResponse<ListAuditLogsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAgents' Query. Allow users to execute without passing in DataConnect. */
export function listAgents(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAgentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAgents' Query. Allow users to pass in custom DataConnect instances. */
export function listAgents(options?: OperationOptions): Promise<ExecuteOperationResponse<ListAgentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAgentConversations' Query. Allow users to execute without passing in DataConnect. */
export function listAgentConversations(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAgentConversationsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAgentConversations' Query. Allow users to pass in custom DataConnect instances. */
export function listAgentConversations(options?: OperationOptions): Promise<ExecuteOperationResponse<ListAgentConversationsData>>;

/** Generated Node Admin SDK operation action function for the 'ListSettings' Query. Allow users to execute without passing in DataConnect. */
export function listSettings(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'ListSettings' Query. Allow users to pass in custom DataConnect instances. */
export function listSettings(options?: OperationOptions): Promise<ExecuteOperationResponse<ListSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListSystemConfigs' Query. Allow users to execute without passing in DataConnect. */
export function listSystemConfigs(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSystemConfigsData>>;
/** Generated Node Admin SDK operation action function for the 'ListSystemConfigs' Query. Allow users to pass in custom DataConnect instances. */
export function listSystemConfigs(options?: OperationOptions): Promise<ExecuteOperationResponse<ListSystemConfigsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllCompanies' Query. Allow users to execute without passing in DataConnect. */
export function listAllCompanies(dc: DataConnect, vars?: ListAllCompaniesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllCompaniesData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllCompanies' Query. Allow users to pass in custom DataConnect instances. */
export function listAllCompanies(vars?: ListAllCompaniesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllCompaniesData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllTeams' Query. Allow users to execute without passing in DataConnect. */
export function listAllTeams(dc: DataConnect, vars?: ListAllTeamsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllTeamsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllTeams' Query. Allow users to pass in custom DataConnect instances. */
export function listAllTeams(vars?: ListAllTeamsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllTeamsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllWorkers' Query. Allow users to execute without passing in DataConnect. */
export function listAllWorkers(dc: DataConnect, vars?: ListAllWorkersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllWorkersData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllWorkers' Query. Allow users to pass in custom DataConnect instances. */
export function listAllWorkers(vars?: ListAllWorkersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllWorkersData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllPositions' Query. Allow users to execute without passing in DataConnect. */
export function listAllPositions(dc: DataConnect, vars?: ListAllPositionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllPositionsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllPositions' Query. Allow users to pass in custom DataConnect instances. */
export function listAllPositions(vars?: ListAllPositionsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllPositionsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllSites' Query. Allow users to execute without passing in DataConnect. */
export function listAllSites(dc: DataConnect, vars?: ListAllSitesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSitesData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllSites' Query. Allow users to pass in custom DataConnect instances. */
export function listAllSites(vars?: ListAllSitesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSitesData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllDailyReports' Query. Allow users to execute without passing in DataConnect. */
export function listAllDailyReports(dc: DataConnect, vars?: ListAllDailyReportsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllDailyReportsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllDailyReports' Query. Allow users to pass in custom DataConnect instances. */
export function listAllDailyReports(vars?: ListAllDailyReportsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllDailyReportsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllDailyReportWorkers' Query. Allow users to execute without passing in DataConnect. */
export function listAllDailyReportWorkers(dc: DataConnect, vars?: ListAllDailyReportWorkersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllDailyReportWorkersData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllDailyReportWorkers' Query. Allow users to pass in custom DataConnect instances. */
export function listAllDailyReportWorkers(vars?: ListAllDailyReportWorkersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllDailyReportWorkersData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllAppUsers' Query. Allow users to execute without passing in DataConnect. */
export function listAllAppUsers(dc: DataConnect, vars?: ListAllAppUsersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAppUsersData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllAppUsers' Query. Allow users to pass in custom DataConnect instances. */
export function listAllAppUsers(vars?: ListAllAppUsersVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAppUsersData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllMenuConfigs' Query. Allow users to execute without passing in DataConnect. */
export function listAllMenuConfigs(dc: DataConnect, vars?: ListAllMenuConfigsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllMenuConfigsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllMenuConfigs' Query. Allow users to pass in custom DataConnect instances. */
export function listAllMenuConfigs(vars?: ListAllMenuConfigsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllMenuConfigsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllSystemLogs' Query. Allow users to execute without passing in DataConnect. */
export function listAllSystemLogs(dc: DataConnect, vars?: ListAllSystemLogsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSystemLogsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllSystemLogs' Query. Allow users to pass in custom DataConnect instances. */
export function listAllSystemLogs(vars?: ListAllSystemLogsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSystemLogsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllAuditLogs' Query. Allow users to execute without passing in DataConnect. */
export function listAllAuditLogs(dc: DataConnect, vars?: ListAllAuditLogsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAuditLogsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllAuditLogs' Query. Allow users to pass in custom DataConnect instances. */
export function listAllAuditLogs(vars?: ListAllAuditLogsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAuditLogsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllAgents' Query. Allow users to execute without passing in DataConnect. */
export function listAllAgents(dc: DataConnect, vars?: ListAllAgentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAgentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllAgents' Query. Allow users to pass in custom DataConnect instances. */
export function listAllAgents(vars?: ListAllAgentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAgentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllAgentConversations' Query. Allow users to execute without passing in DataConnect. */
export function listAllAgentConversations(dc: DataConnect, vars?: ListAllAgentConversationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAgentConversationsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllAgentConversations' Query. Allow users to pass in custom DataConnect instances. */
export function listAllAgentConversations(vars?: ListAllAgentConversationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAgentConversationsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllSettings' Query. Allow users to execute without passing in DataConnect. */
export function listAllSettings(dc: DataConnect, vars?: ListAllSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSettingsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllSettings' Query. Allow users to pass in custom DataConnect instances. */
export function listAllSettings(vars?: ListAllSettingsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSettingsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllSystemConfigs' Query. Allow users to execute without passing in DataConnect. */
export function listAllSystemConfigs(dc: DataConnect, vars?: ListAllSystemConfigsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSystemConfigsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllSystemConfigs' Query. Allow users to pass in custom DataConnect instances. */
export function listAllSystemConfigs(vars?: ListAllSystemConfigsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSystemConfigsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllAccommodations' Query. Allow users to execute without passing in DataConnect. */
export function listAllAccommodations(dc: DataConnect, vars?: ListAllAccommodationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAccommodationsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllAccommodations' Query. Allow users to pass in custom DataConnect instances. */
export function listAllAccommodations(vars?: ListAllAccommodationsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAccommodationsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllAccommodationAssignments' Query. Allow users to execute without passing in DataConnect. */
export function listAllAccommodationAssignments(dc: DataConnect, vars?: ListAllAccommodationAssignmentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAccommodationAssignmentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllAccommodationAssignments' Query. Allow users to pass in custom DataConnect instances. */
export function listAllAccommodationAssignments(vars?: ListAllAccommodationAssignmentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAccommodationAssignmentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllUtilityRecords' Query. Allow users to execute without passing in DataConnect. */
export function listAllUtilityRecords(dc: DataConnect, vars?: ListAllUtilityRecordsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllUtilityRecordsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllUtilityRecords' Query. Allow users to pass in custom DataConnect instances. */
export function listAllUtilityRecords(vars?: ListAllUtilityRecordsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllUtilityRecordsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllAccommodationBillingDocuments' Query. Allow users to execute without passing in DataConnect. */
export function listAllAccommodationBillingDocuments(dc: DataConnect, vars?: ListAllAccommodationBillingDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAccommodationBillingDocumentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllAccommodationBillingDocuments' Query. Allow users to pass in custom DataConnect instances. */
export function listAllAccommodationBillingDocuments(vars?: ListAllAccommodationBillingDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAccommodationBillingDocumentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllAccommodationBillingLineItems' Query. Allow users to execute without passing in DataConnect. */
export function listAllAccommodationBillingLineItems(dc: DataConnect, vars?: ListAllAccommodationBillingLineItemsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAccommodationBillingLineItemsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllAccommodationBillingLineItems' Query. Allow users to pass in custom DataConnect instances. */
export function listAllAccommodationBillingLineItems(vars?: ListAllAccommodationBillingLineItemsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAccommodationBillingLineItemsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllAdvancePayments' Query. Allow users to execute without passing in DataConnect. */
export function listAllAdvancePayments(dc: DataConnect, vars?: ListAllAdvancePaymentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAdvancePaymentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllAdvancePayments' Query. Allow users to pass in custom DataConnect instances. */
export function listAllAdvancePayments(vars?: ListAllAdvancePaymentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllAdvancePaymentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllSmartMemoCategories' Query. Allow users to execute without passing in DataConnect. */
export function listAllSmartMemoCategories(dc: DataConnect, vars?: ListAllSmartMemoCategoriesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSmartMemoCategoriesData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllSmartMemoCategories' Query. Allow users to pass in custom DataConnect instances. */
export function listAllSmartMemoCategories(vars?: ListAllSmartMemoCategoriesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSmartMemoCategoriesData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllSmartMemos' Query. Allow users to execute without passing in DataConnect. */
export function listAllSmartMemos(dc: DataConnect, vars?: ListAllSmartMemosVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSmartMemosData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllSmartMemos' Query. Allow users to pass in custom DataConnect instances. */
export function listAllSmartMemos(vars?: ListAllSmartMemosVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllSmartMemosData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllVehicles' Query. Allow users to execute without passing in DataConnect. */
export function listAllVehicles(dc: DataConnect, vars?: ListAllVehiclesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllVehiclesData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllVehicles' Query. Allow users to pass in custom DataConnect instances. */
export function listAllVehicles(vars?: ListAllVehiclesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllVehiclesData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllVehicleAssignments' Query. Allow users to execute without passing in DataConnect. */
export function listAllVehicleAssignments(dc: DataConnect, vars?: ListAllVehicleAssignmentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllVehicleAssignmentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllVehicleAssignments' Query. Allow users to pass in custom DataConnect instances. */
export function listAllVehicleAssignments(vars?: ListAllVehicleAssignmentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllVehicleAssignmentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllVehicleExpenses' Query. Allow users to execute without passing in DataConnect. */
export function listAllVehicleExpenses(dc: DataConnect, vars?: ListAllVehicleExpensesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllVehicleExpensesData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllVehicleExpenses' Query. Allow users to pass in custom DataConnect instances. */
export function listAllVehicleExpenses(vars?: ListAllVehicleExpensesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllVehicleExpensesData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllVehicleBillingDocuments' Query. Allow users to execute without passing in DataConnect. */
export function listAllVehicleBillingDocuments(dc: DataConnect, vars?: ListAllVehicleBillingDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllVehicleBillingDocumentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllVehicleBillingDocuments' Query. Allow users to pass in custom DataConnect instances. */
export function listAllVehicleBillingDocuments(vars?: ListAllVehicleBillingDocumentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllVehicleBillingDocumentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllDailyDispatches' Query. Allow users to execute without passing in DataConnect. */
export function listAllDailyDispatches(dc: DataConnect, vars?: ListAllDailyDispatchesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllDailyDispatchesData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllDailyDispatches' Query. Allow users to pass in custom DataConnect instances. */
export function listAllDailyDispatches(vars?: ListAllDailyDispatchesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllDailyDispatchesData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllPayments' Query. Allow users to execute without passing in DataConnect. */
export function listAllPayments(dc: DataConnect, vars?: ListAllPaymentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllPaymentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllPayments' Query. Allow users to pass in custom DataConnect instances. */
export function listAllPayments(vars?: ListAllPaymentsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllPaymentsData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllTaxInvoices' Query. Allow users to execute without passing in DataConnect. */
export function listAllTaxInvoices(dc: DataConnect, vars?: ListAllTaxInvoicesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllTaxInvoicesData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllTaxInvoices' Query. Allow users to pass in custom DataConnect instances. */
export function listAllTaxInvoices(vars?: ListAllTaxInvoicesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllTaxInvoicesData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllReceivables' Query. Allow users to execute without passing in DataConnect. */
export function listAllReceivables(dc: DataConnect, vars?: ListAllReceivablesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllReceivablesData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllReceivables' Query. Allow users to pass in custom DataConnect instances. */
export function listAllReceivables(vars?: ListAllReceivablesVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllReceivablesData>>;

