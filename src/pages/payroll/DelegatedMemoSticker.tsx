import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, Plus, StickyNote, Trash2, X } from 'lucide-react';
import { SiteMemoConflictError } from '../../features/delegated-receipts/siteMemoService';

export const MemoButton = React.memo(function MemoButton({ label, memo, canWrite, disabled, onClick }: {
  label: string; memo: string; canWrite: boolean; disabled?: boolean; onClick: () => void;
}) {
  if (!memo && !canWrite) return <span className="dr-memo-none">메모 없음</span>;
  return <button type="button" className={memo ? 'dr-memo-toggle' : 'dr-memo-add'} disabled={disabled} aria-haspopup="dialog"
    aria-label={`${label} ${memo ? '메모 있음' : '새 메모'}`} onClick={onClick}>
    {memo ? <StickyNote size={16} /> : <Plus size={16} />}{memo ? '메모 있음' : '새 메모'}
  </button>;
});

export default function DelegatedMemoSticker({ label, context, memo, canWrite, onSave, onClose }: {
  label: string; context: string; memo: string; canWrite: boolean;
  onSave: (value: string, operationId: string) => Promise<void>; onClose: () => void;
}) {
  // Input state is local: typing never renders the ledger or other rows.
  const [draft, setDraft] = useState(memo);
  const [editing, setEditing] = useState(!memo && canWrite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [discard, setDiscard] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const pending = useRef<{ value: string; id: string }>();
  const busyRef = useRef(false);
  const composing = useRef(false);
  const dirty = editing && draft.trim() !== memo;
  const close = () => { if (!busyRef.current) { if (dirty) setDiscard(true); else onClose(); } };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => { if (!busy) (editing ? input.current : editButton.current)?.focus(); }, [editing, busy]);
  const save = async (value: string, deleting = false) => {
    if (busyRef.current || !canWrite || (!deleting && !value.trim())) return;
    if (pending.current?.value !== value) pending.current = { value, id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `memo-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    busyRef.current = true; setBusy(true); setError('');
    try {
      await onSave(value, pending.current.id);
      pending.current = undefined; setSaved(true); setEditing(false); setDiscard(false);
      if (deleting) onClose();
    } catch (failure) { setError(failure instanceof SiteMemoConflictError ? failure.message : '저장하지 못했습니다. 입력한 내용은 유지됩니다. 다시 저장해 주세요.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return createPortal(<div className="dr-memo-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialog} className="dr-memo-dialog" role="dialog" aria-modal="true" aria-label={`${label} 메모`} tabIndex={-1}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return;
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'Tab') {
          const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled)');
          if (!elements?.length) { event.preventDefault(); return; }
          const first = elements[0]; const last = elements[elements.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
        }
      }}>
      <header><div><span className="dr-memo-context">{context}</span><h2><StickyNote size={22} />{label} 메모</h2></div><button type="button" aria-label="메모 닫기" disabled={busy} onClick={close}><X size={21} /></button></header>
      <div className="dr-memo-sheet">
        {editing ? <form onSubmit={event => { event.preventDefault(); void save(draft.trim()); }}>
          <textarea ref={input} aria-label={`${label} 메모 내용`} value={draft} maxLength={2000} rows={7} disabled={busy} placeholder="확인할 내용이나 전달할 사항을 적어 주세요"
            onChange={event => { setDraft(event.target.value); setSaved(false); }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={event => { if (!event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229 && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void save(draft.trim()); } }} />
          <div className="dr-memo-input-info"><span>Ctrl / ⌘ + Enter로 저장</span><span>{draft.length.toLocaleString()} / 2,000</span></div>
          <div className="dr-memo-actions"><button type="button" disabled={busy} onClick={() => { if (!memo) close(); else { setDraft(memo); setEditing(false); setError(''); setDiscard(false); } }}>취소</button><button type="submit" className="dr-memo-save" disabled={busy || !draft.trim()}>{busy ? '저장 중…' : '메모 저장'}</button></div>
        </form> : <><p className="dr-memo-full-text">{memo}</p>{canWrite && <div className="dr-memo-actions"><button type="button" disabled={busy} onClick={() => void save('', true)} aria-label={`${label} 메모 삭제`}><Trash2 size={17} />삭제</button><button type="button" ref={editButton} disabled={busy} onClick={() => { setDraft(memo); setEditing(true); setSaved(false); setError(''); }} aria-label={`${label} 메모 수정`}><Pencil size={17} />수정</button></div>}</>}
      </div>
      {saved && <p role="status" className="dr-memo-saved"><Check size={15} />저장되었습니다</p>}
      {error && <p role="alert" className="dr-memo-error">{error}</p>}
      {discard && <div className="dr-memo-discard" role="alert"><p>아직 저장하지 않은 내용이 있습니다.</p><button type="button" onClick={() => setDiscard(false)}>계속 작성</button><button type="button" onClick={onClose}>변경 버리고 닫기</button></div>}
    </div>
  </div>, document.body);
}
