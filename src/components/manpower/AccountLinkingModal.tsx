import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import AccountLinkManager from '../admin/AccountLinkManager';

interface AccountLinkingModalProps {
    onClose: () => void;
    actorEmail?: string;
    lockedUserId?: string;
}

const AccountLinkingModal: React.FC<AccountLinkingModalProps> = ({ onClose, actorEmail, lockedUserId }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <h2 className="text-xl font-bold text-slate-800">계정 연동 관리</h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" title="닫기">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>
                <div className="min-h-0 flex-1">
                    <AccountLinkManager actorEmail={actorEmail} lockedUserId={lockedUserId} />
                </div>
            </div>
        </div>
    );
};

export default AccountLinkingModal;
