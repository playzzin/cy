import {
    ManpowerDbSearchDateRange,
    ManpowerDbSearchQuery,
} from './manpowerDbSearchTypes';
import { normalizeQuestionText } from './manpowerDbSynonyms';

const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const compact = (value: string): string => value.replace(/\s+/g, '').toLowerCase();

const cleanKeyword = (value: string): string => value
    .replace(/["'“”‘’]/g, '')
    .replace(/정보|보여줘|알려줘|조회|검색|목록|리스트/g, '')
    .replace(/소속|작업자|사람|근로자|인력|현장|담당팀|최근|투입|팀|회사|포함된|포함/g, '')
    .replace(/계좌|없는|미등록|누락|중/g, '')
    .trim();

const extractQuotedKeyword = (question: string): string | undefined => {
    const match = question.match(/["'“”‘’]([^"'“”‘’]+)["'“”‘’]/);
    return match?.[1]?.trim() || undefined;
};

const extractBefore = (question: string, marker: string): string | undefined => {
    const index = question.indexOf(marker);
    if (index < 0) return undefined;
    return cleanKeyword(question.slice(0, index));
};

const extractKeyword = (question: string): string | undefined => {
    const quoted = extractQuotedKeyword(question);
    if (quoted) return quoted;

    const beforeInclude = extractBefore(question, '포함');
    if (beforeInclude) return beforeInclude;

    const beforeBelongs = extractBefore(question, '소속');
    if (beforeBelongs) return beforeBelongs;

    const beforeSite = extractBefore(question, '현장');
    if (beforeSite) return beforeSite;

    const cleaned = cleanKeyword(question);
    return cleaned || undefined;
};

const thisMonthRange = (today: Date): ManpowerDbSearchDateRange => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { startDate: formatDateKey(start), endDate: formatDateKey(end) };
};

const previousMonthRange = (today: Date): ManpowerDbSearchDateRange => {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: formatDateKey(start), endDate: formatDateKey(end) };
};

const lastDaysRange = (today: Date, days: number): ManpowerDbSearchDateRange => {
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    return { startDate: formatDateKey(start), endDate: formatDateKey(today) };
};

const detectSupportDirection = (question: string): ManpowerDbSearchQuery['filters']['supportDirection'] => {
    const normalized = compact(question);
    if (normalized.includes('외부지원간곳')) return '외부지원간곳';
    if (normalized.includes('외부지원온곳')) return '외부지원온곳';
    if (normalized.includes('내부지원간곳')) return '내부지원간곳';
    if (normalized.includes('내부지원온곳')) return '내부지원온곳';

    const hasExternal = /외부|외부팀|타사|협력사|용역/.test(normalized);
    const hasInternal = /내부|내부팀|청연|우리팀|자사/.test(normalized);
    const hasIncoming = /온곳|들어온|받은|받는|지원받|온지원|들어오는/.test(normalized);
    const hasOutgoing = /간곳|나간|보낸|보내는|지원간|간지원|나가는/.test(normalized);

    if (hasExternal && hasIncoming) return '외부지원온곳';
    if (hasExternal && hasOutgoing) return '외부지원간곳';
    if (hasInternal && hasIncoming) return '내부지원온곳';
    if (hasInternal && hasOutgoing) return '내부지원간곳';
    return undefined;
};

const detectSupportScope = (question: string): ManpowerDbSearchQuery['filters']['supportScope'] => {
    const normalized = compact(question);
    if (/외부|외부팀|타사|협력사|용역/.test(normalized)) return '외부';
    if (/내부|내부팀|청연|우리팀|자사/.test(normalized)) return '내부';
    return undefined;
};

const detectSupportFlowType = (question: string): ManpowerDbSearchQuery['filters']['supportFlowType'] => {
    const normalized = compact(question);
    if (/온곳|들어온|받은|받는|지원받|온지원|들어오는/.test(normalized)) return '온곳';
    if (/간곳|나간|보낸|보내는|지원간|간지원|나가는/.test(normalized)) return '간곳';
    return undefined;
};

const detectDateRange = (question: string, today: Date): ManpowerDbSearchDateRange | undefined => {
    const normalized = compact(question);
    if (normalized.includes('최근7일')) return lastDaysRange(today, 7);
    if (normalized.includes('최근30일')) return lastDaysRange(today, 30);
    if (normalized.includes('이번달') || normalized.includes('이번월')) return thisMonthRange(today);
    return undefined;
};

const isSupportQuestion = (question: string): boolean => {
    const normalized = compact(question);
    return /지원|지원팀|용역|외부팀|내부팀|온곳|간곳|지원받|지원간|나간지원|들어온지원/.test(normalized);
};

