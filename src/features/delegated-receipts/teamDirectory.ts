import type { DelegatedClaim, RecipientKind } from './model';
export interface ReceiptTeam { id: string; name: string; leaderName?: string; color?: string; }
export interface ReceiptSite { id: string; name: string; responsibleTeamId?: string; }
export interface ReceiptWorker { id: string; name: string; color?: string; teamId?: string; }
export interface ReceiptDirectory { teams: ReceiptTeam[]; sites: ReceiptSite[]; workers?: ReceiptWorker[]; }
export const emptyDirectory: ReceiptDirectory = { teams: [], sites: [], workers: [] };
const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
export const validTeamColor = (value?: string) => value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#94a3b8';

export function getWorkerColor(claim: DelegatedClaim, directory: ReceiptDirectory): string {
    if (claim.workerId) return validTeamColor(directory.workers?.find(worker => worker.id === claim.workerId)?.color?.trim());
    // Imported rows only have a name. Ambiguous names must not borrow another worker's color.
    const matches = (directory.workers ?? []).filter(worker => normalize(worker.name) === normalize(claim.workerName));
    return validTeamColor(matches.length === 1 ? matches[0].color?.trim() : undefined);
}

export function getSiteTeam(claim: DelegatedClaim, directory: ReceiptDirectory): ReceiptTeam | undefined {
    if (claim.assignedTeamId) return directory.teams.find(team => team.id === claim.assignedTeamId);
    if (claim.siteId) return directory.teams.find(team => team.id === directory.sites.find(site => site.id === claim.siteId)?.responsibleTeamId);
    const matches = directory.sites.filter(site => normalize(site.name) === normalize(claim.siteName));
    return matches.length === 1 ? directory.teams.find(team => team.id === matches[0].responsibleTeamId) : undefined;
}
export function recipientDetail(claim: DelegatedClaim, kind: RecipientKind, directory: ReceiptDirectory): string {
    if (kind === 'personal') return claim.workerName;
    const matches = kind === 'jaewook_leader' ? directory.teams.filter(team => ['이재욱', '이재욱팀'].includes(normalize(team.name)) || normalize(team.leaderName || '') === '이재욱') : [];
    const team = kind === 'site_leader' ? getSiteTeam(claim, directory) : matches.length === 1 ? matches[0] : undefined;
    return team ? [team.name, team.leaderName].filter(Boolean).join(' · ') : kind === 'unknown' ? '원본 또는 통장 확인' : '팀 연결 후 예금주 확인';
}
