"use strict";
(globalThis["webpackChunksmart_construction"] = globalThis["webpackChunksmart_construction"] || []).push([["src_services_menuServiceV11_ts"],{

/***/ "./src/constants/headerActions.ts"
/*!****************************************!*\
  !*** ./src/constants/headerActions.ts ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_HEADER_ACTIONS: () => (/* binding */ DEFAULT_HEADER_ACTIONS)
/* harmony export */ });
const DEFAULT_HEADER_ACTIONS = [{
  id: 'header-theme',
  text: '테마 전환',
  icon: 'fa-sun',
  action: 'theme'
}, {
  id: 'header-calculator',
  text: '계산기',
  icon: 'fa-calculator',
  action: 'calculator'
}, {
  id: 'header-camera',
  text: '카메라',
  icon: 'fa-camera',
  action: 'camera'
}, {
  id: 'header-position',
  text: '모드 선택',
  icon: 'fa-id-badge',
  action: 'position',
  roles: ['admin', '관리자', '사장', '실장', 'super_admin']
}, {
  id: 'header-admin',
  text: '관리자 메뉴',
  icon: 'fa-user-shield',
  action: 'admin',
  roles: ['admin', '관리자', '사장', '실장', 'super_admin']
}, {
  id: 'header-messages',
  text: '메시지함',
  icon: 'fa-envelope',
  action: 'messages'
}];

/***/ },

/***/ "./src/constants/menuPaths.ts"
/*!************************************!*\
  !*** ./src/constants/menuPaths.ts ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MENU_PATHS: () => (/* binding */ MENU_PATHS)
