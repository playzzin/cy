import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';

export const SiteStatusSchema = z.enum(['active', 'completed', 'planned']);

export const SiteSchema = z.object({
    id: z.string().optional(),
    legacyId: z.string().optional().nullable(),
    name: z.string().min(1, '\uD604\uC7A5\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    code: z.string().min(1, '\uD604\uC7A5 \uCF54\uB4DC\uB294 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    address: z.string().optional().nullable(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    status: SiteStatusSchema.default('active'),
    responsibleTeamId: z.string().optional().nullable(),
    responsibleTeamName: z.string().optional().nullable(),
    siteManagerId: z.string().optional().nullable(),
    siteManagerName: z.string().optional().nullable(),
    companyId: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    constructorCompanyId: z.string().optional().nullable(),
    constructorCompanyName: z.string().optional().nullable(),
    clientCompanyId: z.string().optional().nullable(),
    clientCompanyName: z.string().optional().nullable(),
    partnerId: z.string().optional().nullable(),
    partnerName: z.string().optional().nullable(),
    siteType: z.string().optional().nullable(),
    paymentMethod: z.string().optional().nullable(),
    totalManDay: z.number().optional().default(0),
    color: z.string().optional().nullable(),
    imageUrl: z.string().optional().nullable(),
    photos: z.array(z.string()).optional().default([]),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type SiteZod = NormalizeNullable<z.input<typeof SiteSchema>>;
