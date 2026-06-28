import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { rolePermissionService } from '../../services/rolePermissionService';
import Button from '../../components/ui/Button';

export const formatCurrency = (value: unknown): string =>
  `${Math.round(Number(value || 0)).toLocaleString()}원`;

export const formatNumber = (value: unknown): string =>
  Number(value || 0).toLocaleString();

export const getCurrentYearMonth = (): string => new Date().toISOString().slice(0, 7);

const normalizeRole = (value: unknown): string => String(value || '').trim();
const normalizeRoleKey = (value: unknown): string => normalizeRole(value).toLowerCase();

const toRoleList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(normalizeRole).filter(Boolean);
  const role = normalizeRole(value);
  return role ? [role] : [];
};

const uniqueRoles = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const roles: string[] = [];
  values.flatMap(toRoleList).forEach((role) => {
    const key = normalizeRoleKey(role);
    if (!key || seen.has(key)) return;
    seen.add(key);
    roles.push(role);
  });
  return roles;
};

const ADMIN_ROLE_KEYS = [
  'admin',
  'super_admin',
  'administrator',
  'owner',
  'dev',
  'developer',
  'system_admin',
  'jhl2vtnk9v3c4eiz4qqi',
  'pos_jhl2vtnk9v3c4eiz4qqi',
  '관리자',
  '사장',
  '실장',
  '개발',
  '개발자',
  '시스템관리자',
];

const isAdminLike = (role: string): boolean =>
  ADMIN_ROLE_KEYS.includes(normalizeRoleKey(role));

const hasAnyRole = (roles: string[], aliases: string[]): boolean => {
  const aliasKeys = new Set(aliases.map(normalizeRoleKey));
  return roles.some((role) => aliasKeys.has(normalizeRoleKey(role)));
};

export const useRecruitingPermissions = () => {
  const { currentUser } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser) {
      setRoles([]);
      return;
    }

    void (async () => {
      const { userService } = await import('../../services/userService');
      const profile = await userService.getUser(currentUser.uid).catch(() => null);
      const profileSystemRole = (profile as { systemRole?: unknown } | null)?.systemRole;
      if (cancelled) return;
      setRoles(uniqueRoles([
        profile?.position,
        profile?.role,
        profileSystemRole,
        profile?.additionalPositions,
      ]));
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  return useMemo(() => {
    const admin = roles.some(isAdminLike);
    const payrollManager = hasAnyRole(roles, ['PAYROLL_MANAGER', 'payroll_manager', '급여담당', '정산담당', '정산관리자']);
    const officeStaff = hasAnyRole(roles, ['OFFICE_STAFF', 'office_staff', '사무실직원', '사무직원']);
    const siteManager = hasAnyRole(roles, ['SITE_MANAGER', 'site_manager', 'MANAGER', 'manager', '매니저', '현장관리자', '현장소장']);
    const canUse = (permissionId: string) => admin || roles.some((role) => rolePermissionService.hasAccess(role, permissionId));

    return {
      role: roles[0] || '',
      roles,
      isReadOnly: siteManager && !admin && !payrollManager && !officeStaff,
      canRegister: admin || officeStaff || payrollManager || canUse('recruiting-service-workers'),
      canSettle: admin || payrollManager,
      canManagePayments: admin || payrollManager,
      canManageDeposits: admin || payrollManager,
      canManageReceivables: admin || payrollManager,
      canManageSettings: admin,
      canManageReferrers: admin || payrollManager || officeStaff || canUse('recruiting-referrers'),
    };
  }, [roles]);
};

export const PageHeader: React.FC<{
  title: string;
  description: string;
  right?: React.ReactNode;
}> = ({ title, description, right }) => (
  <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
    <div>
      <h1 className="text-2xl font-black text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
    {right}
  </div>
);

export const MonthToolbar: React.FC<{
  yearMonth: string;
  onChange: (value: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  actions?: React.ReactNode;
}> = ({ yearMonth, onChange, onRefresh, loading, actions }) => (
  <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
    <div className="flex items-center gap-2">
      <input
        type="month"
        value={yearMonth}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
      />
      <Button type="button" variant="secondary" size="sm" onClick={onRefresh} isLoading={loading}>
        새로고침
      </Button>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const StatCard: React.FC<{
  label: string;
  value: string;
  note?: string;
  tone?: 'blue' | 'green' | 'orange' | 'rose' | 'slate';
}> = ({ label, value, note, tone = 'slate' }) => {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  }[tone];

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      {note && <div className="mt-1 text-xs opacity-75">{note}</div>}
    </div>
  );
};

export const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-semibold text-slate-500">
    {message}
  </div>
);

export const ErrorBox: React.FC<{ message?: string | null }> = ({ message }) => {
  if (!message) return null;
  return <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</div>;
};

export const statusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    active: '진행',
    paused: '일시중지',
    stopped: '중지',
    closed: '마감',
    pending: '대기',
    confirmed: '확정',
    excluded: '제외',
    overridden: '수정',
    draft: '작성중',
    approved: '승인',
    verified: '확인',
    partial: '부분회수',
    overdue: '연체',
    inactive: '중지',
    unknown: '미확인',
    paid: '지급완료',
    cancelled: '취소',
  };
  return labels[status] || status;
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const tone = status === 'paid' || status === 'confirmed' || status === 'closed' || status === 'verified'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'pending' || status === 'draft' || status === 'approved' || status === 'partial'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : status === 'stopped' || status === 'excluded' || status === 'cancelled' || status === 'overdue'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-slate-50 text-slate-700 border-slate-200';

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${tone}`}>{statusLabel(status)}</span>;
};
