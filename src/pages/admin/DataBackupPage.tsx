import React, { useState, useEffect } from 'react';
import { SYSTEM_COLLECTIONS } from '../../constants/collectionConfig';
import { exportCollectionToExcel, resetCollection, readExcelFile, restoreBatchData } from '../../services/backupService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faDownload, faTrash, faExclamationTriangle, faCheckCircle, faUpload, faTable, faRefresh } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';

const MySwal = withReactContent(Swal);

// ... PreviewTable component remains same ...
const PreviewTable = ({ data }: { data: any[] }) => {
    if (!data || data.length === 0) return <p className="text-sm text-gray-500">데이터가 없습니다.</p>;

    // Get headers from the first item
    const headers = Object.keys(data[0]);

    return (
        <div className="overflow-x-auto border rounded-lg mt-2 max-h-60">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                    <tr>
                        {headers.map(h => (
                            <th key={h} className="px-3 py-2 border-b whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={i} className="bg-white border-b hover:bg-gray-50">
                            {headers.map(h => (
                                <td key={`${i}-${h}`} className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                                    {String(row[h] || '')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const DataBackupPage: React.FC = () => {
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [counts, setCounts] = useState<{ [key: string]: number }>({});
    const [loadingCounts, setLoadingCounts] = useState(false);

    const fetchCounts = async () => {
        setLoadingCounts(true);
        const newCounts: { [key: string]: number } = {};

        try {
            await Promise.all(SYSTEM_COLLECTIONS.map(async (col) => {
                try {
                    const coll = collection(db, col.id);
                    const snapshot = await getCountFromServer(coll);
                    newCounts[col.id] = snapshot.data().count;
                } catch (e) {
                    console.error(`Error counting ${col.id}:`, e);
                    newCounts[col.id] = 0;
                }
            }));
            setCounts(newCounts);
        } catch (error) {
            console.error("Error fetching counts:", error);
        } finally {
            setLoadingCounts(false);
        }
    };

    useEffect(() => {
        fetchCounts();
    }, []);

    const handleExport = async (id: string) => {
        setProcessingId(id);
        try {
            await exportCollectionToExcel(id);
            MySwal.fire({
                icon: 'success',
                title: '백업 완료',
                text: `${id} 데이터가 엑셀로 다운로드되었습니다.`,
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            MySwal.fire({
                icon: 'error',
                title: '백업 실패',
                text: '데이터를 불러오는 중 오류가 발생했습니다.'
            });
        } finally {
            setProcessingId(null);
        }
    };

    const handleReset = async (id: string, label: string) => {
        const result = await MySwal.fire({
            title: '정말 초기화 하시겠습니까?',
            html: `
                <div style="text-align: left; font-size: 0.95rem; color: #4b5563;">
                    <p class="mb-2"><strong style="color: #ef4444;">경고:</strong> 이 작업은 <strong>${label} (${id})</strong> 컬렉션의 <strong>모든 데이터</strong>를 영구적으로 삭제합니다.</p>
                    <p class="mb-4">이 작업은 되돌릴 수 없으며, 삭제된 데이터는 복구할 수 없습니다.</p>
                    <p>진행하려면 아래 입력창에 <strong>DELETE</strong> 라고 입력하세요.</p>
                </div>
            `,
            input: 'text',
            inputPlaceholder: 'DELETE',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: '초기화 실행',
            cancelButtonText: '취소',
            inputValidator: (value) => {
                if (value !== 'DELETE') {
                    return '정확히 DELETE 라고 입력해야 합니다.';
                }
            }
        });

        if (result.isConfirmed) {
            setProcessingId(id);
            try {
                const count = await resetCollection(id);
                MySwal.fire({
                    icon: 'success',
                    title: '초기화 완료',
                    text: `${count}개의 문서가 삭제되었습니다.`,
                });
                fetchCounts(); // Refresh counts
            } catch (error) {
                MySwal.fire({
                    icon: 'error',
                    title: '초기화 실패',
                    text: '삭제 작업 중 오류가 발생했습니다.'
                });
            } finally {
                setProcessingId(null);
            }
        }
    };

    const handleRestorePreview = async (id: string, label: string, file: File) => {
        try {
            // 1. Read and Map Excel Data
            const data = await readExcelFile(file);

            if (data.length === 0) {
                MySwal.fire({ icon: 'warning', title: '데이터 없음', text: '엑셀 파일에 데이터가 없습니다.' });
                return;
            }

            // 2. Show Preview Modal
            const result = await MySwal.fire({
                title: `<span class="text-xl font-bold flex items-center justify-center gap-2"><i class="fa-solid fa-file-excel text-green-600"></i> 데이터 복구 미리보기</span>`,
                html: (
                    <div className="text-left">
                        <p className="text-sm text-gray-600 mb-2">
                            <strong>{label} ({id})</strong> 컬렉션에 <strong>{data.length}</strong>개의 데이터를 복구합니다.<br />
                            아래는 상위 5개 데이터의 미리보기입니다.
                        </p>
                        <PreviewTable data={data.slice(0, 5)} />
                        <p className="text-xs text-red-500 mt-2 font-semibold">
                            ⚠️ 주의: 복구 시 기존 ID가 동일한 데이터는 덮어씌워집니다.
                        </p>
                    </div>
                ),
                width: '800px',
                showCancelButton: true,
                confirmButtonColor: '#4f46e5', // Indigo
                confirmButtonText: '복구 실행',
                cancelButtonText: '취소',
                showLoaderOnConfirm: true,
                preConfirm: async () => {
                    try {
                        const count = await restoreBatchData(id, data);
                        return count;
                    } catch (error) {
                        Swal.showValidationMessage(`복구 실패: ${error}`);
                    }
                }
            });

            if (result.isConfirmed) {
                MySwal.fire({
                    icon: 'success',
                    title: '복구 완료',
                    text: `${result.value}개의 데이터가 성공적으로 복구되었습니다.`
                });
                fetchCounts(); // Refresh counts
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

    return (
        <div className="p-6 max-w-7xl mx-auto">
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

            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-8 flex items-start gap-3">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-rose-500 mt-1" />
                <div>
                    <h3 className="font-bold text-rose-800 text-lg">관리자 주의사항</h3>
                    <p className="text-rose-700 text-sm mt-1">
                        데이터 초기화 기능은 시스템의 데이터를 영구적으로 삭제합니다.<br />
                        반드시 <strong>백업(Excel 다운로드)</strong>을 먼저 진행한 후 초기화를 수행하십시오.
                    </p>
                </div>
            </div >

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold text-indigo-900 mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faTable} />
                    데이터베이스 구조 변경 대비 백업 (Snapshot)
                </h3>
                <p className="text-indigo-700 text-sm mb-4">
                    DB 구조 변경(예: 단일 컬렉션 분리) 전, 현재 데이터를 안전하게 별도 컬렉션으로 복제합니다.<br />
                    백업된 데이터는 <code>_backup_YYYYMMDD</code> 접미사가 붙은 새로운 컬렉션으로 저장됩니다.
                </p>

                <div className="flex gap-4">
                    <button
                        onClick={async () => {
                            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                            const source = 'companies';
                            const target = `companies_backup_${dateStr}`;

                            const confirm = await MySwal.fire({
                                icon: 'question',
                                title: '회사 컬렉션 백업',
                                text: `'${source}' 컬렉션을 '${target}'으로 전체 복사하시겠습니까?`,
                                showCancelButton: true,
                                confirmButtonText: '백업 실행',
                                cancelButtonText: '취소'
                            });

                            if (confirm.isConfirmed) {
                                setProcessingId('backup_companies');
                                try {
                                    // Dynamic import to allow code splitting and avoid circular dep if any
                                    const { backupCollection } = await import('../../utils/firestoreBackup');
                                    const count = await backupCollection(source, target);

                                    MySwal.fire({
                                        icon: 'success',
                                        title: '백업 완료',
                                        text: `총 ${count}개의 문서가 '${target}'으로 안전하게 복제되었습니다.`
                                    });
                                } catch (error) {
                                    MySwal.fire({
                                        icon: 'error',
                                        title: '백업 실패',
                                        text: String(error)
                                    });
                                } finally {
                                    setProcessingId(null);
                                }
                            }
                        }}
                        disabled={processingId === 'backup_companies'}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition flex items-center gap-2"
                    >
                        {processingId === 'backup_companies' ? <div className="animate-spin w-4 h-4 border-2 border-white rounded-full border-t-transparent" /> : <FontAwesomeIcon icon={faCheckCircle} />}
                        회사(Companies) 컬렉션 스냅샷 생성
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SYSTEM_COLLECTIONS.map((col) => (
                    <div key={col.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-5 border-b border-slate-100 relative">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center justify-between">
                                {col.label}
                                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{col.id}</span>
                            </h3>
                            <div className="absolute top-5 right-5 mt-8 mr-[-10px]">
                                <span className={`text-3xl font-bold ${counts[col.id] > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                                    {loadingCounts ? '-' : (counts[col.id] || 0)}
                                </span>
                                <span className="text-xs text-gray-400 ml-1">건</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-4 h-10">{col.description}</p>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-3">
                            <button
                                onClick={() => handleExport(col.id)}
                                disabled={processingId === col.id}
                                className="flex-1 py-2 px-3 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                            >
                                {processingId === col.id ? (
                                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                                ) : (
                                    <FontAwesomeIcon icon={faDownload} />
                                )}
                                <span>백업</span>
                            </button>

                            <label className="flex-1 cursor-pointer">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            handleRestorePreview(col.id, col.label, e.target.files[0]);
                                            e.target.value = ''; // Reset input
                                        }
                                    }}
                                    disabled={processingId === col.id}
                                />
                                <div className={`h-full py-2 px-3 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 ${processingId === col.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <FontAwesomeIcon icon={faUpload} />
                                    <span>복구</span>
                                </div>
                            </label>

                            <button
                                onClick={() => handleReset(col.id, col.label)}
                                disabled={processingId === col.id}
                                className="flex-1 py-2 px-3 bg-white border border-rose-200 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                                <span>초기화</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DataBackupPage;
