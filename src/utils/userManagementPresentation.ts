import type { UserData } from '../services/userService';
import type { Worker } from '../services/manpowerService';
import type { OfficeStaff } from '../services/officeStaffService';
import type { Company } from '../services/companyService';
import type { Position } from '../services/positionService';
import type { AccountLink, AccountEntityType } from '../types/accountLink';

export type SystemAccessRole = 'admin' | 'manager' | 'user';

export const normalizeAccessRole = (role: unknown): SystemAccessRole => {
    const value = String(role || '').trim().toLowerCase();
    if (['admin', '관리자', '사장', '실장'].includes(value)) return 'admin';
    if (['manager', '매니저', '메니저', '대표'].includes(value)) return 'manager';
    return 'user';
};

export const accessRoleLabel = (role: unknown): string => (
    { admin: '관리자', manager: '매니저', user: '일반' }[normalizeAccessRole(role)]
);

export const userStatusLabel = (status: UserData['status']): string => (
    status ? { active: '사용 가능', pending: '승인 대기', rejected: '반려됨', suspended: '사용 중지' }[status] || status : '상태 미지정'
);

// A position selects its configured role; its name must never imply elevated access.
export const selectPositionAccess = (position: Position | undefined, additional: string[]) => ({
    position: position?.name || '',
    role: normalizeAccessRole(position?.systemRole),
    additionalPositions: position ? Array.from(new Set(additional.filter((name) => name !== position.name))) : [],
});

export interface AccountConnectionSummary {
    key: string;
    type: AccountEntityType;
    label: string;
    name: string;
    detail: string;
    status: 'active' | 'pending';
    missing: boolean;
}

export const summarizeAccountConnections = (
    user: UserData,
    workers: Worker[],
    staffRows: OfficeStaff[],
    companies: Company[],
    links: AccountLink[],
): AccountConnectionSummary[] => {
    const result = new Map<string, AccountConnectionSummary>();
    const sources = [
        { type: 'worker' as const, label: '작업자', rows: workers, ids: user.linkedWorkerIds || [] },
        { type: 'office' as const, label: '사무실', rows: staffRows, ids: user.linkedOfficeStaffIds || [] },
        { type: 'company' as const, label: '회사', rows: companies, ids: user.linkedCompanyIds || [] },
    ];
    sources.forEach(({ type, label, rows, ids }) => {
        const byId = new Map<string, Worker | OfficeStaff | Company>();
        rows.forEach((row) => {
            if (row.id) byId.set(String(row.id), row);
            if (row.legacyId) byId.set(String(row.legacyId), row);
        });
        const add = (id: string, link?: AccountLink) => {
            const row = byId.get(id);
            const key = `${type}:${row?.id || id || link?.id}`;
            if (result.get(key)?.status === 'active' && link?.status === 'pending') return;
            const profile = row as Worker & OfficeStaff & Company | undefined;
            result.set(key, {
                key, type, label,
                name: row?.name || link?.entityName || '연결 대상 확인 필요',
                detail: [profile?.teamName || profile?.department || profile?.type, profile?.role].filter(Boolean).join(' · '),
                status: link?.status === 'pending' ? 'pending' : 'active',
                missing: !row,
            });
        };
        ids.forEach((id) => add(String(id)));
        rows.forEach((row) => {
            if ('uid' in row && row.uid === user.uid && row.id) add(String(row.id));
        });
        links.filter((link) => link.uid === user.uid && link.entityType === type && ['active', 'pending'].includes(link.status))
            .forEach((link) => add(link.entityId, link));
    });
    return Array.from(result.values());
};
