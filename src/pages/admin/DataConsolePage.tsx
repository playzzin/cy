import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    query,
    limit,
    orderBy,
    Timestamp,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

// AG Grid Imports (v34+)
import { AgGridReact } from 'ag-grid-react';
import {
    AllCommunityModule,
    ModuleRegistry,
    ColDef,
    GridReadyEvent,
    ICellRendererParams,
    CellValueChangedEvent,
    themeQuartz
} from 'ag-grid-community';

import 'ag-grid-community/styles/ag-grid.css';

import 'ag-grid-community/styles/ag-theme-quartz.css';


// FontAwesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDatabase,
    faTable,
    faSearch,
    faPlus,
    faSave,
    faTrash,
    faRefresh,
    faSpinner,
    faCode,
    faLayerGroup,
    faCog,
    faUserShield,
    faHardHat,
    faBuilding,
    faUsers,
    faFileInvoice,
    faBed,
    faBolt,
    faExclamationTriangle,
    faCheckCircle,
    faTimesCircle,
    faEdit
} from '@fortawesome/free-solid-svg-icons';

// SweetAlert2
import Swal from 'sweetalert2';

// Register AG Grid Modules
ModuleRegistry.registerModules([AllCommunityModule]);

// --- Types & Interfaces ---

interface CollectionConfig {
    id: string;
    name: string;
    icon: any;
    description: string;
    hidden?: boolean;
}

interface CollectionGroup {
    groupName: string;
    collections: CollectionConfig[];
}

// --- Configuration ---

const COLLECTION_GROUPS: CollectionGroup[] = [
    {
        groupName: '핵심 데이터 (Core)',
        collections: [
            { id: 'workers', name: '근로자 (Workers)', icon: faHardHat, description: '현장 투입 근로자 정보' },
            { id: 'teams', name: '팀 (Teams)', icon: faUsers, description: '작업 팀 및 반장 정보' },
            { id: 'sites', name: '현장 (Sites)', icon: faBuilding, description: '건설 현장 및 프로젝트' },
            { id: 'companies', name: '회사 (Companies)', icon: faBuilding, description: '시공사 및 협력사' },
        ]
    },
    {
        groupName: '업무 데이터 (Work)',
        collections: [
            { id: 'daily_reports', name: '작업 일보 (Daily Reports)', icon: faFileInvoice, description: '일일 출력 및 작업 내용' },
            { id: 'accommodations', name: '숙소 (Accommodations)', icon: faBed, description: '숙소 계약 및 정보' },
            { id: 'utility_records', name: '공과금 (Utilities)', icon: faBolt, description: '숙소 공과금 및 관리비' },
        ]
    },
    {
        groupName: '시스템 및 설정 (System)',
        collections: [
            { id: 'users', name: '사용자 (Users)', icon: faUserShield, description: '시스템 접속 계정' },
            { id: 'positions', name: '직책/직급 (Positions)', icon: faUserShield, description: '인사 관리 직책' },
            { id: 'system_config', name: '시스템 설정 (Config)', icon: faCog, description: '권한 및 전역 설정' },
            { id: 'audit_logs', name: '활동 로그 (Audit)', icon: faDatabase, description: '시스템 주요 활동 기록', hidden: false },
        ]
    }
];

// Default JSON Templates
const TEMPLATES: Record<string, object> = {
    workers: {
        name: "",
        residentNumber: "000000-1000000",
        phone: "010-0000-0000",
        address: "",
        role: "조공",
        unitPrice: 160000,
        teamId: "",
        isActive: true
    },
    teams: {
        name: "",
        leaderId: "",
        companyId: "",
        type: "본팀",
        isActive: true
    },
    sites: {
        name: "",
        code: "SITE_001",
        address: "",
        companyId: "",
        startDate: "2024-01-01",
        status: "active"
    }
};

// --- Components ---

