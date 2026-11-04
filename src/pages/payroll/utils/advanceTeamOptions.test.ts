import type { Team } from '../../../services/teamService';
import { getAdvanceTeamOptions } from './advanceTeamOptions';

test('두 가불 화면은 시공사 팀만 이름순으로 선택하고 입력용 전체 목록에는 하위팀 참조를 유지한다', () => {
    const teams = [
        { id: 'b', name: '나팀', companyId: 'co', legacyId: 'old-b' },
        { id: 'a', name: '가팀', companyName: '검증   시공사 소속팀', color: '#225599' },
        { id: 'child', name: '하위팀', companyId: 'outside', companyName: '검증 시공사', parentTeamId: 'old-b', parentTeamName: '나팀' },
        { id: '', name: '연결 불가', companyId: 'co' },
    ] as Team[];
    const { all, selectable } = getAdvanceTeamOptions(teams, [{ id: 'co', name: '검증 시공사' }]);
    expect(selectable.map(team => team.id)).toEqual(['a', 'b']);
    expect(selectable[0].color).toBe('#225599');
    expect(selectable[1]).toMatchObject({ legacyId: 'old-b', companyName: '검증 시공사' });
    expect(all.find(team => team.id === 'child')).toMatchObject({ parentTeamId: 'old-b', parentTeamName: '나팀' });
    expect(all.some(team => !team.id)).toBe(false);
});

test('회사 ID가 없는 예전 팀은 각 화면의 기존 회사명 비교 방식을 유지한다', () => {
    const teams = [{ id: 'old', name: '이전 팀', companyName: '검증시공사 소속팀' }] as Team[];
    const companies = [{ id: 'co', name: '검증 시공사' }];
    expect(getAdvanceTeamOptions(teams, companies).selectable).toHaveLength(0);
    expect(getAdvanceTeamOptions(teams, companies, 'ignore-spaces').selectable.map(team => team.id)).toEqual(['old']);
});
