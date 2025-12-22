import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCloudUploadAlt,
    faSpinner,
    faCheckCircle,
    faExclamationTriangle,
    faFileExcel,
    faTable,
    faPlay,
    faTimes,
    faBuilding,
    faUsers,
    faMapMarkerAlt,
    faUser,
    faClipboard
} from '@fortawesome/free-solid-svg-icons';
import { companyService } from '../../services/companyService';
import { teamService } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService } from '../../services/dailyReportService';
import { useAuth } from '../../contexts/AuthContext';
import Swal from 'sweetalert2';

interface LogItem {
    step: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    message: string;
    count?: number;
}

type SheetType = 'Company' | 'Team' | 'Site' | 'Worker' | 'DailyReport';

const SHEET_CONFIG: { [key in SheetType]: { name: string; icon: any; keywords: string[] } } = {
    'Company': { name: '회사', icon: faBuilding, keywords: ['회사'] },
    'Team': { name: '팀', icon: faUsers, keywords: ['팀'] },
    'Site': { name: '현장', icon: faMapMarkerAlt, keywords: ['현장'] },
    'Worker': { name: '작업자', icon: faUser, keywords: ['작업자'] },
    'DailyReport': { name: '출력일보', icon: faClipboard, keywords: ['출력일보', 'Report'] }
};

