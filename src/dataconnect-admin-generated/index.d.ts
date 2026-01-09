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

export interface DailyReportWorker_Key {
  dailyReportId: UUIDString;
  workerId: UUIDString;
  __typename?: 'DailyReportWorker_Key';
}

export interface DailyReport_Key {
  id: UUIDString;
  __typename?: 'DailyReport_Key';
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

export interface DeletePositionData {
  position_delete?: Position_Key | null;
}

export interface DeletePositionVariables {
  id: UUIDString;
}

export interface DeleteSiteData {
  site_delete?: Site_Key | null;
}

export interface DeleteSiteVariables {
  id: UUIDString;
}

export interface DeleteTeamData {
  team_delete?: Team_Key | null;
}

export interface DeleteTeamVariables {
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

export interface Position_Key {
  id: UUIDString;
  __typename?: 'Position_Key';
}

export interface Setting_Key {
  id: string;
  __typename?: 'Setting_Key';
}

export interface Site_Key {
  id: UUIDString;
  __typename?: 'Site_Key';
}

export interface SystemConfig_Key {
  id: string;
  __typename?: 'SystemConfig_Key';
}

export interface SystemLog_Key {
  id: UUIDString;
  __typename?: 'SystemLog_Key';
}

export interface Team_Key {
  id: UUIDString;
  __typename?: 'Team_Key';
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

export interface UpdateSystemConfigData {
  systemConfig_update?: SystemConfig_Key | null;
}

export interface UpdateSystemConfigVariables {
  id: string;
  data: string;
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

