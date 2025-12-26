import React, { useState, useEffect } from 'react';
import { siteService, Site } from '../../services/siteService';
import { manpowerService } from '../../services/manpowerService';
import { Team } from '../../services/teamService';
import { Company } from '../../services/companyService';

interface SiteFormProps {
    initialData?: Partial<Site>;
    teams: Team[];
    companies: Company[];
    onSave: () => void;
    onCancel: () => void;
}

const SiteForm: React.FC<SiteFormProps> = ({ initialData, teams, companies, onSave, onCancel }) => {
    const [currentSite, setCurrentSite] = useState<Partial<Site>>(initialData || { status: 'active' });

    const handleSave = async () => {
        try {
            // Find team name
            const team = teams.find(t => t.id === currentSite.responsibleTeamId);
            // Find company name
            const company = companies.find(c => c.id === currentSite.companyId);

            const siteData = {
                ...currentSite,
                responsibleTeamName: team ? team.name : '',
                companyName: company ? company.name : ''
            };

            if (currentSite.id) {
                await siteService.updateSite(currentSite.id, siteData);

                // Sync Name Change
                if (initialData?.name && currentSite.name && initialData.name !== currentSite.name) {
                    await manpowerService.updateWorkersSiteName(currentSite.id, currentSite.name);
                }
            } else {
                await siteService.addSite(siteData as Site);
            }
            onSave();
        } catch (error) {
            console.error("Failed to save site", error);
            alert("저장에 실패했습니다.");
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">
                {currentSite.id ? '현장 수정' : '현장 등록'}
            </h2>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">현장명</label>
                        <input
                            type="text"
                            value={currentSite.name || ''}
                            onChange={(e) => setCurrentSite({ ...currentSite, name: e.target.value })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                            placeholder="현장명을 입력하세요"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">회사명</label>
                        <select
                            value={currentSite.companyId || ''}
                            onChange={(e) => setCurrentSite({ ...currentSite, companyId: e.target.value })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        >
                            <option value="">선택안함</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">담당팀</label>
                        <select
                            value={currentSite.responsibleTeamId || ''}
                            onChange={(e) => setCurrentSite({ ...currentSite, responsibleTeamId: e.target.value })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        >
                            <option value="">선택안함</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">현장코드</label>
                        <input
                            type="text"
                            value={currentSite.code || ''}
                            onChange={(e) => setCurrentSite({ ...currentSite, code: e.target.value })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">주소</label>
                        <input
                            type="text"
                            value={currentSite.address || ''}
                            onChange={(e) => setCurrentSite({ ...currentSite, address: e.target.value })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">상태</label>
                        <select
                            value={currentSite.status || 'active'}
                            onChange={(e) => setCurrentSite({ ...currentSite, status: e.target.value as any })}
                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border"
                        >
                            <option value="active">진행중</option>
                            <option value="planned">예정</option>
                            <option value="completed">완료</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-300 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition-colors"
                    >
                        {currentSite.id ? '수정 완료' : '등록 완료'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SiteForm;
