import { getAccessRoleGroups, uniqueAccessRoles } from '../../utils/accessRoles';
import type { BankNotificationPermissions } from './types';

export const collectBankAccessRoles = (profile: {
  role?: unknown;
  position?: unknown;
  additionalPositions?: unknown;
  systemRole?: unknown;
  accountType?: unknown;
  roles?: unknown;
} | null | undefined): string[] => uniqueAccessRoles([
  profile?.role,
  profile?.position,
  profile?.systemRole,
  profile?.accountType,
  ...(Array.isArray(profile?.additionalPositions) ? profile.additionalPositions : []),
  ...(Array.isArray(profile?.roles) ? profile.roles : []),
]);

/**
 * Banking events are intentionally more restrictive than ordinary ERP data.
 * Read access is limited to financial/audit roles, while configuration is admin-only.
 */
export const resolveBankNotificationPermissions = (
  roles: unknown[],
  authenticated = true,
): BankNotificationPermissions => {
  if (!authenticated) {
    return {
      canView: false,
      canReview: false,
      canConfigure: false,
      canManageOwnDevice: false,
    };
  }

  const groups = getAccessRoleGroups(roles);
  const hasGroup = (...allowed: typeof groups) => allowed.some((group) => groups.includes(group));
  const isAdmin = hasGroup('admin');
  const canView = hasGroup('admin', 'finance', 'payroll', 'audit');

  return {
    canView,
    canReview: hasGroup('admin', 'finance', 'payroll'),
    canConfigure: isAdmin,
    canManageOwnDevice: canView,
  };
};
