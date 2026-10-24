import { createHash } from 'crypto';
import { AiReportCadence } from './contract';
import { WorkspaceError } from './domain';

export const REPORT_LEASE_MS = 10 * 60 * 1000;
export const REPORT_MAX_ATTEMPTS = 3;
export const PAUSED_REPORT_DATE = '9999-12-31T00:00:00.000Z';
export function validateCadence(value: any): AiReportCadence {
  const invalid = () => { throw new WorkspaceError('invalid-argument', '실행 주기와 한국 시간, 요일 또는 날짜를 확인해 주세요. 매월 날짜는 1~28일입니다.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['frequency', 'time', 'weekday', 'monthDay'].includes(key))) invalid();
  if (!['daily', 'weekly', 'monthly'].includes(value.frequency) || typeof value.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) invalid();
  if (value.frequency === 'weekly' ? !Number.isInteger(value.weekday) || value.weekday < 1 || value.weekday > 7 : value.weekday !== null) invalid();
  if (value.frequency === 'monthly' ? !Number.isInteger(value.monthDay) || value.monthDay < 1 || value.monthDay > 28 : value.monthDay !== null) invalid();
  return { frequency: value.frequency, time: value.time, weekday: value.weekday, monthDay: value.monthDay };
}
// Strictly after the anchor; Korea has no DST. Never infer a missing day (29~31).
export function nextReportAt(value: AiReportCadence, after = new Date()): string {
  const cadence = validateCadence(value), korea = new Date(after.getTime() + 9 * 3600000);
  const [hour, minute] = cadence.time.split(':').map(Number);
  for (let offset = 0; offset <= 32; offset++) {
    const day = new Date(Date.UTC(korea.getUTCFullYear(), korea.getUTCMonth(), korea.getUTCDate() + offset, hour, minute));
    if (cadence.frequency === 'weekly' && (day.getUTCDay() || 7) !== cadence.weekday) continue;
    if (cadence.frequency === 'monthly' && day.getUTCDate() !== cadence.monthDay) continue;
    const utc = new Date(day.getTime() - 9 * 3600000);
    if (utc > after) return utc.toISOString();
  }
  throw new WorkspaceError('invalid-argument', '다음 실행 시간을 계산하지 못했습니다.');
}
export const reportRunId = (id: string, revision: number, dueAt: string) => createHash('sha256').update(JSON.stringify([id, revision, dueAt])).digest('hex');
export function reportFailure(error: unknown): { message: string; retryable: boolean; pause: boolean } {
  const code = String((error as { code?: unknown })?.code || '').replace('functions/', '');
  if (['permission-denied', 'unauthenticated', 'auth/user-not-found', 'auth/user-disabled'].includes(code))
    return { message: '계정 또는 조회 권한이 변경되어 예약을 중지했습니다. 권한과 저장 조건을 확인한 뒤 예약을 다시 저장해 주세요.', retryable: false, pause: true };
  if (['failed-precondition', 'invalid-argument', 'resource-exhausted'].includes(code))
    return { message: '저장 조건·대상 또는 조회 크기를 확인해야 합니다. 조건을 수정한 뒤 예약을 다시 저장해 주세요.', retryable: false, pause: true };
  return { message: '보고서를 생성하지 못했습니다. 같은 예정 시각의 조건으로 다시 시도할 수 있습니다.', retryable: true, pause: false };
}
