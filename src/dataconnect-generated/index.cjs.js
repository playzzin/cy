const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const Status = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
}
exports.Status = Status;

const connectorConfig = {
  connector: 'example',
  service: 'cy-connect',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const createCompanyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateCompany', inputVars);
}
createCompanyRef.operationName = 'CreateCompany';
exports.createCompanyRef = createCompanyRef;

exports.createCompany = function createCompany(dcOrVars, vars) {
  return executeMutation(createCompanyRef(dcOrVars, vars));
};

const createTeamRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTeam', inputVars);
}
createTeamRef.operationName = 'CreateTeam';
exports.createTeamRef = createTeamRef;

exports.createTeam = function createTeam(dcOrVars, vars) {
  return executeMutation(createTeamRef(dcOrVars, vars));
};

const createWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateWorker', inputVars);
}
createWorkerRef.operationName = 'CreateWorker';
exports.createWorkerRef = createWorkerRef;

exports.createWorker = function createWorker(dcOrVars, vars) {
  return executeMutation(createWorkerRef(dcOrVars, vars));
};

const createSiteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSite', inputVars);
}
createSiteRef.operationName = 'CreateSite';
exports.createSiteRef = createSiteRef;

exports.createSite = function createSite(dcOrVars, vars) {
  return executeMutation(createSiteRef(dcOrVars, vars));
};

const createDailyReportRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateDailyReport', inputVars);
}
createDailyReportRef.operationName = 'CreateDailyReport';
exports.createDailyReportRef = createDailyReportRef;

exports.createDailyReport = function createDailyReport(dcOrVars, vars) {
  return executeMutation(createDailyReportRef(dcOrVars, vars));
};

const createDailyReportWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateDailyReportWorker', inputVars);
}
createDailyReportWorkerRef.operationName = 'CreateDailyReportWorker';
exports.createDailyReportWorkerRef = createDailyReportWorkerRef;

exports.createDailyReportWorker = function createDailyReportWorker(dcOrVars, vars) {
  return executeMutation(createDailyReportWorkerRef(dcOrVars, vars));
};

const updateDailyReportWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateDailyReportWorker', inputVars);
}
updateDailyReportWorkerRef.operationName = 'UpdateDailyReportWorker';
exports.updateDailyReportWorkerRef = updateDailyReportWorkerRef;

exports.updateDailyReportWorker = function updateDailyReportWorker(dcOrVars, vars) {
  return executeMutation(updateDailyReportWorkerRef(dcOrVars, vars));
};

const deleteDailyReportWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteDailyReportWorker', inputVars);
}
deleteDailyReportWorkerRef.operationName = 'DeleteDailyReportWorker';
exports.deleteDailyReportWorkerRef = deleteDailyReportWorkerRef;

exports.deleteDailyReportWorker = function deleteDailyReportWorker(dcOrVars, vars) {
  return executeMutation(deleteDailyReportWorkerRef(dcOrVars, vars));
};

const createPositionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePosition', inputVars);
}
createPositionRef.operationName = 'CreatePosition';
exports.createPositionRef = createPositionRef;

exports.createPosition = function createPosition(dcOrVars, vars) {
  return executeMutation(createPositionRef(dcOrVars, vars));
};

const createAuditLogRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAuditLog', inputVars);
}
createAuditLogRef.operationName = 'CreateAuditLog';
exports.createAuditLogRef = createAuditLogRef;

exports.createAuditLog = function createAuditLog(dcOrVars, vars) {
  return executeMutation(createAuditLogRef(dcOrVars, vars));
};

const createAgentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAgent', inputVars);
}
createAgentRef.operationName = 'CreateAgent';
exports.createAgentRef = createAgentRef;

exports.createAgent = function createAgent(dcOrVars, vars) {
  return executeMutation(createAgentRef(dcOrVars, vars));
};

const createAgentConversationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAgentConversation', inputVars);
}
createAgentConversationRef.operationName = 'CreateAgentConversation';
exports.createAgentConversationRef = createAgentConversationRef;

exports.createAgentConversation = function createAgentConversation(dcOrVars, vars) {
  return executeMutation(createAgentConversationRef(dcOrVars, vars));
};

const createSettingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSetting', inputVars);
}
createSettingRef.operationName = 'CreateSetting';
exports.createSettingRef = createSettingRef;

exports.createSetting = function createSetting(dcOrVars, vars) {
  return executeMutation(createSettingRef(dcOrVars, vars));
};

const updateSettingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSetting', inputVars);
}
updateSettingRef.operationName = 'UpdateSetting';
exports.updateSettingRef = updateSettingRef;

exports.updateSetting = function updateSetting(dcOrVars, vars) {
  return executeMutation(updateSettingRef(dcOrVars, vars));
};

const createSystemConfigRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSystemConfig', inputVars);
}
createSystemConfigRef.operationName = 'CreateSystemConfig';
exports.createSystemConfigRef = createSystemConfigRef;

exports.createSystemConfig = function createSystemConfig(dcOrVars, vars) {
  return executeMutation(createSystemConfigRef(dcOrVars, vars));
};

const updateSystemConfigRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSystemConfig', inputVars);
}
updateSystemConfigRef.operationName = 'UpdateSystemConfig';
exports.updateSystemConfigRef = updateSystemConfigRef;

exports.updateSystemConfig = function updateSystemConfig(dcOrVars, vars) {
  return executeMutation(updateSystemConfigRef(dcOrVars, vars));
};

const deletePositionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeletePosition', inputVars);
}
deletePositionRef.operationName = 'DeletePosition';
exports.deletePositionRef = deletePositionRef;

exports.deletePosition = function deletePosition(dcOrVars, vars) {
  return executeMutation(deletePositionRef(dcOrVars, vars));
};

const updateCompanyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateCompany', inputVars);
}
updateCompanyRef.operationName = 'UpdateCompany';
exports.updateCompanyRef = updateCompanyRef;

exports.updateCompany = function updateCompany(dcOrVars, vars) {
  return executeMutation(updateCompanyRef(dcOrVars, vars));
};

const deleteCompanyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteCompany', inputVars);
}
deleteCompanyRef.operationName = 'DeleteCompany';
exports.deleteCompanyRef = deleteCompanyRef;

exports.deleteCompany = function deleteCompany(dcOrVars, vars) {
  return executeMutation(deleteCompanyRef(dcOrVars, vars));
};

const updateTeamRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTeam', inputVars);
}
updateTeamRef.operationName = 'UpdateTeam';
exports.updateTeamRef = updateTeamRef;

exports.updateTeam = function updateTeam(dcOrVars, vars) {
  return executeMutation(updateTeamRef(dcOrVars, vars));
};

const deleteTeamRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteTeam', inputVars);
}
deleteTeamRef.operationName = 'DeleteTeam';
exports.deleteTeamRef = deleteTeamRef;

exports.deleteTeam = function deleteTeam(dcOrVars, vars) {
  return executeMutation(deleteTeamRef(dcOrVars, vars));
};

const updateWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateWorker', inputVars);
}
updateWorkerRef.operationName = 'UpdateWorker';
exports.updateWorkerRef = updateWorkerRef;

exports.updateWorker = function updateWorker(dcOrVars, vars) {
  return executeMutation(updateWorkerRef(dcOrVars, vars));
};

const deleteWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteWorker', inputVars);
}
deleteWorkerRef.operationName = 'DeleteWorker';
exports.deleteWorkerRef = deleteWorkerRef;

exports.deleteWorker = function deleteWorker(dcOrVars, vars) {
  return executeMutation(deleteWorkerRef(dcOrVars, vars));
};

const updateSiteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSite', inputVars);
}
updateSiteRef.operationName = 'UpdateSite';
exports.updateSiteRef = updateSiteRef;

exports.updateSite = function updateSite(dcOrVars, vars) {
  return executeMutation(updateSiteRef(dcOrVars, vars));
};

const deleteSiteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteSite', inputVars);
}
deleteSiteRef.operationName = 'DeleteSite';
exports.deleteSiteRef = deleteSiteRef;

exports.deleteSite = function deleteSite(dcOrVars, vars) {
  return executeMutation(deleteSiteRef(dcOrVars, vars));
};

const updateDailyReportRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateDailyReport', inputVars);
}
updateDailyReportRef.operationName = 'UpdateDailyReport';
exports.updateDailyReportRef = updateDailyReportRef;

exports.updateDailyReport = function updateDailyReport(dcOrVars, vars) {
  return executeMutation(updateDailyReportRef(dcOrVars, vars));
};

const deleteDailyReportRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteDailyReport', inputVars);
}
deleteDailyReportRef.operationName = 'DeleteDailyReport';
exports.deleteDailyReportRef = deleteDailyReportRef;

exports.deleteDailyReport = function deleteDailyReport(dcOrVars, vars) {
  return executeMutation(deleteDailyReportRef(dcOrVars, vars));
};

const createAppUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAppUser', inputVars);
}
createAppUserRef.operationName = 'CreateAppUser';
exports.createAppUserRef = createAppUserRef;

exports.createAppUser = function createAppUser(dcOrVars, vars) {
  return executeMutation(createAppUserRef(dcOrVars, vars));
};

const updateAppUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAppUser', inputVars);
}
updateAppUserRef.operationName = 'UpdateAppUser';
exports.updateAppUserRef = updateAppUserRef;

exports.updateAppUser = function updateAppUser(dcOrVars, vars) {
  return executeMutation(updateAppUserRef(dcOrVars, vars));
};

const deleteAppUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAppUser', inputVars);
}
deleteAppUserRef.operationName = 'DeleteAppUser';
exports.deleteAppUserRef = deleteAppUserRef;

exports.deleteAppUser = function deleteAppUser(dcOrVars, vars) {
  return executeMutation(deleteAppUserRef(dcOrVars, vars));
};

const createMenuConfigRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateMenuConfig', inputVars);
}
createMenuConfigRef.operationName = 'CreateMenuConfig';
exports.createMenuConfigRef = createMenuConfigRef;

exports.createMenuConfig = function createMenuConfig(dcOrVars, vars) {
  return executeMutation(createMenuConfigRef(dcOrVars, vars));
};

const updateMenuConfigRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateMenuConfig', inputVars);
}
updateMenuConfigRef.operationName = 'UpdateMenuConfig';
exports.updateMenuConfigRef = updateMenuConfigRef;

exports.updateMenuConfig = function updateMenuConfig(dcOrVars, vars) {
  return executeMutation(updateMenuConfigRef(dcOrVars, vars));
};

const deleteMenuConfigRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteMenuConfig', inputVars);
}
deleteMenuConfigRef.operationName = 'DeleteMenuConfig';
exports.deleteMenuConfigRef = deleteMenuConfigRef;

exports.deleteMenuConfig = function deleteMenuConfig(dcOrVars, vars) {
  return executeMutation(deleteMenuConfigRef(dcOrVars, vars));
};

const createSystemLogRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSystemLog', inputVars);
}
createSystemLogRef.operationName = 'CreateSystemLog';
exports.createSystemLogRef = createSystemLogRef;

exports.createSystemLog = function createSystemLog(dcOrVars, vars) {
  return executeMutation(createSystemLogRef(dcOrVars, vars));
};

const listCompaniesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListCompanies');
}
listCompaniesRef.operationName = 'ListCompanies';
exports.listCompaniesRef = listCompaniesRef;

exports.listCompanies = function listCompanies(dc) {
  return executeQuery(listCompaniesRef(dc));
};

const getCompanyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCompany', inputVars);
}
getCompanyRef.operationName = 'GetCompany';
exports.getCompanyRef = getCompanyRef;

exports.getCompany = function getCompany(dcOrVars, vars) {
  return executeQuery(getCompanyRef(dcOrVars, vars));
};

const listTeamsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListTeams');
}
listTeamsRef.operationName = 'ListTeams';
exports.listTeamsRef = listTeamsRef;

exports.listTeams = function listTeams(dc) {
  return executeQuery(listTeamsRef(dc));
};

const getTeamRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetTeam', inputVars);
}
getTeamRef.operationName = 'GetTeam';
exports.getTeamRef = getTeamRef;

exports.getTeam = function getTeam(dcOrVars, vars) {
  return executeQuery(getTeamRef(dcOrVars, vars));
};

const listWorkersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListWorkers');
}
listWorkersRef.operationName = 'ListWorkers';
exports.listWorkersRef = listWorkersRef;

exports.listWorkers = function listWorkers(dc) {
  return executeQuery(listWorkersRef(dc));
};

const listPositionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListPositions');
}
listPositionsRef.operationName = 'ListPositions';
exports.listPositionsRef = listPositionsRef;

exports.listPositions = function listPositions(dc) {
  return executeQuery(listPositionsRef(dc));
};

const getWorkerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetWorker', inputVars);
}
getWorkerRef.operationName = 'GetWorker';
exports.getWorkerRef = getWorkerRef;

exports.getWorker = function getWorker(dcOrVars, vars) {
  return executeQuery(getWorkerRef(dcOrVars, vars));
};

const listSitesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSites');
}
listSitesRef.operationName = 'ListSites';
exports.listSitesRef = listSitesRef;

exports.listSites = function listSites(dc) {
  return executeQuery(listSitesRef(dc));
};

const getSiteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSite', inputVars);
}
getSiteRef.operationName = 'GetSite';
exports.getSiteRef = getSiteRef;

exports.getSite = function getSite(dcOrVars, vars) {
  return executeQuery(getSiteRef(dcOrVars, vars));
};

const listDailyReportsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListDailyReports');
}
listDailyReportsRef.operationName = 'ListDailyReports';
exports.listDailyReportsRef = listDailyReportsRef;

exports.listDailyReports = function listDailyReports(dc) {
  return executeQuery(listDailyReportsRef(dc));
};

const listDailyReportWorkersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListDailyReportWorkers');
}
listDailyReportWorkersRef.operationName = 'ListDailyReportWorkers';
exports.listDailyReportWorkersRef = listDailyReportWorkersRef;

exports.listDailyReportWorkers = function listDailyReportWorkers(dc) {
  return executeQuery(listDailyReportWorkersRef(dc));
};

const listAppUsersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAppUsers');
}
listAppUsersRef.operationName = 'ListAppUsers';
exports.listAppUsersRef = listAppUsersRef;

exports.listAppUsers = function listAppUsers(dc) {
  return executeQuery(listAppUsersRef(dc));
};

const listMenuConfigsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListMenuConfigs');
}
listMenuConfigsRef.operationName = 'ListMenuConfigs';
exports.listMenuConfigsRef = listMenuConfigsRef;

exports.listMenuConfigs = function listMenuConfigs(dc) {
  return executeQuery(listMenuConfigsRef(dc));
};

const listSystemLogsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSystemLogs');
}
listSystemLogsRef.operationName = 'ListSystemLogs';
exports.listSystemLogsRef = listSystemLogsRef;

exports.listSystemLogs = function listSystemLogs(dc) {
  return executeQuery(listSystemLogsRef(dc));
};

const listAuditLogsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAuditLogs');
}
listAuditLogsRef.operationName = 'ListAuditLogs';
exports.listAuditLogsRef = listAuditLogsRef;

exports.listAuditLogs = function listAuditLogs(dc) {
  return executeQuery(listAuditLogsRef(dc));
};

const listAgentsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAgents');
}
listAgentsRef.operationName = 'ListAgents';
exports.listAgentsRef = listAgentsRef;

exports.listAgents = function listAgents(dc) {
  return executeQuery(listAgentsRef(dc));
};

const listAgentConversationsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAgentConversations');
}
listAgentConversationsRef.operationName = 'ListAgentConversations';
exports.listAgentConversationsRef = listAgentConversationsRef;

exports.listAgentConversations = function listAgentConversations(dc) {
  return executeQuery(listAgentConversationsRef(dc));
};

const listSettingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSettings');
}
listSettingsRef.operationName = 'ListSettings';
exports.listSettingsRef = listSettingsRef;

exports.listSettings = function listSettings(dc) {
  return executeQuery(listSettingsRef(dc));
};

const listSystemConfigsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSystemConfigs');
}
listSystemConfigsRef.operationName = 'ListSystemConfigs';
exports.listSystemConfigsRef = listSystemConfigsRef;

exports.listSystemConfigs = function listSystemConfigs(dc) {
  return executeQuery(listSystemConfigsRef(dc));
};
