import { CreateCompanyData, CreateCompanyVariables, CreateTeamData, CreateTeamVariables, CreateWorkerData, CreateWorkerVariables, CreateSiteData, CreateSiteVariables, CreateDailyReportData, CreateDailyReportVariables, CreateDailyReportWorkerData, CreateDailyReportWorkerVariables, UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables, DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables, CreatePositionData, CreatePositionVariables, CreateAuditLogData, CreateAuditLogVariables, CreateAgentData, CreateAgentVariables, CreateAgentConversationData, CreateAgentConversationVariables, CreateSettingData, CreateSettingVariables, UpdateSettingData, UpdateSettingVariables, CreateSystemConfigData, CreateSystemConfigVariables, UpdateSystemConfigData, UpdateSystemConfigVariables, DeletePositionData, DeletePositionVariables, UpdateCompanyData, UpdateCompanyVariables, DeleteCompanyData, DeleteCompanyVariables, UpdateTeamData, UpdateTeamVariables, DeleteTeamData, DeleteTeamVariables, UpdateWorkerData, UpdateWorkerVariables, DeleteWorkerData, DeleteWorkerVariables, UpdateSiteData, UpdateSiteVariables, DeleteSiteData, DeleteSiteVariables, UpdateDailyReportData, UpdateDailyReportVariables, DeleteDailyReportData, DeleteDailyReportVariables, CreateAppUserData, CreateAppUserVariables, UpdateAppUserData, UpdateAppUserVariables, DeleteAppUserData, DeleteAppUserVariables, CreateMenuConfigData, CreateMenuConfigVariables, UpdateMenuConfigData, UpdateMenuConfigVariables, DeleteMenuConfigData, DeleteMenuConfigVariables, CreateSystemLogData, CreateSystemLogVariables, ListCompaniesData, GetCompanyData, GetCompanyVariables, ListTeamsData, GetTeamData, GetTeamVariables, ListWorkersData, ListPositionsData, GetWorkerData, GetWorkerVariables, ListSitesData, GetSiteData, GetSiteVariables, ListDailyReportsData, ListDailyReportWorkersData, ListAppUsersData, ListMenuConfigsData, ListSystemLogsData, ListAuditLogsData, ListAgentsData, ListAgentConversationsData, ListSettingsData, ListSystemConfigsData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateCompany(options?: useDataConnectMutationOptions<CreateCompanyData, FirebaseError, CreateCompanyVariables>): UseDataConnectMutationResult<CreateCompanyData, CreateCompanyVariables>;
export function useCreateCompany(dc: DataConnect, options?: useDataConnectMutationOptions<CreateCompanyData, FirebaseError, CreateCompanyVariables>): UseDataConnectMutationResult<CreateCompanyData, CreateCompanyVariables>;

export function useCreateTeam(options?: useDataConnectMutationOptions<CreateTeamData, FirebaseError, CreateTeamVariables>): UseDataConnectMutationResult<CreateTeamData, CreateTeamVariables>;
export function useCreateTeam(dc: DataConnect, options?: useDataConnectMutationOptions<CreateTeamData, FirebaseError, CreateTeamVariables>): UseDataConnectMutationResult<CreateTeamData, CreateTeamVariables>;

export function useCreateWorker(options?: useDataConnectMutationOptions<CreateWorkerData, FirebaseError, CreateWorkerVariables>): UseDataConnectMutationResult<CreateWorkerData, CreateWorkerVariables>;
export function useCreateWorker(dc: DataConnect, options?: useDataConnectMutationOptions<CreateWorkerData, FirebaseError, CreateWorkerVariables>): UseDataConnectMutationResult<CreateWorkerData, CreateWorkerVariables>;

export function useCreateSite(options?: useDataConnectMutationOptions<CreateSiteData, FirebaseError, CreateSiteVariables>): UseDataConnectMutationResult<CreateSiteData, CreateSiteVariables>;
export function useCreateSite(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSiteData, FirebaseError, CreateSiteVariables>): UseDataConnectMutationResult<CreateSiteData, CreateSiteVariables>;

export function useCreateDailyReport(options?: useDataConnectMutationOptions<CreateDailyReportData, FirebaseError, CreateDailyReportVariables>): UseDataConnectMutationResult<CreateDailyReportData, CreateDailyReportVariables>;
export function useCreateDailyReport(dc: DataConnect, options?: useDataConnectMutationOptions<CreateDailyReportData, FirebaseError, CreateDailyReportVariables>): UseDataConnectMutationResult<CreateDailyReportData, CreateDailyReportVariables>;

export function useCreateDailyReportWorker(options?: useDataConnectMutationOptions<CreateDailyReportWorkerData, FirebaseError, CreateDailyReportWorkerVariables>): UseDataConnectMutationResult<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;
export function useCreateDailyReportWorker(dc: DataConnect, options?: useDataConnectMutationOptions<CreateDailyReportWorkerData, FirebaseError, CreateDailyReportWorkerVariables>): UseDataConnectMutationResult<CreateDailyReportWorkerData, CreateDailyReportWorkerVariables>;

export function useUpdateDailyReportWorker(options?: useDataConnectMutationOptions<UpdateDailyReportWorkerData, FirebaseError, UpdateDailyReportWorkerVariables>): UseDataConnectMutationResult<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;
export function useUpdateDailyReportWorker(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateDailyReportWorkerData, FirebaseError, UpdateDailyReportWorkerVariables>): UseDataConnectMutationResult<UpdateDailyReportWorkerData, UpdateDailyReportWorkerVariables>;

export function useDeleteDailyReportWorker(options?: useDataConnectMutationOptions<DeleteDailyReportWorkerData, FirebaseError, DeleteDailyReportWorkerVariables>): UseDataConnectMutationResult<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;
export function useDeleteDailyReportWorker(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteDailyReportWorkerData, FirebaseError, DeleteDailyReportWorkerVariables>): UseDataConnectMutationResult<DeleteDailyReportWorkerData, DeleteDailyReportWorkerVariables>;

export function useCreatePosition(options?: useDataConnectMutationOptions<CreatePositionData, FirebaseError, CreatePositionVariables>): UseDataConnectMutationResult<CreatePositionData, CreatePositionVariables>;
export function useCreatePosition(dc: DataConnect, options?: useDataConnectMutationOptions<CreatePositionData, FirebaseError, CreatePositionVariables>): UseDataConnectMutationResult<CreatePositionData, CreatePositionVariables>;

export function useCreateAuditLog(options?: useDataConnectMutationOptions<CreateAuditLogData, FirebaseError, CreateAuditLogVariables>): UseDataConnectMutationResult<CreateAuditLogData, CreateAuditLogVariables>;
export function useCreateAuditLog(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAuditLogData, FirebaseError, CreateAuditLogVariables>): UseDataConnectMutationResult<CreateAuditLogData, CreateAuditLogVariables>;

export function useCreateAgent(options?: useDataConnectMutationOptions<CreateAgentData, FirebaseError, CreateAgentVariables>): UseDataConnectMutationResult<CreateAgentData, CreateAgentVariables>;
export function useCreateAgent(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAgentData, FirebaseError, CreateAgentVariables>): UseDataConnectMutationResult<CreateAgentData, CreateAgentVariables>;

export function useCreateAgentConversation(options?: useDataConnectMutationOptions<CreateAgentConversationData, FirebaseError, CreateAgentConversationVariables>): UseDataConnectMutationResult<CreateAgentConversationData, CreateAgentConversationVariables>;
export function useCreateAgentConversation(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAgentConversationData, FirebaseError, CreateAgentConversationVariables>): UseDataConnectMutationResult<CreateAgentConversationData, CreateAgentConversationVariables>;

export function useCreateSetting(options?: useDataConnectMutationOptions<CreateSettingData, FirebaseError, CreateSettingVariables>): UseDataConnectMutationResult<CreateSettingData, CreateSettingVariables>;
export function useCreateSetting(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSettingData, FirebaseError, CreateSettingVariables>): UseDataConnectMutationResult<CreateSettingData, CreateSettingVariables>;

export function useUpdateSetting(options?: useDataConnectMutationOptions<UpdateSettingData, FirebaseError, UpdateSettingVariables>): UseDataConnectMutationResult<UpdateSettingData, UpdateSettingVariables>;
export function useUpdateSetting(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateSettingData, FirebaseError, UpdateSettingVariables>): UseDataConnectMutationResult<UpdateSettingData, UpdateSettingVariables>;

export function useCreateSystemConfig(options?: useDataConnectMutationOptions<CreateSystemConfigData, FirebaseError, CreateSystemConfigVariables>): UseDataConnectMutationResult<CreateSystemConfigData, CreateSystemConfigVariables>;
export function useCreateSystemConfig(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSystemConfigData, FirebaseError, CreateSystemConfigVariables>): UseDataConnectMutationResult<CreateSystemConfigData, CreateSystemConfigVariables>;

export function useUpdateSystemConfig(options?: useDataConnectMutationOptions<UpdateSystemConfigData, FirebaseError, UpdateSystemConfigVariables>): UseDataConnectMutationResult<UpdateSystemConfigData, UpdateSystemConfigVariables>;
export function useUpdateSystemConfig(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateSystemConfigData, FirebaseError, UpdateSystemConfigVariables>): UseDataConnectMutationResult<UpdateSystemConfigData, UpdateSystemConfigVariables>;

export function useDeletePosition(options?: useDataConnectMutationOptions<DeletePositionData, FirebaseError, DeletePositionVariables>): UseDataConnectMutationResult<DeletePositionData, DeletePositionVariables>;
export function useDeletePosition(dc: DataConnect, options?: useDataConnectMutationOptions<DeletePositionData, FirebaseError, DeletePositionVariables>): UseDataConnectMutationResult<DeletePositionData, DeletePositionVariables>;

export function useUpdateCompany(options?: useDataConnectMutationOptions<UpdateCompanyData, FirebaseError, UpdateCompanyVariables>): UseDataConnectMutationResult<UpdateCompanyData, UpdateCompanyVariables>;
export function useUpdateCompany(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateCompanyData, FirebaseError, UpdateCompanyVariables>): UseDataConnectMutationResult<UpdateCompanyData, UpdateCompanyVariables>;

export function useDeleteCompany(options?: useDataConnectMutationOptions<DeleteCompanyData, FirebaseError, DeleteCompanyVariables>): UseDataConnectMutationResult<DeleteCompanyData, DeleteCompanyVariables>;
export function useDeleteCompany(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteCompanyData, FirebaseError, DeleteCompanyVariables>): UseDataConnectMutationResult<DeleteCompanyData, DeleteCompanyVariables>;

export function useUpdateTeam(options?: useDataConnectMutationOptions<UpdateTeamData, FirebaseError, UpdateTeamVariables>): UseDataConnectMutationResult<UpdateTeamData, UpdateTeamVariables>;
export function useUpdateTeam(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateTeamData, FirebaseError, UpdateTeamVariables>): UseDataConnectMutationResult<UpdateTeamData, UpdateTeamVariables>;

export function useDeleteTeam(options?: useDataConnectMutationOptions<DeleteTeamData, FirebaseError, DeleteTeamVariables>): UseDataConnectMutationResult<DeleteTeamData, DeleteTeamVariables>;
export function useDeleteTeam(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteTeamData, FirebaseError, DeleteTeamVariables>): UseDataConnectMutationResult<DeleteTeamData, DeleteTeamVariables>;

export function useUpdateWorker(options?: useDataConnectMutationOptions<UpdateWorkerData, FirebaseError, UpdateWorkerVariables>): UseDataConnectMutationResult<UpdateWorkerData, UpdateWorkerVariables>;
export function useUpdateWorker(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateWorkerData, FirebaseError, UpdateWorkerVariables>): UseDataConnectMutationResult<UpdateWorkerData, UpdateWorkerVariables>;

export function useDeleteWorker(options?: useDataConnectMutationOptions<DeleteWorkerData, FirebaseError, DeleteWorkerVariables>): UseDataConnectMutationResult<DeleteWorkerData, DeleteWorkerVariables>;
export function useDeleteWorker(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteWorkerData, FirebaseError, DeleteWorkerVariables>): UseDataConnectMutationResult<DeleteWorkerData, DeleteWorkerVariables>;

export function useUpdateSite(options?: useDataConnectMutationOptions<UpdateSiteData, FirebaseError, UpdateSiteVariables>): UseDataConnectMutationResult<UpdateSiteData, UpdateSiteVariables>;
export function useUpdateSite(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateSiteData, FirebaseError, UpdateSiteVariables>): UseDataConnectMutationResult<UpdateSiteData, UpdateSiteVariables>;

export function useDeleteSite(options?: useDataConnectMutationOptions<DeleteSiteData, FirebaseError, DeleteSiteVariables>): UseDataConnectMutationResult<DeleteSiteData, DeleteSiteVariables>;
export function useDeleteSite(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteSiteData, FirebaseError, DeleteSiteVariables>): UseDataConnectMutationResult<DeleteSiteData, DeleteSiteVariables>;

export function useUpdateDailyReport(options?: useDataConnectMutationOptions<UpdateDailyReportData, FirebaseError, UpdateDailyReportVariables>): UseDataConnectMutationResult<UpdateDailyReportData, UpdateDailyReportVariables>;
export function useUpdateDailyReport(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateDailyReportData, FirebaseError, UpdateDailyReportVariables>): UseDataConnectMutationResult<UpdateDailyReportData, UpdateDailyReportVariables>;

export function useDeleteDailyReport(options?: useDataConnectMutationOptions<DeleteDailyReportData, FirebaseError, DeleteDailyReportVariables>): UseDataConnectMutationResult<DeleteDailyReportData, DeleteDailyReportVariables>;
export function useDeleteDailyReport(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteDailyReportData, FirebaseError, DeleteDailyReportVariables>): UseDataConnectMutationResult<DeleteDailyReportData, DeleteDailyReportVariables>;

export function useCreateAppUser(options?: useDataConnectMutationOptions<CreateAppUserData, FirebaseError, CreateAppUserVariables>): UseDataConnectMutationResult<CreateAppUserData, CreateAppUserVariables>;
export function useCreateAppUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateAppUserData, FirebaseError, CreateAppUserVariables>): UseDataConnectMutationResult<CreateAppUserData, CreateAppUserVariables>;

