import React, { useMemo, useState } from 'react';
import { reviewPayroll, type PayrollReviewIssue, type PayrollReviewRow } from '../utils/payrollReview';

export function PayrollReviewCenter({ rows, rangeLabel, busy, onInspect }: {
    rows: PayrollReviewRow[];
    rangeLabel: string;
    busy: boolean;
    onInspect: (issue: PayrollReviewIssue) => void;
}) {
    const result = useMemo(() => reviewPayroll(rows), [rows]);
    const [search, setSearch] = useState('');
    const visible = result.issues.filter(issue => `${issue.workerName} ${issue.teamName} ${issue.month} ${issue.title}`.includes(search.trim()));
    return <details className="my-2 shrink-0 rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-800">
            정산 확인센터 · {busy ? '자료 확인 중' : rows.length === 0 ? '조회 후 확인 가능' : `금액·중복 확인 ${result.errorCount}건 / 계좌 확인 ${result.warningCount}건`}
        </summary>
        <div className="border-t border-slate-100 p-4">
            <p className="text-sm text-slate-600">{rangeLabel} · 현재 조회된 급여 {rows.length}건의 공제 합계, 지급 대상, 계좌, 저장본을 대조합니다.</p>
            <p className="mt-1 text-xs text-slate-500">확정본은 확정 당시 금액으로 점검합니다. 숙소·차량 원장 전체 대조와 실제 은행 지급 여부는 포함하지 않습니다.</p>
            {busy ? <p role="status" className="mt-3">자료를 불러오거나 계산하고 있습니다. 완료 후 결과를 확인해 주세요.</p> : <>
                {result.issues.length > 0 ? <>
                    <label className="mt-3 block text-sm">확인 항목 검색<input value={search} onChange={event => setSearch(event.target.value)} placeholder="작업자·팀·월·확인 항목" className="ml-2 rounded border px-3 py-2" /></label>
                    <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
                        {visible.map(issue => <li key={issue.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm">
                            <div><p className="font-bold text-slate-800">{issue.workerName || '작업자 미지정'} · {issue.month} · {issue.teamName} — {issue.title}</p><p className="mt-1 text-slate-600">{issue.detail}</p></div>
                            <button type="button" onClick={() => onInspect(issue)} className="shrink-0 rounded border border-slate-300 bg-white px-3 py-2">{issue.target === 'ledger' ? '가불·공제 보기' : '상세 급여 보기'}</button>
                        </li>)}
                    </ul>
                    {visible.length === 0 && <p className="mt-3">검색 조건에 맞는 항목이 없습니다.</p>}
                </> : <p className="mt-3 text-sm text-emerald-700">{rows.length ? '점검 범위에서 금액 차이·중복·계좌 누락을 발견하지 못했습니다.' : '기간과 팀을 선택한 뒤 급여를 조회해 주세요.'}</p>}
            </>}
        </div>
    </details>;
}
