import { z } from 'zod';

// Vehicle Enum values
export const VehicleTypeSchema = z.enum(['RENT', 'LEASE', 'OWNED']);
export const VehicleStatusSchema = z.enum(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'DISPOSED']);
export const VehicleAssigneeTypeSchema = z.enum(['TEAM', 'WORKER']);
export const VehicleBillingTargetTypeSchema = z.enum(['TEAM', 'WORKER', 'OFFICE', 'OFFICE_STAFF']);
export const VehicleExpenseTypeSchema = z.enum(['FUEL', 'REPAIR', 'TOLL', 'FINE', 'OTHER']);
export const VehicleExpensePayerSchema = z.enum(['COMPANY', 'DRIVER']);
export const VehicleExpenseStatusSchema = z.enum(['ACTIVE', 'CANCELLED']);
export const VehicleFineChargeTargetSchema = z.enum(['BILLING_TARGET', 'DRIVER']);

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
    currentAssigneeId: z.string().nullable().optional(),
    currentAssigneeType: VehicleAssigneeTypeSchema.nullable().optional(),
    currentAssigneeName: z.string().nullable().optional(),
    billingTargetId: z.string().nullable().optional(),
    billingTargetType: VehicleBillingTargetTypeSchema.nullable().optional(),
    billingTargetName: z.string().nullable().optional(),
    billingTargetStartDate: z.string().nullable().optional(),
    billingTargetEndDate: z.string().nullable().optional(),
    fineChargeTarget: VehicleFineChargeTargetSchema.optional().default('BILLING_TARGET'),
    fineChargeTargetEffectiveDate: z.string().nullable().optional(),
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

// Vehicle Billing Target History Schema
export const vehicleBillingTargetSchema = z.object({
    id: z.string(),
    vehicleId: z.string(),
    vehiclePlate: z.string(),
    targetId: z.string(),
    targetType: VehicleBillingTargetTypeSchema,
    targetName: z.string(),
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
    fineChargeTarget: VehicleFineChargeTargetSchema.optional().default('BILLING_TARGET'),
    fineDriverBillingTarget: z.object({
        workerId: z.string(),
        workerName: z.string(),
        teamId: z.string().optional(),
        teamName: z.string().optional(),
    }).optional(),
    status: VehicleExpenseStatusSchema.optional().default('ACTIVE'),
    note: z.string().optional(),
    evidenceUrl: z.string().optional(),
    importSource: z.enum(['GEMINI_FINE_NOTICE']).optional(),
    fineNotice: z.object({
        sourceFileName: z.string(),
        issuer: z.string(),
        noticeType: z.enum(['PARKING_FINE', 'TRAFFIC_FINE', 'OTHER']),
        extractedLicensePlate: z.string(),
        violationDateTime: z.string(),
        violationLocation: z.string(),
        violationDescription: z.string(),
        dueDate: z.string(),
        noticeNumber: z.string(),
        electronicPaymentNumber: z.string(),
        originalAmount: z.number(),
        reductionAmount: z.number(),
        payableAmount: z.number(),
        driverPenaltyAmount: z.number(),
        ownerFineAmount: z.number(),
        confidence: z.number(),
        warnings: z.array(z.string()),
        dedupeKey: z.string(),
        manualMatch: z.boolean(),
    }).optional(),
    operationId: z.string().optional(),
    lastOperationId: z.string().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
    cancelledAt: z.any().nullable().optional(),
});

export type VehicleSchema = z.infer<typeof vehicleSchema>;
export type VehicleAssignmentSchema = z.infer<typeof vehicleAssignmentSchema>;
export type VehicleBillingTargetSchema = z.infer<typeof vehicleBillingTargetSchema>;
export type VehicleExpenseSchema = z.infer<typeof vehicleExpenseSchema>;
