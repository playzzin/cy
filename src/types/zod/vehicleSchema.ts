import { z } from 'zod';

// Vehicle Enum values
export const VehicleTypeSchema = z.enum(['RENT', 'LEASE', 'OWNED']);
export const VehicleStatusSchema = z.enum(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'DISPOSED']);
export const VehicleAssigneeTypeSchema = z.enum(['TEAM', 'WORKER']);
export const VehicleExpenseTypeSchema = z.enum(['FUEL', 'REPAIR', 'TOLL', 'FINE', 'OTHER']);
export const VehicleExpensePayerSchema = z.enum(['COMPANY', 'DRIVER']);

// Vehicle Contract Schema
export const VehicleContractSchema = z.object({
    type: VehicleTypeSchema,
    startDate: z.string(),
    endDate: z.string(),
    deposit: z.number().default(0),
    monthlyFee: z.number().default(0),
    paymentDay: z.number().min(1).max(31).default(1),
    financeCompany: z.object({
        name: z.string().default(''),
        contact: z.string().default(''),
    }),
    bankAccount: z.object({
        bankName: z.string().default(''),
        accountNumber: z.string().default(''),
        accountHolder: z.string().default(''),
    }).optional(),
});

// Vehicle Insurance Schema
export const VehicleInsuranceSchema = z.object({
    company: z.string(),
    policyNumber: z.string(),
    contact: z.string(),
    expiryDate: z.string(),
    ageLimit: z.string(),
});

// Vehicle Master Schema
export const vehicleSchema = z.object({
    id: z.string(),
    licensePlate: z.string(),
    model: z.string().default(''),
    type: VehicleTypeSchema,
    status: VehicleStatusSchema.default('AVAILABLE'),
    contract: VehicleContractSchema,
    insurance: VehicleInsuranceSchema.optional(),
    currentAssigneeId: z.string().optional(),
    currentAssigneeType: VehicleAssigneeTypeSchema.optional(),
    currentAssigneeName: z.string().optional(),
    billingTargetId: z.string().optional(),
    billingTargetType: VehicleAssigneeTypeSchema.optional(),
    billingTargetName: z.string().optional(),
    memo: z.string().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

// Vehicle Assignment Record Schema
export const vehicleAssignmentSchema = z.object({
    id: z.string(),
    vehicleId: z.string(),
    vehiclePlate: z.string(),
    assigneeId: z.string(),
    assigneeType: VehicleAssigneeTypeSchema,
    assigneeName: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
    note: z.string().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

// Vehicle Expense Record Schema
export const vehicleExpenseSchema = z.object({
    id: z.string(),
    vehicleId: z.string(),
    vehiclePlate: z.string(),
    date: z.string(),
    type: VehicleExpenseTypeSchema,
    amount: z.number().default(0),
    payer: VehicleExpensePayerSchema.default('COMPANY'),
    note: z.string().optional(),
    evidenceUrl: z.string().optional(),
    createdAt: z.any().optional(),
});

export type VehicleSchema = z.infer<typeof vehicleSchema>;
export type VehicleAssignmentSchema = z.infer<typeof vehicleAssignmentSchema>;
export type VehicleExpenseSchema = z.infer<typeof vehicleExpenseSchema>;
