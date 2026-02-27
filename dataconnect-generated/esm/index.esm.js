import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const Status = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
}

export const connectorConfig = {
  connector: 'example',
  service: 'cy-connect',
  location: 'asia-northeast3'
};

export const listAllCompaniesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllCompanies', inputVars);
}
listAllCompaniesRef.operationName = 'ListAllCompanies';

export function listAllCompanies(dcOrVars, vars) {
  return executeQuery(listAllCompaniesRef(dcOrVars, vars));
}

export const listAllTeamsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllTeams', inputVars);
}
listAllTeamsRef.operationName = 'ListAllTeams';

export function listAllTeams(dcOrVars, vars) {
  return executeQuery(listAllTeamsRef(dcOrVars, vars));
}

export const listAllWorkersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllWorkers', inputVars);
}
listAllWorkersRef.operationName = 'ListAllWorkers';

export function listAllWorkers(dcOrVars, vars) {
  return executeQuery(listAllWorkersRef(dcOrVars, vars));
}

export const listAllSitesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSites', inputVars);
}
listAllSitesRef.operationName = 'ListAllSites';

export function listAllSites(dcOrVars, vars) {
  return executeQuery(listAllSitesRef(dcOrVars, vars));
}

export const listAllPositionsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllPositions', inputVars);
}
listAllPositionsRef.operationName = 'ListAllPositions';

export function listAllPositions(dcOrVars, vars) {
  return executeQuery(listAllPositionsRef(dcOrVars, vars));
}

export const listAllDailyReportsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllDailyReports', inputVars);
}
listAllDailyReportsRef.operationName = 'ListAllDailyReports';

export function listAllDailyReports(dcOrVars, vars) {
  return executeQuery(listAllDailyReportsRef(dcOrVars, vars));
}

export const listAllDailyReportWorkersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllDailyReportWorkers', inputVars);
}
listAllDailyReportWorkersRef.operationName = 'ListAllDailyReportWorkers';

export function listAllDailyReportWorkers(dcOrVars, vars) {
  return executeQuery(listAllDailyReportWorkersRef(dcOrVars, vars));
}

export const listAllAppUsersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAppUsers', inputVars);
}
listAllAppUsersRef.operationName = 'ListAllAppUsers';

export function listAllAppUsers(dcOrVars, vars) {
  return executeQuery(listAllAppUsersRef(dcOrVars, vars));
}

export const listAllMenuConfigsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllMenuConfigs', inputVars);
}
listAllMenuConfigsRef.operationName = 'ListAllMenuConfigs';

export function listAllMenuConfigs(dcOrVars, vars) {
  return executeQuery(listAllMenuConfigsRef(dcOrVars, vars));
}

export const listAllSystemLogsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSystemLogs', inputVars);
}
listAllSystemLogsRef.operationName = 'ListAllSystemLogs';

export function listAllSystemLogs(dcOrVars, vars) {
  return executeQuery(listAllSystemLogsRef(dcOrVars, vars));
}

export const listAllAuditLogsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAuditLogs', inputVars);
}
listAllAuditLogsRef.operationName = 'ListAllAuditLogs';

export function listAllAuditLogs(dcOrVars, vars) {
  return executeQuery(listAllAuditLogsRef(dcOrVars, vars));
}

export const listAllAgentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAgents', inputVars);
}
listAllAgentsRef.operationName = 'ListAllAgents';

export function listAllAgents(dcOrVars, vars) {
  return executeQuery(listAllAgentsRef(dcOrVars, vars));
}

export const listAllAgentConversationsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAgentConversations', inputVars);
}
listAllAgentConversationsRef.operationName = 'ListAllAgentConversations';

export function listAllAgentConversations(dcOrVars, vars) {
  return executeQuery(listAllAgentConversationsRef(dcOrVars, vars));
}

export const listAllVehiclesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllVehicles', inputVars);
}
listAllVehiclesRef.operationName = 'ListAllVehicles';

