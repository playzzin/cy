import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { teamService } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { advancePaymentService, AdvancePayment } from '../../services/advancePaymentService';
import { companyService } from '../../services/companyService';
import { payrollConfigService, PayrollConfig, PayrollDeductionItem } from '../../services/payrollConfigService';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { UserRole } from '../../types/roles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faSearch, faSpinner, faCalculator } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { useSearchParams } from 'react-router-dom';

const LEGACY_DEDUCTION_FIELD_IDS = [
    'prevMonthCarryover',
    'accommodation',
    'privateRoom',
    'gloves',
    'deposit',
    'fines',
    'electricity',
    'gas',
    'internet',
    'water'
] as const;

type LegacyDeductionFieldId = (typeof LEGACY_DEDUCTION_FIELD_IDS)[number];

const isLegacyDeductionFieldId = (id: string): id is LegacyDeductionFieldId =>
    (LEGACY_DEDUCTION_FIELD_IDS as readonly string[]).includes(id);

const AdvancePaymentPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [searchParams] = useSearchParams();
    const [canUseAdvanceManagement, setCanUseAdvanceManagement] = useState<boolean | null>(null);

    const queryTeamId = searchParams.get('teamId') ?? '';
    const queryYearMonth = searchParams.get('yearMonth') ?? '';
    const queryHighlightWorkerId = searchParams.get('highlightWorkerId') ?? '';

    const didApplyQueryRef = useRef(false);
    const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

    useEffect(() => {
        let isCancelled = false;

        const resolveAccess = async () => {
            if (!currentUser) {
                if (!isCancelled) setCanUseAdvanceManagement(false);
                return;
            }

            try {
                const user = await userService.getUser(currentUser.uid);
                const role = user?.role;
                const isAdminRole = role === 'admin' || role === UserRole.ADMIN;
                if (isAdminRole) {
                    if (!isCancelled) setCanUseAdvanceManagement(true);
                    return;
                }

                const worker = await manpowerService.getWorkerByUid(currentUser.uid);
                const companyId = worker?.companyId;
                if (!companyId) {
                    if (!isCancelled) setCanUseAdvanceManagement(false);
                    return;
                }

                const company = await companyService.getCompanyById(companyId);
                if (!isCancelled) setCanUseAdvanceManagement(company?.type === '시공사');
            } catch {
                if (!isCancelled) setCanUseAdvanceManagement(false);
            }
        };

        resolveAccess();
        return () => {
            isCancelled = true;
        };
    }, [currentUser]);

    // Filters
    const [selectedCompany, setSelectedCompany] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Data State
    const [teams, setTeams] = useState<{ id: string; name: string; companyName?: string }[]>([]);
    const [companies, setCompanies] = useState<string[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [advances, setAdvances] = useState<{ [workerId: string]: AdvancePayment }>({});

    const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
    const [deductionItems, setDeductionItems] = useState<PayrollDeductionItem[]>([]);
    const [configSaving, setConfigSaving] = useState(false);
    const [newDeductionLabel, setNewDeductionLabel] = useState('');

    // UI State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isDeductionSettingsOpen, setIsDeductionSettingsOpen] = useState(false);

    const [highlightWorkerId, setHighlightWorkerId] = useState<string>('');
    const [autoSearchRequested, setAutoSearchRequested] = useState<boolean>(false);

    const activeDeductionItems = useMemo(() => {
        return [...deductionItems]
            .filter((item) => item.isActive)
            .sort((a, b) => a.order - b.order);
    }, [deductionItems]);

    const getDeductionValue = useCallback((advance: AdvancePayment | undefined, deductionId: string): number => {
        if (!advance) return 0;
        if (isLegacyDeductionFieldId(deductionId)) {
            return (advance[deductionId] as number | undefined) ?? 0;
        }
        return advance.items?.[deductionId] ?? 0;
    }, []);

    const calculateTotalDeduction = useCallback((advance: AdvancePayment): number => {
        return activeDeductionItems.reduce((sum, item) => {
            return sum + getDeductionValue(advance, item.id);
        }, 0);
    }, [activeDeductionItems, getDeductionValue]);

    useEffect(() => {
        setAdvances((prev) => {
            const nextEntries = Object.entries(prev).map(([workerId, advance]) => {
                const nextTotal = calculateTotalDeduction(advance);
                if (advance.totalDeduction === nextTotal) return [workerId, advance] as const;
                return [workerId, { ...advance, totalDeduction: nextTotal }] as const;
            });
            return Object.fromEntries(nextEntries);
        });
    }, [calculateTotalDeduction]);

    const getDeductionCellClassName = useCallback((deductionId: string): string => {
        if (deductionId === 'prevMonthCarryover') return 'p-1 border-r border-slate-200 bg-amber-50/30';
        if (deductionId === 'accommodation') return 'p-1 border-r border-slate-200 bg-blue-50/30';
        if (deductionId === 'privateRoom') return 'p-1 border-r border-slate-200 bg-violet-50/30';
        return 'p-1 border-r border-slate-200';
    }, []);

    const getDeductionHeaderClassName = useCallback((deductionId: string): string => {
        if (deductionId === 'prevMonthCarryover') return 'p-3 border-r border-slate-300 min-w-[100px] bg-amber-50';
        if (deductionId === 'accommodation') return 'p-3 border-r border-slate-300 min-w-[100px] bg-blue-50';
        if (deductionId === 'privateRoom') return 'p-3 border-r border-slate-300 min-w-[100px] bg-violet-50';
        return 'p-3 border-r border-slate-300 min-w-[100px]';
    }, []);

    const createEmptyAdvance = useCallback((worker: Worker, teamId: string, month: string): AdvancePayment => {
        return {
            workerId: worker.id!,
            workerName: worker.name,
            teamId: teamId,
            teamName: worker.teamName || '',
            yearMonth: month,
            items: {},
            prevMonthCarryover: 0,
            accommodation: 0,
            privateRoom: 0,
            gloves: 0,
            deposit: 0,
            fines: 0,
            electricity: 0,
            gas: 0,
            internet: 0,
            water: 0,
            totalDeduction: 0
        };
    }, []);

    useEffect(() => {
        if (canUseAdvanceManagement !== true) return;

        let isCancelled = false;
        const loadPayrollConfig = async () => {
            try {
                const config = await payrollConfigService.getConfigFromServer();
                if (isCancelled) return;
                setPayrollConfig(config);
                setDeductionItems([...config.deductionItems].sort((a, b) => a.order - b.order));
            } catch {
                const config = await payrollConfigService.getConfig();
                if (isCancelled) return;
                setPayrollConfig(config);
                setDeductionItems([...config.deductionItems].sort((a, b) => a.order - b.order));
            }
        };

        void loadPayrollConfig();
        return () => {
            isCancelled = true;
        };
    }, [canUseAdvanceManagement]);

    // 1. Load Initial Teams/Companies
    useEffect(() => {
        if (canUseAdvanceManagement !== true) return;
        loadTeams();
    }, [canUseAdvanceManagement]);

    const loadTeams = async () => {
        try {
            const [teamList, constructionCompanies] = await Promise.all([
                teamService.getTeams(),
                companyService.getCompaniesByType('시공사')
            ]);

            const constructionCompanyIdSet = new Set(
                constructionCompanies
                    .map((c) => c.id)
                    .filter((id): id is string => Boolean(id))
            );
            const constructionCompanyNameSet = new Set(constructionCompanies.map((c) => c.name));
            const constructionCompanyNameById = new Map(
                constructionCompanies
                    .map((c) => (c.id ? ([c.id, c.name] as const) : null))
                    .filter((entry): entry is readonly [string, string] => entry !== null)
            );

            const allowedTeams = teamList.filter((team) => {
                if (team.companyId) return constructionCompanyIdSet.has(team.companyId);
                if (team.companyName) return constructionCompanyNameSet.has(team.companyName);
                return false;
            });

            const formattedTeams = allowedTeams.map((team) => ({
                id: team.id || '',
                name: team.name,
                companyName:
                    team.companyName ||
                    (team.companyId ? constructionCompanyNameById.get(team.companyId) : undefined) ||
                    '기타'
            }));
            setTeams(formattedTeams);

            const uniqueCompanies = Array.from(new Set(formattedTeams.map((t) => t.companyName))).sort((a, b) =>
                a.localeCompare(b, 'ko-KR')
            );
            setCompanies(uniqueCompanies);

            if (uniqueCompanies.length > 0) {
                setSelectedCompany((prev) => (uniqueCompanies.includes(prev) ? prev : uniqueCompanies[0]));
            } else {
                setSelectedCompany('');
            }
        } catch (error) {
            console.error("Failed to load teams:", error);
        }
    };

    // Filter Teams by Company
    const filteredTeams = teams.filter(team => team.companyName === selectedCompany);

    // Auto-select first team
    useEffect(() => {
        if (filteredTeams.length > 0 && !filteredTeams.find(t => t.id === selectedTeamId)) {
            setSelectedTeamId(filteredTeams[0].id);
        } else if (filteredTeams.length === 0) {
            setSelectedTeamId('');
        }
    }, [selectedCompany, teams]);

    // 2. Load Data (Workers + Existing Advances)
    const handleSearch = useCallback(async () => {
        if (canUseAdvanceManagement !== true) {
            Swal.fire('알림', '시공사 계정만 가불 및 공제 관리를 사용할 수 있습니다.', 'warning');
            return;
        }

        if (!selectedTeamId || !selectedMonth) {
            Swal.fire('알림', '팀과 월을 선택해주세요.', 'warning');
            return;
        }

        const isAllowedTeam = filteredTeams.some((team) => team.id === selectedTeamId);
        if (!isAllowedTeam) {
            Swal.fire('알림', '시공사 소속 팀만 조회할 수 있습니다.', 'warning');
            return;
        }

        setLoading(true);
        setHasChanges(false);
        try {
            const allWorkers = await manpowerService.getWorkers();
            const teamWorkers = allWorkers.filter(w => w.teamId === selectedTeamId);

            const [yearStr, monthStr] = selectedMonth.split('-');
            const existingAdvances = await advancePaymentService.getAdvancePayments(
                parseInt(yearStr),
                parseInt(monthStr),
                selectedTeamId
            );

            const advancesMap: { [key: string]: AdvancePayment } = {};

            existingAdvances.forEach(record => {
                const normalizedRecord: AdvancePayment = {
                    ...record,
                    privateRoom: record.privateRoom ?? 0,
                    items: record.items ?? {}
                };

                advancesMap[record.workerId] = {
                    ...normalizedRecord,
                    totalDeduction: calculateTotalDeduction(normalizedRecord)
                };
            });

            teamWorkers.forEach(w => {
                if (!advancesMap[w.id!]) {
                    advancesMap[w.id!] = createEmptyAdvance(w, selectedTeamId, selectedMonth);
                }
            });

            setWorkers(teamWorkers);
            setAdvances(advancesMap);

        } catch (error) {
            console.error("Error loading data:", error);
            Swal.fire('오류', '데이터를 불러오는 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    }, [calculateTotalDeduction, canUseAdvanceManagement, createEmptyAdvance, filteredTeams, selectedMonth, selectedTeamId]);

    useEffect(() => {
        if (didApplyQueryRef.current) return;
        if (canUseAdvanceManagement !== true) return;
        if (teams.length === 0) return;

        if (!queryTeamId && !queryYearMonth && !queryHighlightWorkerId) {
            didApplyQueryRef.current = true;
            return;
        }

        if (queryTeamId) {
            const matchedTeam = teams.find((t) => t.id === queryTeamId);
            if (matchedTeam?.companyName) {
                setSelectedCompany(matchedTeam.companyName);
            }
            setSelectedTeamId(queryTeamId);
        }

        if (queryYearMonth) {
            setSelectedMonth(queryYearMonth);
        }

        if (queryHighlightWorkerId) {
            setHighlightWorkerId(queryHighlightWorkerId);
        }

        setAutoSearchRequested(true);
        didApplyQueryRef.current = true;
    }, [canUseAdvanceManagement, queryHighlightWorkerId, queryTeamId, queryYearMonth, teams]);

    useEffect(() => {
        if (!autoSearchRequested) return;
        if (!selectedTeamId || !selectedMonth) return;
        if (!filteredTeams.some((t) => t.id === selectedTeamId)) return;

        void handleSearch();
        setAutoSearchRequested(false);
    }, [autoSearchRequested, filteredTeams, handleSearch, selectedMonth, selectedTeamId]);

    useEffect(() => {
        if (!highlightWorkerId) return;
        if (workers.length === 0) return;

        const target = highlightedRowRef.current;
        if (!target) return;

        requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }, [highlightWorkerId, workers.length]);

    // 3. Input Handling
    const handleDeductionChange = useCallback((workerId: string, deductionId: string, value: string) => {
        const numVal = parseInt(value) || 0;

        setAdvances(prev => {
            const current = prev[workerId];
            if (!current) return prev;

            let updated: AdvancePayment;
            if (isLegacyDeductionFieldId(deductionId)) {
                updated = { ...current, [deductionId]: numVal };
            } else {
                const nextItems = { ...(current.items ?? {}), [deductionId]: numVal };
                updated = { ...current, items: nextItems };
            }

            updated.totalDeduction = calculateTotalDeduction(updated);
            return { ...prev, [workerId]: updated };
        });

        setHasChanges(true);
    }, [calculateTotalDeduction]);

    // 4. Save Logic
    const handleSave = async () => {
        setSaving(true);
        try {
            // Save all records in the map
            const promises = Object.values(advances).map(record => {
                const cleanedItems = record.items
                    ? Object.fromEntries(
                        Object.entries(record.items).filter(([key]) => !isLegacyDeductionFieldId(key))
                    )
                    : {};

                const normalized: AdvancePayment = {
                    ...record,
                    items: cleanedItems
                };

                normalized.totalDeduction = calculateTotalDeduction(normalized);
                return advancePaymentService.saveAdvancePayment(normalized);
            });

            await Promise.all(promises);

            Swal.fire({
                icon: 'success',
                title: '저장 완료',
                text: '가불 내역이 저장되었습니다.',
                timer: 1500,
                showConfirmButton: false
            });
            setHasChanges(false);
        } catch (error) {
            console.error("Save failed:", error);
            Swal.fire('오류', '저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAddDeductionItem = useCallback(() => {
        const label = newDeductionLabel.trim();
        if (!label) return;

        const maxOrder = deductionItems.reduce((max, item) => Math.max(max, item.order), 0);
        const id = `custom_${Date.now()}`;

        setDeductionItems(prev => [...prev, { id, label, order: maxOrder + 1, isActive: true }]);
        setNewDeductionLabel('');
    }, [deductionItems, newDeductionLabel]);

    const handleUpdateDeductionItem = useCallback((id: string, patch: Partial<Pick<PayrollDeductionItem, 'label' | 'isActive'>>) => {
        setDeductionItems(prev =>
            prev.map(item => {
                if (item.id !== id) return item;
                return {
                    ...item,
                    ...(patch.label !== undefined ? { label: patch.label } : {}),
                    ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {})
                };
            })
        );
    }, []);

    const handleDeleteDeductionItem = useCallback(async (id: string) => {
        const item = deductionItems.find((x) => x.id === id);
        const label = item?.label ?? '공제항목';
        const result = await Swal.fire({
            icon: 'warning',
            title: '삭제 확인',
            text: `${label} 항목을 삭제할까요?`,
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        });

        if (!result.isConfirmed) return;
        setDeductionItems(prev => prev.filter(item => item.id !== id));
    }, [deductionItems]);

    const handleSaveDeductionConfig = useCallback(async () => {
        setConfigSaving(true);
        try {
            const hasInvalidLabel = deductionItems.some((item) => !item.label.trim());
            if (hasInvalidLabel) {
                await Swal.fire('알림', '공제항목 이름은 비어있을 수 없습니다.', 'warning');
                return;
            }

            const idCounts = new Map<string, number>();
            deductionItems.forEach((item) => {
                const id = item.id.trim();
                if (!id) return;
                idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
            });
            const duplicatedIds = Array.from(idCounts.entries())
                .filter(([, count]) => count > 1)
                .map(([id]) => id);
            if (duplicatedIds.length > 0) {
                await Swal.fire('알림', `공제항목 ID가 중복되었습니다.\n${duplicatedIds.slice(0, 5).join(', ')}`, 'warning');
                return;
            }

            const normalizedItems = [...deductionItems]
                .map((item) => ({ ...item, label: item.label.trim(), id: item.id.trim() }))
                .sort((a, b) => a.order - b.order);

            await payrollConfigService.updateDeductionItems(normalizedItems);
            const latest = await payrollConfigService.getConfigFromServer();

            const requestedIds = new Set(normalizedItems.map((item) => item.id));
            const persistedIds = new Set(latest.deductionItems.map((item) => item.id));
            const missingIds = Array.from(requestedIds).filter((id) => !persistedIds.has(id));

            setPayrollConfig(latest);
            setDeductionItems([...latest.deductionItems].sort((a, b) => a.order - b.order));

            if (missingIds.length > 0) {
                await Swal.fire('경고', `일부 공제항목이 서버에 반영되지 않았습니다.\n${missingIds.slice(0, 5).join(', ')}`, 'warning');
                return;
            }

            Swal.fire({
                icon: 'success',
                title: '저장 완료',
                text: '공제항목 설정이 저장되었습니다.',
                timer: 1200,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Failed to save deduction config:', error);
            const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : '';
            const message = typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : '';
            const detail = code ? ` (${code})` : '';
            const suffix = message ? `\n${message}` : '';
            Swal.fire('오류', `공제항목 설정 저장 중 오류가 발생했습니다.${detail}${suffix}`, 'error');
        } finally {
            setConfigSaving(false);
        }
    }, [deductionItems]);

    const renderDeductionInput = (workerId: string, deductionId: string) => (
        <input
            type="number"
            value={getDeductionValue(advances[workerId], deductionId) || 0}
            onChange={(e) => handleDeductionChange(workerId, deductionId, e.target.value)}
            className="w-full bg-transparent text-right outline-none focus:bg-blue-50 focus:ring-2 focus:ring-blue-500 rounded px-1 transition-colors"
            onFocus={(e) => e.target.select()}
        />
    );

    if (canUseAdvanceManagement === null) {
        return (
            <div className="p-4 md:p-8 max-w-[1800px] mx-auto min-h-screen">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6 text-slate-700">
                    권한을 확인하는 중입니다...
                </div>
            </div>
        );
    }

    if (canUseAdvanceManagement === false) {
        return (
            <div className="p-4 md:p-8 max-w-[1800px] mx-auto min-h-screen">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6 text-slate-700">
                    시공사 계정만 가불 및 공제 관리를 사용할 수 있습니다.
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-[1800px] mx-auto min-h-screen">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <FontAwesomeIcon icon={faCalculator} className="text-blue-600" />
                가불 및 공제 관리
            </h1>

            {/* Control Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-end gap-4 sticky top-20 z-10">
                {/* Filters */}
                <div className="flex flex-wrap gap-4 flex-1">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">회사</label>
                        <select
                            value={selectedCompany}
                            onChange={(e) => setSelectedCompany(e.target.value)}
                            className="w-40 border-slate-300 rounded-lg text-sm"
                        >
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">팀</label>
                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-48 border-slate-300 rounded-lg text-sm"
                        >
                            <option value="">팀 선택</option>
                            {filteredTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">적용 월</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="border-slate-300 rounded-lg text-sm"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsDeductionSettingsOpen((prev) => !prev)}
                        className={`px-4 py-2 rounded-lg font-bold border shadow-sm flex items-center gap-2 self-end h-[38px] transition ${isDeductionSettingsOpen
                            ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                            : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-100'
                            }`}
                    >
                        공제항목(공통)
                    </button>
                    <button
                        onClick={handleSearch}
                        className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2 self-end h-[38px]"
                    >
                        {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSearch} />}
                        조회
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-bold shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
                    >
                        {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        저장 ({Object.keys(advances).length}명)
                    </button>
                </div>
            </div>

            {isDeductionSettingsOpen && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="font-bold text-slate-800">공제항목(공통) 설정</div>
                        <button
                            onClick={handleSaveDeductionConfig}
                            disabled={configSaving}
                            className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {configSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                            공제항목 저장
                        </button>
                    </div>

                    <div className="mt-4 flex flex-col md:flex-row gap-2">
                        <input
                            value={newDeductionLabel}
                            onChange={(e) => setNewDeductionLabel(e.target.value)}
                            placeholder="새 공제항목 이름"
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <button
                            onClick={handleAddDeductionItem}
                            disabled={!newDeductionLabel.trim()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            추가
                        </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {deductionItems
                            .slice()
                            .sort((a, b) => a.order - b.order)
                            .map((item) => (
                                <div key={item.id} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                                    <input
                                        value={item.label}
                                        onChange={(e) => handleUpdateDeductionItem(item.id, { label: e.target.value })}
                                        className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm"
                                    />
                                    <label className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={item.isActive}
                                            onChange={(e) => handleUpdateDeductionItem(item.id, { isActive: e.target.checked })}
                                        />
                                        사용
                                    </label>
                                    <button
                                        onClick={() => void handleDeleteDeductionItem(item.id)}
                                        className="text-xs font-bold text-rose-600 hover:text-rose-700 whitespace-nowrap"
                                    >
                                        삭제
                                    </button>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Data Grid */}
            <div className="bg-white rounded-xl shadow border border-slate-300 overflow-hidden">
                <div className="overflow-x-auto max-h-[700px]">
                    <table className="w-full text-sm border-collapse relative">
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-bold text-center border-b border-slate-300">
                                <th className="p-3 border-r border-slate-300 min-w-[50px] sticky left-0 bg-slate-100 z-10">No</th>
                                <th className="p-3 border-r border-slate-300 min-w-[100px] sticky left-[50px] bg-slate-100 z-10">이름</th>
                                <th className="p-3 border-r border-slate-300 min-w-[80px]">직책</th>

                                {activeDeductionItems.map((item) => (
                                    <th key={item.id} className={getDeductionHeaderClassName(item.id)}>
                                        {item.label}
                                    </th>
                                ))}

                                <th className="p-3 min-w-[120px] bg-slate-200 sticky right-0 z-10">공제 합계</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {workers.length === 0 ? (
                                <tr>
                                    <td colSpan={activeDeductionItems.length + 4} className="p-10 text-center text-slate-400">
                                        {loading ? '데이터를 불러오는 중입니다...' : '조회된 데이터가 없습니다.'}
                                    </td>
                                </tr>
                            ) : (
                                workers.map((worker, idx) => {
                                    const isHighlighted = Boolean(worker.id && worker.id === highlightWorkerId);
                                    return (
                                        <tr
                                            key={worker.id}
                                            ref={isHighlighted ? highlightedRowRef : undefined}
                                            className={`hover:bg-slate-50 transition-colors group relative ${isHighlighted ? 'bg-amber-50 ring-2 ring-amber-300' : ''}`}
                                        >
                                            <td className="p-2 text-center border-r border-slate-200 bg-slate-50 sticky left-0 z-5 font-medium">{idx + 1}</td>
                                            <td className="p-2 text-center border-r border-slate-200 font-bold text-slate-700 sticky left-[50px] bg-white group-hover:bg-slate-50 z-5">
                                                {worker.name}
                                            </td>
                                            <td className="p-2 text-center border-r border-slate-200 text-slate-500 text-xs">
                                                {worker.role}
                                            </td>

                                            {activeDeductionItems.map((item) => (
                                                <td key={item.id} className={getDeductionCellClassName(item.id)}>
                                                    {renderDeductionInput(worker.id!, item.id)}
                                                </td>
                                            ))}

                                            {/* Total */}
                                            <td className="p-2 text-right font-bold text-red-600 bg-slate-50 sticky right-0 z-5">
                                                {(advances[worker.id!]?.totalDeduction || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {workers.length > 0 && (
                            <tfoot className="sticky bottom-0 bg-slate-800 text-white font-bold z-20">
                                <tr>
                                    <td colSpan={3} className="p-3 text-center sticky left-0 z-20 bg-slate-800">전체 합계</td>

                                    {activeDeductionItems.map((item) => (
                                        <td key={item.id} className="p-3 text-right">
                                            {workers
                                                .filter((w) => Boolean(w.id))
                                                .reduce((sum, w) => sum + getDeductionValue(advances[w.id!], item.id), 0)
                                                .toLocaleString()}
                                        </td>
                                    ))}

                                    <td className="p-3 text-right text-amber-400 sticky right-0 bg-slate-800 z-20">
                                        {workers.reduce((sum, w) => sum + (advances[w.id!]?.totalDeduction || 0), 0).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <div className="mt-4 text-xs text-slate-500">
                * 숫자를 입력하면 자동으로 합계가 계산됩니다. 입력 후 반드시 [저장] 버튼을 눌러주세요.
            </div>
        </div>
    );
};

export default AdvancePaymentPage;
