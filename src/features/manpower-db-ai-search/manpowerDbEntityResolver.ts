import type { IntegratedDatabaseOverviewSnapshot } from '../../pages/database/manpowerDatabaseOverview';
import { ManpowerDbEntity } from './manpowerDbSearchTypes';
import { pickBestRank } from './manpowerDbSearchRanking';

export interface ManpowerDbEntityCandidate {
    entity: Exclude<ManpowerDbEntity, 'account' | 'integrity' | 'mixed'>;
    id: string;
    name: string;
    score: number;
    matchReason: string;
}

export interface ManpowerDbEntityResolution {
    keyword: string;
    candidates: ManpowerDbEntityCandidate[];
    selected?: ManpowerDbEntityCandidate;
}

const text = (value: unknown): string => String(value ?? '').trim();

export const resolveManpowerDbEntities = (
    snapshot: IntegratedDatabaseOverviewSnapshot,
    keyword: string | undefined,
    targetEntity?: ManpowerDbEntity
): ManpowerDbEntityResolution => {
    const normalizedKeyword = text(keyword);
    if (!normalizedKeyword) return { keyword: '', candidates: [] };

    const candidates: ManpowerDbEntityCandidate[] = [];
    const allow = (entity: ManpowerDbEntity) => !targetEntity || targetEntity === 'mixed' || targetEntity === entity;

    if (allow('worker')) {
        snapshot.workers.forEach((worker) => {
            const rank = pickBestRank([
                { value: worker.name, label: '작업자명' },
                { value: worker.teamName, label: '작업자 소속팀' },
                { value: worker.companyName, label: '작업자 회사' },
                { value: worker.siteName, label: '작업자 현장' },
            ], normalizedKeyword);
            if (rank.score > 0) {
                candidates.push({
                    entity: 'worker',
                    id: text(worker.id) || text(worker.uid) || text(worker.name),
                    name: text(worker.name) || '이름 없음',
                    score: rank.score,
                    matchReason: rank.matchReason,
                });
            }
        });
    }

    if (allow('team')) {
        snapshot.teams.forEach((team) => {
            const rank = pickBestRank([
                { value: team.name, label: '팀명' },
                { value: team.companyName, label: '팀 회사' },
                { value: Array.isArray(team.siteNames) ? team.siteNames.join(' ') : '', label: '팀 담당 현장' },
            ], normalizedKeyword);
            if (rank.score > 0) {
                candidates.push({
                    entity: 'team',
                    id: text(team.id) || text(team.name),
                    name: text(team.name) || '팀명 없음',
                    score: rank.score,
                    matchReason: rank.matchReason,
                });
            }
        });
    }

    if (allow('site')) {
        snapshot.sites.forEach((site) => {
            const rank = pickBestRank([
                { value: site.name, label: '현장명' },
                { value: site.code, label: '현장 코드' },
                { value: site.companyName, label: '현장 회사' },
                { value: site.constructorCompanyName, label: '시공사' },
                { value: site.clientCompanyName, label: '발주처' },
                { value: site.partnerName, label: '협력사' },
            ], normalizedKeyword);
            if (rank.score > 0) {
                candidates.push({
                    entity: 'site',
                    id: text(site.id) || text(site.name),
                    name: text(site.name) || '현장명 없음',
                    score: rank.score,
                    matchReason: rank.matchReason,
                });
            }
        });
    }

    if (allow('company')) {
        snapshot.companies.forEach((company) => {
            const rank = pickBestRank([
                { value: company.name, label: '회사명' },
                { value: company.code, label: '회사 코드' },
                { value: company.type, label: '회사 유형' },
                { value: Array.isArray(company.siteNames) ? company.siteNames.join(' ') : '', label: '회사 현장' },
            ], normalizedKeyword);
            if (rank.score > 0) {
                candidates.push({
                    entity: 'company',
                    id: text(company.id) || text(company.name),
                    name: text(company.name) || '회사명 없음',
                    score: rank.score,
                    matchReason: rank.matchReason,
                });
            }
        });
    }

    const sorted = candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const selected = sorted[0] && sorted[0].score >= 0.9 && (!sorted[1] || sorted[0].score - sorted[1].score >= 0.08)
        ? sorted[0]
        : undefined;

    return {
        keyword: normalizedKeyword,
        candidates: sorted.slice(0, 10),
        selected,
    };
};
