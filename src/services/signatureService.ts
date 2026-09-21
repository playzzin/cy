import { httpsCallable } from 'firebase/functions';
import { invalidateWorkerCache } from '../utils/workerCacheRevision';
import { auth, functions, storage } from '../config/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { manpowerService } from './manpowerService';

export interface SignatureConsentSnapshot {
    version: 1;
    documentText: string;
    documentDate: string;
    workMonth: string;
    siteName: string;
    mandataryName: string;
    workerName: string;
}

export interface SignatureSaveOptions {
    source?: 'administrator' | 'worker_direct';
    consent?: SignatureConsentSnapshot;
}

export const signatureService = {
    /**
     * Upload a signature image (Data URL) to Firebase Storage and update Worker profile
     * @param workerId Worker's Firestore ID
     * @param dataUrl Base64 Image Data URL (PNG)
     */
    saveSignature: async (
        workerId: string,
        dataUrl: string,
        options?: SignatureSaveOptions
    ): Promise<string> => {
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

            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error('로그인이 필요합니다.');
            const result = await httpsCallable<Record<string, unknown>, { signatureUrl: string }>(functions, 'workerSignatures')({
                action: 'save', workerId: canonicalWorkerId, dataUrl, ...(options ? { options } : {}),
            });
            if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다.');
            invalidateWorkerCache();
            return result.data.signatureUrl;

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
