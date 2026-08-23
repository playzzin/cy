export type IdentityDocumentType =
  | 'RESIDENT_CARD'
  | 'DRIVERS_LICENSE'
  | 'PASSPORT'
  | 'SAFETY_EDUCATION'
  | 'SCAFFOLD_TRAINING'
  | 'FOREIGN_REGISTRATION'
  | 'CONSTRUCTION_WORKER_CARD'
  | 'OTHER_ID';

export type IdentityAnalysisStatus = 'queued' | 'analyzing' | 'completed' | 'failed';

export interface IdentityCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IdentityPoint {
  x: number;
  y: number;
}

/** Four document corners in top-left, top-right, bottom-right, bottom-left order. */
export type IdentityPerspectiveQuad = [IdentityPoint, IdentityPoint, IdentityPoint, IdentityPoint];

export type IdentityCorrectionMode = 'AUTO' | 'MANUAL' | 'ORIGINAL';

export interface IdentityDocumentAnalysis {
  fileIndex: number;
  originalFileName: string;
  personName: string;
  birthDate: string;
  identityNumber: string;
  address: string;
  nationality: string;
  documentNumber: string;
  expirationDate: string;
  identityHash: string;
  documentType: IdentityDocumentType;
  documentLabel: string;
  crop: IdentityCropBox;
  correctionMode?: IdentityCorrectionMode;
  perspectiveQuad?: IdentityPerspectiveQuad;
  confidence: number;
  matchingConfidence: number;
  warnings: string[];
}

export interface AnalyzeIdentityDocumentFileInput {
  fileIndex: number;
  originalFileName: string;
  mimeType: string;
  base64: string;
}

export interface AnalyzeIdentityDocumentsInput {
  sessionId: string;
  files: AnalyzeIdentityDocumentFileInput[];
  mode?: 'GROUPING' | 'REGISTRATION';
}

export interface AnalyzeIdentityDocumentsResult {
  ok: boolean;
  model: string;
  documents?: IdentityDocumentAnalysis[];
  registration?: IdentityRegistrationAnalysis;
}

export interface IdentityRegistrationAnalysis {
  name: string;
  idNumber: string;
  address: string;
}

export interface IdentityAnalysisProgress {
  completedFiles: number;
  totalFiles: number;
  currentFileNames: string[];
}

export interface IdentityUploadItem {
  id: string;
  file: File;
  previewUrl: string;
  status: IdentityAnalysisStatus;
  analysis?: IdentityDocumentAnalysis;
  error?: string;
}

export interface IdentityPersonGroup {
  id: string;
  personName: string;
  birthDate: string;
  identityHash: string;
  documents: IdentityDocumentAnalysis[];
  requiresReview: boolean;
  reviewReasons: string[];
}

export type IdentityOutputPreset = 'A4_300' | 'A4_150' | 'MOBILE';

export interface IdentityBundleOutputOptions {
  preset: IdentityOutputPreset;
  includeHeader: boolean;
  jpegQuality: number;
}
