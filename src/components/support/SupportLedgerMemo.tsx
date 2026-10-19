import React, { useEffect, useRef, useState } from 'react';
import { supportLedgerMemoService } from '../../services/supportLedgerMemoService';
import { editableSupportMemo } from '../../utils/supportLedgerMemo';

export function SupportLedgerMemo({ memoKey, label, initialMemo, disabled = false }: { memoKey: string; label: string; initialMemo?: string; disabled?: boolean }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [expected, setExpected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setReady(false); setMessage('');
    supportLedgerMemoService.read(memoKey).then(memo => {
      if (!active) return;
      const text = memo ?? editableSupportMemo(initialMemo);
      setExpected(memo); setValue(text); setSaved(text); setReady(true);
    }).catch(() => { if (active) setMessage('비고를 불러오지 못했습니다. 화면을 다시 열어 주세요.'); });
    return () => { active = false; };
  }, [memoKey, initialMemo]);
  const save = async () => {
    if (!ready || lock.current || value === saved) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      await supportLedgerMemoService.save(memoKey, value, expected);
      setExpected(value); setSaved(value); setMessage('저장됨');
    } catch (error) { setMessage(error instanceof Error ? error.message : '저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="min-w-0 space-y-1">
    <textarea rows={3} maxLength={4000} aria-label={`${label} 비고`} value={value} disabled={!ready || busy || disabled}
      placeholder="비고 입력" onChange={event => { setValue(event.target.value); setMessage(''); }}
      className="w-full resize-y rounded border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-800 focus:ring-2 focus:ring-indigo-300" />
    <button type="button" disabled={!ready || busy || disabled || value === saved} onClick={() => void save()}
      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 disabled:opacity-40">{busy ? '저장 중…' : '비고 저장'}</button>
    {value !== saved && <span className="ml-1 text-xs text-amber-700">미저장</span>}
    {message && <p role="status" className="text-xs text-slate-600">{message}</p>}
  </div>;
}