/* harmony export */ });
const MENU_PATHS = {
  '국민은행 송금': '/payroll/bank-transfer',
  '위임금 입금 확인': '/payroll/delegated-receipts',
  '도장 이미지 관리': '/settings/stamps',
  '엑셀 양식 변환': '/tools/excel-converter',
  '양식변경': '/tools/excel-converter',
  "\ub300\uc2dc\ubcf4\ub4dc": "/dashboard",
  "\ud1b5\ud569 \uc5d1\uc140\ub4f1\ub85d": "/mass-upload/integrated",
  "\ud1b5\ud569 \uc77c\uad04 \ub4f1\ub85d": "/mass-upload/integrated",
  // Keep compat just in case
  "\ud1b5\ud569 \ud604\ud669\ud310": "/jeonkuk/integrated-status",
  "\uc804\uad6d\ud398\uc774\uc9c0": "/jeonkuk/nationwide-partners",
  "\uc804\uad6d \ud398\uc774\uc9c0": "/jeonkuk/nationwide-partners",
  "\uc804\uad6d\uc2dc\uc2a4\ud15c\uc778\ub825": "/dashboard3",
  "\uc804\uad6d\uc2dc\uc2a4\ud15c\uc778\ub825 \ud648": "/dashboard3",
  "\ud604\ud669 \uadf8\ub798\ud504": "/jeonkuk/status-graph",
  "\ud1b5\ud569 \uc9c0\uc6d0 \ud604\ud669\ud310": "/jeonkuk/integrated-support-status",
  "\uc778\uc6d0\uc804\uccb4\ub0b4\uc5ed\uc870\ud68c": "/jeonkuk/total-history",
  "\ud300\ubcc4/\uc778\uc6d0\ubcc4 \ud604\ud669 \uc870\ud68c": "/reports/team-personnel-status",
  '\ub514\uc790\uc778 \uad00\ub9ac': '/design/management',
  "\uc0c1\ud0dc\uad00\ub9ac": "/jeonkuk/status-management",
  "DB \uc870\ud68c": "/database/lookup",
  "\uc77c\ubcf4\uad00\ub9ac": "/reports/daily",
  "\ucd9c\ub825 \uad00\ub9ac": "/reports/daily",
  "\uc7ac\uc9c1\uc99d\uba85\uc11c": "/hr/certificate",
  "해촉증명서": "/hr/termination-certificate",
  "해촉 증명서": "/hr/termination-certificate",
  "\uc77c\ubcf4\uc791\uc131": "/reports/daily?tab=input",
  "\ubcf4\ub4dc\uc785\ub825": "/reports/daily?tab=board-input",
  "\uc77c\ubcf4 \ubcf4\ub4dc\uc785\ub825": "/reports/daily?tab=board-input",
  "\uc77c\ubcf4 v2": "/reports/daily-v2",
  "\uc77c\ubcf4\ubaa9\ub85d": "/reports/daily?tab=list",
  "\uc77c\ubcf4\ubaa9\ub85dv2": "/reports/daily?tab=list-v2",
  "출력일보 로그": "/reports/daily-logs",
  "일보 로그": "/reports/daily-logs",
  "일보변경로그": "/reports/daily-logs",
  "AI\uc77c\ubcf4": "/reports/daily?tab=lookup",
  "\uae09\uc5ec \uc9c0\uae09 \uad00\ub9ac": "/payroll/wage-payment",
  "\uc77c\uae09\uc81c": "/payroll/daily-wage",
  "\uc6d4\uae09\uc81c": "/payroll/monthly-wage",
  "\uc6d4\uae09\uc81cv2": "/payroll/monthly-wage",
  "\uc6d4\uae09\uc81c \uc9d1\uacc4": "/payroll/monthly-wage",
  "\uc9c0\uc6d0\ud300": "/payroll/support-team",
  "\uc9c0\uc6d0\ud300 \uc9c0\uae09": "/payroll/support-team",
  "외부지원간곳": "/payroll/support-team",
  "지원온곳": "/payroll/support-team-incoming",
  "지원온곳 지급": "/payroll/support-team-incoming",
  "지원팀 지원온곳": "/payroll/support-team-incoming",
  "외부지원온곳": "/payroll/support-team-incoming",
  "내부지원팀": "/payroll/support-team-internal",
  "내부지원팀 지급": "/payroll/support-team-internal",
  "내부지원간곳": "/payroll/support-team-internal",
  "내부지원온곳": "/payroll/support-team-internal-incoming",
  "협력사별 지원 출력": "/payroll/partner-support-workers",
  "협력사별 지원 인원": "/payroll/partner-support-workers",
  "협력사별 지원 노임명세서": "/payroll/partner-support-workers",
  "협력사별 노임명세서": "/payroll/partner-support-workers",
  "협력사별 외부/내부지원": "/payroll/partner-support-workers",
  "협력사별 외부지원 내부지원": "/payroll/partner-support-workers",
  "지원팀 발주팀별 현장별": "/payroll/support-client-site",
  "발주팀별 현장별": "/payroll/support-client-site",
  "발주팀별 현장별 지원": "/payroll/support-client-site",
  "현장별 지원 정산": "/payroll/support-client-site",
  "건설사별 현장 출력인원": "/payroll/client-site-labor",
  "건설사별 현장 노임명세서": "/payroll/client-site-labor",
  "건설사별 노임명세서": "/payroll/client-site-labor",
  "건설사 현장 출력": "/payroll/client-site-labor",
  "발주사별 현장 출력인원": "/payroll/client-site-labor",
  "발주사별 현장 노임명세서": "/payroll/client-site-labor",
  "발주사별 노임명세서": "/payroll/client-site-labor",
  "발주사 현장 출력": "/payroll/client-site-labor",
  "\uc9c0\uc6d0\ube44 \uba85\uc138\uc11c": "/payroll/support-claim",
  "기성관리": "/payroll/progress-claims",
  "기성 관리": "/payroll/progress-claims",
  "기성관리대장": "/payroll/progress-claims",
  "기성 관리 대장": "/payroll/progress-claims",
  "현장별 기성관리대장": "/payroll/progress-claims",
  "현장별 기성 관리 대장": "/payroll/progress-claims",
  "현장별 기성대장": "/payroll/progress-claims?tab=ledger",
  "현장별 대장": "/payroll/progress-claims?tab=ledger",
  "기성대장": "/payroll/progress-claims?tab=ledger",
  "기성청구서": "/payroll/progress-claim-invoice",
  "기성 청구서": "/payroll/progress-claim-invoice",
  "계약/기성입력": "/payroll/progress-claims?tab=entry",
  "현장별 계약내역": "/payroll/progress-claims?tab=entry",
  "월별 기성입력": "/payroll/progress-claims?tab=entry",
  "바이백": "/payroll/field-buyback",
  "스꾸미": "/payroll/progress-claims?tab=buyback",
  "관계자 배분": "/payroll/progress-claims?tab=buyback",
  "바이백 정리": "/payroll/buyback-ledger",
  "바이백 내역": "/payroll/buyback-ledger",
  "바이백 현황": "/payroll/buyback-ledger",
  "현장별 바이백": "/payroll/buyback-ledger",
  "현장별 바이백 정리": "/payroll/buyback-ledger",
  "바이백 페이지": "/payroll/field-buyback",
  "바이백페이지": "/payroll/field-buyback",
  "\ub2e8\uac00\uad00\ub9ac": "/payroll/rate-management?tab=unit",
  "\uc9c0\uc6d0\ube44\uad00\ub9ac": "/payroll/rate-management?tab=support",
  "\ud604\uc7a5\ubcc4 \uba85\uc138\uc11c": "/payroll/payslip?tab=site",
  "\uac00\ubd88 \uad00\ub9ac": "/payroll/advance-payment",
  "\uac00\ubd88 \uc2e0\uccad": "/payroll/advance-request",
  "\uac00\ubd88\uc2e0\uccad": "/payroll/advance-request",
  "\uc791\uc5c5\uc790 \uac00\ubd88 \uc2e0\uccad": "/payroll/advance-request",
  "\ub300\ub0a9\ucd9c\ub825\ubd80": "/payroll/daily-advance-workbook",
  "\ub300\ub0a9 \ucd9c\ub825\ubd80": "/payroll/daily-advance-workbook",
  "\ud300\uc815\uc0b0 \uad00\ub9ac": "/payroll/team-settlement",
  "\ud300\uc815\uc0b0 \ud1b5\uacc4": "/payroll/team-settlement-statistics",
  "\ud300\uc815\uc0b0\ud1b5\uacc4": "/payroll/team-settlement-statistics",
  "팀별 연간 통계": "/payroll/team-settlement-annual-statistics",
  "팀정산 연간 통계": "/payroll/team-settlement-annual-statistics",
  "팀정산연간통계": "/payroll/team-settlement-annual-statistics",
  "정산 경고센터": "/settlement/alerts",
  "정산경고센터": "/settlement/alerts",
  "정산 누락": "/settlement/alerts",
  "정산누락": "/settlement/alerts",
  "이상금액 경고": "/settlement/alerts",
  "이상금액경고": "/settlement/alerts",
  "누락 정산": "/settlement/alerts",
  "누락정산": "/settlement/alerts",
  "\uac00\ubd88\ub4f1\ub85d": "/payroll/advance-payment?tab=register",
  "\uac00\ubd88\ubaa9\ub85d": "/payroll/advance-payment?tab=list",
  "\uc138\uae08/\uac00\ubd88": "/payroll/team-payslip",
  "\uc138\uae08/\uac00\ubd88 \uacc4\uc0b0": "/payroll/team-payslip",
  "\uc2f8\uc778 \uad00\ub9ac": "/payroll/sign-management",
  "\uc77c\uc6a9\ub178\ubb34\ube44 \uc9c0\uae09\uba85\uc138\uc11c": "/payroll/labor-cost-statement-generator",
  "\ub178\ubb34\ube44 \uc9c0\uae09\uba85\uc138\uc11c \uc0dd\uc131\uae30": "/payroll/labor-cost-statement-generator",
  "은행 입출금 알림": "/finance/bank-notifications",
  "은행입출금알림": "/finance/bank-notifications",
  "입출금 알림센터": "/finance/bank-notifications",
  "국민은행 알림": "/finance/bank-notifications",
  // \uc11c\uba85 \uad00\ub9ac
  "\uc11c\uba85\uc0dd\uc131\uae30": "/payroll/signature-generator",
  "\uc11c\uba85\ub4f1\ub85d": "/payroll/signature-generator",
  "\uc11c\uba85\uc704\uc784\uc7a5": "/payroll/delegation-letter",
  "\uc704\uc784\uc7a5v2": "/payroll/delegation-letter-v2",
  "현금수령확인서": "/payroll/cash-receipt-confirmation",
  "현금수령 확인서": "/payroll/cash-receipt-confirmation",
  "급여계좌변경신청서": "/payroll/account-change-request",
  "급여계좌 변경 신청서": "/payroll/account-change-request",
  "계좌변경신청서": "/payroll/account-change-request",
  "계좌변경 신청서": "/payroll/account-change-request",
  "위임장 서명": "/worker/delegation-signature",
  "작업자 위임장 서명": "/worker/delegation-signature",
  "\uacc4\uc88c\ubc88\ud638\uad00\ub9ac": "/payroll/taxinvoice/account-inquiry",
  "\uc791\uc5c5\uc790 \uacc4\uc88c": "/payroll/taxinvoice/account-inquiry?tab=workers",
  "\ud300 \uacc4\uc88c": "/payroll/taxinvoice/account-inquiry?tab=teams",
  "\ud68c\uc0ac \uacc4\uc88c": "/payroll/taxinvoice/account-inquiry?tab=companies",
  "\ub9e4\uc785 \uacc4\uc88c": "/payroll/taxinvoice/account-inquiry?tab=custom",
  "\uae30\ud0c0 \uacc4\uc88c": "/payroll/taxinvoice/account-inquiry?tab=custom",
  "\ub9e4\uc785/\uae30\ud0c0 \uacc4\uc88c": "/payroll/taxinvoice/account-inquiry?tab=custom",
  "세금계산서 발행리스트": "/payroll/taxinvoice/issue-list",
  "발행리스트": "/payroll/taxinvoice/issue-list",
  "세금계산서발행리스트": "/payroll/taxinvoice/issue-list",
  "매입매출 관리": "/payroll/workbook-ledger",
  "매입매출 로그": "/payroll/workbook-ledger/logs",
  "매입매출 변경 로그": "/payroll/workbook-ledger/logs",
  "매입매출장부 로그": "/payroll/workbook-ledger/logs",
  "매입매출장부로그": "/payroll/workbook-ledger/logs",
  "\uc0ac\ubb34\uc2e4 \uad00\ub9ac": "/office/management",
  "\uc0ac\ubb34\uc2e4 \uc6b4\uc601 \ub300\uc2dc\ubcf4\ub4dc": "/office/dashboard",
  "\uc6b4\uc601 \ub300\uc2dc\ubcf4\ub4dc": "/office/dashboard",
  "\uc2e0\uccad \uc2b9\uc778\uc13c\ud130": "/office/request-center",
  "\uc0ac\ubb34\uc2e4 \uc2e0\uccad \uc2b9\uc778\uc13c\ud130": "/office/request-center",
  "\uc77c\ubcf4 \uac80\uc218": "/office/daily-review",
  "\uacc4\uc88c / \uc11c\ub958 \uad00\ub9ac": "/office/worker-documents",
  "\uc791\uc5c5\uc790 \uc11c\ub958 \uad00\ub9ac": "/office/worker-documents",
  "\uacf5\uc9c0 / \uba54\uc2dc\uc9c0 \ubc1c\uc1a1": "/office/communications",
  "\uae09\uc5ec \uc9c0\uae09 \uc804 \ud655\uc778": "/office/payroll-check",
  "\ucc98\ub9ac \uc774\ub825 / \ub85c\uadf8": "/office/audit-log",
  "\ud300 \uc694\uccad\ud568": "/team/requests",
  "\uc791\uc5c5\uc790 \ud648": "/worker/home",
  "\uc0ac\ubb34\uc2e4 \ud300\uc815\uc0b0 \uad00\ub9ac": "/office/team-settlement-management",
  "\uc0ac\ubb34\uc2e4 \ud300\uc815\uc0b0": "/office/team-settlement-management",
  "\ud300\uc815\uc0b0 \uc0ac\ubb34\uc2e4 \uad00\ub9ac": "/office/team-settlement-management",
  "\uc0ac\ubb34\uc2e4 \uc9c1\uc6d0 \uae09\uc5ec": "/payroll/office-staff-payroll",
  "\uc0ac\ubb34\uc2e4 \uae09\uc5ec \uacc4\uc0b0": "/payroll/office-staff-payroll",
  "\uc0ac\ubb34\uc2e4 \uc9c1\uc6d0\uae09\uc5ec": "/payroll/office-staff-payroll",
  "\uc0ac\ubb34\uc2e4 \ubaa9\ub85d": "/database/manpower-db?tab=offices",
  "\uc0ac\ubb34\uc2e4 \uc9c1\uc6d0": "/database/manpower-db?tab=offices",
  "\uc0ac\ubb34\uc2e4 \uc9c1\uc6d0 \uad00\ub9ac": "/database/manpower-db?tab=offices",
  "정산 대상자": "/database/manpower-db?tab=settlement-targets",
  "바이백 대상자": "/database/manpower-db?tab=settlement-targets",
  "바이백 목록": "/database/manpower-db?tab=settlement-targets",
  "\uc77c\ubcf4 \ud1b5\uacc4": "/reports/statistics",
  "\uc77c\uae09\uc81c \uc6d4\uae09\uc81c \ud1b5\uacc4": "/payroll/statistics",
  // \uc790\uc7ac\uad00\ub9ac
  "\uc790\uc7ac \ud1b5\ud569\uad00\ub9ac": "/materials",
  "\uc790\uc7ac \ub9c8\uc2a4\ud130": "/materials/master",
  "\uc785\uace0 \ub4f1\ub85d": "/materials/inbound",
  "\ucd9c\uace0 \ub4f1\ub85d": "/materials/outbound",
  "\uc785\ucd9c\uace0 \ub0b4\uc5ed": "/materials/transactions",
  "\ud604\uc7a5\uc77c\uc790 \uc785\ucd9c\uace0": "/materials/transactions-by-site-date",
  "\ud604\uc7a5\ub0a0\uc9dc \uc785\ucd9c\uace0": "/materials/transactions-by-site-date",
  "\ud604\uc7a5\ubcc4 \ub0a0\uc9dc\ubcc4 \uc785\ucd9c\uace0": "/materials/transactions-by-site-date",
  "\ud604\uc7a5\ubb3c\ud488": "/materials/field-goods",
  "\ud604\uc7a5\ubb3c\ud488 \uccad\uad6c": "/materials/field-goods",
  "\uc790\uc7ac \uccad\uad6c \ubaa8\ub378": "/materials/field-goods",
  "\ud604\uc7a5\ubb3c\ud488 \uccad\uad6c \uc124\uacc4": "/materials/field-goods",
  "\uc7ac\uace0 \ud604\ud669": "/materials/inventory",
  "\ud604\uc7a5\ubcc4 \uc7ac\uace0": "/materials/inventory-by-site",
  "자재관리 로그": "/materials/logs",
  "자재 로그": "/materials/logs",
  "자재변경로그": "/materials/logs",
  "\uba85\uc138\uc11c": "/payroll/payslip",
  "\uc138\uae08/\uac00\ubd88 \ud300\uc7a5\ubcc4 \uba85\uc138\uc11c": "/payroll/team-payslip",
  "\ud300\uc7a5\ubcc4 \uba85\uc138\uc11c": "/payroll/team-payslip",
  "\uc77c\uae09\uc81c \uc9c0\uae09": "/payroll/wage-payment?tab=daily",
  "\uc6d4\uae09\uc81c \uc9c0\uae09": "/payroll/monthly-wage-payment",
  "\ud300\ubcc4 \uc9c0\uae09(\ucd08\uc548)": "/payroll/team-payment-draft",
  "\ud300 \ubc30\uc815": "/assignment/team-assignment",
  "\ud604\uc7a5 \ubc30\uc815": "/assignment/site-assignment",
  "\ud604\uc7a5 \uc778\uc6d0 \uc694\uccad": "/assignment/field-request",
  "\ud604\uc7a5 \uc77c\uc815 \uc694\uccad": "/assignment/field-request",
  "\uc778\uc6d0 \uc694\uccad": "/assignment/field-request",
  "\ud734\ubb34\uc790 \uc694\uccad": "/assignment/field-request",
  "휴무신청": "/assignment/off-duty-request",
  "휴무 신청": "/assignment/off-duty-request",
  "작업자 휴무신청": "/assignment/off-duty-request",
  "작업자 휴무 신청": "/assignment/off-duty-request",
  "내 휴무신청": "/assignment/off-duty-request",
  "내 휴무 신청": "/assignment/off-duty-request",
  "\ud604\uc7a5 \uc77c\uc815 \uad00\ub9ac": "/assignment/field-schedule",
  "\ud604\uc7a5 \uc77c\uc815 \ub4f1\ub85d": "/assignment/field-schedule",
  "\ud300\ubcc4 \ud604\uc7a5 \uc77c\uc815": "/assignment/field-schedule",
  "\ubc30\ucc28 \uc77c\uc815 \ubcf4\ub4dc": "/assignment/field-schedule",
  "\uc77c\uc815\ud655\uc815\ubcf4\ub4dc": "/assignment/schedule-confirmation",
  "\uc77c\uc815 \ud655\uc815 \ubcf4\ub4dc": "/assignment/schedule-confirmation",
  "\ud604\uc7a5 \uc77c\uc815\ud655\uc815\ubcf4\ub4dc": "/assignment/schedule-confirmation",
  "\ud604\uc7a5 \uc77c\uc815 \ud655\uc815 \ubcf4\ub4dc": "/assignment/schedule-confirmation",
  "\uc9c1\ucc45 \ubc30\uc815": "/admin/user-management",
  "\ub2e8\uac00 \ubcc0\uacbd": "/hr/rate-change",
  "\uc0ac\uac74 \uae30\ub85d \uad00\ub9ac": "/hr/incident-cases",
  "\uc0ac\uac74\u00b7\uc0ac\uace0 \uae30\ub85d": "/hr/incident-cases",
  "\uc2dc\uc2a4\ud15c \uc124\uc815": "/settings",
  "AI \uc124\uc815": "/settings/ai",
  "\uc2dc\uc2a4\ud15c \uba54\uc2dc\uc9c0 \uc124\uc815": "/messages/settings",
  "로그 자동 메시지 설정": "/messages/settings",
  "메시지 자동설정": "/messages/settings",
  "자동 로그 메시지": "/messages/settings",
  "자동 메시지 발송 로그": "/messages/automation-logs",
  "자동발송로그": "/messages/automation-logs",
  "\uba54\uc2dc\uc9c0\ud568": "/messages",
  "\uba54\uc138\uc9c0\ud568": "/messages",
  "\uc5c5\ubb34 \uba54\uc2dc\uc9c0": "/messages",
  "공지사항": "/notices",
  "공지사항 게시판": "/notices",
  "공지 게시판": "/notices",
  "시공계획서": "/construction-plans",
  "시공 계획서": "/construction-plans",
  "시공계획서 작성": "/construction-plans/create",
  "시공계획서 관리": "/construction-plans/manage",
  "시스템동바리 시공계획서": "/construction-plans",
  "검토·승인함": "/construction-plan-approvals",
  "시공계획서 검토함": "/construction-plan-approvals",
  "PDF 발행이력": "/construction-plan-exports",
  "시공계획서 발행본": "/construction-plan-exports",
  "표준 템플릿 관리": "/construction-plan-templates",
  "시공계획서 템플릿 관리": "/construction-plan-templates",
  "현장 실행기록": "/construction-plan-records",
  "시공계획서 실행기록": "/construction-plan-records",
  "\ud1b5\ud569DB": "/database/manpower-db",
  "\ud1b5\ud569DB(\uc0c8\ucc3d)": "/database/manpower-db?newTab=1",
  "사진 거래처 등록": "/database/partner-photo-registration",
  "사진거래처등록": "/database/partner-photo-registration",
  "명함 거래처 등록": "/database/partner-photo-registration",
  "명함등록": "/database/partner-photo-registration",
  "거래처 사진등록": "/database/partner-photo-registration",
  "거래처 사진 등록": "/database/partner-photo-registration",
  "명함관리 페이지": "/database/partner-photo-registration",
  "명함관리페이지": "/database/partner-photo-registration",
  "명함 관리 페이지": "/database/partner-photo-registration",
  "partner-photo-registration": "/database/partner-photo-registration",
  "명함/담당자 관리": "/database/business-card-contacts",
  "명함 담당자 관리": "/database/business-card-contacts",
  "명함담당자관리": "/database/business-card-contacts",
  "명함관리": "/database/business-card-contacts",
  "명함 관리": "/database/business-card-contacts",
  "담당자 관리": "/database/business-card-contacts",
  "담당자관리": "/database/business-card-contacts",
  "거래처 담당자": "/database/business-card-contacts",
  "거래처담당자": "/database/business-card-contacts",
  "business-card-contacts": "/database/business-card-contacts",
  "신분증 묶음사진": "/database/identity-bundle",
  "신분증묶음사진": "/database/identity-bundle",
  "신분증 일괄 묶기": "/database/identity-bundle",
  "신분증 일괄묶기": "/database/identity-bundle",
  "identity-bundle": "/database/identity-bundle",
  "신분증 로그": "/database/identity-logs",
  "신분증로그": "/database/identity-logs",
  "\ud1b5\ud569DB \ub85c\uadf8": "/database/logs",
  "DB \ub85c\uadf8": "/database/logs",
  "\ub370\uc774\ud130\ubca0\uc774\uc2a4 \ub85c\uadf8": "/database/logs",
  "\ud14c\uc2a4\ud2b8\uc124\uc815": "/test-settings",
  "\ud504\ub85c\ud544 \uc124\uc815": "/profile",
  "\ud560\uc77c": "/todo",
  // \uc9c0\uc6d0 \uad00\ub9ac
  "\uc9c0\uc6d0\ube44 \uc124\uc815": "/support/settings",
  "\uc9c0\uc6d0 \ud604\ud669\ud310": "/support/status",
  "\uc9c0\uc6d0\ube44 \ub2e8\uac00 \uad00\ub9ac": "/support/rate-management",
  "\uc778\ub825 \uad50\ub958 \uc815\uc0b0": "/support/labor-exchange",
  "\ucc28\ub7c9/\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac": "/support/vehicles",
  "\ucc28\ub7c9/\uce74\ub4dc \uad00\ub9ac": "/support/vehicles",
  "\ucc28\ub7c9\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac": "/support/vehicles",
  "\ubc95\uc778\ucc28\ub7c9 \uad00\ub9ac": "/support/vehicles",
  "\uc219\uc18c \uad00\ub9ac": "/support/accommodation",
  "\uc219\uc18c\uad00\ub9ac": "/support/accommodation",
  "엔진오일 주기": "/support/vehicles/oil-cycle",
  "엔진오일 교체주기": "/support/vehicles/oil-cycle",
  "엔진오일 관제표": "/support/vehicles/oil-cycle",
  "차량 엔진오일": "/support/vehicles/oil-cycle",
  "팀별 장비여부": "/support/vehicles/team-equipment",
  "팀 장비여부": "/support/vehicles/team-equipment",
  "팀별 장비 현황": "/support/vehicles/team-equipment",
  "장비여부": "/support/vehicles/team-equipment",
  "차량 청구 로그": "/support/vehicles/logs",
  "차량청구로그": "/support/vehicles/logs",
  "차량 청구 변경 로그": "/support/vehicles/logs",
  "\ubc95\uc778\uce74\ub4dc \uad00\ub9ac": "/support/cards",
  "카드 청구 로그": "/support/cards/logs",
  "카드청구로그": "/support/cards/logs",
  "카드 청구 변경 로그": "/support/cards/logs",
  "카드 AI 감사": "/support/card-audit",
  "카드감사": "/support/card-audit",
  "카드 감사센터": "/support/card-audit",
  "숙소 청구 로그": "/support/accommodation/logs",
  "숙소청구로그": "/support/accommodation/logs",
  "숙소 청구 변경 로그": "/support/accommodation/logs",
  "\uacbd\ube44\ub0b4\uc5ed": "/support/expense-ledger",
  "\uacbd\ube44 \ub0b4\uc5ed": "/support/expense-ledger",
  "후청구 입력": "/support/expense-claims",
  "팀장 경비입력": "/support/team-expense-requests",
  "팀장 경비 승인": "/support/team-expense-requests",
  "신규 작업자 등록": "/manpower/team-worker-requests",
  "신규작업자등록": "/manpower/team-worker-requests",
  "작업자정보": "/manpower/team-worker-detail",
  "급여명세서": "/manpower/team-worker-payslip",
  "출력일보": "/manpower/team-worker-daily-report",
  "작업자 등록 승인": "/manpower/team-worker-requests",
  "후청구 관리": "/support/expense-claims",
  "경비청구 입력": "/support/expense-claims",
  "경비 청구 등록": "/support/expense-claims",
  "팀별 지원 상세": "/support/team-resource-detail",
  "팀별 지원내역": "/support/team-resource-detail",
  "팀별 배정 지원": "/support/team-resource-detail",
  "팀별 숙소 차량 카드 경비": "/support/team-resource-detail",
  "팀별 숙소/차량/카드/경비": "/support/team-resource-detail",
  "\uccad\uc5f0ERP \uc124\uba85\uc11c": "/manual",
  "\ud648\ud398\uc774\uc9c0 \uc0ac\uc6a9\ubc95": "/manual",
  // \uc804\uad6dJS ERP \uba54\ub274
  "\uc77c\ubcf4\ub4f1\ub85d": "/jeonkuk/report-register",
  "\uadfc\ub85c\uc790 \ub4f1\ub85d": "/jeonkuk/worker-registration?newTab=1",
  "\uadfc\ub85c\uc790 \ub4f1\ub85d(\uc0c8\ucc3d)": "/jeonkuk/worker-registration?newTab=1",
  "\uadfc\ub85c\uc790 \ub300\ub7c9 \ub4f1\ub85d": "/manpower/smart-registration",
  "\uadfc\ub85c\uc790 \uadf8\ub9ac\ub4dc \ub4f1\ub85d": "/manpower/smart-registration-grid",
  "\ud300 \ub4f1\ub85d": "/manpower/team-management",
  "\ud300 \ub300\ub7c9 \ub4f1\ub85d": "/manpower/smart-team-registration",
  "\ud604\uc7a5 \ub4f1\ub85d": "/jeonkuk/site-registration",
  "\ud604\uc7a5 \ub300\ub7c9 \ub4f1\ub85d": "/manpower/smart-site-registration",
  "\ud68c\uc0ac \ub4f1\ub85d": "/database/company-db",
  "\ud68c\uc0ac \uc870\uc9c1\ub3c4": "/company/organization",
  "\ud504\ub9ac\ub79c\uc11c \uad00\ub9ac": "/manpower/freelancer",
  "\ud68c\uc0ac\uc18c\uac1c": "/dashboard2",
  // Canonical company intro landing route
  "\ud68c\uc0ac\uc774\ub150": "/cheongyeon/philosophy",
  "\ud68c\uc0ac \uc774\ub150": "/cheongyeon/philosophy",
  "\uc0ac\uc5c5\uc774\ub150": "/cheongyeon/philosophy",
  "\uc0ac\uc5c5 \uc774\ub150": "/cheongyeon/philosophy",
  "\uae30\uc5c5\uc774\ub150": "/cheongyeon/philosophy",
  "\uae30\uc5c5 \uc774\ub150": "/cheongyeon/philosophy",
  "\uc778\uc0ac\ub9d0": "/cheongyeon/greeting",
  "\ub300\ud45c \uc778\uc0ac\ub9d0": "/cheongyeon/greeting",
  // New alias
  "\uc870\uc9c1\ub3c4": "/cheongyeon/organization",
  "\uc624\uc2dc\ub294 \uae38": "/cheongyeon/directions",
  "\uc624\uc2dc\ub294\uae38": "/cheongyeon/directions",
  "\ucc3e\uc544\uc624\uc2dc\ub294 \uae38": "/cheongyeon/directions",
  "\ucc3e\uc544\uc624\ub294 \uae38": "/cheongyeon/directions",
  "\uc624\uc2dc\ub294 \uae38 \uc548\ub0b4": "/cheongyeon/directions",
  "\ubbf8\uac15\ud504\ub77c\uc790 \uc624\uc2dc\ub294 \uae38": "/cheongyeon/directions",
  "\uae30\uc220\ube44\uc804": "/cheongyeon/tech-vision",
  "회사연혁": "/cheongyeon/history",
  "회사 연혁": "/cheongyeon/history",
  "연혁": "/cheongyeon/history",
  "견적 목록": "/estimate/list",
  "UX/UI 견적서": "/estimate/manage",
  "UX/UI 견적": "/estimate/manage",
  "거래명세표 관리": "/transaction/manage",
  "거래명세표 등록": "/transaction/new",
  "거래명세표 목록": "/transaction/list",
  "거래명세표": "/transaction/manage",
  "견적문의": "/estimate/request",
  "견적 문의": "/estimate/request",
  "견적 문의하기": "/estimate/request",
  "\ub3c4\uba74 AI \uacac\uc801": "/estimate/drawing-ai",
  "\ub3c4\uba74 \uae30\ubc18 \uacac\uc801": "/estimate/drawing-ai",
  "\uc2dc\uc2a4\ud15c\ub3d9\ubc14\ub9ac \uc2dc\uc2a4\ud15c\ube44\uacc4 \uacac\uc801": "/estimate/drawing-ai",
  "\uc2dc\uc2a4\ud15c\ub3d9\ubc14\ub9ac/\uc2dc\uc2a4\ud15c\ube44\uacc4 AI \uacac\uc801": "/estimate/drawing-ai",
  "\ud68c\uc0ac \ub300\ub7c9 \ub4f1\ub85d": "/database/smart-company-registration",
  "\ud68c\uc0acDB": "/database/company-db",
  "DB \uad6c\uc870\ub3c4": "/jeonkuk/db-structure",
  "DB \uc124\uacc4\ub3c4": "/jeonkuk/db-design",
  "\ub370\uc774\ud130 \uad00\uacc4 \uc2dc\uac01\ud654": "/admin/data-relationships",
  "\ub370\uc774\ud130 \ucf58\uc194": "/admin/console",
  "\uad00\uacc4 \uad00\ub9ac \ucf58\uc194": "/admin/relationship-console",
  "\ud074\ub77c\uc6b0\ub4dc \uc800\uc7a5\uc18c": "/storage",
  "\ub85c\uceec \uc800\uc7a5\uc18c": "/storage",
  "\uad6c\uae00 \ub4dc\ub77c\uc774\ube0c": "/storage/google-drive",
  "\uae09\uc5ec \uc815\uc0b0 \uc124\uacc4\ub3c4": "/jeonkuk/payroll-design",
  // \uad00\ub9ac\uc790 \uba54\ub274
  "\ud300 \uad00\ub9ac": "/manpower/team-management",
  '\uc791\uc5c5\uc790 \uc694\uc57d': '/manpower/summary',
  "\ud300\ubcc4 \uc791\uc5c5\uc790 \uc0c1\uc138": "/manpower/team-worker-detail",
  "\ud300\ubcc4 \uc791\uc5c5\uc790 \uc0c1\uc138\ucd9c\ub825\uc815\ubcf4": "/manpower/team-worker-detail",
  "\uc791\uc5c5\uc790 \uc0c1\uc138\ucd9c\ub825\uc815\ubcf4": "/manpower/team-worker-detail",
  "\uc791\uc5c5\uc790 \ucd9c\ub825 \uc0c1\uc138": "/manpower/team-worker-detail",
  "현장담당별 현장 상세": "/manpower/site-responsible-detail",
  "현장담당별 현장": "/manpower/site-responsible-detail",
  "현장별 노임명세서 출력일보": "/manpower/site-responsible-detail",
  "현장 노임명세서 출력일보": "/manpower/site-responsible-detail",
  // \ud14c\uc2a4\ud2b8 \uba54\ub274
  "Smart Excel": "/report/excel",
  "\uc77c\ubcf4 \uc2a4\ub9c8\ud2b8 \uc785\ub825 (AI)": "/report/excel",
  "\uc77c\ubcf4 v3": "/report/excel",
  "\uc77c\ubcf4 \ub300\ub7c9 \ub4f1\ub85d": "/report/smart-registration",
  "\ub300\uc6a9\ub7c9 \uc5d1\uc140 \uc5c5\ub85c\ub4dc": "/report/mass-upload",
  "\uc5d1\uc140 \ub370\uc774\ud130 \uad6c\uc870\ub3c4": "/admin/excel-guide",
  // Mass Upload (Excel)
  "\uc791\uc5c5\uc790 \uc5d1\uc140 \ub4f1\ub85d": "/upload/worker",
  "\ud300 \uc5d1\uc140 \ub4f1\ub85d": "/upload/team",
  "\ud604\uc7a5 \uc5d1\uc140 \ub4f1\ub85d": "/upload/site",
  "\ud68c\uc0ac \uc5d1\uc140 \ub4f1\ub85d": "/upload/company",
  "\ucd9c\ub825\uc77c\ubcf4 \uc5d1\uc140 \ub4f1\ub85d": "/mass-upload/daily-report",
  "\uc548\uc804 \uc5c5\ub85c\ub4dc \uac00\uc774\ub4dc": "/manual/excel-guide",
  // \ud559\uc2b5 \uba54\ub274
  "\ub77c\uc774\ube0c\ub7ec\ub9ac \uc0ac\uc6a9\ubc95": "/structure/library-guide",
  "\ud504\ub85c\uc81d\ud2b8 \ud30c\uc77c \uad6c\uc870": "/admin/project-structure",
  "\uc2dc\uc2a4\ud15c \uad00\ub9ac": "/system-management",
  "\ub370\uc774\ud130 \uc5f0\uacb0 \uc810\uac80": "/admin/integrity",
  // \uac1c\ubc1c\uc790 \ub3c4\uad6c
  "\uc5d0\uc774\uc804\ud2b8 \ud50c\ub808\uc774\uadf8\ub77c\uc6b4\ub4dc": "/admin/agent-playground",
  "\uba54\ub274\uad00\ub9ac": "/admin/menu-manager",
  "\uc0ac\uc6a9\uc790 \uad00\ub9ac": "/admin/user-management",
  "\uc0ac\uc6a9\uc790 \ud1b5\ud569 \uad00\ub9ac": "/admin/user-management",
  "로그인 로그": "/admin/login-logs",
  "로그인 접근 로그": "/admin/login-logs",
  "접속 로그": "/admin/login-logs",
  "Gemini 사용량·비용 로그": "/admin/gemini-usage-logs",
  "권한 변경 로그": "/admin/permission-change-logs",
  "권한변경로그": "/admin/permission-change-logs",
  "메뉴 권한 변경 로그": "/admin/permission-change-logs",
  "엑셀 업로드 다운로드 로그": "/admin/excel-transfer-logs",
  "엑셀 업로드·다운로드 로그": "/admin/excel-transfer-logs",
  "PDF 업로드 다운로드 로그": "/admin/pdf-transfer-logs",
  "PDF 업로드·다운로드 로그": "/admin/pdf-transfer-logs",
  "\ubcf5\uc9c0 \uc790\uc0b0 \uad00\ub9ac": "/admin/welfare-assets",
  "\uce90\uc2dc/\ud3ec\uc778\ud2b8 \uad00\ub9ac": "/admin/welfare-assets",
  "\ud3ec\uc778\ud2b8 \uac8c\uc784 \uad00\ub9ac": "/admin/welfare-assets",
  "\uad8c\ud55c \uad00\ub9ac": "/admin/role-menu",
  "\uc2dc\uc2a4\ud15c \uad8c\ud55c \uad00\ub9ac": "/admin/role-menu",
  // Alias
  "\uce74\uce74\uc624\ud1a1 \uad00\ub9ac": "/payroll/kakao-notification",
  "\uc0ac\uc6a9\uc790 \uad8c\ud55c \uc124\uc815": "/settings",
  // Alias for Settings where User Management lives
  // Refine Integrated Console
  "\uc791\uc5c5\uc790 \ucf58\uc194": "/manpower/refine-workers",
  "\ud300 \ucf58\uc194": "/manpower/refine-teams",
  "\ud604\uc7a5 \ucf58\uc194": "/manpower/refine-sites",
  "\ud68c\uc0ac \ucf58\uc194": "/manpower/refine-companies",
  "\ud1b5\ud569 \ub370\uc774\ud130 \ucf58\uc194": "/manpower/refine-sites",
  // Alias
  "\uc815\uc0b0 \uc2dc\uc2a4\ud15c \uc124\uacc4\ub3c4": "/design/settlement-architecture",
  "\uc2a4\ub9c8\ud2b8 \uba54\ubaa8": "/memos",
  // Smart Memo System
  "Smart Memo": "/memos",
  "\ud604\uc7a5 \uac24\ub7ec\ub9ac": "/gallery/projects",
  "\ud504\ub85c\uc81d\ud2b8": "/gallery/projects",
  // Alias
  "AI \uc774\ubbf8\uc9c0 \uc2a4\ud29c\ub514\uc624": "/gallery/ai-images",
  "\uc774\ubbf8\uc9c0 \uac24\ub7ec\ub9ac": "/gallery/ai-images",
  // Alias
  "\ud604\uc7a5 \uad00\ub9ac \uc2dc\uc2a4\ud15c": "/site/management",
  "\ub9c8\uac10 \ud604\uc7a5 \uad00\ub9ac": "/site/management/closed",
  "\ub9c8\uac10\ud604\uc7a5\uad00\ub9ac": "/site/management/closed",
  "\ud604\uc7a5 \uad00\ub9ac(\ub9c8\uac10)": "/site/management/closed",
  "\ud68c\uc0ac \ub79c\ub529 \ud398\uc774\uc9c0": "/company/landing",
  "\ud68c\uc0ac\uc18c\uac1c \ub79c\ub529": "/company/landing",
  "\uc0c1\uc138 \uacac\uc801\uc11c": "/estimate/detail-manage",
  "\uc0c1\uc138\uacac\uc801\uc11c": "/estimate/detail-manage"
};

