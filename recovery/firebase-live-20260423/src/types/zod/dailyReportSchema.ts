import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';

export const DailyReportWorkerStatusSchema = z.enum(['attendance', 'absent', 'half']);

export const DailyReportWorkerSchema = z.object({
    workerId: z.string().min(1, '\uC791\uC5C5\uC790 ID\uB294 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    name: z.string().min(1, '\uC791\uC5C5\uC790 \uC774\uB984\uC740 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    role: z.string().optional().nullable(),
    status: DailyReportWorkerStatusSchema.default('attendance'),
    manDay: z.number().default(0),
    workContent: z.string().optional().nullable(),
    teamId: z.string().optional().nullable(),
    unitPrice: z.number().optional().nullable(),
    payType: z.string().optional().nullable(),
    salaryModel: z.string().optional().nullable(),
    siteType: z.string().optional().nullable(),
    paymentType: z.string().optional().nullable(),
    workerTeamName: z.string().optional().nullable(),
});

export const DailyReportSchema = z.object({
    id: z.string().optional(),
    legacyId: z.string().optional().nullable(),
    date: z.string().min(1, '\uB0A0\uC9DC\uB294 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    teamId: z.string().min(1, '\uD300 ID\uB294 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    teamName: z.string().optional().nullable(),
    siteId: z.string().min(1, '\uD604\uC7A5 ID\uB294 \uD544\uC218\uC785\uB2C8\uB2E4.'),
    siteName: z.string().optional().nullable(),
    responsibleTeamId: z.string().optional().nullable(),
    responsibleTeamName: z.string().optional().nullable(),
    companyId: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    constructorCompanyId: z.string().optional().nullable(),
    constructorCompanyName: z.string().optional().nullable(),
    partnerId: z.string().optional().nullable(),
    partnerName: z.string().optional().nullable(),
    writerId: z.string().optional().nullable(),
    workers: z.array(DailyReportWorkerSchema).default([]),
    totalManDay: z.number().default(0),
    totalAmount: z.number().optional().default(0),
    weather: z.string().optional().nullable(),
    workContent: z.string().optional().nullable(),
    siteType: z.string().optional().nullable(),
    paymentType: z.string().optional().nullable(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

type DailyReportOutput = NormalizeNullable<z.infer<typeof DailyReportSchema>>;
export type DailyReportZod = Omit<DailyReportOutput, 'totalAmount'> & {
    totalAmount?: number;
};
export type DailyReportWorkerZod = NormalizeNullable<z.infer<typeof DailyReportWorkerSchema>>;
export type DailyReportInputZod = NormalizeNullable<z.input<typeof DailyReportSchema>>;
export type DailyReportWorkerInputZod = NormalizeNullable<z.input<typeof DailyReportWorkerSchema>>;
