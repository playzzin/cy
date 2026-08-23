import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileCheck2,
  HardHat,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Truck,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react';
import {
  CONSTRUCTION_PLAN_RECORD_TYPE_LABELS,
  confirmConstructionPlanRecord,
  createConstructionPlanRecordCorrection,
  createConstructionPlanRecordIdempotencyKey,
  downloadConstructionPlanRecordAppendixPdf,
  downloadConstructionPlanRecordPhoto,
  generateConstructionPlanRecordAppendixPdf,
  getConstructionPlanRecord,
  getConstructionPlanRecordErrorMessage,
  updateConstructionPlanRecord,
  type ConstructionPlanRecord,
  type ConstructionPlanRecordAction,
  type ConstructionPlanRecordQuestion,
  type ConstructionPlanRecordResponse,
} from '../services/constructionPlanRecordService';
import {
  createConstructionPlanRecordPhotoUploadOperation,
  getConstructionPlanRecordPhotoUploadErrorMessage,
  type ConstructionPlanRecordPhotoUploadCancelHandle,
  type ConstructionPlanRecordPhotoUploadProgress,
} from '../services/constructionPlanRecordPhotoUploadService';
import '../components/ConstructionPlanUI.css';
import './ConstructionPlanRecordPages.css';

type EditableRecord = Pick<ConstructionPlanRecord,
  'workDate' | 'building' | 'floor' | 'zone' | 'actualWorkers' | 'actualEquipment' | 'responses'> & {
    designatedConfirmerId: string;
  };

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type ActionDraft = Partial<ConstructionPlanRecordAction>;

const recordToEditable = (record: ConstructionPlanRecord): EditableRecord => ({
  workDate: record.workDate,
  building: record.building,
  floor: record.floor,
  zone: record.zone,
  actualWorkers: record.actualWorkers,
  actualEquipment: record.actualEquipment,
  responses: record.responses,
  designatedConfirmerId: record.designatedConfirmerId || '',
});

const statusLabel = (record: ConstructionPlanRecord): string => (
  record.status === 'confirmed' ? '확인 완료' : record.status === 'incomplete' ? '작성 중' : '작성 전'
);

const localDateTimeValue = (): string => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const confirmationIssues = (record: ConstructionPlanRecord, draft: EditableRecord): string[] => {
  const issues: string[] = [];
  if (![draft.workDate, draft.building, draft.floor, draft.zone].every((value) => value.trim())) issues.push('동·층·구간·실행일을 모두 입력하세요.');
  if (!draft.actualWorkers.some((worker) => worker.name.trim())) issues.push('실제 작업자를 1명 이상 입력하세요.');
  if (record.recordType === 'equipment_daily_inspection' && !draft.actualEquipment.some((item) => item.name.trim())) issues.push('실제 점검 장비를 1대 이상 입력하세요.');
  const responseMap = new Map(draft.responses.map((response) => [response.questionId, response]));
  record.questions.forEach((question) => {
    const response = responseMap.get(question.id);
    if (!response?.result) issues.push(`[${question.category}] 판정이 필요합니다.`);
    if (response?.result === 'not_applicable' && (!question.allowNotApplicable || !response.note?.trim())) issues.push(`[${question.category}] 해당없음 사유가 필요합니다.`);
    if (response?.result === 'fail' && (!response.note?.trim() || !response.action)) issues.push(`[${question.category}] 부적합 사유·조치·담당·기한이 필요합니다.`);
  });
  if (record.recordType === 'photo_sheet' && !record.photos.length) issues.push('사진대지에는 현장사진이 1장 이상 필요합니다.');
  return Array.from(new Set(issues));
};

