import React from 'react';
import { Worker } from '../../services/manpowerService';
import AccountPhotoRegistrationModal from '../accounts/AccountPhotoRegistrationModal';

interface BankBookAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    workers: Worker[];
    onUpdateWorkers: (updates: { workerId: string; bankName: string; accountNumber: string; accountHolder: string }[]) => Promise<void>;
}

const BankBookAnalysisModal: React.FC<BankBookAnalysisModalProps> = ({ isOpen, onClose, workers, onUpdateWorkers }) => {
    if (!isOpen) return null;
    return <AccountPhotoRegistrationModal
        targets={workers.filter(worker => worker.id).map(worker => ({
            id: worker.id!, label: `${worker.name} · ${worker.teamName || '미배정'}${worker.companyName ? ` · ${worker.companyName}` : ''}`,
        }))}
        onSave={(workerId, fields) => onUpdateWorkers([{ workerId, ...fields }])}
        onClose={onClose}
    />;
};

export default BankBookAnalysisModal;
