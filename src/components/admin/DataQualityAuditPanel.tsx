import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faRotateRight, faShieldHalved, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  dataQualityAuditService,
  type DataQualityAuditSummary,
  type DataQualitySeverity,
} from '../../services/dataQualityAuditService';

const severityClassMap: Record<DataQualitySeverity, string> = {
  critical: 'bg-red-50 text-red-700 border-red-100',
  warning: 'bg-orange-50 text-orange-700 border-orange-100',
  info: 'bg-blue-50 text-blue-700 border-blue-100',
};

const severityLabelMap: Record<DataQualitySeverity, string> = {
  critical: '긴급',
  warning: '주의',
  info: '참고',
};

export const DataQualityAuditPanel: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = React.useState<DataQualityAuditSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const runAudit = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await dataQualityAuditService.run());
    } catch (auditError) {
      console.error('[DataQualityAuditPanel] audit failed', auditError);
      setError(auditError instanceof Error ? auditError.message : '데이터 품질 감사에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void runAudit();
  }, [runAudit]);

  const topIssues = summary?.issues.slice(0, 8) ?? [];

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-indigo-600">
            <FontAwesomeIcon icon={faShieldHalved} />
            Autonomous Audit
          </div>
          <h2 className="mt-1 text-lg font-black text-slate-900">ERP 데이터 품질 자동 감사</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            인력, 팀, 현장, 회사, 일보, 업무 요청의 연결 끊김과 SLA 리스크를 자동 점검합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={runAudit}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FontAwesomeIcon icon={faRotateRight} spin={loading} />
          {loading ? '감사 중' : '다시 감사'}
        </button>
      </div>

      {error ? (
        <div className="m-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="text-xs font-bold text-slate-400">전체 이슈</div>
              <div className="mt-1 text-2xl font-black text-slate-900">{summary?.totalIssues ?? 0}</div>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <div className="text-xs font-bold text-red-500">긴급</div>
              <div className="mt-1 text-2xl font-black text-red-700">{summary?.critical ?? 0}</div>
            </div>
            <div className="rounded-lg border border-orange-100 bg-orange-50 p-4">
              <div className="text-xs font-bold text-orange-500">주의</div>
              <div className="mt-1 text-2xl font-black text-orange-700">{summary?.warning ?? 0}</div>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="text-xs font-bold text-blue-500">참고</div>
              <div className="mt-1 text-2xl font-black text-blue-700">{summary?.info ?? 0}</div>
            </div>
          </div>

          <div className="border-t border-slate-100">
            {topIssues.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6 text-sm font-bold text-slate-500">
                <FontAwesomeIcon icon={faShieldHalved} className="text-green-500" />
                현재 자동 감사에서 우선 조치할 이슈가 없습니다.
              </div>
            ) : (
              topIssues.map((issue) => (
                <button
                  type="button"
                  key={issue.id}
                  onClick={() => issue.route && navigate(issue.route)}
                  className="group grid w-full grid-cols-1 gap-3 border-t border-slate-100 px-5 py-4 text-left transition first:border-t-0 hover:bg-slate-50 md:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${severityClassMap[issue.severity]}`}>
                        {severityLabelMap[issue.severity]}
                      </span>
                      <span className="text-sm font-black text-slate-900">{issue.title}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-600">{issue.description}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{issue.entityLabel}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 self-center text-sm font-extrabold text-indigo-700">
                    조치 화면
                    <FontAwesomeIcon icon={faArrowRight} className="text-xs transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))
            )}
          </div>

          {summary && summary.totalIssues > topIssues.length && (
            <div className="border-t border-slate-100 px-5 py-3 text-xs font-bold text-slate-500">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2 text-orange-500" />
              상위 {topIssues.length}건만 표시 중입니다. 전체 {summary.totalIssues}건은 감사 서비스 결과 기준으로 정렬됩니다.
            </div>
          )}
        </>
      )}
    </section>
  );
};
