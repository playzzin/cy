import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';

export const SettlementTargetTypeSchema = z.enum([
    'salesperson',
    'client_company',
    'client_contact',
    'rental_company',
    'office_staff',
    'office_income',
    'other',
]);

export const SettlementTargetProcessTypeSchema = z.enum([
    'payable',
    'office_income',
    'memo',
]);

export const SettlementTargetStatusSchema = z.enum(['active', 'inactive']);

export const SettlementTargetSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, '대상자명은 필수입니다.'),
    targetType: SettlementTargetTypeSchema.default('other'),
    defaultProcessType: SettlementTargetProcessTypeSchema.default('payable'),
    companyId: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    officeStaffId: z.string().optional().nullable(),
    officeStaffName: z.string().optional().nullable(),
    positionTitle: z.string().optional().nullable(),
    contact: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    accountHolder: z.string().optional().nullable(),
    defaultAfterTaxRate: z.number().min(0).max(1).optional().default(0.75),
    buybackEnabled: z.boolean().optional().default(false),
    evidenceRequired: z.boolean().optional().default(false),
    status: SettlementTargetStatusSchema.default('active'),
    memo: z.string().optional().nullable(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type SettlementTargetZod = NormalizeNullable<z.input<typeof SettlementTargetSchema>>;
export type SettlementTargetType = z.infer<typeof SettlementTargetTypeSchema>;
export type SettlementTargetProcessType = z.infer<typeof SettlementTargetProcessTypeSchema>;
export type SettlementTargetStatus = z.infer<typeof SettlementTargetStatusSchema>;
