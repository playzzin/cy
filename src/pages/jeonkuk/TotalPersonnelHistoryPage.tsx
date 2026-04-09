import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faDownload, faFileInvoiceDollar, faSearch, faSync, faThumbtack, faTimes, faUser } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx-js-style';
import { dailyReportService, DailyReportWorkerRow } from '../../services/dailyReportService';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { normalizeTypedDateInput, sanitizeTypedDateInput } from '../../utils/typedDateInput';
import OutputManagementTabs from '../../components/common/OutputManagementTabs';

type CompanyTypeFilter = 'construction' | 'partner';
type SalaryModelFilter = '전체' | '일급제' | '월급제' | '지원팀';

interface PersonnelHistoryRow {
    workerId: string;
    name: string;
    idNumber: string;
    salaryModel: SalaryModelFilter;
    teamId: string;
    teamName: string;
    totalManDay: number;
    laborManDay: number;
    invoiceManDay: number;
    unitPrice: number;
    laborAmount: number;
    invoiceAmount: number;
    totalAmount: number;
}

const resolveWorkerSalaryModel = (worker: Worker): SalaryModelFilter => {
    const raw = String(worker.salaryModel ?? worker.payType ?? '').trim();
    if (raw.includes('월급')) return '월급제';
    if (raw.includes('지원')) return '지원팀';
    return '일급제';
};

const resolveSnapshotSalaryModel = (params: {
    worker: Worker;
    reportSalaryModel?: string;
    reportPayType?: string;
}): SalaryModelFilter => {
    const snapshotRaw = String(params.reportSalaryModel ?? params.reportPayType ?? '').trim();
    if (snapshotRaw.includes('월급')) return '월급제';
    if (snapshotRaw.includes('지원')) return '지원팀';
    if (snapshotRaw.includes('일급')) return '일급제';
    return resolveWorkerSalaryModel(params.worker);
};

const normalizeCategoryKey = (value: unknown): string => {
    return String(value ?? '')
        .replace(/\s+/g, '')
        .trim();
};

const classifyInvoiceBySiteContext = (params: {
    paymentType?: unknown;
    siteType?: unknown;
    salaryModel: SalaryModelFilter;
}): boolean => {
    const paymentKey = normalizeCategoryKey(params.paymentType);
    const siteTypeKey = normalizeCategoryKey(params.siteType);

    if (paymentKey.includes('노무')) return false;
    if (paymentKey.includes('계산서') || paymentKey.includes('계산')) return true;

    if (siteTypeKey.includes('직영')) return false;
    if (siteTypeKey.includes('도급') || siteTypeKey.includes('지원')) return true;

    if (params.salaryModel === '지원팀') return true;
    return false;
};

const formatResidentNumberForDisplay = (rawValue: string): string => {
    const raw = String(rawValue ?? '').trim();
    if (!raw) return '';

    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length === 13) {
        return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    }
    return raw;
};


const TotalPersonnelHistoryPage: React.FC = () => {
    return (
        <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - var(--header-height))' }}>
            <OutputManagementTabs activeTab="history" title="인원관리" />
            <div className="flex flex-col overflow-hidden flex-1" style={{ minHeight: 0 }}>
                <TotalPersonnelHistoryInner />
            </div>
        </div>
    );
};

