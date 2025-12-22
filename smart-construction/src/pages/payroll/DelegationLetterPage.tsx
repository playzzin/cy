import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFileAlt, faBuilding, faUsers, faCalendarAlt, faCheckSquare, faSquare, faUserTie, faCopy } from '@fortawesome/free-solid-svg-icons';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';

// --- Types ---
interface DelegationWorker {
    workerId: string;
    workerName: string;
    idNumber: string;
    address: string;
    manDays: number;
    unitPrice: number; // Editable
    amount: number; // Calculated
    signatureUrl?: string;
}

const DelegationLetterPage: React.FC = () => {
    // --- State: Selections ---
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');

    // --- State: Data ---
    const [allReports, setAllReports] = useState<DailyReport[]>([]); // Reports for the month
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);

    // --- State: Logic ---
    const [loading, setLoading] = useState(false);
    const [delegationWorkers, setDelegationWorkers] = useState<DelegationWorker[]>([]);
    const [selectedDelegatorIds, setSelectedDelegatorIds] = useState<string[]>([]);
    const [batchUnitPrice, setBatchUnitPrice] = useState<string>('');
    const [copying, setCopying] = useState(false);

    // --- State: UI ---
    const printRef = useRef<HTMLDivElement>(null);

    // --- 1. Initial Load (Static Data) ---
    useEffect(() => {
        const loadStaticData = async () => {
            try {
                const [fetchedSites, fetchedTeams, fetchedWorkers] = await Promise.all([
                    siteService.getSites(),
                    teamService.getTeams(),
                    manpowerService.getWorkers()
                ]);
                setSites(fetchedSites);
                setTeams(fetchedTeams);
                setAllWorkers(fetchedWorkers);
            } catch (error) {
                console.error("Failed to load static data:", error);
            }
        };
        loadStaticData();
    }, []);

    // --- 2. Cascade Step 1: Month Selection -> Fetch Reports ---
    useEffect(() => {
        const fetchReportsForMonth = async () => {
            if (!selectedMonth) return;
            setLoading(true);
            try {
                // Get start and end of month
                const [yearStr, monthStr] = selectedMonth.split('-');
                const year = Number(yearStr);
                const month = Number(monthStr);
                const startDate = `${selectedMonth}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

                const reports = await dailyReportService.getReportsByRange(startDate, endDate);
                setAllReports(reports);

                // Reset downstream selections when month changes
                setSelectedSiteId('');
                setSelectedTeamId('');
                setSelectedLeaderId('');
                setDelegationWorkers([]);
            } catch (error) {
                console.error("Failed to fetch reports:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReportsForMonth();
    }, [selectedMonth]);

    // --- 3. Derived Logic: Active Sites ---
    const activeSites = useMemo(() => {
        // Filter sites that appear in the reports
        const siteIdsInReports = new Set(allReports.map(r => r.siteId));
        return sites.filter(s => siteIdsInReports.has(s.id!));
    }, [allReports, sites]);

    // --- 4. Derived Logic: Active Teams (Dependent on Site) ---
    const activeTeams = useMemo(() => {
        if (!selectedSiteId) return [];
        // Filter reports for selected site
        const siteReports = allReports.filter(r => r.siteId === selectedSiteId);
        const teamIdsInReports = new Set(siteReports.map(r => r.teamId));
        return teams.filter(t => teamIdsInReports.has(t.id!));
    }, [selectedSiteId, allReports, teams]);

    // --- 5. Logic: Fetch & Process Workers (Dependent on Team) ---
    useEffect(() => {
        if (!selectedTeamId || !selectedSiteId) {
            setDelegationWorkers([]);
            setSelectedDelegatorIds([]);
            setSelectedLeaderId('');
            return;
        }

        // 1. Filter reports for this specific Team AND Site AND Month
        const relevantReports = allReports.filter(r => r.teamId === selectedTeamId && r.siteId === selectedSiteId);

        // 2. Aggregate ManDays per Worker
        const workerStats: Record<string, number> = {};
        relevantReports.forEach(report => {
            report.workers.forEach(w => {
                if (w.manDay > 0) {
                    workerStats[w.workerId] = (workerStats[w.workerId] || 0) + w.manDay;
                }
            });
        });

        // 3. Map to DelegationWorker
        const workers: DelegationWorker[] = [];
        Object.entries(workerStats).forEach(([workerId, manDays]) => {
            const workerInfo = allWorkers.find(w => w.id === workerId);
            if (workerInfo) {
                workers.push({
                    workerId: workerInfo.id!,
                    workerName: workerInfo.name,
                    idNumber: workerInfo.idNumber || '',
                    address: workerInfo.address || '',
                    signatureUrl: workerInfo.signatureUrl,
                    manDays: manDays,
                    unitPrice: workerInfo.unitPrice || 0,
                    amount: manDays * (workerInfo.unitPrice || 0)
                });
            }
        });

        setDelegationWorkers(workers);
        setSelectedDelegatorIds(workers.map(w => w.workerId)); // Select all by default

        // 4. Auto-select Mandatary (Team Leader)
        // Find a worker in the full list who is in this team and has role '팀장'
        // OR use the team's defined leaderId
        const currentTeam = teams.find(t => t.id === selectedTeamId);
        let leaderCandidateId = '';

        if (currentTeam?.leaderId) {
            leaderCandidateId = currentTeam.leaderId;
        } else {
            // Fallback: find any '팀장' in this team
            const leader = allWorkers.find(w => w.teamId === selectedTeamId && w.role === '팀장');
            if (leader) leaderCandidateId = leader.id!;
        }

        // Only set if the candidate is valid (exists in DB, even if not working this month?)
        // Actually, Mandatary MUST be someone valid.
        if (leaderCandidateId) {
            setSelectedLeaderId(leaderCandidateId);
        }

    }, [selectedTeamId, selectedSiteId, allReports, allWorkers, teams]);

    // --- 6. Handlers ---

    const handleUnitPriceChange = (workerId: string, newPrice: number) => {
        setDelegationWorkers(prev => prev.map(w => {
            if (w.workerId === workerId) {
                return { ...w, unitPrice: newPrice, amount: w.manDays * newPrice };
            }
            return w;
        }));
    };

    const handleBatchUnitPriceApply = () => {
        const price = parseInt(batchUnitPrice.replace(/,/g, ''), 10);
        if (isNaN(price)) return;

        // Apply only to displayed workers
        setDelegationWorkers(prev => prev.map(w => ({
            ...w,
            unitPrice: price,
            amount: w.manDays * price
        })));
    };

    const toggleDelegator = (workerId: string) => {
        if (workerId === selectedLeaderId) return; // Cannot toggle mandatary if they are in the list
        setSelectedDelegatorIds(prev =>
            prev.includes(workerId)
                ? prev.filter(id => id !== workerId)
                : [...prev, workerId]
        );
    };

    // --- 7. Copy to Clipboard Logic ---
    const handleCopyToClipboard = async () => {
        if (!printRef.current) return;
        setCopying(true);

        try {
            // Force white background for the capture
            // Cast html2canvas to any because of version mismatch with @types/html2canvas (0.5.x vs 1.4.x)
            const canvas = await (html2canvas as any)(printRef.current, {
                scale: 1.5, // Reasonable scale for clipboard
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true // Important for images (signatures)
            });

            canvas.toBlob(async (blob: Blob | null) => {
                if (!blob) {
                    alert('이미지 생성에 실패했습니다.');
                    setCopying(false);
                    return;
                }

                try {
                    // Safe ClipboardItem usage
                    const ClipboardItem = (window as any).ClipboardItem;
                    if (!ClipboardItem) {
                        alert('이 브라우저는 이미지 복사를 지원하지 않습니다.');
                        setCopying(false);
                        return;
                    }

                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob
                        })
                    ]);
                    alert('위임장이 이미지로 복사되었습니다.\nCtrl+V로 붙여넣으세요.');
                } catch (err) {
                    console.error('Clipboard write failed:', err);
                    alert('클립보드 복사에 실패했습니다. 권한을 확인해주세요.');
                }
                setCopying(false);
            }, 'image/png');

        } catch (error) {
            console.error('Capture failed:', error);
            alert('이미지 생성 중 오류가 발생했습니다.');
            setCopying(false);
        }
    };

    const formatDate = (date: Date) => {
        return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
    };

    // --- 8. Final Preparation for View ---
    const selectedMonthParts = selectedMonth.split('-');
    const yearLabel = selectedMonthParts[0].slice(2);
    const monthLabel = Number(selectedMonthParts[1]);

    const mandatary = allWorkers.find(w => w.id === selectedLeaderId);

    // Filter out Mandatary from Delegator list for the VIEW (Table)
    const finalDelegators = delegationWorkers.filter(w =>
        selectedDelegatorIds.includes(w.workerId) && w.workerId !== selectedLeaderId
    );

    const totalAmount = finalDelegators.reduce((sum, w) => sum + w.amount, 0);

    // --- Render ---
    // Helper to check if data loaded
    const allSitesLoaded = sites.length > 0;

    // --- Render ---
    if (loading && !allSitesLoaded) { // Simple loading check
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-600 mb-4" />
                    <p className="text-slate-500 font-medium">데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 p-6 flex flex-col lg:flex-row gap-6">
            {/* --- Left Panel: Settings --- */}
            <div className="w-full lg:w-96 flex flex-col gap-4 h-fit no-print">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileAlt} className="text-blue-600" />
                        위임장 설정
                    </h2>

                    <div className="space-y-4">
                        {/* 1. Month */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">근무 월</label>
                            <div className="relative">
                                <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="w-full pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* 2. Site (Filtered) */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">현장 선택 (일보 기준)</label>
                            <div className="relative">
                                <FontAwesomeIcon icon={faBuilding} className="absolute left-3 top-2.5 text-slate-400" />
                                <select
                                    value={selectedSiteId}
                                    onChange={(e) => {
                                        setSelectedSiteId(e.target.value);
                                        setSelectedTeamId(''); // Reset team
                                    }}
                                    disabled={loading || activeSites.length === 0}
                                    className="w-full pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100"
                                >
                                    <option value="">{loading ? '데이터 조회 중...' : '현장 선택'}</option>
                                    {activeSites.map(site => (
                                        <option key={site.id} value={site.id}>{site.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 3. Team (Filtered) */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">팀 선택 (일보 기준)</label>
                            <div className="relative">
                                <FontAwesomeIcon icon={faUsers} className="absolute left-3 top-2.5 text-slate-400" />
                                <select
                                    value={selectedTeamId}
                                    onChange={(e) => setSelectedTeamId(e.target.value)}
                                    disabled={!selectedSiteId || activeTeams.length === 0}
                                    className="w-full pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100"
                                >
                                    <option value="">팀 선택</option>
                                    {activeTeams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <hr className="border-slate-200 my-2" />

                        {/* 4. Mandatary (Team Leader) */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                수임인 (팀장/대표)
                                <span className="text-xs text-blue-600 ml-2 font-normal">* 위임자 목록에서 제외됩니다.</span>
                            </label>
                            <div className="relative">
                                <FontAwesomeIcon icon={faUserTie} className="absolute left-3 top-2.5 text-slate-400" />
                                <select
                                    value={selectedLeaderId}
                                    onChange={(e) => setSelectedLeaderId(e.target.value)}
                                    className="w-full pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">수임인 선택</option>
                                    {/* Show ALL workers in this team who are leaders, OR just all workers in team if needed */}
                                    {/* User asked for "Team Leader role" */}
                                    {allWorkers
                                        .filter(w => (w.teamId === selectedTeamId && w.role === '팀장') || w.id === teams.find(t => t.id === selectedTeamId)?.leaderId)
                                        .map(worker => (
                                            <option key={worker.id} value={worker.id}>
                                                {worker.name} {worker.role === '팀장' ? '(팀장)' : ''}
                                            </option>
                                        ))
                                    }
                                    {/* Fallback: Allow selecting ANY worker from the team if needed? User said "Team Leader role" */}
                                    <optgroup label="기타 팀원">
                                        {allWorkers
                                            .filter(w => w.teamId === selectedTeamId && w.role !== '팀장')
                                            .map(worker => (
                                                <option key={worker.id} value={worker.id}>{worker.name}</option>
                                            ))
                                        }
                                    </optgroup>
                                </select>
                            </div>
                        </div>

                        {/* 5. Delegators (Workers) Logic */}
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label className="block text-sm font-medium text-slate-700">작업자 및 단가 설정</label>
                            </div>

                            {/* Batch Unit Price */}
                            <div className="flex gap-2 mb-2 p-2 bg-slate-50 rounded border border-slate-200">
                                <input
                                    type="text"
                                    placeholder="단가 일괄 입력"
                                    value={batchUnitPrice}
                                    onChange={(e) => setBatchUnitPrice(e.target.value)}
                                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
                                />
                                <button
                                    onClick={handleBatchUnitPriceApply}
                                    className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                                >
                                    일괄 적용
                                </button>
                            </div>

                            <div className="border border-slate-300 rounded-lg max-h-80 overflow-y-auto bg-slate-50 p-2 space-y-2">
                                {delegationWorkers.length === 0 ? (
                                    <p className="text-xs text-slate-500 text-center py-4">
                                        {!selectedTeamId ? '팀을 선택해주세요.' : '해당 기간/현장에 근무 이력이 없습니다.'}
                                    </p>
                                ) : (
                                    delegationWorkers.map(worker => {
                                        const isMandatary = worker.workerId === selectedLeaderId;
                                        return (
                                            <div key={worker.workerId} className={`p-2 rounded border ${isMandatary ? 'bg-slate-200 border-slate-300' : 'bg-white border-slate-200'}`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <button
                                                        onClick={() => !isMandatary && toggleDelegator(worker.workerId)}
                                                        disabled={isMandatary}
                                                        className={`text-lg ${selectedDelegatorIds.includes(worker.workerId) || isMandatary ? 'text-blue-600' : 'text-slate-300'}`}
                                                    >
                                                        <FontAwesomeIcon icon={selectedDelegatorIds.includes(worker.workerId) ? faCheckSquare : faSquare} />
                                                    </button>
                                                    <span className={`text-sm ${isMandatary ? 'font-bold' : ''}`}>
                                                        {worker.workerName}
                                                        {isMandatary && <span className="text-xs text-slate-500 ml-1">(수임인)</span>}
                                                    </span>
                                                    <span className="ml-auto text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{worker.manDays}공수</span>
                                                </div>

                                                {!isMandatary && selectedDelegatorIds.includes(worker.workerId) && (
                                                    <div className="flex items-center gap-2 pl-6">
                                                        <span className="text-xs text-slate-500">단가:</span>
                                                        <input
                                                            type="number"
                                                            value={worker.unitPrice}
                                                            onChange={(e) => handleUnitPriceChange(worker.workerId, Number(e.target.value))}
                                                            className="w-24 px-2 py-1 text-xs border border-slate-300 rounded text-right"
                                                        />
                                                        <span className="text-xs text-slate-500">= {(worker.amount).toLocaleString()}원</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleCopyToClipboard}
                            disabled={finalDelegators.length === 0 || copying}
                            className={`w-full mt-4 text-white px-4 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-md ${copying ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                        >
                            <FontAwesomeIcon icon={copying ? faSpinner : faCopy} spin={copying} />
                            {copying ? '이미지 생성 중...' : '위임장 복사 (이미지)'}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- Right Panel: Preview (Target for html2canvas) --- */}
            <div className="flex-1 bg-slate-200 overflow-auto rounded-xl p-4 lg:p-8 flex justify-center">
                <div
                    ref={printRef}
                    className="bg-white shadow-lg mx-auto box-border"
                    style={{
                        width: '210mm',
                        minHeight: '297mm',
                        padding: '15mm',
                        fontFamily: '"Malgun Gothic", "Dotum", sans-serif'
                    }}
                >
                    {/* 제목 */}
                    <h1 className="text-3xl font-extrabold text-center mb-8 tracking-[0.5em] text-black">위 임 장</h1>

                    {/* 수임인 정보 테이블 */}
                    <table className="w-full border-collapse border border-black text-[13px] mb-6">
                        <tbody>
                            <tr>
                                <th className="border border-black bg-slate-50 px-2 py-2 text-center w-[15%] font-bold">수임인</th>
                                <th className="border border-black bg-slate-50 px-2 py-2 text-center w-[20%] font-bold">주민등록번호</th>
                                <td className="border border-black px-2 py-2 text-center text-base">{mandatary?.idNumber || ''}</td>
                                <th className="border border-black bg-slate-50 px-2 py-2 text-center w-[15%] font-bold">주 소</th>
                                <td colSpan={3} className="border border-black px-2 py-2 text-left">{mandatary?.address || ''}</td>
                            </tr>
                            <tr>
                                <td className="border border-black px-2 py-2 text-center text-lg font-bold">{mandatary?.name || ''}</td>
                                <th className="border border-black bg-slate-50 px-2 py-2 text-center font-bold">연락처</th>
                                <td className="border border-black px-2 py-2 text-center">{mandatary?.contact || ''}</td>
                                <th className="border border-black bg-slate-50 px-2 py-2 text-center font-bold">서명 또는 인</th>
                                <td colSpan={3} className="border border-black px-2 py-2 text-center h-16 w-[20%] relative">
                                    {mandatary?.signatureUrl && (
                                        <img src={mandatary.signatureUrl} alt="서명" className="h-12 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 object-contain" />
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* 위임사항 */}
                    <div className="text-center mb-6">
                        <p className="font-bold text-base mb-2">- 위 임 사 항 -</p>
                        <div className="bg-slate-50/50 py-3 px-4 border-t border-b border-black/10 inline-block w-full">
                            ( <span className="font-bold border-b border-black px-2 text-lg">{sites.find(s => s.id === selectedSiteId)?.name || '　　　　　'}</span> ) 에서 발생한
                            <span className="font-bold border-b border-black px-2 mx-2 text-lg">{yearLabel}년 {monthLabel}월</span> 분
                            <br />
                            <span className="font-bold mt-2 inline-block">노무비 청구 및 수령에 대한 권한 일체</span>
                        </div>
                    </div>

                    {/* 은행 정보 (수임인 계좌) */}
                    <table className="w-full border-collapse border border-black text-[13px] mb-6">
                        <tbody>
                            <tr>
                                <th className="border border-black bg-slate-50 px-4 py-2 text-center w-[15%] font-bold">은 행</th>
                                <td className="border border-black px-4 py-2 w-[25%] font-medium text-center">{mandatary?.bankName || ''}</td>
                                <th className="border border-black bg-slate-50 px-4 py-2 text-center w-[15%] font-bold">계좌번호</th>
                                <td className="border border-black px-4 py-2 font-medium text-center">{mandatary?.accountNumber || ''}</td>
                                <th className="border border-black bg-slate-50 px-4 py-2 text-center w-[15%] font-bold">예금주</th>
                                <td className="border border-black px-4 py-2 w-[15%] font-medium text-center">{mandatary?.accountHolder || mandatary?.name || ''}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* 날짜/서명 */}
                    <div className="text-center font-bold text-base mb-6">
                        {formatDate(new Date())}
                    </div>

                    <p className="text-center font-bold text-sm mb-2">- 아 래 -</p>

                    {/* 위임인 목록 테이블 */}
                    <table className="w-full border-collapse border border-black text-[12px]">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="border border-black px-1 py-1.5 w-[8%] text-center">번호</th>
                                <th className="border border-black px-1 py-1.5 w-[15%] text-center">위임인</th>
                                <th className="border border-black px-1 py-1.5 w-[20%] text-center">주민등록번호</th>
                                <th className="border border-black px-1 py-1.5 text-center">주 소</th>
                                <th className="border border-black px-1 py-1.5 w-[15%] text-center">청구금액</th>
                                <th className="border border-black px-1 py-1.5 w-[15%] text-center">서명 또는 인</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finalDelegators.map((worker, index) => (
                                <tr key={worker.workerId}>
                                    <td className="border border-black px-1 py-1.5 text-center">{index + 1}</td>
                                    <td className="border border-black px-2 py-1.5 text-center font-medium">{worker.workerName}</td>
                                    <td className="border border-black px-1 py-1.5 text-center tracking-tight">{worker.idNumber}</td>
                                    <td className="border border-black px-2 py-1.5 text-left tracking-tight truncate max-w-[150px]">{worker.address}</td>
                                    <td className="border border-black px-2 py-1.5 text-right">{worker.amount.toLocaleString()}</td>
                                    <td className="border border-black px-1 py-0 text-center h-10 w-24 relative overflow-hidden">
                                        {worker.signatureUrl && (
                                            <img src={worker.signatureUrl} alt="서명" className="h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 object-contain" />
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {/* 합계 행 */}
                            <tr className="bg-slate-50 font-bold">
                                <td colSpan={4} className="border border-black px-2 py-2 text-center text-[13px]">합계</td>
                                <td className="border border-black px-2 py-2 text-right text-[13px]">{totalAmount.toLocaleString()}</td>
                                <td className="border border-black px-2 py-2 bg-slate-100"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DelegationLetterPage;
