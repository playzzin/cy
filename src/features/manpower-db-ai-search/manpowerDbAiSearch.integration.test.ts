import { parseManpowerDbQuestionHybrid } from './manpowerDbLlmParser';
import { createDeterministicManpowerDbExplanation } from './manpowerDbResultExplainer';
import { searchManpowerDbSnapshot } from './manpowerDbAiSearch';
import { createManpowerDbSearchFixture, MANPOWER_DB_TEST_TODAY } from './manpowerDbTestFixtures';

describe('manpowerDbAiSearch integration', () => {
    it('keeps advanced structured metadata for complex searches', () => {
        const result = searchManpowerDbSnapshot('과천 현장 최근 30일 계좌 없는 작업자', createManpowerDbSearchFixture(), MANPOWER_DB_TEST_TODAY);

        expect(result.success).toBe(true);
        expect(result.interpretation?.entity).toBe('worker');
        expect(result.plan?.map((step) => step.op)).toContain('filter_missing_field');
        expect(result.rows.map((row) => row.name)).toContain('이영희');
        expect(result.rows[0].matchReason).toBeTruthy();
        expect(result.rows[0].source).toBeTruthy();
        expect(typeof result.rows[0].confidence).toBe('number');
    });

    it('supports account-missing workers who appeared this month', () => {
        const result = searchManpowerDbSnapshot('이번 달 계좌 없는 사람 중 출역한 사람', createManpowerDbSearchFixture(), MANPOWER_DB_TEST_TODAY);

        expect(result.rows.map((row) => row.name)).toEqual(['이영희']);
        expect(result.resultType).toBe('worker_list');
    });

    it('supports sites without responsible team that have this month reports', () => {
        const result = searchManpowerDbSnapshot('담당팀 없는 현장 중 이번 달 일보 있는 현장', createManpowerDbSearchFixture(), MANPOWER_DB_TEST_TODAY);

        expect(result.rows.map((row) => row.name)).toEqual(['과천 B현장']);
        expect(result.resultType).toBe('integrity');
    });

    it('supports team activity comparison', () => {
        const result = searchManpowerDbSnapshot('지난달보다 투입 줄어든 팀', createManpowerDbSearchFixture(), MANPOWER_DB_TEST_TODAY);

        expect(result.resultType).toBe('team_list');
        expect(result.rows.map((row) => row.name)).toContain('2팀');
    });

    it('falls back to rule parser when Gemini parsing fails', async () => {
        const parsed = await parseManpowerDbQuestionHybrid('계좌 없는 작업자', MANPOWER_DB_TEST_TODAY, {
            apiKey: 'test-key',
            fetchImpl: (() => Promise.reject(new Error('network down'))) as any,
        });

        expect(parsed.source).toBe('rule');
        expect(parsed.query.filters.missingFields).toContain('accountNumber');
    });

    it('creates deterministic explanation without leaking sensitive identifiers', () => {
        const result = searchManpowerDbSnapshot('김철수 정보 보여줘', createManpowerDbSearchFixture(), MANPOWER_DB_TEST_TODAY);
        const explanation = createDeterministicManpowerDbExplanation(result);
        const serialized = JSON.stringify(result);

        expect(explanation).toContain('김철수');
        expect(serialized).not.toContain('900101-1234567');
    });
});
