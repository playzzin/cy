import type { Timestamp } from 'firebase/firestore';

export const PARTNER_RECOGNITION_COLLECTIONS = {
    jobs: 'partnerRecognitionJobs',
    images: 'partnerRecognitionImages',
    results: 'partnerRecognitionResults',
    contacts: 'businessContacts',
    cardImages: 'businessCardImages',
    contactHistories: 'businessContactHistories',
    followUps: 'businessContactFollowUps',
    relationships: 'companyRelationships',
    companyRequests: 'companyMasterRequests',
} as const;

export type PartnerRecognitionJobStatus =
    | 'draft'
    | 'uploading'
    | 'queued'
    | 'analyzing'
    | 'reviewing'
    | 'committing'
    | 'completed'
    | 'failed';

export type PartnerRecognitionImageStatus =
    | 'uploaded'
    | 'analyzing'
    | 'completed'
    | 'failed';

export type PartnerRecognitionResultStatus =
    | 'extracted'
    | 'auto_matched'
    | 'needs_review'
    | 'no_match'
    | 'excluded'
    | 'committed'
    | 'failed';

export type PartnerSourceKind =
    | 'business_card'
    | 'company_document'
    | 'contact_screen'
    | 'participant_list'
    | 'unknown';

export type RecognizedCompanyTypeGuess =
    | '건설사'
    | '협력사'
    | '임대사'
    | '자재사'
    | '설계'
    | '감리'
    | '기타';

export type CompanyRelationshipType = string;

export type CompanyRelationshipStatus = 'active' | 'inactive' | 'ended';

export interface PartnerRecognitionJob {
    id?: string;
    title: string;
    status: PartnerRecognitionJobStatus;
    createdByUid: string;
    createdByName?: string;
    baseCompanyId?: string;
    baseCompanyName?: string;
    defaultRelationshipType?: CompanyRelationshipType;
    defaultSiteId?: string;
    defaultSiteName?: string;
    processingMode?: 'instant' | 'batch';
    geminiBatchName?: string;
    geminiBatchState?: string;
    geminiBatchModel?: string;
    geminiBatchRequestCount?: number;
    geminiBatchStats?: Record<string, unknown>;
    totalImages: number;
    processedImages: number;
    totalItems: number;
    autoMatchedItems: number;
    needsReviewItems: number;
    noMatchItems: number;
    excludedItems: number;
    committedItems: number;
    errorItems: number;
    errorMessage?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
}

export interface PartnerRecognitionImage {
    id?: string;
    jobId: string;
    storagePath: string;
    downloadUrl?: string;
    originalFileName: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
    rotationApplied?: 0 | 90 | 180 | 270;
    orientationNormalized?: boolean;
    status: PartnerRecognitionImageStatus;
    resultCount: number;
    errorMessage?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface ExtractedPartnerContact {
    sourceKind: PartnerSourceKind;
    companyName: string;
    companyNameAliases: string[];
    businessNumber: string;
    personName: string;
    department: string;
    position: string;
    mobile: string;
    phone: string;
    fax: string;
    email: string;
    address: string;
    website: string;
    businessCategories: string[];
    companyTypeGuess: RecognizedCompanyTypeGuess[];
    memo: string;
    overallConfidence: number;
    warnings: string[];
    rawText: string;
}

export interface CompanyMatchCandidate {
    companyId: string;
    companyName: string;
    companyType?: string;
    businessNumber?: string;
    phone?: string;
    address?: string;
    score: number;
    reasons: string[];
}

export interface PartnerRecognitionResult {
    id?: string;
    jobId: string;
    imageId: string;
    imageStoragePath?: string;
    imageDownloadUrl?: string;
    status: PartnerRecognitionResultStatus;
    extracted: ExtractedPartnerContact;
    reviewed: Partial<ExtractedPartnerContact>;
    selectedCompanyId?: string;
    selectedCompanyName?: string;
    matchScore?: number;
    matchReasons: string[];
    candidates: CompanyMatchCandidate[];
    duplicateContactId?: string;
    duplicateWarning?: string;
    excludeReason?: string;
    committedContactId?: string;
    committedCardImageId?: string;
    committedRelationshipId?: string;
    errorMessage?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface PartnerRecognitionReviewPatch {
    reviewed?: Partial<ExtractedPartnerContact>;
    selectedCompanyId?: string;
    selectedCompanyName?: string;
    status?: PartnerRecognitionResultStatus;
    excludeReason?: string;
}

export interface BusinessContact {
    id?: string;
    companyId: string;
    companyName: string;
    name: string;
    department?: string;
    position?: string;
    mobile?: string;
    phone?: string;
    email?: string;
    memo?: string;
    tags: string[];
    source: 'photo_recognition' | 'manual' | 'migration';
    sourceJobId?: string;
    sourceResultId?: string;
    createdByUid: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export type ContactHistoryType =
    | 'call'
    | 'meeting'
    | 'quote'
    | 'contract'
    | 'claim'
    | 'memo'
    | 'other';

export interface BusinessContactHistory {
    id?: string;
    contactId: string;
    companyId: string;
    companyName: string;
    type: ContactHistoryType;
    title: string;
    content: string;
    happenedAt: string;
    createdByUid: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface BusinessContactFollowUp {
    id?: string;
    contactId: string;
    companyId: string;
    companyName: string;
    title: string;
    dueDate: string;
    status: 'open' | 'done' | 'cancelled';
    memo?: string;
    createdByUid: string;
    completedAt?: Timestamp;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface BusinessCardImage {
    id?: string;
    companyId: string;
    contactId?: string;
    jobId: string;
    imageId: string;
    resultId: string;
    storagePath: string;
    downloadUrl?: string;
    extractedRawText?: string;
    createdByUid: string;
    createdAt?: Timestamp;
}

export interface CompanyRelationship {
    id?: string;
    sourceCompanyId: string;
    sourceCompanyName: string;
    targetCompanyId: string;
    targetCompanyName: string;
    relationshipType: CompanyRelationshipType;
    tradeCategory?: string;
    siteId?: string;
    siteName?: string;
    status: CompanyRelationshipStatus;
    sourceJobId?: string;
    sourceResultId?: string;
    memo?: string;
    createdByUid: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface CompanyMasterRequest {
    id?: string;
    jobId: string;
    resultId: string;
    requestedCompanyName: string;
    extracted: ExtractedPartnerContact;
    status: 'pending' | 'approved' | 'rejected' | 'merged';
    approvedCompanyId?: string;
    reviewedByUid?: string;
    createdByUid: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface PartnerRecognitionCommitResult {
    committed: number;
    skipped: number;
    failed: number;
    errors?: Array<{ resultId: string; message: string }>;
}