export function listAllVehicles(dcOrVars, vars) {
  return executeQuery(listAllVehiclesRef(dcOrVars, vars));
}

export const listAllVehicleAssignmentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllVehicleAssignments', inputVars);
}
listAllVehicleAssignmentsRef.operationName = 'ListAllVehicleAssignments';

export function listAllVehicleAssignments(dcOrVars, vars) {
  return executeQuery(listAllVehicleAssignmentsRef(dcOrVars, vars));
}

export const listAllVehicleExpensesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllVehicleExpenses', inputVars);
}
listAllVehicleExpensesRef.operationName = 'ListAllVehicleExpenses';

export function listAllVehicleExpenses(dcOrVars, vars) {
  return executeQuery(listAllVehicleExpensesRef(dcOrVars, vars));
}

export const listAllVehicleBillingDocumentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllVehicleBillingDocuments', inputVars);
}
listAllVehicleBillingDocumentsRef.operationName = 'ListAllVehicleBillingDocuments';

export function listAllVehicleBillingDocuments(dcOrVars, vars) {
  return executeQuery(listAllVehicleBillingDocumentsRef(dcOrVars, vars));
}

export const listAllSettingsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSettings', inputVars);
}
listAllSettingsRef.operationName = 'ListAllSettings';

export function listAllSettings(dcOrVars, vars) {
  return executeQuery(listAllSettingsRef(dcOrVars, vars));
}

export const listAllSystemConfigsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSystemConfigs', inputVars);
}
listAllSystemConfigsRef.operationName = 'ListAllSystemConfigs';

export function listAllSystemConfigs(dcOrVars, vars) {
  return executeQuery(listAllSystemConfigsRef(dcOrVars, vars));
}

export const listAllAccommodationsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAccommodations', inputVars);
}
listAllAccommodationsRef.operationName = 'ListAllAccommodations';

export function listAllAccommodations(dcOrVars, vars) {
  return executeQuery(listAllAccommodationsRef(dcOrVars, vars));
}

export const listAllUtilityRecordsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllUtilityRecords', inputVars);
}
listAllUtilityRecordsRef.operationName = 'ListAllUtilityRecords';

export function listAllUtilityRecords(dcOrVars, vars) {
  return executeQuery(listAllUtilityRecordsRef(dcOrVars, vars));
}

export const listAllAccommodationAssignmentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAccommodationAssignments', inputVars);
}
listAllAccommodationAssignmentsRef.operationName = 'ListAllAccommodationAssignments';

export function listAllAccommodationAssignments(dcOrVars, vars) {
  return executeQuery(listAllAccommodationAssignmentsRef(dcOrVars, vars));
}

export const listAllAccommodationBillingDocumentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAccommodationBillingDocuments', inputVars);
}
listAllAccommodationBillingDocumentsRef.operationName = 'ListAllAccommodationBillingDocuments';

export function listAllAccommodationBillingDocuments(dcOrVars, vars) {
  return executeQuery(listAllAccommodationBillingDocumentsRef(dcOrVars, vars));
}

export const listAllAccommodationBillingLineItemsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAccommodationBillingLineItems', inputVars);
}
listAllAccommodationBillingLineItemsRef.operationName = 'ListAllAccommodationBillingLineItems';

export function listAllAccommodationBillingLineItems(dcOrVars, vars) {
  return executeQuery(listAllAccommodationBillingLineItemsRef(dcOrVars, vars));
}

export const listAllAdvancePaymentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllAdvancePayments', inputVars);
}
listAllAdvancePaymentsRef.operationName = 'ListAllAdvancePayments';

export function listAllAdvancePayments(dcOrVars, vars) {
  return executeQuery(listAllAdvancePaymentsRef(dcOrVars, vars));
}

export const listAllSmartMemoCategoriesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSmartMemoCategories', inputVars);
}
listAllSmartMemoCategoriesRef.operationName = 'ListAllSmartMemoCategories';

