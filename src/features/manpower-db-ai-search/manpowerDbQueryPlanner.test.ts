import { parseManpowerDbQuestion } from './manpowerDbQueryParser';
import { buildManpowerDbQueryPlan } from './manpowerDbQueryPlanner';
import { MANPOWER_DB_TEST_TODAY } from './manpowerDbTestFixtures';

describe('manpowerDbQueryPlanner', () => {
    it('creates a multi-step plan for site recent missing-account workers', () => {
        const question = '과천 현장 최근 30일 계좌 없는 작업자';
        const query = parseManpowerDbQuestion(question, MANPOWER_DB_TEST_TODAY);
        const plan = buildManpowerDbQueryPlan(question, query);

        expect(plan.map((step) => step.op)).toEqual(expect.arrayContaining([
            'resolve_entity',
            'filter_reports',
            'extract_workers_from_reports',
            'join_workers_master',
            'filter_missing_field',
        ]));
    });

    it('creates comparison plan for team activity deltas', () => {
        const question = '지난달보다 투입 급증한 팀';
        const query = parseManpowerDbQuestion(question, MANPOWER_DB_TEST_TODAY);
        const plan = buildManpowerDbQueryPlan(question, query);

        expect(query.intent).toBe('comparison');
        expect(plan.map((step) => step.op)).toContain('compare_team_activity');
    });
});
