import {
    ManpowerDbSearchQuery,
    ManpowerDbSearchResult,
} from './manpowerDbSearchTypes';
import { ManpowerDbEntityResolution } from './manpowerDbEntityResolver';
import { normalizeQuestionText } from './manpowerDbSynonyms';

export type ManpowerDbPlanStep = NonNullable<ManpowerDbSearchResult['plan']>[number];

const filterValue = (query: ManpowerDbSearchQuery): string | undefined =>
    query.filters.siteName ||
    query.filters.teamName ||
    query.filters.companyName ||
    query.filters.name ||
    query.filters.keyword;

export const buildManpowerDbQueryPlan = (
    question: string,
    query: ManpowerDbSearchQuery,
    resolution?: ManpowerDbEntityResolution
): ManpowerDbPlanStep[] => {
    const normalized = normalizeQuestionText(question);
    const steps: ManpowerDbPlanStep[] = [];
    const add = (op: string, label: string, input?: string) => {
        steps.push({ step: steps.length + 1, op, label, input });
    };

    const keyword = filterValue(query);
    if (keyword) {
        add('resolve_entity', `${keyword} 키워드 후보 해석`, keyword);
    }

    if (query.filters.dateRange) {
        add('filter_reports', `${query.filters.dateRange.startDate}~${query.filters.dateRange.endDate} 일보 필터`, `${query.filters.dateRange.startDate}~${query.filters.dateRange.endDate}`);
    }

    if (query.entity === 'site' && query.intent === 'missing_field') {
        add('filter_sites_without_responsible_team', '담당팀 없는 현장 필터');
    }

    if (query.entity === 'team' && query.intent === 'comparison') {
        add('aggregate_team_activity', '팀별 투입 공수 집계');
        add('compare_team_activity', normalized.includes('감소') ? '지난달 대비 투입 감소 팀 계산' : '지난달 대비 투입 증가 팀 계산');
    }

    if (query.entity === 'support') {
        add('classify_support_flows', '일보 작업자 기준 지원 방향 분류');
        if (query.filters.supportScope) {
            add('filter_support_scope', `${query.filters.supportScope} 지원 필터`, query.filters.supportScope);
        }
        if (query.filters.supportFlowType) {
            add('filter_support_flow_type', `${query.filters.supportFlowType} 지원 흐름 필터`, query.filters.supportFlowType);
        }
        if (query.filters.supportDirection) {
            add('filter_support_direction', `${query.filters.supportDirection} 필터`, query.filters.supportDirection);
        }
        add('aggregate_support_flows', '지원 흐름별 공수/금액 집계');
    }

    if (query.entity === 'site' && query.intent === 'relation') {
        add('join_site_relations', '현장 담당팀/회사 관계 조인');
    }

    if (query.entity === 'worker' && query.intent === 'recent_activity') {
        add('extract_workers_from_reports', '일보에서 투입 작업자 추출');
        add('join_workers_master', '작업자 마스터와 조인');
    }

    if (query.filters.missingFields?.length) {
        query.filters.missingFields.forEach((field) => {
            add('filter_missing_field', `${field} 누락 필터`, field);
        });
    }

    if (query.entity === 'integrity') {
        add('check_integrity', '마스터/일보 무결성 점검');
    }

    if (steps.length === 0) {
        add('search_master', '마스터 데이터 검색', keyword);
    }

    if (resolution?.candidates.length) {
        steps[0] = {
            ...steps[0],
            outputCount: resolution.candidates.length,
        };
    }

    return steps;
};
