export const MENU_PATHS: { [key: string]: string } = {
    "대시보드": "/dashboard",
    "통합 엑셀등록": "/mass-upload/integrated",
    "통합 일괄 등록": "/mass-upload/integrated", // Keep compat just in case
    "통합 현황판": "/jeonkuk/integrated-status",
    "현황 그래프": "/jeonkuk/status-graph",
    "통합 지원 현황판": "/jeonkuk/integrated-support-status",
    "인원전체내역조회": "/jeonkuk/total-history",
    "팀별/인원별 현황 조회": "/reports/team-personnel-status",
    '디자인 관리': '/design/management',
    "상태관리": "/jeonkuk/status-management",

    "DB 조회": "/database/lookup",
    "일보관리": "/reports/daily",
    "일보작성": "/reports/daily?tab=input",
    "일보 v2": "/reports/daily-v2",
    "일보목록": "/reports/daily?tab=list",
    "AI일보": "/reports/daily?tab=lookup",

    "급여 지급 관리": "/payroll/wage-payment",
    "일급제": "/payroll/daily-wage",
    "월급제": "/payroll/monthly-wage",
    "월급제v2": "/payroll/monthly-wage",
    "월급제 집계": "/payroll/monthly-wage",
    "지원팀": "/payroll/support-team",
    "지원팀 지급": "/payroll/support-team",
    "지원비 명세서": "/payroll/support-claim",
    "단가관리": "/payroll/rate-management?tab=unit",
    "지원비관리": "/payroll/rate-management?tab=support",
    "현장별 명세서": "/payroll/payslip?tab=site",
    "가불 관리": "/payroll/advance-payment",
    "가불등록": "/payroll/advance-payment?tab=register",
    "가불목록": "/payroll/advance-payment?tab=list",
    "세금/가불": "/payroll/team-payslip",
    "세금/가불 계산": "/payroll/team-payslip",
    "싸인 관리": "/payroll/sign-management",

    // 서명 관리
    "서명생성기": "/payroll/signature-generator",
    "서명위임장": "/payroll/delegation-letter",
    "위임장v2": "/payroll/delegation-letter-v2",

    // 세금계산서
    "세금계산서 발행": "/payroll/taxinvoice/issue",
    "세금계산서 거래장": "/payroll/taxinvoice/ledger",
    "미수금 대시보드": "/payroll/taxinvoice/dashboard",
    "미수금 관리": "/payroll/taxinvoice/receivables",
    "숙소 관리": "/support/accommodation",
    "법인차량 관리": "/support/vehicles",
    "가불 및 공제": "/payroll/advance-payment",

    // 자재관리
    "자재 마스터": "/materials/master",
    "입고 등록": "/materials/inbound",
    "출고 등록": "/materials/outbound",
    "입출고 내역": "/materials/transactions",
    "재고 현황": "/materials/inventory",
    "현장별 재고": "/materials/inventory-by-site",





    "명세서": "/payroll/payslip",
    "세금/가불 팀장별 명세서": "/payroll/team-payslip",
    "팀장별 명세서": "/payroll/team-payslip",

    "일급제 지급": "/payroll/wage-payment?tab=daily",

    "월급제 지급": "/payroll/monthly-wage-payment",

    "팀별 지급(초안)": "/payroll/team-payment-draft",

    "팀 배정": "/assignment/team-assignment",
    "현장 배정": "/assignment/site-assignment",

    "직책 배정": "/hr/position-assignment",
    "단가 변경": "/hr/rate-change",


    "시스템 설정": "/settings",
    "시스템 메시지 설정": "/settings/system-messages",
    "통합DB": "/database/manpower-db",
    "통합DB(새창)": "/database/manpower-db?newTab=1",
    "테스트설정": "/test-settings",
    "프로필 설정": "/profile",

    // 지원 관리
    "지원비 설정": "/support/settings",
    "지원 현황판": "/support/status",
    "지원비 단가 관리": "/support/rate-management",
    "인력 교류 정산": "/support/labor-exchange",

    "청연ERP 설명서": "/manual",
    "홈페이지 사용법": "/manual",


    // 전국JS ERP 메뉴
    "일보등록": "/jeonkuk/report-register",
    "근로자 등록": "/jeonkuk/worker-registration?newTab=1",
    "근로자 등록(새창)": "/jeonkuk/worker-registration?newTab=1",
    "근로자 대량 등록": "/manpower/smart-registration",
    "근로자 그리드 등록": "/manpower/smart-registration-grid",
    "팀 등록": "/manpower/team-management",
    "팀 대량 등록": "/manpower/smart-team-registration",
    "현장 등록": "/jeonkuk/site-registration",
    "현장 대량 등록": "/manpower/smart-site-registration",
    "회사 등록": "/database/company-db",
    "회사 조직도": "/company/organization",
    "회사소개": "/cheongyeon/home", // New mapping
    "인사말": "/cheongyeon/greeting",
    "대표 인사말": "/cheongyeon/greeting", // New alias
    "조직도": "/cheongyeon/organization",
    "오시는 길": "/cheongyeon/directions",
    "회사 대량 등록": "/database/smart-company-registration",
    "회사DB": "/database/company-db",
    "DB 구조도": "/jeonkuk/db-structure",
    "DB 설계도": "/jeonkuk/db-design",
    "데이터 관계 시각화": "/admin/data-relationships",
    "데이터 콘솔": "/admin/console",
    "관계 관리 콘솔": "/admin/relationship-console",






    "클라우드 저장소": "/storage",
    "로컬 저장소": "/storage",
    "구글 드라이브": "/storage/google-drive",

    "급여 정산 설계도": "/jeonkuk/payroll-design",

    // 관리자 메뉴
    "팀 관리": "/manpower/team-management",

    // 테스트 메뉴
    "Smart Excel": "/report/excel",
    "일보 스마트 입력 (AI)": "/report/excel",
    "일보 v3": "/report/excel",
    "일보 대량 등록": "/report/smart-registration",
    "대용량 엑셀 업로드": "/report/mass-upload",
    "엑셀 데이터 구조도": "/admin/excel-guide",


    // Mass Upload (Excel)
    "작업자 엑셀 등록": "/upload/worker",
    "팀 엑셀 등록": "/upload/team",
    "현장 엑셀 등록": "/upload/site",
    "회사 엑셀 등록": "/upload/company",
    "출력일보 엑셀 등록": "/upload/daily-report",
    "안전 업로드 가이드": "/manual/excel-guide",

    // 학습 메뉴
    "라이브러리 사용법": "/structure/library-guide",
    "프로젝트 파일 구조": "/admin/project-structure",
    "시스템 관리": "/system-management",
    "데이터 연결 점검": "/admin/integrity",

    // 개발자 도구
    "에이전트 플레이그라운드": "/admin/agent-playground",
    "메뉴관리": "/admin/menu-manager",
    "권한 관리": "/admin/role-menu",
    "시스템 권한 관리": "/admin/role-menu", // Alias
    "카카오톡 관리": "/payroll/kakao-notification",
    "사용자 권한 설정": "/settings", // Alias for Settings where User Management lives
    // Refine Integrated Console
    "작업자 콘솔": "/manpower/refine-workers",
    "팀 콘솔": "/manpower/refine-teams",
    "현장 콘솔": "/manpower/refine-sites",
    "회사 콘솔": "/manpower/refine-companies",
    "통합 데이터 콘솔": "/manpower/refine-sites", // Alias
    "정산 시스템 설계도": "/design/settlement-architecture",
    "스마트 메모": "/memos", // Smart Memo System
};
