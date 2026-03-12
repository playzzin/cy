import { z } from 'zod';

// --- Card Enums ---
export const CardTypeSchema = z.enum(['CREDIT', 'CHECK']);
export const CardStatusSchema = z.enum(['AVAILABLE', 'ASSIGNED', 'SUSPENDED', 'CLOSED']);
export const CardAssigneeTypeSchema = z.enum(['TEAM', 'WORKER']);

// --- Card Transaction Enum ---
export const CardTransactionCategorySchema = z.enum(['FUEL', 'TOLL', 'MEAL', 'MATERIAL', 'OTHER']);

// --- Card Billing Enum ---
export const CardBillingStatusSchema = z.enum(['DRAFT', 'CONFIRMED', 'PAID', 'OVERDUE']);
export const CardBillingIssuedToTypeSchema = z.enum(['team', 'worker']);

// --- Core Schemas ---

export const CardSchema = z.object({
    name: z.string().min(1, '카드 이름은 필수입니다.'),
    issuer: z.string().optional(),
    cardType: CardTypeSchema.default('CREDIT'),
    last4: z.string().length(4, '카드 번호 끝 4자리를 입력해주세요.'),
    maskedNumber: z.string().optional(),
    expiry: z.string().optional(),
    status: CardStatusSchema.default('AVAILABLE'),
    currentAssigneeId: z.string().nullable().optional(),
    currentAssigneeType: CardAssigneeTypeSchema.nullable().optional(),
    currentAssigneeName: z.string().nullable().optional(),
    memo: z.string().nullable().optional(),
    legacyId: z.string().optional(),
});

export const CardAssignmentRecordSchema = z.object({
    cardId: z.string(),
    cardLabel: z.string(),
    assigneeId: z.string(),
    assigneeType: CardAssigneeTypeSchema,
    assigneeName: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
    note: z.string().nullable().optional(),
    legacyId: z.string().optional(),
});

export const CardTransactionSchema = z.object({
    cardId: z.string(),
    cardLabel: z.string(),
    date: z.string(),
    yearMonth: z.string(),
    merchant: z.string().optional(),
    category: CardTransactionCategorySchema.default('OTHER'),
    amount: z.number().nonnegative(),
    memo: z.string().nullable().optional(),
    evidenceUrl: z.string().nullable().optional(),
    legacyId: z.string().optional(),
});

export const CardBillingCostItemSchema = z.object({
    id: z.string().optional(),
    label: z.string(),
    amount: z.number(),
    type: z.string().optional(), // 'VARIABLE', 'FIXED' 등
    category: z.string().optional(),
});

export const CardBillingDocumentSchema = z.object({
    yearMonth: z.string(),
    cardId: z.string(),
    cardLabel: z.string(),
    assignedTeamId: z.string().nullable().optional(),
    assignedTeamName: z.string().nullable().optional(),
    teamId: z.string().nullable().optional(),
    teamName: z.string().nullable().optional(),
    issuedToType: CardBillingIssuedToTypeSchema.nullable().optional(),
    issuedToWorkerId: z.string().nullable().optional(),
    issuedToWorkerName: z.string().nullable().optional(),
    variableCost: z.number().default(0),
    totalAmount: z.number().default(0),
    status: CardBillingStatusSchema.default('DRAFT'),
    lineItems: z.array(CardBillingCostItemSchema),
    statementAttachmentPaths: z.array(z.string()).default([]),
    memo: z.string().nullable().optional(),
    confirmedAt: z.any().optional(), // Firestore Timestamp 등의 유연한 처리를 위해 any 허용하거나 추가 로직 필요
    legacyId: z.string().optional(),
});
