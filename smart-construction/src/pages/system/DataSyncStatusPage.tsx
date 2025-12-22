import React, { useState, useEffect } from 'react';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faTimesCircle, faSync, faExclamationTriangle, faArrowRight, faChartPie } from '@fortawesome/free-solid-svg-icons';

const DataSyncStatusPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [unlinkedData, setUnlinkedData] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [workers, teams, sites, companies] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                siteService.getSites(),
                companyService.getCompanies()
            ]);

            // 1. Calculate Stats
            const workerStats = {
                total: workers.length,
                linkedToTeam: workers.filter(w => w.teamId).length,
                linkedToCompany: workers.filter(w => w.companyId).length,
            };

            const teamStats = {
                total: teams.length,
                linkedToLeader: teams.filter(t => t.leaderId).length,
                linkedToCompany: teams.filter(t => t.companyId).length,
            };

            const siteStats = {
                total: sites.length,
                linkedToTeam: sites.filter(s => s.responsibleTeamId).length,
                linkedToCompany: sites.filter(s => s.companyId).length,
            };

            setStats({ workerStats, teamStats, siteStats });

            // 2. Identify Unlinked Data
            setUnlinkedData({
                workersNoTeam: workers.filter(w => !w.teamId).map(w => ({ id: w.id, name: w.name, info: w.teamName || '팀명 없음' })),
                teamsNoLeader: teams.filter(t => !t.leaderId).map(t => ({ id: t.id, name: t.name, info: t.leaderName || '팀장명 없음' })),
                teamsNoCompany: teams.filter(t => !t.companyId).map(t => ({ id: t.id, name: t.name, info: t.companyName || '회사명 없음' })),
                sitesNoTeam: sites.filter(s => !s.responsibleTeamId).map(s => ({ id: s.id, name: s.name, info: s.responsibleTeamName || '담당팀명 없음' })),
            });

        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    const renderStatCard = (title: string, total: number, linked: number, icon: any, colorClass: string) => {
        const percentage = total > 0 ? Math.round((linked / total) * 100) : 0;
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
                        <FontAwesomeIcon icon={icon} className={`text-xl ${colorClass}`} />
                    </div>
                    <span className="text-2xl font-bold text-slate-800">{percentage}%</span>
                </div>
                <h3 className="text-slate-600 font-medium mb-1">{title}</h3>
                <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${percentage}%` }}></div>
                </div>
                <p className="text-xs text-slate-400 text-right">{linked} / {total} 완료</p>
            </div>
        );
    };

    const renderUnlinkedList = (title: string, items: any[], colorClass: string) => (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h4 className="font-bold text-slate-700">{title}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${items.length === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {items.length}건 미연결
                </span>
            </div>
            <div className="p-4 overflow-y-auto max-h-60 flex-1">
                {items.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <FontAwesomeIcon icon={faCheckCircle} className="text-3xl text-green-400 mb-2" />
                        <p>모든 데이터가 연결되었습니다.</p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {items.map((item: any, idx: number) => (
                            <li key={idx} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border border-slate-100">
                                <span className="font-medium text-slate-700">{item.name}</span>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-400" />
                                    {item.info}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <FontAwesomeIcon icon={faSync} spin className="text-4xl text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faChartPie} className="text-indigo-600" />
                        데이터 동기화 현황
                    </h1>
                    <p className="text-slate-500 mt-1">
                        마스터 데이터 간의 연결 상태를 시각적으로 확인하고 누락된 연결을 점검합니다.
                    </p>
                </div>
                <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2">
                    <FontAwesomeIcon icon={faSync} /> 새로고침
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {renderStatCard('작업자 → 팀 연결', stats.workerStats.total, stats.workerStats.linkedToTeam, faArrowRight, 'text-blue-600 bg-blue-600')}
                {renderStatCard('작업자 → 회사 연결', stats.workerStats.total, stats.workerStats.linkedToCompany, faArrowRight, 'text-indigo-600 bg-indigo-600')}
                {renderStatCard('팀 → 팀장 연결', stats.teamStats.total, stats.teamStats.linkedToLeader, faArrowRight, 'text-green-600 bg-green-600')}
                {renderStatCard('현장 → 담당팀 연결', stats.siteStats.total, stats.siteStats.linkedToTeam, faArrowRight, 'text-purple-600 bg-purple-600')}
            </div>

            {/* Unlinked Data Grid */}
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />
                미연결 데이터 (조치 필요)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {renderUnlinkedList('팀 미배정 작업자', unlinkedData.workersNoTeam, 'bg-blue-600')}
                {renderUnlinkedList('팀장 미지정 팀', unlinkedData.teamsNoLeader, 'bg-green-600')}
                {renderUnlinkedList('소속사 미지정 팀', unlinkedData.teamsNoCompany, 'bg-indigo-600')}
                {renderUnlinkedList('담당팀 미지정 현장', unlinkedData.sitesNoTeam, 'bg-purple-600')}
            </div>
        </div>
    );
};

export default DataSyncStatusPage;
