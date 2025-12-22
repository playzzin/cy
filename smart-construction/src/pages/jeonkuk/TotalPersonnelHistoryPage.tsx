import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faFileInvoiceDollar, faDownload, faSync } from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import * as XLSX from 'xlsx-js-style';

interface PersonnelHistory {
    workerId: string;
    name: string;
    idNumber: string;
    salaryModel: string;
    teamName: string;
    totalManDay: number;
    unitPrice: number;
    totalAmount: number;
}

const TotalPersonnelHistoryPage: React.FC = () => {
    // Date helpers
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // State
    const [startDate, setStartDate] = useState(formatDate(firstDay));
    const [endDate, setEndDate] = useState(formatDate(lastDay));
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [companyTypeFilter, setCompanyTypeFilter] = useState<'all' | 'construction' | 'partner'>('all');
    const [historyData, setHistoryData] = useState<PersonnelHistory[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // 이름 정렬

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [fetchedTeams, fetchedCompanies, fetchedWorkers] = await Promise.all([
                teamService.getTeams(),
                companyService.getCompanies(),
                manpowerService.getWorkers()
            ]);
            setTeams(fetchedTeams);
            setCompanies(fetchedCompanies);
            setAllWorkers(fetchedWorkers);
        } catch (error) {
            console.error("Error fetching initial data:", error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const workers = await manpowerService.getWorkers();
            const workerMap = new Map<string, Worker>();
            workers.forEach(w => { if (w.id) workerMap.set(w.id, w); });

            const reports = await dailyReportService.getReportsByRange(startDate, endDate);
            const statsMap = new Map<string, { manDay: number, amount: number }>();
            const salaryModelMap = new Map<string, string>();

            const teamMap = new Map<string, Team>();
            teams.forEach(t => { if (t.id) teamMap.set(t.id, t); });

            const companyMap = new Map<string, Company>();
            companies.forEach(c => { if (c.id) companyMap.set(c.id, c); });

            reports.forEach(report => {
                const reportTeam = teamMap.get(report.teamId);

                // Filter by Company Type
                if (companyTypeFilter !== 'all') {
                    if (!reportTeam || !reportTeam.companyId) return;
                    const company = companyMap.get(reportTeam.companyId);
                    if (!company) return;
                    if (companyTypeFilter === 'construction' && company.type !== '시공사') return;
                    if (companyTypeFilter === 'partner' && company.type !== '협력사') return;
                }

                // Filter by team
                if (selectedTeamId && report.teamId !== selectedTeamId) return;

                report.workers.forEach(reportWorker => {
                    const workerId = reportWorker.workerId;
                    if (selectedWorkerId && workerId !== selectedWorkerId) return;

                    const workerInfo = workerMap.get(workerId);
                    if (!workerInfo) return;

                    const snapshotSalaryModel =
                        typeof reportWorker.salaryModel === 'string' && reportWorker.salaryModel.trim().length > 0
                            ? reportWorker.salaryModel
                            : typeof reportWorker.payType === 'string' && reportWorker.payType.trim().length > 0
                                ? reportWorker.payType
                                : workerInfo.teamType === '지원팀'
                                    ? '지원팀'
                                    : workerInfo.teamType === '용역팀'
                                        ? '용역팀'
                                        : '일급제';

                    if (selectedType && snapshotSalaryModel !== selectedType) return;

                    const prevSalaryModel = salaryModelMap.get(workerId);
                    if (!prevSalaryModel) {
                        salaryModelMap.set(workerId, snapshotSalaryModel);
                    } else if (prevSalaryModel !== snapshotSalaryModel && prevSalaryModel !== '혼합') {
                        salaryModelMap.set(workerId, '혼합');
                    }

                    const currentStats = statsMap.get(workerId) || { manDay: 0, amount: 0 };
                    const unitPrice = reportWorker.unitPrice || workerInfo.unitPrice || 0;
                    const amount = reportWorker.manDay * unitPrice;

                    statsMap.set(workerId, {
                        manDay: currentStats.manDay + reportWorker.manDay,
                        amount: currentStats.amount + amount
                    });
                });
            });

            const result: PersonnelHistory[] = [];
            statsMap.forEach((stats, workerId) => {
                const worker = workerMap.get(workerId);
                if (worker) {
                    const displaySalaryModel =
                        salaryModelMap.get(workerId) ||
                        (worker.teamType === '지원팀'
                            ? '지원팀'
                            : worker.teamType === '용역팀'
                                ? '용역팀'
                                : '일급제');

                    result.push({
                        workerId,
                        name: worker.name,
                        idNumber: worker.idNumber,
                        salaryModel: displaySalaryModel,
                        teamName: worker.teamName || '',
                        totalManDay: stats.manDay,
                        unitPrice: worker.unitPrice,
                        totalAmount: stats.amount
                    });
                }
            });

            result.sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
            setHistoryData(result);
        } catch (error) {
            console.error("Error fetching history data:", error);
            alert("데이터 조회 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadExcel = () => {
        if (historyData.length === 0) {
            alert('다운로드할 데이터가 없습니다. 먼저 조회해주세요.');
            return;
        }

        // Style definitions
        const borderStyle = { style: 'thin', color: { rgb: '000000' } };
        const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

        const titleStyle = {
            font: { bold: true, sz: 16, color: { rgb: '006400' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'E8F5E9' } }
        };

        const dateStyle = {
            font: { sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center' }
        };

        const headerStyle = {
            font: { bold: true, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'FFFF00' } },
            border: borders
        };

        const cellStyle = {
            font: { sz: 10 },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: borders
        };

        const numberStyle = {
            font: { sz: 10 },
            alignment: { horizontal: 'right', vertical: 'center' },
            border: borders,
            numFmt: '#,##0'
        };

        const totalLabelStyle = {
            font: { bold: true, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'E3F2FD' } },
            border: borders
        };

        const totalValueStyle = {
            font: { bold: true, sz: 11, color: { rgb: '1565C0' } },
            alignment: { horizontal: 'right', vertical: 'center' },
            fill: { fgColor: { rgb: 'E3F2FD' } },
            border: borders,
            numFmt: '#,##0'
        };

        // Calculate total
        const totalAmount = historyData.reduce((sum, item) => sum + item.totalAmount, 0);

        // Build styled data
        const wsData: any[][] = [];

        // Row 0: Title
        wsData.push([
            { v: '세무서 제출 자료', s: titleStyle },
            { v: '', s: titleStyle },
            { v: '', s: titleStyle },
            { v: '', s: titleStyle }
        ]);

        // Row 1: Date range
        wsData.push([
            { v: `기간 : ${startDate} ~ ${endDate}`, s: dateStyle },
            { v: '', s: dateStyle },
            { v: '', s: dateStyle },
            { v: '', s: dateStyle }
        ]);

        // Row 2: Headers
        wsData.push([
            { v: '번호', s: headerStyle },
            { v: '이름', s: headerStyle },
            { v: '주민등록번호', s: headerStyle },
            { v: '본봉', s: headerStyle }
        ]);

        // Data rows
        historyData.forEach((item, index) => {
            wsData.push([
                { v: index + 1, s: cellStyle },
                { v: item.name, s: cellStyle },
                { v: item.idNumber, s: cellStyle },
                { v: item.totalAmount.toLocaleString(), t: 's', s: numberStyle }
            ]);
        });

        // Summary row
        wsData.push([
            { v: '', s: totalLabelStyle },
            { v: '', s: totalLabelStyle },
            { v: '합계', s: totalLabelStyle },
            { v: totalAmount.toLocaleString(), t: 's', s: totalValueStyle }
        ]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column widths
        ws['!cols'] = [
            { wch: 8 },   // 번호
            { wch: 12 },  // 이름
            { wch: 18 },  // 주민등록번호
            { wch: 15 }   // 본봉
        ];

        // Merge title and date rows
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }
        ];

        // Set row heights
        ws['!rows'] = [
            { hpt: 28 },  // Title row
            { hpt: 22 },  // Date row
            { hpt: 22 }   // Header row
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "세무서제출자료");
        XLSX.writeFile(wb, `세무서제출자료_${startDate}_${endDate}.xlsx`);
    };

    const handleSyncPartner = async () => {
        if (!window.confirm('협력사 소속 작업자들의 급여방식을 "지원팀"으로 일괄 동기화합니다. 계속하시겠습니까?')) return;
        try {
            const result = await manpowerService.syncPartnerCompanyWorkersTeamType();
            if (result.updated > 0) {
                alert(`${result.updated}명의 작업자가 "지원팀"으로 동기화되었습니다.`);
            } else if (result.errors.length > 0) {
                alert(`동기화 실패: ${result.errors.join(', ')}`);
            } else {
                alert('동기화할 작업자가 없습니다. (이미 모두 동기화됨)');
            }
        } catch (error) {
            alert('동기화 중 오류가 발생했습니다.');
            console.error(error);
        }
    };

    const handleSyncReports = async () => {
        if (!window.confirm('기존 일보의 작업자별 급여방식을 일괄 동기화합니다. 시간이 걸릴 수 있습니다. 계속하시겠습니까?')) return;
        try {
            const result = await dailyReportService.syncReportsSalaryModel();
            if (result.updated > 0) {
                alert(`${result.updated}개의 일보가 동기화되었습니다.`);
            } else if (result.errors.length > 0) {
                alert(`동기화 실패: ${result.errors.join(', ')}`);
            } else {
                alert('동기화할 일보가 없습니다. (이미 모두 동기화됨)');
            }
        } catch (error) {
            alert('동기화 중 오류가 발생했습니다.');
            console.error(error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600" />
                        인원 전체내역 조회
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        기간별 전체 인원의 공수 및 급여 내역을 조회하고 엑셀로 다운로드합니다.
                    </p>
                </div>
                {/* Header Buttons Row */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownloadExcel}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm font-medium text-sm"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        세무용 Excel
                    </button>
                    <button
                        onClick={handleSyncPartner}
                        className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all shadow-sm font-medium text-sm"
                    >
                        <FontAwesomeIcon icon={faSync} />
                        협력사
                    </button>
                    <button
                        onClick={handleSyncReports}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all shadow-sm font-medium text-sm"
                    >
                        <FontAwesomeIcon icon={faSync} />
                        일보
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
                {/* Filter Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 flex-shrink-0">
                    {/* Row 1: Quick Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Company Type Buttons */}
                        <div className="flex items-center gap-1 border-r border-slate-200 pr-3 mr-1">
                            <button
                                onClick={() => { setCompanyTypeFilter('all'); setSelectedType(''); }}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${companyTypeFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >전체</button>
                            <button
                                onClick={() => { setCompanyTypeFilter('construction'); setSelectedType('일급제'); }}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${companyTypeFilter === 'construction' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                            >시공팀</button>
                            <button
                                onClick={() => { setCompanyTypeFilter('partner'); setSelectedType('지원팀'); }}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${companyTypeFilter === 'partner' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                            >협력사</button>
                        </div>

                        {/* Salary Model Buttons */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setSelectedType('')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${selectedType === '' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >전체급여</button>
                            <button
                                onClick={() => setSelectedType('일급제')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${selectedType === '일급제' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                            >일급제</button>
                            <button
                                onClick={() => setSelectedType('월급제')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${selectedType === '월급제' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
                            >월급제</button>
                            <button
                                onClick={() => setSelectedType('지원팀')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${selectedType === '지원팀' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                            >지원팀</button>
                        </div>

                        {/* Sort Order Toggle */}
                        <button
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${sortOrder === 'asc' ? 'bg-indigo-500 text-white' : 'bg-amber-500 text-white'}`}
                        >
                            {sortOrder === 'asc' ? '이름 ㄱ→ㅎ' : '이름 ㅎ→ㄱ'}
                        </button>
                    </div>

                    {/* Row 2: Date & Filters + Search Button */}
                    <div className="flex flex-wrap items-end gap-3">
                        {/* Date Range */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                <label className="text-xs font-medium text-slate-500">시작일</label>
                                <button onClick={() => {
                                    const t = new Date();
                                    setStartDate(formatDate(new Date(t.getFullYear(), t.getMonth() - 1, 1)));
                                    setEndDate(formatDate(new Date(t.getFullYear(), t.getMonth(), 0)));
                                }} className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded">전달</button>
                                <button onClick={() => {
                                    const t = new Date();
                                    setStartDate(formatDate(new Date(t.getFullYear(), t.getMonth(), 1)));
                                    setEndDate(formatDate(t));
                                }} className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded">이달</button>
                            </div>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-36" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-500">종료일</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-36" />
                        </div>

                        {/* Team Select */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-500">팀</label>
                            <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-32">
                                <option value="">전체 팀</option>
                                {teams.filter(team => {
                                    if (companyTypeFilter === 'all') return true;
                                    const company = companies.find(c => c.id === team.companyId);
                                    if (!company) return false;
                                    if (companyTypeFilter === 'construction') return company.type === '시공사';
                                    if (companyTypeFilter === 'partner') return company.type === '협력사';
                                    return true;
                                }).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                            </select>
                        </div>

                        {/* Worker Select */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-500">작업자</label>
                            <select value={selectedWorkerId} onChange={(e) => setSelectedWorkerId(e.target.value)}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-32">
                                <option value="">전체 작업자</option>
                                {allWorkers
                                    .filter(w => !selectedTeamId || w.teamId === selectedTeamId)
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(worker => (
                                        <option key={worker.id} value={worker.id}>
                                            {worker.name} ({worker.idNumber?.slice(0, 6) || '-'})
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Search Button */}
                        <button onClick={fetchData}
                            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md font-bold flex items-center gap-2 text-sm">
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-1.5 h-5 bg-blue-600 rounded-sm"></span>
                            조회 결과
                            <span className="text-slate-400 font-normal text-sm">({historyData.length.toLocaleString()}건)</span>
                        </h3>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2 text-center w-12">No</th>
                                    <th className="px-4 py-2">이름</th>
                                    <th className="px-4 py-2">주민번호</th>
                                    <th className="px-4 py-2">급여방식</th>
                                    <th className="px-4 py-2">팀명</th>
                                    <th className="px-4 py-2 text-right">공수</th>
                                    <th className="px-4 py-2 text-right">단가</th>
                                    <th className="px-4 py-2 text-right">본봉</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                <span>데이터 분석 중...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : historyData.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500 bg-slate-50/50">
                                            <FontAwesomeIcon icon={faSearch} className="text-2xl text-slate-300 mb-2" />
                                            <p className="font-medium">조회된 데이터가 없습니다.</p>
                                            <p className="text-xs text-slate-400">검색 조건을 변경하여 다시 조회해보세요.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    historyData.map((item, index) => (
                                        <tr key={item.workerId} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="px-4 py-3 text-center text-slate-400 text-xs">{index + 1}</td>
                                            <td className="px-4 py-3 font-bold text-slate-800">{item.name}</td>
                                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{item.idNumber}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.salaryModel === '일급제' ? 'bg-blue-50 text-blue-600' :
                                                    item.salaryModel === '월급제' ? 'bg-indigo-50 text-indigo-600' :
                                                        item.salaryModel === '지원팀' ? 'bg-green-50 text-green-600' :
                                                            item.salaryModel === '용역팀' ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-600'
                                                    }`}>{item.salaryModel}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{item.teamName || '-'}</td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-700">{item.totalManDay.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs">{item.unitPrice.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-bold text-blue-600 font-mono">{item.totalAmount.toLocaleString()}</span>
                                                <span className="text-xs text-slate-400 ml-1">원</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {!loading && historyData.length > 0 && (
                                <tfoot className="bg-slate-50 font-bold border-t border-slate-200 sticky bottom-0">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-center text-slate-600">전체 합계</td>
                                        <td className="px-4 py-3 text-right text-slate-800 font-mono">
                                            {historyData.reduce((sum, item) => sum + item.totalManDay, 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3 text-right text-blue-700 font-mono">
                                            {historyData.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()}원
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TotalPersonnelHistoryPage;