export function listAllSmartMemoCategories(dcOrVars, vars) {
  return executeQuery(listAllSmartMemoCategoriesRef(dcOrVars, vars));
}

export const listAllSmartMemosRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllSmartMemos', inputVars);
}
listAllSmartMemosRef.operationName = 'ListAllSmartMemos';

export function listAllSmartMemos(dcOrVars, vars) {
  return executeQuery(listAllSmartMemosRef(dcOrVars, vars));
}

export const listAllDailyDispatchesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllDailyDispatches', inputVars);
}
listAllDailyDispatchesRef.operationName = 'ListAllDailyDispatches';

export function listAllDailyDispatches(dcOrVars, vars) {
  return executeQuery(listAllDailyDispatchesRef(dcOrVars, vars));
}

export const listAllPaymentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllPayments', inputVars);
}
listAllPaymentsRef.operationName = 'ListAllPayments';

export function listAllPayments(dcOrVars, vars) {
  return executeQuery(listAllPaymentsRef(dcOrVars, vars));
}

export const listAllTaxInvoicesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllTaxInvoices', inputVars);
}
listAllTaxInvoicesRef.operationName = 'ListAllTaxInvoices';

export function listAllTaxInvoices(dcOrVars, vars) {
  return executeQuery(listAllTaxInvoicesRef(dcOrVars, vars));
}

export const listAllReceivablesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListAllReceivables', inputVars);
}
listAllReceivablesRef.operationName = 'ListAllReceivables';

export function listAllReceivables(dcOrVars, vars) {
  return executeQuery(listAllReceivablesRef(dcOrVars, vars));
}

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

export const createPaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreatePayment', inputVars);
}
createPaymentRef.operationName = 'CreatePayment';

export function createPayment(dcOrVars, vars) {
  return executeMutation(createPaymentRef(dcOrVars, vars));
}

export const createTaxInvoiceRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateTaxInvoice', inputVars);
}
createTaxInvoiceRef.operationName = 'CreateTaxInvoice';

export function createTaxInvoice(dcOrVars, vars) {
  return executeMutation(createTaxInvoiceRef(dcOrVars, vars));
}

export const createReceivableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateReceivable', inputVars);
}
createReceivableRef.operationName = 'CreateReceivable';

export function createReceivable(dcOrVars, vars) {
  return executeMutation(createReceivableRef(dcOrVars, vars));
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

export const updatePositionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdatePosition', inputVars);
}
updatePositionRef.operationName = 'UpdatePosition';

export function updatePosition(dcOrVars, vars) {
  return executeMutation(updatePositionRef(dcOrVars, vars));
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

export const updateAgentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAgent', inputVars);
}
updateAgentRef.operationName = 'UpdateAgent';

export function updateAgent(dcOrVars, vars) {
  return executeMutation(updateAgentRef(dcOrVars, vars));
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

export const updateAgentConversationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAgentConversation', inputVars);
}
updateAgentConversationRef.operationName = 'UpdateAgentConversation';

export function updateAgentConversation(dcOrVars, vars) {
  return executeMutation(updateAgentConversationRef(dcOrVars, vars));
}

export const createVehicleRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateVehicle', inputVars);
}
createVehicleRef.operationName = 'CreateVehicle';

export function createVehicle(dcOrVars, vars) {
  return executeMutation(createVehicleRef(dcOrVars, vars));
}

export const updateVehicleRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateVehicle', inputVars);
}
updateVehicleRef.operationName = 'UpdateVehicle';

export function updateVehicle(dcOrVars, vars) {
  return executeMutation(updateVehicleRef(dcOrVars, vars));
}

export const deleteVehicleRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteVehicle', inputVars);
}
deleteVehicleRef.operationName = 'DeleteVehicle';

export function deleteVehicle(dcOrVars, vars) {
  return executeMutation(deleteVehicleRef(dcOrVars, vars));
}

export const createVehicleAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateVehicleAssignment', inputVars);
}
createVehicleAssignmentRef.operationName = 'CreateVehicleAssignment';

