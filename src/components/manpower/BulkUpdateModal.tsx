import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTimes } from '@fortawesome/free-solid-svg-icons';
import { Worker } from '../../services/manpowerService';
import { Team } from '../../services/teamService';
import { Site } from '../../services/siteService';
import { Company } from '../../services/companyService';

interface BulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updates: Partial<Worker>) => void | Promise<void>;
    selectedCount: number;
    teams: Team[];
    sites: Site[];
    companies: Company[];
}

const payTypeOptions = ['일급제', '주급제', '월급제', '지원팀', '용역팀', '가지급'];
const teamTypeOptions = ['미배정', '보통', '협력팀'];
const statusOptions = ['재직', '퇴사', '미배정'];
const roleOptions = ['작업자', '팀장', '관리자'];

const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({
    isOpen,
    onClose,
    onUpdate,
    selectedCount,
    teams,
    sites,
    companies,
}) => {
    const [bulkUpdateData, setBulkUpdateData] = useState<Partial<Worker>>({});

    useEffect(() => {
        if (isOpen) {
            setBulkUpdateData({});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleTeamChange = (teamId: string) => {
        const team = teams.find((item) => item.id === teamId);
        setBulkUpdateData((prev) => ({
            ...prev,
            teamId,
            teamName: teamId ? (team?.name ?? '') : '',
            teamType: teamId ? (team?.type ?? prev.teamType ?? '') : prev.teamType,
        }));
    };

    const handleSiteChange = (siteId: string) => {
        const site = sites.find((item) => item.id === siteId);
        setBulkUpdateData((prev) => ({
            ...prev,
            siteId,
            siteName: siteId ? (site?.name ?? '') : '',
        }));
    };

    const handleCompanyChange = (companyId: string) => {
        const company = companies.find((item) => item.id === companyId);
        setBulkUpdateData((prev) => ({
            ...prev,
            companyId,
            companyName: companyId ? (company?.name ?? '') : '',
        }));
    };

    const handleSubmit = () => {
        onUpdate(bulkUpdateData);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                            <FontAwesomeIcon icon={faEdit} className="text-indigo-600" />
                            일괄 수정
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            선택한 <span className="font-semibold text-indigo-600">{selectedCount}명</span>의 정보를 한 번에 변경합니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="닫기"
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">급여 형태 변경</label>
                        <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={bulkUpdateData.payType || ''}
                            onChange={(e) => setBulkUpdateData((prev) => ({ ...prev, payType: e.target.value }))}
                        >
                            <option value="">변경 안함</option>
                            {payTypeOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">구분 변경</label>
                        <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={bulkUpdateData.salaryModel || ''}
                            onChange={(e) => setBulkUpdateData((prev) => ({ ...prev, salaryModel: e.target.value }))}
                        >
                            <option value="">변경 안함</option>
                            {payTypeOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">팀 변경</label>
                        <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={bulkUpdateData.teamId || ''}
                            onChange={(e) => handleTeamChange(e.target.value)}
                        >
                            <option value="">변경 안함</option>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name} {team.type ? `(${team.type})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">현장 변경</label>
                        <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={bulkUpdateData.siteId || ''}
                            onChange={(e) => handleSiteChange(e.target.value)}
                        >
                            <option value="">변경 안함</option>
                            {sites.map((site) => (
                                <option key={site.id} value={site.id}>
                                    {site.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">소속 회사 변경</label>
                        <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={bulkUpdateData.companyId || ''}
                            onChange={(e) => handleCompanyChange(e.target.value)}
                        >
                            <option value="">변경 안함</option>
                            {companies.map((company) => (
                                <option key={company.id} value={company.id}>
                                    {company.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">팀 유형 변경</label>
                        <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={bulkUpdateData.teamType || ''}
                            onChange={(e) => setBulkUpdateData((prev) => ({ ...prev, teamType: e.target.value }))}
                        >
                            <option value="">변경 안함</option>
                            {teamTypeOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">상태 변경</label>
                        <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={bulkUpdateData.status || ''}
                            onChange={(e) => setBulkUpdateData((prev) => ({ ...prev, status: e.target.value }))}
                        >
                            <option value="">변경 안함</option>
                            {statusOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">직책 변경</label>
                        <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={bulkUpdateData.role || ''}
                            onChange={(e) => setBulkUpdateData((prev) => ({ ...prev, role: e.target.value }))}
                        >
                            <option value="">변경 안함</option>
                            {roleOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">단가 변경</label>
                        <input
                            type="number"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="변경 안함"
                            value={bulkUpdateData.unitPrice ?? ''}
                            onChange={(e) =>
                                setBulkUpdateData((prev) => ({
                                    ...prev,
                                    unitPrice: e.target.value === '' ? undefined : Number(e.target.value),
                                }))
                            }
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">주소 변경</label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="변경 안함"
                            value={bulkUpdateData.address || ''}
                            onChange={(e) => setBulkUpdateData((prev) => ({ ...prev, address: e.target.value }))}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">은행명 변경</label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                placeholder="변경 안함"
                                value={bulkUpdateData.bankName || ''}
                                onChange={(e) => setBulkUpdateData((prev) => ({ ...prev, bankName: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">예금주 변경</label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                placeholder="변경 안함"
                                value={bulkUpdateData.accountHolder || ''}
                                onChange={(e) => setBulkUpdateData((prev) => ({ ...prev, accountHolder: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">계좌번호 변경</label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="변경 안함"
                            value={bulkUpdateData.accountNumber || ''}
                            onChange={(e) => setBulkUpdateData((prev) => ({ ...prev, accountNumber: e.target.value }))}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
                    >
                        일괄 수정
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkUpdateModal;
