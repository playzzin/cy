import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBan,
  faCheckCircle,
  faCreditCard,
  faFilePdf,
  faMagnifyingGlass,
  faRotateRight,
  faTriangleExclamation,
  faUpload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { Card } from '../../types/card';
import type {
  CardStatementImportJobPayload,
  CardStatementImportResult,
  CardStatementImportUploadProgress,
} from '../../types/cardStatementImport';
import { cardStatementImportService } from '../../services/cardStatementImportService';

interface CardStatementImportModalProps {
  isOpen: boolean;
  yearMonth: string;
  cards: Card[];
  onClose: () => void;
  onCompleted?: () => void;
}

type Step = 'upload' | 'review';

const ANALYSIS_RECOVERY_DELAY_MS = 20_000;

const formatAmount = (amount: unknown): string => `${Number(amount || 0).toLocaleString('ko-KR')}원`;

const getCardLabel = (card: Card): string => {
  const last4 = card.last4 || String(card.maskedNumber || '').replace(/\D/g, '').slice(-4);
  return last4 ? `${card.name} (${last4})` : card.name;
};

const getBlockingWarning = (result: CardStatementImportResult): string => (
  (result.warnings ?? []).find((warning) => (
    warning.includes('카드 합계 불일치') ||
    (warning.includes('거래 합계') && warning.includes('카드 소계'))
  )) || ''
);

const requiresAmountReview = (result: CardStatementImportResult): boolean =>
  Boolean(getBlockingWarning(result)) && result.analysisReviewRequired !== false;

const getTransactionTotal = (result: CardStatementImportResult): number =>
  (result.transactions ?? []).reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