export function createVehicleAssignment(dcOrVars, vars) {
  return executeMutation(createVehicleAssignmentRef(dcOrVars, vars));
}

export const updateVehicleAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateVehicleAssignment', inputVars);
}
updateVehicleAssignmentRef.operationName = 'UpdateVehicleAssignment';

export function updateVehicleAssignment(dcOrVars, vars) {
  return executeMutation(updateVehicleAssignmentRef(dcOrVars, vars));
}

export const createVehicleExpenseRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateVehicleExpense', inputVars);
}
createVehicleExpenseRef.operationName = 'CreateVehicleExpense';

export function createVehicleExpense(dcOrVars, vars) {
  return executeMutation(createVehicleExpenseRef(dcOrVars, vars));
}

export const deleteVehicleExpenseRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteVehicleExpense', inputVars);
}
deleteVehicleExpenseRef.operationName = 'DeleteVehicleExpense';

export function deleteVehicleExpense(dcOrVars, vars) {
  return executeMutation(deleteVehicleExpenseRef(dcOrVars, vars));
}

export const createVehicleBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateVehicleBillingDocument', inputVars);
}
createVehicleBillingDocumentRef.operationName = 'CreateVehicleBillingDocument';

export function createVehicleBillingDocument(dcOrVars, vars) {
  return executeMutation(createVehicleBillingDocumentRef(dcOrVars, vars));
}

export const updateVehicleBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateVehicleBillingDocument', inputVars);
}
updateVehicleBillingDocumentRef.operationName = 'UpdateVehicleBillingDocument';

export function updateVehicleBillingDocument(dcOrVars, vars) {
  return executeMutation(updateVehicleBillingDocumentRef(dcOrVars, vars));
}

export const createCardRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateCard', inputVars);
}
createCardRef.operationName = 'CreateCard';

export function createCard(dcOrVars, vars) {
  return executeMutation(createCardRef(dcOrVars, vars));
}

export const updateCardRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateCard', inputVars);
}
updateCardRef.operationName = 'UpdateCard';

export function updateCard(dcOrVars, vars) {
  return executeMutation(updateCardRef(dcOrVars, vars));
}

export const deleteCardRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteCard', inputVars);
}
deleteCardRef.operationName = 'DeleteCard';

export function deleteCard(dcOrVars, vars) {
  return executeMutation(deleteCardRef(dcOrVars, vars));
}

export const createCardAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateCardAssignment', inputVars);
}
createCardAssignmentRef.operationName = 'CreateCardAssignment';

export function createCardAssignment(dcOrVars, vars) {
  return executeMutation(createCardAssignmentRef(dcOrVars, vars));
}

export const updateCardAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateCardAssignment', inputVars);
}
updateCardAssignmentRef.operationName = 'UpdateCardAssignment';

export function updateCardAssignment(dcOrVars, vars) {
  return executeMutation(updateCardAssignmentRef(dcOrVars, vars));
}

export const createCardTransactionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateCardTransaction', inputVars);
}
createCardTransactionRef.operationName = 'CreateCardTransaction';

export function createCardTransaction(dcOrVars, vars) {
  return executeMutation(createCardTransactionRef(dcOrVars, vars));
}

export const deleteCardTransactionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteCardTransaction', inputVars);
}
deleteCardTransactionRef.operationName = 'DeleteCardTransaction';

export function deleteCardTransaction(dcOrVars, vars) {
  return executeMutation(deleteCardTransactionRef(dcOrVars, vars));
}

export const createCardBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateCardBillingDocument', inputVars);
}
createCardBillingDocumentRef.operationName = 'CreateCardBillingDocument';

export function createCardBillingDocument(dcOrVars, vars) {
  return executeMutation(createCardBillingDocumentRef(dcOrVars, vars));
}

export const updateCardBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateCardBillingDocument', inputVars);
}
updateCardBillingDocumentRef.operationName = 'UpdateCardBillingDocument';

