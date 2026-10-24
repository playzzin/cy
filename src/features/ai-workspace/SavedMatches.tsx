import React from 'react';
import { AiSavedAnalysis } from './contract';
import { SavedAnalysisSummary } from './SavedAnalyses';

export function SavedMatches({ items, disabled, onRun }: { items: AiSavedAnalysis[]; disabled: boolean; onRun: (item: AiSavedAnalysis) => Promise<void> }) {
  return <section className="ai-workspace__saved-matches" aria-label="저장한 분석 검색 결과">
    <h2>저장한 분석 검색 결과</h2><p>{items.length}개 · 저장된 조건을 표시합니다. 실행하면 현재 권한으로 최신 자료를 조회합니다.</p>
    {items.length > 1 && <p>이름이 같거나 비슷한 항목은 기간과 조건을 확인하고 선택해 주세요.</p>}
    {!items.length && <p>검색 결과가 없습니다. “내가 저장한 분석 목록 보여줘”로 전체 목록을 확인할 수 있습니다.</p>}
    <ul className="ai-workspace__saved-list">{items.map((item, index) => <li key={item.id}><h3>{item.name}</h3>
      <SavedAnalysisSummary item={item} />
      <p className="ai-workspace__note">마지막 변경: {new Date(item.updatedAt).toLocaleString('ko-KR')}</p>
      <button type="button" disabled={disabled} onClick={() => void onRun(item)} aria-label={`후보 ${index + 1} ${item.name} 실행`}>이 조건으로 실행</button>
    </li>)}</ul>
    <p className="ai-workspace__note">기간·대상·보고서 설정을 바꾸려면 먼저 실행한 뒤 후속 질문으로 요청하세요. 저장된 조건은 자동 변경하지 않습니다.</p>
  </section>;
}
