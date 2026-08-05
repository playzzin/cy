import React, { useMemo } from 'react';

export interface SimplePayrollClosingRow {
    id: string;
    month: string;
    workerName: string;
    teamName: string;
    totalManDay: number;
    grossAmount: number;
    personalDeduction: number;
    taxDeduction: number;
    totalDeduction: number;
    netAmount: number;
    isValid: boolean;
    isSnapshot?: boolean;
}

export type SimplePayrollRunStatus = 'unsaved' | 'draft' | 'reviewed' | 'confirmed' | 'paid' | 'mixed';

interface SimplePayrollClosingTableProps {
    rangeLabel: string;
    rows: SimplePayrollClosingRow[];
    onOpenDetailed: () => void;
    onOpenLedger: () => void;
    runStatus: SimplePayrollRunStatus;
    statusActionDisabled?: boolean;
    statusActionLoading?: boolean;
    onSaveDraft: () => void;
    onMarkReviewed: () => void;
    onConfirm: () => void;
    onMarkPaid: () => void;
}

const formatWon = (value: number): string => `${Math.round(value || 0).toLocaleString('ko-KR')}원`;

/**
 * A read-only payroll closing overview.
 *
 * It deliberately receives calculated values from the existing payroll screen
 * instead of recalculating or persisting anything. This makes the simplified
 * view safe to introduce alongside the existing detailed payment and ledger
 * views.
 */
