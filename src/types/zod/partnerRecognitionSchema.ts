import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';

export const PartnerRecognitionJobStatusSchema = z.enum([
    'draft',
    'uploading',
    'queued',
    'analyzing',
    'reviewing',
    'committing',
    'completed',
    'failed',
]);

export const PartnerRecognitionImageStatusSchema = z.enum([
    'uploaded',
    'analyzing',
    'completed',
    'failed',
]);

export const PartnerRecognitionResultStatusSchema = z.enum([
    'extracted',
    'auto_matched',
    'needs_review',
    'no_match',
    'excluded',
    'committed',
    'failed',
]);

export const CompanyRelationshipTypeSchema = z.string().trim().min(1);

export const PartnerSourceKindSchema = z.enum([
    'business_card',
    'company_document',
    'contact_screen',
    'participant_list',
    'unknown',
]);

export const RecognizedCompanyTypeGuessSchema = z.enum([
    '건설사',
    '협력사',
    '임대사',
    '자재사',
    '설계',
    '감리',
    '기타',
]);

export const ExtractedPartnerContactSchema = z.object({
    sourceKind: PartnerSourceKindSchema.default('unknown'),
    companyName: z.string().default(''),
    companyNameAliases: z.array(z.string()).default([]),
    businessNumber: z.string().default(''),
    personName: z.string().default(''),
    department: z.string().default(''),
    position: z.string().default(''),
    mobile: z.string().default(''),
    phone: z.string().default(''),
    fax: z.string().default(''),
    email: z.string().default(''),
    address: z.string().default(''),
    website: z.string().default(''),
    businessCategories: z.array(z.string()).default([]),
    companyTypeGuess: z.array(RecognizedCompanyTypeGuessSchema).default([]),
    memo: z.string().default(''),
    overallConfidence: z.number().min(0).max(1).default(0),
    warnings: z.array(z.string()).default([]),
    rawText: z.string().default(''),
});

export const CompanyMatchCandidateSchema = z.object({
    companyId: z.string(),
    companyName: z.string(),
    companyType: z.string().optional().nullable(),
    businessNumber: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    score: z.number(),
    reasons: z.array(z.string()).default([]),
});

export const PartnerRecognitionJobSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1),
    status: PartnerRecognitionJobStatusSchema,
    createdByUid: z.string().min(1),
    createdByName: z.string().optional().nullable(),
    baseCompanyId: z.string().optional().nullable(),
    baseCompanyName: z.string().optional().nullable(),
    defaultRelationshipType: CompanyRelationshipTypeSchema.optional().nullable(),
    defaultSiteId: z.string().optional().nullable(),
    defaultSiteName: z.string().optional().nullable(),
    processingMode: z.enum(['instant', 'batch']).optional().nullable(),
    geminiBatchName: z.string().optional().nullable(),
    geminiBatchState: z.string().optional().nullable(),
    geminiBatchModel: z.string().optional().nullable(),
    geminiBatchRequestCount: z.number().optional().nullable(),
    geminiBatchStats: z.record(z.unknown()).optional().nullable(),
    totalImages: z.number().default(0),
    processedImages: z.number().default(0),
    totalItems: z.number().default(0),
    autoMatchedItems: z.number().default(0),
    needsReviewItems: z.number().default(0),
    noMatchItems: z.number().default(0),
    excludedItems: z.number().default(0),
    committedItems: z.number().default(0),
    errorItems: z.number().default(0),
    errorMessage: z.string().optional().nullable(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
    startedAt: z.any().optional(),
    completedAt: z.any().optional(),
});

export const PartnerRecognitionImageSchema = z.object({
    id: z.string().optional(),
    jobId: z.string(),
    storagePath: z.string(),
    downloadUrl: z.string().optional().nullable(),
    originalFileName: z.string(),
    mimeType: z.string(),
    size: z.number(),
    width: z.number().optional().nullable(),
    height: z.number().optional().nullable(),
    status: PartnerRecognitionImageStatusSchema,
    resultCount: z.number().default(0),
    errorMessage: z.string().optional().nullable(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export const PartnerRecognitionResultSchema = z.object({
    id: z.string().optional(),
    jobId: z.string(),
    imageId: z.string(),
    imageStoragePath: z.string().optional().nullable(),
    imageDownloadUrl: z.string().optional().nullable(),
    status: PartnerRecognitionResultStatusSchema,
    extracted: ExtractedPartnerContactSchema,
    reviewed: ExtractedPartnerContactSchema.partial().default({}),
    selectedCompanyId: z.string().optional().nullable(),
    selectedCompanyName: z.string().optional().nullable(),
    matchScore: z.number().optional().nullable(),
    matchReasons: z.array(z.string()).default([]),
    candidates: z.array(CompanyMatchCandidateSchema).default([]),
    duplicateContactId: z.string().optional().nullable(),
    duplicateWarning: z.string().optional().nullable(),
    excludeReason: z.string().optional().nullable(),
    committedContactId: z.string().optional().nullable(),
    committedCardImageId: z.string().optional().nullable(),
    committedRelationshipId: z.string().optional().nullable(),
    errorMessage: z.string().optional().nullable(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type PartnerRecognitionJobZod = NormalizeNullable<z.input<typeof PartnerRecognitionJobSchema>>;
export type PartnerRecognitionImageZod = NormalizeNullable<z.input<typeof PartnerRecognitionImageSchema>>;
export type PartnerRecognitionResultZod = NormalizeNullable<z.input<typeof PartnerRecognitionResultSchema>>;
