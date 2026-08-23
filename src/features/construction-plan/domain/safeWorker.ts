import type { SafeWorkerDto, SafeWorkerStatus } from '../types';
import { SafeWorkerDtoSchema } from '../types';

type UnknownRecord = Record<string, unknown>;

export type SafeWorkerProjectionOptions = {
  includeContact?: boolean;
  includePhoto?: boolean;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (record: UnknownRecord, keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const normalizeWorkerStatus = (record: UnknownRecord): SafeWorkerStatus => {
  if (record.isActive === false) return 'inactive';
  const status = (readString(record, ['status']) ?? '').toLowerCase();
  if (['퇴사', '비활성', 'inactive', 'terminated', 'resigned'].includes(status)) return 'inactive';
  if (['휴직', '휴가', 'on_leave', 'leave'].includes(status)) return 'on_leave';
  if (record.isActive === true || ['재직', '활성', 'active', 'working'].includes(status)) return 'active';
  return 'unknown';
};

/**
 * Projects a worker/master record onto the only fields permitted in a plan.
 * Sensitive identity, payroll, banking and address fields are never copied.
 */
export const toSafeWorkerDto = (
  value: unknown,
  options: SafeWorkerProjectionOptions = {},
): SafeWorkerDto | null => {
  if (!isRecord(value)) return null;

  const id = readString(value, ['id', 'uid', 'legacyId']);
  const name = readString(value, ['name']);
  if (!id || !name) return null;

  const candidate: SafeWorkerDto = {
    id,
    name,
    status: normalizeWorkerStatus(value),
  };

  const role = readString(value, ['role']);
  const position = readString(value, ['position', 'rank']);
  const teamId = readString(value, ['teamId']);
  const teamName = readString(value, ['teamName']);
  const siteId = readString(value, ['siteId']);
  const photoUrl = options.includePhoto === false
    ? undefined
    : readString(value, ['profileImageUrl', 'photoUrl']);
  const contact = options.includeContact
    ? readString(value, ['contact', 'phone'])
    : undefined;

  if (role) candidate.role = role;
  if (position) candidate.position = position;
  if (teamId) candidate.teamId = teamId;
  if (teamName) candidate.teamName = teamName;
  if (siteId) candidate.siteId = siteId;
  if (photoUrl) candidate.photoUrl = photoUrl;
  if (contact) candidate.contact = contact;

  return SafeWorkerDtoSchema.parse(candidate);
};

export const toSafeWorkerDtos = (
  values: readonly unknown[],
  options: SafeWorkerProjectionOptions = {},
): SafeWorkerDto[] => values
  .map((value) => toSafeWorkerDto(value, options))
  .filter((value): value is SafeWorkerDto => value !== null);
