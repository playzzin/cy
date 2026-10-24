import React, { useEffect, useRef, useState } from 'react';
import { AI_GROUP_LABELS, AI_METRICS, AiPlan, AiResponse, AiResult, AiSavedAnalysis } from './contract';
import type { WorkspaceClient, WorkspaceFile } from './service';
import { SettlementMetrics, SettlementResults } from './SettlementResults';
import { ReconciliationMetrics, ReconciliationResults } from './ReconciliationResults';
import { SavedAnalyses } from './SavedAnalyses';
import { SavedMatches } from './SavedMatches';
import { ScheduledReports } from './ScheduledReports';
import { MissingBillingMetrics, MissingBillingResults } from './MissingBillingResults';
import { EvidenceMetrics, EvidenceResults } from './EvidenceResults';
import './aiWorkspace.css';

type Message = { role: 'user' | 'assistant'; text: string };
type PreparedFile = { url: string; name: string; format: 'pdf' | 'xlsx' };
const formatNumber = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const percentage = (value: number | null) => value === null ? '기준값 0' : `${value > 0 ? '+' : ''}${value}%`;
const fileUrl = (file: WorkspaceFile) => URL.createObjectURL(new Blob([Uint8Array.from(atob(file.base64), char => char.charCodeAt(0))], { type: file.contentType }));
const EXAMPLES = ['내가 저장한 분석 목록 보여줘', '지난달 확정 정산에 저장된 일보·지원비 근거를 점검해줘', '지난달 현장별 공수와 일보 금액을 보여줘', '이번 달 일별 공수 추이', '계좌가 등록되지 않은 작업자를 찾아줘', '지난달 팀별 확정 정산과 차감 비용을 보여줘', '지난달 확정 정산에 연결된 카드·숙소·차량 청구서를 대사해줘', '지난달 정산에 연결되지 않은 카드·숙소·차량 청구서를 찾아줘'];

