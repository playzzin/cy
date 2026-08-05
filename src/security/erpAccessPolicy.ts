export type ErpAccessOperation = 'read' | 'create' | 'update' | 'delete' | 'write';

export type ErpAccessRoleGroup =
  | 'admin'
  | 'payroll'
  | 'finance'
  | 'office'
  | 'site'
  | 'support'
  | 'audit'
  | 'user';

export interface ErpCollectionAccessPolicy {
  collectionId: string;
  read: ErpAccessRoleGroup[];
  write: ErpAccessRoleGroup[];
  description: string;
}

export interface ErpCollectionAccessSummary {
  roleGroups: ErpAccessRoleGroup[];
  totalCount: number;
  readableCount: number;
  writableCount: number;
  deniedCount: number;
  readableCollections: string[];
  writableCollections: string[];
  deniedCollections: string[];
}

export const ERP_ACCESS_ROLE_GROUPS: Record<ErpAccessRoleGroup, string[]> = {
  admin: [
    'admin',
    'super_admin',
    'administrator',
    'owner',
    'dev',
    'developer',
    'system_admin',
    'jhl2vtnk9v3c4eiz4qqi',
    'pos_jhl2vtnk9v3c4eiz4qqi',
    '\uad00\ub9ac\uc790',
    '\uc0ac\uc7a5',
    '\uc2e4\uc7a5',
    '\uac1c\ubc1c',
    '\uac1c\ubc1c\uc790',
    '\uc2dc\uc2a4\ud15c\uad00\ub9ac\uc790',
    '愿由ъ옄',
    '?ъ옣',
    '?ㅼ옣',
    '媛쒕컻',
    '媛쒕컻??',
    '?쒖뒪?쒓?由ъ옄',
  ],
  payroll: [
    'payroll_manager',
    'PAYROLL_MANAGER',
    '\uae09\uc5ec\ub2f4\ub2f9',
    '\uc815\uc0b0\ub2f4\ub2f9',
    '\uc815\uc0b0\uad00\ub9ac\uc790',
    '湲됱뿬?대떦',
    '?뺤궛?대떦',
    '?뺤궛愿由ъ옄',
  ],
  finance: [
    'finance',
    'finance_manager',
    'accounting',
    'accounting_manager',
    '\ud68c\uacc4',
    '\uc7ac\ubb34',
    '\uacbd\ub9ac',
    '\ud68c\uacc4\ub2f4\ub2f9',
    '\uc7ac\ubb34\ub2f4\ub2f9',
  ],
  office: [
    'office_staff',
    'OFFICE_STAFF',
    'office',
    '\uc0ac\ubb34\uc2e4\uc9c1\uc6d0',
    '\uc0ac\ubb34\uc9c1\uc6d0',
    '\uc0ac\ubb34',
    '?щТ?ㅼ쭅??',
    '?щТ吏곸썝',
  ],
  site: [
    'site_manager',
    'SITE_MANAGER',
    'manager',
    'MANAGER',
    'manager1',
    'manager2',
    'manager3',
    'MANAGER1',
    'MANAGER2',
    'MANAGER3',
    'pos_manager1',
    'pos_manager2',
    'pos_manager3',
    '\ub9e4\ub2c8\uc800',
    '\ud604\uc7a5\uad00\ub9ac\uc790',
    '\ud604\uc7a5\uc18c\uc7a5',
    '\ub9e4\ub2c8\uc8001',
    '\ub9e4\ub2c8\uc8002',
    '\ub9e4\ub2c8\uc8003',
    '\uba54\ub2c8\uc8001',
    '\uba54\ub2c8\uc8002',
    '\uba54\ub2c8\uc8003',
    '留ㅻ땲?',
    '?꾩옣愿由ъ옄',
    '?꾩옣?뚯옣',
  ],
  support: [
    'support',
    'support_manager',
    'manager1',
    'MANAGER1',
    'pos_manager1',
    '\ub9e4\ub2c8\uc8001',
    '\uba54\ub2c8\uc8001',
    '\uc9c0\uc6d0\ub2f4\ub2f9',
    '\uc9c0\uc6d0 \ub2f4\ub2f9',
    '\uc790\uc0b0\uad00\ub9ac',
    '\uc790\uc0b0 \uad00\ub9ac',
    '\uc219\uc18c\uad00\ub9ac',
    '\uc219\uc18c \uad00\ub9ac',
    '\ucc28\ub7c9\uad00\ub9ac',
    '\ucc28\ub7c9 \uad00\ub9ac',
  ],
  audit: [
    'audit',
    'auditor',
    'compliance',
    '\uac10\uc0ac',
    '\uac10\uc0ac\uc790',
    '\uc900\ubc95',
  ],
  user: ['user', 'general', '\uc77c\ubc18', '?쇰컲'],
};

