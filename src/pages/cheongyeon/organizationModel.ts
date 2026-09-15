import type { Company } from '../../services/companyService';
import type { Team } from '../../services/teamService';
import type { Worker } from '../../services/manpowerService';
import type { Site } from '../../services/siteService';

export type OrganizationData = { companies: Company[]; teams: Team[]; workers: Worker[]; sites: Site[] };
export type OrganizationSite = { key: string; name: string; site?: Site; members: Worker[] };
export type OrganizationTeam = {
    id: string; name: string; source: Team; members: Worker[]; leader?: Worker;
    leaderLabel: string; sites: OrganizationSite[]; parentId: string | null; issues: string[];
};
export type OrganizationCompany = { id: string; name: string; type: string; teams: OrganizationTeam[]; unassigned: Worker[] };
export const UNASSIGNED_COMPANY = '__unassigned_organization__';
export const text = (value: unknown): string => String(value ?? '').trim();
const normalized = (value: unknown): string => text(value).normalize('NFKC').toLocaleLowerCase('ko-KR');
export const workerRole = (worker: Worker): string => text(worker.role) || text(worker.rank) || '직무 미등록';
export const teamStatus = (status: unknown): string => ({ active: '운영 중', waiting: '대기', closed: '종료' }[text(status)] || text(status) || '상태 미등록');
export const siteStatus = (status: unknown): string => ({ active: '진행 중', completed: '완료', planned: '예정' }[text(status)] || text(status) || '상태 미등록');
export const isCurrentWorker = (worker: Worker): boolean => worker.isActive !== false
    && !['퇴사', '퇴직', '출입금지', 'inactive', 'retired', 'terminated'].includes(normalized(worker.status));
const sortByName = <T extends { name: string }>(rows: T[]): T[] => rows.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
const uniqueById = <T extends { id?: string }>(rows: T[]): T[] => Array.from(new Map(rows.filter(row => text(row.id)).map(row => [text(row.id), row])).values());

const initials = (value: string): string => Array.from(value).map(char => {
    const offset = char.charCodeAt(0) - 0xac00;
    return offset >= 0 && offset <= 11171 ? 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor(offset / 588)] : char;
}).join('');
export function matchesOrganizationQuery(value: string, query: string): boolean {
    const candidate = normalized(value);
    const initialCandidate = normalized(initials(candidate));
    return normalized(query).split(/\s+/).filter(Boolean).every(term => candidate.includes(term) || initialCandidate.includes(term));
}
export const teamMatches = (team: OrganizationTeam, query: string): boolean => matchesOrganizationQuery([
    team.name, team.leaderLabel, text(team.source.type), ...team.sites.map(site => site.name),
    ...team.members.map(worker => worker.name + ' ' + workerRole(worker)),
].join(' '), query);

function linkedSites(team: Team, members: Worker[], teams: Team[], sites: Site[]): OrganizationSite[] {
    const result = new Map<string, OrganizationSite>();
    const addSite = (site: Site) => {
        if (site.id) result.set(site.id, { key: site.id, name: site.name, site, members: [] });
    };
    const addReference = (id: unknown, name: unknown) => {
        const referenceId = text(id);
        const referenceName = text(name);
        // A stale ID must never be redirected to a different site with the same name.
        const matches = referenceId ? sites.filter(site => site.id === referenceId)
            : referenceName ? sites.filter(site => normalized(site.name) === normalized(referenceName)) : [];
        if (matches.length === 1) addSite(matches[0]);
        else if (referenceId || referenceName) {
            const key = referenceId ? 'missing:' + referenceId : 'name:' + normalized(referenceName);
            result.set(key, { key, name: referenceName || '이름 미등록 현장', members: [] });
        }
    };
    for (const site of sites) {
        const id = text(site.responsibleTeamId);
        const name = normalized(site.responsibleTeamName);
        if (id ? id === team.id : name && normalized(team.name) === name && teams.filter(row => normalized(row.name) === name).length === 1) addSite(site);
    }
    addReference(team.assignedSiteId, team.assignedSiteName);
    const ids = team.siteIds || [];
    const names = team.siteNames || [];
    ids.forEach((id, index) => addReference(id, names[index]));
    // Legacy name-only rows remain visible; paired names never override IDs.
    names.slice(ids.length).forEach(name => addReference(undefined, name));
    members.forEach(worker => addReference(worker.siteId, worker.siteName));
    for (const entry of result.values()) {
        entry.members = members.filter(worker => {
            if (text(worker.siteId)) return Boolean(entry.site) && worker.siteId === entry.site?.id;
            const name = normalized(worker.siteName);
            return Boolean(name && entry.site && name === normalized(entry.site.name)
                && sites.filter(site => normalized(site.name) === name).length === 1);
        });
    }
    return sortByName(Array.from(result.values()));
}