export function useUpdateAppUser(options?: useDataConnectMutationOptions<UpdateAppUserData, FirebaseError, UpdateAppUserVariables>): UseDataConnectMutationResult<UpdateAppUserData, UpdateAppUserVariables>;
export function useUpdateAppUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateAppUserData, FirebaseError, UpdateAppUserVariables>): UseDataConnectMutationResult<UpdateAppUserData, UpdateAppUserVariables>;

export function useDeleteAppUser(options?: useDataConnectMutationOptions<DeleteAppUserData, FirebaseError, DeleteAppUserVariables>): UseDataConnectMutationResult<DeleteAppUserData, DeleteAppUserVariables>;
export function useDeleteAppUser(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteAppUserData, FirebaseError, DeleteAppUserVariables>): UseDataConnectMutationResult<DeleteAppUserData, DeleteAppUserVariables>;

export function useCreateMenuConfig(options?: useDataConnectMutationOptions<CreateMenuConfigData, FirebaseError, CreateMenuConfigVariables>): UseDataConnectMutationResult<CreateMenuConfigData, CreateMenuConfigVariables>;
export function useCreateMenuConfig(dc: DataConnect, options?: useDataConnectMutationOptions<CreateMenuConfigData, FirebaseError, CreateMenuConfigVariables>): UseDataConnectMutationResult<CreateMenuConfigData, CreateMenuConfigVariables>;

