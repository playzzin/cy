import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckSquare, faPlus } from '@fortawesome/free-solid-svg-icons';
import type { Worker } from '../../services/manpowerService';
import { isCompleteBankAccount } from '../../services/bankAccountPhotoService';
import { getWorkerAccount, WorkerAccountPurpose, workerAccountLabel, workerPhotoField } from '../../utils/workerAccount';

interface Props {
    worker: Worker;
    disabled?: boolean;
    onRegister: (purpose: WorkerAccountPurpose) => void;
}

export default function WorkerAccountSummary({ worker, disabled, onRegister }: Props) {
    return <div aria-label={`${worker.name} 계좌 관리`} className="mb-2 flex items-center justify-center gap-1.5">
        {(['default', 'directPay'] as const).map(purpose => {
            const account = getWorkerAccount(worker, purpose);
            const label = workerAccountLabel(purpose);
            const hasAccount = isCompleteBankAccount(account);
            const hasPhoto = Boolean(worker[workerPhotoField(purpose)]);
            const registered = hasAccount && hasPhoto;
            return <button key={purpose} type="button" disabled={disabled || !worker.id}
                aria-label={`${worker.name} ${label}·사진 등록/수정`}
                title={`${label}: 계좌 ${hasAccount ? '등록됨' : '미등록'} · 사진 ${hasPhoto ? '등록됨' : '미등록'}`}
                onClick={() => onRegister(purpose)}
                className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded p-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${registered ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                <FontAwesomeIcon icon={registered ? faCheckSquare : faPlus} />
                <span>{purpose === 'directPay' ? '직불용계좌' : '기본계좌'}</span>
            </button>;
        })}
    </div>;
}
