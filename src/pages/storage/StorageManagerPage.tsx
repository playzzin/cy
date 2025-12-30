import React, { useState, useEffect, useRef } from 'react';
import { storageService, StorageItem } from '../../services/storageService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFolder, faFile, faFileImage, faFilePdf, faFileWord, faFileExcel, faCloudUploadAlt,
    faTrash, faDownload, faHdd, faChevronRight, faHome, faPlus, faSpinner, faEllipsisV,
    faThLarge, faList, faSearch, faSort, faPencilAlt, faTimes
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelEditor from '../../components/storage/ExcelEditor';

// Helper to get icon based on file type
const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return faFileImage;
    if (ext === 'pdf') return faFilePdf;
    if (['doc', 'docx'].includes(ext || '')) return faFileWord;
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return faFileExcel;
    return faFile; // default
};

const StorageManagerPage: React.FC = () => {
    const [currentPath, setCurrentPath] = useState('');
    const [items, setItems] = useState<StorageItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchText, setSearchText] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: StorageItem } | null>(null);

    // Excel Editor State
    const [editorVisible, setEditorVisible] = useState(false);
    const [editorFile, setEditorFile] = useState<{ url: string, name: string } | null>(null);

    // Initial Load
    useEffect(() => {
        loadItems(currentPath);
    }, [currentPath]);

    // Close context menu on click elsewhere
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
            Swal.fire('오류', `파일 목록을 불러오지 못했습니다.\n${error.message || error.code || error}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);

        try {
            await storageService.uploadFile(currentPath, file, (progress) => {
                setUploadProgress(progress);
            });
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
            Toast.fire({ icon: 'success', title: 'Upload Complete' });
            loadItems(currentPath);
        } catch (error) {
            Swal.fire('실패', '업로드 중 오류가 발생했습니다.', 'error');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleCreateFolder = async () => {
        const { value: folderName } = await Swal.fire({
            title: '새 폴더',
            input: 'text',
            inputLabel: '폴더 이름을 입력하세요',
            inputPlaceholder: 'Folder Name',
            showCancelButton: true
        });

        if (folderName) {
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
            const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
            setCurrentPath(newPath);
        } else {
            handleFileAction(item);
        }
    };

    const handleFileAction = async (item: StorageItem) => {
        // Check for Excel
        const ext = item.name.split('.').pop()?.toLowerCase();
        if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
            openExcelEditor(item);
            return;
        }

        // Default Action Download/Preview
        try {
            const url = await storageService.getDownloadUrl(item.fullPath);
            window.open(url, '_blank');
        } catch (e) {
            Swal.fire('오류', '파일 링크를 가져올 수 없습니다.', 'error');
        }
    };

    const openExcelEditor = async (item: StorageItem) => {
        try {
            setLoading(true);
            const url = await storageService.getDownloadUrl(item.fullPath);
            setEditorFile({ url, name: item.name });
            setEditorVisible(true);
        } catch (e) {
            Swal.fire('Error', 'Could not open file for editing', 'error');
        } finally {
            setLoading(false);
        }
    };

    const saveExcelFile = async (blob: Blob) => {
        if (!editorFile) return;
        // Convert Blob to File
        const file = new File([blob], editorFile.name, { type: blob.type });

        try {
            await storageService.uploadFile(currentPath, file); // Overwrite
            loadItems(currentPath); // Refresh list
        } catch (error) {
            console.error(error);
            throw new Error('Upload failed');
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
            try {
                await storageService.deleteFile(item.fullPath);
                loadItems(currentPath);
            } catch (e) {
                Swal.fire('오류', '삭제 실패', 'error');
            }
        }
    };

    const onContextMenu = (e: React.MouseEvent, item: StorageItem) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchText.toLowerCase())
    );

    const renderBreadcrumbs = () => {
        const parts = currentPath ? currentPath.split('/') : [];
        return (
            <div className="flex items-center text-sm text-slate-500 mb-4 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                <button onClick={() => setCurrentPath('')} className="hover:text-indigo-600 flex items-center gap-1 transition-colors">
                    <FontAwesomeIcon icon={faHome} />
                </button>
                {parts.map((part, index) => {
                    const path = parts.slice(0, index + 1).join('/');
                    return (
                        <React.Fragment key={path}>
                            <FontAwesomeIcon icon={faChevronRight} className="mx-2 text-[10px] text-slate-300" />
                            <button onClick={() => setCurrentPath(path)} className="hover:text-indigo-600 font-medium text-slate-700 transition-colors">
                                {part}
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-slate-50 min-h-screen p-6 flex gap-6">
            {/* Left Sidebar (Drive Stats) */}
            <div className="hidden lg:flex w-64 flex-col gap-6 shrink-0">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
                            <FontAwesomeIcon icon={faHdd} className="text-white text-lg" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">My Drive</h2>
                            <p className="text-xs text-slate-400">Cloud Storage</p>
                        </div>
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2 mb-3"
                    >
                        <FontAwesomeIcon icon={faCloudUploadAlt} /> Upload File
                    </button>
                    <button
                        onClick={handleCreateFolder}
                        className="w-full py-3 bg-white border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50 text-slate-700 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <FontAwesomeIcon icon={faFolder} className="text-yellow-500" /> New Folder
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-full max-w-md">
                            <input
                                type="text"
                                placeholder="Search files..."
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                            />
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm">
                            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                                <FontAwesomeIcon icon={faThLarge} />
                            </button>
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                                <FontAwesomeIcon icon={faList} />
                            </button>
                        </div>
                    </div>
                </div>

                {renderBreadcrumbs()}

                {/* File Area */}
                <div className="bg-white rounded-2xl border border-slate-200 flex-1 p-6 relative min-h-[500px] shadow-sm">
                    {loading && (
                        <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-indigo-500" />
                        </div>
                    )}

                    {/* Hidden Input */}
                    <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />

                    {items.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-3xl text-slate-300" />
                            </div>
                            <p className="font-medium text-slate-500">No files found</p>
                            <p className="text-sm">Upload files or create a folder</p>
                        </div>
                    ) : (
                        <motion.div
                            layout
                            className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" : "flex flex-col gap-1"}
                        >
                            <AnimatePresence>
                                {filteredItems.map(item => (
                                    <motion.div
                                        key={item.fullPath}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        layoutId={item.fullPath}
                                        onClick={() => handleItemClick(item)}
                                        onContextMenu={(e) => onContextMenu(e, item)}
                                        className={`
                                            group relative cursor-pointer border border-transparent rounded-xl transition-all duration-200 select-none
                                            ${viewMode === 'grid'
                                                ? 'p-4 flex flex-col items-center text-center hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-md hover:-translate-y-1'
                                                : 'px-4 py-3 flex items-center gap-4 hover:bg-slate-50 border-b border-slate-100 last:border-b-0'
                                            }
                                        `}
                                    >
                                        <div className={`${viewMode === 'grid' ? 'text-4xl mb-3 mt-2' : 'text-xl w-8 text-center'} text-slate-500`}>
                                            <FontAwesomeIcon
                                                icon={item.isFolder ? faFolder : getFileIcon(item.name)}
                                                className={item.isFolder ? 'text-yellow-400 drop-shadow-sm' : ''}
                                            />
                                        </div>

                                        <div className={`flex-1 min-w-0 ${viewMode === 'grid' ? 'w-full' : 'flex justify-between items-center'}`}>
                                            <div className="font-medium text-slate-700 truncate w-full text-sm">
                                                {item.name}
                                            </div>
                                            {viewMode === 'list' && (
                                                <div className="text-xs text-slate-400 w-32 text-right">
                                                    {item.isFolder ? 'Folder' : 'File'}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-100 py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2 border-b border-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {contextMenu.item.name}
                    </div>

                    {!contextMenu.item.isFolder && ['xlsx', 'xls', 'csv'].includes(contextMenu.item.name.split('.').pop()?.toLowerCase() || '') && (
                        <button
                            onClick={() => { openExcelEditor(contextMenu.item); setContextMenu(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPencilAlt} /> Edit Spreadsheet
                        </button>
                    )}

                    <button
                        onClick={() => { handleFileAction(contextMenu.item); setContextMenu(null); }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faDownload} /> Download / Open
                    </button>
                    <button
                        onClick={() => { handleDelete(contextMenu.item); setContextMenu(null); }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faTrash} /> Delete
                    </button>
                </div>
            )}

            {/* Excel Editor Modal */}
            <ExcelEditor
                visible={editorVisible}
                fileUrl={editorFile?.url || null}
                fileName={editorFile?.name || ''}
                onClose={() => setEditorVisible(false)}
                onSave={saveExcelFile}
            />

        </div>
    );
};

export default StorageManagerPage;
