import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileClock,
  FilePlus2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ConstructionPlan } from '../types';
import { listConstructionPlansServer } from '../services/constructionPlanWorkflowApi';
import {
  CONSTRUCTION_PLAN_RECORD_TYPES,
  CONSTRUCTION_PLAN_RECORD_TYPE_LABELS,
  createConstructionPlanRecord,
  createConstructionPlanRecordIdempotencyKey,
  getConstructionPlanRecordErrorMessage,
  listConstructionPlanRecords,
  type ConstructionPlanRecord,
  type ConstructionPlanRecordStatus,
  type ConstructionPlanRecordType,
} from '../services/constructionPlanRecordService';
import '../components/ConstructionPlanUI.css';
import './ConstructionPlanRecordPages.css';

type StatusFilter = 'all' | ConstructionPlanRecordStatus;

const STATUS_LABELS: Record<ConstructionPlanRecordStatus, string> = {
  draft: '작성 전',
  incomplete: '작성 중',
  confirmed: '확인 완료',
};

const today = (): string => new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul',
}).format(new Date());

const formatDateTime = (value: string): string => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

export function ConstructionPlanRecordListPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<ConstructionPlanRecord[]>([]);
  const [plans, setPlans] = useState<ConstructionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [siteId, setSiteId] = useState('all');
  const [planId, setPlanId] = useState('all');
  const [recordType, setRecordType] = useState<'all' | ConstructionPlanRecordType>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [draft, setDraft] = useState({
    planId: '', recordType: 'installation_inspection' as ConstructionPlanRecordType,
    workDate: today(), building: '', floor: '', zone: '', designatedConfirmerId: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [nextRecords, nextPlans] = await Promise.all([
        listConstructionPlanRecords({ limit: 200 }),
        listConstructionPlansServer({}),
      ]);
      setRecords(nextRecords);
      setPlans(nextPlans);
    } catch (error) {
      setLoadError(getConstructionPlanRecordErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const issuedPlans = useMemo(() => plans.filter((plan) => plan.status === 'issued'), [plans]);
  const planMap = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);
  const sites = useMemo(() => Array.from(new Map(plans.map((plan) => [
    plan.siteId,
    plan.projectSnapshot.siteName,
  ])).entries()).sort((left, right) => left[1].localeCompare(right[1], 'ko-KR')), [plans]);

  const filtered = useMemo(() => records.filter((record) => {
    const plan = planMap.get(record.planId);
    const searchText = [
      record.planBinding.siteName, record.planBinding.documentNo,
      CONSTRUCTION_PLAN_RECORD_TYPE_LABELS[record.recordType], record.building, record.floor, record.zone,
    ].join(' ').toLocaleLowerCase('ko-KR');
    return (!query.trim() || searchText.includes(query.trim().toLocaleLowerCase('ko-KR')))
      && (siteId === 'all' || record.siteId === siteId)
      && (planId === 'all' || record.planId === planId)
      && (recordType === 'all' || record.recordType === recordType)
      && (status === 'all' || record.status === status)
      && (!dateFrom || record.workDate >= dateFrom)
      && (!dateTo || record.workDate <= dateTo)
      && Boolean(plan);
  }), [dateFrom, dateTo, planId, planMap, query, recordType, records, siteId, status]);

  const resetFilters = () => {
    setQuery(''); setSiteId('all'); setPlanId('all'); setRecordType('all'); setStatus('all'); setDateFrom(''); setDateTo('');
  };
  const hasFilters = Boolean(query || siteId !== 'all' || planId !== 'all' || recordType !== 'all' || status !== 'all' || dateFrom || dateTo);

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    setCreateBusy(true);
    try {
      const record = await createConstructionPlanRecord({
        planId: draft.planId,
        recordType: draft.recordType,
        workDate: draft.workDate,
        building: draft.building.trim(),
        floor: draft.floor.trim(),
        zone: draft.zone.trim(),
        ...(draft.designatedConfirmerId.trim() ? { designatedConfirmerId: draft.designatedConfirmerId.trim() } : {}),
        idempotencyKey: createConstructionPlanRecordIdempotencyKey('create'),
      });
      navigate(`/construction-plan-records/${record.id}`);
    } catch (error) {
      setCreateError(getConstructionPlanRecordErrorMessage(error));
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="cp-record-shell">
      <header className="cp-record-hero">
        <div>
          <span className="cp-record-eyebrow"><ShieldCheck size={15} /> FIELD EXECUTION CONTROL</span>
          <h1>현장 실행기록</h1>
          <p>발행 시공계획서에 실제 점검·조치·사진 증적을 별도 불변 기록으로 연결합니다.</p>
        </div>
        <button className="cp-record-primary" type="button" onClick={() => {
          const first = issuedPlans[0];
          setDraft((current) => ({ ...current, planId: current.planId || first?.id || '' }));
          setShowCreate(true);
        }} disabled={!issuedPlans.length}>
          <FilePlus2 size={17} /> 새 실행기록
        </button>
      </header>

      <section className="cp-record-metrics" aria-label="실행기록 상태 요약">
        <article><ClipboardCheck /><span>전체 기록</span><strong>{records.length}</strong></article>
        <article><FileClock /><span>작성 중</span><strong>{records.filter((item) => item.status !== 'confirmed').length}</strong></article>
        <article><CheckCircle2 /><span>확인 완료</span><strong>{records.filter((item) => item.status === 'confirmed').length}</strong></article>
        <article><Building2 /><span>발행 계획서</span><strong>{issuedPlans.length}</strong></article>
      </section>

      <section className="cp-record-filter-card">
        <div className="cp-record-search"><Search size={17} /><input aria-label="실행기록 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="현장·문서번호·동·층·구간 검색" /></div>
        <label><span>현장</span><select value={siteId} onChange={(event) => setSiteId(event.target.value)}><option value="all">전체 현장</option>{sites.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label><span>계획서</span><select value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="all">전체 계획서</option>{plans.filter((plan) => siteId === 'all' || plan.siteId === siteId).map((plan) => <option key={plan.id} value={plan.id}>{plan.documentNo}</option>)}</select></label>
        <label><span>기록 유형</span><select value={recordType} onChange={(event) => setRecordType(event.target.value as typeof recordType)}><option value="all">전체 유형</option>{CONSTRUCTION_PLAN_RECORD_TYPES.map((type) => <option key={type} value={type}>{CONSTRUCTION_PLAN_RECORD_TYPE_LABELS[type]}</option>)}</select></label>
        <label><span>상태</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">전체 상태</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>시작일</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label><span>종료일</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        {hasFilters && <button className="cp-record-ghost" type="button" onClick={resetFilters}><X size={15} /> 초기화</button>}
      </section>

      {loading ? (
        <div className="cp-record-state"><Loader2 className="cp-record-spin" /><strong>현장 실행기록을 불러오는 중입니다.</strong></div>
      ) : loadError ? (
        <div className="cp-record-state cp-record-state--error"><AlertCircle /><strong>{loadError}</strong><button type="button" onClick={() => void load()}><RefreshCw size={15} /> 다시 시도</button></div>
      ) : !filtered.length ? (
        <div className="cp-record-state"><Filter /><strong>{hasFilters ? '조건에 맞는 실행기록이 없습니다.' : '아직 등록된 실행기록이 없습니다.'}</strong><p>발행 계획서를 선택하면 서버 표준 문항으로 첫 기록을 만들 수 있습니다.</p></div>
      ) : (
        <section className="cp-record-list" aria-label="현장 실행기록 목록">
          {filtered.map((record) => (
            <button key={record.id} type="button" className="cp-record-row" onClick={() => navigate(`/construction-plan-records/${record.id}`)}>
              <div className="cp-record-row__date"><CalendarDays size={18} /><strong>{record.workDate.slice(5)}</strong><span>{record.workDate.slice(0, 4)}</span></div>
              <div className="cp-record-row__main">
                <div><span className={`cp-record-status cp-record-status--${record.status}`}>{STATUS_LABELS[record.status]}</span><span className="cp-record-rev">Record R{String(record.recordRevision).padStart(2, '0')}</span></div>
                <h2>{CONSTRUCTION_PLAN_RECORD_TYPE_LABELS[record.recordType]}</h2>
                <p>{record.planBinding.siteName} · {record.building} {record.floor} · {record.zone}</p>
              </div>
              <div className="cp-record-row__meta"><strong>{record.planBinding.documentNo}</strong><span>Plan REV.{String(record.planBinding.revision).padStart(2, '0')}</span><span>{formatDateTime(record.updatedAt)}</span></div>
              <ChevronRight size={20} />
            </button>
          ))}
        </section>
      )}

      {showCreate && (
        <div className="cp-record-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !createBusy) setShowCreate(false); }}>
          <form className="cp-record-modal__panel" onSubmit={submitCreate}>
            <header><div><span>ISSUED PLAN BINDING</span><h2>새 현장 실행기록</h2></div><button type="button" aria-label="닫기" onClick={() => setShowCreate(false)} disabled={createBusy}><X /></button></header>
            {!issuedPlans.length ? <div className="cp-record-inline-error"><AlertCircle />현재 사용 가능한 issued 계획서가 없습니다.</div> : <>
              <label><span>발행 계획서</span><select required value={draft.planId} onChange={(event) => setDraft({ ...draft, planId: event.target.value })}><option value="">계획서를 선택하세요</option>{issuedPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.projectSnapshot.siteName} · {plan.documentNo} · REV.{String(plan.revision).padStart(2, '0')}</option>)}</select></label>
              <label><span>기록 유형</span><select required value={draft.recordType} onChange={(event) => setDraft({ ...draft, recordType: event.target.value as ConstructionPlanRecordType })}>{CONSTRUCTION_PLAN_RECORD_TYPES.map((type) => <option key={type} value={type}>{CONSTRUCTION_PLAN_RECORD_TYPE_LABELS[type]}</option>)}</select></label>
              <div className="cp-record-form-grid"><label><span>실행일</span><input required type="date" value={draft.workDate} onChange={(event) => setDraft({ ...draft, workDate: event.target.value })} /></label><label><span>동</span><input required value={draft.building} onChange={(event) => setDraft({ ...draft, building: event.target.value })} placeholder="101동" /></label><label><span>층</span><input required value={draft.floor} onChange={(event) => setDraft({ ...draft, floor: event.target.value })} placeholder="지상 3층" /></label><label><span>구간</span><input required value={draft.zone} onChange={(event) => setDraft({ ...draft, zone: event.target.value })} placeholder="A-1 설치구간" /></label></div>
              <div className="cp-record-modal-note"><strong>확인자 지정</strong><span>기록 생성 후 서버가 제공하는 계획서 검토·승인 후보에서 이름으로 선택합니다.</span></div>
            </>}
            {createError && <div className="cp-record-inline-error"><AlertCircle />{createError}</div>}
            <footer><button type="button" className="cp-record-ghost" onClick={() => setShowCreate(false)} disabled={createBusy}>취소</button><button type="submit" className="cp-record-primary" disabled={createBusy || !issuedPlans.length}>{createBusy ? <Loader2 className="cp-record-spin" /> : <FilePlus2 />}서버 문항으로 생성</button></footer>
          </form>
        </div>
      )}
    </div>
  );
}

export default ConstructionPlanRecordListPage;