export function updateCardBillingDocument(dcOrVars, vars) {
  return executeMutation(updateCardBillingDocumentRef(dcOrVars, vars));
}

export const deleteCardBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteCardBillingDocument', inputVars);
}
deleteCardBillingDocumentRef.operationName = 'DeleteCardBillingDocument';

export function deleteCardBillingDocument(dcOrVars, vars) {
  return executeMutation(deleteCardBillingDocumentRef(dcOrVars, vars));
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

export const updatePaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdatePayment', inputVars);
}
updatePaymentRef.operationName = 'UpdatePayment';

export function updatePayment(dcOrVars, vars) {
  return executeMutation(updatePaymentRef(dcOrVars, vars));
}

export const deletePaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeletePayment', inputVars);
}
deletePaymentRef.operationName = 'DeletePayment';

export function deletePayment(dcOrVars, vars) {
  return executeMutation(deletePaymentRef(dcOrVars, vars));
}

export const updateTaxInvoiceRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTaxInvoice', inputVars);
}
updateTaxInvoiceRef.operationName = 'UpdateTaxInvoice';

export function updateTaxInvoice(dcOrVars, vars) {
  return executeMutation(updateTaxInvoiceRef(dcOrVars, vars));
}

export const deleteTaxInvoiceRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteTaxInvoice', inputVars);
}
deleteTaxInvoiceRef.operationName = 'DeleteTaxInvoice';

export function deleteTaxInvoice(dcOrVars, vars) {
  return executeMutation(deleteTaxInvoiceRef(dcOrVars, vars));
}

export const updateReceivableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateReceivable', inputVars);
}
updateReceivableRef.operationName = 'UpdateReceivable';

export function updateReceivable(dcOrVars, vars) {
  return executeMutation(updateReceivableRef(dcOrVars, vars));
}

export const deleteReceivableRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteReceivable', inputVars);
}
deleteReceivableRef.operationName = 'DeleteReceivable';

export function deleteReceivable(dcOrVars, vars) {
  return executeMutation(deleteReceivableRef(dcOrVars, vars));
}

export const createFreelancerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'createFreelancer', inputVars);
}
createFreelancerRef.operationName = 'createFreelancer';

export function createFreelancer(dcOrVars, vars) {
  return executeMutation(createFreelancerRef(dcOrVars, vars));
}

export const updateFreelancerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'updateFreelancer', inputVars);
}
updateFreelancerRef.operationName = 'updateFreelancer';

export function updateFreelancer(dcOrVars, vars) {
  return executeMutation(updateFreelancerRef(dcOrVars, vars));
}

export const deleteFreelancerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'deleteFreelancer', inputVars);
}
deleteFreelancerRef.operationName = 'deleteFreelancer';

export function deleteFreelancer(dcOrVars, vars) {
  return executeMutation(deleteFreelancerRef(dcOrVars, vars));
}

export const createFreelancerPaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'createFreelancerPayment', inputVars);
}
createFreelancerPaymentRef.operationName = 'createFreelancerPayment';

export function createFreelancerPayment(dcOrVars, vars) {
  return executeMutation(createFreelancerPaymentRef(dcOrVars, vars));
}

export const updateFreelancerPaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'updateFreelancerPayment', inputVars);
}
updateFreelancerPaymentRef.operationName = 'updateFreelancerPayment';

export function updateFreelancerPayment(dcOrVars, vars) {
  return executeMutation(updateFreelancerPaymentRef(dcOrVars, vars));
}

export const deleteFreelancerPaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'deleteFreelancerPayment', inputVars);
}
deleteFreelancerPaymentRef.operationName = 'deleteFreelancerPayment';

export function deleteFreelancerPayment(dcOrVars, vars) {
  return executeMutation(deleteFreelancerPaymentRef(dcOrVars, vars));
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

export const createAccommodationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccommodation', inputVars);
}
createAccommodationRef.operationName = 'CreateAccommodation';