export function useUpdateMenuConfig(options?: useDataConnectMutationOptions<UpdateMenuConfigData, FirebaseError, UpdateMenuConfigVariables>): UseDataConnectMutationResult<UpdateMenuConfigData, UpdateMenuConfigVariables>;
export function useUpdateMenuConfig(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateMenuConfigData, FirebaseError, UpdateMenuConfigVariables>): UseDataConnectMutationResult<UpdateMenuConfigData, UpdateMenuConfigVariables>;

export function useDeleteMenuConfig(options?: useDataConnectMutationOptions<DeleteMenuConfigData, FirebaseError, DeleteMenuConfigVariables>): UseDataConnectMutationResult<DeleteMenuConfigData, DeleteMenuConfigVariables>;
export function useDeleteMenuConfig(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteMenuConfigData, FirebaseError, DeleteMenuConfigVariables>): UseDataConnectMutationResult<DeleteMenuConfigData, DeleteMenuConfigVariables>;

export function useCreateSystemLog(options?: useDataConnectMutationOptions<CreateSystemLogData, FirebaseError, CreateSystemLogVariables>): UseDataConnectMutationResult<CreateSystemLogData, CreateSystemLogVariables>;
export function useCreateSystemLog(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSystemLogData, FirebaseError, CreateSystemLogVariables>): UseDataConnectMutationResult<CreateSystemLogData, CreateSystemLogVariables>;

