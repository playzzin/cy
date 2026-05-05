export const MENU_PATHS: { [key: string]: string } = {
    "\ub300\uc2dc\ubcf4\ub4dc": "/dashboard",
    "\ud1b5\ud569 \uc5d1\uc140\ub4f1\ub85d": "/mass-upload/integrated",
    "\ud1b5\ud569 \uc77c\uad04 \ub4f1\ub85d": "/mass-upload/integrated", // Keep compat just in case
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
    "\uc77c\ubcf4 v2": "/reports/daily-v2",
    "\uc77c\ubcf4\ubaa9\ub85d": "/reports/daily?tab=list",
    "\uc77c\ubcf4\ubaa9\ub85dv2": "/reports/daily?tab=list-v2",
    "AI\uc77c\ubcf4": "/reports/daily?tab=lookup",

    "\uae09\uc5ec \uc9c0\uae09 \uad00\ub9ac": "/payroll/wage-payment",
    "\uc77c\uae09\uc81c": "/payroll/daily-wage",
    "\uc6d4\uae09\uc81c": "/payroll/monthly-wage",
    "\uc6d4\uae09\uc81cv2": "/payroll/monthly-wage",
    "\uc6d4\uae09\uc81c \uc9d1\uacc4": "/payroll/monthly-wage",
    "\uc9c0\uc6d0\ud300": "/payroll/support-team",
    "\uc9c0\uc6d0\ud300 \uc9c0\uae09": "/payroll/support-team",
    "\uc9c0\uc6d0\ube44 \uba85\uc138\uc11c": "/payroll/support-claim",
    "\ub2e8\uac00\uad00\ub9ac": "/payroll/rate-management?tab=unit",
    "\uc9c0\uc6d0\ube44\uad00\ub9ac": "/payroll/rate-management?tab=support",
    "\ud604\uc7a5\ubcc4 \uba85\uc138\uc11c": "/payroll/payslip?tab=site",
    "\uac00\ubd88 \uad00\ub9ac": "/payroll/advance-payment",
    "\ub300\ub0a9\ucd9c\ub825\ubd80": "/payroll/daily-advance-workbook",
    "\ub300\ub0a9 \ucd9c\ub825\ubd80": "/payroll/daily-advance-workbook",
    "\ud300\uc815\uc0b0 \uad00\ub9ac": "/payroll/team-settlement",
    "\uac00\ubd88\ub4f1\ub85d": "/payroll/advance-payment?tab=register",
    "\uac00\ubd88\ubaa9\ub85d": "/payroll/advance-payment?tab=list",
    "\uc138\uae08/\uac00\ubd88": "/payroll/team-payslip",
    "\uc138\uae08/\uac00\ubd88 \uacc4\uc0b0": "/payroll/team-payslip",
    "\uc2f8\uc778 \uad00\ub9ac": "/payroll/sign-management",

    "\uc77c\uc6a9\ub178\ubb34\ube44 \uc9c0\uae09\uba85\uc138\uc11c": "/payroll/labor-cost-statement-generator",
    "\ub178\ubb34\ube44 \uc9c0\uae09\uba85\uc138\uc11c \uc0dd\uc131\uae30": "/payroll/labor-cost-statement-generator",

    // \uc11c\uba85 \uad00\ub9ac
    "\uc11c\uba85\uc0dd\uc131\uae30": "/payroll/signature-generator",
    "\uc11c\uba85\ub4f1\ub85d": "/payroll/signature-generator",
    "\uc11c\uba85\uc704\uc784\uc7a5": "/payroll/delegation-letter",
    "\uc704\uc784\uc7a5v2": "/payroll/delegation-letter-v2",
    "\uacc4\uc88c\uc870\ud68c": "/payroll/taxinvoice/bank-inquiry",
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
    "\uc0ac\ubb34\uc2e4 \uad00\ub9ac": "/office/management",
    "\uc77c\ubcf4 \ud1b5\uacc4": "/reports/statistics",
    "\uc77c\uae09\uc81c \uc6d4\uae09\uc81c \ud1b5\uacc4": "/payroll/statistics",

    // \uc790\uc7ac\uad00\ub9ac
    "\uc790\uc7ac \ud1b5\ud569\uad00\ub9ac": "/materials",
    "\uc790\uc7ac \ub9c8\uc2a4\ud130": "/materials/master",
    "\uc785\uace0 \ub4f1\ub85d": "/materials/inbound",
    "\ucd9c\uace0 \ub4f1\ub85d": "/materials/outbound",
    "\uc785\ucd9c\uace0 \ub0b4\uc5ed": "/materials/transactions",
    "\uc7ac\uace0 \ud604\ud669": "/materials/inventory",
    "\ud604\uc7a5\ubcc4 \uc7ac\uace0": "/materials/inventory-by-site",





    "\uba85\uc138\uc11c": "/payroll/payslip",
    "\uc138\uae08/\uac00\ubd88 \ud300\uc7a5\ubcc4 \uba85\uc138\uc11c": "/payroll/team-payslip",
    "\ud300\uc7a5\ubcc4 \uba85\uc138\uc11c": "/payroll/team-payslip",

    "\uc77c\uae09\uc81c \uc9c0\uae09": "/payroll/wage-payment?tab=daily",

    "\uc6d4\uae09\uc81c \uc9c0\uae09": "/payroll/monthly-wage-payment",

    "\ud300\ubcc4 \uc9c0\uae09(\ucd08\uc548)": "/payroll/team-payment-draft",

    "\ud300 \ubc30\uc815": "/assignment/team-assignment",
    "\ud604\uc7a5 \ubc30\uc815": "/assignment/site-assignment",
    "\ud604\uc7a5 \uc77c\uc815 \uad00\ub9ac": "/assignment/field-schedule",
    "\ud604\uc7a5 \uc77c\uc815 \ub4f1\ub85d": "/assignment/field-schedule",
    "\ud300\ubcc4 \ud604\uc7a5 \uc77c\uc815": "/assignment/field-schedule",
    "\ubc30\ucc28 \uc77c\uc815 \ubcf4\ub4dc": "/assignment/field-schedule",

    "\uc9c1\ucc45 \ubc30\uc815": "/hr/position-assignment",
    "\ub2e8\uac00 \ubcc0\uacbd": "/hr/rate-change",


    "\uc2dc\uc2a4\ud15c \uc124\uc815": "/settings",
    "AI \uc124\uc815": "/settings/ai",
    "\uc2dc\uc2a4\ud15c \uba54\uc2dc\uc9c0 \uc124\uc815": "/settings/system-messages",
    "\ud1b5\ud569DB": "/database/manpower-db",
    "\ud1b5\ud569DB(\uc0c8\ucc3d)": "/database/manpower-db?newTab=1",
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
    "\ubc95\uc778\uce74\ub4dc \uad00\ub9ac": "/support/cards",
    "\uacbd\ube44\ub0b4\uc5ed": "/support/expense-ledger",
    "\uacbd\ube44 \ub0b4\uc5ed": "/support/expense-ledger",
    "후청구 입력": "/support/expense-claims",
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
    "\ud68c\uc0ac\uc18c\uac1c": "/dashboard2", // Canonical company intro landing route
    "\ud68c\uc0ac\uc774\ub150": "/cheongyeon/philosophy",
    "\ud68c\uc0ac \uc774\ub150": "/cheongyeon/philosophy",
    "\uc0ac\uc5c5\uc774\ub150": "/cheongyeon/philosophy",
    "\uc0ac\uc5c5 \uc774\ub150": "/cheongyeon/philosophy",
    "\uae30\uc5c5\uc774\ub150": "/cheongyeon/philosophy",
    "\uae30\uc5c5 \uc774\ub150": "/cheongyeon/philosophy",
    "\uc778\uc0ac\ub9d0": "/cheongyeon/greeting",
    "\ub300\ud45c \uc778\uc0ac\ub9d0": "/cheongyeon/greeting", // New alias
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
    "\uad8c\ud55c \uad00\ub9ac": "/admin/role-menu",
    "\uc2dc\uc2a4\ud15c \uad8c\ud55c \uad00\ub9ac": "/admin/role-menu", // Alias
    "\uce74\uce74\uc624\ud1a1 \uad00\ub9ac": "/payroll/kakao-notification",
    "\uce74\uce74\uc624\ud1a1 \uc5f0\ub3d9 \uc124\uc815": "/payroll/barobill-kakao-connection",
    "\uc0ac\uc6a9\uc790 \uad8c\ud55c \uc124\uc815": "/settings", // Alias for Settings where User Management lives
    // Refine Integrated Console
    "\uc791\uc5c5\uc790 \ucf58\uc194": "/manpower/refine-workers",
    "\ud300 \ucf58\uc194": "/manpower/refine-teams",
    "\ud604\uc7a5 \ucf58\uc194": "/manpower/refine-sites",
    "\ud68c\uc0ac \ucf58\uc194": "/manpower/refine-companies",
    "\ud1b5\ud569 \ub370\uc774\ud130 \ucf58\uc194": "/manpower/refine-sites", // Alias
    "\uc815\uc0b0 \uc2dc\uc2a4\ud15c \uc124\uacc4\ub3c4": "/design/settlement-architecture",
    "\uc2a4\ub9c8\ud2b8 \uba54\ubaa8": "/memos", // Smart Memo System
    "Smart Memo": "/memos",
    "\ud604\uc7a5 \uac24\ub7ec\ub9ac": "/gallery/projects",
    "\ud504\ub85c\uc81d\ud2b8": "/gallery/projects", // Alias
    "AI \uc774\ubbf8\uc9c0 \uc2a4\ud29c\ub514\uc624": "/gallery/ai-images",
    "\uc774\ubbf8\uc9c0 \uac24\ub7ec\ub9ac": "/gallery/ai-images", // Alias
    "\ud604\uc7a5 \uad00\ub9ac \uc2dc\uc2a4\ud15c": "/site/management",
    "\ub9c8\uac10 \ud604\uc7a5 \uad00\ub9ac": "/site/management/closed",
    "\ub9c8\uac10\ud604\uc7a5\uad00\ub9ac": "/site/management/closed",
    "\ud604\uc7a5 \uad00\ub9ac(\ub9c8\uac10)": "/site/management/closed",
    "\ud68c\uc0ac \ub79c\ub529 \ud398\uc774\uc9c0": "/company/landing",
    "\ud68c\uc0ac\uc18c\uac1c \ub79c\ub529": "/company/landing",
    "\uc0c1\uc138 \uacac\uc801\uc11c": "/estimate/detail-manage",
    "\uc0c1\uc138\uacac\uc801\uc11c": "/estimate/detail-manage",
};
