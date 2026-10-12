import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, ChevronDown, Search, UsersRound } from 'lucide-react';
import { validTeamColor } from '../../features/delegated-receipts/teamDirectory';
import { getContrastingTextColor } from '../../utils/color';
import './ReceiptColorFilter.css';

export interface ReceiptFilterOption { value: string; label: string; color?: string; }
const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase();

function ColorIcon({ color, kind }: { color?: string; kind: 'site' | 'team' }) {
  const background = validTeamColor(color);
  const Icon = kind === 'site' ? Building2 : UsersRound;
  return <span className="dr-filter-color-icon" aria-hidden="true" style={{ backgroundColor: background, color: getContrastingTextColor(background, '#ffffff', '#000000') }}><Icon size={17} /></span>;
}

export default function ReceiptColorFilter({ label, kind, value, options, onChange }: {
  label: string; kind: 'site' | 'team'; value: string; options: ReceiptFilterOption[]; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<React.CSSProperties>();
  const positioned = Boolean(position);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = options.find(option => option.value === value) ?? options[0];
  const filtered = useMemo(() => options.filter(option => normalize(option.label).includes(normalize(query))), [options, query]);
  const activeIndex = Math.min(active, filtered.length - 1);
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus({ preventScroll: true }); };
  const choose = (option: ReceiptFilterOption) => { onChange(option.value); close(true); };
  const show = () => { setQuery(''); setActive(Math.max(0, options.findIndex(option => option.value === value))); setOpen(true); };

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewport = window.visualViewport;
      const topEdge = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const width = Math.min(Math.max(anchor.width, 280), window.innerWidth - 24);
      const below = topEdge + height - anchor.bottom - 12;
      const above = anchor.top - topEdge - 12;
      const upward = below < 200 && above > below;
      const maxHeight = Math.max(100, Math.min(360, upward ? above : below));
      setPosition({ left: Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)), width, maxHeight,
        ...(upward ? { bottom: window.innerHeight - anchor.top + 6 } : { top: anchor.bottom + 6 }) });
    };
    const onScroll = (event: Event) => { if (!popup.current?.contains(event.target as Node)) update(); };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', onScroll, true);
    window.visualViewport?.addEventListener('resize', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', onScroll, true); window.visualViewport?.removeEventListener('resize', update); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('pointerdown', outside); };
  }, [open]);
  useEffect(() => { if (open && positioned) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' }); }, [activeIndex, id, open, positioned, query]);

  return <div className="dr-color-filter">
    <button ref={trigger} type="button" className="dr-color-filter-trigger" title={selected?.label} aria-label={label} aria-describedby={`${id}-value`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-popup` : undefined}
      onClick={() => open ? close() : show()} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(); } }}>
      <ColorIcon color={selected?.color} kind={kind} /><span id={`${id}-value`}>{selected?.label}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && position && createPortal(<div ref={popup} id={`${id}-popup`} className="dr-color-filter-popup" style={position} role="dialog" aria-label={`${label} 선택`} onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    }}>
      <div className="dr-color-filter-search"><Search size={16} aria-hidden="true" /><input autoFocus role="combobox" aria-label={`${label} 검색`} aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined} placeholder={`${label} 이름 검색`} value={query}
        onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, Math.min(filtered.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
          if (event.key === 'Enter' && filtered[activeIndex]) { event.preventDefault(); choose(filtered[activeIndex]); }
          if (event.key === 'Tab') { event.preventDefault(); close(true); }
        }} /></div>
      <div id={`${id}-list`} className="dr-color-filter-options" role="listbox" aria-label={`${label} 목록`}>{filtered.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={value === option.value} className={`dr-color-filter-option ${activeIndex === index ? 'dr-filter-option-active' : ''}`} onClick={() => choose(option)}>
        <ColorIcon color={option.color} kind={kind} /><span>{option.label}</span>{value === option.value && <Check size={16} aria-hidden="true" />}
      </div>)}</div>
      {!filtered.length && <p className="dr-filter-no-results" role="status">검색 결과가 없습니다.</p>}
    </div>, document.body)}
  </div>;
}
