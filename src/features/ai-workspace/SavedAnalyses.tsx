import React, { useEffect, useRef, useState } from 'react';
import { AI_GROUP_LABELS, AI_SAVED_LIMIT, AI_SAVED_PERIOD_LABELS, AiResult, AiSavedAnalysis, AiSavedPeriod, canUseRollingMonth } from './contract';
import type { WorkspaceClient } from './service';

type Props = { client: WorkspaceClient; result: AiResult | null; disabled: boolean;
  onRun: (item: AiSavedAnalysis) => Promise<void>; onManaging: (busy: boolean) => void };
export function SavedAnalyses({ client, result, disabled, onRun, onManaging }: Props) {
  const [items, setItems] = useState<AiSavedAnalysis[]>([]), [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [name, setName] = useState(''), [period, setPeriod] = useState<AiSavedPeriod>('fixed');
  const [replaceId, setReplaceId] = useState(''), [deleteId, setDeleteId] = useState('');
  const mounted = useRef(false), pending = useRef(false);
  useEffect(() => {
    mounted.current = true; let active = true;
    client.listSaved().then(response => { if (active) setItems(response.items); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : '저장 목록을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, [client]);
  useEffect(() => {
    setName((result?.plan.report.title || '나의 분석').slice(0, 60)); setPeriod('fixed'); setReplaceId('');
  }, [result]);
  const manage = async (operation: () => Promise<{ items: AiSavedAnalysis[] }>, message: string) => {
    if (pending.current || disabled || loading) return;
    pending.current = true; setWorking(true); onManaging(true); setError(''); setNotice('');
    try {
      const response = await operation();
      if (mounted.current) { setItems(response.items); setNotice(message); setDeleteId(''); setReplaceId(''); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : '저장 목록을 변경하지 못했습니다.'); }
    finally { pending.current = false; if (mounted.current) { setWorking(false); onManaging(false); } }
  };
  const locked = disabled || working || loading;
  const replace = items.find(item => item.id === replaceId);
  return <section className="ai-workspace__saved" aria-label="저장한 분석">
    <div className="ai-workspace__result-heading"><h2>저장한 분석 <small>{items.length}/{AI_SAVED_LIMIT}</small></h2>
      <button type="button" disabled={locked} onClick={() => void manage(() => client.listSaved(), '저장 목록을 새로고침했습니다.')}>목록 새로고침</button></div>
    <p className="ai-workspace__note">내 계정에 조건과 보고서 구성을 저장합니다. 다시 실행하면 현재 권한으로 최신 자료를 조회합니다.</p>
    {loading && <p>저장 목록을 불러오고 있습니다.</p>}
    {error && <p role="alert" className="ai-workspace__error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !items.length && !error && <p>아직 저장한 분석이 없습니다. 조회한 결과에서 조건을 저장해 보세요.</p>}
    <ul className="ai-workspace__saved-list">{items.map(item => <li key={item.id}>
      <h3>{item.name}</h3>
      <SavedAnalysisSummary item={item} />
      <div className="ai-workspace__actions"><button type="button" disabled={locked} onClick={() => void onRun(item)} aria-label={`${item.name} 다시 실행`}>다시 실행</button>
        <button type="button" disabled={locked} onClick={() => setDeleteId(item.id)} aria-label={`${item.name} 삭제`}>삭제</button></div>
      {deleteId === item.id && <div><p>“{item.name}”을 저장 목록에서 삭제할까요?</p><div className="ai-workspace__actions">
        <button type="button" disabled={locked} onClick={() => void manage(() => client.deleteSaved(item.id, item.revision), '저장 목록에서 삭제했습니다.')}>삭제 확인</button>
        <button type="button" disabled={locked} onClick={() => setDeleteId('')}>취소</button></div></div>}
    </li>)}</ul>
    {result && <details className="ai-workspace__save-form"><summary>현재 조건·보고서 저장</summary>
      <form onSubmit={event => { event.preventDefault(); void manage(() => client.saveAnalysis({ resultId: result.id, name, period,
        ...(replace ? { id: replace.id, revision: replace.revision } : {}) }), replace ? '현재 조건과 보고서 구성으로 변경했습니다.' : '조건과 보고서 구성을 저장했습니다.'); }}>
        <label htmlFor="ai-save-target">저장할 항목</label><select id="ai-save-target" disabled={locked} value={replaceId} onChange={event => {
          const item = items.find(row => row.id === event.target.value); setReplaceId(event.target.value); if (item) setName(item.name);
        }}><option value="">새 항목</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <label htmlFor="ai-save-name">저장 이름</label><input id="ai-save-name" value={name} disabled={locked} maxLength={60} onChange={event => setName(event.target.value)} required />
        <label htmlFor="ai-save-period">다시 실행할 기간</label><select id="ai-save-period" value={period} disabled={locked} onChange={event => setPeriod(event.target.value as AiSavedPeriod)}>
          {Object.entries(AI_SAVED_PERIOD_LABELS).map(([value, label]) => <option key={value} value={value} disabled={value !== 'fixed' && !canUseRollingMonth(result.plan)}>{label}</option>)}</select>
        <p className="ai-workspace__note">월 자동 변경은 한 달 전체 조회와 전월 비교에서 선택할 수 있습니다. 보고서 제목은 저장한 문구를 유지합니다.</p>
        <p className="ai-workspace__note">{result.plan.range.startDate} ~ {result.plan.range.endDate} · {result.plan.report.title || '기본 보고서'} · {result.plan.report.includeAmount ? '금액 포함' : '금액 제외'} · {result.plan.report.includeDetails ? '상세 포함' : '요약'}</p>
        <button type="submit" disabled={locked || !name.trim() || (!replace && items.length >= AI_SAVED_LIMIT)}>{replace ? '현재 결과로 덮어쓰기' : '조건 저장'}</button>
      </form></details>}
  </section>;
}

export function SavedAnalysisSummary({ item }: { item: AiSavedAnalysis }) {
  return <>
      <p>{item.plan.operation === 'search' ? '현재 마스터 검색' : `${AI_GROUP_LABELS[item.plan.groupBy]}별 ${item.plan.dataset === 'settlementEvidence' ? '일보·지원비 저장 근거 점검' : item.plan.dataset === 'settlementMissing' ? '미연결 청구서 점검' : item.plan.dataset === 'settlementAudit' ? '청구서 대사' : '분석'}`} · {item.plan.operation === 'search' ? '실행 시점 기준' : AI_SAVED_PERIOD_LABELS[item.period]}</p>
      {item.plan.operation !== 'search' && <p className="ai-workspace__note">{item.period === 'fixed' ? `${item.plan.range.startDate} ~ ${item.plan.range.endDate}` : '한국 시간 기준 한 달 전체'}{item.plan.comparison && (item.period === 'fixed' ? ` · 비교 ${item.plan.comparison.startDate} ~ ${item.plan.comparison.endDate}` : ' · 전월 비교')}</p>}
      <p className="ai-workspace__note">{item.plan.filters.map(filter => filter.name).join(' · ') || '실행 시 조회 가능한 전체 범위'} · {item.plan.report.includeAmount ? '금액 포함' : '금액 제외'} · {item.plan.report.includeDetails ? '상세 포함' : '요약'} · {item.plan.report.splitByGroup ? '그룹별 시트' : '통합 시트'} · {item.plan.report.format === 'none' ? '화면 조회' : `${item.plan.report.format === 'both' ? 'PDF·엑셀' : item.plan.report.format.toUpperCase()} 생성`}</p>
  </>;
}