const formatExcelDate = (val: any): string => {
    if (!val) return '';

    // 1. If it's a number (Excel Serial Date)
    if (typeof val === 'number') {
        if (val > 20000) { // Approx year 1954
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }

    // 2. If it's a string
    const str = String(val).trim();
    if (str.match(/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/)) {
        return str.replace(/[./]/g, '-');
    }
    return str;
};

const IntegratedMassUploader: React.FC = () => {
    const { currentUser } = useAuth();

    // Stages: 'upload' -> 'preview' -> 'processing'
    const [stage, setStage] = useState<'upload' | 'preview' | 'processing'>('upload');
    const [previewData, setPreviewData] = useState<{ [key in SheetType]: any[] }>({
        Company: [],
        Team: [],
        Site: [],
        Worker: [],
        DailyReport: []
    });
    const [activeTab, setActiveTab] = useState<SheetType>('Company');

    const [logs, setLogs] = useState<LogItem[]>([
        { step: 'Company', status: 'pending', message: '회사 데이터 대기 중...' },
        { step: 'Team', status: 'pending', message: '팀 데이터 대기 중...' },
        { step: 'Site', status: 'pending', message: '현장 데이터 대기 중...' },
        { step: 'Worker', status: 'pending', message: '작업자 데이터 대기 중...' },
        { step: 'DailyReport', status: 'pending', message: '출력일보 대기 중...' },
    ]);

    const updateLog = (stepName: string, status: LogItem['status'], message: string, count?: number) => {
        setLogs(prev => prev.map(log =>
            log.step === stepName ? { ...log, status, message, count } : log
        ));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                if (typeof bstr !== 'string') return;

                const wb = XLSX.read(bstr, { type: 'binary' });

                const newData = {
                    Company: [] as any[],
                    Team: [] as any[],
                    Site: [] as any[],
                    Worker: [] as any[],
                    DailyReport: [] as any[]
                };

                // Parse each sheet
                (Object.keys(SHEET_CONFIG) as SheetType[]).forEach(type => {
                    const config = SHEET_CONFIG[type];
                    const sheetName = wb.SheetNames.find(n => config.keywords.some(k => n.includes(k)));
                    if (sheetName) {
                        const ws = wb.Sheets[sheetName];
                        const rawData = XLSX.utils.sheet_to_json(ws);

                        // Normalize Dates immediately for Preview
                        newData[type] = rawData.map((row: any) => {
                            if (row['날짜']) row['날짜'] = formatExcelDate(row['날짜']);
                            if (row['작업일']) row['작업일'] = formatExcelDate(row['작업일']);
                            if (row['착공일']) row['착공일'] = formatExcelDate(row['착공일']);
                            if (row['준공일']) row['준공일'] = formatExcelDate(row['준공일']);
                            if (row['생년월일']) row['생년월일'] = formatExcelDate(row['생년월일']);
                            return row;
                        });
                    }
                });

                setPreviewData(newData);
                setStage('preview');

                // Find first non-empty tab
                const firstDataTab = (Object.keys(newData) as SheetType[]).find(k => newData[k].length > 0);
                if (firstDataTab) setActiveTab(firstDataTab);

            } catch (error) {
                console.error(error);
                Swal.fire('오류', '파일을 읽는 중 오류가 발생했습니다.', 'error');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleProcess = async () => {
        setStage('processing');

        // Reset logs
        setLogs([
            { step: 'Company', status: 'pending', message: '회사 데이터 대기 중...' },
            { step: 'Team', status: 'pending', message: '팀 데이터 대기 중...' },
            { step: 'Site', status: 'pending', message: '현장 데이터 대기 중...' },
            { step: 'Worker', status: 'pending', message: '작업자 데이터 대기 중...' },
            { step: 'DailyReport', status: 'pending', message: '출력일보 대기 중...' },
        ]);

        try {
            // --- 1. Company (회사) ---
            await processData('Company', async (row) => {
                const companyName = row['회사명'] || row['상호'];
                if (!companyName) return;

                const existing = await companyService.getCompanyByName(companyName);
                if (existing) {
                    await companyService.updateCompany(existing.id!, {
                        name: companyName,
                        type: row['구분'] || existing.type,
                        ceoName: row['대표자'] || existing.ceoName,
                        businessNumber: row['사업자번호'] || existing.businessNumber,
                        address: row['주소'] || existing.address
                    });
                } else {
                    await companyService.addCompany({
                        name: companyName,
                        type: row['구분'] || '기타',
                        ceoName: row['대표자'] || '',
                        businessNumber: row['사업자번호'] || '',
                        address: row['주소'] || '',
                        code: '',
                        phone: row['연락처'] || ''
                    });
                }
            });

            // --- 2. Team (팀) ---
            await processData('Team', async (row) => {
                const teamName = row['팀명'];
                if (!teamName) return;

                const companyName = row['회사명'] || row['소속회사'];
                let companyId = '';
                if (companyName) {
                    const company = await companyService.getCompanyByName(companyName);
                    companyId = company?.id || '';
                }

                const existing = await teamService.getTeamByName(teamName);
                if (existing) {
                    await teamService.updateTeam(existing.id!, {
                        name: teamName,
                        companyId: companyId || existing.companyId,
                        leaderName: row['팀장명'] || existing.leaderName,
                        role: row['직종'] || existing.role
                    });
                } else {
                    await teamService.addTeam({
                        name: teamName,
                        companyId: companyId,
                        leaderName: row['팀장명'] || '',
                        role: row['직종'] || '기타',
                        leaderId: '',
                        type: '일반'
                    });
                }
            });

            // --- 3. Site (현장) ---
            let sitesCache: Site[] = [];
            await processData('Site', async (row) => {
                const siteName = row['현장'] || row['현장명'];
                if (!siteName) return;

                const companyName = row['회사명'] || row['발주처'];
                let companyId = '';
                let companyNameVal = '';
                if (companyName) {
                    const company = await companyService.getCompanyByName(companyName);
                    companyId = company?.id || '';
                    companyNameVal = company?.name || companyName;
                }

                const teamName = row['해당팀'] || row['현장담당'];
                let responsibleTeamId = '';
                let responsibleTeamName = '';
                if (teamName) {
                    const team = await teamService.getTeamByName(teamName);
                    responsibleTeamId = team?.id || '';
                    responsibleTeamName = team?.name || teamName;
                }

                const startDate = formatExcelDate(row['착공일']);
                const endDate = formatExcelDate(row['준공일']);

                const existing = await siteService.getSiteByName(siteName);
                if (existing) {
                    await siteService.updateSite(existing.id!, {
                        name: siteName,
                        companyId: companyId || existing.companyId,
                        companyName: companyNameVal || existing.companyName,
                        responsibleTeamId: responsibleTeamId || existing.responsibleTeamId,
                        responsibleTeamName: responsibleTeamName || existing.responsibleTeamName,
                        startDate: startDate || existing.startDate,
                        endDate: endDate || existing.endDate,
                        code: row['현장코드'] || existing.code,
                        status: existing.status
                    });
                } else {
                    await siteService.addSite({
                        name: siteName,
                        companyId: companyId,
                        companyName: companyNameVal,
                        responsibleTeamId: responsibleTeamId,
                        responsibleTeamName: responsibleTeamName,
                        startDate: startDate || '',
                        endDate: endDate || '',
                        code: row['현장코드'] || '',
                        status: 'active',
                        address: row['주소'] || ''
                    });
                }
            });
            sitesCache = await siteService.getSites();

            // --- 4. Worker (작업자) ---
            let workersCache: Worker[] = [];
            await processData('Worker', async (row) => {
                const name = row['이름'] || row['성명'];
                if (!name) return;

                let teamId = '';
                let teamName = '';
                const rowTeamName = row['소속팀'] || row['팀명'] || row['팀'];
                if (rowTeamName) {
                    const team = await teamService.getTeamByName(rowTeamName);
                    if (team) {
                        teamId = team.id!;
                        teamName = team.name;
                    }
                }

                const rowCompanyName = row['회사명'] || row['소속회사'];
                let companyId = '';
                if (rowCompanyName) {
                    const company = await companyService.getCompanyByName(rowCompanyName);
                    companyId = company?.id || '';
                }

                const unitPriceRaw = row['단가'] || row['일당'] || row['임금'] || row['급여'];
                const unitPrice = unitPriceRaw ? Number(String(unitPriceRaw).replace(/[^0-9]/g, '')) : 0;

                const existing = await manpowerService.getWorkerByName(name);

                if (existing) {
                    await manpowerService.updateWorker(existing.id!, {
                        name,
                        teamId: teamId || existing.teamId,
                        teamName: teamName || existing.teamName,
                        companyId: companyId || existing.companyId,
                        role: row['직종'] || row['역할'] || existing.role,
                        contact: row['연락처'] || row['휴대폰'] || existing.contact,
                        idNumber: row['주민번호'] || existing.idNumber,
                        address: row['주소'] || existing.address,
                        unitPrice: unitPrice || existing.unitPrice,
                        payType: row['급여방식'] || row['구분'] || existing.payType,
                        bankName: row['은행명'] || existing.bankName,
                        accountNumber: row['계좌번호'] || existing.accountNumber,
                        accountHolder: row['예금주'] || existing.accountHolder
                    });
                } else {
                    await manpowerService.addWorker({
                        name,
                        teamId,
                        teamName,
                        companyId,
                        role: row['직종'] || row['역할'] || '작업자',
                        contact: row['연락처'] || row['휴대폰'] || '',
                        idNumber: row['주민번호'] || '',
                        address: row['주소'] || '',
                        unitPrice: unitPrice,
                        payType: row['급여방식'] || row['구분'] || '일급제',
                        bankName: row['은행명'] || '',
                        accountNumber: row['계좌번호'] || '',
                        accountHolder: row['예금주'] || '',
                        teamType: row['팀구분'] || '일용직',
                        status: 'active'
                    });
                }
            });
            workersCache = await manpowerService.getWorkers();

            // --- 5. Daily Report (출력일보) ---
            const reportData = previewData['DailyReport'];
            if (reportData.length > 0) {
                updateLog('DailyReport', 'processing', `일보 데이터 처리 중...`);

                const groups: { [key: string]: any[] } = {};
                reportData.forEach((row: any) => {
                    const rawDate = row['날짜'] || row['작업일'];
                    const date = formatExcelDate(rawDate);

                    if (!date) {
                        console.warn('Skipping report due to invalid date:', rawDate);
                        return;
                    }

                    const siteName = row['현장명'] || row['현장'];
                    const teamName = row['팀명'] || row['팀'];

                    if (date && siteName && teamName) {
                        const key = `${date}_${siteName}_${teamName}`;
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(row);
                    }
                });

                let savedCount = 0;
                for (const [key, rows] of Object.entries(groups)) {
                    const [date, siteName, teamName] = key.split('_');

                    // Resolve Site
                    let site = sitesCache.find(s => s.name === siteName);
                    if (!site) {
                        const s = await siteService.getSiteByName(siteName);
                        if (s) site = s;
                        else {
                            const newId = await siteService.addSite({
                                name: siteName,
                                address: '',
                                code: '',
                                startDate: '',
                                endDate: '',
                                status: 'active',
                                responsibleTeamName: '',
                                companyName: ''
                            });
                            site = { id: newId, name: siteName } as Site;
                        }
                    }
                    const siteId = site.id!;

                    // Resolve Team
                    const team = await teamService.getTeamByName(teamName);
                    const teamId = team?.id || '';

                    // Map Workers
                    const workers = rows.map((r: any) => {
                        const wName = r['이름'];
                        let worker = workersCache.find(w => w.name === wName);
                        return {
                            workerId: worker?.id || 'unknown',
                            name: wName,
                            manDay: r['공수'] || 1.0,
                            role: r['직종'] || worker?.role || '작업자',
                            status: 'attendance',
                            unitPrice: r['단가'] ? Number(String(r['단가']).replace(/[^0-9]/g, '')) : (worker?.unitPrice || 0),
                            payType: r['구분'] || worker?.payType || '일급제',
                            workContent: r['작업내용'] || ''
                        };
                    });

                    if (siteId && teamId) {
                        await dailyReportService.addReport({
                            date,
                            siteId,
                            siteName,
                            teamId,
                            teamName,
                            workers: workers as any,
                            totalManDay: workers.reduce((sum: number, w: any) => sum + Number(w.manDay), 0),
                            writerId: currentUser?.uid || 'system',
                            companyName: site?.companyName || '',
                            responsibleTeamName: site?.responsibleTeamName || ''
                        });
                        savedCount++;
                    }
                }
                updateLog('DailyReport', 'success', `일보 ${savedCount}건 저장 완료`, savedCount);
            } else {
                updateLog('DailyReport', 'success', '데이터 없음 (건너뜀)');
            }

            Swal.fire('완료', '모든 데이터가 통합 처리되었습니다.', 'success');

        } catch (error) {
            console.error(error);
            Swal.fire('오류', '데이터 처리 중 오류가 발생했습니다.', 'error');
        } finally {
            // Optional: setStage('upload') to reset?
        }
    };

    const processData = async (type: SheetType, rowHandler: (row: any) => Promise<void>) => {
        const data = previewData[type];
        if (!data || data.length === 0) {
            updateLog(type, 'success', '데이터 없음 (건너뜀)');
            return;
        }

        updateLog(type, 'processing', `처리 중...`);
        let count = 0;
        for (const row of data) {
            try {
                await rowHandler(row);
                count++;
            } catch (err) {
                console.error(`Error processing row in ${type}`, err);
            }
        }
        updateLog(type, 'success', `${count}건 처리 완료`, count);
    };

    const handleCancel = () => {
        setStage('upload');
        setPreviewData({ Company: [], Team: [], Site: [], Worker: [], DailyReport: [] });
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-slate-800">통합 데이터 일괄 등록 (One-Shot Upload)</h1>

            {/* Stage 1: Upload */}
            {stage === 'upload' && (
                <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center animate-fade-in">
                    <div className="flex items-center justify-center w-full max-w-2xl mx-auto">
                        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-5xl text-slate-400 mb-4" />
                                <p className="mb-2 text-lg text-slate-600 font-bold">엑셀 파일 업로드</p>
                                <p className="text-sm text-slate-500">통합 데이터(.xlsx)를 여기에 드래그하거나 클릭하세요</p>
                            </div>
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                        </label>
                    </div>
                    <div className="mt-8 grid grid-cols-5 gap-4 max-w-4xl mx-auto">
                        {Object.values(SHEET_CONFIG).map((conf, idx) => (
                            <div key={idx} className="flex flex-col items-center p-4 bg-slate-50 rounded-lg">
                                <FontAwesomeIcon icon={conf.icon} className="text-2xl text-slate-400 mb-2" />
                                <span className="text-xs font-semibold text-slate-600">{conf.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Stage 2: Preview */}
            {stage === 'preview' && (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faTable} className="text-blue-500" />
                            데이터 미리보기
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={handleCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2">
                                <FontAwesomeIcon icon={faTimes} /> 취소
                            </button>
                            <button onClick={handleProcess} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md transition-colors flex items-center gap-2 font-bold">
                                <FontAwesomeIcon icon={faPlay} /> 등록 시작
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200">
                        {(Object.keys(SHEET_CONFIG) as SheetType[]).map(type => (
                            <button
                                key={type}
                                onClick={() => setActiveTab(type)}
                                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === type
                                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                <FontAwesomeIcon icon={SHEET_CONFIG[type].icon} />
                                {SHEET_CONFIG[type].name}
                                <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${previewData[type].length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                                    {previewData[type].length}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Table Area */}
                    <div className="p-0 overflow-x-auto max-h-[500px]">
                        {previewData[activeTab].length > 0 ? (
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0">
                                    <tr>
                                        {Object.keys(previewData[activeTab][0] || {}).map((header, idx) => (
                                            <th key={idx} className="px-6 py-3 border-b border-slate-200 whitespace-nowrap">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData[activeTab].slice(0, 50).map((row: any, idx: number) => (
                                        <tr key={idx} className="bg-white border-b hover:bg-slate-50">
                                            {Object.values(row).map((val: any, vIdx: number) => (
                                                <td key={vIdx} className="px-6 py-4 whitespace-nowrap">
                                                    {String(val)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-12 text-center text-slate-400">
                                <FontAwesomeIcon icon={faFileExcel} className="text-4xl mb-4 opacity-30" />
                                <p>데이터가 없습니다.</p>
                            </div>
                        )}
                    </div>
                    <div className="p-3 bg-slate-50 text-xs text-slate-500 text-center border-t border-slate-200">
                        * 상위 50개 항목만 표시됩니다.
                    </div>
                </div>
            )}

            {/* Stage 3: Processing Logs */}
            {stage === 'processing' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800">처리 진행 상황</h2>
                        <button onClick={handleCancel} className="text-sm text-slate-500 underline">처음으로</button>
                    </div>
                    {logs.map((log) => (
                        <div key={log.step} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-lg shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.status === 'success' ? 'bg-green-100 text-green-600' :
                                    log.status === 'error' ? 'bg-red-100 text-red-600' :
                                        log.status === 'processing' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                    {log.status === 'processing' ? <FontAwesomeIcon icon={faSpinner} spin /> :
                                        log.status === 'success' ? <FontAwesomeIcon icon={faCheckCircle} /> :
                                            log.status === 'error' ? <FontAwesomeIcon icon={faExclamationTriangle} /> :
                                                <FontAwesomeIcon icon={faFileExcel} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-700">{log.step}</h3>
                                    <p className="text-sm text-slate-500">{log.message}</p>
                                </div>
                            </div>
                            {log.count !== undefined && (
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                                    {log.count} Items
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default IntegratedMassUploader;
