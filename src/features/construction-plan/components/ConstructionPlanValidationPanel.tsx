import React from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, ShieldAlert } from 'lucide-react';

export type ConstructionPlanValidationIssue = {
    id: string;
    severity: 'error' | 'warning' | 'info';
    title: string;
    description: string;
    sectionId?: string;
    field?: string;
    responsibleRole?: string;
    path?: string;
    relatedId?: string;
};

type ConstructionPlanValidationPanelProps = {
    issues: ConstructionPlanValidationIssue[];
    onSelectIssue?: (issue: ConstructionPlanValidationIssue) => void;
};

const META = {
    error: { label: '오류', Icon: ShieldAlert },
    warning: { label: '경고', Icon: AlertTriangle },
    info: { label: '안내', Icon: Info },
} as const;

export function ConstructionPlanValidationPanel({ issues, onSelectIssue }: ConstructionPlanValidationPanelProps) {
    const errors = issues.filter((issue) => issue.severity === 'error').length;
    const warnings = issues.filter((issue) => issue.severity === 'warning').length;

    return (
        <section className="cp-validation" aria-labelledby="cp-validation-title">
            <div className="cp-panel-heading">
                <div>
                    <span className="cp-eyebrow">Validation</span>
                    <h3 id="cp-validation-title">문서 검증</h3>
                </div>
                <div className="cp-validation__counts">
                    <span className="is-error">{errors}</span>
                    <span className="is-warning">{warnings}</span>
                </div>
            </div>

            {issues.length === 0 ? (
                <div className="cp-validation__clear">
                    <CheckCircle2 size={24} />
                    <div>
                        <strong>현재 확인된 오류가 없습니다</strong>
                        <p>검토 요청 전에 서버 검증을 한 번 더 진행합니다.</p>
                    </div>
                </div>
            ) : (
                <div className="cp-validation__list">
                    {issues.map((issue) => {
                        const { Icon, label } = META[issue.severity];
                        return (
                            <button
                                type="button"
                                key={issue.id}
                                className={`cp-validation__item cp-validation__item--${issue.severity}`}
                                onClick={() => onSelectIssue?.(issue)}
                            >
                                <span className="cp-validation__icon"><Icon size={16} /></span>
                                <span className="cp-validation__copy">
                                    <small>
                                        {label}{issue.field ? ` · ${issue.field}` : ''} · 담당 {issue.responsibleRole || '작성자'}
                                    </small>
                                    <strong>{issue.title}</strong>
                                    <span>{issue.description}</span>
                                </span>
                                {onSelectIssue && <ChevronRight size={15} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default ConstructionPlanValidationPanel;
