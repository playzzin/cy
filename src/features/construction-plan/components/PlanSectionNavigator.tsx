import React from 'react';
import { AlertCircle, Check, ChevronRight, Circle, Minus } from 'lucide-react';
import type { PlanSection } from '../types';

type PlanSectionNavigatorProps = {
    sections: PlanSection[];
    selectedSectionId: string;
    onSelect: (sectionId: string) => void;
    disabled?: boolean;
};

const SectionStateIcon = ({ status }: { status: PlanSection['status'] }) => {
    if (status === 'complete') return <Check size={13} strokeWidth={3} />;
    if (status === 'not_applicable') return <Minus size={13} strokeWidth={2.5} />;
    if (status === 'in_progress') return <AlertCircle size={14} strokeWidth={2.2} />;
    return <Circle size={12} strokeWidth={2} />;
};

export function PlanSectionNavigator({ sections, selectedSectionId, onSelect, disabled = false }: PlanSectionNavigatorProps) {
    const completed = sections.filter((section) => section.status === 'complete' || section.status === 'not_applicable').length;
    const progress = sections.length ? Math.round((completed / sections.length) * 100) : 0;

    return (
        <nav className="cp-section-nav" aria-label="시공계획서 목차">
            <div className="cp-section-nav__summary">
                <div className="cp-section-nav__summary-row">
                    <span>문서 완성도</span>
                    <strong>{progress}%</strong>
                </div>
                <div className="cp-progress" aria-label={`문서 완성도 ${progress}%`}>
                    <span style={{ width: `${progress}%` }} />
                </div>
                <p>{completed}/{sections.length}개 섹션 확인</p>
            </div>
            <div className="cp-section-nav__heading">목차</div>
            <div className="cp-section-nav__list">
                {sections.map((section, index) => {
                    const active = section.id === selectedSectionId;
                    return (
                        <button
                            type="button"
                            key={section.id}
                            disabled={disabled}
                            onClick={() => onSelect(section.id)}
                            className={`cp-section-nav__item cp-section-nav__item--${section.status}${active ? ' is-active' : ''}`}
                            aria-current={active ? 'page' : undefined}
                        >
                            <span className="cp-section-nav__number">{String(index + 1).padStart(2, '0')}</span>
                            <span className="cp-section-nav__state"><SectionStateIcon status={section.status} /></span>
                            <span className="cp-section-nav__copy">
                                <strong>{section.title}</strong>
                                <small>
                                    {section.pageNumbers.length > 0 ? `${section.pageNumbers[0]}쪽` : '페이지 미정'}
                                    {section.required ? ' · 필수' : ''}
                                </small>
                            </span>
                            <ChevronRight size={15} className="cp-section-nav__arrow" />
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

export default PlanSectionNavigator;
