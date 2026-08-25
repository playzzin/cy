import type { UserData } from '../services/userService';

export const CARD_EXPENSE_AUDIT_ROLE_KEYS = new Set([
  'ceo',
  '대표',
  '사장',
  'pos_ceo',
  'dev',
  'developer',
  '개발',
  '개발자',
]);

const normalizeRole = (value: unknown): string => String(value ?? '').trim().normalize('NFKC').toLowerCase();

export const getCardExpenseAuditRoles = (
  profile: Pick<UserData, 'role' | 'position' | 'additionalPositions'> | null | undefined,
): string[] => {
  if (!profile) return [];
  return [
    profile.role,
    profile.position,
    ...(Array.isArray(profile.additionalPositions) ? profile.additionalPositions : []),
  ].map(normalizeRole).filter(Boolean);
};

export const canAccessCardExpenseAudit = (
  profile: Pick<UserData, 'role' | 'position' | 'additionalPositions'> | null | undefined,
): boolean => getCardExpenseAuditRoles(profile).some((role) => CARD_EXPENSE_AUDIT_ROLE_KEYS.has(role));
