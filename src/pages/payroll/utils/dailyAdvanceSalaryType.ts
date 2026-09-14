import { resolvePayType, resolveReportPayType } from '../../../utils/payType';

type SalaryTypeSnapshot = {
  salaryModel?: unknown;
  payType?: unknown;
};

type CurrentWorkerSalaryType = SalaryTypeSnapshot & {
  teamType?: unknown;
};

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

export const normalizeDailyAdvanceSalaryType = (...values: unknown[]): string => {
  const label = resolvePayType(...values) || '일급제';
  const normalized = normalizeText(label);

  if (
    normalized.includes('용역') ||
    normalized.includes('인력') ||
    normalized.includes('소개') ||
    normalized.includes('agency')
  ) {
    return '용역팀';
  }

  if (normalized.includes('일급제') || normalized.includes('일급') || normalized.includes('일당')) {
    return '일급제';
  }

  return label;
};

export const resolveDailyAdvanceRowSalaryType = (
  reportRow?: SalaryTypeSnapshot | null,
  currentWorker?: CurrentWorkerSalaryType | null
): string => normalizeDailyAdvanceSalaryType(resolveReportPayType(reportRow, currentWorker));
