import type { Company } from '../../../services/companyService';
import type { Team } from '../../../services/teamService';

export type AdvanceTeamOption = {
    id: string;
    legacyId?: string;
    name: string;
    color?: string;
    companyId?: string;
    companyName?: string;
    parentTeamId?: string;
    parentTeamName?: string;
};

export function getAdvanceTeamOptions(
    teams: Team[],
    constructionCompanies: Pick<Company, 'id' | 'name'>[],
    legacyNameSpacing: 'preserve-spaces' | 'ignore-spaces' = 'preserve-spaces',
) {
    const companyName = (value?: string | null) => String(value ?? '').replace(/\s*소속팀\s*$/, '').trim();
    const companyKey = (name?: string | null) => companyName(name).replace(/\s+/g, legacyNameSpacing === 'ignore-spaces' ? '' : ' ').toLowerCase();
    const companiesById = new Map(constructionCompanies.flatMap(company => company.id ? [[company.id, company.name] as const] : []));
    const names = new Set(constructionCompanies.map(company => companyKey(company.name)).filter(Boolean));
    const all: AdvanceTeamOption[] = [];
    const selectable: AdvanceTeamOption[] = [];
    for (const team of teams) {
        if (!team.id) continue;
        const name = companyName(team.companyName);
        const option = {
            id: team.id, legacyId: team.legacyId ?? undefined, name: team.name || '', color: team.color ?? undefined,
            companyId: team.companyId ?? undefined, companyName: name || companiesById.get(team.companyId ?? '') || '기타',
            parentTeamId: team.parentTeamId ?? undefined, parentTeamName: team.parentTeamName ?? undefined,
        };
        all.push(option);
        if (team.companyId ? companiesById.has(team.companyId) : names.has(companyKey(team.companyName))) selectable.push(option);
    }
    selectable.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return { all, selectable };
}
