import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geminiUsageLogService, GEMINI_USAGE_CHANGED, UsageCursor } from '../../services/geminiUsageLogService';
import { GeminiUsageLog, GEMINI_PRICING_URL, GEMINI_PRICING_VERSION } from '../../utils/geminiUsage';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';

const FEATURES: Record<string, string> = {
  'document-analysis': '문서 분석', 'image-generation': '이미지 생성', 'analytics-agent': '데이터 분석',
  'agent-orchestrator': 'AI 업무 도우미', 'drawing-estimate': '도면 견적', 'tax-invoice-import': '세금계산서 분석',
  'manpower-search': '인력 검색', 'identity-analysis': '신분증 분석', 'accommodation-bills': '숙소 공과금 분석',
  'vehicle-fines': '차량 과태료 분석', 'vehicle-tolls': '통행료 분석', 'card-statements': '카드 명세서 분석',
  'card-audit': '카드 지출 감사', 'partner-recognition': '거래처 인식', 'daily-report-analytics': '일보 통계 분석',
  'excel-conversion': '엑셀 변환', 'excel-structure': '엑셀 구조 분석', 'worker-documents': '작업자 서류 분석',
  'expense-receipt': '경비 영수증 분석', 'ai-workspace': 'AI 업무 분석',
};
const STATUS = { success: '응답 완료', failed: '요청 실패', blocked: '응답 차단' };
const PRICE_STATUS = { missing_usage: '사용량 미제공', unknown_model: '단가 미등록', incomplete_usage: '세부 사용량 부족', estimated: '예상 비용' };
const count = (n: number | null) => n === null ? '미제공' : n.toLocaleString('ko-KR');
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
const koreanDate = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date);
const field = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700';