/***/ },

/***/ "./src/security/erpAccessPolicy.ts"
/*!*****************************************!*\
  !*** ./src/security/erpAccessPolicy.ts ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ERP_ACCESS_ROLE_GROUPS: () => (/* binding */ ERP_ACCESS_ROLE_GROUPS),
/* harmony export */   ERP_ADMIN_COLLECTIONS: () => (/* binding */ ERP_ADMIN_COLLECTIONS),
/* harmony export */   ERP_BANK_NOTIFICATION_COLLECTIONS: () => (/* binding */ ERP_BANK_NOTIFICATION_COLLECTIONS),
/* harmony export */   ERP_COLLECTION_POLICIES: () => (/* binding */ ERP_COLLECTION_POLICIES),
/* harmony export */   ERP_FINANCE_COLLECTIONS: () => (/* binding */ ERP_FINANCE_COLLECTIONS),
/* harmony export */   ERP_MASTER_DATA_COLLECTIONS: () => (/* binding */ ERP_MASTER_DATA_COLLECTIONS),
/* harmony export */   ERP_OPERATION_COLLECTIONS: () => (/* binding */ ERP_OPERATION_COLLECTIONS),
/* harmony export */   ERP_RECRUITING_COLLECTIONS: () => (/* binding */ ERP_RECRUITING_COLLECTIONS),
/* harmony export */   ERP_SUPPORT_COLLECTIONS: () => (/* binding */ ERP_SUPPORT_COLLECTIONS),
/* harmony export */   ERP_WELFARE_COLLECTIONS: () => (/* binding */ ERP_WELFARE_COLLECTIONS),
/* harmony export */   canAccessErpCollection: () => (/* binding */ canAccessErpCollection),
/* harmony export */   getErpCollectionAccessPolicy: () => (/* binding */ getErpCollectionAccessPolicy),
/* harmony export */   getErpRoleGroupKeys: () => (/* binding */ getErpRoleGroupKeys),
/* harmony export */   getErpRoleGroupsForRoles: () => (/* binding */ getErpRoleGroupsForRoles),
/* harmony export */   isErpAdminRole: () => (/* binding */ isErpAdminRole),
/* harmony export */   isErpSensitiveCollection: () => (/* binding */ isErpSensitiveCollection),
/* harmony export */   normalizeErpAccessRole: () => (/* binding */ normalizeErpAccessRole),
/* harmony export */   normalizeErpAccessRoleKey: () => (/* binding */ normalizeErpAccessRoleKey),
/* harmony export */   summarizeErpCollectionAccess: () => (/* binding */ summarizeErpCollectionAccess)
/* harmony export */ });
const ERP_ACCESS_ROLE_GROUPS = {
  admin: ['admin', 'super_admin', 'administrator', 'owner', 'dev', 'developer', 'system_admin', 'jhl2vtnk9v3c4eiz4qqi', 'pos_jhl2vtnk9v3c4eiz4qqi', '\uad00\ub9ac\uc790', '\uc0ac\uc7a5', '\uc2e4\uc7a5', '\uac1c\ubc1c', '\uac1c\ubc1c\uc790', '\uc2dc\uc2a4\ud15c\uad00\ub9ac\uc790', '愿由ъ옄', '?ъ옣', '?ㅼ옣', '媛쒕컻', '媛쒕컻??', '?쒖뒪?쒓?由ъ옄'],
  payroll: ['payroll_manager', 'PAYROLL_MANAGER', '\uae09\uc5ec\ub2f4\ub2f9', '\uc815\uc0b0\ub2f4\ub2f9', '\uc815\uc0b0\uad00\ub9ac\uc790', '湲됱뿬?대떦', '?뺤궛?대떦', '?뺤궛愿由ъ옄'],
  finance: ['finance', 'finance_manager', 'accounting', 'accounting_manager', '\ud68c\uacc4', '\uc7ac\ubb34', '\uacbd\ub9ac', '\ud68c\uacc4\ub2f4\ub2f9', '\uc7ac\ubb34\ub2f4\ub2f9'],
  office: ['office_staff', 'OFFICE_STAFF', 'office', '\uc0ac\ubb34\uc2e4\uc9c1\uc6d0', '\uc0ac\ubb34\uc9c1\uc6d0', '\uc0ac\ubb34', '?щТ?ㅼ쭅??', '?щТ吏곸썝'],
  site: ['site_manager', 'SITE_MANAGER', 'manager', 'MANAGER', 'manager1', 'manager2', 'manager3', 'MANAGER1', 'MANAGER2', 'MANAGER3', 'pos_manager1', 'pos_manager2', 'pos_manager3', '\ub9e4\ub2c8\uc800', '\ud604\uc7a5\uad00\ub9ac\uc790', '\ud604\uc7a5\uc18c\uc7a5', '\ub9e4\ub2c8\uc8001', '\ub9e4\ub2c8\uc8002', '\ub9e4\ub2c8\uc8003', '\uba54\ub2c8\uc8001', '\uba54\ub2c8\uc8002', '\uba54\ub2c8\uc8003', '留ㅻ땲?', '?꾩옣愿由ъ옄', '?꾩옣?뚯옣'],
  support: ['support', 'support_manager', 'manager1', 'MANAGER1', 'pos_manager1', '\ub9e4\ub2c8\uc8001', '\uba54\ub2c8\uc8001', '\uc9c0\uc6d0\ub2f4\ub2f9', '\uc9c0\uc6d0 \ub2f4\ub2f9', '\uc790\uc0b0\uad00\ub9ac', '\uc790\uc0b0 \uad00\ub9ac', '\uc219\uc18c\uad00\ub9ac', '\uc219\uc18c \uad00\ub9ac', '\ucc28\ub7c9\uad00\ub9ac', '\ucc28\ub7c9 \uad00\ub9ac'],
  audit: ['audit', 'auditor', 'compliance', '\uac10\uc0ac', '\uac10\uc0ac\uc790', '\uc900\ubc95'],
  user: ['user', 'general', '\uc77c\ubc18', '?쇰컲']
};
const ERP_MASTER_DATA_COLLECTIONS = ['companies', 'teams', 'workers', 'office_staff', 'sites', 'account_links', 'account_directory_entries'];
const ERP_OPERATION_COLLECTIONS = ['daily_reports', 'daily_report_workers', 'daily_worker_report_sites', 'daily_dispatches', 'field_schedule_requests', 'schedule_confirmation_boards', 'tasks', 'task_requests'];
const ERP_RECRUITING_COLLECTIONS = ['recruiting_referrers', 'service_worker_referrals', 'service_referral_daily_lines', 'service_referral_monthly_settlements', 'service_referral_settings', 'service_worker_history', 'service_referral_payments', 'service_referral_deposits', 'service_referral_receivables'];
const ERP_FINANCE_COLLECTIONS = ['advance_payments', 'advance_requests', 'monthly_payroll_settlements', 'delegated_receipt_claims', 'payments', 'tax_invoices', 'receivables', 'receivable_ledgers', 'receivable_payments', 'contracts', 'progress_claims', 'client_site_labor_adjustments', 'settlements', 'settlement_targets', 'team_settlement_documents', 'daily_advance_workbook_profiles', 'daily_advance_statement_recruiter_fees', 'workbook_ledger_logs', 'tax_ledger_entries', 'quarter_vat_payments', 'quarter_vat_payments_dawon', 'freelancers', 'freelancerPayments'];
const ERP_SUPPORT_COLLECTIONS = ['vehicles', 'vehicleAssignments', 'vehicle_assignments', 'vehicleExpenses', 'vehicle_expenses', 'vehicle_billing_targets', 'vehicle_billing_documents', 'vehicle_billing_logs', 'cards', 'cardAssignments', 'cardTransactions', 'cardBillings', 'card_billing_logs', 'accommodations', 'accommodationAssignments', 'accommodationUtilityRecords', 'accommodation_billing_targets', 'accommodation_billing_documents', 'accommodation_billing_line_items', 'accommodation_billing_logs', 'support_cancellation_logs', 'support_write_operations', 'support_shared_data', 'support_client_site_allocations', 'team_expense_claims', 'team_expense_ledgers', 'team_expense_categories'];
const ERP_ADMIN_COLLECTIONS = ['settings', 'server_settings', 'system_configs', 'system_logs', 'menu_configs', 'menus', 'positions', 'components', 'users', 'app_users', 'login_logs', 'audit_logs', 'database_logs', 'daily_report_logs', 'material_logs', 'settlement_alert_states', 'welfare_admin_permissions', 'welfare_audit_logs'];
const ERP_WELFARE_COLLECTIONS = ['welfare_ledger_transactions', 'welfare_account_snapshots', 'welfare_categories', 'welfare_game_daily_usage', 'welfare_game_plays'];
const ERP_BANK_NOTIFICATION_COLLECTIONS = ['bank_sms_ingestions', 'bank_transaction_candidates', 'bank_notification_settings', 'notification_devices', 'bank_notification_health', 'bank_notification_outbox', 'bank_ingestion_replay_nonces', 'bank_provider_events'];
const ERP_BANK_NOTIFICATION_POLICIES = [{
  collectionId: 'bank_transaction_candidates',
  read: ['admin', 'payroll', 'finance', 'audit'],
  write: ['admin', 'payroll', 'finance'],
  description: 'reviewable normalized bank transaction alerts'
}, {
  collectionId: 'bank_notification_settings',
  read: ['admin', 'payroll', 'finance', 'audit'],
  write: ['admin'],
  description: 'bank notification recipients and delivery policy'
}, {
  collectionId: 'notification_devices',
  read: ['admin', 'payroll', 'finance', 'audit'],
  write: ['admin', 'payroll', 'finance', 'audit'],
  description: 'self-managed FCM registration tokens'
}, {
  collectionId: 'bank_notification_health',
  read: ['admin', 'payroll', 'finance', 'audit'],
  write: [],
  description: 'server-owned bank bridge health state'
}, {
  collectionId: 'bank_notification_outbox',
  read: ['admin', 'audit'],
  write: [],
  description: 'server-owned reliable bank push delivery outbox'
}, ...['bank_sms_ingestions', 'bank_provider_events'].map(collectionId => ({
  collectionId,
  read: ['admin', 'audit'],
  write: [],
  description: 'server-owned bank integration audit data'
})), {
  collectionId: 'bank_ingestion_replay_nonces',
  read: [],
  write: [],
  description: 'server-only replay protection records'
}];
const ERP_COLLECTION_POLICIES = [...ERP_MASTER_DATA_COLLECTIONS.map(collectionId => ({
  collectionId,
  read: ['admin', 'office', 'site', 'payroll'],
  write: ['admin', 'office'],
  description: 'ERP master data'
})), ...ERP_OPERATION_COLLECTIONS.map(collectionId => ({
  collectionId,
  read: ['admin', 'office', 'site', 'payroll'],
  write: ['admin', 'office', 'site'],
  description: 'field operation data'
})), ...ERP_RECRUITING_COLLECTIONS.map(collectionId => ({
  collectionId,
  read: ['admin', 'office', 'site', 'payroll'],
  write: ['admin', 'office', 'payroll'],
  description: 'service recruiting and settlement data'
})), ...ERP_FINANCE_COLLECTIONS.map(collectionId => ({
  collectionId,
  read: ['admin', 'payroll', 'finance'],
  write: ['admin', 'payroll', 'finance'],
  description: 'payroll, tax, receivable, and settlement data'
})), ...ERP_SUPPORT_COLLECTIONS.map(collectionId => ({
  collectionId,
  read: ['admin', 'office', 'support', 'payroll'],
  write: ['admin', 'office', 'support'],
  description: 'support asset and billing data'
})), ...ERP_WELFARE_COLLECTIONS.map(collectionId => ({
  collectionId,
  read: ['admin', 'office'],
  write: ['admin'],
  description: 'welfare asset ledger data'
})), ...ERP_BANK_NOTIFICATION_POLICIES, ...ERP_ADMIN_COLLECTIONS.map(collectionId => ({
  collectionId,
  read: ['admin', 'audit'],
  write: ['admin'],
  description: 'administrative and audit data'
}))];
const COLLECTION_POLICY_MAP = new Map(ERP_COLLECTION_POLICIES.map(policy => [policy.collectionId, policy]));
const normalizeErpAccessRole = role => String(role || '').trim();
const normalizeErpAccessRoleKey = role => normalizeErpAccessRole(role).toLowerCase();
const getErpRoleGroupKeys = groups => {
  const keys = new Set();
  groups.forEach(group => {
    ERP_ACCESS_ROLE_GROUPS[group].forEach(role => {
      const key = normalizeErpAccessRoleKey(role);
      if (key) keys.add(key);
    });
  });
  return Array.from(keys);
};
const getErpRoleGroupsForRoles = roles => {
  const actualKeys = new Set(roles.map(normalizeErpAccessRoleKey).filter(Boolean));
  const groups = [];
  Object.keys(ERP_ACCESS_ROLE_GROUPS).forEach(group => {
    const groupKeys = getErpRoleGroupKeys([group]);
    if (groupKeys.some(key => actualKeys.has(key))) {
      groups.push(group);
    }
  });
  if (groups.includes('admin')) return ['admin', ...groups.filter(group => group !== 'admin')];
  return groups;
};
const isErpAdminRole = role => getErpRoleGroupKeys(['admin']).includes(normalizeErpAccessRoleKey(role));
const getErpCollectionAccessPolicy = collectionId => COLLECTION_POLICY_MAP.get(collectionId);
const isErpSensitiveCollection = collectionId => COLLECTION_POLICY_MAP.has(collectionId);
const canAccessErpCollection = (roles, collectionId, operation) => {
  const roleGroups = getErpRoleGroupsForRoles(roles);
  if (roleGroups.includes('admin')) return true;
  const policy = getErpCollectionAccessPolicy(collectionId);
  if (!policy) return true;
  const allowedGroups = operation === 'read' ? policy.read : policy.write;
  return allowedGroups.some(group => roleGroups.includes(group));
};
const summarizeErpCollectionAccess = roles => {
  const roleGroups = getErpRoleGroupsForRoles(roles);
  const readableCollections = [];
  const writableCollections = [];
  const deniedCollections = [];
  ERP_COLLECTION_POLICIES.forEach(policy => {
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
    deniedCollections
  };
};

/***/ },

/***/ "./src/services/auditService.ts"
/*!**************************************!*\
  !*** ./src/services/auditService.ts ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   auditService: () => (/* binding */ auditService)
/* harmony export */ });
/* harmony import */ var _firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./firestoreCrudCompat */ "./src/services/firestoreCrudCompat.ts");
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _types_timestamp__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../types/timestamp */ "./src/types/timestamp.ts");




