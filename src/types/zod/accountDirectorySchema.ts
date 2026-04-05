import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';

export const AccountDirectoryCategorySchema = z.enum(['purchase', 'other']);
export const AccountDirectoryStatusSchema = z.enum(['active', 'inactive']);

export const AccountDirectorySchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, '계좌명은 필수입니다.'),
    category: AccountDirectoryCategorySchema,
    bankName: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    accountHolder: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
    status: AccountDirectoryStatusSchema.default('active'),
    sortOrder: z.number().optional().default(0),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type AccountDirectoryZod = NormalizeNullable<z.input<typeof AccountDirectorySchema>>;
