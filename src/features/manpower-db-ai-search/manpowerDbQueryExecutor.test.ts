import { parseManpowerDbQuestion } from './manpowerDbQueryParser';
import { buildManpowerDbQueryPlan } from './manpowerDbQueryPlanner';
import { executeManpowerDbPlan } from './manpowerDbQueryExecutor';
import { createManpowerDbSearchFixture, MANPOWER_DB_TEST_TODAY } from './manpowerDbTestFixtures';

describe('manpowerDbQueryExecutor', () => {
    it('executes planner steps and keeps deterministic refs', () => {
        const snapshot = createManpowerDbSearchFixture();
        const query = parseManpowerDbQuestion('과천 현장 최근 30일 계좌 없는 작업자', MANPOWER_DB_TEST_TODAY);
        const plan = buildManpowerDbQueryPlan('과천 현장 최근 30일 계좌 없는 작업자', query);
        const execution = executeManpowerDbPlan(plan, snapshot, query);

        expect(execution.plan.length).toBeGreaterThan(0);
        expect(execution.refs.map((ref) => ref.name)).toContain('이영희');
    });
});
