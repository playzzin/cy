import React, { lazy, Suspense } from 'react';
import ResponsiveDetailDialog from '../common/ResponsiveDetailDialog';
import type { DailyAdvanceStatementContext } from '../../pages/payroll/DailyAdvanceWorkbookPage';
import './TeamWorkbookStatementDialog.css';

const DailyAdvanceWorkbookPage = lazy(() => import('../../pages/payroll/DailyAdvanceWorkbookPage'));

export default function TeamWorkbookStatementDialog({ context, onClose }: { context: DailyAdvanceStatementContext; onClose: () => void }) {
  return <ResponsiveDetailDialog open onOpenChange={open => { if (!open) onClose(); }}
    title={`${context.teamName} 청구서`} description={`${context.month} · 대납출력부 청구서 · 인력소개비 포함`}
    className="team-workbook-statement-dialog">
    <Suspense fallback={<p role="status">대납출력부 청구서를 불러오는 중입니다.</p>}>
      <DailyAdvanceWorkbookPage key={`${context.month}:${context.teamId}`} statementContext={context} />
    </Suspense>
  </ResponsiveDetailDialog>;
}
