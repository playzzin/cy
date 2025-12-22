import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFlask,
    faCalendarAlt,
    faListUl,
    faEraser,
    faCheck,
    faBolt,
    faEye,
    faSave,
    faTruckFast,
    faChartSimple
} from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';

interface SimulationResult {
    totalReports: number;
    totalManDays: number;
    totalAmount: number;
    supportCount: number;
    internalSupportCount: number;
    externalSupportCount: number;
    datesProcessed: number;
    reports: any[]; // The actual payload to save
}

const TestDailyReportGeneratorPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [scenario, setScenario] = useState('standard');

    // Preview Data
    const [simulation, setSimulation] = useState<SimulationResult | null>(null);

    // Data check states
    const [siteCount, setSiteCount] = useState(0);
    const [teamCount, setTeamCount] = useState(0);
    const [workerCount, setWorkerCount] = useState(0);

    useEffect(() => {
        // Set default dates (Current month) based on Local Time
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        setEndDate(`${year}-${month}-${day}`);
        setStartDate(`${year}-${month}-01`);

        // Load initial counts
        checkDataCounts();
    }, []);

    const addLog = (message: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
    };

    const checkDataCounts = async () => {
        try {
            const [sites, teams, workers] = await Promise.all([
                siteService.getSites(),
                teamService.getTeams(),
                manpowerService.getWorkers()
            ]);
            setSiteCount(sites.length);
            setTeamCount(teams.length);
            setWorkerCount(workers.length);
        } catch (error) {
            console.error("Failed to check data counts:", error);
        }
    };

    // --- Core Simulation Logic ---
    const runSimulation = async () => {
        if (!startDate || !endDate) {
            alert("시작일과 종료일을 선택해주세요.");
            return;
        }
        if (siteCount === 0 || teamCount === 0 || workerCount === 0) {
            alert("기초 데이터가 부족합니다.");
            return;
        }

        setLoading(true);
        setSimulation(null);
        addLog(`🎲 시뮬레이션 시작 (${scenario})`);

        try {
            const sites = await siteService.getSites();
            const teams = await teamService.getTeams();
            const workers = await manpowerService.getWorkers();

            const generatedReports: any[] = [];
            let totalMD = 0;
            let totalAmt = 0;
            let supportCnt = 0;
            let internalCnt = 0;
            let externalCnt = 0;

            let current = new Date(startDate);
            const end = new Date(endDate);
            let dateCount = 0;

            // Pre-calculate worker schedules (e.g., who works 5 days vs 6 days)
            // Ideally assume random availability per day for simplicity in this version

            while (current <= end) {
                const dateStr = current.toISOString().split('T')[0];
                const dayOfWeek = current.getDay(); // 0: Sun
                dateCount++;

                // Skip Sundays unless 'full' scenario
                if (dayOfWeek === 0 && scenario !== 'full') {
                    current.setDate(current.getDate() + 1);
                    continue;
                }

                // Weather Logic (Random Rain)
                let weather = "맑음";
                if (scenario === 'rain' && Math.random() < 0.4) weather = "비";
                if (weather === "비" && Math.random() < 0.7) {
                    // Rain often cancels work
                    current.setDate(current.getDate() + 1);
                    continue;
                }

                // Iterate per Team
                for (const team of teams) {
                    // Filter members
                    const teamWorkers = workers.filter(w => w.teamId === team.id);
                    if (teamWorkers.length === 0) continue;

                    // 1. Determine if Team Works Today (90% chance usually)
                    if (Math.random() > 0.9) continue;

                    // 2. Identify Main Site (Responsible Site)
                    // If team has no responsible site, they are purely support team?
                    // Let's find sites where this team is responsible
                    const responsibleSites = sites.filter(s => s.responsibleTeamId === team.id);
                    let mainSite = responsibleSites.length > 0 ? responsibleSites[0] : null;

                    // If 'Support Team' (no site), they MUST go somewhere as support
                    // If 'Construction Team' (has site), they work at main site, BUT might send some support elsewhere

                    const availableWorkers = [...teamWorkers];
                    const dailyWorkEvents = [];

                    // --- Support Logic (30% Chance) ---
                    // "Coming and Going": simulate dividing the team or moving entirely
                    // Probability to do support today
                    const doSupport = Math.random() < 0.3 || (!mainSite);

                    if (doSupport) {
                        // Pick random target site NOT equal to mainSite
                        const otherSites = sites.filter(s => s.id !== mainSite?.id);
                        if (otherSites.length > 0) {
                            const targetSite = otherSites[Math.floor(Math.random() * otherSites.length)];

                            // Determine Support Type
                            // Check Company ID match
                            const isSameCompany = targetSite.companyId === team.companyId;
                            const supportType = isSameCompany ? 'internal_support' : 'external_support';

                            // How many go? (Support usually 20-50% of team, or all if support team)
                            const supportSize = !mainSite
                                ? availableWorkers.length // All go
                                : Math.floor(availableWorkers.length * 0.3) + 1; // Partial go

                            // Extract workers
                            const supportGroup = availableWorkers.splice(0, supportSize);

                            if (supportGroup.length > 0) {
                                dailyWorkEvents.push({
                                    site: targetSite,
                                    workers: supportGroup,
                                    type: supportType
                                });
                                supportCnt++;
                                if (supportType === 'internal_support') internalCnt++;
                                else externalCnt++;
                            }
                        }
                    }

                    // --- Main Work Logic ---
                    // Remaining workers work at Main Site
                    if (mainSite && availableWorkers.length > 0) {
                        dailyWorkEvents.push({
                            site: mainSite,
                            workers: availableWorkers,
                            type: 'main'
                        });
                    }

                    // --- Create Payloads ---
                    for (const event of dailyWorkEvents) {
                        // Man-Day Logic (0.5 ~ 1.5)
                        // 80% = 1.0, 10% = 0.5, 10% = 1.5
                        const attendees = event.workers.map(w => {
                            let md = 1.0;
                            const r = Math.random();
                            if (r < 0.1) md = 0.5;
                            else if (r > 0.9) md = 1.5;

                            return {
                                workerId: w.id!,
                                name: w.name,
                                role: w.role,
                                unitPrice: w.unitPrice,
                                manDay: md,
                                status: 'attendance',
                                workContent: event.type === 'main' ? '일반 시공' : (event.type === 'internal_support' ? '내부 지원' : '외부 지원')
                            };
                        });

                        const eventTotalMD = attendees.reduce((sum, w) => sum + w.manDay, 0);
                        const eventTotalAmt = attendees.reduce((sum, w) => sum + (w.unitPrice || 0) * w.manDay, 0);

                        generatedReports.push({
                            date: dateStr,
                            siteId: event.site.id!,
                            siteName: event.site.name,
                            teamId: team.id!,
                            teamName: team.name,
                            responsibleTeamId: event.site.responsibleTeamId,
                            responsibleTeamName: event.site.responsibleTeamName,
                            writerId: 'sys-sim',
                            totalManDay: eventTotalMD,
                            totalAmount: eventTotalAmt,
                            weather,
                            workContent: attendees[0].workContent,
                            workers: attendees
                        });

                        totalMD += eventTotalMD;
                        totalAmt += eventTotalAmt;
                    }
                } // end team loop

                current.setDate(current.getDate() + 1);
            } // end date loop

            setSimulation({
                totalReports: generatedReports.length,
                totalManDays: totalMD,
                totalAmount: totalAmt,
                supportCount: supportCnt,
                internalSupportCount: internalCnt,
                externalSupportCount: externalCnt,
                datesProcessed: dateCount,
                reports: generatedReports
            });

            addLog(`✅ 시뮬레이션 완료! 총 ${generatedReports.length}건 산출`);

        } catch (error) {
            console.error(error);
            addLog(`❌ 오류: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const saveToDatabase = async () => {
        if (!simulation || simulation.reports.length === 0) return;
        if (!window.confirm(`${simulation.totalReports}건의 일보 데이터를 실제로 저장하시겠습니까?`)) return;

        setLoading(true);
        addLog("💾 데이터베이스 저장 시작...");

        try {
            const batchSize = 50;
            const reports = simulation.reports;

            for (let i = 0; i < reports.length; i += batchSize) {
                const batch = reports.slice(i, i + batchSize);
                await Promise.all(batch.map(r => dailyReportService.addReport(r)));
                addLog(`... ${Math.min(i + batchSize, reports.length)} / ${reports.length} 저장 중`);
            }

            addLog("🎉 모든 데이터가 저장되었습니다!");
            setSimulation(null); // Reset preview
        } catch (error) {
            addLog(`❌ 저장 실패: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const clearReports = async () => {
        if (!window.confirm("정말로 모든 '일보 데이터'를 삭제하시겠습니까?\n(현장, 팀, 작업자 데이터는 유지됩니다)")) return;

        setLoading(true);
        addLog("🗑️ 일보 데이터 삭제 시작...");
        try {
            const reports = await dailyReportService.getAllReports();
            addLog(`발견된 일보: ${reports.length}개`);

            const ids = reports.map(r => r.id!).filter(Boolean);
            if (ids.length > 0) {
                // Delete in chunks
                for (let i = 0; i < ids.length; i += 100) {
                    await dailyReportService.deleteReports(ids.slice(i, i + 100));
                }
            }

            addLog("✅ 모든 일보 데이터가 삭제되었습니다.");
            setSimulation(null);

        } catch (error) {
            addLog(`❌ 삭제 중 오류: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <FontAwesomeIcon icon={faFlask} className="text-purple-600" />
                테스트 데이터 생성기 v2.0 (일보 전용)
            </h1>

            {/* Status Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} className="text-green-500" />
                    기초 데이터 현황
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="text-3xl font-bold text-blue-600">{siteCount}</div>
                        <div className="text-sm text-slate-500">현장</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="text-3xl font-bold text-indigo-600">{teamCount}</div>
                        <div className="text-sm text-slate-500">팀</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="text-3xl font-bold text-green-600">{workerCount}</div>
                        <div className="text-sm text-slate-500">작업자</div>
                    </div>
                </div>
                {siteCount === 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg">
                        ⚠️ 기초 데이터가 없습니다. 먼저 [데이터 생성] 메뉴에서 1단계~4단계를 진행해주세요.
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 1. Settings Panel */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            <FontAwesomeIcon icon={faListUl} />
                            생성 설정
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" />
                                    기간 설정
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                        className="flex-1 border-slate-200 rounded-lg text-sm"
                                    />
                                    <span className="self-center">~</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className="flex-1 border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    <FontAwesomeIcon icon={faBolt} className="mr-1" />
                                    시나리오 선택 (3종)
                                </label>
                                <select
                                    value={scenario}
                                    onChange={e => setScenario(e.target.value)}
                                    className="w-full border-slate-200 rounded-lg text-sm p-3"
                                >
                                    <option value="standard">📅 [표준] 주 5~6일 근무 + 지원 30%</option>
                                    <option value="full">🔥 [풀가동] 휴일 없음 + 야근(1.5공수) 빈도 증가</option>
                                    <option value="random">🎲 [랜덤] 불규칙적 지원 및 공수 패턴</option>
                                </select>
                                <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                                    <p>• <strong>공수</strong>: 0.5 ~ 1.5 랜덤 배정</p>
                                    <p>• <strong>지원</strong>: 30% 확률로 타 현장(내부/외부) 지원 투입</p>
                                    <p>• <strong>작업자</strong>: 소속 팀/회사를 기반으로 논리적 연결</p>
                                </div>
                            </div>

                            <button
                                onClick={runSimulation}
                                disabled={loading || siteCount === 0}
                                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-bold transition-colors disabled:bg-slate-300 flex items-center justify-center gap-2"
                            >
                                <FontAwesomeIcon icon={faEye} />
                                시뮬레이션 미리보기
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-red-600">
                            <FontAwesomeIcon icon={faEraser} />
                            데이터 초기화
                        </h3>
                        <button
                            onClick={clearReports}
                            disabled={loading}
                            className="w-full bg-slate-100 text-red-600 border border-red-200 py-2.5 rounded-lg hover:bg-red-50 font-bold transition-colors disabled:opacity-50"
                        >
                            🗑️ 일보 데이터만 삭제
                        </button>
                    </div>
                </div>

                {/* 2. Result & Log Panel */}
                <div className="space-y-6">
                    {/* Preview Result */}
                    {simulation && (
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-6">
                            <h3 className="font-bold text-indigo-800 mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faChartSimple} />
                                시뮬레이션 결과
                            </h3>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-white p-3 rounded shadow-sm">
                                    <div className="text-xs text-slate-500">생성될 일보</div>
                                    <div className="text-xl font-bold text-slate-800">{simulation.totalReports.toLocaleString()}건</div>
                                </div>
                                <div className="bg-white p-3 rounded shadow-sm">
                                    <div className="text-xs text-slate-500">총 공수 합계</div>
                                    <div className="text-xl font-bold text-slate-800">{simulation.totalManDays.toLocaleString('ko-KR', { minimumFractionDigits: 1 })}</div>
                                </div>
                                <div className="bg-white p-3 rounded shadow-sm">
                                    <div className="text-xs text-slate-500">지원(Dispatch) 건수</div>
                                    <div className="text-xl font-bold text-orange-600">{simulation.supportCount.toLocaleString()}건</div>
                                </div>
                                <div className="bg-white p-3 rounded shadow-sm">
                                    <div className="text-xs text-slate-500">예상 인건비</div>
                                    <div className="text-xl font-bold text-slate-800">{(simulation.totalAmount / 100000000).toFixed(1)}억원</div>
                                </div>
                            </div>

                            <div className="text-xs text-slate-600 flex gap-4 mb-4 bg-white/50 p-2 rounded">
                                <span>🏢 내부지원: {simulation.internalSupportCount}건</span>
                                <span>🤝 외부지원: {simulation.externalSupportCount}건</span>
                            </div>

                            <button
                                onClick={saveToDatabase}
                                disabled={loading}
                                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                            >
                                <FontAwesomeIcon icon={faSave} />
                                데이터베이스 저장 확정
                            </button>
                        </div>
                    )}

                    {/* Logs */}
                    <div className="bg-slate-900 rounded-xl p-6 text-slate-300 font-mono text-sm h-64 overflow-y-auto shadow-inner">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                            <span className="font-bold text-white">처리 로그</span>
                            <button onClick={() => setLogs([])} className="text-xs hover:text-white">지우기</button>
                        </div>
                        <div className="space-y-1">
                            {logs.length === 0 && <span className="text-slate-600 italic">대기 중...</span>}
                            {logs.map((log, index) => (
                                <div key={index} className="break-all">
                                    <span className="text-green-500 mr-2">➜</span>
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestDailyReportGeneratorPage;
