import { storage } from '../config/firebase';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    getBlob,
    listAll,
    deleteObject,
    ListResult,
    UploadMetadata
} from 'firebase/storage';

export interface StorageItem {
    name: string;
    fullPath: string;
    isFolder: boolean;
    size?: number;
    updatedAt?: string; // ISO String
    contentType?: string;
    url?: string;
}

export interface StorageUploadResult {
    name: string;
    fullPath: string;
    /** Immutable Firebase Storage object generation assigned at upload time. */
    generation?: string;
    size?: number;
    contentType?: string;
    url?: string;
}

export const storageService = {
    uploadFileInfo: (
        path: string,
        file: File,
        onProgress?: (progress: number) => void,
        options?: {
            includeDownloadUrl?: boolean;
            metadata?: UploadMetadata;
        }
    ): Promise<StorageUploadResult> => {
        return new Promise((resolve, reject) => {
            const cleanPath = path.endsWith('/') ? path : `${path}/`;
            const storageRef = ref(storage, `${cleanPath}${file.name}`);
            const metadata = options?.metadata || (file.type ? { contentType: file.type } : undefined);
            const uploadTask = uploadBytesResumable(storageRef, file, metadata);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) onProgress(progress);
                },
                (error) => {
                    console.error('Upload failed:', error);
                    reject(error);
                },
                async () => {
                    try {
                        const downloadURL = options?.includeDownloadUrl === false
                            ? undefined
                            : await getDownloadURL(uploadTask.snapshot.ref);
                        resolve({
                            name: uploadTask.snapshot.ref.name,
                            fullPath: uploadTask.snapshot.ref.fullPath,
                            generation: uploadTask.snapshot.metadata.generation,
                            size: uploadTask.snapshot.metadata.size,
                            contentType: uploadTask.snapshot.metadata.contentType,
                            url: downloadURL,
                        });
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    },

    /**
     * Upload a file to the specified path
     * @param path Directory path (e.g., 'documents/project1')
     * @param file File object to upload
     * @param onProgress Optional callback for upload progress (0-100)
     * @returns Promise resolving to the download URL
     */
    uploadFile: (
        path: string,
        file: File,
        onProgress?: (progress: number) => void
    ): Promise<string> => {
        return storageService.uploadFileInfo(path, file, onProgress, { includeDownloadUrl: true })
            .then((result) => result.url || storageService.getDownloadUrl(result.fullPath));
    },

    /**
     * List files and folders in a specific path
     * @param path Directory path
     * @returns Promise resolving to list of items (files and folders)
     */
    listFiles: async (path: string): Promise<StorageItem[]> => {
        try {
            const storageRef = ref(storage, path);
            const res: ListResult = await listAll(storageRef);

            const items: StorageItem[] = [];

            // Folders (Prefixes)
            res.prefixes.forEach((folderRef) => {
                items.push({
                    name: folderRef.name,
                    fullPath: folderRef.fullPath,
                    isFolder: true
                });
            });

            // Files (Items)
            // Note: We need to fetch metadata for size/type if strictly required for list view.
            // For performance, we might skip metadata in bulk list or fetch lazily.
            // Let's just list names for now to keep it fast, or maybe minimal metadata?
            // storage API listAll doesn't give metadata directly.
            res.items.forEach((itemRef) => {
                items.push({
                    name: itemRef.name,
                    fullPath: itemRef.fullPath,
                    isFolder: false,
                });
            });

            return items;
        } catch (error) {
            console.error('List files failed:', error);
            throw error;
        }
    },

    /**
     * Get detailed metadata for a specific item (size, type, timestmap)
     * @param fullPath Full path of the file
     */
    getMetadata: async (fullPath: string) => {
        // Implement if needed for 'Detail View'
        // import { getMetadata } from 'firebase/storage';
        // const itemRef = ref(storage, fullPath);
        // return await getMetadata(itemRef);
    },

    /**
     * Delete a file
     * @param fullPath Full path including filename
     */
    deleteFile: async (fullPath: string): Promise<void> => {
        try {
            const fileRef = ref(storage, fullPath);
            await deleteObject(fileRef);
        } catch (error) {
            console.error('Delete failed:', error);
            throw error;
        }
    },

    /**
     * Get Download URL
     */
    getDownloadUrl: async (fullPath: string): Promise<string> => {
        try {
            const fileRef = ref(storage, fullPath);
            return await getDownloadURL(fileRef);
        } catch (error) {
            console.error('Get URL failed:', error);
            throw error;
        }
    },

    /**
     * Read a private object through the authenticated Storage SDK and expose it
     * only as a tab-local blob URL. Unlike getDownloadURL(), this does not mint
     * a long-lived bearer token that can accidentally be persisted in a plan.
     * Callers must revoke the returned URL when it is no longer needed.
     */
    getAuthorizedObjectUrl: async (fullPath: string): Promise<string> => {
        try {
            const fileRef = ref(storage, fullPath);
            const blob = await getBlob(fileRef);
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('Get private object failed:', error);
            throw error;
        }
    },

    /**
     * Create a folder (Simulation)
     * Firebase Storage doesn't have real folders.
     * We create a .keep file to simulate a folder.
     */
    createFolder: async (path: string, folderName: string): Promise<void> => {
        try {
            const cleanPath = path ? (path.endsWith('/') ? path : `${path}/`) : '';
            const fullPath = `${cleanPath}${folderName}/.keep`;
            const storageRef = ref(storage, fullPath);
            // Upload 0 byte blob
            const blob = new Blob([''], { type: 'application/x-empty' });
            await uploadBytesResumable(storageRef, blob);
        } catch (error) {
            console.error('Create folder failed:', error);
            throw error;
        }
    },

    /**
     * Move a file (Copy + Delete)
     * @param oldPath Full path of the source file
     * @param newPath Full path of the destination
     */
    moveFile: async (oldPath: string, newPath: string): Promise<void> => {
        try {
            // 1. Get Download URL
            const oldRef = ref(storage, oldPath);
            const url = await getDownloadURL(oldRef);

            // 2. Fetch Blob
            const response = await fetch(url);
            const blob = await response.blob();

            // 3. Upload to New Path
            const newRef = ref(storage, newPath);
            await uploadBytesResumable(newRef, blob);

            // 4. Delete Old File
            await deleteObject(oldRef);
        } catch (error) {
            console.error('Move file failed:', error);
            throw error;
        }
    },

    /**
     * Move a folder (Recursive Copy + Delete)
     * @param oldPath Source folder path
     * @param newPath Destination folder path
     */
    moveFolder: async (oldPath: string, newPath: string): Promise<void> => {
        try {
            const oldFolderRef = ref(storage, oldPath);
            const res = await listAll(oldFolderRef);

            // 1. Move Files
            const filePromises = res.items.map(async (itemRef) => {
                const oldFilePath = itemRef.fullPath;
                const newFilePath = oldFilePath.replace(oldPath, newPath);
                await storageService.moveFile(oldFilePath, newFilePath);
            });

            // 2. Move Subfolders (Recursively)
            const folderPromises = res.prefixes.map(async (folderRef) => {
                const oldFolderPath = folderRef.fullPath;
                const newFolderPath = oldFolderPath.replace(oldPath, newPath);
                await storageService.moveFolder(oldFolderPath, newFolderPath);
            });

            await Promise.all([...filePromises, ...folderPromises]);
        } catch (error) {
            console.error('Move folder failed:', error);
            throw error;
        }
    },

    /**
     * Rename a file or folder
     */
    rename: async (oldPath: string, newName: string, isFolder: boolean): Promise<void> => {
        const pathParts = oldPath.split('/');
        pathParts.pop(); // Remove old name
        const basePath = pathParts.join('/');
        const newPath = basePath ? `${basePath}/${newName}` : newName;

        if (isFolder) {
            await storageService.moveFolder(oldPath, newPath);
        } else {
            await storageService.moveFile(oldPath, newPath);
        }
    }
};
