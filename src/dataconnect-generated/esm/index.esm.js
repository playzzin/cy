import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const Status = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
}

export const connectorConfig = {
  connector: 'example',
  service: 'cy-connect',
  location: 'us-central1'
};

export const createCompanyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateCompany', inputVars);
}
createCompanyRef.operationName = 'CreateCompany';

export function createCompany(dcOrVars, vars) {
  return executeMutation(createCompanyRef(dcOrVars, vars));
}

export const createTeamRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTeam', inputVars);
}
createTeamRef.operationName = 'CreateTeam';

export function createTeam(dcOrVars, vars) {
  return executeMutation(createTeamRef(dcOrVars, vars));
}

export const createWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateWorker', inputVars);
}
createWorkerRef.operationName = 'CreateWorker';

export function createWorker(dcOrVars, vars) {
  return executeMutation(createWorkerRef(dcOrVars, vars));
}

export const createSiteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSite', inputVars);
}
createSiteRef.operationName = 'CreateSite';

export function createSite(dcOrVars, vars) {
  return executeMutation(createSiteRef(dcOrVars, vars));
}

export const createDailyReportRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateDailyReport', inputVars);
}
createDailyReportRef.operationName = 'CreateDailyReport';

export function createDailyReport(dcOrVars, vars) {
  return executeMutation(createDailyReportRef(dcOrVars, vars));
}

export const createDailyReportWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateDailyReportWorker', inputVars);
}
createDailyReportWorkerRef.operationName = 'CreateDailyReportWorker';

export function createDailyReportWorker(dcOrVars, vars) {
  return executeMutation(createDailyReportWorkerRef(dcOrVars, vars));
}

export const updateDailyReportWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateDailyReportWorker', inputVars);
}
updateDailyReportWorkerRef.operationName = 'UpdateDailyReportWorker';

export function updateDailyReportWorker(dcOrVars, vars) {
  return executeMutation(updateDailyReportWorkerRef(dcOrVars, vars));
}

export const deleteDailyReportWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteDailyReportWorker', inputVars);
}
deleteDailyReportWorkerRef.operationName = 'DeleteDailyReportWorker';

export function deleteDailyReportWorker(dcOrVars, vars) {
  return executeMutation(deleteDailyReportWorkerRef(dcOrVars, vars));
}

export const createPositionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePosition', inputVars);
}
createPositionRef.operationName = 'CreatePosition';

export function createPosition(dcOrVars, vars) {
  return executeMutation(createPositionRef(dcOrVars, vars));
}

export const createAuditLogRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAuditLog', inputVars);
}
createAuditLogRef.operationName = 'CreateAuditLog';

export function createAuditLog(dcOrVars, vars) {
  return executeMutation(createAuditLogRef(dcOrVars, vars));
}

export const createAgentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAgent', inputVars);
}
createAgentRef.operationName = 'CreateAgent';

export function createAgent(dcOrVars, vars) {
  return executeMutation(createAgentRef(dcOrVars, vars));
}

export const createAgentConversationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAgentConversation', inputVars);
}
createAgentConversationRef.operationName = 'CreateAgentConversation';

export function createAgentConversation(dcOrVars, vars) {
  return executeMutation(createAgentConversationRef(dcOrVars, vars));
}

export const createSettingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSetting', inputVars);
}
createSettingRef.operationName = 'CreateSetting';

export function createSetting(dcOrVars, vars) {
  return executeMutation(createSettingRef(dcOrVars, vars));
}

export const updateSettingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSetting', inputVars);
}
updateSettingRef.operationName = 'UpdateSetting';

export function updateSetting(dcOrVars, vars) {
  return executeMutation(updateSettingRef(dcOrVars, vars));
}

export const createSystemConfigRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSystemConfig', inputVars);
}
createSystemConfigRef.operationName = 'CreateSystemConfig';

export function createSystemConfig(dcOrVars, vars) {
  return executeMutation(createSystemConfigRef(dcOrVars, vars));
}

export const updateSystemConfigRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSystemConfig', inputVars);
}
updateSystemConfigRef.operationName = 'UpdateSystemConfig';

export function updateSystemConfig(dcOrVars, vars) {
  return executeMutation(updateSystemConfigRef(dcOrVars, vars));
}

