import React, { useState } from 'react';
import { dailyReportService } from '../../services/dailyReportService';
import { manpowerService } from '../../services/manpowerService';
import { teamService } from '../../services/teamService';
import { siteService } from '../../services/siteService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSync, faDownload, faUpload, faTrash, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { db } from '../../firebase/config';
import { collection, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';

const DataManagementSection: React.FC = () => {
    // System Management States
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; message: string } | null>(null);

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

    // --- Backup ---
    const handleBackup = async () => {
        setIsLoading(true);
        setProgress({ current: 0, total: 100, message: '데이터를 수집하는 중...' });
        try {
            const backupData: { [key: string]: any[] } = {};
            let totalDocs = 0;

            // 1. Fetch all collections
            for (const colName of COLLECTIONS) {
                setProgress({ current: 0, total: 100, message: `${colName} 데이터 수집 중...` });
                const q = collection(db, colName);
                const snapshot = await getDocs(q);

                backupData[colName] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                totalDocs += snapshot.size;
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

                let totalItems = 0;
                for (const colName of collectionsToRestore) {
                    if (json[colName]) {
                        totalItems += json[colName].length;
                    }
                }

                let processedItems = 0;

                for (const colName of collectionsToRestore) {
                    const data = json[colName];
                    if (!data || !Array.isArray(data)) continue;

                    for (const item of data) {
                        if (item.id) {
                            await setDoc(doc(db, colName, item.id), item, { merge: true });
                        } else {
                            console.warn(`Skipping item without ID in ${colName}`);
                        }
                        processedItems++;

                        if (processedItems % 10 === 0) { // Update UI every 10 items
                            setProgress({
                                current: processedItems,
                                total: totalItems,
                                message: `${colName} 복구 중... (${processedItems}/${totalItems})`
                            });
                        }
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

    // --- Initialization ---
    const handleInitialize = async () => {
        if (!window.confirm('경고: 모든 데이터가 영구적으로 삭제됩니다.\n정말 초기화하시겠습니까?')) return;
        if (!window.confirm('마지막 확인: 정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;

        setIsLoading(true);
        try {
            for (const colName of COLLECTIONS) {
                setProgress({ current: 0, total: 100, message: `${colName} 데이터 삭제 중...` });

                const q = collection(db, colName);
                const snapshot = await getDocs(q);
                const totalDocs = snapshot.size;
                let deletedDocs = 0;

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
                        message: `${colName} 삭제 중... (${Math.min(deletedDocs, totalDocs)}/${totalDocs})`
                    });
                }
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
