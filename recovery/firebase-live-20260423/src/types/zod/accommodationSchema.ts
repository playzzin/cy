import { z } from 'zod';

// Accommodation Enum values
export const AccommodationType = z.enum(['OneRoom', 'TwoRoom', 'Apartment']);
export const AccommodationStatus = z.enum(['active', 'inactive']);
export const AccommodationOwnership = z.enum(['Cheongyeon', 'Dawon', 'Individual']);
export const UtilityPaymentStatus = z.enum(['unpaid', 'paid', 'pending']);

// Cost Profile Schema
export const CostProfileSchema = z.object({
    electricity: z.enum(['variable', 'fixed', 'included']),
    gas: z.enum(['variable', 'fixed', 'included']),
    water: z.enum(['variable', 'fixed', 'included']),
    internet: z.enum(['variable', 'fixed', 'included']),
    maintenance: z.enum(['variable', 'fixed', 'included']),
    fixedElectricity: z.number().optional(),
    fixedGas: z.number().optional(),
    fixedWater: z.number().optional(),
    fixedInternet: z.number().optional(),
    fixedMaintenance: z.number().optional(),
});

// Contract Schema
export const AccommodationContractSchema = z.object({
    startDate: z.string(),
    endDate: z.string(),
    deposit: z.number().default(0),
    monthlyRent: z.number().default(0),
    paymentDay: z.number().min(1).max(31).default(1),
    landlordName: z.string().default(''),
    landlordContact: z.string().default(''),
    isReported: z.boolean().default(false),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    accountHolder: z.string().optional(),
    rentPayDate: z.number().min(1).max(31).optional(),
    isAutoTransfer: z.boolean().default(false),
    transferDay: z.number().min(1).max(31).optional(),
    transferAccountInfo: z.string().optional(),
});

// Accommodation Master Schema
export const accommodationSchema = z.object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    type: AccommodationType,
    status: AccommodationStatus.default('active'),
    ownership: AccommodationOwnership,
    contract: AccommodationContractSchema,
    costProfile: CostProfileSchema,
    currentOccupantName: z.string().optional(),
    currentOccupantPhone: z.string().optional(),
    memo: z.string().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

// Utility Costs Schema
export const UtilityCostsSchema = z.object({
    rent: z.number().default(0),
    electricity: z.number().default(0),
    gas: z.number().default(0),
    water: z.number().default(0),
    internet: z.number().default(0),
    maintenance: z.number().default(0),
    other: z.number().default(0),
    total: z.number().default(0),
});

// Utility Record Schema
export const utilityRecordSchema = z.object({
    id: z.string(),
    accommodationId: z.string(),
    accommodationName: z.string(),
    yearMonth: z.string(), // YYYY-MM
    costs: UtilityCostsSchema,
    paymentDate: z.string().optional(),
    paymentStatus: UtilityPaymentStatus.default('unpaid'),
    memo: z.string().optional(),
    isAnomaly: z.boolean().default(false),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type AccommodationSchema = z.infer<typeof accommodationSchema>;
export type UtilityRecordSchema = z.infer<typeof utilityRecordSchema>;
