import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';

interface HierarchyWorker {
    date: string;
    reportId?: string;
    workerId: string;
    workerName: string;
    workerTeamId?: string;
    workerTeamName?: string;
    teamId?: string;
    teamName?: string;
    siteResponsibleTeamId?: string;
    siteResponsibleTeamName?: string;
    targetTeamName?: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    billingUnitPrice: number;
    billingAmount?: number;
    issuedAmount: number;
}

interface HierarchySite {
    siteId: string;
    siteName: string;
    workers: HierarchyWorker[];
}

interface CounterTeamGroup {
    key: string;
    name: string;
    sites: Array<HierarchySite & { key: string }>;
}

const money = (value: number) => new Intl.NumberFormat('ko-KR').format(Math.round(value));
const manDays = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value);
const totals = (workers: HierarchyWorker[]) => workers.reduce((sum, worker) => ({
    manDay: sum.manDay + worker.manDay,
    amount: sum.amount + worker.amount,
    issuedAmount: sum.issuedAmount + worker.issuedAmount,
    billingAmount: sum.billingAmount + (worker.billingAmount ?? Math.round(worker.manDay * worker.billingUnitPrice)),
}), { manDay: 0, amount: 0, issuedAmount: 0, billingAmount: 0 });

export const getInternalCounterTeamLabel = (direction: string): '현장담당팀' | '작업팀' | null =>
    direction === '내부지원간곳' ? '현장담당팀' : direction === '내부지원온곳' ? '작업팀' : null;

