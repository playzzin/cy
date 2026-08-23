const MAN_DAY_SCALE = 1_000;

export const roundManDay = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * MAN_DAY_SCALE) / MAN_DAY_SCALE;
};

export const sumManDays = (values: Array<number | string | null | undefined>): number => (
  values.reduce<number>((total, value) => {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').trim());
    return roundManDay(total + (Number.isFinite(parsed) ? parsed : 0));
  }, 0)
);

export const formatManDayWithDecimal = (value: number, emptyZero = true): string => {
  const normalized = roundManDay(value);
  if (emptyZero && normalized === 0) return '';
  return normalized.toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  });
};
