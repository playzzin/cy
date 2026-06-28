import React, { useCallback, useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import { serviceReferralSettlementService } from '../../services/serviceReferralSettlementService';
import {
  EmptyState,
  ErrorBox,
  formatCurrency,
  getCurrentYearMonth,
  MonthToolbar,
  PageHeader,
  StatusBadge,
} from './RecruitingShared';

type LogRow = Awaited<ReturnType<typeof serviceReferralSettlementService.getSettlementLogs>>[number];

const RecruitingLogsPage: React.FC = () => {
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await serviceReferralSettlementService.getSettlementLogs(yearMonth));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader title="정산 로그" description="일별 정산 라인과 월별 정산 상태 변경 내역을 추적합니다." />
      <MonthToolbar
        yearMonth={yearMonth}
        onChange={setYearMonth}
        onRefresh={refresh}
        loading={loading}
        actions={<Button type="button" variant="secondary" onClick={refresh}>조회</Button>}
      />
      <ErrorBox message={error} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? <EmptyState message="정산 로그가 없습니다." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3">일자</th>
                  <th className="px-4 py-3">구분</th>
                  <th className="px-4 py-3">내용</th>
                  <th className="px-4 py-3 text-right">금액</th>
                  <th className="px-4 py-3">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{row.date}</td>
                    <td className="px-4 py-3 font-semibold">{row.type}</td>
                    <td className="px-4 py-3">{row.title}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruitingLogsPage;
