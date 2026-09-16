import * as admin from 'firebase-admin';

// Firebase Admin 초기화
admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });

export { setSmartMemoReminder, dispatchSmartMemoReminders } from './smartMemoReminders';
export { notifyTaskChanges } from './taskNotifications';

export {
    createWelfareLedgerTransaction,
    deleteWelfareCategory,
    getWelfareGameConfig,
    playWelfarePointGame,
    saveWelfareAdminPermissions,
    saveWelfareGameConfig,
    seedWelfareAssetMasters,
    upsertWelfareCategory,
} from './services/welfareAssetLedger';
export {
    analyzePartnerRecognitionJob,
    commitPartnerRecognitionResults,
    createPartnerRecognitionBatchJob,
    rematchPartnerRecognitionResult,
    syncPartnerRecognitionBatchJob,
} from './partnerRecognition';
export {
    analyzeCardBillingStatement,
    analyzeCardStatementImportJob,
    cancelCardStatementImportUploadSession,
    cancelCardStatementImportFile,
    commitCardStatementImportJob,
    completeCardStatementImportUpload,
    createCardStatementImportJob,
    createCardStatementImportUploadSession,
    getCardStatementImportJobStatus,
    processCardStatementImportJobAnalysis,
    recoverCardStatementImportJobAnalysis,
    updateCardStatementImportResultReview,
} from './cardBillingStatementAnalysis';
export {
    getCardExpenseAuditDashboard,
    reviewCardExpenseAuditFinding,
    runCardExpenseAudit,
    saveCardExpenseAuditPolicy,
} from './cardExpenseAudit';
export {
    getServerAiSettingsStatus,
    saveServerAiSettings,
} from './serverAiSettings';
export {
    analyzeAccommodationElectricityBills,
    analyzeAccommodationGasBills,
    analyzeAccommodationWaterBills,
} from './accommodationElectricityBillAnalysis';
export {
    analyzeVehicleFineNotices,
    commitVehicleFineImports,
} from './vehicleFineAnalysis';
export {
    analyzeVehicleTollUsages,
    commitVehicleTollImports,
} from './vehicleTollAnalysis';
export {
    analyzeIdentityDocuments,
} from './identityDocumentAnalysis';
export {
    syncAllUserAccessClaims,
    syncUserAccessClaims,
    syncUserAccessClaimsOnUserWrite,
} from './roleClaims';
export {
    approveAccountLinkRequest,
    getMyAccountLinkCandidate,
    getMyAccountLinkStatus,
    linkAccountConnection,
    rejectAccountLinkRequest,
    revokeUserAccessApproval,
    searchAccountLinkCompanies,
    submitAccountLinkRequest,
    unlinkAccountConnection,
    updateUserAccess,
} from './accountAccess';
export {
    ingestBankProviderWebhook,
    ingestBankSms,
    monitorBankNotificationHealth,
    processBankNotificationOutbox,
    reprocessBankSmsCandidate,
} from './bankNotifications';
export {
    cloneConstructionPlanServer,
    createConstructionPlanReviewCommentServer,
    createConstructionPlanDraftServer,
    createConstructionPlanRevisionServer,
    ensureConstructionPlanDrawingPreviewServer,
    getConstructionPlanLineageServer,
    getConstructionPlanSafeWorkers,
    issueConstructionPlanServer,
    listConstructionPlansServer,
    migrateConstructionPlanTemplateBindingServer,
    monitorConstructionPlanPdfRenderOperationsScheduled,
    listConstructionPlanReviewCommentsServer,
    listConstructionPlanReviewMessagesServer,
    listConstructionPlanReviewPackagesServer,
    prepareConstructionPlanIssuedPdfServer,
    replyConstructionPlanReviewCommentServer,
    reviewConstructionPlanServer,
    transitionConstructionPlanReviewCommentServer,
    cleanupConstructionPlanDrawingUploadsScheduled,
    finalizeConstructionPlanDrawingUploadServer,
    startConstructionPlanDrawingUploadServer,
    cleanupConstructionPlanDrawingReuseScheduled,
    getConstructionPlanDrawingReuseDerivationStatusServer,
    importConstructionPlanDrawingFromLibraryServer,
    listConstructionPlanDrawingLibraryServer,
    initializeConstructionPlanTemplateServer,
    listConstructionPlanTemplatesServer,
    transitionConstructionPlanTemplateLifecycleServer,
    confirmConstructionPlanRecordServer,
    createConstructionPlanRecordCorrectionServer,
    createConstructionPlanRecordServer,
    generateConstructionPlanRecordAppendixPdfServer,
    getConstructionPlanRecordServer,
    listConstructionPlanRecordsServer,
    updateConstructionPlanRecordServer,
    cancelConstructionPlanRecordPhotoUploadServer,
    cleanupConstructionPlanRecordPhotoUploadsScheduled,
    finalizeConstructionPlanRecordPhotoUploadServer,
    startConstructionPlanRecordPhotoUploadServer,
    applyConstructionPlanErpSnapshotFieldsServer,
    auditConstructionPlanAutosaveOnUpdate,
    getConstructionPlanLatestErpSnapshotServer,
    getConstructionPlanMapSnapshotServer,
    cleanupExpiredConstructionPlanLocksScheduled,
    completeConstructionPlanIssuedPdfDownloadServer,
    forceReleaseConstructionPlanLockServer,
    getConstructionPlanControlCapabilitiesServer,
    prepareConstructionPlanIssuedPdfDownloadServer,
    requestConstructionPlanUnlockServer,
    transitionConstructionPlanLifecycleServer,
} from './constructionPlans';
export { planExcelConversion, getExcelConversionStatus } from './excelConversionPlanning';
export { analyzeExcelStructure } from './excelStructurePlanning';
