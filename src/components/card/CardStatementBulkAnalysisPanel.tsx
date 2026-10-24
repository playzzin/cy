import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import type { CardStatementFileDetailPayload, CardStatementImportFile } from '../../types/cardStatementImport';
import { needsCardStatementDetailAnalysis, runCardStatementBulkAnalysis, type CardStatementBulkProgress } from '../../services/cardStatementBulkAnalysis';

interface Props {
  yearMonth: string;
  files: CardStatementImportFile[];
  disabled: boolean;
  onRunningChange: (running: boolean) => void;
  onFile: (payload: CardStatementFileDetailPayload) => void;
  onComplete: () => void;
}

export default function CardStatementBulkAnalysisPanel({ yearMonth, files, disabled, onRunningChange, onFile, onComplete }: Props) {
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState<CardStatementBulkProgress | null>(null);
  const stop = useRef(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const callbacks = useRef({ onRunningChange, onFile, onComplete });
  callbacks.current = { onRunningChange, onFile, onComplete };
  const pendingFiles = files.filter(file => file.yearMonth === yearMonth && needsCardStatementDetailAnalysis(file));
  const pendingCount = new Set(pendingFiles.map(file => file.storagePath || file.id)).size;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stop.current = true; };
  }, []);
  useEffect(() => { setProgress(null); }, [yearMonth]);
  useEffect(() => {
    if (!running) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [running]);

  const start = async (retryOnly = false) => {
    if (busy.current || disabled) return;
    const targets = retryOnly ? files.filter(file => progress?.failures.some(failure => failure.file.storagePath === file.storagePath && failure.file.id === file.id)) : pendingFiles;
    if (!targets.length) return;
    busy.current = true;
    stop.current = false;
    setStopping(false);
    setRunning(true);
    callbacks.current.onRunningChange(true);
    try {
      await runCardStatementBulkAnalysis({
        files: targets, yearMonth,
        shouldStop: () => stop.current || !mounted.current,
        onProgress: next => { if (mounted.current) setProgress(next); },
        onFile: payload => { if (mounted.current) callbacks.current.onFile(payload); },
      });
    } finally {
      busy.current = false;
      if (mounted.current) {
        setRunning(false);
        callbacks.current.onRunningChange(false);
        callbacks.current.onComplete();
      }
    }
  };

  return <section aria-label="명세서 전체 분석" className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-extrabold text-slate-900">미분석 명세서 전체 분석</h2><p className="mt-1 text-xs leading-5 text-slate-600">{yearMonth}의 상세 분석 전·실패 파일 {pendingCount}개를 순서대로 분석하고 저장합니다. 완료된 파일은 제외합니다.</p></div>
      <div className="flex flex-wrap gap-2">
        {running ? <button type="button" disabled={stopping} onClick={() => { stop.current = true; setStopping(true); }} className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">{stopping ? '현재 파일 완료 후 중단 중…' : '현재 파일 완료 후 중단'}</button>
          : <><button type="button" disabled={disabled || pendingCount === 0} onClick={() => void start()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40"><Sparkles size={16} aria-hidden="true" />미분석 전체 분석 ({pendingCount}개)</button>
            {!!progress?.failures.length && <button type="button" disabled={disabled} onClick={() => void start(true)} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-40">실패한 파일만 재시도 ({progress.failures.length}개)</button>}</>}
      </div>
    </div>
    <p className="mt-2 text-xs leading-5 text-slate-500">분석 중에는 이 화면을 열어 두세요. 화면을 벗어나면 대기 중인 분석이 중단되며, 이미 저장된 결과는 유지됩니다.</p>
    {progress && <div className="mt-3 space-y-2">
      <div role="status" aria-live="polite" className="text-sm text-slate-700"><p className="flex items-center gap-2 font-bold">{running && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}{running ? '전체 분석 진행 중' : progress.stopped ? '전체 분석 중단' : '전체 분석 완료'} · {progress.processed}/{progress.total}개 처리</p><p className="mt-1 text-xs">성공 {progress.succeeded}개 · 실패 {progress.failures.length}개 · 이미 완료·진행 중 등 제외 {progress.skipped}개</p>{running && progress.currentFileName && <p className="mt-1 break-all text-xs">현재 파일: {progress.currentFileName}</p>}</div>
      <progress aria-label="전체 분석 진행률" max={Math.max(1, progress.total)} value={progress.processed} className="h-2 w-full accent-indigo-600" />
      {progress.stopReason && <p role="alert" className="text-sm text-rose-700">{progress.stopReason}</p>}
      {!!progress.failures.length && <details className="rounded-lg bg-white/80 p-3 text-xs text-rose-700"><summary className="cursor-pointer font-bold">분석에 실패한 파일 {progress.failures.length}개</summary><ul className="mt-2 space-y-2">{progress.failures.map(failure => <li key={failure.file.id} className="break-all"><strong>{failure.file.originalFileName}</strong><p className="mt-0.5">{failure.message}</p></li>)}</ul></details>}
    </div>}
  </section>;
}