const generateId = () => {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};
const toTimestamp = value => {
  if (!value) return _types_timestamp__WEBPACK_IMPORTED_MODULE_3__.Timestamp.now();
  if (value instanceof _types_timestamp__WEBPACK_IMPORTED_MODULE_3__.Timestamp) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return _types_timestamp__WEBPACK_IMPORTED_MODULE_3__.Timestamp.fromDate(d);
  }
  return _types_timestamp__WEBPACK_IMPORTED_MODULE_3__.Timestamp.now();
};
const safeJsonParse = raw => {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return raw;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
};
const auditService = {
  // Write a log entry
  log: async logData => {
    try {
      var _logData$action, _logData$category, _logData$actorId, _logData$actorEmail, _logData$actorName, _logData$targetId, _logData$targetName;
      await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.createAuditLog)({
        id: generateId(),
        action: (_logData$action = logData.action) !== null && _logData$action !== void 0 ? _logData$action : null,
        category: (_logData$category = logData.category) !== null && _logData$category !== void 0 ? _logData$category : null,
        actorId: (_logData$actorId = logData.actorId) !== null && _logData$actorId !== void 0 ? _logData$actorId : null,
        actorEmail: (_logData$actorEmail = logData.actorEmail) !== null && _logData$actorEmail !== void 0 ? _logData$actorEmail : null,
        actorName: (_logData$actorName = logData.actorName) !== null && _logData$actorName !== void 0 ? _logData$actorName : null,
        targetId: (_logData$targetId = logData.targetId) !== null && _logData$targetId !== void 0 ? _logData$targetId : null,
        targetName: (_logData$targetName = logData.targetName) !== null && _logData$targetName !== void 0 ? _logData$targetName : null,
        details: logData.details !== undefined ? JSON.stringify(logData.details) : null,
        timestamp: new Date().toISOString()
      });
      console.log(`[Audit] ${logData.category}:${logData.action} by ${logData.actorEmail}`);
    } catch (error) {
      console.error("Failed to write audit log", error);
      // Non-blocking error
    }
  },
  // Fetch logs with basic filtering
  getLogs: async (limitCount = 100, category, actorId) => {
    try {
      const fetchLimit = Math.min(Math.max(limitCount * 5, 200), 1000);
      const constraints = [(0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.orderBy)('timestamp', 'desc'), (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.limit)(fetchLimit)];
      if (category) constraints.unshift((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('category', '==', category));
      if (actorId) constraints.unshift((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.where)('actorId', '==', actorId));

      // firestoreCrudCompat deliberately ignores ordering/filter arguments. A
      // direct query is required for log screens to show recent records.
      const snapshot = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.getDocs)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.query)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_1__.collection)(_config_firebase__WEBPACK_IMPORTED_MODULE_2__.db, 'audit_logs'), ...constraints));
      const rows = snapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));
      const logs = rows.map(row => {
        var _row$timestamp;
        const rawTimestamp = (_row$timestamp = row === null || row === void 0 ? void 0 : row.timestamp) !== null && _row$timestamp !== void 0 ? _row$timestamp : row === null || row === void 0 ? void 0 : row.createdAt;
        return {
          id: row !== null && row !== void 0 && row.id ? String(row.id) : undefined,
          action: row !== null && row !== void 0 && row.action ? String(row.action) : '',
          category: row !== null && row !== void 0 && row.category ? String(row.category) : '',
          actorId: row !== null && row !== void 0 && row.actorId ? String(row.actorId) : '',
          actorEmail: row !== null && row !== void 0 && row.actorEmail ? String(row.actorEmail) : '',
          actorName: row !== null && row !== void 0 && row.actorName ? String(row.actorName) : undefined,
          targetId: row !== null && row !== void 0 && row.targetId ? String(row.targetId) : undefined,
          targetName: row !== null && row !== void 0 && row.targetName ? String(row.targetName) : undefined,
          details: safeJsonParse(row === null || row === void 0 ? void 0 : row.details),
          timestamp: toTimestamp(rawTimestamp)
        };
      });
      return logs.filter(log => !category || log.category === category).filter(log => !actorId || log.actorId === actorId).sort((left, right) => right.timestamp.toMillis() - left.timestamp.toMillis()).slice(0, limitCount);
    } catch (error) {
      // The fallback keeps log screens usable while a newly added composite
      // index is still being created in Firestore.
      try {
        var _data;
        const res = await (0,_firestoreCrudCompat__WEBPACK_IMPORTED_MODULE_0__.listAllAuditLogs)({
          limit: 1000
        });
        const rawRows = res === null || res === void 0 ? void 0 : (_data = res.data) === null || _data === void 0 ? void 0 : _data.auditLogs;
        const rows = Array.isArray(rawRows) ? rawRows : [];
        return rows.map(row => {
          var _row$timestamp2;
          return {
            id: row !== null && row !== void 0 && row.id ? String(row.id) : undefined,
            action: row !== null && row !== void 0 && row.action ? String(row.action) : '',
            category: row !== null && row !== void 0 && row.category ? String(row.category) : '',
            actorId: row !== null && row !== void 0 && row.actorId ? String(row.actorId) : '',
            actorEmail: row !== null && row !== void 0 && row.actorEmail ? String(row.actorEmail) : '',
            actorName: row !== null && row !== void 0 && row.actorName ? String(row.actorName) : undefined,
            targetId: row !== null && row !== void 0 && row.targetId ? String(row.targetId) : undefined,
            targetName: row !== null && row !== void 0 && row.targetName ? String(row.targetName) : undefined,
            details: safeJsonParse(row === null || row === void 0 ? void 0 : row.details),
            timestamp: toTimestamp((_row$timestamp2 = row === null || row === void 0 ? void 0 : row.timestamp) !== null && _row$timestamp2 !== void 0 ? _row$timestamp2 : row === null || row === void 0 ? void 0 : row.createdAt)
          };
        }).filter(log => !category || log.category === category).filter(log => !actorId || log.actorId === actorId).sort((left, right) => right.timestamp.toMillis() - left.timestamp.toMillis()).slice(0, limitCount);
      } catch (fallbackError) {
        console.error('Failed to fetch logs', error, fallbackError);
        return [];
      }
    }
  }
};

/***/ },

/***/ "./src/services/menuServiceV11.ts"
/*!****************************************!*\
  !*** ./src/services/menuServiceV11.ts ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MENU_DOCUMENT_ID: () => (/* binding */ MENU_DOCUMENT_ID),
/* harmony export */   menuServiceV11: () => (/* binding */ menuServiceV11),
/* harmony export */   removePositionReferencesInMenuConfig: () => (/* binding */ removePositionReferencesInMenuConfig),
/* harmony export */   renamePositionReferencesInMenuConfig: () => (/* binding */ renamePositionReferencesInMenuConfig)
/* harmony export */ });
/* harmony import */ var firebase_firestore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/firestore */ "./node_modules/firebase/firestore/dist/esm/index.esm.js");
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _constants_defaultMenu__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../constants/defaultMenu */ "./src/constants/defaultMenu.ts");
/* harmony import */ var _constants_businessPartnerPositions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../constants/businessPartnerPositions */ "./src/constants/businessPartnerPositions.ts");
/* harmony import */ var _constants_headerActions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../constants/headerActions */ "./src/constants/headerActions.ts");
/* harmony import */ var _constants_menuPaths__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../constants/menuPaths */ "./src/constants/menuPaths.ts");
/* harmony import */ var _types_menuSchema__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../types/menuSchema */ "./src/types/menuSchema.ts");
/* harmony import */ var _utils_devAdminSession__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../utils/devAdminSession */ "./src/utils/devAdminSession.ts");
/* harmony import */ var _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../utils/devAdminFixtures */ "./src/utils/devAdminFixtures.ts");
/* harmony import */ var _utils_operationMenuAccess__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../utils/operationMenuAccess */ "./src/utils/operationMenuAccess.ts");
/* harmony import */ var _permissionAuditService__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./permissionAuditService */ "./src/services/permissionAuditService.ts");
/* harmony import */ var _utils_menuConfigChanges__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../utils/menuConfigChanges */ "./src/utils/menuConfigChanges.ts");
/* harmony import */ var _utils_delegatedReceiptsMenu__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../utils/delegatedReceiptsMenu */ "./src/utils/delegatedReceiptsMenu.ts");
/* harmony import */ var _utils_teamPersonnelMenu__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ../utils/teamPersonnelMenu */ "./src/utils/teamPersonnelMenu.ts");
/* harmony import */ var _utils_bankTransferMenu__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../utils/bankTransferMenu */ "./src/utils/bankTransferMenu.ts");
var _DEFAULT_MENU_CONFIG$;















const COLLECTION_NAME = 'settings';
const MENU_DOCUMENT_ID = 'menus_v12';
const getMenuDocRef = () => (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, MENU_DOCUMENT_ID);

// Options no longer need mergeWithDefaults

let currentConfig = null;
let currentRawConfig = null;
let unsubscribeSnapshot = null;
let snapshotSetupPromise = null;
// Menu edits replace the whole Firestore document. Keep writes strictly ordered:
// if two different saves run in parallel, a slower older write can otherwise
// finish last and silently remove the user's newest menu edit.
let saveWriteQueue = Promise.resolve();
let latestQueuedSaveFingerprint = null;
let latestQueuedSavePromise = null;
const listeners = new Set();
const deepClone = value => JSON.parse(JSON.stringify(value));
const configsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const MENU_ROLE_SURFACES = ['menu', 'headerActions', 'trash'];
const normalizePositionName = value => String(value || '').trim();
const renameRoleListReferences = (roles, oldName, newName) => {
  if (!Array.isArray(roles)) return {
    changed: false,
    replacements: 0
  };
  let replacements = 0;
  const nextRoles = roles.map(role => {
    const normalizedRole = normalizePositionName(role);
    if (normalizedRole === oldName) {
      replacements += 1;
      return newName;
    }
    return normalizedRole;
  }).filter(Boolean);
  const dedupedRoles = Array.from(new Set(nextRoles));
  const changed = !configsEqual(roles, dedupedRoles);
  return {
    roles: changed ? dedupedRoles : roles,
    changed,
    replacements
  };
};
const renamePositionReferencesInItems = (items, oldName, newName) => {
  if (!Array.isArray(items)) return {
    changed: false,
    replacements: 0
  };
  let changed = false;
  let replacements = 0;
  items.forEach(item => {
    if (typeof item === 'string') return;
    const roleListResult = renameRoleListReferences(item.roles, oldName, newName);
    if (roleListResult.changed) {
      item.roles = roleListResult.roles;
      changed = true;
    }
    replacements += roleListResult.replacements;
    const subResult = renamePositionReferencesInItems(item.sub, oldName, newName);
    if (subResult.changed) changed = true;
    replacements += subResult.replacements;
  });
  return {
    changed,
    replacements
  };
};
const renamePositionReferencesInMenuConfig = (config, oldNameInput, newNameInput) => {
  const oldName = normalizePositionName(oldNameInput);
  const newName = normalizePositionName(newNameInput);
  const result = {
    changed: false,
    roleReferences: 0,
    positionConfigs: 0,
    siteLabels: 0
  };
  if (!oldName || !newName || oldName === newName || !config) return result;
  Object.entries(config).forEach(([siteKey, site]) => {
    if (!site || typeof site !== 'object') return;
    if (siteKey.startsWith('pos_') && normalizePositionName(site.name) === oldName) {
      site.name = newName;
      result.siteLabels += 1;
      result.changed = true;
    }
    if (Array.isArray(site.positionConfig)) {
      site.positionConfig.forEach(position => {
        if (normalizePositionName(position === null || position === void 0 ? void 0 : position.name) !== oldName) return;
        position.name = newName;
        result.positionConfigs += 1;
        result.changed = true;
      });
    }
    MENU_ROLE_SURFACES.forEach(surface => {
      const itemsResult = renamePositionReferencesInItems(site[surface], oldName, newName);
      if (itemsResult.changed) result.changed = true;
      result.roleReferences += itemsResult.replacements;
    });
  });
  return result;
};
const removePositionReferencesInItems = (items, positionName) => {
  if (!Array.isArray(items)) return {
    changed: false,
    removals: 0
  };
  let changed = false;
  let removals = 0;
  items.forEach(item => {
    if (typeof item === 'string') return;
    if (Array.isArray(item.roles)) {
      const nextRoles = item.roles.map(normalizePositionName).filter(role => {
        if (role === positionName) {
          removals += 1;
          return false;
        }
        return Boolean(role);
      });
      const dedupedRoles = Array.from(new Set(nextRoles));
      if (!configsEqual(item.roles, dedupedRoles)) {
        item.roles = dedupedRoles;
        changed = true;
      }
    }
    const subResult = removePositionReferencesInItems(item.sub, positionName);
    if (subResult.changed) changed = true;
    removals += subResult.removals;
  });
  return {
    changed,
    removals
  };
};
const removePositionReferencesInMenuConfig = (config, positionNameInput, positionIdInput = '') => {
  const positionName = normalizePositionName(positionNameInput);
  const positionId = normalizePositionName(positionIdInput);
  const positionIds = new Set([positionId, positionId && positionId.startsWith('pos_') ? positionId.slice(4) : '', positionId && !positionId.startsWith('pos_') ? `pos_${positionId}` : ''].filter(Boolean));
  const result = {
    changed: false,
    roleReferences: 0,
    positionConfigs: 0,
    siteLabels: 0
  };
  if (!positionName || !config) return result;
  Object.entries(config).forEach(([siteKey, site]) => {
    if (!site || typeof site !== 'object') return;
    MENU_ROLE_SURFACES.forEach(surface => {
      const itemsResult = removePositionReferencesInItems(site[surface], positionName);
      if (itemsResult.changed) result.changed = true;
      result.roleReferences += itemsResult.removals;
    });
    if (Array.isArray(site.positionConfig)) {
      const beforeLength = site.positionConfig.length;
      site.positionConfig = site.positionConfig.filter(position => {
        const nameMatches = normalizePositionName(position === null || position === void 0 ? void 0 : position.name) === positionName;
        const idMatches = positionIds.has(normalizePositionName(position === null || position === void 0 ? void 0 : position.id));
        return !nameMatches && !idMatches;
      });
      const removed = beforeLength - site.positionConfig.length;
      if (removed > 0) {
        result.positionConfigs += removed;
        result.changed = true;
      }
    }
    const isPositionSite = siteKey.startsWith('pos_');
    const siteMatches = positionIds.has(siteKey) || isPositionSite && normalizePositionName(site.name) === positionName;
    if (siteMatches) {
      delete config[siteKey];
      result.siteLabels += 1;
      result.changed = true;
    }
  });
  return result;
};
const NATION_SITE_NAME = '전국시스템인력';
const MENU_TEXT_ALIASES = {
  "\uC6D4\uAE09\uC81Cv2": "\uC6D4\uAE09\uC81C",
  "\uBA54\uB274/\uAD8C\uD55C\uAD00\uB9AC": "\uBA54\uB274\uAD00\uB9AC",
  "\uC2DC\uC2A4\uD15C\uBA54\uC2DC\uC9C0\uAD00\uB9AC": "\uC2DC\uC2A4\uD15C \uBA54\uC2DC\uC9C0 \uC124\uC815",
  "\uBA54\uC2DC\uC9C0\uAD00\uB9AC": "\uC2DC\uC2A4\uD15C \uBA54\uC2DC\uC9C0 \uC124\uC815",
  "\uC2DC\uC2A4\uD15C\uBA54\uC2DC\uC9C0\uC124\uC815": "\uC2DC\uC2A4\uD15C \uBA54\uC2DC\uC9C0 \uC124\uC815",
  "\uD604\uC7A5\uAD00\uB9AC": "\uD604\uC7A5 \uAD00\uB9AC",
  "\uCD9C\uB825\uAD00\uB9AC": "\uCD9C\uB825 \uAD00\uB9AC",
  "\ubc95\uc778\ucc28\ub7c9 \uad00\ub9ac": "\ucc28\ub7c9/\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac",
  "\ubc95\uc778\uce74\ub4dc \uad00\ub9ac": "\ucc28\ub7c9/\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac",
  "\ucc28\ub7c9/\uce74\ub4dc \uad00\ub9ac": "\ucc28\ub7c9/\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac",
  "\ucc28\ub7c9\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac": "\ucc28\ub7c9/\uce74\ub4dc \ud1b5\ud569 \uad00\ub9ac"
};
const FORCE_MENU_PATH_TEXTS = new Set(["\ubc14\uc774\ubc31", "\uacc4\uc88c\uc870\ud68c", "\uacc4\uc88c\ubc88\ud638\uad00\ub9ac", "\uc791\uc5c5\uc790 \uacc4\uc88c", "\ud300 \uacc4\uc88c", "\ud68c\uc0ac \uacc4\uc88c", "\ub9e4\uc785 \uacc4\uc88c", "\uae30\ud0c0 \uacc4\uc88c", "\ub9e4\uc785/\uae30\ud0c0 \uacc4\uc88c"]);
const PATH_TO_MENU_TEXT = Object.entries(_constants_menuPaths__WEBPACK_IMPORTED_MODULE_5__.MENU_PATHS).reduce((acc, [name, path]) => {
  if (!acc[path]) acc[path] = name;
  return acc;
}, {});
const DEFAULT_POSITION_CONFIG_BY_ID = (((_DEFAULT_MENU_CONFIG$ = _constants_defaultMenu__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_MENU_CONFIG.admin) === null || _DEFAULT_MENU_CONFIG$ === void 0 ? void 0 : _DEFAULT_MENU_CONFIG$.positionConfig) || []).reduce((acc, item) => {
  if (item && item.id) acc[String(item.id)] = item;
  return acc;
}, {});
const sanitizePositionConfig = input => {
  if (!Array.isArray(input)) return undefined;
  const next = input.map(raw => {
    var _fallback$name, _fallback$icon, _fallback$color;
    const id = typeof (raw === null || raw === void 0 ? void 0 : raw.id) === 'string' ? raw.id : '';
    const fallback = id ? DEFAULT_POSITION_CONFIG_BY_ID[id] : undefined;
    const name = typeof (raw === null || raw === void 0 ? void 0 : raw.name) === 'string' ? raw.name : (_fallback$name = fallback === null || fallback === void 0 ? void 0 : fallback.name) !== null && _fallback$name !== void 0 ? _fallback$name : '';
    const icon = typeof (raw === null || raw === void 0 ? void 0 : raw.icon) === 'string' ? raw.icon : (_fallback$icon = fallback === null || fallback === void 0 ? void 0 : fallback.icon) !== null && _fallback$icon !== void 0 ? _fallback$icon : '';
    const color = typeof (raw === null || raw === void 0 ? void 0 : raw.color) === 'string' ? raw.color : (_fallback$color = fallback === null || fallback === void 0 ? void 0 : fallback.color) !== null && _fallback$color !== void 0 ? _fallback$color : 'from-slate-600 to-slate-400';
    const order = typeof (raw === null || raw === void 0 ? void 0 : raw.order) === 'number' ? raw.order : typeof (fallback === null || fallback === void 0 ? void 0 : fallback.order) === 'number' ? fallback.order : undefined;
    if (!id || !name || !icon || !color) return null;
    return {
      id,
      name,
      icon,
      color,
      ...(order !== undefined ? {
        order
      } : {})
    };
  }).filter(Boolean);
  return next.length > 0 ? next : undefined;
};
const normalizeHeaderActions = (input, siteKey) => {
  const source = Array.isArray(input) ? input : deepClone(_constants_headerActions__WEBPACK_IMPORTED_MODULE_4__.DEFAULT_HEADER_ACTIONS);
  return source.map(item => normalizeMenuItem(item, `${siteKey}/headerActions`)).filter(item => typeof item.text === 'string' && item.text.trim().length > 0);
};

// ALLOWED_MENU_TREE removed to support dynamic menu management

// Removed normalizePayrollMenuItem and normalizePayrollStructure to allow dynamic configuration

// prune functions removed

