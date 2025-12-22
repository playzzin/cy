import React, { useState, useEffect, useRef } from 'react';
import { storageService, StorageItem } from '../../services/storageService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFolder, faFile, faFileImage, faFilePdf, faFileWord, faFileExcel, faCloudUploadAlt,
    faTrash, faDownload, faHdd, faChevronRight, faHome, faPlus, faSpinner, faEllipsisV,
    faThLarge, faList
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';

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

    // Initial Load
    useEffect(() => {
        loadItems(currentPath);
    }, [currentPath]);

    const loadItems = async (path: string) => {
        setLoading(true);
        try {
            const fileList = await storageService.listFiles(path);
            // Filter out .keep files which are used for "empty folders"
            setItems(fileList.filter(item => item.name !== '.keep'));
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '파일 목록을 불러오지 못했습니다.', 'error');
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
            Swal.fire('성공', '업로드가 완료되었습니다.', 'success');
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
                Swal.fire({ title: '성공', text: '폴더가 생성되었습니다.', icon: 'success', timer: 1500, showConfirmButton: false });
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
            // Preview or Download Options
            handleFileAction(item);
        }
    };

    const handleFileAction = async (item: StorageItem) => {
        const result = await Swal.fire({
            title: item.name,
            text: '선택하세요',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '다운로드',
            denyButtonText: '삭제',
            cancelButtonText: '닫기'
        });

        if (result.isConfirmed) {
            try {
                const url = await storageService.getDownloadUrl(item.fullPath);
                window.open(url, '_blank');
            } catch (e) {
                Swal.fire('오류', '다운로드 링크를 가져올 수 없습니다.', 'error');
            }
        } else if (result.isDenied) {
            const confirmDelete = await Swal.fire({
                title: '정말 삭제하시겠습니까?',
                text: "이 작업은 되돌릴 수 없습니다!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: '삭제'
            });
            if (confirmDelete.isConfirmed) {
                try {
                    await storageService.deleteFile(item.fullPath);
                    Swal.fire('삭제됨', '파일이 삭제되었습니다.', 'success');
                    loadItems(currentPath);
                } catch (e) {
                    Swal.fire('오류', '삭제 실패', 'error');
                }
            }
        }
    };

    const navigateUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    // Breadcrumb Navigation
    const renderBreadcrumbs = () => {
        const parts = currentPath ? currentPath.split('/') : [];
        return (
            <div className="flex items-center text-sm text-slate-500 mb-4 bg-white p-3 rounded-lg border border-slate-200">
                <button
                    onClick={() => setCurrentPath('')}
                    className="hover:text-indigo-600 flex items-center gap-1"
                >
                    <FontAwesomeIcon icon={faHome} />
                    <span>Home</span>
                </button>
                {parts.map((part, index) => {
                    const path = parts.slice(0, index + 1).join('/');
                    return (
                        <React.Fragment key={path}>
                            <FontAwesomeIcon icon={faChevronRight} className="mx-2 text-xs text-slate-300" />
                            <button
                                onClick={() => setCurrentPath(path)}
                                className="hover:text-indigo-600 font-medium text-slate-700"
                            >
                                {part}
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-slate-50 min-h-screen p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faHdd} className="text-white text-xl" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">클라우드 저장소 (Cloud Drive)</h1>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
                    >
                        <FontAwesomeIcon icon={faThLarge} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
                    >
                        <FontAwesomeIcon icon={faList} />
                    </button>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-between items-center mb-4">
                {renderBreadcrumbs()}

                <div className="flex gap-2">
                    <button
                        onClick={handleCreateFolder}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                    >
                        <FontAwesomeIcon icon={faFolder} className="text-yellow-500" />
                        <span>새 폴더</span>
                    </button>
                    <div className="relative">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleUpload}
                            className="hidden"
                            id="file-upload"
                        />
                        <label
                            htmlFor="file-upload"
                            className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer ${uploading ? 'opacity-70 pointer-events-none' : ''}`}
                        >
                            {uploading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCloudUploadAlt} />}
                            <span>{uploading ? `업로드 중 ${Math.round(uploadProgress)}%` : '파일 업로드'}</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl border border-slate-200 min-h-[500px] p-6 relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-indigo-500" />
                            <span>로딩중...</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-6xl mb-4 text-slate-200" />
                                <p>폴더가 비어있습니다.</p>
                                <p className="text-sm">파일을 업로드하거나 새 폴더를 만드세요.</p>
                            </div>
                        ) : (
                            <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" : "flex flex-col gap-2"}>
                                {items.map((item) => (
                                    <div
                                        key={item.fullPath}
                                        onClick={() => handleItemClick(item)}
                                        className={`
                                            group relative cursor-pointer border border-transparent rounded-xl transition-all duration-200
                                            ${viewMode === 'grid'
                                                ? 'p-4 flex flex-col items-center text-center hover:bg-indigo-50 hover:border-indigo-200'
                                                : 'p-3 flex items-center gap-4 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0'
                                            }
                                        `}
                                    >
                                        <div className={`${viewMode === 'grid' ? 'text-5xl mb-3' : 'text-2xl w-10 text-center'} transition-transform group-hover:scale-110`}>
                                            <FontAwesomeIcon
                                                icon={item.isFolder ? faFolder : getFileIcon(item.name)}
                                                className={item.isFolder ? 'text-yellow-400' : 'text-slate-500'}
                                            />
                                        </div>

                                        <div className={`flex-1 ${viewMode === 'grid' ? '' : 'flex justify-between items-center w-full'}`}>
                                            <div className="font-medium text-slate-700 truncate w-full px-2 text-sm">
                                                {item.name}
                                            </div>

                                            {viewMode === 'list' && (
                                                <div className="text-xs text-slate-400 pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {item.isFolder ? '폴더' : '파일'}
                                                </div>
                                            )}
                                        </div>

                                        {/* Hover Actions in Grid */}
                                        {!item.isFolder && viewMode === 'grid' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleFileAction(item); }}
                                                className="absolute top-2 right-2 p-1.5 bg-white shadow-sm rounded-full text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <FontAwesomeIcon icon={faEllipsisV} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default StorageManagerPage;
