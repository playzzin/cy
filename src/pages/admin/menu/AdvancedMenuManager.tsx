import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    closestCenter
} from '@dnd-kit/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCube,
    faUndo,
    faRedo,
    faSave,
    faCheckCircle,
    faExclamationTriangle,
    faRotateRight,
    faUsers,
    faGlobe,
    faArrowRight,
    faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { arrayMove } from '@dnd-kit/sortable';

import { menuServiceV11, SiteDataType, MenuItem } from '../../../services/menuServiceV11';
import { DEFAULT_MENU_CONFIG } from '../../../constants/defaultMenu';
import ToolboxPanel from './components/ToolboxPanel';
import SortableTreeCanvas from './components/SortableTreeCanvas';
import InspectorPanel from './components/InspectorPanel';
import RoleManager from './components/RoleManager';
import SiteManager from './components/SiteManager';
import MenuManagerHeader from './components/MenuManagerHeader';

// --- Recursive Helpers ---

const findRef = (nodes: (MenuItem | string)[], id: string, parent: MenuItem | null = null): { parent: MenuItem | null, list: (MenuItem | string)[], index: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
        const item = nodes[i];
        const itemId = typeof item === 'string' ? item : (item.id || item.text);
        if (itemId === id) return { parent, list: nodes, index: i };

        if (typeof item !== 'string' && item.sub) {
            const found = findRef(item.sub, id, item);
            if (found) return found;
        }
    }
    return null;
};

const findMenuItemInTree = (nodes: (MenuItem | string)[], id: string | null): MenuItem | null => {
    if (!id) return null;
    for (const item of nodes) {
        if (typeof item === 'string') {
            if (item === id) return { text: item } as MenuItem; // Approximate for string items
        } else {
            if (item.id === id) return item;
            if (item.sub) {
                const found = findMenuItemInTree(item.sub, id);
                if (found) return found;
            }
        }
    }
    return null;
};

const updateMenuItemInTree = (nodes: (MenuItem | string)[], updatedItem: MenuItem): (MenuItem | string)[] => {
    return nodes.map(item => {
        if (typeof item === 'string') {
            return item;
        }

        if (item.id === updatedItem.id) {
            return updatedItem;
        }

        if (item.sub) {
            return {
                ...item,
                sub: updateMenuItemInTree(item.sub, updatedItem)
            };
        }

        return item;
    });
};

