import React from 'react';
import { AI_MISSING_METRICS, AI_MISSING_STATUS_LABELS, AiResult } from './contract';
const money = (value: number | null) => value === null ? '확인 불가' : `${value.toLocaleString('ko-KR')}원`;
export function MissingBillingMetrics({ result }: { result: AiResult }) {
  const data = result.missingBilling!, pending = data.counts.review + data.counts.noSettlement + data.counts.invalid;
  return <div className="ai-workspace__metrics"><div><span>미연결 후보</span><strong>{data.counts.candidate}건</strong></div>
    <div><span>연결 확인</span><strong>{data.counts.linked}건</strong></div><div><span>판단 불가·보류</span><strong>{pending}건</strong></div></div>;
}
export function MissingBillingResults({ result, view }: { result: AiResult; view: 'table' | 'chart' | 'sources' | 'report' }) {
  const data = result.missingBilling!, amount = result.plan.report.includeAmount;
  if (view === 'report') return null;
  if (view === 'chart') {
    const maximum = Math.max(1, ...Object.values(data.counts));
    return <div className="ai-workspace__chart" aria-label="청구서 연결 점검 그래프"><p>현재 확정 청구서의 ID 연결 상태입니다. 연결 확인은 금액 일치를 뜻하지 않습니다.</p>
      {Object.entries(data.counts).map(([key, count]) => <div key={key}><span>{AI_MISSING_STATUS_LABELS[key as keyof typeof AI_MISSING_STATUS_LABELS]}</span><div><i style={{ width: `${count / maximum * 100}%` }} /></div><b>{count}건</b></div>)}</div>;
  }
  const coverage = <div className="ai-workspace__table-wrap"><table aria-label="팀별 점검 범위"><thead><tr><th>정산팀</th><th>정산 확인</th><th>대상 청구서</th></tr></thead><tbody>{data.teams.map(team => <tr key={team.id}><td>{team.name}</td><td>{team.confirmed ? '확정 정산 확인' : '확정 정산 확인 불가'}</td><td>{team.bills}건</td></tr>)}</tbody></table></div>;
  if (view === 'sources') return <div><p>조회 시점: {new Date(result.createdAt).toLocaleString('ko-KR')}</p><dl>{AI_MISSING_METRICS.map(metric => <React.Fragment key={metric.id}><dt>{metric.label}</dt><dd>{metric.definition}</dd></React.Fragment>)}</dl>
    {coverage}<div className="ai-workspace__table-wrap"><table><thead><tr><th>정산팀</th><th>청구서</th><th>정산 문서</th><th>차감 항목</th></tr></thead><tbody>{data.rows.slice(0, 50).map(row => <tr key={`${row.sourceCollection}/${row.sourceId}`}><td>{row.teamName}</td><td>{row.category} · {row.sourceId}</td><td>{row.settlementId || '확인 불가'}</td><td>{row.lineIds.join(', ') || '직접 연결 없음'}</td></tr>)}</tbody></table></div><p>화면에 최대 50건 표시 · 상세 포함 파일에서 전체 근거를 확인하세요.</p></div>;
  return <div><p>현재 확정 청구서 {data.rows.length}건 · 화면에 최대 50건 표시</p><p>미연결 후보는 실제 누락·미지급 확정이 아닙니다. 정산 이후 청구나 의도한 제외일 수 있습니다.</p>
    <p>확정 정산을 확인한 팀 {data.teams.filter(team => team.confirmed).length}/{data.teams.length}개 · 미확정·취소 등 제외 {data.excludedUnconfirmed}건</p>
    {amount && <p>미연결 후보의 현재 청구액 합계: <strong>{money(data.candidateAmount)}</strong> · 정산액에 자동 합산하지 않습니다.</p>}
    <div className="ai-workspace__table-wrap"><table aria-label="미연결 청구서 점검"><thead><tr><th>정산팀</th><th>종류</th><th>상태</th>{amount && <th>현재 청구액</th>}<th>확인 사항</th></tr></thead><tbody>{data.rows.slice(0, 50).map(row => <tr key={`${row.sourceCollection}/${row.sourceId}`}><td>{row.teamName}</td><td>{row.category}</td><td>{AI_MISSING_STATUS_LABELS[row.status]}</td>{amount && <td>{money(row.sourceAmount)}</td>}<td>{row.reason}</td></tr>)}</tbody></table></div>
    {!data.rows.length && <p>이 점검 범위의 확정 청구서가 없습니다. 전체 업무의 누락이 없다는 뜻은 아닙니다.</p>}{coverage}</div>;
}
