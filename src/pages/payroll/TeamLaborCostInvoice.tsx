import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { payrollService, PayrollData } from '../../services/payrollService';
import { advancePaymentService, AdvancePayment } from '../../services/advancePaymentService';
import { payrollConfigService, PayrollConfig, PayrollDeductionItem } from '../../services/payrollConfigService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSearch, faCalculator, faDownload } from '@fortawesome/free-solid-svg-icons';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';

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

interface Props {
    hideHeader?: boolean;
}

const TeamLaborCostInvoice: React.FC<Props> = ({ hideHeader }) => {
    const [loading, setLoading] = useState(false);
    const [teams, setTeams] = useState<{ id: string; name: string; companyName: string }[]>([]);
    const [companies, setCompanies] = useState<string[]>([]);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
    const [advanceData, setAdvanceData] = useState<{ [workerId: string]: AdvancePayment }>({});
    const [isSearched, setIsSearched] = useState(false);

    const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
    const [deductionItems, setDeductionItems] = useState<PayrollDeductionItem[]>([]);
    const [taxRatePercentInput, setTaxRatePercentInput] = useState('');
    const [configSaving, setConfigSaving] = useState(false);
    const [insuranceConfigSaving, setInsuranceConfigSaving] = useState(false);
    const [deductionConfigSaving, setDeductionConfigSaving] = useState(false);
    const [newDeductionLabel, setNewDeductionLabel] = useState('');

    const [insuranceThresholdDaysInput, setInsuranceThresholdDaysInput] = useState('');
    const [pensionRatePercentInput, setPensionRatePercentInput] = useState('');
    const [healthRatePercentInput, setHealthRatePercentInput] = useState('');
    const [careRateOfHealthPercentInput, setCareRateOfHealthPercentInput] = useState('');
    const [employmentRatePercentInput, setEmploymentRatePercentInput] = useState('');

    // Split Mode State (Optional feature from design)
    const [isSplitMode, setIsSplitMode] = useState(false);
    const [splitThreshold, setSplitThreshold] = useState(8);

    const [searchParams] = useSearchParams();

    // 4 Major Insurance Toggle
    const [isInsuranceMode, setIsInsuranceMode] = useState(false);

    const [isTaxSettingsOpen, setIsTaxSettingsOpen] = useState(false);
    const [isInsuranceSettingsOpen, setIsInsuranceSettingsOpen] = useState(false);
    const [isDeductionSettingsOpen, setIsDeductionSettingsOpen] = useState(false);

    const resetSearchState = useCallback(
        (nextCompany: string, nextTeamId: string, nextMonth: string) => {
            const didChangeScope = nextCompany !== selectedCompany || nextTeamId !== selectedTeamId || nextMonth !== selectedMonth;
            if (!didChangeScope) return;
            setPayrollData([]);
            setAdvanceData({});
            setIsSearched(false);
        },
        [selectedCompany, selectedMonth, selectedTeamId]
    );

    const activeDeductionItems = useMemo(() => {
        return [...deductionItems]
            .filter((item) => item.isActive)
            .sort((a, b) => a.order - b.order);
    }, [deductionItems]);

    const sortedDeductionItems = useMemo(() => {
        return [...deductionItems].sort((a, b) => a.order - b.order);
    }, [deductionItems]);

    const effectiveTaxRate = useMemo(() => {
        return payrollConfig?.taxRate ?? 0.033;
    }, [payrollConfig?.taxRate]);

    const taxRateLabel = useMemo(() => {
        const percent = effectiveTaxRate * 100;
        const rounded = Math.round(percent * 10) / 10;
        return `${rounded}%`;
    }, [effectiveTaxRate]);

    const effectiveInsuranceConfig = useMemo(() => {
        return (
            payrollConfig?.insuranceConfig ?? {
                thresholdDays: 8,
                pensionRate: 0.045,
                healthRate: 0.03545,
                careRateOfHealth: 0.1295,
                employmentRate: 0.009
            }
        );
    }, [payrollConfig?.insuranceConfig]);

    const getDeductionValue = useCallback((advance: AdvancePayment | undefined, deductionId: string): number => {
        if (!advance) return 0;
        if (isLegacyDeductionFieldId(deductionId)) {
            return (advance[deductionId] as number | undefined) ?? 0;
        }
        return advance.items?.[deductionId] ?? 0;
    }, []);

    const calculateAdvanceDeduction = useCallback((advance: AdvancePayment | undefined): number => {
        if (!advance) return 0;
        return activeDeductionItems.reduce((sum, item) => sum + getDeductionValue(advance, item.id), 0);
    }, [activeDeductionItems, getDeductionValue]);

    const getDeductionHeaderClassName = useCallback((deductionId: string): string => {
        if (deductionId === 'prevMonthCarryover') return 'p-1 border-r border-slate-300 bg-amber-50';
        if (deductionId === 'accommodation') return 'p-1 border-r border-slate-300 bg-blue-50';
        if (deductionId === 'privateRoom') return 'p-1 border-r border-slate-300 bg-violet-50';
        return 'p-1 border-r border-slate-300';
    }, []);

    const getDeductionCellClassName = useCallback((deductionId: string): string => {
        if (deductionId === 'prevMonthCarryover') return 'p-1 text-right border-r border-slate-200 text-amber-600 bg-amber-50/30 tex-xs';
        if (deductionId === 'accommodation') return 'p-1 text-right border-r border-slate-200 text-blue-600 bg-blue-50/30 text-xs';
        if (deductionId === 'privateRoom') return 'p-1 text-right border-r border-slate-200 text-violet-600 bg-violet-50/30 text-xs';
        return 'p-1 text-right border-r border-slate-200 text-slate-500 text-[10px]';
    }, []);

    const handleSaveTaxRate = useCallback(async () => {
        const raw = taxRatePercentInput.trim();
        const parsedPercent = Number(raw);
        if (!Number.isFinite(parsedPercent) || parsedPercent < 0) {
            await Swal.fire('알림', '0 이상의 숫자를 입력해주세요.', 'warning');
            return;
        }

        const nextRate = parsedPercent / 100;

        setConfigSaving(true);
        try {
            await payrollConfigService.updateTaxRate(nextRate);
            const latest = await payrollConfigService.getConfig();
            setPayrollConfig(latest);
            setDeductionItems([...latest.deductionItems].sort((a, b) => a.order - b.order));
            setTaxRatePercentInput(String(Math.round(latest.taxRate * 1000) / 10));

            Swal.fire({
                icon: 'success',
                title: '적용 완료',
                text: `세금요율 ${parsedPercent}% 가 저장되었습니다.`,
                timer: 1200,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Failed to save tax rate:', error);
            const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : '';
            const message = typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : '';
            const detail = code ? ` (${code})` : '';
            const suffix = message ? `\n${message}` : '';
            Swal.fire('오류', `세금요율 저장 중 오류가 발생했습니다.${detail}${suffix}`, 'error');
        } finally {
            setConfigSaving(false);
        }
    }, [taxRatePercentInput]);

    const handleSaveInsuranceConfig = useCallback(async () => {
        const thresholdDays = Math.floor(Number(insuranceThresholdDaysInput));
        if (!Number.isFinite(thresholdDays) || thresholdDays <= 0) {
            await Swal.fire('알림', '보험 적용 기준 공수는 1 이상의 숫자여야 합니다.', 'warning');
            return;
        }

        const pensionPercent = Number(pensionRatePercentInput);
        const healthPercent = Number(healthRatePercentInput);
        const carePercent = Number(careRateOfHealthPercentInput);
        const employmentPercent = Number(employmentRatePercentInput);

        const allPercentValues = [pensionPercent, healthPercent, carePercent, employmentPercent];
        if (allPercentValues.some((v) => !Number.isFinite(v) || v < 0)) {
            await Swal.fire('알림', '보험 요율은 0 이상의 숫자여야 합니다.', 'warning');
            return;
        }

        const nextInsuranceConfig = {
            thresholdDays,
            pensionRate: pensionPercent / 100,
            healthRate: healthPercent / 100,
            careRateOfHealth: carePercent / 100,
            employmentRate: employmentPercent / 100
        };

        setInsuranceConfigSaving(true);
        try {
            await payrollConfigService.updateInsuranceConfig(nextInsuranceConfig);
            const latest = await payrollConfigService.getConfig();
            const serverLatest = await payrollConfigService.getConfigFromServer();
            setPayrollConfig(latest);
            setDeductionItems([...latest.deductionItems].sort((a, b) => a.order - b.order));
            setTaxRatePercentInput(String(Math.round(latest.taxRate * 1000) / 10));

            setInsuranceThresholdDaysInput(String(latest.insuranceConfig.thresholdDays));
            setPensionRatePercentInput(String(Math.round(latest.insuranceConfig.pensionRate * 10000) / 100));
            setHealthRatePercentInput(String(Math.round(latest.insuranceConfig.healthRate * 100000) / 1000));
            setCareRateOfHealthPercentInput(String(Math.round(latest.insuranceConfig.careRateOfHealth * 100000) / 1000));
            setEmploymentRatePercentInput(String(Math.round(latest.insuranceConfig.employmentRate * 100000) / 1000));

            const mismatch =
                serverLatest.insuranceConfig.thresholdDays !== nextInsuranceConfig.thresholdDays ||
                serverLatest.insuranceConfig.pensionRate !== nextInsuranceConfig.pensionRate ||
                serverLatest.insuranceConfig.healthRate !== nextInsuranceConfig.healthRate ||
                serverLatest.insuranceConfig.careRateOfHealth !== nextInsuranceConfig.careRateOfHealth ||
                serverLatest.insuranceConfig.employmentRate !== nextInsuranceConfig.employmentRate;

            if (mismatch) {
                setPayrollConfig(serverLatest);
                setDeductionItems([...serverLatest.deductionItems].sort((a, b) => a.order - b.order));
                setTaxRatePercentInput(String(Math.round(serverLatest.taxRate * 1000) / 10));

                setInsuranceThresholdDaysInput(String(serverLatest.insuranceConfig.thresholdDays));
                setPensionRatePercentInput(String(Math.round(serverLatest.insuranceConfig.pensionRate * 10000) / 100));
                setHealthRatePercentInput(String(Math.round(serverLatest.insuranceConfig.healthRate * 100000) / 1000));
                setCareRateOfHealthPercentInput(String(Math.round(serverLatest.insuranceConfig.careRateOfHealth * 100000) / 1000));
                setEmploymentRatePercentInput(String(Math.round(serverLatest.insuranceConfig.employmentRate * 100000) / 1000));

                await Swal.fire(
                    '경고',
                    '저장은 요청했지만, 서버 문서(settings/payroll_config_v1)에 값이 반영되지 않았습니다.\nFirestore Rules(권한) 또는 오프라인 캐시 상태를 확인해주세요.',
                    'warning'
                );
                return;
            }

            Swal.fire({
                icon: 'success',
                title: '저장 완료',
                text: '4대보험 요율이 저장되었습니다.',
                timer: 1200,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Failed to save insurance config:', error);
            const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : '';
            const message = typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : '';
            const detail = code ? ` (${code})` : '';
            const suffix = message ? `\n${message}` : '';
            Swal.fire('오류', `4대보험 요율 저장 중 오류가 발생했습니다.${detail}${suffix}`, 'error');
        } finally {
            setInsuranceConfigSaving(false);
        }
    }, [
        careRateOfHealthPercentInput,
        employmentRatePercentInput,
        healthRatePercentInput,
        insuranceThresholdDaysInput,
        pensionRatePercentInput
    ]);

    const handleAddDeductionItem = useCallback(() => {
        const label = newDeductionLabel.trim();
        if (!label) return;

        setDeductionItems((prev) => {
            const maxOrder = prev.reduce((max, item) => Math.max(max, item.order), 0);
            const id = `custom_${Date.now()}`;
            return [...prev, { id, label, order: maxOrder + 1, isActive: true }];
        });
        setNewDeductionLabel('');
    }, [newDeductionLabel]);

    const handleUpdateDeductionItem = useCallback(
        (id: string, patch: Partial<Pick<PayrollDeductionItem, 'label' | 'isActive'>>) => {
            setDeductionItems((prev) =>
                prev.map((item) => {
                    if (item.id !== id) return item;
                    return {
                        ...item,
                        ...(patch.label !== undefined ? { label: patch.label } : {}),
                        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {})
                    };
                })
            );
        },
        []
    );

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
        setDeductionItems((prev) => prev.filter((x) => x.id !== id));
    }, [deductionItems]);

    const handleSaveDeductionConfig = useCallback(async () => {
        const hasInvalidLabel = deductionItems.some((item) => !item.label.trim());
        if (hasInvalidLabel) {
            await Swal.fire('알림', '공제항목 이름은 비어있을 수 없습니다.', 'warning');
            return;
        }

        setDeductionConfigSaving(true);
        try {
            const normalizedItems = [...deductionItems].map((item) => ({ ...item, label: item.label.trim() })).sort((a, b) => a.order - b.order);
            await payrollConfigService.updateDeductionItems(normalizedItems);
            const latest = await payrollConfigService.getConfig();
            setPayrollConfig(latest);
            setDeductionItems([...latest.deductionItems].sort((a, b) => a.order - b.order));
            setTaxRatePercentInput(String(Math.round(latest.taxRate * 1000) / 10));
            setInsuranceThresholdDaysInput(String(latest.insuranceConfig.thresholdDays));
            setPensionRatePercentInput(String(Math.round(latest.insuranceConfig.pensionRate * 10000) / 100));
            setHealthRatePercentInput(String(Math.round(latest.insuranceConfig.healthRate * 100000) / 1000));
            setCareRateOfHealthPercentInput(String(Math.round(latest.insuranceConfig.careRateOfHealth * 100000) / 1000));
            setEmploymentRatePercentInput(String(Math.round(latest.insuranceConfig.employmentRate * 100000) / 1000));

            Swal.fire({
                icon: 'success',
                title: '저장 완료',
                text: '공제항목(공통) 설정이 저장되었습니다.',
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
            setDeductionConfigSaving(false);
        }
    }, [deductionItems]);

    useEffect(() => {
        loadTeams();
        if (searchParams.get('mode') === 'insurance') {
            setIsInsuranceMode(true);
        }
    }, [searchParams]);

    const handleChangeCompany = useCallback(
        (nextCompany: string) => {
            const candidateTeams = teams.filter((team) => team.companyName === nextCompany);
            const fallbackTeamId = candidateTeams[0]?.id ?? '';
            const nextTeamId =
                selectedTeamId && candidateTeams.some((t) => t.id === selectedTeamId) ? selectedTeamId : fallbackTeamId;

            setSelectedCompany(nextCompany);
            setSelectedTeamId(nextTeamId);
            resetSearchState(nextCompany, nextTeamId, selectedMonth);
        },
        [resetSearchState, selectedMonth, selectedTeamId, teams]
    );

    const handleChangeTeam = useCallback(
        (nextTeamId: string) => {
            setSelectedTeamId(nextTeamId);
            resetSearchState(selectedCompany, nextTeamId, selectedMonth);
        },
        [resetSearchState, selectedCompany, selectedMonth]
    );

    const handleChangeMonth = useCallback(
        (nextMonth: string) => {
            setSelectedMonth(nextMonth);
            resetSearchState(selectedCompany, selectedTeamId, nextMonth);
        },
        [resetSearchState, selectedCompany, selectedTeamId]
    );

    useEffect(() => {
        let isCancelled = false;
        const loadPayrollConfig = async () => {
            const config = await payrollConfigService.getConfig();
            if (isCancelled) return;
            setPayrollConfig(config);
            setDeductionItems([...config.deductionItems].sort((a, b) => a.order - b.order));
            setTaxRatePercentInput(String(Math.round(config.taxRate * 1000) / 10));

            setInsuranceThresholdDaysInput(String(config.insuranceConfig.thresholdDays));
            setPensionRatePercentInput(String(Math.round(config.insuranceConfig.pensionRate * 10000) / 100));
            setHealthRatePercentInput(String(Math.round(config.insuranceConfig.healthRate * 100000) / 1000));
            setCareRateOfHealthPercentInput(String(Math.round(config.insuranceConfig.careRateOfHealth * 100000) / 1000));
            setEmploymentRatePercentInput(String(Math.round(config.insuranceConfig.employmentRate * 100000) / 1000));
        };

        void loadPayrollConfig();
        return () => {
            isCancelled = true;
        };
    }, []);

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
            console.error("Error loading teams:", error);
        }
    };

    const filteredTeams = useMemo(() => {
        return teams.filter((team) => team.companyName === selectedCompany);
    }, [selectedCompany, teams]);

    useEffect(() => {
        if (filteredTeams.length > 0) {
            if (!filteredTeams.find(t => t.id === selectedTeamId)) {
                setSelectedTeamId(filteredTeams[0].id);
            }
        } else {
            setSelectedTeamId('');
        }
    }, [filteredTeams, selectedTeamId]);

    const handleSearch = async () => {
        if (!selectedMonth || !selectedTeamId) {
            Swal.fire('알림', '월과 팀을 선택해주세요.', 'warning');
            return;
        }

        const isAllowedTeam = filteredTeams.some((team) => team.id === selectedTeamId);
        if (!isAllowedTeam) {
            Swal.fire('알림', '시공사 소속 팀만 조회할 수 있습니다.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const [yearStr, monthStr] = selectedMonth.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);

            // 1. Fetch Payroll Data
            const data = await payrollService.getPayrollData(year, month, selectedTeamId);
            setPayrollData(data);

            // 2. Fetch Advance Data (Auto-fetch or explicit? Design said "Click to apply", but user might want auto. Let's make it separate as requested "Apply Advance Payments" button, OR auto-fetch but apply on demand?
            // Actually, "Apply" implies fetching and merging. Let's just reset advanceData on new search.
            setAdvanceData({});

            setIsSearched(true);
        } catch (error) {
            console.error("Error fetching payroll data:", error);
            Swal.fire('오류', '데이터를 불러오는 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyAdvances = async () => {
        if (!selectedMonth || !selectedTeamId) return;

        setLoading(true);
        try {
            const [yearStr, monthStr] = selectedMonth.split('-');
            const advances = await advancePaymentService.getAdvancePayments(
                parseInt(yearStr),
                parseInt(monthStr),
                selectedTeamId
            );

            if (advances.length === 0) {
                setAdvanceData({});
                Swal.fire('알림', '해당 월/팀에 적용할 가불 내역이 없습니다.', 'info');
                return;
            }

            const advanceMap: { [key: string]: AdvancePayment } = {};
            advances.forEach(adv => {
                advanceMap[adv.workerId] = adv;
            });

            setAdvanceData(advanceMap);
            Swal.fire('완료', `가불 내역이 적용되었습니다. (총 ${advances.length}건)`, 'success');
        } catch (error) {
            console.error("Failed to load advances:", error);
            Swal.fire('오류', '가불 내역을 불러오는데 실패했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Process data logic
    const processedData = useMemo(() => {
        if (!payrollData) return [];

        const rows = payrollData.map((row) => {
            let reportedDays = row.gongsu.total;
            let remainingDays = 0;
            let reportedGross = row.grossPay;
            let remainingGross = 0;

            if (isSplitMode) {
                reportedDays = Math.min(row.gongsu.total, splitThreshold);
                remainingDays = row.gongsu.total - reportedDays;
                reportedGross = reportedDays * row.unitPrice;
                remainingGross = remainingDays * row.unitPrice;
            }

            let taxIncome = 0;
            let taxResident = 0;
            let insurance = { pension: 0, health: 0, care: 0, employment: 0 };

            if (isInsuranceMode) {
                const insuranceEligible = reportedDays >= effectiveInsuranceConfig.thresholdDays;
                if (insuranceEligible) {
                    insurance.pension = Math.floor(reportedGross * effectiveInsuranceConfig.pensionRate);
                    insurance.health = Math.floor(reportedGross * effectiveInsuranceConfig.healthRate);
                    insurance.care = Math.floor(insurance.health * effectiveInsuranceConfig.careRateOfHealth);
                    insurance.employment = Math.floor(reportedGross * effectiveInsuranceConfig.employmentRate);
                }

                if (isSplitMode && remainingGross > 0) {
                    const totalTax = Math.floor(remainingGross * effectiveTaxRate);
                    taxIncome = Math.floor(totalTax / 1.1);
                    taxResident = Math.max(0, totalTax - taxIncome);
                } else {
                    taxIncome = 0;
                    taxResident = 0;
                }
            } else {
                const totalTax = Math.floor(reportedGross * effectiveTaxRate);
                taxIncome = Math.floor(totalTax / 1.1);
                taxResident = Math.max(0, totalTax - taxIncome);
            }

            // Apply Advance Data if available
            const workerId = row.workerId ?? row.id;
            const adv = workerId ? advanceData[workerId] : undefined;
            const advanceDeduction = calculateAdvanceDeduction(adv);

            const totalDeductions =
                taxIncome + taxResident +
                insurance.pension + insurance.health + insurance.care + insurance.employment +
                advanceDeduction;

            const netPay = row.grossPay - totalDeductions;

            return {
                ...row,
                gongsu: {
                    ...row.gongsu,
                    reported: reportedDays,
                    remaining: remainingDays
                },
                tax: {
                    income: taxIncome,
                    resident: taxResident
                },
                insurance,
                reportedGrossPay: reportedGross,
                advance: adv,
                netPay
            };
        });

        const collator = new Intl.Collator('ko-KR');

        return rows.sort((a, b) => {
            if (isSplitMode) {
                const aNeedsSplit = (a.gongsu.remaining ?? 0) > 0;
                const bNeedsSplit = (b.gongsu.remaining ?? 0) > 0;
                if (aNeedsSplit !== bNeedsSplit) return aNeedsSplit ? -1 : 1;
            }

            if (isInsuranceMode) {
                const aInsuranceEligible = (a.gongsu.reported ?? a.gongsu.total) >= effectiveInsuranceConfig.thresholdDays;
                const bInsuranceEligible = (b.gongsu.reported ?? b.gongsu.total) >= effectiveInsuranceConfig.thresholdDays;
                if (aInsuranceEligible !== bInsuranceEligible) return aInsuranceEligible ? -1 : 1;
            }

            return collator.compare(a.name, b.name);
        });
    }, [advanceData, calculateAdvanceDeduction, effectiveInsuranceConfig.thresholdDays, effectiveInsuranceConfig.careRateOfHealth, effectiveInsuranceConfig.employmentRate, effectiveInsuranceConfig.healthRate, effectiveInsuranceConfig.pensionRate, effectiveTaxRate, isInsuranceMode, isSplitMode, payrollData, splitThreshold]);

    const tableColSpan = useMemo(() => {
        const gongsuCols = isSplitMode ? 3 : 2;
        const taxCols = isInsuranceMode ? 5 : 1;
        const deductionCols = activeDeductionItems.length + 1;
        return 1 + 1 + gongsuCols + 1 + 1 + taxCols + deductionCols + 1;
    }, [activeDeductionItems.length, isInsuranceMode, isSplitMode]);

    return (
        <div className="p-4 md:p-8 max-w-[1800px] mx-auto bg-white rounded-xl shadow-lg mt-10 min-h-screen">
            {!hideHeader && <h1 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-4">팀별 급여 정산 대장</h1>}

            <div className="space-y-6">
                {/* Control Panel */}
                <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2">
                                <div className="text-xs font-bold text-slate-600">회사</div>
                                <select
                                    value={selectedCompany}
                                    onChange={(e) => handleChangeCompany(e.target.value)}
                                    className="h-10 border border-slate-300 rounded-lg px-3 text-sm bg-white shadow-sm"
                                >
                                    {companies.map((company) => (
                                        <option key={company} value={company}>
                                            {company}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="text-xs font-bold text-slate-600">팀</div>
                                <select
                                    value={selectedTeamId}
                                    onChange={(e) => handleChangeTeam(e.target.value)}
                                    className="h-10 border border-slate-300 rounded-lg px-3 text-sm bg-white shadow-sm"
                                >
                                    {filteredTeams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="text-xs font-bold text-slate-600">월</div>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => handleChangeMonth(e.target.value)}
                                    className="h-10 border border-slate-300 rounded-lg px-3 text-sm bg-white shadow-sm"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsInsuranceMode((prev) => !prev)}
                                    className={`h-10 px-3 text-sm font-bold rounded-lg border transition ${isInsuranceMode
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                                        }`}
                                >
                                    4대보험
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsSplitMode((prev) => !prev)}
                                    className={`h-10 px-3 text-sm font-bold rounded-lg border transition ${isSplitMode
                                        ? 'bg-amber-500 border-amber-500 text-white'
                                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                                        }`}
                                >
                                    분리신고
                                </button>

                                {isSplitMode && (
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs font-bold text-slate-600">기준 공수</div>
                                        <input
                                            type="number"
                                            value={splitThreshold}
                                            onChange={(e) => setSplitThreshold(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                                            min={1}
                                            step={1}
                                            className="h-10 w-24 border border-slate-300 rounded-lg px-3 text-sm bg-white shadow-sm"
                                        />
                                    </div>
                                )}

                                <span className="h-10 inline-flex items-center px-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-sm">
                                    세율 {taxRateLabel}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 xl:ml-auto">
                            <button
                                type="button"
                                onClick={() => setIsTaxSettingsOpen((prev) => !prev)}
                                className={`h-10 px-4 rounded-lg font-extrabold shadow-sm border flex items-center gap-2 transition ${isTaxSettingsOpen
                                    ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                                    : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-100'
                                    }`}
                            >
                                세금설정
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsInsuranceSettingsOpen((prev) => !prev)}
                                className={`h-10 px-4 rounded-lg font-extrabold shadow-sm border flex items-center gap-2 transition ${isInsuranceSettingsOpen
                                    ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                                    : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-100'
                                    }`}
                            >
                                4대보험설정
                            </button>

                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="h-10 bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 font-bold shadow-sm flex items-center gap-2 transition"
                            >
                                {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSearch} />}
                                조회
                            </button>

                            {/* New Apple Advances Button */}
                            <button
                                onClick={handleApplyAdvances}
                                disabled={loading || !isSearched}
                                className="h-10 bg-indigo-600 text-white px-4 rounded-lg hover:bg-indigo-700 font-bold shadow-sm flex items-center gap-2 transition disabled:opacity-50"
                            >
                                <FontAwesomeIcon icon={faDownload} />
                                가불 적용
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tax and Insurance Settings */}
                {(isTaxSettingsOpen || isInsuranceSettingsOpen) && (
                    <div
                        className={`grid grid-cols-1 gap-4 ${isTaxSettingsOpen && isInsuranceSettingsOpen ? 'lg:grid-cols-2' : ''
                            }`}
                    >
                        {isTaxSettingsOpen && (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="w-full flex items-center justify-between px-5 py-4 bg-white">
                                    <div className="text-left">
                                        <div className="text-sm font-extrabold text-slate-800">세금 설정</div>
                                        <div className="text-xs text-slate-500 mt-1">현재 {taxRateLabel}</div>
                                    </div>
                                </div>

                                <div className="px-5 pb-5">
                                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-extrabold text-slate-800">세금 요율</div>
                                                <div className="text-xs text-slate-500 mt-1">단위는 % 입니다. 예: 3.3</div>
                                            </div>
                                            <div className="text-xs font-bold text-slate-600">현재 {taxRateLabel}</div>
                                        </div>

                                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="number"
                                                    value={taxRatePercentInput}
                                                    onChange={(e) => setTaxRatePercentInput(e.target.value)}
                                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm pr-10"
                                                    min={0}
                                                    step={0.1}
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setTaxRatePercentInput('3.3')}
                                                    className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                                >
                                                    3.3%
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => void handleSaveTaxRate()}
                                                    disabled={configSaving}
                                                    className="px-3 py-2 text-xs font-extrabold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                                >
                                                    저장
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 leading-relaxed">
                                            <div className="font-bold text-slate-700">세금 적용 규칙</div>
                                            <div className="mt-1">
                                                4대보험 모드 OFF: <span className="font-bold text-slate-800">신고 금액</span>(분리 신고 사용 시 기준 공수까지)에 세금이 적용됩니다.
                                            </div>
                                            <div>
                                                4대보험 모드 ON: <span className="font-bold text-slate-800">미신고 금액</span>(초과분)에만 세금이 적용됩니다.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isInsuranceSettingsOpen && (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="w-full flex items-center justify-between px-5 py-4 bg-white">
                                    <div className="text-left">
                                        <div className="text-sm font-extrabold text-slate-800">4대보험 설정</div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {isInsuranceMode ? `기준 공수 ${effectiveInsuranceConfig.thresholdDays}일` : '4대보험 모드 OFF'}
                                        </div>
                                    </div>
                                </div>

                                <div className="px-5 pb-5">
                                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                                        {isInsuranceMode ? (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="text-sm font-extrabold text-slate-800">4대보험 요율</div>
                                                        <div className="text-xs text-slate-500 mt-1">단위는 % 입니다. 예: 국민 4.5, 건강 3.545</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleSaveInsuranceConfig()}
                                                        disabled={insuranceConfigSaving}
                                                        className="px-3 py-2 text-xs font-extrabold rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                                                    >
                                                        저장
                                                    </button>
                                                </div>

                                                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-600 mb-1">보험 기준 공수</label>
                                                        <input
                                                            type="number"
                                                            value={insuranceThresholdDaysInput}
                                                            onChange={(e) => setInsuranceThresholdDaysInput(e.target.value)}
                                                            className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                                                            min={1}
                                                            step={1}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-600 mb-1">국민(%)</label>
                                                        <input
                                                            type="number"
                                                            value={pensionRatePercentInput}
                                                            onChange={(e) => setPensionRatePercentInput(e.target.value)}
                                                            className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                                                            min={0}
                                                            step={0.01}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-600 mb-1">건강(%)</label>
                                                        <input
                                                            type="number"
                                                            value={healthRatePercentInput}
                                                            onChange={(e) => setHealthRatePercentInput(e.target.value)}
                                                            className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                                                            min={0}
                                                            step={0.001}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-600 mb-1">장기(건강%의 %)</label>
                                                        <input
                                                            type="number"
                                                            value={careRateOfHealthPercentInput}
                                                            onChange={(e) => setCareRateOfHealthPercentInput(e.target.value)}
                                                            className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                                                            min={0}
                                                            step={0.001}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-600 mb-1">고용(%)</label>
                                                        <input
                                                            type="number"
                                                            value={employmentRatePercentInput}
                                                            onChange={(e) => setEmploymentRatePercentInput(e.target.value)}
                                                            className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                                                            min={0}
                                                            step={0.001}
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-extrabold text-slate-800">4대보험 모드가 꺼져 있습니다.</div>
                                                    <div className="text-xs text-slate-500 mt-1">상단에서 4대보험 버튼을 켜면 설정을 저장할 수 있습니다.</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* Ledger Table */}
                {isSearched && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-300 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-center border-b border-slate-300">
                                        <th className="p-2 border-r border-slate-300 w-10" rowSpan={2}>No</th>
                                        <th className="p-2 border-r border-slate-300 w-20" rowSpan={2}>이름</th>
                                        <th className="p-2 border-r border-slate-300 w-20" colSpan={isSplitMode ? 3 : 2}>
                                            공수
                                        </th>
                                        <th className="p-2 border-r border-slate-300 w-20" rowSpan={2}>단가</th>
                                        <th className="p-2 border-r border-slate-300 w-24" rowSpan={2}>총액</th>

                                        {isInsuranceMode ? (
                                            <>
                                                <th className="p-1 border-r border-slate-300 w-14" rowSpan={2}>국민</th>
                                                <th className="p-1 border-r border-slate-300 w-14" rowSpan={2}>건강</th>
                                                <th className="p-1 border-r border-slate-300 w-14" rowSpan={2}>장기</th>
                                                <th className="p-1 border-r border-slate-300 w-14" rowSpan={2}>고용</th>
                                                <th className="p-1 border-r border-slate-300 w-14" rowSpan={2}>세금</th>
                                            </>
                                        ) : (
                                            <th className="p-2 border-r border-slate-300 w-20" rowSpan={2}>세금({taxRateLabel})</th>
                                        )}

                                        {activeDeductionItems.map((item) => (
                                            <th key={item.id} className={getDeductionHeaderClassName(item.id)} rowSpan={2}>
                                                {item.label}
                                            </th>
                                        ))}
                                        <th className="p-1 border-r border-slate-300 w-20 bg-slate-100" rowSpan={2}>공제계</th>

                                        <th className="p-2 w-24 bg-indigo-50 text-indigo-900" rowSpan={2}>실지급액</th>
                                    </tr>
                                    <tr className="bg-slate-50 text-slate-600 text-[10px] font-semibold text-center border-b border-slate-300">
                                        <th className="p-1 border-r border-slate-300 text-blue-600">신고</th>
                                        {isSplitMode && (
                                            <th className="p-1 border-r border-slate-300 text-amber-600 bg-amber-50">미신고</th>
                                        )}
                                        <th className="p-1 border-r border-slate-300 text-slate-500">실제</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {processedData.length === 0 ? (
                                        <tr>
                                            <td colSpan={tableColSpan} className="p-8 text-center text-slate-500">
                                                데이터가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        processedData.map((row, index) => {
                                            const adv = row.advance;
                                            const key = row.workerId ? `${row.workerId}-${index}` : String(index);
                                            return (
                                                <tr key={key} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="p-2 text-center border-r border-slate-200 bg-slate-50 font-medium text-slate-500">
                                                        {index + 1}
                                                    </td>
                                                    <td className="p-2 text-center border-r border-slate-200 font-bold text-slate-700">
                                                        {row.name}
                                                        <div className="text-[9px] font-normal text-slate-400">{row.role}</div>
                                                    </td>

                                                    <td className="p-1 text-center border-r border-slate-200 text-blue-600 font-bold bg-blue-50/20">
                                                        {row.gongsu.reported}
                                                    </td>
                                                    {isSplitMode && (
                                                        <td className="p-1 text-center border-r border-slate-200 text-amber-600 font-bold bg-amber-50/30">
                                                            {row.gongsu.remaining}
                                                        </td>
                                                    )}
                                                    <td className="p-1 text-center border-r border-slate-200 text-slate-600 font-medium">
                                                        {row.gongsu.total}
                                                    </td>

                                                    <td className="p-2 text-right border-r border-slate-200 text-slate-600">
                                                        {row.unitPrice.toLocaleString()}
                                                    </td>
                                                    <td className="p-2 text-right border-r border-slate-200 font-bold text-slate-800 bg-slate-50/50">
                                                        {row.grossPay.toLocaleString()}
                                                    </td>

                                                    {isInsuranceMode ? (
                                                        <>
                                                            <td className="p-1 text-right border-r border-slate-200 text-slate-500 text-[10px]">
                                                                {row.insurance?.pension.toLocaleString() || 0}
                                                            </td>
                                                            <td className="p-1 text-right border-r border-slate-200 text-slate-500 text-[10px]">
                                                                {row.insurance?.health.toLocaleString() || 0}
                                                            </td>
                                                            <td className="p-1 text-right border-r border-slate-200 text-slate-500 text-[10px]">
                                                                {row.insurance?.care.toLocaleString() || 0}
                                                            </td>
                                                            <td className="p-1 text-right border-r border-slate-200 text-slate-500 text-[10px]">
                                                                {row.insurance?.employment.toLocaleString() || 0}
                                                            </td>
                                                            <td className="p-1 text-right border-r border-slate-200 text-slate-500 text-[10px]">
                                                                {(row.tax.income + row.tax.resident).toLocaleString()}
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <td className="p-2 text-right border-r border-slate-200 text-slate-500 text-xs">
                                                            {(row.tax.income + row.tax.resident).toLocaleString()}
                                                        </td>
                                                    )}

                                                    {activeDeductionItems.map((item) => {
                                                        const value = getDeductionValue(adv, item.id);
                                                        return (
                                                            <td key={item.id} className={getDeductionCellClassName(item.id)}>
                                                                {value ? value.toLocaleString() : '-'}
                                                            </td>
                                                        );
                                                    })}

                                                    <td className="p-1 text-right border-r border-slate-200 font-bold text-red-500 bg-slate-50">
                                                        {(() => {
                                                            const taxTotal = row.tax.income + row.tax.resident;
                                                            const insuranceTotal = (row.insurance?.pension || 0) + (row.insurance?.health || 0) + (row.insurance?.care || 0) + (row.insurance?.employment || 0);
                                                            const advTotal = adv ? calculateAdvanceDeduction(adv) : 0;
                                                            const totalDeduction = taxTotal + insuranceTotal + advTotal;
                                                            return totalDeduction > 0 ? totalDeduction.toLocaleString() : '-';
                                                        })()}
                                                    </td>

                                                    <td className="p-2 text-right font-bold text-indigo-700 bg-indigo-50">
                                                        {row.netPay.toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}

                                    {processedData.length > 0 && (
                                        <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-600 text-[11px]">
                                            <td colSpan={2} className="p-2 text-center">합계</td>
                                            <td className="p-2 text-center text-blue-300">
                                                {processedData.reduce((sum, r) => sum + r.gongsu.reported, 0)}
                                            </td>
                                            {isSplitMode && (
                                                <td className="p-2 text-center text-amber-300">
                                                    {processedData.reduce((sum, r) => sum + (r.gongsu.remaining || 0), 0)}
                                                </td>
                                            )}
                                            <td className="p-2 text-center text-slate-300">
                                                {processedData.reduce((sum, r) => sum + r.gongsu.total, 0)}
                                            </td>
                                            <td className="p-2 text-right text-slate-400">-</td>
                                            <td className="p-2 text-right text-amber-300">
                                                {processedData.reduce((sum, r) => sum + r.grossPay, 0).toLocaleString()}
                                            </td>

                                            {isInsuranceMode ? (
                                                <>
                                                    <td className="p-2 text-right text-slate-300">
                                                        {processedData.reduce((sum, r) => sum + (r.insurance?.pension || 0), 0).toLocaleString()}
                                                    </td>
                                                    <td className="p-2 text-right text-slate-300">
                                                        {processedData.reduce((sum, r) => sum + (r.insurance?.health || 0), 0).toLocaleString()}
                                                    </td>
                                                    <td className="p-2 text-right text-slate-300">
                                                        {processedData.reduce((sum, r) => sum + (r.insurance?.care || 0), 0).toLocaleString()}
                                                    </td>
                                                    <td className="p-2 text-right text-slate-300">
                                                        {processedData.reduce((sum, r) => sum + (r.insurance?.employment || 0), 0).toLocaleString()}
                                                    </td>
                                                    <td className="p-2 text-right text-slate-300">
                                                        {processedData.reduce((sum, r) => sum + (r.tax.income + r.tax.resident), 0).toLocaleString()}
                                                    </td>
                                                </>
                                            ) : (
                                                <td className="p-2 text-right text-slate-300">
                                                    {processedData.reduce((sum, r) => sum + r.tax.income + r.tax.resident, 0).toLocaleString()}
                                                </td>
                                            )}

                                            {activeDeductionItems.map((item) => (
                                                <td key={item.id} className="p-2 text-right text-slate-300">
                                                    {processedData
                                                        .reduce((sum, r) => sum + getDeductionValue(r.advance, item.id), 0)
                                                        .toLocaleString()}
                                                </td>
                                            ))}

                                            <td className="p-2 text-right text-red-300 font-bold">
                                                {processedData
                                                    .reduce((sum, r) => {
                                                        const taxTotal = r.tax.income + r.tax.resident;
                                                        const insuranceTotal = (r.insurance?.pension || 0) + (r.insurance?.health || 0) + (r.insurance?.care || 0) + (r.insurance?.employment || 0);
                                                        const advTotal = calculateAdvanceDeduction(r.advance);
                                                        return sum + taxTotal + insuranceTotal + advTotal;
                                                    }, 0)
                                                    .toLocaleString()}
                                            </td>

                                            <td className="p-2 text-right text-emerald-300 text-lg">
                                                {processedData.reduce((sum, r) => sum + r.netPay, 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!isSearched && (
                    <div className="text-center py-20 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <FontAwesomeIcon icon={faCalculator} className="text-4xl mb-4 text-slate-300" />
                        <p className="text-xl mb-2">조회 버튼을 눌러주세요.</p>
                        <p>팀과 월을 선택하고 조회하면 급여 정산 대장이 표시됩니다.</p>
                    </div>
                )}
            </div>

            {/* Detailed Usage Guide */}
            <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalculator} className="text-blue-600" />
                    급여 정산 시스템 사용 가이드
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Logic Section */}
                    <div>
                        <h4 className="font-bold text-slate-700 mb-2 border-b pb-2">1. 자동 계산 로직</h4>
                        <ul className="space-y-3 text-sm text-slate-600">
                            <li className="flex justify-between">
                                <span>• <strong>총액 (Gross)</strong></span>
                                <span className="text-slate-500">공수 × 단가</span>
                            </li>
                            <li className="flex justify-between">
                                <span>• <strong>세금 (Tax)</strong></span>
                                <span className="text-slate-500">세금 적용 구간에만 {taxRateLabel} (설정 가능)</span>
                            </li>
                            <li className="flex justify-between">
                                <span>• <strong>실지급액 (Net)</strong></span>
                                <span className="text-slate-500 font-medium text-indigo-600">총액 - (세금 + 4대보험 + 가불/공제)</span>
                            </li>
                        </ul>

                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed">
                            <div className="font-bold text-slate-700">세금 적용 규칙</div>
                            <div className="mt-1">
                                4대보험 모드 OFF: <span className="font-bold text-slate-800">신고 금액</span>(분리 신고 사용 시 기준 공수까지)에 세금이 적용됩니다.
                            </div>
                            <div>
                                4대보험 모드 ON: <span className="font-bold text-slate-800">미신고 금액</span>(초과분)에만 세금이 적용됩니다.
                            </div>
                        </div>
                    </div>

                    {/* Split Mode Section */}
                    <div>
                        <h4 className="font-bold text-slate-700 mb-2 border-b pb-2">2. 분리 신고 / 4대보험 조합 규칙</h4>
                        <p className="text-sm text-slate-600 mb-3">
                            분리 신고는 <strong>신고분(기준 공수까지)</strong>과 <strong>미신고분(초과분)</strong>을 나누어 서로 다른 공제 규칙을 적용합니다.
                        </p>
                        <div className="bg-amber-50 p-3 rounded text-xs text-amber-800 space-y-1">
                            <p>1. <strong>분리 신고</strong>를 켜고 <strong>신고 기준 공수</strong>(예: 8)를 설정합니다.</p>
                            <p>2. 표의 <strong>[신고]</strong> 공수는 기준 공수까지, <strong>[미신고]</strong> 공수는 초과분이 표시됩니다.</p>
                            <p>3. <strong>4대보험 모드 ON</strong>일 때: 신고분에는 <strong>4대보험</strong>, 미신고분에는 <strong>세금({taxRateLabel})</strong>만 적용됩니다.</p>
                            <p>4. <strong>4대보험 모드 OFF</strong>일 때: 신고분(기준 공수까지)에 <strong>세금({taxRateLabel})</strong>이 적용됩니다.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-2">3. 데이터가 보이지 않을 때</h4>
                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 ml-2">
                        <li>선택한 <strong>'월'</strong>과 <strong>'팀'</strong>에 해당하는 <strong>작업 일보(Daily Report)</strong>가 입력되어 있는지 확인해주세요.</li>
                        <li>작업 일보에 등록된 작업자만 급여 대장에 표시됩니다.</li>
                        <li>데이터 수정이 필요한 경우, <strong>[일일 작업 일보]</strong> 메뉴에서 해당 날짜의 일보를 수정하세요.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default TeamLaborCostInvoice;
