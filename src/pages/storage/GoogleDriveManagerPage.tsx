import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faGoogleDrive
} from '@fortawesome/free-brands-svg-icons';
import {
    faFolder, faFile, faFileImage, faFilePdf, faFileWord, faFileExcel,
    faCloudUploadAlt, faTrash, faDownload, faSpinner, faSignOutAlt,
    faChevronRight, faHome, faExclamationTriangle, faSync, faFolderOpen
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { useGoogleDrive, GoogleDriveFile } from '../../hooks/useGoogleDrive';

export const GoogleDriveManagerPage = () => {
    const {
        isApiLoaded, isAuthenticated, isLoading, login, logout,
        listFiles, uploadFile, deleteFile, getFile, checkEnv
    } = useGoogleDrive();

    // Configurable Root Folder (for Shared Folders/Team Drives)
    const ENV_ROOT_ID = process.env.REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const ROOT_ID = ENV_ROOT_ID || 'root';
    const ROOT_NAME = ENV_ROOT_ID ? 'Team Folder' : 'My Drive';

    const [files, setFiles] = useState<GoogleDriveFile[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState(ROOT_ID);
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string, name: string }[]>([{ id: ROOT_ID, name: ROOT_NAME }]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Load & Root Name Resolution
    useEffect(() => {
        const init = async () => {
            if (isAuthenticated) {
                // If using a custom root, try to get its real name
                if (ENV_ROOT_ID && breadcrumbs[0].name === 'Team Folder') {
                    const rootMetadata = await getFile(ENV_ROOT_ID);
                    if (rootMetadata && rootMetadata.name) {
                        setBreadcrumbs([{ id: ENV_ROOT_ID, name: rootMetadata.name }]);
                    }
                }
            }
        };
        init();
    }, [isAuthenticated]); // Only run on auth change mostly, keeping currentFolderId logic separate

    // Reload when folder changes
    useEffect(() => {
        if (isAuthenticated) {
            loadFiles(currentFolderId);
        }
    }, [currentFolderId, isAuthenticated]);

    const loadFiles = async (folderId: string) => {
        const result = await listFiles(folderId);
        setFiles(result);
    };

    const handleNavigate = (folderId: string, folderName: string) => {
        setCurrentFolderId(folderId);
        // Update breadcrumbs logic
        const index = breadcrumbs.findIndex(b => b.id === folderId);
        if (index !== -1) {
            setBreadcrumbs(breadcrumbs.slice(0, index + 1));
        } else {
            setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
        }
    };

    const handleBreadcrumbClick = (item: { id: string, name: string }) => {
        setCurrentFolderId(item.id);
        const index = breadcrumbs.findIndex(b => b.id === item.id);
        setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            await uploadFile(file, currentFolderId);
            loadFiles(currentFolderId); // Refresh
        }
    };

    const handleDelete = async (fileId: string, fileName: string) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Delete "${fileName}"? This will move it to trash.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            const success = await deleteFile(fileId);
            if (success) {
                loadFiles(currentFolderId);
                Swal.fire('Deleted!', 'Your file has been deleted.', 'success');
            }
        }
    };

    // Helper for icons
    const getIcon = (mimeType: string) => {
        if (mimeType === 'application/vnd.google-apps.folder') return faFolder;
        if (mimeType.includes('image')) return faFileImage;
        if (mimeType.includes('pdf')) return faFilePdf;
        if (mimeType.includes('sheet') || mimeType.includes('excel')) return faFileExcel;
        if (mimeType.includes('document') || mimeType.includes('word')) return faFileWord;
        return faFile;
    };

    if (!checkEnv.hasClientId || !checkEnv.hasApiKey) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-slate-500">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl text-amber-500 mb-4" />
                <h2 className="text-xl font-bold text-slate-700 mb-2">Configuration Missing</h2>
                <p className="max-w-md text-center">
                    Please set <code>REACT_APP_GOOGLE_CLIENT_ID</code> and <code>REACT_APP_GOOGLE_API_KEY</code> in your environment (<code>.env.local</code>).
                </p>
                <div className="mt-6 bg-slate-100 p-4 rounded-lg text-sm font-mono text-left">
                    REACT_APP_GOOGLE_CLIENT_ID=your_client_id<br />
                    REACT_APP_GOOGLE_API_KEY=your_api_key
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[600px] bg-slate-50">
                <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md w-full border border-slate-100">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FontAwesomeIcon icon={faGoogleDrive as any} className="text-4xl text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-3">Google Drive Connect</h1>
                    <p className="text-slate-500 mb-8">
                        Connect your Google account to manage files directly from this dashboard.
                        <br /><span className="text-xs text-slate-400">(Safe & Secure via Google Identity)</span>
                    </p>

                    {!isApiLoaded ? (
                        <div className="flex items-center justify-center gap-3 text-slate-400">
                            <FontAwesomeIcon icon={faSpinner} spin /> Initializing API...
                        </div>
                    ) : (
                        <button
                            onClick={login}
                            className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow-md"
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                            Sign in with Google
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header / Toolbar */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                <div className="flex items-center gap-4 overflow-hidden">
                    {/* Breadcrumbs */}
                    <div className="flex items-center text-sm text-slate-600 overflow-x-auto no-scrollbar whitespace-nowrap mask-linear-fade">
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={crumb.id}>
                                {index > 0 && <FontAwesomeIcon icon={faChevronRight} className="mx-2 text-slate-300 text-xs" />}
                                <button
                                    onClick={() => handleBreadcrumbClick(crumb)}
                                    className={`hover:bg-slate-100 px-2 py-1 rounded transition-colors flex items-center gap-2 ${index === breadcrumbs.length - 1 ? 'font-bold text-slate-800' : ''}`}
                                >
                                    {index === 0 && <FontAwesomeIcon icon={faHome} />}
                                    {crumb.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadFiles(currentFolderId)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <FontAwesomeIcon icon={faSync} spin={isLoading} />
                    </button>
                    <div className="h-6 w-px bg-slate-200 mx-2"></div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        onClick={handleUploadClick}
                        disabled={isLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FontAwesomeIcon icon={faCloudUploadAlt} /> Upload File
                    </button>
                    <button
                        onClick={logout}
                        className="ml-2 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Sign Out"
                    >
                        <FontAwesomeIcon icon={faSignOutAlt} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 relative">
                {isLoading && files.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-indigo-500" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {files.map((file) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                key={file.id}
                                className="group relative bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex flex-col items-center text-center aspect-[1/1.2]"
                                onClick={() => {
                                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                                        handleNavigate(file.id, file.name);
                                    } else {
                                        window.open(file.webViewLink, '_blank');
                                    }
                                }}
                            >
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(file.id, file.name); }}
                                        className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 shadow-sm border border-slate-100 flex items-center justify-center transition-colors"
                                    >
                                        <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                    </button>
                                </div>

                                <div className="flex-1 flex items-center justify-center w-full mb-3">
                                    {file.thumbnailLink && !file.mimeType.includes('folder') ? (
                                        <img
                                            src={file.thumbnailLink}
                                            alt={file.name}
                                            className="w-full h-full object-contain max-h-[120px] rounded"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ) : (
                                        <FontAwesomeIcon
                                            icon={getIcon(file.mimeType)}
                                            className={`text-6xl ${file.mimeType.includes('folder') ? 'text-indigo-400' : 'text-slate-300'}`}
                                        />
                                    )}
                                </div>

                                <div className="w-full">
                                    <h3 className="text-sm font-medium text-slate-700 truncate w-full mb-1" title={file.name}>
                                        {file.name}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        {file.size ? `${(parseInt(file.size) / 1024 / 1024).toFixed(2)} MB` : 'Folder'}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {!isLoading && files.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <FontAwesomeIcon icon={faFolderOpen} className="text-6xl text-slate-200 mb-4" />
                        <p>No files found in this folder</p>
                    </div>
                )}
            </div>
        </div>
    );
};
