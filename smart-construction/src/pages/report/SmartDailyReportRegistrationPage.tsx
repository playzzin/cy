import SmartExcelGrid from './SmartExcelGrid';

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaste, faSave, faCheckCircle, faExclamationTriangle, faSpinner, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import Swal from 'sweetalert2';

const FIELD_LABELS: { [key: string]: string } = {
    date: '날짜',
    siteName: '현장명',
    teamName: '팀명',
    workerName: '성명',
    manDay: '공수',
    unitPrice: '단가',
    workContent: '작업내용',
    payType: '구분'
};

const SmartDailyReportRegistrationPage: React.FC = () => {
    // Data States
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mappedFields, setMappedFields] = useState<{ [index: number]: string }>({});
    const [loading, setLoading] = useState(false);

    // Lookups
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);

    useEffect(() => {
        const fetchLookups = async () => {
            try {
                const [teamsData, sitesData] = await Promise.all([
                    teamService.getTeams(),
                    siteService.getSites()
                ]);
                setTeams(teamsData);
                setSites(sitesData);
            } catch (error) {
                console.error("Error fetching lookups:", error);
            }
        };
        fetchLookups();
    }, []);

    const handleSave = async () => {
        const validRows = parsedData.filter(r => r._valid);
        if (validRows.length === 0) {
            Swal.fire('Error', '저장할 유효한 데이터가 없습니다.', 'error');
            return;
        }

        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const row of validRows) {
                try {
                    // Find Site ID and Team ID
                    const site = sites.find(s => s.name === row.siteName);
                    const team = teams.find(t => t.name === row.teamName);

                    if (!site) throw new Error(`현장을 찾을 수 없음: ${row.siteName}`);
                    if (!team) throw new Error(`팀을 찾을 수 없음: ${row.teamName}`);

                    await dailyReportService.addWorkerToReport(
                        row.date,
                        team.id!,
                        team.name,
                        site.id!,
                        site.name,
                        {
                            workerId: `temp_${Date.now()}_${Math.random()}`,
                            name: row.workerName,
                            role: '일용직',
                            status: 'attendance',
                            manDay: parseFloat(row.manDay),
                            unitPrice: 0,
                            workContent: row.workContent || '',
                            teamId: team.id
                        }
                    );
                    successCount++;
                } catch (error) {
                    console.error("Failed to add report entry:", row, error);
                    failCount++;
                }
            }

            Swal.fire({
                title: '완료',
                text: `성공: ${successCount}건, 실패: ${failCount}건`,
                icon: failCount > 0 ? 'warning' : 'success'
            });

            if (successCount > 0) {
                setParsedData([]);
                setHeaders([]);
            }

        } catch (error) {
            console.error("Batch save error:", error);
            Swal.fire('Error', '저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ... (keep useEffect)

    const handleGridChange = (data: any[]) => {
        // Map grid data to component state
        const mapped = data.map((row, idx) => {
            const { date, siteName, responsibleTeamName, name, teamName, manDay, workContent, payType } = row;

            const rowData: any = {
                _valid: true,
                _errors: [],
                date: date || new Date().toISOString().split('T')[0],
                siteName: siteName,
                teamName: teamName,  // Worker's Team
                workerName: name,
                manDay: typeof manDay === 'number' ? manDay.toFixed(1) : (manDay || '1.0'),
                unitPrice: '0', // Default
                workContent: workContent || '',
                payType: payType || ''
            };

            // Validation
            if (!rowData.siteName) { rowData._valid = false; rowData._errors.push('현장명 누락'); }
            if (!rowData.teamName) { rowData._valid = false; rowData._errors.push('팀명 누락'); }
            if (!rowData.workerName) { rowData._valid = false; rowData._errors.push('이름 누락'); }

            return rowData;
        });

        // Set Headers purely for display (fixed structure now)
        setHeaders(['날짜', '현장명', '담당팀', '이름', '팀명', '공수', '작업내용', '구분']);
        // Mock mapped fields for preview table compatibility
        setMappedFields({ 0: 'date', 1: 'siteName', 2: 'teamName', 3: 'workerName', 4: 'manDay', 5: 'workContent', 6: 'payType' });

        setParsedData(mapped);
    };

    // ... (keep handleSave)

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* ... Header ... */}
            <div className="flex flex-col gap-6">
                {/* ... Title ... */}
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">일보 대량 등록 (엑셀 그리드)</h1>
                        <p className="text-slate-500 mt-1 text-sm">엑셀 데이터를 아래 표에 붙여넣으세요 (Ctrl+V).</p>
                    </div>
                    {/* ... Button ... */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={loading || parsedData.length === 0}
                            className="bg-black hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-sm flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                            일괄 등록
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 h-[800px]">
                    {/* Full Width Grid Input */}
                    <div className="flex flex-col h-1/2">
                        <SmartExcelGrid onChange={handleGridChange} />
                    </div>

                    {/* Preview Area */}
                    <div className="flex flex-col h-1/2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                데이터 미리보기
                                <span className="text-slate-400 font-normal text-sm ml-1">({parsedData.length}건)</span>
                            </h3>
                        </div>
                        {/* ... Table (keep existing table logic) ... */}
                        <div className="flex-1 overflow-auto bg-slate-50/50 relative">
                            {parsedData.length > 0 ? (
                                <table className="w-full text-sm text-left border-collapse">
                                    {/* ... Use existing table structure ... */}
                                    <thead className="text-xs text-slate-500 font-medium bg-white sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-slate-100 w-12 text-center">상태</th>
                                            <th className="px-4 py-3 border-b border-slate-100">날짜</th>
                                            <th className="px-4 py-3 border-b border-slate-100">현장명</th>
                                            <th className="px-4 py-3 border-b border-slate-100">팀명</th>
                                            <th className="px-4 py-3 border-b border-slate-100">이름</th>
                                            <th className="px-4 py-3 border-b border-slate-100">공수</th>
                                            <th className="px-4 py-3 border-b border-slate-100">작업내용</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {parsedData.map((row, rowIdx) => (
                                            <tr key={rowIdx} className={`group transition-colors ${row._valid ? 'hover:bg-slate-50' : 'bg-red-50/50 hover:bg-red-50'}`}>
                                                <td className="px-4 py-2.5 text-center">
                                                    {row._valid ? (
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 mx-auto"></div>
                                                    ) : (
                                                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400 text-xs" title={row._errors.join(', ')} />
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5">{row.date}</td>
                                                <td className="px-4 py-2.5">{row.siteName}</td>
                                                <td className="px-4 py-2.5">{row.teamName}</td>
                                                <td className="px-4 py-2.5">{row.workerName}</td>
                                                <td className="px-4 py-2.5">{row.manDay}</td>
                                                <td className="px-4 py-2.5">{row.workContent}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                                    <FontAwesomeIcon icon={faPaste} className="text-4xl mb-3 opacity-20" />
                                    <p className="text-sm">위 그리드에 데이터를 붙여넣으면 미리보기가 표시됩니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SmartDailyReportRegistrationPage;
