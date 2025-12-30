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

    // Auto-select company based on team selection
    useEffect(() => {
        if (!currentSite.responsibleTeamId) return;

        const team = teams.find(t => t.id === currentSite.responsibleTeamId);
        if (!team || !team.companyId) return;

        const teamCompany = companies.find(c => c.id === team.companyId);
        if (!teamCompany) return;

        // If team belongs to a Partner (협력사)
        if (teamCompany.type === '협력사') {
            setCurrentSite(prev => ({
                ...prev,
                partnerId: teamCompany.id,
                companyId: '', // Reset Constructor
                clientCompanyId: '' // Partners do not select Client
            }));
        }
        // Otherwise, assume the team belongs to the Main Constructor (시공사)
        else {
            setCurrentSite(prev => ({
                ...prev,
                companyId: teamCompany.id,
                partnerId: '' // Reset Partner
            }));
        }
    }, [currentSite.responsibleTeamId, teams, companies]);

    // ... (rest of code) ...

    {/* Client (발주사) */ }
    <div className="md:col-span-2 bg-white p-4 rounded-lg border border-slate-200">
        <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
            <span>발주사 (Client)</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">건설사</span>
        </label>
        <select
            value={currentSite.clientCompanyId || ''}
            onChange={(e) => setCurrentSite({ ...currentSite, clientCompanyId: e.target.value })}
            disabled={(() => {
                const team = teams.find(t => t.id === currentSite.responsibleTeamId);
                const company = team?.companyId ? companies.find(c => c.id === team.companyId) : null;
                return company?.type === '협력사';
            })()}
            className={`w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm py-2 px-3 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
        >
            <option value="">선택안함 {(() => {
                const team = teams.find(t => t.id === currentSite.responsibleTeamId);
                const company = team?.companyId ? companies.find(c => c.id === team.companyId) : null;
                return company?.type === '협력사' ? '(협력사는 선택 불가)' : '';
            })()}</option>
            {companies
                .filter(c => c.type === '건설사')
                .map(c => (
                    <option key={c.id} value={c.id}>🏗️ {c.name}</option>
                ))
            }
        </select>
    </div>

    const handleSave = async () => {
        try {
            if (!currentSite.name) {
                alert("현장명은 필수입니다.");
                return;
            }

            // Find team name
            const team = teams.find(t => t.id === currentSite.responsibleTeamId);

            // Find company names
            const constructor = companies.find(c => c.id === currentSite.companyId); // companyId is Constructor
            const client = companies.find(c => c.id === currentSite.clientCompanyId); // clientCompanyId is Client
            const partner = companies.find(c => c.id === currentSite.partnerId);

            const siteData = {
                ...currentSite,
                code: currentSite.code || '',
                address: currentSite.address || '',
                responsibleTeamName: team ? team.name : '',
                companyName: constructor ? constructor.name : '', // 시공사 (Constructor)
                clientCompanyName: client ? client.name : '', // 발주사 (Client)
                partnerName: partner ? partner.name : '', // 협력사 (Partner)
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
        <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-w-3xl mx-auto">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </span>
                    {currentSite.id ? '현장 정보 수정' : '새 현장 등록'}
                </h2>
                <div className="flex gap-2 text-sm">
                    <span className={`px-2 py-1 rounded-full font-medium ${currentSite.status === 'active' ? 'bg-green-100 text-green-700' :
                        currentSite.status === 'completed' ? 'bg-slate-100 text-slate-600' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                        {currentSite.status === 'active' ? '진행중' : currentSite.status === 'completed' ? '완료' : '예정'}
                    </span>
                </div>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* 1. Basic Information */}
                {/* 1. Basic Information Table */}
                <section className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand-400"></span>
                            기본 정보 (Basic Info)
                        </h3>
                    </div>

                    <div className="grid grid-cols-12 text-sm divide-y divide-slate-200">
                        {/* Row 1: Site Name */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                현장명 <span className="text-red-500 ml-1">*</span>
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <input
                                    type="text"
                                    value={currentSite.name || ''}
                                    onChange={(e) => setCurrentSite({ ...currentSite, name: e.target.value })}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="예: 대전 데이터센터 신축공사"
                                />
                            </div>
                        </div>

                        {/* Row 2: Status & Address */}
                        <div className="col-span-12 grid grid-cols-12">
                            {/* Status Label */}
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                진행 상태
                            </div>
                            {/* Status Input */}
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <select
                                    value={currentSite.status || 'active'}
                                    onChange={(e) => setCurrentSite({ ...currentSite, status: e.target.value as any })}
                                    className={`w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                                        ${currentSite.status === 'active' ? 'text-green-600 bg-green-50/50' :
                                            currentSite.status === 'planned' ? 'text-amber-600 bg-amber-50/50' : 'text-slate-600 bg-slate-50'}`}
                                >
                                    <option value="active">🟢 진행중 (Active)</option>
                                    <option value="planned">🟡 예정 (Planned)</option>
                                    <option value="completed">⚫ 완료 (Completed)</option>
                                </select>
                            </div>

                            {/* Address Label */}
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                주소
                            </div>
                            {/* Address Input */}
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                <input
                                    type="text"
                                    value={currentSite.address || ''}
                                    onChange={(e) => setCurrentSite({ ...currentSite, address: e.target.value })}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="현장 주소 입력"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <div className="w-full border-t border-slate-100 my-2"></div>

                {/* 2. Contract & Responsibility */}
                {/* 2. Contract & Responsibility Table */}
                <section className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                            계약 및 담당 관리 (Contract & Responsibility)
                        </h3>
                    </div>

                    <div className="grid grid-cols-12 text-sm divide-y divide-slate-200 border-t border-slate-200">

                        {/* Row 1: Responsible Team */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex flex-col justify-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                <span>담당 팀</span>
                                <span className="text-[10px] text-slate-400 font-normal mt-0.5">자동완성 기준</span>
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <div className="flex flex-col gap-2">
                                    <select
                                        value={currentSite.responsibleTeamId || ''}
                                        onChange={(e) => setCurrentSite({ ...currentSite, responsibleTeamId: e.target.value })}
                                        className="w-full border-indigo-200 hover:border-indigo-400 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 px-3 shadow-sm bg-indigo-50/20 font-medium text-slate-800 cursor-pointer transition-colors"
                                    >
                                        <option value="">▼ 담당 팀을 선택하세요 (필수)</option>
                                        {teams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>

                                    {/* Auto-selection Feedback */}
                                    {currentSite.responsibleTeamId && (() => {
                                        const team = teams.find(t => t.id === currentSite.responsibleTeamId);
                                        const company = team?.companyId ? companies.find(c => c.id === team.companyId) : null;
                                        if (company) {
                                            return (
                                                <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded border border-indigo-100 animate-in fade-in slide-in-from-top-1">
                                                    <span className="font-bold">✨ Auto-Fill:</span>
                                                    <span>
                                                        <span className="font-bold">'{team?.name}'</span>은 <span className="font-bold underline">{company.name}</span> 소속입니다.
                                                        ({company.type === '협력사' ? '협력사' : '시공사'} 필드가 자동으로 선택되었습니다)
                                                    </span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Constructor & Partner */}
                        <div className="col-span-12 grid grid-cols-12">
                            {/* Constructor Label */}
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                시공사
                            </div>
                            {/* Constructor Input */}
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <div className={`relative w-full rounded border ${currentSite.companyId ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-slate-50/50'}`}>
                                    <select
                                        value={currentSite.companyId || ''}
                                        onChange={(e) => setCurrentSite({ ...currentSite, companyId: e.target.value })}
                                        disabled={true}
                                        className="w-full bg-transparent border-none rounded text-slate-600 text-sm py-1.5 px-3 appearance-none disabled:cursor-not-allowed font-medium"
                                    >
                                        <option value="">(자동 선택)</option>
                                        {companies
                                            .filter(c => c.type === '시공사' || c.type === '건설사' || c.type === '미지정')
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))
                                        }
                                    </select>
                                    {currentSite.companyId && (
                                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                                            <span className="text-[10px] text-slate-500 font-bold px-1.5 bg-white/50 rounded border border-slate-200">Locked</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Partner Label */}
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                협력사
                            </div>
                            {/* Partner Input */}
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                <div className={`relative w-full rounded border ${currentSite.partnerId ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-slate-50/50'}`}>
                                    <select
                                        value={currentSite.partnerId || ''}
                                        onChange={(e) => setCurrentSite({ ...currentSite, partnerId: e.target.value })}
                                        disabled={true}
                                        className="w-full bg-transparent border-none rounded text-slate-600 text-sm py-1.5 px-3 appearance-none disabled:cursor-not-allowed font-medium"
                                    >
                                        <option value="">(자동 선택)</option>
                                        {companies
                                            .filter(c => c.type === '협력사')
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))
                                        }
                                    </select>
                                    {currentSite.partnerId && (
                                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                                            <span className="text-[10px] text-slate-500 font-bold px-1.5 bg-white/50 rounded border border-slate-200">Locked</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Client (Full Width) */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                발주사 (Client)
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <select
                                    value={currentSite.clientCompanyId || ''}
                                    onChange={(e) => setCurrentSite({ ...currentSite, clientCompanyId: e.target.value })}
                                    className="w-full border-slate-200 bg-white hover:border-brand-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-2 px-3 transition-colors cursor-pointer"
                                >
                                    <option value="">선택안함 (선택사항)</option>
                                    {companies
                                        .filter(c => c.type === '건설사')
                                        .map(c => (
                                            <option key={c.id} value={c.id}>🏗️ {c.name}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                    </div>
                </section>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent transition-all"
                >
                    취소
                </button>
                <button
                    onClick={handleSave}
                    className="px-8 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-lg hover:shadow-brand-500/30 transition-all transform hover:-translate-y-0.5"
                >
                    {currentSite.id ? '변경사항 저장' : '현장 등록 완료'}
                </button>
            </div>
        </div >
    );
};

export default SiteForm;
