import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUsers, faUser, faPlus, faSearch, faEdit, faTrash, faPenToSquare,
    faImages, faLink, faDownload, faCheckSquare, faSquare, faTable, faMoneyCheck, faBuilding,
    faGripVertical, faIdCard, faChevronUp, faChevronDown, IconDefinition
} from '@fortawesome/free-solid-svg-icons';

import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';
import { positionService, Position } from '../../services/positionService';
import { storage } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL, getBlob, updateMetadata } from 'firebase/storage';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import AccountLinkingModal from './AccountLinkingModal';
import BulkProgressModal from './BulkProgressModal';
import BulkEditWorkerModal from './BulkEditWorkerModal';
import BankBookAnalysisModal from './BankBookAnalysisModal';
import IdCardAnalysisModal from './IdCardAnalysisModal';
import WorkerModal from '../../pages/manpower/WorkerModal';
import { useColumnSettings } from '../../hooks/useColumnSettings';

import { resolveIcon } from '../../constants/iconMap';

// 아이콘 맵핑 (문자열 → 실제 아이콘) -> Removed in favor of resolveIcon


const WORKER_COLUMNS = [
    { key: 'name', label: '이름' },
    { key: 'idNumber', label: '주민번호' },
    { key: 'contact', label: '연락처' },
    { key: 'role', label: '직책' },
    { key: 'salaryModel', label: '구분' },
    { key: 'teamName', label: '팀명' },
    { key: 'companyName', label: '회사' },
    { key: 'status', label: '상태' },
    { key: 'unitPrice', label: '단가' },
    { key: 'bankInfo', label: '계좌번호' },
];

// 드래그 가능한 열 아이템 컴포넌트


