import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronDown,
    faChevronRight,
    faCheck,
    faEye,
    faEyeSlash,
    faGlobe,
    faLock,
    faRotate,
    faSave,
    faSitemap,
    faUserGear,
    faUserShield,
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { positionService } from '../../services/positionService';
import { MenuItem, SiteDataType } from '../../types/menu';
import { PermissionMatrixPanel } from '../../components/admin/PermissionMatrixPanel';
import { SecurityPolicyPanel } from '../../components/admin/SecurityPolicyPanel';
import { buildPermissionMatrix } from '../../features/permission-matrix/permissionMatrix';

interface RoleOption {
    id: string;
    label: string;
    type: 'custom';
    color: string;
}

const COLOR_MAP: Record<string, string> = {
    gray: '#9ca3af',
    purple: '#a855f7',
    orange: '#f97316',
    yellow: '#eab308',
    blue: '#3b82f6',
    green: '#22c55e',
    slate: '#94a3b8',
    red: '#ef4444',
    cyan: '#06b6d4',
    pink: '#ec4899',
};

const normalizeRoleList = (roles?: string[]): string[] => (
    Array.from(new Set((roles || []).map((role) => String(role).trim()).filter(Boolean)))
);

const isMenuObject = (value: string | MenuItem): value is MenuItem => (
    typeof value === 'object' && value !== null && typeof value.text === 'string'
);

const getMenuKey = (item: MenuItem, depth: number, index: number): string => (
    item.id || item.path || `${depth}:${index}:${item.text}`
);

const collectExpandableIds = (items: Array<string | MenuItem>, depth = 0): string[] => {
    const ids: string[] = [];

    items.forEach((entry, index) => {
        if (!isMenuObject(entry) || !entry.sub || entry.sub.length === 0) return;
        ids.push(getMenuKey(entry, depth, index));
        ids.push(...collectExpandableIds(entry.sub, depth + 1));
    });

    return ids;
};

