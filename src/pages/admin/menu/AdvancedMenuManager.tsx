import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    DragStartEvent,
    DragEndEvent,
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
    faCopy,
    faList,
    faGrip,
    faBroom
} from '@fortawesome/free-solid-svg-icons';
import { arrayMove } from '@dnd-kit/sortable';

import { menuServiceV11, SiteDataType, MenuItem } from '../../../services/menuServiceV11';
import { DEFAULT_MENU_CONFIG } from '../../../constants/defaultMenu';
import { MENU_PATHS } from '../../../constants/menuPaths';
import ToolboxPanel from './components/ToolboxPanel';
import SortableTreeCanvas from './components/SortableTreeCanvas';
import InspectorPanel from './components/InspectorPanel';
import RoleManager from './components/RoleManager';
import SiteManager from './components/SiteManager';
import MenuManagerHeader from './components/MenuManagerHeader';
import PositionMenuCopyModal from './components/PositionMenuCopyModal';
import { addMenuItemsSafely } from './menuBulkApply';
import { isDevAdminSessionEnabled } from '../../../utils/devAdminSession';
import { useSiteMode } from '../../../contexts/SiteModeContext';

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

const getMenuItemLookupId = (item: MenuItem) => String(item.id || item.path || item.text || '');

const findMenuItemsByIds = (nodes: (MenuItem | string)[], ids: string[]): MenuItem[] => {
    const idSet = new Set(ids);
    const found: MenuItem[] = [];

    const visit = (items: (MenuItem | string)[]) => {
        items.forEach((item) => {
            if (typeof item === 'string') return;

            if (idSet.has(getMenuItemLookupId(item))) {
                found.push(item);
            }

            if (Array.isArray(item.sub)) {
                visit(item.sub);
            }
        });
    };

    visit(nodes);
    return found;
};

const collectMenuIds = (nodes: (MenuItem | string)[], ids = new Set<string>()) => {
    nodes.forEach((item) => {
        if (typeof item === 'string') return;

        if (item.id) ids.add(item.id);
        if (Array.isArray(item.sub)) collectMenuIds(item.sub, ids);
    });

    return ids;
};

type MenuParentOption = {
    id: string;
    label: string;
    depth: number;
};

const ROOT_PARENT_ID = '__root__';

const getMenuItemId = (item: MenuItem | string): string =>
    typeof item === 'string' ? item : String(item.id || item.text || '');

const collectParentOptions = (
    nodes: (MenuItem | string)[],
    depth = 0,
    excludedIds = new Set<string>(),
    options: MenuParentOption[] = []
): MenuParentOption[] => {
    nodes.forEach((item) => {
        if (typeof item === 'string' || item.text === '-') return;

        const id = getMenuItemId(item);
        if (!id || excludedIds.has(id)) return;

        options.push({
            id,
            depth,
            label: `${'└ '.repeat(depth)}${item.text || id}`
        });

        if (Array.isArray(item.sub)) {
            collectParentOptions(item.sub, depth + 1, excludedIds, options);
        }
    });

    return options;
};

const collectDescendantIds = (item: MenuItem | string, ids = new Set<string>()): Set<string> => {
    if (typeof item === 'string') return ids;
    const id = getMenuItemId(item);
    if (id) ids.add(id);
    if (Array.isArray(item.sub)) {
        item.sub.forEach((child) => collectDescendantIds(child, ids));
    }
    return ids;
};


const getPositionSiteKey = (positionId: string | null) => {
    const id = String(positionId || '').trim();
    if (!id || id === 'full') return 'admin';
    return id.startsWith('pos_') ? id : `pos_${id}`;
};

type MenuSurface = 'menu' | 'headerActions';

const getSurfaceItems = (data: SiteDataType | null, siteKey: string, surface: MenuSurface): MenuItem[] => {
    const site = data?.[siteKey] as any;
    const items = site?.[surface];
    return Array.isArray(items) ? items : [];
};

const setSurfaceItems = (data: SiteDataType, siteKey: string, surface: MenuSurface, items: MenuItem[]) => {
    if (!data[siteKey]) return;
    (data[siteKey] as any)[surface] = items;
};

const getNormalizedMenuRoute = (item: MenuItem | string): string => {
    const text = typeof item === 'string' ? item : item.text;
    const rawPath = typeof item === 'string' ? MENU_PATHS[text] : (item.path || MENU_PATHS[text]);
    return String(rawPath || '').trim();
};

