export interface VehicleTollUsageAnalysis {
    fileIndex: number;
    entryIndex: number;
    originalFileName: string;
    sourceSha256?: string;
    fileNameVehicleSuffix: string;
    provider: string;
    licensePlate: string;
    licensePlateCandidates: string[];
    transactionDate: string;
    transactionTime: string;
    transactionDateTime: string;
    entryTollgate: string;
    exitTollgate: string;
    routeName: string;
    transactionNumber: string;
    approvalNumber: string;
    statementPeriod: string;
    totalCount: number;
    cardNumber: string;
    amount: number;
    confidence: number;
    warnings: string[];
    dedupeKey: string;
    duplicate: boolean;
    existingExpenseId: string;
}

export interface AnalyzeVehicleTollFileInput {
    fileIndex: number;
    originalFileName: string;
    mimeType: string;
    base64: string;
}

export interface AnalyzeVehicleTollUsagesInput {
    files: AnalyzeVehicleTollFileInput[];
}

export interface AnalyzeVehicleTollUsagesResult {
    ok: boolean;
    model: string;
    usages: VehicleTollUsageAnalysis[];
}

export interface VehicleTollAnalysisProgress {
    completedFiles: number;
    totalFiles: number;
    currentFileName: string;
}

export interface CommitVehicleTollImportItem {
    fileIndex: number;
    entryIndex: number;
    vehicleId: string;
    manualMatch: boolean;
    expenseDate: string;
    amount: number;
    analysis: VehicleTollUsageAnalysis;
}

export interface CommitVehicleTollImportsInput {
    operationId: string;
    items: CommitVehicleTollImportItem[];
}

export type VehicleTollCommitStatus = 'created' | 'duplicate';

export interface VehicleTollCommitResultItem {
    fileIndex: number;
    entryIndex: number;
    expenseId: string;
    status: VehicleTollCommitStatus;
}

export interface CommitVehicleTollImportsResult {
    ok: boolean;
    operationId: string;
    createdCount: number;
    duplicateCount: number;
    results: VehicleTollCommitResultItem[];
}
