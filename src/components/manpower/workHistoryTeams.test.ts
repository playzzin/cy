import type { DailyReportWorkerRow } from '../../services/dailyReportService';
import { getContrastRatio } from '../../utils/color';
import { groupWorkTeams, recordedWorkTeam, workTeamStyle } from './workHistoryTeams';

const row = { workerTeamId: 'old-a', workerTeamName: '가람팀', responsibleTeamId: 'a', responsibleTeamName: '가람팀',
    isSiteSupport: true, workerId: 'one', manDay: 0.25 } as DailyReportWorkerRow;
const teams = [{ id: 'a', legacyId: 'old-a', name: '가람팀', color: '#ffffff' }];

test('일보의 같은 팀 ID와 이전 ID는 현재 명단의 지원 표시와 분리해 하나로 묶는다', () => {
    expect(recordedWorkTeam(row, teams).support).toBe(false);
    const groups = groupWorkTeams([row, { ...row, workerTeamId: 'a', manDay: 0.5, isSiteSupport: false }], teams);
    expect(groups).toHaveLength(1);
    expect(groups[0].manDay).toBe(0.75);
    expect(groups[0].workers.size).toBe(1);
    expect(row.isSiteSupport).toBe(true);
});

test('이름이 같아도 서로 다른 ID는 같은 팀으로 합치지 않는다', () => {
    expect(recordedWorkTeam({ ...row, workerTeamId: 'other' }, teams).support).toBe(true);
    expect(groupWorkTeams([row, { ...row, workerTeamId: 'other' }], teams)).toHaveLength(2);
});

test('ID가 없는 이전 일보는 저장된 팀명으로 구분하고 소속 미확인은 서버 표시를 보존한다', () => {
    expect(recordedWorkTeam({ ...row, workerTeamId: undefined }, teams).support).toBe(false);
    expect(recordedWorkTeam({ ...row, workerTeamId: undefined, workerTeamName: undefined }, []).support).toBe(true);
});

test('등록된 팀 색상을 적용하고 밝은 색의 텍스트 대비와 미등록 팀의 색상 일관성을 보장한다', () => {
    const team = recordedWorkTeam(row, teams);
    expect(team.color).toBe('#ffffff');
    expect(getContrastRatio(workTeamStyle(team.color)['--work-team-text'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
    const unknown = { ...row, workerTeamId: 'new-team' };
    expect(recordedWorkTeam(unknown).color).toBe(recordedWorkTeam({ ...unknown, date: '2027-01-01' }).color);
    expect(recordedWorkTeam(row, [{ ...teams[0], color: 'invalid' }]).color).toMatch(/^#[0-9a-f]{6}$/);
});

test('팀 목록에 없는 지원팀도 서버가 전달한 통합 DB 색상을 사용하고 미확인 색상은 중립색으로 표시한다', () => {
    const support = { ...row, workerTeamId: 'support', workerTeamColorHex: '#d96cbd' };
    expect(recordedWorkTeam(support, teams).color).toBe('#d96cbd');
    expect(recordedWorkTeam({ ...support, workerTeamColorHex: undefined }, teams).color).toBe('#64748b');
    expect(recordedWorkTeam({ ...support, workerTeamColorHex: 'invalid' }, teams).color).toBe('#64748b');
    expect(recordedWorkTeam({ ...row, workerTeamColorHex: '#d96cbd' }, teams).color).toBe('#ffffff');
});