const createDeterministicId = parts => {
  const input = parts.join('|');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `m_${(hash >>> 0).toString(36)}`;
};
const RETIRED_HARDCODED_MENU_SEED_IDS = new Set([createDeterministicId(['admin/\uc0ac\uc9c4 \uac70\ub798\ucc98 \ub4f1\ub85d']), createDeterministicId(['admin/\uba85\ud568/\ub2f4\ub2f9\uc790 \uad00\ub9ac']), 'office_partner_photo_registration', 'office_business_card_contacts']);
const normalizePositionIdForCleanup = value => String(value || '').trim().toLowerCase().replace(/[\s_-]/g, '');
const DUPLICATE_POSITION_MENU_IDS = new Set(['teamlead', 'foreman', 'general']);
const DUPLICATE_POSITION_SITE_KEYS = new Set(['pos_teamLead', 'pos_foreman', 'pos_general']);
const OFFICE_POSITION_CONFIG = {
  id: 'office',
  name: '\uc0ac\ubb34\uc2e4',
  icon: 'fa-building-user',
  color: 'from-sky-600 to-cyan-400',
  order: 4.5
};
const OFFICE_MENU_ITEMS = [{
  id: 'office_dashboard',
  text: '\uc0ac\ubb34\uc2e4 \uc6b4\uc601 \ub300\uc2dc\ubcf4\ub4dc',
  icon: 'fa-chart-line',
  path: '/office/dashboard'
}, {
  id: 'office_request_center',
  text: '\uc2e0\uccad \uc2b9\uc778\uc13c\ud130',
  icon: 'fa-inbox',
  path: '/office/request-center'
}, {
  id: 'office_daily_review',
  text: '\uc77c\ubcf4 \uac80\uc218',
  icon: 'fa-clipboard-check',
  path: '/office/daily-review'
}, {
  id: 'office_worker_documents',
  text: '\uacc4\uc88c / \uc11c\ub958 \uad00\ub9ac',
  icon: 'fa-id-card',
  path: '/office/worker-documents'
}, {
  id: 'office_communications',
  text: '\uacf5\uc9c0 / \uba54\uc2dc\uc9c0 \ubc1c\uc1a1',
  icon: 'fa-bullhorn',
  path: '/office/communications'
}, {
  id: 'office_payroll_check',
  text: '\uae09\uc5ec \uc9c0\uae09 \uc804 \ud655\uc778',
  icon: 'fa-money-check-dollar',
  path: '/office/payroll-check'
}, {
  id: 'office_audit_log',
  text: '\ucc98\ub9ac \uc774\ub825 / \ub85c\uadf8',
  icon: 'fa-clock-rotate-left',
  path: '/office/audit-log'
}];
const OFFICE_MENU_PATHS = new Set(OFFICE_MENU_ITEMS.map(item => item.path).filter(Boolean));
const LEGACY_OFFICE_MENU_TEXTS = new Set(['\uc77c\uc815 / \ubc30\uc815 \uad00\ub9ac', '\ucd9c\uc5ed / \uc77c\ubcf4 \uac80\uc218', '\uc791\uc5c5\uc790 / \uc11c\ub958 \uad00\ub9ac', '\uae09\uc5ec / \uac00\ubd88 \ucc98\ub9ac', '\uacbd\ube44 / \ubb3c\ud488 \uc694\uccad \uad00\ub9ac', '\uacf5\uc9c0 / \uba54\uc2dc\uc9c0', '\uc18c\uac1c\uc18c']);
const RECRUITING_MENU_PATH_PREFIX = '/recruiting';
const RECRUITING_FOLDER_TEXTS = new Set(['\uc18c\uac1c\uc18c', '\uc18c\uac1c\uc18c \uba54\ub274']);
const RECRUITING_MENU_TEXTS = new Set(['\uc18c\uac1c\uc18c \ud604\ud669\ud310', '\uc6a9\uc5ed \ub4f1\ub85d', '\uc6a9\uc5ed \ub4f1\ub85d/\uc218\uc815', '\uc791\uc5c5\uc790 \uc774\ub825\uad00\ub9ac', '\uc18c\uac1c\uc18c \uc6d4\ubcc4 \uc815\uc0b0', '\uc18c\uac1c\uc18c \uc9c0\uae09\uad00\ub9ac', '\uc18c\uac1c\uc18c \uc785\uae08\uad00\ub9ac', '\uc18c\uac1c\uc18c \ubbf8\uc218\uae08\uad00\ub9ac', '\uc18c\uac1c\uc18c \uc6d4\ubcc4 \ud1b5\uacc4', '\uc18c\uac1c\uc790 \uad00\ub9ac', '\uc218\uc775\ubaa8\ub378 \uad00\ub9ac', '\uc18c\uac1c\uc18c \uc815\uc0b0 \ub85c\uadf8']);
const officeMenuContainsLegacyArtifacts = (items = []) => items.some(item => {
  if (typeof item === 'string') {
    return LEGACY_OFFICE_MENU_TEXTS.has(item);
  }
  if (LEGACY_OFFICE_MENU_TEXTS.has(item.text)) {
    return true;
  }
  return Array.isArray(item.sub) ? officeMenuContainsLegacyArtifacts(item.sub) : false;
});
const officeMenuHasDuplicateSeedRoutes = (items = [], seen = new Set()) => {
  for (const item of items) {
    if (typeof item === 'string') continue;
    if (item.path && OFFICE_MENU_PATHS.has(item.path)) {
      if (seen.has(item.path)) return true;
      seen.add(item.path);
    }
    if (Array.isArray(item.sub) && officeMenuHasDuplicateSeedRoutes(item.sub, seen)) {
      return true;
    }
  }
  return false;
};
const removeDuplicatePositionMenuArtifacts = config => {
  let changed = false;
  DUPLICATE_POSITION_SITE_KEYS.forEach(siteKey => {
    if (Object.prototype.hasOwnProperty.call(config, siteKey)) {
      delete config[siteKey];
      changed = true;
    }
  });
  const adminSite = config.admin;
  if (Array.isArray(adminSite === null || adminSite === void 0 ? void 0 : adminSite.positionConfig)) {
    const nextPositionConfig = adminSite.positionConfig.filter(position => {
      const id = normalizePositionIdForCleanup(position === null || position === void 0 ? void 0 : position.id);
      const siteKey = normalizePositionIdForCleanup((position === null || position === void 0 ? void 0 : position.siteKey) || (position === null || position === void 0 ? void 0 : position.menuKey) || (position === null || position === void 0 ? void 0 : position.siteId));
      return !DUPLICATE_POSITION_MENU_IDS.has(id) && !DUPLICATE_POSITION_MENU_IDS.has(siteKey);
    });
    if (nextPositionConfig.length !== adminSite.positionConfig.length) {
      adminSite.positionConfig = nextPositionConfig;
      changed = true;
    }
  }
  return changed;
};
const removeRetiredHardcodedMenuSeeds = config => {
  let changed = false;
  const filterItems = items => {
    return items.reduce((acc, item) => {
      if (typeof item === 'string') {
        acc.push(item);
        return acc;
      }
      if (item.id && RETIRED_HARDCODED_MENU_SEED_IDS.has(item.id)) {
        changed = true;
        return acc;
      }
      if (Array.isArray(item.sub)) {
        const nextSub = filterItems(item.sub);
        if (nextSub.length !== item.sub.length) {
          item.sub = nextSub;
        }
      }
      acc.push(item);
      return acc;
    }, []);
  };
  Object.values(config).forEach(site => {
    if (!site || !Array.isArray(site.menu)) return;
    const nextMenu = filterItems(site.menu);
    if (nextMenu.length !== site.menu.length) {
      site.menu = nextMenu;
    }
  });
  return changed;
};
const ensureOfficeMenuPages = config => {
  let changed = false;
  const adminSite = config.admin;
  if (adminSite && Array.isArray(adminSite.positionConfig)) {
    const existingIndex = adminSite.positionConfig.findIndex(position => normalizePositionIdForCleanup(position === null || position === void 0 ? void 0 : position.id) === 'office');
    if (existingIndex >= 0) {
      const nextOfficePosition = {
        ...OFFICE_POSITION_CONFIG,
        ...adminSite.positionConfig[existingIndex],
        id: OFFICE_POSITION_CONFIG.id,
        name: adminSite.positionConfig[existingIndex].name || OFFICE_POSITION_CONFIG.name,
        icon: adminSite.positionConfig[existingIndex].icon || OFFICE_POSITION_CONFIG.icon,
        color: adminSite.positionConfig[existingIndex].color || OFFICE_POSITION_CONFIG.color,
        order: typeof adminSite.positionConfig[existingIndex].order === 'number' ? adminSite.positionConfig[existingIndex].order : OFFICE_POSITION_CONFIG.order
      };
      if (!configsEqual(adminSite.positionConfig[existingIndex], nextOfficePosition)) {
        adminSite.positionConfig[existingIndex] = nextOfficePosition;
        changed = true;
      }
    } else {
      adminSite.positionConfig = [...adminSite.positionConfig, OFFICE_POSITION_CONFIG].sort((a, b) => (a.order || 0) - (b.order || 0));
      changed = true;
    }
  }
  const existingOfficeSite = config.pos_office;
  const existingOfficeMenu = Array.isArray(existingOfficeSite === null || existingOfficeSite === void 0 ? void 0 : existingOfficeSite.menu) ? existingOfficeSite.menu : [];
  const shouldSeedOfficeMenu = !existingOfficeSite || existingOfficeMenu.length === 0 || officeMenuContainsLegacyArtifacts(existingOfficeMenu) || officeMenuHasDuplicateSeedRoutes(existingOfficeMenu);
  const nextOfficeSite = {
    ...(existingOfficeSite || {}),
    name: (existingOfficeSite === null || existingOfficeSite === void 0 ? void 0 : existingOfficeSite.name) || '\uc0ac\ubb34\uc2e4 \uba54\ub274',
    icon: (existingOfficeSite === null || existingOfficeSite === void 0 ? void 0 : existingOfficeSite.icon) || 'fa-building-user',
    menu: shouldSeedOfficeMenu ? deepClone(OFFICE_MENU_ITEMS) : existingOfficeMenu,
    headerActions: Array.isArray(existingOfficeSite === null || existingOfficeSite === void 0 ? void 0 : existingOfficeSite.headerActions) ? existingOfficeSite.headerActions : [],
    deletedItems: Array.isArray(existingOfficeSite === null || existingOfficeSite === void 0 ? void 0 : existingOfficeSite.deletedItems) ? existingOfficeSite.deletedItems : []
  };
  if (!configsEqual(config.pos_office, nextOfficeSite)) {
    config.pos_office = nextOfficeSite;
    changed = true;
  }
  return changed;
};
const normalizeMenuItem = (item, parentIdPath, siblingIndex = 0) => {
  var _MENU_TEXT_ALIASES$in;
  const base = typeof item === 'string' ? {
    text: item
  } : item && typeof item === 'object' ? {
    ...item
  } : {
    text: ''
  };
  const rawText = typeof base.text === 'string' ? base.text.trim() : '';
  const rawPath = typeof base.path === 'string' ? base.path.trim() : '';
  const rawId = typeof base.id === 'string' ? base.id.trim() : '';
  const fromPath = rawPath ? PATH_TO_MENU_TEXT[rawPath] || '' : '';
  const inferredText = rawText || fromPath || rawId;
  const normalizedText = inferredText ? (_MENU_TEXT_ALIASES$in = MENU_TEXT_ALIASES[inferredText]) !== null && _MENU_TEXT_ALIASES$in !== void 0 ? _MENU_TEXT_ALIASES$in : inferredText : '';
  const idSeed = `${parentIdPath}/${normalizedText || rawId || 'unknown'}${normalizedText === '-' ? `/${siblingIndex}` : ''}`;
  const normalizedId = rawId.length > 0 ? rawId : createDeterministicId([idSeed]);
  const rawSub = Array.isArray(base.sub) ? base.sub.filter(c => typeof c === 'string' || c && typeof c === 'object') : [];
  const normalizedSub = rawSub.map((child, index) => normalizeMenuItem(child, idSeed, index)).filter(child => typeof child.text === 'string' && child.text.trim().length > 0);
  const inferredPath = normalizedText ? _constants_menuPaths__WEBPACK_IMPORTED_MODULE_5__.MENU_PATHS[normalizedText] || undefined : undefined;
  const normalizedPath = normalizedText && FORCE_MENU_PATH_TEXTS.has(normalizedText) ? inferredPath : rawPath.length > 0 ? rawPath : inferredPath;
  const next = {
    ...base,
    text: normalizedText,
    id: normalizedId,
    path: normalizedPath,
    sub: normalizedSub
  };
  if (normalizedText === '-') {
    delete next.path;
    delete next.action;
    delete next.icon;
    delete next.sub;
    return next;
  }
  if (!next.sub || next.sub.length === 0) {
    delete next.sub;
  }
  if ((0,_utils_operationMenuAccess__WEBPACK_IMPORTED_MODULE_9__.isOperationManagementMenuPath)(next.path) || (0,_utils_operationMenuAccess__WEBPACK_IMPORTED_MODULE_9__.isOperationManagementMenuText)(next.text)) {
    delete next.roles;
  }
  return next;
};
const normalizeSiteDataType = config => {
  const normalized = {};
  const safeConfig = config && typeof config === 'object' ? config : {};
  Object.keys(safeConfig).forEach(siteKey => {
    const siteAny = safeConfig[siteKey];
    const site = siteAny && typeof siteAny === 'object' ? siteAny : {};
    const safeName = typeof site.name === 'string' && site.name.trim().length > 0 ? site.name : siteKey;
    const safeIcon = typeof site.icon === 'string' && site.icon.trim().length > 0 ? site.icon : 'fa-globe';
    const rawMenu = Array.isArray(site.menu) ? site.menu : [];
    const rawTrash = Array.isArray(site.trash) ? site.trash : undefined;
    normalized[siteKey] = {
      ...site,
      name: safeName,
      icon: safeIcon,
      order: typeof site.order === 'number' ? site.order : undefined,
      // Ensure order is preserved
      headerActions: normalizeHeaderActions(site.headerActions, siteKey),
      menu: rawMenu.map((item, index) => normalizeMenuItem(item, siteKey, index)).filter(item => typeof item.text === 'string' && item.text.trim().length > 0),
      trash: rawTrash ? rawTrash.map((item, index) => normalizeMenuItem(item, `${siteKey}/trash`, index)).filter(item => typeof item.text === 'string' && item.text.trim().length > 0) : undefined,
      deletedItems: Array.isArray(site.deletedItems) ? site.deletedItems.filter(v => typeof v === 'string') : [],
      positionConfig: sanitizePositionConfig(site.positionConfig)
    };
  });
  return normalized;
};
const pruneLargeConfig = config => {
  try {
    const json = JSON.stringify(config);
    const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json).length : json.length;
    // Firestore doc limit is 1MiB; keep a buffer.
    if (bytes < 900000) return config;
    const next = deepClone(config);
    Object.keys(next).forEach(siteKey => {
      const site = next[siteKey];
      if (!site || typeof site !== 'object') return;
      if (Array.isArray(site.trash) && site.trash.length > 50) {
        site.trash = site.trash.slice(-50);
      }
      if (Array.isArray(site.deletedItems) && site.deletedItems.length > 200) {
        site.deletedItems = site.deletedItems.slice(-200);
      }
    });
    return next;
  } catch {
    return config;
  }
};
const ensureMenuChild = (config, parentText, childText) => {
  let changed = false;
  Object.values(config).forEach(site => {
    if (!site || !Array.isArray(site.menu)) return;
    site.menu.forEach(item => {
      if (typeof item === 'string' || item.text !== parentText) return;
      const subItems = Array.isArray(item.sub) ? item.sub : [];
      const hasChild = subItems.some(subItem => {
        if (typeof subItem === 'string') return subItem === childText;
        return (subItem === null || subItem === void 0 ? void 0 : subItem.text) === childText;
      });
      if (!hasChild) {
        item.sub = [...subItems, childText];
        changed = true;
      }
    });
  });
  return changed;
};
const NOTICE_BOARD_MENU_ITEM = {
  text: '공지사항',
  icon: 'fa-bullhorn',
  path: '/notices'
};
const menuTreeContainsNoticeBoard = (items = []) => items.some(item => {
  if (typeof item === 'string') {
    return item === NOTICE_BOARD_MENU_ITEM.text || _constants_menuPaths__WEBPACK_IMPORTED_MODULE_5__.MENU_PATHS[item] === NOTICE_BOARD_MENU_ITEM.path;
  }
  if (item.text === NOTICE_BOARD_MENU_ITEM.text || item.path === NOTICE_BOARD_MENU_ITEM.path) {
    return true;
  }
  return Array.isArray(item.sub) ? menuTreeContainsNoticeBoard(item.sub) : false;
});
const ensureNoticeBoardMenu = config => {
  let changed = false;
  Object.entries(config).forEach(([siteKey, site]) => {
    if (siteKey === 'test' || siteKey === 'nation') return;
    if (!site || !Array.isArray(site.menu)) return;
    if (menuTreeContainsNoticeBoard(site.menu)) return;
    if (Array.isArray(site.deletedItems) && site.deletedItems.includes(NOTICE_BOARD_MENU_ITEM.text)) return;
    const dashboardIndex = site.menu.findIndex(item => typeof item !== 'string' && (item.path === '/dashboard' || item.text === '대시보드'));
    const insertIndex = dashboardIndex >= 0 ? dashboardIndex + 1 : 0;
    site.menu.splice(insertIndex, 0, {
      ...NOTICE_BOARD_MENU_ITEM
    });
    changed = true;
  });
  return changed;
};
const getMenuItemText = item => typeof item === 'string' ? item : item.text;
const getMenuItemPath = item => {
  const text = getMenuItemText(item);
  return typeof item === 'string' ? _constants_menuPaths__WEBPACK_IMPORTED_MODULE_5__.MENU_PATHS[text] : item.path || _constants_menuPaths__WEBPACK_IMPORTED_MODULE_5__.MENU_PATHS[text];
};
const LOG_MANAGEMENT_FOLDER_TEXT = '로그관리';
const REQUIRED_LOG_MANAGEMENT_ITEMS = [{
  text: 'Gemini 사용량·비용 로그',
  icon: 'fa-chart-simple',
  path: '/admin/gemini-usage-logs',
  roles: ['admin']
}, {
  text: '신분증 로그',
  icon: 'fa-id-card',
  path: '/database/identity-logs'
}, {
  text: '권한 변경 로그',
  icon: 'fa-shield-halved',
  path: '/admin/permission-change-logs'
}, {
  text: '엑셀 업로드·다운로드 로그',
  icon: 'fa-file-excel',
  path: '/admin/excel-transfer-logs'
}, {
  text: 'PDF 업로드·다운로드 로그',
  icon: 'fa-file-pdf',
  path: '/admin/pdf-transfer-logs'
}, {
  text: '자동 메시지 발송 로그',
  icon: 'fa-paper-plane',
  path: '/messages/automation-logs'
}];
const isLogManagementFolder = item => item.text.replace(/\s+/g, '') === LOG_MANAGEMENT_FOLDER_TEXT;
const findLogManagementFolders = (items, result = []) => {
  items.forEach(item => {
    if (typeof item === 'string') return;
    if (isLogManagementFolder(item)) result.push(item);
    if (Array.isArray(item.sub)) findLogManagementFolders(item.sub, result);
  });
  return result;
};
const ensureRequiredLogManagementItems = config => {
  let changed = false;
  Object.entries(config).forEach(([key, site]) => {
    if (!site || !Array.isArray(site.menu)) return;
    const position = normalizePositionIdForCleanup(key).toLowerCase();
    if (position !== 'ceo' && !['ceo', '대표', '사장'].includes(String(site.name || '').trim().toLowerCase())) return;
    if (findLogManagementFolders(site.menu).length === 0) {
      site.menu.push({
        text: LOG_MANAGEMENT_FOLDER_TEXT,
        icon: 'fa-clock-rotate-left',
        sub: ['로그인 로그']
      });
      changed = true;
    }
  });
  Object.values(config).forEach(site => {
    if (!site || !Array.isArray(site.menu)) return;
    findLogManagementFolders(site.menu).forEach(folder => {
      const children = Array.isArray(folder.sub) ? folder.sub : [];
      const missingItems = REQUIRED_LOG_MANAGEMENT_ITEMS.filter(requiredItem => !children.some(child => {
        const childText = getMenuItemText(child);
        const childPath = getMenuItemPath(child);
        return childText === requiredItem.text || childPath === requiredItem.path;
      }));
      if (missingItems.length === 0) return;
      folder.sub = [...children, ...missingItems.map(item => ({
        ...item
      }))];
      changed = true;
    });
  });
  return changed;
};
const isRecruitingMenuItem = item => {
  if (RECRUITING_MENU_TEXTS.has(getMenuItemText(item))) return true;
  const path = getMenuItemPath(item);
  if (typeof path === 'string' && path.startsWith(RECRUITING_MENU_PATH_PREFIX)) return true;
  if (typeof item !== 'string' && Array.isArray(item.sub)) {
    return item.sub.some(isRecruitingMenuItem);
  }
  return false;
};
const removeRecruitingMenuItems = items => {
  let removed = false;
  const nextItems = [];
  items.forEach(item => {
    if (typeof item === 'string') {
      if (isRecruitingMenuItem(item)) {
        removed = true;
        return;
      }
      nextItems.push(item);
      return;
    }
    if (RECRUITING_FOLDER_TEXTS.has(item.text)) {
      removed = true;
      return;
    }
    if ((!Array.isArray(item.sub) || item.sub.length === 0) && isRecruitingMenuItem(item)) {
      removed = true;
      return;
    }
    if (Array.isArray(item.sub) && item.sub.length > 0) {
      const childResult = removeRecruitingMenuItems(item.sub);
      if (childResult.removed) {
        removed = true;
        if (childResult.items.length === 0 && isRecruitingMenuItem(item)) {
          return;
        }
        nextItems.push({
          ...item,
          sub: childResult.items
        });
        return;
      }
    }
    nextItems.push(item);
  });
  return {
    items: nextItems,
    removed
  };
};
const removeRecruitingMenuItemsFromAllSites = config => {
  let changed = false;
  Object.values(config).forEach(site => {
    if (!site || !Array.isArray(site.menu)) return;
    const result = removeRecruitingMenuItems(site.menu);
    if (!result.removed) return;
    site.menu = result.items;
    changed = true;
  });
  return changed;
};
const ensureBusinessPartnerPositionMenus = config => {
  let changed = false;
  const adminSite = config.admin;
  if (adminSite) {
    const currentPositionConfig = Array.isArray(adminSite.positionConfig) ? adminSite.positionConfig : [];
    let nextPositionConfig = [...currentPositionConfig];
    _constants_businessPartnerPositions__WEBPACK_IMPORTED_MODULE_3__.BUSINESS_PARTNER_POSITIONS.forEach(position => {
      const existingIndex = nextPositionConfig.findIndex(item => normalizePositionIdForCleanup(item === null || item === void 0 ? void 0 : item.id) === normalizePositionIdForCleanup(position.id));
      const positionConfig = {
        id: position.id,
        name: position.name,
        icon: position.iconKey,
        color: position.menuColor,
        order: position.order
      };
      if (existingIndex >= 0) {
        const existing = nextPositionConfig[existingIndex] || {};
        const next = {
          ...positionConfig,
          ...existing,
          id: position.id,
          name: existing.name || positionConfig.name,
          icon: existing.icon || positionConfig.icon,
          color: existing.color || positionConfig.color,
          order: typeof existing.order === 'number' ? existing.order : positionConfig.order
        };
        if (!configsEqual(existing, next)) {
          nextPositionConfig[existingIndex] = next;
          changed = true;
        }
      } else {
        nextPositionConfig.push(positionConfig);
        changed = true;
      }
    });
    nextPositionConfig = nextPositionConfig.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!configsEqual(currentPositionConfig, nextPositionConfig)) {
      adminSite.positionConfig = nextPositionConfig;
      changed = true;
    }
  }
  _constants_businessPartnerPositions__WEBPACK_IMPORTED_MODULE_3__.BUSINESS_PARTNER_POSITIONS.forEach(position => {
    const siteKey = (0,_constants_businessPartnerPositions__WEBPACK_IMPORTED_MODULE_3__.getBusinessPartnerPositionSiteKey)(position.id);
    const existingSite = config[siteKey];
    const existingMenu = Array.isArray(existingSite === null || existingSite === void 0 ? void 0 : existingSite.menu) ? existingSite.menu : [];
    const nextSite = {
      ...(existingSite || {}),
      name: (existingSite === null || existingSite === void 0 ? void 0 : existingSite.name) || position.name,
      icon: (existingSite === null || existingSite === void 0 ? void 0 : existingSite.icon) || position.iconKey,
      menu: existingMenu.length > 0 ? existingMenu : deepClone(position.menu),
      headerActions: Array.isArray(existingSite === null || existingSite === void 0 ? void 0 : existingSite.headerActions) ? existingSite.headerActions : [],
      deletedItems: Array.isArray(existingSite === null || existingSite === void 0 ? void 0 : existingSite.deletedItems) ? existingSite.deletedItems : []
    };
    if (!configsEqual(config[siteKey], nextSite)) {
      config[siteKey] = nextSite;
      changed = true;
    }
  });
  return changed;
};
const createNationSiteConfig = sourceSite => {
  const fallbackMenu = [{
    text: '전국시스템인력 홈',
    icon: 'fa-globe',
    path: '/dashboard3'
  }, {
    text: '전국 운영망',
    icon: 'fa-map-location-dot',
    path: '/jeonkuk/nationwide-partners'
  }, {
    text: '통합 현황판',
    icon: 'fa-chart-line',
    path: '/jeonkuk/integrated-status'
  }, {
    text: '상태 관리',
    icon: 'fa-wave-square',
    path: '/jeonkuk/status-management'
  }, {
    text: '인원 전체내역조회',
    icon: 'fa-users',
    path: '/jeonkuk/total-history'
  }];
  const clonedSource = sourceSite ? deepClone(sourceSite) : {};
  const nextMenu = Array.isArray(clonedSource.menu) && clonedSource.menu.length > 0 ? clonedSource.menu : fallbackMenu;
  return {
    ...clonedSource,
    name: '전국시스템인력',
    icon: clonedSource.icon || 'fa-globe',
    order: typeof clonedSource.order === 'number' ? clonedSource.order : 3,
    menu: nextMenu
  };
};
const ensureNationSiteConfig = config => {
  if (config.nation) {
    return false;
  }
  config.nation = createNationSiteConfig(config.test);
  return true;
};
const ensureCanonicalNationSiteConfig = config => {
  const fallbackMenu = [{
    text: '전국시스템인력 홈',
    icon: 'fa-globe',
    path: '/dashboard3'
  }, {
    text: '전국 운영망',
    icon: 'fa-map-location-dot',
    path: '/jeonkuk/nationwide-partners'
  }, {
    text: '통합 현황판',
    icon: 'fa-chart-line',
    path: '/jeonkuk/integrated-status'
  }, {
    text: '상태 관리',
    icon: 'fa-wave-square',
    path: '/jeonkuk/status-management'
  }, {
    text: '인원 전체내역조회',
    icon: 'fa-users',
    path: '/jeonkuk/total-history'
  }];
  const matchingKeys = Object.keys(config).filter(key => {
    var _config$key$name, _config$key;
    if (key.startsWith('pos_')) return false;
    const siteName = String((_config$key$name = (_config$key = config[key]) === null || _config$key === void 0 ? void 0 : _config$key.name) !== null && _config$key$name !== void 0 ? _config$key$name : '').trim();
    return key === 'nation' || siteName === NATION_SITE_NAME;
  });
  if (matchingKeys.length === 0) {
    const testSite = config.test ? deepClone(config.test) : {};
    config.nation = {
      ...testSite,
      name: NATION_SITE_NAME,
      icon: testSite.icon || 'fa-globe',
      order: typeof testSite.order === 'number' ? testSite.order : 3,
      menu: Array.isArray(testSite.menu) && testSite.menu.length > 0 ? testSite.menu : fallbackMenu
    };
    return true;
  }
  const preferredKey = [...matchingKeys].sort((a, b) => {
    var _config$b, _config$a;
    const menuLengthDiff = (Array.isArray((_config$b = config[b]) === null || _config$b === void 0 ? void 0 : _config$b.menu) ? config[b].menu.length : 0) - (Array.isArray((_config$a = config[a]) === null || _config$a === void 0 ? void 0 : _config$a.menu) ? config[a].menu.length : 0);
    if (menuLengthDiff !== 0) return menuLengthDiff;
    if (a === 'nation') return -1;
    if (b === 'nation') return 1;
    return 0;
  })[0];
  const preferredSite = deepClone(config[preferredKey] || {});
  const nextNation = {
    ...preferredSite,
    name: NATION_SITE_NAME,
    icon: preferredSite.icon || 'fa-globe',
    order: typeof preferredSite.order === 'number' ? preferredSite.order : 3,
    menu: Array.isArray(preferredSite.menu) && preferredSite.menu.length > 0 ? preferredSite.menu : fallbackMenu
  };
  let changed = !configsEqual(config.nation, nextNation);
  config.nation = nextNation;
  matchingKeys.forEach(key => {
    if (key !== 'nation') {
      delete config[key];
      changed = true;
    }
  });
  return changed;
};
const getMenuText = item => {
  var _item$text;
  if (!item) return '';
  return typeof item === 'string' ? item : String((_item$text = item.text) !== null && _item$text !== void 0 ? _item$text : '');
};
const normalizeSupportAssetMenu = config => {
  const supportGroupSignals = new Set(['지원비 설정', '지원 현황판', '숙소 관리', '법인차량 관리', '법인카드 관리', '차량/카드 관리', '차량/카드 통합 관리', '경비내역']);
  const legacyAssetLabels = new Set(['법인차량 관리', '법인카드 관리', '차량/카드 관리', '차량카드 통합 관리', '차량/카드 통합 관리']);
  const unifiedAssetLabel = '차량/카드 통합 관리';
  const expenseLedgerLabel = '경비내역';
  let changed = false;
  Object.entries(config).forEach(([siteKey, site]) => {
    if (siteKey !== 'admin') return;
    if (!site || !Array.isArray(site.menu)) return;
    site.menu.forEach(menuItem => {
      if (typeof menuItem === 'string' || !Array.isArray(menuItem.sub)) return;
      const childTexts = menuItem.sub.map(child => getMenuText(child));
      const isSupportAssetGroup = childTexts.some(text => supportGroupSignals.has(text));
      if (!isSupportAssetGroup) return;

      // Only unify if legacy labels exist, but don't force create the whole group if missing
      const nextSub = menuItem.sub.filter(child => !legacyAssetLabels.has(getMenuText(child)));
      if (nextSub.length !== menuItem.sub.length) {
        const insertAfterIndex = nextSub.findIndex(child => getMenuText(child) === '숙소 관리');
        const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : nextSub.length;
        nextSub.splice(insertIndex, 0, unifiedAssetLabel);
        menuItem.sub = nextSub;
        changed = true;
      }
      if (!menuItem.sub.some(child => getMenuText(child) === expenseLedgerLabel)) {
        const insertAfterIndex = menuItem.sub.findIndex(child => getMenuText(child) === unifiedAssetLabel);
        const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : menuItem.sub.length;
        menuItem.sub.splice(insertIndex, 0, expenseLedgerLabel);
        changed = true;
      }
    });

    // AUTO-INJECTION LOGIC REMOVED: 
    // We no longer force '지원 관리' to exist if it was deleted by the user.
  });
  return changed;
};

