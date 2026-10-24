import React, { useEffect, useState } from 'react';
import ResponsiveDetailDialog from '../../components/common/ResponsiveDetailDialog';
import { getWhiteboardSourceReport, type WhiteboardSourceReport } from '../../services/whiteboardSourceService';
import { formatManDay, positiveManDay } from '../../utils/manDayPrecision';

export interface SourceSelection {
    reportIds: string[]; date: string; workerKey: string; workerName: string; manDay: number;
}

export default function WhiteboardSourceReportDialog({ selection, onClose }: {
    selection: SourceSelection | null; onClose: () => void;
}) {
    const [reports, setReports] = useState<WhiteboardSourceReport[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        let alive = true;
        setReports([]); setError('');
        if (!selection) return;
        setLoading(true);
        Promise.all([...new Set(selection.reportIds)].map(getWhiteboardSourceReport)).then(rows => {
            if (alive) { setReports(rows); setLoading(false); }
        }).catch(() => {
            if (alive) { setError('원본 일보를 불러오지 못했습니다. 일보 삭제 또는 조회 권한 변경 여부를 확인해 주세요.'); setLoading(false); }
        });
        return () => { alive = false; };
    }, [selection, retry]);
    const matches = (worker: WhiteboardSourceReport['workers'][number]) => selection?.workerKey ===
        (worker.workerId ? `id:${worker.workerId}` : `name:${worker.name}`);
    const currentTotal = positiveManDay(reports.reduce((sum, report) => sum + (report.date !== selection?.date ? 0 :
        report.workers.length ? report.workers.filter(matches).reduce((value, worker) => value + worker.manDay, 0) : report.totalManDay), 0));
    return <ResponsiveDetailDialog open={Boolean(selection)} onOpenChange={open => { if (!open) onClose(); }}
        title="원본 일보 · 공수 내역" description={`${selection?.date || ''} ${selection?.workerName || ''} · 조회 권한에 해당하는 공수 내역입니다.`}>
        {loading ? <p role="status">원본 일보 확인 중</p> : error ? <div role="alert">
            <p>{error}</p><button type="button" className="mt-4 rounded-lg bg-indigo-600 px-4 py-3 text-white" onClick={() => setRetry(value => value + 1)}>다시 조회</button>
        </div> : selection && <div className="space-y-4">
            <div className="rounded-xl bg-indigo-50 p-4 text-indigo-900">
                <p>현황판 선택 공수 <strong>{formatManDay(selection.manDay)}</strong> · 현재 원본의 해당 작업자 공수 <strong>{formatManDay(currentTotal)}</strong></p>
                {currentTotal !== positiveManDay(selection.manDay) && <p role="alert" className="mt-2 font-bold">현황판 조회 이후 원본이 변경되었거나 작업자 정보가 달라졌습니다. 현황판을 새로고침해 주세요.</p>}
            </div>
            {reports.map(report => <section key={report.id} className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold">{report.date} · {report.siteName || '현장명 미기록'}</h3>
                <p className="text-sm text-slate-600">작성팀: {report.teamName || '팀명 미기록'}</p>
                <p className="break-all text-xs text-slate-500">일보 번호: {report.id}</p>
                <ul className="my-3 divide-y divide-slate-100">
                    {report.workers.length ? report.workers.map((worker, index) => <li key={`${worker.workerId}-${index}`}
                        className={`flex items-center justify-between gap-3 py-3 ${matches(worker) ? 'font-bold text-indigo-700' : 'text-slate-700'}`}>
                        <span className="min-w-0 break-words">{worker.name}<span className="block text-xs font-normal text-slate-500">{worker.teamName}</span></span>
                        <span className="whitespace-nowrap">{formatManDay(worker.manDay)} 공수</span>
                    </li>) : <li className="py-3">작업자 정보 미기록 · 일보 합계 {formatManDay(report.totalManDay)} 공수</li>}
                </ul>
                <p className="text-right font-bold">조회 내역 합계 {formatManDay(report.totalManDay)} 공수</p>
                {positiveManDay(report.recordedTotalManDay) !== positiveManDay(report.totalManDay) && <p className="mt-2 text-sm text-amber-800">저장된 일보 합계({formatManDay(report.recordedTotalManDay)})와 작업자별 합계가 다릅니다. 현황판은 작업자별 내역을 기준으로 집계합니다.</p>}
            </section>)}
        </div>}
    </ResponsiveDetailDialog>;
}
