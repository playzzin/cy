import { z } from 'zod';
import { NormalizeNullable } from './typeUtils';

export const YearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const RecruitingReferrerTypeSchema = z.enum(['agency', 'worker', 'office_staff', 'external']);
export const RecruitingReferrerStatusSchema = z.enum(['active', 'inactive']);
export const ServiceWorkerReferralStatusSchema = z.enum(['active', 'paused', 'stopped', 'closed']);
export const ServiceReferralDailyLineStatusSchema = z.enum(['pending', 'confirmed', 'excluded', 'overridden']);
export const ServiceReferralSettlementStatusSchema = z.enum(['draft', 'confirmed', 'paid', 'cancelled']);
export const ServiceWorkerReferralSourceSchema = z.enum(['workers', 'daily_reports', 'merged']);
export const ServiceWorkerHistoryEventTypeSchema = z.enum([
  '등록',
  '소개자변경',
  '현장변경',
  '팀변경',
  '급여구분변경',
  '휴직',
  '복직',
  '퇴사',
  '출입금지',
  '정산확정',
  '지급완료',
]);
export const ServiceReferralPaymentStatusSchema = z.enum(['pending', 'approved', 'paid', 'cancelled']);
export const ServiceReferralReceivableStatusSchema = z.enum(['pending', 'partial', 'overdue', 'closed']);

const NonNegativeNumberSchema = z.number().finite().min(0);