export const SimplePayrollClosingTable: React.FC<SimplePayrollClosingTableProps> = ({
    rangeLabel,
    rows,
    onOpenDetailed,
    onOpenLedger,
    runStatus,
    statusActionDisabled = false,
    statusActionLoading = false,
    onSaveDraft,
    onMarkReviewed,
    onConfirm,
    onMarkPaid,
}) => {
    const summary = useMemo(() => rows.reduce((acc, row) => ({
        totalManDay: acc.totalManDay + row.totalManDay,
        grossAmount: acc.grossAmount + row.grossAmount,
        personalDeduction: acc.personalDeduction + row.personalDeduction,
        taxDeduction: acc.taxDeduction + row.taxDeduction,
        netAmount: acc.netAmount + row.netAmount,
        accountReviewCount: acc.accountReviewCount + (row.isValid ? 0 : 1),
        amountReviewCount: acc.amountReviewCount + (row.netAmount < 0 ? 1 : 0),
    }), {
        totalManDay: 0,
        grossAmount: 0,
        personalDeduction: 0,
        taxDeduction: 0,
        netAmount: 0,
        accountReviewCount: 0,
        amountReviewCount: 0,
    }), [rows]);

    const runStatusMeta = getRunStatusMeta(runStatus);
    const action = runStatus === 'unsaved'
        ? { label: '초안 저장', onClick: onSaveDraft }
        : runStatus === 'draft'
            ? { label: '검토 완료', onClick: onMarkReviewed }
            : runStatus === 'reviewed'
                ? { label: '급여 확정', onClick: onConfirm }
                : runStatus === 'confirmed'
                    ? { label: '지급 완료', onClick: onMarkPaid }
                    : null;

    return (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">간편 급여 마감표</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        {rangeLabel || '선택 기간'} · {runStatusMeta.description}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-bold ${runStatusMeta.className}`}>
                        {runStatusMeta.label}
                    </span>
                    {action && (
                        <button
                            type="button"
                            onClick={action.onClick}
                            disabled={statusActionDisabled || statusActionLoading || rows.length === 0}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            {statusActionLoading ? '처리 중...' : action.label}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onOpenLedger}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        가불·공제 확인
                    </button>
                    <button
                        type="button"
                        onClick={onOpenDetailed}
                        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                    >
                        상세 급여표 보기
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3 sm:grid-cols-3 xl:grid-cols-6">
                <SummaryCard label="대상자" value={`${rows.length}명`} />
                <SummaryCard label="총공수" value={summary.totalManDay.toLocaleString('ko-KR')} />
                <SummaryCard label="총급여" value={formatWon(summary.grossAmount)} />
                <SummaryCard label="개인공제" value={`-${formatWon(summary.personalDeduction)}`} tone="amber" />
                <SummaryCard label="세금·보험" value={`-${formatWon(summary.taxDeduction)}`} tone="rose" />
                <SummaryCard label="실지급액" value={formatWon(summary.netAmount)} tone="emerald" />
            </div>

            {(summary.accountReviewCount > 0 || summary.amountReviewCount > 0) && (
                <div className="mx-3 mt-3 flex flex-wrap gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    {summary.accountReviewCount > 0 && <span>계좌 정보 확인 {summary.accountReviewCount}명</span>}
                    {summary.amountReviewCount > 0 && <span>실지급액 음수 확인 {summary.amountReviewCount}명</span>}
                </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto p-3">
                <table className="min-w-[840px] w-full border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-xs text-slate-600">
                        <tr>
                            <th className="border-y border-slate-200 px-3 py-2 text-left font-bold">월</th>
                            <th className="border-y border-slate-200 px-3 py-2 text-left font-bold">작업자</th>
                            <th className="border-y border-slate-200 px-3 py-2 text-right font-bold">총공수</th>
                            <th className="border-y border-slate-200 px-3 py-2 text-right font-bold">총급여</th>
                            <th className="border-y border-slate-200 px-3 py-2 text-right font-bold">개인공제</th>
                            <th className="border-y border-slate-200 px-3 py-2 text-right font-bold">세금·보험</th>
                            <th className="border-y border-slate-200 px-3 py-2 text-right font-bold">실지급액</th>
                            <th className="border-y border-slate-200 px-3 py-2 text-center font-bold">확인</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const needsReview = !row.isValid || row.netAmount < 0;
                            return (
                                <tr key={row.id} className="hover:bg-slate-50">
                                    <td className="border-b border-slate-100 px-3 py-2.5 text-slate-600">{row.month || '-'}</td>
                                    <td className="border-b border-slate-100 px-3 py-2.5">
                                        <div className="font-semibold text-slate-800">{row.workerName || '-'}</div>
                                        <div className="mt-0.5 text-xs text-slate-400">{row.teamName || '소속 미지정'}</div>
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-700">
                                        {row.totalManDay.toLocaleString('ko-KR')}
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-slate-800">
                                        {formatWon(row.grossAmount)}
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-amber-700">
                                        -{formatWon(row.personalDeduction)}
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-2.5 text-right tabular-nums text-rose-700">
                                        -{formatWon(row.taxDeduction)}
                                    </td>
                                    <td className={`border-b border-slate-100 px-3 py-2.5 text-right font-bold tabular-nums ${row.netAmount < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                        {formatWon(row.netAmount)}
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-2.5 text-center">
                                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${needsReview ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                            {needsReview ? '확인 필요' : row.isSnapshot ? '확정본' : '확인 완료'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                                    조회된 급여 대상자가 없습니다. 기간과 팀을 선택한 뒤 조회해 주세요.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

const getRunStatusMeta = (status: SimplePayrollRunStatus): {
    label: string;
    description: string;
    className: string;
} => {
    if (status === 'draft') {
        return {
            label: '초안',
            description: '초안 저장본입니다. 공제와 세금을 확인한 뒤 검토 완료로 진행하세요.',
            className: 'bg-slate-100 text-slate-700',
        };
    }
    if (status === 'reviewed') {
        return {
            label: '검토 완료',
            description: '저장된 급여 스냅샷을 확인했습니다. 급여 확정 시 해당 저장본은 변경할 수 없습니다.',
            className: 'bg-blue-100 text-blue-700',
        };
    }
    if (status === 'confirmed') {
        return {
            label: '급여 확정',
            description: '확정 스냅샷을 표시하고 있습니다. 원천자료가 바뀌어도 이 급여 금액은 덮어쓰지 않습니다.',
            className: 'bg-emerald-100 text-emerald-700',
        };
    }
    if (status === 'paid') {
        return {
            label: '지급 완료',
            description: '지급 완료된 급여입니다. 과거 금액 수정은 다음 달 조정으로 처리하세요.',
            className: 'bg-violet-100 text-violet-700',
        };
    }
    if (status === 'mixed') {
        return {
            label: '상태 혼합',
            description: '선택한 기간 또는 팀에 서로 다른 급여 상태가 있습니다. 팀별로 확인해 주세요.',
            className: 'bg-amber-100 text-amber-700',
        };
    }
    return {
        label: '저장 전',
        description: '현재 계산 결과입니다. 초안을 저장하면 검토·확정·지급 단계를 사용할 수 있습니다.',
        className: 'bg-slate-100 text-slate-700',
    };
};

const SummaryCard: React.FC<{
    label: string;
    value: string;
    tone?: 'amber' | 'rose' | 'emerald';
}> = ({ label, value, tone }) => {
    const toneClass = tone === 'amber'
        ? 'text-amber-700'
        : tone === 'rose'
            ? 'text-rose-700'
            : tone === 'emerald'
                ? 'text-emerald-700'
                : 'text-slate-800';

    return (
        <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm">
            <div className="text-[11px] font-semibold text-slate-400">{label}</div>
            <div className={`mt-1 text-sm font-bold tabular-nums ${toneClass}`}>{value}</div>
        </div>
    );
};
