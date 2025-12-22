import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faCheck } from '@fortawesome/free-solid-svg-icons';
import { confirm } from '../../utils/swal';
import { Team } from '../../services/teamService';
import { Worker } from '../../services/manpowerService';
import { Site } from '../../services/siteService';
import { Company } from '../../services/companyService';
import { Position } from '../../services/positionService';

interface BulkEditWorkerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: Partial<Worker>) => Promise<void>;
    selectedCount: number;
    teams: Team[];
    sites: Site[];
    companies: Company[];
    positions: Position[]; // 직책 데이터 추가
}

const BulkEditWorkerModal: React.FC<BulkEditWorkerModalProps> = ({ isOpen, onClose, onSave, selectedCount, teams, sites, companies, positions }) => {
    const [updates, setUpdates] = useState<Partial<Worker>>({});
    const [selectedFields, setSelectedFields] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleFieldToggle = (field: string) => {
        if (selectedFields.includes(field)) {
            setSelectedFields(selectedFields.filter(f => f !== field));
            const newUpdates = { ...updates };
            delete newUpdates[field as keyof Worker];
            if (field === 'teamId') delete newUpdates.teamName;
            if (field === 'siteId') delete newUpdates.siteName;
            if (field === 'companyId') delete newUpdates.companyName;
            setUpdates(newUpdates);
        } else {
            setSelectedFields([...selectedFields, field]);

            // Set default value immediately when checked to prevent undefined error
            let defaultValue: any = '';
            switch (field) {
                case 'status': defaultValue = 'active'; break;
                case 'role': defaultValue = '일반'; break;
                case 'salaryModel': defaultValue = '일급제'; break;
                case 'unitPrice': defaultValue = 0; break;
                case 'teamId':
                case 'siteId':
                case 'companyId': defaultValue = ''; break;
                default: defaultValue = '';
            }

            // Preserve existing value if for some reason it exists (though usually deleted on toggle off)
            setUpdates(prev => ({
                ...prev,
                [field]: (prev as any)[field] !== undefined ? (prev as any)[field] : defaultValue
            }));
        }
    };

    const handleChange = (field: keyof Worker, value: any) => {
        setUpdates(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (selectedFields.length === 0) {
            alert('수정할 항목을 하나 이상 선택해주세요.');
            return;
        }

        const result = await confirm.batch('작업자', selectedCount);
        if (!result.isConfirmed) return;

        setLoading(true);
        try {
            // Only send updates for selected fields
            const finalUpdates: Partial<Worker> = {};
            selectedFields.forEach(field => {
                (finalUpdates as any)[field] = (updates as any)[field];
            });

            // If team is selected, also update teamName
            if (selectedFields.includes('teamId') && updates.teamId) {
                const team = teams.find(t => t.id === updates.teamId);
                if (team) {
                    finalUpdates.teamName = team.name;
                }
            }

            // If site is selected, also update siteName
            if (selectedFields.includes('siteId') && updates.siteId) {
                const site = sites.find(s => s.id === updates.siteId);
                if (site) {
                    finalUpdates.siteName = site.name;
                }
            }

            // If company is selected, also update companyName
            if (selectedFields.includes('companyId') && updates.companyId) {
                const company = companies.find(c => c.id === updates.companyId);
                if (company) {
                    finalUpdates.companyName = company.name;
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <h3 className="text-lg font-bold text-gray-800">
                        작업자 일괄 수정 ({selectedCount}명)
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-500 mb-4">
                        수정할 항목을 체크하고 새로운 값을 입력하세요.
                    </p>

                    {/* Team */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="chk-team"
                            checked={selectedFields.includes('teamId')}
                            onChange={() => handleFieldToggle('teamId')}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="chk-team" className="w-20 text-sm font-medium text-gray-700">소속 팀</label>
                        <select
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedFields.includes('teamId')}
                            value={updates.teamId || ''}
                            onChange={(e) => handleChange('teamId', e.target.value)}
                        >
                            <option value="">팀 선택</option>
                            {teams.map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Site */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="chk-site"
                            checked={selectedFields.includes('siteId')}
                            onChange={() => handleFieldToggle('siteId')}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="chk-site" className="w-20 text-sm font-medium text-gray-700">현장</label>
                        <select
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedFields.includes('siteId')}
                            value={updates.siteId || ''}
                            onChange={(e) => handleChange('siteId', e.target.value)}
                        >
                            <option value="">현장 선택</option>
                            {sites.map(site => (
                                <option key={site.id} value={site.id}>{site.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Company */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="chk-company"
                            checked={selectedFields.includes('companyId')}
                            onChange={() => handleFieldToggle('companyId')}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="chk-company" className="w-20 text-sm font-medium text-gray-700">소속 회사</label>
                        <select
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedFields.includes('companyId')}
                            value={updates.companyId || ''}
                            onChange={(e) => handleChange('companyId', e.target.value)}
                        >
                            <option value="">회사 선택</option>
                            {companies.map(company => (
                                <option key={company.id} value={company.id}>{company.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Role */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="chk-role"
                            checked={selectedFields.includes('role')}
                            onChange={() => handleFieldToggle('role')}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="chk-role" className="w-20 text-sm font-medium text-gray-700">직책</label>
                        <select
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedFields.includes('role')}
                            value={updates.role || '일반'}
                            onChange={(e) => handleChange('role', e.target.value)}
                        >
                            {positions.length > 0 ? (
                                positions.map(pos => (
                                    <option key={pos.id} value={pos.name}>{pos.name}</option>
                                ))
                            ) : (
                                <>
                                    <option value="작업자">작업자</option>
                                    <option value="팀장">팀장</option>
                                    <option value="관리자">관리자</option>
                                </>
                            )}
                        </select>
                    </div>

                    {/* Salary Model */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="chk-salaryModel"
                            checked={selectedFields.includes('salaryModel')}
                            onChange={() => handleFieldToggle('salaryModel')}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="chk-salaryModel" className="w-20 text-sm font-medium text-gray-700">급여방식</label>
                        <select
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedFields.includes('salaryModel')}
                            value={updates.salaryModel || '일급제'}
                            onChange={(e) => handleChange('salaryModel', e.target.value)}
                        >
                            <option value="일급제">일급제</option>
                            <option value="주급제">주급제</option>
                            <option value="월급제">월급제</option>
                            <option value="지원팀">지원팀</option>
                            <option value="용역팀">용역팀</option>
                            <option value="가지급">가지급</option>
                        </select>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="chk-status"
                            checked={selectedFields.includes('status')}
                            onChange={() => handleFieldToggle('status')}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="chk-status" className="w-20 text-sm font-medium text-gray-700">상태</label>
                        <select
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedFields.includes('status')}
                            value={updates.status || 'active'}
                            onChange={(e) => handleChange('status', e.target.value)}
                        >
                            <option value="active">재직 (Active)</option>
                            <option value="inactive">퇴사 (Inactive)</option>
                            <option value="temporary">일용직</option>
                        </select>
                    </div>

                    {/* Unit Price */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="chk-unitPrice"
                            checked={selectedFields.includes('unitPrice')}
                            onChange={() => handleFieldToggle('unitPrice')}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        <label htmlFor="chk-unitPrice" className="w-20 text-sm font-medium text-gray-700">단가</label>
                        <input
                            type="number"
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedFields.includes('unitPrice')}
                            value={updates.unitPrice || 0}
                            onChange={(e) => handleChange('unitPrice', parseInt(e.target.value))}
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
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

export default BulkEditWorkerModal;
