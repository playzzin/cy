import React from 'react';
import { AlertTriangle, FilePlus2, FileText, RefreshCw, SearchX } from 'lucide-react';

export function ConstructionPlanSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="cp-skeleton-list" aria-label="시공계획서를 불러오는 중" aria-busy="true">
            {Array.from({ length: rows }, (_, index) => (
                <div className="cp-skeleton-row" key={index}>
                    <div className="cp-skeleton cp-skeleton--icon" />
                    <div className="cp-skeleton-row__body">
                        <div className="cp-skeleton cp-skeleton--title" />
                        <div className="cp-skeleton cp-skeleton--text" />
                    </div>
                    <div className="cp-skeleton cp-skeleton--pill" />
                </div>
            ))}
        </div>
    );
}

type EmptyStateProps = {
    filtered?: boolean;
    onAction: () => void;
};

export function ConstructionPlanEmptyState({ filtered = false, onAction }: EmptyStateProps) {
    const Icon = filtered ? SearchX : FileText;
    return (
        <div className="cp-feedback cp-feedback--empty">
            <div className="cp-feedback__illustration" aria-hidden="true">
                <Icon size={30} strokeWidth={1.8} />
                {!filtered && <span className="cp-feedback__plus"><FilePlus2 size={15} /></span>}
            </div>
            <h2>{filtered ? '조건에 맞는 계획서가 없습니다' : '첫 시공계획서를 만들어보세요'}</h2>
            <p>
                {filtered
                    ? '검색어나 필터를 초기화하면 전체 계획서를 다시 확인할 수 있습니다.'
                    : '현장을 고르면 기본정보와 작업자 데이터를 연결해 초안 골격을 자동으로 만듭니다.'}
            </p>
            <button type="button" className="cp-button cp-button--primary" onClick={onAction}>
                {filtered ? <RefreshCw size={16} /> : <FilePlus2 size={16} />}
                {filtered ? '필터 초기화' : '새 계획서 만들기'}
            </button>
        </div>
    );
}

export function ConstructionPlanErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="cp-feedback cp-feedback--error" role="alert">
            <div className="cp-feedback__illustration"><AlertTriangle size={30} /></div>
            <h2>계획서를 불러오지 못했습니다</h2>
            <p>네트워크 상태를 확인한 뒤 다시 시도해주세요. 입력한 데이터는 변경되지 않습니다.</p>
            <button type="button" className="cp-button cp-button--secondary" onClick={onRetry}>
                <RefreshCw size={16} /> 다시 시도
            </button>
        </div>
    );
}