export function useListCompanies(options?: useDataConnectQueryOptions<ListCompaniesData>): UseDataConnectQueryResult<ListCompaniesData, undefined>;
export function useListCompanies(dc: DataConnect, options?: useDataConnectQueryOptions<ListCompaniesData>): UseDataConnectQueryResult<ListCompaniesData, undefined>;

export function useGetCompany(vars: GetCompanyVariables, options?: useDataConnectQueryOptions<GetCompanyData>): UseDataConnectQueryResult<GetCompanyData, GetCompanyVariables>;
export function useGetCompany(dc: DataConnect, vars: GetCompanyVariables, options?: useDataConnectQueryOptions<GetCompanyData>): UseDataConnectQueryResult<GetCompanyData, GetCompanyVariables>;

export function useListTeams(options?: useDataConnectQueryOptions<ListTeamsData>): UseDataConnectQueryResult<ListTeamsData, undefined>;
export function useListTeams(dc: DataConnect, options?: useDataConnectQueryOptions<ListTeamsData>): UseDataConnectQueryResult<ListTeamsData, undefined>;

export function useGetTeam(vars: GetTeamVariables, options?: useDataConnectQueryOptions<GetTeamData>): UseDataConnectQueryResult<GetTeamData, GetTeamVariables>;
export function useGetTeam(dc: DataConnect, vars: GetTeamVariables, options?: useDataConnectQueryOptions<GetTeamData>): UseDataConnectQueryResult<GetTeamData, GetTeamVariables>;

