import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faFileInvoiceDollar, faPlus, faChartPie, faMapMarkerAlt, faUser, faBed, faWonSign, faExclamationTriangle, faBell, faTrash, faList, faTh, faUsers, faStickyNote, faPen } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { iconMap } from '../../constants/iconMap';
import { accommodationService } from '../../services/accommodationService';
import { Accommodation, UtilityRecord } from '../../types/accommodation';
import AccommodationForm from '../../components/accommodation/AccommodationForm';
import AccommodationQuickAssignmentModal from '../../components/accommodation/QuickAssignmentModal';
import UtilityLedger from '../../components/accommodation/UtilityLedger';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { UserRole } from '../../types/roles';
import { AccommodationAssignment } from '../../types/accommodationAssignment';
import { accommodationBillingTargetService } from '../../services/accommodationBillingTargetService';
import { AccommodationBillingTarget } from '../../types/accommodationBillingTarget';

const AccommodationManager: React.FC = () => {
    const { currentUser } = useAuth();
    const [canUseAccommodationManager, setCanUseAccommodationManager] = useState<boolean | null>(null);
    const [activeTab, setActiveTab] = useState<'status' | 'ledger'>('status');
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [assignments, setAssignments] = useState<AccommodationAssignment[]>([]);
    const [billingTargets, setBillingTargets] = useState<AccommodationBillingTarget[]>([]);
    const [currentMonthLedgerRecords, setCurrentMonthLedgerRecords] = useState<UtilityRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<Accommodation | undefined>(undefined);
    const [quickAssignItem, setQuickAssignItem] = useState<Accommodation | null>(null);
    const [filterStatus, setFilterStatus] = useState<'active' | 'inactive'>('active');
    const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

    // Team Search State
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectableTeams, setSelectableTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');

    // Expiration Alert State
    const [dismissedExpirationAlerts, setDismissedExpirationAlerts] = useState(false);

    useEffect(() => {
        let isCancelled = false;

        const resolveAccess = async () => {
            if (!currentUser) {
                if (!isCancelled) setCanUseAccommodationManager(false);
                return;
            }

            try {
                const user = await userService.getUser(currentUser.uid);
                const role = user?.role;
                const isAdminRole = role === 'admin' || role === UserRole.ADMIN;
                if (!isCancelled) setCanUseAccommodationManager(isAdminRole);
            } catch {
                if (!isCancelled) setCanUseAccommodationManager(false);
            }
        };

        resolveAccess();
        return () => {
            isCancelled = true;
        };
    }, [currentUser]);

    useEffect(() => {
        if (canUseAccommodationManager !== true) return;
        if (activeTab !== 'status') return;
        loadData();
    }, [canUseAccommodationManager, activeTab]);

    const getCurrentYearMonth = (): string => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const targetYearMonth = getCurrentYearMonth();
            const [accommodationList, teamList, companies, assignmentList, ledgerList, billingTargetList] = await Promise.all([
                accommodationService.getAccommodations(),
                teamService.getTeams(),
                companyService.getCompanies(),
                accommodationService.getAssignments(),
                accommodationService.getMonthlyLedger(targetYearMonth).catch((error) => {
                    console.error('Failed to load accommodation monthly ledger', error);
                    return [] as UtilityRecord[];
                }),
                accommodationBillingTargetService.listTargets().catch((error) => {
                    console.error('Failed to load accommodation billing targets', error);
                    return [] as AccommodationBillingTarget[];
                })
            ]);

            // Filter teams (Cheongyeon Only)
            const cheongyeonCompanies = companies.filter((c: any) => c.name.includes('청연'));
            const cheongyeonIdSet = new Set(cheongyeonCompanies.map((c: any) => c.id).filter((id: any) => !!id));
            const cheongyeonNameSet = new Set(cheongyeonCompanies.map((c: any) => c.name));

            const allowedTeams = teamList.filter((t: Team) => {
                if (t.companyId && cheongyeonIdSet.has(t.companyId)) return true;
                if (t.companyName && cheongyeonNameSet.has(t.companyName)) return true;
                return false;
            }).sort((a: Team, b: Team) => (a.name || '').localeCompare(b.name || ''));

            setAccommodations(accommodationList);
            setAssignments(assignmentList);
            setBillingTargets(billingTargetList);
            setCurrentMonthLedgerRecords(ledgerList);
            setTeams(teamList.sort((a: Team, b: Team) => a.name.localeCompare(b.name))); // Full list for state
            setSelectableTeams(allowedTeams); // Filtered list for assignment
        } catch (error) {
            console.error("Failed to load accommodations", error);
        } finally {
            setLoading(false);
        }
    };

    // Build team info maps (color + icon)
    const teamInfoByIdMap = useMemo(() => {
        const map = new Map<string, { color: string; icon?: string; name: string }>();
        teams.forEach(t => {
            if (t.color && t.id) map.set(String(t.id), { color: t.color, icon: t.icon || t.iconKey, name: t.name });
        });
        return map;
    }, [teams]);

    const teamInfoByNameMap = useMemo(() => {
        const map = new Map<string, { color: string; icon?: string }>();
        teams.forEach(t => {
            if (t.color && t.name) map.set(t.name, { color: t.color, icon: t.icon || t.iconKey });
        });
        return map;
    }, [teams]);

    // Filter for Dropdown (Strict Constructor Teams) - Replaced by state in loadData


    const getTeamFaIcon = (iconName?: string) => {
        if (!iconName) return faUsers;
        return iconMap[iconName] || faUsers;
    };

    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    const getTeamInfo = (teamId?: string, teamName?: string) => {
        if (teamId) {
            const info = teamInfoByIdMap.get(String(teamId));
            if (info) return info;
        }
        if (teamName) {
            const info = teamInfoByNameMap.get(teamName);
            if (info) return info;
        }
        return undefined;
    };

    const normalizeKey = (value: unknown): string => String(value ?? '').trim();

    const teamByAnyId = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const id = normalizeKey(team.id);
            const legacyId = normalizeKey(team.legacyId);
            if (id) map.set(id, team);
            if (legacyId) map.set(legacyId, team);
        });
        return map;
    }, [teams]);

    const teamByName = useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const name = normalizeKey(team.name);
            if (!name || map.has(name)) return;
            map.set(name, team);
        });
        return map;
    }, [teams]);

    const accommodationByAnyId = useMemo(() => {
        const map = new Map<string, Accommodation>();
        accommodations.forEach((accommodation) => {
            const id = normalizeKey(accommodation.id);
            const legacyId = normalizeKey((accommodation as any).legacyId);
            if (id) map.set(id, accommodation);
            if (legacyId) map.set(legacyId, accommodation);
        });
        return map;
    }, [accommodations]);

    const accommodationByName = useMemo(() => {
        const map = new Map<string, Accommodation>();
        accommodations.forEach((accommodation) => {
            const name = normalizeKey(accommodation.name);
            if (!name || map.has(name)) return;
            map.set(name, accommodation);
        });
        return map;
    }, [accommodations]);

    const currentMonthLedgerByAccommodationId = useMemo(() => {
        const map = new Map<string, UtilityRecord>();

        currentMonthLedgerRecords.forEach((record) => {
            const rawAccommodationId = normalizeKey(record.accommodationId);
            const matchedById = rawAccommodationId ? accommodationByAnyId.get(rawAccommodationId) : undefined;
            const canonicalIdFromId = normalizeKey(matchedById?.id ?? rawAccommodationId);
            if (canonicalIdFromId) {
                map.set(canonicalIdFromId, record);
                return;
            }

            const rawAccommodationName = normalizeKey(record.accommodationName);
            if (!rawAccommodationName) return;
            const matchedByName = accommodationByName.get(rawAccommodationName);
            const canonicalIdFromName = normalizeKey(matchedByName?.id);
            if (!canonicalIdFromName) return;
            map.set(canonicalIdFromName, record);
        });

        return map;
    }, [currentMonthLedgerRecords, accommodationByAnyId, accommodationByName]);

    const selectedTeamRawId = normalizeKey(selectedTeamId);
    const selectedTeam = selectedTeamRawId ? teamByAnyId.get(selectedTeamRawId) : undefined;
    const selectedTeamCanonicalId = normalizeKey(selectedTeam?.id ?? selectedTeamId);
    const selectedTeamCanonicalName = normalizeKey(selectedTeam?.name);

    const resolveCanonicalAccommodationId = (assignment: AccommodationAssignment): string => {
        const rawAccommodationId = normalizeKey(assignment.accommodationId);
        if (rawAccommodationId) {
            const matchedById = accommodationByAnyId.get(rawAccommodationId);
            if (matchedById?.id) return normalizeKey(matchedById.id);
            return rawAccommodationId;
        }

        const rawAccommodationName = normalizeKey(assignment.accommodationName);
        if (rawAccommodationName) {
            const matchedByName = accommodationByName.get(rawAccommodationName);
            if (matchedByName?.id) return normalizeKey(matchedByName.id);
        }
        return '';
    };

    const resolveCanonicalTeam = (assignment: AccommodationAssignment): { teamId: string; teamName: string } => {
        const rawTeamId = normalizeKey(assignment.teamId);
        if (rawTeamId) {
            const matchedById = teamByAnyId.get(rawTeamId);
            return {
                teamId: normalizeKey(matchedById?.id ?? rawTeamId),
                teamName: normalizeKey(matchedById?.name ?? assignment.teamName)
            };
        }

        const rawTeamName = normalizeKey(assignment.teamName);
        if (!rawTeamName) {
            return { teamId: '', teamName: '' };
        }

        const matchedByName = teamByName.get(rawTeamName);
        return {
            teamId: normalizeKey(matchedByName?.id),
            teamName: normalizeKey(matchedByName?.name ?? rawTeamName)
        };
    };

    const isActiveAssignmentForStatusBoard = (assignment: AccommodationAssignment): boolean => {
        if ((assignment.status ?? 'active') === 'ended') return false;

        const rawEndDate = normalizeKey(assignment.endDate);
        if (!rawEndDate) return true;

        const endDate = new Date(rawEndDate);
        if (Number.isNaN(endDate.getTime())) return true;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        return endDate >= today;
    };

    const activeAssignmentsByAccommodationId = useMemo(() => {
        const map = new Map<string, AccommodationAssignment[]>();
        assignments.forEach((assignment) => {
            if (!isActiveAssignmentForStatusBoard(assignment)) return;
            const accommodationId = resolveCanonicalAccommodationId(assignment);
            if (!accommodationId) return;

            const list = map.get(accommodationId) ?? [];
            list.push(assignment);
            map.set(accommodationId, list);
        });

        map.forEach((list, key) => {
            const seen = new Set<string>();
            const deduped = list.filter((assignment, index) => {
                const stableKey = normalizeKey(assignment.id) ||
                    `${normalizeKey(assignment.workerId)}|${normalizeKey(assignment.workerName)}|${normalizeKey(assignment.startDate)}|${index}`;
                if (seen.has(stableKey)) return false;
                seen.add(stableKey);
                return true;
            });
            map.set(key, deduped);
        });

        return map;
    }, [assignments, accommodationByAnyId, accommodationByName]);

    const getActiveAssignmentsForAccommodation = (accommodation: Accommodation): AccommodationAssignment[] => {
        return activeAssignmentsByAccommodationId.get(normalizeKey(accommodation.id)) ?? [];
    };

    // Calculate Expirations (Within 1 Month)
    const upcomingExpirations = useMemo(() => {
        const now = new Date();
        const oneMonthLater = new Date();
        oneMonthLater.setMonth(now.getMonth() + 1);

        return accommodations.filter(a => {
            if (a.status !== 'active' || !a.contract.endDate) return false;
            const endDate = new Date(a.contract.endDate);
            return endDate <= oneMonthLater;
        }).sort((a, b) => new Date(a.contract.endDate || '').getTime() - new Date(b.contract.endDate || '').getTime());
    }, [accommodations]);

    // Unified Filtered Data
    const filteredAccommodations = useMemo(() => {
        return accommodations.filter(acc => {
            if (acc.status !== filterStatus) return false;
            if (filterStatus === 'active' && selectedTeamId) {
                const activeList = getActiveAssignmentsForAccommodation(acc);
                return activeList.some((assignment) => {
                    const resolvedTeam = resolveCanonicalTeam(assignment);
                    const matchesById = Boolean(
                        selectedTeamCanonicalId &&
                        resolvedTeam.teamId &&
                        resolvedTeam.teamId === selectedTeamCanonicalId
                    );
                    if (matchesById) return true;

                    return Boolean(
                        selectedTeamCanonicalName &&
                        resolvedTeam.teamName &&
                        resolvedTeam.teamName === selectedTeamCanonicalName
                    );
                });
            }
            return true;
        });
    }, [accommodations, filterStatus, selectedTeamId, selectedTeamCanonicalId, selectedTeamCanonicalName, activeAssignmentsByAccommodationId]);

    const ownershipSummary = useMemo(() => {
        const summary: Record<string, { count: number; rent: number; deposit: number; occupants: number }> = {
            'Cheongyeon': { count: 0, rent: 0, deposit: 0, occupants: 0 },
            'Dawon': { count: 0, rent: 0, deposit: 0, occupants: 0 },
            'Individual': { count: 0, rent: 0, deposit: 0, occupants: 0 }
        };

        filteredAccommodations.forEach(acc => {
            const key = acc.ownership || 'Cheongyeon';
            if (summary[key]) {
                summary[key].count++;
                summary[key].rent += getAccommodationRent(acc);
                summary[key].deposit += getAccommodationDeposit(acc);
                const assignments = getActiveAssignmentsForAccommodation(acc);
                summary[key].occupants += assignments.length;
            }
        });

        return summary;
    }, [filteredAccommodations, activeAssignmentsByAccommodationId]);

    const filteredTotals = useMemo(() => {
        return filteredAccommodations.reduce((acc, curr) => {
            acc.count++;
            acc.rent += getAccommodationRent(curr);
            acc.deposit += getAccommodationDeposit(curr);
            const assignments = getActiveAssignmentsForAccommodation(curr);
            acc.occupants += assignments.length;
            return acc;
        }, { count: 0, rent: 0, deposit: 0, occupants: 0 });
    }, [filteredAccommodations, activeAssignmentsByAccommodationId]);

    const ownershipsConfig: { key: Accommodation['ownership']; label: string; bg: string; text: string; border: string; accent: string }[] = [
        { key: 'Cheongyeon', label: '청연', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', accent: 'bg-indigo-600' },
        { key: 'Dawon', label: '다원', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', accent: 'bg-emerald-600' },
        { key: 'Individual', label: '개인(사모님)', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', accent: 'bg-slate-500' }
    ];

    const billingTargetByAccommodationId = useMemo(() => {
        const map = new Map<string, AccommodationBillingTarget>();
        billingTargets.forEach((target) => {
            const rawAccommodationId = normalizeKey(target.accommodationId);
            if (!rawAccommodationId) return;
            const matchedById = accommodationByAnyId.get(rawAccommodationId);
            const canonicalId = normalizeKey(matchedById?.id ?? rawAccommodationId);
            if (!canonicalId || map.has(canonicalId)) return;
            map.set(canonicalId, target);
        });
        return map;
    }, [billingTargets, accommodationByAnyId]);

    const billingTargetByAccommodationName = useMemo(() => {
        const map = new Map<string, AccommodationBillingTarget>();
        billingTargets.forEach((target) => {
            const targetName = normalizeKey(target.accommodationName);
            if (targetName && !map.has(targetName)) {
                map.set(targetName, target);
            }

            const rawAccommodationId = normalizeKey(target.accommodationId);
            if (!rawAccommodationId) return;
            const matchedById = accommodationByAnyId.get(rawAccommodationId);
            const nameFromAccommodation = normalizeKey(matchedById?.name);
            if (nameFromAccommodation && !map.has(nameFromAccommodation)) {
                map.set(nameFromAccommodation, target);
            }
        });
        return map;
    }, [billingTargets, accommodationByAnyId]);

    const getPrimaryBillingTargetWorkerNameFromLegacy = (items: AccommodationAssignment[]): string => {
        const workerTargets = items
            .filter((assignment) => {
                const workerName = normalizeKey(assignment.workerName);
                if (!workerName) return false;
                if (assignment.source === 'worker') return true;
                return !assignment.source && !normalizeKey(assignment.teamId) && !normalizeKey(assignment.teamName);
            })
            .map((assignment) => ({
                name: String(assignment.workerName ?? '').trim(),
                startDate: String(assignment.startDate ?? '')
            }))
            .filter((entry) => entry.name.length > 0)
            .sort((a, b) => b.startDate.localeCompare(a.startDate));

        if (workerTargets.length === 0) return '';
        return workerTargets[0].name;
    };

    const getBillingTargetForAccommodation = (accommodation: Accommodation): AccommodationBillingTarget | undefined => {
        const accommodationId = normalizeKey(accommodation.id);
        if (accommodationId) {
            const byId = billingTargetByAccommodationId.get(accommodationId);
            if (byId) return byId;
        }

        const accommodationName = normalizeKey(accommodation.name);
        if (accommodationName) {
            const byName = billingTargetByAccommodationName.get(accommodationName);
            if (byName) return byName;
        }
        return undefined;
    };

    const buildBillingTargetLabel = (accommodation: Accommodation, items: AccommodationAssignment[]): string => {
        const separatedTarget = getBillingTargetForAccommodation(accommodation);
        if (separatedTarget) {
            return separatedTarget.targetType === 'worker' ? '개인' : '팀';
        }

        if (items.length === 0) return '-';
        const primaryWorkerTarget = getPrimaryBillingTargetWorkerNameFromLegacy(items);
        if (primaryWorkerTarget) return '개인';

        const hasTeam = items.some((assignment) => !!normalizeKey(assignment.teamId) || !!normalizeKey(assignment.teamName));
        if (hasTeam) return '팀';

        const hasWorker = items.some((assignment) => normalizeKey(assignment.workerName).length > 0);
        if (hasWorker) return '개인';

        return '-';
    };

    const buildBillingTargetWorkerList = (accommodation: Accommodation, items: AccommodationAssignment[]): string => {
        const separatedTarget = getBillingTargetForAccommodation(accommodation);
        if (separatedTarget?.targetType === 'worker') {
            const workerName = normalizeKey(separatedTarget.workerName);
            if (workerName) return workerName;
            const workerId = normalizeKey(separatedTarget.workerId);
            return workerId ? `ID:${workerId.slice(0, 8)}` : '';
        }
        return getPrimaryBillingTargetWorkerNameFromLegacy(items);
    };

    function toSafeNumber(value: unknown): number {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        if (typeof value === 'string') {
            const cleaned = value.replace(/,/g, '').trim();
            if (!cleaned) return 0;
            const parsed = Number(cleaned);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    }

    function getCurrentMonthLedgerRecord(accommodation: Accommodation): UtilityRecord | undefined {
        const accommodationId = normalizeKey(accommodation.id);
        if (accommodationId) {
            const byId = currentMonthLedgerByAccommodationId.get(accommodationId);
            if (byId) return byId;
        }

        const accommodationName = normalizeKey(accommodation.name);
        if (!accommodationName) return undefined;
        const matchedByName = accommodationByName.get(accommodationName);
        const canonicalId = normalizeKey(matchedByName?.id);
        if (!canonicalId) return undefined;
        return currentMonthLedgerByAccommodationId.get(canonicalId);
    }

    function getAccommodationRent(accommodation: Accommodation): number {
        const contractObj = (accommodation as any)?.contract;
        if (contractObj && Object.prototype.hasOwnProperty.call(contractObj, 'monthlyRent')) {
            return toSafeNumber(contractObj.monthlyRent);
        }
        if (Object.prototype.hasOwnProperty.call(accommodation as any, 'monthlyRent')) {
            return toSafeNumber((accommodation as any)?.monthlyRent);
        }

        const ledgerRecord = getCurrentMonthLedgerRecord(accommodation);
        if (Object.prototype.hasOwnProperty.call((ledgerRecord as any)?.costs ?? {}, 'rent')) {
            return toSafeNumber((ledgerRecord as any)?.costs?.rent);
        }

        return 0;
    }

    function getAccommodationDeposit(accommodation: Accommodation): number {
        const contractObj = (accommodation as any)?.contract;
        if (contractObj && Object.prototype.hasOwnProperty.call(contractObj, 'deposit')) {
            return toSafeNumber(contractObj.deposit);
        }
        if (Object.prototype.hasOwnProperty.call(accommodation as any, 'deposit')) {
            return toSafeNumber((accommodation as any)?.deposit);
        }

        const ledgerRecord = getCurrentMonthLedgerRecord(accommodation) as any;
        if (Object.prototype.hasOwnProperty.call(ledgerRecord ?? {}, 'deposit')) {
            return toSafeNumber(ledgerRecord?.deposit);
        }
        if (Object.prototype.hasOwnProperty.call(ledgerRecord?.costs ?? {}, 'deposit')) {
            return toSafeNumber(ledgerRecord?.costs?.deposit);
        }

        return 0;
    }

    const handleAddClick = () => {
        setEditingItem(undefined);
        setShowForm(true);
    };

    const handleEditClick = (item: Accommodation) => {
        const normalizedRent = getAccommodationRent(item);
        const normalizedDeposit = getAccommodationDeposit(item);
        const normalizedItem = {
            ...item,
            contract: {
                ...item.contract,
                monthlyRent: normalizedRent,
                deposit: normalizedDeposit
            }
        } as Accommodation;

        setEditingItem(normalizedItem);
        setShowForm(true);
    };

    const handleMemoClick = async (e: React.MouseEvent, item: Accommodation) => {
        e.stopPropagation();

        const result = await Swal.fire({
            title: `<div class="flex items-center gap-2"><span class="text-amber-500"><i class="fas fa-sticky-note"></i></span> ${item.name} 메모</div>`,
            input: 'textarea',
            inputLabel: '숙소 관련 특이사항이나 메모를 입력하세요.',
            inputValue: item.memo || '',
            inputPlaceholder: '이곳에 메모를 입력하세요...',
            showCancelButton: true,
            confirmButtonText: '저장하기',
            cancelButtonText: '취소',
            confirmButtonColor: '#4f46e5',
            inputAttributes: {
                'aria-label': 'Type your message here'
            },
            showDenyButton: !!item.memo,
            denyButtonText: '삭제하기',
            denyButtonColor: '#ef4444',
            customClass: {
                title: 'text-xl font-bold text-slate-800',
                input: 'rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 text-sm h-40',
                confirmButton: 'rounded-lg px-6 py-2.5 font-bold',
                cancelButton: 'rounded-lg px-6 py-2.5 font-bold',
                denyButton: 'rounded-lg px-6 py-2.5 font-bold'
            }
        });

        if (result.isConfirmed) {
            try {
                const text = result.value;
                await accommodationService.updateAccommodation(item.id, { memo: text || '' });
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: '메모가 저장되었습니다.',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true
                });
                loadData();
            } catch (error) {
                console.error("Failed to save memo", error);
                Swal.fire('오류', '메모 저장 중 오류가 발생했습니다.', 'error');
            }
        } else if (result.isDenied) {
            const confirmDelete = await Swal.fire({
                title: '메모 삭제',
                text: '이 숙소의 메모를 삭제하시겠습니까?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                confirmButtonText: '삭제',
                cancelButtonText: '취소'
            });

            if (confirmDelete.isConfirmed) {
                try {
                    await accommodationService.updateAccommodation(item.id, { memo: '' });
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: '메모가 삭제되었습니다.',
                        showConfirmButton: false,
                        timer: 2000,
                        timerProgressBar: true
                    });
                    loadData();
                } catch (error) {
                    console.error("Failed to delete memo", error);
                    Swal.fire('오류', '메모 삭제 중 오류가 발생했습니다.', 'error');
                }
            }
        }
    };

    const handleQuickAssignClick = (e: React.MouseEvent, item: Accommodation) => {
        e.stopPropagation();
        setQuickAssignItem(item);
    };

    const handleOpenAssignmentCenter = (item: Accommodation) => {
        setQuickAssignItem(item);
    };

    const handleFormSubmit = async (data: Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            if (editingItem) {
                await accommodationService.updateAccommodation(editingItem.id, data);
            } else {
                await accommodationService.addAccommodation(data);
            }
            setShowForm(false);
            loadData();
        } catch (error) {
            console.error("Failed to save", error);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm('정말 이 숙소를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.')) return;

        try {
            await accommodationService.deleteAccommodation(id);
            loadData();
        } catch (error) {
            console.error("Failed to delete", error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    const handleSeedAllAccommodations = async () => {
        const ok = window.confirm('전체 37개 숙소 데이터를 일괄 등록할까요? (이미 있으면 건너뜁니다)');
        if (!ok) return;

        setSeeding(true);
        try {
            const existingNameSet = new Set(accommodations.map((a) => a.name));

            const fullSeeds: Array<Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>> = [
                { name: '초지동 726-4 305호', address: '초지로 116', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-05-20', deposit: 0, monthlyRent: 0, paymentDay: 20, landlordName: '서원석', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '선불' },
                { name: '이동 712-2 503호', address: '광덕1로 341', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-01-30', deposit: 20000000, monthlyRent: 1530000, paymentDay: 20, landlordName: '엄순애', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1422-6 501호', address: '초당로 16-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-03-20', deposit: 5000000, monthlyRent: 650000, paymentDay: 30, landlordName: '김황원', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'variable' }, memo: '수도개별' },
                { name: '사동 1392-12 201호', address: '초당로 41', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-05-03', deposit: 5000000, monthlyRent: 420000, paymentDay: 20, landlordName: '이재천', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '1인거주' },
                { name: '사동 1408-14 202호', address: '장화3안길 9', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-07-13', deposit: 5000000, monthlyRent: 580000, paymentDay: 3, landlordName: '문지연', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1415-2 203호', address: '장화로 7', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-01-11', deposit: 5000000, monthlyRent: 580000, paymentDay: 13, landlordName: '이성현', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1403 102호', address: '장화1길 54', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2023-10-31', deposit: 5000000, monthlyRent: 430000, paymentDay: 11, landlordName: '이송재', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1431-1 202호', address: '항가울로 17', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-04-01', deposit: 5000000, monthlyRent: 500000, paymentDay: 31, landlordName: '왕경식', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1431-4 402호', address: '항가울로 13', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-12-20', deposit: 5000000, monthlyRent: 450000, paymentDay: 1, landlordName: '이상옥', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1416-1 202호', address: '평안로1안길 4', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-07-22', deposit: 5000000, monthlyRent: 530000, paymentDay: 20, landlordName: '강재인', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1424-1 202호', address: '항가울로 31-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-10-25', deposit: 5000000, monthlyRent: 500000, paymentDay: 22, landlordName: '최기호', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1421-3 202호', address: '장화3길 6', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-04-08', deposit: 5000000, monthlyRent: 545000, paymentDay: 25, landlordName: '최기호', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1421-3 303호', address: '장화3길 6', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-10-28', deposit: 5000000, monthlyRent: 545000, paymentDay: 8, landlordName: '최기호', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1426-3 301호', address: '항호1길 40-10', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-08-20', deposit: 5000000, monthlyRent: 540000, paymentDay: 28, landlordName: '이현재', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable', fixedMaintenance: 40000 }, memo: '' },
                { name: '와동 730-5 202호', address: '와개길 53-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-03-02', deposit: 5000000, monthlyRent: 450000, paymentDay: 20, landlordName: '박점쇠', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable', fixedMaintenance: 30000 }, memo: '' },
                { name: '와동 730-5 103호', address: '와개길 53-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-01-29', deposit: 5000000, monthlyRent: 450000, paymentDay: 2, landlordName: '박점쇠', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '1인거주' },
                { name: '와동 729-5 401호', address: '와개길 62', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-11-26', deposit: 5000000, monthlyRent: 480000, paymentDay: 29, landlordName: '정숙영', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '와동 729-5 203호', address: '와개길 62', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-06-01', deposit: 5000000, monthlyRent: 480000, paymentDay: 26, landlordName: '정숙영', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '와동 729-5 204호', address: '와개길 62', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2023-08-31', deposit: 5000000, monthlyRent: 480000, paymentDay: 1, landlordName: '정숙영', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '3인거주' },
                { name: '사동 1428-14 202호', address: '항호1길 26-5', type: 'Apartment', status: 'active', contract: { startDate: '2023-08-31', endDate: '', deposit: 5000000, monthlyRent: 450000, paymentDay: 1, landlordName: '김종국', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'fixed', maintenance: 'fixed', fixedInternet: 25000, fixedMaintenance: 50000 }, memo: '' },
                { name: '사동 1393-3 201호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '2024-04-27', endDate: '2026-04-27', deposit: 3000000, monthlyRent: 500000, paymentDay: 28, landlordName: '유현주', landlordContact: '농협 352-1436-374583', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'fixed', maintenance: 'fixed', fixedInternet: 25000, fixedMaintenance: 50000 }, memo: '수도개별' },
                { name: '사동 1407-31 201호', address: '장화로 22-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-07-31', deposit: 5000000, monthlyRent: 430000, paymentDay: 31, landlordName: '김숙향', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1407-22 202호', address: '장화2길 37-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2024-11-01', deposit: 5000000, monthlyRent: 530000, paymentDay: 1, landlordName: '김순자', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable', fixedMaintenance: 30000 }, memo: '2명거주 관리비10,000추가' },
                { name: '사동 1421-4 202호', address: '장화3길 6-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2025-05-31', deposit: 5000000, monthlyRent: 400000, paymentDay: 31, landlordName: '이선옥', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '' },
                { name: '사동 1383-10 402호', address: '항호2길 12-10', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-01-04', deposit: 10000000, monthlyRent: 530000, paymentDay: 4, landlordName: '임진우', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '' },
                { name: '사동 1415-2 401호', address: '장화로 7', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2024-03-31', deposit: 10000000, monthlyRent: 830000, paymentDay: 31, landlordName: '문지연', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '' },
                { name: '사동 1407-1 103호', address: '장화3길 28', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2024-12-01', deposit: 5000000, monthlyRent: 480000, paymentDay: 1, landlordName: '양재순', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '' },
                { name: '사동 1394-5 303호', address: '초당5길 22', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-02-04', deposit: 5000000, monthlyRent: 458000, paymentDay: 4, landlordName: '박옥자', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1393-3 203호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-11-20', deposit: 3000000, monthlyRent: 500000, paymentDay: 20, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '수도개별' },
                { name: '사동 1376-6 303호', address: '항가울로 56', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-11-10', deposit: 5000000, monthlyRent: 450000, paymentDay: 10, landlordName: '이은영', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1386-3 302호', address: '항가울로 48', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-07-22', deposit: 5000000, monthlyRent: 500000, paymentDay: 22, landlordName: '장철수', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1393-3 303호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-06-30', deposit: 3000000, monthlyRent: 520000, paymentDay: 5, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'included' }, memo: '관리비포함(47만원)' },
                { name: '사동 1393-3 103호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-11-04', deposit: 3000000, monthlyRent: 520000, paymentDay: 30, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1421-4 402호', address: '장화3길 6-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2023-10-30', deposit: 10000000, monthlyRent: 800000, paymentDay: 30, landlordName: '이선옥', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'included' }, memo: '3인포함' },
                { name: '사동 1421-3 304호', address: '장화3길 6', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-08-04', deposit: 2000000, monthlyRent: 330000, paymentDay: 4, landlordName: '최기호', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1393-3 101호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2025-09-30', deposit: 3000000, monthlyRent: 500000, paymentDay: 1, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '수도개별' },
                { name: '사동 1393-3 301호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-07-06', deposit: 2000000, monthlyRent: 520000, paymentDay: 7, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '수도개별' },
                { name: '사동 1393-3 402호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-10-14', deposit: 15000000, monthlyRent: 900000, paymentDay: 15, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '수도개별' }
            ];

            const toCreate = fullSeeds.filter((s) => !existingNameSet.has(s.name));

            for (const item of toCreate) {
                await accommodationService.addAccommodation(item);
            }

            await loadData();

            if (toCreate.length === 0) {
                alert('모든 숙소가 이미 등록되어 있습니다.');
            } else {
                alert(`${toCreate.length}건 등록 완료!`);
            }
        } catch (e) {
            console.error(e);
            alert('등록에 실패했습니다.');
        } finally {
            setSeeding(false);
        }
    };

    if (canUseAccommodationManager === null) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
        );
    }

    if (canUseAccommodationManager === false) {
        return (
            <div className="p-10 max-w-4xl mx-auto min-h-screen flex items-center justify-center">
                <div className="bg-white rounded-2xl border border-red-100 shadow-xl p-8 text-center max-w-lg">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                        <FontAwesomeIcon icon={faUsers} size="2x" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">접근 권한 없음</h2>
                    <p className="text-slate-500">관리자(admin) 계정만 숙소 관리를 사용할 수 있습니다.</p>
                </div>
            </div>
        );
    }

    // Stats Logic
    const totalCount = accommodations.length;
    const occupiedCount = accommodations.filter(a => a.status === 'active').reduce((acc, _) => acc + 1, 0); // safe count
    const vacantCount = accommodations.filter(a => a.status === 'inactive').reduce((acc, _) => acc + 1, 0);
    const totalRent = accommodations
        .filter(a => a.status === 'active')
        .reduce((sum, a) => sum + getAccommodationRent(a), 0);
    const totalDeposit = accommodations
        .filter(a => a.status === 'active')
        .reduce((sum, a) => sum + getAccommodationDeposit(a), 0);

    // Calculate Alerts (Rent Due Soon)
    const today = new Date();
    const currentDay = today.getDate();
    const upcomingRentAccommodations = accommodations.filter(a => {
        if (a.status !== 'active' || !a.contract.rentPayDate) return false;

        // Logical "Due Soon": if payDate is within next 3 days or today
        // Simple logic: if abs(payDate - currentDay) <= 3
        // Note: Edge case of month transition is ignored for simplicity as per requirement, but can be robust.
        // Let's stick to "Current month's pay day is approaching or passed recently"

        const payDay = a.contract.rentPayDate;
        // Check if Pay Day is "Close" (e.g. today, tomorrow, or 2 days ago overdue)
        // Or if today is greater than payDay (Overdue for this month?) - assuming user clears it?
        // Actually, without a "Payment Record" check, we just alert if the *Day* is near.

        const diff = payDay - currentDay;
        // e.g. Day 20. Today 18. Diff 2. (Upcoming)
        // Day 20. Today 21. Diff -1. (Passed/Overdue?)

        return diff >= 0 && diff <= 3;
    });



    // Calculate Occupancy Rate
    const occupancyRate = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 xl:p-10">
            <div className="max-w-[1800px] mx-auto space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <FontAwesomeIcon icon={faBuilding} className="text-lg" />
                            </span>
                            숙소 관리 통합 콘솔
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium ml-14">
                            부동산 계약 현황, 월별 공과금 정산, 청구 관리 및 작업자 배정을 통합 관리합니다.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleSeedAllAccommodations}
                            disabled={seeding}
                            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-sm flex items-center gap-2
                                ${seeding ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
                            `}
                        >
                            {seeding ? <div className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full"></div> : <FontAwesomeIcon icon={faPlus} />}
                            샘플 데이터 생성
                        </button>
                        <button
                            onClick={handleAddClick}
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 hover:-translate-y-0.5 flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            신규 숙소 등록
                        </button>
                    </div>
                </div>

                {/* Modern Navigation Tabs */}
                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex">
                    {[
                        { id: 'status', label: '숙소 현황판', icon: faChartPie },
                        { id: 'ledger', label: '월별 공과금 대장', icon: faFileInvoiceDollar },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2.5
                                ${activeTab === tab.id
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }
                            `}
                        >
                            <FontAwesomeIcon icon={tab.icon} className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="animate-fade-in-up">
                    {activeTab === 'status' ? (
                        <div className="space-y-8">
                            {/* Alerts Section */}
                            <div className="space-y-4">
                                {/* Expiration Alert (Priority) */}
                                {upcomingExpirations.length > 0 && !dismissedExpirationAlerts && (
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm animate-fade-in-down">
                                        <div className="bg-red-100 p-2 rounded-full text-red-600">
                                            <FontAwesomeIcon icon={faExclamationTriangle} className="animate-pulse" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold text-red-800 text-sm mb-1">계약 만료 예정인 숙소가 있습니다! (1개월 내)</h3>
                                                <button
                                                    onClick={() => setDismissedExpirationAlerts(true)}
                                                    className="text-xs font-bold text-red-400 hover:text-red-600 underline"
                                                >
                                                    확인 (닫기)
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {upcomingExpirations.map(acc => {
                                                    const daysLeft = Math.ceil((new Date(acc.contract.endDate || '').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                                    return (
                                                        <span key={acc.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-red-200 text-xs font-bold text-red-700 shadow-sm">
                                                            <FontAwesomeIcon icon={faBuilding} className="text-red-400" />
                                                            {acc.name} ({acc.contract.endDate} / {daysLeft}일 남음)
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Rent Due Alert */}
                                {upcomingRentAccommodations.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm animate-fade-in-down">
                                        <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                                            <FontAwesomeIcon icon={faBell} className="animate-swing" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-amber-800 text-sm mb-1">곧 월세 납부일인 숙소가 있습니다!</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {upcomingRentAccommodations.map(acc => (
                                                    <span key={acc.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs font-bold text-amber-700 shadow-sm">
                                                        <FontAwesomeIcon icon={faBuilding} className="text-amber-400" />
                                                        {acc.name} (매월 {acc.contract.rentPayDate}일)
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-1">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setFilterStatus('active')}
                                        className={`pb-3 px-1 text-sm font-bold transition-all relative
                                            ${filterStatus === 'active' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}
                                        `}
                                    >
                                        운영 중인 숙소 ({occupiedCount}호)
                                        {filterStatus === 'active' && (
                                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full"></div>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus('inactive')}
                                        className={`pb-3 px-1 text-sm font-bold transition-all relative
                                            ${filterStatus === 'inactive' ? 'text-slate-600' : 'text-slate-400 hover:text-slate-600'}
                                        `}
                                    >
                                        계약 종료 / 보관함 ({vacantCount}호)
                                        {filterStatus === 'inactive' && (
                                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-600 rounded-full"></div>
                                        )}
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 mb-2">
                                    {filterStatus === 'active' && (
                                        <select
                                            value={selectedTeamId}
                                            onChange={(e) => setSelectedTeamId(e.target.value)}
                                            className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 min-w-[200px]"
                                        >
                                            <option value="">전체 팀 보기</option>
                                            {selectableTeams.map((team) => (
                                                <option key={team.id} value={team.id}>
                                                    {team.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {/* View Mode Toggle */}
                                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5
                                                ${viewMode === 'list'
                                                    ? 'bg-white text-indigo-600 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'}
                                            `}
                                            title="목록형"
                                        >
                                            <FontAwesomeIcon icon={faList} />
                                            목록
                                        </button>
                                        <button
                                            onClick={() => setViewMode('card')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5
                                                ${viewMode === 'card'
                                                    ? 'bg-white text-indigo-600 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'}
                                            `}
                                            title="카드형"
                                        >
                                            <FontAwesomeIcon icon={faTh} />
                                            카드
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-slate-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">총 관리 숙소</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-3xl font-extrabold text-slate-800">{totalCount}</h3>
                                            <span className="text-sm font-bold text-slate-400">호</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded-lg">
                                            <FontAwesomeIcon icon={faBuilding} className="text-slate-400" /> 전체 등록된 숙소
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-wider mb-2">계약 중 (입실)</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-3xl font-extrabold text-slate-800">{occupiedCount}</h3>
                                            <span className="text-sm font-bold text-slate-400">호</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                                            <FontAwesomeIcon icon={faChartPie} /> 가동률 {occupancyRate}%
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-indigo-600/70 uppercase tracking-wider mb-2">총 월세 지출액</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-3xl font-extrabold text-slate-800">{totalRent.toLocaleString()}</h3>
                                            <span className="text-sm font-bold text-slate-400">원</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 w-fit px-2 py-1 rounded-lg">
                                            <FontAwesomeIcon icon={faWonSign} /> 매월 고정 지출
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-blue-600/70 uppercase tracking-wider mb-2">총 예치 보증금</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-3xl font-extrabold text-slate-800">{totalDeposit.toLocaleString()}</h3>
                                            <span className="text-sm font-bold text-slate-400">원</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-blue-700 bg-blue-50 w-fit px-2 py-1 rounded-lg">
                                            <FontAwesomeIcon icon={faWonSign} /> 자산 (반환 예정)
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-orange-100 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-orange-600/70 uppercase tracking-wider mb-2">공실 (계약 종료)</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-3xl font-extrabold text-slate-800">{vacantCount}</h3>
                                            <span className="text-sm font-bold text-slate-400">호</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-orange-700 bg-orange-50 w-fit px-2 py-1 rounded-lg">
                                            <FontAwesomeIcon icon={faBed} /> 비어있는 숙소
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Accommodation List/Cards */}
                            {loading ? (
                                <div className="h-64 flex items-center justify-center text-slate-400">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : accommodations.length === 0 ? (
                                <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-20 text-center">
                                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                                        <FontAwesomeIcon icon={faBuilding} className="text-4xl" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-700 mb-2">등록된 숙소가 없습니다</h3>
                                    <p className="text-slate-400 mb-6">새로운 숙소를 등록하여 관리를 시작해보세요.</p>
                                    <button
                                        onClick={handleAddClick}
                                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition"
                                    >
                                        숙소 등록하기
                                    </button>
                                </div>
                            ) : viewMode === 'list' ? (
                                /* ── 목록형 (Table) ── */
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider w-8">#</th>
                                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">숙소명</th>
                                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">주소</th>
                                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">배정팀</th>
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">상태/명의</th>
                                                    <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">월세</th>
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">보증금</th>
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">배정인원</th>
                                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">청구대상</th>
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">이체/월세일</th>
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">계약만료</th>
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">임대인</th>
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider w-20"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredAccommodations
                                                    .map((acc, rowIdx) => {
                                                        const activeList = getActiveAssignmentsForAccommodation(acc);
                                                        const assignedWorkerNames = Array.from(
                                                            new Set(
                                                                activeList
                                                                    .map((assignment) => String(assignment.workerName ?? '').trim())
                                                                    .filter((name) => name.length > 0)
                                                            )
                                                        );
                                                        const assignedWorkerDisplayNames = assignedWorkerNames.length > 0
                                                            ? assignedWorkerNames
                                                            : Array.from(
                                                                new Set(
                                                                    activeList
                                                                        .map((assignment) => normalizeKey(assignment.workerId))
                                                                        .filter((workerId) => workerId.length > 0)
                                                                        .map((workerId) => `ID:${workerId.slice(0, 8)}`)
                                                                )
                                                            );
                                                        const primaryTeamAssign = activeList.find(
                                                            (a) => !!normalizeKey(a.teamId) || !!normalizeKey(a.teamName)
                                                        );
                                                        const primaryTeamInfo = primaryTeamAssign
                                                            ? getTeamInfo(primaryTeamAssign.teamId, primaryTeamAssign.teamName)
                                                            : undefined;
                                                        const separatedBillingTarget = getBillingTargetForAccommodation(acc);
                                                        const separatedWorkerId = normalizeKey(separatedBillingTarget?.workerId);
                                                        const separatedWorkerNameFromAssignments = separatedWorkerId
                                                            ? activeList.find((assignment) => normalizeKey(assignment.workerId) === separatedWorkerId)?.workerName
                                                            : '';
                                                        const billingTargetWorkerName = separatedBillingTarget?.targetType === 'worker'
                                                            ? String(
                                                                separatedBillingTarget.workerName
                                                                || separatedWorkerNameFromAssignments
                                                                || getPrimaryBillingTargetWorkerNameFromLegacy(activeList)
                                                                || assignedWorkerDisplayNames[0]
                                                                || ''
                                                            ).trim()
                                                            : '';
                                                        const separatedTeamId = normalizeKey(separatedBillingTarget?.teamId);
                                                        const separatedTeamName = normalizeKey(separatedBillingTarget?.teamName);
                                                        const separatedTeam = separatedTeamId
                                                            ? teamByAnyId.get(separatedTeamId)
                                                            : (separatedTeamName ? teamByName.get(separatedTeamName) : undefined);
                                                        const billingTargetTeamName = separatedBillingTarget?.targetType === 'team'
                                                            ? String(
                                                                separatedBillingTarget.teamName
                                                                || separatedTeam?.name
                                                                || primaryTeamAssign?.teamName
                                                                || ''
                                                            ).trim()
                                                            : '';
                                                        const billingTargetType = separatedBillingTarget?.targetType
                                                            ?? (billingTargetWorkerName ? 'worker' : billingTargetTeamName ? 'team' : undefined);
                                                        const billingTargetName = billingTargetType === 'worker'
                                                            ? billingTargetWorkerName
                                                            : billingTargetTeamName;
                                                        const billingTargetTeamInfo = billingTargetType === 'team'
                                                            ? getTeamInfo(separatedTeam?.id ?? primaryTeamAssign?.teamId, billingTargetName)
                                                            : undefined;
                                                        const tc = primaryTeamInfo?.color;
                                                        const paymentDay = acc.contract.paymentDay || acc.contract.rentPayDate;
                                                        const isContractExpired = acc.contract.endDate && new Date(acc.contract.endDate) < new Date();

                                                        return (
                                                            <tr
                                                                key={acc.id}
                                                                onClick={() => handleOpenAssignmentCenter(acc)}
                                                                className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                                                                style={tc ? { borderLeft: `3px solid ${tc}` } : undefined}
                                                            >
                                                                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{rowIdx + 1}</td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-2 group/name">
                                                                        <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                                                            {acc.name}
                                                                        </span>
                                                                        <button
                                                                            onClick={(e) => handleMemoClick(e, acc)}
                                                                            title={acc.memo || '메모 추가'}
                                                                            className={`transition-all duration-200 hover:scale-110 active:scale-95 ${acc.memo ? 'text-amber-400 opacity-100' : 'text-slate-300 opacity-0 group-hover/name:opacity-100'
                                                                                }`}
                                                                        >
                                                                            <FontAwesomeIcon icon={faStickyNote} className="text-sm" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-500 text-xs">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-300 text-[10px]" />
                                                                        {acc.address}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {primaryTeamAssign ? (
                                                                        <span
                                                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold"
                                                                            style={tc ? {
                                                                                backgroundColor: hexToRgba(tc, 0.1),
                                                                                color: tc,
                                                                                border: `1px solid ${hexToRgba(tc, 0.2)}`,
                                                                            } : {
                                                                                backgroundColor: '#f1f5f9',
                                                                                color: '#475569',
                                                                                border: '1px solid #e2e8f0',
                                                                            }}
                                                                        >
                                                                            <FontAwesomeIcon icon={getTeamFaIcon(primaryTeamInfo?.icon)} className="text-[10px]" />
                                                                            {primaryTeamAssign.teamName || primaryTeamAssign.workerName}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-300">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        {(() => {
                                                                            const ownership = acc.ownership || 'Cheongyeon';
                                                                            const label = { Cheongyeon: '청연', Dawon: '다원', Individual: '개인(사모님)' }[ownership];
                                                                            const colorClass = {
                                                                                Cheongyeon: 'bg-indigo-100 text-indigo-700',
                                                                                Dawon: 'bg-emerald-100 text-emerald-700',
                                                                                Individual: 'bg-slate-100 text-slate-600'
                                                                            }[ownership];
                                                                            return (
                                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colorClass}`}>
                                                                                    {label}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${acc.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                                            {acc.status === 'active' ? '계약중' : '종료'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-bold text-slate-700">
                                                                    {getAccommodationRent(acc).toLocaleString()}<span className="text-slate-400 font-normal">원</span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center text-xs text-slate-500">
                                                                    {`${getAccommodationDeposit(acc).toLocaleString()}원`}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    {assignedWorkerDisplayNames.length > 0 ? (
                                                                        <div className="flex flex-wrap items-center justify-center gap-1">
                                                                            {assignedWorkerDisplayNames.map((workerName) => (
                                                                                <span
                                                                                    key={workerName}
                                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100"
                                                                                >
                                                                                    <FontAwesomeIcon icon={faUser} className="text-[9px]" />
                                                                                    {workerName}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-300">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-xs text-slate-600">
                                                                    {billingTargetType && billingTargetName ? (
                                                                        <span
                                                                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold ${billingTargetType === 'team'
                                                                                ? ''
                                                                                : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                                                }`}
                                                                            style={billingTargetType === 'team'
                                                                                ? (billingTargetTeamInfo?.color ? {
                                                                                    backgroundColor: hexToRgba(billingTargetTeamInfo.color, 0.1),
                                                                                    color: billingTargetTeamInfo.color,
                                                                                    border: `1px solid ${hexToRgba(billingTargetTeamInfo.color, 0.2)}`
                                                                                } : {
                                                                                    backgroundColor: '#f1f5f9',
                                                                                    color: '#475569',
                                                                                    border: '1px solid #e2e8f0'
                                                                                })
                                                                                : undefined}
                                                                        >
                                                                            <FontAwesomeIcon
                                                                                icon={billingTargetType === 'team' ? getTeamFaIcon(billingTargetTeamInfo?.icon) : faUser}
                                                                                className="text-[10px]"
                                                                            />
                                                                            {billingTargetName}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-300">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        {acc.contract.isAutoTransfer && (
                                                                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1" title={`자동이체: 매월 ${acc.contract.transferDay}일 (${acc.contract.transferAccountInfo || '계좌정보 없음'})`}>
                                                                                <FontAwesomeIcon icon={faFileInvoiceDollar} />
                                                                                {acc.contract.transferDay}일
                                                                            </span>
                                                                        )}
                                                                        {paymentDay ? (
                                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${Math.abs(paymentDay - new Date().getDate()) <= 3 ? 'bg-amber-100 text-amber-700' : 'text-slate-500'}`}>
                                                                                {paymentDay}일
                                                                            </span>
                                                                        ) : (
                                                                            !acc.contract.isAutoTransfer && <span className="text-xs text-slate-300">-</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    {acc.contract.endDate ? (
                                                                        <span className={`text-xs font-medium ${isContractExpired ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                                                                            {acc.contract.endDate}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-300">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-center text-xs text-slate-500">
                                                                    {acc.contract.landlordName || '-'}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                        <button
                                                                            onClick={(e) => handleQuickAssignClick(e, acc)}
                                                                            className="px-2.5 h-7 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 flex items-center justify-center gap-1.5 text-indigo-700 transition-colors text-[11px] font-bold"
                                                                            title="배정/청구대상 관리"
                                                                        >
                                                                            <FontAwesomeIcon icon={faUsers} className="text-[10px]" />
                                                                            배정/청구
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleEditClick(acc);
                                                                            }}
                                                                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-amber-50 flex items-center justify-center text-slate-400 hover:text-amber-600 transition-colors"
                                                                            title="숙소 정보 수정"
                                                                        >
                                                                            <FontAwesomeIcon icon={faPen} className="text-xs" />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => handleDelete(e, acc.id)}
                                                                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-rose-50 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                                                                            title="삭제"
                                                                        >
                                                                            <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                /* ── 카드형 (Grid) ── */
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {filteredAccommodations.map(acc => (
                                        (() => {
                                            const activeList = getActiveAssignmentsForAccommodation(acc);
                                            const checkedInCount = activeList.length;
                                            const billingTargetLabel = buildBillingTargetLabel(acc, activeList);
                                            const billingTargetWorkers = buildBillingTargetWorkerList(acc, activeList);
                                            const isExpired = acc.status === 'inactive';

                                            const primaryTeamAssign = activeList.find(
                                                (a) => !!normalizeKey(a.teamId) || !!normalizeKey(a.teamName)
                                            );
                                            const primaryTeamInfo = primaryTeamAssign
                                                ? getTeamInfo(primaryTeamAssign.teamId, primaryTeamAssign.teamName)
                                                : undefined;
                                            const tc = primaryTeamInfo?.color;

                                            return (
                                                <div
                                                    key={acc.id}
                                                    onClick={() => handleOpenAssignmentCenter(acc)}
                                                    className={`group bg-white rounded-2xl border transition-all cursor-pointer relative overflow-hidden
                                                        ${isExpired
                                                            ? 'border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                                                            : 'border-slate-200 hover:border-slate-300 hover:-translate-y-1'
                                                        }
                                                    `}
                                                    style={{
                                                        borderLeftWidth: tc ? '4px' : undefined,
                                                        borderLeftColor: tc || undefined,
                                                        boxShadow: tc ? `0 4px 20px -4px ${hexToRgba(tc, 0.12)}` : undefined,
                                                    }}
                                                >
                                                    {tc && (
                                                        <div className="h-1" style={{ background: `linear-gradient(to right, ${tc}, ${hexToRgba(tc, 0.1)}, transparent)` }} />
                                                    )}
                                                    <div className="p-6">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5
                                                            ${acc.status === 'active'
                                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                                    : 'bg-slate-100 text-slate-500 border border-slate-200'}
                                                        `}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${acc.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                                                {acc.status === 'active' ? '계약중' : '계약종료'}
                                                            </span>
                                                            {/* Ownership Badge */}
                                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ml-2
                                                                     ${(acc.ownership === 'Dawon') ? 'bg-emerald-100 text-emerald-700' :
                                                                    (acc.ownership === 'Individual') ? 'bg-slate-100 text-slate-600' :
                                                                        'bg-indigo-100 text-indigo-700'}
                                                                 `}>
                                                                {{ Cheongyeon: '청연', Dawon: '다원', Individual: '개인(사모님)' }[acc.ownership || 'Cheongyeon']}
                                                            </span>
                                                            <div className="flex gap-2 items-center">
                                                                <button
                                                                    onClick={(e) => handleDelete(e, acc.id)}
                                                                    className="w-8 h-8 rounded-full bg-slate-50 hover:bg-rose-50 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors z-10"
                                                                    title="숙소 삭제"
                                                                >
                                                                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEditClick(acc);
                                                                    }}
                                                                    className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-amber-50 flex items-center justify-center text-slate-300 group-hover:text-amber-600 transition-colors z-10"
                                                                    title="숙소 정보 수정"
                                                                >
                                                                    <FontAwesomeIcon icon={faPen} className="text-xs" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {primaryTeamAssign && (
                                                            <div className="mb-3">
                                                                <span
                                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold"
                                                                    style={tc ? {
                                                                        backgroundColor: hexToRgba(tc, 0.1),
                                                                        color: tc,
                                                                        border: `1px solid ${hexToRgba(tc, 0.2)}`,
                                                                    } : {
                                                                        backgroundColor: '#f1f5f9',
                                                                        color: '#475569',
                                                                        border: '1px solid #e2e8f0',
                                                                    }}
                                                                >
                                                                    <FontAwesomeIcon icon={getTeamFaIcon(primaryTeamInfo?.icon)} className="text-xs" />
                                                                    {primaryTeamAssign.teamName || primaryTeamAssign.workerName}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-2 mb-1 group/cardname">
                                                            <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-700 transition-colors truncate">
                                                                {acc.name}
                                                            </h3>
                                                            <button
                                                                onClick={(e) => handleMemoClick(e, acc)}
                                                                title={acc.memo || '메모 추가'}
                                                                className={`flex-shrink-0 transition-all duration-200 hover:scale-110 active:scale-95 ${acc.memo ? 'text-amber-400 opacity-100' : 'text-slate-200 opacity-0 group-hover/cardname:opacity-100'
                                                                    }`}
                                                            >
                                                                <FontAwesomeIcon icon={faStickyNote} className="text-base" />
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                                                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-300" />
                                                            <span className="truncate">{acc.address}</span>
                                                        </div>

                                                        <div className="space-y-3 pt-4 border-t border-slate-100">
                                                            <div className="flex justify-between items-center text-sm">
                                                                <span className="text-slate-400 font-medium text-xs">월세</span>
                                                                <span className="font-bold text-slate-700">{getAccommodationRent(acc).toLocaleString()}원</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-sm mb-2">
                                                                <span className="text-slate-400 font-medium text-xs">현재 입실 ({checkedInCount}명)</span>
                                                                <button
                                                                    onClick={(e) => handleQuickAssignClick(e, acc)}
                                                                    className="px-2 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 transition-colors flex items-center gap-1"
                                                                >
                                                                    <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                                                                    배정/청구관리
                                                                </button>
                                                            </div>

                                                            {activeList.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                                    {activeList.map(assign => {
                                                                        const assignTeamInfo = getTeamInfo(assign.teamId, assign.teamName);
                                                                        const atc = assignTeamInfo?.color;

                                                                        return (
                                                                            <span key={assign.id}
                                                                                className="text-xs px-2 py-1 rounded-lg font-bold border flex items-center gap-1.5"
                                                                                style={atc ? {
                                                                                    backgroundColor: hexToRgba(atc, 0.08),
                                                                                    color: atc,
                                                                                    borderColor: hexToRgba(atc, 0.2),
                                                                                } : {
                                                                                    backgroundColor: '#ffffff',
                                                                                    color: '#475569',
                                                                                    borderColor: '#e2e8f0',
                                                                                }}
                                                                            >
                                                                                <FontAwesomeIcon
                                                                                    icon={faUser}
                                                                                    className="text-[10px]"
                                                                                />
                                                                                {assign.workerName}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="mb-3 pt-3 border-t border-dashed border-slate-100 flex justify-center">
                                                                    <button
                                                                        onClick={(e) => handleQuickAssignClick(e, acc)}
                                                                        className="w-full py-2 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5"
                                                                    >
                                                                        <FontAwesomeIcon icon={faPlus} />
                                                                        지금 입실/배정/청구설정
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between items-center text-sm">
                                                                <span className="text-slate-400 font-medium text-xs">청구 대상</span>
                                                                <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                                                    {billingTargetLabel}
                                                                </span>
                                                            </div>
                                                            {billingTargetWorkers && (
                                                                <div className="text-[11px] text-slate-500 leading-relaxed">
                                                                    개인: {billingTargetWorkers}
                                                                </div>
                                                            )}
                                                            {(() => {
                                                                const paymentDay = acc.contract.paymentDay || acc.contract.rentPayDate;
                                                                return paymentDay ? (
                                                                    <div className="flex justify-between items-center text-sm">
                                                                        <span className="text-slate-400 font-medium text-xs">월세일</span>
                                                                        <span className={`font-bold text-xs px-2 py-0.5 rounded ${Math.abs(paymentDay - new Date().getDate()) <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
                                                                            매월 {paymentDay}일
                                                                        </span>
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>

                                                        {acc.contract.endDate && (
                                                            <div className={`mt-4 pt-3 border-t border-dashed text-xs text-center font-medium
                                                            ${new Date(acc.contract.endDate) < new Date() ? 'text-rose-500 bg-rose-50 rounded-lg py-1.5' : 'text-slate-400'}
                                                        `}>
                                                                계약만료: {acc.contract.endDate}
                                                            </div>
                                                        )}

                                                    </div>
                                                </div>
                                            );
                                        })()
                                    ))}
                                </div>
                            )}

                            {/* Ownership Summary Breakdown */}
                            <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in-up">
                                <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faChartPie} className="text-indigo-500" />
                                        명의별 현황 요약 ({filterStatus === 'active' ? '운영 중' : '보관함'})
                                    </h3>
                                    <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                        {selectedTeamId ? '필터링된 결과' : '전체 결과'}
                                    </div>
                                </div>
                                <div className="p-0">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100">
                                        {ownershipsConfig.map(({ key, label, bg, text, border, accent }) => {
                                            const s = ownershipSummary[key || 'Cheongyeon'];
                                            return (
                                                <div key={key} className="p-6 hover:bg-slate-50/50 transition-colors">
                                                    <div className="flex items-center gap-2 mb-5">
                                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${bg} ${text} border ${border} shadow-sm`}>
                                                            {label}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-y-5 gap-x-2">
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">숙소 수</p>
                                                            <p className="text-lg font-extrabold text-slate-700">{s.count}<span className="text-slate-400 text-xs font-medium ml-1">호</span></p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">입실 인원</p>
                                                            <p className="text-lg font-extrabold text-slate-700">{s.occupants}<span className="text-slate-400 text-xs font-medium ml-1">명</span></p>
                                                        </div>
                                                        <div className="pt-3 border-t border-slate-50">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">보증금 합계</p>
                                                            <p className="text-sm font-bold text-slate-600">
                                                                {s.deposit.toLocaleString()}
                                                                <span className="text-slate-400 text-[10px] font-medium ml-1">원</span>
                                                            </p>
                                                        </div>
                                                        <div className="pt-3 border-t border-slate-50">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">매월 월세 지출</p>
                                                            <p className="text-lg font-black text-indigo-600">
                                                                {s.rent.toLocaleString()}
                                                                <span className="text-slate-400 text-[10px] font-bold ml-1 whitespace-nowrap">원 / 월</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Grand Total Column */}
                                        <div className="p-6 bg-indigo-50/20 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-2 opacity-5">
                                                <FontAwesomeIcon icon={faBuilding} size="4x" className="text-indigo-600" />
                                            </div>
                                            <div className="flex items-center gap-2 mb-5">
                                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white border border-indigo-600 shadow-md">
                                                    전체 합계
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-y-5 gap-x-2 relative z-10">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">총 관리 숙소</p>
                                                    <p className="text-lg font-extrabold text-slate-800">{filteredTotals.count}<span className="text-slate-400 text-xs font-medium ml-1">호</span></p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">총 입실 인원</p>
                                                    <p className="text-lg font-extrabold text-slate-800">{filteredTotals.occupants}<span className="text-slate-400 text-xs font-medium ml-1">명</span></p>
                                                </div>
                                                <div className="pt-3 border-t border-indigo-100">
                                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">총 예치 보증금</p>
                                                    <p className="text-sm font-bold text-slate-700">
                                                        {filteredTotals.deposit.toLocaleString()}
                                                        <span className="text-slate-400 text-[10px] font-medium ml-1">원</span>
                                                    </p>
                                                </div>
                                                <div className="pt-3 border-t border-indigo-100">
                                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">총 고정비 (월세)</p>
                                                    <p className="text-xl font-black text-indigo-700">
                                                        {filteredTotals.rent.toLocaleString()}
                                                        <span className="text-indigo-400 text-sm font-bold ml-1.5">원</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-indigo-50/70 rounded-2xl border border-indigo-100 shadow-sm p-5">
                                <h2 className="text-sm font-extrabold text-indigo-900">배정/청구관리 통합 안내</h2>
                                <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                                    현황판에서 숙소 행/카드를 클릭하거나 `배정/청구관리` 버튼을 누르면, 배정 등록과 청구대상(팀/개인) 설정을 한 화면에서 함께 관리합니다.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <UtilityLedger />
                    )}
                </div>
            </div>

            {showForm && (
                <AccommodationForm
                    initialData={editingItem}
                    onSubmit={handleFormSubmit}
                    onCancel={() => setShowForm(false)}
                    onManageAssignments={(item) => {
                        // Close the form first if needed, or keep it open in background
                        // Since new modal is z-50 and form is likely z-50, we might need z-index management or close form
                        // Let's close form to avoid confusion
                        setShowForm(false);
                        setQuickAssignItem(item);
                    }}
                />
            )}

            {quickAssignItem && (
                <AccommodationQuickAssignmentModal
                    accommodation={quickAssignItem}
                    activeAssignments={getActiveAssignmentsForAccommodation(quickAssignItem)}
                    isOpen={!!quickAssignItem}
                    onClose={() => setQuickAssignItem(null)}
                    onSuccess={() => {
                        loadData(); // 단순 리로드 (UX 개선을 위해선 로컬 state만 바꿔도 되지만 안전하게)
                        // setQuickAssignItem(null); // Keep open? No, close makes sense or user closes manually
                    }}
                />
            )}
        </div>
    );
};

export default AccommodationManager;