export const deletePositionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeletePosition', inputVars);
}
deletePositionRef.operationName = 'DeletePosition';

export function deletePosition(dcOrVars, vars) {
  return executeMutation(deletePositionRef(dcOrVars, vars));
}

export const updateCompanyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateCompany', inputVars);
}
updateCompanyRef.operationName = 'UpdateCompany';

export function updateCompany(dcOrVars, vars) {
  return executeMutation(updateCompanyRef(dcOrVars, vars));
}

export const deleteCompanyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteCompany', inputVars);
}
deleteCompanyRef.operationName = 'DeleteCompany';

export function deleteCompany(dcOrVars, vars) {
  return executeMutation(deleteCompanyRef(dcOrVars, vars));
}

export const updateTeamRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTeam', inputVars);
}
updateTeamRef.operationName = 'UpdateTeam';

export function updateTeam(dcOrVars, vars) {
  return executeMutation(updateTeamRef(dcOrVars, vars));
}

export const deleteTeamRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteTeam', inputVars);
}
deleteTeamRef.operationName = 'DeleteTeam';

export function deleteTeam(dcOrVars, vars) {
  return executeMutation(deleteTeamRef(dcOrVars, vars));
}

export const updateWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateWorker', inputVars);
}
updateWorkerRef.operationName = 'UpdateWorker';

export function updateWorker(dcOrVars, vars) {
  return executeMutation(updateWorkerRef(dcOrVars, vars));
}

export const deleteWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteWorker', inputVars);
}
deleteWorkerRef.operationName = 'DeleteWorker';

export function deleteWorker(dcOrVars, vars) {
  return executeMutation(deleteWorkerRef(dcOrVars, vars));
}

export const updateSiteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSite', inputVars);
}
updateSiteRef.operationName = 'UpdateSite';

export function updateSite(dcOrVars, vars) {
  return executeMutation(updateSiteRef(dcOrVars, vars));
}

export const deleteSiteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteSite', inputVars);
}
deleteSiteRef.operationName = 'DeleteSite';

export function deleteSite(dcOrVars, vars) {
  return executeMutation(deleteSiteRef(dcOrVars, vars));
}

export const updateDailyReportRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateDailyReport', inputVars);
}
updateDailyReportRef.operationName = 'UpdateDailyReport';

export function updateDailyReport(dcOrVars, vars) {
  return executeMutation(updateDailyReportRef(dcOrVars, vars));
}

export const deleteDailyReportRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteDailyReport', inputVars);
}
deleteDailyReportRef.operationName = 'DeleteDailyReport';

export function deleteDailyReport(dcOrVars, vars) {
  return executeMutation(deleteDailyReportRef(dcOrVars, vars));
}

export const createAppUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAppUser', inputVars);
}
createAppUserRef.operationName = 'CreateAppUser';

export function createAppUser(dcOrVars, vars) {
  return executeMutation(createAppUserRef(dcOrVars, vars));
}

export const updateAppUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAppUser', inputVars);
}
updateAppUserRef.operationName = 'UpdateAppUser';

export function updateAppUser(dcOrVars, vars) {
  return executeMutation(updateAppUserRef(dcOrVars, vars));
}

export const deleteAppUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAppUser', inputVars);
}
deleteAppUserRef.operationName = 'DeleteAppUser';

export function deleteAppUser(dcOrVars, vars) {
  return executeMutation(deleteAppUserRef(dcOrVars, vars));
}

export const createMenuConfigRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateMenuConfig', inputVars);
}
createMenuConfigRef.operationName = 'CreateMenuConfig';

export function createMenuConfig(dcOrVars, vars) {
  return executeMutation(createMenuConfigRef(dcOrVars, vars));
}

export const updateMenuConfigRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateMenuConfig', inputVars);
}
updateMenuConfigRef.operationName = 'UpdateMenuConfig';

export function updateMenuConfig(dcOrVars, vars) {
  return executeMutation(updateMenuConfigRef(dcOrVars, vars));
}

export const deleteMenuConfigRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteMenuConfig', inputVars);
}
deleteMenuConfigRef.operationName = 'DeleteMenuConfig';

