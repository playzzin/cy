import React, { useState, useEffect } from 'react';
import {
    faUserTag, faPlus, faTrash, faRotateLeft, faSearch, faSave, faCheck,
    faCrown, faUserTie, faUserShield, faHardHat, faUser, faUserPlus,
    faUserGear, faUserCog, faUserNurse, faUserSecret, faUserPen,
    faHelmetSafety, faPersonDigging, faWrench, faScrewdriverWrench,
    IconDefinition
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { positionService, Position } from '../../services/positionService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { UserRole } from '../../types/roles';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';

// 아이콘 맵핑 (문자열 → 실제 아이콘)
const ICON_MAP: Record<string, IconDefinition> = {
    faCrown,
    faUserTie,
    faUserShield,
    faHardHat,
    faUser,
    faUserPlus,
    faUserGear,
    faUserCog,
    faUserNurse,
    faUserSecret,
    faUserPen,
    faHelmetSafety,
    faPersonDigging,
    faWrench,
    faScrewdriverWrench,
};

// 선택 가능한 아이콘 목록
const ICONS = [
    { id: 'faCrown', icon: faCrown, label: '왕관' },
    { id: 'faUserTie', icon: faUserTie, label: '매니저' },
    { id: 'faUserShield', icon: faUserShield, label: '팀장' },
    { id: 'faHardHat', icon: faHardHat, label: '반장' },
    { id: 'faHelmetSafety', icon: faHelmetSafety, label: '안전모' },
    { id: 'faPersonDigging', icon: faPersonDigging, label: '작업자' },
    { id: 'faUser', icon: faUser, label: '일반' },
    { id: 'faUserPlus', icon: faUserPlus, label: '신규' },
    { id: 'faUserGear', icon: faUserGear, label: '기술자' },
    { id: 'faWrench', icon: faWrench, label: '기계' },
    { id: 'faScrewdriverWrench', icon: faScrewdriverWrench, label: '설비' },
];

const PositionManager: React.FC = () => {
    // State
    const [positions, setPositions] = useState<Position[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // New Position Form
    const [newPosName, setNewPosName] = useState('');
    const [newPosColor, setNewPosColor] = useState('gray');
    const [newPosIcon, setNewPosIcon] = useState('faUser');

    const COLORS = [
        { id: 'red', bg: 'bg-red-500' },
        { id: 'orange', bg: 'bg-orange-500' },
        { id: 'yellow', bg: 'bg-yellow-500' },
        { id: 'green', bg: 'bg-emerald-500' },
        { id: 'blue', bg: 'bg-blue-500' },
        { id: 'indigo', bg: 'bg-indigo-500' },
        { id: 'purple', bg: 'bg-purple-500' },
        { id: 'pink', bg: 'bg-pink-500' },
        { id: 'gray', bg: 'bg-slate-500' },
        { id: 'black', bg: 'bg-slate-900' },
    ];

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
                        const loaded = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Worker));
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

    // --- 2. Position Management ---
    const handleAddPosition = async () => {
        if (!newPosName.trim()) return;
        try {
            // Auto-determine System Role based on Name (Strict Rules)
            let sysRole = UserRole.GENERAL;
            if (newPosName === '관리자') sysRole = UserRole.ADMIN;
            else if (newPosName.includes('메니저') || newPosName.includes('매니저')) sysRole = UserRole.MANAGER;
            // '대표', '팀장' etc fall to GENERAL as requested

            const newRank = positions.length > 0 ? Math.max(...positions.map(p => p.rank)) + 1 : 1;

            await positionService.addPosition({
                name: newPosName,
                color: newPosColor,
                icon: newPosIcon,
                rank: newRank,
                systemRole: sysRole,
                isDefault: false
            });
            setNewPosName('');
            setNewPosIcon('faUser');
        } catch (error) {
            alert('직책 추가 실패');
        }
    };

    const handleDeletePosition = async (id: string, name: string) => {
        if (!window.confirm(`'${name}' 직책을 삭제하시겠습니까?`)) return;
        try {
            await positionService.deletePosition(id);
        } catch (error) {
            alert('삭제 실패');
        }
    };

    // 아이콘 수정 팝업 상태
    const [editingIconId, setEditingIconId] = useState<string | null>(null);

    // 아이콘 수정 핸들러 (Firebase에 저장)
    const handleIconChange = async (positionId: string, newIcon: string) => {
        try {
            await positionService.updatePosition(positionId, { icon: newIcon });
            setEditingIconId(null); // 팝업 닫기
        } catch (error) {
            console.error("아이콘 수정 실패:", error);
            alert('아이콘 수정 실패');
        }
    };

    const handleRestoreDefaults = async () => {
        if (!window.confirm('모든 직책을 초기화하고 기본값으로 복원하시겠습니까?')) return;
        try {
            await positionService.initializeDefaults();
        } catch (error) {
            alert('초기화 실패');
        }
    };

    // --- 3. Worker Assignment ---
    const handleWorkerPositionChange = async (workerId: string, positionName: string) => {
        try {
            // Find the full position object
            const targetPos = positions.find(p => p.name === positionName);
            if (!targetPos) return;

            // Update worker's role field
            await manpowerService.updateWorker(workerId, { role: positionName });

        } catch (error) {
            console.error("Change failed", error);
            alert("변경 실패");
        }
    };

    // Filtered Workers
    const filteredWorkers = workers.filter(w =>
        w.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.idNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-10 text-center"><FontAwesomeIcon icon={faRotateLeft} spin /> 로딩중...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <FontAwesomeIcon icon={faUserTag} />
                직책 관리 및 배정
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-150px)]">

                {/* --- Left: Position Definition --- */}
                <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h2 className="font-bold text-gray-700">1. 직책 정의</h2>
                        <button
                            onClick={handleRestoreDefaults}
                            className="text-xs text-slate-500 hover:text-blue-600 underline"
                        >
                            기본값 복원
                        </button>
                    </div>

                    {/* Add Form */}
                    <div className="p-4 border-b bg-white space-y-3">
                        <div className="text-xs text-gray-500 mb-1">새 직책 추가</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newPosName}
                                onChange={(e) => setNewPosName(e.target.value)}
                                placeholder="직책명 (예: 설비팀장)"
                                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button
                                onClick={handleAddPosition}
                                disabled={!newPosName}
                                className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                        </div>
                        {/* Color Picker */}
                        <div className="flex gap-1 flex-wrap mb-2">
                            {COLORS.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setNewPosColor(c.id)}
                                    className={`w-6 h-6 rounded-full ${c.bg} ${newPosColor === c.id ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'opacity-70 hover:opacity-100'}`}
                                />
                            ))}
                        </div>
                        {/* Icon Picker */}
                        <div className="flex gap-1 flex-wrap">
                            {ICONS.map(ic => (
                                <button
                                    key={ic.id}
                                    onClick={() => setNewPosIcon(ic.id)}
                                    title={ic.label}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${newPosIcon === ic.id
                                        ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-200 scale-110'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-gray-50'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={ic.icon} className="text-sm" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Position List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
                        {positions.map(pos => (
                            <div key={pos.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        {/* 아이콘 표시 (클릭하여 수정) */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setEditingIconId(editingIconId === pos.id ? null : pos.id!)}
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all ${COLORS.find(c => c.id === pos.color)?.bg || 'bg-gray-400'}`}
                                                title="클릭하여 아이콘 변경"
                                            >
                                                <FontAwesomeIcon
                                                    icon={ICON_MAP[pos.icon || 'faUser'] || faUser}
                                                    className="text-white text-lg"
                                                />
                                            </button>

                                            {/* 아이콘 선택 팝업 */}
                                            {editingIconId === pos.id && (
                                                <div className="absolute top-12 left-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 min-w-[200px]">
                                                    <div className="text-xs font-bold text-gray-500 mb-2">아이콘 선택</div>
                                                    <div className="grid grid-cols-4 gap-1">
                                                        {ICONS.map(ic => (
                                                            <button
                                                                key={ic.id}
                                                                onClick={() => handleIconChange(pos.id!, ic.id)}
                                                                title={ic.label}
                                                                className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${pos.icon === ic.id
                                                                    ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-200'
                                                                    : 'border-gray-200 text-gray-500 hover:border-blue-400 hover:bg-blue-50'
                                                                    }`}
                                                            >
                                                                <FontAwesomeIcon icon={ic.icon} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {/* 닫기 오버레이 */}
                                                    <div className="fixed inset-0 -z-10" onClick={() => setEditingIconId(null)}></div>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800">{pos.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {pos.systemRole === UserRole.ADMIN ? '관리자 권한' :
                                                    pos.systemRole === UserRole.MANAGER ? '매니저 권한' : '일반 권한'}
                                            </div>
                                        </div>
                                    </div>
                                    {!['관리자', '대표', '메니저'].some(fix => pos.name.startsWith(fix)) ? (
                                        <button
                                            onClick={() => handleDeletePosition(pos.id!, pos.name)}
                                            className="text-gray-300 hover:text-red-500 p-2"
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    ) : (
                                        <span className="text-[10px] text-gray-300 px-2">고정</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>


                {/* --- Right: Worker Assignment --- */}
                <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h2 className="font-bold text-gray-700">2. 작업자 배정</h2>
                        <div className="relative w-64">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="이름, 직책 검색..."
                                className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-full focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3">이름/주민번호</th>
                                    <th className="px-4 py-3">현재 직책</th>
                                    <th className="px-4 py-3">직책 변경 (자동저장)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredWorkers.map(worker => {
                                    const workerPosName = worker.role || '일반';
                                    const currentPos = positions.find(p => p.name === workerPosName);

                                    return (
                                        <tr key={worker.id} className="hover:bg-blue-50/30 transition-colors">
                                            {/* Worker Info */}
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-800">{worker.name || '이름 없음'}</div>
                                                <div className="text-xs text-gray-400">{worker.idNumber}</div>
                                            </td>

                                            {/* Current Badge */}
                                            <td className="px-4 py-3">
                                                <span className={`
                                                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                    ${currentPos
                                                        ? `${COLORS.find(c => c.id === currentPos.color)?.bg.replace('bg-', 'bg-').replace('500', '100')} ${COLORS.find(c => c.id === currentPos.color)?.bg.replace('bg-', 'text-').replace('500', '700')}`
                                                        : 'bg-gray-100 text-gray-800'}
                                                `}>
                                                    {workerPosName}
                                                </span>
                                            </td>

                                            {/* Dropdown */}
                                            <td className="px-4 py-3">
                                                <select
                                                    value={worker.role || '일반'}
                                                    onChange={(e) => handleWorkerPositionChange(worker.id!, e.target.value)}
                                                    className="w-full max-w-[180px] bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 cursor-pointer hover:border-blue-400 transition-colors"
                                                >
                                                    <optgroup label="설정된 직책 목록">
                                                        {positions.map(p => (
                                                            <option key={p.id} value={p.name}>
                                                                {p.name}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredWorkers.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-gray-400">
                                            검색 결과가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PositionManager;
