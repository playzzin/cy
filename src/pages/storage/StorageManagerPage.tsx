
import React, { useState, useEffect, useRef } from 'react';
import { storageService, StorageItem } from '../../services/storageService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFolder, faFile, faFileImage, faFilePdf, faFileWord, faFileExcel, faCloudUploadAlt,
    faTrash, faDownload, faHdd, faChevronRight, faHome, faPlus, faSpinner, faEllipsisV,
    faThLarge, faList, faSearch, faSort, faPencilAlt, faTimes, faFolderOpen
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DndContext,
    useDraggable,
    useDroppable,
    DragEndEvent,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    TouchSensor,
    DragStartEvent
} from '@dnd-kit/core';

// --- Visual & Helper Components ---

// High fidelity icon helper
const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return faFileImage;
    if (ext === 'pdf') return faFilePdf;
    if (['doc', 'docx'].includes(ext || '')) return faFileWord;
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return faFileExcel;
    return faFile;
};

// --- Draggable File Card ---
const StorageItemCard = ({ item, viewMode, onClick, onContextMenu, isDragOverlay = false }: any) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: item.fullPath,
        data: { item, type: 'file' },
        disabled: item.isFolder // Only files draggable yet
    });

    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: item.fullPath,
        data: { item, type: 'folder' },
        disabled: !item.isFolder
    });

    // Combined Refs
    const setRef = (node: HTMLElement | null) => {
        setNodeRef(node);
        if (item.isFolder) setDropRef(node);
    };

    // Visual States
    const isFolderOpen = isOver && item.isFolder;

    // Class Names
    const baseClasses = `
        group relative cursor - pointer select - none transition - all duration - 200
        ${viewMode === 'grid'
            ? 'p-4 flex flex-col items-center text-center rounded-2xl border bg-white'
            : 'px-4 py-3 flex items-center gap-4 rounded-xl border-b border-slate-50 hover:bg-slate-50'
        }
        ${isDragOverlay ? 'shadow-2xl scale-105 rotate-2 bg-white/90 backdrop-blur ring-2 ring-indigo-500 z-50' : 'hover:shadow-md hover:border-indigo-200'}
        ${isDragging ? 'opacity-30 grayscale' : 'opacity-100'}
        ${isFolderOpen ? 'ring-2 ring-indigo-500 bg-indigo-50 border-indigo-500 scale-105 shadow-xl z-10' : 'border-slate-100'}
`;

    return (
        <div
            ref={setRef}
            className={baseClasses}
            {...listeners}
            {...attributes}
            onClick={onClick}
            onContextMenu={onContextMenu}
        >
            <div className={`relative ${viewMode === 'grid' ? 'text-5xl mb-3 mt-2' : 'text-2xl w-8 text-center'} text - slate - 500 transition - transform duration - 300 ${isFolderOpen ? 'scale-110' : ''} `}>
                <FontAwesomeIcon
                    icon={item.isFolder ? (isFolderOpen ? faFolderOpen : faFolder) : getFileIcon(item.name)}
                    className={`
                        ${item.isFolder ? 'text-yellow-400 drop-shadow-sm' : ''}
                        ${['doc', 'docx'].includes(item.name.split('.').pop() || '') ? 'text-blue-500' : ''}
                        ${['xls', 'xlsx', 'csv'].includes(item.name.split('.').pop() || '') ? 'text-green-500' : ''}
                        ${['pdf'].includes(item.name.split('.').pop() || '') ? 'text-red-500' : ''}
                        ${['jpg', 'png', 'jpeg'].includes(item.name.split('.').pop() || '') ? 'text-purple-500' : ''}
`}
                />
                {/* Badge for Folder Contents (Simulated) */}
                {item.isFolder && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm border border-slate-100">
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full opacity-50"></div>
                    </div>
                )}
            </div>

            <div className={`flex - 1 min - w - 0 ${viewMode === 'grid' ? 'w-full' : 'flex justify-between items-center'} `}>
                <div className={`font - semibold text - slate - 700 truncate w - full ${viewMode === 'grid' ? 'text-sm' : 'text-base'} `}>
                    {item.name}
                </div>
                {viewMode === 'list' && (
                    <div className="text-xs text-slate-400 flex gap-4">
                        <span>{item.isFolder ? 'Folder' : (item.size ? `${(item.size / 1024).toFixed(1)} KB` : 'File')}</span>
                        {item.updatedAt && <span>{new Date(item.updatedAt).toLocaleDateString()}</span>}
                    </div>
                )}
            </div>

            {/* Quick Actions (Hover) */}
            {!isDragOverlay && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600">
                        <FontAwesomeIcon icon={faEllipsisV} />
                    </button>
                </div>
            )}
        </div>
    );
};

