import { storage, db } from '../config/firebase';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export const signatureService = {
    /**
     * Upload a signature image (Data URL) to Firebase Storage and update Worker profile
     * @param workerId Worker's Firestore ID
     * @param dataUrl Base64 Image Data URL (PNG)
     */
    saveSignature: async (workerId: string, dataUrl: string): Promise<string> => {
        try {
            // 1. Create Storage Reference
            // Use a timestamp to prevent caching issues when updating
            const timestamp = Date.now();
            const storagePath = `signatures/${workerId}_${timestamp}.png`;
            const storageRef = ref(storage, storagePath);

            // 2. Upload Image
            await uploadString(storageRef, dataUrl, 'data_url');
            const downloadUrl = await getDownloadURL(storageRef);

            // 3. Update Worker Document
            // First, get the old signature URL to delete later if needed (optional cleanup)
            const workerRef = doc(db, 'workers', workerId);
            const workerSnap = await getDoc(workerRef);
            const oldSignatureUrl = workerSnap.exists() ? workerSnap.data().signatureUrl : null;

            await updateDoc(workerRef, {
                signatureUrl: downloadUrl,
                updatedAt: new Date()
            });

            // 4. (Optional) Cleanup old signature file if it exists and is different
            // Note: Parsing the token from URL is tricky, so we skip complex deletion for now 
            // or just rely on the new URL invalidating the old view. 

            return downloadUrl;

        } catch (error) {
            console.error("Error saving signature:", error);
            throw new Error("서명 저장에 실패했습니다.");
        }
    },

    /**
     * Delete a signature from a worker profile
     */
    deleteSignature: async (workerId: string, signatureUrl?: string): Promise<void> => {
        try {
            const workerRef = doc(db, 'workers', workerId);

            // Remove field from Firestore
            await updateDoc(workerRef, {
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
