
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldHalved, faSave, faCheck, faFolder, faFile, faChevronRight, faChevronDown, faUserShield, faRotate } from '@fortawesome/free-solid-svg-icons';
import { menuServiceV11 } from '../../services/menuServiceV11';
import { positionService } from '../../services/positionService';
import { MenuItem, SiteDataType } from '../../types/menu';
import Swal from 'sweetalert2';

// Combined Role Type
interface RoleOption {
    id: string;
    label: string;
    type: 'system' | 'custom';
    color: string;
}

const SYSTEM_ROLES: RoleOption[] = [
    { id: 'admin', label: '관리자 (System Admin)', type: 'system', color: 'red' },
    { id: 'manager', label: '매니저 (System Manager)', type: 'system', color: 'orange' },
    { id: 'user', label: '일반 (System User)', type: 'system', color: 'gray' },
];

const RoleMenuAssignmentPage: React.FC = () => {
    const [allMenuData, setAllMenuData] = useState<SiteDataType | null>(null);
    const [siteKeys, setSiteKeys] = useState<string[]>([]);
    const [selectedSite, setSelectedSite] = useState<string>('admin');

    // Roles
    const [roles, setRoles] = useState<RoleOption[]>(SYSTEM_ROLES);
    const [selectedRole, setSelectedRole] = useState<string>('manager');

    const [loading, setLoading] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [isModified, setIsModified] = useState(false);

    // Initial Load
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Load Menus
                const menuData = await menuServiceV11.getMenuConfig(); // Assuming get method exists or we subscribe
                // For simplicity, using subscribe once or if available
            } catch (error) {
                console.error("Failed to load data", error);
            }
            setLoading(false);
        };

        // Subscribe to Menu Updates
        const unsubscribeMenu = menuServiceV11.subscribe((data) => {
            setAllMenuData(data);
            setSiteKeys(Object.keys(data));
        });

        // Load Positions (Custom Roles)
        const loadPositions = async () => {
            try {
                const positions = await positionService.getPositions();
                const customRoles: RoleOption[] = positions.map(pos => ({
                    id: pos.name, // Using Name as ID for role check as per standard
                    label: pos.name,
                    type: 'custom',
                    color: pos.color
                }));
                // Merge System Roles + Custom Roles
                // Filter out duplicates if any
                const uniqueRoles = [...SYSTEM_ROLES];
                customRoles.forEach(cRole => {
                    if (!uniqueRoles.find(r => r.id === cRole.id)) {
                        uniqueRoles.push(cRole);
                    }
                });
                setRoles(uniqueRoles);
            } catch (e) {
                console.error("Failed to load positions", e);
            }
        };
        loadPositions();

        return () => unsubscribeMenu();
    }, []);

    // Helper: Toggle Checkbox
    const handleTogglePermission = (item: MenuItem, roleId: string) => {
        if (!allMenuData) return;

        const currentRoles = item.roles || [];
        const hasRole = currentRoles.includes(roleId);

        let newRoles: string[];
        if (hasRole) {
            newRoles = currentRoles.filter(r => r !== roleId);
        } else {
            newRoles = [...currentRoles, roleId];
        }

        // Recursively update function
        const updateRecursive = (items: MenuItem[]): MenuItem[] => {
            return items.map(i => {
                if (i.id === item.id) {
                    return { ...i, roles: newRoles };
                }
                if (i.sub && i.sub.length > 0) {
                    // Logic: If checking parent, should we auto-check children?
                    // Optional: For now, strict individual check or simpler UX?
                    // UX Decision: Manual control is safer for granular.
                    // But if UNCHECKING parent, children effectively become invisible.
                    return { ...i, sub: updateRecursive(i.sub as MenuItem[]) };
                }
                return i;
            });
        };

        const updatedMenu = updateRecursive(allMenuData[selectedSite].menu);

        setAllMenuData({
            ...allMenuData,
            [selectedSite]: {
                ...allMenuData[selectedSite],
                menu: updatedMenu
            }
        });
        setIsModified(true);
    };

    // Helper: Toggle All for Role
    // (Optional feature)

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
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const renderTree = (items: MenuItem[], depth = 0) => {
        return items.map(item => {
            const hasSub = item.sub && item.sub.length > 0;
            const isAssigned = item.roles?.includes(selectedRole);

            // Default: If item.roles is undefined or empty, is it Visible or Hidden?
            // "Empty means Visible to All" usually.
            // But here we want to explicit control.
            // UX: If role list is empty, it is visible to everyone (including this role).
            // So we should show it as "Implicitly Checked" or differentiate?
            // Let's adopt Logic: Empty = Visible to All.
            // So checkbox should be checked if (roles is empty) OR (roles includes selectedRole).
            // BUT, if user wants to HIDE it from this role, they must populate roles with OTHERS but not this one.
            // This logic is tricky.
            // Simpler Logic for this page:
            // "Explicit Mode": If item.roles is set, only those see it. If empty, all see it.
            // Representation:
            // - Checked: Explicitly in list.
            // - Unchecked: Not in list.
            // - Indeterminate: Empty List (Visible to All).

            const isGlobal = !item.roles || item.roles.length === 0;
            const isChecked = isAssigned || isGlobal;

            return (
                <div key={item.id} className="mb-1">
                    <div
                        className={`flex items-center p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors ${isChecked ? 'bg-indigo-50/30' : 'opacity-60'}`}
                        style={{ paddingLeft: `${depth * 24 + 8}px` }}
                    >
                        <button
                            onClick={() => hasSub && toggleExpand(item.id!)}
                            className={`w-6 h-6 flex items-center justify-center mr-2 text-slate-400 ${hasSub ? 'hover:text-indigo-600' : 'opacity-0 cursor-default'}`}
                        >
                            <FontAwesomeIcon icon={expandedItems.has(item.id!) ? faChevronDown : faChevronRight} size="xs" />
                        </button>

                        <div className="flex-1 flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={!!isAssigned} // Strict Check: Only check if explicitly assigned? No, that's confusing.
                                // Let's use tri-state logic visually or just strict checking?
                                // If I want to "Assign" -> I check it. `roles` becomes ['manager']. 'user' lost it.
                                // If I want "Everyone" -> I need a "Reset to All" button or clear all roles.
                                // Let's simplistic approach: Checkbox controls presence in `roles`.
                                // If `roles` becomes empty, it implies Global.
                                // Problem: How to verify "Global"?
                                // Solution: Show a badge "전체 공개" if empty.
                                onChange={() => handleTogglePermission(item, selectedRole)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />

                            <div className="flex flex-col">
                                <span className={`text-sm font-medium ${isChecked ? 'text-slate-800' : 'text-slate-400'}`}>
                                    {item.text}
                                </span>
                            </div>

                            {isGlobal && (
                                <span className="ml-auto text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">
                                    전체 공개 (기본)
                                </span>
                            )}
                            {!isGlobal && isAssigned && (
                                <span className="ml-auto text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold">
                                    허용됨
                                </span>
                            )}
                            {!isGlobal && !isAssigned && (
                                <span className="ml-auto text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    제한됨
                                </span>
                            )}
                        </div>
                    </div>

                    {hasSub && (expandedItems.has(item.id!) || true) && ( // Default expanded or controlled? Let's default expand active
                        <div className="border-l border-slate-100 ml-5">
                            {renderTree(item.sub as MenuItem[], depth + 1)}
                        </div>
                    )}
                </div>
            );
        });
    };

    if (!allMenuData) return <div className="p-10 flex justify-center"><FontAwesomeIcon icon={faRotate} spin className="text-3xl text-indigo-300" /></div>;

    const currentRoleLabel = roles.find(r => r.id === selectedRole)?.label || selectedRole;

    return (
        <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-100px)] flex flex-col">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <span className="p-2 bg-yellow-400/20 rounded-lg text-yellow-600">
                            <FontAwesomeIcon icon={faUserShield} />
                        </span>
                        직책별 메뉴 권한 설정
                    </h1>
                    <p className="text-slate-500 mt-1">특정 직책에게만 메뉴를 보이거나 숨길 수 있습니다.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={!isModified}
                    className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 ${isModified ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 cursor-not-allowed'}`}
                >
                    <FontAwesomeIcon icon={faSave} />
                    설정 저장
                </button>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Left: Role Selection */}
                <div className="col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700">
                        직책 선택
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {roles.map(role => (
                            <button
                                key={role.id}
                                onClick={() => setSelectedRole(role.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${selectedRole === role.id ? `bg-${role.color}-50 text-${role.color}-700 ring-2 ring-${role.color}-500/20` : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full bg-${role.color}-500`}></div>
                                    <span className="font-medium">{role.label}</span>
                                </div>
                                {selectedRole === role.id && <FontAwesomeIcon icon={faCheck} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Menu Tree */}
                <div className="col-span-9 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h2 className="font-bold text-slate-700 flex items-center gap-2">
                                <span className="text-indigo-600">[{currentRoleLabel}]</span> 메뉴 접근 권한
                            </h2>
                            <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
                                체크 시 해당 직책 접근 가능 (미체크 시 전체공개 상태가 아니라면 제한됨)
                            </span>
                        </div>
                        <select
                            value={selectedSite}
                            onChange={(e) => setSelectedSite(e.target.value)}
                            className="bg-white border border-slate-300 text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500"
                        >
                            {allMenuData && Object.keys(allMenuData).map(k => (
                                <option key={k} value={k}>{allMenuData[k].name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            {allMenuData && renderTree(allMenuData[selectedSite].menu)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleMenuAssignmentPage;
