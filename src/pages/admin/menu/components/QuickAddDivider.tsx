import React, { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

export default function QuickAddDivider({ onAdd }: { onAdd: (title: string) => void }) {
    const [title, setTitle] = useState('');
    const composing = useRef(false);
    const add = () => { onAdd(title.trim()); setTitle(''); };
    return <div role="group" aria-label="구분선 빠른 등록" className="inline-flex max-w-full items-center rounded-lg border border-slate-600 bg-slate-900 p-1">
        <input aria-label="새 구분선 제목" placeholder="구분선 제목 (선택)" maxLength={60} value={title}
            className="w-32 min-w-0 rounded bg-transparent px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-400"
            onChange={event => setTitle(event.target.value)}
            onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={event => {
                if (event.key !== 'Enter' || composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
                event.preventDefault();
                if (!event.repeat) add();
            }} />
        <button type="button" onClick={add} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400">
            <FontAwesomeIcon icon={faPlus} />구분선 추가
        </button>
    </div>;
}
