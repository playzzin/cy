import { z } from 'zod';

// Material Master Schema
export const MaterialSchema = z.object({
    id: z.string(),
    itemName: z.string(),
    category: z.string().optional(),
    spec: z.string().optional(),
    unit: z.string().optional(),
    unitPrice: z.number().default(0),
    isActive: z.boolean().default(true),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type MaterialZod = z.infer<typeof MaterialSchema>;

// Material Inbound Transaction Schema
export const MaterialInboundSchema = z.object({
    id: z.string(),
    materialId: z.string(),
    itemName: z.string(),
    category: z.string().optional(),
    spec: z.string().optional(),
    unit: z.string().optional(),
    siteId: z.string(),
    siteName: z.string(),
    quantity: z.number(),
    unitPrice: z.number().default(0),
    amount: z.number().default(0),
    transactionDate: z.string(), // YYYY-MM-DD
    vehicleNumber: z.string().optional(),
    remarks: z.string().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type MaterialInboundZod = z.infer<typeof MaterialInboundSchema>;

// Material Outbound Transaction Schema
export const MaterialOutboundSchema = z.object({
    id: z.string(),
    materialId: z.string(),
    itemName: z.string(),
    category: z.string().optional(),
    spec: z.string().optional(),
    unit: z.string().optional(),
    siteId: z.string(),
    siteName: z.string(),
    quantity: z.number(),
    transactionDate: z.string(), // YYYY-MM-DD
    vehicleNumber: z.string().optional(),
    remarks: z.string().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type MaterialOutboundZod = z.infer<typeof MaterialOutboundSchema>;
