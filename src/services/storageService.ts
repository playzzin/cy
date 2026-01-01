import { storage } from '../config/firebase';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    listAll,
    deleteObject,
    ListResult
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

export const storageService = {
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
        return new Promise((resolve, reject) => {
            // Clean path to avoid double slashes
            const cleanPath = path.endsWith('/') ? path : `${path}/`;
            const storageRef = ref(storage, `${cleanPath}${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

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
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(downloadURL);
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
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
    }
};