// Removed: mergeSubItems, fillMissingPaths, mergeMenuItemsWithDefaults, ensureMenuWithDefaults

const RETIRED_WORKBOOK_LEDGER_MENU_TEXTS = new Set(['매입매출 스마트 장부', '매입매출 업그레이드', '매입매출V2', '미수미지급 관리']);

// Saved menu configurations may still contain the removed page, including
// renamed links and legacy text-only entries. Do not write on read.
const removeWorkbookLedgerUpgradeMenus = config => {
  const filterItems = items => items.flatMap(item => {
    const text = (typeof item === 'string' ? item : item.text).trim();
    const path = typeof item === 'string' ? '' : (item.path || '').trim();
    const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '');
    const children = typeof item !== 'string' && Array.isArray(item.sub) ? filterItems(item.sub) : undefined;
    if (pathname === '/payroll/workbook-ledger-upgrade' || !path && RETIRED_WORKBOOK_LEDGER_MENU_TEXTS.has(text)) {
      return children || [];
    }
    return [typeof item !== 'string' && children ? {
      ...item,
      sub: children
    } : item];
  });
  Object.values(config).forEach(site => {
    MENU_ROLE_SURFACES.forEach(surface => {
      const items = site[surface];
      if (Array.isArray(items)) site[surface] = filterItems(items);
    });
  });
};

