import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowsRotate,
    faCheck,
    faCircleInfo,
    faLink,
    faShieldHalved,
    faSpinner,
    faSitemap,
    faTag,
    faUserGear,
    faUserTag,
    faXmark
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { useAuth } from '../../contexts/AuthContext';
import { userService, UserData } from '../../services/userService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { positionService, Position } from '../../services/positionService';
import { userMenuPositionService, UserMenuPositionMap } from '../../services/userMenuPositionService';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { MenuItem, SiteDataType } from '../../types/menu';
import { UserRole } from '../../types/roles';
import { MENU_PATHS } from '../../constants/menuPaths';

type CanonicalSystemRole = 'admin' | 'manager' | 'user';

interface MenuLeaf {
    text: string;
    roles: string[];
}

const SYSTEM_ROLE_OPTIONS: Array<{ value: CanonicalSystemRole; label: string }> = [
    { value: 'admin', label: '관리자' },
    { value: 'manager', label: '매니저' },
    { value: 'user', label: '일반' }
];

const POSITION_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
    { value: UserRole.ADMIN, label: '관리자' },
    { value: UserRole.MANAGER, label: '매니저' },
    { value: UserRole.GENERAL, label: '일반' }
];

const normalizeSystemRole = (role: unknown): CanonicalSystemRole => {
    const raw = String(role || '').trim().toLowerCase();
    if (['admin', '관리자', '사장', '실장'].includes(raw)) return 'admin';
    if (['manager', '매니저', '메니저', '대표'].includes(raw)) return 'manager';
    return 'user';
};

const getPositionAliases = (position: string): Set<string> => {
    const alias = new Set<string>();
    const base = String(position || '').trim() || '일반';
    alias.add(base);
    if (base === '사장' || base === '실장' || base === '관리자') ['admin', '관리자', '사장', '실장'].forEach((v) => alias.add(v));
    if (base.startsWith('매니저') || base.startsWith('메니저')) ['manager', '매니저', '메니저', '매니저1', '매니저2', '매니저3', '메니저1', '메니저2', '메니저3'].forEach((v) => alias.add(v));
    if (base === '일반') ['user', 'general', '일반'].forEach((v) => alias.add(v));
    if (base === '신규자' || base === '신규') ['신규자', '신규', 'newbie'].forEach((v) => alias.add(v));
    return alias;
};

const expandLegacyRole = (role: string): string[] => {
    const raw = String(role || '').trim();
    if (!raw) return [];
    if (raw === 'admin') return ['사장', '관리자'];
    if (raw === 'manager') return ['매니저', '매니저1', '매니저2', '매니저3'];
    if (raw === 'user' || raw === 'general') return ['일반'];
    if (raw === 'newbie') return ['신규자', '신규'];
    return [raw];
};

const isMenuAllowed = (roles: string[], aliases: Set<string>): boolean => {
    if (!roles || roles.length === 0) return true;
    return roles.flatMap((role) => expandLegacyRole(role)).some((role) => aliases.has(role));
};

const toMenuItem = (item: string | MenuItem): MenuItem => {
    if (typeof item === 'string') return { text: item, path: MENU_PATHS[item] };
    return item;
};

const collectLeafMenus = (items: Array<string | MenuItem>): MenuLeaf[] => {
    const leaves: MenuLeaf[] = [];
    items.forEach((raw) => {
        const item = toMenuItem(raw);
        if (!item.text) return;
        const children = Array.isArray(item.sub) ? item.sub : [];
        if (children.length > 0) {
            leaves.push(...collectLeafMenus(children));
            return;
        }
        leaves.push({
            text: item.text,
            roles: Array.isArray(item.roles) ? item.roles.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : []
        });
    });
    return leaves;
};

const UserManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [users, setUsers] = useState<UserData[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [menuConfig, setMenuConfig] = useState<SiteDataType | null>(null);
    const [userPositionMap, setUserPositionMap] = useState<UserMenuPositionMap>({});

    const [search, setSearch] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [workerSearch, setWorkerSearch] = useState('');
    const [linkWorkerId, setLinkWorkerId] = useState('');

    const [draftRole, setDraftRole] = useState<CanonicalSystemRole>('user');
    const [draftPosition, setDraftPosition] = useState('일반');
    const [draftAdditionalPositions, setDraftAdditionalPositions] = useState<string[]>([]);
    const [syncLinkedWorkerRole, setSyncLinkedWorkerRole] = useState(true);

    const [savingCore, setSavingCore] = useState(false);
    const [savingAdditional, setSavingAdditional] = useState(false);
    const [savingPositionRoleId, setSavingPositionRoleId] = useState('');
    const [runningAutoFix, setRunningAutoFix] = useState(false);

    const loadAll = useCallback(async () => {
        const [usersData, workersData, positionsData] = await Promise.all([
            userService.getAllUsers(),
            manpowerService.getWorkers(),
            positionService.getPositions()
        ]);
        setUsers(usersData);
        setWorkers(workersData);
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

    const ownerByWorkerId = useMemo(() => {
        const map = new Map<string, string>();
        users.forEach((user) => {
            (user.linkedWorkerIds || []).forEach((id) => {
                const key = String(id);
                map.set(key, user.uid);
                const worker = workerById.get(key);
                if (worker?.id) map.set(String(worker.id), user.uid);
                if (worker?.legacyId) map.set(String(worker.legacyId), user.uid);
            });
        });
        return map;
    }, [users, workerById]);

    const validPositionNames = useMemo(() => {
        return new Set(positions.map((position) => String(position.name).trim()).filter(Boolean));
    }, [positions]);

    const integrityRows = useMemo(() => {
        return users.map((user) => {
            const linkedWorkers = (user.linkedWorkerIds || [])
                .map((id) => workerById.get(String(id)))
                .filter((worker): worker is Worker => Boolean(worker));
            const primaryLinkedWorker = linkedWorkers[0] || null;

            const basePosition = String(user.position || '').trim();
            const linkedRole = String(primaryLinkedWorker?.role || '').trim();
            const additionalPositions = userPositionMap[user.uid] || [];
            const invalidAdditionalPositions = additionalPositions.filter((name) => !validPositionNames.has(String(name).trim()));

            const missingBasePosition = basePosition.length === 0;
            const invalidBasePosition = basePosition.length > 0 && !validPositionNames.has(basePosition);
            const mismatchWithLinkedWorker = Boolean(basePosition && linkedRole && basePosition !== linkedRole);

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
    }, [users, workerById, userPositionMap, validPositionNames]);

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
        return (selectedUser.linkedWorkerIds || []).map((id) => workerById.get(String(id))).filter((worker): worker is Worker => Boolean(worker));
    }, [selectedUser, workerById]);

    useEffect(() => {
        if (!selectedUser) return;
        setDraftRole(normalizeSystemRole(selectedUser.role));
        setDraftPosition(String(selectedUser.position || selectedLinkedWorkers[0]?.role || '일반'));
        setDraftAdditionalPositions(userPositionMap[selectedUser.uid] || []);
        setLinkWorkerId('');
    }, [selectedUser, selectedLinkedWorkers, userPositionMap]);

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

    const previewLeaves = useMemo(() => {
        const site = menuConfig?.admin;
        if (!site) return [];
        return collectLeafMenus(site.menu || []);
    }, [menuConfig]);

    const previewAliases = useMemo(() => {
        const aliases = new Set<string>();
        getPositionAliases(draftPosition).forEach((alias) => aliases.add(alias));
        draftAdditionalPositions.forEach((pos) => {
            getPositionAliases(pos).forEach((alias) => aliases.add(alias));
        });
        return aliases;
    }, [draftPosition, draftAdditionalPositions]);

    const previewSummary = useMemo(() => {
        const total = previewLeaves.length;
        const allowed = previewLeaves.filter((leaf) => isMenuAllowed(leaf.roles, previewAliases)).length;
        return { total, allowed, blocked: total - allowed };
    }, [previewLeaves, previewAliases]);

    const availableWorkers = useMemo(() => {
        if (!selectedUser) return [];
        const q = workerSearch.trim().toLowerCase();
        return workers.filter((worker) => {
            const workerId = String(worker.id || '');
            if (!workerId) return false;
            const owner = ownerByWorkerId.get(workerId);
            if (owner && owner !== selectedUser.uid) return false;
            if (!q) return true;
            return `${worker.name || ''} ${worker.idNumber || ''} ${worker.role || ''}`.toLowerCase().includes(q);
        });
    }, [workers, selectedUser, workerSearch, ownerByWorkerId]);

    const positionSummary = useMemo(() => {
        return positions.map((position) => ({
            position,
            users: users.filter((user) => String(user.position || '').trim() === position.name).length,
            extraUsers: users.filter((user) => (userPositionMap[user.uid] || []).includes(position.name)).length,
            workers: workers.filter((worker) => String(worker.role || '').trim() === position.name).length
        }));
    }, [positions, users, userPositionMap, workers]);

    const handleAutoSyncUserPositionFromLinkedWorker = async () => {
        setRunningAutoFix(true);
        try {
            let updatedCount = 0;
            for (const user of users) {
                const basePosition = String(user.position || '').trim();
                const linkedWorkers = (user.linkedWorkerIds || [])
                    .map((id) => workerById.get(String(id)))
                    .filter((worker): worker is Worker => Boolean(worker));
                const linkedRole = String(linkedWorkers[0]?.role || '').trim();
                if (!linkedRole) continue;
                if (!validPositionNames.has(linkedRole)) continue;
                if (basePosition === linkedRole) continue;

                await userService.updateUserProfile(user.uid, { position: linkedRole });
                updatedCount += 1;
            }
            await loadAll();
            Swal.fire('자동 동기화 완료', `${updatedCount}명의 기본 직책을 연동 작업자 기준으로 맞췄습니다.`, 'success');
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
                for (const linkedWorkerId of user.linkedWorkerIds || []) {
                    const linkedWorker = workerById.get(String(linkedWorkerId));
                    if (!linkedWorker?.id) continue;
                    if (String(linkedWorker.role || '').trim() === basePosition) continue;
                    await manpowerService.updateWorker(String(linkedWorker.id), { role: basePosition });
                    updatedCount += 1;
                }
            }
            await loadAll();
            Swal.fire('자동 동기화 완료', `${updatedCount}건의 연동 작업자 직책을 사용자 기본 직책으로 맞췄습니다.`, 'success');
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

    const handleSaveCore = async () => {
        if (!selectedUser) return;
        setSavingCore(true);
        try {
            await userService.updateUserRole(selectedUser.uid, draftRole);
            await userService.updateUserProfile(selectedUser.uid, { position: draftPosition });
            if (syncLinkedWorkerRole && draftPosition) {
                await Promise.all((selectedUser.linkedWorkerIds || []).map((workerId) => manpowerService.updateWorker(String(workerId), { role: draftPosition })));
            }
            await loadAll();
            Swal.fire('저장 완료', '사용자 권한과 기본 직책을 저장했습니다.', 'success');
        } catch (error) {
            console.error('[UserManagementPage] save core failed:', error);
            Swal.fire('오류', '저장에 실패했습니다.', 'error');
        } finally {
            setSavingCore(false);
        }
    };

    const handleSaveAdditional = async () => {
        if (!selectedUser) return;
        setSavingAdditional(true);
        try {
            await userMenuPositionService.setPositions(selectedUser.uid, draftAdditionalPositions);
            Swal.fire('저장 완료', '추가 직책 권한을 저장했습니다.', 'success');
        } catch (error) {
            console.error('[UserManagementPage] save additional failed:', error);
            Swal.fire('오류', '추가 직책 저장에 실패했습니다.', 'error');
        } finally {
            setSavingAdditional(false);
        }
    };

    const handleLinkWorker = async () => {
        if (!selectedUser || !linkWorkerId) return;
        try {
            await userService.linkUserToWorker(selectedUser.uid, linkWorkerId, currentUser?.email || 'system');
            setLinkWorkerId('');
            await loadAll();
            Swal.fire('완료', '작업자를 사용자에 연결했습니다.', 'success');
        } catch (error) {
            console.error('[UserManagementPage] link worker failed:', error);
            Swal.fire('오류', '작업자 연결에 실패했습니다.', 'error');
        }
    };

    const handleUnlinkWorker = async (workerId: string) => {
        if (!selectedUser) return;
        const confirm = await Swal.fire({
            title: '연동 해제',
            text: '선택한 작업자 연동을 해제하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '해제',
            cancelButtonText: '취소'
        });
        if (!confirm.isConfirmed) return;

        try {
            await userService.unlinkUserFromWorker(selectedUser.uid, workerId);
            await loadAll();
            Swal.fire('완료', '작업자 연동을 해제했습니다.', 'success');
        } catch (error) {
            console.error('[UserManagementPage] unlink worker failed:', error);
            Swal.fire('오류', '작업자 연동 해제에 실패했습니다.', 'error');
        }
    };

    const handlePositionRoleChange = async (position: Position, nextRole: UserRole) => {
        if (!position.id) return;
        setSavingPositionRoleId(position.id);
        try {
            await positionService.updatePosition(position.id, { systemRole: nextRole });
            setPositions(await positionService.getPositions());
        } catch (error) {
            console.error('[UserManagementPage] update position role failed:', error);
        } finally {
            setSavingPositionRoleId('');
        }
    };

    if (loading) {
        return <div className="p-10 text-center text-slate-500"><FontAwesomeIcon icon={faSpinner} spin className="mr-2" />로딩중...</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2"><FontAwesomeIcon icon={faUserGear} className="text-red-500" />사용자 통합 관리</h1>
                        <p className="text-sm text-slate-500 mt-1">사용자 기준으로 시스템 권한, 직책모드, 추가 직책 권한을 통합 관리합니다.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={refreshAll} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"><FontAwesomeIcon icon={refreshing ? faSpinner : faArrowsRotate} spin={refreshing} className="mr-2" />새로고침</button>
                        <button type="button" onClick={() => navigate('/admin/role-menu')} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold">권한 매트릭스</button>
                        <button type="button" onClick={() => navigate('/hr/position-management')} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold"><FontAwesomeIcon icon={faSitemap} className="mr-2" />직책 관리</button>
                    </div>
                </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
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
                            연동 작업자 직책 동기화
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
                        <div className="text-[11px] text-indigo-700">사용자-작업자 직책 불일치</div>
                        <div className="text-lg font-bold text-indigo-800">{integritySummary.mismatchWithLinkedWorker}</div>
                    </div>
                    <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
                        <div className="text-[11px] text-rose-700">잘못된 추가 직책</div>
                        <div className="text-lg font-bold text-rose-800">{integritySummary.invalidAdditional}</div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
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
                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className="text-xs font-bold text-slate-500">선택 사용자 점검</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${selectedUserIntegrity?.missingBasePosition ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {selectedUserIntegrity?.missingBasePosition ? '기본직책 미지정' : '기본직책 정상'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${selectedUserIntegrity?.mismatchWithLinkedWorker ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {selectedUserIntegrity?.mismatchWithLinkedWorker ? '작업자 직책 불일치' : '작업자 직책 일치'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${(selectedUserIntegrity?.invalidAdditionalPositions.length || 0) > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {(selectedUserIntegrity?.invalidAdditionalPositions.length || 0) > 0 ? `잘못된 추가직책 ${selectedUserIntegrity?.invalidAdditionalPositions.length}건` : '추가직책 정상'}
                                    </span>
                                </div>
                            </section>

                            <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center justify-between"><h2 className="font-extrabold text-slate-800 flex items-center gap-2"><FontAwesomeIcon icon={faShieldHalved} className="text-indigo-500" />기본 권한/직책</h2><button onClick={handleSaveCore} disabled={savingCore} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold"><FontAwesomeIcon icon={savingCore ? faSpinner : faCheck} spin={savingCore} className="mr-2" />저장</button></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <select value={draftRole} onChange={(e) => setDraftRole(e.target.value as CanonicalSystemRole)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">{SYSTEM_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.value})</option>)}</select>
                                    <select value={draftPosition} onChange={(e) => setDraftPosition(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">{positions.map((position) => <option key={position.id || position.name} value={position.name}>{position.name} ({position.systemRole})</option>)}</select>
                                </div>
                                <label className="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={syncLinkedWorkerRole} onChange={(e) => setSyncLinkedWorkerRole(e.target.checked)} className="rounded border-slate-300" />연동 작업자 직책 동기화</label>
                            </section>

                            <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center justify-between"><h2 className="font-extrabold text-slate-800 flex items-center gap-2"><FontAwesomeIcon icon={faTag} className="text-cyan-500" />추가 직책 권한</h2><button onClick={handleSaveAdditional} disabled={savingAdditional} className="px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm font-bold"><FontAwesomeIcon icon={savingAdditional ? faSpinner : faCheck} spin={savingAdditional} className="mr-2" />저장</button></div>
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

                            <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                                <h2 className="font-extrabold text-slate-800 flex items-center gap-2"><FontAwesomeIcon icon={faLink} className="text-emerald-500" />연동 작업자</h2>
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-2">
                                    <input value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} placeholder="작업자 검색" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                    <select value={linkWorkerId} onChange={(e) => setLinkWorkerId(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm"><option value="">작업자 선택</option>{availableWorkers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name} ({worker.role || '직책없음'})</option>)}</select>
                                    <button onClick={handleLinkWorker} disabled={!linkWorkerId} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">연결</button>
                                </div>
                                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                                    {selectedLinkedWorkers.length === 0 && <div className="p-3 text-sm text-slate-400">연동 작업자가 없습니다.</div>}
                                    {selectedLinkedWorkers.map((worker) => <div key={worker.id} className="p-3 flex items-center justify-between gap-2"><div><div className="font-bold text-slate-800">{worker.name}</div><div className="text-xs text-slate-500">직책: {worker.role || '-'} / 식별번호: {worker.idNumber || '-'}</div></div><button onClick={() => handleUnlinkWorker(String(worker.id))} className="px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold"><FontAwesomeIcon icon={faXmark} className="mr-1" />해제</button></div>)}
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
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50"><h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><FontAwesomeIcon icon={faUserTag} className="text-indigo-500" />직책 모드 통합 현황</h2></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500"><tr><th className="px-4 py-3 text-left">직책</th><th className="px-4 py-3 text-left">기본 사용자</th><th className="px-4 py-3 text-left">추가 배정</th><th className="px-4 py-3 text-left">작업자 수</th><th className="px-4 py-3 text-left">시스템 권한</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {positionSummary.map((row) => <tr key={row.position.id || row.position.name}><td className="px-4 py-3"><div className="font-bold text-slate-800">{row.position.name}</div><div className="text-[11px] text-slate-400">rank: {row.position.rank}</div></td><td className="px-4 py-3">{row.users}</td><td className="px-4 py-3">{row.extraUsers}</td><td className="px-4 py-3">{row.workers}</td><td className="px-4 py-3"><select value={row.position.systemRole} onChange={(e) => handlePositionRoleChange(row.position, e.target.value as UserRole)} disabled={!row.position.id || savingPositionRoleId === row.position.id} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold">{POSITION_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{savingPositionRoleId === row.position.id && <FontAwesomeIcon icon={faSpinner} spin className="ml-2 text-slate-400" />}</td></tr>)}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default UserManagementPage;
