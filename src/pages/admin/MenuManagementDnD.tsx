import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSitemap, faPlus, faTrash, faFolder, faFile,
    faChevronRight, faChevronDown, faGripVertical, faRotateLeft,
    faTimes, faUndo, faCog, faArrowUp, faArrowDown, faArrowLeft, faArrowRight,
    faSync, faRotate
} from '@fortawesome/free-solid-svg-icons';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useDroppable, useDraggable } from '@dnd-kit/core';

import { menuServiceV11 } from '../../services/menuServiceV11';
import { SiteDataType, MenuItem } from '../../types/menu';
import { getIcon } from '../../utils/iconMapper';
import { MenuTrashBin } from '../../components/admin/menu/MenuTrashBin';
import { MenuSidebar } from '../../components/admin/menu/MenuSidebar';
import { MenuTree } from '../../components/admin/menu/MenuTree';
import Swal from 'sweetalert2';
import { MENU_PATHS } from '../../constants/menuPaths';
import MenuSettingsModal from '../../components/admin/MenuSettingsModal';
import { useHistory } from '../../hooks/useHistory';

const createDeterministicId = (parts: string[]): string => {
    const input = parts.join('|');
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `m_${(hash >>> 0).toString(36)}`;
};

const createRandomId = (): string => {
    return `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
};

const standardizeMenuItem = (item: MenuItem | string, parentIdPath: string): MenuItem => {
    const base: MenuItem = typeof item === 'string' ? { text: item } : { ...item };
    const normalizedText = String(base.text ?? '').trim();
    const idSeed = `${parentIdPath}/${normalizedText}`;

    const normalizedId = base.id && String(base.id).trim().length > 0 ? String(base.id) : createDeterministicId([idSeed]);

    const normalizedPath =
        base.path && String(base.path).trim().length > 0
            ? String(base.path)
            : MENU_PATHS[normalizedText] || undefined;

    const rawSub = Array.isArray(base.sub) ? base.sub : [];
    const normalizedSub = rawSub.map((child) => standardizeMenuItem(child, idSeed));

    return {
        ...base,
        text: normalizedText,
        id: normalizedId,
        path: normalizedPath,
        sub: normalizedSub
    };
};






const MenuManagementDnD: React.FC = () => {
    const [allMenuData, setAllMenuData] = useState<SiteDataType | null>(null);
    const [selectedSite, setSelectedSite] = useState<string>('admin');
    const [activeId, setActiveId] = useState<string | null>(null);
    const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());
    const [availableItems, setAvailableItems] = useState<{ id: string, text: string, path: string }[]>([]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // History for Undo/Redo
    const [historyData, historyActions] = useHistory<SiteDataType>(null);
    const previousDataRef = React.useRef<SiteDataType | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8
            }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    // --- Undo/Redo Handlers ---
    const handleUndo = useCallback(() => {
        const previousState = historyActions.undo();
        if (previousState) {
            setAllMenuData(previousState);
            // Save the undone state to Firebase
            menuServiceV11.saveMenuConfig(previousState).catch(console.error);
            Swal.fire({
                toast: true,
                position: 'bottom-end',
                icon: 'info',
                title: '실행 취소됨',
                showConfirmButton: false,
                timer: 1200
            });
        }
    }, [historyActions]);

    const handleRedo = useCallback(() => {
        const nextState = historyActions.redo();
        if (nextState) {
            setAllMenuData(nextState);
            // Save the redone state to Firebase
            menuServiceV11.saveMenuConfig(nextState).catch(console.error);
            Swal.fire({
                toast: true,
                position: 'bottom-end',
                icon: 'info',
                title: '다시 실행됨',
                showConfirmButton: false,
                timer: 1200
            });
        }
    }, [historyActions]);

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo: Ctrl+Z (not Shift)
            if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                handleUndo();
                return;
            }

            // Redo: Ctrl+Shift+Z or Ctrl+Y
            if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
                e.preventDefault();
                handleRedo();
                return;
            }

            // Delete: Delete key on selected item
            if (e.key === 'Delete' && selectedItemId && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                handleSoftDelete(selectedItemId);
                setSelectedItemId(null);
                return;
            }

            // Escape: Deselect
            if (e.key === 'Escape') {
                setSelectedItemId(null);
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo, selectedItemId]);

    // Real-time sync
    useEffect(() => {
        const handleConfigUpdate = (data: SiteDataType) => {
            const standardizedData: SiteDataType = {};
            Object.keys(data).forEach(site => {
                standardizedData[site] = {
                    ...data[site],
                    menu: data[site].menu.map((item) => standardizeMenuItem(item, site))
                };
            });
            setAllMenuData(standardizedData);
            // Initialize history with first load (skip history tracking)
            if (!previousDataRef.current) {
                historyActions.set(standardizedData, true);
            }
            previousDataRef.current = standardizedData;
        };

        const unsubscribe = menuServiceV11.subscribe(handleConfigUpdate, { mergeWithDefaults: true });
        return () => unsubscribe();
    }, [historyActions]);

    // --- Trash & Restore Logic ---
    const handleSoftDelete = (id: string) => {
        if (!allMenuData) return;
        const currentSiteData = allMenuData[selectedSite];
        let newMenu = JSON.parse(JSON.stringify(currentSiteData.menu)) as MenuItem[];
        let newTrash = currentSiteData.trash ? JSON.parse(JSON.stringify(currentSiteData.trash)) as MenuItem[] : [];

        let deletedItem: MenuItem | null = null;

        const removeRecursive = (items: MenuItem[]) => {
            const filtered: MenuItem[] = [];
            for (const item of items) {
                if (item.id === id) {
                    deletedItem = item;
                    // Remove
                } else {
                    if (item.sub) {
                        item.sub = removeRecursive(item.sub as MenuItem[]);
                    }
                    filtered.push(item);
                }
            }
            return filtered;
        };

        newMenu = removeRecursive(newMenu);

        if (deletedItem) {
            newTrash.unshift(deletedItem); // Add to top of trash

            // Add to deletedItems to prevent it from reappearing via merge
            const currentDeletedItems: string[] = currentSiteData.deletedItems || [];
            const targetText = (deletedItem as MenuItem).text;
            const newDeletedItems = currentDeletedItems.includes(targetText)
                ? currentDeletedItems
                : [...currentDeletedItems, targetText];

            const newData = {
                ...allMenuData,
                [selectedSite]: {
                    ...currentSiteData,
                    menu: newMenu,
                    trash: newTrash,
                    deletedItems: newDeletedItems
                }
            };
            autoSave(newData);
            Swal.fire({
                toast: true,
                position: 'bottom-end',
                icon: 'info',
                title: '휴지통으로 이동되었습니다',
                showConfirmButton: false,
                timer: 1500
            });
        }
    };

    const handleHardDelete = (id: string) => {
        if (!allMenuData) return;
        const currentSiteData = allMenuData[selectedSite];
        let newTrash = currentSiteData.trash ? JSON.parse(JSON.stringify(currentSiteData.trash)) as MenuItem[] : [];

        newTrash = newTrash.filter(item => item.id !== id);

        const newData = {
            ...allMenuData,
            [selectedSite]: { ...currentSiteData, trash: newTrash }
        };
        autoSave(newData);
    };

    const handleRestore = (id: string) => {
        if (!allMenuData) return;
        const currentSiteData = allMenuData[selectedSite];
        let newMenu = JSON.parse(JSON.stringify(currentSiteData.menu)) as MenuItem[];
        let newTrash = currentSiteData.trash ? JSON.parse(JSON.stringify(currentSiteData.trash)) as MenuItem[] : [];

        const itemToRestore = newTrash.find(i => i.id === id);
        if (itemToRestore) {
            newTrash = newTrash.filter(i => i.id !== id);
            newMenu.push(itemToRestore); // Restore to bottom of menu

            // Remove from deletedItems so it can be merged again if it's a default item
            const newDeletedItems = ((currentSiteData.deletedItems || []) as string[]).filter(text => text !== itemToRestore.text);

            const newData = {
                ...allMenuData,
                [selectedSite]: {
                    ...currentSiteData,
                    menu: newMenu,
                    trash: newTrash,
                    deletedItems: newDeletedItems
                }
            };
            autoSave(newData);
            Swal.fire({
                toast: true,
                position: 'bottom-end',
                icon: 'success',
                title: '메뉴가 복원되었습니다',
                showConfirmButton: false,
                timer: 1500
            });
        }
    };

    const handleEmptyTrash = async () => {
        const result = await Swal.fire({
            title: '휴지통 비우기',
            text: '휴지통의 모든 항목이 영구 삭제됩니다. 되돌릴 수 없습니다.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: '네, 비웁니다',
            cancelButtonText: '취소'
        });

        if (result.isConfirmed) {
            const currentSiteData = allMenuData![selectedSite];
            const newData = {
                ...allMenuData!,
                [selectedSite]: { ...currentSiteData, trash: [] }
            };
            await autoSave(newData);
            Swal.fire('완료', '휴지통을 비웠습니다.', 'success');
        }
    };

    const moveNode = (
        tree: MenuItem[],
        sourceId: string,
        targetId: string,
        placement: 'before' | 'after' | 'child'
    ): MenuItem[] => {
        // 1. Clone Tree
        let newTree = JSON.parse(JSON.stringify(tree)) as MenuItem[];

        // 2. Find and Remove Source
        let sourceItem: MenuItem | null = null;

        const removeSource = (items: MenuItem[]): MenuItem[] => {
            const filtered: MenuItem[] = [];
            for (const item of items) {
                if (item.id === sourceId) {
                    sourceItem = item; // Found it
                    // Don't add to filtered -> Removed
                } else {
                    if (item.sub) {
                        item.sub = removeSource(item.sub as MenuItem[]);
                    }
                    filtered.push(item);
                }
            }
            return filtered;
        };

        newTree = removeSource(newTree);

        if (!sourceItem) return tree; // Source not found, abort

        // 3. Insert at Target
        const insertTarget = (items: MenuItem[]): boolean => {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.id === targetId) {
                    // Match!
                    if (placement === 'child') {
                        if (!item.sub) item.sub = [];
                        item.sub.push(sourceItem!);
                        // Expand if inserted as child
                        setCollapsedItems(prev => {
                            const next = new Set(prev);
                            next.delete(targetId);
                            return next;
                        });
                    } else if (placement === 'before') {
                        items.splice(i, 0, sourceItem!);
                    } else if (placement === 'after') {
                        items.splice(i + 1, 0, sourceItem!);
                    }
                    return true; // Done
                }

                if (item.sub && item.sub.length > 0) {
                    if (insertTarget(item.sub as MenuItem[])) return true;
                }
            }
            return false;
        };

        const inserted = insertTarget(newTree);
        if (!inserted) {
            newTree.push(sourceItem);
        }

        return newTree;
    };

    const cleanMenuData = (items: (MenuItem | string)[], parentIdPath: string): MenuItem[] => {
        return items.map((item) => standardizeMenuItem(item, parentIdPath));
    };

    const autoSave = async (newData: SiteDataType) => {
        // Track history before making changes (for undo/redo)
        if (allMenuData) {
            historyActions.set(allMenuData);
        }

        // Deep Cleanse Data before setting State or Saving
        Object.keys(newData).forEach(site => {
            newData[site].menu = cleanMenuData((newData[site].menu || []) as (MenuItem | string)[], site);
            if (newData[site].trash) {
                newData[site].trash = cleanMenuData((newData[site].trash || []) as (MenuItem | string)[], `${site}/trash`);
            }
        });

        setAllMenuData(newData); // Optimistic Update with CLEAN data
        setSaveStatus('saving');
        try {
            await menuServiceV11.saveMenuConfig(newData);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000);
        } catch (e: any) {
            console.error("Auto-save failed:", e);
            setSaveStatus('error');

            // Rollback on error
            if (allMenuData) {
                setAllMenuData(allMenuData);
            }

            let errorMsg = "변경사항을 저장하지 못했습니다.";
            if (e.issues) {
                errorMsg += "\n" + e.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
            } else if (e.message) {
                errorMsg += "\n" + e.message;
            }
            Swal.fire("저장 실패", errorMsg, "error");
        }
    };


    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        if (!allMenuData) return;

        const { active, over } = event;
        if (!over) return;

        const activeIdStr = String(active.id);
        const overIdStr = String(over.id);

        const currentSiteData = allMenuData[selectedSite];

        // Drop into Trash
        if (overIdStr === 'trash-zone' && !activeIdStr.startsWith('available-')) {
            handleSoftDelete(activeIdStr);
            return;
        }

        // Available item -> insert
        if (activeIdStr.startsWith('available-')) {
            const realId = activeIdStr.replace('available-', '');
            const newItem: MenuItem =
                realId === 'new-folder'
                    ? {
                        text: '새 폴더 (그룹)',
                        id: createRandomId(),
                        path: '',
                        sub: [],
                        icon: 'fa-folder'
                    }
                    : {
                        text: realId,
                        id: createRandomId(),
                        path: MENU_PATHS[realId] ?? '',
                        sub: []
                    };

            const insertAfter = (items: MenuItem[]): boolean => {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].id === overIdStr) {
                        items.splice(i + 1, 0, newItem);
                        return true;
                    }
                    if (items[i].sub && insertAfter(items[i].sub as MenuItem[])) return true;
                }
                return false;
            };

            const newMenu = JSON.parse(JSON.stringify(currentSiteData.menu)) as MenuItem[];
            if (!insertAfter(newMenu)) {
                newMenu.push(newItem);
            }

            autoSave({
                ...allMenuData,
                [selectedSite]: { ...currentSiteData, menu: newMenu }
            });
            return;
        }

        // Tree -> Tree (reorder)
        const moved = moveNode(currentSiteData.menu, activeIdStr, overIdStr, 'after');
        autoSave({
            ...allMenuData,
            [selectedSite]: { ...currentSiteData, menu: moved }
        });
    };

    const handleAddFolder = () => {
        if (!allMenuData) return;
        const currentSiteData = allMenuData[selectedSite];
        const newFolder: MenuItem = {
            text: '새 폴더',
            id: createRandomId(),
            path: '',
            sub: [],
            icon: 'fa-folder'
        };

        autoSave({
            ...allMenuData,
            [selectedSite]: { ...currentSiteData, menu: [...currentSiteData.menu, newFolder] }
        });
    };

    const handleReset = async () => {
        const result = await Swal.fire({
            title: '메뉴 초기화',
            text: `정말로 [${allMenuData?.[selectedSite].name}] 메뉴를 코드 기본값으로 복원하시겠습니까?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: '네, 초기화합니다',
            cancelButtonText: '취소'
        });

        if (result.isConfirmed) {
            try {
                const { DEFAULT_MENU_CONFIG } = await import('../../constants/defaultMenu');
                // 항상 코드 기본값(DEFAULT_MENU_CONFIG)을 사용
                const resetTargetSiteConfig = DEFAULT_MENU_CONFIG[selectedSite];

                if (!resetTargetSiteConfig) {
                    Swal.fire('오류', '기본 설정 데이터를 찾을 수 없습니다.', 'error');
                    return;
                }

                const newData = {
                    ...allMenuData,
                    [selectedSite]: {
                        ...resetTargetSiteConfig,
                        menu: resetTargetSiteConfig.menu.map((item) => standardizeMenuItem(item, selectedSite))
                    }
                };

                await autoSave(newData as SiteDataType);
                Swal.fire('완료', '메뉴가 코드 기본값으로 초기화되었습니다.', 'success');
            } catch (error) {
                console.error(error);
                Swal.fire('오류', '초기화 중 문제가 발생했습니다.', 'error');
            }
        }
    };

    const handleResetAllSettings = async () => {
        const result = await Swal.fire({
            title: 'settings 전체 초기화',
            text: 'Firestore settings/menus_v11을 코드 기본값으로 전체 덮어씁니다. 계속하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: '네, 전체 초기화합니다',
            cancelButtonText: '취소'
        });

        if (!result.isConfirmed) return;

        setSaveStatus('saving');
        try {
            await menuServiceV11.resetToDefault();
            Swal.fire('완료', 'settings 메뉴 설정이 코드 기본값으로 초기화되었습니다.', 'success');
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000);
        } catch (error) {
            console.error(error);
            setSaveStatus('error');
            Swal.fire('오류', 'settings 전체 초기화 중 문제가 발생했습니다.', 'error');
        }
    };

    // Sync all position menus from defaultMenu to Firestore
    const handleSyncAllPositions = async () => {
        const result = await Swal.fire({
            title: '직책 메뉴 동기화',
            text: '모든 직책별 메뉴(pos_*)를 기본값으로 Firestore에 동기화합니다. 계속하시겠습니까?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#6366f1',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: '네, 동기화합니다',
            cancelButtonText: '취소'
        });

        if (result.isConfirmed) {
            try {
                const { DEFAULT_MENU_CONFIG } = await import('../../constants/defaultMenu');
                const positionKeys = Object.keys(DEFAULT_MENU_CONFIG).filter(key => key.startsWith('pos_'));

                if (positionKeys.length === 0) {
                    Swal.fire('오류', '직책별 메뉴 설정을 찾을 수 없습니다.', 'error');
                    return;
                }

                const newData = { ...allMenuData } as SiteDataType;
                positionKeys.forEach(key => {
                    const defaultConfig = DEFAULT_MENU_CONFIG[key];
                    if (defaultConfig) {
                        newData[key] = {
                            ...defaultConfig,
                            menu: defaultConfig.menu.map((item) => standardizeMenuItem(item, key))
                        };
                    }
                });

                await autoSave(newData);
                Swal.fire('완료', `${positionKeys.length}개의 직책별 메뉴가 동기화되었습니다.`, 'success');
            } catch (error) {
                console.error(error);
                Swal.fire('오류', '동기화 중 문제가 발생했습니다.', 'error');
            }
        }
    };

    // Save current menu as backup to Firestore
    const handleSaveAsDefault = async () => {
        if (!allMenuData) return;

        const result = await Swal.fire({
            title: '메뉴 백업',
            text: '현재 메뉴 설정을 Firestore에 백업합니다. 나중에 "백업 복원"으로 이 상태로 돌아올 수 있습니다.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: '네, 백업합니다',
            cancelButtonText: '취소'
        });

        if (result.isConfirmed) {
            try {
                await menuServiceV11.saveAsDefault(allMenuData);
                Swal.fire('완료', '현재 메뉴가 백업되었습니다.', 'success');
            } catch (error) {
                console.error(error);
                Swal.fire('오류', '백업 중 문제가 발생했습니다.', 'error');
            }
        }
    };

    // Restore menu from backup in Firestore
    const handleRestoreBackup = async () => {
        const result = await Swal.fire({
            title: '백업 복원',
            text: '저장된 백업에서 메뉴를 복원하시겠습니까?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: '네, 복원합니다',
            cancelButtonText: '취소'
        });

        if (result.isConfirmed) {
            try {
                const backup = await menuServiceV11.getCustomDefault();
                if (!backup || !backup[selectedSite]) {
                    Swal.fire('오류', '저장된 백업이 없습니다.', 'warning');
                    return;
                }

                const newData = {
                    ...allMenuData,
                    [selectedSite]: {
                        ...backup[selectedSite],
                        menu: backup[selectedSite].menu.map((item) => standardizeMenuItem(item, selectedSite))
                    }
                };

                await autoSave(newData as SiteDataType);
                Swal.fire('완료', '백업에서 메뉴가 복원되었습니다.', 'success');
            } catch (error) {
                console.error(error);
                Swal.fire('오류', '복원 중 문제가 발생했습니다.', 'error');
            }
        }
    };

    const handleRemove = (id: string) => {
        handleSoftDelete(id); // Use Soft Delete instead of hard delete
    };

    const handleRename = (id: string, newName: string) => {
        if (!allMenuData) return;
        const currentSiteData = allMenuData[selectedSite];
        let newMenu = JSON.parse(JSON.stringify(currentSiteData.menu)) as MenuItem[];

        // Recursive Rename
        const renameRecursive = (items: MenuItem[]): boolean => {
            for (const item of items) {
                if (item.id === id) {
                    item.text = newName;
                    return true;
                }
                if (item.sub) {
                    if (renameRecursive(item.sub as MenuItem[])) return true;
                }
            }
            return false;
        };

        renameRecursive(newMenu);

        const newData = {
            ...allMenuData,
            [selectedSite]: { ...currentSiteData, menu: newMenu }
        };
        autoSave(newData);
    };

    // === Move Handlers ===
    const handleMoveUp = (id: string) => {
        if (!allMenuData) return;
        const currentSiteData = allMenuData[selectedSite];
        let newMenu = JSON.parse(JSON.stringify(currentSiteData.menu)) as MenuItem[];

        const moveUpRecursive = (items: MenuItem[]): boolean => {
            for (let i = 0; i < items.length; i++) {
                if (items[i].id === id && i > 0) {
                    [items[i - 1], items[i]] = [items[i], items[i - 1]];
                    return true;
                }
                if (items[i].sub && moveUpRecursive(items[i].sub as MenuItem[])) return true;
            }
            return false;
        };

        moveUpRecursive(newMenu);
        autoSave({ ...allMenuData, [selectedSite]: { ...currentSiteData, menu: newMenu } });
    };

    const handleMoveDown = (id: string) => {
        if (!allMenuData) return;
        const currentSiteData = allMenuData[selectedSite];
        let newMenu = JSON.parse(JSON.stringify(currentSiteData.menu)) as MenuItem[];

        const moveDownRecursive = (items: MenuItem[]): boolean => {
            for (let i = 0; i < items.length; i++) {
                if (items[i].id === id && i < items.length - 1) {
                    [items[i], items[i + 1]] = [items[i + 1], items[i]];
                    return true;
                }
                if (items[i].sub && moveDownRecursive(items[i].sub as MenuItem[])) return true;
            }
            return false;
        };

        moveDownRecursive(newMenu);
        autoSave({ ...allMenuData, [selectedSite]: { ...currentSiteData, menu: newMenu } });
    };

    const handleMoveToParent = (id: string) => {
        if (!allMenuData) return;
        const currentSiteData = allMenuData[selectedSite];
        let newMenu = JSON.parse(JSON.stringify(currentSiteData.menu)) as MenuItem[];

        let targetItem: MenuItem | null = null;

        // First, find and extract the item, then place at parent level
        const moveToParent = (items: MenuItem[]): boolean => {
            for (let i = 0; i < items.length; i++) {
                const itemSub = items[i].sub as MenuItem[] | undefined;
                if (itemSub) {
                    for (let j = 0; j < itemSub.length; j++) {
                        const sub = itemSub[j] as MenuItem;
                        if (sub.id === id) {
                            targetItem = itemSub.splice(j, 1)[0] as MenuItem;
                            items.splice(i + 1, 0, targetItem);
                            return true;
                        }
                    }
                    if (moveToParent(itemSub)) return true;
                }
            }
            return false;
        };

        moveToParent(newMenu);
        autoSave({ ...allMenuData, [selectedSite]: { ...currentSiteData, menu: newMenu } });
    };

    const handleMoveToChild = (id: string) => {
        if (!allMenuData) return;
        const currentSiteData = allMenuData[selectedSite];
        let newMenu = JSON.parse(JSON.stringify(currentSiteData.menu)) as MenuItem[];

        // Move item into the previous sibling as a child
        const moveToChild = (items: MenuItem[]): boolean => {
            for (let i = 0; i < items.length; i++) {
                if (items[i].id === id && i > 0) {
                    const targetItem = items.splice(i, 1)[0];
                    if (!items[i - 1].sub) items[i - 1].sub = [];
                    (items[i - 1].sub as MenuItem[]).push(targetItem);
                    // Expand the parent
                    setCollapsedItems(prev => {
                        const next = new Set(prev);
                        next.delete(items[i - 1].id!);
                        return next;
                    });
                    return true;
                }
                if (items[i].sub && moveToChild(items[i].sub as MenuItem[])) return true;
            }
            return false;
        };

        moveToChild(newMenu);
        autoSave({ ...allMenuData, [selectedSite]: { ...currentSiteData, menu: newMenu } });
    };

    // Calculate Available Items (Effect)
    useEffect(() => {
        if (!allMenuData) return;
        const usedPaths = new Set<string>();
        const collectPaths = (items: MenuItem[]) => {
            items.forEach(item => {
                if (item.path) usedPaths.add(item.path);
                if (item.sub) collectPaths(item.sub as MenuItem[]);
            });
        };
        collectPaths(allMenuData[selectedSite].menu);

        const orphans = Object.entries(MENU_PATHS)
            .filter(([_, path]) => !usedPaths.has(path))
            .map(([text, path]) => ({
                id: text,
                text,
                path
            }))
            .sort((a, b) => a.text.localeCompare(b.text, 'ko'));
        setAvailableItems(orphans);
    }, [allMenuData, selectedSite]);

    // --- Helper to update item recursively ---
    const updateItemInTree = (items: MenuItem[], id: string, updates: Partial<MenuItem>): MenuItem[] => {
        return items.map(item => {
            if (item.id === id) {
                return { ...item, ...updates };
            }
            if (item.sub && item.sub.length > 0) {
                const newSub = item.sub.map(subItem => {
                    if (typeof subItem === 'string') return subItem;
                    const updatedItems = updateItemInTree([subItem], id, updates);
                    return updatedItems[0];
                });
                return { ...item, sub: newSub as any };
            }
            return item;
        });
    };

    const handleUpdateItem = (id: string, updates: { icon?: string; hoverColor?: string }) => {
        if (!allMenuData) return;

        setAllMenuData(prev => {
            if (!prev) return null;
            const newData = { ...prev };
            const currentMenu = newData[selectedSite]?.menu || [];

            newData[selectedSite].menu = updateItemInTree(currentMenu, id, updates);

            return newData;
        });

        // Trigger Auto Save
        autoSave({
            ...allMenuData,
            [selectedSite]: {
                ...allMenuData[selectedSite],
                menu: updateItemInTree(allMenuData[selectedSite].menu, id, updates)
            }
        });
    };

    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [editingItemData, setEditingItemData] = useState<{ id: string, name: string, icon?: string, hoverColor?: string } | null>(null);

    const openSettings = (item: MenuItem) => {
        setEditingItemData({
            id: item.id || '',
            name: item.text,
            icon: item.icon,
            hoverColor: item.hoverColor
        });
        setSettingsModalOpen(true);
    };



    if (!allMenuData) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">메뉴 데이터 로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="p-6 max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl text-white shadow-lg shadow-indigo-500/30">
                                    <FontAwesomeIcon icon={faSitemap} />
                                </div>
                                메뉴 관리 (DnD)
                            </h1>
                            <p className="text-slate-500 mt-1 ml-[52px]">드래그 앤 드롭으로 메뉴 구조를 편집합니다.</p>
                        </div>

                        <button
                            onClick={handleAddFolder}
                            className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            폴더 추가
                        </button>
                    </div>

                    {/* Toolbar */}
                    <div className="mt-6 flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 bg-slate-50 text-slate-600 rounded-lg font-medium hover:bg-slate-100 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faRotateLeft} />
                            초기화
                        </button>

                        <button
                            onClick={handleResetAllSettings}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faRotateLeft} />
                            settings 전체 초기화
                        </button>

                        <button
                            onClick={handleSaveAsDefault}
                            className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg font-medium hover:bg-emerald-100 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSitemap} />
                            메뉴 백업
                        </button>

                        <button
                            onClick={handleRestoreBackup}
                            className="px-4 py-2 bg-sky-50 text-sky-600 rounded-lg font-medium hover:bg-sky-100 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faRotateLeft} />
                            백업 복원
                        </button>

                        <button
                            onClick={handleSyncAllPositions}
                            className="px-4 py-2 bg-violet-50 text-violet-600 rounded-lg font-medium hover:bg-violet-100 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSync} />
                            직책 동기화
                        </button>

                        <div className="w-px h-8 bg-slate-200 mx-2" />

                        {/* Undo/Redo Buttons */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleUndo}
                                disabled={!historyActions.canUndo}
                                className={`px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${historyActions.canUndo
                                    ? 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                    }`}
                                title="실행 취소 (Ctrl+Z)"
                            >
                                <FontAwesomeIcon icon={faUndo} />
                            </button>
                            <button
                                onClick={handleRedo}
                                disabled={!historyActions.canRedo}
                                className={`px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${historyActions.canRedo
                                    ? 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                    }`}
                                title="다시 실행 (Ctrl+Shift+Z)"
                            >
                                <FontAwesomeIcon icon={faRotate} />
                            </button>
                        </div>

                        <div className="w-px h-8 bg-slate-200 mx-2" />

                        <select
                            value={selectedSite}
                            onChange={(e) => setSelectedSite(e.target.value)}
                            className="pl-3 pr-8 py-2 bg-slate-50 rounded-lg text-slate-600 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 border-transparent focus:border-indigo-500 transition-all"
                        >
                            {allMenuData && Object.keys(allMenuData).map(site => (
                                <option key={site} value={site}>{allMenuData[site].name}</option>
                            ))}
                        </select>

                        {/* Status Indicator */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                            {saveStatus === 'saving' && (
                                <>
                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    <span className="text-xs text-slate-500 font-medium">저장 중...</span>
                                </>
                            )}
                            {saveStatus === 'saved' && (
                                <>
                                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                    <span className="text-xs text-slate-500 font-medium">저장됨</span>
                                </>
                            )}
                            {saveStatus === 'error' && (
                                <>
                                    <div className="w-2 h-2 rounded-full bg-red-400" />
                                    <span className="text-xs text-red-500 font-medium">저장 실패</span>
                                </>
                            )}
                            {saveStatus === 'idle' && (
                                <span className="text-xs text-slate-400">대기 중</span>
                            )}
                        </div>
                    </div>
                </div>


                {/* Main Content */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">

                    {/* Left Panel: Available Modules */}
                    <MenuSidebar availableItems={availableItems} />

                    {/* Right Panel: Menu Tree */}
                    <div className="flex-1 w-full bg-white rounded-xl border border-slate-200 shadow-sm min-h-[600px] flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center rounded-t-xl">
                            <h3 className="font-bold text-slate-700">현재 메뉴 구조</h3>
                            <div className="text-xs text-slate-400 flex items-center gap-4">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                    더블클릭: 수정
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                    Ctrl+Z: 취소
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                    Delete: 삭제
                                </span>
                            </div>
                        </div>

                        <div className="p-6 flex-1">
                            {allMenuData && (
                                <SortableContext
                                    items={allMenuData[selectedSite].menu.map(i => i.id!)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <MenuTree
                                        items={allMenuData[selectedSite].menu}
                                        selectedItemId={selectedItemId}
                                        collapsedItems={collapsedItems}
                                        onToggleCollapse={(id) => {
                                            setCollapsedItems(prev => {
                                                const next = new Set(prev);
                                                if (next.has(id)) next.delete(id);
                                                else next.add(id);
                                                return next;
                                            });
                                        }}
                                        onRemove={handleRemove}
                                        onRename={handleRename}
                                        onSettingsClick={openSettings}
                                        onMoveUp={handleMoveUp}
                                        onMoveDown={handleMoveDown}
                                        onMoveToParent={handleMoveToParent}
                                        onMoveToChild={handleMoveToChild}
                                        onSelect={setSelectedItemId}
                                    />
                                </SortableContext>
                            )}

                            {allMenuData && allMenuData[selectedSite].menu.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                    <FontAwesomeIcon icon={faSitemap} className="text-4xl mb-3 opacity-20" />
                                    <p>메뉴 항목을 왼쪽에서 드래그하여 추가하세요</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Trash Drop Zone */}
                {allMenuData && (
                    <MenuTrashBin
                        count={allMenuData[selectedSite].trash?.length || 0}
                        items={allMenuData[selectedSite].trash || []}
                        onRestore={handleRestore}
                        onHardDelete={handleHardDelete}
                        onEmpty={handleEmptyTrash}
                        isDragging={!!activeId}
                    />
                )}
            </div>

            <DragOverlay>
                {activeId ? (
                    activeId.toString().startsWith('available-') ? (
                        // Render Available Item Drag Preview
                        <div className="p-3 bg-white rounded-lg border border-indigo-300 shadow-xl opacity-90 w-64 flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-500 rounded-lg">
                                <FontAwesomeIcon icon={faPlus} size="sm" />
                            </div>
                            <span className="font-medium text-slate-800">
                                {activeId.toString().replace('available-', '') === 'new-folder' ? '새 폴더 (그룹)' : activeId.toString().replace('available-', '')}
                            </span>
                        </div>
                    ) : (
                        // Render Sortable Item Drag Preview
                        <div className="p-3 bg-white rounded-lg border border-indigo-500 shadow-2xl opacity-90 w-64 flex items-center gap-3 ring-2 ring-indigo-200">
                            <FontAwesomeIcon icon={faGripVertical} className="text-slate-400" />
                            <FontAwesomeIcon icon={faFolder} className="text-indigo-400" />
                            <span className="font-bold text-slate-800">Moving Item...</span>
                        </div>
                    )
                ) : null}
            </DragOverlay>

            <MenuSettingsModal
                isOpen={settingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
                onSave={handleUpdateItem}
                itemId={editingItemData?.id || ''}
                itemName={editingItemData?.name || ''}
                initialIcon={editingItemData?.icon}
                initialHoverColor={editingItemData?.hoverColor}
            />

        </DndContext>
    );
};

export default MenuManagementDnD;
