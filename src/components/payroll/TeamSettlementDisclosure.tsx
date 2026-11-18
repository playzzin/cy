import React, { useId } from 'react';

export function TeamSettlementDisclosure({ id, title, count, open, onToggle, children }: {
  id: string; title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const bodyId = useId();
  return <section id={id} aria-label={title} className={`scroll-mt-36 rounded-2xl border transition ${count ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
    <h2><button type="button" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <span>{title} {count ? `${count}건 확인 필요` : '완료'}</span>
      <span aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
    </button></h2>
    {open && <div id={bodyId} className="px-4 pb-4">{children}</div>}
  </section>;
}
