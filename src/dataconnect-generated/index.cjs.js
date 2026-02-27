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

const createAccommodationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccommodation', inputVars);
}
createAccommodationRef.operationName = 'CreateAccommodation';
exports.createAccommodationRef = createAccommodationRef;

exports.createAccommodation = function createAccommodation(dcOrVars, vars) {
  return executeMutation(createAccommodationRef(dcOrVars, vars));
};

const updateAccommodationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAccommodation', inputVars);
}
updateAccommodationRef.operationName = 'UpdateAccommodation';
exports.updateAccommodationRef = updateAccommodationRef;

exports.updateAccommodation = function updateAccommodation(dcOrVars, vars) {
  return executeMutation(updateAccommodationRef(dcOrVars, vars));
};

const deleteAccommodationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAccommodation', inputVars);
}
deleteAccommodationRef.operationName = 'DeleteAccommodation';
exports.deleteAccommodationRef = deleteAccommodationRef;

exports.deleteAccommodation = function deleteAccommodation(dcOrVars, vars) {
  return executeMutation(deleteAccommodationRef(dcOrVars, vars));
};

const createAccommodationAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccommodationAssignment', inputVars);
}
createAccommodationAssignmentRef.operationName = 'CreateAccommodationAssignment';
exports.createAccommodationAssignmentRef = createAccommodationAssignmentRef;

exports.createAccommodationAssignment = function createAccommodationAssignment(dcOrVars, vars) {
  return executeMutation(createAccommodationAssignmentRef(dcOrVars, vars));
};

const updateAccommodationAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAccommodationAssignment', inputVars);
}
updateAccommodationAssignmentRef.operationName = 'UpdateAccommodationAssignment';
exports.updateAccommodationAssignmentRef = updateAccommodationAssignmentRef;

exports.updateAccommodationAssignment = function updateAccommodationAssignment(dcOrVars, vars) {
  return executeMutation(updateAccommodationAssignmentRef(dcOrVars, vars));
};

const deleteAccommodationAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAccommodationAssignment', inputVars);
}
deleteAccommodationAssignmentRef.operationName = 'DeleteAccommodationAssignment';
exports.deleteAccommodationAssignmentRef = deleteAccommodationAssignmentRef;

exports.deleteAccommodationAssignment = function deleteAccommodationAssignment(dcOrVars, vars) {
  return executeMutation(deleteAccommodationAssignmentRef(dcOrVars, vars));
};

const createUtilityRecordRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUtilityRecord', inputVars);
}
createUtilityRecordRef.operationName = 'CreateUtilityRecord';
exports.createUtilityRecordRef = createUtilityRecordRef;

exports.createUtilityRecord = function createUtilityRecord(dcOrVars, vars) {
  return executeMutation(createUtilityRecordRef(dcOrVars, vars));
};

const updateUtilityRecordRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUtilityRecord', inputVars);
}
updateUtilityRecordRef.operationName = 'UpdateUtilityRecord';
exports.updateUtilityRecordRef = updateUtilityRecordRef;

exports.updateUtilityRecord = function updateUtilityRecord(dcOrVars, vars) {
  return executeMutation(updateUtilityRecordRef(dcOrVars, vars));
};

const deleteUtilityRecordRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteUtilityRecord', inputVars);
}
deleteUtilityRecordRef.operationName = 'DeleteUtilityRecord';
exports.deleteUtilityRecordRef = deleteUtilityRecordRef;

exports.deleteUtilityRecord = function deleteUtilityRecord(dcOrVars, vars) {
  return executeMutation(deleteUtilityRecordRef(dcOrVars, vars));
};

const createAccommodationBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccommodationBillingDocument', inputVars);
}
createAccommodationBillingDocumentRef.operationName = 'CreateAccommodationBillingDocument';
exports.createAccommodationBillingDocumentRef = createAccommodationBillingDocumentRef;