// --- Breadcrumb Component ---
const DroppableBreadcrumb = ({ path, name, isLast, onClick }: any) => {
    const { setNodeRef, isOver } = useDroppable({
        id: path || 'root',
        data: { path, type: 'breadcrumb' }
    });

    return (
        <div ref={setNodeRef} className={`relative flex items - center transition - all duration - 200 ${isOver ? 'z-10' : ''} `}>

            {isOver && (
                <motion.div
                    layoutId="breadcrumb-glow"
                    className="absolute inset-0 bg-indigo-100 rounded-md -z-10 ring-2 ring-indigo-400"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1.1 }}
                />
            )}

            {!name ? (
                <button onClick={onClick} className={`px - 2 py - 1 rounded - md transition - colors ${isOver ? 'text-indigo-700 font-bold' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'} `}>
                    <FontAwesomeIcon icon={faHome} />
                </button>
            ) : (
                <>
                    <FontAwesomeIcon icon={faChevronRight} className="mx-2 text-[10px] text-slate-300" />
                    <button onClick={onClick} className={`font - medium px - 2 py - 1 rounded - md transition - colors ${isOver ? 'text-indigo-700 font-bold' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'} `}>
                        {name}
                    </button>
                </>
            )}
        </div>
    );
};


// --- Skeleton Loader ---
const StorageSkeleton = () => (
    <div className="animate-pulse flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-100 h-[140px] justify-center">
        <div className="w-12 h-12 bg-slate-100 rounded-xl mb-4"></div>
        <div className="h-4 bg-slate-100 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-slate-50 rounded w-1/2"></div>
    </div>
);


