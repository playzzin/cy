import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';

export const OfficeStaffStatusSchema = z.string().default('재직');

export const OfficeStaffSchema = z.object({
    id: z.string().optional(),
    legacyId: z.string().optional().nullable(),
    uid: z.string().optional().nullable(),
    name: z.string().min(1, '이름은 필수입니다.'),
    idNumber: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    contact: z.string().optional().nullable(),
    email: z.string().email('올바른 이메일 형식이 아닙니다.').optional().nullable().or(z.literal('')),
    role: z.string().optional().nullable(),
    department: z.string().optional().nullable(),
    employmentType: z.string().optional().nullable(),
    status: OfficeStaffStatusSchema,
    unitPrice: z.number().optional().default(0),
    payType: z.string().optional().nullable(),
    salaryModel: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    accountHolder: z.string().optional().nullable(),
    joinDate: z.string().optional().nullable(),
    memo: z.string().optional().nullable(),
    fileNameSaved: z.string().optional().nullable(),
    isActive: z.boolean().optional().default(true),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type OfficeStaffZod = NormalizeNullable<z.input<typeof OfficeStaffSchema>>;
