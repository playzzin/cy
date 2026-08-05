import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faArrowTrendUp,
    faBell,
    faBuilding,
    faCalendarCheck,
    faChartLine,
    faClipboardCheck,
    faClipboardList,
    faCog,
    faCrown,
    faDatabase,
    faFileExcel,
    faFileInvoiceDollar,
    faFileSignature,
    faHandHoldingDollar,
    faHardHat,
    faListCheck,
    faMoneyBillTrendUp,
    faPaperPlane,
    faRightLeft,
    faShieldHalved,
    faSignature,
    faTruckFront,
    faUser,
    faUserGear,
    faUserTie,
    faUsers,
    faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type { PositionItem } from '../../types/menu';
import {
    BusinessPartnerPositionId,
    findBusinessPartnerPositionDefinition,
} from '../../constants/businessPartnerPositions';

export type DashboardModeId = 'executive' | 'manager' | 'teamLead' | 'foreman' | 'worker';
export type DashboardLayoutKind = 'executive' | 'field';

export interface DashboardAction {
    label: string;
    desc: string;
    path: string;
    icon: IconDefinition;
    color: string;
    adminOnly?: boolean;
}

export interface DashboardFocusItem {
    label: string;
    value: string;
    description: string;
}

export interface DashboardModeConfig {
    id: DashboardModeId;
    label: string;
    shortLabel: string;
    roleGroup: string;
    layout: DashboardLayoutKind;
    icon: IconDefinition;
    gradient: string;
    accent: string;
    softBg: string;
    heroTitle: string;
    heroDescription: string;
    focusItems: DashboardFocusItem[];
    quickActions: DashboardAction[];
}

export const DASHBOARD_MODE_STORAGE_KEY = 'dashboard_role_mode';
export const LEGACY_DASHBOARD_VIEW_STORAGE_KEY = 'dashboard_view_mode';

