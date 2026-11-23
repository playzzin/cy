import type { UserData } from '../services/userService';
import type { Worker } from '../services/manpowerService';
import type { OfficeStaff } from '../services/officeStaffService';
import type { Company } from '../services/companyService';
import { AccountEntityType, AccountLink, resolveAccountTypeFromCompanyType } from '../types/accountLink';

export interface AccountTarget {
    id: string;
    type: AccountEntityType;
    name: string;
    detail: string;
    searchText: string;
    score: number;
    reasons: string[];
    blocked: boolean;
    linked: boolean;
}

const normalize = (value: unknown) => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, '');
const digits = (value: unknown) => String(value || '').replace(/\D/g, '');
export const accountTargetType = (user?: UserData | null): AccountEntityType => {
    const type = user?.requestedAccountType || user?.accountType;
    return type === 'office' ? 'office' : type?.endsWith('_company') ? 'company' : 'worker';
};

/** Suggestions are evidence for human review, never authorization or automatic identity matching. */
export function rankAccountTargets({ user, request, type, workers, staff, companies, users, links }: {
    user?: UserData | null; request?: AccountLink; type: AccountEntityType;
    workers: Worker[]; staff: OfficeStaff[]; companies: Company[]; users: UserData[]; links: AccountLink[];
}): AccountTarget[] {
    const rows = type === 'worker' ? workers : type === 'office' ? staff : companies;
    const uid = request?.uid || user?.uid;
    const requested = request?.requestedEntity;
    const name = normalize(requested?.name || request?.entityName || (type !== 'company' ? user?.displayName : ''));
    const email = normalize(requested?.email || (type !== 'company' ? user?.email || request?.userEmail : ''));
    const phone = digits(requested?.phone || (type !== 'company' ? user?.phoneNumber : ''));
    const business = digits(requested?.businessNumber);
    const ownerIndex = new Map<string, Set<string>>();
    const addOwner = (id: string, owner: string) => {
        if (!id || !owner) return;
        if (!ownerIndex.has(id)) ownerIndex.set(id, new Set());
        ownerIndex.get(id)!.add(owner);
    };
    users.forEach(account => {
        const ids = type === 'worker' ? account.linkedWorkerIds : type === 'office' ? account.linkedOfficeStaffIds : account.linkedCompanyIds;
        ids?.forEach(id => addOwner(id, account.uid));
    });
    links.filter(link => link.entityType === type && link.status === 'active').forEach(link => addOwner(link.entityId, link.uid));
    return rows.filter(row => row.id).filter(row => type !== 'company' || !request?.accountType
        || resolveAccountTypeFromCompanyType((row as Company).type) === request.accountType).map(row => {
        const profile = row as Worker & OfficeStaff & Company;
        const ids = [String(row.id), String(row.legacyId || '')].filter(Boolean);
        const owners = new Set<string>();
        if (type !== 'company' && profile.uid) owners.add(profile.uid);
        ids.forEach(id => ownerIndex.get(id)?.forEach(owner => owners.add(owner)));
        const reasons: string[] = [];
        let score = 0;
        if (request && ids.includes(request.entityId)) { score += 1000; reasons.push('요청한 대상'); }
        if (business.length >= 10 && business === digits(profile.businessNumber)) { score += 100; reasons.push('사업자번호 일치'); }
        if (email && email === normalize(profile.email)) { score += 80; reasons.push('이메일 일치'); }
        if (phone.length >= 8 && phone === digits(profile.contact || profile.phone)) { score += 60; reasons.push('연락처 일치'); }
        if (name && name === normalize(row.name)) { score += 20; reasons.push('이름 일치'); }
        const detail = [profile.teamName || profile.department || profile.type, profile.role, profile.contact || profile.phone, profile.email].filter(Boolean).join(' · ');
        return { id: String(row.id), type, name: row.name, detail, score, reasons,
            searchText: normalize([row.name, detail, profile.businessNumber].join(' ')),
            blocked: type !== 'company' && [...owners].some(owner => owner !== uid), linked: Boolean(uid && owners.has(uid)),
        };
    }).sort((a, b) => Number(a.blocked) - Number(b.blocked) || b.score - a.score || a.name.localeCompare(b.name, 'ko'));
}

export const searchAccountTargets = (targets: AccountTarget[], query: string) =>
    targets.filter(target => target.searchText.includes(normalize(query)));