exports.createAccommodationBillingDocument = function createAccommodationBillingDocument(dcOrVars, vars) {
  return executeMutation(createAccommodationBillingDocumentRef(dcOrVars, vars));
};

const updateAccommodationBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAccommodationBillingDocument', inputVars);
}
updateAccommodationBillingDocumentRef.operationName = 'UpdateAccommodationBillingDocument';
exports.updateAccommodationBillingDocumentRef = updateAccommodationBillingDocumentRef;

exports.updateAccommodationBillingDocument = function updateAccommodationBillingDocument(dcOrVars, vars) {
  return executeMutation(updateAccommodationBillingDocumentRef(dcOrVars, vars));
};

const createAccommodationBillingLineItemRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccommodationBillingLineItem', inputVars);
}
createAccommodationBillingLineItemRef.operationName = 'CreateAccommodationBillingLineItem';
exports.createAccommodationBillingLineItemRef = createAccommodationBillingLineItemRef;

exports.createAccommodationBillingLineItem = function createAccommodationBillingLineItem(dcOrVars, vars) {
  return executeMutation(createAccommodationBillingLineItemRef(dcOrVars, vars));
};

const deleteAccommodationBillingLineItemRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAccommodationBillingLineItem', inputVars);
}
deleteAccommodationBillingLineItemRef.operationName = 'DeleteAccommodationBillingLineItem';
exports.deleteAccommodationBillingLineItemRef = deleteAccommodationBillingLineItemRef;

exports.deleteAccommodationBillingLineItem = function deleteAccommodationBillingLineItem(dcOrVars, vars) {
  return executeMutation(deleteAccommodationBillingLineItemRef(dcOrVars, vars));
};

const createAdvancePaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAdvancePayment', inputVars);
}
createAdvancePaymentRef.operationName = 'CreateAdvancePayment';
exports.createAdvancePaymentRef = createAdvancePaymentRef;

exports.createAdvancePayment = function createAdvancePayment(dcOrVars, vars) {
  return executeMutation(createAdvancePaymentRef(dcOrVars, vars));
};

const updateAdvancePaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAdvancePayment', inputVars);
}
updateAdvancePaymentRef.operationName = 'UpdateAdvancePayment';
exports.updateAdvancePaymentRef = updateAdvancePaymentRef;

exports.updateAdvancePayment = function updateAdvancePayment(dcOrVars, vars) {
  return executeMutation(updateAdvancePaymentRef(dcOrVars, vars));
};

const deleteAdvancePaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAdvancePayment', inputVars);
}
deleteAdvancePaymentRef.operationName = 'DeleteAdvancePayment';
exports.deleteAdvancePaymentRef = deleteAdvancePaymentRef;

exports.deleteAdvancePayment = function deleteAdvancePayment(dcOrVars, vars) {
  return executeMutation(deleteAdvancePaymentRef(dcOrVars, vars));
};

const createSmartMemoRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSmartMemo', inputVars);
}
createSmartMemoRef.operationName = 'CreateSmartMemo';
exports.createSmartMemoRef = createSmartMemoRef;

exports.createSmartMemo = function createSmartMemo(dcOrVars, vars) {
  return executeMutation(createSmartMemoRef(dcOrVars, vars));
};

const updateSmartMemoRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSmartMemo', inputVars);
}
updateSmartMemoRef.operationName = 'UpdateSmartMemo';
exports.updateSmartMemoRef = updateSmartMemoRef;

exports.updateSmartMemo = function updateSmartMemo(dcOrVars, vars) {
  return executeMutation(updateSmartMemoRef(dcOrVars, vars));
};

const deleteSmartMemoRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteSmartMemo', inputVars);
}
deleteSmartMemoRef.operationName = 'DeleteSmartMemo';
exports.deleteSmartMemoRef = deleteSmartMemoRef;

exports.deleteSmartMemo = function deleteSmartMemo(dcOrVars, vars) {
  return executeMutation(deleteSmartMemoRef(dcOrVars, vars));
};

const createSmartMemoCategoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSmartMemoCategory', inputVars);
}
createSmartMemoCategoryRef.operationName = 'CreateSmartMemoCategory';
exports.createSmartMemoCategoryRef = createSmartMemoCategoryRef;

exports.createSmartMemoCategory = function createSmartMemoCategory(dcOrVars, vars) {
  return executeMutation(createSmartMemoCategoryRef(dcOrVars, vars));
};

const updateSmartMemoCategoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSmartMemoCategory', inputVars);
}
updateSmartMemoCategoryRef.operationName = 'UpdateSmartMemoCategory';
exports.updateSmartMemoCategoryRef = updateSmartMemoCategoryRef;

exports.updateSmartMemoCategory = function updateSmartMemoCategory(dcOrVars, vars) {
  return executeMutation(updateSmartMemoCategoryRef(dcOrVars, vars));
};

const deleteSmartMemoCategoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteSmartMemoCategory', inputVars);
}
deleteSmartMemoCategoryRef.operationName = 'DeleteSmartMemoCategory';
exports.deleteSmartMemoCategoryRef = deleteSmartMemoCategoryRef;

exports.deleteSmartMemoCategory = function deleteSmartMemoCategory(dcOrVars, vars) {
  return executeMutation(deleteSmartMemoCategoryRef(dcOrVars, vars));
};

const createVehicleRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateVehicle', inputVars);
}
createVehicleRef.operationName = 'CreateVehicle';
exports.createVehicleRef = createVehicleRef;

exports.createVehicle = function createVehicle(dcOrVars, vars) {
  return executeMutation(createVehicleRef(dcOrVars, vars));
};

const updateVehicleRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateVehicle', inputVars);
}
updateVehicleRef.operationName = 'UpdateVehicle';
exports.updateVehicleRef = updateVehicleRef;

exports.updateVehicle = function updateVehicle(dcOrVars, vars) {
  return executeMutation(updateVehicleRef(dcOrVars, vars));
};

const deleteVehicleRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteVehicle', inputVars);
}
deleteVehicleRef.operationName = 'DeleteVehicle';
exports.deleteVehicleRef = deleteVehicleRef;

exports.deleteVehicle = function deleteVehicle(dcOrVars, vars) {
  return executeMutation(deleteVehicleRef(dcOrVars, vars));
};

const createVehicleAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateVehicleAssignment', inputVars);
}
createVehicleAssignmentRef.operationName = 'CreateVehicleAssignment';
exports.createVehicleAssignmentRef = createVehicleAssignmentRef;

exports.createVehicleAssignment = function createVehicleAssignment(dcOrVars, vars) {
  return executeMutation(createVehicleAssignmentRef(dcOrVars, vars));
};

const updateVehicleAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateVehicleAssignment', inputVars);
}
updateVehicleAssignmentRef.operationName = 'UpdateVehicleAssignment';
exports.updateVehicleAssignmentRef = updateVehicleAssignmentRef;

exports.updateVehicleAssignment = function updateVehicleAssignment(dcOrVars, vars) {
  return executeMutation(updateVehicleAssignmentRef(dcOrVars, vars));
};

const deleteVehicleAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteVehicleAssignment', inputVars);
}
deleteVehicleAssignmentRef.operationName = 'DeleteVehicleAssignment';
exports.deleteVehicleAssignmentRef = deleteVehicleAssignmentRef;

exports.deleteVehicleAssignment = function deleteVehicleAssignment(dcOrVars, vars) {
  return executeMutation(deleteVehicleAssignmentRef(dcOrVars, vars));
};

const createVehicleExpenseRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateVehicleExpense', inputVars);
}
createVehicleExpenseRef.operationName = 'CreateVehicleExpense';
exports.createVehicleExpenseRef = createVehicleExpenseRef;

exports.createVehicleExpense = function createVehicleExpense(dcOrVars, vars) {
  return executeMutation(createVehicleExpenseRef(dcOrVars, vars));
};

const updateVehicleExpenseRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateVehicleExpense', inputVars);
}
updateVehicleExpenseRef.operationName = 'UpdateVehicleExpense';
exports.updateVehicleExpenseRef = updateVehicleExpenseRef;

exports.updateVehicleExpense = function updateVehicleExpense(dcOrVars, vars) {
  return executeMutation(updateVehicleExpenseRef(dcOrVars, vars));
};

const deleteVehicleExpenseRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteVehicleExpense', inputVars);
}
deleteVehicleExpenseRef.operationName = 'DeleteVehicleExpense';
exports.deleteVehicleExpenseRef = deleteVehicleExpenseRef;

exports.deleteVehicleExpense = function deleteVehicleExpense(dcOrVars, vars) {
  return executeMutation(deleteVehicleExpenseRef(dcOrVars, vars));
};

const createVehicleBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateVehicleBillingDocument', inputVars);
}
createVehicleBillingDocumentRef.operationName = 'CreateVehicleBillingDocument';
exports.createVehicleBillingDocumentRef = createVehicleBillingDocumentRef;

exports.createVehicleBillingDocument = function createVehicleBillingDocument(dcOrVars, vars) {
  return executeMutation(createVehicleBillingDocumentRef(dcOrVars, vars));
};

const updateVehicleBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateVehicleBillingDocument', inputVars);
}
updateVehicleBillingDocumentRef.operationName = 'UpdateVehicleBillingDocument';
exports.updateVehicleBillingDocumentRef = updateVehicleBillingDocumentRef;

exports.updateVehicleBillingDocument = function updateVehicleBillingDocument(dcOrVars, vars) {
  return executeMutation(updateVehicleBillingDocumentRef(dcOrVars, vars));
};

const deleteVehicleBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteVehicleBillingDocument', inputVars);
}
deleteVehicleBillingDocumentRef.operationName = 'DeleteVehicleBillingDocument';
exports.deleteVehicleBillingDocumentRef = deleteVehicleBillingDocumentRef;

exports.deleteVehicleBillingDocument = function deleteVehicleBillingDocument(dcOrVars, vars) {
  return executeMutation(deleteVehicleBillingDocumentRef(dcOrVars, vars));
};

const updateAgentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAgent', inputVars);
}
updateAgentRef.operationName = 'UpdateAgent';
exports.updateAgentRef = updateAgentRef;

exports.updateAgent = function updateAgent(dcOrVars, vars) {
  return executeMutation(updateAgentRef(dcOrVars, vars));
};

const updateAgentConversationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAgentConversation', inputVars);
}
updateAgentConversationRef.operationName = 'UpdateAgentConversation';
exports.updateAgentConversationRef = updateAgentConversationRef;

exports.updateAgentConversation = function updateAgentConversation(dcOrVars, vars) {
  return executeMutation(updateAgentConversationRef(dcOrVars, vars));
};

const createDailyDispatchRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateDailyDispatch', inputVars);
}
createDailyDispatchRef.operationName = 'CreateDailyDispatch';
exports.createDailyDispatchRef = createDailyDispatchRef;

exports.createDailyDispatch = function createDailyDispatch(dcOrVars, vars) {
  return executeMutation(createDailyDispatchRef(dcOrVars, vars));
};

const updateDailyDispatchRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateDailyDispatch', inputVars);
}
updateDailyDispatchRef.operationName = 'UpdateDailyDispatch';
exports.updateDailyDispatchRef = updateDailyDispatchRef;

exports.updateDailyDispatch = function updateDailyDispatch(dcOrVars, vars) {
  return executeMutation(updateDailyDispatchRef(dcOrVars, vars));
};

const deleteDailyDispatchRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteDailyDispatch', inputVars);
}
deleteDailyDispatchRef.operationName = 'DeleteDailyDispatch';
exports.deleteDailyDispatchRef = deleteDailyDispatchRef;

