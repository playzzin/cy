import React from 'react';
import { AI_AUDIT_METRICS, AI_AUDIT_STATUS_LABELS, AiResult } from './contract';
const money = (value: number | null) => value === null ? '비교 불가' : `${value.toLocaleString('ko-KR', { maximumFractionDigits: 6 })}원`;
export function ReconciliationMetrics({ result }: { result: AiResult }) {
  const audit = result.reconciliation!, unchecked = audit.rows.length - audit.counts.matched - audit.counts.difference;
  return <div className="ai-workspace__metrics"><div><span>일치</span><strong>{audit.counts.matched}건</strong></div><div><span>금액 차이</span><strong>{audit.counts.difference}건</strong></div><div><span>비교 불가</span><strong>{unchecked}건</strong></div></div>;
}
export function ReconciliationResults({ result, view }: { result: AiResult; view: 'table' | 'chart' | 'sources' | 'report' }) {
  const audit = result.reconciliation!, showAmount = result.plan.report.includeAmount;
  if (view === 'report') return null;
  if (view === 'chart') {
    const maximum = Math.max(1, ...Object.values(audit.counts));
    return <div className="ai-workspace__chart" aria-label="청구서 대사 상태 그래프"><p>정산에 연결된 카드·숙소·차량 차감 내역의 대사 상태입니다.</p>{Object.entries(audit.counts).map(([key, count]) => <div key={key}><span>{AI_AUDIT_STATUS_LABELS[key as keyof typeof AI_AUDIT_STATUS_LABELS]}</span><div><i style={{ width: `${count / maximum * 100}%` }}/></div><b>{count}건</b></div>)}</div>;
  }
  if (view === 'sources') return <div><p>조회 시점: {new Date(result.createdAt).toLocaleString('ko-KR')}</p><dl>{AI_AUDIT_METRICS.map(metric => <React.Fragment key={metric.id}><dt>{metric.label}</dt><dd>{metric.definition}</dd></React.Fragment>)}</dl><div className="ai-workspace__table-wrap"><table><thead><tr><th>정산팀</th><th>정산 문서</th><th>청구서</th><th>차감 항목</th></tr></thead><tbody>{audit.rows.slice(0, 50).map((row, index) => <tr key={index}><td>{row.teamName}</td><td>{row.settlementId}</td><td>{row.sourceId || '확인 불가'}</td><td>{row.lineId}</td></tr>)}</tbody></table></div><p>최대 50건 표시 · 파일에서 전체 내역을 확인할 수 있습니다.</p></div>;
  return <div><p>차감 내역 {audit.rows.length}건 · 화면에 최대 50건 표시</p><p>차이는 현재 청구액 − 정산 반영액입니다. ‘비교 불가’는 0원이나 일치가 아닙니다.</p>{showAmount && <p>비교 가능한 내역의 금액 차이 절댓값 합계: <strong>{money(audit.absoluteDifference)}</strong></p>}
    <div className="ai-workspace__table-wrap"><table><thead><tr><th>정산팀</th><th>종류</th><th>상태</th>{showAmount && <><th>정산 반영액</th><th>현재 청구액</th><th>차이</th></>}<th>확인 사항</th></tr></thead><tbody>{audit.rows.slice(0, 50).map((row, index) => <tr key={index}><td>{row.teamName}</td><td>{row.category}</td><td>{AI_AUDIT_STATUS_LABELS[row.status]}</td>{showAmount && <><td>{money(row.settledAmount)}</td><td>{money(row.sourceAmount)}</td><td>{money(row.difference)}</td></>}<td>{row.reason}</td></tr>)}</tbody></table></div>
    {!audit.rows.length && <p>대사할 카드·숙소·차량 차감 내역이 없습니다. 전체 원장의 누락이 없다는 뜻은 아닙니다.</p>}</div>;
}