export default function GeminiUsageLogPage() {
  const today = koreanDate();
  const [startDate, setStartDate] = useState(`${today.slice(0, 7)}-01`), [endDate, setEndDate] = useState(today);
  const [logs, setLogs] = useState<GeminiUsageLog[]>([]), [cursor, setCursor] = useState<UsageCursor | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [keyword, setKeyword] = useState(''), [model, setModel] = useState(''), [status, setStatus] = useState('');
  const [exchangeRate, setExchangeRate] = useState(''), [expanded, setExpanded] = useState<string | null>(null);
  const serial = useRef(0);
  const load = useCallback(async (next?: UsageCursor | null) => {
    const request = ++serial.current;
    if (!startDate || !endDate || startDate > endDate || (Date.parse(endDate) - Date.parse(startDate)) / 86400000 >= 366) {
      setLogs([]); setCursor(null); setError('조회 기간은 시작일부터 최대 366일까지 선택해 주세요.'); setLoading(false); return;
    }
    setLoading(true); setError('');
    if (!next) { setLogs([]); setCursor(null); }
    try {
      const page = await geminiUsageLogService.list(startDate, endDate, next);
      if (request !== serial.current) return;
      setLogs(previous => next ? [...new Map([...previous, ...page.logs].map(log => [log.id, log])).values()] : page.logs);
      setCursor(page.nextCursor);
    } catch {
      if (request === serial.current) setError('기록을 불러오지 못했습니다. 관리자 권한, 연결 상태 및 사용량 수집 서버 배포 상태를 확인해 주세요.');
    } finally { if (request === serial.current) setLoading(false); }
  }, [startDate, endDate]);
  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener(GEMINI_USAGE_CHANGED, refresh);
    return () => { serial.current++; window.removeEventListener(GEMINI_USAGE_CHANGED, refresh); };
  }, [load]);
  const visible = useMemo(() => logs.filter(log => (!model || log.model === model) && (!status || log.status === status)
    && `${log.actorName} ${log.actorUid} ${FEATURES[log.feature] || log.feature} ${log.path} ${log.model}`.toLowerCase().includes(keyword.trim().toLowerCase())), [logs, model, status, keyword]);
  const stats = useMemo(() => visible.reduce((a, log) => ({
    input: a.input + (log.usage.inputTokens ?? 0), output: a.output + (log.usage.outputTokens ?? 0) + log.usage.thinkingTokens,
    cost: a.cost + (log.estimatedUsd ?? 0), unknown: a.unknown + (log.estimatedUsd === null ? 1 : 0),
    failed: a.failed + (log.status === 'failed' ? 1 : 0),
  }), { input: 0, output: 0, cost: 0, unknown: 0, failed: 0 }), [visible]);
  const rate = Number(exchangeRate);
  const models = [...new Set(logs.map(log => log.model))].sort();
  const cards = [
    { title: '조회된 호출', value: `${count(visible.length)}건`, note: `요청 실패 ${count(stats.failed)}건` },
    { title: '입력 사용량', value: count(stats.input), note: '토큰 · 캐시 포함' },
    { title: '출력 사용량', value: count(stats.output), note: '토큰 · 추론 포함' },
    { title: '예상 비용 (USD)', value: usd(stats.cost), note: stats.unknown ? `비용 미확인 ${count(stats.unknown)}건 제외` : '확인된 토큰 비용 합계' },
  ];
  return <div className="min-h-screen bg-slate-50 p-4 md:p-8">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold tracking-widest text-indigo-600">로그관리 · AI 사용 현황</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Gemini 사용량·비용 로그</h1>
        <p className="mt-2 text-sm text-slate-500">누가 어떤 기능에서 Gemini를 사용했는지, 사용량과 예상 비용을 확인합니다.</p></div>
      <button className={`${field} font-bold disabled:opacity-50`} disabled={loading} onClick={() => void load()}>새로고침</button>
    </div>
    {isDevAdminSessionEnabled() && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">개발 모드 · 이 브라우저의 테스트 사용 기록입니다. 실제 사용자 기록은 실제 관리자 계정에서 확인해 주세요.</div>}
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <div role="group" aria-label={card.title} key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{card.title}</p><p className="mt-3 text-2xl font-black text-slate-900">{card.value}</p><p className="mt-2 text-xs text-slate-500">{card.note}</p>
    </div>)}</div>
    <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm leading-6 text-slate-600">
      <p>금액은 유료 API 단가를 적용한 <strong>토큰 비용 예상치</strong>입니다. 무료 할당량·할인·세금·검색 도구·캐시 보관 비용은 반영하지 않아 실제 청구액과 다를 수 있습니다.</p>
      <p className="mt-1 text-xs">수집 적용 이후 기록만 표시합니다. 통계·검색·필터는 현재 불러온 기록 기준이며, 사용량이 없거나 단가를 모르는 요청은 비용 미확인으로 표시합니다. <a className="font-bold text-indigo-700 underline" href={GEMINI_PRICING_URL} target="_blank" rel="noreferrer">Google 공식 단가</a> · 확인일 {GEMINI_PRICING_VERSION}</p>
      <label className="mt-3 inline-flex flex-wrap items-center gap-2 text-xs">원화 환산 기준 (직접 입력)<input aria-label="달러당 원화 환율" className={`${field} w-32`} type="number" min="0" step="0.01" value={exchangeRate} placeholder="1 USD당 원" onChange={event => setExchangeRate(event.target.value)} />
        {rate > 0 && Number.isFinite(rate) && <span>예상 합계 약 {Math.round(stats.cost * rate).toLocaleString('ko-KR')}원 · 입력 환율 {rate.toLocaleString('ko-KR')}원/USD</span>}</label>
    </div>
    <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="text-xs text-slate-500">시작일 (한국 시간)<input aria-label="조회 시작일" type="date" className={`${field} mt-1 block`} value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
      <label className="text-xs text-slate-500">종료일 (한국 시간)<input aria-label="조회 종료일" type="date" className={`${field} mt-1 block`} value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
      <input aria-label="사용 기록 검색" className={`${field} min-w-48 flex-1 self-end`} placeholder="사용자·기능·경로 검색" value={keyword} onChange={event => setKeyword(event.target.value)} />
      <select aria-label="Gemini 모델" className={`${field} self-end`} value={model} onChange={event => setModel(event.target.value)}><option value="">전체 모델</option>{models.map(item => <option key={item}>{item}</option>)}</select>
      <select aria-label="호출 결과" className={`${field} self-end`} value={status} onChange={event => setStatus(event.target.value)}><option value="">전체 결과</option>{Object.entries(STATUS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
    </div>
    {error && <div role="alert" className="mb-4 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs text-slate-500"><tr>{['사용 시각 · 사용자', '기능 · 모델', '결과', '입력 토큰', '출력 · 추론 토큰', '예상 비용 (USD)', '상세'].map(label => <th className="px-4 py-4" key={label}>{label}</th>)}</tr></thead>
        <tbody>{visible.map(log => <React.Fragment key={log.id}><tr className="border-b border-slate-100 hover:bg-slate-50">
          <td className="px-4 py-4"><div className="font-semibold">{new Date(log.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div><div className="mt-1 text-xs text-slate-500">{log.actorName || log.actorUid || '서버 작업'}</div></td>
          <td className="px-4 py-4"><div className="font-bold">{FEATURES[log.feature] || log.feature}</div><div className="mt-1 text-xs text-slate-500">{log.model} · {log.mode === 'batch' ? '일괄 처리' : '일반 호출'}</div></td>
          <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${log.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{STATUS[log.status]}</span></td>
          <td className="px-4 py-4 tabular-nums">{count(log.usage.inputTokens)}</td>
          <td className="px-4 py-4 tabular-nums">{count(log.usage.outputTokens)}<div className="mt-1 text-xs text-slate-400">추론 {count(log.usage.thinkingTokens)}</div></td>
          <td className="px-4 py-4 font-bold tabular-nums">{log.estimatedUsd === null ? <span className="text-amber-700">비용 미확인</span> : usd(log.estimatedUsd)}</td>
          <td className="px-4 py-4"><button aria-label={`${log.id} 상세`} aria-expanded={expanded === log.id} className="font-bold text-indigo-600" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>상세</button></td>
        </tr>{expanded === log.id && <tr className="border-b bg-slate-50"><td colSpan={7} className="px-5 py-4 text-xs leading-6 text-slate-600">
          <div>사용자 ID: {log.actorUid || '서버 작업'} · 수집 위치: {log.source === 'server' ? '서버' : log.source === 'browser' ? '브라우저 보고' : '개발 테스트'} · 경로: {log.path || '서버에서 실행'}</div>
          <div>소요 시간: {(log.durationMs / 1000).toFixed(1)}초 · 캐시 입력: {count(log.usage.cachedTokens)} · 전체 토큰: {count(log.usage.totalTokens)} · 이미지 출력 토큰: {count(log.usage.imageOutputTokens)}</div>
          <div>비용 상태: {PRICE_STATUS[log.priceStatus]} · 단가 기준: {log.pricingVersion} {log.errorCode && `· 오류 코드: ${log.errorCode}`}</div>
        </td></tr>}</React.Fragment>)}
        {!visible.length && !loading && !error && <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-500">조건에 맞는 사용 기록이 없습니다.</td></tr>}
        {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">사용 기록을 불러오는 중입니다.</td></tr>}</tbody>
      </table>
    </div>
    <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><p>불러온 기록 {count(logs.length)}건 · 표시 {count(visible.length)}건{cursor ? ' · 이전 기록이 더 있습니다.' : ''}</p>
      {cursor && <button disabled={loading} className={`${field} font-bold`} onClick={() => void load(cursor)}>이전 기록 더 보기</button>}</div>
  </div>;
}