const DataConsolePage: React.FC = () => {
    // State
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>('workers');
    const [rowData, setRowData] = useState<any[]>([]);
    const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [searchText, setSearchText] = useState<string>('');
    const [gridApi, setGridApi] = useState<any>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editMode, setEditMode] = useState<'create' | 'update'>('create');
    const [currentDocId, setCurrentDocId] = useState('');
    const [jsonContent, setJsonContent] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);

    // Helper: Determine current collection info
    const currentCollection = useMemo(() => {
        for (const group of COLLECTION_GROUPS) {
            const found = group.collections.find(c => c.id === selectedCollectionId);
            if (found) return found;
        }
        return { id: selectedCollectionId, name: selectedCollectionId, icon: faDatabase, description: '' };
    }, [selectedCollectionId]);

    // Data Fetching
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Default Limit 1000 for performance, Order by updatedAt desc if possible, else default
            const q = query(collection(db, selectedCollectionId), limit(1000));
            const snapshot = await getDocs(q);

            const docs = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id, // Ensure ID is present
                    ...data
                };
            });

            setRowData(docs);
            generateColumns(docs);
        } catch (error: any) {
            console.error("Fetch error:", error);
            Swal.fire({
                icon: 'error',
                title: '데이터 로드 실패',
                text: error.message
            });
            setRowData([]);
            setColumnDefs([]);
        } finally {
            setLoading(false);
        }
    }, [selectedCollectionId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);


    // Inline Edit Handler
    const onCellValueChanged = async (params: CellValueChangedEvent) => {
        const { data, colDef, newValue, oldValue } = params;
        if (newValue === oldValue) return;

        try {
            const collectionId = selectedCollectionId;
            const docId = data.id;

            // Optimistic UI is already handled by grid

            // Allow reverting? Not easily without more state. 
            // We assume success or show error.

            let finalValue = newValue;

            // Basic Type Conversion
            if (colDef.cellEditor === 'agNumberCellEditor' || typeof oldValue === 'number') {
                finalValue = Number(newValue);
                if (isNaN(finalValue)) finalValue = 0; // or revert?
            }

            await updateDoc(doc(db, collectionId, docId), {
                [colDef.field!]: finalValue,
                updatedAt: serverTimestamp()
            });

            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer)
                    toast.addEventListener('mouseleave', Swal.resumeTimer)
                }
            });

            Toast.fire({
                icon: 'success',
                title: 'Saved successfully'
            });

        } catch (error: any) {
            console.error("Update failed:", error);
            // Revert value
            params.node.setDataValue(colDef.field!, oldValue);
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Save Failed',
                text: error.message
            });
        }
    };

    // Field Name Mappings (Korean Translation)
    // Field Metadata (Label + Description for Beginners)
    const FIELD_METADATA: { [key: string]: { label: string; desc: string } } = {
        // Common System Fields
        'id': { label: '고유 ID', desc: '데이터베이스에서 각 문서를 구별하는 유일한 값입니다. (자동 생성됨)' },
        'createdAt': { label: '생성일', desc: '이 데이터가 처음 만들어진 시간입니다. 시스템이 자동으로 기록합니다.' },
        'updatedAt': { label: '수정일', desc: '이 데이터가 마지막으로 변경된 시간입니다. 수정 시 자동으로 갱신됩니다.' },
        'uid': { label: 'UID', desc: '사용자 고유 식별자입니다. Firebase Auth 인증 시스템과 연결됩니다.' },
        'isActive': { label: '활성 상태', desc: '이 데이터가 현재 사용 중인지 여부입니다. (true: 사용중, false: 숨김/삭제됨)' },
        'type': { label: '유형', desc: '데이터의 종류나 카테고리를 나타냅니다. (예: 시공사, 협력사 등)' },
        'code': { label: '코드', desc: '현장이나 회사를 식별하는 짧은 관리용 코드입니다.' },
        'status': { label: '상태', desc: '현재 진행 상태입니다. (active: 진행중, completed: 완료 등)' },

        // User (사용자)
        'email': { label: '이메일', desc: '사용자의 로그인 아이디로 사용되는 이메일 주소입니다.' },
        'displayName': { label: '이름', desc: '화면에 표시되는 사용자의 실명입니다.' },
        'photoUrl': { label: '사진 URL', desc: '프로필 이미지의 인터넷 주소입니다.' },
        'role': { label: '직책/권한', desc: '사용자의 권한 레벨입니다. (예: admin, manager, general)' },
        'lastLogin': { label: '마지막 로그인', desc: '사용자가 마지막으로 시스템에 접속한 시간입니다.' },
        'linkedWorkerIds': { label: '연동 작업자 IDs', desc: '이 계정과 연결된 현장 근로자 데이터의 ID 목록입니다.' },
        'phoneNumber': { label: '전화번호', desc: '연락 가능한 휴대전화 번호입니다.' },
        'fcmToken': { label: 'FCM 토큰', desc: '모바일 앱 푸시 알림을 보내기 위한 고유 키값입니다.' },

        // Company & Site (회사 및 현장)
        'name': { label: '이름/명칭', desc: '회사명, 현장명, 혹은 사람의 이름입니다.' },
        'ceoName': { label: '대표자명', desc: '사업자등록증에 기재된 대표자의 성명입니다.' },
        'businessNumber': { label: '사업자번호', desc: '회사의 고유한 사업자등록번호입니다. (하이픈 포함 추천)' },
        'siteName': { label: '현장명', desc: '공사가 진행되는 현장의 공식 명칭입니다.' },
        'companyName': { label: '소속 회사명', desc: '이 현장이나 팀이 소속된 회사의 이름입니다.' },
        'companyId': { label: '소속 회사 ID', desc: '소속된 회사의 시스템 내부 ID입니다.' },
        'responsibleTeamId': { label: '담당 팀 ID', desc: '이 현장을 담당하는 주 관리 팀의 ID입니다.' },
        'responsibleTeamName': { label: '담당 팀명', desc: '이 현장을 담당하는 주 관리 팀의 이름입니다.' },
        'address': { label: '주소', desc: '회사나 현장의 물리적 위치 주소입니다.' },
        'corpNum': { label: '법인번호', desc: '법인인 경우 법인등록번호를 기록합니다.' },
        'tel': { label: '전화번호', desc: '회사의 대표 전화번호입니다.' },
        'fax': { label: '팩스번호', desc: '문서 수신용 팩스 번호입니다.' },
        'kickoffDate': { label: '착공일', desc: '공사가 시작된 날짜입니다.' },
        'endDate': { label: '종료일/준공일', desc: '공사나 계약이 종료되는 날짜입니다.' },

        // Workers (근로자)
        'jumin': { label: '주민등록번호', desc: '급여 신고 및 세금 처리를 위한 주민번호 뒷자리 포함 전체 번호입니다.' },
        'birthDate': { label: '생년월일', desc: '근로자의 생년월일 (YYMMDD 혹은 YYYY-MM-DD)' },
        'gender': { label: '성별', desc: '남성/여성 구분' },
        'teamId': { label: '소속 팀 ID', desc: '이 근로자가 현재 소속된 팀의 고유 ID입니다.' },
        'folderId': { label: '폴더 ID', desc: '전자결재나 문서함 분류를 위한 폴더 식별자입니다.' },
        'leaderId': { label: '팀장 ID', desc: '이 팀을 이끄는 팀장의 근로자 데이터 ID입니다.' },
        'targetWage': { label: '적용 단가', desc: '근로자에게 지급하기로 계약된 하루 일당(단가)입니다.' },
        'accountNumber': { label: '계좌번호', desc: '급여를 지급받을 은행 계좌번호입니다.' },
        'bankName': { label: '은행명', desc: '계좌의 은행 이름입니다. (예: 국민, 신한)' },
        'accountHolder': { label: '예금주', desc: '통장에 표시된 예금주 명입니다 (보통 본인 이름).' },
        'registrationDate': { label: '등록일', desc: '시스템에 근로자로 처음 등록된 날짜입니다.' },
        'contractDate': { label: '근로계약일', desc: '근로 계약서를 작성한 날짜입니다.' },

        // Daily Reports (일보)
        'date': { label: '작업 날짜', desc: '해당 일보가 작성된 실제 작업일입니다.' },
        'siteId': { label: '현장 ID', desc: '작업이 이루어진 현장의 고유 ID입니다.' },
        'writerId': { label: '작성자 ID', desc: '일보를 작성한 사용자의 UID입니다.' },
        'totalManDay': { label: '총 공수', desc: '당일 투입된 인원의 총 공수 합계입니다. (예: 5.5공수)' },
        'totalAmount': { label: '총 금액', desc: '당일 발생한 노무비 등의 총 합계 금액입니다.' },
        'weather': { label: '날씨', desc: '작업 당일의 날씨 상태입니다.' },

        // Accommodations (숙소)
        'roomName': { label: '숙소명/호실', desc: '숙소의 이름이나 호수입니다.' },
        'deposit': { label: '보증금', desc: '숙소 임대 보증금 액수입니다.' },
        'monthlyRent': { label: '월세', desc: '매월 나가는 임대료입니다.' },
        'managementFee': { label: '관리비', desc: '매월 고정적으로 지출되는 관리비입니다.' },

        // Sites Specific
        'basicRate': { label: '대장 단가', desc: '해당 현장에 기본적으로 적용되는 기준 단가입니다.' },

        // General
        'description': { label: '설명', desc: '추가적인 상세 설명이나 비고 사항입니다.' },
        'memo': { label: '메모', desc: '관리자용 내부 메모입니다.' }
    };

    // Column Generation Logic
    const generateColumns = (docs: any[]) => {
        if (docs.length === 0) {
            setColumnDefs([{ field: 'id', headerName: '고유 ID (ID)', flex: 1 }]);
            return;
        }

        // Sample keys from top 20 documents to ensure coverage
        const keys = new Set<string>(['id']); // ID always first
        docs.slice(0, 20).forEach(doc => {
            Object.keys(doc).forEach(key => keys.add(key));
        });

        const defs: ColDef[] = Array.from(keys).map(key => {
            const isId = key === 'id';

            // Determine type inference from first non-null value
            const sampleValue = docs.find(d => d[key] !== undefined && d[key] !== null)?.[key];
            const type = typeof sampleValue;
            let filter = 'agTextColumnFilter';
            let cellRenderer = undefined;
            let width = undefined;
            let editable = false;
            let cellEditor = 'agTextCellEditor';
            let cellEditorParams = {};

            if (key === 'id' || key === 'createdAt' || key === 'updatedAt') {
                // Read-only system fields (keep as is)
            } else {
                // Default Editable
                editable = true;
            }

            if (key === 'id') {
                width = 220;
                cellRenderer = (params: ICellRendererParams) => (
                    <span className="font-mono text-xs text-slate-400">{params.value}</span>
                );
            }

            if (key === 'status' || key === 'type' || key === 'role' || key === 'salaryModel' || key === 'teamType') {
                cellRenderer = (params: ICellRendererParams) => {
                    if (!params.value) return '-';
                    const colors = [
                        'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                        'bg-amber-500/20 text-amber-300 border-amber-500/30',
                        'bg-rose-500/20 text-rose-300 border-rose-500/30',
                        'bg-sky-500/20 text-sky-300 border-sky-500/30',
                        'bg-purple-500/20 text-purple-300 border-purple-500/30',
                    ];
                    // Simple hash for consistent color
                    const hash = params.value.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                    const colorClass = colors[hash % colors.length];

                    return (
                        <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wider ${colorClass}`}>
                            {params.value}
                        </span>
                    );
                };
                width = 130;
                // Use default Text Editor for now, but maybe Select later
            } else if (type === 'boolean') {
                // For Booleans, use Select Editor with True/False
                cellEditor = 'agSelectCellEditor';
                cellEditorParams = {
                    values: [true, false]
                };
                cellRenderer = (params: ICellRendererParams) => {
                    return params.value ?
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                            <FontAwesomeIcon icon={faCheckCircle} /> ACTIVE
                        </span> :
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-700/50 border border-slate-600/50 text-slate-400 text-[11px] font-bold">
                            <FontAwesomeIcon icon={faTimesCircle} /> INACTIVE
                        </span>;
                };
                width = 120;
            } else if (type === 'number') {
                filter = 'agNumberColumnFilter';
                cellEditor = 'agNumberCellEditor'; // Built-in Number editor
                cellRenderer = (params: ICellRendererParams) => (
                    <span className="font-mono text-indigo-300 font-bold">{params.value?.toLocaleString()}</span>
                );
                width = 120;
            } else if (sampleValue instanceof Timestamp || (typeof sampleValue === 'object' && sampleValue?.seconds)) {
                // Keep Date Read-only for now or simple text if user knows ISO
                // Let's keep read-only for complex objects to avoid crashes
                editable = false;

                // Firestore Timestamp
                cellRenderer = (params: ICellRendererParams) => {
                    if (!params.value) return '-';
                    try {
                        const date = params.value instanceof Timestamp ? params.value.toDate() : new Date(params.value.seconds * 1000);
                        return <span className='text-[11px] font-mono text-slate-300 bg-white/5 px-1.5 py-0.5 rounded border border-white/5'>{date.toLocaleString('ko-KR')}</span>;
                    } catch (e) { return 'Invalid Date'; }
                };
                width = 180;
            } else if (type === 'object') {
                editable = false; // Disable editing for Objects/Arrays inline
                cellRenderer = (params: ICellRendererParams) => {
                    if (!params.value) return '';
                    return <span className="text-xs text-slate-500 font-mono overflow-hidden text-ellipsis whitespace-nowrap block w-full" title={JSON.stringify(params.value)}>{JSON.stringify(params.value)}</span>;
                };
                width = 200;
            }

            // Header Name Translation & Tooltip
            const meta = FIELD_METADATA[key];
            const headerName = meta
                ? `${meta.label} (${key})`
                : key;
            const headerTooltip = meta ? meta.desc : undefined;

            return {
                field: key,
                headerName: headerName,
                headerTooltip: headerTooltip, // Shows description on hover
                tooltipField: key, // Optional: also show value tooltip
                filter: filter,
                sortable: true,
                resizable: true,
                flex: isId ? 0 : 1,

                minWidth: 100,
                width: width,
                pinned: isId ? 'left' : undefined,
                cellRenderer: cellRenderer,
                editable: editable,
                cellEditor: cellEditor,
                cellEditorParams: cellEditorParams
            } as ColDef;
        });

        // Add Actions Column
        defs.unshift({
            headerName: 'Actions',
            field: 'actions',
            pinned: 'right',
            width: 100,
            sortable: false,
            filter: false,
            cellRenderer: (params: ICellRendererParams) => (
                <div className="flex items-center gap-2 justify-center h-full">
                    <button
                        onClick={() => handleEditClick(params.data)}
                        className="text-indigo-600 hover:text-indigo-800 transition-colors"
                        title="Edit"
                    >
                        <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                        onClick={() => handleDeleteClick(params.data.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Delete"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            )
        });

        setColumnDefs(defs);
    };

    // Actions
    const handleEditClick = (data: any) => {
        const { id, ...editableData } = data;
        // Convert Timestamps to string for editing
        const replacer = (key: string, value: any) => {
            if (value && typeof value === 'object' && value.seconds !== undefined) {
                return new Date(value.seconds * 1000).toISOString();
            }
            return value;
        };

        setCurrentDocId(id);
        setJsonContent(JSON.stringify(editableData, replacer, 2));
        setEditMode('update');
        setJsonError(null);
        setIsModalOpen(true);
    };

    const handleCreateClick = () => {
        const template = TEMPLATES[selectedCollectionId] || {};
        setCurrentDocId('');
        setJsonContent(JSON.stringify(template, null, 2));
        setEditMode('create');
        setJsonError(null);
        setIsModalOpen(true);
    };

    const handleDeleteClick = async (docId: string) => {
        const result = await Swal.fire({
            title: '정말 삭제하시겠습니까?',
            text: `ID: ${docId} 문서를 삭제합니다. 복구할 수 없습니다.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, selectedCollectionId, docId));
                Swal.fire('삭제됨', '문서가 성공적으로 삭제되었습니다.', 'success');
                // Optimistic Update
                setRowData(prev => prev.filter(r => r.id !== docId));
            } catch (error: any) {
                Swal.fire('오류', `삭제 실패: ${error.message}`, 'error');
            }
        }
    };

    const handleSave = async () => {
        try {
            // Validate JSON
            let parsedData;
            try {
                parsedData = JSON.parse(jsonContent);
            } catch (e: any) {
                setJsonError(e.message);
                return;
            }

            // Restore Timestamps (simple check for ISO strings that look like dates? maybe optional)
            // For robust admin, we might assume user inputs ISO strings for dates.
            // Firestore saves ISO strings as Strings unless converted to Date object.
            // Let's iterate and convert specific keys if needed, or leave as string.
            // Requirement usually prefers Timestamp. Auto-detect? complex. 
            // Let's just save as is for now, standard JSON doesn't support Date objects.

            if (editMode === 'create') {
                const newId = currentDocId.trim();
                if (newId) {
                    await setDoc(doc(db, selectedCollectionId, newId), {
                        ...parsedData,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                } else {
                    // Auto ID
                    const newDocRef = doc(collection(db, selectedCollectionId));
                    await setDoc(newDocRef, {
                        ...parsedData,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                }
            } else {
                await setDoc(doc(db, selectedCollectionId, currentDocId), {
                    ...parsedData,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }

            setIsModalOpen(false);
            Swal.fire('저장 성공', '데이터가 저장되었습니다.', 'success');
            fetchData(); // Refresh to match server state

        } catch (error: any) {
            Swal.fire('저장 실패', error.message, 'error');
        }
    };

    // Grid Ready
    const onGridReady = (params: GridReadyEvent) => {
        setGridApi(params.api);
    };

    // Search Filter
    useEffect(() => {
        if (gridApi) {
            gridApi.setGridOption('quickFilterText', searchText);
        }
    }, [searchText, gridApi]);

    // --- Stats Calculation ---
    const stats = useMemo(() => {
        const totalDocs = rowData.length;
        const activeDocs = rowData.filter(d => d.isActive !== false && d.status !== 'completed').length;
        // Calculate "Recent" (last 24h)
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentDocs = rowData.filter(d => {
            if (!d.updatedAt) return false;
            const date = d.updatedAt instanceof Timestamp ? d.updatedAt.toDate() : new Date(d.updatedAt.seconds * 1000);
            return date > oneDayAgo;
        }).length;

        return { totalDocs, activeDocs, recentDocs };
    }, [rowData]);

    // --- Render ---
    return (
        <div className="flex h-screen bg-[#0f172a] text-slate-100 font-sans overflow-hidden">
            {/* 1. Internal Sidebar (Glass Style) */}
            <div className="w-72 flex-shrink-0 flex flex-col border-r border-white/10 bg-slate-900/50 backdrop-blur-xl z-20 shadow-2xl">
                <div className="p-8 pb-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <FontAwesomeIcon icon={faDatabase} className="text-white text-lg" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Data Console</h1>
                            <p className="text-[11px] text-indigo-300 font-medium tracking-wider uppercase">Master Control</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-8 custom-scrollbar">
                    {COLLECTION_GROUPS.map((group) => (
                        <div key={group.groupName}>
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-2">
                                {group.groupName}
                            </h3>
                            <div className="space-y-1">
                                {group.collections.filter(c => !c.hidden).map(col => (
                                    <button
                                        key={col.id}
                                        onClick={() => setSelectedCollectionId(col.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group
                                            ${selectedCollectionId === col.id
                                                ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-900/50 ring-1 ring-white/20 translate-x-1'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 
                                            ${selectedCollectionId === col.id ? 'bg-white/20 text-white' : 'bg-slate-800/50 text-slate-500 group-hover:bg-slate-700 group-hover:text-indigo-400'}`}>
                                            <FontAwesomeIcon icon={col.icon} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <span className="block leading-none mb-0.5">{col.name.split('(')[0]}</span>
                                            <span className="text-[10px] opacity-50 font-light">{col.id}</span>
                                        </div>
                                        {selectedCollectionId === col.id && (
                                            <FontAwesomeIcon icon={faCheckCircle} className="text-indigo-300 text-xs" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-black/20 text-[10px] text-slate-600 text-center border-t border-white/5">
                    Authorized Personnel Only <br />
                    System Ver 3.0.0
                </div>
            </div>

            {/* 2. Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a] relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

                {/* Top Header & Stats */}
                <div className="z-10 px-8 py-6 pb-2">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
                                {currentCollection.name}
                                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-normal">
                                    {currentCollection.id}
                                </span>
                            </h2>
                            <p className="text-slate-400 text-sm max-w-2xl">{currentCollection.description}</p>
                        </div>
                        <div className="flex gap-3">
                            {/* Stats Cards */}
                            <div className="flex gap-4">
                                <div className="px-5 py-3 rounded-2xl bg-slate-800/50 border border-white/10 backdrop-blur-md flex flex-col items-center min-w-[100px]">
                                    <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">Total Docs</span>
                                    <span className="text-2xl font-black text-white">{stats.totalDocs.toLocaleString()}</span>
                                </div>
                                <div className="px-5 py-3 rounded-2xl bg-indigo-900/20 border border-indigo-500/20 backdrop-blur-md flex flex-col items-center min-w-[100px]">
                                    <span className="text-indigo-300 text-[10px] uppercase tracking-wider font-bold mb-1">Active</span>
                                    <span className="text-2xl font-black text-indigo-400">{stats.activeDocs.toLocaleString()}</span>
                                </div>
                                <div className="px-5 py-3 rounded-2xl bg-emerald-900/20 border border-emerald-500/20 backdrop-blur-md flex flex-col items-center min-w-[100px]">
                                    <span className="text-emerald-300 text-[10px] uppercase tracking-wider font-bold mb-1">Recent 24h</span>
                                    <span className="text-2xl font-black text-emerald-400">+{stats.recentDocs}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center gap-3">
                        <div className="relative group flex-1 max-w-md">
                            <input
                                type="text"
                                placeholder="Search database..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-xl text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-lg backdrop-blur-md"
                            />
                            <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                        </div>

                        <div className="h-8 w-px bg-white/10 mx-2"></div>

                        <button
                            onClick={fetchData}
                            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95 backdrop-blur-md shadow-lg"
                            title="Refresh Data"
                        >
                            <FontAwesomeIcon icon={faRefresh} spin={loading} />
                        </button>

                        <button
                            onClick={handleCreateClick}
                            className="h-11 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-900/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>New Document</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-8 pt-2 overflow-hidden flex flex-col">
                    <div
                        className="flex-1 rounded-2xl overflow-hidden relative shadow-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl ring-1 ring-white/5"
                    >
                        {loading && (
                            <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                                <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-indigo-500" />
                                <span className="text-sm font-bold text-slate-400">Loading secure data...</span>
                            </div>
                        )}

                        {/* Theme override wrapper */}
                        <div className="ag-theme-quartz-dark h-full w-full" style={{
                            '--ag-background-color': 'transparent',
                            '--ag-header-background-color': 'rgba(255, 255, 255, 0.03)',
                            '--ag-row-hover-color': 'rgba(99, 102, 241, 0.15)',
                            '--ag-header-foreground-color': '#94a3b8',
                            '--ag-foreground-color': '#f1f5f9',
                            '--ag-border-color': 'rgba(255, 255, 255, 0.05)',
                            '--ag-row-border-color': 'rgba(255, 255, 255, 0.03)',
                            '--ag-header-column-separator-display': 'block',
                            '--ag-header-column-separator-color': 'rgba(255, 255, 255, 0.1)',
                            '--ag-header-column-resize-handle-color': 'rgba(255, 255, 255, 0.3)',
                        } as any}>
                            <AgGridReact

                                rowData={rowData}
                                columnDefs={columnDefs}
                                onGridReady={onGridReady}
                                onCellValueChanged={onCellValueChanged}
                                defaultColDef={{
                                    sortable: true,
                                    filter: true,
                                    resizable: true,
                                    floatingFilter: true,
                                }}
                                pagination={true}
                                paginationPageSize={20}
                                paginationPageSizeSelector={[20, 50, 100]}
                                rowSelection="multiple"
                                animateRows={true}
                                headerHeight={52}
                                rowHeight={52}
                            />
                        </div>
                    </div>

                    <div className="mt-3 flex justify-between items-center text-xs text-slate-500 px-2 font-mono">
                        <span>Status: <span className="text-emerald-500">Connected</span></span>
                        <span>Time: {new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>

            {/* 3. JSON Editor Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-slate-900/5">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <FontAwesomeIcon icon={editMode === 'create' ? faPlus : faEdit} className={editMode === 'create' ? "text-indigo-600" : "text-amber-500"} />
                                    {editMode === 'create' ? 'Create New Document' : 'Edit Document'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Collection: <span className="font-bold text-indigo-600">{selectedCollectionId}</span>
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors">
                                <FontAwesomeIcon icon={faTimesCircle} size="lg" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 p-6 overflow-hidden flex flex-col gap-6">
                            {editMode === 'create' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Document ID (Optional)</label>
                                    <input
                                        type="text"
                                        value={currentDocId}
                                        onChange={(e) => setCurrentDocId(e.target.value)}
                                        placeholder="Leave empty for auto-generated ID"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1 pl-1">
                                        * 공백일 경우 Firestore가 자동으로 ID를 생성합니다.
                                    </p>
                                </div>
                            )}

                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-sm font-bold text-slate-700">JSON Data</label>
                                    {jsonError && (
                                        <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 font-bold animate-pulse">
                                            <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" />
                                            Invalid JSON Format
                                        </span>
                                    )}
                                </div>

                                <div className={`flex-1 border rounded-xl overflow-hidden flex flex-col relative transition-all duration-300 ${jsonError ? 'border-red-300 ring-4 ring-red-50' : 'border-slate-300 focus-within:ring-4 focus-within:ring-indigo-50 focus-within:border-indigo-400'}`}>
                                    <textarea
                                        value={jsonContent}
                                        onChange={(e) => {
                                            setJsonContent(e.target.value);
                                            try {
                                                JSON.parse(e.target.value);
                                                setJsonError(null);
                                            } catch (err: any) {
                                                setJsonError(err.message);
                                            }
                                        }}
                                        className="flex-1 w-full p-4 font-mono text-sm resize-none focus:outline-none leading-relaxed custom-scrollbar"
                                        spellCheck={false}
                                    />
                                    {/* Line Number Decoration could go here */}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-bold text-sm hover:bg-white hover:border-slate-400 transition-all shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!!jsonError}
                                className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 active:translate-y-0.5 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faSave} />
                                {editMode === 'create' ? 'Create Document' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataConsolePage;