const AdvancedMenuManager: React.FC = () => {
    const [searchParams] = useSearchParams();
    const initialSite = searchParams.get('site') || 'cheongyeon';

    // --- State ---
    const [menuData, setMenuData] = useState<SiteDataType | null>(null);
    const [selectedSite, setSelectedSite] = useState<string>(initialSite);
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    // Derived state: Get actual item objects from IDs
    const selectedItems = useMemo(() => {
        if (!menuData) return [];
        const items: MenuItem[] = [];
        selectedIds.forEach(id => {
            const item = findMenuItemInTree(menuData[selectedSite]?.menu || [], id);
            if (item) items.push(item);
        });
        return items;
    }, [menuData, selectedSite, selectedIds]);

    const activeItem = selectedItems.length === 1 ? selectedItems[0] : undefined;

    // Actions
    const handleNodeSelect = useCallback((id: string, multiSelect: boolean = false) => {
        if (multiSelect) {
            setSelectedIds(prev => {
                if (prev.includes(id)) {
                    return prev.filter(item => item !== id);
                } else {
                    return [...prev, id];
                }
            });
        } else {
            setSelectedIds([id]);
        }
        setLeftPanelOpen(false);
    }, []);

    const handleIndent = useCallback((id: string) => {
        if (!menuData) return;
        const currentMenu = [...(menuData[selectedSite]?.menu || [])];
        const ref = findRef(currentMenu, id);

        if (!ref || ref.index <= 0) return; // Can't indent if first item

        const prevSibling = ref.list[ref.index - 1];
        if (typeof prevSibling === 'string') return; // Can't nest under a string (separator)

        // Remove from current list
        const [movedItem] = ref.list.splice(ref.index, 1);

        // Add to prevSibling's sub
        if (!prevSibling.sub) prevSibling.sub = [];
        prevSibling.sub.push(movedItem);

        // Update state
        const newData = { ...menuData };
        newData[selectedSite].menu = currentMenu;
        setMenuData(newData);
        menuServiceV11.saveMenuConfig(newData);
    }, [menuData, selectedSite]);

    const handleOutdent = useCallback((id: string) => {
        if (!menuData) return;
        const currentMenu = [...(menuData[selectedSite]?.menu || [])];
        const ref = findRef(currentMenu, id);

        if (!ref || !ref.parent) return; // Can't outdent if root

        const parentRef = findRef(currentMenu, ref.parent.id || ref.parent.text || '');
        if (!parentRef) return; // Should not happen

        // Remove from parent's sub
        const [movedItem] = ref.list.splice(ref.index, 1);

        // Add to grandParent's list (parentRef.list) after parent
        parentRef.list.splice(parentRef.index + 1, 0, movedItem);

        // Update state
        const newData = { ...menuData };
        newData[selectedSite].menu = currentMenu;
        setMenuData(newData);
        menuServiceV11.saveMenuConfig(newData);
    }, [menuData, selectedSite]);

    const handleBatchUpdate = (updates: Partial<MenuItem>) => {
        if (!menuData) return;

        const updateRecursive = (nodes: (MenuItem | string)[]): (MenuItem | string)[] => {
            return nodes.map(node => {
                if (typeof node === 'string') return node;

                let newNode = { ...node };
                if (selectedIds.includes(node.id || '')) {
                    newNode = { ...newNode, ...updates };
                }

                if (newNode.sub) {
                    newNode.sub = updateRecursive(newNode.sub);
                }
                return newNode;
            });
        };

        const newMenu = updateRecursive(menuData[selectedSite].menu);
        const newData = { ...menuData };
        newData[selectedSite].menu = newMenu as MenuItem[];
        updateMenuData(newData);
    };

    const handleInspectorUpdate = (updatedItem: MenuItem) => {
        if (!menuData) return;
        const newMenu = updateMenuItemInTree(menuData[selectedSite].menu, updatedItem);
        const newData = { ...menuData };
        newData[selectedSite].menu = newMenu as MenuItem[];
        updateMenuData(newData);
    };

    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
    const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);

    // History for Undo/Redo
    const [history, setHistory] = useState<{ past: SiteDataType[], future: SiteDataType[] }>({
        past: [],
        future: []
    });

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // --- Effects ---
    useEffect(() => {
        // Load initial data
        const loadData = async () => {
            const data = await menuServiceV11.getMenuConfig();
            if (data) {
                // [Sync Logic] Ensure all 'pos_' sites exist for defined roles
                const syncedData = { ...data };
                let hasChanges = false;
                const positions = syncedData.admin?.positionConfig || [];

                positions.forEach(pos => {
                    // Skip 'full' as it maps to 'admin'
                    if (pos.id === 'full') return;

                    const siteKey = pos.id.startsWith('pos_') ? pos.id : `pos_${pos.id}`;
                    if (!syncedData[siteKey]) {
                        console.log(`[Auto-Repair] Creating missing site: ${siteKey}`);
                        syncedData[siteKey] = {
                            name: pos.name,
                            icon: pos.icon,
                            menu: [],
                            // Inherit color/order if needed, or default
                        };
                        hasChanges = true;
                    }
                    // Optional: Sync Name/Icon if they differ? 
                    // Let's rely on RoleManager for explicit updates to avoid overwriting user customizations
                });

                setMenuData(syncedData);

                // If we patched data, save it silently or just keep in state? 
                // Better to save it ensuring consistency for next reload
                if (hasChanges) {
                    menuServiceV11.saveMenuConfig(syncedData);
                }

                // Set default site if not selected or invalid
                if (!Object.keys(syncedData).includes(selectedSite)) {
                    setSelectedSite(Object.keys(syncedData)[0] || 'admin');
                }
            }
        };
        loadData();
    }, []);

    // Reset selection when site changes (Fix for: "Menu structure doesn't seem to change")
    useEffect(() => {
        setSelectedIds([]);
    }, [selectedSite]);

    // --- Actions ---

    const updateMenuData = useCallback((newData: SiteDataType) => {
        if (!menuData) return;

        // Push to history
        setHistory(prev => ({
            past: [...prev.past, JSON.parse(JSON.stringify(menuData))],
            future: []
        }));

        setMenuData(newData);
        debouncedSave(newData);
    }, [menuData]);

    const handleUndo = () => {
        if (history.past.length === 0 || !menuData) return;
        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, history.past.length - 1);

        setHistory({
            past: newPast,
            future: [menuData, ...history.future]
        });
        setMenuData(previous);
        debouncedSave(previous);
    };

    const handleRedo = () => {
        if (history.future.length === 0 || !menuData) return;
        const next = history.future[0];
        const newFuture = history.future.slice(1);

        setHistory({
            past: [...history.past, menuData],
            future: newFuture
        });
        setMenuData(next);
        debouncedSave(next);
    };

    const handleResetDefaults = () => {
        if (window.confirm('정말 초기화하시겠습니까? 기존 메뉴 설정이 모두 사라지고 기본값(한글)으로 복원됩니다.')) {
            // Push current state to history before resetting
            if (menuData) {
                setHistory(prev => ({
                    past: [...prev.past, JSON.parse(JSON.stringify(menuData))],
                    future: []
                }));
            }
            // Use defaults
            setMenuData(JSON.parse(JSON.stringify(DEFAULT_MENU_CONFIG)));
            debouncedSave(DEFAULT_MENU_CONFIG);
        }
    };

    const handleDeleteItem = (itemId: string) => {
        if (!window.confirm('정말 삭제하시겠습니까? 휴지통으로 이동하지 않고 즉시 삭제됩니다.')) return;
        if (!menuData) return;

        const newMenu = JSON.parse(JSON.stringify(menuData[selectedSite]?.menu || []));
        const target = findRef(newMenu, itemId);

        if (target) {
            target.list.splice(target.index, 1);

            const newData = { ...menuData };
            newData[selectedSite].menu = newMenu;
            updateMenuData(newData);

            if (selectedIds.includes(itemId)) {
                setSelectedIds(prev => prev.filter(id => id !== itemId));
            }
        }
    };

    // Auto-save logic
    const debouncedSave = useCallback((data: SiteDataType) => {
        setSaveStatus('saving');
        menuServiceV11.saveMenuConfig(data)
            .then(() => setSaveStatus('saved'))
            .catch(() => setSaveStatus('error'));
    }, []);

    // --- DnD Sensors ---
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(String(event.active.id));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);
        if (!over || !menuData) return;

        // Clone for mutation
        let newMenu = JSON.parse(JSON.stringify(menuData[selectedSite]?.menu || []));
        const activeId = String(active.id);
        const overId = String(over.id);

        // 1. Drop into Trash
        if (overId === 'trash-zone') {
            const src = findRef(newMenu, activeId);
            if (src) {
                src.list.splice(src.index, 1);
                const newData = { ...menuData };
                newData[selectedSite].menu = newMenu;
                updateMenuData(newData);
            }
            return;
        }

        // 2. New Item from Toolbox
        if (active.data.current?.type === 'new-item' || active.data.current?.type === 'system-page') {
            const data = active.data.current;
            const newId = `menu-${Date.now()}`;

            let newItem: MenuItem;

            if (data.type === 'system-page') {
                newItem = {
                    id: newId,
                    text: data.text,
                    path: data.path,
                    icon: 'faFileLines' // Default icon for system pages
                };
            } else {
                const template = data.template;
                newItem = template === 'folder'
                    ? { id: newId, text: '새 그룹', sub: [], icon: 'faFolder' }
                    : { id: newId, text: '새 링크', path: '/new-link', icon: 'faLink' };
            }

            const dst = findRef(newMenu, overId);
            if (dst) {
                dst.list.splice(dst.index, 0, newItem);
            } else if (overId === 'root-drop-zone') {
                newMenu.push(newItem);
            } else {
                newMenu.push(newItem);
            }

            const newData = { ...menuData };
            newData[selectedSite].menu = newMenu;
            updateMenuData(newData);
            return;
        }

        // 3. Reorder (Canvas to Canvas)
        if (activeId !== overId) {
            const src = findRef(newMenu, activeId);
            const dst = findRef(newMenu, overId);

            if (src && dst) {
                if (src.list === dst.list) {
                    // Same list reorder
                    const reordered = arrayMove(src.list, src.index, dst.index);
                    if (src.parent) {
                        src.parent.sub = reordered;
                    } else {
                        newMenu = reordered;
                    }
                } else {
                    // Move to different list (Reparenting)
                    const [movedItem] = src.list.splice(src.index, 1);
                    dst.list.splice(dst.index, 0, movedItem);
                }

                const newData = { ...menuData };
                newData[selectedSite].menu = newMenu;
                updateMenuData(newData);
            }
        }
    };

    if (!menuData) return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg font-medium text-gray-300">메뉴 시스템 로딩 중...</span>
        </div>
    );

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-900 text-gray-100 font-sans">
            {/* --- Top Bar --- */}
            <header className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700 shadow-md z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2.5 rounded-xl shadow-lg shadow-blue-500/20 border border-blue-500/30">
                        <FontAwesomeIcon icon={faCube} className="text-white text-xl" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            통합 메뉴 관리자
                            <span className="text-[10px] font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-wide">Premium</span>
                        </h1>
                        <p className="text-xs text-gray-400 font-medium ml-0.5">드래그 앤 드롭으로 메뉴 구조를 자유롭게 설정하세요</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* History Controls */}
                    <div className="flex items-center gap-2 border-l border-r border-gray-700 px-4 mx-2">
                        <button
                            onClick={handleUndo}
                            disabled={history.past.length === 0}
                            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                            title="실행 취소 (Undo)"
                        >
                            <FontAwesomeIcon icon={faUndo} />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={history.future.length === 0}
                            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                            title="다시 실행 (Redo)"
                        >
                            <FontAwesomeIcon icon={faRedo} />
                        </button>
                        <div className="w-px h-4 bg-gray-700 mx-1"></div>
                        <button
                            onClick={handleResetDefaults}
                            className="p-2 text-red-400 hover:text-red-300 transition-colors"
                            title="초기화 (Reset to Default)"
                        >
                            <FontAwesomeIcon icon={faRotateRight} />
                        </button>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2 min-w-[100px] justify-end">
                        {saveStatus === 'saving' && <span className="text-yellow-400 text-sm animate-pulse flex items-center gap-1.5"><FontAwesomeIcon icon={faSave} /> 저장 중...</span>}
                        {saveStatus === 'saved' && <span className="text-green-400 text-sm flex items-center gap-1.5"><FontAwesomeIcon icon={faCheckCircle} /> 저장됨</span>}
                        {saveStatus === 'error' && <span className="text-red-400 text-sm flex items-center gap-1.5"><FontAwesomeIcon icon={faExclamationTriangle} /> 오류 발생</span>}
                    </div>
                </div>
            </header>

            {/* New Tabs Header */}
            {menuData && (
                <MenuManagerHeader
                    menuData={menuData}
                    selectedSite={selectedSite}
                    onSelectSite={setSelectedSite}
                    onUpdateMenuData={updateMenuData}
                    onOpenSiteManager={() => setIsSiteManagerOpen(true)}
                    onOpenRoleManager={() => setIsRoleManagerOpen(true)}
                />
            )}

            {/* Role Manager Modal */}
            <RoleManager
                isOpen={isRoleManagerOpen}
                onClose={() => setIsRoleManagerOpen(false)}
                menuData={menuData}
                onUpdate={(newData) => {
                    updateMenuData(newData);
                    if (!newData[selectedSite]) {
                        setSelectedSite(Object.keys(newData)[0] || 'cheongyeon');
                    }
                }}
            />

            {/* Site Manager Modal */}
            <SiteManager
                isOpen={isSiteManagerOpen}
                onClose={() => setIsSiteManagerOpen(false)}
                menuData={menuData}
                onUpdate={(newData) => {
                    updateMenuData(newData);
                    // If currently selected site was deleted, switch to default
                    if (!newData[selectedSite]) {
                        setSelectedSite(Object.keys(newData)[0] || 'cheongyeon');
                    }
                }}
            />

            {/* --- Main Content (3-Col Layout) --- */}
            < DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex flex-1 overflow-hidden">
                    {/* 1. Toolbox Panel (Left) */}
                    <ToolboxPanel
                        isOpen={leftPanelOpen}
                        toggle={() => setLeftPanelOpen(!leftPanelOpen)}
                    />

                    {/* 2. Canvas (Center) */}
                    <main className="flex-1 bg-gray-900 overflow-hidden flex flex-col relative w-full h-full">
                        <div className="absolute inset-0 bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

                        <SortableTreeCanvas
                            key={selectedSite}
                            siteId={selectedSite}
                            items={menuData[selectedSite]?.menu || []}
                            onItemsChange={(newItems: MenuItem[]) => {
                                const newData = { ...menuData };
                                newData[selectedSite].menu = newItems;
                                updateMenuData(newData);
                            }}
                            selectedIds={selectedIds}
                            onSelect={handleNodeSelect}
                            onDelete={handleDeleteItem}
                            onIndent={handleIndent}
                            onOutdent={handleOutdent}
                        />
                    </main>

                    {/* 3. Inspector Panel (Right) */}
                    <InspectorPanel
                        isOpen={selectedIds.length > 0}
                        toggle={() => setSelectedIds([])}
                        selectedItems={selectedItems}
                        onUpdate={handleInspectorUpdate}
                        onBatchUpdate={handleBatchUpdate}
                    />
                </div>

                {/* Drag Overlay for smooth visuals */}
                <DragOverlay>
                    {activeDragId ? (
                        <div className="bg-blue-600 text-white p-3 rounded-lg shadow-2xl skew-y-2 opacity-90 backdrop-blur-sm border border-blue-400/50 font-bold z-50">
                            <FontAwesomeIcon icon={faCube} className="mr-2" />
                            아이템 이동 중...
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext >
        </div >
    );
};

export default AdvancedMenuManager;
