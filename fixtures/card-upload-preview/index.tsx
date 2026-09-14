import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CardStatementImportHistoryModal } from '../../src/components/card/CardStatementImportHistoryModal';
import { CardStatementImportModal } from '../../src/components/card/CardStatementImportModal';

function Preview() {
  const savePreview = new URLSearchParams(window.location.search).has('save');
  const [history, setHistory] = useState(!savePreview);
  const [importOpen, setImportOpen] = useState(savePreview);
  return <main className="p-5"><h1>가상 데이터 검증 화면</h1><button onClick={() => setHistory(true)}>업로드 내역</button><button onClick={() => setImportOpen(true)}>PDF 등록 테스트</button>
    <CardStatementImportHistoryModal isOpen={history} yearMonth="2026-09" onClose={() => setHistory(false)} onCancelled={() => {}} />
    <CardStatementImportModal isOpen={importOpen} yearMonth="2026-08" cards={[]} onClose={() => setImportOpen(false)} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