export function AiWorkspace({ client }: { client: WorkspaceClient }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<AiResult | null>(null);
  const [pending, setPending] = useState<AiResponse | null>(null);
  const [busy, setBusy] = useState('');
  const [managing, setManaging] = useState(false);
  const isBusy = Boolean(busy) || managing;
  const [error, setError] = useState('');
  const [view, setView] = useState<'table' | 'chart' | 'sources' | 'report'>('table');
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const sequence = useRef(0), urls = useRef<string[]>([]), inFlight = useRef(false);
  useEffect(() => () => { sequence.current++; urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  const clearFiles = () => { urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = []; setFiles([]); };
  const prepareFile = async (id: string, format: 'pdf' | 'xlsx', request: number) => {
    const file = await client.exportFile(id, format);
    if (request !== sequence.current) return;
    const url = fileUrl(file); urls.current.push(url);
    setFiles(prev => [...prev.filter(value => value.format !== format), { url, name: file.fileName, format }]);
  };
  const submit = async (value: string, plan?: AiPlan, saved?: AiSavedAnalysis) => {
    if (!value.trim() || inFlight.current) return;
    inFlight.current = true;
    const request = ++sequence.current;
    setQuestion(''); setError(''); setBusy('조건을 확인하고 자료를 분석하고 있습니다.'); clearFiles();
    if (saved) { setPending(null); setResult(null); setView('table'); }
    setMessages(prev => [...prev.slice(-19), { role: 'user', text: value.trim() }]);
    try {
      const response = saved ? await client.runSaved(saved.id, saved.revision)
        : await client.analyze({ question: value.trim(), previousId: result?.id, ...(plan ? { plan } : {}), ...(pending ? { contextPlan: pending.plan } : {}), ...(pending?.savedMatches ? { savedContextId: pending.savedMatches.contextId } : {}) });
      if (request !== sequence.current) return;
      if (response.status === 'saved' && response.savedMatches) {
        setPending(response); setResult(null); setView('table');
        setMessages(prev => [...prev, { role: 'assistant', text: response.message || '저장한 분석 목록을 확인해 주세요.' }]);
      } else if (response.status === 'clarification') {
        // Keep reviewed saved choices available when clarification asks the user to select one.
        // Their server token/revisions are still rechecked when execution is requested.
        setPending(response.plan.operation === 'clarify' && pending?.savedMatches
          ? { ...response, plan: pending.plan, savedMatches: pending.savedMatches } : response);
        setMessages(prev => [...prev, { role: 'assistant', text: response.message || '조회 조건을 확인해 주세요.' }]);
      } else if (response.result) {
        const next = response.result;
        setPending(null); setResult(next);
        setMessages(prev => [...prev, { role: 'assistant', text: next.summary }]);
        if (next.plan.report.format !== 'none') {
          setView('report'); setBusy('같은 분석 결과로 파일을 만들고 있습니다.');
          if (['pdf', 'both'].includes(next.plan.report.format)) await prepareFile(next.id, 'pdf', request);
          if (request === sequence.current && ['xlsx', 'both'].includes(next.plan.report.format)) await prepareFile(next.id, 'xlsx', request);
        }
      } else throw new Error('분석 결과를 확인하지 못했습니다.');
    } catch (e) { if (request === sequence.current) setError(e instanceof Error ? e.message : '분석을 완료하지 못했습니다.'); }
    finally { if (request === sequence.current) { setBusy(''); inFlight.current = false; } }
  };
  const exportFile = async (format: 'pdf' | 'xlsx') => {
    if (!result || inFlight.current) return;
    inFlight.current = true; const request = ++sequence.current;
    setError(''); setBusy(`${format.toUpperCase()} 파일을 만들고 있습니다.`);
    try { await prepareFile(result.id, format, request); }
    catch (e) { if (request === sequence.current) setError(e instanceof Error ? e.message : '파일을 만들지 못했습니다.'); }
    finally { if (request === sequence.current) { setBusy(''); inFlight.current = false; } }
  };
  const reset = () => {
    sequence.current++; inFlight.current = false; clearFiles(); setBusy(''); setPending(null); setResult(null); setMessages([]); setError(''); setQuestion('');
  };
  const stop = () => { sequence.current++; inFlight.current = false; setBusy(''); setError('응답 표시를 중지했습니다. 서버에서 진행 중인 분석은 잠시 후 종료됩니다.'); };
  const showAmount = result?.plan.report.includeAmount !== false;
  const rows = result?.rows || [], largest = Math.max(...rows.map(row => row.manDay), 1);
  return <section className="ai-workspace" aria-label="AI 업무 도우미">
    <header className="ai-workspace__header"><div><h1>AI 업무 도우미</h1><p>일보·인력·확정 정산을 질문하고 같은 결과를 보고서로 만드세요.</p></div><button type="button" onClick={reset} disabled={managing}>새 대화</button></header>
    <div className="ai-workspace__layout">
      <aside className="ai-workspace__conversation" aria-label="대화">
        {!messages.length && <div className="ai-workspace__examples"><h2>이렇게 질문해 보세요</h2>{EXAMPLES.map(example => <button key={example} disabled={isBusy} onClick={() => void submit(example)}>{example}</button>)}</div>}
        <div className="ai-workspace__messages" aria-live="polite">{messages.map((message, index) => <div key={index} className={`ai-workspace__message ai-workspace__message--${message.role}`}><span>{message.role === 'user' ? '나' : 'CY'}</span><p>{message.text}</p></div>)}</div>
        {pending && <div className="ai-workspace__choices" aria-label="대상 선택">{pending.choices?.map(choice => <button key={choice.id} disabled={isBusy} onClick={() => {
          const plan = { ...pending.plan, filters: pending.plan.filters.map((filter, index) => index === choice.filterIndex ? { ...filter, id: choice.id, name: choice.name } : filter) };
          void submit(`${choice.label} 선택`, plan);
        }}>{choice.label}</button>)}</div>}
        <form onSubmit={event => { event.preventDefault(); void submit(question); }}>
          <label htmlFor="ai-workspace-question">업무 요청</label>
          <textarea id="ai-workspace-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={1200} rows={3} placeholder="그중 A현장만, 팀별로 나눠줘" />
          <div className="ai-workspace__actions"><button className="ai-workspace__primary" disabled={isBusy || !question.trim()} type="submit">요청하기</button>{busy && <button type="button" onClick={stop}>응답 표시 중지</button>}</div>
        </form>
        <p className="ai-workspace__note">조회 범위는 현재 계정 권한을 따릅니다. 일보 산출액은 확정 정산액·실지급액과 다릅니다.</p>
        <SavedAnalyses client={client} result={result} disabled={isBusy}
          onRun={item => submit(`저장한 분석 “${item.name}” 다시 실행`, undefined, item)}
          onManaging={value => { inFlight.current = value; setManaging(value); }} />
        <ScheduledReports client={client} disabled={isBusy} onManaging={value => { inFlight.current = value; setManaging(value); }} />
      </aside>
      <main className="ai-workspace__results">
        {busy && <p role="status">{busy}</p>}
        {error && <p role="alert" className="ai-workspace__error">{error}</p>}
        {pending?.savedMatches ? <SavedMatches items={pending.savedMatches.items} disabled={isBusy} onRun={item => submit(`저장한 분석 “${item.name}” 다시 실행`, undefined, item)} /> : !result ? <div className="ai-workspace__empty"><h2>질문에서 보고서까지</h2><p>조회 조건과 집계 기준, 원본 내역을 함께 확인할 수 있습니다.</p><p>예: 지난달 현장별 공수 → A현장만 팀별로 → PDF와 엑셀로</p></div> : <>
          <div className="ai-workspace__result-heading"><h2>{result.evidence ? '일보·지원비 저장 근거 점검' : result.missingBilling ? '정산 미연결 청구서 점검' : result.reconciliation ? '정산 청구서 대사' : result.plan.operation === 'search' ? '현재 인력 DB 검색' : `${AI_GROUP_LABELS[result.plan.groupBy]}별 분석`}</h2><span>{result.completeness === 'partial' ? '부분 결과' : '조회 완료'}</span></div>
          <div className="ai-workspace__conditions"><span>{result.plan.operation === 'search' ? '현재 마스터 기준' : `${result.plan.range.startDate} ~ ${result.plan.range.endDate}`}</span>{result.plan.comparison && <span>비교 {result.plan.comparison.startDate} ~ {result.plan.comparison.endDate}</span>}{result.plan.filters.map(filter => <span key={filter.entity}>{filter.name}</span>)}</div>
          {result.warnings.length > 0 && <ul className="ai-workspace__warnings">{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
          {!result.settlement && result.plan.operation !== 'search' && <div className="ai-workspace__metrics"><div><span>공수</span><strong>{formatNumber(result.totals.manDay)}</strong></div><div><span>고유 작업자</span><strong>{formatNumber(result.totals.workers)}명</strong></div>{showAmount && <div><span>일보 산출액</span><strong>{formatNumber(result.totals.amount)}원</strong></div>}</div>}
          {result.settlement && !result.reconciliation && !result.missingBilling && !result.evidence && <SettlementMetrics result={result} />}
          {result.reconciliation && <ReconciliationMetrics result={result} />}
          {result.evidence && <EvidenceMetrics result={result} />}
          {result.missingBilling && <MissingBillingMetrics result={result} />}
          <nav className="ai-workspace__tabs" aria-label="분석 결과 보기">{(['table', 'chart', 'sources', 'report'] as const).map(key => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{({ table: '표', chart: '그래프', sources: '근거', report: '보고서' })[key]}</button>)}</nav>
          {!result.settlement && view === 'table' && <div className="ai-workspace__table-wrap">{result.plan.operation === 'search' ? <><p>전체 {result.records.length}건 · 화면에 최대 50건 표시</p><table><thead><tr><th>이름</th><th>소속팀</th><th>상태</th><th>계좌</th></tr></thead><tbody>{result.records.slice(0, 50).map(row => <tr key={row.id}><td>{row.name}<small>{row.id}</small></td><td>{row.teamName || '미지정'}</td><td>{row.status || '미지정'}</td><td>{row.accountRegistered === null ? '확인 대상 아님' : row.accountRegistered ? '등록' : '미등록'}</td></tr>)}</tbody></table>{!result.records.length && <p>조건에 맞는 자료가 없습니다.</p>}</> : <><p>전체 {rows.length}개 그룹 · 화면에 최대 50개 표시</p><table><thead><tr><th>{AI_GROUP_LABELS[result.plan.groupBy]}</th><th>공수</th><th>인원</th>{showAmount && <th>일보 산출액</th>}{result.previousTotals && <><th>전기 공수</th><th>공수 증감률</th>{showAmount && <><th>전기 산출액</th><th>금액 증감률</th></>}</>}</tr></thead><tbody>{rows.slice(0, 50).map(row => <tr key={row.id}><td>{row.name}</td><td>{formatNumber(row.manDay)}</td><td>{row.workers}명</td>{showAmount && <td>{formatNumber(row.amount)}원</td>}{result.previousTotals && <><td>{formatNumber(row.previous?.manDay || 0)}</td><td>{percentage(row.manDayChangePercent)}</td>{showAmount && <><td>{formatNumber(row.previous?.amount || 0)}원</td><td>{percentage(row.amountChangePercent)}</td></>}</>}</tr>)}</tbody></table>{!rows.length && <p>조건에 맞는 일보가 없습니다.</p>}</>}</div>}
          {!result.settlement && view === 'chart' && <div aria-label="그룹별 공수 막대그래프" className="ai-workspace__chart"><p>현재 정렬 기준 상위 10개 그룹 · 공수</p>{rows.slice(0, 10).map(row => <div key={row.id}><span>{row.name}</span><div><i style={{ width: `${Math.max(0, row.manDay) / largest * 100}%` }} /></div><b>{formatNumber(row.manDay)}</b></div>)}{!rows.length && <p>집계 결과가 있을 때 그래프를 표시합니다.</p>}</div>}
          {!result.settlement && view === 'sources' && <div><p>조회 시점: {new Date(result.createdAt).toLocaleString('ko-KR')}</p><p>결과 ID: {result.id}</p><p>원본 일보 {result.totals.reports}건 · 파일에는 전체 결과를 반영합니다.</p><dl>{AI_METRICS.map(metric => <React.Fragment key={metric.id}><dt>{metric.label}</dt><dd>{metric.definition}</dd></React.Fragment>)}</dl><a href="/reports/daily?tab=list-v2">일보 화면 열기</a><div className="ai-workspace__table-wrap"><table><thead><tr><th>일보 ID</th><th>일자</th><th>현장</th><th>작업자</th></tr></thead><tbody>{result.details.slice(0, 50).map((row, index) => <tr key={`${row.reportId}-${index}`}><td>{row.reportId}</td><td>{row.date}</td><td>{row.siteName}</td><td>{row.workerName}</td></tr>)}</tbody></table></div></div>}
          {result.settlement && !result.reconciliation && !result.missingBilling && !result.evidence && <SettlementResults result={result} view={view} />}
          {result.reconciliation && <ReconciliationResults result={result} view={view} />}
          {result.evidence && <EvidenceResults result={result} view={view} />}
          {result.missingBilling && <MissingBillingResults result={result} view={view} />}
          {view === 'report' && <div className="ai-workspace__report"><h3>{result.plan.report.title || '일보 분석 보고서'}</h3><p>{result.plan.report.includeDetails ? '상세 내역 포함' : '요약과 그룹별 결과'} · {showAmount ? '금액 포함' : '금액 제외'} · {result.plan.report.splitByGroup ? '그룹별 시트 분리' : '통합 시트'}</p><p>“금액 열 빼줘”, “상세 내역 포함”, “팀별 시트로 나눠줘”처럼 요청할 수 있습니다.</p><div className="ai-workspace__actions"><button disabled={isBusy} onClick={() => void exportFile('pdf')}>PDF 만들기</button><button disabled={isBusy} onClick={() => void exportFile('xlsx')}>엑셀 만들기</button></div><p className="ai-workspace__note">계정별 최신 분석 결과를 1시간 동안 출력할 수 있습니다. 새 분석 또는 권한 변경 후에는 다시 조회해야 할 수 있습니다.</p></div>}
          {files.length > 0 && <div className="ai-workspace__files" aria-label="완성 파일">{files.map(file => <a key={file.format} href={file.url} download={file.name}>{file.format.toUpperCase()} 다운로드</a>)}</div>}
        </>}
      </main>
    </div>
  </section>;
}
