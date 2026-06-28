import { recruitingReferrerRepository } from '../repositories/recruitingReferrerRepository';
import { DEFAULT_SERVICE_REFERRAL_SETTINGS, RecruitingReferrer } from '../types/recruiting';
import { toast } from '../utils/swal';

const withDefaultRates = (input: Partial<RecruitingReferrer>): RecruitingReferrer => ({
  type: input.type || 'agency',
  linkedEntityId: input.linkedEntityId || '',
  name: String(input.name || '').trim(),
  contact: input.contact || '',
  bankName: input.bankName || '',
  accountNumber: input.accountNumber || '',
  accountHolder: input.accountHolder || input.name || '',
  defaultIntroFeeIncomePerDay: Number(input.defaultIntroFeeIncomePerDay ?? DEFAULT_SERVICE_REFERRAL_SETTINGS.introFeeIncomePerDay),
  defaultIntroFeePayoutPerDay: Number(input.defaultIntroFeePayoutPerDay ?? DEFAULT_SERVICE_REFERRAL_SETTINGS.introFeePayoutPerDay),
  defaultIntroFeeMaxDays: Number(input.defaultIntroFeeMaxDays ?? DEFAULT_SERVICE_REFERRAL_SETTINGS.introFeeMaxDays),
  defaultDailyCommission: Number(input.defaultDailyCommission ?? DEFAULT_SERVICE_REFERRAL_SETTINGS.dailyCommissionPerDay),
  status: input.status || 'active',
  memo: input.memo || '',
});

export const recruitingReferrerService = {
  async listReferrers(): Promise<RecruitingReferrer[]> {
    return recruitingReferrerRepository.list();
  },

  async listActiveReferrers(): Promise<RecruitingReferrer[]> {
    return recruitingReferrerRepository.listActive();
  },

  async createReferrer(input: Partial<RecruitingReferrer>): Promise<string> {
    const referrer = withDefaultRates(input);
    if (!referrer.name) {
      throw new Error('소개자명은 필수입니다.');
    }
    const id = await recruitingReferrerRepository.create(referrer);
    toast.saved('소개자', 1);
    return id;
  },

  async updateReferrer(id: string, updates: Partial<RecruitingReferrer>): Promise<void> {
    const normalizedUpdates: Partial<RecruitingReferrer> = { ...updates };
    if (updates.name !== undefined) {
      normalizedUpdates.name = String(updates.name || '').trim();
      if (!normalizedUpdates.name) throw new Error('소개자명은 필수입니다.');
    }
    [
      'defaultIntroFeeIncomePerDay',
      'defaultIntroFeePayoutPerDay',
      'defaultIntroFeeMaxDays',
      'defaultDailyCommission',
    ].forEach((key) => {
      const value = (normalizedUpdates as Record<string, unknown>)[key];
      if (value !== undefined) {
        (normalizedUpdates as Record<string, unknown>)[key] = Number(value || 0);
      }
    });
    await recruitingReferrerRepository.update(id, normalizedUpdates);
    toast.updated('소개자');
  },

  async deleteReferrer(id: string): Promise<void> {
    await recruitingReferrerRepository.delete(id);
    toast.deleted('소개자', 1);
  },
};
