import React, { useEffect, useRef, useState } from 'react';
import { supportLedgerMemoService } from '../../services/supportLedgerMemoService';
import { editableSupportMemo } from '../../utils/supportLedgerMemo';

type MemoSession = {
  key: string; value: string; saved: string; expected: string | null;
  ready: boolean; busy: boolean; active: boolean; error: boolean; message: string;
  timer?: ReturnType<typeof setTimeout>;
};

export function SupportLedgerMemo({ memoKey, label, initialMemo, disabled = false }: { memoKey: string; label: string; initialMemo?: string; disabled?: boolean }) {
  const [state, setState] = useState({ value: '', saved: '', ready: false, busy: false, error: false, message: '' });
  const sessionRef = useRef<MemoSession | null>(null);
  const publish = (session: MemoSession) => {
    if (!session.active || sessionRef.current !== session) return;
    const { value, saved, ready, busy, error, message } = session;
    setState({ value, saved, ready, busy, error, message });
  };
  const clearTimer = (session: MemoSession) => {
    clearTimeout(session.timer);
    session.timer = undefined;
  };
  const save = async (session: MemoSession, retry = false): Promise<void> => {
    clearTimer(session);
    if (!session.ready || session.busy || session.value === session.saved || (session.error && !retry)) return;
    const submitted = session.value;
    session.busy = true; session.error = false; session.message = '';
    publish(session);
    try {
      await supportLedgerMemoService.save(session.key, submitted, session.expected);
      session.expected = submitted; session.saved = submitted; session.message = '자동 저장됨';
    } catch (error) {
      session.error = true;
      session.message = error instanceof Error ? error.message : '저장하지 못했습니다. 다시 시도해 주세요.';
    } finally {
      session.busy = false;
      publish(session);
    }
    // Serialize writes so typing during a save never loses the latest text or uses a stale expected value.
    if (!session.error && session.value !== session.saved) await save(session);
  };

  useEffect(() => {
    const session: MemoSession = { key: memoKey, value: '', saved: '', expected: null, ready: false,
      busy: false, active: true, error: false, message: '' };
    sessionRef.current = session;
    publish(session);
    const protectUnsaved = (event: BeforeUnloadEvent) => {
      if (!session.ready || (!session.busy && session.value === session.saved)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectUnsaved);
    supportLedgerMemoService.read(memoKey).then(memo => {
      if (!session.active) return;
      const text = memo ?? editableSupportMemo(initialMemo);
      session.expected = memo; session.value = text; session.saved = text; session.ready = true;
      publish(session);
    }).catch(() => {
      session.error = true; session.message = '비고를 불러오지 못했습니다. 화면을 다시 열어 주세요.';
      publish(session);
    });
    return () => {
      session.active = false;
      window.removeEventListener('beforeunload', protectUnsaved);
      clearTimer(session);
      // A month/row change flushes this session using its own key, never the next row's key.
      void save(session);
    };
    // initialMemo is a legacy fallback, not a reason to replace an in-progress edit when amounts reload.
  }, [memoKey]);

  const change = (value: string) => {
    const session = sessionRef.current;
    if (!session?.ready || disabled) return;
    session.value = value; session.message = ''; session.error = false;
    publish(session);
    clearTimer(session);
    session.timer = setTimeout(() => void save(session), 700);
  };
  return <div className="min-w-0 space-y-1">
    <textarea rows={3} maxLength={4000} aria-label={`${label} 비고`} value={state.value} disabled={!state.ready || disabled}
      placeholder="비고 입력" onChange={event => change(event.target.value)}
      onBlur={() => { if (sessionRef.current) void save(sessionRef.current); }}
      className="w-full resize-y rounded border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-800 focus:ring-2 focus:ring-indigo-300" />
    {state.busy ? <p role="status" className="text-xs text-slate-500">자동 저장 중…</p>
      : state.message && <p role={state.error ? 'alert' : 'status'} className={state.error ? 'text-xs text-red-600' : 'text-xs text-slate-500'}>{state.message}</p>}
    {state.error && state.ready && state.value !== state.saved && <button type="button" disabled={disabled}
      onClick={() => { if (sessionRef.current) void save(sessionRef.current, true); }}
      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700">다시 시도</button>}
  </div>;
}
