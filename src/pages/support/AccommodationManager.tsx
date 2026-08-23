import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faFileInvoiceDollar, faPlus, faChartPie, faMapMarkerAlt, faUser, faBed, faWonSign, faExclamationTriangle, faBell, faBoxArchive, faList, faTh, faUsers, faStickyNote, faPen, faRotateRight, faHistory, faSearch, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { iconMap } from '../../constants/iconMap';
import { accommodationService } from '../../services/accommodationService';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { Accommodation, UtilityRecord } from '../../types/accommodation';
import AccommodationForm from '../../components/accommodation/AccommodationForm';
import AccommodationQuickAssignmentModal from '../../components/accommodation/QuickAssignmentModal';
import UtilityLedger from '../../components/accommodation/UtilityLedger';
import { SupportTeamFilterTabs } from '../../components/support/SupportTeamFilterTabs';
import { SupportPageHeader } from '../../components/support/SupportPageHeader';
import { SupportSegmentedTabs, type SupportSegmentedTabOption } from '../../components/support/SupportSegmentedTabs';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { AccommodationAssignment } from '../../types/accommodationAssignment';
import { accommodationBillingTargetService } from '../../services/accommodationBillingTargetService';
import { AccommodationBillingTarget } from '../../types/accommodationBillingTarget';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { userMenuPositionService } from '../../services/userMenuPositionService';
import { buildCheongyeonEngTeams } from '../../utils/cheongyeonTeams';
import {
    appendOfficeAssignmentTeam,
    isOfficeBillingTargetForSelectedTeam,
    officeAssignmentReferencesMatch
} from '../../utils/supportAssignmentTargets';
import { uniqueAccessRoles } from '../../utils/accessRoles';
import { buildMenuAccessRoles, canAccessMenuRoute } from '../../utils/menuAccess';
import { SupportCancellationHistory } from '../../components/support/SupportCancellationHistory';
import { SupportCancellationModal, type SupportCancellationFormValue } from '../../components/support/SupportCancellationModal';
import { supportCancellationLogService } from '../../services/supportCancellationLogService';
import { getContrastingTextColor } from '../../utils/color';
import type { SiteDataType } from '../../types/menu';

interface AccommodationManagerProps {
    embedded?: boolean;
    initialTab?: AccommodationTabId;
    onTabChange?: (tab: AccommodationTabId) => void;
}

type AccommodationTabId = 'status' | 'ledger' | 'history';
type AccommodationStatusFilter = 'todo' | 'all' | 'active' | 'inactive';

const accommodationTabs: SupportSegmentedTabOption<AccommodationTabId>[] = [
    { id: 'status', label: '배정·경비현황', icon: faChartPie },
    { id: 'ledger', label: '통합관리대장', icon: faFileInvoiceDollar },
    { id: 'history', label: '처리내역', icon: faHistory }
];

const DAY_MS = 1000 * 60 * 60 * 24;
const RENT_DUE_SOON_DAYS = 5;
const RENT_DUE_ALERT_COLLAPSED_LIMIT = 6;
const EXPIRATION_ALERT_ACK_STORAGE_KEY = 'cy.accommodation.expirationAlertAcknowledgements';
const ACCOMMODATION_MANAGER_ROUTE = '/support/accommodation';

const getInitialSupportViewMode = (): 'list' | 'card' => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) {
        return 'card';
    }
    return 'list';
};

