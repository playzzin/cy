import type { Worker } from './manpowerService';
import { deleteWorkerBankPhoto, saveWorkerBankPhoto } from './workerBankPhotoService';
import { workerPhotoField, type WorkerAccountPurpose } from '../utils/workerAccount';

export type WorkerPhotoDraft = { file: File; id: string } | null;
export type WorkerPhotoDrafts = Partial<Record<WorkerAccountPurpose, WorkerPhotoDraft>>;
export type WorkerSaveResult = Pick<Worker, 'id' | 'bankPhotoId' | 'directPayBankPhotoId'> & { id: string };
export type PersistWorker = (data: Partial<Worker>, savedId?: string) => Promise<WorkerSaveResult | null>;

// One session per open registration form. A photo failure must never create the worker twice.
export class WorkerRegistrationSaveSession {
    private result: WorkerSaveResult | null;
    private savedData = '';
    private completed: Partial<Record<WorkerAccountPurpose, string>> = {};
    didSave = false;

    constructor(initial?: Partial<Worker> | null) {
        this.result = initial?.id ? { id: initial.id, bankPhotoId: initial.bankPhotoId, directPayBankPhotoId: initial.directPayBankPhotoId } : null;
    }

    async save(data: Partial<Worker>, photos: WorkerPhotoDrafts, persist: PersistWorker): Promise<boolean> {
        // Photo references are owned by the callable; never overwrite them from a stale form.
        const { bankPhotoId, directPayBankPhotoId, bankPhotoUpdatedAt, directPayBankPhotoUpdatedAt, ...fields } = data;
        const serialized = JSON.stringify(fields);
        if (this.savedData !== serialized) {
            const saved = await persist(fields, this.result?.id);
            if (!saved) return false;
            if (!saved.id) throw new Error('저장된 작업자를 확인하지 못했습니다.');
            if (!this.result) this.result = saved;
            if (this.result.id !== saved.id) throw new Error('저장 대상 작업자가 변경되었습니다. 다시 확인해 주세요.');
            this.savedData = serialized;
            this.didSave = true;
        }
        if (!this.result) throw new Error('작업자 정보를 먼저 저장해 주세요.');
        for (const purpose of ['default', 'directPay'] as const) {
            const draft = photos[purpose];
            if (draft === undefined) continue;
            const operation = draft ? draft.id : 'delete';
            if (this.completed[purpose] === operation) continue;
            const field = workerPhotoField(purpose);
            const expected = this.result[field] || '';
            if (draft) this.result[field] = await saveWorkerBankPhoto(this.result.id, draft.file, draft.id, expected, purpose);
            else {
                if (expected) await deleteWorkerBankPhoto(this.result.id, expected, purpose);
                this.result[field] = '';
            }
            this.completed[purpose] = operation;
        }
        return true;
    }
}