const WorkerManagement: React.FC = () => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [positions, setPositions] = useState<Position[]>([]); // 직책 데이터
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const { currentUser } = useAuth();
    const hideHeader = false;
    const highlightedId: string | null = null;

    const {
        visibleColumns,
        toggleColumn,
        showColumnSettings,
        setShowColumnSettings,
        moveColumn,
        getOrderedColumns,
        columnOrder
    } = useColumnSettings('worker_registration_visible_columns', WORKER_COLUMNS);

    const orderedColumns = getOrderedColumns();

    // Bulk Actions State
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [showLinkingModal, setShowLinkingModal] = useState(false);
    const [isBulkProgressOpen, setIsBulkProgressOpen] = useState(false);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, success: 0, fail: 0 });
    const [bulkLogs, setBulkLogs] = useState<string[]>([]);
    const [isBankBookModalOpen, setIsBankBookModalOpen] = useState(false);
    const [isIdCardAnalysisModalOpen, setIsIdCardAnalysisModalOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentWorker, setCurrentWorker] = useState<Worker | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showInactive, setShowInactive] = useState(false); // Default: Hide inactive workers

    // Highlight scroll control (for Data Integrity "관리" navigation)
    const highlightScrolledRef = useRef(false);
    const lastHighlightIdRef = useRef<string | null>(null);

    // Handlers for Inline Editing
    const handleWorkerChange = (id: string, field: keyof Worker, value: any) => {
        setWorkers(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    };

    const handleWorkerBlur = async (id: string, field: keyof Worker, value: any) => {
        try {
            await manpowerService.updateWorker(id, { [field]: value });
        } catch (error) {
            console.error("Update failed", error);
            fetchWorkers(); // Revert on error
        }
    };

    // 상태 값을 화면/기존 데이터 형식에 맞게 정규화
    const getCanonicalStatus = (status?: string): string => {
        if (!status) return '미배정';
        if (status === 'active') return '재직';
        if (status === 'inactive') return '퇴사';
        return status;
    };

    // 목록에서 바로 상태 변경 (토글/셀렉트 공통 사용)
    const handleStatusChange = async (workerId: string, newStatus: string) => {
        if (!workerId) return;

        // Optimistic UI 업데이트
        setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, status: newStatus } : w));

        try {
            await manpowerService.updateWorker(workerId, { status: newStatus });
        } catch (error) {
            console.error('Failed to update worker status', error);
            alert('상태 변경에 실패했습니다. 다시 시도해 주세요.');
            // 실패 시 최신 데이터로 롤백
            fetchWorkers();
        }
    };

    const handleWorkerTeamSelect = async (workerId: string, teamId: string) => {
        if (!teamId) {
            // Unassign
            setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, teamId: '', teamName: '', teamType: '미배정' } : w));
            await manpowerService.updateWorker(workerId, { teamId: '', teamName: '', teamType: '미배정' });
            return;
        }

        const team = teams.find(t => t.id === teamId);
        if (team) {
            // 팀의 회사 정보도 함께 설정
            const teamCompany = team.companyId ? companies.find(c => c.id === team.companyId) : null;

            // 회사 유형에 따라 급여방식 결정 (협력사면 지원팀, 아니면 팀의 defaultSalaryModel 우선 적용)
            const worker = workers.find(w => w.id === workerId);
            const isPartnerCompany = teamCompany?.type === '협력사';
            const newSalaryModel = isPartnerCompany ? '지원팀' : (worker?.salaryModel || team.defaultSalaryModel || '일급제');

            const updates = {
                teamId: team.id,
                teamName: team.name,
                teamType: team.type,
                companyId: team.companyId || '',
                companyName: team.companyName || '',
                salaryModel: newSalaryModel
            };

            setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, ...updates } : w));
            try {
                await manpowerService.updateWorker(workerId, updates);
            } catch (e) {
                console.error(e);
                fetchWorkers();
            }
        }
    };

    const handleWorkerSiteSelect = async (workerId: string, siteId: string) => {
        if (!siteId) {
            setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, siteId: '', siteName: '' } : w));
            await manpowerService.updateWorker(workerId, { siteId: '', siteName: '' });
            return;
        }
        const site = sites.find(s => s.id === siteId);
        if (site) {
            setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, siteId: site.id, siteName: site.name } : w));
            await manpowerService.updateWorker(workerId, { siteId: site.id, siteName: site.name });
        }
    }

    const handleWorkerCompanySelect = async (workerId: string, companyId: string) => {
        if (!companyId) {
            setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, companyId: '', companyName: '' } : w));
            await manpowerService.updateWorker(workerId, { companyId: '', companyName: '' });
            return;
        }
        const company = companies.find(c => c.id === companyId);
        if (company) {
            setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, companyId: company.id, companyName: company.name } : w));
            await manpowerService.updateWorker(workerId, { companyId: company.id, companyName: company.name });
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [workersData, teamsData, sitesData, companiesData, positionsData] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                siteService.getSites(),
                companyService.getCompanies(),
                positionService.getPositions()
            ]);

            setWorkers(workersData);
            setTeams(teamsData);
            setSites(sitesData);
            setCompanies(companiesData);
            setPositions(positionsData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchWorkers = async () => {
        try {
            const workersData = await manpowerService.getWorkers();
            setWorkers(workersData);
        } catch (error) {
            console.error("Failed to fetch workers:", error);
        }
    };

    // 작업자 삭제
    const handleDelete = async (workerId: string, workerName: string) => {
        if (window.confirm(`[${workerName}] 작업자를 삭제하시겠습니까?`)) {
            try {
                await manpowerService.deleteWorker(workerId);
                alert('작업자가 삭제되었습니다.');
                await fetchWorkers();
            } catch (error) {
                console.error("삭제 실패:", error);
                alert("작업자 삭제에 실패했습니다.");
            }
        }
    };

    // 필터링된 작업자 목록 (Memoized)
    const filteredWorkers = React.useMemo(() => {
        return workers.filter(worker => {
            const lowerSearch = searchTerm.toLowerCase();

            // Status filter: If showInactive is false, only show 'active'/'재직' or 'unassigned'/'미배정'.
            const isActive = worker.status === '재직' || worker.status === 'active' || worker.status === '미배정' || !worker.status;
            if (!showInactive && !isActive) return false;

            return (
                worker.name.toLowerCase().includes(lowerSearch) ||
                worker.idNumber.includes(lowerSearch) ||
                (worker.contact && worker.contact.includes(lowerSearch))
            );
        });
    }, [workers, searchTerm, showInactive]);

    // 선택 기능
    const toggleSelectAll = () => {
        if (selectedWorkerIds.length === filteredWorkers.length && filteredWorkers.length > 0) {
            setSelectedWorkerIds([]);
        } else {
            setSelectedWorkerIds(filteredWorkers.map(w => w.id!).filter(Boolean));
        }
    };

    const toggleSelectWorker = (id: string) => {
        if (selectedWorkerIds.includes(id)) {
            setSelectedWorkerIds(selectedWorkerIds.filter(wid => wid !== id));
        } else {
            setSelectedWorkerIds([...selectedWorkerIds, id]);
        }
    };

    // 일괄 삭제
    const handleBulkDelete = async () => {
        if (selectedWorkerIds.length === 0) return;

        if (window.confirm(`선택한 ${selectedWorkerIds.length}명의 작업자를 정말 삭제하시겠습니까?`)) {
            try {
                await Promise.all(selectedWorkerIds.map(id => manpowerService.deleteWorker(id)));
                setSelectedWorkerIds([]);
                await fetchWorkers();
                alert("일괄 삭제되었습니다.");
            } catch (error) {
                console.error("Failed to delete workers", error);
                alert("일괄 삭제에 실패했습니다.");
            }
        }
    };



    // 선택 항목 다운로드 (신분증)
    const handleBulkDownload = async () => {
        if (selectedWorkerIds.length === 0) return;

        const workersToDownload = workers.filter(w => selectedWorkerIds.includes(w.id!) && w.fileNameSaved);
        if (workersToDownload.length === 0) {
            alert("선택한 작업자 중 다운로드할 신분증 이미지가 없습니다.");
            return;
        }

        setIsBulkProgressOpen(true);
        setBulkProgress({ current: 0, total: workersToDownload.length, success: 0, fail: 0 });
        setBulkLogs([]);

        const zip = new JSZip();
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < workersToDownload.length; i++) {
            const worker = workersToDownload[i];
            setBulkProgress(prev => ({ ...prev, current: i + 1 }));

            try {
                // Use getBlob directly from SDK
                const blob = await getBlob(ref(storage, worker.fileNameSaved!));

                const ext = worker.fileNameSaved!.split('.').pop() || 'jpg';
                const filename = `${worker.name}_${worker.idNumber}.${ext}`;

                zip.file(filename, blob);

                successCount++;
                setBulkLogs(prev => [`[성공] ${worker.name} 이미지 다운로드 완료`, ...prev]);
            } catch (error: any) {
                console.error(error);
                failCount++;
                // Try to provide a helpful error message
                let msg = error.code === 'storage/unauthorized' ? '권한 없음' :
                    error.code === 'storage/object-not-found' ? '파일 없음' :
                        error.message;
                setBulkLogs(prev => [`[실패] ${worker.name}: ${msg}`, ...prev]);
            }
            setBulkProgress(prev => ({ ...prev, success: successCount, fail: failCount }));
        }

        if (successCount > 0) {
            setBulkLogs(prev => [`[압축] 파일 압축 중...`, ...prev]);
            try {
                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, `신분증_모음_${new Date().toISOString().slice(0, 10)}.zip`);
                setBulkLogs(prev => [`[완료] 다운로드 시작`, ...prev]);
            } catch (zipError) {
                console.error("Zip generation failed:", zipError);
                setBulkLogs(prev => [`[오류] 압축 파일 생성 실패`, ...prev]);
            }
        } else {
            setBulkLogs(prev => [`[알림] 다운로드 가능한 파일이 없습니다.`, ...prev]);
        }
    };



    // 개별 신분증 다운로드 (Blob 방식 - CORS 해결)
    const handleDownloadIdCard = async (worker: Worker) => {
        if (!worker.fileNameSaved) {
            alert("등록된 신분증 이미지가 없습니다.");
            return;
        }

        try {
            const fileRef = ref(storage, worker.fileNameSaved);
            const url = await getDownloadURL(fileRef);

            const ext = worker.fileNameSaved.split('.').pop() || 'jpg';
            const safeIdNumber = worker.idNumber || '미등록';
            const filename = `${worker.name}_${safeIdNumber}.${ext}`;

            const downloadUrl = new URL(url);
            downloadUrl.searchParams.set(
                'response-content-disposition',
                `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
            );

            const link = document.createElement('a');
            link.href = downloadUrl.toString();
            link.rel = 'noopener noreferrer';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            link.remove();

        } catch (error: unknown) {
            console.error("Download failed:", error);
            alert("다운로드에 실패했습니다. (파일을 찾을 수 없거나 권한 부족)");
        }
    };

    const handleSaveWorker = async (workerData: Omit<Worker, 'id'> | Partial<Worker>) => {
        try {
            if (currentWorker && currentWorker.id) {
                await manpowerService.updateWorker(currentWorker.id, workerData);
            } else {
                await manpowerService.addWorker(workerData as Omit<Worker, 'id'>);
            }
            fetchWorkers();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save worker", error);
            alert("저장에 실패했습니다.");
        }
    };

    const handleBankBookUpdate = async (updates: { workerId: string, bankName: string, accountNumber: string, accountHolder: string }[]) => {
        setLoading(true);
        try {
            await Promise.all(updates.map(update =>
                manpowerService.updateWorker(update.workerId, {
                    bankName: update.bankName,
                    accountNumber: update.accountNumber,
                    accountHolder: update.accountHolder
                })
            ));
            alert(`${updates.length}명의 계좌정보가 업데이트되었습니다.`);
            await fetchData(); // 데이터 새로고침
        } catch (error) {
            console.error("Batch update failed", error);
            alert("일부 업데이트에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleIdCardRegister = async (newWorkers: {
        name: string,
        idNumber: string,
        address: string,
        file: File,
        matchType: 'new' | 'update' | 'duplicate',
        matchedWorkerId?: string
    }[]) => {
        setLoading(true);
        setIsBulkProgressOpen(true);
        setBulkProgress({ current: 0, total: newWorkers.length, success: 0, fail: 0 });
        setBulkLogs([]);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < newWorkers.length; i++) {
            const worker = newWorkers[i];
            setBulkProgress(prev => ({ ...prev, current: i + 1 }));

            try {
                // 1. Upload image to Firebase Storage
                const storagePath = `id_cards/${Date.now()}_${worker.file.name}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, worker.file);

                // 2. 분기 처리: 신규 / 업데이트 / 중복
                let processed = false;

                if (worker.matchType === 'new') {
                    // 신규 작업자 생성
                    await manpowerService.addWorker({
                        name: worker.name,
                        idNumber: worker.idNumber,
                        address: worker.address,
                        role: '작업자',
                        teamType: '미배정',
                        status: '미배정',
                        unitPrice: 0,
                        fileNameSaved: storagePath
                    });
                    setBulkLogs(prev => [`[신규] ${worker.name} 등록 완료`, ...prev]);
                    processed = true;
                } else if (worker.matchType === 'update' && worker.matchedWorkerId) {
                    // 기존 작업자 업데이트 (누락 필드만)
                    const updates: Partial<Worker> = { fileNameSaved: storagePath };
                    if (worker.name) updates.name = worker.name;
                    if (worker.idNumber) updates.idNumber = worker.idNumber;
                    if (worker.address) updates.address = worker.address;

                    await manpowerService.updateWorker(worker.matchedWorkerId, updates);
                    setBulkLogs(prev => [`[업데이트] ${worker.name} 정보 보충 완료`, ...prev]);
                    processed = true;
                } else if (worker.matchType === 'duplicate' && worker.matchedWorkerId) {
                    // 중복 - 사진만 업데이트
                    await manpowerService.updateWorker(worker.matchedWorkerId, {
                        fileNameSaved: storagePath
                    });
                    setBulkLogs(prev => [`[사진] ${worker.name} 신분증 사진 업데이트`, ...prev]);
                    processed = true;
                }

                if (processed) {
                    successCount++;
                } else {
                    failCount++;
                    const reason = !worker.matchedWorkerId ? '매칭된 작업자 ID 없음' : '알 수 없는 유형';
                    setBulkLogs(prev => [`[실패] ${worker.name}: 처리되지 않음 (${worker.matchType}, ${reason})`, ...prev]);
                }
            } catch (error: any) {
                console.error(error);
                failCount++;
                setBulkLogs(prev => [`[실패] ${worker.name}: ${error.message}`, ...prev]);
            }
            setBulkProgress(prev => ({ ...prev, success: successCount, fail: failCount }));
        }

        setLoading(false);
        fetchWorkers();
        // Keep progress modal open to show results
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header & Toolbar - Single Row */}
            <div className="bg-white border-b border-slate-200 p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 flex-shrink-0">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
                    <FontAwesomeIcon icon={faUsers} className="text-blue-600" />
                    작업자 등록 관리
                </h2>

                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:ml-auto justify-end">
                    {/* 열 설정 */}
                    {/* 열 설정 */}
                    <div className="relative inline-block">
                        <button
                            onClick={() => setShowColumnSettings(!showColumnSettings)}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
                        >
                            <FontAwesomeIcon icon={faTable} />
                            <span className="hidden sm:inline">열 설정</span>
                        </button>

                        {showColumnSettings && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-2 text-left">
                                <div className="text-xs font-bold text-slate-500 mb-2 px-2">열 설정 (순서 변경 가능)</div>
                                <div className="space-y-1 max-h-80 overflow-y-auto">
                                    {columnOrder.map((key, index) => {
                                        const col = WORKER_COLUMNS.find(c => c.key === key);
                                        if (!col) return null;
                                        const isFirst = index === 0;
                                        const isLast = index === columnOrder.length - 1;

                                        return (
                                            <div key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded group">
                                                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={visibleColumns.includes(key)}
                                                        onChange={() => toggleColumn(key)}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-slate-700">{col.label}</span>
                                                </label>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!isFirst) moveColumn(index, index - 1);
                                                        }}
                                                        disabled={isFirst}
                                                        className={`p-1 rounded hover:bg-slate-200 ${isFirst ? 'text-slate-300' : 'text-slate-500'}`}
                                                    >
                                                        <FontAwesomeIcon icon={faChevronUp} size="xs" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!isLast) moveColumn(index, index + 1);
                                                        }}
                                                        disabled={isLast}
                                                        className={`p-1 rounded hover:bg-slate-200 ${isLast ? 'text-slate-300' : 'text-slate-500'}`}
                                                    >
                                                        <FontAwesomeIcon icon={faChevronDown} size="xs" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="fixed inset-0 -z-10" onClick={() => setShowColumnSettings(false)}></div>
                            </div>
                        )}
                    </div>

                    {/* 계정 연결 */}
                    <button
                        onClick={() => setShowLinkingModal(true)}
                        title="계정 연동"
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
                    >
                        <FontAwesomeIcon icon={faLink} className="text-slate-500" />
                        <span className="hidden sm:inline">계정 연결</span>
                    </button>

                    {/* 신분증 등록 */}
                    <button
                        onClick={() => setIsIdCardAnalysisModalOpen(true)}
                        title="신분증 대량 등록 (AI)"
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
                    >
                        <FontAwesomeIcon icon={faImages} className="text-brand-600" />
                        <span className="hidden sm:inline">신분증 등록</span>
                    </button>

                    {/* 수정모드 */}
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm whitespace-nowrap ${isEditMode
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faPenToSquare} />
                        <span className="hidden sm:inline">{isEditMode ? '수정 종료' : '수정모드'}</span>
                    </button>

                    {/* 선택 다운로드 */}
                    <button
                        onClick={handleBulkDownload}
                        disabled={selectedWorkerIds.length === 0}
                        title="선택 항목 다운로드"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm whitespace-nowrap ${selectedWorkerIds.length > 0
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 border border-blue-200'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        <span className="hidden sm:inline">선택 다운로드</span>
                    </button>

                    {/* 일괄 수정 */}
                    <button
                        onClick={() => setIsBulkEditOpen(true)}
                        disabled={selectedWorkerIds.length === 0}
                        title="일괄 수정"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm whitespace-nowrap ${selectedWorkerIds.length > 0
                            ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200 border border-indigo-200'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <FontAwesomeIcon icon={faEdit} />
                        <span className="hidden sm:inline">일괄 수정</span>
                    </button>

                    {/* 일괄 삭제 */}
                    <button
                        onClick={handleBulkDelete}
                        disabled={selectedWorkerIds.length === 0}
                        title="일괄 삭제"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all shadow-sm whitespace-nowrap ${selectedWorkerIds.length > 0
                            ? 'bg-red-100 text-red-600 hover:bg-red-200 border border-red-200'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <FontAwesomeIcon icon={faTrash} />
                        <span className="hidden sm:inline">일괄 삭제</span>
                    </button>

                    {/* 근로자 등록 */}
                    <button
                        onClick={() => {
                            setCurrentWorker(null);
                            setIsModalOpen(true);
                        }}
                        title="근로자 등록"
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 whitespace-nowrap ml-auto xl:ml-0"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        근로자 등록
                    </button>
                </div>
            </div>

            {/* 검색 및 목록 - Content Area */}
            <div className="flex-1 overflow-auto p-4 md:p-6">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faUsers} className="text-blue-600" />
                            등록된 작업자 ({filteredWorkers.length}명)
                        </h3>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showInactive}
                                    onChange={(e) => setShowInactive(e.target.checked)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                퇴사자 포함
                            </label>
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="이름, 주민번호, 연락처 검색"
                                    className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-64"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-auto max-h-[calc(100vh-250px)]">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-center w-12 bg-gray-50">
                                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-gray-700">
                                            <FontAwesomeIcon icon={selectedWorkerIds.length === filteredWorkers.length && filteredWorkers.length > 0 ? faCheckSquare : faSquare} />
                                        </button>
                                    </th>
                                    {orderedColumns.map(key => {
                                        const col = WORKER_COLUMNS.find(c => c.key === key);
                                        if (!col) return null;
                                        return (
                                            <th key={col.key} className={`px-4 py-3 text-${col.key === 'unitPrice' ? 'right' : 'left'} font-medium text-gray-700 bg-gray-50`}>
                                                {col.label}
                                            </th>
                                        );
                                    })}
                                    <th className="px-4 py-3 text-center font-medium text-gray-700 bg-gray-50">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                                            데이터를 불러오는 중입니다...
                                        </td>
                                    </tr>
                                ) : filteredWorkers.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                                            등록된 작업자가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredWorkers.map((worker) => {
                                        const isInactive = worker.status === '퇴사' || worker.status === 'inactive' || worker.status === '출입금지';
                                        const workerTeam = worker.teamId ? teams.find(t => t.id === worker.teamId) : undefined;
                                        const workerCompany = worker.companyId ? companies.find(c => c.id === worker.companyId) : undefined;
                                        const iconColor = workerTeam?.color || worker.color || '#e5e7eb';

                                        return (
                                            <tr
                                                key={worker.id}
                                                className={`border-b transition-colors 
                                                    ${selectedWorkerIds.includes(worker.id!) ? 'bg-indigo-50' : 'hover:bg-gray-50'} 
                                                    ${isInactive ? 'bg-slate-50 text-slate-400' : ''}
                                                `}
                                            >
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => toggleSelectWorker(worker.id!)} className={`${selectedWorkerIds.includes(worker.id!) ? 'text-indigo-600' : 'text-gray-400'} hover:text-indigo-600`}>
                                                        <FontAwesomeIcon icon={selectedWorkerIds.includes(worker.id!) ? faCheckSquare : faSquare} />
                                                    </button>
                                                </td>
                                                {orderedColumns.map(key => {
                                                    const col = WORKER_COLUMNS.find(c => c.key === key);
                                                    if (!col) return null;

                                                    return (
                                                        <td key={key} className={`px-4 py-3 ${key === 'unitPrice' ? 'text-right' : 'text-left'} ${key === 'name' ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                                            {(() => {
                                                                switch (key) {
                                                                    case 'name': return isEditMode ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="color"
                                                                                value={worker.color || '#0f766e'}
                                                                                onChange={(e) => handleWorkerChange(worker.id!, 'color', e.target.value)}
                                                                                onBlur={(e) => handleWorkerBlur(worker.id!, 'color', e.target.value)}
                                                                                className="h-8 w-8 rounded border border-slate-300 cursor-pointer"
                                                                            />
                                                                            <input
                                                                                type="text"
                                                                                value={worker.name || ''}
                                                                                onChange={(e) => handleWorkerChange(worker.id!, 'name', e.target.value)}
                                                                                onBlur={(e) => handleWorkerBlur(worker.id!, 'name', e.target.value)}
                                                                                className="w-full border rounded px-2 py-1 text-sm"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2">
                                                                            <span
                                                                                className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 flex-shrink-0"
                                                                                style={{ backgroundColor: iconColor }}
                                                                            >
                                                                                <FontAwesomeIcon icon={faUser} className="text-white text-xs" />
                                                                            </span>
                                                                            <span className="truncate">{worker.name}</span>
                                                                            {worker.fileNameSaved && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDownloadIdCard(worker);
                                                                                    }}
                                                                                    className="text-slate-400 hover:text-indigo-600 transition-colors ml-1"
                                                                                    title="신분증 다운로드"
                                                                                >
                                                                                    <FontAwesomeIcon icon={faIdCard} size="sm" />
                                                                                </button>
                                                                            )}
                                                                            {isInactive && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-gray-500">퇴사</span>}
                                                                        </div>
                                                                    );
                                                                    case 'idNumber': return isEditMode ? (
                                                                        <input
                                                                            type="text"
                                                                            value={worker.idNumber || ''}
                                                                            onChange={(e) => handleWorkerChange(worker.id!, 'idNumber', e.target.value)}
                                                                            onBlur={(e) => handleWorkerBlur(worker.id!, 'idNumber', e.target.value)}
                                                                            className="w-full border rounded px-2 py-1 text-sm"
                                                                        />
                                                                    ) : worker.idNumber;
                                                                    case 'contact': return isEditMode ? (
                                                                        <input
                                                                            type="text"
                                                                            value={worker.contact || ''}
                                                                            onChange={(e) => handleWorkerChange(worker.id!, 'contact', e.target.value)}
                                                                            onBlur={(e) => handleWorkerBlur(worker.id!, 'contact', e.target.value)}
                                                                            className="w-full border rounded px-2 py-1 text-sm"
                                                                        />
                                                                    ) : (worker.contact || '-');
                                                                    case 'role': {
                                                                        const workerPosition = positions.find(p => p.name === worker.role);
                                                                        const posIcon = resolveIcon(workerPosition?.icon, faUser);
                                                                        const posColor = workerPosition?.color || 'gray';
                                                                        const colorClass = {
                                                                            red: 'bg-red-500', orange: 'bg-orange-500', yellow: 'bg-yellow-500',
                                                                            green: 'bg-emerald-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500',
                                                                            purple: 'bg-purple-500', pink: 'bg-pink-500', gray: 'bg-slate-500',
                                                                            slate: 'bg-slate-500', black: 'bg-slate-900',
                                                                        }[posColor] || 'bg-slate-500';

                                                                        return isEditMode ? (
                                                                            <select
                                                                                value={worker.role || '일반'}
                                                                                onChange={(e) => {
                                                                                    handleWorkerChange(worker.id!, 'role', e.target.value);
                                                                                    handleWorkerBlur(worker.id!, 'role', e.target.value);
                                                                                }}
                                                                                className="w-full border rounded px-2 py-1 text-sm"
                                                                            >
                                                                                {positions.map(pos => (
                                                                                    <option key={pos.id} value={pos.name}>{pos.name}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${colorClass}`}>
                                                                                    <FontAwesomeIcon icon={posIcon} className="text-white text-xs" />
                                                                                </span>
                                                                                <span>{worker.role || '일반'}</span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    case 'salaryModel': {
                                                                        const companyType = workerCompany?.type;
                                                                        const isPartner = companyType === '협력사';
                                                                        const currentValue = isPartner ? '지원팀' : (worker.salaryModel || '일급제');
                                                                        return isEditMode ? (
                                                                            <select
                                                                                value={currentValue}
                                                                                onChange={(e) => {
                                                                                    handleWorkerChange(worker.id!, 'salaryModel', e.target.value);
                                                                                    handleWorkerBlur(worker.id!, 'salaryModel', e.target.value);
                                                                                }}
                                                                                disabled={isPartner}
                                                                                className={`w-full border rounded px-2 py-1 text-sm ${isPartner ? 'bg-gray-100 text-gray-500' : ''}`}
                                                                            >
                                                                                {isPartner ? <option value="지원팀">지원팀</option> :
                                                                                    <>
                                                                                        <option value="일급제">일급제</option>
                                                                                        <option value="주급제">주급제</option>
                                                                                        <option value="월급제">월급제</option>
                                                                                        <option value="지원팀">지원팀</option>
                                                                                        <option value="용역팀">용역팀</option>
                                                                                        <option value="가지급">가지급</option>
                                                                                    </>
                                                                                }
                                                                            </select>
                                                                        ) : (
                                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${currentValue === '일급제' ? 'bg-yellow-100 text-yellow-700' :
                                                                                currentValue === '월급제' ? 'bg-green-100 text-green-700' :
                                                                                    currentValue === '지원팀' ? 'bg-orange-100 text-orange-700' :
                                                                                        'bg-gray-100 text-gray-600'}`}>
                                                                                {currentValue}
                                                                            </span>
                                                                        );
                                                                    }
                                                                    case 'teamName': {
                                                                        const teamIcon = resolveIcon(workerTeam?.icon, faUsers);
                                                                        const teamColor = workerTeam?.color || '#94a3b8';
                                                                        return isEditMode ? (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0" style={{ backgroundColor: teamColor }}>
                                                                                    <FontAwesomeIcon icon={teamIcon} className="text-white text-xs" />
                                                                                </span>
                                                                                <select
                                                                                    value={worker.teamId || ''}
                                                                                    onChange={(e) => handleWorkerTeamSelect(worker.id!, e.target.value)}
                                                                                    className="w-full border rounded px-2 py-1 text-sm"
                                                                                >
                                                                                    <option value="">미배정</option>
                                                                                    {teams.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                                                                                </select>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0" style={{ backgroundColor: teamColor }}>
                                                                                    <FontAwesomeIcon icon={teamIcon || faUsers} className="text-white text-xs" />
                                                                                </span>
                                                                                <span className={workerTeam ? 'text-gray-900' : 'text-gray-400'}>{workerTeam?.name || worker.teamName || '-'}</span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    case 'companyName': {
                                                                        return isEditMode ? (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: workerCompany?.color || '#e5e7eb' }}>
                                                                                    <FontAwesomeIcon icon={faBuilding} className="text-white text-xs" />
                                                                                </span>
                                                                                <select
                                                                                    value={worker.companyId || ''}
                                                                                    onChange={(e) => handleWorkerCompanySelect(worker.id!, e.target.value)}
                                                                                    className="w-full border rounded px-2 py-1 text-sm"
                                                                                >
                                                                                    <option value="">미소속</option>
                                                                                    {companies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                                                                                </select>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: workerCompany?.color || '#e5e7eb' }}>
                                                                                    <FontAwesomeIcon icon={faBuilding} className="text-white text-xs" />
                                                                                </span>
                                                                                <span>{workerCompany?.name || worker.companyName || '-'}</span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    case 'status': {
                                                                        const canonicalStatus = getCanonicalStatus(worker.status);
                                                                        const isWorkerActive = canonicalStatus === '재직';
                                                                        return isEditMode ? (
                                                                            <select
                                                                                value={isWorkerActive ? '재직' : '퇴사'}
                                                                                onChange={(e) => handleStatusChange(worker.id!, e.target.value)}
                                                                                className="w-full border rounded px-2 py-1 text-sm"
                                                                            >
                                                                                <option value="재직">재직</option>
                                                                                <option value="퇴사">퇴사</option>
                                                                            </select>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2">
                                                                                <button
                                                                                    onClick={() => handleStatusChange(worker.id!, isWorkerActive ? '퇴사' : '재직')}
                                                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isWorkerActive ? 'bg-green-500' : 'bg-slate-300'}`}
                                                                                >
                                                                                    <span className="sr-only">상태 변경</span>
                                                                                    <span className={`${isWorkerActive ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out`} />
                                                                                </button>
                                                                                <span className="text-xs text-slate-500">{canonicalStatus}</span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    case 'unitPrice': return isEditMode ? (
                                                                        <input
                                                                            type="number"
                                                                            value={worker.unitPrice || 0}
                                                                            onChange={(e) => handleWorkerChange(worker.id!, 'unitPrice', Number(e.target.value))}
                                                                            onBlur={(e) => handleWorkerBlur(worker.id!, 'unitPrice', Number(e.target.value))}
                                                                            className="w-full border rounded px-2 py-1 text-sm text-right"
                                                                        />
                                                                    ) : (worker.unitPrice ? worker.unitPrice.toLocaleString() : '0');
                                                                    case 'bankInfo': return isEditMode ? (
                                                                        <div className="flex flex-col gap-1 min-w-[120px]">
                                                                            <input
                                                                                type="text"
                                                                                value={worker.bankName || ''}
                                                                                placeholder="은행"
                                                                                onChange={(e) => handleWorkerChange(worker.id!, 'bankName', e.target.value)}
                                                                                onBlur={(e) => handleWorkerBlur(worker.id!, 'bankName', e.target.value)}
                                                                                className="w-full border rounded px-2 py-1 text-xs"
                                                                            />
                                                                            <input
                                                                                type="text"
                                                                                value={worker.accountNumber || ''}
                                                                                placeholder="계좌번호"
                                                                                onChange={(e) => handleWorkerChange(worker.id!, 'accountNumber', e.target.value)}
                                                                                onBlur={(e) => handleWorkerBlur(worker.id!, 'accountNumber', e.target.value)}
                                                                                className="w-full border rounded px-2 py-1 text-xs"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-col">
                                                                            <span className="text-xs font-bold text-slate-700">{worker.bankName}</span>
                                                                            <span className="text-xs">{worker.accountNumber}</span>
                                                                            {worker.accountHolder && <span className="text-[10px] text-gray-400">({worker.accountHolder})</span>}
                                                                        </div>
                                                                    );
                                                                    default: return null;
                                                                }
                                                            })()}
                                                        </td>
                                                    );
                                                })
                                                }

                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {worker.fileNameSaved ? (
                                                            <button
                                                                onClick={() => handleDownloadIdCard(worker)}
                                                                className="p-1.5 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors flex items-center gap-1"
                                                                title="신분증 다운로드"
                                                            >
                                                                <FontAwesomeIcon icon={faCheckSquare} />
                                                                <span>신분증</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-gray-400 p-1.5">미등록</span>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                setCurrentWorker(worker);
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                                            title="수정"
                                                        >
                                                            <FontAwesomeIcon icon={faEdit} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(worker.id!, worker.name)}
                                                            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                            title="삭제"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div >

            {/* Modals */}
            {
                isModalOpen && (
                    <WorkerModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSave={handleSaveWorker}
                        initialData={currentWorker || { status: '재직' }}
                        teams={teams}
                        companies={companies}
                        positions={positions}
                    />
                )
            }

            <IdCardAnalysisModal
                isOpen={isIdCardAnalysisModalOpen}
                onClose={() => setIsIdCardAnalysisModalOpen(false)}
                onAddWorkers={handleIdCardRegister}
                existingWorkers={workers}
            />

            {
                isBankBookModalOpen && (
                    <BankBookAnalysisModal
                        isOpen={isBankBookModalOpen}
                        onClose={() => setIsBankBookModalOpen(false)}
                        workers={filteredWorkers}
                        onUpdateWorkers={handleBankBookUpdate}
                    />
                )
            }

            {
                showLinkingModal && (
                    <AccountLinkingModal
                        onClose={() => setShowLinkingModal(false)}
                    />
                )
            }

            <BulkProgressModal
                isOpen={isBulkProgressOpen}
                onClose={() => setIsBulkProgressOpen(false)}
                progress={bulkProgress}
                logs={bulkLogs}
            />

            <BulkEditWorkerModal
                isOpen={isBulkEditOpen}
                onClose={() => setIsBulkEditOpen(false)}
                onSave={async (updates) => {
                    await manpowerService.updateWorkersBatch(selectedWorkerIds, updates);
                    await fetchWorkers();
                    setSelectedWorkerIds([]);
                    alert('일괄 수정이 완료되었습니다.');
                }}
                selectedCount={selectedWorkerIds.length}
                teams={teams}
                sites={sites}
                companies={companies}
                positions={positions}
            />
        </div >
    );
};

export default WorkerManagement;