export function createAccommodation(dcOrVars, vars) {
  return executeMutation(createAccommodationRef(dcOrVars, vars));
}

export const updateAccommodationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAccommodation', inputVars);
}
updateAccommodationRef.operationName = 'UpdateAccommodation';

export function updateAccommodation(dcOrVars, vars) {
  return executeMutation(updateAccommodationRef(dcOrVars, vars));
}

export const deleteAccommodationRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAccommodation', inputVars);
}
deleteAccommodationRef.operationName = 'DeleteAccommodation';

export function deleteAccommodation(dcOrVars, vars) {
  return executeMutation(deleteAccommodationRef(dcOrVars, vars));
}

export const createUtilityRecordRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUtilityRecord', inputVars);
}
createUtilityRecordRef.operationName = 'CreateUtilityRecord';

export function createUtilityRecord(dcOrVars, vars) {
  return executeMutation(createUtilityRecordRef(dcOrVars, vars));
}

export const updateUtilityRecordRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateUtilityRecord', inputVars);
}
updateUtilityRecordRef.operationName = 'UpdateUtilityRecord';

export function updateUtilityRecord(dcOrVars, vars) {
  return executeMutation(updateUtilityRecordRef(dcOrVars, vars));
}

export const deleteUtilityRecordRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteUtilityRecord', inputVars);
}
deleteUtilityRecordRef.operationName = 'DeleteUtilityRecord';

export function deleteUtilityRecord(dcOrVars, vars) {
  return executeMutation(deleteUtilityRecordRef(dcOrVars, vars));
}

export const createAccommodationAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccommodationAssignment', inputVars);
}
createAccommodationAssignmentRef.operationName = 'CreateAccommodationAssignment';

export function createAccommodationAssignment(dcOrVars, vars) {
  return executeMutation(createAccommodationAssignmentRef(dcOrVars, vars));
}

export const updateAccommodationAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAccommodationAssignment', inputVars);
}
updateAccommodationAssignmentRef.operationName = 'UpdateAccommodationAssignment';

export function updateAccommodationAssignment(dcOrVars, vars) {
  return executeMutation(updateAccommodationAssignmentRef(dcOrVars, vars));
}

export const deleteAccommodationAssignmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAccommodationAssignment', inputVars);
}
deleteAccommodationAssignmentRef.operationName = 'DeleteAccommodationAssignment';

export function deleteAccommodationAssignment(dcOrVars, vars) {
  return executeMutation(deleteAccommodationAssignmentRef(dcOrVars, vars));
}

export const createAccommodationBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccommodationBillingDocument', inputVars);
}
createAccommodationBillingDocumentRef.operationName = 'CreateAccommodationBillingDocument';

export function createAccommodationBillingDocument(dcOrVars, vars) {
  return executeMutation(createAccommodationBillingDocumentRef(dcOrVars, vars));
}

export const updateAccommodationBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAccommodationBillingDocument', inputVars);
}
updateAccommodationBillingDocumentRef.operationName = 'UpdateAccommodationBillingDocument';

export function updateAccommodationBillingDocument(dcOrVars, vars) {
  return executeMutation(updateAccommodationBillingDocumentRef(dcOrVars, vars));
}

export const deleteAccommodationBillingDocumentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAccommodationBillingDocument', inputVars);
}
deleteAccommodationBillingDocumentRef.operationName = 'DeleteAccommodationBillingDocument';

export function deleteAccommodationBillingDocument(dcOrVars, vars) {
  return executeMutation(deleteAccommodationBillingDocumentRef(dcOrVars, vars));
}

export const createAccommodationBillingLineItemRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAccommodationBillingLineItem', inputVars);
}
createAccommodationBillingLineItemRef.operationName = 'CreateAccommodationBillingLineItem';

export function createAccommodationBillingLineItem(dcOrVars, vars) {
  return executeMutation(createAccommodationBillingLineItemRef(dcOrVars, vars));
}

export const deleteAccommodationBillingLineItemRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAccommodationBillingLineItem', inputVars);
}
deleteAccommodationBillingLineItemRef.operationName = 'DeleteAccommodationBillingLineItem';

export function deleteAccommodationBillingLineItem(dcOrVars, vars) {
  return executeMutation(deleteAccommodationBillingLineItemRef(dcOrVars, vars));
}

export const createAdvancePaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAdvancePayment', inputVars);
}
createAdvancePaymentRef.operationName = 'CreateAdvancePayment';

export function createAdvancePayment(dcOrVars, vars) {
  return executeMutation(createAdvancePaymentRef(dcOrVars, vars));
}

export const updateAdvancePaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAdvancePayment', inputVars);
}
updateAdvancePaymentRef.operationName = 'UpdateAdvancePayment';

export function updateAdvancePayment(dcOrVars, vars) {
  return executeMutation(updateAdvancePaymentRef(dcOrVars, vars));
}

export const deleteAdvancePaymentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAdvancePayment', inputVars);
}
deleteAdvancePaymentRef.operationName = 'DeleteAdvancePayment';

export function deleteAdvancePayment(dcOrVars, vars) {
  return executeMutation(deleteAdvancePaymentRef(dcOrVars, vars));
}

export const createSmartMemoCategoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSmartMemoCategory', inputVars);
}
createSmartMemoCategoryRef.operationName = 'CreateSmartMemoCategory';

export function createSmartMemoCategory(dcOrVars, vars) {
  return executeMutation(createSmartMemoCategoryRef(dcOrVars, vars));
}

export const updateSmartMemoCategoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSmartMemoCategory', inputVars);
}
updateSmartMemoCategoryRef.operationName = 'UpdateSmartMemoCategory';

export function updateSmartMemoCategory(dcOrVars, vars) {
  return executeMutation(updateSmartMemoCategoryRef(dcOrVars, vars));
}

export const deleteSmartMemoCategoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteSmartMemoCategory', inputVars);
}
deleteSmartMemoCategoryRef.operationName = 'DeleteSmartMemoCategory';

export function deleteSmartMemoCategory(dcOrVars, vars) {
  return executeMutation(deleteSmartMemoCategoryRef(dcOrVars, vars));
}

export const createSmartMemoRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateSmartMemo', inputVars);
}
createSmartMemoRef.operationName = 'CreateSmartMemo';

export function createSmartMemo(dcOrVars, vars) {
  return executeMutation(createSmartMemoRef(dcOrVars, vars));
}

export const updateSmartMemoRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSmartMemo', inputVars);
}
updateSmartMemoRef.operationName = 'UpdateSmartMemo';

export function updateSmartMemo(dcOrVars, vars) {
  return executeMutation(updateSmartMemoRef(dcOrVars, vars));
}

export const deleteSmartMemoRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteSmartMemo', inputVars);
}
deleteSmartMemoRef.operationName = 'DeleteSmartMemo';

export function deleteSmartMemo(dcOrVars, vars) {
  return executeMutation(deleteSmartMemoRef(dcOrVars, vars));
}

export const createDailyDispatchRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateDailyDispatch', inputVars);
}
createDailyDispatchRef.operationName = 'CreateDailyDispatch';

export function createDailyDispatch(dcOrVars, vars) {
  return executeMutation(createDailyDispatchRef(dcOrVars, vars));
}

export const updateDailyDispatchRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateDailyDispatch', inputVars);
}
updateDailyDispatchRef.operationName = 'UpdateDailyDispatch';

export function updateDailyDispatch(dcOrVars, vars) {
  return executeMutation(updateDailyDispatchRef(dcOrVars, vars));
}

export const deleteDailyDispatchRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteDailyDispatch', inputVars);
}
deleteDailyDispatchRef.operationName = 'DeleteDailyDispatch';

export function deleteDailyDispatch(dcOrVars, vars) {
  return executeMutation(deleteDailyDispatchRef(dcOrVars, vars));
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

