import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit } from '@fortawesome/free-solid-svg-icons';
import { Worker } from '../../services/manpowerService';
import { Team } from '../../services/teamService';
import { Site } from '../../services/siteService';
import { Company } from '../../services/companyService';

interface BulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updates: Partial<Worker>) => Promise<void>;
    selectedCount: number;
    teams: Team[];
    sites: Site[];
    companies: Company[];
}

const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({
    isOpen,
    onClose,
    onUpdate,
    selectedCount,
    teams,
    sites,
    companies
}) => {
    const [bulkUpdateData, setBulkUpdateData] = useState<Partial<Worker>>({});

    useEffect(() => {
        if (isOpen) {
            setBulkUpdateData({});
        }
    }, [isOpen]);

    const handleUpdate = () => {
        onUpdate(bulkUpdateData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faEdit} className="text-indigo-600" /> 일괄 수정
                </h2>
                <p className="text-sm text-slate-500 mb-4">
                    선택한 <span className="font-bold text-indigo-600">{selectedCount}명</span>의 정보를 일괄 수정합니다.
                </p>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">팀 변경</label>
                        <select
                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border appearance-none bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat"
                            value={bulkUpdateData.teamId || ''}
                            onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, teamId: e.target.value })}
                        >
                            <option value="">변경 안함</option>
                            {teams.map(team => (
                                <option key={team.id} value={team.id}>
                                    {team.name} ({team.type})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">현장 변경</label>
                        <select
                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border appearance-none bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat"
                            value={bulkUpdateData.siteId || ''}
                            onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, siteId: e.target.value })}
                        >
                            <option value="">변경 안함</option>
                            {sites.map(site => (
                                <option key={site.id} value={site.id}>
                                    {site.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">소속 회사 변경</label>
                        <select
                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border appearance-none bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat"
                            value={bulkUpdateData.companyId || ''}
                            onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, companyId: e.target.value })}
                        >
                            <option value="">변경 안함</option>
                            {companies.map(company => (
                                <option key={company.id} value={company.id}>
                                    {company.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">팀 유형 변경</label>
                        <select
                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border appearance-none bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat"
                            value={bulkUpdateData.teamType || ''}
                            onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, teamType: e.target.value })}
                        >
                            <option value="">변경 안함</option>
                            <option value="미배정">미배정</option>
                            <option value="본팀">본팀</option>
                            <option value="새끼팀">새끼팀</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">급여 형태 변경</label>
                        <select
                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border appearance-none bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat"
                            value={bulkUpdateData.salaryModel || ''}
                            onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, salaryModel: e.target.value })}
                        >
                            <option value="">변경 안함</option>
                            <option value="일급제">일급제</option>
                            <option value="주급제">주급제</option>
                            <option value="월급제">월급제</option>
                            <option value="지원팀">지원팀</option>
                            <option value="용역팀">용역팀</option>
                            <option value="가지급">가지급</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">상태 변경</label>
                        <select
                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border appearance-none bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat"
                            value={bulkUpdateData.status || ''}
                            onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, status: e.target.value })}
                        >
                            <option value="">변경 안함</option>
                            <option value="재직">재직</option>
                            <option value="퇴사">퇴사</option>
                            <option value="미배정">미배정</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">직책 변경</label>
                        <select
                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border appearance-none bg-white bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat"
                            value={bulkUpdateData.role || ''}
                            onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, role: e.target.value })}
                        >
                            <option value="">변경 안함</option>
                            <option value="작업자">작업자</option>
                            <option value="팀장">팀장</option>
                            <option value="관리자">관리자</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">단가 변경</label>
                        <input
                            type="number"
                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border"
                            placeholder="변경 안함"
                            value={bulkUpdateData.unitPrice || ''}
                            onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, unitPrice: parseInt(e.target.value) || 0 })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">주소 변경</label>
                        <input
                            type="text"
                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border"
                            placeholder="변경 안함"
                            value={bulkUpdateData.address || ''}
                            onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, address: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">은행명 변경</label>
                            <input
                                type="text"
                                className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border"
                                placeholder="변경 안함"
                                value={bulkUpdateData.bankName || ''}
                                onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, bankName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">예금주 변경</label>
                            <input
                                type="text"
                                className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border"
                                placeholder="변경 안함"
                                value={bulkUpdateData.accountHolder || ''}
                                onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, accountHolder: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">계좌번호 변경</label>
                        <input
                            type="text"
                            className="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2.5 border"
                            placeholder="변경 안함"
                            value={bulkUpdateData.accountNumber || ''}
                            onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, accountNumber: e.target.value })}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">취소</button>
                    <button onClick={handleUpdate} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700">일괄 수정</button>
                </div>
            </div>
        </div>
    );
};

export default BulkUpdateModal;
