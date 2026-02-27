import React, { useState, useEffect, useMemo } from 'react';
import { siteService, Site } from '../../services/siteService';
import { manpowerService } from '../../services/manpowerService';
import { Team } from '../../services/teamService';
import { Company, companyService } from '../../services/companyService';

interface SiteFormProps {
    initialData?: Partial<Site>;
    teams: Team[];
    companies: Company[];
    onSave: () => void;
    onCancel: () => void;
}

const SiteForm: React.FC<SiteFormProps> = ({ initialData, teams, companies, onSave, onCancel }) => {
    const [currentSite, setCurrentSite] = useState<Partial<Site>>(initialData || { status: 'active' });
    const [companyOptions, setCompanyOptions] = useState<Company[]>(companies);

    const [isCompanyTouched, setIsCompanyTouched] = useState(false);
    const [isPartnerTouched, setIsPartnerTouched] = useState(false);
    const [, setIsClientTouched] = useState(false);

    const [isClientCompanyTouched, setIsClientCompanyTouched] = useState(false);
    const [showInlinePartnerForm, setShowInlinePartnerForm] = useState(false);
    const [isPartnerSaving, setIsPartnerSaving] = useState(false);
    const [partnerDraft, setPartnerDraft] = useState({
        name: '',
        code: '',
        ceoName: '',
        phone: '',
        address: ''
    });

    const CREATE_PARTNER_VALUE = '__CREATE_PARTNER__';

    useEffect(() => {
        setCompanyOptions(companies);
    }, [companies]);

    const companyUuidByAnyId = useMemo(() => {
        const map = new Map<string, string>();
        companyOptions.forEach(c => {
            if (c.id) map.set(String(c.id), String(c.id));
            if (c.legacyId) map.set(String(c.legacyId), String(c.id));
        });
        return map;
    }, [companyOptions]);

    const filteredTeams = useMemo(() => {
        const rawPartnerId = currentSite.partnerId ? String(currentSite.partnerId).trim() : '';
        const rawCompanyId = currentSite.companyId ? String(currentSite.companyId).trim() : '';

        const targetCompanyIdRaw = rawPartnerId || rawCompanyId;
        const targetCompanyId = targetCompanyIdRaw ? (companyUuidByAnyId.get(targetCompanyIdRaw) ?? targetCompanyIdRaw) : '';
        if (!targetCompanyId) return teams;

        return teams.filter(t => {
            const teamCompanyIdRaw = t.companyId ? String(t.companyId).trim() : '';
            if (!teamCompanyIdRaw) return false;
            const teamCompanyId = companyUuidByAnyId.get(teamCompanyIdRaw) ?? teamCompanyIdRaw;
            return teamCompanyId === targetCompanyId;
        });
    }, [teams, currentSite.partnerId, currentSite.companyId, companyUuidByAnyId]);

    useEffect(() => {
        const teamId = currentSite.responsibleTeamId ? String(currentSite.responsibleTeamId).trim() : '';
        if (!teamId) return;

        const rawPartnerId = currentSite.partnerId ? String(currentSite.partnerId).trim() : '';
        const rawCompanyId = currentSite.companyId ? String(currentSite.companyId).trim() : '';
        const hasCompanyConstraint = rawPartnerId.length > 0 || rawCompanyId.length > 0;
        if (!hasCompanyConstraint) return;

        const isValid = filteredTeams.some(t => t.id === teamId);
        if (isValid) return;

        setCurrentSite(prev => ({
            ...prev,
            responsibleTeamId: ''
        }));
    }, [currentSite.responsibleTeamId, currentSite.partnerId, currentSite.companyId, filteredTeams]);

    useEffect(() => {
        if (!companyOptions || companyOptions.length === 0) return;

        const normalizeCompanyId = (raw: unknown): string | undefined => {
            if (raw === undefined) return undefined;
            if (raw === null) return '';
            const v = String(raw);
            if (!v) return '';
            const found = companyOptions.find(c => c.id === v || c.legacyId === v);
            if (found?.id && found.id !== v) return found.id;
            return v;
        };

        setCurrentSite(prev => {
            const nextCompanyId = normalizeCompanyId(prev.companyId);
            const nextPartnerId = normalizeCompanyId((prev as any).partnerId);
            const nextClientCompanyId = normalizeCompanyId((prev as any).clientCompanyId);

            if (
                nextCompanyId === prev.companyId &&
                nextPartnerId === (prev as any).partnerId &&
                nextClientCompanyId === (prev as any).clientCompanyId
            ) {
                return prev;
            }

            return {
                ...prev,
                companyId: nextCompanyId as any,
                partnerId: nextPartnerId as any,
                clientCompanyId: nextClientCompanyId as any
            };
        });
    }, [companyOptions]);

    // Auto-select company based on team selection
    useEffect(() => {
        if (!currentSite.responsibleTeamId) return;

        const team = teams.find(t => t.id === currentSite.responsibleTeamId);
        if (!team || !team.companyId) return;

        const teamCompany = companyOptions.find(c => c.id === team.companyId || c.legacyId === team.companyId);
        const resolvedTeamCompanyId = teamCompany?.id || team.companyId;

        const normalizedTeamType = String(team?.type ?? '').trim();
        const normalizedCompanyType = String((teamCompany as any)?.type ?? '').trim();
        const isPartnerTeam = normalizedCompanyType === '협력사' || normalizedTeamType.includes('지원') || normalizedTeamType.includes('협력');

        if (isPartnerTeam) {
            setCurrentSite(prev => {
                const next: any = { ...prev };

                if (!isPartnerTouched && (!prev.partnerId || String(prev.partnerId).trim().length === 0)) {
                    next.partnerId = resolvedTeamCompanyId;
                }

                if (!isCompanyTouched && (prev.companyId === undefined || prev.companyId === null || String(prev.companyId).trim().length === 0)) {
                    const constructorCompanies = companyOptions.filter(c => String((c as any)?.type ?? '').trim() === '시공사');
                    if (constructorCompanies.length === 1) {
                        next.companyId = constructorCompanies[0].id;
                    }
                }

                return next;
            });
            return;
        }

        setCurrentSite(prev => {
            const next: any = { ...prev };

            if (!isCompanyTouched && (!prev.companyId || String(prev.companyId).trim().length === 0)) {
                next.companyId = resolvedTeamCompanyId;
            }

            if (!isPartnerTouched && (prev.partnerId === undefined || prev.partnerId === null || String(prev.partnerId).trim().length === 0)) {
                next.partnerId = '';
            }

            return next;
        });
    }, [currentSite.responsibleTeamId, teams, companyOptions, isCompanyTouched, isPartnerTouched]);

    // Auto-select Client (발주사/건설사) based on selected Constructor (시공사)
    useEffect(() => {
        const rawConstructorId = currentSite.companyId ? String(currentSite.companyId).trim() : '';
        if (!rawConstructorId) return;
        if (isClientCompanyTouched) return;

        const currentClientId = (currentSite as any).clientCompanyId ? String((currentSite as any).clientCompanyId).trim() : '';
        if (currentClientId.length > 0) return;

        const constructorCompany = companyOptions.find(c => c.id === rawConstructorId || c.legacyId === rawConstructorId);
        const assigned = (constructorCompany as any)?.assignedClientCompanyIds as unknown;
        const assignedIds = Array.isArray(assigned)
            ? assigned.map(v => String(v)).filter(Boolean)
            : [];

        const resolvedClientIds = assignedIds
            .map(id => companyOptions.find(c => c.id === id || c.legacyId === id)?.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0);

        // If there is exactly one candidate, auto-fill it
        if (resolvedClientIds.length === 1) {
            setCurrentSite(prev => ({
                ...prev,
                clientCompanyId: resolvedClientIds[0] as any
            }));
        }
    }, [currentSite.companyId, companyOptions, isClientCompanyTouched]);

    const handleInlinePartnerSave = async () => {
        const trimmedName = partnerDraft.name.trim();
        if (!trimmedName) {
            alert('협력사명을 입력해주세요.');
            return;
        }

        const duplicate = companyOptions.find(
            (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (duplicate?.id) {
            alert('이미 등록된 협력사입니다. 기존 협력사를 선택합니다.');
            setCurrentSite((prev) => ({ ...prev, partnerId: duplicate.id, partnerName: duplicate.name }));
            setShowInlinePartnerForm(false);
            return;
        }

        setIsPartnerSaving(true);
        try {
            const payload = {
                name: trimmedName,
                code: partnerDraft.code.trim(),
                businessNumber: '',
                ceoName: partnerDraft.ceoName.trim(),
                address: partnerDraft.address.trim(),
                phone: partnerDraft.phone.trim(),
                email: '',
                type: '협력사' as const,
                bankName: '',
                accountNumber: '',
                accountHolder: '',
                ceoResidentNumber: '',
                color: '#16a34a'
            };

            const newId = await companyService.addCompany(payload);
            const created: Company = {
                ...payload,
                id: newId,
                status: 'active'
            };

            setCompanyOptions((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
            setCurrentSite((prev) => ({
                ...prev,
                partnerId: created.id,
                partnerName: created.name
            }));
            setShowInlinePartnerForm(false);
            setIsPartnerTouched(true);
            setPartnerDraft({ name: '', code: '', ceoName: '', phone: '', address: '' });
            alert(`협력사 [${created.name}] 등록 후 자동 선택되었습니다.`);
        } catch (error) {
            console.error('Failed to create partner company:', error);
            alert('협력사 등록에 실패했습니다.');
        } finally {
            setIsPartnerSaving(false);
        }
    };

    // ... (rest of code) ...

    // Client (발주사)

    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        if (typeof error === 'object' && error !== null && 'message' in error) {
            const msg = (error as { message: unknown }).message;
            if (typeof msg === 'string') return msg;
        }
        return 'Unknown error';
    };

    const handleSave = async () => {
        try {
            if (!currentSite.name) {
                alert("현장명은 필수입니다.");
                return;
            }

            const partnerId = currentSite.partnerId ? String(currentSite.partnerId).trim() : '';
            if (partnerId && !currentSite.responsibleTeamId) {
                alert('협력사 현장 등록 시 협력사 담당팀을 선택해주세요.');
                return;
            }

            // Find team name
            const team = teams.find(t => t.id === currentSite.responsibleTeamId);

            const normalizedCompanyId = currentSite.companyId ? String(currentSite.companyId) : null;
            const normalizedClientCompanyId = (currentSite as any).clientCompanyId ? String((currentSite as any).clientCompanyId) : null;
            const normalizedPartnerId = (currentSite as any).partnerId ? String((currentSite as any).partnerId) : null;

            // Find company names
            const constructor = normalizedCompanyId ? companyOptions.find(c => c.id === normalizedCompanyId) : undefined; // companyId is Constructor
            const client = normalizedClientCompanyId ? companyOptions.find(c => c.id === normalizedClientCompanyId) : undefined; // clientCompanyId is Client
            const partner = normalizedPartnerId ? companyOptions.find(c => c.id === normalizedPartnerId) : undefined;

            const siteData: any = {
                ...currentSite,
                companyId: normalizedCompanyId as any,
                clientCompanyId: normalizedClientCompanyId as any,
                partnerId: normalizedPartnerId as any,
                code: currentSite.code || '',
                address: currentSite.address || '',
                responsibleTeamName: team ? team.name : null,
                companyName: constructor ? constructor.name : null, // 시공사 (Constructor)
                clientCompanyName: client ? client.name : null, // 발주사 (Client)
                partnerName: partner ? partner.name : null, // 협력사 (Partner)
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
            alert(`저장에 실패했습니다.\n${getErrorMessage(error)}`);
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

                        {/* Row 3: Site Type & Payment Method */}
                        <div className="col-span-12 grid grid-cols-12 border-t border-slate-200">
                            {/* Site Type Label */}
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                현장 구분
                            </div>
                            {/* Site Type Input */}
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <select
                                    value={currentSite.siteType || ''}
                                    onChange={(e) => setCurrentSite({ ...currentSite, siteType: e.target.value as any })}
                                    className="w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                >
                                    <option value="">(선택)</option>
                                    <option value="도급">도급</option>
                                    <option value="직영">직영</option>
                                    <option value="지원">지원</option>
                                </select>
                            </div>

                            {/* Payment Method Label */}
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                결제 구분
                            </div>
                            {/* Payment Method Input */}
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0 flex items-center">
                                <div className="flex gap-4 items-center px-2">
                                    <label className="flex items-center gap-2 cursor-pointer hover:text-brand-600 transition-colors">
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="계산서"
                                            checked={currentSite.paymentMethod === '계산서'}
                                            onChange={(e) => setCurrentSite({ ...currentSite, paymentMethod: e.target.value as any })}
                                            className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-slate-300"
                                        />
                                        <span className="text-sm font-medium">계산서</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer hover:text-brand-600 transition-colors">
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="노무"
                                            checked={currentSite.paymentMethod === '노무'}
                                            onChange={(e) => setCurrentSite({ ...currentSite, paymentMethod: e.target.value as any })}
                                            className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-slate-300"
                                        />
                                        <span className="text-sm font-medium">노무</span>
                                    </label>
                                </div>
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
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setIsCompanyTouched(false);
                                            setIsPartnerTouched(false);
                                            setIsClientCompanyTouched(false);
                                            setCurrentSite(prev => {
                                                if (!v) {
                                                    return {
                                                        ...prev,
                                                        responsibleTeamId: '',
                                                        companyId: '',
                                                        partnerId: ''
                                                    };
                                                }
                                                return { ...prev, responsibleTeamId: v };
                                            });
                                        }}
                                        className="w-full border-indigo-200 hover:border-indigo-400 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 px-3 shadow-sm bg-indigo-50/20 font-medium text-slate-800 cursor-pointer transition-colors"
                                    >
                                        <option value="">▼ 담당 팀을 선택하세요 (필수)</option>
                                        {filteredTeams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    {currentSite.partnerId && (
                                        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700">
                                            협력사가 선택되었습니다. 협력사 소속 담당팀을 선택해주세요.
                                        </div>
                                    )}
                                    {!currentSite.partnerId && (
                                        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
                                            협력사 현장이라면 먼저 협력사를 선택하면 담당팀 목록이 협력사 기준으로 좁혀집니다.
                                        </div>
                                    )}

                                    {/* Auto-selection Feedback */}
                                    {currentSite.responsibleTeamId && (() => {
                                        const team = teams.find(t => t.id === currentSite.responsibleTeamId);
                                        const company = team?.companyId ? companyOptions.find(c => c.id === team.companyId) : null;
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
                                        onChange={(e) => {
                                            setIsCompanyTouched(true);
                                            setCurrentSite({ ...currentSite, companyId: e.target.value });
                                        }}
                                        disabled={false}
                                        className="w-full bg-transparent border-none rounded text-slate-600 text-sm py-1.5 px-3 appearance-none disabled:cursor-not-allowed font-medium"
                                    >
                                        <option value="">(자동 선택)</option>
                                        {companyOptions
                                            .filter(c => {
                                                const t = String((c as any)?.type ?? '').trim();
                                                const selectedId = currentSite.companyId ? String(currentSite.companyId) : '';
                                                if (selectedId && c.id === selectedId) return true;
                                                return t === '시공사' || t === '건설사' || t === '미지정' || t === '기타';
                                            })
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))
                                        }
                                    </select>
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
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            if (next === CREATE_PARTNER_VALUE) {
                                                setShowInlinePartnerForm(true);
                                                return;
                                            }
                                            setIsPartnerTouched(true);
                                            setShowInlinePartnerForm(false);
                                            setCurrentSite({ ...currentSite, partnerId: next });
                                        }}
                                        disabled={false}
                                        className="w-full bg-transparent border-none rounded text-slate-600 text-sm py-1.5 px-3 appearance-none disabled:cursor-not-allowed font-medium"
                                    >
                                        <option value="">(자동 선택)</option>
                                        {companyOptions
                                            .filter(c => {
                                                const t = String((c as any)?.type ?? '').trim();
                                                const selectedId = currentSite.partnerId ? String(currentSite.partnerId) : '';
                                                if (selectedId && c.id === selectedId) return true;
                                                return t === '협력사';
                                            })
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))
                                        }
                                        <option value={CREATE_PARTNER_VALUE}>+ 신규 협력사 등록</option>
                                    </select>
                                </div>
                                <div className="mt-2 space-y-2">
                                    <div className="text-[12px] text-slate-500">
                                        신규 협력사면 먼저 등록해주세요. 새 창 없이 현재 등록 페이지에서 바로 등록할 수 있습니다.
                                    </div>
                                    {!showInlinePartnerForm && (
                                        <button
                                            type="button"
                                            onClick={() => setShowInlinePartnerForm(true)}
                                            className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                        >
                                            + 협력사 등록
                                        </button>
                                    )}
                                </div>
                                {showInlinePartnerForm && (
                                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                                        <div className="mb-2 text-xs font-bold text-emerald-800">협력사 먼저 등록</div>
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                            <input
                                                type="text"
                                                value={partnerDraft.name}
                                                onChange={(e) => setPartnerDraft((prev) => ({ ...prev, name: e.target.value }))}
                                                placeholder="협력사명 *"
                                                className="w-full border border-emerald-200 bg-white rounded px-2.5 py-1.5 text-sm"
                                            />
                                            <input
                                                type="text"
                                                value={partnerDraft.code}
                                                onChange={(e) => setPartnerDraft((prev) => ({ ...prev, code: e.target.value }))}
                                                placeholder="회사코드(선택)"
                                                className="w-full border border-emerald-200 bg-white rounded px-2.5 py-1.5 text-sm"
                                            />
                                            <input
                                                type="text"
                                                value={partnerDraft.ceoName}
                                                onChange={(e) => setPartnerDraft((prev) => ({ ...prev, ceoName: e.target.value }))}
                                                placeholder="대표자명(선택)"
                                                className="w-full border border-emerald-200 bg-white rounded px-2.5 py-1.5 text-sm"
                                            />
                                            <input
                                                type="text"
                                                value={partnerDraft.phone}
                                                onChange={(e) => setPartnerDraft((prev) => ({ ...prev, phone: e.target.value }))}
                                                placeholder="연락처(선택)"
                                                className="w-full border border-emerald-200 bg-white rounded px-2.5 py-1.5 text-sm"
                                            />
                                            <input
                                                type="text"
                                                value={partnerDraft.address}
                                                onChange={(e) => setPartnerDraft((prev) => ({ ...prev, address: e.target.value }))}
                                                placeholder="주소(선택)"
                                                className="w-full border border-emerald-200 bg-white rounded px-2.5 py-1.5 text-sm md:col-span-2"
                                            />
                                        </div>
                                        <div className="mt-3 flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleInlinePartnerSave}
                                                disabled={isPartnerSaving}
                                                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                {isPartnerSaving ? '등록 중...' : '협력사 등록 후 선택'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowInlinePartnerForm(false)}
                                                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                            >
                                                닫기
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                    onChange={(e) => {
                                        setIsClientTouched(true);
                                        setIsClientCompanyTouched(true);
                                        setCurrentSite({ ...currentSite, clientCompanyId: e.target.value });
                                    }}
                                    className="w-full border-slate-200 bg-white hover:border-brand-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-2 px-3 transition-colors cursor-pointer"
                                >
                                    <option value="">선택안함 (선택사항)</option>
                                    {companyOptions
                                        .filter(c => {
                                            const t = String((c as any)?.type ?? '').trim();
                                            const selectedId = currentSite.clientCompanyId ? String(currentSite.clientCompanyId) : '';
                                            if (selectedId && c.id === selectedId) return true;
                                            return t === '건설사' || t === '발주사' || t === '발주처';
                                        })
                                        .map(c => (
                                            <option key={c.id} value={c.id}>🏗️ {c.name}</option>
                                        ))}
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
