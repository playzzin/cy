import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';

export const TeamStatusSchema = z.enum(['active', 'waiting', 'closed']);
export const SupportModelSchema = z.enum(['man_day', 'fixed']);

export const TeamSchema = z.object({
    id: z.string().optional(),
    legacyId: z.string().optional().nullable(),
    name: z.string().min(1, '\uD300\uBA85\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    type: z.string().min(1, '\uD300 \uC720\uD615\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    leaderId: z.string().optional().nullable(),
    leaderName: z.string().optional().nullable(),
    companyId: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    parentTeamId: z.string().optional().nullable(),
    parentTeamName: z.string().optional().nullable(),
    memberCount: z.number().optional().default(0),
    memberIds: z.array(z.string()).optional().default([]),
    memberNames: z.array(z.string()).optional().default([]),
    siteIds: z.array(z.string()).optional().default([]),
    siteNames: z.array(z.string()).optional().default([]),
    assignedSiteId: z.string().optional().nullable(),
    assignedSiteName: z.string().optional().nullable(),
    assignedWorkers: z.array(z.string()).optional().default([]),
    totalManDay: z.number().optional().default(0),
    status: TeamStatusSchema.default('active'),
    supportRate: z.number().optional().nullable(),
    supportModel: SupportModelSchema.optional().nullable(),
    supportDescription: z.string().optional().nullable(),
    serviceRate: z.number().optional().nullable(),
    serviceModel: SupportModelSchema.optional().nullable(),
    serviceDescription: z.string().optional().nullable(),
    defaultSalaryModel: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    iconKey: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type TeamZod = NormalizeNullable<z.input<typeof TeamSchema>>;