// --- Main Page Component ---
const StorageManagerPage: React.FC = () => {
    const [currentPath, setCurrentPath] = useState('');
    const [items, setItems] = useState<StorageItem[]>([]);
    const [loading, setLoading] = useState(false); // Initial Load
    const [isProcessing, setIsProcessing] = useState(false); // Background Ops
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchText, setSearchText] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'size' | 'date', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // DnD State
    const [activeDragItem, setActiveDragItem] = useState<StorageItem | null>(null);
    const [isDragOver, setIsDragOver] = useState(false); // Native DnD

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: StorageItem } | null>(null);



    // Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor)
    );

    useEffect(() => {
        loadItems(currentPath);
    }, [currentPath]);

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const loadItems = async (path: string) => {
        setLoading(true);
        try {
            const fileList = await storageService.listFiles(path);
            setItems(fileList.filter(item => item.name !== '.keep'));
        } catch (error: any) {
            console.error('Storage Error:', error);
            Swal.fire('오류', '파일 목록 로드 실패', 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---

    const handleUploadFiles = async (files: FileList | File[]) => {
        if (!files || files.length === 0) return;
        setIsProcessing(true);
        const total = files.length;
        // Optimistic: We can't easily show file before upload without a fake item. 
        // For upload, we'll use a traditional progress toast.

        try {
            for (let i = 0; i < total; i++) {
                await storageService.uploadFile(currentPath, files[i]);
            }
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            Toast.fire({ icon: 'success', title: 'Upload Complete' });
            loadItems(currentPath);
        } catch (error) {
            Swal.fire('실패', '업로드 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragItem(event.active.data.current?.item as StorageItem);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragItem(null);
        if (!over) return;

        const activeItem = active.data.current?.item as StorageItem;
        const targetType = over.data.current?.type;

        let targetPath = '';
        let moveDescription = '';
        let isParentMove = false;

        // Determine Target
        if (targetType === 'breadcrumb') {
            targetPath = over.data.current?.path || '';
            if (targetPath === currentPath) return; // Same path
            moveDescription = `to ${over.data.current?.name || 'Home'} `;
            isParentMove = true;
        } else if (targetType === 'folder') {
            const overItem = over.data.current?.item as StorageItem;
            if (activeItem.fullPath === overItem.fullPath) return; // Self

            if (overItem.name === '..') {
                targetPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                moveDescription = 'to Parent Folder';
                isParentMove = true;
            } else {
                targetPath = overItem.fullPath;
                moveDescription = `to ${overItem.name} `;
            }
        } else {
            return; // Not a valid drop target
        }

        // --- Optimistic Move Logic ---

        // 1. Snapshot previous state
        const previousItems = [...items];

        // 2. Remove item from UI immediately
        setItems(prev => prev.filter(i => i.fullPath !== activeItem.fullPath));

        // 3. Show non-blocking feedback
        const Toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 2000 });
        Toast.fire({ icon: 'info', title: `Moving ${activeItem.name}...` });

        // 4. Perform background operation
        try {
            const newPath = isParentMove
                ? (targetPath ? `${targetPath}/${activeItem.name}` : activeItem.name)
                : `${targetPath}/${activeItem.name}`;

            await storageService.moveFile(activeItem.fullPath, newPath);

            // Success: No action needed, item is already gone.
            // If we moved within view (unlikely for file-to-folder), we might need to refresh trigger.
            // But usually file enters folder -> disappears.

            Toast.fire({ icon: 'success', title: 'Moved successfully' });

        } catch (error) {
            // 5. Rollback on Error
            console.error("Move failed", error);
            setItems(previousItems); // Restore
            Swal.fire({
                icon: 'error',
                title: 'Move Failed',
                text: 'Could not move the file. Restoring...',
                toast: true,
                position: 'bottom-end',
                timer: 3000
            });
        }
    };

    const handleCreateFolder = async () => {
        const { value: folderName } = await Swal.fire({
            title: '새 폴더',
            input: 'text',
            inputPlaceholder: 'Folder Name',
            showCancelButton: true
        });

        if (folderName) {
            // Optimistic Folder Creation? No, fast enough usually.
            try {
                await storageService.createFolder(currentPath, folderName);
                loadItems(currentPath);
            } catch (error) {
                Swal.fire('오류', '폴더 생성 실패', 'error');
            }
        }
    };

    const handleItemClick = (item: StorageItem) => {
        if (item.isFolder) {
            if (item.name === '..') {
                const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                setCurrentPath(parentPath);
                return;
            }
            const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
            setCurrentPath(newPath);
        } else {
            handleFileAction(item);
        }
    };

    // ... (File Actions: Open, Edit, Delete - unchanged mostly, just cleaner)
    const handleFileAction = async (item: StorageItem) => {
        try {
            const url = await storageService.getDownloadUrl(item.fullPath);
            window.open(url, '_blank');
        } catch (e) {
            Swal.fire('Error', 'Link Error', 'error');
        }
    };




    const handleDelete = async (item: StorageItem) => {
        const result = await Swal.fire({
            title: '삭제하시겠습니까?',
            text: item.name,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: '삭제'
        });

        if (result.isConfirmed) {
            const prev = [...items];
            setItems(curr => curr.filter(i => i.fullPath !== item.fullPath)); // Optimistic
            try {
                await storageService.deleteFile(item.fullPath);
            } catch (e) {
                setItems(prev); // Rollback
                Swal.fire('오류', '삭제 실패', 'error');
            }
        }
    };

    // --- Render Helpers ---

    const toggleSort = (key: 'name' | 'size' | 'date') => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const displayItems = [...items];
    if (currentPath) {
        displayItems.unshift({
            name: '..',
            fullPath: currentPath.substring(0, currentPath.lastIndexOf('/')),
            isFolder: true,
            size: 0,
            updatedAt: new Date().toISOString()
        });
    }

    const sortedItems = displayItems.filter(item =>
        item.name.toLowerCase().includes(searchText.toLowerCase())
    ).sort((a, b) => {
        if (a.name === '..') return -1;
        if (b.name === '..') return 1;
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        if (sortConfig.key === 'name') return a.name.localeCompare(b.name) * dir;
        return 0;
    });

    const renderBreadcrumbs = () => {
        const parts = currentPath ? currentPath.split('/') : [];
        return (
            <div className="flex items-center text-sm text-slate-500 mb-6 bg-white/50 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/60 shadow-sm sticky top-0 z-20">
                <DroppableBreadcrumb path="" onClick={() => setCurrentPath('')} />
                {parts.map((part, index) => {
                    const path = parts.slice(0, index + 1).join('/');
                    return (
                        <DroppableBreadcrumb
                            key={path}
                            path={path}
                            name={part}
                            onClick={() => setCurrentPath(path)}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="bg-slate-50 min-h-screen p-6 flex gap-6 relative overflow-hidden">

                {/* Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none" />

                {/* Left Sidebar (Compact) */}
                <div className="hidden lg:flex w-64 flex-col gap-6 shrink-0 z-10">
                    <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl sticky top-6">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-2xl shadow-lg shadow-indigo-200 text-white">
                                <FontAwesomeIcon icon={faHdd} className="text-xl" />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-800 text-lg">My Cloud</h2>
                                <p className="text-xs text-slate-400 font-medium">102.4 GB Used</p>
                            </div>
                        </div>

                        <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-3 mb-4 text-sm group">
                            <FontAwesomeIcon icon={faCloudUploadAlt} className="group-hover:animate-bounce" /> Upload File
                        </button>
                        <button onClick={handleCreateFolder} className="w-full py-4 bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 text-slate-700 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-3 text-sm">
                            <FontAwesomeIcon icon={faFolder} className="text-yellow-500" /> New Folder
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col z-10 w-full max-w-7xl mx-auto">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div className="relative w-full max-w-xl">
                            <input
                                type="text"
                                placeholder="Search everything..."
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm text-slate-700 placeholder:text-slate-400"
                            />
                            <FontAwesomeIcon icon={faSearch} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                        </div>

                        <div className="flex gap-2 ml-4">
                            <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm">
                                <button onClick={() => setViewMode('grid')} className={`p-3 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <FontAwesomeIcon icon={faThLarge} />
                                </button>
                                <button onClick={() => setViewMode('list')} className={`p-3 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <FontAwesomeIcon icon={faList} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {renderBreadcrumbs()}

                    {/* File Grid */}
                    <div className="flex-1 relative min-h-[500px]">

                        {/* Native DnD Zone */}
                        <div
                            className="h-full"
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragOver(false);
                                if (e.dataTransfer.files?.length) handleUploadFiles(e.dataTransfer.files);
                            }}
                        >
                            {/* Native Drop Overlay */}
                            <AnimatePresence>
                                {isDragOver && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 z-50 bg-indigo-500/10 backdrop-blur-md border-4 border-indigo-500 border-dashed rounded-3xl flex items-center justify-center"
                                    >
                                        <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center">
                                            <FontAwesomeIcon icon={faCloudUploadAlt} className="text-7xl text-indigo-600 mb-6 animate-bounce" />
                                            <h2 className="text-3xl font-bold text-slate-800">Drop files here</h2>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Content */}
                            {loading ? (
                                <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 'grid-cols-1'}`}>
                                    {[...Array(12)].map((_, i) => <StorageSkeleton key={i} />)}
                                </div>
                            ) : items.length === 0 && !currentPath ? (
                                <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
                                        <FontAwesomeIcon icon={faCloudUploadAlt} className="text-4xl text-indigo-200" />
                                    </div>
                                    <p className="font-bold text-lg text-slate-500">Your cloud is empty</p>
                                    <p className="text-sm">Drag and drop files to get started</p>
                                </div>
                            ) : (
                                <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" : "flex flex-col gap-2"}>
                                    <AnimatePresence mode='popLayout'>
                                        {sortedItems.map(item => (
                                            <motion.div
                                                layout
                                                key={item.fullPath}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                            >
                                                <StorageItemCard
                                                    item={item}
                                                    viewMode={viewMode}
                                                    onClick={() => handleItemClick(item)}
                                                    onContextMenu={(e: any) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item }); }}
                                                />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}


                        </div>
                    </div>
                </div>

                {/* Internal Drag Overlay (Follows Cursor) */}
                <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                    {activeDragItem ? (
                        <div className="w-64">
                            <StorageItemCard item={activeDragItem} viewMode="list" isDragOverlay />
                        </div>
                    ) : null}
                </DragOverlay>

                {/* Context Menu */}
                {contextMenu && (
                    <div className="fixed z-50 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-100 py-2 min-w-[200px]" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
                        <div className="px-4 py-2 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            {contextMenu.item.name}
                        </div>

                        <button onClick={() => { handleFileAction(contextMenu.item); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors">
                            <FontAwesomeIcon icon={faDownload} /> Open / Download
                        </button>
                        <button onClick={() => { handleDelete(contextMenu.item); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors">
                            <FontAwesomeIcon icon={faTrash} /> Delete
                        </button>
                    </div>
                )}

                {/* Excel Editor */}


                {/* Hidden Input */}
                <input type="file" multiple ref={fileInputRef} onChange={(e) => e.target.files && handleUploadFiles(e.target.files)} className="hidden" />
            </div>
        </DndContext>
    );
};

export default StorageManagerPage;
