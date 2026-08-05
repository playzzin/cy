import { buildManpowerDbSupportFlows } from './manpowerDbAnalysisEngine';
import { searchManpowerDbSnapshot } from './manpowerDbAiSearch';
import { parseManpowerDbQuestion } from './manpowerDbQueryParser';
import { createManpowerDbSearchFixture, MANPOWER_DB_TEST_TODAY } from './manpowerDbTestFixtures';

describe('manpower DB support flow analysis', () => {
    it('parses external incoming and internal outgoing support questions', () => {
        const externalIncoming = parseManpowerDbQuestion('이번 달 외부팀 지원온곳', MANPOWER_DB_TEST_TODAY);
        const internalOutgoing = parseManpowerDbQuestion('이번 달 내부팀 지원간곳', MANPOWER_DB_TEST_TODAY);

        expect(externalIncoming.entity).toBe('support');
        expect(externalIncoming.filters.supportDirection).toBe('외부지원온곳');
        expect(externalIncoming.filters.supportScope).toBe('외부');
        expect(externalIncoming.filters.supportFlowType).toBe('온곳');

        expect(internalOutgoing.entity).toBe('support');
        expect(internalOutgoing.filters.supportDirection).toBe('내부지원간곳');
        expect(internalOutgoing.filters.supportScope).toBe('내부');
        expect(internalOutgoing.filters.supportFlowType).toBe('간곳');
    });

    it('builds deterministic support flow rows from daily reports', () => {
        const snapshot = createManpowerDbSearchFixture();
        const externalIncoming = buildManpowerDbSupportFlows(snapshot, {
            supportDirection: '외부지원온곳',
            dateRange: { startDate: '2026-07-01', endDate: '2026-07-31' },
        });
        const internalOutgoing = buildManpowerDbSupportFlows(snapshot, {
            supportDirection: '내부지원간곳',
            dateRange: { startDate: '2026-07-01', endDate: '2026-07-31' },
        });

        expect(externalIncoming.map((flow) => flow.direction)).toContain('외부지원온곳');
        expect(externalIncoming.map((flow) => flow.supportOutTeamName)).toContain('2팀');
        expect(externalIncoming.map((flow) => flow.supportInTeamName)).toContain('1팀');

        expect(internalOutgoing.map((flow) => flow.direction)).toContain('내부지원간곳');
        expect(internalOutgoing.map((flow) => flow.supportOutTeamName)).toContain('청연특수팀');
        expect(internalOutgoing.map((flow) => flow.supportInTeamName)).toContain('1팀');
    });

    it('returns structured UI results for support questions', () => {
        const result = searchManpowerDbSnapshot('이번 달 외부팀 지원온곳', createManpowerDbSearchFixture(), MANPOWER_DB_TEST_TODAY);

        expect(result.success).toBe(true);
        expect(result.resultType).toBe('support');
        expect(result.query.entity).toBe('support');
        expect(result.interpretation?.filters).toEqual(
            expect.arrayContaining([
                { label: '지원방향', value: '외부지원온곳' },
                { label: '지원범위', value: '외부' },
                { label: '지원흐름', value: '온곳' },
            ])
        );
        expect(result.plan?.map((step) => step.op)).toEqual(
            expect.arrayContaining(['classify_support_flows', 'filter_support_direction', 'aggregate_support_flows'])
        );
        expect(result.rows[0]).toEqual(expect.objectContaining({
            rowType: 'support',
            source: 'support',
            status: '외부지원온곳',
        }));
        expect(result.rows[0].fields.map((field) => field.label)).toEqual(
            expect.arrayContaining(['지원방향', '지원간 팀', '지원온 팀', '현장', '작업자', '공수'])
        );
        expect(result.related?.teams?.map((row) => row.name)).toEqual(expect.arrayContaining(['1팀', '2팀']));
        expect(result.actions?.map((action) => action.path)).toContain('/support/status');
        expect(result.followUpQuestions).toContain('이번 달 내부팀 지원간곳');
    });
});
