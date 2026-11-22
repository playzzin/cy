import React from 'react';

export default function RequestDraftNotice({ onDiscard, disabled }: { onDiscard: () => void; disabled?: boolean }) {
  return <div className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
    <p>작성 중인 내용과 첨부를 이 탭에 임시 보관합니다. 새로고침하거나 탭을 닫으면 삭제됩니다.</p>
    <button type="button" disabled={disabled} className="min-h-11 rounded-lg border border-blue-200 bg-white px-3 font-semibold disabled:opacity-50"
      onClick={() => { if (window.confirm('작성 중인 내용과 첨부를 지울까요?')) onDiscard(); }}>작성 내용 지우기</button>
  </div>;
}
