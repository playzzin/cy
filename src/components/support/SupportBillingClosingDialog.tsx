import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  supportBillingClosingService,
  type SupportBillingClosingPreview,
  type SupportBillingClosingRow,
  type SupportBillingDomain,
} from '../../services/supportBillingClosingService';

const labels = { card: '카드', vehicle: '차량', accommodation: '숙소' };
const statuses: Record<string, string> = { DRAFT: '작성 중', CONFIRMED: '확정', PAID: '지급 완료', OVERDUE: '연체', CANCELLED: '취소' };
const amount = (value: number | null) => value === null ? '상세에서 확인' : `${value.toLocaleString('ko-KR')}원`;
const errorMessage = (error: unknown) => {
  const code = (error as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return '급여·정산 상태를 확인할 권한이 없습니다. 정산 담당자에게 확인해 주세요.';
  if (code.includes('unavailable') || code.includes('failed-precondition')) return '서버에서 최신 자료를 확인할 수 없습니다. 연결 상태를 확인한 뒤 다시 조회해 주세요.';
  return error instanceof Error ? error.message : '처리 상태를 확인할 수 없습니다. 목록을 새로고침해 주세요.';
};

interface Props { domain: SupportBillingDomain; yearMonth: string; onClose: () => void; externalBlockedReason?: string | null }

const SupportBillingClosingDialog: React.FC<Props> = ({ domain, yearMonth, onClose, externalBlockedReason }) => {
  const [rows, setRows] = useState<SupportBillingClosingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<SupportBillingClosingPreview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const request = useRef(0);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const closeButton = useRef<HTMLButtonElement>(null);

  const refresh = async () => {
    const sequence = ++request.current;
    setLoading(true); setChecking(false); setPreview(null); setError(''); setReason('');
    try {
      const next = await supportBillingClosingService.list(domain, yearMonth);
      if (alive.current && sequence === request.current) setRows(next);
    } catch (error) {
      if (alive.current && sequence === request.current) { setRows([]); setError(errorMessage(error)); }
    } finally {
      if (alive.current && sequence === request.current) setLoading(false);
    }
  };

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => { alive.current = false; request.current += 1; };
    // The parent captures the domain/month when opening, preserving the ledger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, yearMonth]);

  const check = async (row: SupportBillingClosingRow) => {
    const sequence = ++request.current;
    setChecking(true); setPreview(null); setReason(''); setError(''); setNotice('');
    try {
      const next = await supportBillingClosingService.preview(domain, row.id, yearMonth);
      if (alive.current && sequence === request.current) setPreview(next);
    } catch (error) {
      if (alive.current && sequence === request.current) setError(errorMessage(error));
    } finally {
      if (alive.current && sequence === request.current) setChecking(false);
    }
  };

  const apply = async () => {
    if (!preview || preview.blockedReason || externalBlockedReason || !preview.action || inFlight.current) return;
    if (preview.action === 'reopen' && !reason.trim()) return;
    inFlight.current = true; setSaving(true); setError('');
    try {
      await supportBillingClosingService.apply(preview, reason);
      if (!alive.current) return;
      setNotice(preview.action === 'confirm' ? '청구를 확정하고 처리 이력을 저장했습니다.' : '확정을 취소하고 처리 이력을 저장했습니다. 청구 금액은 유지됩니다.');
      await refresh();
    } catch (error) {
      if (alive.current) { setError(errorMessage(error)); setPreview(null); }
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const visibleRows = rows.filter(row => `${row.title} ${row.teamName} ${row.targetName}`.toLowerCase().includes(search.trim().toLowerCase()));
  const busy = loading || saving;

  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !inFlight.current) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-sm" />
        <Dialog.Content
          onOpenAutoFocus={event => { event.preventDefault(); closeButton.current?.focus(); }}
          onInteractOutside={event => event.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[91] flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
            <div>
              <Dialog.Title className="text-lg font-extrabold text-slate-900">{labels[domain]} 청구 마감 · {yearMonth}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-600">저장된 청구서를 한 건씩 확인하고 확정하거나 확정을 취소합니다.</Dialog.Description>
            </div>
            <button ref={closeButton} type="button" disabled={saving} onClick={onClose} className="shrink-0 rounded-lg border px-3 py-2 text-sm disabled:opacity-40" aria-label="청구 마감 닫기">닫기</button>
          </header>
          <div className="overflow-y-auto p-4 sm:p-6">
            <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">입력 중인 내용은 관리대장에서 먼저 저장해 주세요. 이 화면은 저장된 자료만 처리하며 월 전체를 일괄 마감하지 않습니다.</p>
            {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section aria-label="저장된 청구 목록" className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input aria-label="청구서 검색" value={search} onChange={event => setSearch(event.target.value)} placeholder="팀·대상·카드·차량 검색" disabled={saving} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <button type="button" onClick={() => void refresh()} disabled={busy} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">새로고침</button>
                </div>
                <p className="mb-2 text-xs text-slate-500">{loading ? '최신 청구 자료를 불러오는 중…' : `${visibleRows.length}건 · 확정 ${rows.filter(row => row.status === 'CONFIRMED').length}건`}</p>
                <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                  {!loading && !error && visibleRows.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">해당 조건의 저장된 청구서가 없습니다.</p>}
                  {!loading && visibleRows.map(row => (
                    <button key={row.id} type="button" disabled={saving} onClick={() => void check(row)} aria-pressed={preview?.id === row.id} className={`w-full rounded-xl border p-3 text-left disabled:opacity-50 ${preview?.id === row.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex items-start justify-between gap-2"><span className="break-words font-bold text-slate-800">{row.title}</span><span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{statuses[row.status] || '상태 확인 필요'}</span></div>
                      <p className="mt-1 break-words text-xs text-slate-500">{row.teamName} · {row.targetName}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-700">{amount(row.totalAmount)}</p>
                    </button>
                  ))}
                </div>
              </section>
              <section aria-label="마감 전 확인" className="min-w-0 rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">마감 전 확인</h3>
                {checking && <p role="status" className="mt-4 text-sm text-slate-500">최신 청구 내용과 급여·팀정산 상태를 확인하는 중…</p>}
                {!checking && !preview && <p className="mt-4 text-sm leading-6 text-slate-500">목록에서 청구서를 선택해 주세요. 처리 가능 여부와 영향을 먼저 확인합니다.</p>}
                {preview && <>
                  <p className="mt-4 break-words font-bold">{preview.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{preview.teamName} · {preview.targetName} · {statuses[preview.status] || '확인 필요'}</p>
                  <dl className="my-4 max-h-48 space-y-2 overflow-y-auto text-sm">
                    {preview.lineItems.map((item, index) => <div key={index} className="flex justify-between gap-3"><dt className="break-words text-slate-600">{item.label || '청구 항목'}</dt><dd className="shrink-0 font-medium">{Number.isFinite(item.amount) ? amount(item.amount) : '금액 확인 필요'}</dd></div>)}
                  </dl>
                  <div className="flex justify-between gap-2 border-t pt-3 font-bold"><span>청구 합계</span><span>{amount(preview.totalAmount)}</span></div>
                  <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{preview.impact}</p>
                  {preview.blockedReason || externalBlockedReason ? <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">{preview.blockedReason || externalBlockedReason}</p> : <>
                    <p className="mt-3 text-xs leading-5 text-slate-500">처리 직전에 급여·팀정산 상태를 다시 확인합니다. 처리자와 변경 전후 내용은 기존 청구 이력에 함께 기록됩니다.</p>
                    {preview.action === 'reopen' && <label className="mt-4 block text-sm font-bold text-slate-700">확정 취소 사유 <span className="text-rose-600">(필수)</span><textarea value={reason} maxLength={500} disabled={saving} onChange={event => setReason(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" placeholder="수정이 필요한 이유를 입력해 주세요." /></label>}
                    {preview.action && <button type="button" onClick={() => void apply()} disabled={saving || (preview.action === 'reopen' && !reason.trim())} className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">{saving ? '처리 중…' : preview.action === 'confirm' ? '내용 확인 후 청구 확정' : '사유를 기록하고 확정 취소'}</button>}
                  </>}
                </>}
              </section>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default SupportBillingClosingDialog;
