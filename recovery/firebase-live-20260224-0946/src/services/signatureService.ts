import { storage } from '../config/firebase';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { manpowerService } from './manpowerService';

export const signatureService = {
    /**
     * Upload a signature image (Data URL) to Firebase Storage and update Worker profile
     * @param workerId Worker's Firestore ID
     * @param dataUrl Base64 Image Data URL (PNG)
     */
    saveSignature: async (workerId: string, dataUrl: string): Promise<string> => {
        try {
            const rawWorkerId = String((workerId as any) ?? '').trim();
            if (!rawWorkerId || rawWorkerId === 'undefined' || rawWorkerId === 'null') {
                throw new Error('근로자 ID가 없습니다.');
            }

            const worker = await manpowerService.getWorker(rawWorkerId);
            const canonicalWorkerId = worker?.id ? String(worker.id) : '';
            if (!canonicalWorkerId) {
                throw new Error(`존재하지 않는 근로자입니다. (id=${rawWorkerId})`);
            }

            // 1. Create Storage Reference
            // Use a timestamp to prevent caching issues when updating
            const timestamp = Date.now();
            const storagePath = `signatures/${canonicalWorkerId}_${timestamp}.png`;
            const storageRef = ref(storage, storagePath);

            // 2. Upload Image
            await uploadString(storageRef, dataUrl, 'data_url');
            const downloadUrl = await getDownloadURL(storageRef);

            // 3. Update Worker Document
            // First, get the old signature URL to delete later if needed (optional cleanup)
            try {
                await manpowerService.updateWorker(canonicalWorkerId, {
                    signatureUrl: downloadUrl
                });
            } catch (e) {
                try {
                    await deleteObject(storageRef);
                } catch {
                    // ignore cleanup errors
                }
                throw e;
            }

            // 4. (Optional) Cleanup old signature file if it exists and is different
            // Note: Parsing the token from URL is tricky, so we skip complex deletion for now 
            // or just rely on the new URL invalidating the old view. 

            return downloadUrl;

        } catch (error) {
            console.error("Error saving signature:", error);
            const rawMessage = (error as any)?.message ? String((error as any).message) : '';
            throw new Error(rawMessage ? `서명 저장에 실패했습니다. (${rawMessage})` : '서명 저장에 실패했습니다.');
        }
    },

    /**
     * Delete a signature from a worker profile
     */
    deleteSignature: async (workerId: string, signatureUrl?: string): Promise<void> => {
        try {
            await manpowerService.updateWorker(workerId, {
                signatureUrl: '' // or deleteField()
            });

            // Try to delete from Storage if URL provided
            if (signatureUrl) {
                try {
                    // This is a comprehensive attempt, might fail if URL format is custom
                    const storageRef = ref(storage, signatureUrl);
                    await deleteObject(storageRef);
                } catch (e) {
                    console.warn("Could not delete file from storage (might act different in client SDK):", e);
                }
            }
        } catch (error) {
            console.error("Error deleting signature:", error);
            throw error;
        }
    }
};
