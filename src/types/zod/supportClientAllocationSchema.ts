import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';
import {
    SettlementTargetProcessTypeSchema,
    SettlementTargetTypeSchema,
} from './settlementTargetSchema';

export const SupportClientAllocationLineStatusSchema = z.enum([
    'draft',
    'confirmed',
    'payment_pending',
    'paid',
    'received',
]);

export const SupportClientAllocationStatusSchema = z.enum([
    'draft',
    'partial',
    'balanced',
    'over',
]);

export const SupportClientAllocationLineSchema = z.object({
    id: z.string(),
    targetId: z.string().optional().nullable(),
    targetName: z.string().min(1, '대상자명은 필수입니다.'),
    targetType: SettlementTargetTypeSchema.default('other'),
    companyId: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    amount: z.number().default(0),
    processType: SettlementTargetProcessTypeSchema.default('payable'),
    dueDate: z.string().optional().nullable(),
    status: SupportClientAllocationLineStatusSchema.default('confirmed'),
    memo: z.string().optional().nullable(),
});

export const SupportClientAllocationSchema = z.object({
    id: z.string().optional(),
    yearMonth: z.string(),
    siteKey: z.string(),
    siteId: z.string().optional().nullable(),
    siteName: z.string().optional().nullable(),
    clientCompanyId: z.string().optional().nullable(),
    clientCompanyName: z.string().optional().nullable(),
    issuedAmount: z.number().default(0),
    settlementAmount: z.number().default(0),
    distributableAmount: z.number().default(0),
    allocatedAmount: z.number().default(0),
    status: SupportClientAllocationStatusSchema.default('draft'),
    lines: z.array(SupportClientAllocationLineSchema).optional().default([]),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type SupportClientAllocationZod = NormalizeNullable<z.input<typeof SupportClientAllocationSchema>>;
export type SupportClientAllocationLineZod = NormalizeNullable<z.input<typeof SupportClientAllocationLineSchema>>;
export type SupportClientAllocationLineStatus = z.infer<typeof SupportClientAllocationLineStatusSchema>;
export type SupportClientAllocationStatus = z.infer<typeof SupportClientAllocationStatusSchema>;
