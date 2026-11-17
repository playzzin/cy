import React, { useEffect, useRef } from 'react';
import { Worker } from '../../services/manpowerService';
import { Team } from '../../services/teamService';
import { Company } from '../../services/companyService';
import { storage } from '../../config/firebase';
import { ref, uploadBytes } from 'firebase/storage';
import { Position } from '../../services/positionService';
import WorkerForm from '../../components/manpower/WorkerForm';
import { showErrorAlert } from '../../utils/swal';
import { recordIdentityDocumentLog } from '../../services/identityDocumentLogService';
import { WorkerRegistrationSaveSession, type PersistWorker, type WorkerPhotoDrafts } from '../../services/workerRegistrationSave';

interface WorkerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: PersistWorker;
    onSaved?: () => void;
    initialData?: Partial<Worker> | null;
    teams: Team[];
    companies: Company[];
    positions: Position[];
}

const WorkerModal: React.FC<WorkerModalProps> = ({ isOpen, onClose, onSave, onSaved, initialData, teams, companies, positions }) => {
    const session = useRef(new WorkerRegistrationSaveSession(initialData));
    const identityUpload = useRef<{ file: File; path: string } | null>(null);
    useEffect(() => {
        session.current = new WorkerRegistrationSaveSession(initialData);
        identityUpload.current = null;
    }, [isOpen, initialData?.id]);
    if (!isOpen) return null;

    const close = () => {
        if (session.current.didSave) onSaved?.();
        onClose();
    };
    const handleSaveWrapper = async (data: Omit<Worker, 'id'> | Partial<Worker>, file?: File | null, photos: WorkerPhotoDrafts = {}) => {
        try {
            let finalData = { ...data };

            // Upload file if selected
            if (file && identityUpload.current?.file !== file) {
                const storagePath = `id_cards/${Date.now()}_${file.name}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, file);
                identityUpload.current = { file, path: storagePath };
            }
            if (file && identityUpload.current) finalData.fileNameSaved = identityUpload.current.path;

            if (await session.current.save(finalData, photos, onSave)) close();
        } catch (error: any) {
            if (file) void recordIdentityDocumentLog({ action: initialData?.id ? 'worker_updated' : 'worker_created', status: 'failure',
                workerId: initialData?.id, personNames: [data.name || ''], fileNames: [file.name], fileCount: 1, reason: 'processing_failed' });
            console.error("Failed to save worker:", error);
            await showErrorAlert('저장 실패', `${session.current.didSave ? '작업자 정보는 저장됐지만 통장사본 처리가 완료되지 않았습니다. 이 창에서 다시 저장하면 이어서 처리합니다. ' : ''}${error.message || '저장 중 오류가 발생했습니다.'}`);
        }
    };

    // initialData가 있으면 해당 id를 가진 Worker 객체로 간주, 없으면 null (New Mode)
    // WorkerForm will handle the defaulting logic if initialData is null.
    // However, initialData from props is Partial<Worker> | null, but WorkerForm expects Worker | null.
    // casting is safe here as WorkerForm handles Partial logic internally anyway or we can adjust type.
    const formInitialData = initialData ? (initialData as Worker) : null;
    const isEditMode = !!(initialData && initialData.id);

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl">
                <WorkerForm
                    initialData={formInitialData}
                    teams={teams}
                    companies={companies}
                    positions={positions}
                    onSave={handleSaveWrapper}
                    onCancel={close}
                    isEditMode={isEditMode}
                />
            </div>
        </div>
    );
};

export default WorkerModal;
