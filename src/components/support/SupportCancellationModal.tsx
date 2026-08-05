import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBoxArchive, faXmark } from '@fortawesome/free-solid-svg-icons';
import {
  SUPPORT_CANCELLATION_REASON_LABELS,
  SUPPORT_CANCELLATION_REASON_OPTIONS,
  type SupportCancellationReason,
  type SupportCancellationResourceType,
} from '../../types/supportCancellationLog';

export interface SupportCancellationFormValue {
  reason: SupportCancellationReason;
  reasonLabel: string;
  processedDate: string;
  settlementAmount?: number;
  note: string;
}

interface SupportCancellationModalProps {
  isOpen: boolean;
  resourceType: SupportCancellationResourceType;
  resourceLabel: string;
  resourceDescription?: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (value: SupportCancellationFormValue) => Promise<void> | void;
}

const getTodayText = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const RESOURCE_TITLE: Record<SupportCancellationResourceType, string> = {
  vehicle: '차량 사용취소 처리',
  card: '카드 사용취소 처리',
  accommodation: '숙소 사용취소 처리',
};

const RESOURCE_HELP: Record<SupportCancellationResourceType, string> = {
  vehicle: '차량 만료, 매각, 약정 취소처럼 운영에서 제외되는 내역을 남깁니다.',
  card: '카드 정지, 분실, 번호 변경, 해지 내역을 남깁니다.',
  accommodation: '숙소 만료, 중간정리, 약정 취소 내역을 남깁니다.',
};

export const SupportCancellationModal: React.FC<SupportCancellationModalProps> = ({
  isOpen,
  resourceType,
  resourceLabel,
  resourceDescription,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const reasonOptions = SUPPORT_CANCELLATION_REASON_OPTIONS[resourceType];
  const [reason, setReason] = useState<SupportCancellationReason>(reasonOptions[0]);
  const [processedDate, setProcessedDate] = useState(getTodayText);
  const [settlementAmountText, setSettlementAmountText] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setReason(reasonOptions[0]);
    setProcessedDate(getTodayText());
    setSettlementAmountText('');
    setNote('');
  }, [isOpen, reasonOptions]);

  const settlementAmount = useMemo(() => {
    const normalized = settlementAmountText.replace(/,/g, '').trim();
    if (!normalized) return undefined;
    const numberValue = Number(normalized);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }, [settlementAmountText]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedNote = note.trim();
    if (!processedDate) {
      window.alert('처리일을 입력해주세요.');
      return;
    }
    if (!trimmedNote) {
      window.alert('처리 내역을 입력해주세요.');
      return;
    }

    await onSubmit({
      reason,
      reasonLabel: SUPPORT_CANCELLATION_REASON_LABELS[reason],
      processedDate,
      settlementAmount,
      note: trimmedNote,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <form onSubmit={handleSubmit} className="support-cancellation-modal w-full max-w-2xl overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl">
        <style>{`
          .support-cancellation-modal input,
          .support-cancellation-modal select,
          .support-cancellation-modal textarea {
            background-color: #ffffff;
            color: #1f2937;
            caret-color: #1f2937;
          }
          .support-cancellation-modal input::placeholder,
          .support-cancellation-modal textarea::placeholder {
            color: #94a3b8;
          }
          .support-cancellation-modal option {
            background-color: #ffffff;
            color: #1f2937;
          }
          .support-cancellation-modal input[type="checkbox"],
          .support-cancellation-modal input[type="radio"] {
            background-color: initial;
          }
        `}</style>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
              <FontAwesomeIcon icon={faBoxArchive} />
              처리 기록
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-900">{RESOURCE_TITLE[resourceType]}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{RESOURCE_HELP[resourceType]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50"
            aria-label="닫기"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">처리 대상</div>
            <div className="mt-1 text-lg font-black text-slate-900">{resourceLabel || '대상 미지정'}</div>
            {resourceDescription && (
              <div className="mt-1 text-sm font-semibold text-slate-500">{resourceDescription}</div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-black text-slate-700">처리 사유</span>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value as SupportCancellationReason)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              >
                {reasonOptions.map((option) => (
                  <option key={option} value={option}>{SUPPORT_CANCELLATION_REASON_LABELS[option]}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">처리일</span>
              <input
                type="date"
                value={processedDate}
                onChange={(event) => setProcessedDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-black text-slate-700">정산/환급 금액</span>
            <input
              value={settlementAmountText}
              onChange={(event) => setSettlementAmountText(event.target.value.replace(/[^\d,-]/g, ''))}
              placeholder="금액이 없으면 비워둡니다"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </label>

          <label className="block">
            <span className="text-sm font-black text-slate-700">처리 내역</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={5}
              placeholder="취소 사유, 정리 내용, 후속 처리 사항을 입력하세요."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold leading-6 text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
            />
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? '처리 중...' : '처리 완료'}
          </button>
        </div>
      </form>
    </div>
  );
};
