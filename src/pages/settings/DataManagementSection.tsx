import React, { useState } from 'react';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import { siteService } from '../../services/siteService';
import { companyService } from '../../services/companyService';
import { dispatchService } from '../../services/dispatchService';
import { coreMigrationService } from '../../services/coreMigrationService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSync, faDownload, faUpload, faTrash, faSpinner, faDatabase, faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import { fetchCollectionData } from '../../services/backupService';

const DataManagementSection: React.FC = () => {
    // System Management States
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; message: string } | null>(null);

    // --- Migration ---
    const handleRunMigration = async () => {
        if (!window.confirm('Firestore로의 데이터 이관(Batch 2)을 시작하시겠습니까?\n대상: 자재, 숙소, 차량 데이터')) return;

        setIsLoading(true);
        try {
            await coreMigrationService.runBatch2Migration((msg) => {
                setProgress({ current: 50, total: 100, message: msg });
            });
            alert('Batch 2 데이터 이관이 완료되었습니다.');
            window.location.reload();
        } catch (error) {
            console.error('Migration failed:', error);
            alert('이관 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
            setProgress(null);
        }
    };

    // Define all collections to manage
    const COLLECTIONS = [
        'workers',          // 작업자 DB
        'teams',            // 팀 DB
        'sites',            // 현장 DB
        'daily_reports',    // 일보 데이터
        'companies',        // 회사 DB
        'positions',        // 직책 설정
        'daily_dispatches', // 일일 배정 현황
        'settlements',      // 정산 데이터
        'vehicles',         // 차량 관리
        'audit_logs',       // 시스템 로그
        'system_config'     // 권한 등 시스템 설정
    ];

    const DC_COLLECTIONS = ['workers', 'teams', 'sites', 'daily_reports', 'companies', 'daily_dispatches'];
    const FIRESTORE_COLLECTIONS = COLLECTIONS.filter((c) => !DC_COLLECTIONS.includes(c));

    const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    // --- Backup ---
    const handleBackup = async () => {
        setIsLoading(true);
        setProgress({ current: 0, total: 100, message: '데이터를 수집하는 중...' });
        try {
            const backupData: { [key: string]: any[] } = {};
            let totalDocs = 0;

            setProgress({ current: 0, total: 100, message: `운영 데이터 수집 중...` });
            const [workers, teams, sites, dailyReports, companies, dailyDispatches] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                siteService.getSites(),
                dailyReportService.getAllReports(),
                companyService.getCompanies(),
                dispatchService.getAllDispatches()
            ]);

            backupData.workers = workers;
            backupData.teams = teams;
            backupData.sites = sites;
            backupData.daily_reports = dailyReports;
            backupData.companies = companies;
            backupData.daily_dispatches = dailyDispatches;

            totalDocs += workers.length;
            totalDocs += teams.length;
            totalDocs += sites.length;
            totalDocs += dailyReports.length;
            totalDocs += companies.length;
            totalDocs += dailyDispatches.length;

            for (const colName of FIRESTORE_COLLECTIONS) {
                setProgress({ current: 0, total: 100, message: `${colName} 데이터 수집 중...` });
                try {
                    const data = await fetchCollectionData(colName);
                    backupData[colName] = data;
                    totalDocs += Array.isArray(data) ? data.length : 0;
                } catch {
                    backupData[colName] = [];
                }
            }

            const finalData = {
                ...backupData,
                exportedAt: new Date().toISOString(),
                version: '2.0', // Version bumped due to schema expansion
                metadata: {
                    totalDocs,
                    collections: COLLECTIONS
                }
            };

            const jsonString = JSON.stringify(finalData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const now = new Date();
            const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
            const link = document.createElement('a');
            link.href = url;
            link.download = `smart_construction_backup_${timestamp}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert(`백업이 완료되었습니다.\n총 ${totalDocs}개의 데이터가 저장되었습니다.`);
        } catch (error) {
            console.error('Backup failed:', error);
            alert('백업 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
            setProgress(null);
        }
    };

    // --- Recovery ---
    const handleRecovery = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm('데이터 복구를 진행하시겠습니까?\n기존 데이터 중 ID가 중복되는 항목은 덮어쓰기 됩니다.')) {
            e.target.value = '';
            return;
        }

        setIsLoading(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const json = JSON.parse(evt.target?.result as string);

                // Basic validation
                if (!json.exportedAt || !json.workers) {
                    throw new Error('올바르지 않은 백업 파일 형식입니다.');
                }

                // Determine collections to restore (support v1 and v2)
                const collectionsToRestore = json.metadata?.collections || COLLECTIONS;

                const sample = json?.workers?.[0] ?? json?.teams?.[0] ?? json?.sites?.[0] ?? null;
                const sampleId = sample?.id ? String(sample.id) : '';
                const sampleLegacyId = sample?.legacyId ? String(sample.legacyId) : '';
                if (sampleId && isUuidString(sampleId) && !sampleLegacyId) {
                    throw new Error('legacy UUID 기반 백업 파일은 legacyId 없이 복구할 수 없습니다.');
                }

                let totalItems = 0;
                for (const colName of collectionsToRestore) {
                    if (json[colName]) {
                        totalItems += json[colName].length;
                    }
                }

                let processedItems = 0;

                const dcRestoreOrder = ['companies', 'teams', 'sites', 'workers', 'daily_dispatches', 'daily_reports'];
                const dcCollectionsToRestore = collectionsToRestore.filter((c: string) => DC_COLLECTIONS.includes(c));
                const firestoreCollectionsToRestore = collectionsToRestore.filter((c: string) => !DC_COLLECTIONS.includes(c));

                for (const colName of dcRestoreOrder) {
                    if (!dcCollectionsToRestore.includes(colName)) continue;
                    const data = json[colName];
                    if (!data || !Array.isArray(data)) continue;

                    for (const item of data) {
                        const legacyId = item?.legacyId ? String(item.legacyId) : (item?.id ? String(item.id) : '');
                        if (!legacyId) continue;

                        if (colName === 'companies') {
                            try {
                                await companyService.updateCompany(legacyId, item);
                            } catch {
                                await companyService.addCompany({ ...(item as any), legacyId, id: undefined } as any);
                            }
                        }

                        if (colName === 'teams') {
                            try {
                                await teamService.updateTeam(legacyId, item);
                            } catch {
                                await teamService.addTeam({ ...(item as any), legacyId, id: undefined } as any);
                            }
                        }

                        if (colName === 'sites') {
                            try {
                                await siteService.updateSite(legacyId, item);
                            } catch {
                                await siteService.addSite({ ...(item as any), legacyId, id: undefined } as any);
                            }
                        }

                        if (colName === 'workers') {
                            try {
                                await manpowerService.updateWorker(legacyId, item);
                            } catch {
                                await manpowerService.addWorker({ ...(item as any), legacyId, id: undefined } as any);
                            }
                        }

                        if (colName === 'daily_dispatches') {
                            const date = item?.date ? String(item.date) : legacyId;
                            let assignments: any[] = [];
                            const raw = item?.assignments;
                            if (Array.isArray(raw)) assignments = raw;
                            if (typeof raw === 'string') {
                                try {
                                    const parsed = JSON.parse(raw);
                                    if (Array.isArray(parsed)) assignments = parsed;
                                } catch {
                                    assignments = [];
                                }
                            }
                            await dispatchService.saveDispatch(date, assignments as any);
                        }

                        if (colName === 'daily_reports') {
                            try {
                                await dailyReportService.updateReport(legacyId, {
                                    date: (item as any)?.date,
                                    teamId: (item as any)?.teamId,
                                    siteId: (item as any)?.siteId,
                                    siteName: (item as any)?.siteName,
                                    weather: (item as any)?.weather,
                                    companyName: (item as any)?.companyName,
                                    responsibleTeamId: (item as any)?.responsibleTeamId,
                                    responsibleTeamName: (item as any)?.responsibleTeamName,
                                    workContent: (item as any)?.workContent,
                                    totalManDay: (item as any)?.totalManDay,
                                    totalAmount: (item as any)?.totalAmount,
                                    writerId: (item as any)?.writerId,
                                    workers: (item as any)?.workers ?? []
                                } as any);
                            } catch {
                                await dailyReportService.addReport({ ...(item as any), legacyId, id: undefined } as any);
                            }
                        }

                        processedItems++;
                        if (processedItems % 10 === 0) {
                            setProgress({ current: processedItems, total: totalItems, message: `${colName} 복구 중... (${processedItems}/${totalItems})` });
                        }
                    }
                }

                if (firestoreCollectionsToRestore.length > 0) {
                    console.warn('Firestore restore is disabled; skipped:', firestoreCollectionsToRestore);
                }

                alert('데이터 복구가 완료되었습니다. 페이지를 새로고침합니다.');
                window.location.reload();

            } catch (error) {
                console.error('Recovery failed:', error);
                alert(`복구 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
            } finally {
                setIsLoading(false);
                setProgress(null);
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    // --- Initialization ---
    const handleInitialize = async () => {
        if (!window.confirm('경고: 모든 데이터가 영구적으로 삭제됩니다.\n정말 초기화하시겠습니까?')) return;
        if (!window.confirm('마지막 확인: 정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;

        setIsLoading(true);
        try {
            const deleteDcCollection = async (colName: string) => {
                if (colName === 'daily_reports') {
                    const reports = await dailyReportService.getAllReports();
                    const ids = reports.map(r => r.id).filter(Boolean) as string[];
                    const total = ids.length;
                    const batchSize = 100;
                    let done = 0;
                    for (let i = 0; i < ids.length; i += batchSize) {
                        const chunk = ids.slice(i, i + batchSize);
                        await dailyReportService.deleteReports(chunk);
                        done += chunk.length;
                        setProgress({ current: done, total, message: `${colName} 삭제 중... (${done}/${total})` });
                    }
                    return;
                }

                if (colName === 'daily_dispatches') {
                    const all = await dispatchService.getAllDispatches();
                    const ids = all.map(d => d.id).filter(Boolean) as string[];
                    const total = ids.length;
                    let done = 0;
                    const batchSize = 50;
                    for (let i = 0; i < ids.length; i += batchSize) {
                        const chunk = ids.slice(i, i + batchSize);
                        await dispatchService.deleteDispatches(chunk);
                        done += chunk.length;
                        setProgress({ current: done, total, message: `${colName} 삭제 중... (${done}/${total})` });
                    }
                    return;
                }

                if (colName === 'workers') {
                    const workers = await manpowerService.getWorkers();
                    const ids = workers.map(w => w.id).filter(Boolean) as string[];
                    const total = ids.length;
                    let done = 0;
                    const batchSize = 50;
                    for (let i = 0; i < ids.length; i += batchSize) {
                        const chunk = ids.slice(i, i + batchSize);
                        await manpowerService.deleteWorkers(chunk);
                        done += chunk.length;
                        setProgress({ current: done, total, message: `${colName} 삭제 중... (${done}/${total})` });
                    }
                    return;
                }

                if (colName === 'teams') {
                    const teams = await teamService.getTeams();
                    const ids = teams.map(t => t.id).filter(Boolean) as string[];
                    const total = ids.length;
                    for (let i = 0; i < ids.length; i++) {
                        await teamService.deleteTeam(ids[i]);
                        if (i % 10 === 0 || i === ids.length - 1) {
                            setProgress({ current: i + 1, total, message: `${colName} 삭제 중... (${i + 1}/${total})` });
                        }
                    }
                    return;
                }

                if (colName === 'sites') {
                    const sites = await siteService.getSites();
                    const ids = sites.map(s => s.id).filter(Boolean) as string[];
                    const total = ids.length;
                    for (let i = 0; i < ids.length; i++) {
                        await siteService.deleteSite(ids[i]);
                        if (i % 10 === 0 || i === ids.length - 1) {
                            setProgress({ current: i + 1, total, message: `${colName} 삭제 중... (${i + 1}/${total})` });
                        }
                    }
                    return;
                }

                if (colName === 'companies') {
                    const companies = await companyService.getCompanies();
                    const ids = companies.map(c => c.id).filter(Boolean) as string[];
                    const total = ids.length;
                    for (let i = 0; i < ids.length; i++) {
                        await companyService.deleteCompany(ids[i]);
                        if (i % 10 === 0 || i === ids.length - 1) {
                            setProgress({ current: i + 1, total, message: `${colName} 삭제 중... (${i + 1}/${total})` });
                        }
                    }
                    return;
                }
            };

            const ordered = [
                'daily_reports',
                'daily_dispatches',
                'workers',
                'teams',
                'sites',
                'companies'
            ];

            for (const colName of ordered) {
                setProgress({ current: 0, total: 100, message: `${colName} 데이터 삭제 중...` });

                if (DC_COLLECTIONS.includes(colName)) {
                    await deleteDcCollection(colName);
                    continue;
                }

                console.warn('Firestore initialization is disabled; skipped:', colName);
            }

            alert('모든 데이터가 초기화되었습니다.');
            window.location.reload();

        } catch (error) {
            console.error('Initialization failed:', error);
            alert('초기화 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
            setProgress(null);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Progress Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-brand-600 mb-4" />
                        <h3 className="text-xl font-bold text-slate-800 mb-2">작업 진행 중...</h3>
                        <p className="text-slate-600 mb-4">{progress?.message || '잠시만 기다려주세요.'}</p>
                        {progress && (
                            <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2">
                                <div
                                    className="bg-brand-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faSync} className="text-brand-600" />
                    데이터 관리
                </h3>
            </div>
            <div className="p-6 space-y-8">

                {/* Data Scope Information */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                    <h4 className="font-bold text-slate-700 mb-2">관리 대상 데이터 (총 11종)</h4>
                    <p className="text-slate-500 mb-3">
                        백업, 복구, 초기화 작업은 아래의 모든 데이터를 대상으로 수행됩니다.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-600">
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>작업자 DB</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>팀 DB</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>현장 DB</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>회사 DB</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>일보 데이터</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>일일 배정</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>정산 데이터</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>직책 설정</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>차량 관리</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>시스템 설정</div>
                        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>시스템 로그</div>
                    </div>
                </div>

                {/* 0. Firestore Migration (Batch 2) */}
                <div className="bg-brand-50 p-6 rounded-xl border border-brand-100 mb-8 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="bg-brand-100 p-3 rounded-lg text-brand-600">
                            <FontAwesomeIcon icon={faDatabase} size="lg" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 mb-1">Firestore 데이터 이관 (Batch 2)</h3>
                            <p className="text-sm text-slate-600 mb-4">
                                <span className="font-bold text-brand-700">자재, 숙소, 차량</span> 데이터의 Firestore 적재 상태를 점검합니다.<br />
                                이 작업은 기존 데이터를 삭제하지 않으며, 동일한 ID가 있을 경우 업데이트(Merge)합니다.
                            </p>
                            <button
                                onClick={handleRunMigration}
                                disabled={isLoading}
                                className="bg-brand-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-700 transition shadow-md flex items-center gap-2 disabled:opacity-50"
                            >
                                <FontAwesomeIcon icon={faSync} spin={isLoading} />
                                데이터 이관 실행
                                <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 1. Backup & Recovery */}
                <div>
                    <h4 className="font-bold text-slate-700 mb-4">시스템 백업 및 복구</h4>
                    <div className="space-y-4">
                        {/* Backup */}
                        <div className="flex items-start gap-4">
                            <div className="bg-green-100 p-3 rounded-lg text-green-600">
                                <FontAwesomeIcon icon={faDownload} size="lg" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 mb-1">데이터 백업</h3>
                                <p className="text-sm text-slate-500 mb-3">
                                    현재 시스템의 모든 데이터(작업자, 팀, 현장, 일보)를 JSON 파일로 다운로드합니다.
                                </p>
                                <button
                                    onClick={handleBackup}
                                    disabled={isLoading}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition shadow-sm disabled:opacity-50"
                                >
                                    백업 파일 다운로드
                                </button>
                            </div>
                        </div>

                        {/* Recovery */}
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                                <FontAwesomeIcon icon={faUpload} size="lg" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 mb-1">데이터 복구</h3>
                                <p className="text-sm text-slate-500 mb-3">
                                    백업된 JSON 파일을 업로드하여 데이터를 복구합니다.
                                    <span className="text-red-500 font-bold"> 주의: 동일한 ID를 가진 데이터는 덮어쓰기 됩니다.</span>
                                </p>
                                <label className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm cursor-pointer inline-block">
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={handleRecovery}
                                        disabled={isLoading}
                                        className="hidden"
                                    />
                                    백업 파일 업로드
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="border-slate-100" />

                {/* 2. Initialization */}
                <div>
                    <h4 className="font-bold text-slate-700 mb-4 text-red-600">위험 구역</h4>
                    <div className="flex items-start gap-4">
                        <div className="bg-red-100 p-3 rounded-lg text-red-600">
                            <FontAwesomeIcon icon={faTrash} size="lg" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 mb-1">데이터 초기화</h3>
                            <p className="text-sm text-slate-500 mb-3">
                                <span className="text-red-600 font-bold">경고: 모든 데이터를 영구적으로 삭제합니다.</span>
                                이 작업은 되돌릴 수 없습니다.
                            </p>
                            <button
                                onClick={handleInitialize}
                                disabled={isLoading}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-sm disabled:opacity-50"
                            >
                                시스템 초기화
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataManagementSection;
