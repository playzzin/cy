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

