export interface AccommodationElectricityBillAnalysis {
    fileIndex: number;
    originalFileName: string;
    sourceFileSha256?: string;
    provider: string;
    customerName: string;
    customerNumber: string;
    billingYearMonth: string;
    dueDate: string;
    usagePeriodStart: string;
    usagePeriodEnd: string;
    address: string;
    housingName: string;
    electricityAmount: number;
    usageKwh: number;
    confidence: number;
    warnings: string[];
}

export type AccommodationUtilityBillType = 'electricity' | 'gas' | 'water';

export interface AccommodationGasBillAnalysis {
    fileIndex: number;
    originalFileName: string;
    sourceFileSha256?: string;
    provider: string;
    customerName: string;
    payerNumber: string;
    billingYearMonth: string;
    dueDate: string;
    usagePeriodStart: string;
    usagePeriodEnd: string;
    address: string;
    housingName: string;
    gasAmount: number;
    usageCubicMeters: number;
    confidence: number;
    warnings: string[];
}

export interface AccommodationWaterBillAnalysis {
    fileIndex: number;
    originalFileName: string;
    sourceFileSha256?: string;
    provider: string;
    customerName: string;
    consumerNumber: string;
    billingYearMonth: string;
    dueDate: string;
    usagePeriodStart: string;
    usagePeriodEnd: string;
    address: string;
    housingName: string;
    waterAmount: number;
    usageCubicMeters: number;
    confidence: number;
    warnings: string[];
}

export interface AccommodationElectricityBillMatchCandidate {
    accommodationId: string;
    accommodationName: string;
    accommodationAddress: string;
    score: number;
    addressScore: number;
    reasons: string[];
}

export interface AccommodationElectricityBillMatchResult {
    selectedAccommodationId: string;
    confidence: number;
    status: 'auto_matched' | 'needs_review' | 'no_match';
    candidates: AccommodationElectricityBillMatchCandidate[];
    warnings: string[];
}

export interface UtilityElectricityBillImportMeta {
    sourceFileName: string;
    sourceFileSha256?: string;
    provider: string;
    customerNumber: string;
    billingYearMonth: string;
    dueDate: string;
    usagePeriodStart: string;
    usagePeriodEnd: string;
    address: string;
    housingName: string;
    usageKwh: number;
    confidence: number;
    analyzedAt: string;
}

export interface UtilityGasBillImportMeta {
    sourceFileName: string;
    sourceFileSha256?: string;
    provider: string;
    payerNumber: string;
    billingYearMonth: string;
    dueDate: string;
    usagePeriodStart: string;
    usagePeriodEnd: string;
    address: string;
    housingName: string;
    usageCubicMeters: number;
    confidence: number;
    analyzedAt: string;
}

export interface UtilityWaterBillImportMeta {
    sourceFileName: string;
    sourceFileSha256?: string;
    provider: string;
    consumerNumber: string;
    billingYearMonth: string;
    dueDate: string;
    usagePeriodStart: string;
    usagePeriodEnd: string;
    address: string;
    housingName: string;
    usageCubicMeters: number;
    confidence: number;
    analyzedAt: string;
}

export interface AccommodationElectricityBillApplyItem {
    utilityType: 'electricity';
    fileIndex: number;
    recordId: string;
    accommodationId: string;
    electricityAmount: number;
    meta: UtilityElectricityBillImportMeta;
}

export interface AccommodationGasBillApplyItem {
    utilityType: 'gas';
    fileIndex: number;
    recordId: string;
    accommodationId: string;
    gasAmount: number;
    meta: UtilityGasBillImportMeta;
}

export interface AccommodationWaterBillApplyItem {
    utilityType: 'water';
    fileIndex: number;
    recordId: string;
    accommodationId: string;
    waterAmount: number;
    meta: UtilityWaterBillImportMeta;
}

export type AccommodationUtilityBillApplyItem =
    | AccommodationElectricityBillApplyItem
    | AccommodationGasBillApplyItem
    | AccommodationWaterBillApplyItem;

export interface AnalyzeAccommodationElectricityBillFileInput {
    fileIndex: number;
    originalFileName: string;
    mimeType: string;
    base64: string;
    sourceFileSha256?: string;
}

export interface AnalyzeAccommodationElectricityBillsInput {
    yearMonth: string;
    files: AnalyzeAccommodationElectricityBillFileInput[];
}

export interface AnalyzeAccommodationElectricityBillsResult {
    ok: boolean;
    model: string;
    bills: AccommodationElectricityBillAnalysis[];
}

export interface AnalyzeAccommodationGasBillsInput {
    yearMonth: string;
    files: AnalyzeAccommodationElectricityBillFileInput[];
}

export interface AnalyzeAccommodationGasBillsResult {
    ok: boolean;
    model: string;
    bills: AccommodationGasBillAnalysis[];
}

export interface AnalyzeAccommodationWaterBillsInput {
    yearMonth: string;
    files: AnalyzeAccommodationElectricityBillFileInput[];
}

export interface AnalyzeAccommodationWaterBillsResult {
    ok: boolean;
    model: string;
    bills: AccommodationWaterBillAnalysis[];
}

export interface AccommodationElectricityBillAnalysisProgress {
    completedFiles: number;
    totalFiles: number;
    currentFileName: string;
}
