import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, LucideIcon } from 'lucide-react';
import './ReceiptChoiceSelect.css';

export interface ReceiptChoiceOption { value: string; label: string; icon: LucideIcon; color: string; background: string; }
const tone = (option?: ReceiptChoiceOption) => ({ '--dr-choice-color': option?.color || '#52657b', '--dr-choice-background': option?.background || '#f1f5f9' } as React.CSSProperties);
function ChoiceIcon({ option }: { option?: ReceiptChoiceOption }) {
  if (!option) return null;
  const Icon = option.icon;
  return <span className="dr-choice-icon" aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></span>;
}

/** Select-only combobox: arrow keys preview an option; Enter commits it. */
export default function ReceiptChoiceSelect({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: ReceiptChoiceOption[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<React.CSSProperties>();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];
  const activeIndex = Math.max(0, Math.min(active, options.length - 1));
  const blocked = () => disabled || trigger.current?.matches(':disabled');
  const close = (focus = false) => { setOpen(false); if (focus) trigger.current?.focus({ preventScroll: true }); };
  const show = () => { if (blocked()) return; setActive(Math.max(0, selectedIndex)); setOpen(true); };
  const choose = (option: ReceiptChoiceOption) => { if (blocked()) return; onChange(option.value); close(true); };

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = trigger.current?.getBoundingClientRect(); if (!anchor) return;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const width = Math.min(Math.max(anchor.width, 260), window.innerWidth - 24);
      const below = top + height - anchor.bottom - 12;
      const above = anchor.top - top - 12;
      const upward = below < 240 && above > below;
      setPosition({ left: Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)), width,
        maxHeight: Math.max(44, Math.min(360, upward ? above : below)),
        ...(upward ? { bottom: window.innerHeight - anchor.top + 6 } : { top: anchor.bottom + 6 }) });
    };
    const scroll = (event: Event) => { if (!popup.current?.contains(event.target as Node)) update(); };
    update(); window.addEventListener('resize', update); window.addEventListener('scroll', scroll, true); window.visualViewport?.addEventListener('resize', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', scroll, true); window.visualViewport?.removeEventListener('resize', update); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => { if (open && position) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' }); }, [open, position, activeIndex, id]);

  return <div className="dr-choice-select">
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-describedby={`${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined} disabled={disabled} title={selected?.label} className="dr-choice-trigger" style={tone(selected)}
      onClick={() => open ? close() : show()} onBlur={() => close()} onKeyDown={event => {
        if (event.nativeEvent.isComposing || blocked()) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); if (!open) show(); else setActive(index => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); if (!open) show(); setActive(event.key === 'Home' ? 0 : options.length - 1); }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); if (open && options[activeIndex]) choose(options[activeIndex]); else show(); }
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); }
        if (event.key === 'Tab') close();
      }}><ChoiceIcon option={selected} /><span id={`${id}-value`} className="dr-choice-label">{selected?.label || '선택하세요'}</span><ChevronDown size={15} className={open ? 'dr-choice-chevron-open' : ''} aria-hidden="true" /></button>
    {open && position && createPortal(<div ref={popup} id={`${id}-list`} className="dr-choice-popup" style={position} role="listbox" aria-label={`${label} 목록`} onMouseDown={event => event.preventDefault()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={value === option.value} style={tone(option)} className={`dr-choice-option ${index === activeIndex ? 'dr-choice-active' : ''}`} onMouseMove={() => setActive(index)} onClick={() => choose(option)}>
        <ChoiceIcon option={option} /><span className="dr-choice-option-label">{option.label}</span>{value === option.value && <Check size={17} className="dr-choice-check" aria-hidden="true" />}
      </div>)}
    </div>, document.body)}
  </div>;
}