const RoleMenuAssignmentPage: React.FC = () => {
    const navigate = useNavigate();
    const [allMenuData, setAllMenuData] = useState<SiteDataType | null>(null);
    const [selectedSite, setSelectedSite] = useState<string>('admin');
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [isModified, setIsModified] = useState(false);
    const [showReview, setShowReview] = useState(false);

    useEffect(() => {
        const unsubscribeMenu = menuServiceV11.subscribe((data) => {
            setAllMenuData(data);
            setSelectedSite((current) => data[current] ? current : Object.keys(data)[0] || 'admin');
        });

        const loadPositions = async () => {
            try {
                const positions = await positionService.getPositions();
                const customRoles: RoleOption[] = positions.map((position) => ({
                    id: position.name,
                    label: position.name,
                    type: 'custom',
                    color: position.color,
                }));

                setRoles(customRoles);
                setSelectedRole((current) => {
                    if (current && customRoles.some((role) => role.id === current)) return current;
                    return customRoles.find((role) => role.id === '일반')?.id || customRoles[0]?.id || '';
                });
            } catch (error) {
                console.error('[RoleMenuAssignmentPage] Failed to load positions:', error);
            }
        };

        void loadPositions();

        return () => {
            unsubscribeMenu();
        };
    }, []);

    const siteOptions = useMemo(() => Object.keys(allMenuData || {}), [allMenuData]);
    const currentSiteData = allMenuData?.[selectedSite] || null;
    const roleIds = useMemo(() => roles.map((role) => role.id).filter(Boolean), [roles]);
    const currentRoleLabel = roles.find((role) => role.id === selectedRole)?.label || selectedRole;

    const matrix = useMemo(
        () => buildPermissionMatrix(allMenuData, roles, { selectedSite }),
        [allMenuData, roles, selectedSite]
    );
    const selectedRoleSummary = matrix.roleSummaries.find((summary) => summary.roleId === selectedRole);

    const normalizeNextRoles = (currentRoles: string[] | undefined, roleId: string, nextAllowed: boolean): string[] => {
        const current = normalizeRoleList(currentRoles);
        const knownRoleSet = new Set(roleIds);

        if (current.length === 0) {
            if (nextAllowed) return [];
            return roleIds.filter((id) => id !== roleId);
        }

        const next = normalizeRoleList(
            nextAllowed
                ? [...current, roleId]
                : current.filter((role) => role !== roleId)
        );

        const known = next.filter((role) => knownRoleSet.has(role));
        const unknown = next.filter((role) => !knownRoleSet.has(role));

        if (known.length === roleIds.length && unknown.length === 0) {
            return [];
        }

        if (!nextAllowed && next.length === 0) {
            return roleIds.length > 1 ? roleIds.filter((id) => id !== roleId) : current;
        }

        return [
            ...roleIds.filter((id) => known.includes(id)),
            ...unknown,
        ];
    };

    const handleTogglePermission = (item: MenuItem, roleId: string, nextAllowed: boolean) => {
        if (!allMenuData || !currentSiteData || !roleId) return;
        const nextRoles = normalizeNextRoles(item.roles, roleId, nextAllowed);

        const updateRecursive = (items: Array<string | MenuItem>): Array<string | MenuItem> => items.map((entry) => {
            if (!isMenuObject(entry)) return entry;

            if (entry.id === item.id && item.id) {
                return { ...entry, roles: nextRoles };
            }

            const sameFallbackItem = !item.id && entry.text === item.text && entry.path === item.path;
            if (sameFallbackItem) {
                return { ...entry, roles: nextRoles };
            }

            if (entry.sub && entry.sub.length > 0) {
                return { ...entry, sub: updateRecursive(entry.sub) };
            }

            return entry;
        });

        setAllMenuData({
            ...allMenuData,
            [selectedSite]: {
                ...currentSiteData,
                menu: updateRecursive(currentSiteData.menu) as MenuItem[],
            },
        });
        setIsModified(true);
    };

    const handleSave = async () => {
        if (!allMenuData) return;
        setSaving(true);

        try {
            await menuServiceV11.saveMenuConfig(allMenuData);
            setIsModified(false);
            Swal.fire('저장 완료', '직책별 메뉴 권한이 저장되었습니다.', 'success');
        } catch (error) {
            console.error('[RoleMenuAssignmentPage] save failed:', error);
            Swal.fire('저장 실패', '메뉴 권한 저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedItems((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () => {
        if (!currentSiteData) return;
        setExpandedItems(new Set(collectExpandableIds(currentSiteData.menu)));
    };

    const collapseAll = () => {
        setExpandedItems(new Set());
    };

    const renderTree = (items: Array<string | MenuItem>, depth = 0) => items.map((entry, index) => {
        if (!isMenuObject(entry)) {
            return (
                <div
                    key={`${depth}:${index}:${entry}`}
                    className="mb-1 flex items-center rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm text-slate-500"
                    style={{ paddingLeft: `${depth * 24 + 16}px` }}
                >
                    <span className="font-medium">{entry}</span>
                    <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">전체 공개</span>
                </div>
            );
        }

        const key = getMenuKey(entry, depth, index);
        const hasSub = Array.isArray(entry.sub) && entry.sub.length > 0;
        const currentRoles = normalizeRoleList(entry.roles);
        const isGlobal = currentRoles.length === 0;
        const isAssigned = currentRoles.includes(selectedRole);
        const isChecked = isGlobal || isAssigned;
        const allowedLabel = isGlobal ? '전체 공개' : currentRoles.length > 0 ? `${currentRoles.length}개 직책 허용` : '허용 직책 없음';

        return (
            <div key={key} className="mb-1">
                <div
                    className={`flex items-center rounded-lg border p-2 transition-colors ${
                        isChecked ? 'border-indigo-100 bg-indigo-50/40' : 'border-slate-100 bg-white opacity-70 hover:opacity-100'
                    }`}
                    style={{ paddingLeft: `${depth * 24 + 8}px` }}
                >
                    <button
                        type="button"
                        onClick={() => hasSub && toggleExpand(key)}
                        className={`mr-2 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 ${hasSub ? 'hover:bg-white hover:text-indigo-600' : 'invisible'}`}
                        aria-label={expandedItems.has(key) ? '하위 메뉴 접기' : '하위 메뉴 펼치기'}
                    >
                        <FontAwesomeIcon icon={expandedItems.has(key) ? faChevronDown : faChevronRight} size="xs" />
                    </button>

                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(event) => handleTogglePermission(entry, selectedRole, event.target.checked)}
                            disabled={!selectedRole}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className={`truncate text-sm font-bold ${isChecked ? 'text-slate-800' : 'text-slate-500'}`}>{entry.text}</span>
                    </label>

                    <span className={`ml-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        isGlobal ? 'bg-emerald-100 text-emerald-700' : isAssigned ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                        <FontAwesomeIcon icon={isGlobal ? faGlobe : isAssigned ? faCheck : faLock} />
                        {allowedLabel}
                    </span>
                </div>

                {hasSub && expandedItems.has(key) && (
                    <div className="ml-5 border-l border-slate-100 pl-2">
                        {renderTree(entry.sub || [], depth + 1)}
                    </div>
                )}
            </div>
        );
    });

    if (!allMenuData || !currentSiteData) {
        return (
            <div className="flex p-10 justify-center text-indigo-300">
                <FontAwesomeIcon icon={faRotate} spin className="text-3xl" />
            </div>
        );
    }

    return (
        <div className="mx-auto flex h-[calc(100vh-100px)] max-w-[1600px] flex-col p-6">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="flex items-center gap-3 text-2xl font-extrabold text-slate-800">
                        <span className="rounded-lg bg-yellow-100 p-2 text-yellow-600"><FontAwesomeIcon icon={faUserShield} /></span>
                        메뉴 권한 관리
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">직책별 메뉴 접근만 관리합니다. 사용자별 추가 직책은 사용자 통합 관리에서 처리합니다.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/user-management')}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faUserGear} />
                        사용자 권한 관리
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowReview((value) => !value)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={showReview ? faEyeSlash : faEye} />
                        {showReview ? '검토 숨기기' : '검토 보기'}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!isModified || saving}
                        className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition-colors ${
                            isModified ? 'bg-indigo-600 hover:bg-indigo-700' : 'cursor-not-allowed bg-slate-300'
                        }`}
                    >
                        <FontAwesomeIcon icon={saving ? faRotate : faSave} spin={saving} />
                        설정 저장
                    </button>
                </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <div className="text-[11px] font-bold text-slate-400">전체 메뉴</div>
                    <div className="mt-1 text-xl font-extrabold text-slate-900">{matrix.rows.length}</div>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <div className="text-[11px] font-bold text-emerald-700">전체 공개</div>
                    <div className="mt-1 text-xl font-extrabold text-emerald-900">{matrix.globalCount}</div>
                </div>
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <div className="text-[11px] font-bold text-indigo-700">선택 직책 접근</div>
                    <div className="mt-1 text-xl font-extrabold text-indigo-900">{selectedRoleSummary?.allowedCount ?? 0}</div>
                </div>
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3">
                    <div className="text-[11px] font-bold text-rose-700">선택 직책 제한</div>
                    <div className="mt-1 text-xl font-extrabold text-rose-900">{selectedRoleSummary?.restrictedCount ?? 0}</div>
                </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-12">
                <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-3">
                    <div className="border-b border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center gap-2 font-extrabold text-slate-700">
                            <FontAwesomeIcon icon={faSitemap} className="text-indigo-500" />
                            직책 선택
                        </div>
                        <p className="mt-1 text-xs text-slate-400">직책을 고른 뒤 오른쪽 메뉴 접근을 체크합니다.</p>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        {roles.map((role) => {
                            const summary = matrix.roleSummaries.find((item) => item.roleId === role.id);
                            const selected = selectedRole === role.id;

                            return (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => setSelectedRole(role.id)}
                                    className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition-colors ${
                                        selected ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="flex min-w-0 items-center gap-3">
                                        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: COLOR_MAP[role.color] || '#9ca3af' }} />
                                        <span className="truncate text-sm font-bold">{role.label}</span>
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-400">{summary?.coverageRate ?? 0}%</span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <main className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-9">
                    <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="font-extrabold text-slate-800">
                                <span className="text-indigo-600">[{currentRoleLabel}]</span> 메뉴 접근 권한
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">전체 공개 메뉴를 해제하면 현재 직책만 제외한 제한 메뉴로 자동 전환됩니다.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={expandAll} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">전체 펼치기</button>
                            <button type="button" onClick={collapseAll} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">전체 접기</button>
                            <select
                                value={selectedSite}
                                onChange={(event) => setSelectedSite(event.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500"
                            >
                                {siteOptions.map((siteKey) => <option key={siteKey} value={siteKey}>{allMenuData[siteKey].name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-5">
                        {showReview && (
                            <div className="mb-5">
                                <SecurityPolicyPanel roles={roles} selectedRole={selectedRole} />
                                <PermissionMatrixPanel menuData={allMenuData} roles={roles} selectedSite={selectedSite} />
                            </div>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            {currentSiteData.menu.length > 0 ? (
                                renderTree(currentSiteData.menu)
                            ) : (
                                <div className="p-10 text-center text-sm text-slate-400">등록된 메뉴가 없습니다.</div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default RoleMenuAssignmentPage;
