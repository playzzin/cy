import React, { useEffect, useState } from 'react';
import ExcelUploadWizard, { FieldDef, ValidationResult } from '../../components/excel/ExcelUploadWizard';
import { dailyReportService, DailyReportWorker } from '../../services/dailyReportService';
import { teamService } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import Swal from 'sweetalert2';

const DailyReportMassUploader: React.FC = () => {
    // State
    const [teams, setTeams] = useState<Map<string, string>>(new Map()); // Name -> ID
    const [sites, setSites] = useState<Map<string, Site>>(new Map()); // Name -> Site Object
    const [workers, setWorkers] = useState<Map<string, Worker>>(new Map()); // Name -> Worker
    const [existingReports, setExistingReports] = useState<Map<string, DailyReportWorker[]>>(new Map()); // Key: Date_SiteId_TeamId -> Workers[]
    const [logs, setLogs] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadCache = async () => {
            try {
                const [tData, sData, wData] = await Promise.all([
                    teamService.getTeams(),
                    siteService.getSites(),
                    manpowerService.getWorkers()
                ]);

                const tMap = new Map<string, string>();
                tData.forEach(t => { if (t.id) tMap.set(t.name, t.id); });
                setTeams(tMap);

                const sMap = new Map<string, Site>();
                sData.forEach(s => { if (s.id) sMap.set(s.name, s); });
                setSites(sMap);

                const wMap = new Map<string, Worker>();
                wData.forEach(w => {
                    // Normalize name (remove spaces)
                    wMap.set(w.name.replace(/\s+/g, ''), w);
                });
                setWorkers(wMap);

                // Fetch last 90 days reports for comparison cache
                const today = new Date();
                const past = new Date();
                past.setDate(today.getDate() - 90);
                const startDate = past.toISOString().split('T')[0];
                const endDate = '2099-12-31';

                const rData = await dailyReportService.getReportsByRange(startDate, endDate);
                const rMap = new Map<string, DailyReportWorker[]>();
                rData.forEach(r => {
                    // Normalize Date
                    const d = r.date.replace(/\./g, '-');
                    const key = `${d}_${r.siteId}_${r.teamId}`;
                    rMap.set(key, r.workers);
                });
                setExistingReports(rMap);

            } catch (error) {
                console.error("Error loading cache:", error);
                Swal.fire('오류', '기초 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
            }
        };
        loadCache();
    }, []);

    const fields: FieldDef[] = [
        { key: 'date', label: '날짜', required: true, example: '2024-01-01', aliases: ['작업일', '일자'] },
        { key: 'siteName', label: '현장명', required: true, aliases: ['현장', '현장이름'] },
        { key: 'workerName', label: '이름', required: true, aliases: ['작업자명', '성명', '작업자'] },
        { key: 'manDay', label: '공수', required: true, example: '1.0' },
        { key: 'teamName', label: '팀명', required: true, aliases: ['팀', '소속팀'] },
        { key: 'responsibleTeamName', label: '현장담당', required: false, aliases: ['담당팀', '책임팀', '해당팀'] },
        { key: 'payType', label: '구분', required: false, example: '월급제', aliases: ['급여형태', '임금유형', '급여방식'] },
        { key: 'unitPrice', label: '단가', required: false, example: '150000', aliases: ['일당', '임금'] },
        { key: 'companyName', label: '회사', required: false, aliases: ['회사명', '발주처', '건설사'] },
        { key: 'content', label: '작업내용', required: false },
        { key: 'role', label: '직종', required: false, example: '조공', aliases: ['역할'] }
    ];

    const validateRow = async (row: any): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: 'NEW' | 'UPDATE' | 'IDENTICAL' = 'NEW';
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        // Required
        if (!row.date) errors.push('날짜 필수');
        if (!row.siteName) errors.push('현장명 필수');
        if (!row.teamName) errors.push('팀명 필수');
        if (!row.workerName) errors.push('이름 필수');

        // Check Worker Existence (STRICT)
        const cleanName = row.workerName?.replace(/\s+/g, '') || '';
        if (row.workerName && !workers.has(cleanName)) {
            errors.push(`미등록 작업자: ${row.workerName} (먼저 작업자를 등록해주세요.)`);
        }

        // Check Team/Site (PERMISSIVE - Warning only)
        const siteId = sites.get(row.siteName);
        if (row.siteName && !siteId) {
            warnings.push(`새로운 현장 감지: ${row.siteName} (자동 생성됩니다)`);
        }

        const teamId = teams.get(row.teamName);
        if (row.teamName && !teamId) {
            warnings.push(`새로운 팀 감지: ${row.teamName} (자동 생성됩니다)`);
        }

        // Format Date
        let dateKey = row.date;
        if (dateKey && typeof dateKey === 'string') dateKey = dateKey.replace(/\./g, '-');

        if (siteId && teamId && dateKey) {
            const key = `${dateKey}_${siteId}_${teamId}`;
            const existingWorkers = existingReports.get(key);

            if (existingWorkers) {
                const existingWorker = existingWorkers.find(w => w.name.replace(/\s+/g, '') === cleanName);
                if (existingWorker) {
                    let hasChanges = false;
                    const compare = (field: string, newVal: any, oldVal: any) => {
                        if (String(newVal || '').trim() !== String(oldVal || '').trim()) {
                            hasChanges = true;
                            changes.push({ field, oldValue: oldVal, newValue: newVal });
                        }
                    };

                    compare('manDay', row.manDay, existingWorker.manDay);
                    compare('role', row.role, existingWorker.role);
                    compare('content', row.content, existingWorker.workContent);
                    compare('payType', row.payType, existingWorker.payType);
                    compare('unitPrice', row.unitPrice, existingWorker.unitPrice);

                    if (hasChanges) {
                        status = 'UPDATE';
                        warnings.push('기존 일보에 다른 정보가 있습니다.');
                    } else {
                        status = 'IDENTICAL';
                        warnings.push('기존 일보와 동일합니다.');
                    }
                }
            }
        }

        return { isValid: errors.length === 0, errors, warnings, status, changes };
    };

    const handleSave = async (data: any[], options?: { overwrite: boolean }) => {
        setSaving(true);
        setLogs([]);
        const newLogs: string[] = [];

        // Groups
        const groups: { [key: string]: any[] } = {};
        const groupMeta: {
            [key: string]: {
                date: string, siteId: string, teamId: string,
                siteName: string, teamName: string, responsibleTeamName: string,
                companyId?: string, companyName?: string
            }
        } = {};

        let skippedCount = 0;
        let failCount = 0;
        let successCount = 0;

        // Dynamic Cache for newly created Teams/Sites in this batch
        const tempTeams = new Map<string, string>(teams);
        const tempSites = new Map<string, Site>(sites);

        for (const row of data) {
            if (!row.date || !row.siteName || !row.teamName || !row.workerName) {
                failCount++;
                continue;
            }

            // 1. Strict Worker Check
            const cleanName = row.workerName.replace(/\s+/g, '');
            if (!workers.has(cleanName)) {
                failCount++;
                newLogs.push(`[실패] ${row.workerName}: 미등록 작업자입니다. 작업자를 먼저 등록해주세요.`);
                continue;
            }

            // 2. Permissive Site Check (Auto-Create)
            let site = tempSites.get(row.siteName);
            if (!site) {
                try {
                    const newSiteId = await siteService.addSite({
                        name: row.siteName,
                        code: `SITE-${Date.now()}-${Math.floor(Math.random() * 100)}`,
                        address: '일괄생성',
                        status: 'active'
                    });
                    const newSiteObj: Site = {
                        id: newSiteId,
                        name: row.siteName,
                        code: `SITE-${Date.now()}-${Math.floor(Math.random() * 100)}`,
                        address: '일괄생성',
                        status: 'active',
                        companyName: row.companyName // Add company info if from Excel
                    };
                    tempSites.set(row.siteName, newSiteObj);
                    site = newSiteObj;
                    newLogs.push(`[자동생성] 현장: ${row.siteName}`);
                } catch (e) {
                    console.error("Site creation failed", e);
                    failCount++;
                    newLogs.push(`[실패] 현장 생성 실패: ${row.siteName}`);
                    continue;
                }
            }

            // 3. Permissive Team Check (Auto-Create)
            let teamId = tempTeams.get(row.teamName);
            if (!teamId) {
                try {
                    const newTeamId = await teamService.addTeam({
                        name: row.teamName,
                        leaderName: '일괄생성',
                        leaderId: 'unknown',
                        type: 'unknown',
                        memberCount: 0
                    });
                    tempTeams.set(row.teamName, newTeamId);
                    teamId = newTeamId;
                    newLogs.push(`[자동생성] 팀: ${row.teamName}`);
                } catch (e) {
                    console.error("Team creation failed", e);
                    failCount++;
                    newLogs.push(`[실패] 팀 생성 실패: ${row.teamName}`);
                    continue;
                }
            }

            // Date Normalization
            let dateStr = row.date;
            if (typeof dateStr === 'string') dateStr = dateStr.replace(/\./g, '-');

            const key = `${dateStr}_${site.id}_${teamId}`;

            // Grouping Logic
            if (!groups[key]) {
                groups[key] = [];
                groupMeta[key] = {
                    date: dateStr,
                    siteId: site.id!,
                    teamId,
                    siteName: row.siteName,
                    teamName: row.teamName,
                    responsibleTeamName: row.responsibleTeamName || row.teamName,
                    companyId: site.companyId,
                    companyName: site.companyName
                };
            }
            groups[key].push(row);
        }

        // Save Groups
        for (const key in groups) {
            const groupRows = groups[key];
            const meta = groupMeta[key];

            try {
                const reports = await dailyReportService.getReports(meta.date, meta.teamId);
                const targetReport = reports.find(r => r.siteId === meta.siteId);

                let currentWorkers: DailyReportWorker[] = [];
                if (targetReport) currentWorkers = [...targetReport.workers];

                for (const row of groupRows) {
                    const cleanName = row.workerName.replace(/\s+/g, '');
                    const existingWorkerIndex = currentWorkers.findIndex(w => w.name.replace(/\s+/g, '') === cleanName);

                    const workerDataFromDB = workers.get(cleanName);
                    if (!workerDataFromDB) continue; // Should be caught above, but safety check

                    const newWorkerData: DailyReportWorker = {
                        workerId: workerDataFromDB.id!,
                        name: row.workerName,
                        role: row.role || workerDataFromDB.role || '조공',
                        status: 'attendance',
                        manDay: Number(row.manDay) || 1.0,
                        workContent: row.content || '',
                        teamId: meta.teamId,
                        unitPrice: Number(row.unitPrice) || workerDataFromDB.unitPrice || 0,
                        payType: row.payType || workerDataFromDB.payType || '일급제',
                        salaryModel: workerDataFromDB.teamType === '지원팀' ? '지원팀'
                            : workerDataFromDB.teamType === '용역팀' ? '용역팀'
                                : workerDataFromDB.salaryModel || '일급제'
                    };

                    if (existingWorkerIndex !== -1) {
                        if (options?.overwrite) {
                            currentWorkers[existingWorkerIndex] = { ...currentWorkers[existingWorkerIndex], ...newWorkerData };
                        } else {
                            skippedCount++;
                        }
                    } else {
                        currentWorkers.push(newWorkerData);
                    }
                }

                const totalManDay = currentWorkers.reduce((sum, w) => sum + w.manDay, 0);

                if (targetReport && targetReport.id) {
                    await dailyReportService.updateReport(targetReport.id, {
                        workers: currentWorkers,
                        totalManDay,
                        responsibleTeamName: meta.responsibleTeamName
                    });
                    successCount += groupRows.length;
                    newLogs.push(`[저장완료] ${meta.date} ${meta.teamName} -> ${currentWorkers.length}명 (수정됨)`);
                } else {
                    await dailyReportService.addReport({
                        date: meta.date,
                        siteId: meta.siteId,
                        siteName: meta.siteName,
                        teamId: meta.teamId,
                        teamName: meta.teamName,
                        responsibleTeamName: meta.responsibleTeamName,
                        companyId: meta.companyId,
                        companyName: meta.companyName,
                        workers: currentWorkers,
                        totalManDay,
                        totalAmount: 0,
                        writerId: 'excel_upload',
                        weather: '맑음',
                        workContent: '엑셀 일괄 등록'
                    });
                    successCount += groupRows.length;
                    newLogs.push(`[저장완료] ${meta.date} ${meta.teamName} -> ${currentWorkers.length}명 (신규생성)`);
                }

            } catch (e: any) {
                console.error(e);
                failCount += groupRows.length;
                newLogs.push(`[오류] ${meta.date} ${meta.teamName}: ${e.message}`);
            }
        }

        setLogs(newLogs);
        setSaving(false);
        // Refresh Cache (optional but good practice)
        return { success: successCount, failed: failCount, skipped: skippedCount };
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">출력일보 대량 등록</h2>
            <ExcelUploadWizard
                title="출력일보 엑셀 업로드"
                description="날짜, 현장명, 팀명, 작업자명, 공수, 현장담당, 구분이 포함된 엑셀 파일을 업로드하세요."
                fields={fields}
                onValidate={validateRow}
                onSaveBatch={handleSave}
            />
            {logs.length > 0 && (
                <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-bold mb-2">처리 로그</h3>
                    <div className="max-h-60 overflow-y-auto font-mono text-sm text-slate-600">
                        {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyReportMassUploader;