const findMenuItemByRoute = (
    nodes: (MenuItem | string)[],
    route: string
): MenuItem | string | null => {
    for (const item of nodes) {
        if (getNormalizedMenuRoute(item) === route) return item;

        if (typeof item !== 'string' && Array.isArray(item.sub)) {
            const found = findMenuItemByRoute(item.sub, route);
            if (found) return found;
        }
    }

    return null;
};

const removeDuplicateLeafMenuRoutes = (
    nodes: (MenuItem | string)[],
    seenRoutes = new Set<string>()
): { items: (MenuItem | string)[]; removed: number } => {
    let removed = 0;
    const items: (MenuItem | string)[] = [];

    nodes.forEach((item) => {
        const hasChildren = typeof item !== 'string' && Array.isArray(item.sub) && item.sub.length > 0;
        const route = hasChildren ? '' : getNormalizedMenuRoute(item);

        if (route && seenRoutes.has(route)) {
            removed += 1;
            return;
        }
        if (route) seenRoutes.add(route);

        if (typeof item === 'string' || !hasChildren) {
            items.push(item);
            return;
        }

        const childResult = removeDuplicateLeafMenuRoutes(item.sub || [], seenRoutes);
        removed += childResult.removed;
        items.push({ ...item, sub: childResult.items });
    });

    return { items, removed };
};

const getInitialMenuSite = (requestedSite: string | null) => {
    if (requestedSite) return requestedSite;

    const storedPosition = localStorage.getItem('cy_current_position');
    if (storedPosition && storedPosition !== 'full') {
        return getPositionSiteKey(storedPosition);
    }

    return localStorage.getItem('cy_current_site') || 'admin';
};

const resolveExistingMenuSite = (data: SiteDataType, desiredSite: string) => {
    const keys = Object.keys(data);
    const candidates = [
        desiredSite,
        getInitialMenuSite(null),
        'admin',
        keys.find(key => !key.startsWith('pos_')),
        keys[0]
    ].filter((key): key is string => Boolean(key));

    return candidates.find(key => Boolean(data[key])) || 'admin';
};

