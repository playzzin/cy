import type { MenuItem, PositionItem, SiteData } from '../types/menu';
import { UserRole } from '../types/roles';

export type BusinessPartnerPositionId = 'client' | 'rental' | 'referral';

export interface BusinessPartnerPositionDefinition {
    id: BusinessPartnerPositionId;
    name: string;
    rank: number;
    color: string;
    menuColor: string;
    order: number;
    icon: string;
    iconKey: string;
    description: string;
    roles: string[];
    menu: MenuItem[];
}

const withRoles = (roles: string[], menu: MenuItem[]): MenuItem[] =>
    menu.map((item) => ({ ...item, roles }));

const CLIENT_ROLES = ['발주사', '건설사', '원청', 'client', 'client_company', 'construction_company'];
const RENTAL_ROLES = ['임대사', 'rental', 'rental_company'];
const REFERRAL_ROLES = ['소개소', '소개자', 'referral', 'recruiting', 'agency'];

export const BUSINESS_PARTNER_POSITIONS: BusinessPartnerPositionDefinition[] = [
    {
        id: 'client',
        name: '건설',
        rank: 6,
        color: 'indigo',
        menuColor: 'from-indigo-600 to-sky-400',
        order: 5,
        icon: 'fa-building',
        iconKey: 'fa-building',
        description: '건설/원청 계정용 직책 및 메뉴 권한',
        roles: CLIENT_ROLES,
        menu: withRoles(CLIENT_ROLES, [
            { id: 'client_dashboard', text: '건설 대시보드', icon: 'fa-chart-line', path: '/dashboard' },
            { id: 'client_company_db', text: '건설 DB', icon: 'fa-database', path: '/database/manpower-db?tab=companies&companyTab=client' },
            { id: 'client_site_labor', text: '건설 현장 출력인원', icon: 'fa-file-invoice-dollar', path: '/payroll/client-site-labor' },
            { id: 'client_support_site', text: '건설 현장별 지원', icon: 'fa-hand-holding-dollar', path: '/payroll/support-client-site' },
            { id: 'client_progress_claims', text: '기성관리', icon: 'fa-list-check', path: '/payroll/progress-claims' },
            { id: 'client_progress_invoice', text: '기성청구서', icon: 'fa-file-contract', path: '/payroll/progress-claim-invoice' },
            { id: 'client_notices', text: '공지사항', icon: 'fa-bullhorn', path: '/notices' },
        ]),
    },
    {
        id: 'rental',
        name: '임대사',
        rank: 7,
        color: 'orange',
        menuColor: 'from-orange-600 to-amber-400',
        order: 6,
        icon: 'fa-truck-front',
        iconKey: 'fa-truck-front',
        description: '임대사 계정용 직책 및 메뉴 권한',
        roles: RENTAL_ROLES,
        menu: withRoles(RENTAL_ROLES, [
            { id: 'rental_dashboard', text: '임대사 대시보드', icon: 'fa-chart-line', path: '/dashboard' },
            { id: 'rental_company_db', text: '임대사 DB', icon: 'fa-database', path: '/database/manpower-db?tab=companies&companyTab=rental' },
            { id: 'rental_transaction', text: '임대 거래명세표', icon: 'fa-file-invoice', path: '/transaction/manage' },
            { id: 'rental_estimate', text: '임대 견적', icon: 'fa-calculator', path: '/estimate/manage' },
            { id: 'rental_materials', text: '자재 통합관리', icon: 'fa-boxes-stacked', path: '/materials' },
            { id: 'rental_workbook_ledger', text: '매입매출 스마트 장부', icon: 'fa-file-invoice-dollar', path: '/payroll/workbook-ledger-upgrade' },
            { id: 'rental_notices', text: '공지사항', icon: 'fa-bullhorn', path: '/notices' },
        ]),
    },
    {
        id: 'referral',
        name: '소개소',
        rank: 8,
        color: 'cyan',
        menuColor: 'from-cyan-600 to-emerald-400',
        order: 7,
        icon: 'fa-user-group',
        iconKey: 'fa-user-group',
        description: '소개소/용역 소개 정산 계정용 직책 및 메뉴 권한',
        roles: REFERRAL_ROLES,
        menu: [],
    },
];

export const BUSINESS_PARTNER_POSITION_CONFIGS: PositionItem[] = BUSINESS_PARTNER_POSITIONS.map((position) => ({
    id: position.id,
    name: position.name,
    icon: position.iconKey,
    color: position.menuColor,
    order: position.order,
}));

export const getBusinessPartnerPositionSiteKey = (positionId: string): string =>
    positionId.startsWith('pos_') ? positionId : `pos_${positionId}`;

export const BUSINESS_PARTNER_POSITION_SITES: Record<string, SiteData> =
    BUSINESS_PARTNER_POSITIONS.reduce<Record<string, SiteData>>((acc, position) => {
        acc[getBusinessPartnerPositionSiteKey(position.id)] = {
            name: position.name,
            icon: position.iconKey,
            menu: position.menu,
            headerActions: [],
            deletedItems: [],
        };
        return acc;
    }, {});

export const BUSINESS_PARTNER_DEFAULT_POSITION_ROWS = BUSINESS_PARTNER_POSITIONS.map((position) => ({
    legacyId: position.id,
    name: position.name,
    rank: position.rank,
    color: position.color,
    icon: position.icon,
    iconKey: position.iconKey,
    description: position.description,
    isDefault: true,
    systemRole: UserRole.GENERAL,
}));

const normalizePartnerKey = (value: unknown): string =>
    String(value || '').trim().toLowerCase().replace(/^pos_/, '').replace(/[\s_-]/g, '');

export const findBusinessPartnerPositionDefinition = (
    positionId?: string | null,
    positionName?: string | null
): BusinessPartnerPositionDefinition | undefined => {
    const idKey = normalizePartnerKey(positionId);
    const nameKey = normalizePartnerKey(positionName);

    return BUSINESS_PARTNER_POSITIONS.find((position) => {
        const keys = [
            normalizePartnerKey(position.id),
            normalizePartnerKey(position.name),
            ...position.roles.map(normalizePartnerKey),
        ];
        return keys.includes(idKey) || keys.includes(nameKey);
    });
};
