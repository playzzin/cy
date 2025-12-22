import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';
import { Team } from '../../services/teamService';
import { Worker } from '../../services/manpowerService';

interface BulkEditTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: Partial<Team>) => Promise<void>;
    selectedCount: number;
    workers: Worker[];
}

const BulkEditTeamModal: React.FC<BulkEditTeamModalProps> = ({ isOpen, onClose, onSave, selectedCount, workers }) => {
    const [updates, setUpdates] = useState<Partial<Team>>({});
    const [selectedFields, setSelectedFields] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleFieldToggle = (field: string) => {
        if (selectedFields.includes(field)) {
            setSelectedFields(selectedFields.filter(f => f !== field));
            const newUpdates = { ...updates };
            delete newUpdates[field as keyof Team];
            setUpdates(newUpdates);
        } else {
            setSelectedFields([...selectedFields, field]);
        }
    };

    const handleChange = (field: keyof Team, value: any) => {
        setUpdates(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (selectedFields.length === 0) {
            alert('수정할 항목을 하나 이상 선택해주세요.');
            return;
        }

        if (!window.confirm(`선택한 ${selectedCount}개의 팀 정보를 일괄 수정하시겠습니까?`)) return;

        setLoading(true);
        try {
            // Only send updates for selected fields
            const finalUpdates: Partial<Team> = {};
            selectedFields.forEach(field => {
                (finalUpdates as any)[field] = (updates as any)[field];
            });

            // If leader is selected, also update leaderName
            if (selectedFields.includes('leaderId') && updates.leaderId) {
                const leader = workers.find(w => w.id === updates.leaderId);
                if (leader) {
                    finalUpdates.leaderName = leader.name;
                }
            }

            await onSave(finalUpdates);
            onClose();
        } catch (error) {
            console.error("Bulk update failed:", error);
            alert("일괄 수정 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800">
                        팀 일괄 수정 ({selectedCount}개)
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-500 mb-4">
                        수정할 항목을 체크하고 새로운 값을 입력하세요.
                    </p>

                    {/* Team Type */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="chk-type"
                            checked={selectedFields.includes('type')}
                            onChange={() => handleFieldToggle('type')}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="chk-type" className="w-20 text-sm font-medium text-gray-700">팀 구분</label>
                        <select
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedFields.includes('type')}
                            value={updates.type || '작업팀'}
                            onChange={(e) => handleChange('type', e.target.value)}
                        >
                            <option value="작업팀">작업팀</option>
                            <option value="지원팀">지원팀</option>
                            <option value="용역팀">용역팀</option>
                            <option value="관리팀">관리팀</option>
                        </select>
                    </div>

                    {/* Company Name */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="chk-companyName"
                            checked={selectedFields.includes('companyName')}
                            onChange={() => handleFieldToggle('companyName')}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="chk-companyName" className="w-20 text-sm font-medium text-gray-700">회사명</label>
                        <input
                            type="text"
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedFields.includes('companyName')}
                            value={updates.companyName || ''}
                            onChange={(e) => handleChange('companyName', e.target.value)}
                            placeholder="회사명 입력"
                        />
                    </div>

                    {/* Leader */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="chk-leaderId"
                            checked={selectedFields.includes('leaderId')}
                            onChange={() => handleFieldToggle('leaderId')}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="chk-leaderId" className="w-20 text-sm font-medium text-gray-700">팀장</label>
                        <select
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedFields.includes('leaderId')}
                            value={updates.leaderId || ''}
                            onChange={(e) => handleChange('leaderId', e.target.value)}
                        >
                            <option value="">팀장 선택</option>
                            {workers.map(worker => (
                                <option key={worker.id} value={worker.id}>
                                    {worker.name} ({worker.role})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || selectedFields.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? '저장 중...' : (
                            <>
                                <FontAwesomeIcon icon={faCheck} />
                                일괄 적용
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkEditTeamModal;
