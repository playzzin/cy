import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faEdit, faUserShield, faUserGear, faUser, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { positionService, Position } from '../../services/positionService';
import { UserRole } from '../../types/roles';

const COLORS = [
    { name: 'Red', value: 'red', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    { name: 'Orange', value: 'orange', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    { name: 'Green', value: 'green', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    { name: 'Blue', value: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    { name: 'Indigo', value: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    { name: 'Purple', value: 'purple', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    { name: 'Gray', value: 'gray', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
    { name: 'Slate', value: 'slate', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
];

const PositionDefinition: React.FC = () => {
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<Position | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Position>>({
        name: '',
        rank: 100,
        color: 'gray',
        description: '',
        systemRole: UserRole.GENERAL
    });

    useEffect(() => {
        fetchPositions();
    }, []);

    const fetchPositions = async () => {
        setLoading(true);
        try {
            const data = await positionService.getPositions();
            setPositions(data);
        } catch (error) {
            console.error("Failed to fetch positions", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (position?: Position) => {
        if (position) {
            setEditingPosition(position);
            setFormData(position);
        } else {
            setEditingPosition(null);
            setFormData({
                name: '',
                rank: positions.length > 0 ? Math.max(...positions.map(p => p.rank)) + 1 : 1,
                color: 'gray',
                description: '',
                systemRole: UserRole.GENERAL
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPosition(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        try {
            if (editingPosition && editingPosition.id) {
                await positionService.updatePosition(editingPosition.id, formData);
            } else {
                await positionService.addPosition(formData as Omit<Position, 'id'>);
            }
            await fetchPositions();
            handleCloseModal();
        } catch (error) {
            console.error("Failed to save position", error);
            alert("저장에 실패했습니다.");
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`'${name}' 직책을 삭제하시겠습니까?`)) {
            try {
                await positionService.deletePosition(id);
                await fetchPositions();
            } catch (error) {
                console.error("Failed to delete position", error);
                alert("삭제에 실패했습니다.");
            }
        }
    };

    const handleResetDefaults = async () => {
        if (window.confirm("초기화 시 기존 직책이 중복될 수 있으며, 기본값(관리자, 대표, 메니저 등)이 다시 생성됩니다. 계속하시겠습니까?")) {
            setLoading(true);
            try {
                await positionService.initializeDefaults();
                await fetchPositions();
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
    }

    const getRoleBadge = (role: UserRole) => {
        switch (role) {
            case UserRole.ADMIN:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                        <FontAwesomeIcon icon={faUserShield} className="text-[10px]" />
                        관리자
                    </span>
                );
            case UserRole.MANAGER:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                        <FontAwesomeIcon icon={faUserGear} className="text-[10px]" />
                        매니저
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        <FontAwesomeIcon icon={faUser} className="text-[10px]" />
                        일반
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <FontAwesomeIcon icon={faUserGear} size="lg" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">직책 정의 및 권한 설정</h3>
                        <p className="text-xs text-slate-500">시스템에서 사용할 직책과 해당 직책의 시스템 권한 등급을 설정합니다.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleResetDefaults}
                        className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                    >
                        기본값 복원
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        직책 추가
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-3 border-b border-slate-200 w-20 text-center">서열</th>
                            <th className="px-6 py-3 border-b border-slate-200">직책명</th>
                            <th className="px-6 py-3 border-b border-slate-200">시스템 권한</th>
                            <th className="px-6 py-3 border-b border-slate-200">UI 색상</th>
                            <th className="px-6 py-3 border-b border-slate-200">설명</th>
                            <th className="px-6 py-3 border-b border-slate-200 w-32 text-center">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                    데이터를 불러오는 중...
                                </td>
                            </tr>
                        ) : positions.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                    등록된 직책이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            positions.map((pos) => (
                                <tr key={pos.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 text-center font-mono text-slate-400">
                                        {pos.rank}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{pos.name}</div>
                                        {pos.isDefault && (
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-2">기본</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getRoleBadge(pos.systemRole || UserRole.GENERAL)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-md bg-${pos.color}-50 text-${pos.color}-700 border border-${pos.color}-200 text-xs font-medium`}>
                                            <div className={`w-3 h-3 rounded-full bg-${pos.color}-500`}></div>
                                            {pos.color.toUpperCase()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {pos.description || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(pos)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                title="수정"
                                            >
                                                <FontAwesomeIcon icon={faEdit} />
                                            </button>
                                            {!pos.isDefault && (
                                                <button
                                                    onClick={() => handleDelete(pos.id!, pos.name)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="삭제"
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <FontAwesomeIcon icon={editingPosition ? faEdit : faPlus} className="text-indigo-600" />
                            {editingPosition ? '직책 수정' : '새 직책 추가'}
                        </h2>

                        <form onSubmit={handleSave}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">직책명 <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border"
                                        placeholder="예: 안전관리자"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">시스템 권한 <span className="text-red-500">*</span></label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, systemRole: UserRole.ADMIN })}
                                            className={`p-2 rounded-lg border text-sm flex flex-col items-center justify-center gap-1 transition-all ${formData.systemRole === UserRole.ADMIN ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <FontAwesomeIcon icon={faUserShield} />
                                            <span className="font-bold">관리자</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, systemRole: UserRole.MANAGER })}
                                            className={`p-2 rounded-lg border text-sm flex flex-col items-center justify-center gap-1 transition-all ${formData.systemRole === UserRole.MANAGER ? 'bg-orange-50 border-orange-500 text-orange-700 ring-1 ring-orange-500' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <FontAwesomeIcon icon={faUserGear} />
                                            <span className="font-bold">매니저</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, systemRole: UserRole.GENERAL })}
                                            className={`p-2 rounded-lg border text-sm flex flex-col items-center justify-center gap-1 transition-all ${formData.systemRole === UserRole.GENERAL ? 'bg-slate-100 border-slate-400 text-slate-700 ring-1 ring-slate-400' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <FontAwesomeIcon icon={faUser} />
                                            <span className="font-bold">일반</span>
                                        </button>
                                    </div>
                                    <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100 flex gap-2">
                                        <FontAwesomeIcon icon={faExclamationTriangle} className="mt-0.5" />
                                        <span>
                                            <strong>주의:</strong> 관리자는 모든 권한을 가집니다. '매니저' 직책만 매니저 권한을 부여하고, 대표/팀장/반장은 '일반' 권한을 권장합니다.
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">서열 (Rank)</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={formData.rank}
                                            onChange={(e) => setFormData({ ...formData, rank: parseFloat(e.target.value) || 0 })}
                                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border"
                                        />
                                        <span className="text-xs text-slate-500 whitespace-nowrap">낮을수록 높음 (1=대표)</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">색상 테마</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {COLORS.map(color => (
                                            <button
                                                key={color.value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color: color.value })}
                                                className={`
                                                    w-full aspect-square rounded-lg border-2 flex items-center justify-center transition-all
                                                    ${formData.color === color.value ? `border-${color.value}-500 ring-2 ring-${color.value}-200` : 'border-transparent hover:scale-105'}
                                                    ${color.bg}
                                                `}
                                                title={color.name}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-${color.value}-500`}></div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">설명</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border h-20 resize-none"
                                        placeholder="직책에 대한 간단한 설명"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md"
                                >
                                    저장
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PositionDefinition;
