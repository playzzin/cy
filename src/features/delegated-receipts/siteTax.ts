import { calculateExpectedAmount, DelegatedClaim } from './model';
import type { ReceiptDirectory } from './teamDirectory';

export interface SiteTaxTarget { key: string; name: string; }
export interface SiteTaxSetting extends SiteTaxTarget { taxRate: number | null; revision: number; operationId: string; updatedAt: string; }
export interface SiteTaxSelection { id: string; updatedAt: string; }
export interface SiteTaxRequest { target: SiteTaxTarget; taxRate: number | null; revision: number; operationId: string; month: string; selected: SiteTaxSelection[]; }
const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
export function siteTaxTarget(site: { siteId?: string; siteName: string }, directory: ReceiptDirectory): SiteTaxTarget {
  const matches = directory.sites.filter(value => normalize(value.name) === normalize(site.siteName));
  const id = site.siteId || (matches.length === 1 ? matches[0].id : undefined);
  return { key: JSON.stringify([id ? 'id' : 'name', id || normalize(site.siteName)]), name: directory.sites.find(value => value.id === id)?.name || site.siteName };
}
export function siteTaxRate(siteId: string, settings: SiteTaxSetting[]): string {
  const rate = settings.find(value => value.key === JSON.stringify(['id', siteId]))?.taxRate;
  return rate === null || rate === undefined ? '' : String(rate);
}
export function parseSiteTax(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(?:\.\d+)?$/.test(value.trim()) || !Number.isFinite(Number(value)) || Number(value) > 100) throw new Error('세율은 0~100%로 입력하거나 비워 두세요.');
  return Number(value);
}
export function recalculateSiteClaim(claim: DelegatedClaim, taxRate: number, recordedAt: string): DelegatedClaim {
  if (claim.grossAmount === null) throw new Error('세전 금액이 있는 내역만 재계산할 수 있습니다.');
  const amounts = calculateExpectedAmount(claim.grossAmount, taxRate);
  return { ...claim, ...amounts, taxRate,
    originalGrossAmount: claim.originalGrossAmount !== undefined ? claim.originalGrossAmount : claim.grossAmount,
    originalExpectedAmount: claim.originalExpectedAmount !== undefined ? claim.originalExpectedAmount : claim.expectedAmount,
    updatedAt: recordedAt };
}
