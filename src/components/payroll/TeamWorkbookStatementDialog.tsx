import React, { lazy, Suspense, useLayoutEffect, useState } from 'react';
import ResponsiveDetailDialog from '../common/ResponsiveDetailDialog';
import type { DailyAdvanceStatementContext } from '../../pages/payroll/DailyAdvanceWorkbookPage';
import './TeamWorkbookStatementDialog.css';

const DailyAdvanceWorkbookPage = lazy(() => import('../../pages/payroll/DailyAdvanceWorkbookPage'));

export default function TeamWorkbookStatementDialog({ context, onClose }: { context: DailyAdvanceStatementContext; onClose: () => void }) {
  const [contentStyle, setContentStyle] = useState<React.CSSProperties>({});
  useLayoutEffect(() => {
    const main = document.getElementById('main-content');
    const measure = () => {
      const rect = main?.getBoundingClientRect();
      const inset = window.innerWidth <= 640 ? 0 : 8;
      const left = Math.max(0, rect?.left ?? 0) + inset;
      const right = Math.min(window.innerWidth, rect?.right ?? window.innerWidth) - inset;
      const header = main ? Number.parseFloat(getComputedStyle(main).marginTop) || 0 : 0;
      const top = Math.max(0, header) + inset;
      setContentStyle({ left, top, right: 'auto', bottom: 'auto', width: Math.max(0, right - left),
        height: Math.max(0, window.innerHeight - top - inset), maxHeight: Math.max(0, window.innerHeight - top - inset) });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (main) observer?.observe(main);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); };
  }, []);
  return <ResponsiveDetailDialog open onOpenChange={open => { if (!open) onClose(); }}
    title={`${context.teamName} 청구서`} description={`${context.month} · 대납출력부 청구서 · 인력소개비 포함`}
    className="team-workbook-statement-dialog" contentStyle={contentStyle}>
    <Suspense fallback={<p role="status">대납출력부 청구서를 불러오는 중입니다.</p>}>
      <DailyAdvanceWorkbookPage key={`${context.month}:${context.teamId}`} statementContext={context} />
    </Suspense>
  </ResponsiveDetailDialog>;
}
