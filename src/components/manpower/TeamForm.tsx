import React, { useMemo, useState, useEffect } from 'react';
import { Team, teamService } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { Company, companyService } from '../../services/companyService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faCheck, faTimes, faPlus } from '@fortawesome/free-solid-svg-icons';

interface TeamFormProps {
    initialData?: Partial<Team>;
    teams: Team[];
    workers: Worker[];
    companies: Company[];
    onSave: () => void;
    onCancel: () => void;
}

const TeamForm: React.FC<TeamFormProps> = ({ initialData, teams, workers, companies, onSave, onCancel }) => {
    const EXTERNAL_TEAM_COMPANY_NAME = '외부팀';
    const EXTERNAL_TEAM_COMPANY_VALUE = '__EXTERNAL_TEAM__';
    const [currentTeam, setCurrentTeam] = useState<Partial<Team>>(initialData || {
        type: '시공팀',
        bankName: '',
        accountNumber: '',
        accountHolder: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [companyOptions, setCompanyOptions] = useState<Company[]>(companies);
    const [showInlinePartnerForm, setShowInlinePartnerForm] = useState(false);
    const [isPartnerSaving, setIsPartnerSaving] = useState(false);
    const [partnerDraft, setPartnerDraft] = useState({
        name: '',
        code: '',
        ceoName: '',
        phone: '',
        address: ''
    });

    const salaryModelOptions = ['일급제', '주급제', '월급제', '지원팀', '용역팀', '가지급'];
    const CREATE_PARTNER_VALUE = '__CREATE_PARTNER__';

    useEffect(() => {
        setCompanyOptions(companies);
    }, [companies]);

    const teamType = String(currentTeam.type ?? '시공팀');
    const isConstructorTeam = teamType === '시공팀';
    const isSupportTeam = teamType === '지원팀';
    const canCreatePartnerInline = isSupportTeam || teamType === '용역팀';
    const isExternalSupportTeamCompany =
        isSupportTeam &&
        String(currentTeam.companyId ?? '').trim().length === 0 &&
        String(currentTeam.companyName ?? '').trim() === EXTERNAL_TEAM_COMPANY_NAME;

    const constructorCompanyOptions = useMemo(() => {
        const constructorCompanies = companyOptions.filter((c) => c.type === '시공사');
        const cheongyeonCompanies = constructorCompanies.filter((c) => String(c.name ?? '').includes('청연'));
        return cheongyeonCompanies.length > 0 ? cheongyeonCompanies : constructorCompanies;
    }, [companyOptions]);

    const partnerCompanies = useMemo(
        () => companyOptions.filter((c) => c.type === '협력사'),
        [companyOptions]
    );

    const selectableCompanies = useMemo(() => {
        if (isConstructorTeam) return constructorCompanyOptions;
        if (isSupportTeam) return partnerCompanies;
        return companyOptions;
    }, [companyOptions, constructorCompanyOptions, isConstructorTeam, isSupportTeam, partnerCompanies]);

    useEffect(() => {
        setCurrentTeam((prev) => {
            const currentCompanyId = String(prev.companyId ?? '').trim();
            const currentCompanyName = String(prev.companyName ?? '').trim();
            const isValid = selectableCompanies.some((c) => String(c.id ?? '') === currentCompanyId);
            if (isSupportTeam && !isValid) {
                if (!currentCompanyId && currentCompanyName === EXTERNAL_TEAM_COMPANY_NAME) return prev;
                return { ...prev, companyId: '', companyName: EXTERNAL_TEAM_COMPANY_NAME };
            }
            if (isValid) return prev;

            const nextCompanyId = String(selectableCompanies[0]?.id ?? '').trim();
            if (currentCompanyId === nextCompanyId) return prev;
            const nextCompany = selectableCompanies.find((c) => String(c.id ?? '') === nextCompanyId);
            return { ...prev, companyId: nextCompanyId, companyName: nextCompany?.name ?? '' };
        });

        if (!canCreatePartnerInline && showInlinePartnerForm) {
            setShowInlinePartnerForm(false);
        }
    }, [canCreatePartnerInline, isSupportTeam, selectableCompanies, showInlinePartnerForm]);

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
            setCurrentTeam((prev) => ({ ...prev, companyId: duplicate.id, companyName: duplicate.name }));
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
            setCurrentTeam((prev) => ({ ...prev, companyId: newId, companyName: created.name }));
            setShowInlinePartnerForm(false);
            setPartnerDraft({ name: '', code: '', ceoName: '', phone: '', address: '' });
            alert(`협력사 [${created.name}] 등록 후 자동 선택되었습니다.`);
        } catch (error) {
            console.error('Failed to create partner company:', error);
            alert('협력사 등록에 실패했습니다.');
        } finally {
            setIsPartnerSaving(false);
        }
    };

    const handleSave = async () => {
        if (isSaving) return;
        try {
            const trimmedName = String(currentTeam.name ?? '').trim();
            if (!trimmedName) {
                alert('팀명을 입력해주세요.');
                return;
            }

            const selectedCompanyId = String(currentTeam.companyId ?? '').trim();
            const selectedCompany = companyOptions.find((c) => String(c.id ?? '') === selectedCompanyId);

            if (isConstructorTeam) {
                const isAllowedConstructor = constructorCompanyOptions.some((c) => String(c.id ?? '') === selectedCompanyId);
                if (!selectedCompany || !isAllowedConstructor) {
                    alert('시공팀은 청연 소속 시공사만 소속 회사로 선택할 수 있습니다.');
                    return;
                }
            }

            if (isSupportTeam) {
                const isAllowedPartner = partnerCompanies.some((c) => String(c.id ?? '') === selectedCompanyId);
                if (!isExternalSupportTeamCompany && (!selectedCompany || !isAllowedPartner)) {
                    alert('지원팀은 외부팀 또는 협력사를 소속으로 선택해주세요.');
                    return;
                }
            }

            setIsSaving(true);

            // Find leader name
            const leader = workers.find(w => w.id === currentTeam.leaderId);
            // Find company name
            const company = companyOptions.find(c => c.id === currentTeam.companyId);


            const teamData = {
                ...currentTeam,
                name: trimmedName,
                leaderName: leader ? leader.name : '',
                companyName: isExternalSupportTeamCompany ? EXTERNAL_TEAM_COMPANY_NAME : (company ? company.name : '')
            };

            if (currentTeam.id) {
                await teamService.updateTeam(currentTeam.id, teamData);

                // Sync Name Change if needed
                if (initialData?.name && currentTeam.name && initialData.name !== currentTeam.name) {
                    await manpowerService.updateWorkersTeamName(currentTeam.id, currentTeam.name);
                }

                const prevDefaultSalaryModel = initialData?.defaultSalaryModel ?? '';
                const nextDefaultSalaryModel = currentTeam.defaultSalaryModel ?? '';
                if (prevDefaultSalaryModel !== nextDefaultSalaryModel && nextDefaultSalaryModel) {
                    const ok = window.confirm('팀 기본 지급구분이 변경되었습니다. 이 팀의 모든 작업자 지급구분도 일괄 변경할까요?');
                    if (ok) {
                        await manpowerService.updateWorkersSalaryModelByTeam(currentTeam.id, nextDefaultSalaryModel);
                    }
                }
            } else {
                await teamService.addTeam(teamData as Team);
            }
            onSave();
        } catch (error) {
            console.error("Failed to save team", error);
            const message = error instanceof Error ? error.message : String(error);
            alert(`저장에 실패했습니다: ${message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-w-3xl mx-auto">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                        <FontAwesomeIcon icon={faUsers} className="text-sm" />
                    </span>
                    <span>{currentTeam.id ? '팀 정보 수정' : '새 팀 등록'}</span>
                </h3>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* 1. Basic Information */}
                <section className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand-400"></span>
                            기본 정보 (Basic Information)
                        </h3>
                    </div>

                    <div className="grid grid-cols-12 text-sm divide-y divide-slate-200">
                        {/* Row 1: Team Name */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                팀명 <span className="text-red-500 ml-1">*</span>
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <input
                                    type="text"
                                    value={currentTeam.name || ''}
                                    onChange={(e) => setCurrentTeam({ ...currentTeam, name: e.target.value })}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="팀명을 입력하세요"
                                />
                            </div>
                        </div>

                        {/* Row 2: Type & Company */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                팀 유형
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <select
                                    value={currentTeam.type || '시공팀'}
                                    onChange={(e) => {
                                        const nextType = e.target.value;
                                        setCurrentTeam(prev => {
                                            const next: Partial<Team> = { ...prev, type: nextType };
                                            if (!prev.defaultSalaryModel) {
                                                if (nextType === '지원팀') next.defaultSalaryModel = '지원팀';
                                                if (nextType === '용역팀') next.defaultSalaryModel = '용역팀';
                                            }
                                            if (nextType === '지원팀') {
                                                next.companyId = '';
                                                next.companyName = EXTERNAL_TEAM_COMPANY_NAME;
                                            } else if (String(prev.companyName ?? '').trim() === EXTERNAL_TEAM_COMPANY_NAME) {
                                                next.companyId = '';
                                                next.companyName = '';
                                            }
                                            return next;
                                        });
                                    }}
                                    className="w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                >
                                    <option value="시공팀">시공팀</option>
                                    <option value="지원팀">지원팀</option>
                                    <option value="용역팀">용역팀</option>
                                </select>
                            </div>
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                소속 회사
                            </div>
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                <select
                                    value={isExternalSupportTeamCompany ? EXTERNAL_TEAM_COMPANY_VALUE : (currentTeam.companyId || '')}
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        if (next === EXTERNAL_TEAM_COMPANY_VALUE && isSupportTeam) {
                                            setShowInlinePartnerForm(false);
                                            setCurrentTeam({ ...currentTeam, companyId: '', companyName: EXTERNAL_TEAM_COMPANY_NAME });
                                            return;
                                        }
                                        if (next === CREATE_PARTNER_VALUE && canCreatePartnerInline) {
                                            setShowInlinePartnerForm(true);
                                            return;
                                        }
                                        setShowInlinePartnerForm(false);
                                        const selectedCompany = companyOptions.find((company) => company.id === next);
                                        setCurrentTeam({ ...currentTeam, companyId: next, companyName: selectedCompany?.name ?? '' });
                                    }}
                                    className="w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                >
                                    <option value="">
                                        {isConstructorTeam
                                            ? '청연 소속 시공사 선택'
                                            : isSupportTeam
                                                ? '외부팀 또는 협력사 선택'
                                                : '소속 회사 선택'}
                                    </option>
                                    {isSupportTeam && <option value={EXTERNAL_TEAM_COMPANY_VALUE}>외부팀</option>}
                                    {selectableCompanies.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                    {canCreatePartnerInline && <option value={CREATE_PARTNER_VALUE}>+ 신규 협력사 등록</option>}
                                </select>
                                <div className="mt-2 space-y-2">
                                    {isConstructorTeam && (
                                        <div className="text-[12px] text-slate-500">
                                            시공팀은 청연 소속 시공사만 선택됩니다.
                                        </div>
                                    )}
                                    {isSupportTeam && (
                                        <div className="text-[12px] text-slate-500">
                                            지원팀은 기본 소속이 외부팀입니다. 필요하면 협력사를 선택하거나 아래에서 바로 등록할 수 있습니다.
                                        </div>
                                    )}
                                    {isSupportTeam && partnerCompanies.length === 0 && !showInlinePartnerForm && (
                                        <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[12px] text-amber-700">
                                            등록된 협력사가 없습니다. `신규 협력사 등록`을 눌러 먼저 등록해주세요.
                                        </div>
                                    )}
                                    {canCreatePartnerInline && !showInlinePartnerForm && (
                                        <button
                                            type="button"
                                            onClick={() => setShowInlinePartnerForm(true)}
                                            className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                        >
                                            <FontAwesomeIcon icon={faPlus} />
                                            신규 협력사 등록
                                        </button>
                                    )}
                                </div>
                                {canCreatePartnerInline && showInlinePartnerForm && (
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

                        {/* Row 3: Leader */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                팀장
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <select
                                    value={currentTeam.leaderId || ''}
                                    onChange={(e) => setCurrentTeam({ ...currentTeam, leaderId: e.target.value })}
                                    className="w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                >
                                    <option value="">선택안함</option>
                                    {workers.map(w => (
                                        <option key={w.id} value={w.id}>
                                            {w.name} ({w.teamType}/{w.role || '작업자'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 4: Bank Account */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                계좌정보
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                    <input
                                        type="text"
                                        value={currentTeam.bankName || ''}
                                        onChange={(e) => setCurrentTeam({ ...currentTeam, bankName: e.target.value })}
                                        placeholder="은행명"
                                        className="w-full border-slate-200 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm"
                                    />
                                    <input
                                        type="text"
                                        value={currentTeam.accountNumber || ''}
                                        onChange={(e) => setCurrentTeam({ ...currentTeam, accountNumber: e.target.value })}
                                        placeholder="계좌번호"
                                        className="w-full border-slate-200 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm"
                                    />
                                    <input
                                        type="text"
                                        value={currentTeam.accountHolder || ''}
                                        onChange={(e) => setCurrentTeam({ ...currentTeam, accountHolder: e.target.value })}
                                        placeholder="예금주"
                                        className="w-full border-slate-200 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Management Setting */}
                <section className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                            관리 설정 (Management Setting)
                        </h3>
                    </div>

                    <div className="grid grid-cols-12 text-sm divide-y divide-slate-200 border-t border-slate-200">
                        {/* Row 1: Default Salary Model */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                기본 지급구분
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <select
                                    value={currentTeam.defaultSalaryModel || ''}
                                    onChange={(e) => setCurrentTeam({ ...currentTeam, defaultSalaryModel: e.target.value })}
                                    className="w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                >
                                    <option value="">선택안함 (개별 설정 따름)</option>
                                    {salaryModelOptions.map(v => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Team Color */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                팀 색상
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={currentTeam.color || '#2563eb'}
                                        onChange={(e) => setCurrentTeam({ ...currentTeam, color: e.target.value })}
                                        className="h-8 w-8 rounded border border-slate-200 cursor-pointer p-0 shadow-sm"
                                    />
                                    <input
                                        type="text"
                                        value={currentTeam.color || ''}
                                        onChange={(e) => setCurrentTeam({ ...currentTeam, color: e.target.value })}
                                        placeholder="#2563eb"
                                        className="w-32 border-slate-200 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 font-mono shadow-sm"
                                    />
                                </div>
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
                    disabled={isSaving}
                    className="px-8 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-lg hover:shadow-brand-500/30 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <FontAwesomeIcon icon={faCheck} />
                    <span>{currentTeam.id ? '변경사항 저장' : '팀 등록 완료'}</span>
                </button>
            </div>
        </div>
    );
};

export default TeamForm;
