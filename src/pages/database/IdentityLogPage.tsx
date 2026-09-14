import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Download, Filter, IdCard, RefreshCw, Search } from 'lucide-react';
import {
  IDENTITY_LOG_ACTIONS, identityBundleLogService,
  type IdentityBundleLog, type IdentityLogAction, type IdentityLogStatus,
} from '../../services/identityBundleLogService';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';

const STATUS_LABELS: Record<IdentityLogStatus, string> = { success: '성공', partial: '일부 완료', failure: '실패' };
const REASON_LABELS = {
  invalid_files: '지원하지 않는 파일 또는 파일 크기 제한 초과',
  too_many_files: '최대 60장 제한 초과',
  processing_failed: '처리 중 오류 발생',
  missing_results: '일부 문서의 분석 결과 없음',
};
const day = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dateTime = (iso: string): string => day(iso) ? new Date(iso).toLocaleString('ko-KR', { hour12: false }) : '-';

const IdentityLogPage: React.FC = () => {
  const [logs, setLogs] = useState<IdentityBundleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [action, setAction] = useState<IdentityLogAction | 'all'>('all');
  const [status, setStatus] = useState<IdentityLogStatus | 'all'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedId, setExpandedId] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setLogs(await identityBundleLogService.getLogs()); }
    catch { setError('신분증 로그를 불러오지 못했습니다. 로그 조회 권한과 연결 상태를 확인해 주세요.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadLogs(); }, [loadLogs]);

  const filtered = useMemo(() => logs.filter((log) => {
    if (action !== 'all' && log.action !== action) return false;
    if (status !== 'all' && log.status !== status) return false;
    const createdDay = day(log.createdAt);
    if (fromDate && createdDay < fromDate) return false;
    if (toDate && createdDay > toDate) return false;
    const text = [log.actorName, log.actorEmail, log.workerId, ...log.personNames, ...log.fileNames,
      IDENTITY_LOG_ACTIONS[log.action]].join(' ').toLowerCase();
    return text.includes(keyword.trim().toLowerCase());
  }), [logs, action, status, keyword, fromDate, toDate]);

  const stats = [
    { label: '전체 기록', value: logs.length, icon: IdCard },
    { label: '성공', value: logs.filter((log) => log.status === 'success').length, icon: CheckCircle2 },
    { label: '다운로드 요청', value: logs.filter((log) => log.status === 'success' && log.action.startsWith('download_')).length, icon: Download },
    { label: '실패·일부 완료', value: logs.filter((log) => log.status !== 'success').length, icon: AlertCircle },
  ];
  const inputClass = 'min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500';

  return (
    <main className="mx-auto max-w-[1800px] p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700"><IdCard size={15} /> 로그 관리</div>
          <h1 className="mt-3 text-3xl font-black text-slate-900">신분증 로그</h1>
          <p className="mt-2 text-sm text-slate-500">신분증 묶음사진의 파일 추가, 분석, 편집, 다운로드와 DB 등록 이력을 확인합니다.</p>
          {isDevAdminSessionEnabled() && <p className="mt-2 text-xs text-amber-700">개발 모드 · 이 브라우저에 저장된 테스트 기록입니다.</p>}
        </div>
        <div className="flex gap-2">
          <Link to="/database/identity-bundle" className={`${inputClass} inline-flex items-center`}>신분증 묶음사진</Link>
          <button type="button" onClick={() => { void loadLogs(); }} disabled={loading} className={`${inputClass} inline-flex items-center gap-2 disabled:opacity-50`}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 새로고침</button>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="rounded-lg bg-slate-100 p-3 text-slate-600"><Icon size={20} /></span>
          <div><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value.toLocaleString('ko-KR')}</p></div>
        </div>)}
      </div>
      <section aria-label="로그 필터" className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700"><Filter size={16} /> 로그 필터</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_180px_140px_160px_160px]">
          <label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input aria-label="신분증 로그 검색" placeholder="대상자, 파일명, 작업자로 검색" className={`${inputClass} w-full pl-9`} value={keyword} onChange={(event) => setKeyword(event.target.value)} /></label>
          <select aria-label="작업 종류" className={inputClass} value={action} onChange={(event) => setAction(event.target.value as IdentityLogAction | 'all')}><option value="all">전체 작업</option>{Object.entries(IDENTITY_LOG_ACTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="처리 결과" className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as IdentityLogStatus | 'all')}><option value="all">전체 결과</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <input aria-label="시작일" type="date" className={inputClass} value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} />
          <input aria-label="종료일" type="date" className={inputClass} value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </section>
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="font-bold text-slate-900">신분증 처리 이력</h2><span className="text-sm text-slate-500">최근 500건 중 {filtered.length}건 표시</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-xs text-slate-500"><tr>{['일시', '작업', '대상자 / 파일', '작업자', '결과', '상세'].map((label) => <th key={label} scope="col" className="px-5 py-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((log) => <React.Fragment key={log.id}>
              <tr className="text-slate-700 hover:bg-slate-50">
                <td className="whitespace-nowrap px-5 py-4 text-xs">{dateTime(log.createdAt)}</td>
                <td className="px-5 py-4 font-semibold">{IDENTITY_LOG_ACTIONS[log.action]}</td>
                <td className="px-5 py-4"><div className="max-w-[260px] truncate font-semibold">{log.personNames.join(', ') || log.fileNames[0] || '-'}</div><div className="mt-1 text-xs text-slate-500">파일 {log.fileCount}개 · 대상 {log.personCount}명</div></td>
                <td className="px-5 py-4"><div className="font-semibold">{log.actorName || '-'}</div><div className="mt-1 text-xs text-slate-500">{log.actorEmail || log.actorId}</div></td>
                <td className="px-5 py-4"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${log.status === 'success' ? 'bg-emerald-50 text-emerald-700' : log.status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{STATUS_LABELS[log.status]}</span></td>
                <td className="px-5 py-4"><button type="button" aria-expanded={expandedId === log.id} aria-label={`${IDENTITY_LOG_ACTIONS[log.action]} 상세 보기`} onClick={() => setExpandedId(expandedId === log.id ? '' : log.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{expandedId === log.id ? '닫기' : '보기'}</button></td>
              </tr>
              {expandedId === log.id && <tr className="bg-slate-50"><td colSpan={6} className="px-5 py-4">
                <dl className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
                  <div><dt className="text-xs text-slate-500">대상자</dt><dd className="mt-1 break-words text-slate-800">{log.personNames.join(', ') || '-'}</dd></div>
                  <div><dt className="text-xs text-slate-500">파일 목록</dt><dd className="mt-1 break-all text-slate-800">{log.fileNames.join(', ') || '-'}</dd></div>
                  {log.workerId && <div><dt className="text-xs text-slate-500">작업자 DB ID</dt><dd className="mt-1 break-all text-slate-800">{log.workerId}</dd></div>}
                  {log.correctionMode && <div><dt className="text-xs text-slate-500">문서 보정</dt><dd className="mt-1 text-slate-800">{log.correctionMode === 'MANUAL' ? '수동 보정' : log.correctionMode === 'ORIGINAL' ? '원본 사용' : 'AI 자동 보정'}</dd></div>}
                  {log.reason && <div><dt className="text-xs text-slate-500">처리 내용</dt><dd className="mt-1 text-rose-700">{REASON_LABELS[log.reason]}</dd></div>}
                </dl>
                {log.action.startsWith('download_') && <p className="mt-3 text-xs text-slate-500">파일을 생성해 브라우저에 다운로드를 요청한 기록입니다. 기기의 최종 저장 여부는 확인하지 않습니다.</p>}
              </td></tr>}
            </React.Fragment>)}
            {loading && <tr><td colSpan={6} className="p-12 text-center text-slate-500">신분증 로그를 불러오는 중입니다.</td></tr>}
            {!loading && !error && filtered.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-slate-500">조건에 맞는 신분증 로그가 없습니다.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </main>
  );
};

export default IdentityLogPage;