export const DASHBOARD_MODES: DashboardModeConfig[] = [
    {
        id: 'executive',
        label: '사장 모드',
        shortLabel: '사장',
        roleGroup: '전사 운영',
        layout: 'executive',
        icon: faCrown,
        gradient: 'linear-gradient(135deg, #111827 0%, #581c87 46%, #0f766e 100%)',
        accent: '#7c3aed',
        softBg: '#f5f3ff',
        heroTitle: '전사 현황과 정산 흐름을 한 화면에서 봅니다',
        heroDescription: '현장, 인력, 급여, 지원 공수를 의사결정 순서대로 배치했습니다.',
        focusItems: [
            { label: '경영 지표', value: '공수·현장·지원', description: '오늘과 이번 달의 핵심 투입량을 우선 확인합니다.' },
            { label: '정산 우선순위', value: '급여·지원비', description: '지급, 명세, 통계 화면으로 바로 이동합니다.' },
            { label: '관리 범위', value: '전체 데이터', description: '전사 DB와 메뉴 관리까지 빠르게 접근합니다.' },
        ],
        quickActions: [
            { label: '통합 DB', desc: '인력 및 현장 데이터 관리', path: '/database/manpower-db', icon: faDatabase, color: 'blue' },
            { label: '현장 현황', desc: '현장별 실시간 현황판', path: '/dashboard/site-status', icon: faBuilding, color: 'purple' },
            { label: '지원비 지급', desc: '지원비 지급과 정산 확인', path: '/payroll/support-team', icon: faFileInvoiceDollar, color: 'green' },
            { label: '정산 경고', desc: '누락·이상금액 확인', path: '/settlement/alerts', icon: faTriangleExclamation, color: 'rose' },
            { label: '급여 지급', desc: '급여 대장 및 지급 현황', path: '/payroll/wage-payment', icon: faHandHoldingDollar, color: 'emerald' },
            { label: '급여 통계', desc: '일급·월급 통계 분석', path: '/payroll/statistics', icon: faChartLine, color: 'sky' },
            { label: '위임장', desc: '급여 수령 위임장 관리', path: '/payroll/delegation-letter', icon: faFileSignature, color: 'rose' },
            { label: '알림톡 발송', desc: '급여와 공지 알림 전송', path: '/payroll/kakao-notification', icon: faPaperPlane, color: 'cyan' },
            { label: '메뉴 관리', desc: '시스템 메뉴 구조 설정', path: '/admin/menu-manager', icon: faCog, color: 'gray', adminOnly: true },
        ],
    },
    {
        id: 'manager',
        label: '실장 모드',
        shortLabel: '실장',
        roleGroup: '운영 관리',
        layout: 'executive',
        icon: faUserTie,
        gradient: 'linear-gradient(135deg, #111827 0%, #075985 48%, #92400e 100%)',
        accent: '#0284c7',
        softBg: '#e0f2fe',
        heroTitle: '오늘 처리해야 할 운영 업무를 앞으로 모았습니다',
        heroDescription: '일보, 인력 DB, 지원비, 급여 초안처럼 실무 확인이 잦은 화면을 중심으로 구성했습니다.',
        focusItems: [
            { label: '일보 흐름', value: '작성·확인', description: '누락 없이 입력과 목록을 빠르게 오갑니다.' },
            { label: '운영 데이터', value: '인력·팀·현장', description: '실무 기준 정보의 정합성을 바로 확인합니다.' },
            { label: '지급 준비', value: '급여·지원비', description: '월급 집계와 지원 명세 작업을 앞단에 둡니다.' },
        ],
        quickActions: [
            { label: '일보 작성', desc: '오늘 작업 내용 기록', path: '/reports/daily?tab=input', icon: faCalendarCheck, color: 'brand' },
            { label: '일보 목록', desc: '일자별 일보 확인', path: '/reports/daily?tab=list-v2', icon: faClipboardList, color: 'orange' },
            { label: '통합 DB', desc: '인력 및 현장 데이터 관리', path: '/database/manpower-db', icon: faDatabase, color: 'blue' },
            { label: '팀 관리', desc: '팀 정보와 소속 확인', path: '/database/team-db', icon: faHardHat, color: 'violet' },
            { label: '지원비 명세서', desc: '지원비 지급명세서 작성', path: '/payroll/support-claim', icon: faFileExcel, color: 'teal' },
            { label: '정산 경고', desc: '누락·이상금액 확인', path: '/settlement/alerts', icon: faTriangleExclamation, color: 'rose' },
            { label: '월급 집계', desc: '월급자 공수와 지급 관리', path: '/payroll/monthly-wage', icon: faListCheck, color: 'orange' },
            { label: '가불·공제', desc: '가불 등록 및 공제 현황', path: '/payroll/advance-payment?tab=register', icon: faMoneyBillTrendUp, color: 'amber' },
            { label: '업무 요청', desc: '요청 업무 처리 현황', path: '/todo', icon: faClipboardCheck, color: 'slate' },
        ],
    },
    {
        id: 'teamLead',
        label: '팀장 모드',
        shortLabel: '팀장',
        roleGroup: '팀 운영',
        layout: 'field',
        icon: faShieldHalved,
        gradient: 'linear-gradient(135deg, #0f172a 0%, #155e75 50%, #365314 100%)',
        accent: '#0891b2',
        softBg: '#ecfeff',
        heroTitle: '팀 출역과 공수를 빠르게 정리합니다',
        heroDescription: '오늘 투입, 팀별 흐름, 일보 작성과 현장 현황을 팀 운영 순서에 맞췄습니다.',
        focusItems: [
            { label: '오늘 출역', value: '인원·공수', description: '당일 작업자와 공수 변화를 먼저 확인합니다.' },
            { label: '팀 현황', value: '팀별 성과', description: '팀 단위 투입 추세를 바로 비교합니다.' },
            { label: '현장 이동', value: '일보·현황', description: '작성과 확인 화면을 짧은 동선으로 연결합니다.' },
        ],
        quickActions: [
            { label: '일보 작성', desc: '오늘 작업 내용 기록', path: '/reports/daily?tab=input', icon: faCalendarCheck, color: 'brand' },
            { label: '오늘 현황', desc: '오늘 일보와 공수 확인', path: '/reports/daily?tab=list-v2', icon: faClipboardList, color: 'orange' },
            { label: '작업자 관리', desc: '팀원 정보 확인', path: '/database/manpower-db', icon: faUsers, color: 'cyan' },
            { label: '팀 관리', desc: '팀 구성과 배정 확인', path: '/database/team-db', icon: faHardHat, color: 'violet' },
            { label: '현장 현황', desc: '현장별 투입 현황', path: '/dashboard/site-status', icon: faBuilding, color: 'green' },
            { label: '지원 관리', desc: '지원 공수와 청구 확인', path: '/payroll/support-claim', icon: faRightLeft, color: 'teal' },
            { label: '가불 신청', desc: '가불 등록과 내역 확인', path: '/payroll/advance-payment', icon: faHandHoldingDollar, color: 'amber' },
            { label: '급여 조회', desc: '급여 지급 내역 확인', path: '/payroll/payslip', icon: faFileInvoiceDollar, color: 'emerald' },
        ],
    },
    {
        id: 'foreman',
        label: '반장 모드',
        shortLabel: '반장',
        roleGroup: '현장 실행',
        layout: 'field',
        icon: faHardHat,
        gradient: 'linear-gradient(135deg, #1f2937 0%, #166534 48%, #b45309 100%)',
        accent: '#16a34a',
        softBg: '#f0fdf4',
        heroTitle: '현장 입력과 확인 동선을 짧게 잡았습니다',
        heroDescription: '작업 입력, 오늘 현황, 작업자 확인, 지원 관리를 현장 실행 순서대로 배치했습니다.',
        focusItems: [
            { label: '작업 입력', value: '일보 우선', description: '오늘 작업 내용을 빠르게 남기는 흐름입니다.' },
            { label: '현장 확인', value: '공수·인원', description: '당일 투입과 최근 일보를 바로 봅니다.' },
            { label: '지원 처리', value: '지원·가불', description: '현장 요청성 업무로 빠르게 이동합니다.' },
        ],
        quickActions: [
            { label: '일보 작성', desc: '오늘 작업 내용 기록', path: '/reports/daily?tab=input', icon: faCalendarCheck, color: 'brand' },
            { label: '오늘 현황', desc: '오늘 일보와 공수 확인', path: '/reports/daily?tab=list-v2', icon: faClipboardList, color: 'orange' },
            { label: '작업자 관리', desc: '작업자 정보 확인', path: '/database/manpower-db', icon: faUsers, color: 'cyan' },
            { label: '현장 현황', desc: '현장별 투입 현황', path: '/dashboard/site-status', icon: faBuilding, color: 'green' },
            { label: '업무 요청', desc: '요청 업무 확인', path: '/todo', icon: faClipboardCheck, color: 'slate' },
            { label: '지원 관리', desc: '지원 공수와 청구 확인', path: '/payroll/support-claim', icon: faRightLeft, color: 'teal' },
            { label: '가불 신청', desc: '가불 등록과 내역 확인', path: '/payroll/advance-payment', icon: faHandHoldingDollar, color: 'amber' },
            { label: '급여 조회', desc: '급여 지급 내역 확인', path: '/payroll/payslip', icon: faFileInvoiceDollar, color: 'emerald' },
        ],
    },
    {
        id: 'worker',
        label: '작업자 모드',
        shortLabel: '작업자',
        roleGroup: '개인 업무',
        layout: 'field',
        icon: faUser,
        gradient: 'linear-gradient(135deg, #111827 0%, #475569 46%, #0f766e 100%)',
        accent: '#0f766e',
        softBg: '#f0fdfa',
        heroTitle: '내 급여와 오늘 현장 정보를 바로 확인합니다',
        heroDescription: '개인 확인이 필요한 급여, 가불, 일보 현황, 공지 동선을 앞에 배치했습니다.',
        focusItems: [
            { label: '내 정보', value: '급여·명세', description: '급여 명세와 지급 내역을 우선 확인합니다.' },
            { label: '신청 업무', value: '가불·위임장', description: '개인 신청 화면으로 바로 이동합니다.' },
            { label: '현장 확인', value: '오늘 현황', description: '현재 현장 흐름과 최근 일보를 확인합니다.' },
        ],
        quickActions: [
            { label: '급여 조회', desc: '급여 지급 내역 확인', path: '/payroll/payslip', icon: faFileInvoiceDollar, color: 'emerald' },
            { label: '가불 신청', desc: '가불 등록과 내역 확인', path: '/payroll/advance-payment', icon: faHandHoldingDollar, color: 'amber' },
            { label: '오늘 현황', desc: '오늘 일보와 공수 확인', path: '/reports/daily?tab=list-v2', icon: faClipboardList, color: 'orange' },
            { label: '일보 작성', desc: '작업 내용 기록', path: '/reports/daily?tab=input', icon: faCalendarCheck, color: 'brand' },
            { label: '위임장 서명', desc: '내용 확인·동의·직접 서명', path: '/worker/delegation-signature', icon: faSignature, color: 'rose' },
            { label: '알림톡', desc: '공지와 발송 내역 확인', path: '/payroll/kakao-notification', icon: faBell, color: 'cyan' },
            { label: '내 프로필', desc: '계정 정보 확인', path: '/profile', icon: faUserGear, color: 'slate' },
            { label: '작업 추세', desc: '최근 투입 흐름 확인', path: '/reports/statistics', icon: faArrowTrendUp, color: 'sky' },
        ],
    },
];

