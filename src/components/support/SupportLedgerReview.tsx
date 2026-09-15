import React, { useEffect, useRef, useState } from 'react';
import { LedgerReviewBill, LedgerReviewFinding, LedgerReviewSource, reviewSupportLedger } from '../../utils/supportLedgerReview';

export function SupportLedgerReview({ kind, month, blocked, revision, billingRevision, prepare, reload }: {
    kind: 'accommodation' | 'vehicle'; month: string; blocked: boolean; revision: unknown; billingRevision: unknown;
    prepare: () => { sources: LedgerReviewSource[]; bills: LedgerReviewBill[] };
    reload: () => Promise<void>;
}) {
    const [result, setResult] = useState<{ findings: LedgerReviewFinding[]; count: number; time: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const generation = useRef(0);
    useEffect(() => { generation.current += 1; setResult(null); setError(''); setBusy(false); }, [month, revision, billingRevision, blocked]);
    useEffect(() => () => { generation.current += 1; }, []);
    const scan = async () => {
        const ticket = ++generation.current;
        setBusy(true); setError(''); setResult(null);
        try {
            const { reviewSavedLedgerPosting } = await import('../../services/supportLedgerReviewService');
            const { sources, bills } = prepare();
            const findings = [...reviewSupportLedger(sources, bills), ...await reviewSavedLedgerPosting(kind, month, bills, sources)];
            if (generation.current === ticket) setResult({ findings, count: sources.length, time: new Date().toLocaleString('ko-KR') });
        } catch {
            if (generation.current === ticket) setError('자료를 모두 읽지 못해 검사를 완료하지 못했습니다. 자료를 새로 불러온 뒤 다시 검사해 주세요.');
        } finally { if (generation.current === ticket) setBusy(false); }
    };
    return <details className="shrink-0 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-bold text-slate-800">{kind === 'accommodation' ? '숙소' : '차량'} 원장·청구·정산 대조</summary>
        <p className="mt-3 text-sm text-slate-600">{month} 전체 원장을 검사합니다. 화면의 팀·검색 필터와 관계없이 부담 대상과 항목별 청구 금액, 저장된 정산을 대조합니다.</p>
        <p className="mt-1 text-xs text-slate-500">불러온 원장 기준입니다. 먼저 자료를 새로 불러오면 최신 상태를 확인할 수 있습니다. 확정본을 수정하지 않으며, 실제 은행 지급 여부는 검사하지 않습니다.</p>
        <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={blocked || busy} onClick={reload} className="rounded border px-3 py-2 text-sm disabled:opacity-40">자료 새로 불러오기</button>
            <button type="button" disabled={blocked || busy} onClick={scan} className="rounded bg-indigo-700 px-3 py-2 text-sm text-white disabled:opacity-40">{busy ? '검사 중' : '월 전체 대조하기'}</button>
        </div>
        <div className="mt-2 flex gap-4 text-sm text-indigo-700"><a href="/payroll/team-settlement">저장 정산 열기</a><a href="/payroll/advance-payment">개인 공제 열기</a></div>
        {blocked && <p role="status" className="mt-2 text-sm">자료를 불러온 후 변경사항을 저장해야 검사할 수 있습니다. 읽기 오류가 있었다면 원장을 다시 열어 주세요.</p>}
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        {result && <div className="mt-3 text-sm" role="status">
            <p>{result.time} · 원장 {result.count}건 · 금액·중복 차이 {result.findings.filter(f => f.level === 'difference').length}건 · 추가 확인 {result.findings.filter(f => f.level === 'unverified').length}건</p>
            {!result.findings.length && <p className="mt-2">{result.count ? '검사 범위에서 차이를 발견하지 못했습니다.' : '이 월에는 대조할 원장과 청구가 없습니다.'}</p>}
            <ul className="mt-2 max-h-80 space-y-2 overflow-auto">{result.findings.map((finding, index) => <li key={index} className="rounded bg-slate-50 p-3">
                <p className="font-semibold">{finding.label} · {finding.title}</p><p>{finding.detail}</p>
                {finding.expected !== undefined && <p>기준 {Number.isFinite(finding.expected) ? finding.expected.toLocaleString() + '원' : '금액 확인 필요'} / 반영 {Number.isFinite(finding.actual) ? finding.actual?.toLocaleString() + '원' : '금액 확인 필요'} / 차이 {Number.isFinite(finding.expected) && Number.isFinite(finding.actual) ? (finding.expected - finding.actual!).toLocaleString() + '원' : '계산 불가'}</p>}
            </li>)}</ul>
        </div>}
    </details>;
}
