import { z } from 'zod';

export const SupportRateSchema = z.object({
    siteId: z.string().min(1, '현장 ID는 필수입니다.'),
    siteName: z.string().optional(),
    defaultRate: z.number().nonnegative('단가는 0 이상이어야 합니다.'),
    legacyId: z.string().optional(),
});