// This is the new "Init" logic: normalize inputs, prune illegal items, fix structure.
// But it DOES NOT merge with defaults.
const processIncomingConfig = incomingConfig => {
  // 1. Normalize IDs and structure
  const normalized = normalizeSiteDataType(incomingConfig);

  // Removed normalizePayrollStructure to allow dynamic configuration
  const final = normalized;
  ensureCanonicalNationSiteConfig(final);

  // 3. Ensure Position Config exists (Migration)
  if (final['admin'] && !final['admin'].positionConfig) {
    var _DEFAULT_MENU_CONFIG$2;
    console.log('[MenuService] Auto-injecting default position config');
    // Use a safe fallback or import from DEFAULT_MENU_CONFIG
    // Since we are inside the module, we can use the imported constant if we avoid circular issues or just hardcode/copy.
    // Copying from DEFAULT_MENU_CONFIG if available, or using hardcoded fallback for safety.
    if ((_DEFAULT_MENU_CONFIG$2 = _constants_defaultMenu__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_MENU_CONFIG.admin) !== null && _DEFAULT_MENU_CONFIG$2 !== void 0 && _DEFAULT_MENU_CONFIG$2.positionConfig) {
      final['admin'].positionConfig = JSON.parse(JSON.stringify(_constants_defaultMenu__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_MENU_CONFIG.admin.positionConfig));
    }
  }
  removeDuplicatePositionMenuArtifacts(final);
  ensureBusinessPartnerPositionMenus(final);
  removeRecruitingMenuItemsFromAllSites(final);
  ensureOfficeMenuPages(final);
  removeRetiredHardcodedMenuSeeds(final);
  ensureRequiredLogManagementItems(final);
  removeWorkbookLedgerUpgradeMenus(final);
  (0,_utils_delegatedReceiptsMenu__WEBPACK_IMPORTED_MODULE_12__.ensureDelegatedReceiptsMenu)(final);
  (0,_utils_teamPersonnelMenu__WEBPACK_IMPORTED_MODULE_13__.ensureTeamPersonnelMenu)(final);
  (0,_utils_bankTransferMenu__WEBPACK_IMPORTED_MODULE_14__.ensureBankTransferMenu)(final);
  return final;
};
const notifyListeners = () => {
  listeners.forEach(listener => {
    // Always return currentConfig (which is processed)
    if (currentConfig) {
      listener.callback(deepClone(currentConfig));
    }
  });
};
const setupSnapshotListener = () => {
  if (unsubscribeSnapshot || snapshotSetupPromise) return;
  snapshotSetupPromise = Promise.resolve().then(() => {
    if (listeners.size === 0) return;
    if (unsubscribeSnapshot) return;
    unsubscribeSnapshot = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.onSnapshot)(getMenuDocRef(), snapshot => {
      if (!snapshot.exists()) {
        console.warn('[MenuService] Configuration missing. Initializing with defaults...');
        const processedInitial = processIncomingConfig(deepClone(_constants_defaultMenu__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_MENU_CONFIG));
        currentRawConfig = processedInitial;
        currentConfig = processedInitial;
        menuServiceV11.saveMenuConfig(processedInitial).catch(err => {
          console.error('[MenuService] Failed to auto-initialize menu config:', err);
        });
        notifyListeners();
        return;
      }
      const normalizedIncoming = normalizeSiteDataType(snapshot.data());
      currentRawConfig = deepClone(normalizedIncoming);
      currentConfig = processIncomingConfig(normalizedIncoming);
      notifyListeners();
    }, error => {
      console.error('[MenuService] Snapshot listener error:', error);
      unsubscribeSnapshot = null;
      listeners.forEach(listener => {
        var _listener$onError;
        return (_listener$onError = listener.onError) === null || _listener$onError === void 0 ? void 0 : _listener$onError.call(listener, error);
      });
    });
  }).catch(error => {
    console.error('[MenuService] Failed to subscribe to menus_v12:', error);
    listeners.forEach(listener => {
      var _listener$onError2;
      return (_listener$onError2 = listener.onError) === null || _listener$onError2 === void 0 ? void 0 : _listener$onError2.call(listener, error);
    });
  }).finally(() => {
    snapshotSetupPromise = null;
  });
};
const menuServiceV11 = {
  subscribe: (callback, options = {}) => {
    const listener = {
      callback,
      onError: options.onError
    };
    listeners.add(listener);
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_7__.isDevAdminSessionEnabled)()) {
      currentConfig = processIncomingConfig((0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_8__.getDevMenuConfig)());
      currentRawConfig = deepClone(currentConfig);
      callback(deepClone(currentConfig));
      const handleDevMenuStorageChange = event => {
        if (event.key !== _utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_8__.DEV_MENU_STORAGE_KEY) return;
        const refreshedConfig = processIncomingConfig((0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_8__.reloadDevMenuConfigFromStorage)());
        currentConfig = refreshedConfig;
        currentRawConfig = deepClone(refreshedConfig);
        callback(deepClone(refreshedConfig));
      };
      window.addEventListener('storage', handleDevMenuStorageChange);
      return () => {
        window.removeEventListener('storage', handleDevMenuStorageChange);
        listeners.delete(listener);
      };
    }
    setupSnapshotListener();

    // Immediate return if we have data
    if (currentConfig) {
      callback(deepClone(currentConfig));
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
    };
  },
  getMenuConfig: async (options = {}) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_7__.isDevAdminSessionEnabled)()) {
      return processIncomingConfig((0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_8__.getDevMenuConfig)());
    }
    try {
      const snapshot = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDoc)(getMenuDocRef());
      if (snapshot.exists()) {
        const rawConfig = normalizeSiteDataType(snapshot.data());
        currentRawConfig = deepClone(rawConfig);
        currentConfig = processIncomingConfig(rawConfig);
        setupSnapshotListener();
        return deepClone(currentConfig);
      }
      console.warn('[MenuService] Config missing on fetch. Returning defaults.');
      const initial = processIncomingConfig(deepClone(_constants_defaultMenu__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_MENU_CONFIG));
      await menuServiceV11.saveMenuConfig(initial);
      return initial;
    } catch (error) {
      console.error('Failed to fetch menu configuration:', error);
      return null;
    }
  },
  saveMenuConfig: async (newConfig, baseConfig) => {
    if ((0,_utils_devAdminSession__WEBPACK_IMPORTED_MODULE_7__.isDevAdminSessionEnabled)()) {
      (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_8__.setDevMenuConfig)(processIncomingConfig(newConfig));
      currentConfig = (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_8__.getDevMenuConfig)();
      currentRawConfig = (0,_utils_devAdminFixtures__WEBPACK_IMPORTED_MODULE_8__.getDevMenuConfig)();
      notifyListeners();
      return deepClone(currentConfig);
    }
    const normalizedConfig = processIncomingConfig(normalizeSiteDataType(newConfig));
    const prunedConfig = pruneLargeConfig(normalizedConfig);
    const result = _types_menuSchema__WEBPACK_IMPORTED_MODULE_6__.SiteDataTypeSchema.safeParse(prunedConfig);
    if (!result.success) {
      const issues = result.error.issues;
      const error = new Error('Invalid Menu Configuration');
      error.issues = issues;
      throw error;
    }
    let ownedSaveFingerprint = null;
    let ownedSavePromise = null;
    try {
      const sanitizedData = JSON.parse(JSON.stringify(result.data));
      const normalizedBase = baseConfig ? JSON.parse(JSON.stringify(_types_menuSchema__WEBPACK_IMPORTED_MODULE_6__.SiteDataTypeSchema.parse(pruneLargeConfig(processIncomingConfig(normalizeSiteDataType(baseConfig)))))) : undefined;
      const saveFingerprint = JSON.stringify([sanitizedData, normalizedBase]);
      if (latestQueuedSavePromise && latestQueuedSaveFingerprint === saveFingerprint) {
        return await latestQueuedSavePromise;
      }
      const nextSavePromise = saveWriteQueue.catch(() => undefined).then(async () => {
        let previousConfig = currentRawConfig ? deepClone(currentRawConfig) : null;
        let savedData = sanitizedData;

        // Full replacement keeps Firestore in sync with the menu editor after deletions.
        if (normalizedBase) {
          savedData = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.runTransaction)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, async transaction => {
            const snapshot = await transaction.get(getMenuDocRef());
            if (!snapshot.exists()) throw new Error('메뉴 설정을 찾을 수 없습니다. 최신 메뉴를 불러와주세요.');
            const latest = _types_menuSchema__WEBPACK_IMPORTED_MODULE_6__.SiteDataTypeSchema.parse(pruneLargeConfig(processIncomingConfig(normalizeSiteDataType(snapshot.data()))));
            previousConfig = latest;
            const merged = (0,_utils_menuConfigChanges__WEBPACK_IMPORTED_MODULE_11__.mergeMenuConfigChanges)(latest, normalizedBase, sanitizedData);
            const validated = JSON.parse(JSON.stringify(_types_menuSchema__WEBPACK_IMPORTED_MODULE_6__.SiteDataTypeSchema.parse(merged)));
            transaction.set(getMenuDocRef(), validated);
            return validated;
          });
        } else {
          await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)(getMenuDocRef(), sanitizedData);
        }
        currentRawConfig = deepClone(savedData);
        const committedConfig = processIncomingConfig(normalizeSiteDataType(savedData));
        currentConfig = committedConfig;

        // Do not wait for the Firestore snapshot to make the sidebar consistent.
        // The snapshot remains the cross-tab/server source of truth.
        notifyListeners();
        try {
          await _permissionAuditService__WEBPACK_IMPORTED_MODULE_10__.permissionAuditService.logMenuAccessChanges(previousConfig, savedData);
        } catch (auditError) {
          // The menu write already succeeded. An audit failure must not make the
          // editor report that the menu itself was lost.
          console.error('Failed to audit menu configuration change:', auditError);
        }
        return deepClone(committedConfig);
      });
      saveWriteQueue = nextSavePromise.then(() => undefined, () => undefined);
      latestQueuedSaveFingerprint = saveFingerprint;
      latestQueuedSavePromise = nextSavePromise;
      ownedSaveFingerprint = saveFingerprint;
      ownedSavePromise = nextSavePromise;
      return await nextSavePromise;
    } catch (error) {
      console.error('Failed to save menu configuration:', error);
      throw error;
    } finally {
      if (ownedSavePromise && latestQueuedSavePromise === ownedSavePromise && latestQueuedSaveFingerprint === ownedSaveFingerprint) {
        latestQueuedSaveFingerprint = null;
        latestQueuedSavePromise = null;
      }
    }
  },
  saveAsDefault: async newDefault => {
    const normalizedConfig = normalizeSiteDataType(newDefault);
    const result = _types_menuSchema__WEBPACK_IMPORTED_MODULE_6__.SiteDataTypeSchema.safeParse(normalizedConfig);
    if (!result.success) {
      throw new Error('Invalid Menu Configuration');
    }
    try {
      const sanitizedData = JSON.parse(JSON.stringify(result.data));
      await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.setDoc)((0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, 'menu_custom_defaults_v11'), sanitizedData);
      return true;
    } catch (error) {
      console.error('Failed to save custom defaults:', error);
      throw error;
    }
  },
  getCustomDefault: async () => {
    try {
      const customDefaultRef = (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.doc)(_config_firebase__WEBPACK_IMPORTED_MODULE_1__.db, COLLECTION_NAME, 'menu_custom_defaults_v11');
      const docSnapshot = await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDoc)(customDefaultRef);
      if (docSnapshot.exists()) {
        const rawData = docSnapshot.data();
        const result = _types_menuSchema__WEBPACK_IMPORTED_MODULE_6__.SiteDataTypeSchema.safeParse(rawData);
        if (result.success) {
          return normalizeSiteDataType(result.data);
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get custom defaults:', error);
      return null;
    }
  },
  resetToDefault: async () => {
    // Logic: Use Custom Default if exists, otherwise Manual Default
    const customDefault = await menuServiceV11.getCustomDefault();
    if (customDefault) {
      await menuServiceV11.saveMenuConfig(customDefault);
    } else {
      // Use the local defaultMenu.ts as the "Factory Reset" source
      await menuServiceV11.saveMenuConfig(_constants_defaultMenu__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_MENU_CONFIG);
    }
  },
  ensureSystemMenuExists: async () => {
    // Remove auto-injection of menu items completely
    // The user wants manual configuration of system management menus.
    return Promise.resolve();
  },
  ensureSmartMemoMenuExists: async () => {
    // Remove auto-injection of smart memo menus completely
    return Promise.resolve();
  },
  clearCache: () => {
    currentConfig = null;
    currentRawConfig = null;
  },
  renamePositionReferences: async (oldName, newName) => {
    const emptyResult = {
      changed: false,
      roleReferences: 0,
      positionConfigs: 0,
      siteLabels: 0
    };
    try {
      const config = await menuServiceV11.getMenuConfig();
      if (!config) return emptyResult;
      const result = renamePositionReferencesInMenuConfig(config, oldName, newName);
      if (result.changed) {
        await menuServiceV11.saveMenuConfig(config);
        console.log('[MenuService] Renamed position references in menu config.', {
          oldName,
          newName,
          ...result
        });
      }
      return result;
    } catch (error) {
      console.error('[MenuService] Position reference rename failed:', error);
      throw error;
    }
  },
  removePositionReferences: async (positionName, positionId = '') => {
    const emptyResult = {
      changed: false,
      roleReferences: 0,
      positionConfigs: 0,
      siteLabels: 0
    };
    try {
      const config = await menuServiceV11.getMenuConfig();
      if (!config) return emptyResult;
      const result = removePositionReferencesInMenuConfig(config, positionName, positionId);
      if (result.changed) {
        await menuServiceV11.saveMenuConfig(config);
        console.log('[MenuService] Removed deleted position references from menu config.', {
          positionName,
          positionId,
          ...result
        });
      }
      return result;
    } catch (error) {
      console.error('[MenuService] Position reference removal failed:', error);
      throw error;
    }
  },
  syncWithPositions: async positions => {
    try {
      const config = await menuServiceV11.getMenuConfig();
      if (!config || !config.admin) return;
      let modified = false;
      const positionsById = new Map();
      positions.forEach(position => {
        if (position.id) positionsById.set(position.id, position);
        if (position.legacyId) positionsById.set(position.legacyId, position);
      });
      const currentPositionConfig = Array.isArray(config.admin.positionConfig) ? config.admin.positionConfig : [];
      const nextPositionConfig = currentPositionConfig.map(position => {
        const source = typeof (position === null || position === void 0 ? void 0 : position.id) === 'string' ? positionsById.get(position.id) : undefined;
        if (!source || position.id === 'full') return position;
        return {
          ...position,
          name: source.name || position.name,
          icon: source.iconKey || source.icon || position.icon || 'fa-user',
          color: source.color || position.color,
          order: typeof position.order === 'number' ? position.order : (source.rank || 0) + 1
        };
      });
      if (JSON.stringify(currentPositionConfig) !== JSON.stringify(nextPositionConfig)) {
        config.admin.positionConfig = nextPositionConfig;
        modified = true;
      }
      nextPositionConfig.forEach(position => {
        if (!(position !== null && position !== void 0 && position.id) || position.id === 'full') return;
        const source = positionsById.get(position.id);
        if (!source) return;
        const siteKey = position.id.startsWith('pos_') ? position.id : `pos_${position.id}`;
        const site = config[siteKey];
        if (!site) return;
        const nextIcon = source.iconKey || source.icon || site.icon || 'fa-user';
        if (site.name !== source.name || site.icon !== nextIcon) {
          site.name = source.name;
          site.icon = nextIcon;
          modified = true;
        }
      });
      if (modified) {
        await menuServiceV11.saveMenuConfig(config);
        console.log('[MenuService] Synced positions to menu config.');
      }
    } catch (error) {
      console.error('[MenuService] Sync failed:', error);
    }
  },
  pruneDuplicates: async () => {
    try {
      const config = await menuServiceV11.getMenuConfig();
      if (!config) return;
      let modified = false;
      const seenIds = new Set();
      const generateDeterministicId = (text, parentPath = '') => {
        const combined = `${parentPath}/${text}`.toLowerCase().replace(/\s+/g, '');
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
          const char = combined.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        return `m_${Math.abs(hash).toString(36)}`;
      };
      const pruneRecursive = (items, parentPath = '') => {
        const seenText = new Set();
        const uniqueItems = [];
        items.forEach((item, index) => {
          const text = typeof item === 'string' ? item : item.text;
          const normalizedText = text.trim();
          const isDivider = normalizedText === '-';

          // 1. Text Deduplication (per level)
          if (!isDivider && seenText.has(normalizedText)) {
            modified = true;
            return; // Skip duplicate text at same level
          }
          seenText.add(normalizedText);

          // 2. ID Deduplication (Global) & ID Generation
          if (typeof item !== 'string') {
            const expectedId = generateDeterministicId(isDivider ? `divider-${index}` : normalizedText, parentPath);
            if (!item.id || item.id.startsWith('m_rand_') || seenIds.has(item.id)) {
              // Fix deterministic ID if missing or potentially random
              item.id = expectedId;
              modified = true;
            }

            // Fix text padding issues while we're at it
            if (item.text !== normalizedText) {
              item.text = normalizedText;
              modified = true;
            }
            seenIds.add(item.id);
            if (item.sub) {
              item.sub = pruneRecursive(item.sub, `${parentPath}/${normalizedText}`);
            }
          }
          uniqueItems.push(item);
        });
        return uniqueItems;
      };
      Object.keys(config).forEach(siteKey => {
        const site = config[siteKey];
        if (site.menu) {
          site.menu = pruneRecursive(site.menu);
        }
      });
      if (modified) {
        console.log('[MenuService] Duplicates (IDs/Text) pruned and fixed.');
        await menuServiceV11.saveMenuConfig(config);
      } else {
        console.log('[MenuService] No duplicates found.');
      }
    } catch (error) {
      console.error('[MenuService] Prune failed:', error);
    }
  },
  // === ?筌뤿굞???shim (??ル맪???袁⑤?獄?????嶺뚣볦굣?? ===
  refreshFromServer: async () => {
    await menuServiceV11.getMenuConfig();
    return {
      changed: false,
      activeDocId: MENU_DOCUMENT_ID
    };
  },
  announceMenuChange: _source => {/* no-op */},
  checkMenusV12Exists: async () => {
    try {
      return (await (0,firebase_firestore__WEBPACK_IMPORTED_MODULE_0__.getDoc)(getMenuDocRef())).exists();
    } catch {
      return false;
    }
  },
  getActiveDocId: () => MENU_DOCUMENT_ID,
  initializeMenusV12: async () => {
    await menuServiceV11.saveMenuConfig(_constants_defaultMenu__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_MENU_CONFIG);
  },
  parseMenuConfigJson: raw => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  getMenuConfigRaw: async () => menuServiceV11.getMenuConfig(),
  runOneTimeMigrations: async () => {
    try {
      const config = await menuServiceV11.getMenuConfig();
      if (!config) return;
      const addedNationwidePage = ensureMenuChild(config, '현황관리', '전국페이지');
      const addedNoticeBoard = ensureNoticeBoardMenu(config);
      const removedRecruitingMenus = removeRecruitingMenuItemsFromAllSites(config);
      const ensuredNationSite = ensureCanonicalNationSiteConfig(config);
      const normalizedSupportAssetMenu = normalizeSupportAssetMenu(config);
      const changed = addedNationwidePage || addedNoticeBoard || removedRecruitingMenus || ensuredNationSite || normalizedSupportAssetMenu;
      if (changed) {
        await menuServiceV11.saveMenuConfig(config);
      }
    } catch (error) {
      console.error('[MenuService] runOneTimeMigrations failed:', error);
    }
  }
};

/***/ },

/***/ "./src/services/permissionAuditService.ts"
/*!************************************************!*\
  !*** ./src/services/permissionAuditService.ts ***!
  \************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   collectMenuPermissionChanges: () => (/* binding */ collectMenuPermissionChanges),
/* harmony export */   permissionAuditService: () => (/* binding */ permissionAuditService)
/* harmony export */ });
/* harmony import */ var _config_firebase__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../config/firebase */ "./fixtures/client-mobile-preview/mocks.tsx");
/* harmony import */ var _auditService__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./auditService */ "./src/services/auditService.ts");


const normalizeRoles = value => Array.from(new Set((Array.isArray(value) ? value : []).map(role => typeof role === 'string' ? role.trim() : '').filter(Boolean))).sort();
const rolesEqual = (left, right) => left.length === right.length && left.every((role, index) => role === right[index]);
const collectRoleEntries = config => {
  const entries = new Map();
  if (!config) return entries;
  const visit = (siteKey, siteName, items, parentKey = '') => {
    (items || []).forEach((item, index) => {
      if (typeof item === 'string') return;
      const identity = item.id || item.path || `${parentKey}/${index}:${item.text}`;
      const key = `${siteKey}:${identity}`;
      entries.set(key, {
        siteName,
        menuId: identity,
        menuText: item.text || identity,
        roles: normalizeRoles(item.roles)
      });
      visit(siteKey, siteName, item.sub, identity);
    });
  };
  Object.entries(config).forEach(([siteKey, site]) => {
    visit(siteKey, String((site === null || site === void 0 ? void 0 : site.name) || siteKey), site === null || site === void 0 ? void 0 : site.menu);
  });
  return entries;
};
const collectMenuPermissionChanges = (beforeConfig, afterConfig) => {
  const before = collectRoleEntries(beforeConfig);
  const after = collectRoleEntries(afterConfig);
  const keys = new Set([...before.keys(), ...after.keys()]);
  const changes = [];
  keys.forEach(key => {
    const beforeItem = before.get(key);
    const afterItem = after.get(key);
    const beforeRoles = (beforeItem === null || beforeItem === void 0 ? void 0 : beforeItem.roles) || [];
    const afterRoles = (afterItem === null || afterItem === void 0 ? void 0 : afterItem.roles) || [];
    if (rolesEqual(beforeRoles, afterRoles)) return;
    const item = afterItem || beforeItem;
    if (!item) return;
    changes.push({
      siteKey: key.split(':', 1)[0],
      siteName: item.siteName,
      menuId: item.menuId,
      menuText: item.menuText,
      beforeRoles,
      afterRoles
    });
  });
  return changes.sort((left, right) => `${left.siteName}:${left.menuText}`.localeCompare(`${right.siteName}:${right.menuText}`, 'ko'));
};
const resolveActor = () => {
  const user = _config_firebase__WEBPACK_IMPORTED_MODULE_0__.auth.currentUser;
  return {
    actorId: (user === null || user === void 0 ? void 0 : user.uid) || 'system',
    actorEmail: (user === null || user === void 0 ? void 0 : user.email) || 'system',
    actorName: (user === null || user === void 0 ? void 0 : user.displayName) || undefined
  };
};

/**
 * Keeps security-sensitive access changes in a single, queryable audit category.
 * Audit logging is deliberately non-blocking: an access update must not fail just
 * because its history record cannot be written.
 */
const permissionAuditService = {
  async log(input) {
    await _auditService__WEBPACK_IMPORTED_MODULE_1__.auditService.log({
      action: input.action,
      category: 'PERMISSION',
      ...resolveActor(),
      targetId: input.targetId,
      targetName: input.targetName,
      details: input.details
    });
  },
  async logMenuAccessChanges(beforeConfig, afterConfig) {
    const changes = collectMenuPermissionChanges(beforeConfig, afterConfig);
    if (changes.length === 0) return;
    const savedChanges = changes.slice(0, 100);
    await this.log({
      action: 'MENU_ACCESS_UPDATED',
      targetId: 'menu-config',
      targetName: 'Menu access configuration',
      details: {
        scope: 'menu_access',
        changeCount: changes.length,
        truncated: changes.length > savedChanges.length,
        changes: savedChanges
      }
    });
  }
};

/***/ },

/***/ "./src/types/menuSchema.ts"
/*!*********************************!*\
  !*** ./src/types/menuSchema.ts ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MenuItemSchema: () => (/* binding */ MenuItemSchema),
/* harmony export */   SiteDataSchema: () => (/* binding */ SiteDataSchema),
/* harmony export */   SiteDataTypeSchema: () => (/* binding */ SiteDataTypeSchema)
/* harmony export */ });
/* harmony import */ var zod__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! zod */ "./node_modules/zod/v3/types.js");