const getResultTone = (result: CardStatementImportResult): string => {
  if (requiresAmountReview(result)) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (result.status === 'matched' || result.status === 'committed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (result.status === 'excluded') return 'bg-slate-100 text-slate-500 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const getResultStatusLabel = (result: CardStatementImportResult): string => {
  if (result.status === 'committed') return '반영';
  if (result.status === 'excluded') return '제외';
  if (requiresAmountReview(result)) return '금액 확인';
  if (result.status === 'matched') return '매칭';
  return '확인';
};

const getFileStatusTone = (status: string): string => {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'analyzing') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const getFileStatusLabel = (status: string): string => {
  if (status === 'completed') return '완료';
  if (status === 'failed') return '실패';
  if (status === 'analyzing') return '분석 중';
  if (status === 'uploaded') return '대기';
  return status || '-';
};

export const CardStatementImportModal: React.FC<CardStatementImportModalProps> = ({
  isOpen,
  yearMonth,
  cards,
  onClose,
  onCompleted,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [payload, setPayload] = useState<CardStatementImportJobPayload | null>(null);
  const [progressRows, setProgressRows] = useState<CardStatementImportUploadProgress[]>([]);
  const [processing, setProcessing] = useState(false);
  const [analysisRecovering, setAnalysisRecovering] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [analysisWatch, setAnalysisWatch] = useState<{ jobId: string; startedAt: number } | null>(null);
  const [reviewingResultIds, setReviewingResultIds] = useState<Set<string>>(() => new Set());
  const [expandedResultIds, setExpandedResultIds] = useState<Set<string>>(() => new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const recoveryAttemptedJobIdsRef = useRef<Set<string>>(new Set());

  const activeResults = useMemo(
    () => (payload?.results ?? []).filter((result) => result.status !== 'excluded'),
    [payload],
  );

  const summary = useMemo(() => {
    const totalAmount = activeResults.reduce((sum, result) => sum + Number(result.subtotalAmount || 0), 0);
    const matchedAmount = activeResults
      .filter((result) => (
        (result.status === 'matched' || result.status === 'committed') &&
        result.matchedCardId &&
        !requiresAmountReview(result)
      ))
      .reduce((sum, result) => sum + Number(result.subtotalAmount || 0), 0);
    const warningCount = activeResults.reduce((sum, result) => sum + (result.warnings?.length ?? 0), 0);
    return {
      totalAmount,
      matchedAmount,
      reviewAmount: totalAmount - matchedAmount,
      cardCount: activeResults.length,
      transactionCount: activeResults.reduce((sum, result) => sum + Number(result.transactionCount || 0), 0),
      warningCount,
      needsReviewCount: activeResults.filter((result) => (
        !['matched', 'committed'].includes(result.status) ||
        !result.matchedCardId ||
        requiresAmountReview(result)
      )).length,
    };
  }, [activeResults]);

  const jobStatus = payload?.job?.status ?? '';
  const analysisRunning = jobStatus === 'analyzing';
  const actionBusy = processing || analysisRunning || analysisRecovering;
  const fileRows = payload?.files ?? [];
  const totalFileCount = Number(payload?.job?.totalFiles ?? fileRows.length ?? 0);
  const processedFileCount = Math.min(
    totalFileCount,
    Number(payload?.job?.analyzedFiles ?? fileRows.filter((file) => ['completed', 'failed'].includes(file.status)).length),
  );
  const analysisProgressPercent = totalFileCount > 0
    ? Math.round((processedFileCount / totalFileCount) * 100)
    : 0;
  const displayedErrorMessage = errorMessage || (
    jobStatus === 'failed' ? String(payload?.job?.errorMessage || '') : ''
  );
  const hasAnalysisProgress = processedFileCount > 0 ||
    activeResults.length > 0 ||
    fileRows.some((file) => ['analyzing', 'completed', 'failed'].includes(String(file.status || '')));
  const analysisElapsedMs = analysisWatch && analysisWatch.jobId === payload?.job?.id
    ? nowMs - analysisWatch.startedAt
    : 0;
  const analysisMayBeStuck = analysisRunning &&
    analysisElapsedMs >= ANALYSIS_RECOVERY_DELAY_MS &&
    !hasAnalysisProgress;
  const analysisProgressMessage = analysisRecovering
    ? '백그라운드 분석이 지연되어 서버에서 직접 이어서 실행 중입니다.'
    : analysisMayBeStuck
    ? '백그라운드 분석이 지연되고 있습니다. 분석 복구로 이어서 처리할 수 있습니다.'
    : analysisRunning
    ? 'PDF를 백그라운드에서 분석하는 중입니다.'
    : '파일별 분석 상태입니다.';

  useEffect(() => {
    const jobId = payload?.job?.id;
    if (!isOpen || !jobId) return undefined;

    const unsubscribeJob = cardStatementImportService.subscribeJob(jobId, (job) => {
      setPayload((prev) => {
        if (!prev) return prev;
        if (!job) return null;
        return { ...prev, job };
      });
    });
    const unsubscribeFiles = cardStatementImportService.subscribeFiles(jobId, (files) => {
      setPayload((prev) => (prev ? { ...prev, files } : prev));
    });
    const unsubscribeResults = cardStatementImportService.subscribeResults(jobId, (results) => {
      setPayload((prev) => (prev ? { ...prev, results } : prev));
    });

    return () => {
      unsubscribeJob();
      unsubscribeFiles();
      unsubscribeResults();
    };
  }, [isOpen, payload?.job?.id]);

  useEffect(() => {
    const jobId = payload?.job?.id;
    if (!analysisRunning || !jobId) {
      setAnalysisWatch(null);
      return;
    }
    setAnalysisWatch((prev) => (
      prev?.jobId === jobId ? prev : { jobId, startedAt: Date.now() }
    ));
  }, [analysisRunning, payload?.job?.id]);

  useEffect(() => {
    if (!analysisRunning) return undefined;
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 5_000);
    return () => window.clearInterval(intervalId);
  }, [analysisRunning]);

  useEffect(() => {
    const jobId = payload?.job?.id;
    if (!isOpen || !jobId || !analysisMayBeStuck || analysisRecovering) return;
    if (recoveryAttemptedJobIdsRef.current.has(jobId)) return;

    recoveryAttemptedJobIdsRef.current.add(jobId);
    setAnalysisRecovering(true);
    setErrorMessage('');
    void cardStatementImportService.recoverAnalysisJob(jobId)
      .then((recovered) => {
        setPayload(recovered);
        onCompleted?.();
      })
      .catch((error) => {
        console.error('[CardStatementImportModal] recover analysis failed', error);
        setErrorMessage(error instanceof Error ? error.message : '분석 복구에 실패했습니다.');
      })
      .finally(() => {
        setAnalysisRecovering(false);
      });
  }, [analysisMayBeStuck, analysisRecovering, isOpen, onCompleted, payload?.job?.id]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (processing || analysisRecovering) return;
    setStep('upload');
    setSelectedFiles([]);
    setPayload(null);
    setProgressRows([]);
    setAnalysisWatch(null);
    setAnalysisRecovering(false);
    recoveryAttemptedJobIdsRef.current.clear();
    setReviewingResultIds(new Set());
    setExpandedResultIds(new Set());
    setErrorMessage('');
    onClose();
  };

  const handleFileChange = (fileList: FileList | null) => {
    setErrorMessage('');
    setSelectedFiles(Array.from(fileList ?? []));
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) {
      setErrorMessage('분석할 국민은행 PDF를 선택해 주세요.');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    setPayload(null);
    setProgressRows([]);
    setAnalysisWatch(null);
    setAnalysisRecovering(false);
    recoveryAttemptedJobIdsRef.current.clear();
    setExpandedResultIds(new Set());
    try {
      const created = await cardStatementImportService.createJobFromFiles(
        yearMonth,
        selectedFiles,
        (progress) => {
          setProgressRows((prev) => {
            const next = prev.filter((row) => row.fileIndex !== progress.fileIndex);
            next.push(progress);
            return next.sort((a, b) => a.fileIndex - b.fileIndex);
          });
        },
      );
      const analyzed = await cardStatementImportService.analyzeJob(created.jobId);
      setPayload(analyzed);
      setStep('review');
      onCompleted?.();
    } catch (error) {
      console.error('[CardStatementImportModal] analyze failed', error);
      setErrorMessage(error instanceof Error ? error.message : 'PDF 일괄 분석에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReanalyze = async () => {
    if (!payload?.job?.id || analysisRunning) return;
    setProcessing(true);
    setErrorMessage('');
    try {
      const analyzed = await cardStatementImportService.analyzeJob(payload.job.id);
      setPayload(analyzed);
      setStep('review');
      onCompleted?.();
    } catch (error) {
      console.error('[CardStatementImportModal] reanalyze failed', error);
      setErrorMessage(error instanceof Error ? error.message : '재분석에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRecoverAnalysis = async () => {
    const jobId = payload?.job?.id;
    if (!jobId || !analysisRunning || analysisRecovering) return;
    recoveryAttemptedJobIdsRef.current.add(jobId);
    setAnalysisRecovering(true);
    setErrorMessage('');
    try {
      const recovered = await cardStatementImportService.recoverAnalysisJob(jobId);
      setPayload(recovered);
      onCompleted?.();
    } catch (error) {
      console.error('[CardStatementImportModal] recover analysis failed', error);
      setErrorMessage(error instanceof Error ? error.message : '분석 복구에 실패했습니다.');
    } finally {
      setAnalysisRecovering(false);
    }
  };

  const handleCommit = async () => {
    if (!payload?.job?.id || analysisRunning || summary.needsReviewCount > 0 || activeResults.length === 0) return;
    setProcessing(true);
    setErrorMessage('');
    try {
      const committed = await cardStatementImportService.commitJob(payload.job.id);
      setPayload(committed);
      onCompleted?.();
    } catch (error) {
      console.error('[CardStatementImportModal] commit failed', error);
      setErrorMessage(error instanceof Error ? error.message : '원장 반영에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const patchResultLocal = (resultId: string, patch: Partial<CardStatementImportResult>) => {
    setPayload((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        results: prev.results.map((result) => (
          result.id === resultId ? { ...result, ...patch } : result
        )),
      };
    });
  };

  const setResultReviewing = (resultId: string, isReviewing: boolean) => {
    setReviewingResultIds((prev) => {
      const next = new Set(prev);
      if (isReviewing) next.add(resultId);
      else next.delete(resultId);
      return next;
    });
  };

  const handleMatchCard = async (result: CardStatementImportResult, cardId: string) => {
    const card = cards.find((item) => String(item.id) === String(cardId)) ?? null;
    const patch = card
      ? {
          matchedCardId: card.id,
          matchedCardLabel: getCardLabel(card),
          matchConfidence: 1,
          status: 'matched' as const,
          analysisReviewRequired: false,
        }
      : {
          matchedCardId: null,
          matchedCardLabel: null,
          matchConfidence: 0,
          status: 'needs_review' as const,
          analysisReviewRequired: Boolean(getBlockingWarning(result)),
        };
    patchResultLocal(result.id, patch);
    setErrorMessage('');
    setResultReviewing(result.id, true);
    try {
      const updated = await cardStatementImportService.updateResultReview(result.id, {
        matchedCardId: card ? card.id : null,
      });
      setPayload(updated);
    } catch (error) {
      console.error('[CardStatementImportModal] update review failed', error);
      patchResultLocal(result.id, result);
      setErrorMessage(error instanceof Error ? error.message : '검수 결과 수정에 실패했습니다.');
    } finally {
      setResultReviewing(result.id, false);
    }
  };

  const toggleResultExpanded = (resultId: string) => {
    setExpandedResultIds((prev) => {
      const next = new Set(prev);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  };

  const handleConfirmAmountReview = async (result: CardStatementImportResult) => {
    if (!result.matchedCardId) {
      setErrorMessage('금액 확인을 완료하려면 먼저 카드를 매칭해 주세요.');
      return;
    }
    await handleMatchCard(result, result.matchedCardId);
  };

  const handleExclude = async (result: CardStatementImportResult) => {
    patchResultLocal(result.id, { status: 'excluded' });
    setErrorMessage('');
    setResultReviewing(result.id, true);
    try {
      const updated = await cardStatementImportService.excludeResult(result.id);
      setPayload(updated);
    } catch (error) {
      console.error('[CardStatementImportModal] exclude result failed', error);
      patchResultLocal(result.id, result);
      setErrorMessage(error instanceof Error ? error.message : '검수 결과 제외에 실패했습니다.');
    } finally {
      setResultReviewing(result.id, false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-indigo-500">
              <FontAwesomeIcon icon={faFilePdf} />
              KB Card Statement Import
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-900">국민은행 카드 청구 PDF 일괄등록</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">{yearMonth} 월 원장에 반영할 청구 PDF를 분석합니다.</p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            disabled={processing || analysisRecovering}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
            aria-label="닫기"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-50 px-5 py-3">
          {(['upload', 'review'] as Step[]).map((item, index) => (
            <div key={item} className="flex items-center gap-2 text-sm font-extrabold">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                step === item ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-500'
              }`}>
                {index + 1}
              </span>
              <span className={step === item ? 'text-indigo-700' : 'text-slate-500'}>
                {item === 'upload' ? '업로드' : '분석 검수'}
              </span>
              {index === 0 && <span className="mx-3 h-px w-10 bg-slate-300" />}
            </div>
          ))}
        </div>

        {displayedErrorMessage && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />
            <span className="whitespace-pre-line">{displayedErrorMessage}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {step === 'upload' ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <label className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-8 text-center hover:bg-indigo-50">
                <FontAwesomeIcon icon={faUpload} className="text-4xl text-indigo-500" />
                <div className="mt-4 text-lg font-black text-slate-900">PDF 여러 장 선택</div>
                <div className="mt-2 text-sm font-medium text-slate-500">국민은행에서 내려받은 월별 법인카드 청구 PDF를 선택합니다.</div>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  disabled={processing}
                  onChange={(event) => handleFileChange(event.target.files)}
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-black text-slate-900">선택 파일</div>
                <div className="mt-1 text-xs font-bold text-slate-500">{selectedFiles.length.toLocaleString('ko-KR')}개</div>
                <div className="mt-4 max-h-[260px] space-y-2 overflow-auto">
                  {selectedFiles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm font-medium text-slate-400">
                      아직 선택된 파일이 없습니다.
                    </div>
                  ) : selectedFiles.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${index}`} className="rounded-xl border border-slate-200 px-3 py-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <FontAwesomeIcon icon={faFilePdf} className="text-rose-500" />
                        <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      </div>
                      <div className="mt-1 text-xs font-mono text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  ))}
                </div>

                {progressRows.length > 0 && (
                  <div className="mt-4 space-y-1 text-xs font-bold text-slate-500">
                    {progressRows.map((row) => (
                      <div key={`${row.fileIndex}-${row.status}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">{row.fileName}</span>
                        <span className={row.status === 'failed' ? 'text-rose-600' : 'text-emerald-600'}>
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                  ['총 청구액', formatAmount(summary.totalAmount), 'text-indigo-700'],
                  ['매칭 금액', formatAmount(summary.matchedAmount), 'text-emerald-700'],
                  ['확인 필요', formatAmount(summary.reviewAmount), 'text-amber-700'],
                  ['카드', summary.cardCount.toLocaleString('ko-KR'), 'text-slate-800'],
                  ['거래', summary.transactionCount.toLocaleString('ko-KR'), 'text-slate-800'],
                  ['경고', summary.warningCount.toLocaleString('ko-KR'), 'text-rose-700'],
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-extrabold text-slate-500">{label}</div>
                    <div className={`mt-1 text-lg font-black ${tone}`}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-black text-slate-900">분석 진행</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      {analysisProgressMessage}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-black text-slate-800">
                      {processedFileCount.toLocaleString('ko-KR')} / {totalFileCount.toLocaleString('ko-KR')}개
                    </div>
                    {analysisRunning && (
                      <button
                        type="button"
                        onClick={() => void handleRecoverAnalysis()}
                        disabled={!analysisMayBeStuck || analysisRecovering}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-extrabold text-indigo-700 hover:bg-indigo-100 disabled:cursor-wait disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        title={analysisMayBeStuck ? '지연된 분석을 서버에서 직접 이어서 실행합니다.' : '분석 진행이 지연될 때 활성화됩니다.'}
                      >
                        <FontAwesomeIcon icon={faRotateRight} className={analysisRecovering ? 'animate-spin' : ''} />
                        {analysisRecovering ? '복구 중' : '분석 복구'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${analysisRunning ? 'bg-indigo-600' : 'bg-emerald-600'}`}
                    style={{ width: `${Math.max(0, Math.min(100, analysisProgressPercent))}%` }}
                  />
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {fileRows.map((file) => (
                    <div key={file.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                          {file.originalFileName || `PDF ${file.fileIndex + 1}`}
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${getFileStatusTone(file.status)}`}>
                          {getFileStatusLabel(file.status)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-slate-500">
                        <span>카드 {Number(file.cardCount || 0).toLocaleString('ko-KR')}</span>
                        <span>거래 {Number(file.transactionCount || 0).toLocaleString('ko-KR')}</span>
                        <span>{formatAmount(file.grandTotalAmount)}</span>
                      </div>
                      {file.errorMessage && (
                        <div className="mt-1 truncate text-xs font-bold text-rose-600">{file.errorMessage}</div>
                      )}
                    </div>
                  ))}
                  {fileRows.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm font-bold text-slate-400">
                      파일 상태를 불러오는 중입니다.
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-900 text-xs font-extrabold text-white">
                    <tr>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3">파일 / 카드</th>
                      <th className="px-4 py-3">자동 매칭</th>
                      <th className="px-4 py-3 text-right">금액</th>
                      <th className="px-4 py-3 text-center">거래</th>
                      <th className="px-4 py-3">수동 매칭</th>
                      <th className="px-4 py-3">경고</th>
                      <th className="px-4 py-3 text-center">처리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(payload?.results ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center font-bold text-slate-400">
                          {analysisRunning ? '분석 결과가 생성되는 대로 표시됩니다.' : '분석 결과가 없습니다.'}
                        </td>
                      </tr>
                    ) : payload!.results.map((result) => {
                      const isReviewing = reviewingResultIds.has(result.id);
                      const blockingWarning = getBlockingWarning(result);
                      const amountReviewRequired = requiresAmountReview(result);
                      const isExpanded = expandedResultIds.has(result.id);
                      const transactionTotal = getTransactionTotal(result);
                      const amountDelta = transactionTotal - Number(result.subtotalAmount || 0);
                      const transactionRows = result.transactions ?? [];
                      return (
                      <React.Fragment key={result.id}>
                      <tr className={result.status === 'excluded' ? 'bg-slate-50 opacity-70' : amountReviewRequired ? 'bg-rose-50/40' : 'bg-white'}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold ${getResultTone(result)}`}>
                            {getResultStatusLabel(result)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{result.originalFileName || '-'}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {result.cardName || '카드명 없음'} {result.cardLast4 ? `· ${result.cardLast4}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-bold text-slate-800">
                            <FontAwesomeIcon icon={faCreditCard} className="text-indigo-500" />
                            <span>{result.matchedCardLabel || '미매칭'}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-400">신뢰도 {Math.round(Number(result.matchConfidence || 0) * 100)}%</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-slate-900">{formatAmount(result.subtotalAmount)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleResultExpanded(result.id)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-extrabold ${
                              blockingWarning
                                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {Number(result.transactionCount || 0).toLocaleString('ko-KR')}건
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={result.matchedCardId || ''}
                            disabled={actionBusy || isReviewing || result.status === 'excluded' || result.status === 'committed'}
                            onChange={(event) => void handleMatchCard(result, event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                          >
                            <option value="">카드 선택</option>
                            {cards.map((card) => (
                              <option key={card.id} value={card.id}>{getCardLabel(card)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {(result.warnings ?? []).length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                              <FontAwesomeIcon icon={faCheckCircle} />
                              없음
                            </span>
                          ) : (
                            <div className="max-w-[300px] space-y-2">
                              {blockingWarning && (
                                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-700">
                                  <div>{blockingWarning}</div>
                                  <div className="mt-1 grid gap-1 font-mono text-[11px]">
                                    <span>거래합계 {formatAmount(transactionTotal)}</span>
                                    <span>카드소계 {formatAmount(result.subtotalAmount)}</span>
                                    <span>차이 {formatAmount(amountDelta)}</span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => toggleResultExpanded(result.id)}
                                      className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-extrabold text-rose-700 hover:bg-rose-100"
                                    >
                                      {isExpanded ? '거래 접기' : '거래 보기'}
                                    </button>
                                    {amountReviewRequired && result.matchedCardId && (
                                      <button
                                        type="button"
                                        onClick={() => void handleConfirmAmountReview(result)}
                                        disabled={actionBusy || isReviewing || result.status === 'excluded' || result.status === 'committed'}
                                        className="rounded-md bg-rose-700 px-2 py-1 text-[11px] font-extrabold text-white hover:bg-rose-800 disabled:cursor-wait disabled:bg-slate-300"
                                      >
                                        검수 완료
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                              {result.warnings.filter((warning) => warning !== blockingWarning).slice(0, 3).map((warning, index) => (
                                <div key={`${result.id}-warning-${index}`} className={`truncate text-xs font-bold ${blockingWarning ? 'text-slate-500' : 'text-amber-700'}`}>
                                  {warning}
                                </div>
                              ))}
                              {result.warnings.filter((warning) => warning !== blockingWarning).length > 3 && (
                                <div className="text-xs font-bold text-slate-400">+{result.warnings.filter((warning) => warning !== blockingWarning).length - 3}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => void handleExclude(result)}
                            disabled={actionBusy || isReviewing || result.status === 'excluded' || result.status === 'committed'}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title="저장 대상에서 제외"
                          >
                            <FontAwesomeIcon icon={faBan} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className={blockingWarning ? 'bg-rose-50/50' : 'bg-slate-50'}>
                          <td colSpan={8} className="px-4 py-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-black text-slate-900">거래 상세</div>
                                <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">거래합계 {formatAmount(transactionTotal)}</span>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">카드소계 {formatAmount(result.subtotalAmount)}</span>
                                  {blockingWarning && (
                                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">차이 {formatAmount(amountDelta)}</span>
                                  )}
                                </div>
                              </div>
                              {transactionRows.length === 0 ? (
                                <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm font-bold text-slate-400">
                                  추출된 거래가 없습니다.
                                </div>
                              ) : (
                                <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200">
                                  <table className="w-full min-w-[720px] text-xs">
                                    <thead className="bg-slate-100 text-slate-600">
                                      <tr>
                                        <th className="px-3 py-2 text-left">일자</th>
                                        <th className="px-3 py-2 text-left">가맹점</th>
                                        <th className="px-3 py-2 text-left">분류</th>
                                        <th className="px-3 py-2 text-right">금액</th>
                                        <th className="px-3 py-2 text-left">메모</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {transactionRows.map((transaction, transactionIndex) => (
                                        <tr key={`${result.id}-${transaction.id || transactionIndex}`}>
                                          <td className="px-3 py-2 font-mono text-slate-600">{transaction.date || '-'}</td>
                                          <td className="px-3 py-2 font-bold text-slate-800">{transaction.merchant || '-'}</td>
                                          <td className="px-3 py-2 text-slate-500">{transaction.category || '-'}</td>
                                          <td className={`px-3 py-2 text-right font-mono font-black ${Number(transaction.amount || 0) < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                                            {formatAmount(transaction.amount)}
                                          </td>
                                          <td className="px-3 py-2 text-slate-500">{transaction.memo || ''}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-bold text-slate-500">
            {step === 'review' && analysisRecovering
              ? '지연된 분석을 서버에서 이어서 실행 중입니다.'
              : step === 'review' && analysisRunning
              ? `분석 진행 중 ${processedFileCount.toLocaleString('ko-KR')} / ${totalFileCount.toLocaleString('ko-KR')}개`
              : step === 'review' && summary.needsReviewCount > 0
              ? `저장 전 확인 필요 항목 ${summary.needsReviewCount.toLocaleString('ko-KR')}건`
              : 'AI 분석 결과는 검수 후 저장 단계에서 원장에 반영됩니다.'}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {step === 'review' && (
              <button
                type="button"
                onClick={() => void handleReanalyze()}
                disabled={actionBusy || !payload?.job?.id}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faRotateRight} className={processing ? 'animate-spin' : ''} />
                재분석
              </button>
            )}
            <button
              type="button"
              onClick={resetAndClose}
              disabled={processing || analysisRecovering}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50"
            >
              닫기
            </button>
            {step === 'upload' ? (
              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={processing || selectedFiles.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} className={processing ? 'animate-pulse' : ''} />
                {processing ? '분석 시작 중...' : '업로드 후 분석'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleCommit()}
                disabled={actionBusy || !payload?.job?.id || summary.needsReviewCount > 0 || activeResults.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                title={summary.needsReviewCount > 0 ? '확인 필요 항목을 먼저 매칭하거나 제외하세요.' : '검수 완료 결과를 카드 원장에 반영합니다.'}
              >
                <FontAwesomeIcon icon={faCheckCircle} />
                {processing ? '반영 중...' : '원장 반영'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardStatementImportModal;
