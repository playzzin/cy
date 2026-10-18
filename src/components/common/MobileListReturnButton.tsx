import React from 'react';
import { ArrowLeft, List } from 'lucide-react';
import './MobileListReturnButton.css';

interface MobileListReturnButtonProps {
    kind: 'site' | 'worker';
    onClick: () => void;
}

const MobileListReturnButton: React.FC<MobileListReturnButtonProps> = ({ kind, onClick }) => (
    <button type="button" className={`mobile-list-return mobile-list-return--${kind}`} onClick={onClick}>
        <span className="mobile-list-return__arrow" aria-hidden="true"><ArrowLeft size={21} strokeWidth={2.5} /></span>
        <span className="mobile-list-return__label">{kind === 'site' ? '현장 목록으로' : '작업자 목록으로'}</span>
        <List className="mobile-list-return__list" size={20} aria-hidden="true" />
    </button>
);

export default MobileListReturnButton;
