export type RecruitingReferrerType = 'agency' | 'worker' | 'office_staff' | 'external';
export type RecruitingReferrerStatus = 'active' | 'inactive';
export type ServiceWorkerReferralStatus = 'active' | 'paused' | 'stopped' | 'closed';
export type ServiceReferralDailyLineStatus = 'pending' | 'confirmed' | 'excluded' | 'overridden';
export type ServiceReferralSettlementStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled';
export type ServiceWorkerReferralSource = 'workers' | 'daily_reports' | 'merged';
export type ServiceWorkerHistoryEventType =
  | '등록'
  | '소개자변경'
  | '현장변경'
  | '팀변경'
  | '급여구분변경'
  | '휴직'
  | '복직'
  | '퇴사'
  | '출입금지'
  | '정산확정'
  | '지급완료';
export type ServiceReferralPaymentStatus = 'pending' | 'approved' | 'paid' | 'cancelled';
export type ServiceReferralReceivableStatus = 'pending' | 'partial' | 'overdue' | 'closed';

export interface RecruitingReferrer {
  id?: string;
  type: RecruitingReferrerType;
  linkedEntityId?: string;
  name: string;
  contact?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  defaultIntroFeeIncomePerDay?: number;
  defaultIntroFeePayoutPerDay?: number;
  defaultIntroFeeMaxDays?: number;
  defaultDailyCommission?: number;
  status: RecruitingReferrerStatus;
  memo?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceWorkerReferral {
  id?: string;
  workerId: string;
  workerName: string;
  workerTeamName?: string;
  source?: ServiceWorkerReferralSource;
  firstWorkDate?: string;
  lastWorkDate?: string;
  sourceReportIds?: string[];
  sourceSiteNames?: string[];
  sourceSnapshot?: Record<string, unknown>;
  referrerId: string;
  referrerType: RecruitingReferrerType;
  referrerName: string;
  startDate: string;
  stopDate?: string;
  status: ServiceWorkerReferralStatus;
  introFeeIncomePerDay: number;
  introFeePayoutPerDay: number;
  introFeeMaxDays: number;
  dailyCommissionPerDay: number;
  stopReason?: string;
  memo?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceReferralDailyLine {
  id?: string;
  yearMonth: string;
  date: string;
  referralId: string;
  referrerId: string;
  referrerName: string;
  workerId: string;
  workerName: string;
  teamId?: string;
  teamName?: string;
  siteNames: string[];
  reportIds: string[];
  reportWorkerIndexes: number[];
  manDay: number;
  workdayCounted: boolean;
  introDayIndex: number;
  introIncomeAmount: number;
  introPayoutAmount: number;
  dailyCommissionAmount: number;
  status: ServiceReferralDailyLineStatus;
  overrideReason?: string;
  excludedReason?: string;
  sourceSnapshot?: Record<string, unknown>;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceReferralMonthlySettlement {
  id?: string;
  yearMonth: string;
  referrerId: string;
  referrerName: string;
  referrerType: RecruitingReferrerType;
  totalWorkers: number;
  totalWorkDays: number;
  introIncomeTotal: number;
  introPayoutTotal: number;
  dailyCommissionTotal: number;
  adjustmentAmount: number;
  payableTotal: number;
  netProfit: number;
  pendingLineCount: number;
  confirmedLineCount: number;
  paidLineCount?: number;
  status: ServiceReferralSettlementStatus;
  memo?: string;
  confirmedAt?: string | null;
  paidAt?: string | null;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceReferralSettings {
  id?: string;
  introFeeIncomePerDay: number;
  introFeePayoutPerDay: number;
  introFeeMaxDays: number;
  dailyCommissionPerDay: number;
  confirmAfterWorkDays: number;
  countMode: 'unique_work_date';
  updatedAt?: any;
}

export interface ServiceWorkerHistory {
  id?: string;
  workerId: string;
  workerName: string;
  referrerId?: string;
  referrerName?: string;
  siteName?: string;
  teamName?: string;
  eventType: ServiceWorkerHistoryEventType;
  oldValue?: string;
  newValue?: string;
  eventDate: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceWorkerHistoryDetail {
  workerId: string;
  workerName: string;
  currentStatus: string;
  currentReferrerName: string;
  firstStartDate: string;
  cumulativeWorkDays: number;
  settlementCount: number;
  totalIncome: number;
  latestTeamName?: string;
  latestSiteName?: string;
  events: ServiceWorkerHistory[];
}

export interface ServiceReferralPayment {
  id?: string;
  paymentId?: string;
  settlementId: string;
  yearMonth: string;
  referrerId: string;
  referrerName: string;
  amount: number;
  paymentStatus: ServiceReferralPaymentStatus;
  paymentDate?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  memo?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceReferralPaymentDashboard {
  yearMonth: string;
  pendingAmount: number;
  currentMonthPaidAmount: number;
  cumulativePaidAmount: number;
  pendingCount: number;
  paidCount: number;
}

export interface ServiceReferralDeposit {
  id?: string;
  depositId?: string;
  yearMonth: string;
  referrerId: string;
  referrerName: string;
  expectedAmount: number;
  depositAmount: number;
  difference: number;
  verified: boolean;
  cancelled?: boolean;
  depositDate?: string;
  evidenceFileUrl?: string;
  memo?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceReferralDepositDashboard {
  yearMonth: string;
  expectedAmount: number;
  depositAmount: number;
  depositRate: number;
  verifiedCount: number;
  differenceAmount: number;
}

export interface ServiceReferralReceivable {
  id?: string;
  receivableId?: string;
  referrerId: string;
  referrerName: string;
  month: string;
  expectedAmount: number;
  receivedAmount: number;
  receivableAmount: number;
  overdueDays: number;
  status: ServiceReferralReceivableStatus;
  memo?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceReferralReceivableDashboard {
  month: string;
  totalReceivableAmount: number;
  recoveryRate: number;
  overdueCount: number;
  expectedRecoveryAmount: number;
  openCount: number;
}

export interface ServiceReferralReceivableStatistics {
  monthlyRows: Array<{
    month: string;
    expectedAmount: number;
    receivedAmount: number;
    receivableAmount: number;
    recoveryRate: number;
  }>;
  referrerRows: Array<{
    referrerId: string;
    referrerName: string;
    receivableAmount: number;
    overdueDays: number;
    status: ServiceReferralReceivableStatus;
  }>;
}

export const DEFAULT_SERVICE_REFERRAL_SETTINGS: ServiceReferralSettings = {
  id: 'default',
  introFeeIncomePerDay: 60000,
  introFeePayoutPerDay: 60000,
  introFeeMaxDays: 5,
  dailyCommissionPerDay: 5000,
  confirmAfterWorkDays: 5,
  countMode: 'unique_work_date',
};

export interface ServiceWorkerCandidate {
  workerId: string;
  workerName: string;
  source?: ServiceWorkerReferralSource;
  teamId?: string;
  teamName?: string;
  teamType?: string;
  payType?: string;
  salaryModel?: string;
  status?: string;
  contact?: string;
  firstWorkDate?: string;
  lastWorkDate?: string;
  workDays?: number;
  siteNames?: string[];
  reportIds?: string[];
  isHistorical?: boolean;
  existingReferral?: ServiceWorkerReferral;
}

export interface RecruitingDashboardSummary {
  yearMonth: string;
  introIncomeTotal: number;
  introPayoutTotal: number;
  dailyCommissionTotal: number;
  netProfit: number;
  pendingWorkerCount: number;
  stoppedCandidateCount: number;
  payableSettlementCount: number;
  paidSettlementCount: number;
}

export interface RecruitingMonthlyStatistics {
  yearMonth: string;
  referrerRows: Array<{
    referrerId: string;
    referrerName: string;
    workerCount: number;
    workDays: number;
    achievedCount: number;
    stoppedCount: number;
    achievementRate: number;
    stopRate: number;
    introIncomeTotal: number;
    introPayoutTotal: number;
    dailyCommissionTotal: number;
    netProfit: number;
  }>;
  siteRows: Array<{
    siteName: string;
    workerCount: number;
    workDays: number;
    manDay: number;
  }>;
  monthlyRows: Array<{
    yearMonth: string;
    introIncomeTotal: number;
    introPayoutTotal: number;
    dailyCommissionTotal: number;
    netProfit: number;
  }>;
}
