import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Button from '../../components/ui/Button';
import { useWorkerHistory } from '../../hooks/useWorkerHistory';
import {
  EmptyState,
  ErrorBox,
  formatCurrency,
  formatNumber,
  PageHeader,
  StatusBadge,
  useRecruitingPermissions,
} from './RecruitingShared';

const RecruitingWorkerHistoryPage: React.FC = () => {
  const permissions = useRecruitingPermissions();
  const {
    filters,
    setFilters,
    history,
    detail,
    trend,
    selectedWorkerId,
    loading,
    saving,
    error,
    refresh,
    selectWorker,
    syncHistoricalWorkers,
    downloadExcel,
  } = useWorkerHistory();

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <PageHeader
        title="작업자 이력관리"
        description="용역팀 작업자의 소개자, 현장, 팀, 정산, 지급 변경 이력을 추적합니다."
        right={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => syncHistoricalWorkers()}
              isLoading={saving}
              disabled={!permissions.canRegister}
            >
              출력일보 이력 동기화
            </Button>
            <Button type="button" variant="secondary" onClick={downloadExcel} isLoading={saving}>이력 Excel</Button>
          </div>
        )}
      />
      <ErrorBox message={error} />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input value={filters.workerName} onChange={(event) => updateFilter('workerName', event.target.value)} placeholder="작업자명" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={filters.referrerName} onChange={(event) => updateFilter('referrerName', event.target.value)} placeholder="소개자" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={filters.siteName} onChange={(event) => updateFilter('siteName', event.target.value)} placeholder="현장" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={filters.teamName} onChange={(event) => updateFilter('teamName', event.target.value)} placeholder="팀" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <input type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <Button type="button" variant="secondary" onClick={refresh} isLoading={loading}>조회</Button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-black text-slate-800">작업자 증가 추이</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="workers" name="등록 작업자" stroke="#2563EB" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-black text-slate-800">작업자 상세</div>
            {detail && <StatusBadge status={detail.currentStatus} />}
          </div>
          {!detail ? <EmptyState message="작업자를 선택하면 상세 이력이 표시됩니다." /> : (
            <div className="space-y-3 text-sm">
              <div className="text-xl font-black text-slate-900">{detail.workerName}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">현재 소개자</div><div className="font-bold">{detail.currentReferrerName || '-'}</div></div>
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">최초 투입일</div><div className="font-bold">{detail.firstStartDate || '-'}</div></div>
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">누적근무일</div><div className="font-bold">{formatNumber(detail.cumulativeWorkDays)}일</div></div>
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">정산횟수</div><div className="font-bold">{formatNumber(detail.settlementCount)}회</div></div>
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">총수익</div><div className="font-bold">{formatCurrency(detail.totalIncome)}</div></div>
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">최근 현장/팀</div><div className="font-bold">{[detail.latestSiteName, detail.latestTeamName].filter(Boolean).join(' / ') || '-'}</div></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {history.length === 0 && !loading ? <EmptyState message="조회된 작업자 이력이 없습니다." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">일자</th>
                    <th className="px-4 py-3">작업자</th>
                    <th className="px-4 py-3">소개자</th>
                    <th className="px-4 py-3">현장</th>
                    <th className="px-4 py-3">팀</th>
                    <th className="px-4 py-3">이벤트</th>
                    <th className="px-4 py-3">이전값</th>
                    <th className="px-4 py-3">변경값</th>
                    <th className="px-4 py-3 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((row) => (
                    <tr key={row.id || `${row.workerId}:${row.eventDate}:${row.eventType}`} className={selectedWorkerId === row.workerId ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">{row.eventDate}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{row.workerName}</td>
                      <td className="px-4 py-3">{row.referrerName || '-'}</td>
                      <td className="px-4 py-3">{row.siteName || '-'}</td>
                      <td className="px-4 py-3">{row.teamName || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.eventType} /></td>
                      <td className="px-4 py-3">{row.oldValue || '-'}</td>
                      <td className="px-4 py-3">{row.newValue || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" size="sm" variant="secondary" onClick={() => selectWorker(row.workerId)}>상세</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-black text-slate-800">최근 이벤트 타임라인</div>
          {!detail || detail.events.length === 0 ? <EmptyState message="타임라인 이력이 없습니다." /> : (
            <div className="space-y-4">
              {detail.events.slice(0, 20).map((event) => (
                <div key={event.id || `${event.eventDate}:${event.eventType}`} className="border-l-2 border-indigo-200 pl-4">
                  <div className="text-xs font-semibold text-slate-500">{event.eventDate}</div>
                  <div className="mt-1 font-black text-slate-900">{event.eventType}</div>
                  <div className="mt-1 text-sm text-slate-600">{[event.oldValue, event.newValue].filter(Boolean).join(' → ') || event.referrerName || event.siteName || '-'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecruitingWorkerHistoryPage;
