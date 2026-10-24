import React from 'react';
import { AI_SETTLEMENT_METRICS, AiResult } from './contract';
const money = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export function SettlementMetrics({ result }: { result: AiResult }) {
  const value = result.settlement!.totals;
  return <div className="ai-workspace__metrics"><div><span>확정 정산</span><strong>{value.documents}건</strong></div>{result.plan.report.includeAmount && <><div><span>정산 계산액</span><strong>{money(value.net)}원</strong></div><div><span>차감 비용</span><strong>{money(value.deductions)}원</strong></div></>}</div>;
}
export function SettlementResults({ result, view }: { result: AiResult; view: 'table' | 'chart' | 'sources' | 'report' }) {
  const data = result.settlement!, showAmount = result.plan.report.includeAmount;
  if (view === 'report') return null;
  if (view === 'sources') {
    const sources = Array.from(new Map(data.details.map(row => [row.documentId, row])).values());
    return <div><p>조회 시점: {new Date(result.createdAt).toLocaleString('ko-KR')}</p><p>결과 ID: {result.id}</p><dl>{AI_SETTLEMENT_METRICS.map(metric => <React.Fragment key={metric.id}><dt>{metric.label}</dt><dd>{metric.definition}</dd></React.Fragment>)}</dl>
      <p>현재 기간의 확정 원본 {sources.length}건 · 최대 50건 표시</p><div className="ai-workspace__table-wrap"><table><thead><tr><th>정산팀</th><th>정산월</th><th>확정 시각</th><th>문서 ID</th></tr></thead><tbody>{sources.slice(0, 50).map(row => <tr key={row.documentId}><td>{row.teamName}</td><td>{row.yearMonth}</td><td>{new Date(row.confirmedAt).toLocaleString('ko-KR')}</td><td>{row.documentId}</td></tr>)}</tbody></table></div></div>;
  }
  if (view === 'chart') {
    if (!showAmount) return <p>금액을 제외한 보고서입니다. 금액을 포함하도록 요청하면 비용 그래프를 확인할 수 있습니다.</p>;
    const costs = [['카드', data.totals.card], ['숙소', data.totals.accommodation], ['차량', data.totals.vehicle], ['급여', data.totals.payroll], ['기타', data.totals.other]] as const;
    const maximum = Math.max(1, ...costs.map(([, amount]) => amount));
    return <div className="ai-workspace__chart ai-workspace__chart--money" aria-label="확정 정산 차감 비용 그래프"><p>정산에 이미 반영된 차감 비용입니다. 별도 원장 지출은 합산하지 않습니다.</p>{costs.map(([label, amount]) => <div key={label}><span>{label}</span><div><i style={{ width: `${amount / maximum * 100}%` }} /></div><b>{money(amount)}원</b></div>)}</div>;
  }
  return <div><p>전체 {data.rows.length}개 팀 · 화면에 최대 50개 표시</p>
    <div className="ai-workspace__table-wrap"><table><thead><tr><th>정산팀</th><th>확정 건수</th>{showAmount && <><th>정산 계산액</th><th>차감 합계</th>{data.previousTotals && <><th>전기 계산액</th><th>계산액 증감</th></>}</>}</tr></thead><tbody>{data.rows.slice(0, 50).map(row => <tr key={row.id}><td>{row.name}</td><td>{row.documents}건</td>{showAmount && <><td>{money(row.net)}원</td><td>{money(row.deductions)}원</td>{row.previous && <><td>{money(row.previous.net)}원</td><td>{money(row.netChange || 0)}원</td></>}</>}</tr>)}</tbody></table></div>
    {!data.rows.length && <p>조건에 맞는 저장된 확정 정산이 없습니다.</p>}
    {showAmount && data.rows.length > 0 && <><h3>정산 구성</h3><div className="ai-workspace__table-wrap"><table><thead><tr><th>팀</th><th>매출</th><th>매입</th><th>차감</th><th>추가</th><th>이월</th><th>입금/정산조정</th></tr></thead><tbody>{data.rows.slice(0, 50).map(row => <tr key={row.id}><td>{row.name}</td>{[row.sales, row.purchases, row.deductions, row.additions, row.prevCarryover, row.deposit].map((value, index) => <td key={index}>{money(value)}원</td>)}</tr>)}</tbody></table></div>
    <h3>차감 비용 구성</h3><div className="ai-workspace__table-wrap"><table><thead><tr><th>팀</th><th>카드</th><th>숙소</th><th>차량</th><th>급여</th><th>기타</th></tr></thead><tbody>{data.rows.slice(0, 50).map(row => <tr key={row.id}><td>{row.name}</td>{[row.card, row.accommodation, row.vehicle, row.payroll, row.other].map((value, index) => <td key={index}>{money(value)}원</td>)}</tr>)}</tbody></table></div></>}
  </div>;
}
