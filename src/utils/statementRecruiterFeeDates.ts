/** Stored dates are explicit fee charge dates, never inferred from attendance or man-days. */
export function normalizeStatementRecruiterFeeDates(month: string, value: unknown): string[] {
  if (!Array.isArray(value) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return [...new Set(value.filter((date): date is string => typeof date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(date) && date.slice(0, 7) === month
    && Number(date.slice(8)) >= 1 && Number(date.slice(8)) <= lastDay))].sort();
}
