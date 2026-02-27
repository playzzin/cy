import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SYSTEM_COLLECTIONS } from '../../constants/collectionConfig';
import { exportCollectionToExcel, fetchCollectionData, fetchCollectionSample, readExcelFile, restoreBatchData, resetCollection, BackupResult, getCollectionCapabilities } from '../../services/backupService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faDownload, faTrash, faExclamationTriangle, faUpload, faRefresh, faCheckCircle, faTimesCircle, faSpinner, faEye } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { z } from 'zod';
import { connectorConfig } from '@dataconnect/generated';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { UserRole } from '../../types/roles';
import { auditService } from '../../services/auditService';

const MySwal = withReactContent(Swal);

// ===================================
// 1. Helper Components
// ===================================

const PreviewTable = ({ data }: { data: Array<Record<string, unknown>> }) => {
    if (!data || data.length === 0) return <p className="text-sm text-gray-500">데이터가 없습니다.</p>;
    const headers = Object.keys(data[0]);
    return (
        <div className="overflow-x-auto border rounded-lg mt-2 max-h-60 text-left">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                    <tr>
                        {headers.map(h => (
                            <th key={h} className="px-3 py-2 border-b whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.slice(0, 20).map((row, i) => (
                        <tr key={i} className="bg-white border-b hover:bg-gray-50">
                            {headers.map(h => (
                                <td key={`${i}-${h}`} className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                                    {String(row[h] ?? '')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.length > 20 && <p className="p-2 text-xs text-center text-gray-400">...외 {data.length - 20}건...</p>}
        </div>
    );
};

// ===================================
// 2. Main Page Component
// ===================================

const DataBackupPage: React.FC = () => {
    const { currentUser } = useAuth();

    const [processingId, setProcessingId] = useState<string | null>(null);
    const [previewingId, setPreviewingId] = useState<string | null>(null);
    const [counts, setCounts] = useState<{ [key: string]: number }>({});
    const [countErrors, setCountErrors] = useState<{ [key: string]: string | undefined }>({});
    const [loadingCounts, setLoadingCounts] = useState(false);
    const [didFetchCounts, setDidFetchCounts] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; message: string } | null>(null);

    const [authzLoading, setAuthzLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);

    const allCollections = SYSTEM_COLLECTIONS;
    const dataConnectCollections = allCollections.filter((c) => c.source === 'dataconnect');
    const firestoreCollections = allCollections.filter((c) => c.source === 'firestore');

    const dataConnectCountSummary = useMemo(() => {
        const dcTotal = dataConnectCollections.reduce((sum, col) => sum + (counts[col.id] ?? 0), 0);
        const hasDcErrors = dataConnectCollections.some((col) => !!countErrors[col.id]);
        return { dcTotal, hasDcErrors };
    }, [counts, countErrors, dataConnectCollections]);

    const shouldShowAllZeroHint = useMemo(() => {
        if (!didFetchCounts) return false;
        if (loadingCounts) return false;
        if (dataConnectCountSummary.hasDcErrors) return false;
        return dataConnectCountSummary.dcTotal === 0;
    }, [didFetchCounts, loadingCounts, dataConnectCountSummary]);

    const restoreRowsSchema = useMemo(() => {
        return z
            .array(z.record(z.string(), z.unknown()))
            .min(1, '엑셀 파일에 데이터가 없습니다.')
            .max(20000, '복구 데이터가 너무 많습니다. (최대 20,000건)');
    }, []);

    const isAdminRole = useMemo(() => {
        const role = (userRole ?? '').trim();
        return role === 'admin' || role === UserRole.ADMIN || role === '관리자' || role === '사장' || role === '실장';
    }, [userRole]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            try {
                if (!currentUser) {
                    if (!cancelled) {
                        setUserRole(null);
                        setAuthzLoading(false);
                    }
                    return;
                }

                const row = await userService.getUser(currentUser.uid);
                if (!cancelled) {
                    setUserRole(row?.role ? String(row.role) : 'user');
                    setAuthzLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setUserRole('user');
                    setAuthzLoading(false);
                }
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [currentUser]);

    const handlePreview = useCallback(async (collectionId: string, label: string) => {
        if (processingId) return;
        if (previewingId) return;

        setPreviewingId(collectionId);
        try {
            MySwal.fire({
                title: `${label} 미리보기`,
                didOpen: () => {
                    Swal.showLoading();
                },
                allowOutsideClick: false,
                showConfirmButton: false
            });

            const rows = await fetchCollectionSample(collectionId, 20);

            MySwal.fire({
                title: `${label} 미리보기`,
                width: '90%',
                html: (
                    <div className="text-left">
                        <p className="text-xs text-gray-500">샘플 {rows.length}건 (최대 20건)</p>
                        <PreviewTable data={rows as Array<Record<string, unknown>>} />
                    </div>
                ),
                confirmButtonText: '닫기'
            });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            MySwal.fire({
                icon: 'error',
                title: '미리보기 실패',
                text: message
            });
        } finally {
            setPreviewingId(null);
        }
    }, [processingId, previewingId]);

    const fetchCounts = useCallback(async () => {
        setLoadingCounts(true);
        const newCounts: { [key: string]: number } = {};
        const newErrors: { [key: string]: string | undefined } = {};
        const chunkSize = 5;
        for (let i = 0; i < allCollections.length; i += chunkSize) {
            const chunk = allCollections.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (col) => {
                try {
                    const data = await fetchCollectionData(col.id);
                    newCounts[col.id] = Array.isArray(data) ? data.length : 0;
                    newErrors[col.id] = undefined;
                } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    newCounts[col.id] = 0;
                    newErrors[col.id] = message;
                    console.error(`[DataBackupPage] fetchCounts failed: ${col.id}`, e);
                }
            }));
        }
        setCounts(newCounts);
        setCountErrors(newErrors);
        setLoadingCounts(false);
        setDidFetchCounts(true);
    }, [allCollections]);

    useEffect(() => {
        if (authzLoading) return;
        if (!currentUser) return;
        if (!isAdminRole) return;
        void fetchCounts();
    }, [authzLoading, currentUser, isAdminRole, fetchCounts]);

    const capabilitiesById = useMemo(() => {
        const map = new Map<string, ReturnType<typeof getCollectionCapabilities>>();
        allCollections.forEach((col) => {
            map.set(col.id, getCollectionCapabilities(col.id));
        });
        return map;
    }, [allCollections]);

    const getCapabilityReason = useCallback((id: string): { canRestore: boolean; canUpsert: boolean; canReset: boolean; reason?: string } => {
        const col = allCollections.find((c) => c.id === id);
        const caps = capabilitiesById.get(id);
        if (!col) return { canRestore: false, canUpsert: false, canReset: false, reason: '컬렉션 정보를 찾을 수 없습니다.' };

        const canRestore = !!caps?.canRestore;
        const canUpsert = !!caps?.canUpsert;
        const canReset = col.source === 'dataconnect' ? !!caps?.canResetViaDataConnect : !!caps?.canResetViaFirestore;

        if (!canRestore && !canReset) {
            return { canRestore, canUpsert, canReset, reason: '현재 SDK/스토리지 구성에서 복구/초기화를 지원하지 않습니다.' };
        }

        if (!canRestore) return { canRestore, canUpsert, canReset, reason: '복구(Create) SDK가 준비되지 않았습니다.' };
        if (!canReset) {
            if (col.source === 'dataconnect') {
                return { canRestore, canUpsert, canReset, reason: 'Data Connect에서 Delete API가 없어 초기화를 막았습니다.' };
            }
            return { canRestore, canUpsert, canReset, reason: 'Firestore 초기화가 지원되지 않습니다.' };
        }
        return { canRestore, canUpsert, canReset };
    }, [allCollections, capabilitiesById]);

    const writeAudit = useCallback(async (params: { action: string; targetId: string; details?: Record<string, unknown> }) => {
        if (!currentUser) return;
        await auditService.log({
            action: params.action,
            category: 'SYSTEM',
            actorId: currentUser.uid,
            actorEmail: currentUser.email ?? 'unknown',
            targetId: params.targetId,
            details: params.details
        });
    }, [currentUser]);

    const handleExport = async (id: string) => {
        if (processingId) return;

        setProcessingId(id);
        try {
            await exportCollectionToExcel(id);
            await writeAudit({ action: 'BACKUP_EXPORT', targetId: id });
            await MySwal.fire({
                icon: 'success',
                title: '백업 완료',
                text: `${id} 데이터가 엑셀로 다운로드되었습니다.`,
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error(error);
            await MySwal.fire({
                icon: 'error',
                title: '백업 실패',
                text: error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.'
            });
        } finally {
            setProcessingId(null);
        }
    };

    const handleReset = async (id: string, label: string) => {
        const capability = getCapabilityReason(id);
        if (!capability.canReset) {
            await MySwal.fire({
                icon: 'warning',
                title: '초기화 불가',
                text: capability.reason ?? '현재 환경에서 초기화를 지원하지 않습니다.'
            });
            return;
        }

        const result = await MySwal.fire({
            icon: 'warning',
            title: '⚠️ 데이터 영구 삭제',
            html: `
                <div class="text-left">
                    <p class="font-bold text-red-600 mb-2">정말로 삭제하시겠습니까?</p>
                    <p class="text-sm">대상: <strong>${label} (${id})</strong></p>
                    <p class="text-xs text-gray-500 mt-2">이 작업은 되돌릴 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.</p>
                </div>
            `,
            input: 'text',
            inputPlaceholder: `DELETE ${id} 를 입력하세요`,
            inputValidator: (value) => {
                if (String(value ?? '').trim() !== `DELETE ${id}`) {
                    return `정확히 "DELETE ${id}" 를 입력해야 합니다.`;
                }
                return null;
            },
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: '네, 삭제합니다',
            cancelButtonText: '취소',
            focusCancel: true
        });

        if (result.isConfirmed) {
            setProcessingId(id);
            try {
                const count = await resetCollection(id);
                await writeAudit({ action: 'BACKUP_RESET', targetId: id, details: { deleted: count } });
                await MySwal.fire(
                    '삭제 완료',
                    `${label} 데이터 ${count}건이 삭제되었습니다.`,
                    'success'
                );
                fetchCounts();
            } catch (error) {
                console.error(error);
                MySwal.fire(
                    '삭제 실패',
                    error instanceof Error ? error.message : '데이터 삭제 중 오류가 발생했습니다.',
                    'error'
                );
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleRestorePreview = async (id: string, label: string, file: File) => {
        const capability = getCapabilityReason(id);
        if (!capability.canRestore) {
            await MySwal.fire({
                icon: 'warning',
                title: '복구 불가',
                text: capability.reason ?? '현재 환경에서 복구를 지원하지 않습니다.'
            });
            return;
        }

        try {
            // 1. Read Excel
            const raw = (await readExcelFile(file)) as unknown;
            const parsed = restoreRowsSchema.safeParse(raw);
            if (!parsed.success) {
                await MySwal.fire({ icon: 'warning', title: '복구 데이터 오류', text: parsed.error.issues[0]?.message ?? '엑셀 데이터를 해석할 수 없습니다.' });
                return;
            }

            const data = parsed.data;

            if (id === 'daily_report_workers') {
                const missing = data.some((row) => !row.dailyReportId || !row.workerId);
                if (missing) {
                    await MySwal.fire({
                        icon: 'warning',
                        title: '필수 컬럼 누락',
                        text: 'daily_report_workers 복구에는 dailyReportId, workerId 컬럼이 필요합니다.'
                    });
                    return;
                }
            }

            // 2. Preview Modal
            const result = await MySwal.fire({
                title: `<span class="text-xl font-bold flex items-center justify-center gap-2"><i class="fa-solid fa-file-excel text-green-600"></i> 데이터 복구 미리보기</span>`,
                html: (
                    <div className="text-left">
                        <p className="text-sm text-gray-600 mb-2">
                            <strong>{label} ({id})</strong> 컬렉션에 <strong>{data.length}</strong>개의 데이터를 복구합니다.<br />
                            {capability.canUpsert
                                ? '기존 ID가 있으면 수정하고, 없으면 생성합니다.(Upsert)'
                                : 'Update API가 없어 신규 생성(Create)만 시도합니다. (동일 ID가 이미 있으면 실패할 수 있습니다.)'}
                        </p>
                        <PreviewTable data={data} />
                    </div>
                ),
                width: '800px',
                showCancelButton: true,
                confirmButtonColor: '#4f46e5',
                confirmButtonText: '복구 실행',
                cancelButtonText: '취소'
            });

            if (result.isConfirmed) {
                const confirm = await MySwal.fire({
                    icon: 'warning',
                    title: '복구 실행 확인',
                    html: `
                        <div class="text-left">
                            <p class="text-sm">대상: <strong>${label} (${id})</strong></p>
                            <p class="text-xs text-gray-500 mt-2">복구는 Upsert 방식으로 실행됩니다. 잘못된 파일이면 데이터가 오염될 수 있습니다.</p>
                        </div>
                    `,
                    input: 'text',
                    inputPlaceholder: `RESTORE ${id} 를 입력하세요`,
                    inputValidator: (value) => {
                        if (String(value ?? '').trim() !== `RESTORE ${id}`) {
                            return `정확히 "RESTORE ${id}" 를 입력해야 합니다.`;
                        }
                        return null;
                    },
                    showCancelButton: true,
                    confirmButtonColor: '#4f46e5',
                    confirmButtonText: '확인',
                    cancelButtonText: '취소',
                    focusCancel: true
                });

                if (!confirm.isConfirmed) return;

                setProcessingId(id);
                setProgress({ current: 0, total: data.length, message: '복구나 데이터 처리 중...' });

                // Run Restoration
                try {
                    const restoreResult: BackupResult = await restoreBatchData(id, data, (current, total) => {
                        setProgress({ current, total, message: `${current} / ${total} 처리 중...` });
                    });

                    // Final Report
                    const icon: 'success' | 'warning' | 'error' = restoreResult.failed === 0
                        ? 'success'
                        : (restoreResult.failed === restoreResult.total ? 'error' : 'warning');

                    await writeAudit({
                        action: 'BACKUP_RESTORE',
                        targetId: id,
                        details: {
                            total: restoreResult.total,
                            success: restoreResult.success,
                            failed: restoreResult.failed
                        }
                    });

                    await MySwal.fire({
                        icon,
                        title: '복구 작업 완료',
                        html: (
                            <div className="text-left bg-gray-50 p-4 rounded-lg">
                                <p className="font-bold mb-2">총 처리: {restoreResult.total}건</p>
                                <p className="text-green-600 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faCheckCircle} /> 성공: {restoreResult.success}건
                                </p>
                                <p className="text-red-600 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faTimesCircle} /> 실패: {restoreResult.failed}건
                                </p>

                                {restoreResult.errors.length > 0 && (
                                    <div className="mt-3 border-t pt-2 max-h-32 overflow-y-auto text-xs text-red-500">
                                        <p className="font-bold">에러 상세(최대 10건):</p>
                                        <ul className="list-disc pl-4">
                                            {restoreResult.errors.slice(0, 10).map((e, idx) => (
                                                <li key={`${idx}_${String(e.id ?? '')}`}>ID {String(e.id ?? 'unknown')}: {String(e.error)}</li>
                                            ))}
                                            {restoreResult.errors.length > 10 && (
                                                <li>...외 {restoreResult.errors.length - 10}건</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )
                    });
                    fetchCounts();

                } catch (err: any) {
                    MySwal.fire({ icon: 'error', title: '치명적 오류', text: err.message });
                } finally {
                    setProcessingId(null);
                    setProgress(null);
                }
            }

        } catch (error) {
            console.error(error);
            MySwal.fire({
                icon: 'error',
                title: '파일 읽기 실패',
                text: '엑셀 파일을 읽는 중 오류가 발생했습니다. 파일 형식을 확인해주세요.'
            });
        }
    };

    if (authzLoading) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-indigo-600 mb-3" />
                    <p className="text-slate-600 font-medium">권한을 확인하는 중...</p>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <p className="text-slate-700 font-bold">로그인이 필요합니다.</p>
                </div>
            </div>
        );
    }

    if (!isAdminRole) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl text-rose-500 mb-3" />
                    <p className="text-slate-800 font-bold text-lg">접근 권한 없음</p>
                    <p className="text-slate-500 text-sm mt-2">관리자(admin) 권한만 데이터 백업/복구/초기화를 사용할 수 있습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faDatabase} className="text-rose-500" />
                    데이터 백업 및 초기화
                </div>
                <button
                    onClick={fetchCounts}
                    disabled={loadingCounts}
                    className="text-sm bg-white border px-3 py-1 rounded hover:bg-gray-50 transition-colors"
                >
                    <FontAwesomeIcon icon={faRefresh} className={loadingCounts ? "animate-spin mr-2" : "mr-2"} />
                    새로고침
                </button>
            </h2>

            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm text-slate-700">
                    <div className="space-y-2">
                        <p className="font-bold">1. 목표 및 범위 정의</p>
                        <p className="text-slate-600">운영 데이터의 백업(Export) / 복구(Upsert) / 초기화(Delete)를 컬렉션 단위로 수행합니다.</p>
                    </div>
                    <div className="space-y-2">
                        <p className="font-bold">2. 맥락 분석</p>
                        <p className="text-slate-600">Data Connect와 Firestore가 혼재된 환경에서 컬렉션별로 지원 가능한 작업이 다릅니다.</p>
                    </div>
                    <div className="space-y-2">
                        <p className="font-bold">3. ⚠️ 위험 요소</p>
                        <p className="text-slate-600">초기화는 되돌릴 수 없습니다. 복구는 잘못된 파일이면 데이터 오염을 유발할 수 있습니다.</p>
                    </div>
                    <div className="space-y-2">
                        <p className="font-bold">4. 🛠️ 구현 전략</p>
                        <p className="text-slate-600">관리자 권한 게이트 + 2단계 확인(타이핑) + Zod 검증 + AuditLog 기록으로 안전성을 확보합니다.</p>
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                        <p className="font-bold">5. ✅ 검증 계획</p>
                        <p className="text-slate-600">백업 파일 다운로드 확인 → 샘플 파일로 복구 테스트 → count 새로고침 검증 → 실패 건수/에러 목록 확인.</p>
                    </div>
                </div>
            </div>

            {shouldShowAllZeroHint ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500 mt-1" />
                        <div>
                            <p className="font-bold text-amber-900">Data Connect 데이터가 0건으로 조회됩니다.</p>
                            <p className="text-amber-800 text-sm mt-1">
                                조회 에러는 없지만 모든 Data Connect 컬렉션 합계가 0입니다. 현재 연결된 Data Connect DB가 비어있거나(예: 테스트용 clean DB),
                                또는 운영 데이터가 아직 마이그레이션되지 않은 상태일 수 있습니다.
                            </p>
                            <p className="text-amber-900 text-xs mt-2 font-mono break-all">
                                connector={String((connectorConfig as any)?.connector ?? '')} / service={String((connectorConfig as any)?.service ?? '')} / location={String((connectorConfig as any)?.location ?? '')}
                            </p>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Warning Box */}
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-8 flex items-start gap-3">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-rose-500 mt-1" />
                <div>
                    <h3 className="font-bold text-rose-800 text-lg">관리자 주의사항</h3>
                    <p className="text-rose-700 text-sm mt-1">
                        데이터 초기화 기능은 시스템의 데이터를 영구적으로 삭제합니다.<br />
                        반드시 <strong>백업(Excel 다운로드)</strong>을 먼저 진행한 후 초기화를 수행하십시오.
                    </p>
                </div>
            </div>

            {/* Progress Overlay */}
            {progress && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-indigo-600 mb-4" />
                        <h3 className="text-xl font-bold mb-2">{progress.message}</h3>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                            <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-gray-500 text-sm">{Math.round((progress.current / progress.total) * 100)}% 완료</p>
                    </div>
                </div>
            )}

            {/* Collections Grid */}
            <div className="space-y-8 mb-10">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-3">Data Connect 컬렉션</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {dataConnectCollections.map((col) => {
                            const capability = getCapabilityReason(col.id);

                            // Determine style based on source
                            const isFirestore = col.source === 'firestore';
                            const badgeColor = isFirestore ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600';
                            const borderColor = processingId === col.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200';

                            return (
                                <div key={col.id} className={`bg-white rounded-xl shadow-sm border ${borderColor} overflow-hidden hover:shadow-md transition-all`}>
                                    <div className="p-5 border-b border-slate-100 relative">
                                        <h3 className="text-lg font-bold text-slate-800 flex items-center justify-between">
                                            {col.label}
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeColor}`}>
                                                {col.source === 'dataconnect' ? 'DC' : 'FS'}
                                            </span>
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1 mb-2 font-mono">{col.id}</p>

                                        <div className="absolute top-5 right-5 mt-6 mr-[-5px]">
                                            <span className={`text-3xl font-bold ${counts[col.id] > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                                                {loadingCounts ? (counts[col.id] !== undefined ? counts[col.id] : '-') : (counts[col.id] || 0)}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-1">건</span>
                                        </div>
                                        <p className="text-sm text-slate-500 mt-4 min-h-[40px] line-clamp-2">{col.description}</p>
                                        {countErrors[col.id] ? (
                                            <p className="text-xs text-rose-600 mt-2 break-all">조회 실패: {countErrors[col.id]}</p>
                                        ) : null}
                                        {!capability.canRestore || !capability.canReset ? (
                                            <p className="text-xs text-amber-600 mt-2">{capability.reason}</p>
                                        ) : null}
                                    </div>

                                    <div className="p-4 bg-slate-50 flex gap-2">
                                        <button
                                            onClick={() => handlePreview(col.id, col.label)}
                                            disabled={!!processingId || !!previewingId}
                                            className="flex-1 py-1.5 px-2 bg-white border border-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-50 hover:text-indigo-600 transition-colors flex flex-col items-center justify-center gap-1 h-16 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faEye} className="text-lg" />
                                            <span className="text-xs">미리보기</span>
                                        </button>

                                        <button
                                            onClick={() => handleExport(col.id)}
                                            disabled={!!processingId}
                                            className="flex-1 py-1.5 px-2 bg-white border border-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-50 hover:text-indigo-600 transition-colors flex flex-col items-center justify-center gap-1 h-16 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faDownload} className="text-lg" />
                                            <span className="text-xs">백업</span>
                                        </button>

                                        <label className={`flex-1 cursor-pointer py-1.5 px-2 bg-white border border-indigo-200 text-indigo-600 rounded text-sm font-medium hover:bg-indigo-50 transition-colors flex flex-col items-center justify-center gap-1 h-16 ${!!processingId || !capability.canRestore ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                                            <input
                                                type="file"
                                                accept=".xlsx, .xls"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        handleRestorePreview(col.id, col.label, e.target.files[0]);
                                                        e.target.value = '';
                                                    }
                                                }}
                                                disabled={!!processingId || !capability.canRestore}
                                            />
                                            <FontAwesomeIcon icon={faUpload} className="text-lg" />
                                            <span className="text-xs">복구</span>
                                        </label>

                                        <button
                                            onClick={() => handleReset(col.id, col.label)}
                                            disabled={!!processingId || !capability.canReset}
                                            className="flex-1 py-1.5 px-2 bg-white border border-rose-200 text-rose-600 rounded text-sm font-medium hover:bg-rose-50 transition-colors flex flex-col items-center justify-center gap-1 h-16 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faTrash} className="text-lg" />
                                            <span className="text-xs">초기화</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-3">Firestore 컬렉션</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {firestoreCollections.map((col) => {
                            const capability = getCapabilityReason(col.id);

                            const isFirestore = col.source === 'firestore';
                            const badgeColor = isFirestore ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600';
                            const borderColor = processingId === col.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200';

                            return (
                                <div key={col.id} className={`bg-white rounded-xl shadow-sm border ${borderColor} overflow-hidden hover:shadow-md transition-all`}>
                                    <div className="p-5 border-b border-slate-100 relative">
                                        <h3 className="text-lg font-bold text-slate-800 flex items-center justify-between">
                                            {col.label}
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeColor}`}>
                                                {col.source === 'dataconnect' ? 'DC' : 'FS'}
                                            </span>
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1 mb-2 font-mono">{col.id}</p>

                                        <div className="absolute top-5 right-5 mt-6 mr-[-5px]">
                                            <span className={`text-3xl font-bold ${counts[col.id] > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                                                {loadingCounts ? (counts[col.id] !== undefined ? counts[col.id] : '-') : (counts[col.id] || 0)}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-1">건</span>
                                        </div>
                                        <p className="text-sm text-slate-500 mt-4 min-h-[40px] line-clamp-2">{col.description}</p>
                                        {countErrors[col.id] ? (
                                            <p className="text-xs text-rose-600 mt-2 break-all">조회 실패: {countErrors[col.id]}</p>
                                        ) : null}
                                        {!capability.canRestore || !capability.canReset ? (
                                            <p className="text-xs text-amber-600 mt-2">{capability.reason}</p>
                                        ) : null}
                                    </div>

                                    <div className="p-4 bg-slate-50 flex gap-2">
                                        <button
                                            onClick={() => handlePreview(col.id, col.label)}
                                            disabled={!!processingId || !!previewingId}
                                            className="flex-1 py-1.5 px-2 bg-white border border-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-50 hover:text-indigo-600 transition-colors flex flex-col items-center justify-center gap-1 h-16 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faEye} className="text-lg" />
                                            <span className="text-xs">미리보기</span>
                                        </button>

                                        <button
                                            onClick={() => handleExport(col.id)}
                                            disabled={!!processingId}
                                            className="flex-1 py-1.5 px-2 bg-white border border-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-50 hover:text-indigo-600 transition-colors flex flex-col items-center justify-center gap-1 h-16 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faDownload} className="text-lg" />
                                            <span className="text-xs">백업</span>
                                        </button>

                                        <label className={`flex-1 cursor-pointer py-1.5 px-2 bg-white border border-indigo-200 text-indigo-600 rounded text-sm font-medium hover:bg-indigo-50 transition-colors flex flex-col items-center justify-center gap-1 h-16 ${!!processingId || !capability.canRestore ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                                            <input
                                                type="file"
                                                accept=".xlsx, .xls"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        handleRestorePreview(col.id, col.label, e.target.files[0]);
                                                        e.target.value = '';
                                                    }
                                                }}
                                                disabled={!!processingId || !capability.canRestore}
                                            />
                                            <FontAwesomeIcon icon={faUpload} className="text-lg" />
                                            <span className="text-xs">복구</span>
                                        </label>

                                        <button
                                            onClick={() => handleReset(col.id, col.label)}
                                            disabled={!!processingId || !capability.canReset}
                                            className="flex-1 py-1.5 px-2 bg-white border border-rose-200 text-rose-600 rounded text-sm font-medium hover:bg-rose-50 transition-colors flex flex-col items-center justify-center gap-1 h-16 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={faTrash} className="text-lg" />
                                            <span className="text-xs">초기화</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataBackupPage;
