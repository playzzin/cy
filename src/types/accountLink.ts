export type AccountType =
    | 'worker'
    | 'office'
    | 'partner_company'
    | 'construction_company'
    | 'rental_company';

export type AccountEntityType = 'worker' | 'company' | 'office';

export type AccountEntitySubType =
    | '작업자'
    | '사무실'
    | '협력사'
    | '건설사'
    | '시공사'
    | '임대사'
    | '기타';

export type AccountLinkStatus = 'pending' | 'active' | 'rejected' | 'inactive';

export type AccountRelationRole = 'owner' | 'manager' | 'staff' | 'viewer';

export interface RequestedEntitySnapshot {
    name?: string;
    idNumber?: string;
    businessNumber?: string;
    ceoName?: string;
    phone?: string;
    email?: string;
    address?: string;
    role?: string;
    department?: string;
    employmentType?: string;
    salaryModel?: string;
    unitPrice?: number;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    memo?: string;
}

export interface AccountLink {
    id?: string;
    uid: string;
    userEmail?: string | null;
    userDisplayName?: string | null;
    accountType: AccountType;
    entityType: AccountEntityType;
    entityId: string;
    entityName: string;
    entitySubType: AccountEntitySubType;
    relationRole: AccountRelationRole;
    status: AccountLinkStatus;
    requestedEntity?: RequestedEntitySnapshot;
    memo?: string;
    createdAt?: any;
    updatedAt?: any;
    requestedAt?: any;
    approvedAt?: any;
    approvedBy?: string;
    approvedByEmail?: string | null;
    rejectedAt?: any;
    rejectedBy?: string;
    rejectedByEmail?: string | null;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
    worker: '작업자',
    office: '사무실',
    partner_company: '협력사',
    construction_company: '건설사',
    rental_company: '임대사',
};

export const ACCOUNT_RELATION_ROLE_LABELS: Record<AccountRelationRole, string> = {
    owner: '대표/소유자',
    manager: '관리자',
    staff: '담당자',
    viewer: '조회자',
};

export const resolveAccountTypeFromCompanyType = (companyType: unknown): AccountType => {
    const type = String(companyType || '').trim();
    if (type === '협력사') return 'partner_company';
    if (type === '건설사' || type === '시공사') return 'construction_company';
    if (type === '임대사') return 'rental_company';
    return 'partner_company';
};

export const resolveEntitySubTypeFromCompanyType = (companyType: unknown): AccountEntitySubType => {
    const type = String(companyType || '').trim();
    if (type === '협력사' || type === '건설사' || type === '시공사' || type === '임대사') {
        return type;
    }
    return '기타';
};