exports.deleteDailyDispatch = function deleteDailyDispatch(dcOrVars, vars) {
  return executeMutation(deleteDailyDispatchRef(dcOrVars, vars));
};

const createPaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePayment', inputVars);
}
createPaymentRef.operationName = 'CreatePayment';
exports.createPaymentRef = createPaymentRef;

exports.createPayment = function createPayment(dcOrVars, vars) {
  return executeMutation(createPaymentRef(dcOrVars, vars));
};

const updatePaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdatePayment', inputVars);
}
updatePaymentRef.operationName = 'UpdatePayment';
exports.updatePaymentRef = updatePaymentRef;

exports.updatePayment = function updatePayment(dcOrVars, vars) {
  return executeMutation(updatePaymentRef(dcOrVars, vars));
};

const deletePaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeletePayment', inputVars);
}
deletePaymentRef.operationName = 'DeletePayment';
exports.deletePaymentRef = deletePaymentRef;

exports.deletePayment = function deletePayment(dcOrVars, vars) {
  return executeMutation(deletePaymentRef(dcOrVars, vars));
};

const createTaxInvoiceRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTaxInvoice', inputVars);
}
createTaxInvoiceRef.operationName = 'CreateTaxInvoice';
exports.createTaxInvoiceRef = createTaxInvoiceRef;

exports.createTaxInvoice = function createTaxInvoice(dcOrVars, vars) {
  return executeMutation(createTaxInvoiceRef(dcOrVars, vars));
};

const updateTaxInvoiceRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTaxInvoice', inputVars);
}
updateTaxInvoiceRef.operationName = 'UpdateTaxInvoice';
exports.updateTaxInvoiceRef = updateTaxInvoiceRef;

exports.updateTaxInvoice = function updateTaxInvoice(dcOrVars, vars) {
  return executeMutation(updateTaxInvoiceRef(dcOrVars, vars));
};

const deleteTaxInvoiceRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteTaxInvoice', inputVars);
}
deleteTaxInvoiceRef.operationName = 'DeleteTaxInvoice';
exports.deleteTaxInvoiceRef = deleteTaxInvoiceRef;

exports.deleteTaxInvoice = function deleteTaxInvoice(dcOrVars, vars) {
  return executeMutation(deleteTaxInvoiceRef(dcOrVars, vars));
};

const createReceivableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateReceivable', inputVars);
}
createReceivableRef.operationName = 'CreateReceivable';
exports.createReceivableRef = createReceivableRef;

exports.createReceivable = function createReceivable(dcOrVars, vars) {
  return executeMutation(createReceivableRef(dcOrVars, vars));
};

const updateReceivableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateReceivable', inputVars);
}
updateReceivableRef.operationName = 'UpdateReceivable';
exports.updateReceivableRef = updateReceivableRef;

exports.updateReceivable = function updateReceivable(dcOrVars, vars) {
  return executeMutation(updateReceivableRef(dcOrVars, vars));
};

const deleteReceivableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteReceivable', inputVars);
}
deleteReceivableRef.operationName = 'DeleteReceivable';
exports.deleteReceivableRef = deleteReceivableRef;

exports.deleteReceivable = function deleteReceivable(dcOrVars, vars) {
  return executeMutation(deleteReceivableRef(dcOrVars, vars));
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

const listAllCompaniesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllCompanies', inputVars);
}
listAllCompaniesRef.operationName = 'ListAllCompanies';
exports.listAllCompaniesRef = listAllCompaniesRef;

exports.listAllCompanies = function listAllCompanies(dcOrVars, vars) {
  return executeQuery(listAllCompaniesRef(dcOrVars, vars));
};

const listAllTeamsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllTeams', inputVars);
}
listAllTeamsRef.operationName = 'ListAllTeams';
exports.listAllTeamsRef = listAllTeamsRef;

exports.listAllTeams = function listAllTeams(dcOrVars, vars) {
  return executeQuery(listAllTeamsRef(dcOrVars, vars));
};

const listAllWorkersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllWorkers', inputVars);
}
listAllWorkersRef.operationName = 'ListAllWorkers';
exports.listAllWorkersRef = listAllWorkersRef;

exports.listAllWorkers = function listAllWorkers(dcOrVars, vars) {
  return executeQuery(listAllWorkersRef(dcOrVars, vars));
};

const listAllPositionsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllPositions', inputVars);
}
listAllPositionsRef.operationName = 'ListAllPositions';
exports.listAllPositionsRef = listAllPositionsRef;

exports.listAllPositions = function listAllPositions(dcOrVars, vars) {
  return executeQuery(listAllPositionsRef(dcOrVars, vars));
};

const listAllSitesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSites', inputVars);
}
listAllSitesRef.operationName = 'ListAllSites';
exports.listAllSitesRef = listAllSitesRef;

exports.listAllSites = function listAllSites(dcOrVars, vars) {
  return executeQuery(listAllSitesRef(dcOrVars, vars));
};

const listAllDailyReportsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllDailyReports', inputVars);
}
listAllDailyReportsRef.operationName = 'ListAllDailyReports';
exports.listAllDailyReportsRef = listAllDailyReportsRef;

exports.listAllDailyReports = function listAllDailyReports(dcOrVars, vars) {
  return executeQuery(listAllDailyReportsRef(dcOrVars, vars));
};

const listAllDailyReportWorkersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllDailyReportWorkers', inputVars);
}
listAllDailyReportWorkersRef.operationName = 'ListAllDailyReportWorkers';
exports.listAllDailyReportWorkersRef = listAllDailyReportWorkersRef;

exports.listAllDailyReportWorkers = function listAllDailyReportWorkers(dcOrVars, vars) {
  return executeQuery(listAllDailyReportWorkersRef(dcOrVars, vars));
};

const listAllAppUsersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAppUsers', inputVars);
}
listAllAppUsersRef.operationName = 'ListAllAppUsers';
exports.listAllAppUsersRef = listAllAppUsersRef;

exports.listAllAppUsers = function listAllAppUsers(dcOrVars, vars) {
  return executeQuery(listAllAppUsersRef(dcOrVars, vars));
};

const listAllMenuConfigsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllMenuConfigs', inputVars);
}
listAllMenuConfigsRef.operationName = 'ListAllMenuConfigs';
exports.listAllMenuConfigsRef = listAllMenuConfigsRef;

exports.listAllMenuConfigs = function listAllMenuConfigs(dcOrVars, vars) {
  return executeQuery(listAllMenuConfigsRef(dcOrVars, vars));
};

const listAllSystemLogsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSystemLogs', inputVars);
}
listAllSystemLogsRef.operationName = 'ListAllSystemLogs';
exports.listAllSystemLogsRef = listAllSystemLogsRef;

exports.listAllSystemLogs = function listAllSystemLogs(dcOrVars, vars) {
  return executeQuery(listAllSystemLogsRef(dcOrVars, vars));
};

const listAllAuditLogsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAuditLogs', inputVars);
}
listAllAuditLogsRef.operationName = 'ListAllAuditLogs';
exports.listAllAuditLogsRef = listAllAuditLogsRef;

exports.listAllAuditLogs = function listAllAuditLogs(dcOrVars, vars) {
  return executeQuery(listAllAuditLogsRef(dcOrVars, vars));
};

const listAllAgentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAgents', inputVars);
}
listAllAgentsRef.operationName = 'ListAllAgents';
exports.listAllAgentsRef = listAllAgentsRef;

exports.listAllAgents = function listAllAgents(dcOrVars, vars) {
  return executeQuery(listAllAgentsRef(dcOrVars, vars));
};

const listAllAgentConversationsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAgentConversations', inputVars);
}
listAllAgentConversationsRef.operationName = 'ListAllAgentConversations';
exports.listAllAgentConversationsRef = listAllAgentConversationsRef;

