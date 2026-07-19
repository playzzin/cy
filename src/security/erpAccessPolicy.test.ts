import {
  canAccessErpCollection,
  ERP_COLLECTION_POLICIES,
  ERP_SUPPORT_COLLECTIONS,
  getErpCollectionAccessPolicy,
  getErpRoleGroupsForRoles,
  isErpSensitiveCollection,
  summarizeErpCollectionAccess,
} from './erpAccessPolicy';

describe('erpAccessPolicy', () => {
  it('maps legacy and Korean admin roles to the admin group', () => {
    expect(getErpRoleGroupsForRoles(['developer'])).toContain('admin');
    expect(getErpRoleGroupsForRoles(['\uad00\ub9ac\uc790'])).toContain('admin');
  });

  it('allows admins to access every configured collection operation', () => {
    expect(canAccessErpCollection(['admin'], 'users', 'read')).toBe(true);
    expect(canAccessErpCollection(['admin'], 'users', 'update')).toBe(true);
    expect(canAccessErpCollection(['admin'], 'tax_invoices', 'delete')).toBe(true);
  });

  it('keeps ordinary users out of sensitive ERP collections', () => {
    expect(isErpSensitiveCollection('users')).toBe(true);
    expect(canAccessErpCollection(['user'], 'users', 'read')).toBe(false);
    expect(canAccessErpCollection(['user'], 'tax_invoices', 'read')).toBe(false);
    expect(canAccessErpCollection(['user'], 'daily_reports', 'update')).toBe(false);
  });

  it('keeps every server-defined sensitive collection in the client policy catalog', () => {
    const missingPolicyIds = [
      'daily_worker_report_sites',
      'receivable_ledgers',
      'receivable_payments',
      'client_site_labor_adjustments',
      'daily_advance_statement_recruiter_fees',
      'quarter_vat_payments',
      'quarter_vat_payments_dawon',
      'support_shared_data',
      'settlement_alert_states',
    ];

    missingPolicyIds.forEach((collectionId) => {
      expect(isErpSensitiveCollection(collectionId)).toBe(true);
      expect(canAccessErpCollection(['user'], collectionId, 'read')).toBe(false);
    });

    expect(canAccessErpCollection(['finance'], 'receivable_payments', 'write')).toBe(true);
    expect(canAccessErpCollection(['support_manager'], 'support_shared_data', 'write')).toBe(true);
    expect(canAccessErpCollection(['audit'], 'settlement_alert_states', 'read')).toBe(true);
  });

  it('limits payroll roles to finance and settlement data, not admin settings', () => {
    expect(canAccessErpCollection(['PAYROLL_MANAGER'], 'tax_invoices', 'read')).toBe(true);
    expect(canAccessErpCollection(['PAYROLL_MANAGER'], 'tax_invoices', 'update')).toBe(true);
    expect(canAccessErpCollection(['PAYROLL_MANAGER'], 'settings', 'update')).toBe(false);
  });

  it('allows site managers to operate daily reports without finance access', () => {
    expect(canAccessErpCollection(['SITE_MANAGER'], 'daily_reports', 'read')).toBe(true);
    expect(canAccessErpCollection(['SITE_MANAGER'], 'daily_reports', 'create')).toBe(true);
    expect(canAccessErpCollection(['SITE_MANAGER'], 'payments', 'read')).toBe(false);
  });

  it('treats manager1 as a support-capable manager for accommodation data', () => {
    expect(getErpRoleGroupsForRoles(['manager1'])).toEqual(expect.arrayContaining(['site', 'support']));
    expect(canAccessErpCollection(['manager1'], 'accommodations', 'read')).toBe(true);
    expect(canAccessErpCollection(['메니저1'], 'accommodation_billing_documents', 'write')).toBe(true);
  });

  it('documents why collection policies exist', () => {
    expect(getErpCollectionAccessPolicy('daily_reports')?.description).toBeTruthy();
    expect(getErpCollectionAccessPolicy('settings')?.write).toEqual(['admin']);
  });

  it('treats the actual team expense claims collection as support data', () => {
    expect(ERP_SUPPORT_COLLECTIONS).toEqual(expect.arrayContaining([
      'team_expense_claims',
      'team_expense_ledgers',
      'support_write_operations',
    ]));
    expect(getErpCollectionAccessPolicy('team_expense_claims')?.write).toEqual([
      'admin',
      'office',
      'support',
    ]);
    expect(canAccessErpCollection(['support_manager'], 'team_expense_claims', 'write')).toBe(true);
    expect(canAccessErpCollection(['user'], 'team_expense_claims', 'read')).toBe(false);
  });

  it('treats normalized bank alerts as finance data and settings as admin-owned', () => {
    expect(canAccessErpCollection(['finance'], 'bank_transaction_candidates', 'read')).toBe(true);
    expect(canAccessErpCollection(['PAYROLL_MANAGER'], 'bank_transaction_candidates', 'update')).toBe(true);
    expect(canAccessErpCollection(['SITE_MANAGER'], 'bank_transaction_candidates', 'read')).toBe(false);
    expect(canAccessErpCollection(['finance'], 'bank_notification_settings', 'write')).toBe(false);
    expect(canAccessErpCollection(['admin'], 'bank_notification_settings', 'write')).toBe(true);
  });

  it('keeps each sensitive collection in a single policy group', () => {
    const ids = [
      ...new Set(ERP_COLLECTION_POLICIES.map((policy) => policy.collectionId)),
    ];

    expect(ids).toHaveLength(ERP_COLLECTION_POLICIES.length);
  });

  it('summarizes collection access for permission management screens', () => {
    const payrollSummary = summarizeErpCollectionAccess(['PAYROLL_MANAGER']);
    const siteSummary = summarizeErpCollectionAccess(['SITE_MANAGER']);

    expect(payrollSummary.roleGroups).toContain('payroll');
    expect(payrollSummary.writableCollections).toContain('tax_invoices');
    expect(siteSummary.readableCollections).toContain('daily_reports');
    expect(siteSummary.deniedCollections).toContain('tax_invoices');
  });
});