export const RecruitingReferrerSchema = z.object({
  id: z.string().optional(),
  type: RecruitingReferrerTypeSchema.default('agency'),
  linkedEntityId: z.string().optional().nullable(),
  name: z.string().min(1, '소개자명은 필수입니다.'),
  contact: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountHolder: z.string().optional().nullable(),
  defaultIntroFeeIncomePerDay: NonNegativeNumberSchema.optional().default(60000),
  defaultIntroFeePayoutPerDay: NonNegativeNumberSchema.optional().default(60000),
  defaultIntroFeeMaxDays: NonNegativeNumberSchema.optional().default(5),
  defaultDailyCommission: NonNegativeNumberSchema.optional().default(5000),
  status: RecruitingReferrerStatusSchema.default('active'),
  memo: z.string().optional().nullable(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export const ServiceWorkerReferralSchema = z.object({
  id: z.string().optional(),
  workerId: z.string().min(1, '작업자 ID는 필수입니다.'),
  workerName: z.string().min(1, '작업자명은 필수입니다.'),
  workerTeamName: z.string().optional().nullable(),
  source: ServiceWorkerReferralSourceSchema.optional().default('workers'),
  firstWorkDate: z.string().optional().nullable(),
  lastWorkDate: z.string().optional().nullable(),
  sourceReportIds: z.array(z.string()).optional().default([]),
  sourceSiteNames: z.array(z.string()).optional().default([]),
  sourceSnapshot: z.record(z.unknown()).optional().nullable(),
  referrerId: z.string().min(1, '소개자 ID는 필수입니다.'),
  referrerType: RecruitingReferrerTypeSchema,
  referrerName: z.string().min(1, '소개자명은 필수입니다.'),
  startDate: z.string().min(1, '시작일은 필수입니다.'),
  stopDate: z.string().optional().nullable(),
  status: ServiceWorkerReferralStatusSchema.default('active'),
  introFeeIncomePerDay: NonNegativeNumberSchema.default(60000),
  introFeePayoutPerDay: NonNegativeNumberSchema.default(60000),
  introFeeMaxDays: NonNegativeNumberSchema.default(5),
  dailyCommissionPerDay: NonNegativeNumberSchema.default(5000),
  stopReason: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export const ServiceReferralDailyLineSchema = z.object({
  id: z.string().optional(),
  yearMonth: YearMonthSchema,
  date: z.string().min(1),
  referralId: z.string().min(1),
  referrerId: z.string().min(1),
  referrerName: z.string().min(1),
  workerId: z.string().min(1),
  workerName: z.string().min(1),
  teamId: z.string().optional().nullable(),
  teamName: z.string().optional().nullable(),
  siteNames: z.array(z.string()).default([]),
  reportIds: z.array(z.string()).default([]),
  reportWorkerIndexes: z.array(z.number()).default([]),
  manDay: NonNegativeNumberSchema.default(0),
  workdayCounted: z.boolean().default(false),
  introDayIndex: NonNegativeNumberSchema.default(0),
  introIncomeAmount: NonNegativeNumberSchema.default(0),
  introPayoutAmount: NonNegativeNumberSchema.default(0),
  dailyCommissionAmount: NonNegativeNumberSchema.default(0),
  status: ServiceReferralDailyLineStatusSchema.default('pending'),
  overrideReason: z.string().optional().nullable(),
  excludedReason: z.string().optional().nullable(),
  sourceSnapshot: z.record(z.unknown()).optional().nullable(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export const ServiceReferralMonthlySettlementSchema = z.object({
  id: z.string().optional(),
  yearMonth: YearMonthSchema,
  referrerId: z.string().min(1),
  referrerName: z.string().min(1),
  referrerType: RecruitingReferrerTypeSchema,
  totalWorkers: NonNegativeNumberSchema.default(0),
  totalWorkDays: NonNegativeNumberSchema.default(0),
  introIncomeTotal: NonNegativeNumberSchema.default(0),
  introPayoutTotal: NonNegativeNumberSchema.default(0),
  dailyCommissionTotal: NonNegativeNumberSchema.default(0),
  adjustmentAmount: z.number().finite().default(0),
  payableTotal: z.number().finite().default(0),
  netProfit: z.number().finite().default(0),
  pendingLineCount: NonNegativeNumberSchema.default(0),
  confirmedLineCount: NonNegativeNumberSchema.default(0),
  paidLineCount: NonNegativeNumberSchema.optional().default(0),
  status: ServiceReferralSettlementStatusSchema.default('draft'),
  memo: z.string().optional().nullable(),
  confirmedAt: z.string().datetime().optional().nullable(),
  paidAt: z.string().datetime().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  updatedBy: z.string().optional().nullable(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export const ServiceReferralSettingsSchema = z.object({
  id: z.string().optional(),
  introFeeIncomePerDay: NonNegativeNumberSchema.default(60000),
  introFeePayoutPerDay: NonNegativeNumberSchema.default(60000),
  introFeeMaxDays: NonNegativeNumberSchema.default(5),
  dailyCommissionPerDay: NonNegativeNumberSchema.default(5000),
  confirmAfterWorkDays: NonNegativeNumberSchema.default(5),
  countMode: z.literal('unique_work_date').default('unique_work_date'),
  updatedAt: z.any().optional(),
});

export const ServiceWorkerHistorySchema = z.object({
  id: z.string().optional(),
  workerId: z.string().min(1),
  workerName: z.string().min(1),
  referrerId: z.string().optional().nullable(),
  referrerName: z.string().optional().nullable(),
  siteName: z.string().optional().nullable(),
  teamName: z.string().optional().nullable(),
  eventType: ServiceWorkerHistoryEventTypeSchema,
  oldValue: z.string().optional().nullable(),
  newValue: z.string().optional().nullable(),
  eventDate: z.string().min(1),
  createdBy: z.string().optional().nullable(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export const ServiceReferralPaymentSchema = z.object({
  id: z.string().optional(),
  paymentId: z.string().optional().nullable(),
  settlementId: z.string().min(1),
  yearMonth: YearMonthSchema,
  referrerId: z.string().min(1),
  referrerName: z.string().min(1),
  amount: z.number().finite().default(0),
  paymentStatus: ServiceReferralPaymentStatusSchema.default('pending'),
  paymentDate: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountHolder: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export const ServiceReferralDepositSchema = z.object({
  id: z.string().optional(),
  depositId: z.string().optional().nullable(),
  yearMonth: YearMonthSchema,
  referrerId: z.string().min(1),
  referrerName: z.string().min(1),
  expectedAmount: z.number().finite().default(0),
  depositAmount: z.number().finite().default(0),
  difference: z.number().finite().default(0),
  verified: z.boolean().default(false),
  cancelled: z.boolean().optional().default(false),
  depositDate: z.string().optional().nullable(),
  evidenceFileUrl: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export const ServiceReferralReceivableSchema = z.object({
  id: z.string().optional(),
  receivableId: z.string().optional().nullable(),
  referrerId: z.string().min(1),
  referrerName: z.string().min(1),
  month: YearMonthSchema,
  expectedAmount: z.number().finite().default(0),
  receivedAmount: z.number().finite().default(0),
  receivableAmount: z.number().finite().default(0),
  overdueDays: NonNegativeNumberSchema.default(0),
  status: ServiceReferralReceivableStatusSchema.default('pending'),
  memo: z.string().optional().nullable(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export type RecruitingReferrerZod = NormalizeNullable<z.input<typeof RecruitingReferrerSchema>>;
export type ServiceWorkerReferralZod = NormalizeNullable<z.input<typeof ServiceWorkerReferralSchema>>;
export type ServiceReferralDailyLineZod = NormalizeNullable<z.input<typeof ServiceReferralDailyLineSchema>>;
export type ServiceReferralMonthlySettlementZod = NormalizeNullable<z.input<typeof ServiceReferralMonthlySettlementSchema>>;
export type ServiceReferralSettingsZod = NormalizeNullable<z.input<typeof ServiceReferralSettingsSchema>>;
export type ServiceWorkerHistoryZod = NormalizeNullable<z.input<typeof ServiceWorkerHistorySchema>>;
export type ServiceReferralPaymentZod = NormalizeNullable<z.input<typeof ServiceReferralPaymentSchema>>;
export type ServiceReferralDepositZod = NormalizeNullable<z.input<typeof ServiceReferralDepositSchema>>;
export type ServiceReferralReceivableZod = NormalizeNullable<z.input<typeof ServiceReferralReceivableSchema>>;
