import * as admin from 'firebase-admin';

// Firebase Admin 초기화
admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });

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
    syncAllUserAccessClaims,
    syncUserAccessClaims,
    syncUserAccessClaimsOnUserWrite,
} from './roleClaims';
export {
    ingestBankProviderWebhook,
    ingestBankSms,
    monitorBankNotificationHealth,
    processBankNotificationOutbox,
    reprocessBankSmsCandidate,
} from './bankNotifications';