const MODE_BY_ID = DASHBOARD_MODES.reduce<Record<DashboardModeId, DashboardModeConfig>>((acc, mode) => {
    acc[mode.id] = mode;
    return acc;
}, {} as Record<DashboardModeId, DashboardModeConfig>);

const BUSINESS_PARTNER_DASHBOARD_OVERRIDES: Record<BusinessPartnerPositionId, Partial<DashboardModeConfig>> = {
    client: {
        roleGroup: '건설 / 정산',
        icon: faBuilding,
        gradient: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 48%, #0f766e 100%)',
        accent: '#2563eb',
        softBg: '#eff6ff',
        heroTitle: '건설 기준 현장과 정산 흐름을 확인합니다',
        heroDescription: '현장별 출력, 지원 정산, 기성관리와 청구서를 건설 업무 순서로 모았습니다.',
        focusItems: [
            { label: '현장 출력', value: '건설 현장', description: '현장별 출력인원과 노무비 흐름을 우선 확인합니다.' },
            { label: '지원 정산', value: '지원·기성', description: '지원 정산과 기성관리 화면으로 바로 이동합니다.' },
            { label: '기준 정보', value: '건설 DB', description: '통합DB의 건설 회사 정보를 함께 관리합니다.' },
        ],
        quickActions: [
            { label: '건설 DB', desc: '건설 회사 데이터 관리', path: '/database/manpower-db?tab=companies&companyTab=client', icon: faDatabase, color: 'blue' },
            { label: '현장 출력인원', desc: '건설 현장 노무 내역', path: '/payroll/client-site-labor', icon: faFileInvoiceDollar, color: 'indigo' },
            { label: '현장별 지원', desc: '건설/현장 단위 지원 정산', path: '/payroll/support-client-site', icon: faHandHoldingDollar, color: 'emerald' },
            { label: '기성관리', desc: '계약·기성 입력과 대장 확인', path: '/payroll/progress-claims', icon: faListCheck, color: 'orange' },
            { label: '기성청구서', desc: '기성 청구서 출력', path: '/payroll/progress-claim-invoice', icon: faFileSignature, color: 'rose' },
        ],
    },
    rental: {
        roleGroup: '임대 / 거래',
        icon: faTruckFront,
        gradient: 'linear-gradient(135deg, #111827 0%, #b45309 48%, #0f766e 100%)',
        accent: '#d97706',
        softBg: '#fffbeb',
        heroTitle: '임대 거래와 자재 흐름을 한 곳에서 봅니다',
        heroDescription: '임대사 DB, 임대 거래명세표, 견적, 자재와 매입매출 장부를 연결했습니다.',
        focusItems: [
            { label: '거래처 정보', value: '임대사 DB', description: '통합DB의 임대사 회사 정보를 바로 확인합니다.' },
            { label: '거래 문서', value: '견적·명세', description: '임대 견적과 거래명세표 작성 화면으로 이동합니다.' },
            { label: '장부 확인', value: '자재·매입매출', description: '자재 흐름과 매입매출 장부를 함께 점검합니다.' },
        ],
        quickActions: [
            { label: '임대사 DB', desc: '임대사 회사 데이터 관리', path: '/database/manpower-db?tab=companies&companyTab=rental', icon: faDatabase, color: 'orange' },
            { label: '임대 거래명세표', desc: '임대 거래 문서 작성', path: '/transaction/manage', icon: faClipboardList, color: 'amber' },
            { label: '임대 견적', desc: '임대 견적 작성 및 관리', path: '/estimate/manage', icon: faFileExcel, color: 'sky' },
            { label: '자재 통합관리', desc: '자재 입출고와 재고 확인', path: '/materials', icon: faBuilding, color: 'slate' },
            { label: '매입매출 장부', desc: '임대 거래 매입매출 확인', path: '/payroll/workbook-ledger-upgrade', icon: faFileInvoiceDollar, color: 'green' },
        ],
    },
    referral: {
        roleGroup: '소개',
        icon: faUsers,
        gradient: 'linear-gradient(135deg, #0f172a 0%, #0e7490 48%, #047857 100%)',
        accent: '#0891b2',
        softBg: '#ecfeff',
        heroTitle: '소개소 업무 공간',
        heroDescription: '현재 등록된 소개소 전용 메뉴가 없습니다.',
        focusItems: [],
        quickActions: [],
    },
};

