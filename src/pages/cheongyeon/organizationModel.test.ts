import { buildOrganization, defaultCompany, matchesOrganizationQuery, OrganizationData, UNASSIGNED_COMPANY, visibleOrganizationTeams } from './organizationModel';

const company = (id: string, name = id) => ({ id, name, code: id, type: '시공사' as const });
const team = (id: string, extra = {}) => ({ id, name: id, type: '시공팀', companyId: 'c1', status: 'active' as const, ...extra });
const worker = (id: string, extra = {}) => ({ id, name: id, teamId: 't1', role: '작업자', status: '재직', ...extra });
const site = (id: string, extra = {}) => ({ id, name: id, code: id, status: 'active' as const, ...extra });
const data = (extra: Partial<OrganizationData> = {}): OrganizationData => ({ companies: [company('c1', '청연')], teams: [team('t1')], workers: [], sites: [], ...extra });

describe('organization source relationships', () => {
    it('never guesses a leader from the first member or job title', () => {
        const result = buildOrganization(data({ workers: [worker('w1', { role: '팀장' })] }))[0].teams[0];
        expect(result.leader).toBeUndefined();
        expect(result.leaderLabel).toBe('팀장 미지정');
        expect(result.members).toHaveLength(1);
    });
    it('uses leader ID after a name change and never redirects a stale ID by name', () => {
        const source = data({ teams: [team('t1', { leaderId: 'w1', leaderName: '이전이름' })], workers: [worker('w1', { name: '새이름' })] });
        expect(buildOrganization(source)[0].teams[0].leaderLabel).toBe('새이름');
        source.teams[0].leaderId = 'missing';
        source.teams[0].leaderName = '새이름';
        expect(buildOrganization(source)[0].teams[0].leader).toBeUndefined();
    });
    it('resolves a legacy leader name only for one current member', () => {
        const source = data({ teams: [team('t1', { leaderName: '김민수' })], workers: [worker('w1', { name: '김민수' })] });
        expect(buildOrganization(source)[0].teams[0].leader?.id).toBe('w1');
        source.workers.push(worker('w2', { name: '김민수' }));
        expect(buildOrganization(source)[0].teams[0].leader).toBeUndefined();
    });
    it('keeps empty companies empty, separates unknown companies, and defaults to Cheongyeon', () => {
        const groups = buildOrganization(data({ companies: [company('c1', '청연'), company('c2', '다른회사')], teams: [team('t2', { companyId: 'c2' }), team('missing', { companyId: 'deleted' })] }));
        expect(groups.find(group => group.id === 'c1')?.teams).toHaveLength(0);
        expect(groups.find(group => group.id === 'c2')?.teams.map(row => row.id)).toEqual(['t2']);
        expect(groups.find(group => group.id === UNASSIGNED_COMPANY)?.teams.map(row => row.id)).toEqual(['missing']);
        expect(defaultCompany(groups)).toBe('c1');
    });
    it('counts current unique members and preserves unassigned employees', () => {
        const groups = buildOrganization(data({ workers: [worker('w1'), worker('w1'), worker('w2', { status: '퇴사' }), worker('w3', { isActive: false }), worker('w4', { status: '휴직' }), worker('w5', { teamId: 'deleted', companyId: 'c1' }), worker('w6', { teamId: '', companyId: 'unknown' })] }));
        expect(groups[0].teams[0].members.map(row => row.id)).toEqual(['w1', 'w4']);
        expect(groups[0].unassigned.map(row => row.id)).toEqual(['w5']);
        expect(groups.find(group => group.id === UNASSIGNED_COMPANY)?.unassigned.map(row => row.id)).toEqual(['w6']);
    });
    it('keeps zero assigned members and actual completed site status', () => {
        const result = buildOrganization(data({ sites: [site('s1', { responsibleTeamId: 't1', status: 'completed' })], workers: [worker('w1')] }))[0].teams[0];
        expect(result.sites).toHaveLength(1);
        expect(result.sites[0].members).toHaveLength(0);
        expect(result.sites[0].site?.status).toBe('completed');
    });
    it('deduplicates references without merging distinct same-name sites', () => {
        const result = buildOrganization(data({ teams: [team('t1', { assignedSiteId: 's1', siteIds: ['s1', 's2'] })], sites: [site('s1', { name: '같은현장', responsibleTeamId: 't1' }), site('s2', { name: '같은현장' })], workers: [worker('w1', { siteId: 's1', siteName: '이전이름' }), worker('w2', { siteName: '같은현장' })] }))[0].teams[0];
        expect(result.sites.filter(row => row.site)).toHaveLength(2);
        expect(result.sites.find(row => row.key === 's1')?.members.map(row => row.id)).toEqual(['w1']);
        expect(result.sites.find(row => row.key === 's2')?.members).toHaveLength(0);
        expect(result.issues).toContain('현장 연결 확인 필요');
    });
    it('never matches a stale site ID or responsible team ID by name', () => {
        const result = buildOrganization(data({ teams: [team('t1', { assignedSiteId: 'deleted', assignedSiteName: '현장A' })], sites: [site('s1', { name: '현장A', responsibleTeamId: 'deleted', responsibleTeamName: 't1' })], workers: [worker('w1', { siteId: 'deleted', siteName: '현장A' })] }))[0].teams[0];
        expect(result.sites).toHaveLength(1);
        expect(result.sites[0].site).toBeUndefined();
        expect(result.sites[0].members).toHaveLength(0);
    });
    it('accepts unique legacy site names and worker assignments', () => {
        const result = buildOrganization(data({ teams: [team('t1', { siteNames: ['현장A'] })], sites: [site('s1', { name: '현장A' })], workers: [worker('w1', { siteName: '현장A' })] }))[0].teams[0];
        expect(result.sites.map(row => row.key)).toEqual(['s1']);
        expect(result.sites[0].members).toHaveLength(1);
    });
    it('does not infer responsible teams from ambiguous legacy names', () => {
        const groups = buildOrganization(data({ teams: [team('t1', { name: '동명팀' }), team('t2', { name: '동명팀' })], sites: [site('s1', { responsibleTeamName: '동명팀' })] }));
        expect(groups[0].teams.every(row => row.sites.length === 0)).toBe(true);
    });
    it('does not report missing site links during a lookup failure', () => {
        const result = buildOrganization(data({ teams: [team('t1', { assignedSiteId: 's1', leaderId: 'w1' })], workers: [worker('w1')] }), false)[0].teams[0];
        expect(result.issues).toEqual([]);
    });
    it('breaks cycles without hiding descendants and rejects cross-company parents', () => {
        const groups = buildOrganization(data({ companies: [company('c1'), company('c2')], teams: [team('a', { parentTeamId: 'b' }), team('b', { parentTeamId: 'a' }), team('child', { parentTeamId: 'a' }), team('other', { companyId: 'c2', parentTeamId: 'a' }), team('self', { parentTeamId: 'self' })] }));
        const teams = groups.flatMap(group => group.teams);
        expect(teams.find(row => row.id === 'a')?.parentId).toBeNull();
        expect(teams.find(row => row.id === 'b')?.parentId).toBeNull();
        expect(teams.find(row => row.id === 'child')?.parentId).toBe('a');
        expect(teams.find(row => row.id === 'other')?.parentId).toBeNull();
        expect(teams.find(row => row.id === 'self')?.parentId).toBeNull();
        expect(teams.find(row => row.id === 'a')?.issues).toContain('상위 팀 순환 연결 확인 필요');
    });
});

describe('organization discovery', () => {
    it.each([['김민수 전기', 'ㄱㅁㅅ'], ['김민수 전기', 'ㄱㅁㅅ ㅈㄱ'], ['김민수 ABC', '  김민수 abc '], ['김민수 A', 'ａ']])('finds %s with %s', (value, query) => {
        expect(matchesOrganizationQuery(value, query)).toBe(true);
    });
    it('requires every search term', () => {
        expect(matchesOrganizationQuery('김민수 전기', '김민수 토목')).toBe(false);
    });
    it('retains ancestors as context while counting only matches', () => {
        const teams = buildOrganization(data({ teams: [team('parent', { status: 'closed' }), team('child', { parentTeamId: 'parent' }), team('other')], workers: [worker('김민수', { teamId: 'child' })] }))[0].teams;
        const result = visibleOrganizationTeams(teams, 'ㄱㅁㅅ', 'active', true);
        expect(result.matched.map(row => row.id)).toEqual(['child']);
        expect(Array.from(result.visibleIds).sort()).toEqual(['child', 'parent']);
        expect(result.matchedIds.has('parent')).toBe(false);
    });
});