export const ERP_MASTER_DATA_COLLECTIONS = [
  'companies',
  'teams',
  'workers',
  'office_staff',
  'sites',
  'account_links',
  'account_directory_entries',
];

export const ERP_OPERATION_COLLECTIONS = [
  'daily_reports',
  'daily_report_workers',
  'daily_worker_report_sites',
  'daily_dispatches',
  'field_schedule_requests',
  'schedule_confirmation_boards',
  'tasks',
  'task_requests',
];

export const ERP_RECRUITING_COLLECTIONS = [
  'recruiting_referrers',
  'service_worker_referrals',
  'service_referral_daily_lines',
  'service_referral_monthly_settlements',
  'service_referral_settings',
  'service_worker_history',
  'service_referral_payments',
  'service_referral_deposits',
  'service_referral_receivables',
];

export const ERP_FINANCE_COLLECTIONS = [
  'advance_payments',
  'advance_requests',
  'monthly_payroll_settlements',
  'payments',
  'tax_invoices',
  'receivables',
  'receivable_ledgers',
  'receivable_payments',
  'contracts',
  'progress_claims',
  'client_site_labor_adjustments',
  'settlements',
  'settlement_targets',
  'team_settlement_documents',
  'daily_advance_workbook_profiles',
  'daily_advance_statement_recruiter_fees',
  'workbook_ledger_logs',
  'tax_ledger_entries',
  'quarter_vat_payments',
  'quarter_vat_payments_dawon',
  'freelancers',
  'freelancerPayments',
];

export const ERP_SUPPORT_COLLECTIONS = [
  'vehicles',
  'vehicleAssignments',
  'vehicle_assignments',
  'vehicleExpenses',
  'vehicle_expenses',
  'vehicle_billing_targets',
  'vehicle_billing_documents',
  'vehicle_billing_logs',
  'cards',
  'cardAssignments',
  'cardTransactions',
  'cardBillings',
  'card_billing_logs',
  'accommodations',
  'accommodationAssignments',
  'accommodationUtilityRecords',
  'accommodation_billing_targets',
  'accommodation_billing_documents',
  'accommodation_billing_line_items',
  'accommodation_billing_logs',
  'support_cancellation_logs',
  'support_write_operations',
  'support_shared_data',
  'support_client_site_allocations',
  'team_expense_claims',
  'team_expense_ledgers',
  'team_expense_categories',
];

export const ERP_ADMIN_COLLECTIONS = [
  'settings',
  'server_settings',
  'system_configs',
  'system_logs',
  'menu_configs',
  'menus',
  'positions',
  'components',
  'users',
  'app_users',
  'login_logs',
  'audit_logs',
  'database_logs',
  'daily_report_logs',
  'material_logs',
  'settlement_alert_states',
  'welfare_admin_permissions',
  'welfare_audit_logs',
];

export const ERP_WELFARE_COLLECTIONS = [
  'welfare_ledger_transactions',
  'welfare_account_snapshots',
  'welfare_categories',
  'welfare_game_daily_usage',
  'welfare_game_plays',
];

