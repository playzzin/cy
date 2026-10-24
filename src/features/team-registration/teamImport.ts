import type { Team } from '../../services/teamService';

export const TEAM_IMPORT_LABELS = {
    name: '팀명', type: '팀구분', leaderName: '팀장명', companyName: '소속회사', parentTeamName: '상위팀',
};
export type TeamImportField = keyof typeof TEAM_IMPORT_LABELS;
export type TeamImportRow = Partial<Record<TeamImportField, string>> & {
    name: string; _valid: boolean; _errors: string[];
};
const aliases: Record<TeamImportField, string[]> = {
    name: ['팀명', '팀이름', '팀'],
    type: ['팀구분', '유형', '구분', '성격', '팀성격'],
    leaderName: ['팀장', '팀장명', '대표'],
    companyName: ['소속회사', '회사명', '회사'],
    parentTeamName: ['상위팀', '원청팀'],
};
const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ');

export function parseTeamImport(text: string) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const headers: string[] = [];
    const mappedFields: Partial<Record<number, TeamImportField>> = {};
    if (!lines.length) return { headers, mappedFields, rows: [] as TeamImportRow[] };
    const split = (line: string) => line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/);
    headers.push(...split(lines[0]).map(value => value.trim()));
    const errors: string[] = [];
    const seen = new Set<TeamImportField>();
    headers.forEach((header, index) => {
        const field = (Object.keys(aliases) as TeamImportField[]).find(key =>
            aliases[key].includes(header.replace(/\s+/g, '')));
        if (!field) return;
        if (seen.has(field)) errors.push(`${TEAM_IMPORT_LABELS[field]} 열이 중복되었습니다.`);
        seen.add(field);
        mappedFields[index] = field;
    });
    if (!seen.has('name')) errors.push('팀명 열이 필요합니다.');
    const rows: TeamImportRow[] = lines.slice(1).map(line => {
        const values = split(line);
        const row: TeamImportRow = { name: '', _valid: true, _errors: [...errors] };
        Object.entries(mappedFields).forEach(([index, field]) => {
            if (field && row[field] === undefined) row[field] = normalize(values[Number(index)] || '');
            else if (field === 'name' && !row.name) row.name = normalize(values[Number(index)] || '');
        });
        if (!row.name) row._errors.push('팀명 누락');
        if (values.slice(headers.length).some(value => value.trim())) row._errors.push('제목보다 데이터 열이 많습니다.');
        row._valid = row._errors.length === 0;
        return row;
    });
    const counts = new Map<string, number>();
    rows.forEach(row => counts.set(row.name, (counts.get(row.name) || 0) + 1));
    rows.forEach(row => {
        if (row.name && counts.get(row.name)! > 1) {
            row._errors.push('붙여넣은 데이터에 같은 팀명이 중복되었습니다.');
            row._valid = false;
        }
    });
    return { headers, mappedFields, rows };
}

type Reference = { id?: string; name: string };
export type TeamImportReferences = { workers: Reference[]; companies: Reference[]; teams: Reference[] };

export function resolveTeamImportRow(row: TeamImportRow, references: TeamImportReferences): Team {
    if (!row._valid) throw new Error(row._errors.join(' '));
    if (references.teams.some(team => normalize(team.name) === row.name)) throw new Error('이미 등록된 팀명입니다.');
    const findId = (name: string | undefined, values: Reference[], label: string) => {
        if (!name) return undefined;
        const matches = values.filter(value => value.id && normalize(value.name) === normalize(name));
        if (matches.length !== 1) throw new Error(`${label} '${name}'${matches.length ? '이 중복되어 있습니다.' : '을 찾을 수 없습니다.'} 기존 정보를 확인해 주세요.`);
        return matches[0].id;
    };
    return {
        name: row.name, type: row.type || '시공팀',
        leaderId: findId(row.leaderName, references.workers, '팀장'), leaderName: row.leaderName || '',
        companyId: findId(row.companyName, references.companies, '회사'), companyName: row.companyName || '',
        parentTeamId: findId(row.parentTeamName, references.teams, '상위팀'), parentTeamName: row.parentTeamName || '',
    };
}
