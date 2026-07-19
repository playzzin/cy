import {
  collectBankAccessRoles,
  resolveBankNotificationPermissions,
} from './bankNotificationPermissions';

describe('bankNotificationPermissions', () => {
  it('collects all Firestore-rule role sources without duplicates', () => {
    expect(collectBankAccessRoles({
      role: 'user',
      position: '회계',
      systemRole: 'finance_manager',
      accountType: 'office',
      additionalPositions: ['회계', '정산담당'],
      roles: ['audit'],
    })).toEqual(['user', '회계', 'finance_manager', 'office', '정산담당', 'audit']);
  });

  it('grants admin full access', () => {
    expect(resolveBankNotificationPermissions(['admin'])).toEqual({
      canView: true,
      canReview: true,
      canConfigure: true,
      canManageOwnDevice: true,
    });
  });

  it('allows finance and payroll to review but not change global settings', () => {
    expect(resolveBankNotificationPermissions(['finance_manager'])).toMatchObject({
      canView: true,
      canReview: true,
      canConfigure: false,
    });
    expect(resolveBankNotificationPermissions(['PAYROLL_MANAGER'])).toMatchObject({
      canView: true,
      canReview: true,
      canConfigure: false,
    });
  });

  it('keeps auditors read-only and denies ordinary office accounts', () => {
    expect(resolveBankNotificationPermissions(['audit'])).toEqual({
      canView: true,
      canReview: false,
      canConfigure: false,
      canManageOwnDevice: true,
    });
    expect(resolveBankNotificationPermissions(['OFFICE_STAFF']).canView).toBe(false);
    expect(resolveBankNotificationPermissions(['admin'], false).canView).toBe(false);
  });
});
