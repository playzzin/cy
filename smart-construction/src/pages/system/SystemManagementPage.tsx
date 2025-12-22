import React, { useState } from 'react';
import { manpowerService } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import { siteService } from '../../services/siteService';
import { companyService } from '../../services/companyService';
import { dailyReportService } from '../../services/dailyReportService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faUpload, faTrash, faBook, faExclamationTriangle, faCheckCircle, faSpinner, faTimes, faChartPie, faSitemap } from '@fortawesome/free-solid-svg-icons';
import { db } from '../../firebase/config';
import { collection, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';

import { useNavigate } from 'react-router-dom';

const SystemManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; message: string } | null>(null);

    // --- Backup ---
    const handleBackup = async () => {
        setIsLoading(true);
        setProgress({ current: 0, total: 100, message: '데이터를 수집하는 중...' });
        try {
            const [workers, teams, sites, reports] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                siteService.getSites(),
                dailyReportService.getAllReports()
            ]);

            const backupData = {
                workers,
                teams,
                sites,
                dailyReports: reports,
                exportedAt: new Date().toISOString(),
                version: '1.0'
            };

            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const now = new Date();
            const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
            const link = document.createElement('a');
            link.href = url;
            link.download = `backup_${timestamp}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert('백업이 완료되었습니다.');
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

                // Validate structure roughly
                if (!json.workers || !json.teams || !json.sites || !json.dailyReports) {
                    throw new Error('올바르지 않은 백업 파일 형식입니다.');
                }

                const collections = [
                    { name: 'workers', data: json.workers },
                    { name: 'teams', data: json.teams },
                    { name: 'sites', data: json.sites },
                    { name: 'dailyReports', data: json.dailyReports }
                ];

                let totalItems = collections.reduce((acc, curr) => acc + curr.data.length, 0);
                let processedItems = 0;

                for (const col of collections) {
                    for (const item of col.data) {
                        if (item.id) {
                            await setDoc(doc(db, col.name, item.id), item, { merge: false });
                        } else {
                            // If no ID, skip or handle? For now skip to be safe/consistent with plan
                            console.warn(`Skipping item without ID in ${col.name}`);
                        }
                        processedItems++;
                        setProgress({
                            current: processedItems,
                            total: totalItems,
                            message: `${col.name} 복구 중... (${processedItems}/${totalItems})`
                        });
                    }
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

    // --- Helper: Delete Collection Data ---
    const deleteCollectionData = async (colName: string, displayName: string) => {
        setProgress({ current: 0, total: 100, message: `${displayName} 데이터 삭제 중...` });

        const q = collection(db, colName);
        const snapshot = await getDocs(q);
        const totalDocs = snapshot.size;
        let deletedDocs = 0;

        if (totalDocs === 0) return;

        // Batch delete in chunks of 500
        const chunks = [];
        let batch = writeBatch(db);
        let count = 0;

        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
            if (count === 500) {
                chunks.push(batch);
                batch = writeBatch(db);
                count = 0;
            }
        });
        if (count > 0) chunks.push(batch);

        for (const b of chunks) {
            await b.commit();
            deletedDocs += 500; // Approximate for progress
            setProgress({
                current: Math.min(deletedDocs, totalDocs),
                total: totalDocs,
                message: `${displayName} 삭제 중... (${Math.min(deletedDocs, totalDocs)}/${totalDocs})`
            });
        }
    };

    // --- Individual Collection Initialization ---
    const handleClearCollection = async (colName: string, displayName: string) => {
        if (!window.confirm(`경고: ${displayName} 데이터를 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

        setIsLoading(true);
        try {
            await deleteCollectionData(colName, displayName);
            alert(`${displayName} 데이터가 초기화되었습니다.`);
            window.location.reload();
        } catch (error) {
            console.error(`${displayName} initialization failed:`, error);
            alert(`${displayName} 초기화 중 오류가 발생했습니다.`);
        } finally {
            setIsLoading(false);
            setProgress(null);
        }
    };

    // --- Full Initialization ---
    const handleInitialize = async () => {
        if (!window.confirm('경고: 모든 데이터가 영구적으로 삭제됩니다.\n정말 초기화하시겠습니까?')) return;
        if (!window.confirm('마지막 확인: 정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;

        setIsLoading(true);
        try {
            const collections = [
                { name: 'workers', label: '작업자' },
                { name: 'teams', label: '팀' },
                { name: 'sites', label: '현장' },
                { name: 'daily_reports', label: '일보' },
                { name: 'companies', label: '업체' }
            ];

            for (const col of collections) {
                await deleteCollectionData(col.name, col.label);
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

    // --- Data Synchronization ---
    const [syncPreview, setSyncPreview] = useState<{
        workersToTeam: { id: string; name: string; targetId: string; targetName: string }[];
        workersToCompany: { id: string; name: string; targetId: string; targetName: string }[];
        workersToRole: { id: string; name: string; targetRole: string; reason: string }[];
        teamsToLeader: { id: string; name: string; targetId: string; targetName: string }[];
        teamsToCompany: { id: string; name: string; targetId: string; targetName: string }[];
        sitesToTeam: { id: string; name: string; targetId: string; targetName: string }[];
        sitesToCompany: { id: string; name: string; targetId: string; targetName: string }[];
    } | null>(null);

    const handleAnalyze = async () => {
        setIsLoading(true);
        setProgress({ current: 0, total: 100, message: '데이터 분석 중...' });
        try {
            const [workers, teams, sites, companies] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                siteService.getSites(),
                companyService.getCompanies()
            ]);

            const changes = {
                workersToTeam: [] as any[],
                workersToCompany: [] as any[],
                workersToRole: [] as any[],
                teamsToLeader: [] as any[],
                teamsToCompany: [] as any[],
                sitesToTeam: [] as any[],
                sitesToCompany: [] as any[]
            };

            // 1. Worker Sync
            workers.forEach(w => {
                // Link Team
                if (w.teamName) {
                    const targetTeam = teams.find(t => t.name === w.teamName);
                    // If target found AND (no current link OR (overwrite is true AND link is different))
                    // For now, let's just show all mismatches and let user decide?
                    // Or just stick to "missing only" unless we add a checkbox.
                    // Let's assume user wants to fix mismatches.
                    if (targetTeam && w.teamId !== targetTeam.id) {
                        changes.workersToTeam.push({ id: w.id, name: w.name, targetId: targetTeam.id, targetName: targetTeam.name, currentId: w.teamId });
                    }
                }
                // Link Company
                if (w.companyName) {
                    const targetCompany = companies.find(c => c.name === w.companyName);
                    if (targetCompany && w.companyId !== targetCompany.id) {
                        changes.workersToCompany.push({ id: w.id, name: w.name, targetId: targetCompany.id, targetName: targetCompany.name, currentId: w.companyId });
                    }
                }
            });

            // 2. Team Sync
            teams.forEach(t => {
                // Link Leader
                if (t.leaderName) {
                    const targetWorker = workers.find(w => w.name === t.leaderName);

                    // 2-1. Link Team -> Leader
                    if (targetWorker && t.leaderId !== targetWorker.id) {
                        changes.teamsToLeader.push({ id: t.id, name: t.name, targetId: targetWorker.id, targetName: targetWorker.name });
                    }

                    // 2-2. Update Worker Role (if found and not already '팀장')
                    if (targetWorker && targetWorker.role !== '팀장') {
                        // Check if not already added to changes
                        if (!changes.workersToRole.find((c: any) => c.id === targetWorker.id)) {
                            changes.workersToRole.push({ id: targetWorker.id, name: targetWorker.name, targetRole: '팀장', reason: `${t.name}의 팀장` });
                        }
                    }
                }

                // Link Company
                if (t.companyName) {
                    const targetCompany = companies.find(c => c.name === t.companyName);
                    if (targetCompany && t.companyId !== targetCompany.id) {
                        changes.teamsToCompany.push({ id: t.id, name: t.name, targetId: targetCompany.id, targetName: targetCompany.name });
                    }
                }
            });

            // 3. Site Sync
            sites.forEach(s => {
                // Link Responsible Team
                if (s.responsibleTeamName) {
                    const targetTeam = teams.find(t => t.name === s.responsibleTeamName);
                    if (targetTeam && s.responsibleTeamId !== targetTeam.id) {
                        changes.sitesToTeam.push({ id: s.id, name: s.name, targetId: targetTeam.id, targetName: targetTeam.name });
                    }
                }
                // Link Company
                if ((s as any).companyName) {
                    const targetCompany = companies.find(c => c.name === (s as any).companyName);
                    if (targetCompany && (s as any).companyId !== targetCompany.id) {
                        changes.sitesToCompany.push({ id: s.id, name: s.name, targetId: targetCompany.id, targetName: targetCompany.name });
                    }
                }
            });

            const totalChanges = Object.values(changes).reduce((acc, arr) => acc + arr.length, 0);
            if (totalChanges === 0) {
                alert('동기화할 데이터가 없습니다. 모든 연결이 이미 완료되었습니다.');
            } else {
                setSyncPreview(changes);
            }

        } catch (error) {
            console.error("Analysis failed:", error);
            alert("데이터 분석 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
            setProgress(null);
        }
    };

    const handleExecuteSync = async () => {
        if (!syncPreview) return;
        if (!window.confirm('분석된 내용대로 데이터를 동기화하시겠습니까?')) return;

        setIsLoading(true);
        setProgress({ current: 0, total: 100, message: '데이터 동기화 중...' });

        try {
            const batch = writeBatch(db);
            let operationCount = 0;
            const MAX_BATCH_SIZE = 450; // Safety margin
            const batches = [batch];

            const addToBatch = (ref: any, data: any) => {
                batches[batches.length - 1].update(ref, data);
                operationCount++;
                if (operationCount >= MAX_BATCH_SIZE) {
                    batches.push(writeBatch(db));
                    operationCount = 0;
                }
            };

            // Workers
            syncPreview.workersToTeam.forEach(item => {
                addToBatch(doc(db, 'workers', item.id), { teamId: item.targetId });
            });
            syncPreview.workersToCompany.forEach(item => {
                addToBatch(doc(db, 'workers', item.id), { companyId: item.targetId });
            });
            syncPreview.workersToRole.forEach(item => {
                addToBatch(doc(db, 'workers', item.id), { role: item.targetRole });
            });

            // Teams
            syncPreview.teamsToLeader.forEach(item => {
                addToBatch(doc(db, 'teams', item.id), { leaderId: item.targetId });
            });
            syncPreview.teamsToCompany.forEach(item => {
                addToBatch(doc(db, 'teams', item.id), { companyId: item.targetId });
            });

            // Sites
            syncPreview.sitesToTeam.forEach(item => {
                addToBatch(doc(db, 'sites', item.id), { responsibleTeamId: item.targetId });
            });
            syncPreview.sitesToCompany.forEach(item => {
                addToBatch(doc(db, 'sites', item.id), { companyId: item.targetId });
            });

            // Commit all batches
            for (const b of batches) {
                await b.commit();
            }

            alert('데이터 동기화가 완료되었습니다.');
            setSyncPreview(null);
            window.location.reload();

        } catch (error) {
            console.error("Sync execution failed:", error);
            alert("동기화 적용 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
            setProgress(null);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto font-['Pretendard']">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-slate-400" />
                시스템 관리
            </h1>

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

            {/* Sync Preview Modal */}
            {syncPreview && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <h3 className="text-xl font-bold text-slate-800">데이터 동기화 미리보기</h3>
                            <button onClick={() => setSyncPreview(null)} className="text-slate-400 hover:text-slate-600">
                                <FontAwesomeIcon icon={faTimes} size="lg" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="bg-blue-50 p-4 rounded-lg text-blue-800 text-sm mb-4">
                                <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
                                아래 항목들이 이름 매칭을 통해 자동으로 연결됩니다.
                            </div>

                            {/* Workers -> Team */}
                            {syncPreview.workersToTeam.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">작업자 → 팀 연결 ({syncPreview.workersToTeam.length}건)</h4>
                                    <ul className="text-sm text-slate-600 space-y-1 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded">
                                        {syncPreview.workersToTeam.map((item, idx) => (
                                            <li key={idx}>
                                                {item.name} → {item.targetName}
                                                {(item as any).currentId && <span className="text-xs text-orange-500 ml-2">(변경)</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Workers -> Company */}
                            {syncPreview.workersToCompany.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">작업자 → 업체 연결 ({syncPreview.workersToCompany.length}건)</h4>
                                    <ul className="text-sm text-slate-600 space-y-1 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded">
                                        {syncPreview.workersToCompany.map((item, idx) => (
                                            <li key={idx}>{item.name} → {item.targetName}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Workers -> Role */}
                            {syncPreview.workersToRole.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">작업자 직책 변경 (팀장 자동 지정) ({syncPreview.workersToRole.length}건)</h4>
                                    <ul className="text-sm text-slate-600 space-y-1 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded">
                                        {syncPreview.workersToRole.map((item, idx) => (
                                            <li key={idx}>{item.name} → {item.targetRole} ({item.reason})</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Teams -> Leader */}
                            {syncPreview.teamsToLeader.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">팀 → 팀장 연결 ({syncPreview.teamsToLeader.length}건)</h4>
                                    <ul className="text-sm text-slate-600 space-y-1 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded">
                                        {syncPreview.teamsToLeader.map((item, idx) => (
                                            <li key={idx}>{item.name} → {item.targetName}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Sites -> Team */}
                            {syncPreview.sitesToTeam.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">현장 → 담당팀 연결 ({syncPreview.sitesToTeam.length}건)</h4>
                                    <ul className="text-sm text-slate-600 space-y-1 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded">
                                        {syncPreview.sitesToTeam.map((item, idx) => (
                                            <li key={idx}>{item.name} → {item.targetName}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                            <button
                                onClick={() => setSyncPreview(null)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold transition"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleExecuteSync}
                                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-sm transition flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faCheckCircle} />
                                적용하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Data Management Section */}
                <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h2 className="font-bold text-slate-700 flex items-center gap-2">
                            <FontAwesomeIcon icon={faDownload} /> 데이터 관리
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Data Sync */}
                        <div className="flex items-start gap-4">
                            <div className="bg-indigo-100 p-3 rounded-lg text-indigo-600">
                                <FontAwesomeIcon icon={faCheckCircle} size="lg" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 mb-1">마스터 데이터 동기화</h3>
                                <p className="text-sm text-slate-500 mb-3">
                                    이름만 등록된 데이터들의 연결 고리(ID)를 자동으로 찾아 연결합니다.<br />
                                    <span className="text-xs text-slate-400">(작업자→팀, 팀→팀장, 현장→담당팀 등)</span>
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => navigate('/system/sync-status')}
                                        className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
                                    >
                                        <FontAwesomeIcon icon={faChartPie} />
                                        동기화 현황 시각화
                                    </button>
                                    <button
                                        onClick={() => navigate('/structure/organization')}
                                        className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
                                    >
                                        <FontAwesomeIcon icon={faSitemap} className="text-indigo-500" />
                                        조직도 보기
                                    </button>
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={isLoading}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                                    >
                                        데이터 분석 및 동기화
                                    </button>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100" />

                        {/* Backup */}
                        <div className="flex items-start gap-4">
                            <div className="bg-green-100 p-3 rounded-lg text-green-600">
                                <FontAwesomeIcon icon={faDownload} size="lg" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 mb-1">데이터 백업</h3>
                                <p className="text-sm text-slate-500 mb-3">
                                    현재 시스템의 모든 데이터(작업자, 팀, 현장, 일보)를 JSON 파일로 다운로드합니다.
                                    파일명에는 백업 시점이 포함됩니다.
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

                        <hr className="border-slate-100" />

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

                        <hr className="border-slate-100" />

                        {/* Initialization */}
                        <div className="flex items-start gap-4">
                            <div className="bg-red-100 p-3 rounded-lg text-red-600">
                                <FontAwesomeIcon icon={faTrash} size="lg" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 mb-1">전체 시스템 초기화</h3>
                                <p className="text-sm text-slate-500 mb-3">
                                    <span className="text-red-600 font-bold">경고: 모든 데이터를 영구적으로 삭제합니다.</span>
                                    이 작업은 되돌릴 수 없습니다. 반드시 백업 후 진행하세요.
                                </p>
                                <button
                                    onClick={handleInitialize}
                                    disabled={isLoading}
                                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-sm disabled:opacity-50"
                                >
                                    시스템 초기화 (전체 삭제)
                                </button>
                            </div>
                        </div>

                        <hr className="border-slate-100" />

                        {/* Individual Collection Initialization */}
                        <div className="flex items-start gap-4">
                            <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
                                <FontAwesomeIcon icon={faTrash} size="lg" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 mb-1">컬렉션별 초기화</h3>
                                <p className="text-sm text-slate-500 mb-3">
                                    특정 데이터만 선택하여 삭제합니다. 삭제된 데이터는 복구할 수 없습니다.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleClearCollection('companies', '업체(Company)')}
                                        disabled={isLoading}
                                        className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-red-600 hover:border-red-300 transition shadow-sm disabled:opacity-50"
                                    >
                                        업체 초기화
                                    </button>
                                    <button
                                        onClick={() => handleClearCollection('sites', '현장(Site)')}
                                        disabled={isLoading}
                                        className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-red-600 hover:border-red-300 transition shadow-sm disabled:opacity-50"
                                    >
                                        현장 초기화
                                    </button>
                                    <button
                                        onClick={() => handleClearCollection('teams', '팀(Team)')}
                                        disabled={isLoading}
                                        className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-red-600 hover:border-red-300 transition shadow-sm disabled:opacity-50"
                                    >
                                        팀 초기화
                                    </button>
                                    <button
                                        onClick={() => handleClearCollection('workers', '작업자(Worker)')}
                                        disabled={isLoading}
                                        className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-red-600 hover:border-red-300 transition shadow-sm disabled:opacity-50"
                                    >
                                        작업자 초기화
                                    </button>
                                    <button
                                        onClick={() => handleClearCollection('daily_reports', '일보(Daily Report)')}
                                        disabled={isLoading}
                                        className="bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-red-600 hover:border-red-300 transition shadow-sm disabled:opacity-50"
                                    >
                                        일보 초기화
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* User Manual Section */}
                <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h2 className="font-bold text-slate-700 flex items-center gap-2">
                            <FontAwesomeIcon icon={faBook} /> 사용 설명서
                        </h2>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-[600px] text-sm text-slate-700 leading-relaxed space-y-4">
                        <div>
                            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-brand-500" /> 1. 기초 데이터 등록
                            </h3>
                            <p className="pl-6">
                                <strong>작업자 DB:</strong> 작업자의 이름, 연락처, 단가, 계좌정보 등을 등록합니다. 엑셀 일괄 업로드도 가능합니다.<br />
                                <strong>팀 DB:</strong> 작업 팀을 구성하고 팀장을 지정합니다.<br />
                                <strong>현장 DB:</strong> 공사 현장 정보를 등록하고 담당 팀을 배정합니다.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-brand-500" /> 2. 일보 작성 (매일)
                            </h3>
                            <p className="pl-6">
                                <strong>일보 작성 메뉴:</strong> 날짜와 현장을 선택하고 작업 내용을 입력합니다.<br />
                                <strong>AI 사진 업로드:</strong> 카카오톡으로 받은 작업 사진을 업로드하면 AI가 자동으로 공수를 분석해줍니다.<br />
                                <strong>엑셀 업로드:</strong> 엑셀 양식으로 일보를 일괄 등록할 수 있습니다.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-brand-500" /> 3. 노무비 청구 및 지급
                            </h3>
                            <p className="pl-6">
                                <strong>노무비 청구서:</strong> 현장별, 팀별, 개인별로 기간을 설정하여 노무비 청구서를 생성하고 엑셀로 출력합니다.<br />
                                <strong>급여 지급 관리:</strong> 일급제, 주급제, 월급제 등 급여 형태에 따라 지급 내역을 정산하고 은행 이체 양식을 생성합니다.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-brand-500" /> 4. 데이터 관리 (주의)
                            </h3>
                            <p className="pl-6">
                                <strong>동기화:</strong> 대량 등록 후 '데이터 분석 및 동기화'를 실행하여 연결 고리를 자동으로 완성하세요.<br />
                                <strong>백업:</strong> 정기적으로 데이터를 백업하여 PC에 보관하세요.<br />
                                <strong>복구:</strong> 데이터 손실 시 백업 파일로 복구할 수 있습니다. (중복 ID 덮어쓰기 주의)<br />
                                <strong>초기화:</strong> 시스템을 처음부터 다시 시작할 때만 사용하세요. 모든 데이터가 삭제됩니다.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default SystemManagementPage;
