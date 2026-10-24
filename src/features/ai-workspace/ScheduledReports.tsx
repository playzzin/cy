import React, { useEffect, useRef, useState } from 'react';
import { AI_REPORT_RETENTION_DAYS, AI_SCHEDULE_LIMIT, AiReportCadence, AiReportOverview, AiReportSchedule, AiSavedAnalysis } from './contract';
import { SavedAnalysisSummary } from './SavedAnalyses';
import type { WorkspaceClient } from './service';

const kst = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
export const cadenceLabel = (value: AiReportCadence) => `${value.frequency === 'daily' ? '매일' : value.frequency === 'weekly' ? `매주 ${weekdays[value.weekday! - 1]}요일` : `매월 ${value.monthDay}일`} ${value.time} (한국 시간)`;
const initialCadence: AiReportCadence = { frequency: 'monthly', time: '09:00', weekday: null, monthDay: 1 };
type Props = { client: WorkspaceClient; disabled: boolean; onManaging: (busy: boolean) => void };
export function ScheduledReports(props: Props) {
  const [open, setOpen] = useState(false);
  return <section className="ai-workspace__saved" aria-label="정기 보고">
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} disabled={props.disabled}>정기 보고 {open ? '접기' : '열기'}</button>
    {open && <ReportPanel {...props} />}
  </section>;
}
function ReportPanel({ client, disabled, onManaging }: Props) {
  const [data, setData] = useState<AiReportOverview>({ schedules: [], runs: [] });
  const [saved, setSaved] = useState<AiSavedAnalysis[]>([]), [savedId, setSavedId] = useState('');
  const [cadence, setCadence] = useState<AiReportCadence>(initialCadence);
  const [editing, setEditing] = useState<AiReportSchedule | null>(null), [review, setReview] = useState(false);
  const [deleteId, setDeleteId] = useState(''), [working, setWorking] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const active = useRef(true), pending = useRef(false), url = useRef('');
  const clearFile = () => { if (url.current) URL.revokeObjectURL(url.current); url.current = ''; setFile(null); };
  useEffect(() => {
    active.current = true;
    Promise.all([client.reports.list(), client.listSaved()]).then(([reports, analyses]) => {
      if (active.current) { setData(reports); setSaved(analyses.items); }
    }).catch(e => { if (active.current) setError(e instanceof Error ? e.message : '정기 보고 목록을 불러오지 못했습니다.'); })
      .finally(() => { if (active.current) setWorking(false); });
    return () => { active.current = false; if (url.current) URL.revokeObjectURL(url.current); };
  }, [client]);
  const manage = async (operation: () => Promise<void>) => {
    if (pending.current || disabled || working) return;
    pending.current = true; setWorking(true); onManaging(true); setError(''); setNotice(''); clearFile();
    try { await operation(); }
    catch (e) { if (active.current) setError(e instanceof Error ? e.message : '정기 보고 요청을 완료하지 못했습니다.'); }
    finally { pending.current = false; if (active.current) { setWorking(false); onManaging(false); } }
  };
  const update = async (operation: () => Promise<AiReportOverview>, message: string) => {
    const next = await operation();
    if (active.current) { setData(next); setNotice(message); setReview(false); setDeleteId(''); setEditing(null); }
  };
  const refresh = () => manage(async () => {
    const [reports, analyses] = await Promise.all([client.reports.list(), client.listSaved()]);
    if (active.current) { setData(reports); setSaved(analyses.items); setReview(false); setEditing(null); setNotice('목록을 새로고침했습니다.'); }
  });
  const selected = saved.find(item => item.id === savedId), locked = disabled || working;
  const automaticPaused = data.schedulerEnabled === false;
  const edit = (item: AiReportSchedule) => { setEditing(item); setSavedId(item.savedId); setCadence(item.cadence); setReview(false); setNotice('현재 저장 조건과 시간을 확인한 뒤 예약을 저장해 주세요.'); };
  return <div className="ai-workspace__schedule-panel">
    <h2>정기 보고 <small>{data.schedules.length}/{AI_SCHEDULE_LIMIT}</small></h2>
    <p className="ai-workspace__note">한국 시간으로 예약합니다. 실행 시 생성한 결과를 {AI_REPORT_RETENTION_DAYS}일간 보관하며 같은 결과로 PDF·엑셀을 만듭니다. 외부로 발송하지 않습니다.</p>
    <p className="ai-workspace__note">약 5분 간격으로 예약을 확인하므로 지정 시각보다 늦게 실행될 수 있습니다. 권한이나 저장 조건이 바뀌면 예약이 중지됩니다.</p>
    <p className="ai-workspace__note">월 자동 변경은 예정 시각 기준입니다. 밀린 회차는 한 번 실행한 뒤 다음 일정으로 넘어갑니다.</p>
    {automaticPaused && <p className="ai-workspace__note">관리자가 정기 보고 실행을 중지했습니다. 기존 보고서 받기와 예약 중지·삭제는 계속 사용할 수 있습니다.</p>}
    <button type="button" disabled={locked} onClick={() => void refresh()}>정기 보고 새로고침</button>
    {working && <p>정기 보고를 처리하고 있습니다.</p>}
    {error && <p role="alert" className="ai-workspace__error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <ul className="ai-workspace__saved-list">{data.schedules.map(item => <li key={item.id}>
      <h3>{item.name}</h3><p>{cadenceLabel(item.cadence)}</p><p>{item.enabled ? '예약 중' : '중지됨'}{item.nextRunAt && ` · 다음 확인 ${kst(item.nextRunAt)}`}</p>
      {item.lastMessage && <p className="ai-workspace__note">{item.lastMessage}</p>}
      <div className="ai-workspace__actions">
        <button disabled={locked} onClick={() => edit(item)} aria-label={`${item.name} 예약 수정`}>{item.enabled ? '예약 수정' : '확인 후 다시 예약'}</button>
        {item.enabled && <button disabled={locked} onClick={() => void manage(() => update(() => client.reports.pause(item.id, item.revision), '예약을 중지했습니다.'))} aria-label={`${item.name} 예약 중지`}>중지</button>}
        <button disabled={locked} onClick={() => setDeleteId(item.id)} aria-label={`${item.name} 예약 삭제`}>예약 삭제</button>
      </div>
      {deleteId === item.id && <div><p>이 예약을 삭제할까요? 이미 생성한 보고서는 보관 기한까지 남습니다.</p>
        <button disabled={locked} onClick={() => void manage(() => update(() => client.reports.delete(item.id, item.revision), '예약을 삭제했습니다.'))}>예약 삭제 확인</button>
        <button disabled={locked} onClick={() => setDeleteId('')}>삭제 취소</button></div>}
    </li>)}</ul>
    {!data.schedules.length && !working && <p>등록한 정기 보고가 없습니다.</p>}
    <form className="ai-workspace__save-form" onSubmit={event => { event.preventDefault(); setReview(true); }}>
      <h3>{editing ? '예약 수정·재개' : '새 예약'}</h3>
      <label htmlFor="ai-report-saved">보고할 저장 분석</label><select id="ai-report-saved" value={savedId} disabled={locked} required onChange={event => { setSavedId(event.target.value); setReview(false); }}>
        <option value="">저장 분석 선택</option>{saved.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {selected && <SavedAnalysisSummary item={selected} />}
      {!saved.length && !working && <p>먼저 분석한 결과의 조건을 저장해 주세요.</p>}
      <label htmlFor="ai-report-frequency">실행 주기</label><select id="ai-report-frequency" value={cadence.frequency} disabled={locked} onChange={event => {
        const frequency = event.target.value as AiReportCadence['frequency']; setCadence({ ...cadence, frequency, weekday: frequency === 'weekly' ? 1 : null, monthDay: frequency === 'monthly' ? 1 : null }); setReview(false);
      }}><option value="daily">매일</option><option value="weekly">매주</option><option value="monthly">매월</option></select>
      {cadence.frequency === 'weekly' && <><label htmlFor="ai-report-weekday">실행 요일</label><select id="ai-report-weekday" value={cadence.weekday!} disabled={locked} onChange={event => { setCadence({ ...cadence, weekday: Number(event.target.value) }); setReview(false); }}>{weekdays.map((day, index) => <option key={day} value={index + 1}>{day}요일</option>)}</select></>}
      {cadence.frequency === 'monthly' && <><label htmlFor="ai-report-monthday">실행 날짜 (1~28일)</label><input id="ai-report-monthday" type="number" min={1} max={28} required value={cadence.monthDay!} disabled={locked} onChange={event => { setCadence({ ...cadence, monthDay: Number(event.target.value) }); setReview(false); }} /></>}
      <label htmlFor="ai-report-time">실행 시간 (한국 시간)</label><input id="ai-report-time" type="time" required value={cadence.time} disabled={locked} onChange={event => { setCadence({ ...cadence, time: event.target.value }); setReview(false); }} />
      <button type="submit" disabled={locked || automaticPaused || !selected || (!editing && data.schedules.length >= AI_SCHEDULE_LIMIT)}>예약 내용 확인</button>
      {editing && <button type="button" disabled={locked} onClick={() => { setEditing(null); setReview(false); }}>수정 취소</button>}
      {review && selected && <div className="ai-workspace__conditions" aria-label="예약 내용 확인">
        <p>“{selected.name}” · {cadenceLabel(cadence)}</p><p>위 저장 조건과 현재 조회 권한으로 반복 실행합니다. 결과는 {AI_REPORT_RETENTION_DAYS}일 후 만료됩니다.</p>
        <button type="button" disabled={locked || automaticPaused} onClick={() => void manage(() => update(() => client.reports.save({ savedId: selected.id, savedRevision: selected.revision, cadence,
          ...(editing ? { id: editing.id, revision: editing.revision } : {}) }), '정기 보고를 예약했습니다.'))}>이 내용으로 예약 저장</button>
      </div>}
    </form>
    <h3>최근 실행 내역</h3><p className="ai-workspace__note">보관 기한 안의 최근 30건입니다. 파일은 생성 당시 결과로 만들며 원본을 다시 조회하지 않습니다.</p>
    {!data.runs.length && !working && <p>아직 생성한 정기 보고가 없습니다.</p>}
    <ul className="ai-workspace__saved-list">{data.runs.map(run => <li key={run.id}>
      <h4>{run.name}</h4><p>예정 {kst(run.dueAt)} · {({ running: '생성 중', complete: '완료', partial: '부분 결과', failed: '실패' })[run.status]}</p>
      <p>{run.message}</p><p className="ai-workspace__note">{run.attempts}회 시도 · 만료 {kst(run.expiresAt)}</p>
      <div className="ai-workspace__actions">
        {['complete', 'partial'].includes(run.status) && (['pdf', 'xlsx'] as const).map(format => <button key={format} disabled={locked} aria-label={`${run.name} ${format.toUpperCase()} 만들기`} onClick={() => void manage(async () => {
          const response = await client.reports.exportFile(run.id, format);
          if (!active.current) return;
          url.current = URL.createObjectURL(new Blob([Uint8Array.from(atob(response.base64), char => char.charCodeAt(0))], { type: response.contentType }));
          setFile({ url: url.current, name: response.fileName });
        })}>{format === 'pdf' ? 'PDF' : '엑셀'} 만들기</button>)}
        {run.status === 'failed' && run.retryable && <button disabled={locked || automaticPaused} aria-label={`${run.name} 실패한 보고 다시 시도`} onClick={() => void manage(() => update(() => client.reports.retry(run.id), '재시도 결과를 확인해 주세요.'))}>다시 시도</button>}
      </div>
    </li>)}</ul>
    {file && <p><a href={file.url} download={file.name}>정기 보고 파일 다운로드</a></p>}
  </div>;
}