exports.listAllAgentConversations = function listAllAgentConversations(dcOrVars, vars) {
  return executeQuery(listAllAgentConversationsRef(dcOrVars, vars));
};

const listAllSettingsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSettings', inputVars);
}
listAllSettingsRef.operationName = 'ListAllSettings';
exports.listAllSettingsRef = listAllSettingsRef;

exports.listAllSettings = function listAllSettings(dcOrVars, vars) {
  return executeQuery(listAllSettingsRef(dcOrVars, vars));
};

const listAllSystemConfigsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSystemConfigs', inputVars);
}
listAllSystemConfigsRef.operationName = 'ListAllSystemConfigs';
exports.listAllSystemConfigsRef = listAllSystemConfigsRef;

exports.listAllSystemConfigs = function listAllSystemConfigs(dcOrVars, vars) {
  return executeQuery(listAllSystemConfigsRef(dcOrVars, vars));
};

const listAllAccommodationsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAccommodations', inputVars);
}
listAllAccommodationsRef.operationName = 'ListAllAccommodations';
exports.listAllAccommodationsRef = listAllAccommodationsRef;

exports.listAllAccommodations = function listAllAccommodations(dcOrVars, vars) {
  return executeQuery(listAllAccommodationsRef(dcOrVars, vars));
};

const listAllAccommodationAssignmentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAccommodationAssignments', inputVars);
}
listAllAccommodationAssignmentsRef.operationName = 'ListAllAccommodationAssignments';
exports.listAllAccommodationAssignmentsRef = listAllAccommodationAssignmentsRef;

exports.listAllAccommodationAssignments = function listAllAccommodationAssignments(dcOrVars, vars) {
  return executeQuery(listAllAccommodationAssignmentsRef(dcOrVars, vars));
};

const listAllUtilityRecordsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllUtilityRecords', inputVars);
}
listAllUtilityRecordsRef.operationName = 'ListAllUtilityRecords';
exports.listAllUtilityRecordsRef = listAllUtilityRecordsRef;

exports.listAllUtilityRecords = function listAllUtilityRecords(dcOrVars, vars) {
  return executeQuery(listAllUtilityRecordsRef(dcOrVars, vars));
};

const listAllAccommodationBillingDocumentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAccommodationBillingDocuments', inputVars);
}
listAllAccommodationBillingDocumentsRef.operationName = 'ListAllAccommodationBillingDocuments';
exports.listAllAccommodationBillingDocumentsRef = listAllAccommodationBillingDocumentsRef;

exports.listAllAccommodationBillingDocuments = function listAllAccommodationBillingDocuments(dcOrVars, vars) {
  return executeQuery(listAllAccommodationBillingDocumentsRef(dcOrVars, vars));
};

const listAllAccommodationBillingLineItemsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAccommodationBillingLineItems', inputVars);
}
listAllAccommodationBillingLineItemsRef.operationName = 'ListAllAccommodationBillingLineItems';
exports.listAllAccommodationBillingLineItemsRef = listAllAccommodationBillingLineItemsRef;

exports.listAllAccommodationBillingLineItems = function listAllAccommodationBillingLineItems(dcOrVars, vars) {
  return executeQuery(listAllAccommodationBillingLineItemsRef(dcOrVars, vars));
};

const listAllAdvancePaymentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAdvancePayments', inputVars);
}
listAllAdvancePaymentsRef.operationName = 'ListAllAdvancePayments';
exports.listAllAdvancePaymentsRef = listAllAdvancePaymentsRef;

exports.listAllAdvancePayments = function listAllAdvancePayments(dcOrVars, vars) {
  return executeQuery(listAllAdvancePaymentsRef(dcOrVars, vars));
};

const listAllSmartMemoCategoriesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSmartMemoCategories', inputVars);
}
listAllSmartMemoCategoriesRef.operationName = 'ListAllSmartMemoCategories';
exports.listAllSmartMemoCategoriesRef = listAllSmartMemoCategoriesRef;

