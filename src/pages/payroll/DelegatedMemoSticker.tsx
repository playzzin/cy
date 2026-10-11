import React, { useEffect, useRef } from 'react';
import { Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';

interface Props {
  label: string; memo: string; draft?: string; canWrite: boolean; locked: boolean;
  onStart: () => void; onChange: (value: string) => void; onSave: () => void;
  onCancel: () => void; onDelete: () => void;
}

export default function DelegatedMemoSticker({ label, memo, draft, canWrite, locked, onStart, onChange, onSave, onCancel, onDelete }: Props) {
  const editing = draft !== undefined;
  const input = useRef<HTMLTextAreaElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const hadMemo = useRef(Boolean(memo));
  useEffect(() => {
    if (locked) return;
    const target = editing ? input.current : wasEditing.current || (hadMemo.current && !memo) ? trigger.current : null;
    if (target?.getClientRects().length) target.focus();
    wasEditing.current = editing;
    hadMemo.current = Boolean(memo);
  }, [editing, memo, locked]);

  if (!memo && !editing) return <div className="dr-memo-empty">
    {canWrite ? <button type="button" ref={trigger} className="dr-memo-add" disabled={locked} onClick={onStart} aria-label={`${label} 새 메모`}><Plus size={16} />새 메모</button> : <span className="dr-memo-none">메모 없음</span>}
  </div>;

  return <section className={`dr-memo-sticker ${editing ? 'dr-memo-editing' : ''}`} aria-label={`${label} 메모`}>
    <header><span><StickyNote size={15} />{!memo && editing ? '새 메모' : '메모'}</span>{canWrite && !editing && <div>
      <button ref={trigger} disabled={locked} onClick={onStart} aria-label={`${label} 메모 수정`} title="메모 수정"><Pencil size={15} /></button>
      <button disabled={locked} onClick={onDelete} aria-label={`${label} 메모 삭제`} title="메모 삭제"><Trash2 size={15} /></button>
    </div>}</header>
    {editing ? <form onSubmit={event => { event.preventDefault(); if (draft.trim() && !locked) onSave(); }}>
      <textarea ref={input} aria-label={`${label} 메모 내용`} rows={4} maxLength={2000} placeholder="확인할 내용을 적어 주세요" value={draft} disabled={locked} onChange={event => onChange(event.target.value)}
        onKeyDown={event => { if (event.key === 'Escape' && !locked) { event.preventDefault(); onCancel(); } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && draft.trim() && !locked) { event.preventDefault(); onSave(); } }} />
      <div className="dr-memo-editor-footer"><small>{draft.length.toLocaleString()} / 2,000</small><div><button type="button" disabled={locked} onClick={onCancel}>취소</button><button type="submit" disabled={locked || !draft.trim()} aria-label={`${label} 메모 저장`}>저장</button></div></div>
    </form> : <p className="dr-memo-text">{memo}</p>}
  </section>;
}
