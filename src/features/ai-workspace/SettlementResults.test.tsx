import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { SettlementMetrics, SettlementResults } from './SettlementResults';
import { AI_WORKSPACE_VERSION, AiResult } from './contract';
const example = (): AiResult => {
  const totals = { sales: 1000000, purchases: 200000, deductions: 310000, additions: 20000, prevCarryover: 40000, deposit: 60000, net: 610000, documents: 1, card: 50000, accommodation: 100000, vehicle: 30000, payroll: 120000, other: 10000 };
  return { id: 'synthetic-financial', version: AI_WORKSPACE_VERSION, createdAt: '2026-09-01T00:00:00Z', expiresAt: '2026-09-01T01:00:00Z',
    plan: { dataset: 'teamSettlements', operation: 'aggregate', entity: 'team', range: {startDate:'2026-08-01',endDate:'2026-08-31'}, comparison:null, groupBy:'settlementTeam', filters:[], missingAccount:false,status:'',sortBy:'amount',direction:'desc',clarification:'',report:{format:'none',title:'확정 정산',includeDetails:true,includeAmount:true,splitByGroup:false} },
    totals:{manDay:0,workers:0,amount:0,reports:0}, previousTotals:null, rows:[],details:[],records:[],warnings:[],completeness:'complete',summary:'확정 정산 1건',
    settlement:{totals,previousTotals:null,rows:[{id:'t1',name:'검증팀',...totals,previous:null,netChange:null}],details:[{documentId:'synthetic-source',teamId:'t1',teamName:'검증팀',yearMonth:'2026-08',confirmedAt:'2026-09-01T00:00:00Z',section:'차감',category:'카드',amount:50000}]} };
};
test('financial metrics and component costs are distinct from daily report wages', () => {
  const result = example(); render(<><SettlementMetrics result={result}/><SettlementResults result={result} view="table"/></>);
  expect(screen.getAllByText('610,000원')).toHaveLength(2); expect(screen.getByText('50,000원')).toBeInTheDocument();
  expect(screen.getByRole('heading', {name:'차감 비용 구성'})).toBeInTheDocument(); expect(screen.queryByText('일보 산출액')).not.toBeInTheDocument();
});
test('amount exclusion hides financial cards, tables and charts', () => {
  const result = example(); result.plan.report.includeAmount = false;
  render(<><SettlementMetrics result={result}/><SettlementResults result={result} view="table"/><SettlementResults result={result} view="chart"/></>);
  expect(screen.queryByText('610,000원')).not.toBeInTheDocument(); expect(screen.queryByText('50,000원')).not.toBeInTheDocument();
  expect(screen.getByText(/금액을 제외한 보고서/)).toBeInTheDocument();
});
test('source view carries confirmation date and original document identity', () => {
  render(<SettlementResults result={example()} view="sources"/>);
  expect(screen.getByText('synthetic-source')).toBeInTheDocument(); expect(screen.getByText('확정 시각')).toBeInTheDocument();
  expect(screen.getByText(/내부거래 제거 전/)).toBeInTheDocument();
});
