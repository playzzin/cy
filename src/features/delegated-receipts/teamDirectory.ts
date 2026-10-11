import type { DelegatedClaim, RecipientKind } from './model';
export interface ReceiptTeam { id: string; name: string; leaderName?: string; color?: string; }
export interface ReceiptSite { id: string; name: string; responsibleTeamId?: string; }
export interface ReceiptDirectory { teams: ReceiptTeam[]; sites: ReceiptSite[]; }
export const emptyDirectory: ReceiptDirectory = { teams: [], sites: [] };
const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
export const validTeamColor = (value?: string) => value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#94a3b8';

export function getSiteTeam(claim: DelegatedClaim, directory: ReceiptDirectory): ReceiptTeam | undefined {
    if (claim.assignedTeamId) return directory.teams.find(team => team.id === claim.assignedTeamId);
    const matches = directory.sites.filter(site => normalize(site.name) === normalize(claim.siteName));
    return matches.length === 1 ? directory.teams.find(team => team.id === matches[0].responsibleTeamId) : undefined;
}
export function recipientDetail(claim: DelegatedClaim, kind: RecipientKind, directory: ReceiptDirectory): string {
    if (kind === 'personal') return claim.workerName;
    const matches = kind === 'jaewook_leader' ? directory.teams.filter(team => ['이재욱', '이재욱팀'].includes(normalize(team.name)) || normalize(team.leaderName || '') === '이재욱') : [];
    const team = kind === 'site_leader' ? getSiteTeam(claim, directory) : matches.length === 1 ? matches[0] : undefined;
    return team ? [team.name, team.leaderName].filter(Boolean).join(' · ') : kind === 'unknown' ? '원본 또는 통장 확인' : '팀 연결 후 예금주 확인';
}
