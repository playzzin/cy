import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import TeamWorkerDetailPage from '../../src/pages/manpower/TeamWorkerDetailPage';
import WhiteboardStatusBoard from '../../src/pages/jeonkuk/WhiteboardStatusBoard';
import WorkerAdvanceRequestPage from '../../src/pages/payroll/WorkerAdvanceRequestPage';
import TeamAccountApprovalPage from '../../src/pages/manpower/TeamAccountApprovalPage';
import ImageFileActions from '../../src/components/common/ImageFileActions';
import { TeamSettlementWorkspaceHeader } from '../../src/components/payroll/TeamSettlementWorkspaceHeader';
import '../../src/pages/payroll/TeamSettlementPage.css';
import '../../src/components/common/WorkflowTheme.css';
import './tailwind.css';
import './preview.css';
import { makeSharePhoto } from './sharePhoto';

function Settlement() {
    const [month, setMonth] = useState('2026-01');
    const noop = () => undefined;
    return <section className="team-settlement-page"><TeamSettlementWorkspaceHeader teamName="검증팀" year={Number(month.slice(0, 4))} month={Number(month.slice(5))} confirmedAt={null} updatedAt={null} isDirty={false} issueCount={0} saveState="idle" loading={false} canEdit={false} canRecalculate={false} onRefresh={noop} onSave={noop} onConfirm={noop} onUnconfirm={noop} onRecalculate={noop} onMonthChange={setMonth} />{Array.from({length:40},(_,i)=><p key={i} style={{padding:20}}>합성 정산 상세 {i + 1} · 100,000원</p>)}</section>;
}
const page = new URLSearchParams(window.location.search).get('preview');
const photo = makeSharePhoto();
createRoot(document.getElementById('root')!).render(<BrowserRouter><main className="preview-workspace">
    {page === 'board' ? <WhiteboardStatusBoard /> : page === 'advance' ? <WorkerAdvanceRequestPage /> : page === 'approval' ? <TeamAccountApprovalPage /> : page === 'settlement' ? <Settlement /> : page === 'photo' ? <ImageFileActions imageUrl={photo} name="합성 공유 검증 사진" /> : <TeamWorkerDetailPage />}
</main></BrowserRouter>);
