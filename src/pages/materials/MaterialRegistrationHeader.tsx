import React from 'react';
import { ArrowDown, ArrowUp, Save } from 'lucide-react';
import './MaterialRegistrationHeader.css';

interface MaterialRegistrationHeaderProps {
    kind: 'inbound' | 'outbound';
    saving: boolean;
    onSave: () => void;
    children: React.ReactNode;
    additionalControls: React.ReactNode;
}

const MaterialRegistrationHeader: React.FC<MaterialRegistrationHeaderProps> = ({
    kind, saving, onSave, children, additionalControls,
}) => {
    const title = kind === 'inbound' ? '입고' : '출고';
    const Icon = kind === 'inbound' ? ArrowDown : ArrowUp;

    return <section className={`material-registration-header material-registration-header--${kind}`} aria-label={`${title} 기본정보`}>
        <div className="material-registration-header__row">
            <h1 className="material-registration-header__title"><Icon size={19} />{title} 등록</h1>
            <div className="material-registration-header__fields">{children}</div>
            <div className="material-registration-header__actions">
                <button type="button" className="material-registration-header__save" onClick={onSave} disabled={saving}>
                    <Save size={16} />{saving ? '저장 중...' : `${title} 완료`}
                </button>
            </div>
        </div>
        <div className="material-registration-header__extras" role="group" aria-label={`${title} 부가 기능`}>
            {additionalControls}
        </div>
    </section>;
};

export default MaterialRegistrationHeader;
