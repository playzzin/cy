import { serviceReferralDepositRepository } from '../repositories/serviceReferralDepositRepository';
import { serviceReferralReceivableRepository } from '../repositories/serviceReferralReceivableRepository';
import { serviceReferralSettlementRepository } from '../repositories/serviceReferralSettlementRepository';
import type {
  ServiceReferralDeposit,
  ServiceReferralReceivable,
  ServiceReferralReceivableDashboard,
  ServiceReferralReceivableStatistics,
  ServiceReferralReceivableStatus,
} from '../types/recruiting';
import { recruitingExcelService } from './recruitingExcelService';
import { toast } from '../utils/swal';

const toNumber = (value: unknown): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};
const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);
const sanitizeDocId = (value: string): string => value.replace(/[\\/#?[\]]/g, '_');
const buildReceivableId = (month: string, referrerId: string): string => sanitizeDocId(`receivable__${month}__${referrerId}`);

const monthDueDate = (month: string): Date => {
  const [yearRaw, monthRaw] = month.split('-');
  return new Date(Number(yearRaw), Number(monthRaw), 10);
};

const getOverdueDays = (month: string): number => {
  const dueDate = monthDueDate(month);
  const diff = Date.now() - dueDate.getTime();
  return diff > 0 ? Math.floor(diff / 86400000) : 0;
};

const resolveStatus = (receivableAmount: number, receivedAmount: number, month: string): ServiceReferralReceivableStatus => {
  if (receivableAmount <= 0) return 'closed';
  if (getOverdueDays(month) > 0) return 'overdue';
  if (receivedAmount > 0) return 'partial';
  return 'pending';
};

const aggregateByReferrer = (rows: Array<{ referrerId: string; referrerName: string; expectedAmount: number; receivedAmount: number }>) => {
  const grouped = new Map<string, { referrerId: string; referrerName: string; expectedAmount: number; receivedAmount: number }>();
  rows.forEach((row) => {
    const current = grouped.get(row.referrerId) || {
      referrerId: row.referrerId,
      referrerName: row.referrerName,
      expectedAmount: 0,
      receivedAmount: 0,
    };
    current.expectedAmount += toNumber(row.expectedAmount);
    current.receivedAmount += toNumber(row.receivedAmount);
    grouped.set(row.referrerId, current);
  });
  return Array.from(grouped.values());
};

export const serviceReferralReceivableService = {
  async listReceivables(month: string = currentYearMonth(), status: ServiceReferralReceivableStatus | 'all' = 'all'): Promise<ServiceReferralReceivable[]> {
    const rows = await serviceReferralReceivableRepository.listByMonth(month, status);
    const refreshed = rows.map((row) => {
      const overdueDays = row.status === 'closed' ? 0 : getOverdueDays(row.month);
      const statusNext = resolveStatus(toNumber(row.receivableAmount), toNumber(row.receivedAmount), row.month);
      return overdueDays === row.overdueDays && statusNext === row.status
        ? row
        : { ...row, overdueDays, status: statusNext };
    });
    await Promise.all(
      refreshed
        .filter((row, index) => row.id && (row.overdueDays !== rows[index].overdueDays || row.status !== rows[index].status))
        .map((row) => serviceReferralReceivableRepository.update(row.id || '', {
          overdueDays: row.overdueDays,
          status: row.status,
        }))
    );
    return refreshed;
  },

  async upsertFromDeposit(deposit: ServiceReferralDeposit): Promise<void> {
    const expectedAmount = toNumber(deposit.expectedAmount);
    const receivedAmount = deposit.cancelled ? 0 : toNumber(deposit.depositAmount);
    const receivableAmount = Math.max(expectedAmount - receivedAmount, 0);
    const id = buildReceivableId(deposit.yearMonth, deposit.referrerId);
    await serviceReferralReceivableRepository.save({
      id,
      receivableId: id,
      referrerId: deposit.referrerId,
      referrerName: deposit.referrerName,
      month: deposit.yearMonth,
      expectedAmount,
      receivedAmount,
      receivableAmount,
      overdueDays: receivableAmount > 0 ? getOverdueDays(deposit.yearMonth) : 0,
      status: resolveStatus(receivableAmount, receivedAmount, deposit.yearMonth),
      memo: deposit.cancelled
        ? `입금 취소 반영: ${deposit.memo || ''}`
        : deposit.memo || '',
    });
  },

  async generateFromDeposits(month: string = currentYearMonth()): Promise<ServiceReferralReceivable[]> {
    const [deposits, settlements] = await Promise.all([
      serviceReferralDepositRepository.listByMonth(month),
      serviceReferralSettlementRepository.listByMonth(month),
    ]);
    const depositRows = deposits
      .filter((deposit) => !deposit.cancelled)
      .map((deposit) => ({
        referrerId: deposit.referrerId,
        referrerName: deposit.referrerName,
        expectedAmount: toNumber(deposit.expectedAmount),
        receivedAmount: toNumber(deposit.depositAmount),
      }));
    const settlementRows = settlements.map((settlement) => ({
      referrerId: settlement.referrerId,
      referrerName: settlement.referrerName,
      expectedAmount: toNumber(settlement.introIncomeTotal),
      receivedAmount: 0,
    }));
    const depositReferrers = new Set(depositRows.map((row) => row.referrerId));
    const rows = aggregateByReferrer([
      ...depositRows,
      ...settlementRows.filter((row) => !depositReferrers.has(row.referrerId)),
    ]);

    await Promise.all(rows.map((row) => {
      const receivableAmount = Math.max(row.expectedAmount - row.receivedAmount, 0);
      const id = buildReceivableId(month, row.referrerId);
      return serviceReferralReceivableRepository.save({
        id,
        receivableId: id,
        referrerId: row.referrerId,
        referrerName: row.referrerName,
        month,
        expectedAmount: row.expectedAmount,
        receivedAmount: row.receivedAmount,
        receivableAmount,
        overdueDays: receivableAmount > 0 ? getOverdueDays(month) : 0,
        status: resolveStatus(receivableAmount, row.receivedAmount, month),
        memo: '월별 입금/정산 기준 자동 생성',
      });
    }));

    return this.listReceivables(month);
  },

  async collectReceivable(receivableId: string, amount: number, memo?: string): Promise<void> {
    const receivable = await serviceReferralReceivableRepository.get(receivableId);
    if (!receivable) throw new Error('미수금 문서를 찾을 수 없습니다.');
    const receivedAmount = toNumber(receivable.receivedAmount) + toNumber(amount);
    const receivableAmount = Math.max(toNumber(receivable.expectedAmount) - receivedAmount, 0);
    await serviceReferralReceivableRepository.update(receivableId, {
      receivedAmount,
      receivableAmount,
      overdueDays: receivableAmount > 0 ? getOverdueDays(receivable.month) : 0,
      status: resolveStatus(receivableAmount, receivedAmount, receivable.month),
      memo: memo || receivable.memo || '',
    });
    toast.updated('미수금 회수');
  },

  async closeReceivable(receivableId: string, memo?: string): Promise<void> {
    const receivable = await serviceReferralReceivableRepository.get(receivableId);
    if (!receivable) throw new Error('미수금 문서를 찾을 수 없습니다.');
    await serviceReferralReceivableRepository.update(receivableId, {
      receivedAmount: receivable.expectedAmount,
      receivableAmount: 0,
      overdueDays: 0,
      status: 'closed',
      memo: memo || receivable.memo || '',
    });
    toast.updated('미수금 완납');
  },

  async getDashboardSummary(month: string = currentYearMonth()): Promise<ServiceReferralReceivableDashboard> {
    const rows = await this.listReceivables(month);
    const expected = rows.reduce((sum, row) => sum + toNumber(row.expectedAmount), 0);
    const received = rows.reduce((sum, row) => sum + toNumber(row.receivedAmount), 0);
    return {
      month,
      totalReceivableAmount: rows.reduce((sum, row) => sum + toNumber(row.receivableAmount), 0),
      recoveryRate: expected > 0 ? Math.round((received / expected) * 1000) / 10 : 0,
      overdueCount: rows.filter((row) => row.status === 'overdue').length,
      expectedRecoveryAmount: rows.filter((row) => row.status !== 'closed').reduce((sum, row) => sum + toNumber(row.receivableAmount), 0),
      openCount: rows.filter((row) => row.status !== 'closed').length,
    };
  },

  async getStatistics(): Promise<ServiceReferralReceivableStatistics> {
    const rows = await serviceReferralReceivableRepository.listAll();
    const monthly = new Map<string, { expectedAmount: number; receivedAmount: number; receivableAmount: number }>();
    rows.forEach((row) => {
      const current = monthly.get(row.month) || { expectedAmount: 0, receivedAmount: 0, receivableAmount: 0 };
      current.expectedAmount += toNumber(row.expectedAmount);
      current.receivedAmount += toNumber(row.receivedAmount);
      current.receivableAmount += toNumber(row.receivableAmount);
      monthly.set(row.month, current);
    });
    return {
      monthlyRows: Array.from(monthly.entries()).map(([month, value]) => ({
        month,
        ...value,
        recoveryRate: value.expectedAmount > 0 ? Math.round((value.receivedAmount / value.expectedAmount) * 1000) / 10 : 0,
      })).sort((left, right) => left.month.localeCompare(right.month)),
      referrerRows: rows
        .filter((row) => row.status !== 'closed' && row.receivableAmount > 0)
        .sort((left, right) => right.receivableAmount - left.receivableAmount)
        .slice(0, 20)
        .map((row) => ({
          referrerId: row.referrerId,
          referrerName: row.referrerName,
          receivableAmount: row.receivableAmount,
          overdueDays: row.overdueDays,
          status: row.status,
        })),
    };
  },

  async downloadReceivablesExcel(month: string = currentYearMonth()): Promise<void> {
    const rows = await this.listReceivables(month);
    await recruitingExcelService.download(`미수금_${month}.xlsx`, [
      {
        name: '미수금',
        rows: rows.map((row) => ({
          월: row.month,
          소개자: row.referrerName,
          예정금액: row.expectedAmount,
          입금금액: row.receivedAmount,
          미수금액: row.receivableAmount,
          연체일수: row.overdueDays,
          상태: row.status,
          메모: row.memo || '',
        })),
      },
    ]);
    toast.processed('미수금 Excel 다운로드');
  },
};