const ROLE_MATCHERS: Array<{ mode: DashboardModeId; keywords: string[] }> = [
    { mode: 'executive', keywords: ['사장', '대표', '최고관리자', '관리자', 'ceo', 'chief executive', 'admin', 'owner'] },
    { mode: 'manager', keywords: ['실장', '매니저', '관리', '사무', 'manager', 'office', 'staff', 'office_staff'] },
    { mode: 'teamLead', keywords: ['팀장', '대장', '소장', '시공', 'leader'] },
    { mode: 'foreman', keywords: ['반장', 'foreman'] },
    { mode: 'worker', keywords: ['기공', '기능공', '준기공', '조공', '일반', '일반공', '신규', '작업자', 'worker', 'user'] },
];

export const isDashboardModeId = (value: unknown): value is DashboardModeId => {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MODE_BY_ID, value);
};

export const getDashboardMode = (modeId: DashboardModeId): DashboardModeConfig => {
    return MODE_BY_ID[modeId];
};

export const getDashboardModeForRole = (role?: string | null): DashboardModeId => {
    const normalized = String(role || '').trim().toLowerCase();
    if (!normalized) return 'executive';

    const matched = ROLE_MATCHERS.find(({ keywords }) =>
        keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
    );

    return matched?.mode || 'worker';
};