const TotalPersonnelHistoryInner: React.FC = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [startDate, setStartDate] = useState(formatDate(firstDay));
    const [endDate, setEndDate] = useState(formatDate(lastDay));
    const [startDateInput, setStartDateInput] = useState(formatDate(firstDay));
    const [endDateInput, setEndDateInput] = useState(formatDate(lastDay));

    const [companyType, setCompanyType] = useState<CompanyTypeFilter>('construction');
    const [salaryModel, setSalaryModel] = useState<SalaryModelFilter>('전체');

    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
    const [workerSearchTerm, setWorkerSearchTerm] = useState<string>('');
    const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const [historyData, setHistoryData] = useState<PersonnelHistoryRow[]>([]);
    const [teamScopeRows, setTeamScopeRows] = useState<DailyReportWorkerRow[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(false);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [isFixed, setIsFixed] = useState<boolean>(true);

    // Lock parent scroll for internal scrolling
    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const originalOverflow = mainContent.style.overflow;
            mainContent.style.overflow = 'hidden';
            return () => {
                mainContent.style.overflow = originalOverflow;
            };
        }
    }, []);

    const fetchInitialData = async () => {
        try {
            const [fetchedTeams, fetchedCompanies, fetchedWorkers] = await Promise.all([
                teamService.getTeams(),
                companyService.getCompanies(),
                manpowerService.getWorkers()
            ]);
            setTeams(fetchedTeams);
            setCompanies(fetchedCompanies);
            setAllWorkers(fetchedWorkers);
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
    };

    useEffect(() => {
        void fetchInitialData();
    }, []);

    useEffect(() => {
        setStartDateInput(startDate);
    }, [startDate]);

    useEffect(() => {
        setEndDateInput(endDate);
    }, [endDate]);

    useEffect(() => {
        if (companyType === 'partner') {
            setSalaryModel('지원팀');
        } else {
            if (salaryModel === '지원팀') setSalaryModel('전체');
        }
        setSelectedTeamId('');
        setSelectedWorkerId('');
        setWorkerSearchTerm('');
    }, [companyType]);

    const companyById = useMemo(() => {
        const map = new Map<string, Company>();
        companies.forEach((company) => {
            if (!company.id) return;
            map.set(company.id, company);
        });
        return map;
    }, [companies]);

    const teamById = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            if (team.id) map.set(String(team.id).trim(), team);
            if ((team as any).legacyId) map.set(String((team as any).legacyId).trim(), team);
        });
        return map;
    }, [teams]);

    const teamByName = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const nameKey = String(team.name ?? '').replace(/\s+/g, '').trim();
            if (nameKey && !map.has(nameKey)) {
                map.set(nameKey, team);
            }
        });
        return map;
    }, [teams]);

    const allowedTeamIds = useMemo(() => {
        const ids = new Set<string>();
        teams.forEach((team) => {
            if (!team.id) return;
            const companyId = String(team.companyId ?? '').trim();
            if (!companyId) return;
            const company = companyById.get(companyId);
            if (!company) return;

            const teamId = String(team.id).trim();
            const teamLegacyId = String((team as any).legacyId ?? '').trim();
            const isAllowed =
                (companyType === 'construction' && company.type === '시공사')
                || (companyType === 'partner' && company.type === '협력사');
            if (!isAllowed) return;

            if (teamId) ids.add(teamId);
            if (teamLegacyId) ids.add(teamLegacyId);
        });
        return ids;
    }, [companyById, companyType, teams]);

    const teamOptions = useMemo(() => {
        const scopedSupportTeamIds =
            companyType === 'partner'
                ? new Set(
                    teamScopeRows
                        .map((row) => {
                            const rawTeamId = String(row.workerTeamId ?? '').trim();
                            if (rawTeamId) {
                                return String(teamById.get(rawTeamId)?.id ?? rawTeamId).trim();
                            }
                            const rawTeamName = String(row.workerTeamName ?? '').replace(/\s+/g, '').trim();
                            return String(teamByName.get(rawTeamName)?.id ?? '').trim();
                        })
                        .filter((id) => Boolean(id) && allowedTeamIds.has(id))
                )
                : null;

        return teams
            .filter((team) => Boolean(team.id) && team.id && allowedTeamIds.has(team.id))
            .filter((team) => {
                if (companyType !== 'partner') return true;
                const canonicalTeamId = String(team.id ?? '').trim();
                return scopedSupportTeamIds ? scopedSupportTeamIds.has(canonicalTeamId) : false;
            })
            .slice()
            .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko'));
    }, [allowedTeamIds, companyType, teamById, teamByName, teamScopeRows, teams]);

    const workerOptions = useMemo(() => {
        const filtered = allWorkers
            .filter((worker) => Boolean(worker.id))
            .filter((worker) => {
                if (!workerSearchTerm) return true;
                const nameMatch = String(worker.name ?? '').includes(workerSearchTerm);
                const idMatch = String(worker.idNumber ?? '').includes(workerSearchTerm);
                return nameMatch || idMatch;
            })
            .filter((worker) => {
                const teamId = String(worker.teamId ?? '').trim();
                if (!teamId) return false;
                if (!allowedTeamIds.has(teamId)) return false;
                if (selectedTeamId && teamId !== selectedTeamId) return false;

                const model = resolveWorkerSalaryModel(worker);
                if (companyType === 'partner') return model === '지원팀';
                return model === '일급제' || model === '월급제';
            })
            .filter((worker) => {
                const model = resolveWorkerSalaryModel(worker);
                if (companyType === 'partner') return model === '지원팀';
                if (salaryModel === '전체') return model === '일급제' || model === '월급제';
                return model === salaryModel;
            })
            .slice()
            .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko'));

        return filtered;
    }, [allWorkers, allowedTeamIds, companyType, salaryModel, selectedTeamId, workerSearchTerm]);

    // Reset active index when search term changes or dropdown opens
    useEffect(() => {
        setActiveIndex(0);
    }, [workerSearchTerm, isWorkerDropdownOpen]);

    // Handle Keyboard Navigation
    const handleWorkerKeyDown = (e: React.KeyboardEvent) => {
        if (!isWorkerDropdownOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsWorkerDropdownOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(prev => (prev < workerOptions.length - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
                break;
            case 'Enter':
                e.preventDefault();
                if (workerOptions.length > 0 && activeIndex >= 0) {
                    const selected = workerOptions[activeIndex];
                    setSelectedWorkerId(selected.id || '');
                    setIsWorkerDropdownOpen(false);
                }
                break;
            case 'Escape':
                setIsWorkerDropdownOpen(false);
                break;
            case 'Tab':
                setIsWorkerDropdownOpen(false);
                break;
        }
    };

    // Text Highlighter Utility
    const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
        if (!highlight.trim()) return <span>{text}</span>;
        const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === highlight.toLowerCase() ? (
                        <span key={i} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{part}</span>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                )}
            </span>
        );
    };

    useEffect(() => {
        const selectableTeamIds = new Set(
            teamOptions
                .map((team) => String(team.id ?? '').trim())
                .filter((id) => Boolean(id))
        );

        if (selectedTeamId && !selectableTeamIds.has(selectedTeamId)) {
            setSelectedTeamId('');
            setSelectedWorkerId('');
            setWorkerSearchTerm('');
            return;
        }
        if (selectedWorkerId && !workerOptions.some((w) => w.id === selectedWorkerId)) {
            setSelectedWorkerId('');
        }
    }, [selectedTeamId, selectedWorkerId, teamOptions, workerOptions]);

    useEffect(() => {
        let cancelled = false;

        const loadTeamScopeRows = async () => {
            if (companyType !== 'partner') {
                setTeamScopeRows([]);
                return;
            }

            try {
                const rows = await dailyReportService.getReportWorkerRowsByRange({
                    startDate,
                    endDate
                });
                if (!cancelled) {
                    setTeamScopeRows(rows);
                }
            } catch (error) {
                console.error('Error fetching support team options:', error);
                if (!cancelled) {
                    setTeamScopeRows([]);
                }
            }
        };

        void loadTeamScopeRows();

        return () => {
            cancelled = true;
        };
    }, [companyType, endDate, startDate]);

    const commitDateDrafts = () => {
        const nextStartDate = normalizeTypedDateInput(startDateInput) ?? startDate;
        const nextEndDate = normalizeTypedDateInput(endDateInput) ?? endDate;

        setStartDateInput(nextStartDate);
        setEndDateInput(nextEndDate);

        if (nextStartDate !== startDate) setStartDate(nextStartDate);
        if (nextEndDate !== endDate) setEndDate(nextEndDate);

        return {
            startDate: nextStartDate,
            endDate: nextEndDate,
        };
    };

    const fetchData = async (dateOverride?: { startDate: string; endDate: string }) => {
        setLoading(true);
        try {
            const effectiveStartDate = dateOverride?.startDate ?? startDate;
            const effectiveEndDate = dateOverride?.endDate ?? endDate;
            const [workers, reportRows] = await Promise.all([
                manpowerService.getWorkers(),
                dailyReportService.getReportWorkerRowsByRange({ startDate: effectiveStartDate, endDate: effectiveEndDate })
            ]);
            setTeamScopeRows(reportRows);
            const workerById = new Map<string, Worker>();
            workers.forEach((w) => {
                const id = String(w.id ?? '').trim();
                const legacyId = String((w as any).legacyId ?? '').trim();
                if (id) workerById.set(id, w);
                if (legacyId) workerById.set(legacyId, w);
            });

            const normalizeTeamId = (value?: string | null): string => {
                const raw = String(value ?? '').trim();
                if (!raw) return '';
                return String(teamById.get(raw)?.id ?? raw).trim();
            };

            const normalizeWorkerId = (value?: string | null): string => {
                const raw = String(value ?? '').trim();
                if (!raw) return '';
                return String(workerById.get(raw)?.id ?? raw).trim();
            };

            const selectedNormalizedTeamId = normalizeTeamId(selectedTeamId);
            const selectedWorkerIds = new Set<string>();
            if (selectedWorkerId) {
                const normalizedSelectedWorkerId = normalizeWorkerId(selectedWorkerId);
                if (normalizedSelectedWorkerId) selectedWorkerIds.add(normalizedSelectedWorkerId);

                const selectedWorker =
                    workerById.get(String(selectedWorkerId).trim())
                    ?? allWorkers.find((worker) => String(worker.id ?? '').trim() === String(selectedWorkerId).trim());
                const selectedLegacyId = String((selectedWorker as any)?.legacyId ?? '').trim();
                const normalizedLegacyId = normalizeWorkerId(selectedLegacyId);
                if (normalizedLegacyId) selectedWorkerIds.add(normalizedLegacyId);
            }

            const search = workerSearchTerm.trim();

            const statsByWorker = new Map<string, {
                workerId: string;
                name: string;
                idNumber: string;
                salaryModel: SalaryModelFilter;
                teamId: string;
                teamName: string;
                laborManDay: number;
                invoiceManDay: number;
                laborAmount: number;
                invoiceAmount: number;
            }>();
            const salaryByWorker = new Map<string, SalaryModelFilter>();
            const siteById = new Map<string, { siteType?: unknown; paymentMethod?: unknown }>();

            reportRows.forEach((row) => {
                const rawWorkerId = String(row.workerId ?? '').trim();
                if (!rawWorkerId) return;

                const normalizedWorkerId = normalizeWorkerId(rawWorkerId);
                if (!normalizedWorkerId) return;
                if (selectedWorkerIds.size > 0 && !selectedWorkerIds.has(normalizedWorkerId)) return;

                const worker = workerById.get(rawWorkerId) ?? workerById.get(normalizedWorkerId);
                const workerName = String(row.workerName ?? worker?.name ?? '').trim();
                const idNumber = String(worker?.idNumber ?? '').trim();
                if (search && selectedWorkerIds.size === 0) {
                    const matchesName = workerName.includes(search);
                    const matchesIdNumber = idNumber.includes(search);
                    if (!matchesName && !matchesIdNumber) return;
                }

                const workerTeamId = normalizeTeamId(String(row.workerTeamId ?? worker?.teamId ?? '').trim());
                if (!workerTeamId) return;
                if (!allowedTeamIds.has(workerTeamId)) return;
                if (selectedNormalizedTeamId && workerTeamId !== selectedNormalizedTeamId) return;

                const workerId = normalizedWorkerId;
                const rw = row;
                const report = row as any;

                const model = resolveSnapshotSalaryModel({
                    worker: worker ?? ({ salaryModel: row.salaryModel, payType: row.payType } as Worker),
                    reportSalaryModel: row.salaryModel,
                    reportPayType: row.payType
                });

                    if (companyType === 'partner') {
                        if (model !== '지원팀') return;
                    } else {
                        if (model !== '일급제' && model !== '월급제' && model !== '지원팀') return; // All allowed for internal search

                        if (salaryModel === '전체') {
                            if (model !== '일급제' && model !== '월급제') return;
                        } else {
                            if (salaryModel !== '지원팀' && model === '지원팀') {
                                // If filtering by labor but found invoice entry, we check if we should skip
                                // Actually, keep it for split view
                            }
                            if (salaryModel !== '지원팀' && salaryModel !== model && model !== '지원팀') {
                                return;
                            }
                        }
                    }

                    const prevModel = salaryByWorker.get(workerId);
                    if (!prevModel) salaryByWorker.set(workerId, model);

                    const manDay = typeof rw.manDay === 'number' ? rw.manDay : 0;
                    const snapshotUnitPrice = typeof rw.unitPrice === 'number' ? rw.unitPrice : null;
                    const fallbackUnitPrice = typeof worker?.unitPrice === 'number' ? worker.unitPrice : 0;
                    const unitPrice = snapshotUnitPrice ?? fallbackUnitPrice;
                    const amount = typeof rw.amount === 'number' ? rw.amount : (manDay * unitPrice);

                    const current = statsByWorker.get(workerId) ?? {
                        workerId,
                        name: workerName,
                        idNumber,
                        salaryModel: model,
                        teamId: workerTeamId,
                        teamName: String(rw.workerTeamName ?? teamById.get(workerTeamId)?.name ?? worker?.teamName ?? '').trim(),
                        laborManDay: 0,
                        invoiceManDay: 0,
                        laborAmount: 0,
                        invoiceAmount: 0
                    };
                    if (!current.name && workerName) current.name = workerName;
                    if (!current.idNumber && idNumber) current.idNumber = idNumber;
                    if (!current.teamId && workerTeamId) current.teamId = workerTeamId;
                    if (!current.teamName) {
                        current.teamName = String(rw.workerTeamName ?? teamById.get(workerTeamId)?.name ?? worker?.teamName ?? '').trim();
                    }
                    // 2024-05-22 Separate Labor/Invoice based on siteType & paymentType
                    const site = siteById.get(String(report.siteId ?? '').trim());
                    const siteType = report.siteType ?? rw.siteType ?? site?.siteType;
                    const paymentType = report.paymentType ?? rw.paymentType ?? site?.paymentMethod;
                    const isInvoice = classifyInvoiceBySiteContext({
                        paymentType,
                        siteType,
                        salaryModel: model
                    });

                    if (isInvoice) {
                        current.invoiceManDay += manDay;
                        current.invoiceAmount += amount;
                    } else {
                        current.laborManDay += manDay;
                        current.laborAmount += amount;
                    }

                    statsByWorker.set(workerId, current);
            });

            const result: PersonnelHistoryRow[] = [];
            statsByWorker.forEach((stats, workerId) => {
                const worker = workerById.get(workerId);
                const teamId = stats.teamId || String(worker?.teamId ?? '').trim();
                const teamName = stats.teamName || teamById.get(teamId)?.name || String(worker?.teamName ?? '');
                const model = salaryByWorker.get(workerId) ?? stats.salaryModel ?? resolveWorkerSalaryModel(worker ?? ({ name: stats.name } as Worker));
                const fallbackUnitPrice = typeof worker?.unitPrice === 'number' ? worker.unitPrice : 0;

                const totalManDay = stats.laborManDay + stats.invoiceManDay;
                const totalAmount = stats.laborAmount + stats.invoiceAmount;
                const computedUnitPrice = totalManDay > 0 ? Math.round(totalAmount / totalManDay) : fallbackUnitPrice;

                result.push({
                    workerId,
                    name: stats.name || String(worker?.name ?? ''),
                    idNumber: stats.idNumber || String(worker?.idNumber ?? ''),
                    salaryModel: model,
                    teamId,
                    teamName,
                    laborManDay: stats.laborManDay,
                    invoiceManDay: stats.invoiceManDay,
                    totalManDay,
                    unitPrice: computedUnitPrice,
                    laborAmount: stats.laborAmount,
                    invoiceAmount: stats.invoiceAmount,
                    totalAmount
                });
            });

            result.sort((a, b) => {
                const cmp = String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko');
                return sortOrder === 'asc' ? cmp : -cmp;
            });

            setHistoryData(result);
        } catch (error) {
            console.error('Error fetching history data:', error);
            alert('데이터 조회 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadExcel = () => {
        if (historyData.length === 0) {
            alert('다운로드할 데이터가 없습니다. 먼저 조회해주세요.');
            return;
        }

        const headers = ['No', '이름', '주민번호', '본봉'] as const;
        const wsData: Array<Array<string | number>> = [headers.slice() as unknown as Array<string | number>];

        historyData.forEach((row, index) => {
            wsData.push([
                index + 1,
                row.name,
                formatResidentNumberForDisplay(row.idNumber),
                row.invoiceAmount
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Column widths
        ws['!cols'] = [
            { wch: 6 },
            { wch: 12 },
            { wch: 20 },
            { wch: 16 }
        ];

        // Number formats (xlsx-js-style)
        const setCellNumFmt = (rowIndex: number, colIndex: number, numFmt: string) => {
            const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
            const cell = ws[addr] as { t?: string; v?: unknown; s?: Record<string, unknown> } | undefined;
            if (!cell) return;
            cell.s = { ...(cell.s ?? {}), numFmt };
        };

        // Data rows start at r=1 (r=0 is header)
        for (let r = 1; r < wsData.length; r += 1) {
            setCellNumFmt(r, 3, '#,##0');   // 본봉
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '인원전체내역');
        XLSX.writeFile(wb, `인원전체내역_${startDate}_${endDate}.xlsx`);
    };

    const handleSyncPartner = async () => {
        if (!window.confirm('협력사 소속 작업자들의 급여방식을 "지원팀"으로 일괄 동기화합니다. 계속하시겠습니까?')) return;
        try {
            const result = await manpowerService.syncPartnerCompanyWorkersTeamType();
            if (result.updated > 0) {
                alert(`${result.updated}명의 작업자가 "지원팀"으로 동기화되었습니다.`);
            } else if (result.errors.length > 0) {
                alert(`동기화 실패: ${result.errors.join(', ')}`);
            } else {
                alert('동기화할 작업자가 없습니다. (이미 모두 동기화됨)');
            }
        } catch (error) {
            alert('동기화 중 오류가 발생했습니다.');
            console.error(error);
        }
    };

    const handleSyncReports = async () => {
        if (!window.confirm('기존 일보의 작업자별 급여방식을 일괄 동기화합니다. 시간이 걸릴 수 있습니다. 계속하시겠습니까?')) return;
        try {
            const result = await dailyReportService.syncReportsSalaryModel();
            if (result.updated > 0) {
                alert(`${result.updated}개의 일보가 동기화되었습니다.`);
            } else if (result.errors.length > 0) {
                alert(`동기화 실패: ${result.errors.join(', ')}`);
            } else {
                alert('동기화할 일보가 없습니다. (이미 모두 동기화됨)');
            }
        } catch (error) {
            alert('동기화 중 오류가 발생했습니다.');
            console.error(error);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600" />
                        인원 전체내역 조회
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        기간별 전체 인원의 공수 및 급여 내역을 조회하고 엑셀로 다운로드합니다.
                    </p>
                </div>
                {/* Header Buttons Row */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownloadExcel}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm font-medium text-sm"
                    >
                        <FontAwesomeIcon icon={faDownload} />
                        세무용 Excel
                    </button>
                    <button
                        onClick={handleSyncPartner}
                        className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all shadow-sm font-medium text-sm"
                    >
                        <FontAwesomeIcon icon={faSync} />
                        협력사
                    </button>
                    <button
                        onClick={handleSyncReports}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all shadow-sm font-medium text-sm"
                    >
                        <FontAwesomeIcon icon={faSync} />
                        일보
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsFixed((prev) => !prev)}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-all shadow-sm font-medium text-sm ${isFixed
                            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faThumbtack} className={isFixed ? 'rotate-45' : ''} />
                        {isFixed ? '틀고정 해제' : '틀고정'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
                {/* Filter Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 flex-shrink-0">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                <label className="text-xs font-medium text-slate-500">시작일</label>
                                <button
                                    onClick={() => {
                                        const t = new Date();
                                        const nextStartDate = formatDate(new Date(t.getFullYear(), t.getMonth() - 1, 1));
                                        const nextEndDate = formatDate(new Date(t.getFullYear(), t.getMonth(), 0));
                                        setStartDate(nextStartDate);
                                        setEndDate(nextEndDate);
                                        setStartDateInput(nextStartDate);
                                        setEndDateInput(nextEndDate);
                                    }}
                                    className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded"
                                >
                                    전달
                                </button>
                                <button
                                    onClick={() => {
                                        const t = new Date();
                                        const nextStartDate = formatDate(new Date(t.getFullYear(), t.getMonth(), 1));
                                        const nextEndDate = formatDate(t);
                                        setStartDate(nextStartDate);
                                        setEndDate(nextEndDate);
                                        setStartDateInput(nextStartDate);
                                        setEndDateInput(nextEndDate);
                                    }}
                                    className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded"
                                >
                                    이달
                                </button>
                            </div>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={startDateInput}
                                onChange={(e) => setStartDateInput(sanitizeTypedDateInput(e.target.value))}
                                onBlur={() => {
                                    const nextStartDate = normalizeTypedDateInput(startDateInput) ?? startDate;
                                    setStartDateInput(nextStartDate);
                                    if (nextStartDate !== startDate) {
                                        setStartDate(nextStartDate);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                    }
                                }}
                                placeholder="YYYY-MM-DD"
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-36"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-500">종료일</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={endDateInput}
                                onChange={(e) => setEndDateInput(sanitizeTypedDateInput(e.target.value))}
                                onBlur={() => {
                                    const nextEndDate = normalizeTypedDateInput(endDateInput) ?? endDate;
                                    setEndDateInput(nextEndDate);
                                    if (nextEndDate !== endDate) {
                                        setEndDate(nextEndDate);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                    }
                                }}
                                placeholder="YYYY-MM-DD"
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-36"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-500">구분</label>
                            <select
                                value={companyType}
                                onChange={(e) => setCompanyType(e.target.value as CompanyTypeFilter)}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-32"
                            >
                                <option value="construction">청연이엔지</option>
                                <option value="partner">지원팀(현재협력사)</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-500">급여방식</label>
                            <select
                                value={salaryModel}
                                onChange={(e) => setSalaryModel(e.target.value as SalaryModelFilter)}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-32"
                                disabled={companyType === 'partner'}
                            >
                                {companyType === 'partner' ? (
                                    <option value="지원팀">지원팀</option>
                                ) : (
                                    <>
                                        <option value="전체">전체</option>
                                        <option value="일급제">일급제</option>
                                        <option value="월급제">월급제</option>
                                    </>
                                )}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-500">팀</label>
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm min-w-40"
                            >
                                <option value="">전체 팀</option>
                                {teamOptions.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1 relative">
                            <label className="text-xs font-medium text-slate-500">작업자 검색 및 선택</label>
                            <div className="relative">
                                <div
                                    onClick={() => setIsWorkerDropdownOpen(!isWorkerDropdownOpen)}
                                    className={`flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-72 h-[38px] cursor-pointer hover:border-blue-400 transition-all ${isWorkerDropdownOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                                >
                                    <FontAwesomeIcon icon={faSearch} className="text-slate-400 text-xs" />
                                    <input
                                        type="text"
                                        value={selectedWorkerId ? (allWorkers.find(w => w.id === selectedWorkerId)?.name || '') : workerSearchTerm}
                                        onChange={(e) => {
                                            if (selectedWorkerId) {
                                                setSelectedWorkerId('');
                                            }
                                            setWorkerSearchTerm(e.target.value);
                                            setIsWorkerDropdownOpen(true);
                                        }}
                                        onKeyDown={handleWorkerKeyDown}
                                        placeholder="이름 또는 주민번호 입력"
                                        className="bg-transparent border-none outline-none text-sm w-full"
                                        onFocus={() => setIsWorkerDropdownOpen(true)}
                                    />
                                    {(selectedWorkerId || workerSearchTerm) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedWorkerId('');
                                                setWorkerSearchTerm('');
                                            }}
                                            className="ml-auto text-slate-400 hover:text-slate-600 p-1"
                                        >
                                            <FontAwesomeIcon icon={faTimes} className="text-[10px]" />
                                        </button>
                                    )}
                                    <FontAwesomeIcon icon={faChevronDown} className={`text-slate-300 text-[10px] transition-transform duration-200 ${isWorkerDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>

                                <AnimatePresence>
                                    {isWorkerDropdownOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setIsWorkerDropdownOpen(false)}
                                            />
                                            <motion.div
                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                                className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[320px]"
                                            >
                                                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                                    {workerOptions.length > 0 ? (
                                                        <>
                                                            <div className="px-3 py-2 text-[11px] font-bold text-slate-400 flex items-center justify-between">
                                                                <span>검색 결과: {workerOptions.length}명</span>
                                                                {workerSearchTerm && !selectedWorkerId && (
                                                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">검색 모드</span>
                                                                )}
                                                            </div>
                                                            {workerOptions.map((worker, index) => (
                                                                <button
                                                                    key={worker.id}
                                                                    onClick={() => {
                                                                        setSelectedWorkerId(worker.id || '');
                                                                        setIsWorkerDropdownOpen(false);
                                                                    }}
                                                                    onMouseEnter={() => setActiveIndex(index)}
                                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group ${selectedWorkerId === worker.id || activeIndex === index
                                                                        ? (selectedWorkerId === worker.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900')
                                                                        : 'hover:bg-slate-50 text-slate-700'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${selectedWorkerId === worker.id ? 'bg-blue-500' : activeIndex === index ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                                                                            <FontAwesomeIcon icon={faUser} />
                                                                        </div>
                                                                        <div className="text-left">
                                                                            <p className="font-bold">
                                                                                <HighlightText text={worker.name} highlight={workerSearchTerm} />
                                                                            </p>
                                                                            <p className={`text-[11px] ${selectedWorkerId === worker.id ? 'text-blue-100' : 'text-slate-400'}`}>
                                                                                {worker.teamName || '팀 미지정'} • <HighlightText text={formatResidentNumberForDisplay(worker.idNumber || '').slice(0, 8)} highlight={workerSearchTerm} />******
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    {selectedWorkerId === worker.id && (
                                                                        <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </>
                                                    ) : (
                                                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                                                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                                                                <FontAwesomeIcon icon={faSearch} className="text-lg opacity-20" />
                                                            </div>
                                                            <p className="text-xs">검색 결과가 없습니다.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortOrder === 'asc' ? 'bg-indigo-500 text-white' : 'bg-amber-500 text-white'}`}
                        >
                            {sortOrder === 'asc' ? '이름 ㄱ→ㅎ' : '이름 ㅎ→ㄱ'}
                        </button>

                        <button
                            onClick={() => {
                                const nextRange = commitDateDrafts();
                                fetchData(nextRange);
                            }}
                            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md font-bold flex items-center gap-2 text-sm"
                        >
                            <FontAwesomeIcon icon={faSearch} />
                            조회
                        </button>
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-1.5 h-5 bg-blue-600 rounded-sm"></span>
                            조회 결과
                            <span className="text-slate-400 font-normal text-sm">({historyData.length.toLocaleString()}건)</span>
                        </h3>
                    </div>

                    <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
                        <table className="w-full text-sm text-left border-separate border-spacing-0">
                            <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-40">
                                <tr className="text-xs uppercase tracking-wider">
                                    <th rowSpan={2} className={`px-4 py-2 text-center w-12 border-b border-r border-slate-200 ${isFixed ? 'sticky left-0 z-50 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}>No</th>
                                    <th rowSpan={2} className={`px-4 py-2 border-b border-r border-slate-200 ${isFixed ? 'sticky left-[48px] z-50 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: isFixed ? '100px' : 'auto', minWidth: isFixed ? '100px' : 'auto' }}>이름</th>
                                    <th rowSpan={2} className={`px-4 py-2 border-b border-r border-slate-200 ${isFixed ? 'sticky left-[148px] z-50 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: isFixed ? '140px' : 'auto', minWidth: isFixed ? '140px' : 'auto' }}>팀명</th>
                                    <th rowSpan={2} className="px-4 py-2 border-b border-r border-slate-200">주민번호</th>
                                    <th rowSpan={2} className="px-4 py-2 border-b border-r border-slate-200">급여방식</th>
                                    <th colSpan={3} className="px-4 py-1 text-center border-b border-r border-slate-200 bg-slate-100/50">공수 (Man-Days)</th>
                                    <th rowSpan={2} className="px-4 py-2 text-right border-b border-r border-slate-200">단가</th>
                                    <th colSpan={3} className="px-4 py-1 text-center border-b border-slate-200 bg-blue-50/50 text-blue-700">본봉 (Total Amount)</th>
                                </tr>
                                <tr>
                                    <th className="px-3 py-1 text-right border-b border-r border-slate-200 text-[10px] bg-slate-50">노무</th>
                                    <th className="px-3 py-1 text-right border-b border-r border-slate-200 text-[10px] bg-slate-50">계산서</th>
                                    <th className="px-3 py-1 text-right border-b border-r border-slate-200 text-[11px] bg-slate-100 font-bold">합계</th>
                                    <th className="px-3 py-1 text-right border-b border-r border-slate-200 text-[10px] bg-blue-50/30">노무</th>
                                    <th className="px-3 py-1 text-right border-b border-r border-slate-200 text-[10px] bg-blue-50/30">계산서</th>
                                    <th className="px-3 py-1 text-right border-b border-slate-200 text-[11px] bg-blue-600 text-white font-bold">합계</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                <span>데이터 분석 중...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : historyData.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500 bg-slate-50/50">
                                            <FontAwesomeIcon icon={faSearch} className="text-2xl text-slate-300 mb-2" />
                                            <p className="font-medium">조회된 데이터가 없습니다.</p>
                                            <p className="text-xs text-slate-400">검색 조건을 변경하여 다시 조회해보세요.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    historyData.map((item, index) => (
                                        <tr key={item.workerId} className="hover:bg-blue-50/50 transition-colors">
                                            <td className={`px-4 py-3 text-center text-slate-400 text-xs border-b border-slate-100 ${isFixed ? 'sticky left-0 z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}>{index + 1}</td>
                                            <td className={`px-4 py-3 font-bold text-slate-800 border-b border-slate-100 ${isFixed ? 'sticky left-[48px] z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}>{item.name}</td>
                                            <td className={`px-4 py-3 text-slate-600 border-b border-slate-100 ${isFixed ? 'sticky left-[148px] z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}>{item.teamName || '-'}</td>
                                            <td className="px-4 py-3 text-slate-500 font-mono text-xs border-b border-slate-100">{item.idNumber}</td>
                                            <td className="px-4 py-3 border-b border-slate-100">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.salaryModel === '일급제' ? 'bg-blue-50 text-blue-600' :
                                                    item.salaryModel === '월급제' ? 'bg-indigo-50 text-indigo-600' :
                                                        item.salaryModel === '지원팀' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600'
                                                    }`}>{item.salaryModel}</span>
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-500 bg-slate-50/30 border-b border-r border-slate-100">{item.laborManDay > 0 ? item.laborManDay.toFixed(1) : '-'}</td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-500 bg-slate-50/30 border-b border-r border-slate-100">{item.invoiceManDay > 0 ? item.invoiceManDay.toFixed(1) : '-'}</td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-800 font-bold bg-slate-100/30 border-b border-r border-slate-100 tracking-tighter">{item.totalManDay.toFixed(1)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs border-b border-r border-slate-100">{item.unitPrice.toLocaleString()}</td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-600 border-b border-r border-slate-100">{item.laborAmount > 0 ? item.laborAmount.toLocaleString() : '-'}</td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-600 border-b border-r border-slate-100">{item.invoiceAmount > 0 ? item.invoiceAmount.toLocaleString() : '-'}</td>
                                            <td className="px-4 py-3 text-right border-b border-slate-100 bg-blue-50/10">
                                                <span className="font-bold text-blue-700 font-mono tracking-tighter">{item.totalAmount.toLocaleString()}</span>
                                                <span className="text-[10px] text-slate-400 ml-0.5">원</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {!loading && historyData.length > 0 && (
                                <tfoot className="bg-slate-50 font-bold border-t border-slate-200 sticky bottom-0 z-40">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-center text-slate-600 border-r border-slate-200">전체 합계</td>
                                        <td className="px-3 py-3 text-right text-slate-500 font-mono text-xs border-r border-slate-200">
                                            {historyData.reduce((sum, item) => sum + item.laborManDay, 0).toFixed(1)}
                                        </td>
                                        <td className="px-3 py-3 text-right text-slate-500 font-mono text-xs border-r border-slate-200">
                                            {historyData.reduce((sum, item) => sum + item.invoiceManDay, 0).toFixed(1)}
                                        </td>
                                        <td className="px-3 py-3 text-right text-slate-900 font-mono border-r border-slate-200">
                                            {historyData.reduce((sum, item) => sum + item.totalManDay, 0).toFixed(1)}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-200"></td>
                                        <td className="px-3 py-3 text-right text-slate-600 font-mono text-xs border-r border-slate-200">
                                            {historyData.reduce((sum, item) => sum + item.laborAmount, 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-3 text-right text-slate-600 font-mono text-xs border-r border-slate-200">
                                            {historyData.reduce((sum, item) => sum + item.invoiceAmount, 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-blue-800 font-mono font-black text-base">
                                            {historyData.reduce((sum, item) => sum + item.totalAmount, 0).toLocaleString()} <span className="text-[10px] font-normal">원</span>
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TotalPersonnelHistoryPage;
