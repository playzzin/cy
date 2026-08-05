import { z } from 'zod';

export const FreelancerStatusSchema = z.enum(['active', 'inactive']);

export const FreelancerSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, '이름은 필수입니다.'),
    teamId: z.string().optional().nullable(),
    teamName: z.string().optional().nullable(),
    residentNumber: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    status: FreelancerStatusSchema.default('active'),
    memo: z.string().optional().nullable(),
    unitPrice: z.number().optional().nullable(),
    legacyId: z.string().optional().nullable(), // 마이그레이션용
    createdAt: z.any().optional().nullable(),
    updatedAt: z.any().optional().nullable(),
});

export const FreelancerPaymentSchema = z.object({
    id: z.string().optional(),
    freelancerId: z.string().min(1, '프리랜서 ID는 필수입니다.'),
    year: z.number().int().min(2000),
    month: z.number().int().min(1).max(12),
    dailyRate: z.number().optional().nullable(),
    manDays: z.number().optional().nullable(),
    amount: z.number().optional().nullable(),
    isManualTaxOverride: z.boolean().optional(),
    performanceBonus: z.number().optional().nullable(),
    reportingBalance: z.number().optional().nullable(),
    reportableAmount: z.number().optional().nullable(),
    depositDate: z.string().optional().nullable(),
    memo: z.string().optional().nullable(),
    legacyId: z.string().optional().nullable(), // 마이그레이션용
    createdAt: z.any().optional().nullable(),
    updatedAt: z.any().optional().nullable(),
});

export type FreelancerZod = z.infer<typeof FreelancerSchema>;
export type FreelancerPaymentZod = z.infer<typeof FreelancerPaymentSchema>;
