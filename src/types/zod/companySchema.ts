import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';

export const CompanyTypeSchema = z.enum([
    '\uBBF8\uC9C0\uC815',
    '\uC2DC\uACF5\uC0AC',
    '\uD611\uB825\uC0AC',
    '\uAC74\uC124\uC0AC',
    '\uC784\uB300\uC0AC',
    '\uAE30\uD0C0',
]);
export const CompanyStatusSchema = z.enum(['active', 'inactive', 'archived']);

export const CompanySchema = z.object({
    id: z.string().optional(),
    legacyId: z.string().optional().nullable(),
    corpNum: z.string().optional().nullable(),
    name: z.string().min(1, '\uD68C\uC0AC\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    code: z.string().min(1, '\uD68C\uC0AC \uCF54\uB4DC\uB294 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    businessNumber: z.string().optional().nullable(),
    ceoName: z.string().optional().nullable(),
    ceoResidentNumber: z.string().optional().nullable(),
    idNumber: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    fax: z.string().optional().nullable(),
    email: z.string().email('\uC62C\uBC14\uB978 \uC774\uBA54\uC77C \uD615\uC2DD\uC774 \uC544\uB2D9\uB2C8\uB2E4.').optional().nullable().or(z.literal('')),
    type: CompanyTypeSchema.default('\uBBF8\uC9C0\uC815'),
    bankName: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    accountHolder: z.string().optional().nullable(),
    siteIds: z.array(z.string()).optional().default([]),
    siteNames: z.array(z.string()).optional().default([]),
    status: CompanyStatusSchema.default('active'),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    iconKey: z.string().optional().nullable(),
    totalManDay: z.number().optional().default(0),
    clientTotalManDay: z.number().optional().default(0),
    constructorTotalManDay: z.number().optional().default(0),
    partnerTotalManDay: z.number().optional().default(0),
    isMyCompany: z.boolean().optional().default(false),
    assignedClientCompanyIds: z.array(z.string()).optional().default([]),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type CompanyZod = NormalizeNullable<z.input<typeof CompanySchema>>;
