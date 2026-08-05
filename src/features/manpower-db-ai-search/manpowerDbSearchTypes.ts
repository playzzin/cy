export type ManpowerDbEntity =
    | 'worker'
    | 'team'
    | 'site'
    | 'company'
    | 'account'
    | 'integrity'
    | 'support'
    | 'mixed';

export type ManpowerDbIntent =
    | 'lookup'
    | 'list'
    | 'relation'
    | 'missing_field'
    | 'status'
    | 'recent_activity'
    | 'duplicate'
    | 'data_quality'
    | 'trend'
    | 'comparison';

export interface ManpowerDbSearchDateRange {
    startDate: string;
    endDate: string;
}

export interface ManpowerDbSearchFilters {
    keyword?: string;
    name?: string;
    teamName?: string;
    siteName?: string;
    companyName?: string;
    status?: string;
    missingFields?: string[];
    dateRange?: ManpowerDbSearchDateRange;
    compareDateRange?: ManpowerDbSearchDateRange;
    supportDirection?: '외부지원간곳' | '외부지원온곳' | '내부지원간곳' | '내부지원온곳';
    supportScope?: '외부' | '내부';
    supportFlowType?: '간곳' | '온곳';
}

export interface ManpowerDbSearchQuery {
    domain: 'manpower_db';
    entity: ManpowerDbEntity;
    intent: ManpowerDbIntent;
    filters: ManpowerDbSearchFilters;
    joins?: string[];
    sort?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    limit?: number;
    confidence?: number;
    clarificationNeeded?: boolean;
}

export type ManpowerDbSearchResultType =
    | 'worker_list'
    | 'team_list'
    | 'site_list'
    | 'company_list'
    | 'support'
    | 'mixed'
    | 'integrity';

export type ManpowerDbRowType = 'worker' | 'team' | 'site' | 'company' | 'support' | 'integrity';

export type ManpowerDbFieldTone = 'default' | 'muted' | 'success' | 'warning' | 'danger' | 'info';

export interface ManpowerDbSearchField {
    label: string;
    value: string;
    tone?: ManpowerDbFieldTone;
}

export interface ManpowerDbSearchRow {
    id: string;
    rowType: ManpowerDbRowType;
    name: string;
    status?: string;
    subtitle?: string;
    badges?: string[];
    fields: ManpowerDbSearchField[];
    path?: string;
    matchReason?: string;
    source?: 'master' | 'daily_report' | 'derived' | 'integrity' | 'support';
    confidence?: number;
    rawRef?: {
        entity: Exclude<ManpowerDbRowType, 'integrity'>;
        id: string;
    };
}

export interface ManpowerDbRelatedData {
    workers?: ManpowerDbSearchRow[];
    teams?: ManpowerDbSearchRow[];
    sites?: ManpowerDbSearchRow[];
    companies?: ManpowerDbSearchRow[];
}

export interface ManpowerDbSearchAction {
    label: string;
    path: string;
}

export interface ManpowerDbSearchResult {
    success: boolean;
    parsedQuestion: string;
    query: ManpowerDbSearchQuery;
    summary: string;
    resultType: ManpowerDbSearchResultType;
    rows: ManpowerDbSearchRow[];
    counts: {
        total: number;
        shown: number;
    };
    interpretation?: {
        entity: string;
        intent: string;
        confidence: number;
        filters: Array<{ label: string; value: string }>;
        clarificationNeeded?: boolean;
        candidates?: Array<{
            entity: string;
            id: string;
            name: string;
            score: number;
            matchReason: string;
        }>;
    };
    plan?: Array<{
        step: number;
        op: string;
        label: string;
        input?: string;
        outputCount?: number;
    }>;
    related?: ManpowerDbRelatedData;
    actions?: ManpowerDbSearchAction[];
    followUpQuestions?: string[];
    warnings?: string[];
    aiExplanation?: string;
}

export const MANPOWER_DB_TAB_PATHS = {
    workers: '/database/manpower-db?tab=workers',
    teams: '/database/manpower-db?tab=teams',
    sites: '/database/manpower-db?tab=sites',
    companies: '/database/manpower-db?tab=companies',
    accounts: '/database/manpower-db?tab=accounts',
} as const;
