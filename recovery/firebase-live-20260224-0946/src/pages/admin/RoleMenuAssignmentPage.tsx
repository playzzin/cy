
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSave, faCheck, faChevronRight, faChevronDown, faUserShield, faRotate,
    faUsers, faTag, faTimes, faSearch, faUserCog
} from '@fortawesome/free-solid-svg-icons';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { positionService } from '../../services/positionService';
import { userService, UserData } from '../../services/userService';
import { userMenuPositionService } from '../../services/userMenuPositionService';
import { MenuItem, SiteDataType } from '../../types/menu';
import Swal from 'sweetalert2';

interface RoleOption {
    id: string;
    label: string;
    type: 'custom';
    color: string;
}

const COLOR_MAP: Record<string, string> = {
    gray: '#9ca3af', purple: '#a855f7', orange: '#f97316', yellow: '#eab308',
    blue: '#3b82f6', green: '#22c55e', slate: '#94a3b8', red: '#ef4444', cyan: '#06b6d4', pink: '#ec4899'
};

const RoleMenuAssignmentPage: React.FC = () => {
    // Tab
    const [activeTab, setActiveTab] = useState<'position' | 'user'>('position');

    // Position tab state
    const [allMenuData, setAllMenuData] = useState<SiteDataType | null>(null);
    const [siteKeys, setSiteKeys] = useState<string[]>([]);
    const [selectedSite, setSelectedSite] = useState<string>('admin');
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [isModified, setIsModified] = useState(false);

    // User tab state
    const [allUsers, setAllUsers] = useState<UserData[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [userPositionMap, setUserPositionMap] = useState<{ [uid: string]: string[] }>({});
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [savingUserPositions, setSavingUserPositions] = useState(false);

    // Load data
    useEffect(() => {
        const unsubscribeMenu = menuServiceV11.subscribe((data) => {
            setAllMenuData(data);
            setSiteKeys(Object.keys(data));
        });

        const loadPositions = async () => {
            try {
                const positions = await positionService.getPositions();
                const customRoles: RoleOption[] = positions.map(pos => ({
                    id: pos.name, label: pos.name, type: 'custom', color: pos.color
                }));
                setRoles(customRoles);
                if (!selectedRole) {
                    setSelectedRole(customRoles.find(r => r.id === '일반')?.id || customRoles[0]?.id || '일반');
                }
            } catch (e) {
                console.error("Failed to load positions", e);
            }
        };
        loadPositions();

        userService.getAllUsers().then(users => {
            setAllUsers(users.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')));
        });
        const unsubUserPos = userMenuPositionService.subscribe(data => setUserPositionMap(data));

        return () => { unsubscribeMenu(); unsubUserPos(); };
    }, []);

    // === Position Tab ===
    const handleTogglePermission = (item: MenuItem, roleId: string) => {
        if (!allMenuData) return;
        const currentRoles = item.roles || [];
        const hasRole = currentRoles.includes(roleId);
        const newRoles = hasRole ? currentRoles.filter(r => r !== roleId) : [...currentRoles, roleId];

        const updateRecursive = (items: MenuItem[]): MenuItem[] => items.map(i => {
            if (i.id === item.id) return { ...i, roles: newRoles };
            if (i.sub && i.sub.length > 0) return { ...i, sub: updateRecursive(i.sub as MenuItem[]) };
            return i;
        });

        setAllMenuData({ ...allMenuData, [selectedSite]: { ...allMenuData[selectedSite], menu: updateRecursive(allMenuData[selectedSite].menu) } });
        setIsModified(true);
    };

    const handleSave = async () => {
        if (!allMenuData) return;
        setLoading(true);
        try {
            await menuServiceV11.saveMenuConfig(allMenuData);
            setIsModified(false);
            Swal.fire("저장 완료", "메뉴 권한 설정이 저장되었습니다.", "success");
        } catch (error) {
            console.error(error);
            Swal.fire("저장 실패", "메뉴 권한 저장 중 오류가 발생했습니다.", "error");
        }
        setLoading(false);
    };

    const toggleExpand = (id: string) => {
        setExpandedItems(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };

    const renderTree = (items: MenuItem[], depth = 0) => items.map(item => {
        const hasSub = item.sub && item.sub.length > 0;
        const isAssigned = item.roles?.includes(selectedRole);
        const isGlobal = !item.roles || item.roles.length === 0;
        const isChecked = isAssigned || isGlobal;

        return (
            <div key={item.id} className="mb-1">
                <div className={`flex items-center p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors ${isChecked ? 'bg-indigo-50/30' : 'opacity-60'}`}
                    style={{ paddingLeft: `${depth * 24 + 8}px` }}>
                    <button onClick={() => hasSub && toggleExpand(item.id!)}
                        className={`w-6 h-6 flex items-center justify-center mr-2 text-slate-400 ${hasSub ? 'hover:text-indigo-600' : 'opacity-0 cursor-default'}`}>
                        <FontAwesomeIcon icon={expandedItems.has(item.id!) ? faChevronDown : faChevronRight} size="xs" />
                    </button>
                    <div className="flex-1 flex items-center gap-3">
                        <input type="checkbox" checked={!!isAssigned} onChange={() => handleTogglePermission(item, selectedRole)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                        <span className={`text-sm font-medium ${isChecked ? 'text-slate-800' : 'text-slate-400'}`}>{item.text}</span>
                        {isGlobal && <span className="ml-auto text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">전체 공개</span>}
                        {!isGlobal && isAssigned && <span className="ml-auto text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold">허용됨</span>}
                        {!isGlobal && !isAssigned && <span className="ml-auto text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">제한됨</span>}
                    </div>
                </div>
                {hasSub && <div className="border-l border-slate-100 ml-5">{renderTree(item.sub as MenuItem[], depth + 1)}</div>}
            </div>
        );
    });

    // === User Tab ===
    const handleToggleUserPosition = async (uid: string, positionName: string) => {
        setSavingUserPositions(true);
        try {
            const current = userPositionMap[uid] || [];
            if (current.includes(positionName)) {
                await userMenuPositionService.removePosition(uid, positionName);
            } else {
                await userMenuPositionService.addPosition(uid, positionName);
            }
        } catch (error) {
            console.error('Failed to update user position:', error);
            Swal.fire('오류', '직책 변경에 실패했습니다.', 'error');
        }
        setSavingUserPositions(false);
    };

    const filteredUsers = allUsers.filter(u => {
        if (!userSearchQuery.trim()) return true;
        const q = userSearchQuery.toLowerCase();
        return (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.position || '').toLowerCase().includes(q);
    });

    if (!allMenuData) return <div className="p-10 flex justify-center"><FontAwesomeIcon icon={faRotate} spin className="text-3xl text-indigo-300" /></div>;

    const currentRoleLabel = roles.find(r => r.id === selectedRole)?.label || selectedRole;

    return (
        <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <span className="p-2 bg-yellow-400/20 rounded-lg text-yellow-600"><FontAwesomeIcon icon={faUserShield} /></span>
                        메뉴 권한 관리
                    </h1>
                    <p className="text-slate-500 mt-1">직책별 메뉴 권한과 유저별 추가 직책을 관리합니다.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 rounded-xl p-1">
                        <button onClick={() => setActiveTab('position')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'position' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <FontAwesomeIcon icon={faUserShield} /> 직책별 권한
                        </button>
                        <button onClick={() => setActiveTab('user')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'user' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <FontAwesomeIcon icon={faUsers} /> 유저별 직책
                        </button>
                    </div>
                    {activeTab === 'position' && (
                        <button onClick={handleSave} disabled={!isModified}
                            className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all ${isModified ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 cursor-not-allowed'}`}>
                            <FontAwesomeIcon icon={faSave} /> 설정 저장
                        </button>
                    )}
                </div>
            </div>

            {/* === Position Tab === */}
            {activeTab === 'position' && (
                <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                    <div className="col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700">직책 선택</div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {roles.map(role => (
                                <button key={role.id} onClick={() => setSelectedRole(role.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${selectedRole === role.id ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20' : 'hover:bg-slate-50 text-slate-600'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_MAP[role.color] || '#9ca3af' }}></div>
                                        <span className="font-medium">{role.label}</span>
                                    </div>
                                    {selectedRole === role.id && <FontAwesomeIcon icon={faCheck} />}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="col-span-9 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <h2 className="font-bold text-slate-700"><span className="text-indigo-600">[{currentRoleLabel}]</span> 메뉴 접근 권한</h2>
                                <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">체크 시 해당 직책 접근 가능</span>
                            </div>
                            <select value={selectedSite} onChange={e => setSelectedSite(e.target.value)}
                                className="bg-white border border-slate-300 text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500">
                                {Object.keys(allMenuData).map(k => <option key={k} value={k}>{allMenuData[k].name}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">{renderTree(allMenuData[selectedSite].menu)}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* === User Tab === */}
            {activeTab === 'user' && (
                <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                    {/* Left: User List */}
                    <div className="col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                            <div className="font-bold text-slate-700 mb-2 flex items-center justify-between">
                                <span>유저 목록</span>
                                <span className="text-xs font-normal text-slate-400">{allUsers.length}명</span>
                            </div>
                            <div className="relative">
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                <input className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="이름, 이메일, 직책 검색..." value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {filteredUsers.map(user => {
                                const additionalCount = (userPositionMap[user.uid] || []).length;
                                return (
                                    <button key={user.uid} onClick={() => setSelectedUserId(user.uid)}
                                        className={`w-full text-left px-4 py-3 rounded-xl transition-all ${selectedUserId === user.uid ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20' : 'hover:bg-slate-50 text-slate-600'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-sm truncate">{user.displayName || '(이름 없음)'}</div>
                                                <div className="text-xs text-slate-400 truncate">{user.email}</div>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-none ml-2">
                                                {user.position && <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold">{user.position}</span>}
                                                {additionalCount > 0 && <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-bold">+{additionalCount}</span>}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <div className="p-6 text-center text-slate-400 text-sm">{userSearchQuery ? '검색 결과가 없습니다' : '등록된 유저가 없습니다'}</div>
                            )}
                        </div>
                    </div>

                    {/* Right: Position Assignment */}
                    <div className="col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        {selectedUserId ? (() => {
                            const selectedUser = allUsers.find(u => u.uid === selectedUserId);
                            const userAdditionalPositions = userPositionMap[selectedUserId] || [];
                            if (!selectedUser) return <div className="flex-1 flex items-center justify-center text-slate-400">유저를 찾을 수 없습니다</div>;
                            return (<>
                                <div className="p-4 bg-slate-50 border-b border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="font-bold text-slate-700">
                                                <span className="text-indigo-600">{selectedUser.displayName || selectedUser.email}</span>
                                                <span className="text-slate-500 font-normal"> 의 추가 직책</span>
                                            </h2>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                기본 직책: <span className="font-bold text-slate-600">{selectedUser.position || '(미지정)'}</span>
                                                {userAdditionalPositions.length > 0 && <> · 추가: <span className="font-bold text-indigo-600">{userAdditionalPositions.length}개</span></>}
                                            </p>
                                        </div>
                                        {savingUserPositions && <FontAwesomeIcon icon={faRotate} spin className="text-indigo-500" />}
                                    </div>
                                    {userAdditionalPositions.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {userAdditionalPositions.map(pos => (
                                                <span key={pos} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                                                    <FontAwesomeIcon icon={faTag} className="text-[9px]" /> {pos}
                                                    <button onClick={() => handleToggleUserPosition(selectedUserId, pos)} className="ml-0.5 hover:text-red-500 transition-colors">
                                                        <FontAwesomeIcon icon={faTimes} className="text-[9px]" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-6">
                                    <p className="text-xs text-slate-400 mb-4">아래 직책을 클릭하면 이 유저에게 해당 직책의 메뉴 권한이 추가됩니다. 기본 직책의 메뉴는 자동 포함됩니다.</p>
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                        {roles.map(role => {
                                            const isBase = selectedUser.position === role.id;
                                            const isAdditional = userAdditionalPositions.includes(role.id);
                                            return (
                                                <button key={role.id}
                                                    onClick={() => !isBase && handleToggleUserPosition(selectedUserId, role.id)}
                                                    disabled={isBase || savingUserPositions}
                                                    className={`p-4 rounded-xl border-2 transition-all text-left ${isBase ? 'border-green-300 bg-green-50 cursor-default' : isAdditional ? 'border-indigo-400 bg-indigo-50 hover:border-indigo-500' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`font-bold text-sm ${isBase ? 'text-green-700' : isAdditional ? 'text-indigo-700' : 'text-slate-700'}`}>{role.label}</span>
                                                        {isBase && <span className="text-[10px] px-2 py-0.5 bg-green-200 text-green-800 rounded-full font-bold">기본</span>}
                                                        {isAdditional && <span className="text-[10px] px-2 py-0.5 bg-indigo-200 text-indigo-800 rounded-full font-bold">추가</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_MAP[role.color] || '#9ca3af' }}></div>
                                                        <span className="text-[11px] text-slate-400">직책</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>);
                        })() : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6">
                                <FontAwesomeIcon icon={faUserCog} className="text-4xl mb-3 text-slate-300" />
                                <p className="text-sm font-medium">왼쪽에서 유저를 선택하세요</p>
                                <p className="text-xs mt-1">선택한 유저에게 추가 직책을 배정할 수 있습니다</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleMenuAssignmentPage;
