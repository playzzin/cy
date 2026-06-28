import React from 'react';
import { toShortYearDateInputValue } from '../../utils/typedDateInput';

export interface BillingPeriodTimelineItem {
    id: string;
    label: string;
    typeLabel?: string;
    startDate?: string | null;
    endDate?: string | null;
    color?: string;
}

interface BillingPeriodTimelineProps {
    items: BillingPeriodTimelineItem[];
    title?: string;
    compact?: boolean;
    emptyLabel?: string;
}

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const toDateText = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const todayText = toDateText(new Date());

const displayDate = (value?: string | null): string => (
    toShortYearDateInputValue(value) || normalizeKey(value)
);

const getPeriodState = (item: BillingPeriodTimelineItem): 'past' | 'current' | 'future' => {
    const startDate = normalizeKey(item.startDate);
    const endDate = normalizeKey(item.endDate);
    if (endDate && endDate < todayText) return 'past';
    if (startDate && startDate > todayText) return 'future';
    return 'current';
};

const getStateLabel = (state: ReturnType<typeof getPeriodState>): string => {
    if (state === 'past') return '이전';
    if (state === 'future') return '예정';
    return '현재';
};

const getStateClassName = (state: ReturnType<typeof getPeriodState>): string => {
    if (state === 'past') return 'border-slate-200 bg-slate-50 text-slate-500';
    if (state === 'future') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-indigo-200 bg-indigo-50 text-indigo-700';
};

const BillingPeriodTimeline: React.FC<BillingPeriodTimelineProps> = ({
    items,
    title = '청구기간 흐름',
    compact = false,
    emptyLabel = '등록된 청구기간이 없습니다.'
}) => {
    if (items.length === 0) {
        return <div className="text-xs font-semibold text-slate-400">{emptyLabel}</div>;
    }

    return (
        <div className={compact ? 'min-w-0' : 'rounded-2xl border border-slate-200 bg-white p-4'}>
            {!compact && (
                <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-500">
                        {items.length}구간
                    </span>
                </div>
            )}
            <div className={compact ? 'flex flex-wrap gap-1.5' : 'space-y-2'}>
                {items.map((item, index) => {
                    const state = getPeriodState(item);
                    const stateClassName = getStateClassName(state);
                    const startLabel = displayDate(item.startDate) || '시작일 없음';
                    const endLabel = displayDate(item.endDate) || '계속';

                    if (compact) {
                        return (
                            <div
                                key={item.id}
                                className={`min-w-0 rounded-lg border px-2 py-1.5 ${stateClassName}`}
                                title={`${startLabel} ~ ${endLabel} · ${item.typeLabel ? `${item.typeLabel} · ` : ''}${item.label}`}
                            >
                                <div className="flex min-w-0 items-center gap-1.5">
                                    <span
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{ backgroundColor: item.color || 'currentColor' }}
                                    />
                                    <span className="truncate text-[11px] font-extrabold">{item.label}</span>
                                    <span className="shrink-0 rounded bg-white/70 px-1 text-[10px] font-extrabold">
                                        {getStateLabel(state)}
                                    </span>
                                </div>
                                <div className="mt-0.5 truncate text-[10px] font-semibold opacity-80">
                                    {startLabel} ~ {endLabel}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={item.id} className="grid grid-cols-[18px,1fr] gap-2">
                            <div className="flex flex-col items-center pt-1">
                                <span
                                    className="h-3 w-3 rounded-full border-2 border-white shadow"
                                    style={{ backgroundColor: item.color || (state === 'current' ? '#4f46e5' : '#94a3b8') }}
                                />
                                {index < items.length - 1 && <span className="mt-1 h-full min-h-7 w-px bg-slate-200" />}
                            </div>
                            <div className={`rounded-xl border px-3 py-2 ${stateClassName}`}>
                                <div className="flex min-w-0 items-center justify-between gap-2">
                                    <div className="min-w-0 truncate text-sm font-extrabold">
                                        {item.label}
                                    </div>
                                    <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-extrabold">
                                        {getStateLabel(state)}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold opacity-85">
                                    {item.typeLabel && (
                                        <span className="rounded bg-white/70 px-1.5 py-0.5">{item.typeLabel}</span>
                                    )}
                                    <span className="rounded bg-white/70 px-1.5 py-0.5">시작 {startLabel}</span>
                                    <span className="rounded bg-white/70 px-1.5 py-0.5">종료 {endLabel}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BillingPeriodTimeline;
