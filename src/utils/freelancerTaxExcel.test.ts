import { buildFreelancerTaxExcelRows } from './freelancerTaxExcel';

const toFiniteAmount = (value: unknown) => Number(value) || 0;
const normalizeTeamId = (teamId?: string | null) => String(teamId ?? '');
const sortFreelancers = (left: any, right: any) => String(left.name).localeCompare(String(right.name), 'ko');

describe('buildFreelancerTaxExcelRows', () => {
    it('모든 팀을 한 파일에 포함하고 본표와 팀별 합계 정보를 분리한다', () => {
        const report = buildFreelancerTaxExcelRows({
            allRows: [
                { teamId: 'team-b', teamName: '나팀', name: '박민수', residentNumber: '9001011234567', m08: 200 },
                { teamId: 'team-a', teamName: '가팀', name: '김영희', residentNumber: '910202-2345678', m08: 100 },
                { teamId: 'team-a', teamName: '가팀', name: '제외', residentNumber: '', m08: 0 },
            ],
            selectedTeamId: 'team-a',
            currentTeamRows: [
                { teamId: 'team-a', teamName: '가팀', name: '김영희', residentNumber: '910202-2345678', m08: 150 },
                { teamId: 'team-a', teamName: '가팀', name: '이철수', residentNumber: '9203033456789', m08: 50 },
            ],
            monthKey: 'm08',
            normalizeTeamId,
            sortFreelancers,
            toFiniteAmount,
        });

        expect(report.detailRows).toEqual([
            [1, '김영희', '910202-2345678', 150],
            [2, '이철수', '920303-3456789', 50],
            [3, '박민수', '900101-1234567', 200],
        ]);
        expect(report.teamSummaries).toEqual([
            { teamName: '가팀', startIndex: 0, endIndex: 1, total: 200 },
            { teamName: '나팀', startIndex: 2, endIndex: 2, total: 200 },
        ]);
        expect(report.grandTotal).toBe(400);
    });
});