const groupSitesByTeam = (sites: HierarchySite[], teamLabel: '현장담당팀' | '작업팀' | null): CounterTeamGroup[] => {
    const groups = new Map<string, CounterTeamGroup>();
    sites.forEach(site => site.workers.forEach(worker => {
        const responsible = teamLabel === '현장담당팀';
        const id = (responsible ? worker.siteResponsibleTeamId : worker.workerTeamId || worker.teamId)?.trim();
        const name = (responsible ? worker.siteResponsibleTeamName || worker.targetTeamName : worker.workerTeamName || worker.teamName)?.trim()
            || `${teamLabel} 미지정`;
        const key = id ? `id:${id}` : `name:${name}`;
        let group = groups.get(key);
        if (!group) {
            group = { key, name, sites: [] };
            groups.set(key, group);
        }
        const siteKey = site.siteId ? `id:${site.siteId}` : `name:${site.siteName}`;
        let targetSite = group.sites.find(candidate => candidate.key === siteKey);
        if (!targetSite) {
            targetSite = { ...site, key: siteKey, workers: [] };
            group.sites.push(targetSite);
        }
        targetSite.workers.push(worker);
    }));
    return Array.from(groups.values())
        .map(group => ({ ...group, sites: group.sites.sort((a, b) => a.siteName.localeCompare(b.siteName, 'ko-KR')) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
};

const SummaryCells: React.FC<{ workers: HierarchyWorker[] }> = ({ workers }) => {
    const sum = totals(workers);
    return <>
        <td className="border border-slate-300 px-3 py-2 text-center font-mono font-bold">{manDays(sum.manDay)}</td>
        <td className="border border-slate-300 px-3 py-2 text-right font-mono">{sum.manDay > 0 ? money(sum.amount / sum.manDay) : '-'}</td>
        <td className="border border-slate-300 px-3 py-2 text-right font-mono font-bold">{money(sum.amount)}</td>
        <td className="border border-slate-300 px-3 py-2 text-right font-mono">{sum.manDay > 0 ? money(sum.billingAmount / sum.manDay) : '-'}</td>
        <td className="border border-slate-300 px-3 py-2 text-right font-mono font-bold">{money(sum.issuedAmount)}</td>
    </>;
};

const SupportTeamHierarchy: React.FC<{
    direction: string;
    teamName: string;
    sites: HierarchySite[];
    onOpenSiteSettlement: (site: HierarchySite) => void;
}> = ({ direction, teamName, sites, onOpenSiteSettlement }) => {
    const teamLabel = getInternalCounterTeamLabel(direction);
    const groups = useMemo(() => groupSitesByTeam(sites, teamLabel), [teamLabel, sites]);
    const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
    const [expandedSite, setExpandedSite] = useState<string | null>(null);
    return (
        <table aria-label={`${teamName} ${teamLabel}별 현장`} className="w-full table-fixed border-collapse text-[13px] text-slate-900">
            <thead className="bg-slate-100">
                <tr>
                    <th className="w-72 border border-slate-300 px-3 py-2 text-left">{teamLabel} / 현장</th>
                    <th className="border border-slate-300 px-3 py-2">공수</th>
                    <th className="border border-slate-300 px-3 py-2">지원단가</th>
                    <th className="border border-slate-300 px-3 py-2">노임총액</th>
                    <th className="border border-slate-300 px-3 py-2">청구단가</th>
                    <th className="border border-slate-300 px-3 py-2">발행금액</th>
                    <th className="border border-slate-300 px-3 py-2">현장 정산</th>
                </tr>
            </thead>
            <tbody>
                {groups.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">해당 조건의 정산 내역이 없습니다.</td></tr>}
                {groups.map(group => {
                    const open = expandedTeam === group.key;
                    return <React.Fragment key={group.key}>
                        <tr className={direction === '내부지원간곳' ? 'bg-sky-50' : 'bg-indigo-50'}>
                            <td className="border border-slate-300 px-3 py-2">
                                <button type="button" aria-label={`${teamName}의 ${teamLabel} ${group.name} 현장 목록`} aria-expanded={open}
                                    onClick={() => { setExpandedTeam(open ? null : group.key); setExpandedSite(null); }}
                                    className="flex w-full items-center gap-2 text-left font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600">
                                    <FontAwesomeIcon icon={faChevronRight} className={`shrink-0 text-[10px] ${open ? 'rotate-90' : ''}`} />
                                    <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-white">{teamLabel}</span>
                                    <span>{group.name}</span>
                                    <span className="shrink-0 text-[10px] text-slate-500">현장 {group.sites.length}개</span>
                                </button>
                            </td>
                            <SummaryCells workers={group.sites.flatMap(site => site.workers)} />
                            <td className="border border-slate-300 px-3 py-2 text-center text-slate-500">-</td>
                        </tr>
                        {open && group.sites.map(site => {
                            const key = JSON.stringify([group.key, site.key]);
                            const siteOpen = expandedSite === key;
                            return <React.Fragment key={key}>
                                <tr className="bg-white">
                                    <td className="border border-slate-300 py-2 pl-7 pr-3">
                                        <button type="button" aria-label={`${teamName} ${group.name} ${site.siteName} 작업자 상세`} aria-expanded={siteOpen}
                                            onClick={() => setExpandedSite(siteOpen ? null : key)}
                                            className="flex w-full items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600">
                                            <FontAwesomeIcon icon={faChevronRight} className={`shrink-0 text-[10px] ${siteOpen ? 'rotate-90' : ''}`} />
                                            <span className="rounded bg-slate-600 px-1.5 py-0.5 text-[10px] text-white">현장</span>
                                            <span>{site.siteName}</span>
                                        </button>
                                    </td>
                                    <SummaryCells workers={site.workers} />
                                    <td className="border border-slate-300 px-3 py-2 text-center">
                                        <button type="button" onClick={() => onOpenSiteSettlement(site)}
                                            aria-label={`${teamName} ${group.name} ${site.siteName} 현장 전체 정산`}
                                            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-bold hover:bg-slate-100">현장 정산</button>
                                    </td>
                                </tr>
                                {siteOpen && <tr>
                                    <td colSpan={7} className="border border-slate-300 bg-slate-50 p-3">
                                        <h3 className="mb-2 font-bold">{group.name} · {site.siteName} 작업자 상세</h3>
                                        <table aria-label={`${group.name} ${site.siteName} 작업자`} className="w-full border-collapse bg-white text-xs">
                                            <thead className="bg-slate-100"><tr>
                                                {['일자', '작업자', '작업팀', '현장담당팀', '공수', '노임총액', '발행금액'].map(label =>
                                                    <th key={label} className="border border-slate-300 px-3 py-2">{label}</th>)}
                                            </tr></thead>
                                            <tbody>{site.workers.map((worker, index) => <tr key={`${worker.reportId}-${worker.workerId}-${index}`}>
                                                <td className="border border-slate-300 px-3 py-2">{worker.date}</td>
                                                <td className="border border-slate-300 px-3 py-2 font-bold">{worker.workerName}</td>
                                                <td className="border border-slate-300 px-3 py-2">{worker.workerTeamName || worker.teamName || '-'}</td>
                                                <td className="border border-slate-300 px-3 py-2">{worker.siteResponsibleTeamName || worker.targetTeamName || '-'}</td>
                                                <td className="border border-slate-300 px-3 py-2 text-right">{manDays(worker.manDay)}</td>
                                                <td className="border border-slate-300 px-3 py-2 text-right">{money(worker.amount)}</td>
                                                <td className="border border-slate-300 px-3 py-2 text-right">{money(worker.issuedAmount)}</td>
                                            </tr>)}</tbody>
                                        </table>
                                    </td>
                                </tr>}
                            </React.Fragment>;
                        })}
                    </React.Fragment>;
                })}
            </tbody>
        </table>
    );
};

export default SupportTeamHierarchy;
