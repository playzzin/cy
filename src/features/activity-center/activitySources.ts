import { getErpRoleGroupsForRoles, type ErpAccessRoleGroup } from '../../security/erpAccessPolicy';

export interface ActivitySource {
  id: string;
  label: string;
  paths: string[];
  collection: string;
  timeField: 'createdAt' | 'timestamp';
  actorField: 'actor.uid' | 'actorId';
  category?: string;
  roles: ErpAccessRoleGroup[];
}

const source = (id: string, label: string, paths: string[], collection: string,
  roles: ErpAccessRoleGroup[], category?: string, timeField: ActivitySource['timeField'] = 'createdAt'): ActivitySource => ({
  id, label, paths, collection, roles, category, timeField,
  actorField: collection === 'audit_logs' ? 'actorId' : 'actor.uid',
});

export const ACTIVITY_SOURCES: ActivitySource[] = [
  source('login', '접속', ['/admin/login-logs'], 'login_logs', []),
  source('daily', '일보', ['/reports/daily-logs'], 'daily_report_logs', ['audit', 'office', 'site', 'payroll']),
  source('database', '기초 데이터', ['/database/logs'], 'database_logs', ['audit']),
  source('materials', '자재', ['/materials/logs'], 'material_logs', ['audit', 'office', 'support', 'payroll']),
  source('ledger', '매입·매출', ['/payroll/workbook-ledger/logs'], 'workbook_ledger_logs', ['finance', 'payroll']),
  source('vehicles', '차량 청구', ['/support/vehicles/logs'], 'vehicle_billing_logs', ['office', 'support', 'payroll']),
  source('cards', '카드 청구', ['/support/cards/logs'], 'card_billing_logs', ['office', 'support', 'payroll']),
  source('accommodation', '숙소 청구', ['/support/accommodation/logs'], 'accommodation_billing_logs', ['office', 'support', 'payroll']),
  source('files', '파일 전송', ['/admin/excel-transfer-logs', '/admin/pdf-transfer-logs'], 'audit_logs', ['audit'], 'FILE_TRANSFER', 'timestamp'),
  source('identity', '신분증 작업', ['/database/identity-logs'], 'audit_logs', ['audit'], 'IDENTITY_BUNDLE', 'timestamp'),
  source('permissions', '권한 변경', ['/admin/permission-change-logs'], 'audit_logs', ['audit'], 'PERMISSION', 'timestamp'),
  source('messages', '자동 메시지', ['/messages/automation-logs'], 'audit_logs', ['audit'], 'MESSAGE_AUTOMATION', 'timestamp'),
  source('system', '시스템 활동', ['/admin/activity-logs'], 'audit_logs', ['audit'], undefined, 'timestamp'),
  // Server-owned account/approval events use createdAt, unlike browser audit events.
  source('accounts', '계정·승인', [], 'audit_logs', ['audit']),
  source('ai', 'AI 사용량·비용', ['/admin/gemini-usage-logs'], 'gemini_usage_logs', []),
];

export const activitySourceForPath = (path: string): ActivitySource | undefined => {
  const url = new URL(path, 'https://activity.invalid');
  return url.pathname === '/activity'
    ? ACTIVITY_SOURCES.find(item => item.id === url.searchParams.get('source'))
    : ACTIVITY_SOURCES.find(item => item.paths.includes(url.pathname.replace(/\/$/, '')));
};

export function availableActivitySources(profile: Record<string, unknown> | null): ActivitySource[] {
  if (!profile || (profile.status && profile.status !== 'active')) return [];
  const roles = getErpRoleGroupsForRoles([
    profile.role, profile.position, profile.systemRole, profile.accountType,
    ...(Array.isArray(profile.roles) ? profile.roles : []),
    ...(Array.isArray(profile.additionalPositions) ? profile.additionalPositions : []),
  ]);
  return ACTIVITY_SOURCES.filter(item => roles.includes('admin') || item.roles.some(role => roles.includes(role)));
}
