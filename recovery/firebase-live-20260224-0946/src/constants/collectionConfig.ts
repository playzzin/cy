export type SystemCollectionSource = 'dataconnect' | 'firestore';

export interface SystemCollectionConfig {
    id: string;
    label: string;
    description: string;
    source: SystemCollectionSource;
}

export const SYSTEM_COLLECTIONS: SystemCollectionConfig[] = [
    // Core Manpower
    { id: 'companies', label: '회사 (Companies)', description: '협력업체 및 소속사 정보', source: 'dataconnect' },
    { id: 'teams', label: '팀 (Teams)', description: '작업 팀 및 리더 정보', source: 'dataconnect' },
    { id: 'workers', label: '작업자 (Workers)', description: '등록된 건설 작업자 명부', source: 'dataconnect' },
    { id: 'app_users', label: '앱 사용자 (App Users)', description: '시스템 접속 사용자 계정', source: 'dataconnect' },

    // Process & Site
    { id: 'sites', label: '현장 (Sites)', description: '공사 현장 및 배정 정보', source: 'dataconnect' },
    { id: 'daily_dispatches', label: '일일 배차 (Dispatches)', description: '일일 작업자 배차 정보', source: 'dataconnect' },
    { id: 'daily_reports', label: '작업일보 (Daily Reports)', description: '매일 작성된 출력/공수 일보', source: 'dataconnect' },
    { id: 'daily_report_workers', label: '일보 상세 (Report Utils)', description: '작업일보 내 작업자별 공수 상세', source: 'dataconnect' },

    // Finance & Settlement
    { id: 'tax_invoices', label: '세금계산서 (Invoices)', description: '매입/매출 세금계산서', source: 'dataconnect' },
    { id: 'payments', label: '입출금 (Payments)', description: '통장 입출금 내역', source: 'dataconnect' },
    { id: 'receivables', label: '미수금 (Receivables)', description: '미수금 현황 관리', source: 'dataconnect' },
    { id: 'advance_payments', label: '가불/공제 (Advance Pay)', description: '작업자 가불 및 공제 내역', source: 'dataconnect' },

    // Asset: Vehicle
    { id: 'vehicles', label: '차량 (Vehicles)', description: '보유 차량 관리', source: 'dataconnect' },
    { id: 'vehicle_assignments', label: '차량 배정 (V-Assign)', description: '차량 운행/배정 기록', source: 'dataconnect' },
    { id: 'vehicle_expenses', label: '차량 지출 (V-Expense)', description: '주유비, 수리비 등 차량 지출', source: 'dataconnect' },
    { id: 'vehicle_billing_documents', label: '차량 청구서 (V-Bills)', description: '월별 차량 비용 청구서', source: 'dataconnect' },

    // Asset: Accommodation
    { id: 'accommodations', label: '숙소 (Accommodations)', description: '작업자 숙소 정보', source: 'dataconnect' },
    { id: 'utility_records', label: '공과금 (Utilities)', description: '숙소 공과금 납부 내역', source: 'dataconnect' },
    { id: 'accommodation_assignments', label: '숙소 배정 (A-Assign)', description: '숙소 입퇴실 기록', source: 'dataconnect' },
    { id: 'accommodation_billing_documents', label: '숙소 청구서 (A-Bills)', description: '월별 숙소비 청구서', source: 'dataconnect' },
    { id: 'accommodation_billing_line_items', label: '숙소 청구 항목 (A-Lines)', description: '숙소 청구서 상세 항목', source: 'dataconnect' },

    // System & Config
    { id: 'positions', label: '직책 (Positions)', description: '직책 및 시스템 권한 설정', source: 'dataconnect' },
    { id: 'menus', label: '메뉴 (Menus)', description: '사이드바 메뉴 구조 및 설정', source: 'firestore' },
    { id: 'menu_configs', label: '메뉴 설정 (Menu Configs)', description: '동적 메뉴 설정 데이터', source: 'dataconnect' },
    { id: 'settings', label: '환경 설정 (Settings)', description: '전역 시스템 설정', source: 'dataconnect' },
    { id: 'system_configs', label: '시스템 구성 (Sys Configs)', description: '시스템 내부 구성 데이터', source: 'dataconnect' },

    // Tools & Logs
    { id: 'smart_memos', label: '스마트 메모 (Memos)', description: '사용자 메모 데이터', source: 'dataconnect' },
    { id: 'smart_memo_categories', label: '메모 카테고리 (Memo Cats)', description: '메모 카테고리 분류', source: 'dataconnect' },
    { id: 'agents', label: 'AI 에이전트 (Agents)', description: '등록된 AI 에이전트 정보', source: 'dataconnect' },
    { id: 'agent_conversations', label: '대화 기록 (Conversations)', description: 'AI 에이전트와의 대화 기록', source: 'dataconnect' },
    { id: 'system_logs', label: '시스템 로그 (Sys Logs)', description: '시스템 오류 및 디버그 로그', source: 'dataconnect' },
    { id: 'audit_logs', label: '감사 로그 (Audit Logs)', description: '사용자 중요 활동 이력', source: 'dataconnect' },
];
