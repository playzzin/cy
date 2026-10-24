import { buildFreelancerTeamHistory, freelancerTeamBackground } from './freelancerTeamHistory';
import { freelancerReportRowKey } from './freelancerYearlyData';

const teams = [
    { id: 'a', name: '검증 A팀', background: '#000000' },
    { id: 'b', name: '검증 B팀', background: '#7c3aed' },
    { id: 'c', name: '검증 C팀', background: '#fef08a' },
];
const key = (teamId: string, id = 'worker') => freelancerReportRowKey({ id, teamId });

it('밝은 3자리 색상도 읽을 수 있는 글자색으로 표시한다', () => {
    const history = buildFreelancerTeamHistory([
        { id: 'worker', teamId: 'a', m08: 100 },
        { id: 'worker', teamId: 'b', m09: 200 },
    ], [{ id: 'a', name: '밝은 팀', background: '#fff' }, teams[1]], 2026);
    expect(history.get(key('b'))).toMatchObject({ background: '#fff', textColor: '#0f172a' });
});

it('미등록 팀 색상은 요청한 검정·보라를 사용하고 등록 색상은 그대로 따른다', () => {
    expect(freelancerTeamBackground({ name: '김진민팀' }, 5)).toBe('#000000');
    expect(freelancerTeamBackground({ name: '김군회 팀' }, 0)).toBe('#7c3aed');
    expect(freelancerTeamBackground({ name: '김군회팀', color: '#663399' }, 0)).toBe('#663399');
});

it('새 팀의 이름에 이전 신고팀의 검정 배경과 흰 글씨를 표시하고 팀별 월·금액을 안내한다', () => {
    const history = buildFreelancerTeamHistory([
        { id: 'worker', teamId: 'b', m09: 2000000 },
        { id: 'worker', teamId: 'a', m08: 1000000 },
    ], teams, 2026);
    expect(history.get(key('b'))).toMatchObject({ previousTeamId: 'a', background: '#000000', textColor: '#ffffff' });
    expect(history.get(key('b'))?.title).toContain('검증 A팀 · 합계 1,000,000원');
    expect(history.get(key('b'))?.title).toContain('8월 1,000,000원');
    expect(history.get(key('b'))?.title).toContain('9월 2,000,000원');
    expect(history.get(key('b'))?.label).toBe('이전: 검증 A팀');
    expect(history.get(key('b'))?.reports).toEqual([
        { teamId: 'b', teamName: '검증 B팀', months: [{ month: 9, amount: 2000000 }], bonus: 0, total: 2000000 },
        { teamId: 'a', teamName: '검증 A팀', months: [{ month: 8, amount: 1000000 }], bonus: 0, total: 1000000 },
    ]);
    expect(history.get(key('a'))?.background).toBeUndefined();
    expect(history.get(key('a'))?.label).toBe('다른 팀 신고 있음');
});

it('재이동 시 최근 신고 월 직전의 팀을 선택하며 현재 소속만 있고 신고가 없는 팀에도 표시한다', () => {
    const history = buildFreelancerTeamHistory([
        { id: 'worker', teamId: 'a', m01: 100, m10: 200 },
        { id: 'worker', teamId: 'b', m06: 300 },
        { id: 'worker', teamId: 'c', m08: 400 },
        { id: 'worker', teamId: 'new' },
    ], teams, 2026);
    expect(history.get(key('a'))).toMatchObject({ previousTeamId: 'c', textColor: '#0f172a' });
    expect(history.get(key('c'))).toMatchObject({ previousTeamId: 'b', textColor: '#ffffff' });
    expect(history.get(key('new'))?.previousTeamId).toBe('a');
});

it('동월 복수 신고를 팀 이동으로 단정하지 않고 이력만 안내한다', () => {
    const history = buildFreelancerTeamHistory([
        { id: 'worker', teamId: 'a', m09: 100 },
        { id: 'worker', teamId: 'b', m09: 200 },
        { id: 'worker', teamId: 'c', m10: 300 },
    ], teams, 2026);
    expect(history.get(key('a'))?.background).toBeUndefined();
    expect(history.get(key('b'))?.background).toBeUndefined();
    expect(history.get(key('c'))?.background).toBeUndefined();
    expect(history.get(key('c'))?.title).toContain('같은 월에 여러 팀');
    expect(history.get(key('b'))?.label).toBe('같은 달 여러 팀 신고');
    expect(history.get(key('b'))?.sharedMonths).toEqual([9]);
});

it('이전 팀이 확인되어도 같은 달 여러 팀 신고가 있으면 함께 표시한다', () => {
    const history = buildFreelancerTeamHistory([
        { id: 'worker', teamId: 'a', m08: 100, m09: 200 },
        { id: 'worker', teamId: 'b', m09: 300 },
    ], teams, 2026);
    expect(history.get(key('b'))).toMatchObject({
        label: '이전: 검증 A팀', previousTeamId: 'a', sharedMonths: [9],
    });
});

it('동명이인과 빈 행은 섞지 않고 0원으로 수정한 신고액은 이전 신고로 세지 않는다', () => {
    const history = buildFreelancerTeamHistory([
        { id: 'one', name: '동일 이름', teamId: 'a', m08: 100 },
        { id: 'two', name: '동일 이름', teamId: 'b', m09: 200 },
        { id: 'one', teamId: 'b', m07: 0, m07_sourceAmount: 300 },
        { name: '', teamId: 'b' },
    ], teams, 2026);
    expect(history.has(key('b', 'two'))).toBe(false);
    expect(history.has(key('a', 'one'))).toBe(false);
    expect(history.get(key('b', 'one'))?.previousTeamId).toBe('a');
    expect(history.has(key('b', ''))).toBe(false);
});

it('팀 색상이 없으면 임의의 팀 색상을 붙이지 않고 저장된 팀명과 금액을 안내한다', () => {
    const history = buildFreelancerTeamHistory([
        { id: 'worker', teamId: 'deleted', teamName: '옛 팀', m08: '1,000', performanceBonus: 50 },
        { id: 'worker', teamId: 'b', m09: 200 },
    ], teams, 2026);
    expect(history.get(key('b'))?.background).toBeUndefined();
    expect(history.get(key('b'))?.title).toContain('옛 팀 · 합계 1,050원');
    expect(history.get(key('b'))?.title).toContain('성과급 50원');
});
