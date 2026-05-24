import { z } from 'zod';

// Material Master Schema
export const MaterialSchema = z.object({
    id: z.string(),
    materialKey: z.string().optional(),
    itemName: z.string(),
    category: z.string().optional(),
    spec: z.string().optional(),
    unit: z.string().optional(),
    safetyStock: z.number().optional(),
    description: z.string().optional(),
    unitPrice: z.number().default(0),
    isActive: z.boolean().default(true),
    isCatalogDefault: z.boolean().optional(),
    hiddenCatalogDefault: z.boolean().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type MaterialZod = z.infer<typeof MaterialSchema>;

// Material Inbound Transaction Schema
export const MaterialInboundSchema = z.object({
    id: z.string(),
    materialId: z.string(),
    materialKey: z.string().optional(),
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
    supplier: z.string().optional(),
    invoiceNumber: z.string().optional(),
    notes: z.string().optional(),
    photoUrls: z.array(z.string()).optional(),
    registeredBy: z.string().optional(),
    registeredByName: z.string().optional(),
    remarks: z.string().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type MaterialInboundZod = z.infer<typeof MaterialInboundSchema>;

// Material Outbound Transaction Schema
export const MaterialOutboundSchema = z.object({
    id: z.string(),
    materialId: z.string(),
    materialKey: z.string().optional(),
    itemName: z.string(),
    category: z.string().optional(),
    spec: z.string().optional(),
    unit: z.string().optional(),
    siteId: z.string(),
    siteName: z.string(),
    quantity: z.number(),
    transactionDate: z.string(), // YYYY-MM-DD
    vehicleNumber: z.string().optional(),
    recipient: z.string().optional(),
    recipientPhone: z.string().optional(),
    deliveryStatus: z.enum(['pending', 'in-transit', 'delivered']).optional(),
    notes: z.string().optional(),
    photoUrls: z.array(z.string()).optional(),
    registeredBy: z.string().optional(),
    registeredByName: z.string().optional(),
    remarks: z.string().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type MaterialOutboundZod = z.infer<typeof MaterialOutboundSchema>;
