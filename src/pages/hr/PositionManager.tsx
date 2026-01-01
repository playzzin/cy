import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveIcon } from '../../constants/iconMap';
import {
    faUserTag, faPlus, faTrash, faRotateLeft, faSearch, faSave, faCheck,
    faCrown, faUserTie, faUserShield, faHardHat, faUser, faUserPlus,
    faUserGear, faUserCog, faUserNurse, faUserSecret, faUserPen,
    faHelmetSafety, faPersonDigging, faWrench, faScrewdriverWrench,
    IconDefinition, faList, faEdit, faInfoCircle, faUsers
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { positionService, Position } from '../../services/positionService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { UserRole } from '../../types/roles';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import IconPicker from '../../pages/admin/menu/components/IconPicker';
import Swal from 'sweetalert2';

// ----------------------------------------------------------------------
// Constants & Types
// ----------------------------------------------------------------------

const COLORS = [
    { id: 'red', bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' },
    { id: 'orange', bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50' },
    { id: 'yellow', bg: 'bg-yellow-500', text: 'text-yellow-700', light: 'bg-yellow-50' },
    { id: 'green', bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50' },
    { id: 'blue', bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50' },
    { id: 'indigo', bg: 'bg-indigo-500', text: 'text-indigo-700', light: 'bg-indigo-50' },
    { id: 'purple', bg: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-50' },
    { id: 'pink', bg: 'bg-pink-500', text: 'text-pink-700', light: 'bg-pink-50' },
    { id: 'gray', bg: 'bg-slate-500', text: 'text-slate-700', light: 'bg-slate-50' },
    { id: 'black', bg: 'bg-slate-900', text: 'text-slate-900', light: 'bg-slate-100' },
];

const ROLES = [
    { id: UserRole.ADMIN, label: '관리자 (Admin)', desc: '시스템 전체 관리' },
    { id: UserRole.MANAGER, label: '매니저 (Manager)', desc: '현장/업무 관리자' },
    { id: UserRole.GENERAL, label: '일반 (General)', desc: '일반 사용자/작업자' },
];

// Helper to get color style safely
const getColorStyle = (colorId: string) => COLORS.find(c => c.id === colorId) || COLORS.find(c => c.id === 'gray')!;

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

const PositionManager: React.FC = () => {
    const navigate = useNavigate();

    // -- Data State --
    const [positions, setPositions] = useState<Position[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);

    // -- UI State --
    const [searchTerm, setSearchTerm] = useState('');
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

    // -- Form State --
    // "New Position" form
    const [newPosName, setNewPosName] = useState('');
    const [newPosColor, setNewPosColor] = useState('gray');
    const [newPosIcon, setNewPosIcon] = useState('faUser');
    const [newPosRole, setNewPosRole] = useState<UserRole>(UserRole.GENERAL);

    // "Edit Icon" context
    const [iconPickerTarget, setIconPickerTarget] = useState<'NEW' | 'EDIT_TEMP' | string | null>(null);

    // "Edit Position" Form State
    const [editPos, setEditPos] = useState<Position | null>(null);
    const [editPosName, setEditPosName] = useState('');
    const [editPosColor, setEditPosColor] = useState('');
    const [editPosIcon, setEditPosIcon] = useState('');

    // --- 1. Load Data ---
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Subscribe to Positions
                const unsubPos = onSnapshot(
                    query(collection(db, 'positions'), orderBy('rank', 'asc')),
                    (snapshot) => {
                        const loaded = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Position));
                        setPositions(loaded);
                    }
                );

                // Subscribe to Workers
                const unsubWorkers = onSnapshot(
                    query(collection(db, 'workers'), orderBy('name', 'asc')),
                    (snapshot) => {
                        const loaded = snapshot.docs
                            .map(d => ({ id: d.id, ...d.data() } as Worker))
                            .filter(w => w.status !== '퇴사'); // Exclude retired workers
                        setWorkers(loaded);
                        setLoading(false);
                    }
                );

                return () => {
                    unsubPos();
                    unsubWorkers();
                };
            } catch (err) {
                console.error(err);
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // --- 1.5 Auto-Sync Menu with Positions ---
    useEffect(() => {
        if (positions.length > 0) {
            // Filter valid positions with IDs for sync
            const validPositions = positions
                .filter(p => p.id)
                .map(p => ({
                    id: p.id!,
                    name: p.name,
                    rank: p.rank,
                    color: p.color,
                    icon: p.icon,
                    iconKey: p.iconKey
                }));

            menuServiceV11.syncWithPositions(validPositions).catch(err =>
                console.error("Failed to sync menu with positions:", err)
            );
        }
    }, [positions]);

    // --- 2. Actions ---

    const handleAddPosition = async () => {
        if (!newPosName.trim()) return;
        try {
            const newRank = positions.length > 0 ? Math.max(...positions.map(p => p.rank)) + 1 : 1;

            await positionService.addPosition({
                name: newPosName,
                color: newPosColor,
                icon: newPosIcon,
                rank: newRank,
                systemRole: newPosRole,
                isDefault: false
            });
            // Reset Form
            setNewPosName('');
            setNewPosIcon('faUser');
            setNewPosColor('gray');
            setNewPosRole(UserRole.GENERAL);

            Swal.fire({
                icon: 'success',
                title: '직책 추가됨',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });
        } catch (error) {
            Swal.fire('오류', '직책 추가에 실패했습니다.', 'error');
        }
    };

    const handleDeletePosition = async (id: string, name: string) => {
        const assignedCount = workers.filter(w => w.role === name).length;
        if (assignedCount > 0) {
            Swal.fire('삭제 불가', `현재 ${assignedCount}명의 작업자가 이 직책을 가지고 있습니다.\\n배정을 해제한 후 삭제해주세요.`, 'warning');
            return;
        }

        const result = await Swal.fire({
            title: `'${name}' 삭제`,
            text: "이 직책을 삭제하시겠습니까?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });

        if (result.isConfirmed) {
            try {
                await positionService.deletePosition(id);
                Swal.fire({ icon: 'success', title: '삭제됨', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
            } catch (error) {
                Swal.fire('오류', '삭제 실패', 'error');
            }
        }
    };

    // Update Icon
    const handleIconSelect = async (iconName: string) => {
        if (iconPickerTarget === 'NEW') {
            setNewPosIcon(iconName);
        } else if (iconPickerTarget === 'EDIT_TEMP') {
            setEditPosIcon(iconName);
        } else if (iconPickerTarget) {
            // Update existing position (Direct Icon Edit from List)
            try {
                await positionService.updatePosition(iconPickerTarget, { icon: iconName });
            } catch (error) {
                console.error("아이콘 수정 실패:", error);
                Swal.fire('오류', '아이콘 수정 실패', 'error');
            }
        }
        setIsIconPickerOpen(false);
        setIconPickerTarget(null);
    };

    // Update Role
    const handleRoleChange = async (positionId: string, newRole: UserRole) => {
        try {
            await positionService.updatePosition(positionId, { systemRole: newRole });
        } catch (error) {
            Swal.fire('오류', '권한 수정 실패', 'error');
        }
    };

    const handleRestoreDefaults = async () => {
        const result = await Swal.fire({
            title: '기본값 복원',
            text: "모든 직책 설정이 초기화됩니다. 계속하시겠습니까?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '복원'
        });
        if (result.isConfirmed) {
            try {
                await positionService.initializeDefaults();
                Swal.fire('완료', '초기화되었습니다.', 'success');
            } catch (error) {
                Swal.fire('오류', '초기화 실패', 'error');
            }
        }
    };

    // --- 3. Edit Position (Open Modal) ---
    const handleEditPosition = (pos: Position) => {
        setEditPos(pos);
        setEditPosName(pos.name);
        setEditPosColor(pos.color);
        setEditPosIcon(pos.icon || 'faUser');
    };

    const handleSaveEditPosition = async () => {
        if (!editPos) return;
        if (!editPosName.trim()) {
            Swal.fire('오류', '직책 이름을 입력해주세요.', 'warning');
            return;
        }

        try {
            // 1. Update Name (Integrated Sync)
            if (editPosName !== editPos.name) {
                await positionService.updatePositionNameWithSync(editPos.id!, editPos.name, editPosName);
            }

            // 2. Update Color
            if (editPosColor !== editPos.color) {
                await positionService.updatePositionColor(editPos.id!, editPosColor);
            }

            // 3. Update Icon (Check if changed)
            if (editPosIcon !== editPos.icon) {
                await positionService.updatePosition(editPos.id!, { icon: editPosIcon });
            }

            Swal.fire({ icon: 'success', title: '수정 완료', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
            setEditPos(null); // Close modal
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '수정 중 문제가 발생했습니다.', 'error');
        }
    };

    // --- 4. Worker Assignment Actions ---
    const handleWorkerPositionChange = async (workerId: string, positionName: string) => {
        try {
            // Find full position to verify? Not strictly needed if we trust the name.
            await manpowerService.updateWorker(workerId, { role: positionName });
        } catch (error) {
            console.error("Change failed", error);
            Swal.fire('오류', '직책 변경 실패', 'error');
        }
    };

    // --- Render Helpers ---

    const filteredWorkers = workers.filter(w =>
        w.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.idNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openIconPicker = (target: 'NEW' | string) => {
        setIconPickerTarget(target);
        setIsIconPickerOpen(true);
    };

    if (loading) return <div className="p-10 text-center"><FontAwesomeIcon icon={faRotateLeft} spin /> 로딩중...</div>;

    return (
        <div className="space-y-6">
            {/* --- Header --- */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                        <FontAwesomeIcon icon={faUserTag} />
                    </div>
                    <div>
                        <span>직책 및 권한 관리</span>
                        <p className="text-xs text-gray-500 font-normal mt-1">
                            현장 조직도에 사용될 직책을 정의하고 작업자에게 배정합니다.
                        </p>
                    </div>
                </h1>
                <button
                    onClick={handleRestoreDefaults}
                    className="text-sm px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faRotateLeft} />
                    기본값 복원
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-200px)] min-h-[600px]">

                {/* --- Left: Position Definition (4 cols) --- */}
                <div className="xl:col-span-4 flex flex-col gap-4 h-full overflow-hidden">

                    {/* Add New Position Card */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4 flex-shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faPlus} className="text-blue-500" />
                            새 직책 등록
                        </h3>

                        <div className="flex gap-3">
                            <div className="flex-1 space-y-3">
                                <input
                                    type="text"
                                    value={newPosName}
                                    onChange={(e) => setNewPosName(e.target.value)}
                                    placeholder="직책명 (예: 설비팀장)"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                <div className="flex gap-2">
                                    <select
                                        value={newPosRole}
                                        onChange={(e) => setNewPosRole(e.target.value as UserRole)}
                                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                        {ROLES.map(r => (
                                            <option key={r.id} value={r.id}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Icon & Color Preview */}
                            <div className="flex flex-col gap-2 items-center">
                                <button
                                    onClick={() => openIconPicker('NEW')}
                                    className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 transition-all cursor-pointer shadow-sm hover:shadow-md
                                        ${getColorStyle(newPosColor).bg} text-white border-transparent
                                    `}
                                    title="아이콘 선택"
                                >
                                    <FontAwesomeIcon icon={resolveIcon(newPosIcon, faUser)} size="lg" />
                                </button>
                                <div className="flex gap-1 justify-center w-full max-w-[60px] flex-wrap">
                                    {COLORS.slice(0, 5).map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setNewPosColor(c.id)}
                                            className={`w-3 h-3 rounded-full ${c.bg} ${newPosColor === c.id ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-40'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleAddPosition}
                            disabled={!newPosName}
                            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200"
                        >
                            직책 추가하기
                        </button>
                    </div>

                    {/* Position List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-700">등록된 직책 목록 ({positions.length})</h3>
                        </div>
                        <div className="overflow-y-auto p-3 space-y-3 custom-scrollbar flex-1">
                            {positions.map(pos => {
                                const style = getColorStyle(pos.color);
                                const memberCount = workers.filter(w => w.role === pos.name).length;

                                return (
                                    <div key={pos.id} className="group bg-white p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3">
                                            {/* Icon */}
                                            <button
                                                onClick={() => openIconPicker(pos.id!)}
                                                className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center ${style.bg} text-white shadow-sm transition-transform hover:scale-105 active:scale-95`}
                                                title="아이콘 변경"
                                            >
                                                <FontAwesomeIcon icon={resolveIcon(pos.icon, faUser)} size="lg" />
                                            </button>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-bold text-gray-800 truncate">{pos.name}</span>
                                                    {/* Member Count Badge */}
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${memberCount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                        <FontAwesomeIcon icon={faUsers} className="text-[9px]" />
                                                        {memberCount}
                                                    </span>
                                                </div>

                                                {/* Role Selector (Inline) */}
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={pos.systemRole}
                                                        onChange={(e) => handleRoleChange(pos.id!, e.target.value as UserRole)}
                                                        className="text-xs text-gray-500 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-blue-600 font-medium"
                                                    >
                                                        {ROLES.map(r => (
                                                            <option key={r.id} value={r.id}>{r.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEditPosition(pos)}
                                                    className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-blue-600 flex items-center justify-center transition-colors"
                                                    title="직책명/색상 수정"
                                                >
                                                    <FontAwesomeIcon icon={faEdit} />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/admin/menu-manager?site=${pos.id!.startsWith('pos_') ? pos.id : `pos_${pos.id}`}`)}
                                                    className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-blue-600 flex items-center justify-center transition-colors"
                                                    title="메뉴 설정"
                                                >
                                                    <FontAwesomeIcon icon={faList} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePosition(pos.id!, pos.name)}
                                                    className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                                                    title="삭제"
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* --- Right: Worker Assignment (8 cols) --- */}
                <div className="xl:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
                    <div className="p-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-gray-800 text-lg">작업자 직책 배정</h2>
                            <span className="text-xs px-2 py-1 bg-white border border-gray-200 rounded-md text-gray-500">
                                총 {workers.length}명
                            </span>
                        </div>

                        <div className="relative w-full sm:w-72">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="작업자 이름, 직책 검색..."
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 w-[250px]">작업자 정보</th>
                                    <th className="px-6 py-4 w-[150px]">현재 직책 명찰</th>
                                    <th className="px-6 py-4">직책 변경 (즉시 반영)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredWorkers.map(worker => {
                                    const workerPosName = worker.role || '일반';
                                    const currentPos = positions.find(p => p.name === workerPosName);
                                    const style = currentPos ? getColorStyle(currentPos.color) : getColorStyle('gray');

                                    return (
                                        <tr key={worker.id} className="hover:bg-blue-50/20 transition-colors group">
                                            {/* Worker Info */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold border border-slate-200">
                                                        {worker.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-800">{worker.name || '이름 없음'}</div>
                                                        <div className="text-xs text-gray-400 font-mono mt-0.5">{worker.idNumber}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Current Badge */}
                                            <td className="px-6 py-4">
                                                <span className={`
                                                    inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-transparent
                                                    ${style.light} ${style.text}
                                                `}>
                                                    {currentPos && <FontAwesomeIcon icon={resolveIcon(currentPos.icon, faUser)} className="mr-1.5" />}
                                                    {workerPosName}
                                                </span>
                                            </td>

                                            {/* Dropdown */}
                                            <td className="px-6 py-4">
                                                <div className="relative w-full max-w-[200px]">
                                                    <select
                                                        value={worker.role || '일반'}
                                                        onChange={(e) => handleWorkerPositionChange(worker.id!, e.target.value)}
                                                        className="w-full appearance-none bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-4 py-2.5 cursor-pointer hover:border-blue-400 transition-colors shadow-sm"
                                                    >
                                                        <optgroup label="직책 선택">
                                                            {positions.map(p => (
                                                                <option key={p.id} value={p.name}>
                                                                    {p.name} ({p.systemRole === UserRole.ADMIN ? '관리자' : p.systemRole === UserRole.MANAGER ? '매니저' : '일반'})
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    </select>
                                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                                                        <FontAwesomeIcon icon={faUserPen} />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredWorkers.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
                                                <FontAwesomeIcon icon={faSearch} size="2x" />
                                            </div>
                                            검색 결과가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* --- Edit Modal --- */}
            {editPos && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scaleUp">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">직책 수정</h3>
                            <button onClick={() => setEditPos(null)} className="text-gray-400 hover:text-gray-600">
                                <FontAwesomeIcon icon={faPlus} className="rotate-45" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Icon & Name Row */}
                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        setIconPickerTarget('EDIT_TEMP');
                                        setIsIconPickerOpen(true);
                                    }}
                                    className={`w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center border-2 transition-all cursor-pointer shadow-sm hover:shadow-md
                                        ${getColorStyle(editPosColor).bg} text-white border-transparent relative group
                                    `}
                                >
                                    <FontAwesomeIcon icon={resolveIcon(editPosIcon, faUser)} size="lg" />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-xl flex items-center justify-center transition-all">
                                        <FontAwesomeIcon icon={faEdit} className="text-white opacity-0 group-hover:opacity-100" />
                                    </div>
                                </button>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">직책 이름</label>
                                    <input
                                        type="text"
                                        value={editPosName}
                                        onChange={(e) => setEditPosName(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="직책명"
                                    />
                                </div>
                            </div>

                            {/* Color Picker */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-2 block">색상 선택</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLORS.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setEditPosColor(c.id)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                                                ${c.bg} ${editPosColor === c.id ? 'ring-2 ring-offset-2 ring-blue-500 scale-110 shadow-sm' : 'hover:scale-105 opacity-70 hover:opacity-100'}
                                            `}
                                        >
                                            {editPosColor === c.id && <FontAwesomeIcon icon={faCheck} className="text-white text-xs" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-orange-50 text-orange-600 text-xs p-3 rounded-lg flex gap-2 items-start">
                                <FontAwesomeIcon icon={faInfoCircle} className="mt-0.5" />
                                <p>직책 이름을 변경하면, 해당 직책을 배정받은 모든 작업자의 명찰도 자동으로 업데이트됩니다.</p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2 justify-end">
                            <button
                                onClick={() => setEditPos(null)}
                                className="px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-200 font-bold text-sm transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveEditPosition}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm shadow-md transition-colors"
                            >
                                저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Icon Picker Modal --- */}
            <IconPicker
                isOpen={isIconPickerOpen}
                onClose={() => setIsIconPickerOpen(false)}
                onSelect={handleIconSelect}
                currentIcon={iconPickerTarget === 'NEW' ? newPosIcon : iconPickerTarget === 'EDIT_TEMP' ? editPosIcon : positions.find(p => p.id === iconPickerTarget)?.icon}
            />

        </div>
    );
};

export default PositionManager;
