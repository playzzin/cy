import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowsRotate,
    faCheck,
    faCircleInfo,
    faShieldHalved,
    faSpinner,
    faSitemap,
    faTag,
    faLink,
    faSearch,
    faUserGear
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { useAuth } from '../../contexts/AuthContext';
import { userService, UserData } from '../../services/userService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { officeStaffService, OfficeStaff } from '../../services/officeStaffService';
import { positionService, Position } from '../../services/positionService';
import { userMenuPositionService, UserMenuPositionMap } from '../../services/userMenuPositionService';
import { userAccessClaimsService } from '../../services/userAccessClaimsService';
import { accountLinkService } from '../../services/accountLinkService';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { permissionAuditService } from '../../services/permissionAuditService';
import { SiteDataType } from '../../types/menu';
import AccountLinkManager from '../../components/admin/AccountLinkManager';
import IntegratedPositionManager from '../../components/admin/IntegratedPositionManager';
import { flattenMenuPermissions } from '../../features/permission-matrix/permissionMatrix';
import { buildMenuAccessRoles, canAccessMenuRoles } from '../../utils/menuAccess';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import { companyService, type Company } from '../../services/companyService';
import type { AccountLink } from '../../types/accountLink';
import { accessRoleLabel, normalizeAccessRole, selectPositionAccess, summarizeAccountConnections, userStatusLabel } from '../../utils/userManagementPresentation';
import './UserManagementPage.css';

type CanonicalSystemRole = 'admin' | 'manager' | 'user';
type UserManagementSection = 'access' | 'account-links' | 'positions' | 'integrity';

const SYSTEM_ROLE_OPTIONS: Array<{ value: CanonicalSystemRole; label: string }> = [
    { value: 'admin', label: '관리자' },
    { value: 'manager', label: '매니저' },
    { value: 'user', label: '일반' }
];

const normalizeSystemRole = normalizeAccessRole;

const USER_MANAGEMENT_SECTIONS: Array<{
    id: UserManagementSection;
    label: string;
    description: string;
    path: string;
    icon: typeof faUserGear;
}> = [
    {
        id: 'access',
        label: '직책·권한',
        description: '사용자별 시스템 권한과 기본·추가 직책을 설정합니다.',
        path: '/admin/user-management',
        icon: faUserGear
    },
    {
        id: 'account-links',
        label: '계정 연결',
        description: '가입 요청을 승인하고 사용자 계정과 작업자·직원·회사를 안전하게 연결합니다.',
        path: '/admin/user-management/account-links',
        icon: faShieldHalved
    },
    {
        id: 'positions',
        label: '직책 관리',
        description: '직책 체계, 권한 그룹, 인력 배정을 관리합니다.',
        path: '/admin/user-management/positions',
        icon: faSitemap
    },
    {
        id: 'integrity',
        label: '점검',
        description: '사용자와 연동 인력의 직책·권한 데이터를 점검하고 보정합니다.',
        path: '/admin/user-management/integrity',
        icon: faCircleInfo
    }
];

const getUserManagementSection = (pathname: string): UserManagementSection => {
    if (pathname.endsWith('/account-links')) return 'account-links';
    if (pathname.endsWith('/positions')) return 'positions';
    if (pathname.endsWith('/integrity')) return 'integrity';
    return 'access';
};

const UserManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser } = useAuth();
    const devAdminMode = isDevAdminSessionEnabled();
    const activeSection = getUserManagementSection(location.pathname);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [users, setUsers] = useState<UserData[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [accountLinks, setAccountLinks] = useState<AccountLink[]>([]);
    const [connectionError, setConnectionError] = useState(false);
    const [menuConfig, setMenuConfig] = useState<SiteDataType | null>(null);
    const [userPositionMap, setUserPositionMap] = useState<UserMenuPositionMap>({});

    const [search, setSearch] = useState('');
    const requestedUserId = new URLSearchParams(location.search).get('user') || '';
    const [selectedUserId, setSelectedUserId] = useState(requestedUserId);
    const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'issues'>('all');
    const [integrityFilter, setIntegrityFilter] = useState('all');
    const [advancedRole, setAdvancedRole] = useState(false);

    const [draftRole, setDraftRole] = useState<CanonicalSystemRole>('user');
    const [draftPosition, setDraftPosition] = useState('');
    const [draftAdditionalPositions, setDraftAdditionalPositions] = useState<string[]>([]);
    const [syncLinkedWorkerRole, setSyncLinkedWorkerRole] = useState(false);

    const [savingCore, setSavingCore] = useState(false);
    const [savingAdditional, setSavingAdditional] = useState(false);
    const [runningAutoFix, setRunningAutoFix] = useState(false);

    const loadAll = useCallback(async () => {
        const [usersData, workersData, officeStaffData, positionsData] = await Promise.all([
            userService.getAllUsers(),
            manpowerService.getWorkers(),
            officeStaffService.getOfficeStaff(true),
            positionService.getPositions()
        ]);
        setUsers(usersData);
        setWorkers(workersData);
        setOfficeStaffRows(officeStaffData);
        setPositions(positionsData);
        if (!isDevAdminSessionEnabled()) {
            try {
                const [companyRows, links] = await Promise.all([companyService.getCompanies(), accountLinkService.getAllLinks()]);
                setCompanies(companyRows);
                setAccountLinks(links);
                setConnectionError(false);
            } catch {
                setConnectionError(true);
            }
        }
    }, []);

    useEffect(() => {
        let alive = true;
        const boot = async () => {
            try {
                await loadAll();
            } catch (error) {
                console.error('[UserManagementPage] load failed:', error);
                Swal.fire('오류', '사용자 데이터를 불러오지 못했습니다.', 'error');
            } finally {
                if (alive) setLoading(false);
            }
        };
        boot();

        const unsubMenu = menuServiceV11.subscribe((cfg) => setMenuConfig(cfg));
        const unsubUserPositions = userMenuPositionService.subscribe((map) => setUserPositionMap(map));
        return () => {
            alive = false;
            unsubMenu();
            unsubUserPositions();
        };
    }, [loadAll]);

    const workerById = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => {
            if (worker.id) map.set(String(worker.id), worker);
            if (worker.legacyId) map.set(String(worker.legacyId), worker);
        });
        return map;
    }, [workers]);

    const officeStaffById = useMemo(() => {
        const map = new Map<string, OfficeStaff>();
        officeStaffRows.forEach((staff) => {
            if (staff.id) map.set(String(staff.id), staff);
            if (staff.legacyId) map.set(String(staff.legacyId), staff);
        });
        return map;
    }, [officeStaffRows]);

    const linkedWorkersByUserId = useMemo(() => {
        const map = new Map<string, Worker[]>();
        users.forEach((user) => {
            const linked = new Map<string, Worker>();
            (user.linkedWorkerIds || []).forEach((id) => {
                const worker = workerById.get(String(id));
                if (worker?.id) linked.set(String(worker.id), worker);
            });
            workers.forEach((worker) => {
                if (worker.uid === user.uid && worker.id) linked.set(String(worker.id), worker);
            });
            accountLinks.filter((link) => link.uid === user.uid && link.entityType === 'worker' && link.status === 'active').forEach((link) => {
                const worker = workerById.get(link.entityId);
                if (worker?.id) linked.set(String(worker.id), worker);
            });
            map.set(user.uid, Array.from(linked.values()));
        });
        return map;
    }, [users, workers, workerById, accountLinks]);

    const linkedOfficeStaffByUserId = useMemo(() => {
        const map = new Map<string, OfficeStaff[]>();
        users.forEach((user) => {
            const linked = new Map<string, OfficeStaff>();
            (user.linkedOfficeStaffIds || []).forEach((id) => {
                const staff = officeStaffById.get(String(id));
                if (staff?.id) linked.set(String(staff.id), staff);
            });
            officeStaffRows.forEach((staff) => {
                if (staff.uid === user.uid && staff.id) linked.set(String(staff.id), staff);
            });
            accountLinks.filter((link) => link.uid === user.uid && link.entityType === 'office' && link.status === 'active').forEach((link) => {
                const staff = officeStaffById.get(link.entityId);
                if (staff?.id) linked.set(String(staff.id), staff);
            });
            map.set(user.uid, Array.from(linked.values()));
        });
        return map;
    }, [users, officeStaffRows, officeStaffById, accountLinks]);

    const validPositionNames = useMemo(() => {
        return new Set(positions.map((position) => String(position.name).trim()).filter(Boolean));
    }, [positions]);

    const integrityRows = useMemo(() => {
        return users.map((user) => {
            const linkedWorkers = linkedWorkersByUserId.get(user.uid) || [];
            const linkedOfficeStaff = linkedOfficeStaffByUserId.get(user.uid) || [];

            const basePosition = String(user.position || '').trim();
            const linkedRoles = Array.from(new Set([
                ...linkedWorkers.map((worker) => String(worker.role || '').trim()),
                ...linkedOfficeStaff.map((staff) => String(staff.role || '').trim())
            ].filter(Boolean)));
            const linkedRole = linkedRoles.join(', ');
            const additionalPositions = userPositionMap[user.uid] || [];
            const invalidAdditionalPositions = additionalPositions.filter((name) => !validPositionNames.has(String(name).trim()));

            const missingBasePosition = basePosition.length === 0;
            const invalidBasePosition = basePosition.length > 0 && !validPositionNames.has(basePosition);
            const mismatchWithLinkedWorker = Boolean(basePosition && linkedRoles.some((role) => role !== basePosition));
            const configuredPosition = positions.find((position) => position.name === basePosition);
            const roleMismatch = Boolean(configuredPosition && normalizeSystemRole(user.role) !== normalizeSystemRole(configuredPosition.systemRole));

            return {
                uid: user.uid,
                displayName: user.displayName || '',
                email: user.email || '',
                basePosition,
                linkedRole,
                missingBasePosition,
                invalidBasePosition,
                mismatchWithLinkedWorker,
                roleMismatch,
                invalidAdditionalPositions
            };
        });
    }, [users, positions, linkedOfficeStaffByUserId, linkedWorkersByUserId, userPositionMap, validPositionNames]);

    const integritySummary = useMemo(() => {
        return {
            missingBasePosition: integrityRows.filter((row) => row.missingBasePosition).length,
            invalidBasePosition: integrityRows.filter((row) => row.invalidBasePosition).length,
            mismatchWithLinkedWorker: integrityRows.filter((row) => row.mismatchWithLinkedWorker).length,
            invalidAdditional: integrityRows.filter((row) => row.invalidAdditionalPositions.length > 0).length,
            roleMismatch: integrityRows.filter((row) => row.roleMismatch).length,
        };
    }, [integrityRows]);

    const connectionsByUser = useMemo(() => new Map(users.map((user) => [user.uid,
        summarizeAccountConnections(user, workers, officeStaffRows, companies, accountLinks),
    ])), [users, workers, officeStaffRows, companies, accountLinks]);
    const previewLinkData = useMemo(() => devAdminMode ? { companies: [], officeStaff: officeStaffRows, links: [] } : undefined, [devAdminMode, officeStaffRows]);

    const issueRows = integrityRows.filter((row) => row.missingBasePosition || row.invalidBasePosition || row.mismatchWithLinkedWorker || row.invalidAdditionalPositions.length > 0 || row.roleMismatch);

    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter((user) => {
            if (userFilter === 'pending' && user.status !== 'pending') return false;
            if (userFilter === 'issues' && !integrityRows.some((row) => row.uid === user.uid && (row.missingBasePosition || row.invalidBasePosition || row.mismatchWithLinkedWorker || row.roleMismatch || row.invalidAdditionalPositions.length > 0))) return false;
            const text = `${user.displayName || ''} ${user.email || ''} ${user.position || ''} ${accessRoleLabel(user.role)} ${(connectionsByUser.get(user.uid) || []).map((link) => link.name).join(' ')}`.toLowerCase();
            return text.includes(q);
        });
    }, [users, search, userFilter, integrityRows, connectionsByUser]);

    useEffect(() => {
        if ((!selectedUserId || !users.some((u) => u.uid === selectedUserId)) && users.length > 0) {
            setSelectedUserId(users[0].uid);
        }
    }, [users, selectedUserId]);

    useEffect(() => {
        if (requestedUserId) {
            setSelectedUserId(requestedUserId);
            setSearch('');
            setUserFilter('all');
        }
    }, [requestedUserId]);

    const selectedUser = useMemo(() => users.find((user) => user.uid === selectedUserId) || null, [users, selectedUserId]);
    const selectedUserIntegrity = useMemo(
        () => integrityRows.find((row) => row.uid === selectedUserId) || null,
        [integrityRows, selectedUserId]
    );
    const selectedLinkedWorkers = useMemo(() => {
        if (!selectedUser) return [];
        return linkedWorkersByUserId.get(selectedUser.uid) || [];
    }, [selectedUser, linkedWorkersByUserId]);
    const selectedLinkedOfficeStaff = useMemo(() => {
        if (!selectedUser) return [];
        return linkedOfficeStaffByUserId.get(selectedUser.uid) || [];
    }, [selectedUser, linkedOfficeStaffByUserId]);

    useEffect(() => {
        if (!selectedUser) return;
        setDraftRole(normalizeSystemRole(selectedUser.role));
        setDraftPosition(String(selectedUser.position || ''));
        setDraftAdditionalPositions(userPositionMap[selectedUser.uid] || []);
        setSyncLinkedWorkerRole(false);
        setAdvancedRole(false);
    }, [selectedUser, userPositionMap]);

    const refreshAll = async () => {
        setRefreshing(true);
        try {
            await loadAll();
            await userMenuPositionService.refresh();
            await menuServiceV11.refreshFromServer();
        } catch {
            Swal.fire('새로고침 실패', '데이터를 불러오지 못했습니다. 다시 시도해 주세요.', 'error');
        } finally {
            setRefreshing(false);
        }
    };

    const previewMenuRows = useMemo(() => {
        return flattenMenuPermissions(menuConfig, { selectedSite: 'admin' });
    }, [menuConfig]);

    const previewAccessRoles = useMemo(() => {
        return buildMenuAccessRoles(draftPosition, draftAdditionalPositions);
    }, [draftPosition, draftAdditionalPositions]);

    const previewSummary = useMemo(() => {
        const total = previewMenuRows.length;
        const allowed = previewMenuRows.filter((row) => canAccessMenuRoles(previewAccessRoles, row.roles)).length;
        return { total, allowed, blocked: total - allowed };
    }, [previewAccessRoles, previewMenuRows]);

    const handleAutoSyncUserPositionFromLinkedWorker = async () => {
        setRunningAutoFix(true);
        try {
            let updatedCount = 0;
            for (const user of users) {
                const basePosition = String(user.position || '').trim();
                const linkedWorkers = linkedWorkersByUserId.get(user.uid) || [];
                const linkedOfficeStaff = linkedOfficeStaffByUserId.get(user.uid) || [];
                const linkedRole = String(linkedWorkers[0]?.role || linkedOfficeStaff[0]?.role || '').trim();
                if (!linkedRole) continue;
                if (!validPositionNames.has(linkedRole)) continue;
                if (basePosition === linkedRole) continue;

                await userService.updateUserProfile(user.uid, { position: linkedRole });
                updatedCount += 1;
            }
            await loadAll();
            Swal.fire('자동 동기화 완료', `${updatedCount}명의 기본 직책을 연동 인원 기준으로 맞췄습니다.`, 'success');
        } catch (error) {
            console.error('[UserManagementPage] auto sync user position failed:', error);
            Swal.fire('오류', '사용자 기본 직책 자동 동기화에 실패했습니다.', 'error');
        } finally {
            setRunningAutoFix(false);
        }
    };

    const handleAutoSyncLinkedWorkerRoleFromUser = async () => {
        setRunningAutoFix(true);
        try {
            let updatedCount = 0;
            for (const user of users) {
                const basePosition = String(user.position || '').trim();
                if (!basePosition) continue;
                for (const linkedWorker of linkedWorkersByUserId.get(user.uid) || []) {
                    if (!linkedWorker?.id) continue;
                    if (String(linkedWorker.role || '').trim() === basePosition) continue;
                    await manpowerService.updateWorker(String(linkedWorker.id), { role: basePosition });
                    updatedCount += 1;
                }
                for (const linkedStaff of linkedOfficeStaffByUserId.get(user.uid) || []) {
                    if (!linkedStaff?.id) continue;
                    if (String(linkedStaff.role || '').trim() === basePosition) continue;
                    await officeStaffService.updateOfficeStaff(String(linkedStaff.id), { role: basePosition });
                    updatedCount += 1;
                }
            }
            await loadAll();
            Swal.fire('자동 동기화 완료', `${updatedCount}건의 연동 인원 직책을 사용자 기본 직책으로 맞췄습니다.`, 'success');
        } catch (error) {
            console.error('[UserManagementPage] auto sync linked worker role failed:', error);
            Swal.fire('오류', '연동 작업자 직책 자동 동기화에 실패했습니다.', 'error');
        } finally {
            setRunningAutoFix(false);
        }
    };

    const handleCleanInvalidAdditionalPositions = async () => {
        setRunningAutoFix(true);
        try {
            let updatedCount = 0;
            for (const user of users) {
                const current = userPositionMap[user.uid] || [];
                const cleaned = current.filter((name) => validPositionNames.has(String(name).trim()));
                if (cleaned.length === current.length) continue;
                await userMenuPositionService.setPositions(user.uid, cleaned);
                await userAccessClaimsService.syncUser(user.uid).catch((claimError) => {
                    console.warn('[UserManagementPage] claim sync failed:', claimError);
                });
                updatedCount += 1;
            }
            await userMenuPositionService.refresh();
            Swal.fire('정리 완료', `${updatedCount}명의 잘못된 추가 직책을 정리했습니다.`, 'success');
        } catch (error) {
            console.error('[UserManagementPage] clean invalid additional positions failed:', error);
            Swal.fire('오류', '추가 직책 정리에 실패했습니다.', 'error');
        } finally {
            setRunningAutoFix(false);
        }
    };

    const handleSaveSelectedUserAccess = async () => {
        if (!selectedUser) return;
        if (!draftPosition && selectedUser.uid === currentUser?.uid) {
            Swal.fire('해제할 수 없음', '현재 로그인한 관리자 자신의 승인은 해제할 수 없습니다.', 'warning');
            return;
        }
        setSavingCore(true);
        setSavingAdditional(true);
        try {
            const beforeAccess = {
                systemRole: normalizeSystemRole(selectedUser.role),
                position: String(selectedUser.position || ''),
                additionalPositions: [...(userPositionMap[selectedUser.uid] || [])].sort(),
            };
            const afterAccess = {
                systemRole: draftRole,
                position: draftPosition,
                additionalPositions: draftPosition ? [...draftAdditionalPositions].sort() : [],
            };
            if (draftPosition) {
                await accountLinkService.updateUserAccess({
                    uid: selectedUser.uid,
                    role: draftRole,
                    position: draftPosition,
                    additionalPositions: draftAdditionalPositions,
                    syncLinkedProfiles: syncLinkedWorkerRole,
                });
            } else {
                await accountLinkService.revokeUserAccessApproval(selectedUser.uid);
            }
            const accessChanged = JSON.stringify(beforeAccess) !== JSON.stringify(afterAccess);
            if (accessChanged) {
                await permissionAuditService.log({
                    action: 'USER_ACCESS_UPDATED',
                    targetId: selectedUser.uid,
                    targetName: selectedUser.displayName || selectedUser.email || selectedUser.uid,
                    details: {
                        scope: 'user_access',
                        before: beforeAccess,
                        after: afterAccess,
                        syncedLinkedProfiles: syncLinkedWorkerRole,
                    },
                }).catch((auditError) => {
                    console.warn('[UserManagementPage] server update succeeded but client audit log failed:', auditError);
                });
            }
            await loadAll();
            await userMenuPositionService.refresh();
            Swal.fire(
                '저장 완료',
                draftPosition
                    ? '사용자 권한, 기본 직책, 추가 직책을 저장했습니다.'
                    : '기본 직책과 접근 승인을 해제했습니다. 해당 사용자는 다시 승인될 때까지 승인 대기 화면이 표시됩니다.',
                'success'
            );
        } catch (error) {
            console.error('[UserManagementPage] save selected user access failed:', error);
            Swal.fire('오류', '저장에 실패했습니다.', 'error');
        } finally {
            setSavingCore(false);
            setSavingAdditional(false);
        }
    };

    const savingUserAccess = savingCore || savingAdditional;
    const configuredPosition = positions.find((position) => position.name === draftPosition);
    const selectedConnections = connectionsByUser.get(selectedUserId) || [];
    const hasChanges = Boolean(selectedUser && (draftRole !== normalizeSystemRole(selectedUser.role)
        || draftPosition !== (selectedUser.position || '') || syncLinkedWorkerRole
        || JSON.stringify([...draftAdditionalPositions].sort()) !== JSON.stringify([...(userPositionMap[selectedUserId] || [])].sort())));
    const needsApproval = Boolean(selectedUser && selectedUser.status !== 'active' && draftPosition);
    const canSaveAccess = hasChanges || needsApproval;
    useEffect(() => {
        if (!hasChanges) return;
        const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [hasChanges]);
    const canLeaveEditor = async () => !hasChanges || (await Swal.fire({
        title: '저장하지 않은 변경이 있습니다', text: '변경을 버리고 이동할까요?', icon: 'question',
        showCancelButton: true, confirmButtonText: '변경 버리고 이동', cancelButtonText: '계속 편집',
    })).isConfirmed;
    const resetDraft = () => {
        if (!selectedUser) return;
        setDraftRole(normalizeSystemRole(selectedUser.role)); setDraftPosition(selectedUser.position || '');
        setDraftAdditionalPositions(userPositionMap[selectedUserId] || []); setSyncLinkedWorkerRole(false); setAdvancedRole(false);
    };
    const openSection = async (section: UserManagementSection, uid = selectedUserId) => {
        if (savingUserAccess || !(await canLeaveEditor())) return;
        resetDraft();
        const target = USER_MANAGEMENT_SECTIONS.find((item) => item.id === section)!;
        navigate(`${target.path}${uid ? `?user=${encodeURIComponent(uid)}` : ''}`);
    };
    const selectUser = async (uid: string) => {
        if (uid === selectedUserId || savingUserAccess || !(await canLeaveEditor())) return;
        setSelectedUserId(uid); navigate(`${location.pathname}?user=${encodeURIComponent(uid)}`, { replace: true });
    };
    const changePosition = (name: string) => {
        const next = selectPositionAccess(positions.find((position) => position.name === name), draftAdditionalPositions);
        setDraftPosition(next.position); setDraftRole(next.role); setDraftAdditionalPositions(next.additionalPositions); setAdvancedRole(false);
    };
    const saveAccess = async () => {
        if (!selectedUser || !canSaveAccess) return;
        const confirmed = await Swal.fire({
            title: draftPosition ? '직책·권한을 저장할까요?' : '접근 승인을 해제할까요?',
            text: `${selectedUser.displayName || selectedUser.email}: ${selectedUser.position || '미지정'} → ${draftPosition || '미지정'} · ${accessRoleLabel(draftRole)}. ${!draftPosition ? '다시 승인될 때까지 이 계정은 서비스를 사용할 수 없습니다.' : syncLinkedWorkerRole ? '연결된 인원 직책도 함께 변경됩니다.' : '추가 직책의 메뉴 권한도 함께 저장합니다.'}`,
            icon: 'question', showCancelButton: true, confirmButtonText: draftPosition ? '저장' : '승인 해제', cancelButtonText: '취소',
        });
        if (confirmed.isConfirmed) await handleSaveSelectedUserAccess();
    };
    const confirmAutoFix = async (title: string, action: () => Promise<void>) => {
        const result = await Swal.fire({ title, text: '전체 계정의 해당 데이터를 일괄 변경합니다. 점검 목록을 확인한 뒤 실행해 주세요.', icon: 'warning', showCancelButton: true, confirmButtonText: '일괄 적용', cancelButtonText: '취소' });
        if (result.isConfirmed) await action();
    };
    const integrityOptions = [
        { id: 'all', label: '전체 확인 필요', count: issueRows.length },
        { id: 'missingBasePosition', label: '직책 미지정', count: integritySummary.missingBasePosition },
        { id: 'invalidBasePosition', label: '삭제된 직책', count: integritySummary.invalidBasePosition },
        { id: 'mismatchWithLinkedWorker', label: '연결 인원과 불일치', count: integritySummary.mismatchWithLinkedWorker },
        { id: 'roleMismatch', label: '직책 권한과 다름', count: integritySummary.roleMismatch },
        { id: 'invalidAdditional', label: '추가 직책 오류', count: integritySummary.invalidAdditional },
    ];
    const visibleIssues = issueRows.filter((row) => integrityFilter === 'all'
        || (integrityFilter === 'invalidAdditional' ? row.invalidAdditionalPositions.length > 0 : Boolean(row[integrityFilter as keyof typeof row])));

    if (loading) return <div className="p-6 text-center text-slate-500" role="status"><FontAwesomeIcon icon={faSpinner} spin /> 사용자 정보를 불러오는 중...</div>;
    return (
        <div className="user-management-page">
            <header className="um-header">
                <h1><FontAwesomeIcon icon={faUserGear} /> 사용자 관리</h1>
                <nav aria-label="사용자 관리 메뉴" className="um-nav">
                    {USER_MANAGEMENT_SECTIONS.filter((section) => section.id !== 'positions').map((section) => {
                        const active = section.id === activeSection || (section.id === 'access' && activeSection === 'positions');
                        return <button key={section.id} type="button" onClick={() => void openSection(section.id)} aria-current={active ? 'page' : undefined}>
                            <FontAwesomeIcon icon={section.icon} /> {section.label}
                            {section.id === 'integrity' && issueRows.length > 0 && <span className="um-count">{issueRows.length}</span>}
                        </button>;
                    })}
                </nav>
                <div className="um-header-actions">
                    <button type="button" className="um-button" onClick={async () => { if (await canLeaveEditor()) { resetDraft(); await refreshAll(); } }} disabled={refreshing || savingUserAccess} aria-label="사용자 정보 새로고침"><FontAwesomeIcon icon={refreshing ? faSpinner : faArrowsRotate} spin={refreshing} /></button>
                    <button type="button" className="um-button" onClick={async () => { if (await canLeaveEditor()) navigate('/admin/role-menu'); }}>메뉴별 권한</button>
                </div>
            </header>
            {(activeSection === 'access' || activeSection === 'positions') && <div className="um-subbar">
                <div className="um-segment" aria-label="직책·권한 보기">
                    <button type="button" aria-pressed={activeSection === 'access'} onClick={() => void openSection('access')}>사용자별 설정 <span>{users.length}</span></button>
                    <button type="button" aria-pressed={activeSection === 'positions'} onClick={() => void openSection('positions')}>직책별 설정 <span>{positions.length}</span></button>
                </div><p>직책을 선택하면 연결된 권한이 함께 적용됩니다.</p>
            </div>}
            {activeSection === 'account-links' && <AccountLinkManager users={users} workers={workers} loading={refreshing} selectedUserId={selectedUserId}
                onSelectUser={setSelectedUserId} onChanged={loadAll} actorEmail={currentUser?.email || 'system'} embedded
                onManageAccess={(uid) => void openSection('access', uid)} previewData={previewLinkData} />}
            {activeSection === 'positions' && <IntegratedPositionManager positions={positions} users={users} workers={workers} officeStaffRows={officeStaffRows}
                userPositionMap={userPositionMap} onChanged={async () => { await loadAll(); await userMenuPositionService.refresh(); }} />}
            {activeSection === 'access' && <div className="um-workspace">
                <aside className="um-panel um-users" aria-label="사용자 목록">
                    <div className="um-list-tools">
                        <div className="um-search"><FontAwesomeIcon icon={faSearch} /><input aria-label="사용자 검색" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름, 이메일, 직책, 연결 대상 검색" />{search && <button type="button" aria-label="검색 지우기" onClick={() => setSearch('')}>×</button>}</div>
                        <div className="um-filters">{([['all', '전체'], ['pending', '승인 대기'], ['issues', '확인 필요']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={userFilter === key} onClick={() => setUserFilter(key)}>{label}</button>)}<span>{filteredUsers.length}명</span></div>
                    </div>
                    <div className="um-user-list">{filteredUsers.map((user) => {
                        const links = connectionsByUser.get(user.uid) || [];
                        return <button key={user.uid} type="button" aria-pressed={user.uid === selectedUserId} onClick={() => void selectUser(user.uid)} className="um-user-row">
                            <div className="um-user-line"><strong>{user.displayName || '이름 없음'}</strong><span className={`um-badge ${user.status === 'active' ? 'um-good' : 'um-warning'}`}>{userStatusLabel(user.status)}</span></div>
                            <div className="um-email">{user.email || '이메일 없음'}</div>
                            <div className="um-user-line"><span className="um-badge">{user.position || '직책 미지정'}</span><span className="um-muted">{accessRoleLabel(user.role)}</span></div>
                            <div className="um-connection-caption"><FontAwesomeIcon icon={faLink} /> {connectionError ? '연결 정보 확인 필요' : links.length ? links.map((link) => `${link.label} ${link.name}${link.status === 'pending' ? ' (승인 대기)' : ''}`).join(' · ') : '연결된 대상 없음'}</div>
                        </button>;
                    })}{filteredUsers.length === 0 && <div className="um-empty">검색 조건에 맞는 사용자가 없습니다.<button className="um-button" type="button" onClick={() => { setSearch(''); setUserFilter('all'); }}>필터 초기화</button></div>}</div>
                </aside>
                {!selectedUser ? <div className="um-panel um-empty">관리할 사용자를 선택해 주세요.</div> : <section className="um-panel um-editor" aria-label="선택 사용자 직책·권한">
                    <div className="um-editor-heading"><div><div className="um-eyebrow">선택한 로그인 계정</div><h2>{selectedUser.displayName || '이름 없음'}</h2><p className="um-email">{selectedUser.email || '이메일 없음'}</p></div><span className={`um-badge ${selectedUser.status === 'active' ? 'um-good' : 'um-warning'}`}>{userStatusLabel(selectedUser.status)}</span></div>
                    <div className="um-editor-section um-linked-overview">
                        <div className="um-section-title"><h3><FontAwesomeIcon icon={faLink} /> 연결된 인원·회사</h3><button type="button" className="um-text-button" onClick={() => void openSection('account-links')}>연결 관리 →</button></div>
                        {connectionError ? <p className="um-notice" role="status">연결 정보를 불러오지 못했습니다. 새로고침해 주세요.</p> : selectedConnections.length ? <div className="um-connection-list">{selectedConnections.map((link) => <div key={link.key} className="um-connection"><span className="um-badge">{link.label}</span><div><strong>{link.name}</strong>{link.detail && <small>{link.detail}</small>}</div><span className={`um-badge ${link.status === 'pending' || link.missing ? 'um-warning' : 'um-good'}`}>{link.status === 'pending' ? '승인 대기' : link.missing ? '대상 확인 필요' : '연결됨'}</span></div>)}</div> : <p className="um-muted">아직 연결된 대상이 없습니다. 연결 관리에서 인원이나 회사를 선택하세요.</p>}
                    </div>
                    <fieldset disabled={savingUserAccess} className="um-editor-fields">
                        <div className="um-editor-section">
                            <div className="um-section-title"><h3><FontAwesomeIcon icon={faShieldHalved} /> 직책·권한 설정</h3><button type="button" className="um-text-button" onClick={() => void openSection('positions')}>직책 관리 →</button></div>
                            <div className="um-position-choice">
                                <label>기본 직책<select aria-label="기본 직책" value={draftPosition} onChange={(e) => changePosition(e.target.value)}><option value="">미지정 · 접근 승인 해제</option>{draftPosition && !configuredPosition && <option value={draftPosition}>{draftPosition} · 삭제된 직책</option>}{positions.map((position) => <option key={position.id || position.name} value={position.name}>{position.name} · {accessRoleLabel(position.systemRole)}</option>)}</select></label>
                                <div className="um-derived-role"><span>적용 권한</span><strong><FontAwesomeIcon icon={faShieldHalved} /> {accessRoleLabel(draftRole)}</strong><small>{configuredPosition && normalizeSystemRole(configuredPosition.systemRole) !== draftRole ? '이 계정에 개별 설정됨' : '직책에 연결된 권한'}</small></div>
                            </div>
                            {configuredPosition && normalizeSystemRole(configuredPosition.systemRole) !== draftRole && <div className="um-notice"><span>직책의 기본 권한은 {accessRoleLabel(configuredPosition.systemRole)}입니다.</span><button className="um-text-button" type="button" onClick={() => setDraftRole(normalizeSystemRole(configuredPosition.systemRole))}>직책 권한으로 맞추기</button></div>}
                            <button type="button" className="um-text-button um-advanced-toggle" aria-expanded={advancedRole} onClick={() => setAdvancedRole(!advancedRole)}>개별 권한 설정 {advancedRole ? '접기' : '펼치기'}</button>
                            {advancedRole && <label className="um-field-label">이 계정의 권한만 다르게 설정<select aria-label="개별 시스템 권한" value={draftRole} onChange={(e) => setDraftRole(e.target.value as CanonicalSystemRole)}>{SYSTEM_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
                            {(selectedLinkedWorkers.length > 0 || selectedLinkedOfficeStaff.length > 0) && <label className="um-checkbox"><input type="checkbox" checked={syncLinkedWorkerRole} onChange={(e) => setSyncLinkedWorkerRole(e.target.checked)} disabled={!draftPosition} /><span>연결된 인원 {selectedLinkedWorkers.length + selectedLinkedOfficeStaff.length}명의 직책도 함께 맞추기</span></label>}
                            {selectedUserIntegrity?.mismatchWithLinkedWorker && <p className="um-notice">현재 연결 인원의 직책({selectedUserIntegrity.linkedRole})이 계정과 다릅니다.</p>}
                            {selectedUser.status !== 'active' && <p className="um-notice">직책을 저장하면 사용 가능한 상태로 승인됩니다.</p>}
                            {!draftPosition && <p className="um-notice">미지정 상태로 저장하면 직책과 접근 승인이 해제됩니다.</p>}
                        </div>
                        <details className="um-editor-section um-details" key={`additional-${selectedUserId}`}>
                            <summary><FontAwesomeIcon icon={faTag} /> 추가 직책 <span className="um-badge">{draftAdditionalPositions.length}개</span><span className="um-muted">겸직·추가 메뉴가 필요할 때</span></summary>
                            <p className="um-muted">기본 직책을 유지하면서 선택한 직책의 메뉴를 추가합니다.</p>
                            <div className="um-position-chips">{positions.filter((position) => position.name !== draftPosition).map((position) => <button key={position.id || position.name} type="button" disabled={!draftPosition} aria-pressed={draftAdditionalPositions.includes(position.name)} onClick={() => setDraftAdditionalPositions((prev) => prev.includes(position.name) ? prev.filter((name) => name !== position.name) : [...prev, position.name])}>{draftAdditionalPositions.includes(position.name) && <FontAwesomeIcon icon={faCheck} />} {position.name}</button>)}</div>
                            {draftAdditionalPositions.filter((name) => !validPositionNames.has(name)).map((name) => <button key={name} type="button" className="um-notice" onClick={() => setDraftAdditionalPositions((prev) => prev.filter((value) => value !== name))}>{name} · 삭제된 직책 제거 ×</button>)}
                        </details>
                        <details className="um-editor-section um-details"><summary><FontAwesomeIcon icon={faCircleInfo} /> 메뉴 미리보기 <span className="um-badge um-good">{previewSummary.allowed}개 표시</span><span className="um-muted">전체 {previewSummary.total}개</span></summary>
                            <p className="um-muted">선택한 직책의 메뉴 표시 기준입니다. 실제 데이터 접근은 계정 승인과 서버 권한에 따릅니다.</p>
                            <div className="um-menu-preview">{previewMenuRows.map((row, index) => <div key={`${row.id}:${index}`}><span>{row.menuPath}</span><span className={`um-badge ${canAccessMenuRoles(previewAccessRoles, row.roles) ? 'um-good' : ''}`}>{canAccessMenuRoles(previewAccessRoles, row.roles) ? '표시' : '숨김'}</span></div>)}</div>
                        </details>
                    </fieldset>
                    <div className="um-savebar"><span role="status" className="um-muted">{hasChanges ? '저장하지 않은 변경이 있습니다' : needsApproval ? '저장하면 이 직책으로 사용을 승인합니다' : '저장된 설정입니다'}</span><div><button type="button" className="um-button" onClick={resetDraft} disabled={!hasChanges || savingUserAccess}>되돌리기</button><button type="button" className="um-button um-primary" onClick={() => void saveAccess()} disabled={!canSaveAccess || savingUserAccess}><FontAwesomeIcon icon={savingUserAccess ? faSpinner : faCheck} spin={savingUserAccess} /> 직책·권한 저장</button></div></div>
                </section>}
            </div>}
            {activeSection === 'integrity' && <section className="um-panel um-integrity">
                <div className="um-section-title"><div><h2>계정·직책 점검</h2><p className="um-muted">확인이 필요한 사용자를 선택해 직책과 권한을 함께 정리하세요.</p></div><span className={`um-badge ${issueRows.length ? 'um-warning' : 'um-good'}`}>{issueRows.length ? `${issueRows.length}명 확인 필요` : '모두 정상'}</span></div>
                <div className="um-integrity-filters">{integrityOptions.map((option) => <button type="button" key={option.id} aria-pressed={integrityFilter === option.id} onClick={() => setIntegrityFilter(option.id)}>{option.label} <strong>{option.count}</strong></button>)}</div>
                <div className="um-table-scroll"><table className="um-table"><thead><tr><th>사용자 계정</th><th>현재 직책</th><th>확인할 내용</th><th>관리</th></tr></thead><tbody>{visibleIssues.map((row) => <tr key={row.uid}><td><strong>{row.displayName || '이름 없음'}</strong><small>{row.email}</small></td><td>{row.basePosition || '미지정'}{row.linkedRole && <small>연결 인원: {row.linkedRole}</small>}</td><td><div className="um-issue-tags">{row.missingBasePosition && <span className="um-badge um-warning">직책 미지정</span>}{row.invalidBasePosition && <span className="um-badge um-warning">삭제된 기본 직책</span>}{row.mismatchWithLinkedWorker && <span className="um-badge um-warning">연결 인원과 직책 불일치</span>}{row.roleMismatch && <span className="um-badge um-warning">직책 권한과 다름 · 개별 설정 확인</span>}{row.invalidAdditionalPositions.length > 0 && <span className="um-badge um-warning">추가 직책 확인: {row.invalidAdditionalPositions.join(', ')}</span>}</div></td><td><button type="button" className="um-button" onClick={() => void openSection('access', row.uid)}>수정 →</button></td></tr>)}</tbody></table>{visibleIssues.length === 0 && <div className="um-empty"><FontAwesomeIcon icon={faCheck} /> 이 항목에서 확인할 문제가 없습니다.</div>}</div>
                <details className="um-details um-bulk"><summary>일괄 정리 도구</summary><p className="um-muted">여러 계정을 같은 기준으로 맞춰야 할 때 사용하세요.</p><div className="um-bulk-actions"><button type="button" className="um-button" disabled={runningAutoFix} onClick={() => void confirmAutoFix('인원 기준으로 계정 직책 맞추기', handleAutoSyncUserPositionFromLinkedWorker)}>인원 → 계정 직책 맞추기</button><button type="button" className="um-button" disabled={runningAutoFix} onClick={() => void confirmAutoFix('계정 기준으로 인원 직책 맞추기', handleAutoSyncLinkedWorkerRoleFromUser)}>계정 → 인원 직책 맞추기</button><button type="button" className="um-button" disabled={runningAutoFix} onClick={() => void confirmAutoFix('잘못된 추가 직책 정리', handleCleanInvalidAdditionalPositions)}>삭제된 추가 직책 정리</button></div></details>
            </section>}
        </div>
    );
};

export default UserManagementPage;
