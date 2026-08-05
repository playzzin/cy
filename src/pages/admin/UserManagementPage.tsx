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
import { menuServiceV11 } from '../../services/menuServiceV11';
import { permissionAuditService } from '../../services/permissionAuditService';
import { SiteDataType } from '../../types/menu';
import AccountLinkManager from '../../components/admin/AccountLinkManager';
import IntegratedPositionManager from '../../components/admin/IntegratedPositionManager';
import { flattenMenuPermissions } from '../../features/permission-matrix/permissionMatrix';
import { buildMenuAccessRoles, canAccessMenuRoles } from '../../utils/menuAccess';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';

type CanonicalSystemRole = 'admin' | 'manager' | 'user';
type UserManagementSection = 'access' | 'account-links' | 'positions' | 'integrity';

const SYSTEM_ROLE_OPTIONS: Array<{ value: CanonicalSystemRole; label: string }> = [
    { value: 'admin', label: '관리자' },
    { value: 'manager', label: '매니저' },
    { value: 'user', label: '일반' }
];

const normalizeSystemRole = (role: unknown): CanonicalSystemRole => {
    const raw = String(role || '').trim().toLowerCase();
    if (['admin', '관리자', '사장', '실장'].includes(raw)) return 'admin';
    if (['manager', '매니저', '메니저', '대표'].includes(raw)) return 'manager';
    return 'user';
};