exports.listAllSmartMemoCategories = function listAllSmartMemoCategories(dcOrVars, vars) {
  return executeQuery(listAllSmartMemoCategoriesRef(dcOrVars, vars));
};

const listAllSmartMemosRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSmartMemos', inputVars);
}
listAllSmartMemosRef.operationName = 'ListAllSmartMemos';
exports.listAllSmartMemosRef = listAllSmartMemosRef;

exports.listAllSmartMemos = function listAllSmartMemos(dcOrVars, vars) {
  return executeQuery(listAllSmartMemosRef(dcOrVars, vars));
};

const listAllVehiclesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllVehicles', inputVars);
}
listAllVehiclesRef.operationName = 'ListAllVehicles';
exports.listAllVehiclesRef = listAllVehiclesRef;

exports.listAllVehicles = function listAllVehicles(dcOrVars, vars) {
  return executeQuery(listAllVehiclesRef(dcOrVars, vars));
};

const listAllVehicleAssignmentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllVehicleAssignments', inputVars);
}
listAllVehicleAssignmentsRef.operationName = 'ListAllVehicleAssignments';
exports.listAllVehicleAssignmentsRef = listAllVehicleAssignmentsRef;

exports.listAllVehicleAssignments = function listAllVehicleAssignments(dcOrVars, vars) {
  return executeQuery(listAllVehicleAssignmentsRef(dcOrVars, vars));
};

const listAllVehicleExpensesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllVehicleExpenses', inputVars);
}
listAllVehicleExpensesRef.operationName = 'ListAllVehicleExpenses';
exports.listAllVehicleExpensesRef = listAllVehicleExpensesRef;

exports.listAllVehicleExpenses = function listAllVehicleExpenses(dcOrVars, vars) {
  return executeQuery(listAllVehicleExpensesRef(dcOrVars, vars));
};

const listAllVehicleBillingDocumentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllVehicleBillingDocuments', inputVars);
}
listAllVehicleBillingDocumentsRef.operationName = 'ListAllVehicleBillingDocuments';
exports.listAllVehicleBillingDocumentsRef = listAllVehicleBillingDocumentsRef;

exports.listAllVehicleBillingDocuments = function listAllVehicleBillingDocuments(dcOrVars, vars) {
  return executeQuery(listAllVehicleBillingDocumentsRef(dcOrVars, vars));
};

const listAllDailyDispatchesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllDailyDispatches', inputVars);
}
listAllDailyDispatchesRef.operationName = 'ListAllDailyDispatches';
exports.listAllDailyDispatchesRef = listAllDailyDispatchesRef;

exports.listAllDailyDispatches = function listAllDailyDispatches(dcOrVars, vars) {
  return executeQuery(listAllDailyDispatchesRef(dcOrVars, vars));
};

const listAllPaymentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllPayments', inputVars);
}
listAllPaymentsRef.operationName = 'ListAllPayments';
exports.listAllPaymentsRef = listAllPaymentsRef;

exports.listAllPayments = function listAllPayments(dcOrVars, vars) {
  return executeQuery(listAllPaymentsRef(dcOrVars, vars));
};

const listAllTaxInvoicesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllTaxInvoices', inputVars);
}
listAllTaxInvoicesRef.operationName = 'ListAllTaxInvoices';
exports.listAllTaxInvoicesRef = listAllTaxInvoicesRef;

exports.listAllTaxInvoices = function listAllTaxInvoices(dcOrVars, vars) {
  return executeQuery(listAllTaxInvoicesRef(dcOrVars, vars));
};

const listAllReceivablesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllReceivables', inputVars);
}
listAllReceivablesRef.operationName = 'ListAllReceivables';
exports.listAllReceivablesRef = listAllReceivablesRef;

exports.listAllReceivables = function listAllReceivables(dcOrVars, vars) {
  return executeQuery(listAllReceivablesRef(dcOrVars, vars));
};
