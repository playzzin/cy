// 프로젝트 파일 정보
export interface FileInfo {
    id: string;
    name: string;
    path: string;
    category: 'page' | 'component' | 'service' | 'hook' | 'util';
    description?: string;
    tags?: string[];
    lastModified?: string;
    lines?: number;
}

export const projectFiles: FileInfo[] = [
    // Pages - Report
    {
        id: 'daily-report-list',
        name: 'DailyReportList.tsx',
        path: 'src/pages/report/DailyReportList.tsx',
        category: 'page',
        description: '일보 목록 조회 및 필터링',
        tags: ['일보', '리스트', '필터'],
        lines: 484
    },
    {
        id: 'daily-report-grid',
        name: 'DailyReportGridInput.tsx',
        path: 'src/pages/report/DailyReportGridInput.tsx',
        category: 'page',
        description: '일보 작성 및 수정 (Handsontable)',
        tags: ['일보', '입력', 'Handsontable'],
        lines: 1046
    },

    // Pages - Database
    {
        id: 'worker-database',
        name: 'WorkerDatabase.tsx',
        path: 'src/pages/database/WorkerDatabase.tsx',
        category: 'page',
        description: '작업자 등록 및 관리',
        tags: ['작업자', 'DB', '관리'],
        lines: 650
    },
    {
        id: 'team-database',
        name: 'TeamDatabase.tsx',
        path: 'src/pages/database/TeamDatabase.tsx',
        category: 'page',
        description: '팀 등록 및 관리',
        tags: ['팀', 'DB', '관리'],
        lines: 520
    },
    {
        id: 'site-database',
        name: 'SiteDatabase.tsx',
        path: 'src/pages/database/SiteDatabase.tsx',
        category: 'page',
        description: '현장 등록 및 관리',
        tags: ['현장', 'DB', '관리'],
        lines: 757
    },
    {
        id: 'company-database',
        name: 'CompanyDatabase.tsx',
        path: 'src/pages/database/CompanyDatabase.tsx',
        category: 'page',
        description: '회사 등록 및 관리',
        tags: ['회사', 'DB', '관리'],
        lines: 450
    },

    // Services
    {
        id: 'daily-report-service',
        name: 'dailyReportService.ts',
        path: 'src/services/dailyReportService.ts',
        category: 'service',
        description: 'Firebase 일보 데이터 CRUD',
        tags: ['일보', 'Firebase', 'CRUD'],
        lines: 800
    },
    {
        id: 'manpower-service',
        name: 'manpowerService.ts',
        path: 'src/services/manpowerService.ts',
        category: 'service',
        description: 'Firebase 작업자 데이터 관리',
        tags: ['작업자', 'Firebase'],
        lines: 350
    },
    {
        id: 'team-service',
        name: 'teamService.ts',
        path: 'src/services/teamService.ts',
        category: 'service',
        description: 'Firebase 팀 데이터 관리',
        tags: ['팀', 'Firebase'],
        lines: 200
    },
    {
        id: 'site-service',
        name: 'siteService.ts',
        path: 'src/services/siteService.ts',
        category: 'service',
        description: 'Firebase 현장 데이터 관리',
        tags: ['현장', 'Firebase'],
        lines: 250
    },
    {
        id: 'company-service',
        name: 'companyService.ts',
        path: 'src/services/companyService.ts',
        category: 'service',
        description: 'Firebase 회사 데이터 관리',
        tags: ['회사', 'Firebase'],
        lines: 200
    },

    // Components - Layout
    {
        id: 'bottom-panel',
        name: 'BottomPanel.tsx',
        path: 'src/components/layout/BottomPanel.tsx',
        category: 'component',
        description: '하단 슬라이드 패널 (빠른등록)',
        tags: ['레이아웃', '패널'],
        lines: 180
    },

    // Hooks
    {
        id: 'use-master-data',
        name: 'useMasterData.tsx',
        path: 'src/contexts/MasterDataContext.tsx',
        category: 'hook',
        description: '마스터 데이터 Context (teams, sites, workers 등)',
        tags: ['Context', '마스터데이터'],
        lines: 150
    }
];

// 카테고리별 필터링 헬퍼
export const getFilesByCategory = (category: FileInfo['category']) => {
    return projectFiles.filter(file => file.category === category);
};

// 태그로 검색
export const searchByTag = (tag: string) => {
    return projectFiles.filter(file =>
        file.tags?.some(t => t.toLowerCase().includes(tag.toLowerCase()))
    );
};

// 이름으로 검색
export const searchByName = (query: string) => {
    return projectFiles.filter(file =>
        file.name.toLowerCase().includes(query.toLowerCase()) ||
        file.description?.toLowerCase().includes(query.toLowerCase())
    );
};