const USER_MANAGEMENT_SECTIONS: Array<{
    id: UserManagementSection;
    label: string;
    description: string;
    path: string;
    icon: typeof faUserGear;
}> = [
    {
        id: 'access',
        label: '사용자 권한',
        description: '사용자별 시스템 권한과 기본·추가 직책을 설정합니다.',
        path: '/admin/user-management',
        icon: faUserGear
    },
    {
        id: 'account-links',
        label: '계정 연동',
        description: '사용자 계정과 작업자·사무실 직원 정보를 연결합니다.',
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
        label: '정합성 점검',
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
    const activeSectionMeta = USER_MANAGEMENT_SECTIONS.find((section) => section.id === activeSection) || USER_MANAGEMENT_SECTIONS[0];

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [users, setUsers] = useState<UserData[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [menuConfig, setMenuConfig] = useState<SiteDataType | null>(null);
    const [userPositionMap, setUserPositionMap] = useState<UserMenuPositionMap>({});

    const [search, setSearch] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');

    const [draftRole, setDraftRole] = useState<CanonicalSystemRole>('user');
    const [draftPosition, setDraftPosition] = useState('일반');
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
            map.set(user.uid, Array.from(linked.values()));
        });
        return map;
    }, [users, workers, workerById]);

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
            map.set(user.uid, Array.from(linked.values()));
        });
        return map;
    }, [users, officeStaffRows, officeStaffById]);

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
            const mismatchWithLinkedWorker = Boolean(basePosition && linkedRoles.length > 0 && !linkedRoles.includes(basePosition));

            return {
                uid: user.uid,
                displayName: user.displayName || '',
                email: user.email || '',
                basePosition,
                linkedRole,
                missingBasePosition,
                invalidBasePosition,
                mismatchWithLinkedWorker,
                invalidAdditionalPositions
            };
        });
    }, [users, linkedOfficeStaffByUserId, linkedWorkersByUserId, userPositionMap, validPositionNames]);

    const integritySummary = useMemo(() => {
        return {
            missingBasePosition: integrityRows.filter((row) => row.missingBasePosition).length,
            invalidBasePosition: integrityRows.filter((row) => row.invalidBasePosition).length,
            mismatchWithLinkedWorker: integrityRows.filter((row) => row.mismatchWithLinkedWorker).length,
            invalidAdditional: integrityRows.filter((row) => row.invalidAdditionalPositions.length > 0).length
        };
    }, [integrityRows]);

    const filteredUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return users;
        return users.filter((user) => {
            const text = `${user.displayName || ''} ${user.email || ''} ${user.position || ''} ${user.role || ''}`.toLowerCase();
            return text.includes(q);
        });
    }, [users, search]);

    useEffect(() => {
        if (filteredUsers.length === 0) {
            setSelectedUserId('');
            return;
        }
        if (!selectedUserId || !filteredUsers.some((u) => u.uid === selectedUserId)) {
            setSelectedUserId(filteredUsers[0].uid);
        }
    }, [filteredUsers, selectedUserId]);

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
        setDraftPosition(String(selectedUser.position || selectedLinkedWorkers[0]?.role || selectedLinkedOfficeStaff[0]?.role || '일반'));
        setDraftAdditionalPositions(userPositionMap[selectedUser.uid] || []);
    }, [selectedUser, selectedLinkedOfficeStaff, selectedLinkedWorkers, userPositionMap]);

    const refreshAll = async () => {
        setRefreshing(true);
        try {
            await loadAll();
            await userMenuPositionService.refresh();
            await menuServiceV11.refreshFromServer();
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
                additionalPositions: [...draftAdditionalPositions].sort(),
            };
            await userService.updateUserRole(selectedUser.uid, draftRole);
            await userService.updateUserProfile(selectedUser.uid, { position: draftPosition });
            await userMenuPositionService.setPositions(selectedUser.uid, draftAdditionalPositions);
            if (syncLinkedWorkerRole && draftPosition) {
                await Promise.all([
                    ...selectedLinkedWorkers.map((worker) => worker.id ? manpowerService.updateWorker(String(worker.id), { role: draftPosition }) : Promise.resolve()),
                    ...selectedLinkedOfficeStaff.map((staff) => staff.id ? officeStaffService.updateOfficeStaff(String(staff.id), { role: draftPosition }) : Promise.resolve())
                ]);
            }
            await userAccessClaimsService.syncUser(selectedUser.uid).catch((claimError) => {
                console.warn('[UserManagementPage] claim sync failed:', claimError);
            });
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
                });
            }
            await loadAll();
            await userMenuPositionService.refresh();
            Swal.fire('저장 완료', '사용자 권한, 기본 직책, 추가 직책을 저장했습니다.', 'success');
        } catch (error) {
            console.error('[UserManagementPage] save selected user access failed:', error);
            Swal.fire('오류', '저장에 실패했습니다.', 'error');
        } finally {
            setSavingCore(false);
            setSavingAdditional(false);
        }
    };

    const savingUserAccess = savingCore || savingAdditional;

    if (loading) {
        return <div className="p-10 text-center text-slate-500"><FontAwesomeIcon icon={faSpinner} spin className="mr-2" />로딩중...</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2"><FontAwesomeIcon icon={activeSectionMeta.icon} className="text-red-500" />사용자 관리</h1>
                        <p className="text-sm text-slate-500 mt-1">{activeSectionMeta.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={refreshAll} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"><FontAwesomeIcon icon={refreshing ? faSpinner : faArrowsRotate} spin={refreshing} className="mr-2" />새로고침</button>
                        <button type="button" onClick={() => navigate('/admin/role-menu')} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold"><FontAwesomeIcon icon={faShieldHalved} className="mr-2" />메뉴 권한 설정</button>
                    </div>
                </div>
                <nav aria-label="사용자 관리 메뉴" className="mt-5 border-t border-slate-100 pt-4">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {USER_MANAGEMENT_SECTIONS.map((section) => {
                            const isActive = section.id === activeSection;
                            const hasIntegrityIssues = section.id === 'integrity' && Object.values(integritySummary).some((count) => count > 0);
                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => navigate(section.path)}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-extrabold transition-colors ${isActive
                                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                                    }`}
                                >
                                    <FontAwesomeIcon icon={section.icon} />
                                    {section.label}
                                    {hasIntegrityIssues && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>확인</span>}
                                </button>
                            );
                        })}
                    </div>
                </nav>
            </section>

            {activeSection === 'integrity' && <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCircleInfo} className="text-amber-500" />
                        정합성 자동 점검
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleAutoSyncUserPositionFromLinkedWorker}
                            disabled={runningAutoFix}
                            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={runningAutoFix ? faSpinner : faArrowsRotate} spin={runningAutoFix} className="mr-2" />
                            사용자 직책 자동동기화
                        </button>
                        <button
                            type="button"
                            onClick={handleAutoSyncLinkedWorkerRoleFromUser}
                            disabled={runningAutoFix}
                            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={runningAutoFix ? faSpinner : faArrowsRotate} spin={runningAutoFix} className="mr-2" />
                            연동 인원 직책 동기화
                        </button>
                        <button
                            type="button"
                            onClick={handleCleanInvalidAdditionalPositions}
                            disabled={runningAutoFix}
                            className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:opacity-60"
                        >
                            <FontAwesomeIcon icon={runningAutoFix ? faSpinner : faArrowsRotate} spin={runningAutoFix} className="mr-2" />
                            잘못된 추가직책 정리
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                        <div className="text-[11px] text-slate-500">기본 직책 미지정</div>
                        <div className="text-lg font-bold text-slate-800">{integritySummary.missingBasePosition}</div>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                        <div className="text-[11px] text-amber-700">기본 직책 유효성 오류</div>
                        <div className="text-lg font-bold text-amber-800">{integritySummary.invalidBasePosition}</div>
                    </div>
                    <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
                        <div className="text-[11px] text-indigo-700">사용자-연동직책 불일치</div>
                        <div className="text-lg font-bold text-indigo-800">{integritySummary.mismatchWithLinkedWorker}</div>
                    </div>
                    <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
                        <div className="text-[11px] text-rose-700">잘못된 추가 직책</div>
                        <div className="text-lg font-bold text-rose-800">{integritySummary.invalidAdditional}</div>
                    </div>
                </div>
            </section>}

            {activeSection === 'account-links' && (devAdminMode ? (
                <section className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                        <FontAwesomeIcon icon={faCircleInfo} className="text-sky-600 mt-1" />
                        <div>
                            <div className="font-bold text-sky-900">개발자 관리자 모드</div>
                            <p className="text-sm text-sky-800 mt-1">
                                계정 연동 승인/거절 패널은 실제 사용자, 인력, 내근직 데이터를 변경할 수 있어 개발 확인 모드에서는 비활성화했습니다.
                                아래 권한 편집 영역은 샘플 데이터로 직접 테스트할 수 있습니다.
                            </p>
                        </div>
                    </div>
                </section>
            ) : (
                <AccountLinkManager
                    users={users}
                    workers={workers}
                    loading={refreshing}
                    selectedUserId={selectedUserId}
                    onSelectUser={setSelectedUserId}
                    onChanged={loadAll}
                    actorEmail={currentUser?.email || 'system'}
                    embedded
                />
            ))}

            {activeSection === 'positions' && <IntegratedPositionManager
                positions={positions}
                users={users}
                workers={workers}
                officeStaffRows={officeStaffRows}
                userPositionMap={userPositionMap}
                onChanged={async () => {
                    await loadAll();
                    await userMenuPositionService.refresh();
                }}
            />}

            {activeSection === 'access' && <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-100"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="사용자 검색" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>
                    <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100">
                        {filteredUsers.map((user) => (
                            <button key={user.uid} onClick={() => setSelectedUserId(user.uid)} className={`w-full text-left p-4 ${user.uid === selectedUserId ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                <div className="font-bold text-slate-800">{user.displayName || '(이름없음)'}</div>
                                <div className="text-xs text-slate-500">{user.email}</div>
                                <div className="text-xs text-slate-400 mt-1">권한: {normalizeSystemRole(user.role)} / 기본직책: {user.position || '(미지정)'}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="xl:col-span-7 space-y-4">
                    {!selectedUser ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">사용자를 선택하세요.</div>
                    ) : (
                        <>
                            <section className="bg-white border border-slate-200 rounded-2xl p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <span className="text-xs font-bold text-slate-500">선택 사용자 점검</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${selectedUserIntegrity?.missingBasePosition ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {selectedUserIntegrity?.missingBasePosition ? '기본직책 미지정' : '기본직책 정상'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${selectedUserIntegrity?.mismatchWithLinkedWorker ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {selectedUserIntegrity?.mismatchWithLinkedWorker ? '연동 직책 불일치' : '연동 직책 일치'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${(selectedUserIntegrity?.invalidAdditionalPositions.length || 0) > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {(selectedUserIntegrity?.invalidAdditionalPositions.length || 0) > 0 ? `잘못된 추가직책 ${selectedUserIntegrity?.invalidAdditionalPositions.length}건` : '추가직책 정상'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSaveSelectedUserAccess}
                                        disabled={savingUserAccess}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
                                    >
                                        <FontAwesomeIcon icon={savingUserAccess ? faSpinner : faCheck} spin={savingUserAccess} />
                                        선택 사용자 권한 저장
                                    </button>
                                </div>
                            </section>

                            <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center justify-between"><h2 className="font-extrabold text-slate-800 flex items-center gap-2"><FontAwesomeIcon icon={faShieldHalved} className="text-indigo-500" />기본 권한/직책</h2></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <select value={draftRole} onChange={(e) => setDraftRole(e.target.value as CanonicalSystemRole)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">{SYSTEM_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.value})</option>)}</select>
                                    <select value={draftPosition} onChange={(e) => setDraftPosition(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">{positions.map((position) => <option key={position.id || position.name} value={position.name}>{position.name} ({position.systemRole})</option>)}</select>
                                </div>
                                <label className="inline-flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" checked={syncLinkedWorkerRole} onChange={(e) => setSyncLinkedWorkerRole(e.target.checked)} className="mt-0.5 rounded border-slate-300" /><span>연동 작업자/사무실 직원 직책도 변경 <span className="text-xs text-slate-400">(선택 시에만 인력 직책을 함께 변경합니다)</span></span></label>
                            </section>

                            <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center justify-between"><h2 className="font-extrabold text-slate-800 flex items-center gap-2"><FontAwesomeIcon icon={faTag} className="text-cyan-500" />추가 직책 권한</h2></div>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {positions.map((position) => {
                                        const isBase = position.name === draftPosition;
                                        const isExtra = draftAdditionalPositions.includes(position.name);
                                        return (
                                            <button key={position.id || position.name} disabled={isBase} onClick={() => setDraftAdditionalPositions((prev) => prev.includes(position.name) ? prev.filter((v) => v !== position.name) : [...prev, position.name])} className={`px-3 py-2 rounded-lg border text-sm text-left ${isBase ? 'bg-green-50 border-green-200 text-green-700' : isExtra ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                                <div className="font-bold">{position.name}</div><div className="text-[11px] opacity-80">{isBase ? '기본 직책' : position.systemRole}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="bg-white border border-slate-200 rounded-2xl p-5">
                                <h2 className="font-extrabold text-slate-800 flex items-center gap-2"><FontAwesomeIcon icon={faCircleInfo} className="text-amber-500" />권한 연동 요약</h2>
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"><div className="text-[11px] text-slate-500">전체 메뉴</div><div className="text-lg font-bold text-slate-800">{previewSummary.total}</div></div>
                                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2"><div className="text-[11px] text-emerald-700">접근 가능</div><div className="text-lg font-bold text-emerald-800">{previewSummary.allowed}</div></div>
                                    <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2"><div className="text-[11px] text-rose-700">비접근</div><div className="text-lg font-bold text-rose-800">{previewSummary.blocked}</div></div>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </section>}

        </div>
    );
};

export default UserManagementPage;