export function useListWorkers(options?: useDataConnectQueryOptions<ListWorkersData>): UseDataConnectQueryResult<ListWorkersData, undefined>;
export function useListWorkers(dc: DataConnect, options?: useDataConnectQueryOptions<ListWorkersData>): UseDataConnectQueryResult<ListWorkersData, undefined>;

export function useListPositions(options?: useDataConnectQueryOptions<ListPositionsData>): UseDataConnectQueryResult<ListPositionsData, undefined>;
export function useListPositions(dc: DataConnect, options?: useDataConnectQueryOptions<ListPositionsData>): UseDataConnectQueryResult<ListPositionsData, undefined>;

export function useGetWorker(vars: GetWorkerVariables, options?: useDataConnectQueryOptions<GetWorkerData>): UseDataConnectQueryResult<GetWorkerData, GetWorkerVariables>;
export function useGetWorker(dc: DataConnect, vars: GetWorkerVariables, options?: useDataConnectQueryOptions<GetWorkerData>): UseDataConnectQueryResult<GetWorkerData, GetWorkerVariables>;

export function useListSites(options?: useDataConnectQueryOptions<ListSitesData>): UseDataConnectQueryResult<ListSitesData, undefined>;
export function useListSites(dc: DataConnect, options?: useDataConnectQueryOptions<ListSitesData>): UseDataConnectQueryResult<ListSitesData, undefined>;