export function ConstructionPlanRecordDetailPage() {
  const { recordId = '' } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<ConstructionPlanRecord>();
  const [draft, setDraft] = useState<EditableRecord>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [expandedQuestion, setExpandedQuestion] = useState<string>();
  const [actionDrafts, setActionDrafts] = useState<Record<string, ActionDraft>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [photoForm, setPhotoForm] = useState({ caption: '', takenAt: localDateTimeValue(), zone: '', file: undefined as File | undefined });
  const [photoProgress, setPhotoProgress] = useState<ConstructionPlanRecordPhotoUploadProgress>();
  const [photoError, setPhotoError] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionBusy, setCorrectionBusy] = useState(false);

  const recordRef = useRef<ConstructionPlanRecord>();
  const draftRef = useRef<EditableRecord>();
  const dirtyRef = useRef(false);
  const editSequenceRef = useRef(0);
  const savePromiseRef = useRef<Promise<ConstructionPlanRecord | undefined>>();
  const pendingSaveRef = useRef<{
    sequence: number;
    input: Parameters<typeof updateConstructionPlanRecord>[0];
  }>();
  const photoCancelRef = useRef<ConstructionPlanRecordPhotoUploadCancelHandle>();
  const confirmKeyRef = useRef('');
  const pdfKeyRef = useRef('');
  const correctionKeyRef = useRef('');

  const applyRecord = useCallback((next: ConstructionPlanRecord, resetDraft = true) => {
    recordRef.current = next;
    setRecord(next);
    if (resetDraft) {
      const editable = recordToEditable(next);
      draftRef.current = editable;
      setDraft(editable);
      setActionDrafts(Object.fromEntries(next.responses.filter((response) => response.action).map((response) => [response.questionId, response.action || {}])));
      dirtyRef.current = false;
      pendingSaveRef.current = undefined;
      setSaveState('idle');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const next = await getConstructionPlanRecord(recordId);
      applyRecord(next);
      setPhotoForm((current) => ({ ...current, zone: next.zone }));
    } catch (error) {
      setLoadError(getConstructionPlanRecordErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [applyRecord, recordId]);

  useEffect(() => { void load(); }, [load]);

  const updateDraft = useCallback((updater: (current: EditableRecord) => EditableRecord) => {
    const current = draftRef.current;
    if (!current || recordRef.current?.status === 'confirmed') return;
    const next = updater(current);
    draftRef.current = next;
    setDraft(next);
    dirtyRef.current = true;
    editSequenceRef.current += 1;
    setSaveState('dirty');
    setSaveError('');
  }, []);

  const saveNow = useCallback(async (): Promise<ConstructionPlanRecord | undefined> => {
    if (savePromiseRef.current) return savePromiseRef.current;
    const currentRecord = recordRef.current;
    const currentDraft = draftRef.current;
    if (!currentRecord || !currentDraft || currentRecord.status === 'confirmed') return currentRecord;
    if (!dirtyRef.current) return currentRecord;
    let pending = pendingSaveRef.current;
    if (!pending) {
      const sequence = editSequenceRef.current;
      pending = {
        sequence,
        input: {
          recordId: currentRecord.id,
          expectedVersion: currentRecord.version,
          workDate: currentDraft.workDate,
          building: currentDraft.building.trim(),
          floor: currentDraft.floor.trim(),
          zone: currentDraft.zone.trim(),
          actualWorkers: currentDraft.actualWorkers.filter((worker) => worker.name.trim()).map((worker) => ({
            ...(worker.workerId?.trim() ? { workerId: worker.workerId.trim() } : {}),
            name: worker.name.trim(),
            ...(worker.role?.trim() ? { role: worker.role.trim() } : {}),
          })),
          actualEquipment: currentDraft.actualEquipment.filter((item) => item.name.trim()).map((item) => ({
            ...(item.equipmentId?.trim() ? { equipmentId: item.equipmentId.trim() } : {}),
            name: item.name.trim(),
            ...(item.model?.trim() ? { model: item.model.trim() } : {}),
            ...(item.registrationNo?.trim() ? { registrationNo: item.registrationNo.trim() } : {}),
            ...(item.operatorName?.trim() ? { operatorName: item.operatorName.trim() } : {}),
          })),
          responses: currentDraft.responses.map((response) => ({
            questionId: response.questionId,
            ...(response.result ? { result: response.result } : {}),
            ...(response.note?.trim() ? { note: response.note.trim() } : {}),
            ...(response.measuredValue?.trim() ? { measuredValue: response.measuredValue.trim() } : {}),
            ...(response.action ? { action: response.action } : {}),
          })),
          ...(currentDraft.designatedConfirmerId.trim() ? { designatedConfirmerId: currentDraft.designatedConfirmerId.trim() } : {}),
          idempotencyKey: createConstructionPlanRecordIdempotencyKey('autosave'),
        },
      };
      pendingSaveRef.current = pending;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setSaveState('error');
      setSaveError('오프라인입니다. 입력 내용과 동일 요청키를 유지하며 연결 복구 후 자동으로 다시 저장합니다.');
      return undefined;
    }
    setSaveState('saving');
    setSaveError('');
    const operation = updateConstructionPlanRecord(pending.input).then((next) => {
      pendingSaveRef.current = undefined;
      recordRef.current = next;
      setRecord(next);
      if (pending?.sequence === editSequenceRef.current) {
        const editable = recordToEditable(next);
        draftRef.current = editable;
        setDraft(editable);
        dirtyRef.current = false;
        setSaveState('saved');
      } else {
        dirtyRef.current = true;
        setSaveState('dirty');
      }
      return next;
    }).catch((error) => {
      setSaveState('error');
      setSaveError(getConstructionPlanRecordErrorMessage(error));
      return undefined;
    }).finally(() => { savePromiseRef.current = undefined; });
    savePromiseRef.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    if (saveState !== 'dirty' || record?.status === 'confirmed') return undefined;
    const timer = window.setTimeout(() => { void saveNow(); }, 900);
    return () => window.clearTimeout(timer);
  }, [draft, record?.status, record?.version, saveNow, saveState]);

  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setIsOnline(true);
      if (dirtyRef.current || pendingSaveRef.current) void saveNow();
    };
    const flushDirty = () => {
      if ((dirtyRef.current || pendingSaveRef.current) && navigator.onLine) void saveNow();
    };
    const warnDirty = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !pendingSaveRef.current) return;
      flushDirty();
      event.preventDefault();
      event.returnValue = '';
    };
    const handleVisibility = () => { if (document.visibilityState === 'hidden') flushDirty(); };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('pagehide', flushDirty);
    window.addEventListener('beforeunload', warnDirty);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pagehide', flushDirty);
      window.removeEventListener('beforeunload', warnDirty);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveNow]);

  useEffect(() => {
    let cancelled = false;
    const urls: Record<string, string> = {};
    if (!record?.photos.length) { setPhotoUrls({}); return undefined; }
    void Promise.all(record.photos.map(async (photo) => {
      try {
        const blob = await downloadConstructionPlanRecordPhoto(record, photo);
        if (!cancelled) urls[photo.id] = URL.createObjectURL(blob);
      } catch { /* individual integrity/download failure remains visible as an empty evidence tile */ }
    })).then(() => { if (!cancelled) setPhotoUrls(urls); });
    return () => {
      cancelled = true;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [record]);

  const patchResponse = (questionId: string, patch: Partial<ConstructionPlanRecordResponse>) => {
    updateDraft((current) => {
      const prior = current.responses.find((response) => response.questionId === questionId) || { questionId };
      const next = { ...prior, ...patch };
      Object.entries(next).forEach(([key, value]) => { if (value === undefined) delete (next as Record<string, unknown>)[key]; });
      return { ...current, responses: [...current.responses.filter((response) => response.questionId !== questionId), next] };
    });
  };

  const updateAction = (questionId: string, patch: ActionDraft) => {
    const next = { ...(actionDrafts[questionId] || {}), ...patch };
    setActionDrafts((current) => ({ ...current, [questionId]: next }));
    const complete = Boolean(next.description?.trim() && next.owner?.trim() && next.due
      && next.status && (next.status !== 'resolved' || next.resolution?.trim()));
    patchResponse(questionId, { action: complete ? next as ConstructionPlanRecordAction : undefined });
  };

  const issues = useMemo(() => record && draft ? confirmationIssues(record, draft) : [], [draft, record]);

  const uploadPhoto = async () => {
    if (!record || !draft || !photoForm.file) return;
    setPhotoError('');
    const latest = await saveNow();
    if (!latest) { setPhotoError('저장 오류를 해결한 뒤 사진을 등록하세요.'); return; }
    const operation = createConstructionPlanRecordPhotoUploadOperation({
      record: latest,
      file: photoForm.file,
      caption: photoForm.caption,
      takenAt: new Date(photoForm.takenAt).toISOString(),
      zone: photoForm.zone,
      onProgress: setPhotoProgress,
    });
    photoCancelRef.current = operation.cancelHandle;
    try {
      const result = await operation.result;
      applyRecord(result.record);
      setPhotoForm({ caption: '', takenAt: localDateTimeValue(), zone: result.record.zone, file: undefined });
    } catch (error) {
      setPhotoError(getConstructionPlanRecordPhotoUploadErrorMessage(error));
    } finally {
      setPhotoProgress(undefined);
      photoCancelRef.current = undefined;
    }
  };

  const confirm = async () => {
    setConfirmError('');
    const latest = await saveNow();
    if (!latest) { setConfirmError('자동저장 오류를 먼저 해결하세요.'); return; }
    const latestIssues = confirmationIssues(latest, recordToEditable(latest));
    if (latestIssues.length) { setConfirmError(latestIssues[0]); return; }
    setConfirmBusy(true);
    confirmKeyRef.current ||= createConstructionPlanRecordIdempotencyKey('confirm');
    try {
      const confirmed = await confirmConstructionPlanRecord({ recordId: latest.id, expectedVersion: latest.version, idempotencyKey: confirmKeyRef.current });
      applyRecord(confirmed);
      confirmKeyRef.current = '';
    } catch (error) {
      setConfirmError(getConstructionPlanRecordErrorMessage(error));
    } finally { setConfirmBusy(false); }
  };

  const downloadAppendix = async () => {
    if (!record) return;
    setPdfBusy(true); setPdfError('');
    pdfKeyRef.current ||= createConstructionPlanRecordIdempotencyKey('appendix');
    try {
      const artifact = await generateConstructionPlanRecordAppendixPdf({ recordId: record.id, idempotencyKey: pdfKeyRef.current });
      const blob = await downloadConstructionPlanRecordAppendixPdf(artifact);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = artifact.fileName; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      pdfKeyRef.current = '';
    } catch (error) {
      setPdfError(getConstructionPlanRecordErrorMessage(error));
    } finally { setPdfBusy(false); }
  };

  const createCorrection = async () => {
    if (!record) return;
    setCorrectionBusy(true); setConfirmError('');
    correctionKeyRef.current ||= createConstructionPlanRecordIdempotencyKey('correction');
    try {
      const corrected = await createConstructionPlanRecordCorrection({
        sourceRecordId: record.id, reason: correctionReason.trim(), idempotencyKey: correctionKeyRef.current,
      });
      correctionKeyRef.current = '';
      navigate(`/construction-plan-records/${corrected.id}`);
    } catch (error) {
      setConfirmError(getConstructionPlanRecordErrorMessage(error));
    } finally { setCorrectionBusy(false); }
  };

  if (loading) return <div className="cp-record-state cp-record-state--page"><Loader2 className="cp-record-spin" /><strong>실행기록을 불러오는 중입니다.</strong></div>;
  if (loadError || !record || !draft) return <div className="cp-record-state cp-record-state--page cp-record-state--error"><AlertCircle /><strong>{loadError || '실행기록을 찾을 수 없습니다.'}</strong><button type="button" onClick={() => void load()}><RefreshCw size={15} /> 다시 시도</button></div>;

  const readOnly = record.status === 'confirmed';
  const responseMap = new Map(draft.responses.map((response) => [response.questionId, response]));
  const availableWorkerCandidates = record.resourceCandidates.workers.filter((candidate) => (
    !draft.actualWorkers.some((worker) => worker.workerId === candidate.workerId)
  ));
  const availableEquipmentCandidates = record.resourceCandidates.equipment.filter((candidate) => (
    !draft.actualEquipment.some((item) => item.equipmentId === candidate.equipmentId)
  ));

  return (
    <div className="cp-record-shell cp-record-shell--detail">
      <nav className="cp-record-detail-nav"><button type="button" onClick={() => navigate('/construction-plan-records')}><ArrowLeft size={17} /> 실행기록 목록</button><div className={`cp-record-save cp-record-save--${saveState}`}>{saveState === 'saving' ? <Loader2 className="cp-record-spin" /> : saveState === 'error' ? <AlertCircle /> : saveState === 'saved' ? <Check /> : <Save />}<span>{saveState === 'dirty' ? '저장 대기' : saveState === 'saving' ? '자동 저장 중' : saveState === 'saved' ? '저장됨' : saveState === 'error' ? '저장 실패' : readOnly ? '불변 기록' : '변경 없음'}</span>{saveState === 'error' && <button type="button" onClick={() => void saveNow()}>재시도</button>}</div></nav>

      <header className="cp-record-detail-hero">
        <div><span className={`cp-record-status cp-record-status--${record.status}`}>{statusLabel(record)}</span><span className="cp-record-rev">Record R{String(record.recordRevision).padStart(2, '0')}</span><h1>{CONSTRUCTION_PLAN_RECORD_TYPE_LABELS[record.recordType]}</h1><p>{record.planBinding.siteName} · {record.planBinding.documentNo} · Plan REV.{String(record.planBinding.revision).padStart(2, '0')}</p></div>
        <div className="cp-record-binding"><span>ISSUED SHA-256</span><code>{record.planBinding.issuedExportSha256.slice(0, 16)}…{record.planBinding.issuedExportSha256.slice(-8)}</code><small>{record.planBinding.templateId}@{record.planBinding.templateVersion}</small></div>
      </header>

      {saveError && <div className="cp-record-inline-error"><AlertCircle />{saveError}</div>}
      {!isOnline && <div className="cp-record-offline"><AlertCircle /><div><strong>오프라인 작성 중</strong><span>현재 입력은 이 화면에 유지됩니다. 연결되면 동결된 동일 요청과 idempotency key로 자동 재시도합니다.</span></div></div>}
      {record.supersedesRecordId && <div className="cp-record-lineage"><RotateCcw /><div><strong>정정 기록 R{String(record.recordRevision).padStart(2, '0')}</strong><span>{record.correctionReason}</span>{record.correctionLineage && <small>{record.correctionLineage.actorName || record.correctionLineage.actorId} · {new Date(record.correctionLineage.createdAt).toLocaleString('ko-KR')} · 원본 SHA {record.correctionLineage.sourceConfirmationHash.slice(0, 12)}…</small>}</div><button type="button" onClick={() => navigate(`/construction-plan-records/${record.supersedesRecordId}`)}>원 기록 보기</button></div>}

      <main className="cp-record-detail-grid">
        <div className="cp-record-detail-main">
          <section className="cp-record-section">
            <header><div><span>01</span><h2>실행 범위</h2></div><p>실제 작업 일자와 동·층·구간을 특정합니다.</p></header>
            <div className="cp-record-form-grid cp-record-form-grid--scope">
              <label><span>실행일</span><input disabled={readOnly} type="date" value={draft.workDate} onChange={(event) => updateDraft((current) => ({ ...current, workDate: event.target.value }))} /></label>
              <label><span>동</span><input disabled={readOnly} value={draft.building} onChange={(event) => updateDraft((current) => ({ ...current, building: event.target.value }))} /></label>
              <label><span>층</span><input disabled={readOnly} value={draft.floor} onChange={(event) => updateDraft((current) => ({ ...current, floor: event.target.value }))} /></label>
              <label><span>구간</span><input disabled={readOnly} value={draft.zone} onChange={(event) => updateDraft((current) => ({ ...current, zone: event.target.value }))} /></label>
              <label className="cp-record-span-2"><span>지정 확인자 <small>선택</small></span><select disabled={readOnly} value={draft.designatedConfirmerId} onChange={(event) => updateDraft((current) => ({ ...current, designatedConfirmerId: event.target.value }))}><option value="">계획서 검토·승인 권한자 자동 허용</option>{record.resourceCandidates.confirmers.map((candidate) => <option key={candidate.uid} value={candidate.uid}>{candidate.name} · {candidate.role === 'approver' ? '승인자' : candidate.role === 'reviewer' ? '검토자' : '작성자'}</option>)}</select></label>
            </div>
          </section>

          <section className="cp-record-section">
            <header><div><span>02</span><h2>실제 투입 인원·장비</h2></div><p>계획 인원이 아니라 당일 실제 참여 정보를 기록합니다.</p></header>
            {!readOnly && <div className="cp-record-resource-pickers">
              <label><span>ERP/계획 스냅샷 작업자</span><select aria-label="ERP/계획 스냅샷 작업자 선택" value="" disabled={!availableWorkerCandidates.length} onChange={(event) => {
                const candidate = record.resourceCandidates.workers.find((item) => item.workerId === event.target.value);
                if (candidate) updateDraft((current) => ({ ...current, actualWorkers: [...current.actualWorkers, { ...candidate }] }));
              }}><option value="">{availableWorkerCandidates.length ? '작업자 선택' : '추가 가능한 작업자 없음'}</option>{availableWorkerCandidates.map((candidate) => <option key={candidate.workerId} value={candidate.workerId}>{candidate.name}{candidate.role ? ` · ${candidate.role}` : ''}</option>)}</select></label>
              <label><span>계획 장비</span><select aria-label="계획 장비 선택" value="" disabled={!availableEquipmentCandidates.length} onChange={(event) => {
                const candidate = record.resourceCandidates.equipment.find((item) => item.equipmentId === event.target.value);
                if (candidate) updateDraft((current) => ({ ...current, actualEquipment: [...current.actualEquipment, {
                  equipmentId: candidate.equipmentId, name: candidate.name, model: candidate.model,
                  registrationNo: candidate.registrationNo, operatorName: candidate.operatorName,
                }] }));
              }}><option value="">{availableEquipmentCandidates.length ? '장비 선택' : '추가 가능한 장비 없음'}</option>{availableEquipmentCandidates.map((candidate) => <option key={candidate.equipmentId} value={candidate.equipmentId}>{candidate.name}{candidate.registrationNo ? ` · ${candidate.registrationNo}` : ''}</option>)}</select></label>
            </div>}
            <div className="cp-record-subheading"><UserRound size={16} /><strong>작업자</strong>{!readOnly && <button type="button" onClick={() => updateDraft((current) => ({ ...current, actualWorkers: [...current.actualWorkers, { name: '', role: '' }] }))}><Plus size={14} /> 추가</button>}</div>
            {!draft.actualWorkers.length && <p className="cp-record-empty-line">등록된 실제 작업자가 없습니다.</p>}
            {draft.actualWorkers.map((worker, index) => <div className="cp-record-resource-row" key={`${worker.workerId || 'new'}-${index}`}><div className="cp-record-resource-identity"><input disabled={readOnly || Boolean(worker.workerId)} aria-label={`작업자 ${index + 1} 이름`} value={worker.name} placeholder="이름" onChange={(event) => updateDraft((current) => ({ ...current, actualWorkers: current.actualWorkers.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} />{worker.workerId && <small>ERP/계획 ID {worker.workerId}</small>}</div><input disabled={readOnly} value={worker.role || ''} placeholder="역할" onChange={(event) => updateDraft((current) => ({ ...current, actualWorkers: current.actualWorkers.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) }))} />{!readOnly && <button type="button" aria-label="작업자 삭제" onClick={() => updateDraft((current) => ({ ...current, actualWorkers: current.actualWorkers.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={15} /></button>}</div>)}
            <div className="cp-record-subheading"><Truck size={16} /><strong>장비</strong>{!readOnly && <button type="button" onClick={() => updateDraft((current) => ({ ...current, actualEquipment: [...current.actualEquipment, { name: '', model: '', registrationNo: '', operatorName: '' }] }))}><Plus size={14} /> 추가</button>}</div>
            {!draft.actualEquipment.length && <p className="cp-record-empty-line">해당 장비가 없으면 비워둘 수 있습니다.</p>}
            {draft.actualEquipment.map((equipment, index) => <div className="cp-record-resource-row cp-record-resource-row--equipment" key={`${equipment.equipmentId || equipment.registrationNo || 'new'}-${index}`}><div className="cp-record-resource-identity"><input disabled={readOnly || Boolean(equipment.equipmentId)} value={equipment.name} placeholder="장비명" onChange={(event) => updateDraft((current) => ({ ...current, actualEquipment: current.actualEquipment.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} />{equipment.equipmentId && <small>계획 ID {equipment.equipmentId}</small>}</div><input disabled={readOnly || Boolean(equipment.equipmentId)} value={equipment.model || ''} placeholder="모델" onChange={(event) => updateDraft((current) => ({ ...current, actualEquipment: current.actualEquipment.map((item, itemIndex) => itemIndex === index ? { ...item, model: event.target.value } : item) }))} /><input disabled={readOnly || Boolean(equipment.equipmentId)} value={equipment.registrationNo || ''} placeholder="등록번호" onChange={(event) => updateDraft((current) => ({ ...current, actualEquipment: current.actualEquipment.map((item, itemIndex) => itemIndex === index ? { ...item, registrationNo: event.target.value } : item) }))} /><input disabled={readOnly} value={equipment.operatorName || ''} placeholder="운전원" onChange={(event) => updateDraft((current) => ({ ...current, actualEquipment: current.actualEquipment.map((item, itemIndex) => itemIndex === index ? { ...item, operatorName: event.target.value } : item) }))} />{!readOnly && <button type="button" aria-label="장비 삭제" onClick={() => updateDraft((current) => ({ ...current, actualEquipment: current.actualEquipment.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={15} /></button>}</div>)}
          </section>

          <section className="cp-record-section">
            <header><div><span>03</span><h2>서버 표준 체크리스트</h2></div><p>공종·기록유형별 catalog {record.catalogVersion} · 클라이언트 임의 문항 추가 불가</p></header>
            <div className="cp-record-checklist">
              {record.questions.map((question: ConstructionPlanRecordQuestion, index) => {
                const response = responseMap.get(question.id) || { questionId: question.id };
                const expanded = expandedQuestion === question.id || response.result === 'fail' || response.result === 'not_applicable';
                return <article key={question.id} className={`cp-record-question cp-record-question--${response.result || 'empty'}`}>
                  <button type="button" className="cp-record-question__title" onClick={() => setExpandedQuestion(expandedQuestion === question.id ? undefined : question.id)}><span className="cp-record-question__number">{String(index + 1).padStart(2, '0')}</span><div><small>{question.category}</small><strong>{question.text}</strong></div><ChevronDown className={expanded ? 'is-open' : ''} /></button>
                  <div className="cp-record-verdicts" role="group" aria-label={`${question.category} 판정`}>
                    {(['pass', 'fail', 'not_applicable'] as const).map((result) => <button key={result} type="button" disabled={readOnly || (result === 'not_applicable' && !question.allowNotApplicable)} className={response.result === result ? 'is-selected' : ''} onClick={() => patchResponse(question.id, { result, ...(result !== 'fail' ? { action: undefined } : {}) })}>{result === 'pass' ? <><CheckCircle2 /> 적합</> : result === 'fail' ? <><ShieldAlert /> 부적합</> : '해당없음'}</button>)}
                  </div>
                  {expanded && <div className="cp-record-question__detail">
                    {question.measuredValueLabel && <label><span>{question.measuredValueLabel}</span><input disabled={readOnly} value={response.measuredValue || ''} onChange={(event) => patchResponse(question.id, { measuredValue: event.target.value })} /></label>}
                    <label><span>{response.result === 'fail' ? '부적합 사유' : response.result === 'not_applicable' ? '해당없음 사유' : '확인 메모'}{response.result !== 'pass' && <b>필수</b>}</span><textarea disabled={readOnly} value={response.note || ''} onChange={(event) => patchResponse(question.id, { note: event.target.value })} rows={2} /></label>
                    {response.result === 'fail' && <div className="cp-record-action-box"><strong>시정 조치</strong><div className="cp-record-form-grid"><label className="cp-record-span-2"><span>조치 내용</span><input disabled={readOnly} value={actionDrafts[question.id]?.description || ''} onChange={(event) => updateAction(question.id, { description: event.target.value })} /></label><label><span>담당자</span><input disabled={readOnly} value={actionDrafts[question.id]?.owner || ''} onChange={(event) => updateAction(question.id, { owner: event.target.value })} /></label><label><span>기한</span><input disabled={readOnly} type="date" value={actionDrafts[question.id]?.due || ''} onChange={(event) => updateAction(question.id, { due: event.target.value })} /></label><label><span>상태</span><select disabled={readOnly} value={actionDrafts[question.id]?.status || 'open'} onChange={(event) => updateAction(question.id, { status: event.target.value as 'open' | 'resolved' })}><option value="open">미결</option><option value="resolved">완료</option></select></label>{actionDrafts[question.id]?.status === 'resolved' && <label><span>완료 결과</span><input disabled={readOnly} value={actionDrafts[question.id]?.resolution || ''} onChange={(event) => updateAction(question.id, { resolution: event.target.value })} /></label>}</div></div>}
                  </div>}
                </article>;
              })}
            </div>
          </section>

          <section className="cp-record-section">
            <header><div><span>04</span><h2>현장사진 증적</h2></div><p>원본 SHA-256·Storage generation을 실행기록에 불변 바인딩합니다.</p></header>
            <div className="cp-record-photo-grid">{record.photos.map((photo) => <figure key={photo.id}>{photoUrls[photo.id] ? <img src={photoUrls[photo.id]} alt={photo.caption} /> : <div className="cp-record-photo-loading"><ImageIcon /><span>보안 원본 확인 중</span></div>}<figcaption><strong>{photo.caption}</strong><span>{new Date(photo.takenAt).toLocaleString('ko-KR')} · {photo.zone}</span><code>SHA {photo.sha256.slice(0, 12)}…</code></figcaption></figure>)}</div>
            {!record.photos.length && <p className="cp-record-empty-line">등록된 현장사진이 없습니다.</p>}
            {!readOnly && <div className="cp-record-photo-uploader"><label className="cp-record-file"><Camera /><span>{photoForm.file ? photoForm.file.name : 'JPEG 또는 PNG 선택 (최대 12MB)'}</span><input type="file" accept="image/jpeg,image/png" onChange={(event) => setPhotoForm({ ...photoForm, file: event.target.files?.[0] })} /></label><div className="cp-record-form-grid"><label className="cp-record-span-2"><span>사진 설명</span><input value={photoForm.caption} onChange={(event) => setPhotoForm({ ...photoForm, caption: event.target.value })} placeholder="무엇을 확인할 수 있는 사진인지 구체적으로 기록" /></label><label><span>실제 촬영시각</span><input type="datetime-local" value={photoForm.takenAt} onChange={(event) => setPhotoForm({ ...photoForm, takenAt: event.target.value })} /></label><label><span>촬영 구간</span><input value={photoForm.zone} onChange={(event) => setPhotoForm({ ...photoForm, zone: event.target.value })} /></label></div>{photoProgress && <div className="cp-record-upload-progress"><div><span style={{ width: `${photoProgress.percent}%` }} /></div><strong>{photoProgress.stage === 'hashing' ? '원본 SHA 계산' : photoProgress.stage === 'creating_session' ? '보안 세션 생성' : photoProgress.stage === 'uploading' ? 'staging 업로드' : '서버 원본 검증·불변 복사'} {Math.round(photoProgress.percent)}%</strong>{photoCancelRef.current?.canCancel && <button type="button" onClick={() => photoCancelRef.current?.cancel()}><X size={14} /> 취소</button>}</div>}{photoError && <div className="cp-record-inline-error"><AlertCircle />{photoError}</div>}<button className="cp-record-secondary" type="button" disabled={!photoForm.file || Boolean(photoProgress)} onClick={() => void uploadPhoto()}><UploadCloud /> 무결성 검증 후 등록</button></div>}
          </section>
        </div>

        <aside className="cp-record-detail-aside">
          <section className="cp-record-confirm-card"><header><ShieldCheck /><div><span>CONFIRMATION GATE</span><h2>{readOnly ? '불변 확인 완료' : '확인 준비상태'}</h2></div></header>{readOnly ? <><div className="cp-record-confirmed"><CheckCircle2 /><div><strong>{record.confirmedByName}</strong><span>{record.confirmedAt && new Date(record.confirmedAt).toLocaleString('ko-KR')}</span></div></div><code className="cp-record-full-hash">{record.confirmationHash}</code><button className="cp-record-primary" type="button" disabled={pdfBusy} onClick={() => void downloadAppendix()}>{pdfBusy ? <Loader2 className="cp-record-spin" /> : <Download />} A4 부록 PDF</button>{pdfError && <div className="cp-record-inline-error"><AlertCircle />{pdfError}</div>}<div className="cp-record-correction"><strong>오류 정정</strong><p>확인 완료 원본은 변경하지 않습니다. 사유를 남기고 새 Record Rev.를 만듭니다.</p><textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} rows={3} placeholder="정정 사유 5자 이상" /><button type="button" disabled={correctionBusy || correctionReason.trim().length < 5} onClick={() => void createCorrection()}>{correctionBusy ? <Loader2 className="cp-record-spin" /> : <RotateCcw />} 정정본 생성</button></div></> : <><div className={`cp-record-readiness ${issues.length ? '' : 'is-ready'}`}><strong>{issues.length ? `${issues.length}개 확인 필요` : '확인 가능'}</strong><span>{issues.length ? '모든 판정과 실제 증적을 완료해야 합니다.' : '서버가 최종 불변 해시를 생성합니다.'}</span></div>{issues.length > 0 && <ul className="cp-record-issue-list">{issues.slice(0, 6).map((issue) => <li key={issue}>{issue}</li>)}</ul>}<button className="cp-record-primary" type="button" disabled={confirmBusy || issues.length > 0 || saveState === 'saving' || saveState === 'error'} onClick={() => void confirm()}>{confirmBusy ? <Loader2 className="cp-record-spin" /> : <FileCheck2 />} 실행기록 확인 완료</button>{confirmError && <div className="cp-record-inline-error"><AlertCircle />{confirmError}</div>}<p className="cp-record-confirm-note">계획서 빈 양식이나 승인상태는 자동 합격으로 전환되지 않습니다. 이 확인은 해당 일자·구간의 실제 기록에만 적용됩니다.</p></>}
          </section>
          <section className="cp-record-audit-card"><h3>불변 바인딩</h3><dl><div><dt>기록 ID</dt><dd>{record.id}</dd></div><div><dt>계획서 ID</dt><dd>{record.planId}</dd></div><div><dt>Issued export</dt><dd>{record.planBinding.issuedExportId}</dd></div><div><dt>Catalog</dt><dd>{record.catalogVersion}</dd></div><div><dt>Record version</dt><dd>v{record.version}</dd></div></dl></section>
        </aside>
      </main>
    </div>
  );
}

export default ConstructionPlanRecordDetailPage;