export function buildOrganization(data: OrganizationData, sitesAvailable = true): OrganizationCompany[] {
    const companies = uniqueById(data.companies);
    const teams = uniqueById(data.teams);
    const workers = uniqueById(data.workers).filter(isCurrentWorker);
    const sites = uniqueById(data.sites);
    const companyIds = new Set(companies.map(company => company.id));
    const teamIds = new Set(teams.map(team => team.id));
    const groups: OrganizationCompany[] = sortByName(companies.map(company => ({
        id: company.id!, name: company.name, type: company.type || '회사', teams: [], unassigned: [],
    })));
    const unassigned: OrganizationCompany = { id: UNASSIGNED_COMPANY, name: '소속 확인 필요', type: '미배정', teams: [], unassigned: [] };
    const groupById = new Map(groups.map(group => [group.id, group]));
    for (const team of teams) {
        const members = sortByName(workers.filter(worker => worker.teamId === team.id));
        const id = text(team.leaderId);
        const name = normalized(team.leaderName);
        const named = members.filter(worker => normalized(worker.name) === name);
        const leader = id ? members.find(worker => worker.id === id) : name && named.length === 1 ? named[0] : undefined;
        const issues: string[] = [];
        if (!leader) issues.push(id || name ? '팀장 소속 확인 필요' : '팀장 미지정');
        const connectedSites = linkedSites(team, members, teams, sites);
        if (sitesAvailable && connectedSites.some(site => !site.site)) issues.push('현장 연결 확인 필요');
        const summary: OrganizationTeam = {
            id: team.id!, name: team.name, source: team, members, leader, sites: connectedSites, parentId: null, issues,
            leaderLabel: leader?.name || (text(team.leaderName) ? text(team.leaderName) + ' · 소속 확인 필요' : id ? '팀장 소속 확인 필요' : '팀장 미지정'),
        };
        (groupById.get(text(team.companyId)) || unassigned).teams.push(summary);
    }
    for (const worker of workers) {
        if (teamIds.has(worker.teamId)) continue;
        (companyIds.has(worker.companyId) ? groupById.get(worker.companyId!)! : unassigned).unassigned.push(worker);
    }
    if (unassigned.teams.length || unassigned.unassigned.length) groups.push(unassigned);
    for (const group of groups) {
        sortByName(group.teams);
        sortByName(group.unassigned);
        const byId = new Map(group.teams.map(team => [team.id, team]));
        for (const team of group.teams) {
            const requested = text(team.source.parentTeamId);
            if (requested && (!byId.has(requested) || requested === team.id)) team.issues.push('상위 팀 연결 확인 필요');
            else team.parentId = requested || null;
        }
        // Break only cycle members. Descendants can still be reached and inspected.
        const cycleIds = new Set<string>();
        for (const team of group.teams) {
            const chain: string[] = [];
            let id: string | null = team.id;
            while (id) {
                const seen = chain.indexOf(id);
                if (seen >= 0) { chain.slice(seen).forEach(value => cycleIds.add(value)); break; }
                chain.push(id);
                id = byId.get(id)?.parentId || null;
            }
        }
        for (const id of cycleIds) {
            const team = byId.get(id)!;
            team.parentId = null;
            team.issues.push('상위 팀 순환 연결 확인 필요');
        }
    }
    return groups;
}

export function defaultCompany(groups: OrganizationCompany[]): string {
    return groups.find(group => /청연|cheongyeon|chungyeon/i.test(group.name))?.id || groups[0]?.id || '';
}

export function visibleOrganizationTeams(teams: OrganizationTeam[], query: string, status: string, needsAttention: boolean) {
    const matched = teams.filter(team => (status === 'all' || text(team.source.status) === status)
        && (!needsAttention || team.issues.length > 0) && teamMatches(team, query));
    const matchedIds = new Set(matched.map(team => team.id));
    const visibleIds = new Set(matchedIds);
    const byId = new Map(teams.map(team => [team.id, team]));
    for (const team of matched) {
        let parentId = team.parentId;
        while (parentId && !visibleIds.has(parentId)) {
            visibleIds.add(parentId);
            parentId = byId.get(parentId)?.parentId || null;
        }
    }
    return { matched, matchedIds, visibleIds };
}
