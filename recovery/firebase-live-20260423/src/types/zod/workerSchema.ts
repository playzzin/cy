import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';

export const WorkerStatusSchema = z.string().default('\uC7AC\uC9C1');

export const WorkerSchema = z.object({
    id: z.string().optional(),
    legacyId: z.string().optional().nullable(),
    uid: z.string().optional().nullable(),
    name: z.string().min(1, '\uC774\uB984\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    idNumber: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    contact: z.string().optional().nullable(),
    email: z.string().email('\uC62C\uBC14\uB978 \uC774\uBA54\uC77C \uD615\uC2DD\uC774 \uC544\uB2D9\uB2C8\uB2E4.').optional().nullable().or(z.literal('')),
    role: z.string().optional().nullable(),
    teamId: z.string().optional().nullable(),
    teamType: z.string().optional().default('\uBBF8\uBC30\uC815'),
    teamName: z.string().optional().nullable(),
    status: WorkerStatusSchema,
    unitPrice: z.number().optional().default(0),
    payType: z.string().optional().nullable(),
    salaryModel: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    accountHolder: z.string().optional().nullable(),
    fileNameSaved: z.string().optional().nullable(),
    needsApproval: z.boolean().optional().default(false),
    totalManDay: z.number().optional().default(0),
    employmentType: z.string().optional().nullable(),
    rank: z.string().optional().nullable(),
    siteId: z.string().optional().nullable(),
    siteName: z.string().optional().nullable(),
    companyId: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    leaderName: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    iconKey: z.string().optional().nullable(),
    signatureUrl: z.string().optional().nullable(),
    profileImageUrl: z.string().optional().nullable(),
    profileImagePath: z.string().optional().nullable(),
    profileImageUpdatedAt: z.any().optional(),
    bloodType: z.string().optional().nullable(),
    isActive: z.boolean().optional().default(true),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type WorkerZod = NormalizeNullable<z.input<typeof WorkerSchema>>;