export function deleteMenuConfig(dcOrVars, vars) {
  return executeMutation(deleteMenuConfigRef(dcOrVars, vars));
}

export const createSystemLogRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSystemLog', inputVars);
}
createSystemLogRef.operationName = 'CreateSystemLog';

export function createSystemLog(dcOrVars, vars) {
  return executeMutation(createSystemLogRef(dcOrVars, vars));
}

export const listCompaniesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListCompanies');
}
listCompaniesRef.operationName = 'ListCompanies';

export function listCompanies(dc) {
  return executeQuery(listCompaniesRef(dc));
}

export const getCompanyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCompany', inputVars);
}
getCompanyRef.operationName = 'GetCompany';

export function getCompany(dcOrVars, vars) {
  return executeQuery(getCompanyRef(dcOrVars, vars));
}

export const listTeamsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListTeams');
}
listTeamsRef.operationName = 'ListTeams';

export function listTeams(dc) {
  return executeQuery(listTeamsRef(dc));
}

export const getTeamRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTeam', inputVars);
}
getTeamRef.operationName = 'GetTeam';

export function getTeam(dcOrVars, vars) {
  return executeQuery(getTeamRef(dcOrVars, vars));
}

export const listWorkersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListWorkers');
}
listWorkersRef.operationName = 'ListWorkers';

export function listWorkers(dc) {
  return executeQuery(listWorkersRef(dc));
}

export const listPositionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListPositions');
}
listPositionsRef.operationName = 'ListPositions';

export function listPositions(dc) {
  return executeQuery(listPositionsRef(dc));
}

export const getWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetWorker', inputVars);
}
getWorkerRef.operationName = 'GetWorker';

export function getWorker(dcOrVars, vars) {
  return executeQuery(getWorkerRef(dcOrVars, vars));
}

export const listSitesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSites');
}
listSitesRef.operationName = 'ListSites';

export function listSites(dc) {
  return executeQuery(listSitesRef(dc));
}

export const getSiteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSite', inputVars);
}
getSiteRef.operationName = 'GetSite';

export function getSite(dcOrVars, vars) {
  return executeQuery(getSiteRef(dcOrVars, vars));
}

export const listDailyReportsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListDailyReports');
}
listDailyReportsRef.operationName = 'ListDailyReports';

export function listDailyReports(dc) {
  return executeQuery(listDailyReportsRef(dc));
}

export const listDailyReportWorkersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListDailyReportWorkers');
}
listDailyReportWorkersRef.operationName = 'ListDailyReportWorkers';

export function listDailyReportWorkers(dc) {
  return executeQuery(listDailyReportWorkersRef(dc));
}

export const listAppUsersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAppUsers');
}
listAppUsersRef.operationName = 'ListAppUsers';

export function listAppUsers(dc) {
  return executeQuery(listAppUsersRef(dc));
}

export const listMenuConfigsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListMenuConfigs');
}
listMenuConfigsRef.operationName = 'ListMenuConfigs';

export function listMenuConfigs(dc) {
  return executeQuery(listMenuConfigsRef(dc));
}

export const listSystemLogsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSystemLogs');
}
listSystemLogsRef.operationName = 'ListSystemLogs';

export function listSystemLogs(dc) {
  return executeQuery(listSystemLogsRef(dc));
}

export const listAuditLogsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAuditLogs');
}
listAuditLogsRef.operationName = 'ListAuditLogs';

export function listAuditLogs(dc) {
  return executeQuery(listAuditLogsRef(dc));
}

export const listAgentsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAgents');
}
listAgentsRef.operationName = 'ListAgents';

export function listAgents(dc) {
  return executeQuery(listAgentsRef(dc));
}

export const listAgentConversationsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAgentConversations');
}
listAgentConversationsRef.operationName = 'ListAgentConversations';

export function listAgentConversations(dc) {
  return executeQuery(listAgentConversationsRef(dc));
}

export const listSettingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSettings');
}
listSettingsRef.operationName = 'ListSettings';

export function listSettings(dc) {
  return executeQuery(listSettingsRef(dc));
}

export const listSystemConfigsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSystemConfigs');
}
listSystemConfigsRef.operationName = 'ListSystemConfigs';

export function listSystemConfigs(dc) {
  return executeQuery(listSystemConfigsRef(dc));
}