export const ERP_BANK_NOTIFICATION_COLLECTIONS = [
  'bank_sms_ingestions',
  'bank_transaction_candidates',
  'bank_notification_settings',
  'notification_devices',
  'bank_notification_health',
  'bank_notification_outbox',
  'bank_ingestion_replay_nonces',
  'bank_provider_events',
];

const ERP_BANK_NOTIFICATION_POLICIES: ErpCollectionAccessPolicy[] = [
  {
    collectionId: 'bank_transaction_candidates',
    read: ['admin', 'payroll', 'finance', 'audit'],
    write: ['admin', 'payroll', 'finance'],
    description: 'reviewable normalized bank transaction alerts',
  },
  {
    collectionId: 'bank_notification_settings',
    read: ['admin', 'payroll', 'finance', 'audit'],
    write: ['admin'],
    description: 'bank notification recipients and delivery policy',
  },
  {
    collectionId: 'notification_devices',
    read: ['admin', 'payroll', 'finance', 'audit'],
    write: ['admin', 'payroll', 'finance', 'audit'],
    description: 'self-managed FCM registration tokens',
  },
  {
    collectionId: 'bank_notification_health',
    read: ['admin', 'payroll', 'finance', 'audit'],
    write: [],
    description: 'server-owned bank bridge health state',
  },
  {
    collectionId: 'bank_notification_outbox',
    read: ['admin', 'audit'],
    write: [],
    description: 'server-owned reliable bank push delivery outbox',
  },
  ...[
    'bank_sms_ingestions',
    'bank_provider_events',
  ].map((collectionId) => ({
    collectionId,
    read: ['admin', 'audit'] as ErpAccessRoleGroup[],
    write: [] as ErpAccessRoleGroup[],
    description: 'server-owned bank integration audit data',
  })),
  {
    collectionId: 'bank_ingestion_replay_nonces',
    read: [],
    write: [],
    description: 'server-only replay protection records',
  },
];

export const ERP_COLLECTION_POLICIES: ErpCollectionAccessPolicy[] = [
  ...ERP_MASTER_DATA_COLLECTIONS.map((collectionId) => ({
    collectionId,
    read: ['admin', 'office', 'site', 'payroll'] as ErpAccessRoleGroup[],
    write: ['admin', 'office'] as ErpAccessRoleGroup[],
    description: 'ERP master data',
  })),
  ...ERP_OPERATION_COLLECTIONS.map((collectionId) => ({
    collectionId,
    read: ['admin', 'office', 'site', 'payroll'] as ErpAccessRoleGroup[],
    write: ['admin', 'office', 'site'] as ErpAccessRoleGroup[],
    description: 'field operation data',
  })),
  ...ERP_RECRUITING_COLLECTIONS.map((collectionId) => ({
    collectionId,
    read: ['admin', 'office', 'site', 'payroll'] as ErpAccessRoleGroup[],
    write: ['admin', 'office', 'payroll'] as ErpAccessRoleGroup[],
    description: 'service recruiting and settlement data',
  })),
  ...ERP_FINANCE_COLLECTIONS.map((collectionId) => ({
    collectionId,
    read: ['admin', 'payroll', 'finance'] as ErpAccessRoleGroup[],
    write: ['admin', 'payroll', 'finance'] as ErpAccessRoleGroup[],
    description: 'payroll, tax, receivable, and settlement data',
  })),
  ...ERP_SUPPORT_COLLECTIONS.map((collectionId) => ({
    collectionId,
    read: ['admin', 'office', 'support', 'payroll'] as ErpAccessRoleGroup[],
    write: ['admin', 'office', 'support'] as ErpAccessRoleGroup[],
    description: 'support asset and billing data',
  })),
  ...ERP_WELFARE_COLLECTIONS.map((collectionId) => ({
    collectionId,
    read: ['admin', 'office'] as ErpAccessRoleGroup[],
    write: ['admin'] as ErpAccessRoleGroup[],
    description: 'welfare asset ledger data',
  })),
  ...ERP_BANK_NOTIFICATION_POLICIES,
  ...ERP_ADMIN_COLLECTIONS.map((collectionId) => ({
    collectionId,
    read: ['admin', 'audit'] as ErpAccessRoleGroup[],
    write: ['admin'] as ErpAccessRoleGroup[],
    description: 'administrative and audit data',
  })),
];