export function useGetSite(vars: GetSiteVariables, options?: useDataConnectQueryOptions<GetSiteData>): UseDataConnectQueryResult<GetSiteData, GetSiteVariables>;
export function useGetSite(dc: DataConnect, vars: GetSiteVariables, options?: useDataConnectQueryOptions<GetSiteData>): UseDataConnectQueryResult<GetSiteData, GetSiteVariables>;

export function useListDailyReports(options?: useDataConnectQueryOptions<ListDailyReportsData>): UseDataConnectQueryResult<ListDailyReportsData, undefined>;
export function useListDailyReports(dc: DataConnect, options?: useDataConnectQueryOptions<ListDailyReportsData>): UseDataConnectQueryResult<ListDailyReportsData, undefined>;

export function useListDailyReportWorkers(options?: useDataConnectQueryOptions<ListDailyReportWorkersData>): UseDataConnectQueryResult<ListDailyReportWorkersData, undefined>;
export function useListDailyReportWorkers(dc: DataConnect, options?: useDataConnectQueryOptions<ListDailyReportWorkersData>): UseDataConnectQueryResult<ListDailyReportWorkersData, undefined>;

export function useListAppUsers(options?: useDataConnectQueryOptions<ListAppUsersData>): UseDataConnectQueryResult<ListAppUsersData, undefined>;
export function useListAppUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListAppUsersData>): UseDataConnectQueryResult<ListAppUsersData, undefined>;

export function useListMenuConfigs(options?: useDataConnectQueryOptions<ListMenuConfigsData>): UseDataConnectQueryResult<ListMenuConfigsData, undefined>;
export function useListMenuConfigs(dc: DataConnect, options?: useDataConnectQueryOptions<ListMenuConfigsData>): UseDataConnectQueryResult<ListMenuConfigsData, undefined>;

export function useListSystemLogs(options?: useDataConnectQueryOptions<ListSystemLogsData>): UseDataConnectQueryResult<ListSystemLogsData, undefined>;
export function useListSystemLogs(dc: DataConnect, options?: useDataConnectQueryOptions<ListSystemLogsData>): UseDataConnectQueryResult<ListSystemLogsData, undefined>;

export function useListAuditLogs(options?: useDataConnectQueryOptions<ListAuditLogsData>): UseDataConnectQueryResult<ListAuditLogsData, undefined>;
export function useListAuditLogs(dc: DataConnect, options?: useDataConnectQueryOptions<ListAuditLogsData>): UseDataConnectQueryResult<ListAuditLogsData, undefined>;

export function useListAgents(options?: useDataConnectQueryOptions<ListAgentsData>): UseDataConnectQueryResult<ListAgentsData, undefined>;
export function useListAgents(dc: DataConnect, options?: useDataConnectQueryOptions<ListAgentsData>): UseDataConnectQueryResult<ListAgentsData, undefined>;

export function useListAgentConversations(options?: useDataConnectQueryOptions<ListAgentConversationsData>): UseDataConnectQueryResult<ListAgentConversationsData, undefined>;
export function useListAgentConversations(dc: DataConnect, options?: useDataConnectQueryOptions<ListAgentConversationsData>): UseDataConnectQueryResult<ListAgentConversationsData, undefined>;

export function useListSettings(options?: useDataConnectQueryOptions<ListSettingsData>): UseDataConnectQueryResult<ListSettingsData, undefined>;
export function useListSettings(dc: DataConnect, options?: useDataConnectQueryOptions<ListSettingsData>): UseDataConnectQueryResult<ListSettingsData, undefined>;

export function useListSystemConfigs(options?: useDataConnectQueryOptions<ListSystemConfigsData>): UseDataConnectQueryResult<ListSystemConfigsData, undefined>;
export function useListSystemConfigs(dc: DataConnect, options?: useDataConnectQueryOptions<ListSystemConfigsData>): UseDataConnectQueryResult<ListSystemConfigsData, undefined>;
