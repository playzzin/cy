export type VehicleFineNoticeType = 'PARKING_FINE' | 'TRAFFIC_FINE' | 'OTHER';
export type VehicleFinePlateSource = 'VIOLATION_VEHICLE' | 'CHARGED_VEHICLE' | 'PLATE_IMAGE' | 'UNKNOWN';

export interface VehicleFineNoticeAnalysis {
    fileIndex: number;
    originalFileName: string;
    issuer: string;
    noticeType: VehicleFineNoticeType;
    violationVehiclePlate?: string;
    chargedTargetPlate?: string;
    plateImagePlate?: string;
    licensePlate: string;
    licensePlateCandidates?: string[];
    plateSource?: VehicleFinePlateSource;
    plateEvidence?: string;
    plateConfidence?: number;
    violationDateTime: string;
    violationDate: string;
    violationLocation: string;
    violationDescription: string;
    dueDate: string;
    noticeNumber: string;
    electronicPaymentNumber: string;
    originalAmount: number;
    reductionAmount: number;
    payableAmount: number;
    driverPenaltyAmount: number;
    ownerFineAmount: number;
    confidence: number;
    warnings: string[];
    dedupeKey: string;
    duplicate: boolean;
    existingExpenseId: string;
}

export interface AnalyzeVehicleFineFileInput {
    fileIndex: number;
    originalFileName: string;
    mimeType: string;
    base64: string;
}

export interface AnalyzeVehicleFineNoticesInput {
    files: AnalyzeVehicleFineFileInput[];
    vehiclePlates?: string[];
}

export interface AnalyzeVehicleFineNoticesResult {
    ok: boolean;
    model: string;
    notices: VehicleFineNoticeAnalysis[];
}

export interface VehicleFineAnalysisProgress {
    completedFiles: number;
    totalFiles: number;
    currentFileName: string;
}

export interface CommitVehicleFineImportItem {
    fileIndex: number;
    vehicleId: string;
    manualMatch: boolean;
    expenseDate: string;
    payableAmount: number;
    analysis: VehicleFineNoticeAnalysis;
}

export interface CommitVehicleFineImportsInput {
    operationId: string;
    items: CommitVehicleFineImportItem[];
}

export type VehicleFineCommitStatus = 'created' | 'duplicate';

export interface VehicleFineCommitResultItem {
    fileIndex: number;
    expenseId: string;
    status: VehicleFineCommitStatus;
}

export interface CommitVehicleFineImportsResult {
    ok: boolean;
    operationId: string;
    createdCount: number;
    duplicateCount: number;
    results: VehicleFineCommitResultItem[];
}
