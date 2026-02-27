import React, { useState } from 'react';
import { Worker } from '../../services/manpowerService';
import { Team } from '../../services/teamService';
import { Company } from '../../services/companyService';
import { storage } from '../../config/firebase';
import { ref, uploadBytes } from 'firebase/storage';
import { Position } from '../../services/positionService';
import WorkerForm from '../../components/manpower/WorkerForm';
import { showErrorAlert } from '../../utils/swal';

interface WorkerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (worker: Omit<Worker, 'id'> | Partial<Worker>) => Promise<void>;
    initialData?: Partial<Worker> | null;
    teams: Team[];
    companies: Company[];
    positions: Position[];
}

const WorkerModal: React.FC<WorkerModalProps> = ({ isOpen, onClose, onSave, initialData, teams, companies, positions }) => {
    if (!isOpen) return null;

    const handleSaveWrapper = async (data: Omit<Worker, 'id'> | Partial<Worker>, file?: File | null) => {
        try {
            let finalData = { ...data };

            // Upload file if selected
            if (file) {
                const storagePath = `id_cards/${Date.now()}_${file.name}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, file);
                finalData.fileNameSaved = storagePath;
            }

            await onSave(finalData);
            onClose();
        } catch (error: any) {
            console.error("Failed to save worker:", error);
            await showErrorAlert('저장 실패', error.message || "저장 중 오류가 발생했습니다.");
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
                    onCancel={onClose}
                    isEditMode={isEditMode}
                />
            </div>
        </div>
    );
};

export default WorkerModal;
