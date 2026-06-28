import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';
import { serviceReferralDepositRepository } from '../repositories/serviceReferralDepositRepository';
import { serviceReferralSettlementRepository } from '../repositories/serviceReferralSettlementRepository';
import type { ServiceReferralDeposit, ServiceReferralDepositDashboard } from '../types/recruiting';
import { recruitingExcelService } from './recruitingExcelService';
import { serviceReferralReceivableService } from './serviceReferralReceivableService';
import { toast } from '../utils/swal';

const toNumber = (value: unknown): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};
const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);
const today = (): string => new Date().toISOString().slice(0, 10);
const sanitizeDocId = (value: string): string => value.replace(/[\\/#?[\]]/g, '_');
const buildDepositId = (yearMonth: string, referrerId: string): string => sanitizeDocId(`deposit__${yearMonth}__${referrerId}`);

const normalizeDeposit = (input: Partial<ServiceReferralDeposit>, existing?: ServiceReferralDeposit | null): ServiceReferralDeposit => {
  const expectedAmount = toNumber(input.expectedAmount ?? existing?.expectedAmount);
  const depositAmount = toNumber(input.depositAmount ?? existing?.depositAmount);
  const yearMonth = String(input.yearMonth || existing?.yearMonth || currentYearMonth());
  const referrerId = String(input.referrerId || existing?.referrerId || '');
  const id = String(input.id || input.depositId || existing?.id || existing?.depositId || buildDepositId(yearMonth, referrerId));
  return {
    id,
    depositId: id,
    yearMonth,
    referrerId,
    referrerName: String(input.referrerName || existing?.referrerName || ''),
    expectedAmount,
    depositAmount,
    difference: expectedAmount - depositAmount,
    verified: Boolean(input.verified ?? existing?.verified ?? false),
    cancelled: Boolean(input.cancelled ?? existing?.cancelled ?? false),
    depositDate: String(input.depositDate || existing?.depositDate || today()),
    evidenceFileUrl: String(input.evidenceFileUrl || existing?.evidenceFileUrl || ''),
    memo: String(input.memo ?? existing?.memo ?? ''),
    createdAt: existing?.createdAt,
  };
};

export const serviceReferralDepositService = {
  async syncExpectedDepositsFromSettlements(yearMonth: string = currentYearMonth()): Promise<ServiceReferralDeposit[]> {
    const [settlements, deposits] = await Promise.all([
      serviceReferralSettlementRepository.listByMonth(yearMonth),
      serviceReferralDepositRepository.listByMonth(yearMonth),
    ]);
    const existingByReferrer = new Map(deposits.map((deposit) => [deposit.referrerId, deposit]));
    const grouped = new Map<string, { referrerId: string; referrerName: string; expectedAmount: number }>();
    settlements.forEach((settlement) => {
      if (!settlement.referrerId || settlement.introIncomeTotal <= 0) return;
      const current = grouped.get(settlement.referrerId) || {
        referrerId: settlement.referrerId,
        referrerName: settlement.referrerName,
        expectedAmount: 0,
      };
      current.expectedAmount += toNumber(settlement.introIncomeTotal);
      grouped.set(settlement.referrerId, current);
    });

    await Promise.all(Array.from(grouped.values()).map((row) => {
      const existing = existingByReferrer.get(row.referrerId);
      return serviceReferralDepositRepository.save(normalizeDeposit({
        id: existing?.id || buildDepositId(yearMonth, row.referrerId),
        yearMonth,
        referrerId: row.referrerId,
        referrerName: row.referrerName,
        expectedAmount: row.expectedAmount,
        depositAmount: existing?.depositAmount || 0,
        verified: existing?.verified || false,
        depositDate: existing?.depositDate || today(),
        evidenceFileUrl: existing?.evidenceFileUrl || '',
        memo: existing?.memo || '',
      }, existing));
    }));

    return serviceReferralDepositRepository.listByMonth(yearMonth);
  },

  async listDeposits(yearMonth: string = currentYearMonth(), verified: boolean | 'all' = 'all'): Promise<ServiceReferralDeposit[]> {
    return serviceReferralDepositRepository.listByMonth(yearMonth, verified);
  },

  async saveDeposit(input: Partial<ServiceReferralDeposit>): Promise<string> {
    const existing = input.id ? await serviceReferralDepositRepository.get(input.id) : null;
    const deposit = normalizeDeposit(input, existing);
    if (!deposit.referrerId || !deposit.referrerName) throw new Error('소개자 정보가 필요합니다.');
    const id = await serviceReferralDepositRepository.save(deposit);
    await serviceReferralReceivableService.upsertFromDeposit({ ...deposit, id });
    toast.saved('입금', 1);
    return id;
  },

  async cancelDeposit(depositId: string): Promise<void> {
    const deposit = await serviceReferralDepositRepository.get(depositId);
    if (!deposit) throw new Error('입금 문서를 찾을 수 없습니다.');
    const cancelled: ServiceReferralDeposit = {
      ...deposit,
      cancelled: true,
      verified: false,
      difference: toNumber(deposit.expectedAmount),
      depositAmount: 0,
    };
    await serviceReferralDepositRepository.update(depositId, cancelled);
    await serviceReferralReceivableService.upsertFromDeposit(cancelled);
    toast.updated('입금 취소');
  },

  async verifyDeposit(depositId: string): Promise<void> {
    const deposit = await serviceReferralDepositRepository.get(depositId);
    if (!deposit) throw new Error('입금 문서를 찾을 수 없습니다.');
    const verified: ServiceReferralDeposit = {
      ...deposit,
      verified: true,
      cancelled: false,
      difference: toNumber(deposit.expectedAmount) - toNumber(deposit.depositAmount),
    };
    await serviceReferralDepositRepository.update(depositId, verified);
    await serviceReferralReceivableService.upsertFromDeposit(verified);
    toast.updated('입금 확인');
  },

  async uploadEvidence(file: File, depositId?: string): Promise<string> {
    const safeName = file.name.replace(/[\\/#?[\]]/g, '_');
    const path = `recruiting/deposits/${depositId || currentYearMonth()}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);
    const result = await uploadBytes(storageRef, file);
    return getDownloadURL(result.ref);
  },

  async getDashboardSummary(yearMonth: string = currentYearMonth()): Promise<ServiceReferralDepositDashboard> {
    const [deposits, settlements] = await Promise.all([
      serviceReferralDepositRepository.listByMonth(yearMonth),
      serviceReferralSettlementRepository.listByMonth(yearMonth),
    ]);
    const settlementExpected = settlements.reduce((sum, settlement) => sum + toNumber(settlement.introIncomeTotal), 0);
    const expected = deposits.length > 0
      ? deposits.filter((deposit) => !deposit.cancelled).reduce((sum, deposit) => sum + toNumber(deposit.expectedAmount), 0)
      : settlementExpected;
    const actual = deposits
      .filter((deposit) => !deposit.cancelled)
      .reduce((sum, deposit) => sum + toNumber(deposit.depositAmount), 0);
    return {
      yearMonth,
      expectedAmount: expected,
      depositAmount: actual,
      depositRate: expected > 0 ? Math.round((actual / expected) * 1000) / 10 : 0,
      verifiedCount: deposits.filter((deposit) => deposit.verified && !deposit.cancelled).length,
      differenceAmount: expected - actual,
    };
  },

  async getDepositTrend(): Promise<Array<{ month: string; expectedAmount: number; depositAmount: number }>> {
    const rows = await serviceReferralDepositRepository.listAll();
    const grouped = new Map<string, { expectedAmount: number; depositAmount: number }>();
    rows.filter((deposit) => !deposit.cancelled).forEach((deposit) => {
      const current = grouped.get(deposit.yearMonth) || { expectedAmount: 0, depositAmount: 0 };
      current.expectedAmount += toNumber(deposit.expectedAmount);
      current.depositAmount += toNumber(deposit.depositAmount);
      grouped.set(deposit.yearMonth, current);
    });
    return Array.from(grouped.entries())
      .map(([month, value]) => ({ month, ...value }))
      .sort((left, right) => left.month.localeCompare(right.month));
  },

  async downloadDepositsExcel(yearMonth: string = currentYearMonth()): Promise<void> {
    const deposits = await serviceReferralDepositRepository.listByMonth(yearMonth);
    await recruitingExcelService.download(`입금내역_${yearMonth}.xlsx`, [
      {
        name: '입금 내역',
        rows: deposits.map((deposit) => ({
          월: deposit.yearMonth,
          소개자: deposit.referrerName,
          예정입금: deposit.expectedAmount,
          실제입금: deposit.depositAmount,
          차액: deposit.difference,
          확인: deposit.verified ? '확인' : '미확인',
          취소: deposit.cancelled ? '취소' : '',
          입금일: deposit.depositDate || '',
          증빙파일: deposit.evidenceFileUrl || '',
          메모: deposit.memo || '',
        })),
      },
    ]);
    toast.processed('입금내역 Excel 다운로드');
  },
};