const AdvancedMenuManagerEditor: React.FC = () => {
    const [searchParams] = useSearchParams();
    const initialSite = getInitialMenuSite(searchParams.get('site'));
    const { positions: previewPositions, changePosition: changePreviewPosition } = useSiteMode();

    // --- State ---
    const [menuData, setMenuData] = useState<SiteDataType | null>(null);
    const [selectedSite, setSelectedSite] = useState<string>(initialSite);
    const [selectedSurface, setSelectedSurface] = useState<MenuSurface>('menu');
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [quickAddType, setQuickAddType] = useState<'folder' | 'link'>('link');
    const [quickAddText, setQuickAddText] = useState('');
    const [quickAddPath, setQuickAddPath] = useState('');
    const [quickAddParentId, setQuickAddParentId] = useState<string>(ROOT_PARENT_ID);
    const [moveTargetParentId, setMoveTargetParentId] = useState<string>(ROOT_PARENT_ID);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    // Derived state: Get actual item objects from IDs
    const selectedItems = useMemo(() => {
        if (!menuData) return [];
        const surfaceItems = getSurfaceItems(menuData, selectedSite, selectedSurface);
        const items: MenuItem[] = [];
        selectedIds.forEach(id => {
            const item = findMenuItemInTree(surfaceItems, id);
            if (item) items.push(item);
        });
        return items;
    }, [menuData, selectedSite, selectedSurface, selectedIds]);

    const activeItem = selectedItems.length === 1 ? selectedItems[0] : undefined;

    const currentMenuDuplicateCount = useMemo(() => {
        if (!menuData) return 0;
        return removeDuplicateLeafMenuRoutes(getSurfaceItems(menuData, selectedSite, 'menu')).removed;
    }, [menuData, selectedSite]);

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState<string>('');
    const latestSaveRequestRef = useRef(0);

    const formatSaveError = useCallback((err: any): string => {
        if (!err) return 'Unknown error';
        if (Array.isArray(err.issues)) {
            const details = err.issues
                .map((i: any) => `${Array.isArray(i.path) ? i.path.join('.') : ''}: ${i.message}`)
                .join('\n');
            return `${err.message || 'Invalid Menu Configuration'}\n${details}`.trim();
        }
        if (err.code) {
            return `${String(err.code)}: ${String(err.message || '')}`.trim();
        }
        return String(err.message || err);
    }, []);

    const persistMenuData = useCallback((data: SiteDataType) => {
        const saveRequestId = ++latestSaveRequestRef.current;
        setSaveStatus('saving');
        setSaveError('');
        menuServiceV11.saveMenuConfig(data)
            .then((savedData) => {
                if (saveRequestId !== latestSaveRequestRef.current) return;
                setMenuData(savedData);
                setSaveStatus('saved');
                setSaveError('');
            })
            .catch((err) => {
                console.error('[MenuManager] saveMenuConfig failed:', err);
                if (saveRequestId !== latestSaveRequestRef.current) return;
                setSaveStatus('error');
                setSaveError(formatSaveError(err));
            });
    }, [formatSaveError]);

    useEffect(() => {
        if (saveStatus !== 'saving') return;

        const preventReloadDuringSave = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', preventReloadDuringSave);
        return () => window.removeEventListener('beforeunload', preventReloadDuringSave);
    }, [saveStatus]);

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
        const currentMenu = [...getSurfaceItems(menuData, selectedSite, selectedSurface)];
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
        setSurfaceItems(newData, selectedSite, selectedSurface, currentMenu as MenuItem[]);
        setMenuData(newData);
        persistMenuData(newData);
    }, [menuData, selectedSite, selectedSurface, persistMenuData]);

    const handleDeleteItem = useCallback((id: string) => {
        if (!window.confirm('정말 삭제하시겠습니까? 휴지통으로 이동하지 않고 즉시 삭제됩니다.')) return;
        if (!menuData) return;
        
        // Deep clone to ensure immutable update and prevent side effects in nested structures
        const newData = JSON.parse(JSON.stringify(menuData));
        const result = findRef(getSurfaceItems(newData, selectedSite, selectedSurface), id);
        
        if (result) {
            result.list.splice(result.index, 1);
            
            // Clear from selectedIds if it was deleted
            setSelectedIds(prev => prev.filter(sid => sid !== id));
            
            setMenuData(newData);
            persistMenuData(newData);
        } else {
            console.warn(`[MenuManager] Failed to find item with ID: ${id} for deletion`);
        }
    }, [menuData, selectedSite, selectedSurface, persistMenuData]);

    const handleOutdent = useCallback((id: string) => {
        if (!menuData) return;
        const currentMenu = [...getSurfaceItems(menuData, selectedSite, selectedSurface)];
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
        setSurfaceItems(newData, selectedSite, selectedSurface, currentMenu as MenuItem[]);
        setMenuData(newData);
        persistMenuData(newData);
    }, [menuData, selectedSite, selectedSurface, persistMenuData]);

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

        const newMenu = updateRecursive(getSurfaceItems(menuData, selectedSite, selectedSurface));
        const newData = { ...menuData };
        setSurfaceItems(newData, selectedSite, selectedSurface, newMenu as MenuItem[]);
        updateMenuData(newData);
    };

    const handleInspectorUpdate = (updatedItem: MenuItem) => {
        if (!menuData) return;
        const newMenu = updateMenuItemInTree(getSurfaceItems(menuData, selectedSite, selectedSurface), updatedItem);
        const newData = { ...menuData };
        setSurfaceItems(newData, selectedSite, selectedSurface, newMenu as MenuItem[]);
        updateMenuData(newData);
    };

    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
    const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

    // History for Undo/Redo
    const [history, setHistory] = useState<{ past: SiteDataType[], future: SiteDataType[] }>({
        past: [],
        future: []
    });

    // --- Effects ---
    useEffect(() => {
        // Load initial data
        const loadData = async () => {
            const data = await menuServiceV11.getMenuConfig();
            if (data) {
                // [Sync Logic] Ensure all 'pos_' sites exist for defined roles
                // Disabled auto-repair to allow manual deletion of site tabs. (User Feedback: "Deleted items reappear")
                /*
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
                });
                
                if (hasChanges) {
                    menuServiceV11.saveMenuConfig(syncedData);
                    // Use synced data
                    setMenuData(syncedData);
                } else {
                    setMenuData(data);
                }
                */
                setMenuData(data);

                // If we patched data, save it silently or just keep in state? 
                // Better to save it ensuring consistency for next reload
                /*
                if (hasChanges) {
                    menuServiceV11.saveMenuConfig(syncedData);
                }
                */

                setSelectedSite(previous => resolveExistingMenuSite(data, previous || initialSite));
            }
        };
        loadData();
    }, []);

    // Reset selection when site changes (Fix for: "Menu structure doesn't seem to change")
    useEffect(() => {
        setSelectedIds([]);
    }, [selectedSite, selectedSurface]);

    const handleSelectMenuSite = useCallback((siteKey: string) => {
        setSelectedSite(siteKey);

        if (siteKey === 'admin') {
            changePreviewPosition('full');
            return;
        }

        const matchingPosition = previewPositions.find((position) => {
            const positionSiteKey = position.id.startsWith('pos_')
                ? position.id
                : `pos_${position.id}`;
            return positionSiteKey === siteKey;
        });

        if (matchingPosition) {
            changePreviewPosition(matchingPosition.id);
        }
    }, [changePreviewPosition, previewPositions]);

    // --- Actions ---

    const updateMenuData = useCallback((newData: SiteDataType) => {
        if (!menuData) return;

        // Push to history
        setHistory(prev => ({
            past: [...prev.past, JSON.parse(JSON.stringify(menuData))],
            future: []
        }));

        setMenuData(newData);
        persistMenuData(newData);
    }, [menuData, persistMenuData]);

    const handleUndo = () => {
        if (history.past.length === 0 || !menuData) return;
        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, history.past.length - 1);

        setHistory({
            past: newPast,
            future: [menuData, ...history.future]
        });
        setMenuData(previous);
        persistMenuData(previous);
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
        persistMenuData(next);
    };

    const handleRenameSystemPage = useCallback((path: string, name: string) => {
        if (!menuData?.admin) return;

        const normalizedPath = path.trim();
        const normalizedName = name.trim();
        if (!normalizedPath || !normalizedName) return;

        const newData = JSON.parse(JSON.stringify(menuData)) as SiteDataType;
        newData.admin.systemPageLabels = {
            ...(newData.admin.systemPageLabels || {}),
            [normalizedPath]: normalizedName
        };
        updateMenuData(newData);
    }, [menuData, updateMenuData]);

    const isSystemPageAdded = useCallback((path: string) => {
        const normalizedPath = String(path || '').trim();
        if (!normalizedPath) return false;

        return Boolean(findMenuItemByRoute(
            getSurfaceItems(menuData, selectedSite, 'menu'),
            normalizedPath
        ));
    }, [menuData, selectedSite]);

    const handleAddSystemPage = useCallback((page: { name: string; path: string }) => {
        if (!menuData?.[selectedSite]) return;

        const normalizedPath = String(page.path || '').trim();
        const normalizedName = String(page.name || '').trim();
        if (!normalizedPath || !normalizedName) return;

        const existingItem = findMenuItemByRoute(
            getSurfaceItems(menuData, selectedSite, 'menu'),
            normalizedPath
        );

        setSelectedSurface('menu');
        if (existingItem) {
            const existingId = getMenuItemId(existingItem);
            setSelectedIds(existingId ? [existingId] : []);
            return;
        }

        const newData = JSON.parse(JSON.stringify(menuData)) as SiteDataType;
        const targetMenu = [...getSurfaceItems(newData, selectedSite, 'menu')];
        const existingIds = collectMenuIds(targetMenu);
        const baseId = `menu-${Date.now()}`;
        let newId = baseId;
        let suffix = 1;

        while (existingIds.has(newId)) {
            newId = `${baseId}-${suffix}`;
            suffix += 1;
        }

        targetMenu.push({
            id: newId,
            text: normalizedName,
            path: normalizedPath,
            icon: 'faFileLines'
        });
        setSurfaceItems(newData, selectedSite, 'menu', targetMenu);
        updateMenuData(newData);
        setSelectedIds([newId]);
    }, [menuData, selectedSite, updateMenuData]);

    const handleRemoveDuplicateMenuLinks = useCallback(() => {
        if (!menuData || currentMenuDuplicateCount === 0) return;

        const siteName = menuData[selectedSite]?.name || selectedSite;
        const confirmed = window.confirm(
            `${siteName} 좌측 메뉴에서 같은 이동 경로를 사용하는 중복 링크 ${currentMenuDuplicateCount}개를 정리할까요?\n\n위에 있는 메뉴를 남기고 나머지만 제거합니다.`
        );
        if (!confirmed) return;

        const newData = JSON.parse(JSON.stringify(menuData)) as SiteDataType;
        const cleanup = removeDuplicateLeafMenuRoutes(getSurfaceItems(newData, selectedSite, 'menu'));
        setSurfaceItems(newData, selectedSite, 'menu', cleanup.items as MenuItem[]);
        setSelectedIds([]);
        updateMenuData(newData);
    }, [currentMenuDuplicateCount, menuData, selectedSite, updateMenuData]);

    const handleCopyFromPosition = useCallback((sourceSite: string, itemIds: string[], targetSites: string[]) => {
        if (!menuData) return;

        const sourceItems = findMenuItemsByIds(menuData[sourceSite]?.menu || [], itemIds);
        if (sourceItems.length === 0) {
            alert('복사할 메뉴를 찾지 못했습니다.');
            return;
        }

        const validTargetSites = Array.from(new Set(targetSites)).filter((siteKey) => (
            siteKey !== sourceSite && Boolean(menuData[siteKey])
        ));
        if (validTargetSites.length === 0) {
            alert('메뉴를 추가할 직책을 선택해주세요.');
            return;
        }

        const newData = JSON.parse(JSON.stringify(menuData)) as SiteDataType;
        const token = Date.now().toString(36);
        let addedCount = 0;

        validTargetSites.forEach((siteKey, index) => {
            const result = addMenuItemsSafely(
                newData[siteKey]?.menu || [],
                sourceItems,
                `${token}_${index}`
            );
            addedCount += result.addedCount;
            newData[siteKey] = {
                ...newData[siteKey],
                menu: result.menu
            };
        });

        if (addedCount === 0) {
            alert('선택한 메뉴가 대상 직책에 이미 모두 등록되어 있습니다.');
            return;
        }

        updateMenuData(newData);
        setSelectedIds([]);
        setIsCopyModalOpen(false);
    }, [menuData, updateMenuData]);

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
            persistMenuData(DEFAULT_MENU_CONFIG);
        }
    };





















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
        let newMenu = JSON.parse(JSON.stringify(getSurfaceItems(menuData, selectedSite, selectedSurface)));
        const activeId = String(active.id);
        const overId = String(over.id);

        // 1. Drop into Trash
        if (overId === 'trash-zone') {
            const src = findRef(newMenu, activeId);
            if (src) {
                src.list.splice(src.index, 1);
                const newData = { ...menuData };
                setSurfaceItems(newData, selectedSite, selectedSurface, newMenu as MenuItem[]);
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
                    : template === 'divider'
                        ? { id: newId, text: '-' }
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
            setSurfaceItems(newData, selectedSite, selectedSurface, newMenu as MenuItem[]);
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
                setSurfaceItems(newData, selectedSite, selectedSurface, newMenu as MenuItem[]);
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
                        {saveStatus === 'error' && (
                            <span
                                className="text-red-400 text-sm flex items-center gap-1.5 cursor-help"
                                title={saveError || '저장 오류'}
                            >
                                <FontAwesomeIcon icon={faExclamationTriangle} /> 오류 발생
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {isDevAdminSessionEnabled() && (
                <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-xs font-medium text-amber-200">
                    개발 관리자 모드에서는 메뉴 설정이 현재 브라우저에 저장됩니다. 다른 탭에는 즉시 동기화되며, 다른 브라우저와는 공유되지 않습니다.
                </div>
            )}

            {/* New Tabs Header */}
            {menuData && (
                <MenuManagerHeader
                    menuData={menuData}
                    selectedSite={selectedSite}
                    onSelectSite={handleSelectMenuSite}
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

            <PositionMenuCopyModal
                isOpen={isCopyModalOpen}
                onClose={() => setIsCopyModalOpen(false)}
                menuData={menuData}
                targetSite={selectedSite}
                onCopy={handleCopyFromPosition}
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
                        systemPageLabels={menuData.admin?.systemPageLabels}
                        onRenameSystemPage={handleRenameSystemPage}
                        targetMenuName={menuData[selectedSite]?.name || selectedSite}
                        isSystemPageAdded={isSystemPageAdded}
                        onAddSystemPage={handleAddSystemPage}
                    />

                    {/* 2. Canvas (Center) */}
                    <main className="flex-1 bg-gray-900 overflow-hidden flex flex-col relative w-full h-full">
                        <div className="absolute inset-0 bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

                        <SortableTreeCanvas
                            key={`${selectedSite}-${selectedSurface}`}
                            siteId={selectedSite}
                            title={selectedSurface === 'headerActions' ? '상단 아이콘 구조' : '메뉴 구조'}
                            emptyMessage={selectedSurface === 'headerActions' ? '상단 아이콘이 비어있습니다.' : undefined}
                            emptyHint={selectedSurface === 'headerActions' ? '기본 아이콘은 메뉴 설정 초기화로 복구할 수 있습니다.' : undefined}
                            items={getSurfaceItems(menuData, selectedSite, selectedSurface)}
                            onItemsChange={(newItems: MenuItem[]) => {
                                const newData = { ...menuData };
                                setSurfaceItems(newData, selectedSite, selectedSurface, newItems);
                                updateMenuData(newData);
                            }}
                            selectedIds={selectedIds}
                            onSelect={handleNodeSelect}
                            onDelete={handleDeleteItem}
                            onIndent={handleIndent}
                            onOutdent={handleOutdent}
                            headerActions={(
                                <>
                                    <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950/50 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedSurface('menu')}
                                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${selectedSurface === 'menu' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                        >
                                            <FontAwesomeIcon icon={faList} />
                                            좌측 메뉴
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedSurface('headerActions')}
                                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${selectedSurface === 'headerActions' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                        >
                                            <FontAwesomeIcon icon={faGrip} />
                                            상단 아이콘
                                        </button>
                                    </div>
                                    {selectedSurface === 'menu' && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleRemoveDuplicateMenuLinks}
                                                disabled={currentMenuDuplicateCount === 0}
                                                className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 transition-colors hover:border-amber-400 hover:bg-amber-500/20 hover:text-white disabled:cursor-default disabled:border-slate-700 disabled:bg-slate-800/50 disabled:text-slate-500"
                                                title={currentMenuDuplicateCount > 0 ? '현재 직책의 같은 경로 중복 링크 정리' : '현재 좌측 메뉴에 중복 링크가 없습니다'}
                                            >
                                                <FontAwesomeIcon icon={faBroom} />
                                                {currentMenuDuplicateCount > 0 ? `중복 ${currentMenuDuplicateCount}개 정리` : '중복 없음'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsCopyModalOpen(true)}
                                                className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-600/15 px-3 py-2 text-xs font-bold text-blue-200 transition-colors hover:border-blue-400 hover:bg-blue-600/25 hover:text-white"
                                                title="전체메뉴에서 메뉴를 선택해 여러 직책에 안전하게 추가"
                                            >
                                                <FontAwesomeIcon icon={faCopy} />
                                                여러 직책에 메뉴 추가
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
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

const CanonicalMenuManagerRedirect: React.FC = () => {
    useEffect(() => {
        const configuredOrigin = String(process.env.REACT_APP_CANONICAL_APP_ORIGIN || '').trim();
        const projectId = String(process.env.REACT_APP_FIREBASE_PROJECT_ID || '').trim();
        const canonicalOrigin = configuredOrigin || (projectId ? `https://${projectId}.web.app` : '');

        if (!canonicalOrigin) return;
        window.location.replace(`${canonicalOrigin.replace(/\/+$/, '')}/admin/menu-manager`);
    }, []);

    return (
        <main className="flex min-h-[60vh] items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
            <div>
                <FontAwesomeIcon icon={faRotateRight} className="mb-4 animate-spin text-2xl text-blue-400" />
                <p className="font-semibold">CEO·DEV 운영 통합메뉴로 이동 중입니다.</p>
                <p className="mt-2 text-sm text-slate-400">메뉴 설정은 운영 통합메뉴 한 곳에서만 관리합니다.</p>
            </div>
        </main>
    );
};

const AdvancedMenuManager: React.FC = () => {
    if (isDevAdminSessionEnabled()) {
        return <CanonicalMenuManagerRedirect />;
    }

    return <AdvancedMenuManagerEditor />;
};

export default AdvancedMenuManager;
