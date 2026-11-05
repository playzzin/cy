import React, { useEffect, useRef } from 'react';
import { Worker } from '../../services/manpowerService';
import AccountPhotoRegistrationModal from '../accounts/AccountPhotoRegistrationModal';
import { saveWorkerBankPhoto, validateWorkerBankPhoto } from '../../services/workerBankPhotoService';

interface BankBookAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    workers: Worker[];
    initialWorkerId?: string;
    onUpdateWorkers: (updates: { workerId: string; bankName: string; accountNumber: string; accountHolder: string }[]) => Promise<void>;
    onPhotoSaved?: (workerId: string, photoId: string) => void;
}

const BankBookAnalysisModal: React.FC<BankBookAnalysisModalProps> = ({ isOpen, onClose, workers, initialWorkerId, onUpdateWorkers, onPhotoSaved }) => {
    const uploads = useRef(new Map<File, Map<string, { id: string; expected: string }>>());
    useEffect(() => { if (!isOpen) uploads.current.clear(); }, [isOpen]);
    if (!isOpen) return null;
    return <AccountPhotoRegistrationModal
        initialTargetId={initialWorkerId}
        targets={workers.filter(worker => worker.id).map(worker => ({
            id: worker.id!, label: `${worker.name} · ${worker.teamName || '미배정'}${worker.companyName ? ` · ${worker.companyName}` : ''}`,
        }))}
        onSave={(workerId, fields) => onUpdateWorkers([{ workerId, ...fields }])}
        onSavePhoto={async (workerId, file) => {
            validateWorkerBankPhoto(file);
            const worker = workers.find(item => item.id === workerId);
            if (!worker) throw new Error('작업자를 찾을 수 없습니다. 다시 조회해 주세요.');
            const byWorker = uploads.current.get(file) ?? new Map();
            let upload = byWorker.get(workerId);
            if (!upload) {
                upload = { id: Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''), expected: worker.bankPhotoId || '' };
                byWorker.set(workerId, upload); uploads.current.set(file, byWorker);
            }
            const photoId = await saveWorkerBankPhoto(workerId, file, upload.id, upload.expected, 'default');
            onPhotoSaved?.(workerId, photoId);
        }}
        onClose={onClose}
    />;
};

export default BankBookAnalysisModal;
