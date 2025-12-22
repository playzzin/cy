import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faSync, faTools, faBuilding, faUserGroup, faHardHat } from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { toast } from '../../utils/swal';

interface Discrepancy {
    type: 'team' | 'site' | 'company';
    workerId: string;
    workerName: string;
    targetId: string; // The ID of the team/site/company
    currentName: string; // The name currently in the worker document
    correctName: string; // The correct name from the master document
    masterExists: boolean; // Does the master document even exist?
}

const AdminDataIntegrityPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
    const [stats, setStats] = useState({ totalWorkers: 0, scanned: 0, issues: 0 });
    const [lastScanned, setLastScanned] = useState<Date | null>(null);

    const scanData = async () => {
        setLoading(true);
        setDiscrepancies([]);
        try {
            // 1. Fetch Master Data
            const [teams, sites, companies, workers] = await Promise.all([
                teamService.getTeams(),
                siteService.getSites(),
                companyService.getCompanies(),
                manpowerService.getWorkers() // Implementation might need pagination if huge
            ]);

            const teamMap = new Map(teams.map(t => [t.id, t]));
            const siteMap = new Map(sites.map(s => [s.id, s]));
            const companyMap = new Map(companies.map(c => [c.id, c]));

            const issues: Discrepancy[] = [];

            workers.forEach(worker => {
                // Check Team
                if (worker.teamId) {
                    const team = teamMap.get(worker.teamId);
                    if (!team) {
                        issues.push({
                            type: 'team',
                            workerId: worker.id!,
                            workerName: worker.name,
                            targetId: worker.teamId,
                            currentName: worker.teamName || '(없음)',
                            correctName: '(삭제된 팀)',
                            masterExists: false
                        });
                    } else if (worker.teamName !== team.name) {
                        issues.push({
                            type: 'team',
                            workerId: worker.id!,
                            workerName: worker.name,
                            targetId: worker.teamId,
                            currentName: worker.teamName || '(없음)',
                            correctName: team.name,
                            masterExists: true
                        });
                    }
                }

                // Check Site
                if (worker.siteId) {
                    const site = siteMap.get(worker.siteId);
                    if (!site) {
                        issues.push({
                            type: 'site',
                            workerId: worker.id!,
                            workerName: worker.name,
                            targetId: worker.siteId,
                            currentName: worker.siteName || '(없음)',
                            correctName: '(삭제된 현장)',
                            masterExists: false
                        });
                    } else if (worker.siteName !== site.name) {
                        issues.push({
                            type: 'site',
                            workerId: worker.id!,
                            workerName: worker.name,
                            targetId: worker.siteId,
                            currentName: worker.siteName || '(없음)',
                            correctName: site.name,
                            masterExists: true
                        });
                    }
                }

                // Check Company
                if (worker.companyId) {
                    const company = companyMap.get(worker.companyId);
                    if (!company) {
                        issues.push({
                            type: 'company',
                            workerId: worker.id!,
                            workerName: worker.name,
                            targetId: worker.companyId,
                            currentName: worker.companyName || '(없음)',
                            correctName: '(삭제된 회사)',
                            masterExists: false
                        });
                    } else if (worker.companyName !== company.name) {
                        issues.push({
                            type: 'company',
                            workerId: worker.id!,
                            workerName: worker.name,
                            targetId: worker.companyId,
                            currentName: worker.companyName || '(없음)',
                            correctName: company.name,
                            masterExists: true
                        });
                    }
                }
            });

            setDiscrepancies(issues);
            setStats({
                totalWorkers: workers.length,
                scanned: workers.length,
                issues: issues.length
            });
            setLastScanned(new Date());

            if (issues.length === 0) {
                toast.success('데이터 불일치가 발견되지 않았습니다.');
            } else {
                toast.warning(`${issues.length}건의 데이터 불일치가 발견되었습니다.`);
            }

        } catch (error) {
            console.error("Error scanning data:", error);
            toast.error('데이터 스캔 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const fixIssue = async (issue: Discrepancy) => {
        try {
            if (!issue.masterExists) {
                alert('원본 데이터(팀/현장/회사)가 삭제되어 복구할 수 없습니다. 수동으로 작업자를 수정해주세요.');
                return;
            }

            const updates: Partial<Worker> = {};
            if (issue.type === 'team') updates.teamName = issue.correctName;
            if (issue.type === 'site') updates.siteName = issue.correctName;
            if (issue.type === 'company') updates.companyName = issue.correctName;

            await manpowerService.updateWorker(issue.workerId, updates);
            toast.success('수정되었습니다.');

            // Remove from list locally
            setDiscrepancies(prev => prev.filter(item =>
                !(item.workerId === issue.workerId && item.type === issue.type)
            ));
            setStats(prev => ({ ...prev, issues: prev.issues - 1 }));

        } catch (error) {
            console.error("Error fixing issue:", error);
            toast.error('수정 중 오류가 발생했습니다.');
        }
    };

    const fixAll = async () => {
        if (!window.confirm(`총 ${discrepancies.length}건의 데이터를 일괄 수정하시겠습니까? (삭제된 원본 데이터 제외)`)) return;

        setLoading(true);
        try {
            const fixableIssues = discrepancies.filter(d => d.masterExists);
            const { writeBatch } = await import('firebase/firestore');
            const { db } = await import('../../config/firebase');
            const { doc } = await import('firebase/firestore');

            // Batch size is limited to 500
            const batchSize = 500;
            const chunks = [];
            for (let i = 0; i < fixableIssues.length; i += batchSize) {
                chunks.push(fixableIssues.slice(i, i + batchSize));
            }

            let fixedCount = 0;

            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(issue => {
                    const workerRef = doc(db, 'workers', issue.workerId);
                    const updates: any = {};
                    if (issue.type === 'team') updates.teamName = issue.correctName;
                    if (issue.type === 'site') updates.siteName = issue.correctName;
                    if (issue.type === 'company') updates.companyName = issue.correctName;
                    batch.update(workerRef, updates);
                });
                await batch.commit();
                fixedCount += chunk.length;
            }

            toast.success(`${fixedCount}건 수정 완료`);
            scanData(); // Rescan
        } catch (error) {
            console.error("Error batch fixing:", error);
            toast.error('일괄 수정 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <FontAwesomeIcon icon={faTools} className="text-indigo-600" />
                        데이터 연결 무결성 점검
                    </h1>
                    <p className="text-slate-500 mt-1">
                        작업자 정보와 원본(팀, 현장, 회사) 데이터의 이름 일치 여부를 검사하고 수정합니다.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={scanData}
                        disabled={loading}
                        className={`px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-sm
                            ${loading
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'
                            }`}
                    >
                        <FontAwesomeIcon icon={faSync} spin={loading} />
                        {loading ? '검사 진행중...' : '데이터 검사 시작'}
                    </button>
                    {discrepancies.length > 0 && (
                        <button
                            onClick={fixAll}
                            disabled={loading}
                            className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 shadow-sm transition-all flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faCheckCircle} />
                            일괄 수정 ({discrepancies.filter(d => d.masterExists).length})
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium mb-1">총 작업자 수</div>
                    <div className="text-3xl font-bold text-slate-800">{stats.totalWorkers.toLocaleString()}명</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium mb-1">검사된 항목</div>
                    <div className="text-3xl font-bold text-blue-600">{stats.scanned.toLocaleString()}명</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium mb-1">발견된 문제</div>
                    <div className={`text-3xl font-bold ${stats.issues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {stats.issues.toLocaleString()}건
                    </div>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} className={discrepancies.length > 0 ? "text-orange-500" : "text-green-500"} />
                        검사 결과
                        {lastScanned && <span className="text-xs font-normal text-slate-400 ml-2">({lastScanned.toLocaleTimeString()} 기준)</span>}
                    </h3>
                </div>

                <div className="overflow-auto flex-1">
                    {discrepancies.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12">
                            <FontAwesomeIcon icon={faCheckCircle} className="text-5xl text-green-100 mb-4" />
                            <p className="text-lg">데이터 불일치가 없습니다.</p>
                            <p className="text-sm">위 '데이터 검사 시작' 버튼을 눌러 검사를 진행해주세요.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3">유형</th>
                                    <th className="px-6 py-3">작업자</th>
                                    <th className="px-6 py-3">현재 저장된 이름</th>
                                    <th className="px-6 py-3">원본 이름 (Master)</th>
                                    <th className="px-6 py-3 text-right">조치</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {discrepancies.map((issue, idx) => (
                                    <tr key={`${issue.workerId}-${issue.type}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`
                                                inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border
                                                ${issue.type === 'team' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                    issue.type === 'site' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                        'bg-purple-50 text-purple-600 border-purple-100'}
                                            `}>
                                                <FontAwesomeIcon icon={
                                                    issue.type === 'team' ? faUserGroup :
                                                        issue.type === 'site' ? faHardHat : faBuilding
                                                } />
                                                {issue.type === 'team' ? '팀' : issue.type === 'site' ? '현장' : '회사'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {issue.workerName}
                                            <span className="block text-xs text-slate-400 font-normal">{issue.workerId}</span>
                                        </td>
                                        <td className="px-6 py-4 text-red-500 font-medium">
                                            {issue.currentName}
                                        </td>
                                        <td className="px-6 py-4 text-green-600 font-medium">
                                            {issue.correctName}
                                            {!issue.masterExists && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">삭제됨</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {issue.masterExists ? (
                                                <button
                                                    onClick={() => fixIssue(issue)}
                                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-600 rounded-lg text-xs font-medium transition-colors shadow-sm"
                                                >
                                                    수정
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">수동 수정 필요</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDataIntegrityPage;
