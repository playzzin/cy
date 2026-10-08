import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { CardStatementFileAnalysisStatus, CardStatementImportResult } from '../../types/cardStatementImport';
import { reconcileCardStatement } from '../../utils/cardStatementReconciliation';

export interface CardStatementReconciliationProps {
  results: CardStatementImportResult[];
  analysisStatus: CardStatementFileAnalysisStatus;
  ledgerTotal?: number;
  title?: string;
}

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

const CardStatementReconciliation: React.FC<CardStatementReconciliationProps> = ({ results, analysisStatus, ledgerTotal, title = '카드 총액 대조' }) => {
  const summary = reconcileCardStatement(results, analysisStatus);
  const conclusive = summary.status === 'matched' || summary.status === 'mismatch';
  const ledgerDifference = ledgerTotal === undefined || !summary.transactionsAvailable ? null : Math.round((ledgerTotal - summary.transactionTotal) * 100) / 100;
  const matched = summary.status === 'matched' && (ledgerDifference === null || ledgerDifference === 0);
  const label = !conclusive ? '미확인' : matched ? '일치' : '불일치';
  const tone = !conclusive ? 'border-amber-200 bg-amber-50 text-amber-900' : matched ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900';
  const reason = summary.status === 'not_analyzed'
    ? '모든 연결 파일의 분석이 완료되어야 총액을 확인할 수 있습니다.'
    : summary.status === 'no_transactions' ? '상세 거래가 없는 명세서가 있어 총액 일치를 확인할 수 없습니다.'
      : summary.status === 'missing_total' ? '원본에서 확인한 카드 총액이 없습니다. 원본 확인 또는 재분석이 필요합니다.'
        : summary.status === 'mismatch' ? '명세서 카드 총액과 상세 사용내역의 금액이 다릅니다. 누락·중복·취소 내역을 원본과 확인해 주세요.'
          : ledgerDifference !== null && ledgerDifference !== 0 ? '명세서와 사용내역은 일치하지만, 대장 등록액과 사용내역 합계가 다릅니다.'
            : '명세서 카드 총액과 전체 상세 사용내역 합계가 일치합니다.';

  return <section aria-label={title} className={`rounded-xl border p-4 ${tone}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-extrabold">{title}</h3><span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold">{matched && conclusive ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}{label}</span></div>
    <dl className={`mt-3 grid grid-cols-2 gap-3 ${ledgerTotal === undefined ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
      {ledgerTotal !== undefined && <div><dt className="text-xs opacity-75">대장 등록액</dt><dd className="mt-1 text-lg font-extrabold tabular-nums">{won(ledgerTotal)}</dd></div>}
      <div><dt className="text-xs opacity-75">명세서 카드 총액</dt><dd className="mt-1 text-lg font-extrabold tabular-nums">{summary.statementTotal === null ? '미확인' : won(summary.statementTotal)}</dd></div>
      <div><dt className="text-xs opacity-75">전체 사용내역 합계</dt><dd className="mt-1 text-lg font-extrabold tabular-nums">{won(summary.transactionTotal)}</dd><div className="mt-1 text-xs opacity-75">{summary.transactionCount.toLocaleString('ko-KR')}건 · 취소 금액 포함</div></div>
      <div><dt className="text-xs opacity-75">명세서 − 사용내역 차액</dt><dd className="mt-1 text-lg font-extrabold tabular-nums">{!conclusive || summary.difference === null ? '미확인' : won(summary.difference)}</dd></div>
    </dl>
    {ledgerTotal !== undefined && <p className="mt-3 text-xs">대장 − 사용내역 차액: <strong>{ledgerDifference === null ? '미확인' : won(ledgerDifference)}</strong>{ledgerDifference !== null && <span className="ml-2 font-bold">대장 대비 {ledgerDifference === 0 ? '일치' : '불일치'}</span>}</p>}
    <p className="mt-2 text-xs leading-5">{reason}</p>
    <p className="mt-1 text-xs opacity-75">검색·분류 필터와 무관하게 전체 사용내역을 대조합니다. 금액 일치만으로 분석 내용의 정확성을 보장하지는 않습니다.</p>
  </section>;
};

export default CardStatementReconciliation;