export const MANPOWER_DB_EXAMPLE_QUESTIONS: Array<{ category: string; text: string }> = [
    { category: '작업자', text: '김철수 정보 보여줘' },
    { category: '팀', text: '1팀 소속 작업자' },
    { category: '계좌', text: '1팀 소속 작업자 중 계좌 없는 사람' },
    { category: '현장', text: '과천 현장 담당팀' },
    { category: '현장', text: '과천 현장 최근 투입 작업자' },
    { category: '무결성', text: '계좌 없는 작업자' },
    { category: '무결성', text: '담당팀 없는 진행중 현장' },
    { category: '일보 대조', text: '퇴사자인데 이번 달 일보에 나온 사람' },
    { category: '회사', text: '현대 포함된 회사' },
    { category: '회사', text: '청연 소속 팀' },
    { category: '지원', text: '이번 달 외부팀 지원온곳' },
    { category: '지원', text: '이번 달 내부팀 지원간곳' },
    { category: '복합검색', text: '과천 현장 최근 30일 계좌 없는 작업자' },
    { category: '분석', text: '지난달보다 투입 급증한 팀' },
];

export const parseManpowerDbQuestion = (
    rawQuestion: string,
    today = new Date()
): ManpowerDbSearchQuery => {
    const question = rawQuestion.trim();
    const normalized = compact(question);
    const synonymNormalized = normalizeQuestionText(question);
    const keyword = extractKeyword(question);
    const hasMissingAccount = normalized.includes('계좌') && (
        normalized.includes('없는') || normalized.includes('누락') || normalized.includes('미등록')
    );

    if (normalized.includes('현장') && normalized.includes('최근30일') && hasMissingAccount && (
        normalized.includes('작업자') || normalized.includes('근로자') || normalized.includes('사람')
    )) {
        return {
            domain: 'manpower_db',
            entity: 'worker',
            intent: 'recent_activity',
            filters: {
                siteName: extractBefore(question, '현장') || keyword,
                missingFields: ['accountNumber'],
                dateRange: lastDaysRange(today, 30),
            },
        };
    }

    if ((normalized.includes('이번달') || normalized.includes('이번월')) && hasMissingAccount && synonymNormalized.includes('출역')) {
        return {
            domain: 'manpower_db',
            entity: 'worker',
            intent: 'recent_activity',
            filters: {
                missingFields: ['accountNumber'],
                dateRange: thisMonthRange(today),
            },
        };
    }

    if (normalized.includes('담당팀없는') && normalized.includes('현장') && normalized.includes('일보') && (normalized.includes('이번달') || normalized.includes('이번월'))) {
        return {
            domain: 'manpower_db',
            entity: 'site',
            intent: 'data_quality',
            filters: {
                status: 'active',
                missingFields: ['responsibleTeamId', 'responsibleTeamName'],
                dateRange: thisMonthRange(today),
            },
        };
    }

    if (normalized.includes('지난달보다') && synonymNormalized.includes('출역') && normalized.includes('팀') &&
        (synonymNormalized.includes('급증') || synonymNormalized.includes('감소'))) {
        const decreasing = synonymNormalized.includes('감소');
        return {
            domain: 'manpower_db',
            entity: 'team',
            intent: 'comparison',
            filters: {
                status: decreasing ? 'decrease' : 'increase',
                dateRange: thisMonthRange(today),
                compareDateRange: previousMonthRange(today),
            },
            sort: { field: 'diff', direction: decreasing ? 'asc' : 'desc' },
        };
    }

    if (normalized.includes('퇴사') && normalized.includes('최근7일') && synonymNormalized.includes('출역')) {
        return {
            domain: 'manpower_db',
            entity: 'integrity',
            intent: 'data_quality',
            filters: { status: '퇴사', dateRange: lastDaysRange(today, 7) },
        };
    }

    if (normalized.includes('관련현장') && normalized.includes('담당팀')) {
        return {
            domain: 'manpower_db',
            entity: 'site',
            intent: 'relation',
            filters: { companyName: extractBefore(question, '관련') || keyword },
        };
    }

    if (normalized.includes('소속팀') && hasMissingAccount) {
        return {
            domain: 'manpower_db',
            entity: 'team',
            intent: 'missing_field',
            filters: {
                companyName: extractBefore(question, '소속') || keyword,
                missingFields: ['accountNumber'],
            },
        };
    }

    if (hasMissingAccount) {
        if (normalized.includes('팀') && !normalized.includes('작업자') && !normalized.includes('사람') && !normalized.includes('근로자')) {
            return {
                domain: 'manpower_db',
                entity: 'team',
                intent: 'missing_field',
                filters: { missingFields: ['accountNumber'] },
            };
        }

        if (normalized.includes('회사')) {
            return {
                domain: 'manpower_db',
                entity: 'company',
                intent: 'missing_field',
                filters: { missingFields: ['accountNumber'] },
            };
        }

        return {
            domain: 'manpower_db',
            entity: 'worker',
            intent: 'missing_field',
            filters: {
                teamName: normalized.includes('팀') ? extractBefore(question, '소속') || keyword : undefined,
                missingFields: ['accountNumber'],
            },
        };
    }

    if (isSupportQuestion(question)) {
        const supportDirection = detectSupportDirection(question);
        const supportScope = detectSupportScope(question);
        const supportFlowType = detectSupportFlowType(question);
        const dateRange = detectDateRange(question, today) || thisMonthRange(today);
        const siteName = normalized.includes('현장') ? extractBefore(question, '현장') || undefined : undefined;
        const teamName = normalized.includes('팀') && !normalized.includes('외부팀') && !normalized.includes('내부팀')
            ? extractBefore(question, '지원') || keyword
            : undefined;

        return {
            domain: 'manpower_db',
            entity: 'support',
            intent: 'relation',
            filters: {
                keyword: teamName || siteName ? keyword : undefined,
                siteName,
                teamName,
                supportDirection,
                supportScope,
                supportFlowType,
                dateRange,
            },
            confidence: supportDirection || supportFlowType || supportScope ? 0.9 : 0.78,
            clarificationNeeded: !supportDirection && !supportFlowType && !supportScope,
        };
    }

    if (normalized.includes('미배정') && (normalized.includes('작업자') || normalized.includes('근로자') || normalized.includes('인력'))) {
        return {
            domain: 'manpower_db',
            entity: 'worker',
            intent: 'missing_field',
            filters: { missingFields: ['teamId', 'teamName'] },
        };
    }

    if (normalized.includes('담당팀없는') && (normalized.includes('진행중') || normalized.includes('active')) && normalized.includes('현장')) {
        return {
            domain: 'manpower_db',
            entity: 'site',
            intent: 'missing_field',
            filters: { status: 'active', missingFields: ['responsibleTeamId', 'responsibleTeamName'] },
        };
    }

    if (normalized.includes('최근30일') && (normalized.includes('출역없는') || normalized.includes('투입없는')) && normalized.includes('재직자')) {
        return {
            domain: 'manpower_db',
            entity: 'integrity',
            intent: 'recent_activity',
            filters: { status: '재직', dateRange: lastDaysRange(today, 30) },
        };
    }

    if (normalized.includes('퇴사자') && normalized.includes('일보') && (normalized.includes('이번달') || normalized.includes('이번월'))) {
        return {
            domain: 'manpower_db',
            entity: 'integrity',
            intent: 'data_quality',
            filters: { status: '퇴사', dateRange: thisMonthRange(today) },
        };
    }

    if (normalized.includes('현장') && normalized.includes('담당팀')) {
        return {
            domain: 'manpower_db',
            entity: 'site',
            intent: 'relation',
            filters: { siteName: extractBefore(question, '현장') || keyword },
        };
    }

    if (normalized.includes('현장') && normalized.includes('최근') && (normalized.includes('투입작업자') || normalized.includes('작업자'))) {
        return {
            domain: 'manpower_db',
            entity: 'site',
            intent: 'recent_activity',
            filters: { siteName: extractBefore(question, '현장') || keyword, dateRange: lastDaysRange(today, 30) },
        };
    }

    if (normalized.includes('포함') && normalized.includes('회사')) {
        return {
            domain: 'manpower_db',
            entity: 'company',
            intent: 'lookup',
            filters: { keyword },
        };
    }

    if (normalized.includes('소속팀')) {
        return {
            domain: 'manpower_db',
            entity: 'team',
            intent: 'relation',
            filters: { companyName: extractBefore(question, '소속') || keyword },
        };
    }

    if (normalized.includes('소속작업자') || normalized.includes('소속근로자') || normalized.includes('소속인력')) {
        return {
            domain: 'manpower_db',
            entity: 'worker',
            intent: 'list',
            filters: { teamName: extractBefore(question, '소속') || keyword },
        };
    }

    if (normalized.includes('팀') && (normalized.includes('작업자') || normalized.includes('근로자') || normalized.includes('인력'))) {
        return {
            domain: 'manpower_db',
            entity: 'worker',
            intent: 'list',
            filters: { teamName: keyword },
        };
    }

    if (normalized.includes('회사')) {
        return {
            domain: 'manpower_db',
            entity: 'company',
            intent: 'lookup',
            filters: { keyword },
        };
    }

    if (normalized.includes('현장')) {
        return {
            domain: 'manpower_db',
            entity: 'site',
            intent: 'lookup',
            filters: { siteName: keyword },
        };
    }

    if (normalized.includes('팀')) {
        return {
            domain: 'manpower_db',
            entity: 'team',
            intent: 'lookup',
            filters: { teamName: keyword },
        };
    }

    return {
        domain: 'manpower_db',
        entity: 'worker',
        intent: 'lookup',
        filters: { name: keyword || question },
    };
};

export const shouldUseManpowerDbSearch = (question: string): boolean => {
    const normalized = compact(question);
    return [
        '작업자',
        '근로자',
        '인력',
        '재직자',
        '퇴사자',
        '미배정',
        '담당팀',
        '계좌',
        '현장',
        '회사',
        '소속',
        '일보에나온',
        '최근30일',
        '투입작업자',
        '지난달보다',
        '급증',
        '감소',
        '줄어든',
        '관련현장',
        '지원',
        '지원팀',
        '용역',
        '외부팀',
        '내부팀',
        '온곳',
        '간곳',
    ].some((token) => normalized.includes(token));
};
