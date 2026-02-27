import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ExcelUploadWizard, { FieldDef, ValidationResult, SampleDataRow } from '../../components/excel/ExcelUploadWizard';
import { dailyReportService, DailyReportWorker } from '../../services/dailyReportService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { normalizeString, normalizeNumber, formatExcelDate, normalizeNameForCompare } from '../../utils/excelUtils';
import Swal from 'sweetalert2';

const DailyReportMassUploader: React.FC = () => {
    const { currentUser } = useAuth();
    const [teams, setTeams] = useState<Map<string, Team>>(new Map());
    const [sites, setSites] = useState<Map<string, Site>>(new Map());
    const [workers, setWorkers] = useState<Map<string, Worker>>(new Map());
    const [existingReports, setExistingReports] = useState<Map<string, DailyReportWorker[]>>(new Map());
    const [logs, setLogs] = useState<string[]>([]);

    // 미등록 작업자 자동 생성 옵션
    const [autoCreateWorker, setAutoCreateWorker] = useState(false);

    useEffect(() => {
        const loadCache = async () => {
            try {
                const [tData, sData, wData] = await Promise.all([
                    teamService.getTeams(),
                    siteService.getSites(),
                    manpowerService.getWorkers()
                ]);

                const tMap = new Map<string, Team>();
                tData.forEach(t => {
                    if (t.id) tMap.set(normalizeNameForCompare(t.name), t);
                });
                setTeams(tMap);

                const sMap = new Map<string, Site>();
                sData.forEach(s => {
                    if (s.id) sMap.set(normalizeNameForCompare(s.name), s);
                });
                setSites(sMap);

                const wMap = new Map<string, Worker>();
                wData.forEach(w => {
                    if (w.id) wMap.set(normalizeNameForCompare(w.name), w);
                });
                setWorkers(wMap);

                // 최근 90일 일보 캐시
                const today = new Date();
                const past = new Date();
                past.setDate(today.getDate() - 90);
                const startDate = past.toISOString().split('T')[0];
                const endDate = '2099-12-31';

                const rData = await dailyReportService.getReportsByRange(startDate, endDate);
                const rMap = new Map<string, DailyReportWorker[]>();
                rData.forEach(r => {
                    const d = formatExcelDate(r.date);
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
        { key: 'date', label: '날짜', required: true, example: '2024-01-01', aliases: ['작업일', '일자', '날짜'] },
        { key: 'siteName', label: '현장명', required: true, example: '강남역 복합개발', aliases: ['현장', '현장이름', '공사명'] },
        { key: 'teamName', label: '팀명', required: true, example: '1공구팀', aliases: ['팀', '소속팀', '조'] },
        { key: 'workerName', label: '작업자명', required: true, example: '김철수', aliases: ['이름', '성명', '작업자', '인원'] },
        { key: 'manDay', label: '공수', required: true, example: '1.0', aliases: ['M/D', '출력'] },
        { key: 'role', label: '직종', required: false, example: '보통인부', aliases: ['역할', '공종'] },
        { key: 'unitPrice', label: '단가', required: false, example: '180000', aliases: ['일당', '임금', '노임'] },
        { key: 'payType', label: '구분', required: false, example: '일급제', aliases: ['급여형태', '임금유형', '급여방식'] },
        { key: 'workContent', label: '작업내용', required: false, example: '자재 정리', aliases: ['내용', '비고'] },
        { key: 'responsibleTeamName', label: '현장담당', required: false, example: '1공구팀', aliases: ['담당팀', '책임팀', '해당팀'] },
        { key: 'companyName', label: '회사', required: false, example: '(주)대한건설', aliases: ['회사명', '발주처', '건설사'] }
    ];

    const sampleData: SampleDataRow[] = [
        { date: '2024-01-01', siteName: '강남역 복합개발', teamName: '1공구팀', workerName: '김철수', manDay: 1, role: '보통인부', unitPrice: 180000, payType: '일급제', workContent: '자재 정리 및 청소', responsibleTeamName: '1공구팀', companyName: '(주)대한건설' },
        { date: '2024-01-01', siteName: '강남역 복합개발', teamName: '1공구팀', workerName: '이영희', manDay: 1, role: '형틀목공', unitPrice: 220000, payType: '일급제', workContent: '거푸집 설치', responsibleTeamName: '1공구팀', companyName: '(주)대한건설' },
        { date: '2024-01-01', siteName: '판교 테크노밸리 2단계', teamName: '철근조', workerName: '박진우', manDay: 1, role: '철근공', unitPrice: 230000, payType: '일급제', workContent: '철근 배근', responsibleTeamName: '철근조', companyName: '삼성엔지니어링' }
    ];


    const validateRow = async (row: any): Promise<ValidationResult> => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let status: 'NEW' | 'UPDATE' | 'IDENTICAL' = 'NEW';
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        // 필수 검증
        if (!row.date) errors.push('날짜 필수');
        if (!row.siteName) errors.push('현장명 필수');
        if (!row.teamName) errors.push('팀명 필수');
        if (!row.workerName) errors.push('작업자명 필수');
        if (!row.manDay) errors.push('공수 필수');

        if (errors.length > 0) {
            return { isValid: false, errors, warnings, status, changes };
        }

        const workerKey = normalizeNameForCompare(row.workerName);
        const siteKey = normalizeNameForCompare(row.siteName);
        const teamKey = normalizeNameForCompare(row.teamName);

        // 작업자 검증
        if (!workers.has(workerKey)) {
            if (autoCreateWorker) {
                warnings.push(`미등록 작업자: ${row.workerName} (자동 생성됩니다)`);
            } else {
                errors.push(`미등록 작업자: ${row.workerName} (먼저 작업자를 등록하거나 자동 생성 옵션을 활성화하세요)`);
            }
        }

        // 현장 검증
        if (!sites.has(siteKey)) {
            warnings.push(`새로운 현장: ${row.siteName} (자동 생성됩니다)`);
        }

        // 팀 검증
        if (!teams.has(teamKey)) {
            warnings.push(`새로운 팀: ${row.teamName} (자동 생성됩니다)`);
        }

        // 공수 검증
        const manDay = normalizeNumber(row.manDay);
        if (manDay <= 0 || manDay > 3) {
            warnings.push(`공수 확인 필요: ${row.manDay} (일반적으로 0.5~2.0)`);
        }

        // 단가 검증
        if (row.unitPrice) {
            const price = normalizeNumber(row.unitPrice);
            if (price < 50000 || price > 1000000) {
                warnings.push(`단가 범위 확인: ${row.unitPrice}`);
            }
        }

        // 날짜 포맷
        const dateStr = formatExcelDate(row.date);
        const site = sites.get(siteKey);
        const team = teams.get(teamKey);

        if (site && team && dateStr) {
            const key = `${dateStr}_${site.id}_${team.id}`;
            const existingWorkersList = existingReports.get(key);

            if (existingWorkersList) {
                const existingWorker = existingWorkersList.find(w =>
                    normalizeNameForCompare(w.name) === workerKey
                );
                if (existingWorker) {
                    let hasChanges = false;
                    const compare = (field: string, newVal: any, oldVal: any) => {
                        const newStr = normalizeString(newVal);
                        const oldStr = normalizeString(oldVal);
                        if (newStr && newStr !== oldStr) {
                            hasChanges = true;
                            changes.push({ field, oldValue: oldVal, newValue: newVal });
                        }
                    };

                    compare('manDay', row.manDay, existingWorker.manDay);
                    compare('role', row.role, existingWorker.role);
                    compare('workContent', row.workContent, existingWorker.workContent);
                    compare('payType', row.payType, existingWorker.payType);
                    compare('unitPrice', row.unitPrice, existingWorker.unitPrice);

                    if (hasChanges) {
                        status = 'UPDATE';
                        warnings.push('기존 일보와 다른 정보가 있습니다.');
                    } else {
                        status = 'IDENTICAL';
                        warnings.push('기존 일보와 동일합니다.');
                    }
                }
            }
        }

        return { isValid: errors.length === 0, errors, warnings, status, changes };
    };

    const saveBatch = async (rows: any[], options?: { overwrite: boolean }): Promise<{ success: number; failed: number; skipped: number }> => {
        const newLogs: string[] = [];
        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        // 그룹화를 위한 맵
        const groups: { [key: string]: any[] } = {};
        const groupMeta: {
            [key: string]: {
                date: string, siteId: string, teamId: string,
                siteName: string, teamName: string, responsibleTeamName: string,
                companyId?: string, companyName?: string
            }
        } = {};

        // 배치 내에서 새로 생성된 데이터 임시 캐시
        const tempTeams = new Map(teams);
        const tempSites = new Map(sites);
        const tempWorkers = new Map(workers);

        for (const row of rows) {
            if (!row.date || !row.siteName || !row.teamName || !row.workerName || !row.manDay) {
                failCount++;
                newLogs.push(`[실패] 필수 필드 누락`);
                continue;
            }

            const workerKey = normalizeNameForCompare(row.workerName);
            const siteKey = normalizeNameForCompare(row.siteName);
            const teamKey = normalizeNameForCompare(row.teamName);

            // 1. 작업자 체크 (자동 생성 옵션에 따라)
            let workerData = tempWorkers.get(workerKey);
            if (!workerData) {
                if (autoCreateWorker) {
                    try {
                        const newWorkerId = await manpowerService.addWorker({
                            name: normalizeString(row.workerName),
                            idNumber: '',
                            contact: '',
                            role: normalizeString(row.role) || '작업자',
                            status: 'available',
                            unitPrice: normalizeNumber(row.unitPrice) || 0,
                            payType: normalizeString(row.payType) || '일급제',
                            teamId: '',
                            teamType: '일용직'
                        });
                        const newWorker: Worker = {
                            id: newWorkerId,
                            name: normalizeString(row.workerName),
                            idNumber: '',
                            role: normalizeString(row.role) || '작업자',
                            status: 'available',
                            unitPrice: normalizeNumber(row.unitPrice) || 0,
                            payType: normalizeString(row.payType) || '일급제',
                            teamType: '일용직'
                        };
                        tempWorkers.set(workerKey, newWorker);
                        workerData = newWorker;
                        newLogs.push(`[자동생성] 작업자: ${row.workerName}`);
                    } catch (e) {
                        console.error("Worker creation failed", e);
                        failCount++;
                        newLogs.push(`[실패] 작업자 생성 실패: ${row.workerName}`);
                        continue;
                    }
                } else {
                    failCount++;
                    newLogs.push(`[실패] ${row.workerName}: 미등록 작업자`);
                    continue;
                }
            }

            // 2. 현장 체크 (자동 생성)
            let site = tempSites.get(siteKey);
            if (!site) {
                try {
                    const newSiteId = await siteService.addSite({
                        name: normalizeString(row.siteName),
                        code: `S-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        address: '',
                        status: 'active',
                        companyName: normalizeString(row.companyName) || undefined
                    });
                    const newSite: Site = {
                        id: newSiteId,
                        name: normalizeString(row.siteName),
                        code: `S-${Date.now()}`,
                        address: '',
                        status: 'active',
                        companyName: normalizeString(row.companyName) || undefined
                    };
                    tempSites.set(siteKey, newSite);
                    site = newSite;
                    newLogs.push(`[자동생성] 현장: ${row.siteName}`);
                } catch (e) {
                    console.error("Site creation failed", e);
                    failCount++;
                    newLogs.push(`[실패] 현장 생성 실패: ${row.siteName}`);
                    continue;
                }
            }

            // 3. 팀 체크 (자동 생성)
            let team = tempTeams.get(teamKey);
            if (!team) {
                try {
                    const newTeamId = await teamService.addTeam({
                        name: normalizeString(row.teamName),
                        leaderName: '미지정',
                        leaderId: '',
                        type: '미지정',
                        memberCount: 0
                    });
                    const newTeam: Team = {
                        id: newTeamId,
                        name: normalizeString(row.teamName),
                        leaderName: '미지정',
                        leaderId: '',
                        type: '미지정'
                    };
                    tempTeams.set(teamKey, newTeam);
                    team = newTeam;
                    newLogs.push(`[자동생성] 팀: ${row.teamName}`);
                } catch (e) {
                    console.error("Team creation failed", e);
                    failCount++;
                    newLogs.push(`[실패] 팀 생성 실패: ${row.teamName}`);
                    continue;
                }
            }

            // 날짜 포맷
            const dateStr = formatExcelDate(row.date);
            const key = `${dateStr}_${site.id}_${team.id}`;

            // 그룹화
            if (!groups[key]) {
                groups[key] = [];
                groupMeta[key] = {
                    date: dateStr,
                    siteId: site.id!,
                    teamId: team.id!,
                    siteName: site.name,
                    teamName: team.name,
                    responsibleTeamName: normalizeString(row.responsibleTeamName) || team.name,
                    companyId: site.companyId,
                    companyName: site.companyName
                };
            }
            groups[key].push({ ...row, workerData });
        }

        // 그룹별 저장
        for (const key in groups) {
            const groupRows = groups[key];
            const meta = groupMeta[key];

            try {
                const reports = await dailyReportService.getReports(meta.date, meta.teamId);
                const targetReport = reports.find(r => r.siteId === meta.siteId);

                let currentWorkers: DailyReportWorker[] = [];
                if (targetReport) currentWorkers = [...targetReport.workers];

                for (const row of groupRows) {
                    const workerKey = normalizeNameForCompare(row.workerName);
                    const existingWorkerIndex = currentWorkers.findIndex(w =>
                        normalizeNameForCompare(w.name) === workerKey
                    );

                    const workerDB = row.workerData as Worker;

                    const newWorkerData: DailyReportWorker = {
                        workerId: workerDB.id!,
                        name: workerDB.name,
                        role: normalizeString(row.role) || workerDB.role || '작업자',
                        status: 'attendance',
                        manDay: normalizeNumber(row.manDay) || 1.0,
                        workContent: normalizeString(row.workContent) || '',
                        teamId: meta.teamId,
                        unitPrice: normalizeNumber(row.unitPrice) || workerDB.unitPrice || 0,
                        payType: normalizeString(row.payType) || workerDB.payType || '일급제',
                        salaryModel: workerDB.salaryModel || '일급제'
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

                const totalManDay = currentWorkers.reduce((sum, w) => sum + (w.manDay || 0), 0);

                if (targetReport && targetReport.id) {
                    await dailyReportService.updateReport(targetReport.id, {
                        workers: currentWorkers,
                        totalManDay,
                        responsibleTeamName: meta.responsibleTeamName
                    });
                    successCount += groupRows.length;
                    newLogs.push(`[수정] ${meta.date} ${meta.siteName} ${meta.teamName} (${currentWorkers.length}명)`);
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
                        writerId: currentUser?.uid || 'excel_upload',
                        weather: '맑음',
                        workContent: '엑셀 일괄 등록'
                    });
                    successCount += groupRows.length;
                    newLogs.push(`[신규] ${meta.date} ${meta.siteName} ${meta.teamName} (${currentWorkers.length}명)`);
                }

            } catch (e: any) {
                console.error(e);
                failCount += groupRows.length;
                newLogs.push(`[실패] ${meta.date} ${meta.teamName}: ${e.message || '알 수 없는 오류'}`);
            }
        }

        setLogs(prev => [...newLogs, ...prev].slice(0, 100));
        return { success: successCount, failed: failCount, skipped: skippedCount };
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">출력일보 대량 등록</h2>

            {/* 옵션 패널 */}
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h3 className="font-semibold text-amber-800 mb-3">업로드 옵션</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={autoCreateWorker}
                        onChange={(e) => setAutoCreateWorker(e.target.checked)}
                        className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm text-amber-900">
                        미등록 작업자 자동 생성
                        <span className="text-amber-600 ml-1">(체크 시 엑셀에 있는 미등록 작업자를 기본 정보로 자동 생성합니다)</span>
                    </span>
                </label>
            </div>

            <ExcelUploadWizard
                title="출력일보 엑셀 업로드"
                description="날짜, 현장명, 팀명, 작업자명, 공수가 포함된 엑셀 파일을 업로드하세요."
                fields={fields}
                onValidate={validateRow}
                onSaveBatch={saveBatch}
                sampleFileName="일보_대량등록_샘플"
                sampleData={sampleData}
            />
            {logs.length > 0 && (
                <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-bold mb-2 text-slate-700">처리 로그</h3>
                    <div className="max-h-60 overflow-y-auto font-mono text-sm text-slate-600">
                        {logs.map((log, i) => (
                            <div key={i} className={
                                log.includes('[실패]') ? 'text-red-600' :
                                    log.includes('[신규]') ? 'text-green-600' :
                                        log.includes('[수정]') ? 'text-blue-600' :
                                            log.includes('[자동생성]') ? 'text-amber-600' :
                                                'text-slate-500'
                            }>{log}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyReportMassUploader;