const COLLECTION_POLICY_MAP = new Map(
  ERP_COLLECTION_POLICIES.map((policy) => [policy.collectionId, policy])
);

export const normalizeErpAccessRole = (role: unknown): string =>
  String(role || '').trim();

export const normalizeErpAccessRoleKey = (role: unknown): string =>
  normalizeErpAccessRole(role).toLowerCase();

export const getErpRoleGroupKeys = (groups: ErpAccessRoleGroup[]): string[] => {
  const keys = new Set<string>();

  groups.forEach((group) => {
    ERP_ACCESS_ROLE_GROUPS[group].forEach((role) => {
      const key = normalizeErpAccessRoleKey(role);
      if (key) keys.add(key);
    });
  });

  return Array.from(keys);
};

export const getErpRoleGroupsForRoles = (roles: unknown[]): ErpAccessRoleGroup[] => {
  const actualKeys = new Set(roles.map(normalizeErpAccessRoleKey).filter(Boolean));
  const groups: ErpAccessRoleGroup[] = [];

  (Object.keys(ERP_ACCESS_ROLE_GROUPS) as ErpAccessRoleGroup[]).forEach((group) => {
    const groupKeys = getErpRoleGroupKeys([group]);
    if (groupKeys.some((key) => actualKeys.has(key))) {
      groups.push(group);
    }
  });

  if (groups.includes('admin')) return ['admin', ...groups.filter((group) => group !== 'admin')];
  return groups;
};

export const isErpAdminRole = (role: unknown): boolean =>
  getErpRoleGroupKeys(['admin']).includes(normalizeErpAccessRoleKey(role));

export const getErpCollectionAccessPolicy = (
  collectionId: string
): ErpCollectionAccessPolicy | undefined => COLLECTION_POLICY_MAP.get(collectionId);

export const isErpSensitiveCollection = (collectionId: string): boolean =>
  COLLECTION_POLICY_MAP.has(collectionId);

export const canAccessErpCollection = (
  roles: unknown[],
  collectionId: string,
  operation: ErpAccessOperation
): boolean => {
  const roleGroups = getErpRoleGroupsForRoles(roles);
  if (roleGroups.includes('admin')) return true;

  const policy = getErpCollectionAccessPolicy(collectionId);
  if (!policy) return true;

  const allowedGroups = operation === 'read' ? policy.read : policy.write;
  return allowedGroups.some((group) => roleGroups.includes(group));
};

export const summarizeErpCollectionAccess = (roles: unknown[]): ErpCollectionAccessSummary => {
  const roleGroups = getErpRoleGroupsForRoles(roles);
  const readableCollections: string[] = [];
  const writableCollections: string[] = [];
  const deniedCollections: string[] = [];

  ERP_COLLECTION_POLICIES.forEach((policy) => {
    const canRead = canAccessErpCollection(roles, policy.collectionId, 'read');
    const canWrite = canAccessErpCollection(roles, policy.collectionId, 'write');

    if (canRead) readableCollections.push(policy.collectionId);
    if (canWrite) writableCollections.push(policy.collectionId);
    if (!canRead && !canWrite) deniedCollections.push(policy.collectionId);
  });

  return {
    roleGroups,
    totalCount: ERP_COLLECTION_POLICIES.length,
    readableCount: readableCollections.length,
    writableCount: writableCollections.length,
    deniedCount: deniedCollections.length,
    readableCollections,
    writableCollections,
    deniedCollections,
  };
};
