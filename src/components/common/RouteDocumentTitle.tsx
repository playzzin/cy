import { useLayoutEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { MENU_PATHS } from '../../constants/menuPaths';

const SITE_TITLE = '청연ENG ERP';
const pageNames: Record<string, string> = {
    '/': '로그인',
    '/login': '로그인',
    '/homepage/client': '홈페이지 제작 진행 현황',
    '/construction-plans': '시공계획서',
    '/construction-plan-records': '시공계획서 기록',
    '/construction-plans/:planId/exports': '시공계획서 내보내기',
    '/dashboard-v2': '경영 대시보드',
    '/reports/daily-worker-calendar': '작업자 일보 달력',
    '/reports/labor-check': '공수 확인',
    '/reports/list': '보고서 목록',
    '/labor/workers': '작업자 목록',
    '/manpower': '인력 입력',
    '/manpower/site-manager-detail': '현장 담당자 상세',
    '/manpower/refine-smart-select': '스마트 선택 데모',
    '/database/company-db-construction': '건설사 관리',
    '/database/office-staff-db': '사무직 관리',
    '/database/account-management': '계좌 관리',
    '/database/worker-input': '작업자 입력',
    '/mass-upload/daily-report-integrated': '통합 일보 등록',
    '/payroll/daily-wage-statement': '일용 노임명세서',
    '/payroll/support-company-site': '회사별 현장 지원 정산',
    '/payroll/support-site': '현장별 지원 정산',
    '/payroll/partner-support-labor': '협력사별 지원 노임명세서',
    '/payroll/client-site-labor-statement': '건설사별 현장 노임명세서',
    '/payroll/team-payment-draft-legacy': '팀별 지급 초안',
    '/payroll/tax-invoice': '세금계산서',
    '/payroll/tax-invoice-ledger': '세금계산서 대장',
    '/payroll/taxinvoice/issue': '세금계산서 발행',
    '/payroll/taxinvoice/ledger': '세금계산서 대장',
    '/payroll/taxinvoice/receivables': '미수금 관리',
    '/payroll/taxinvoice/dashboard': '미수금 대시보드',
    '/payroll/workbook-ledger': '통합 거래대장',
    '/payroll/workbook-ledger-dawon': '다원 거래대장',
    '/payroll/partner-ledger': '거래처 거래대장',
    '/payroll/kakao-test': '카카오 테스트',
    '/payroll/kakao-sender': '카카오 발송',
    '/payroll/kakao-message-center': '카카오 메시지 센터',
    '/payroll/tax-affairs': '세무 관리',
    '/payroll/delegation-letter-v3': '위임장 v3',
    '/payroll/delegation-letter-v5': '위임장 v5',
    '/payroll/labor-exchange': '노무 교류',
    '/payroll/team-settlement-stats': '팀별 정산 통계',
    '/payroll/team-settlement-annual-stats': '팀별 연간 정산 통계',
    '/office/team-settlement': '팀별 정산',
    '/office/payroll': '사무직 급여',
    '/homepage/requests': '홈페이지 제작 요청',
    '/homepage/requests/new': '홈페이지 제작 요청 등록',
    '/notice-board': '공지사항',
    '/messages/compose': '쪽지 작성',
    '/settings/system-messages': '시스템 메시지 설정',
    '/assignment/daily-dispatch': '일일 배치',
    '/worker/off-duty-request': '휴무 신청',
    '/assignment/schedule-confirmation-board': '일정 확정 현황판',
    '/support/vehicles/engine-oil': '엔진오일 관리',
    '/support/engine-oil': '엔진오일 관리',
    '/support/team-equipment': '팀별 장비 관리',
    '/support/team-equipment-status': '팀별 장비 현황',
    '/support/expense-claim-input': '경비 청구 입력',
    '/support/team-resources': '팀별 자원 상세',
    '/materials/inbound-certificate': '자재 입고증',
    '/materials/outbound-certificate': '자재 출고증',
    '/jeonkuk/team-registration': '팀 등록',
    '/jeonkuk/support-assignment': '지원 배정',
    '/jeonkuk/data-integrity': '데이터 정합성',
    '/jeonkuk/test-data-generator': '테스트 데이터 생성',
    '/jeonkuk/test-daily-report-generator': '테스트 일보 생성',
    '/jeonkuk/salary-model-updater': '급여 모델 업데이트',
    '/admin/component-management': '컴포넌트 관리',
    '/admin/activity-logs': '활동 로그',
    '/admin/library-guide': '라이브러리 가이드',
    '/admin/data-backup': '데이터 백업',
    '/admin/accommodation-design': '숙소 관리 설계',
    '/admin/agent-dashboard': '에이전트 대시보드',
    '/admin/menu': '메뉴 관리',
    '/admin/menu-sync-tool': '메뉴 동기화',
    '/admin/system-status': '시스템 상태',
    '/design-system': '디자인 시스템',
    '/system/sync-status': '데이터 동기화 상태',
    '/structure/organization': '조직도',
    '/corp/company/ceo-intro': '대표 인사말',
    '/company/management': '회사 관리',
    '/company/registration': '회사 등록',
    '/estimate/new': '견적서 작성',
    '/site/management-closed': '마감 현장 관리',
};

// Keep the first name for paths that also have legacy menu aliases.
Object.entries(MENU_PATHS).forEach(([name, path]) => {
    if (!pageNames[path]) pageNames[path] = name;
});

export const getRouteDocumentTitle = (pathname: string, search = ''): string => {
    const currentPath = pathname.replace(/\/+$/, '') || '/';
    const currentParams = new URLSearchParams(search);
    let bestName = '';
    let bestScore = -1;

    Object.entries(pageNames).forEach(([target, name]) => {
        const [path, query = ''] = target.split('?');
        const exact = Boolean(matchPath({ path, end: true }, currentPath));
        if (!exact && (path === '/' || !matchPath({ path, end: false }, currentPath))) return;

        const params = Array.from(new URLSearchParams(query).entries());
        if (!params.every(([key, value]) => currentParams.getAll(key).includes(value))) return;

        // Prefer exact pages, then the most specific query or parent path.
        const score = (exact ? 10000 : 0) + path.length + params.length * 100;
        if (score > bestScore) {
            bestScore = score;
            bestName = name;
        }
    });

    return bestName ? `${bestName} | ${SITE_TITLE}` : SITE_TITLE;
};

const RouteDocumentTitle = () => {
    const { pathname, search } = useLocation();

    // Page-specific metadata effects can still supply a more detailed title.
    useLayoutEffect(() => {
        document.title = getRouteDocumentTitle(pathname, search);
    }, [pathname, search]);

    return null;
};

export default RouteDocumentTitle;