const getContractEndDateInfo = (rawDate?: string) => {
    if (!rawDate) return null;
    const endDate = new Date(rawDate);
    if (Number.isNaN(endDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / DAY_MS);
    return {
        daysLeft,
        isExpired: daysLeft < 0,
        label: daysLeft < 0 ? '만료됨' : daysLeft === 0 ? '오늘 만료' : `${daysLeft}일 남음`
    };
};

const normalizeSortKey = (value: unknown): string => String(value ?? '').trim();

const compareTeamThenAccommodation = (leftTeam: string, rightTeam: string, leftName: string, rightName: string): number => {
    const normalizedLeftTeam = normalizeSortKey(leftTeam);
    const normalizedRightTeam = normalizeSortKey(rightTeam);
    if (normalizedLeftTeam && !normalizedRightTeam) return -1;
    if (!normalizedLeftTeam && normalizedRightTeam) return 1;
    const teamCompare = normalizedLeftTeam.localeCompare(normalizedRightTeam, 'ko-KR');
    if (teamCompare !== 0) return teamCompare;
    return normalizeSortKey(leftName).localeCompare(normalizeSortKey(rightName), 'ko-KR');
};

const AccommodationManager: React.FC<AccommodationManagerProps> = ({
    embedded = false,
    initialTab = 'status',
    onTabChange,
}) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [canUseAccommodationManager, setCanUseAccommodationManager] = useState<boolean | null>(null);
    const [activeTab, setActiveTab] = useState<AccommodationTabId>(initialTab);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const handleTabChange = (tab: AccommodationTabId) => {
        setActiveTab(tab);
        onTabChange?.(tab);
    };
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [assignments, setAssignments] = useState<AccommodationAssignment[]>([]);
    const [billingTargets, setBillingTargets] = useState<AccommodationBillingTarget[]>([]);
    const [currentMonthLedgerRecords, setCurrentMonthLedgerRecords] = useState<UtilityRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<Accommodation | undefined>(undefined);
    const [quickAssignItem, setQuickAssignItem] = useState<Accommodation | null>(null);
    const [cancellationTarget, setCancellationTarget] = useState<Accommodation | null>(null);
    const [savingCancellation, setSavingCancellation] = useState(false);
    const [filterStatus, setFilterStatus] = useState<AccommodationStatusFilter>('active');
    const [viewMode, setViewMode] = useState<'list' | 'card'>(getInitialSupportViewMode);

    // Team Search State
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectableTeams, setSelectableTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Expiration Alert State
    const [confirmedExpirationAlertKeys, setConfirmedExpirationAlertKeys] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = window.localStorage.getItem(EXPIRATION_ALERT_ACK_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
        } catch {
            return [];
        }
    });
    const [selectedExpirationAlertKeys, setSelectedExpirationAlertKeys] = useState<string[]>([]);
    const [isRentDueAlertExpanded, setIsRentDueAlertExpanded] = useState(true);

    useEffect(() => {
        let isCancelled = false;
        let menuConfig: SiteDataType | null = null;
        let userProfile: any = null;
        let additionalMenuPositions: string[] = [];
        let linkedEntityRoles: string[] = [];
        let menuLoaded = false;
        let userProfileLoaded = false;
        let linkedRolesLoaded = false;

        if (!currentUser?.uid) {
            setCanUseAccommodationManager(false);
            return () => {
                isCancelled = true;
            };
        }

        const uid = currentUser.uid;
        additionalMenuPositions = userMenuPositionService.getPositions(uid);
        setCanUseAccommodationManager(null);

        const updateAccess = () => {
            if (isCancelled) return;

            if (!menuLoaded || !userProfileLoaded || !linkedRolesLoaded) {
                setCanUseAccommodationManager(null);
                return;
            }

            const accessRoles = buildMenuAccessRoles(
                linkedEntityRoles.length > 0 ? linkedEntityRoles : userProfile?.position,
                userProfile?.role,
                userProfile?.systemRole,
                userProfile?.accountType,
                userProfile?.additionalPositions,
                additionalMenuPositions
            );

            setCanUseAccommodationManager(
                canAccessMenuRoute(menuConfig, ACCOMMODATION_MANAGER_ROUTE, accessRoles, { siteKey: 'admin' })
            );
        };

        const menuUnsubscribe = menuServiceV11.subscribe((config) => {
            menuConfig = config;
            menuLoaded = true;
            updateAccess();
        });

        const positionUnsubscribe = userMenuPositionService.subscribe((map) => {
            additionalMenuPositions = map[uid] || [];
            updateAccess();
        });

        const userUnsubscribe = onSnapshot(
            doc(db, 'users', uid),
            (docSnap) => {
                userProfile = docSnap.exists() ? { ...(docSnap.data() as any), uid } : null;
                userProfileLoaded = true;
                updateAccess();
            },
            (error) => {
                console.error('[AccommodationManager] Failed to subscribe user profile:', error);
                userProfile = null;
                userProfileLoaded = true;
                updateAccess();
            }
        );

        void (async () => {
            try {
                const [{ manpowerService }, { officeStaffService }] = await Promise.all([
                    import('../../services/manpowerService'),
                    import('../../services/officeStaffService')
                ]);
                const [linkedWorker, linkedOfficeStaff] = await Promise.all([
                    manpowerService.getWorkerByUid(uid).catch(() => null),
                    officeStaffService.getOfficeStaffByUid(uid).catch(() => null)
                ]);

                linkedEntityRoles = uniqueAccessRoles([linkedWorker?.role, linkedOfficeStaff?.role]);
            } catch (error) {
                console.error('[AccommodationManager] Failed to load linked entity roles:', error);
                linkedEntityRoles = [];
            } finally {
                linkedRolesLoaded = true;
                updateAccess();
            }
        })();

        return () => {
            isCancelled = true;
            menuUnsubscribe();
            positionUnsubscribe();
            userUnsubscribe();
        };
    }, [currentUser?.uid]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(
            EXPIRATION_ALERT_ACK_STORAGE_KEY,
            JSON.stringify(confirmedExpirationAlertKeys)
        );
    }, [confirmedExpirationAlertKeys]);

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
                accommodationService.listAllAccommodations(),
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

            const allowedTeams = buildCheongyeonEngTeams(teamList, companies);
            const sortedTeams = teamList
                .slice()
                .sort((a: Team, b: Team) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko-KR'));

            setAccommodations(accommodationList);
            setAssignments(assignmentList);
            setBillingTargets(billingTargetList);
            setCurrentMonthLedgerRecords(ledgerList);
            setTeams(appendOfficeAssignmentTeam(sortedTeams, sortedTeams)); // Full list for state
            setSelectableTeams(appendOfficeAssignmentTeam(allowedTeams, sortedTeams)); // Filtered list for assignment
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

    const getExpirationAlertKey = (accommodation: Accommodation): string => {
        const accommodationKey = normalizeKey(accommodation.id) || normalizeKey(accommodation.name);
        const endDateKey = normalizeKey(accommodation.contract?.endDate);
        return accommodationKey && endDateKey ? `${accommodationKey}:${endDateKey}` : '';
    };

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

    const assignmentsByAccommodationId = useMemo(() => {
        const map = new Map<string, AccommodationAssignment[]>();
        assignments.forEach((assignment) => {
            const accommodationId = resolveCanonicalAccommodationId(assignment);
            if (!accommodationId) return;

            const list = map.get(accommodationId) ?? [];
            list.push(assignment);
            map.set(accommodationId, list);
        });

        return map;
    }, [assignments, accommodationByAnyId, accommodationByName]);

    const getActiveAssignmentsForAccommodation = (accommodation: Accommodation): AccommodationAssignment[] => {
        return activeAssignmentsByAccommodationId.get(normalizeKey(accommodation.id)) ?? [];
    };

    const getAssignmentsForAccommodation = (accommodation: Accommodation): AccommodationAssignment[] => {
        return assignmentsByAccommodationId.get(normalizeKey(accommodation.id)) ?? [];
    };

    const confirmedExpirationAlertKeySet = useMemo(
        () => new Set(confirmedExpirationAlertKeys),
        [confirmedExpirationAlertKeys]
    );

    // Calculate Expirations (Within 1 Month)
    const upcomingExpirations = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const oneMonthLater = new Date();
        oneMonthLater.setMonth(now.getMonth() + 1);

        return accommodations.filter(a => {
            if (a.status !== 'active' || !a.contract.endDate) return false;
            const alertKey = getExpirationAlertKey(a);
            if (alertKey && confirmedExpirationAlertKeySet.has(alertKey)) return false;
            const endDate = new Date(a.contract.endDate);
            if (Number.isNaN(endDate.getTime())) return false;
            endDate.setHours(0, 0, 0, 0);
            return endDate <= oneMonthLater;
        }).sort((a, b) => new Date(a.contract.endDate || '').getTime() - new Date(b.contract.endDate || '').getTime());
    }, [accommodations, confirmedExpirationAlertKeySet]);

    const visibleExpirationAlerts = upcomingExpirations.slice(0, 6);
    const hiddenExpirationAlertCount = Math.max(0, upcomingExpirations.length - visibleExpirationAlerts.length);
    const selectedExpirationAlertKeySet = useMemo(
        () => new Set(selectedExpirationAlertKeys),
        [selectedExpirationAlertKeys]
    );

    useEffect(() => {
        const activeAlertKeys = new Set(upcomingExpirations.map(getExpirationAlertKey).filter(Boolean));
        setSelectedExpirationAlertKeys((current) => current.filter((key) => activeAlertKeys.has(key)));
    }, [upcomingExpirations]);

    const toggleExpirationAlertSelection = (alertKey: string) => {
        if (!alertKey) return;
        setSelectedExpirationAlertKeys((current) => (
            current.includes(alertKey)
                ? current.filter((key) => key !== alertKey)
                : [...current, alertKey]
        ));
    };

    const confirmExpirationAlertKeys = (alertKeys: string[]) => {
        const nextKeys = alertKeys.map(normalizeKey).filter(Boolean);
        if (nextKeys.length === 0) return;
        setConfirmedExpirationAlertKeys((current) => Array.from(new Set([...current, ...nextKeys])));
        setSelectedExpirationAlertKeys((current) => current.filter((key) => !nextKeys.includes(key)));
    };

    const confirmSelectedExpirationAlerts = () => {
        confirmExpirationAlertKeys(selectedExpirationAlertKeys);
    };

    const confirmAllExpirationAlerts = () => {
        confirmExpirationAlertKeys(upcomingExpirations.map(getExpirationAlertKey));
    };

    const matchesSelectedTeam = (teamId?: unknown, teamName?: unknown): boolean => {
        if (!selectedTeamId) return true;

        if (officeAssignmentReferencesMatch(
            selectedTeamCanonicalId,
            selectedTeamCanonicalName,
            teamId,
            teamName
        )) return true;

        const rawTeamId = normalizeKey(teamId);
        const rawTeamName = normalizeKey(teamName);
        const matchedById = rawTeamId ? teamByAnyId.get(rawTeamId) : undefined;
        const matchedByName = rawTeamName ? teamByName.get(rawTeamName) : undefined;
        const canonicalTeamId = normalizeKey(matchedById?.id ?? matchedByName?.id ?? rawTeamId);
        const canonicalTeamName = normalizeKey(matchedById?.name ?? matchedByName?.name ?? rawTeamName);

        return Boolean(
            (selectedTeamCanonicalId && canonicalTeamId && canonicalTeamId === selectedTeamCanonicalId) ||
            (selectedTeamCanonicalName && canonicalTeamName && canonicalTeamName === selectedTeamCanonicalName)
        );
    };

    const assignmentMatchesSelectedTeam = (assignment: AccommodationAssignment): boolean => {
        const resolvedTeam = resolveCanonicalTeam(assignment);
        return matchesSelectedTeam(resolvedTeam.teamId || assignment.teamId, resolvedTeam.teamName || assignment.teamName);
    };

    const getBillingTargetsForAccommodation = (accommodation: Accommodation): AccommodationBillingTarget[] => {
        const accommodationId = normalizeKey(accommodation.id);
        const accommodationName = normalizeKey(accommodation.name);

        return billingTargets.filter((target) => {
            const rawTargetAccommodationId = normalizeKey(target.accommodationId);
            const matchedById = rawTargetAccommodationId ? accommodationByAnyId.get(rawTargetAccommodationId) : undefined;
            const canonicalTargetAccommodationId = normalizeKey(matchedById?.id ?? rawTargetAccommodationId);
            const targetAccommodationName = normalizeKey(target.accommodationName);

            return Boolean(
                (accommodationId && canonicalTargetAccommodationId === accommodationId) ||
                (accommodationName && targetAccommodationName === accommodationName)
            );
        }).sort((a, b) => {
            const startDiff = normalizeKey(a.startDate).localeCompare(normalizeKey(b.startDate));
            if (startDiff !== 0) return startDiff;
            return normalizeKey(a.id).localeCompare(normalizeKey(b.id));
        });
    };

    const billingTargetMatchesSelectedTeam = (target: AccommodationBillingTarget): boolean => {
        if (isOfficeBillingTargetForSelectedTeam(
            selectedTeamCanonicalId,
            selectedTeamCanonicalName,
            target.targetType
        )) return true;
        if (target.targetType !== 'team') return false;
        return matchesSelectedTeam(target.teamId, target.teamName);
    };

    const selectedTeamScopedAccommodations = useMemo(() => {
        if (!selectedTeamId) return accommodations;

        return accommodations.filter((accommodation) => {
            const activeAssignments = getActiveAssignmentsForAccommodation(accommodation);
            if (activeAssignments.some(assignmentMatchesSelectedTeam)) return true;

            const allAssignments = getAssignmentsForAccommodation(accommodation);
            if (allAssignments.some(assignmentMatchesSelectedTeam)) return true;

            return getBillingTargetsForAccommodation(accommodation).some(billingTargetMatchesSelectedTeam);
        });
    }, [
        accommodations,
        selectedTeamId,
        selectedTeamCanonicalId,
        selectedTeamCanonicalName,
        activeAssignmentsByAccommodationId,
        assignmentsByAccommodationId,
        billingTargets,
        accommodationByAnyId,
        teamByAnyId,
        teamByName
    ]);

    // Unified Filtered Data
    const filteredAccommodations = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return selectedTeamScopedAccommodations.filter(acc => {
            const activeList = getActiveAssignmentsForAccommodation(acc);

            if (filterStatus === 'todo') {
                if (acc.status !== 'active') return false;
                if (activeList.length > 0) return false;
            } else if (filterStatus !== 'all' && acc.status !== filterStatus) {
                return false;
            }

            if (!query) return true;

            const matchedBillingTargets = getBillingTargetsForAccommodation(acc);

            const assignmentSearchValues = activeList.flatMap((assignment) => {
                const resolvedTeam = resolveCanonicalTeam(assignment);
                return [
                    assignment.workerName,
                    assignment.workerId,
                    assignment.teamName,
                    assignment.teamId,
                    assignment.memo,
                    resolvedTeam.teamName,
                    resolvedTeam.teamId
                ];
            });

            const billingTargetSearchValues = matchedBillingTargets.flatMap((target) => [
                target.workerName,
                target.workerId,
                target.teamName,
                target.teamId,
                target.targetType,
                target.memo
            ]);

            return [
                acc.name,
                acc.address,
                acc.type,
                acc.status,
                acc.ownership,
                acc.currentOccupantName,
                acc.currentOccupantPhone,
                acc.memo,
                acc.contract?.landlordName,
                acc.contract?.landlordContact,
                acc.contract?.bankName,
                acc.contract?.accountHolder,
                acc.contract?.accountNumber,
                acc.contract?.startDate,
                acc.contract?.endDate,
                ...assignmentSearchValues,
                ...billingTargetSearchValues
            ].some(value => String(value ?? '').toLowerCase().includes(query));
        });
    }, [selectedTeamScopedAccommodations, filterStatus, activeAssignmentsByAccommodationId, searchTerm, billingTargets, accommodationByAnyId]);

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
        return getBillingTargetsForAccommodation(accommodation).at(-1);
    };

    const getBillingModeBadge = (
        accommodation: Accommodation,
        separatedTarget: AccommodationBillingTarget | undefined,
        hasAssignment: boolean
    ) => {
        const targetRows = getBillingTargetsForAccommodation(accommodation);
        const isSplit = targetRows.length > 1 || targetRows.some((target) => Boolean(normalizeKey(target.endDate)));
        if (isSplit) {
            return { label: '분할', className: 'bg-amber-50 text-amber-700 border-amber-100' };
        }

        if (separatedTarget) {
            return { label: '별도', className: 'bg-blue-50 text-blue-700 border-blue-100' };
        }

        if (hasAssignment) {
            return { label: '동일', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
        }

        return { label: '미지정', className: 'bg-slate-50 text-slate-400 border-slate-100' };
    };

    const buildBillingTargetLabel = (accommodation: Accommodation, items: AccommodationAssignment[]): string => {
        const separatedTarget = getBillingTargetForAccommodation(accommodation);
        if (separatedTarget) {
            if (separatedTarget.targetType === 'worker') return '개인';
            if (separatedTarget.targetType === 'office') return '사무실';
            if (separatedTarget.targetType === 'office_staff') return '사무실직원';
            return '팀';
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
        if (separatedTarget?.targetType === 'office_staff') {
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

    function getRentDuePaymentBreakdown(accommodation: Accommodation): { rent: number; maintenance: number; total: number } {
        const ledgerRecord = getCurrentMonthLedgerRecord(accommodation);
        const ledgerCosts = (ledgerRecord as any)?.costs ?? {};
        const hasLedgerRent = Object.prototype.hasOwnProperty.call(ledgerCosts, 'rent');
        const hasLedgerMaintenance = Object.prototype.hasOwnProperty.call(ledgerCosts, 'maintenance');
        const rent = hasLedgerRent
            ? toSafeNumber(ledgerCosts.rent)
            : getAccommodationRent(accommodation);

        let maintenance = hasLedgerMaintenance
            ? toSafeNumber(ledgerCosts.maintenance)
            : 0;

        if (!hasLedgerMaintenance) {
            const costProfile = (accommodation as any)?.costProfile;
            if (costProfile?.maintenance === 'fixed') {
                maintenance = toSafeNumber(costProfile.fixedMaintenance);
            }
        }

        return {
            rent,
            maintenance,
            total: rent + maintenance
        };
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

    const getAssignedTeamNameForAccommodation = (accommodation: Accommodation): string => {
        const activeList = getActiveAssignmentsForAccommodation(accommodation);
        const primaryTeamAssign = activeList.find((assignment) => (
            Boolean(normalizeKey(assignment.teamId)) || Boolean(normalizeKey(assignment.teamName))
        ));
        if (!primaryTeamAssign) return '';
        const resolvedTeam = resolveCanonicalTeam(primaryTeamAssign);
        return normalizeKey(resolvedTeam.teamName || primaryTeamAssign.teamName);
    };

    const getBillingTeamNameForAccommodation = (accommodation: Accommodation): string => {
        const separatedTarget = getBillingTargetForAccommodation(accommodation);
        if (!separatedTarget) return getAssignedTeamNameForAccommodation(accommodation);

        if (separatedTarget.targetType === 'team') {
            const teamId = normalizeKey(separatedTarget.teamId);
            const teamName = normalizeKey(separatedTarget.teamName);
            const team = teamId ? teamByAnyId.get(teamId) : (teamName ? teamByName.get(teamName) : undefined);
            return normalizeKey(team?.name || teamName);
        }

        if (separatedTarget.targetType === 'office' || separatedTarget.targetType === 'office_staff') {
            return '사무실';
        }

        const targetWorkerId = normalizeKey(separatedTarget.workerId);
        const targetWorkerName = normalizeKey(separatedTarget.workerName);
        const activeList = getActiveAssignmentsForAccommodation(accommodation);
        const matchedAssignment = activeList.find((assignment) => (
            Boolean(targetWorkerId && normalizeKey(assignment.workerId) === targetWorkerId) ||
            Boolean(targetWorkerName && normalizeKey(assignment.workerName) === targetWorkerName)
        ));
        if (!matchedAssignment) return getAssignedTeamNameForAccommodation(accommodation);

        const resolvedTeam = resolveCanonicalTeam(matchedAssignment);
        return normalizeKey(resolvedTeam.teamName || matchedAssignment.teamName);
    };

    const sortedFilteredAccommodations = useMemo(() => (
        [...filteredAccommodations].sort((left, right) => {
            const teamCompare = compareTeamThenAccommodation(
                getBillingTeamNameForAccommodation(left),
                getBillingTeamNameForAccommodation(right),
                normalizeKey(left.name) || normalizeKey(left.address),
                normalizeKey(right.name) || normalizeKey(right.address)
            );
            if (teamCompare !== 0) return teamCompare;
            return normalizeKey(left.address).localeCompare(normalizeKey(right.address), 'ko-KR');
        })
    ), [
        filteredAccommodations,
        activeAssignmentsByAccommodationId,
        billingTargetByAccommodationId,
        billingTargetByAccommodationName,
        teamByAnyId,
        teamByName
    ]);

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

    const handleCancellationClick = (e: React.MouseEvent, item: Accommodation) => {
        e.stopPropagation();
        setCancellationTarget(item);
    };

    const handleCancellationSubmit = async (form: SupportCancellationFormValue) => {
        if (!cancellationTarget) return;
        const accommodation = cancellationTarget;
        setSavingCancellation(true);

        try {
            const activeList = getActiveAssignmentsForAccommodation(accommodation);
            const activeIds = activeList
                .map((assignment) => normalizeKey(assignment.id))
                .filter((id): id is string => Boolean(id));
            if (activeIds.length > 0) {
                await accommodationAssignmentService.endAssignmentsBatch(activeIds, form.processedDate);
            }

            const targetRows = (await accommodationBillingTargetService.listTargetsByAccommodationId(accommodation.id))
                .filter((target) => !normalizeKey(target.endDate));
            if (targetRows.length > 0) {
                await accommodationBillingTargetService.applyTargetChanges({
                    accommodationId: accommodation.id,
                    closeRecords: targetRows.map((target) => ({ id: target.id, endDate: form.processedDate }))
                });
            }

            await accommodationService.updateAccommodation(accommodation.id, {
                status: 'inactive',
                currentOccupantName: '',
                currentOccupantPhone: ''
            });

            await supportCancellationLogService.createLog({
                resourceType: 'accommodation',
                resourceId: accommodation.id,
                resourceLabel: accommodation.name || accommodation.address || '숙소',
                reason: form.reason,
                reasonLabel: form.reasonLabel,
                processedDate: form.processedDate,
                statusBefore: accommodation.status,
                statusAfter: 'inactive',
                assigneeName: activeList.map((assignment) => normalizeKey(assignment.workerName)).filter(Boolean).join(', ') || accommodation.currentOccupantName,
                teamName: activeList.map((assignment) => normalizeKey(assignment.teamName)).filter(Boolean).join(', '),
                billingTargetName: buildBillingTargetLabel(accommodation, activeList),
                settlementAmount: form.settlementAmount,
                note: form.note,
                snapshot: {
                    name: accommodation.name,
                    address: accommodation.address,
                    type: accommodation.type,
                    ownership: accommodation.ownership,
                    status: accommodation.status,
                    contractStartDate: accommodation.contract?.startDate,
                    contractEndDate: accommodation.contract?.endDate,
                    deposit: getAccommodationDeposit(accommodation),
                    monthlyRent: getAccommodationRent(accommodation),
                    currentOccupantName: accommodation.currentOccupantName,
                    billingTarget: buildBillingTargetLabel(accommodation, activeList)
                }
            });

            setCancellationTarget(null);
            handleTabChange('history');
            loadData();
        } catch (error) {
            console.error("Failed to process accommodation cancellation", error);
            alert("숙소 사용취소 처리 중 오류가 발생했습니다.");
        } finally {
            setSavingCancellation(false);
        }
    };

    const handleRestoreClick = async (e: React.MouseEvent, item: Accommodation) => {
        e.stopPropagation();
        if (item.status !== 'inactive') return;

        const result = await Swal.fire({
            title: '처리취소',
            text: `${item.name || item.address || '숙소'} 사용취소/만료 처리를 취소하고 다시 계약중으로 변경할까요?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '처리취소',
            cancelButtonText: '닫기',
            confirmButtonColor: '#059669'
        });
        if (!result.isConfirmed) return;

        try {
            await accommodationService.updateAccommodation(item.id, { status: 'active' });
            await supportCancellationLogService.createLog({
                resourceType: 'accommodation',
                resourceId: item.id,
                resourceLabel: item.name || item.address || '숙소',
                reason: 'OTHER',
                reasonLabel: '처리취소',
                processedDate: new Date().toISOString().slice(0, 10),
                statusBefore: item.status,
                statusAfter: 'active',
                assigneeName: item.currentOccupantName,
                note: '사용취소/만료 처리 번복',
                snapshot: {
                    name: item.name,
                    address: item.address,
                    status: item.status,
                    contractEndDate: item.contract?.endDate,
                    currentOccupantName: item.currentOccupantName
                }
            });
            loadData();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: '처리취소되었습니다.',
                showConfirmButton: false,
                timer: 1800,
                timerProgressBar: true
            });
        } catch (error) {
            console.error('Failed to restore accommodation status', error);
            Swal.fire('오류', '숙소 처리취소 중 오류가 발생했습니다.', 'error');
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
                    <p className="text-slate-500">관리자 또는 권한 관리에서 숙소 관리 메뉴 권한이 부여된 계정만 사용할 수 있습니다.</p>
                </div>
            </div>
        );
    }

    // Stats Logic
    const totalCount = selectedTeamScopedAccommodations.length;
    const currentWorkCount = selectedTeamScopedAccommodations.filter((accommodation) => (
        accommodation.status === 'active' && getActiveAssignmentsForAccommodation(accommodation).length === 0
    )).length;
    const occupiedCount = selectedTeamScopedAccommodations.filter(a => a.status === 'active').reduce((acc, _) => acc + 1, 0); // safe count
    const vacantCount = selectedTeamScopedAccommodations.filter(a => a.status === 'inactive').reduce((acc, _) => acc + 1, 0);
    const totalRent = selectedTeamScopedAccommodations
        .filter(a => a.status === 'active')
        .reduce((sum, a: any) => sum + getAccommodationRent(a), 0);
    const totalDeposit = selectedTeamScopedAccommodations
        .filter(a => a.status === 'active')
        .reduce((sum, a: any) => sum + getAccommodationDeposit(a), 0);

    // Calculate Alerts (Rent Due Soon)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isAutoTransferEnabled = (value: unknown): boolean => {
        if (value === true) return true;
        if (typeof value === 'string') {
            return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
        }
        return false;
    };

    const getRentPaymentDay = (accommodation: Accommodation): number | null => {
        const rawDay = accommodation.contract?.rentPayDate ?? accommodation.contract?.paymentDay;
        const day = Math.floor(toSafeNumber(rawDay));
        if (!Number.isFinite(day) || day <= 0) return null;
        return Math.max(1, Math.min(31, day));
    };

    const buildRentDueDate = (baseDate: Date, payDay: number, monthOffset: number): Date => {
        const monthIndex = baseDate.getMonth() + monthOffset;
        const lastDayOfMonth = new Date(baseDate.getFullYear(), monthIndex + 1, 0).getDate();
        const dueDate = new Date(baseDate.getFullYear(), monthIndex, Math.min(payDay, lastDayOfMonth));
        dueDate.setHours(0, 0, 0, 0);
        return dueDate;
    };

    const getRentDueInfo = (accommodation: Accommodation): { payDay: number; daysLeft: number; dueDate: Date } | null => {
        const payDay = getRentPaymentDay(accommodation);
        if (!payDay) return null;

        let dueDate = buildRentDueDate(today, payDay, 0);
        if (dueDate.getTime() < today.getTime()) {
            dueDate = buildRentDueDate(today, payDay, 1);
        }

        return {
            payDay,
            daysLeft: Math.ceil((dueDate.getTime() - today.getTime()) / DAY_MS),
            dueDate
        };
    };

    const isManualRentDueSoon = (accommodation: Accommodation): boolean => {
        if (accommodation.status !== 'active') return false;
        if (isAutoTransferEnabled(accommodation.contract?.isAutoTransfer)) return false;
        const dueInfo = getRentDueInfo(accommodation);
        return Boolean(dueInfo && dueInfo.daysLeft >= 0 && dueInfo.daysLeft <= RENT_DUE_SOON_DAYS);
    };

    const upcomingRentAccommodations = selectedTeamScopedAccommodations
        .filter(isManualRentDueSoon)
        .sort((a, b) => {
            const leftInfo = getRentDueInfo(a);
            const rightInfo = getRentDueInfo(b);
            const dayDiff = (leftInfo?.daysLeft ?? 999) - (rightInfo?.daysLeft ?? 999);
            if (dayDiff !== 0) return dayDiff;
            return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko-KR');
        });

    const displayedUpcomingRentAccommodations = isRentDueAlertExpanded
        ? upcomingRentAccommodations
        : upcomingRentAccommodations.slice(0, RENT_DUE_ALERT_COLLAPSED_LIMIT);
    const hiddenUpcomingRentCount = Math.max(0, upcomingRentAccommodations.length - displayedUpcomingRentAccommodations.length);
    const canToggleUpcomingRentList = upcomingRentAccommodations.length > RENT_DUE_ALERT_COLLAPSED_LIMIT;
    const upcomingRentTotal = upcomingRentAccommodations.reduce(
        (sum, accommodation) => sum + getRentDuePaymentBreakdown(accommodation).total,
        0
    );



    // Calculate Occupancy Rate
    const occupancyRate = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;

    return (
        <div className={embedded ? 'space-y-3 bg-transparent min-h-full w-full min-w-0 max-w-full overflow-x-hidden' : 'p-3 sm:p-6 space-y-5 sm:space-y-6 bg-slate-50 min-h-full w-full max-w-[calc(100vw-30px)] sm:max-w-full min-w-0 overflow-x-hidden'}>
            <div className={embedded ? 'space-y-3 w-full min-w-0' : 'space-y-5 sm:space-y-6 w-full min-w-0'}>

                <SupportPageHeader
                    icon={faBuilding}
                    title="숙소 통합관리"
                    description="숙소 배정 현황 및 공과금/청구 내역을 관리합니다."
                    tone="emerald"
                    compact={embedded}
                    actions={(
                        <>
                        <button
                            type="button"
                            onClick={() => navigate('/support/accommodation/logs')}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:flex-none"
                        >
                            <FontAwesomeIcon icon={faHistory} />
                            <span>청구 로그</span>
                        </button>
                        <button
                            type="button"
                            onClick={loadData}
                            className="rounded-lg border border-transparent p-2.5 text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                            aria-label="새로고침"
                            title="새로고침"
                        >
                            <FontAwesomeIcon icon={faRotateRight} className={loading ? 'spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={handleAddClick}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-95 sm:flex-none"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            신규 숙소 등록
                        </button>
                        </>
                    )}
                />

                {/* 필터 및 탭 섹션 */}
                <div className="flex max-w-full flex-col gap-2 overflow-hidden bg-white p-2 rounded-2xl border border-slate-200 shadow-sm xl:flex-row xl:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center">
                        <SupportSegmentedTabs
                            options={accommodationTabs}
                            activeId={activeTab}
                            onChange={handleTabChange}
                            ariaLabel="숙소 관리 보기"
                        />

                        <SupportTeamFilterTabs
                            teams={selectableTeams}
                            selectedTeamId={selectedTeamId}
                            onChange={setSelectedTeamId}
              disabled={activeTab !== 'status' && activeTab !== 'ledger'}
                            className="flex-1"
                        />
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end xl:w-auto">
                        {activeTab === 'status' && (
                            <span className="whitespace-nowrap px-1 text-xs font-bold text-slate-400">
                                조회 {filteredAccommodations.length} / {selectedTeamScopedAccommodations.length}
                            </span>
                        )}

                        <label className="relative block w-full sm:min-w-[240px] xl:w-72">
                            <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                aria-label="숙소 검색"
                                disabled={activeTab === 'history'}
                                placeholder="숙소명, 주소, 배정자 검색"
                                className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-indigo-500 disabled:text-slate-300"
                            />
                        </label>
                    </div>
                </div>

                {/* Content Area */}
                <div className="animate-fade-in-up">
                    {activeTab === 'status' ? (
                        <div className="space-y-6">
                            {/* Alerts Section */}
                            <div className="space-y-4">
                                {/* Expiration Alert (Priority) */}
                                {upcomingExpirations.length > 0 && (
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm animate-fade-in-down sm:flex-row sm:items-start">
                                        <div className="w-fit bg-red-100 p-2 rounded-full text-red-600">
                                            <FontAwesomeIcon icon={faExclamationTriangle} className="animate-pulse" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <h3 className="font-bold text-red-800 text-sm">계약 만료 확인 필요 ({upcomingExpirations.length}건)</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={confirmSelectedExpirationAlerts}
                                                        disabled={selectedExpirationAlertKeys.length === 0}
                                                        className="w-fit rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        선택 완료
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={confirmAllExpirationAlerts}
                                                        className="w-fit rounded-lg bg-red-600 px-2.5 py-1 text-xs font-black text-white hover:bg-red-700"
                                                    >
                                                        전체 확인
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {visibleExpirationAlerts.map(acc => {
                                                    const endDateInfo = getContractEndDateInfo(acc.contract.endDate);
                                                    const alertKey = getExpirationAlertKey(acc);
                                                    const checked = selectedExpirationAlertKeySet.has(alertKey);
                                                    return (
                                                        <label key={alertKey || acc.id} className={`inline-flex cursor-pointer items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold shadow-sm transition-colors ${checked ? 'bg-red-600 border-red-600 text-white' : endDateInfo?.isExpired ? 'bg-red-100 border-red-300 text-red-800' : 'bg-white border-red-200 text-red-700'}`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleExpirationAlertSelection(alertKey)}
                                                                className="h-3.5 w-3.5 rounded border-red-300 text-red-600 focus:ring-red-500"
                                                            />
                                                            <FontAwesomeIcon icon={faBuilding} className="text-red-400" />
                                                            {acc.name} ({acc.contract.endDate} / {endDateInfo?.label ?? '날짜 확인 필요'})
                                                        </label>
                                                    );
                                                })}
                                                {hiddenExpirationAlertCount > 0 && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-red-100 text-xs font-bold text-red-700">
                                                        외 {hiddenExpirationAlertCount}건
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Rent Due Alert */}
                                {upcomingRentAccommodations.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm animate-fade-in-down sm:flex-row sm:items-start">
                                        <div className="w-fit bg-amber-100 p-2 rounded-full text-amber-600">
                                            <FontAwesomeIcon icon={faBell} className="animate-swing" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <h3 className="font-bold text-amber-800 text-sm">월세 납부일 임박 ({upcomingRentAccommodations.length}건)</h3>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="w-fit rounded-lg bg-white px-2.5 py-1 text-xs font-black text-amber-800 border border-amber-200">
                                                        총 {upcomingRentTotal.toLocaleString()}원
                                                    </span>
                                                    {canToggleUpcomingRentList && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsRentDueAlertExpanded((current) => !current)}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-black text-amber-700 hover:bg-amber-100"
                                                            aria-expanded={isRentDueAlertExpanded}
                                                        >
                                                            <FontAwesomeIcon icon={isRentDueAlertExpanded ? faChevronUp : faChevronDown} className="text-[10px]" />
                                                            {isRentDueAlertExpanded ? '접기' : `전체 ${upcomingRentAccommodations.length}건 펼치기`}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={isRentDueAlertExpanded ? 'grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3' : 'flex flex-wrap gap-2'}>
                                                {displayedUpcomingRentAccommodations.map(acc => {
                                                    const dueInfo = getRentDueInfo(acc);
                                                    const dayLabel = dueInfo?.daysLeft === 0 ? 'D-day' : `D-${dueInfo?.daysLeft ?? '-'}`;
                                                    const paymentBreakdown = getRentDuePaymentBreakdown(acc);
                                                    return (
                                                        <span
                                                            key={acc.id}
                                                            className={`${isRentDueAlertExpanded ? 'flex w-full items-center justify-between gap-2' : 'inline-flex items-center gap-1.5'} rounded-lg bg-white border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-700 shadow-sm`}
                                                            title={`월세 ${paymentBreakdown.rent.toLocaleString()}원 + 관리비 ${paymentBreakdown.maintenance.toLocaleString()}원`}
                                                        >
                                                            <span className="inline-flex min-w-0 items-center gap-1.5">
                                                                <FontAwesomeIcon icon={faBuilding} className="shrink-0 text-amber-400" />
                                                                <span className="truncate">{acc.name} (매월 {dueInfo?.payDay ?? getRentPaymentDay(acc)}일 · {dayLabel})</span>
                                                            </span>
                                                            <span className="shrink-0 text-amber-900">
                                                                입금 {paymentBreakdown.total.toLocaleString()}원
                                                            </span>
                                                        </span>
                                                    );
                                                })}
                                                {!isRentDueAlertExpanded && hiddenUpcomingRentCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsRentDueAlertExpanded(true)}
                                                        className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-200"
                                                    >
                                                        <FontAwesomeIcon icon={faChevronDown} className="text-[10px]" />
                                                        전체 {upcomingRentAccommodations.length}건 보기
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                    {([
                                        ['active', `운영 중 ${occupiedCount}호`],
                                        ['inactive', `보관/종료 ${vacantCount}호`],
                                        ['all', `전체 ${totalCount}호`]
                                    ] as Array<[AccommodationStatusFilter, string]>).map(([status, label]) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setFilterStatus(status)}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all
                                                ${filterStatus === status ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}
                                            `}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                    {currentWorkCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setFilterStatus('todo')}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all
                                                ${filterStatus === 'todo' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-50'}
                                            `}
                                        >
                                            확인 필요 {currentWorkCount}호
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* View Mode Toggle */}
                                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                                        <button
                                            type="button"
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
                                            type="button"
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
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                                {currentWorkCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilterStatus('todo')}
                                    aria-pressed={filterStatus === 'todo'}
                                    className={`w-full text-left bg-white p-6 rounded-2xl border border-amber-100 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.12)] hover:shadow-lg transition-shadow relative overflow-hidden group ${filterStatus === 'todo' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                >
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-amber-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-amber-600/80 uppercase tracking-wider mb-2">현재 업무</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-3xl font-extrabold text-slate-800">{currentWorkCount}</h3>
                                            <span className="text-sm font-bold text-slate-400">호</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 w-fit px-2 py-1 rounded-lg">
                                            <FontAwesomeIcon icon={faExclamationTriangle} /> 입실/배정 필요
                                        </div>
                                    </div>
                                </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setFilterStatus('active')}
                                    aria-pressed={filterStatus === 'active'}
                                    className={`w-full text-left bg-white p-6 rounded-2xl border border-emerald-100 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group ${filterStatus === 'active' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                >
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
                                </button>

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

                                <button
                                    type="button"
                                    onClick={() => setFilterStatus('inactive')}
                                    aria-pressed={filterStatus === 'inactive'}
                                    className={`w-full text-left bg-white p-6 rounded-2xl border border-orange-100 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group ${filterStatus === 'inactive' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                >
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
                                </button>
                            </div>

                            {/* Accommodation List/Cards */}
                            {loading ? (
                                <div className="h-64 flex items-center justify-center text-slate-400">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : accommodations.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-20 text-center">
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
                            ) : sortedFilteredAccommodations.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                        <FontAwesomeIcon icon={faChartPie} />
                                    </div>
                                    <h3 className="text-base font-black text-slate-800">
                                        {filterStatus === 'active'
                                            ? '운영 중인 숙소가 없습니다'
                                            : filterStatus === 'inactive'
                                                ? '보관/종료된 숙소가 없습니다'
                                                : filterStatus === 'todo'
                                                    ? '확인할 숙소 배정/청구 업무가 없습니다'
                                                    : '조건에 맞는 숙소가 없습니다'}
                                    </h3>
                                    <p className="mt-1 text-sm font-medium text-slate-500">다른 보기를 선택하면 운영 중이거나 종료된 숙소까지 함께 확인할 수 있습니다.</p>
                                    <button
                                        type="button"
                                        onClick={() => setFilterStatus(filterStatus === 'active' ? 'all' : 'active')}
                                        className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                                    >
                                        {filterStatus === 'active' ? '전체 보기' : '운영 중 보기'}
                                    </button>
                                </div>
                            ) : viewMode === 'list' ? (
                                /* ── 목록형 (Table) ── */
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="support-compact-table support-compact-status w-full table-fixed text-xs">
                                            <colgroup>
                                                <col style={{ width: '3%' }} />
                                                <col style={{ width: '10%' }} />
                                                <col style={{ width: '14%' }} />
                                                <col style={{ width: '9%' }} />
                                                <col style={{ width: '7%' }} />
                                                <col style={{ width: '7%' }} />
                                                <col style={{ width: '7%' }} />
                                                <col style={{ width: '6%' }} />
                                                <col style={{ width: '10%' }} />
                                                <col style={{ width: '7%' }} />
                                                <col style={{ width: '7%' }} />
                                                <col style={{ width: '7%' }} />
                                                <col style={{ width: '6%' }} />
                                            </colgroup>
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
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">청구방식</th>
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">이체/월세일</th>
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">계약만료</th>
                                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider w-20"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {sortedFilteredAccommodations
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
                                                        const assignedTargetDisplayNames = assignedWorkerDisplayNames.length > 0
                                                            ? assignedWorkerDisplayNames
                                                            : Array.from(
                                                                new Set(
                                                                    activeList
                                                                        .map((assignment) => normalizeKey(assignment.teamName))
                                                                        .filter((teamName) => teamName.length > 0)
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
                                                        const billingTargetOfficeName = separatedBillingTarget?.targetType === 'office'
                                                            ? String(separatedBillingTarget.teamName || '사무실').trim()
                                                            : '';
                                                        const billingTargetOfficeStaffName = separatedBillingTarget?.targetType === 'office_staff'
                                                            ? String(separatedBillingTarget.workerName || '사무실직원').trim()
                                                            : '';
                                                        const billingTargetType = separatedBillingTarget?.targetType
                                                            ?? (billingTargetWorkerName ? 'worker' : billingTargetTeamName ? 'team' : undefined);
                                                        const billingTargetName = billingTargetType === 'worker'
                                                            ? billingTargetWorkerName
                                                            : billingTargetType === 'team'
                                                                ? billingTargetTeamName
                                                                : billingTargetType === 'office'
                                                                    ? billingTargetOfficeName
                                                                    : billingTargetType === 'office_staff'
                                                                        ? billingTargetOfficeStaffName
                                                                        : '';
                                                        const billingTargetTeamInfo = billingTargetType === 'team'
                                                            ? getTeamInfo(separatedTeam?.id ?? primaryTeamAssign?.teamId, billingTargetName)
                                                            : undefined;
                                                        const billingModeBadge = getBillingModeBadge(acc, separatedBillingTarget, activeList.length > 0);
                                                        const tc = primaryTeamInfo?.color;
                                                        const tcText = tc ? getContrastingTextColor(tc) : undefined;
                                                        const paymentDay = acc.contract.paymentDay || acc.contract.rentPayDate;
                                                        const isContractExpired = acc.contract.endDate && new Date(acc.contract.endDate) < new Date();

                                                        const needsWork = acc.status === 'active' && activeList.length === 0;

                                                        return (
                                                            <tr
                                                                key={acc.id}
                                                                onClick={() => handleOpenAssignmentCenter(acc)}
                                                                className={`hover:bg-indigo-50/40 cursor-pointer transition-colors group ${needsWork ? 'bg-amber-50/35' : ''}`}
                                                                style={tc ? { borderLeft: `3px solid ${tc}` } : needsWork ? { borderLeft: '3px solid #f59e0b' } : undefined}
                                                            >
                                                                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{rowIdx + 1}</td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-2 group/name">
                                                                        <span
                                                                             className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-xs text-slate-400"
                                                                             style={tc ? {
                                                                                 backgroundColor: tc,
                                                                                 color: tcText,
                                                                                 borderColor: tc,
                                                                             } : undefined}
                                                                         >
                                                                            <FontAwesomeIcon icon={faBuilding} />
                                                                        </span>
                                                                         <span
                                                                              className="truncate font-bold text-slate-800 transition-colors group-hover:text-indigo-600"
                                                                          >
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
                                                                                 backgroundColor: tc,
                                                                                 color: tcText,
                                                                                 border: `1px solid ${tc}`,
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
                                                                    {assignedTargetDisplayNames.length > 0 ? (
                                                                        <div className="flex flex-wrap items-center justify-center gap-1">
                                                                            {assignedTargetDisplayNames.map((workerName) => {
                                                                                const matchingAssignment = activeList.find((assignment) => (
                                                                                    normalizeKey(assignment.workerName) === normalizeKey(workerName) ||
                                                                                    normalizeKey(assignment.teamName) === normalizeKey(workerName)
                                                                                ));
                                                                                const badgeTeamInfo = matchingAssignment
                                                                                    ? getTeamInfo(matchingAssignment.teamId, matchingAssignment.teamName)
                                                                                    : undefined;
                                                                                const badgeColor = badgeTeamInfo?.color;

                                                                                return (
                                                                                    <span
                                                                                        key={workerName}
                                                                                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold"
                                                                                        style={badgeColor ? {
                                                                                            backgroundColor: badgeColor,
                                                                                            borderColor: badgeColor,
                                                                                            color: getContrastingTextColor(badgeColor)
                                                                                        } : {
                                                                                            backgroundColor: '#eef2ff',
                                                                                            borderColor: '#e0e7ff',
                                                                                            color: '#4338ca'
                                                                                        }}
                                                                                    >
                                                                                        <FontAwesomeIcon icon={faUser} className="text-[9px]" />
                                                                                        {workerName}
                                                                                    </span>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-300">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-xs text-slate-600">
                                                                    {billingTargetType && billingTargetName ? (
                                                                        <span
                                                                            className={`inline-flex max-w-[190px] items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold ${billingTargetType === 'team'
                                                                                ? ''
                                                                                : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                                                }`}
                                                                             style={billingTargetType === 'team'
                                                                                 ? (billingTargetTeamInfo?.color ? {
                                                                                     backgroundColor: billingTargetTeamInfo.color,
                                                                                     color: getContrastingTextColor(billingTargetTeamInfo.color),
                                                                                     border: `1px solid ${billingTargetTeamInfo.color}`
                                                                                 } : {
                                                                                    backgroundColor: '#f1f5f9',
                                                                                    color: '#475569',
                                                                                    border: '1px solid #e2e8f0'
                                                                                })
                                                                                : undefined}
                                                                        >
                                                                            <FontAwesomeIcon
                                                                                icon={billingTargetType === 'team'
                                                                                    ? getTeamFaIcon(billingTargetTeamInfo?.icon)
                                                                                    : billingTargetType === 'office'
                                                                                        ? faBuilding
                                                                                        : faUser}
                                                                                className="text-[10px]"
                                                                            />
                                                                            <span className="truncate">{billingTargetName}</span>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-300">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={`inline-flex min-w-[46px] items-center justify-center rounded-md border px-2 py-1 text-[11px] font-extrabold ${billingModeBadge.className}`}>
                                                                        {billingModeBadge.label}
                                                                    </span>
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
                                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${isManualRentDueSoon(acc) ? 'bg-amber-100 text-amber-700' : 'text-slate-500'}`}>
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
                                                                <td className="px-4 py-3 text-center">
                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                        <button
                                                                            onClick={(e) => handleQuickAssignClick(e, acc)}
                                                                            className="px-2.5 h-7 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 flex items-center justify-center gap-1.5 text-indigo-700 transition-colors text-[11px] font-bold"
                                                                            title="배정/청구대상 관리 및 청구이력 확인"
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
                                                                        {acc.status === 'inactive' ? (
                                                                            <button
                                                                                onClick={(e) => handleRestoreClick(e, acc)}
                                                                                className="w-7 h-7 rounded-md bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-colors"
                                                                                title="처리취소"
                                                                            >
                                                                                <FontAwesomeIcon icon={faRotateRight} className="text-xs" />
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={(e) => handleCancellationClick(e, acc)}
                                                                                className="w-7 h-7 rounded-md bg-slate-50 hover:bg-amber-50 flex items-center justify-center text-slate-300 hover:text-amber-600 transition-colors"
                                                                                title="사용취소 처리"
                                                                            >
                                                                                <FontAwesomeIcon icon={faBoxArchive} className="text-xs" />
                                                                            </button>
                                                                        )}
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
                                    {sortedFilteredAccommodations.map(acc => (
                                        (() => {
                                            const activeList = getActiveAssignmentsForAccommodation(acc);
                                            const checkedInCount = activeList.length;
                                            const separatedBillingTarget = getBillingTargetForAccommodation(acc);
                                            const billingTargetLabel = buildBillingTargetLabel(acc, activeList);
                                            const billingTargetWorkers = buildBillingTargetWorkerList(acc, activeList);
                                            const billingModeBadge = getBillingModeBadge(acc, separatedBillingTarget, activeList.length > 0);
                                            const isExpired = acc.status === 'inactive';
                                            const needsWork = acc.status === 'active' && activeList.length === 0;

                                            const primaryTeamAssign = activeList.find(
                                                (a) => !!normalizeKey(a.teamId) || !!normalizeKey(a.teamName)
                                            );
                                            const primaryTeamInfo = primaryTeamAssign
                                                ? getTeamInfo(primaryTeamAssign.teamId, primaryTeamAssign.teamName)
                                                : undefined;
                                            const tc = primaryTeamInfo?.color;
                                            const tcText = tc ? getContrastingTextColor(tc) : undefined;

                                            return (
                                                <div
                                                    key={acc.id}
                                                    onClick={() => handleOpenAssignmentCenter(acc)}
                                                    className={`group bg-white rounded-2xl border transition-all cursor-pointer relative overflow-hidden
                                                        ${needsWork
                                                            ? 'border-amber-200 shadow-[0_8px_24px_-16px_rgba(245,158,11,0.65)]'
                                                            : isExpired
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
                                                                {acc.status === 'inactive' ? (
                                                                    <button
                                                                        onClick={(e) => handleRestoreClick(e, acc)}
                                                                        className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-colors z-10"
                                                                        title="처리취소"
                                                                    >
                                                                        <FontAwesomeIcon icon={faRotateRight} className="text-xs" />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => handleCancellationClick(e, acc)}
                                                                        className="w-8 h-8 rounded-full bg-slate-50 hover:bg-amber-50 flex items-center justify-center text-slate-300 hover:text-amber-600 transition-colors z-10"
                                                                        title="사용취소 처리"
                                                                    >
                                                                        <FontAwesomeIcon icon={faBoxArchive} className="text-xs" />
                                                                    </button>
                                                                )}
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
                                                                         backgroundColor: tc,
                                                                         color: tcText,
                                                                         border: `1px solid ${tc}`,
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

                                                        <div className="flex min-w-0 items-center gap-2 mb-1 group/cardname">
                                                            <span
                                                                 className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-400"
                                                                 style={tc ? {
                                                                     backgroundColor: tc,
                                                                     color: tcText,
                                                                     borderColor: tc,
                                                                 } : undefined}
                                                            >
                                                                <FontAwesomeIcon icon={faBuilding} />
                                                            </span>
                                                             <h3
                                                                 className="min-w-0 flex-1 truncate text-lg font-bold text-slate-800 transition-colors group-hover:text-indigo-700"
                                                             >
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
                                                                        const assignmentDisplayName = normalizeKey(assign.workerName) || normalizeKey(assign.teamName) || '배정 대상';

                                                                        return (
                                                                            <span key={assign.id}
                                                                                 className="text-xs px-2 py-1 rounded-lg font-bold border flex items-center gap-1.5"
                                                                                 style={atc ? {
                                                                                     backgroundColor: atc,
                                                                                     color: getContrastingTextColor(atc),
                                                                                     borderColor: atc,
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
                                                                                {assignmentDisplayName}
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
                                                            <div className="flex justify-between items-center text-sm">
                                                                <span className="text-slate-400 font-medium text-xs">청구 방식</span>
                                                                <span className={`inline-flex min-w-[46px] items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${billingModeBadge.className}`}>
                                                                    {billingModeBadge.label}
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
                                                                        <span className={`font-bold text-xs px-2 py-0.5 rounded ${isManualRentDueSoon(acc) ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
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
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in-up">
                                <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faChartPie} className="text-indigo-500" />
                                        명의별 현황 요약 ({
                                            filterStatus === 'all' ? '전체' :
                                            filterStatus === 'active' ? '운영 중' :
                                            filterStatus === 'todo' ? '확인 필요' :
                                            '보관/종료'
                                        })
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
                        </div>
                    ) : activeTab === 'ledger' ? (
                        <UtilityLedger selectedTeamId={selectedTeamId} searchText={searchTerm} />
                    ) : (
                        <SupportCancellationHistory
                            resourceType="accommodation"
                            title="숙소 사용취소 처리내역"
                        />
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
                    assignmentHistory={getAssignmentsForAccommodation(quickAssignItem)}
                    isOpen={!!quickAssignItem}
                    onClose={() => setQuickAssignItem(null)}
                    onSuccess={() => {
                        loadData(); // 단순 리로드 (UX 개선을 위해선 로컬 state만 바꿔도 되지만 안전하게)
                        // setQuickAssignItem(null); // Keep open? No, close makes sense or user closes manually
                    }}
                />
            )}

            <SupportCancellationModal
                isOpen={!!cancellationTarget}
                resourceType="accommodation"
                resourceLabel={cancellationTarget?.name || cancellationTarget?.address || '숙소'}
                resourceDescription={cancellationTarget ? `${cancellationTarget.address || '주소 미입력'} · ${cancellationTarget.currentOccupantName || '입실자 없음'}` : undefined}
                submitting={savingCancellation}
                onClose={() => setCancellationTarget(null)}
                onSubmit={handleCancellationSubmit}
            />
        </div>
    );
};

export default AccommodationManager;
