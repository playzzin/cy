import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faUsers,
    faUserTie,
    faUser,
    faSpinner,
    faExclamationTriangle,
    faCrown,
    faIdCard
} from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import PremiumOrgChart from '../../components/structure/PremiumOrgChart';

type PositionLevel = 'executive' | 'management' | 'field';

const getPositionLevel = (worker: Worker): PositionLevel => {
    const baseText = `${worker.rank ?? ''} ${worker.role ?? ''}`.toLowerCase();

    if (/(대표|사장|이사|본부장|임원|ceo|cfo|coo)/.test(baseText)) {
        return 'executive';
    }
    if (/(부장|차장|과장|팀장|실장|소장|관리|매니저|관리자)/.test(baseText)) {
        return 'management';
    }
    return 'field';
};

const getPositionLabel = (level: PositionLevel): string => {
    if (level === 'executive') return '임원';
    if (level === 'management') return '관리직';
    return '현장직';
};

const getPositionBadgeClass = (level: PositionLevel): string => {
    switch (level) {
        case 'executive':
            return 'bg-indigo-50 text-indigo-600 border border-indigo-100';
        case 'management':
            return 'bg-amber-50 text-amber-700 border border-amber-100';
        case 'field':
        default:
            return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    }
};

const CheongyeonOrganizationPage: React.FC = () => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'premium' | 'card'>('premium');

    useEffect(() => {
        void loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [workerList, teamList, companyList] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                companyService.getCompanies()
            ]);

            const cheongyeonCompany =
                companyList.find(c => c.name.includes('청연')) ||
                companyList.find(c => c.name.includes('청연ENG')) ||
                null;

            setWorkers(workerList);
            setTeams(teamList);
            setCompany(cheongyeonCompany);
        } catch (e) {
            console.error('Failed to load Cheongyeon organization data', e);
            setError('조직도 데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    const normalizedCompanyName = company?.name ?? '청연이엔지';

    const companyTeams: Team[] = company && company.id
        ? teams.filter(team => team.companyId === company.id)
        : [];

    const companyWorkers: Worker[] = company && company.id
        ? workers.filter(worker => worker.companyId === company.id)
        : [];

    const getTeamMembers = (teamId: string): Worker[] => {
        return companyWorkers.filter(worker => worker.teamId === teamId);
    };

    const unassignedWorkers: Worker[] = companyWorkers.filter(worker => !worker.teamId);

    // Premium View Mode
    if (viewMode === 'premium') {
        return (
            <div className="fixed inset-0 z-40">
                <PremiumOrgChart />
                {/* Mode Toggle Button - Floating */}
                <button
                    onClick={() => setViewMode('card')}
                    className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-white transition-all flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faIdCard} />
                    카드 보기
                </button>
            </div>
        );
    }

    // Card View Mode
    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                            <FontAwesomeIcon icon={faBuilding} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800">청연ENG 조직도</h1>
                            <p className="text-xs text-slate-500">팀 및 인원 구조</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setViewMode('premium')}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg shadow-lg text-sm font-bold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faCrown} />
                        프리미엄 ✨
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 md:p-8">
                {company && (
                    <div className="space-y-6">
                        {/* Company Card */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl">
                                    <FontAwesomeIcon icon={faBuilding} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">{company.name}</h2>
                                    <p className="text-sm text-slate-500">{company.type} • 팀 {companyTeams.length}개 • 인원 {companyWorkers.length}명</p>
                                </div>
                            </div>
                        </div>

                        {/* Team Cards */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs">
                                        <FontAwesomeIcon icon={faUserTie} />
                                    </span>
                                    팀 조직도
                                </h3>
                                <p className="text-[11px] text-slate-400">
                                    회사에 연결된 팀과 팀별 구성원을 실시간으로 보여줍니다.
                                </p>
                            </div>

                            {companyTeams.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
                                    아직 이 회사에 연결된 팀이 없습니다. 팀 등록 후 회사와 연결하면 조직도가 자동으로 생성됩니다.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {companyTeams.map(team => {
                                        if (!team.id) return null;
                                        const members = getTeamMembers(team.id);

                                        const leader = members.find(m => m.id === team.leaderId) ||
                                            members.find(m => m.rank?.includes('반장') || m.rank?.includes('팀장'));

                                        return (
                                            <div
                                                key={team.id}
                                                className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-sm">
                                                            <FontAwesomeIcon icon={faUsers} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                                                {team.name}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500">
                                                                구성원 {members.length}명
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {team.status && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-50 text-slate-500">
                                                            {team.status === 'active' && '운영중'}
                                                            {team.status === 'waiting' && '대기'}
                                                            {team.status === 'closed' && '종료'}
                                                            {!['active', 'waiting', 'closed'].includes(team.status) && team.status}
                                                        </span>
                                                    )}
                                                </div>

                                                {leader && (
                                                    <div className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2">
                                                        <div className="w-7 h-7 rounded-full bg-white text-indigo-600 flex items-center justify-center text-xs">
                                                            <FontAwesomeIcon icon={faUserTie} />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-semibold text-slate-800">팀장: {leader.name}</div>
                                                            <div className="text-[10px] text-slate-500">
                                                                {leader.rank || leader.role || '직급 미지정'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="border-t border-slate-100 pt-2">
                                                    <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
                                                        <span>팀원 목록</span>
                                                    </div>
                                                    {members.length === 0 ? (
                                                        <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2 text-center">
                                                            소속된 인원이 없습니다.
                                                        </div>
                                                    ) : (
                                                        <div className="max-h-40 overflow-auto pr-1 space-y-1">
                                                            {members.map(member => (
                                                                <div
                                                                    key={member.id}
                                                                    className="flex items-center justify-between text-[11px] px-2 py-1 rounded hover:bg-slate-50"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[9px] text-slate-500">
                                                                            <FontAwesomeIcon icon={faUser} />
                                                                        </span>
                                                                        <span className="font-medium text-slate-700">
                                                                            {member.name}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400">
                                                                            {member.rank || member.role || ''}
                                                                        </span>
                                                                    </div>
                                                                    {member.status && (
                                                                        <span className="text-[9px] text-slate-400">
                                                                            {member.status}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Unassigned Workers */}
                        {unassignedWorkers.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs">
                                        <FontAwesomeIcon icon={faUser} />
                                    </span>
                                    팀 미배정 인원
                                    <span className="text-[11px] text-slate-400 font-normal">({unassignedWorkers.length}명)</span>
                                </h3>
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 max-h-52 overflow-auto">
                                    {unassignedWorkers.map(worker => (
                                        <div
                                            key={worker.id}
                                            className="flex items-center justify-between text-[11px] px-2 py-1 rounded hover:bg-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] text-slate-600">
                                                    <FontAwesomeIcon icon={faUser} />
                                                </span>
                                                <span className="font-medium text-slate-700">{worker.name}</span>
                                                <span className="text-[10px] text-slate-400">
                                                    {worker.rank || worker.role || ''}
                                                </span>
                                            </div>
                                            {worker.status && (
                                                <span className="text-[9px] text-slate-400">{worker.status}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheongyeonOrganizationPage;