// Recursive schema definition for MenuItem
const MenuItemSchema = zod__WEBPACK_IMPORTED_MODULE_0__.lazy(() => zod__WEBPACK_IMPORTED_MODULE_0__.object({
  text: zod__WEBPACK_IMPORTED_MODULE_0__.string().min(1, "메뉴명은 필수입니다."),
  // Text is required
  icon: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  path: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  action: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  id: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  // ID might be missing in legacy data, but we encourage it
  roles: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional(),
  hoverColor: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  // Rollover Color
  iconColor: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  activeColor: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  hide: zod__WEBPACK_IMPORTED_MODULE_0__.boolean().optional(),
  dividerStyle: zod__WEBPACK_IMPORTED_MODULE_0__["enum"](['solid', 'dashed']).optional(),
  dividerSpacing: zod__WEBPACK_IMPORTED_MODULE_0__["enum"](['compact', 'normal', 'relaxed']).optional(),
  sub: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string().or(MenuItemSchema)).optional()
}));
const SiteDataSchema = zod__WEBPACK_IMPORTED_MODULE_0__.object({
  name: zod__WEBPACK_IMPORTED_MODULE_0__.string(),
  icon: zod__WEBPACK_IMPORTED_MODULE_0__.string(),
  order: zod__WEBPACK_IMPORTED_MODULE_0__.number().optional(),
  delegationTemplatePath: zod__WEBPACK_IMPORTED_MODULE_0__.string().optional(),
  menu: zod__WEBPACK_IMPORTED_MODULE_0__.array(MenuItemSchema),
  headerActions: zod__WEBPACK_IMPORTED_MODULE_0__.array(MenuItemSchema).optional(),
  sidebarSearchEnabled: zod__WEBPACK_IMPORTED_MODULE_0__.boolean().optional(),
  linkedPositionMenusEnabled: zod__WEBPACK_IMPORTED_MODULE_0__.boolean().optional(),
  trash: zod__WEBPACK_IMPORTED_MODULE_0__.array(MenuItemSchema).optional(),
  deletedItems: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.string()).optional(),
  systemPageLabels: zod__WEBPACK_IMPORTED_MODULE_0__.record(zod__WEBPACK_IMPORTED_MODULE_0__.string(), zod__WEBPACK_IMPORTED_MODULE_0__.string().min(1)).optional(),
  positionConfig: zod__WEBPACK_IMPORTED_MODULE_0__.array(zod__WEBPACK_IMPORTED_MODULE_0__.object({
    id: zod__WEBPACK_IMPORTED_MODULE_0__.string(),
    name: zod__WEBPACK_IMPORTED_MODULE_0__.string(),
    icon: zod__WEBPACK_IMPORTED_MODULE_0__.string(),
    color: zod__WEBPACK_IMPORTED_MODULE_0__.string(),
    order: zod__WEBPACK_IMPORTED_MODULE_0__.number().optional()
  })).optional()
});
const SiteDataTypeSchema = zod__WEBPACK_IMPORTED_MODULE_0__.record(zod__WEBPACK_IMPORTED_MODULE_0__.string(), SiteDataSchema);

// Types inferred from Schema

/***/ },

/***/ "./src/utils/bankTransferMenu.ts"
/*!***************************************!*\
  !*** ./src/utils/bankTransferMenu.ts ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ensureBankTransferMenu: () => (/* binding */ ensureBankTransferMenu)
/* harmony export */ });
const path = '/payroll/bank-transfer';
const label = '국민은행 송금';
const contains = items => items.some(item => {
  var _item$sub;
  return typeof item === 'string' ? item === label : item.path === path || item.text === label || contains((_item$sub = item.sub) !== null && _item$sub !== void 0 ? _item$sub : []);
});

/** Add the transfer workspace beside payroll in memory, retaining the existing payroll access restrictions. */
function ensureBankTransferMenu(config) {
  Object.values(config).forEach(site => {
    var _site$trash, _site$deletedItems;
    if (!Array.isArray(site.menu) || contains(site.menu) || contains((_site$trash = site.trash) !== null && _site$trash !== void 0 ? _site$trash : []) || (_site$deletedItems = site.deletedItems) !== null && _site$deletedItems !== void 0 && _site$deletedItems.some(item => item === path || item === label)) return;
    const insert = items => {
      const index = items.findIndex(item => typeof item === 'string' ? item === '월급제' : item.path === '/payroll/monthly-wage');
      if (index >= 0) {
        const existing = items[index];
        items.splice(index + 1, 0, {
          text: label,
          path,
          icon: 'fa-building-columns',
          ...(typeof existing !== 'string' && existing.roles ? {
            roles: [...existing.roles]
          } : {}),
          ...(typeof existing !== 'string' && existing.hide !== undefined ? {
            hide: existing.hide
          } : {})
        });
        return true;
      }
      return items.some(item => typeof item !== 'string' && !!item.sub && insert(item.sub));
    };
    insert(site.menu);
  });
}

/***/ },

/***/ "./src/utils/delegatedReceiptsMenu.ts"
/*!********************************************!*\
  !*** ./src/utils/delegatedReceiptsMenu.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DELEGATED_RECEIPTS_MENU: () => (/* binding */ DELEGATED_RECEIPTS_MENU),
/* harmony export */   ensureDelegatedReceiptsMenu: () => (/* binding */ ensureDelegatedReceiptsMenu)
/* harmony export */ });
/* harmony import */ var _security_erpAccessPolicy__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../security/erpAccessPolicy */ "./src/security/erpAccessPolicy.ts");

const DELEGATED_RECEIPTS_MENU = {
  text: '위임금 입금 확인',
  path: '/payroll/delegated-receipts',
  icon: 'fa-money-bill-transfer'
};
const containsMenu = items => items.some(item => {
  var _item$path;
  return typeof item === 'string' ? item === DELEGATED_RECEIPTS_MENU.text : item.text === DELEGATED_RECEIPTS_MENU.text || ((_item$path = item.path) === null || _item$path === void 0 ? void 0 : _item$path.split(/[?#]/)[0]) === DELEGATED_RECEIPTS_MENU.path || Array.isArray(item.sub) && containsMenu(item.sub);
});

/** Enrich the in-memory menu only; no configuration writes occur here. */
const ensureDelegatedReceiptsMenu = config => {
  Object.entries(config).forEach(([key, site]) => {
    var _site$deletedItems;
    const role = key.replace(/^pos_/, '');
    const groups = (0,_security_erpAccessPolicy__WEBPACK_IMPORTED_MODULE_0__.getErpRoleGroupsForRoles)([role, site.name]);
    if (key !== 'pos_ceo' && !groups.some(group => ['admin', 'finance', 'payroll'].includes(group))) return;
    if ((_site$deletedItems = site.deletedItems) !== null && _site$deletedItems !== void 0 && _site$deletedItems.some(value => [DELEGATED_RECEIPTS_MENU.text, DELEGATED_RECEIPTS_MENU.path].includes(value))) return;
    if (containsMenu(site.menu) || containsMenu(site.trash || [])) return;
    const findPayroll = items => {
      for (const item of items) {
        if (typeof item === 'string') continue;
        if (item.text.replace(/\s/g, '') === '급여관리') return item;
        const child = item.sub && findPayroll(item.sub);
        if (child) return child;
      }
      return undefined;
    };
    const payroll = findPayroll(site.menu);
    if (payroll) payroll.sub = [...(payroll.sub || []), {
      ...DELEGATED_RECEIPTS_MENU
    }];
  });
};

/***/ },

/***/ "./src/utils/menuConfigChanges.ts"
/*!****************************************!*\
  !*** ./src/utils/menuConfigChanges.ts ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   menuConfigsEqual: () => (/* binding */ menuConfigsEqual),
/* harmony export */   mergeMenuConfigChanges: () => (/* binding */ mergeMenuConfigChanges),
/* harmony export */   rebaseMenuHistory: () => (/* binding */ rebaseMenuHistory)
/* harmony export */ });
// Firestore/schema normalization can change object key order without changing data.
const menuConfigsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => menuConfigsEqual(value, b[i]));
  }
  const left = a;
  const right = b;
  const keys = Object.keys(left).filter(key => left[key] !== undefined);
  return keys.length === Object.keys(right).filter(key => right[key] !== undefined).length && keys.every(key => menuConfigsEqual(left[key], right[key]));
};
const equal = menuConfigsEqual;

/** Merge only edited fields; concurrent edits to the same menu require a reload. */
const mergeMenuConfigChanges = (latest, base, next) => {
  const merged = JSON.parse(JSON.stringify(latest));
  const conflict = () => {
    throw new Error('다른 창에서 같은 메뉴가 변경되었습니다. 최신 메뉴 불러오기를 눌러 확인한 뒤 다시 수정해주세요.');
  };
  for (const key of new Set([...Object.keys(base), ...Object.keys(next)])) {
    if (equal(base[key], next[key])) continue;
    if (!base[key] || !next[key]) {
      if (!equal(latest[key], base[key]) && !equal(latest[key], next[key])) conflict();
      if (next[key]) merged[key] = next[key];else delete merged[key];
      continue;
    }
    if (!latest[key]) conflict();
    const before = base[key];
    const after = next[key];
    const current = latest[key];
    const target = merged[key];
    for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (equal(before[field], after[field])) continue;
      if (!equal(current[field], before[field]) && !equal(current[field], after[field])) conflict();
      if (after[field] === undefined) delete target[field];else target[field] = after[field];
    }
  }
  return JSON.parse(JSON.stringify(merged));
};
/** Undo must not revert unrelated changes received from another editor. */
const rebaseMenuHistory = (history, base, latest) => {
  try {
    const rebase = snapshot => mergeMenuConfigChanges(latest, base, snapshot);
    return {
      past: history.past.map(rebase),
      future: history.future.map(rebase)
    };
  } catch {
    return {
      past: [],
      future: []
    };
  }
};

/***/ },

/***/ "./src/utils/operationMenuAccess.ts"
/*!******************************************!*\
  !*** ./src/utils/operationMenuAccess.ts ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isOperationManagementMenuPath: () => (/* binding */ isOperationManagementMenuPath),
/* harmony export */   isOperationManagementMenuText: () => (/* binding */ isOperationManagementMenuText)
/* harmony export */ });
const normalizePathParts = path => {
  const raw = String(path !== null && path !== void 0 ? path : '').trim();
  if (!raw) return {
    pathname: '',
    search: ''
  };
  try {
    const url = new URL(raw, 'http://local.invalid');
    const pathname = url.pathname.length > 1 && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    return {
      pathname,
      search: url.search
    };
  } catch {
    const [withoutHash] = raw.split('#');
    const [rawPathname, rawSearch = ''] = withoutHash.split('?');
    const pathname = rawPathname.length > 1 && rawPathname.endsWith('/') ? rawPathname.slice(0, -1) : rawPathname;
    return {
      pathname,
      search: rawSearch ? `?${rawSearch}` : ''
    };
  }
};
const normalizeMenuTextKey = value => String(value !== null && value !== void 0 ? value : '').replace(/\s+/g, '').trim();
const OPERATION_MENU_TEXT_KEYS = new Set(['\uc6b4\uc601\uad00\ub9ac', '\uc0ac\ubb34\uc2e4\uad00\ub9ac', '\uc0ac\ubb34\uc2e4\uba54\ub274']);
const isOperationManagementMenuText = text => {
  return OPERATION_MENU_TEXT_KEYS.has(normalizeMenuTextKey(text));
};
const isOperationManagementMenuPath = path => {
  const {
    pathname,
    search
  } = normalizePathParts(path);
  if (!pathname) return false;
  if (pathname === '/office' || pathname.startsWith('/office/')) return true;
  if (pathname === '/payroll/office-staff-payroll') return true;
  if (pathname === '/database/manpower-db') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return params.get('tab') === 'offices';
  }
  return false;
};

/***/ },

/***/ "./src/utils/teamPersonnelMenu.ts"
/*!****************************************!*\
  !*** ./src/utils/teamPersonnelMenu.ts ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TEAM_PERSONNEL_MENU_ITEMS: () => (/* binding */ TEAM_PERSONNEL_MENU_ITEMS),
/* harmony export */   ensureTeamPersonnelMenu: () => (/* binding */ ensureTeamPersonnelMenu)
/* harmony export */ });
/* harmony import */ var _teamWorkflowPolicy__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./teamWorkflowPolicy */ "./src/utils/teamWorkflowPolicy.ts");
/* harmony import */ var _teamAccountApprovalFeature__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./teamAccountApprovalFeature */ "./src/utils/teamAccountApprovalFeature.ts");


const TEAM_PERSONNEL_MENU_ITEMS = [{
  text: '작업자정보',
  path: '/manpower/team-worker-detail',
  icon: 'fa-address-card'
}, {
  text: '급여명세서',
  path: '/manpower/team-worker-payslip',
  icon: 'fa-file-invoice-dollar'
}, {
  text: '신규작업자등록',
  path: '/manpower/team-worker-requests',
  icon: 'fa-user-plus'
}];
const normalize = value => String(value !== null && value !== void 0 ? value : '').replace(/\s/g, '');
const isTeamLead = value => ['팀장', 'team_leader', 'teamleader'].includes(normalize(value).toLowerCase());

/** Upgrade existing team-leader personnel menus in memory without writing settings. */
const ensureTeamPersonnelMenu = config => {
  var _config$admin$positio, _config$admin;
  const teamLeadKeys = new Set(((_config$admin$positio = (_config$admin = config.admin) === null || _config$admin === void 0 ? void 0 : _config$admin.positionConfig) !== null && _config$admin$positio !== void 0 ? _config$admin$positio : []).filter(position => isTeamLead(position.name)).map(position => `pos_${position.id}`));
  Object.entries(config).forEach(([key, site]) => {
    if (!teamLeadKeys.has(key) && !isTeamLead(site.name) && !isTeamLead(key.replace(/^pos_/, ''))) return;
    const prune = items => items.flatMap(value => {
      const item = typeof value === 'string' ? {
        text: value
      } : value;
      if ((0,_teamWorkflowPolicy__WEBPACK_IMPORTED_MODULE_0__.hideTeamWorkflowLink)(item)) return [];
      if (item.path === '/manpower/team-account-approvals' && !(0,_teamAccountApprovalFeature__WEBPACK_IMPORTED_MODULE_1__.teamAccountApprovalEnabled)()) return [];
      if (item.sub) {
        item.sub = prune(item.sub);
        if (!item.sub.length && !item.path) return [];
      }
      return [item];
    });
    site.menu = prune(site.menu);
    if (site.headerActions) site.headerActions = prune(site.headerActions);
    const targets = [...TEAM_PERSONNEL_MENU_ITEMS, ...((0,_teamAccountApprovalFeature__WEBPACK_IMPORTED_MODULE_1__.teamAccountApprovalEnabled)() ? [{
      text: '팀원 계정 승인',
      path: '/manpower/team-account-approvals',
      icon: 'fa-user-check'
    }] : [])];
    const upgrade = items => {
      items.forEach(item => {
        var _item$sub;
        if (typeof item === 'string') return;
        if (normalize(item.text) !== '인원관리') {
          if (item.sub) upgrade(item.sub);
          return;
        }
        const children = ((_item$sub = item.sub) !== null && _item$sub !== void 0 ? _item$sub : []).map(child => typeof child === 'string' ? {
          text: child
        } : child);
        const matches = (child, target) => {
          var _child$path;
          return ((_child$path = child.path) === null || _child$path === void 0 ? void 0 : _child$path.split(/[?#]/)[0]) === target.path || normalize(child.text) === normalize(target.text) || target === TEAM_PERSONNEL_MENU_ITEMS[0] && normalize(child.text) === '인원현황';
        };
        const profile = children.find(child => matches(child, TEAM_PERSONNEL_MENU_ITEMS[0]));
        item.sub = targets.map((target, index) => {
          const existing = children.find(child => matches(child, target));
          return {
            ...(profile !== null && profile !== void 0 && profile.roles ? {
              roles: [...profile.roles]
            } : {}),
            ...((profile === null || profile === void 0 ? void 0 : profile.hide) !== undefined ? {
              hide: profile.hide
            } : {}),
            ...target,
            ...existing,
            id: (existing === null || existing === void 0 ? void 0 : existing.id) || `${item.id || key + '-personnel'}-${index}`,
            text: target.text,
            path: target.path
          };
        });
        // Preserve unrelated custom links when updating older configurations.
        item.sub.push(...children.filter(child => !targets.some(target => matches(child, target))));
        delete item.path;
      });
    };
    upgrade(site.menu);
  });
};

/***/ },

/***/ "./src/utils/teamWorkflowPolicy.ts"
/*!*****************************************!*\
  !*** ./src/utils/teamWorkflowPolicy.ts ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   hideTeamWorkflowLink: () => (/* binding */ hideTeamWorkflowLink),
/* harmony export */   isRestrictedTeamLeader: () => (/* binding */ isRestrictedTeamLeader),
/* harmony export */   isTeamLeaderRole: () => (/* binding */ isTeamLeaderRole),
/* harmony export */   teamWorkflowDestination: () => (/* binding */ teamWorkflowDestination)
/* harmony export */ });
/* harmony import */ var _constants_menuPaths__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../constants/menuPaths */ "./src/constants/menuPaths.ts");

const key = value => String(value !== null && value !== void 0 ? value : '').toLowerCase().replace(/[\s_-]/g, '');
const isTeamLeaderRole = value => ['팀장', 'teamlead', 'teamleader'].includes(key(value));
const officeRoles = new Set(['admin', 'administrator', 'superadmin', 'owner', 'developer', 'dev', 'systemadmin', '관리자', '사장', '실장', '개발자', 'office', 'officestaff', '사무실직원', '사무직원', '사무', 'manager', 'manager1', 'manager2', 'manager3', 'sitemanager', '현장관리자', '현장소장', '매니저', '메니저', 'payrollmanager', 'finance', 'accounting', '회계', '재무', '경리']);
function isRestrictedTeamLeader(profile, positions = [], workers = []) {
  const roles = [profile === null || profile === void 0 ? void 0 : profile.role, profile === null || profile === void 0 ? void 0 : profile.position, profile === null || profile === void 0 ? void 0 : profile.systemRole, profile === null || profile === void 0 ? void 0 : profile.accountType, ...((profile === null || profile === void 0 ? void 0 : profile.roles) || []), ...((profile === null || profile === void 0 ? void 0 : profile.additionalPositions) || [])].flatMap(value => {
    var _positions$find;
    return [value, (_positions$find = positions.find(position => value === position.id || value === `pos_${position.id}`)) === null || _positions$find === void 0 ? void 0 : _positions$find.name];
  });
  if (roles.some(value => officeRoles.has(key(value)))) return false;
  return [...roles, ...workers.map(worker => worker.role)].some(isTeamLeaderRole);
}
const readAliases = new Set(['/manpower/team-worker-daily-report', '/reports/daily-worker-calendar', '/reports/worker-calendar', '/reports/daily-logs', '/reports/labor-check', '/jeonkuk/total-history']);
const blocked = new Set(['/reports/daily', '/reports/daily-v2', '/assignment/off-duty-request', '/worker/off-duty-request', '/database/manpower-db', '/database/team-db', '/database/worker-input', '/manpower', '/mass-upload/daily-report', '/mass-upload/daily-report-integrated', '/mass-upload/integrated', '/upload/worker']);
const teamWorkflowDestination = path => {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (readAliases.has(pathname)) return 'work';
  if (blocked.has(pathname)) return 'blocked';
  return null;
};
const removedLabels = new Set(['일보작성', '보드입력', '일보보드입력', '일보목록', '일보목록v2', '출력일보', '개인달력', '노임체크', '인원전체관리', '인원전체내역조회', '휴무신청', '작업자휴무신청', '내휴무신청']);
const hideTeamWorkflowLink = item => {
  var _item$text;
  return removedLabels.has(String((_item$text = item.text) !== null && _item$text !== void 0 ? _item$text : '').replace(/\s/g, '')) || Boolean(teamWorkflowDestination(item.path || _constants_menuPaths__WEBPACK_IMPORTED_MODULE_0__.MENU_PATHS[item.text || ''] || ''));
};

/***/ }

}]);