import React from 'react';
import { AI_EVIDENCE_METRICS, AI_EVIDENCE_STATUS_LABELS, AiResult } from './contract';
const money = (value: number | null) => value === null ? '비교 불가' : `${value.toLocaleString('ko-KR')}원`;
export function EvidenceMetrics({ result }: { result: AiResult }) {
  const { counts } = result.evidence!;
  return <div className="ai-workspace__metrics"><div><span>저장 근거 일치</span><strong>{counts.matched}건</strong></div>
    <div><span>금액 차이</span><strong>{counts.difference}건</strong></div><div><span>판단 불가·보류</span><strong>{counts.unavailable + counts.review + counts.invalid + counts.noSettlement}건</strong></div></div>;
}
export function EvidenceResults({ result, view }: { result: AiResult; view: 'table' | 'chart' | 'sources' | 'report' }) {
  const data = result.evidence!, amount = result.plan.report.includeAmount;
  if (view === 'report') return null;
  if (view === 'chart') {
    const maximum = Math.max(1, ...Object.values(data.counts));
    return <div className="ai-workspace__chart" aria-label="저장 근거 점검 그래프"><p>저장된 일보·지원비 근거 점검 상태입니다. 현재 원장 전체 대사를 뜻하지 않습니다.</p>
      {Object.entries(data.counts).map(([key, count]) => <div key={key}><span>{AI_EVIDENCE_STATUS_LABELS[key as keyof typeof AI_EVIDENCE_STATUS_LABELS]}</span><div><i style={{ width: `${count / maximum * 100}%` }} /></div><b>{count}건</b></div>)}</div>;
  }
  if (view === 'sources') return <div><p>조회 시점: {new Date(result.createdAt).toLocaleString('ko-KR')}</p><dl>{AI_EVIDENCE_METRICS.map(metric => <React.Fragment key={metric.id}><dt>{metric.label}</dt><dd>{metric.definition}</dd></React.Fragment>)}</dl>
    <div className="ai-workspace__table-wrap"><table aria-label="저장 근거 출처"><thead><tr><th>정산팀 / 항목</th><th>근거 저장 시각</th><th>근거 건수</th><th>정산 문서 / 항목 ID</th></tr></thead><tbody>{data.rows.slice(0, 50).map((row, index) => <tr key={index}><td>{row.teamName} / {row.category}</td><td>{row.capturedAt ? new Date(row.capturedAt).toLocaleString('ko-KR') : '확인 불가'}</td><td>{row.evidenceCount ?? '확인 불가'}</td><td>{row.settlementId || '확인 불가'}<br />{row.lineIds.join(', ') || '개별 연결 없음'}</td></tr>)}</tbody></table></div><p>화면에 최대 50건 표시 · 상세 포함 파일에서 전체 근거를 확인하세요.</p></div>;
  return <div><p>저장 근거 점검 {data.rows.length}건 · 화면에 최대 50건 표시</p><p>일보의 과거 공수·단가·금액은 저장되지 않아 금액 비교가 불가능합니다. 지원비 차이도 누락·과오납으로 단정하지 않습니다.</p>
    {amount && <p>비교 가능한 지원비 차이 절댓값 합계: <strong>{money(data.absoluteDifference)}</strong></p>}
    <div className="ai-workspace__table-wrap"><table aria-label="일보 지원비 저장 근거 점검"><thead><tr><th>정산팀</th><th>항목</th><th>상태</th>{amount && <><th>정산 반영액</th><th>저장 근거액</th><th>차이</th></>}<th>확인 사항</th></tr></thead><tbody>{data.rows.slice(0, 50).map((row, index) => <tr key={index}><td>{row.teamName}</td><td>{row.category}</td><td>{AI_EVIDENCE_STATUS_LABELS[row.status]}</td>{amount && <><td>{money(row.settledAmount)}</td><td>{money(row.evidenceAmount)}</td><td>{money(row.difference)}</td></>}<td>{row.reason}</td></tr>)}</tbody></table></div>
    {!data.rows.length && <p>조회 가능한 정산팀이 없습니다.</p>}</div>;
}
