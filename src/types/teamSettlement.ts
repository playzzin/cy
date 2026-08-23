import { z } from 'zod';

export const YearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const SettlementSourceSchema = z.enum(['auto', 'manual']);
export type SettlementSource = z.infer<typeof SettlementSourceSchema>;

const NonNegativeNumberSchema = z.number().finite().min(0);

export const TeamSettlementWorkKindSchema = z.enum(['도급', '직영', '지원']);
export type TeamSettlementWorkKind = z.infer<typeof TeamSettlementWorkKindSchema>;

export const TeamSettlementSalesOriginSchema = z.enum([
  'tax_invoice',
  'daily_report',
  'support_client_site',
  '내부지원간곳',
  '외부지원간곳',
  'support_outgoing',
  'support_fee_outgoing',
  'manual'
]);
export type TeamSettlementSalesOrigin = z.infer<typeof TeamSettlementSalesOriginSchema>;

export const TeamSettlementPurchaseOriginSchema = z.enum([
  'daily_report',
  '내부지원온곳',
  '외부지원온곳',
  'support_incoming',
  'support_fee_incoming',
  'manual'
]);
export type TeamSettlementPurchaseOrigin = z.infer<typeof TeamSettlementPurchaseOriginSchema>;

export const TeamSettlementDeductionOriginSchema = z.enum([
  'accommodation_billing',
  'office_expense',
  'daily_wage_payroll',
  'monthly_wage_payroll',
  'service_team_payroll',
  'team_expense_claim',
  'vehicle_billing',
  'card_billing',
  'manual'
]);
export type TeamSettlementDeductionOrigin = z.infer<typeof TeamSettlementDeductionOriginSchema>;

export const TeamSettlementAdditionOriginSchema = z.enum(['team_expense_claim', 'manual']);
export type TeamSettlementAdditionOrigin = z.infer<typeof TeamSettlementAdditionOriginSchema>;

export const TeamSettlementSalesItemSchema = z.object({
  id: z.string().min(1),
  source: SettlementSourceSchema,
  origin: TeamSettlementSalesOriginSchema,
  kind: TeamSettlementWorkKindSchema.default('직영'),
  siteId: z.string().optional(),
  siteName: z.string().min(1),
  counterTeamId: z.string().optional(),
  counterTeamName: z.string().optional(),
  manDay: NonNegativeNumberSchema,
  quantity: NonNegativeNumberSchema.optional(),
  amount: NonNegativeNumberSchema,
  amountOverridden: z.boolean().optional(),
  memo: z.string().optional()
});
export type TeamSettlementSalesItem = z.infer<typeof TeamSettlementSalesItemSchema>;

export const TeamSettlementPurchaseItemSchema = z.object({
  id: z.string().min(1),
  source: SettlementSourceSchema,
  origin: TeamSettlementPurchaseOriginSchema,
  kind: TeamSettlementWorkKindSchema.default('지원'),
  siteId: z.string().optional(),
  siteName: z.string().min(1),
  counterTeamId: z.string().optional(),
  counterTeamName: z.string().optional(),
  manDay: NonNegativeNumberSchema,
  amount: NonNegativeNumberSchema,
  memo: z.string().optional()
});
export type TeamSettlementPurchaseItem = z.infer<typeof TeamSettlementPurchaseItemSchema>;

export const TeamSettlementDeductionItemSchema = z.object({
  id: z.string().min(1),
  source: SettlementSourceSchema,
  origin: TeamSettlementDeductionOriginSchema,
  category: z.string().min(1),
  amount: NonNegativeNumberSchema,
  memo: z.string().optional()
});
export type TeamSettlementDeductionItem = z.infer<typeof TeamSettlementDeductionItemSchema>;

export const TeamSettlementAdditionItemSchema = z.object({
  id: z.string().min(1),
  source: SettlementSourceSchema,
  origin: TeamSettlementAdditionOriginSchema,
  category: z.string().min(1),
  amount: NonNegativeNumberSchema,
  memo: z.string().optional()
});
export type TeamSettlementAdditionItem = z.infer<typeof TeamSettlementAdditionItemSchema>;

export const TeamSettlementSummarySchema = z.object({
  prevCarryover: NonNegativeNumberSchema.default(0),
  deposit: NonNegativeNumberSchema.default(0)
});
export type TeamSettlementSummary = z.infer<typeof TeamSettlementSummarySchema>;

export const TeamSettlementSourceTotalsSchema = z.object({
  sales: NonNegativeNumberSchema,
  purchases: NonNegativeNumberSchema,
  deductions: NonNegativeNumberSchema,
  additions: NonNegativeNumberSchema,
  net: z.number().finite()
});
export type TeamSettlementSourceTotals = z.infer<typeof TeamSettlementSourceTotalsSchema>;

export const TeamSettlementDailyReportSnapshotSchema = z.object({
  reportId: z.string().min(1),
  date: z.string().min(1),
  reportTeamId: z.string().default(''),
  reportTeamName: z.string().default(''),
  siteId: z.string().default(''),
  siteName: z.string().default(''),
  responsibleTeamId: z.string().default(''),
  responsibleTeamName: z.string().default(''),
  teamAssignmentMissing: z.boolean().default(false),
  workerTeamIds: z.array(z.string()).default([]),
  workerTeamNames: z.array(z.string()).default([])
});
export type TeamSettlementDailyReportSnapshot = z.infer<typeof TeamSettlementDailyReportSnapshotSchema>;

export const TeamSettlementSourceSnapshotSchema = z.object({
  version: z.literal(1),
  capturedAt: z.string().datetime(),
  dailyReports: z.array(TeamSettlementDailyReportSnapshotSchema).default([]),
  totals: TeamSettlementSourceTotalsSchema
});
export type TeamSettlementSourceSnapshot = z.infer<typeof TeamSettlementSourceSnapshotSchema>;

export const TeamSettlementDocumentSchema = z.object({
  yearMonth: YearMonthSchema,
  teamId: z.string().min(1),
  teamName: z.string().default(''),
  sales: z.array(TeamSettlementSalesItemSchema),
  purchases: z.array(TeamSettlementPurchaseItemSchema),
  deductions: z.array(TeamSettlementDeductionItemSchema),
  additions: z.array(TeamSettlementAdditionItemSchema).default([]),
  summary: TeamSettlementSummarySchema,
  sourceSnapshot: TeamSettlementSourceSnapshotSchema.optional(),
  confirmedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime()
});

export type TeamSettlementDocument = z.infer<typeof TeamSettlementDocumentSchema>;