export const getDashboardModeForPosition = (
    positionId?: string | null,
    positionName?: string | null
): DashboardModeId => {
    const id = String(positionId || '').trim().toLowerCase();
    const name = String(positionName || '').trim();

    if (!id && !name) return 'executive';
    if (findBusinessPartnerPositionDefinition(positionId, positionName)) return 'manager';
    if (id === 'full') return 'executive';
    if (['ceo', 'owner', 'president', 'executive', 'admin'].includes(id)) return 'executive';
    if (id.startsWith('manager') || id === 'manager') return 'manager';
    if (['office', 'office_staff', 'office-staff', 'staff', 'clerk'].includes(id)) return 'manager';
    if (['teamlead', 'team_lead', 'team-lead', 'leader', 'sitelead', 'site_lead'].includes(id)) return 'teamLead';
    if (['foreman', 'banjang'].includes(id)) return 'foreman';
    if (['general', 'newbie', 'worker', 'skilled', 'assistant'].includes(id)) return 'worker';

    return getDashboardModeForRole(name || id);
};

export const getDashboardModeConfigForPosition = (
    positionId?: string | null,
    positionName?: string | null
): DashboardModeConfig => {
    const partnerDefinition = findBusinessPartnerPositionDefinition(positionId, positionName);
    if (partnerDefinition) {
        const baseConfig = getDashboardMode('manager');
        const override = BUSINESS_PARTNER_DASHBOARD_OVERRIDES[partnerDefinition.id];
        const label = String(positionName || partnerDefinition.name).trim();
        return {
            ...baseConfig,
            ...override,
            id: baseConfig.id,
            layout: baseConfig.layout,
            label: `${label} 모드`,
            shortLabel: label,
        };
    }

    const baseConfig = getDashboardMode(getDashboardModeForPosition(positionId, positionName));
    const label = String(positionName || '').trim();

    if (!label) return baseConfig;

    return {
        ...baseConfig,
        label: `${label} 모드`,
        shortLabel: label,
    };
};

const findPositionId = (
    positions: PositionItem[],
    idCandidates: string[],
    nameKeywords: string[]
): string | undefined => {
    const normalizedIds = idCandidates.map((value) => value.toLowerCase());

    const byId = positions.find((position) => normalizedIds.includes(String(position.id || '').toLowerCase()));
    if (byId) return byId.id;

    const byName = positions.find((position) => {
        const name = String(position.name || '').toLowerCase();
        return nameKeywords.some((keyword) => name.includes(keyword.toLowerCase()));
    });

    return byName?.id;
};

export const getPreferredPositionIdForDashboardMode = (
    modeId: DashboardModeId,
    positions: PositionItem[] = []
): string | undefined => {
    if (modeId === 'executive') {
        return findPositionId(positions, ['ceo'], ['대표', '사장']) || findPositionId(positions, ['full'], ['전체']);
    }
    if (modeId === 'manager') {
        return findPositionId(positions, ['manager1', 'manager'], ['메니저', '매니저', '실장']);
    }
    if (modeId === 'teamLead') {
        return findPositionId(positions, ['teamLead', 'teamlead'], ['팀장', '소장']);
    }
    if (modeId === 'foreman') {
        return findPositionId(positions, ['foreman'], ['반장']);
    }
    if (modeId === 'worker') {
        return findPositionId(positions, ['general', 'newbie'], ['일반', '신규', '작업자']);
    }

    return undefined;
};
