import { recruitingReferrerRepository } from '../repositories/recruitingReferrerRepository';
import { serviceReferralPaymentRepository } from '../repositories/serviceReferralPaymentRepository';
import { serviceReferralSettlementRepository } from '../repositories/serviceReferralSettlementRepository';
import { serviceWorkerReferralRepository } from '../repositories/serviceWorkerReferralRepository';
import type {
  ServiceReferralMonthlySettlement,
  ServiceReferralPayment,
  ServiceReferralPaymentDashboard,
  ServiceReferralPaymentStatus,
} from '../types/recruiting';
import { recruitingExcelService } from './recruitingExcelService';
import { serviceWorkerHistoryService } from './serviceWorkerHistoryService';
import { toast } from '../utils/swal';

const toNumber = (value: unknown): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};
const today = (): string => new Date().toISOString().slice(0, 10);
const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);
const sanitizeDocId = (value: string): string => value.replace(/[\\/#?[\]]/g, '_');

const buildPaymentId = (settlementId: string): string => sanitizeDocId(`payment__${settlementId}`);

const shouldKeepStatus = (status?: ServiceReferralPaymentStatus): boolean =>
  status === 'paid' || status === 'cancelled';

const paymentFromSettlement = (
  settlement: ServiceReferralMonthlySettlement,
  existing?: ServiceReferralPayment,
  bank?: { bankName?: string; accountNumber?: string; accountHolder?: string }
): ServiceReferralPayment => {
  const id = buildPaymentId(settlement.id || `${settlement.yearMonth}_${settlement.referrerId}`);
  const settlementPaid = settlement.status === 'paid';
  const status = shouldKeepStatus(existing?.paymentStatus)
    ? existing?.paymentStatus || 'pending'
    : settlementPaid
      ? 'paid'
      : existing?.paymentStatus === 'approved'
        ? 'approved'
        : 'pending';

  return {
    id,
    paymentId: id,
    settlementId: settlement.id || '',
    yearMonth: settlement.yearMonth,
    referrerId: settlement.referrerId,
    referrerName: settlement.referrerName,
    amount: toNumber(settlement.payableTotal),
    paymentStatus: status,
    paymentDate: existing?.paymentDate || settlement.paidAt?.slice(0, 10) || '',
    bankName: existing?.bankName || bank?.bankName || '',
    accountNumber: existing?.accountNumber || bank?.accountNumber || '',
    accountHolder: existing?.accountHolder || bank?.accountHolder || settlement.referrerName,
    memo: existing?.memo || settlement.memo || '',
    createdAt: existing?.createdAt,
  };
};

export const serviceReferralPaymentService = {
  async syncPaymentsFromSettlements(yearMonth: string = currentYearMonth()): Promise<ServiceReferralPayment[]> {
    const [settlements, payments, referrers] = await Promise.all([
      serviceReferralSettlementRepository.listByMonth(yearMonth),
      serviceReferralPaymentRepository.listByMonth(yearMonth),
      recruitingReferrerRepository.list(),
    ]);
    const existingBySettlement = new Map(payments.map((payment) => [payment.settlementId, payment]));
    const referrerById = new Map(referrers.map((referrer) => [referrer.id || '', referrer]));

    const nextPayments = settlements
      .filter((settlement) => settlement.id && settlement.payableTotal > 0 && ['confirmed', 'paid'].includes(settlement.status))
      .map((settlement) => paymentFromSettlement(
        settlement,
        existingBySettlement.get(settlement.id || ''),
        referrerById.get(settlement.referrerId)
      ));

    await serviceReferralPaymentRepository.saveMany(nextPayments);
    return serviceReferralPaymentRepository.listByMonth(yearMonth);
  },

  async listPayments(yearMonth: string = currentYearMonth(), status: ServiceReferralPaymentStatus | 'all' = 'all'): Promise<ServiceReferralPayment[]> {
    return serviceReferralPaymentRepository.listByMonth(yearMonth, status);
  },

  async approvePayment(paymentId: string): Promise<void> {
    await serviceReferralPaymentRepository.update(paymentId, { paymentStatus: 'approved' });
    toast.updated('지급 승인');
  },

  async payPayment(paymentId: string, userId?: string, paymentDate: string = today()): Promise<void> {
    const payment = await serviceReferralPaymentRepository.get(paymentId);
    if (!payment) throw new Error('지급 문서를 찾을 수 없습니다.');
    await serviceReferralPaymentRepository.update(paymentId, {
      paymentStatus: 'paid',
      paymentDate,
    });
    if (payment.settlementId) {
      await serviceReferralSettlementRepository.update(payment.settlementId, {
        status: 'paid',
        paidAt: new Date().toISOString(),
        updatedBy: userId || '',
      });
      const lines = await serviceWorkerReferralRepository.listDailyLinesByMonthAndReferrer(payment.yearMonth, payment.referrerId);
      await Promise.all(
        lines
          .filter((line) => line.status === 'confirmed' || line.status === 'overridden')
          .map((line) => serviceWorkerHistoryService.logEvent({
            workerId: line.workerId,
            workerName: line.workerName,
            eventType: '지급완료',
            eventDate: paymentDate,
            referrerId: line.referrerId,
            referrerName: line.referrerName,
            siteName: line.siteNames[0] || '',
            teamName: line.teamName || '',
            newValue: String(payment.amount),
            createdBy: userId || '',
          }))
      );
    }
    toast.saved('지급 완료', 1);
  },

  async cancelPayment(paymentId: string): Promise<void> {
    await serviceReferralPaymentRepository.update(paymentId, { paymentStatus: 'cancelled' });
    toast.updated('지급 취소');
  },

  async bulkApprove(paymentIds: string[]): Promise<void> {
    await Promise.all(paymentIds.map((id) => this.approvePayment(id)));
    toast.processed(`지급 ${paymentIds.length}건 승인`);
  },

  async bulkPay(paymentIds: string[], userId?: string, paymentDate: string = today()): Promise<void> {
    await Promise.all(paymentIds.map((id) => this.payPayment(id, userId, paymentDate)));
    toast.processed(`지급 ${paymentIds.length}건 완료`);
  },

  async getDashboardSummary(yearMonth: string = currentYearMonth()): Promise<ServiceReferralPaymentDashboard> {
    const [monthPayments, allPayments] = await Promise.all([
      serviceReferralPaymentRepository.listByMonth(yearMonth),
      serviceReferralPaymentRepository.listAll(),
    ]);
    return {
      yearMonth,
      pendingAmount: monthPayments
        .filter((payment) => payment.paymentStatus === 'pending' || payment.paymentStatus === 'approved')
        .reduce((sum, payment) => sum + toNumber(payment.amount), 0),
      currentMonthPaidAmount: monthPayments
        .filter((payment) => payment.paymentStatus === 'paid')
        .reduce((sum, payment) => sum + toNumber(payment.amount), 0),
      cumulativePaidAmount: allPayments
        .filter((payment) => payment.paymentStatus === 'paid')
        .reduce((sum, payment) => sum + toNumber(payment.amount), 0),
      pendingCount: monthPayments.filter((payment) => payment.paymentStatus === 'pending' || payment.paymentStatus === 'approved').length,
      paidCount: monthPayments.filter((payment) => payment.paymentStatus === 'paid').length,
    };
  },

  async getPaymentTrend(): Promise<Array<{ month: string; pendingAmount: number; paidAmount: number }>> {
    const payments = await serviceReferralPaymentRepository.listAll();
    const grouped = new Map<string, { pendingAmount: number; paidAmount: number }>();
    payments.forEach((payment) => {
      const current = grouped.get(payment.yearMonth) || { pendingAmount: 0, paidAmount: 0 };
      if (payment.paymentStatus === 'paid') current.paidAmount += toNumber(payment.amount);
      if (payment.paymentStatus === 'pending' || payment.paymentStatus === 'approved') current.pendingAmount += toNumber(payment.amount);
      grouped.set(payment.yearMonth, current);
    });
    return Array.from(grouped.entries())
      .map(([month, value]) => ({ month, ...value }))
      .sort((left, right) => left.month.localeCompare(right.month));
  },

  async downloadPaymentsExcel(yearMonth: string = currentYearMonth()): Promise<void> {
    const payments = await serviceReferralPaymentRepository.listByMonth(yearMonth);
    await recruitingExcelService.download(`지급내역_${yearMonth}.xlsx`, [
      {
        name: '지급 내역',
        rows: payments.map((payment) => ({
          월: payment.yearMonth,
          소개자: payment.referrerName,
          정산ID: payment.settlementId,
          지급금액: payment.amount,
          상태: payment.paymentStatus,
          지급일: payment.paymentDate || '',
          은행: payment.bankName || '',
          계좌번호: payment.accountNumber || '',
          예금주: payment.accountHolder || '',
          메모: payment.memo || '',
        })),
      },
    ]);
    toast.processed('지급내역 Excel 다운로드');
  },
};
