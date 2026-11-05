import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ImagePlus } from 'lucide-react';
import type { Vehicle } from '../../types/vehicle';
import { parseRepairAmountInput } from './draft';
import { COST_KEYS, COST_LABELS, CostKey, emptyCosts, formatRepairAmount, isValidRepairDate, RepairRecord } from './model';
import { analyzeRepairPhoto, identifyRepairPhoto, RepairPhotoResult } from './photoAnalysis';
import type { RepairVehicleLink } from './vehicleTeam';
import RepairTeamBadge from './RepairTeamBadge';

export type PhotoRow = Pick<RepairRecord, 'id' | 'date' | 'vehiclePlate' | 'description' | 'vendor' | 'costs'> & RepairVehicleLink;
type PhotoForm = Omit<RepairPhotoResult, 'total'> & { id: string; amount: string };
type PhotoEntry = {
  key: number;
  file: File;
  status: 'waiting' | 'reading' | 'ready' | 'error' | 'duplicate';
  photoId?: string;
  form?: PhotoForm;
  error?: string;
};
type Props = {
  vehicles: Vehicle[];
  lookup: (plate: string) => RepairVehicleLink;
  alreadyAdded: (id: string) => boolean;
  remaining: number;
  onAdd: (rows: PhotoRow[]) => boolean;
  onClose: () => void;
};

function missingFields(form: PhotoForm) {
  const amount = parseRepairAmountInput(form.amount);
  return [
    !isValidRepairDate(form.date) && '정비일', !form.vehiclePlate.trim() && '차량번호', !form.description.trim() && '정비내용',
    (!amount.valid || amount.value === null) && '합계금액', !form.category && '비용 구분',
  ].filter(Boolean);
}

function entryStatus(entry: PhotoEntry) {
  if (entry.status === 'ready') return entry.form && missingFields(entry.form).length ? '확인 필요' : '인식 완료';
  return { waiting: '인식 대기', reading: '인식 중', error: '인식 실패', duplicate: '중복 사진' }[entry.status];
}

export default function RepairPhotoImport({ vehicles, lookup, alreadyAdded, remaining, onAdd, onClose }: Props) {
  const [entries, setEntries] = useState<PhotoEntry[]>([]);
  const [activeKey, setActiveKey] = useState<number>();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController>();
  const sequence = useRef(0);
  const active = entries.find(entry => entry.key === activeKey) ?? entries[0];
  const file = active?.file;
  const form = active?.form;
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    setUrl('');
    if (!file) return;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const patchEntry = (key: number, patch: Partial<PhotoEntry>) => setEntries(current => current.map(entry => entry.key === key ? { ...entry, ...patch } : entry));
  const analyze = async (batch: PhotoEntry[], existingIds: string[] = []) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError('');
    const seen = new Set(existingIds);
    try {
      for (const entry of batch) {
        if (controller.signal.aborted) return;
        patchEntry(entry.key, { status: 'reading', error: undefined });
        try {
          const id = await identifyRepairPhoto(entry.file);
          if (controller.signal.aborted) return;
          if (alreadyAdded(id) || seen.has(id)) {
            patchEntry(entry.key, { status: 'duplicate', error: alreadyAdded(id)
              ? '이미 대장 또는 작성 중인 행에 있는 사진입니다. 기존 내역과 휴지통을 확인해 주세요.'
              : '함께 선택한 사진 중 같은 사진이 있습니다. 한 번만 추가합니다.' });
            continue;
          }
          seen.add(id);
          patchEntry(entry.key, { photoId: id });
          const result = await analyzeRepairPhoto(entry.file, controller.signal);
          if (controller.signal.aborted) return;
          patchEntry(entry.key, { status: 'ready', form: { ...result, id, amount: result.total === null ? '' : formatRepairAmount(result.total) } });
        } catch (reason) {
          if (controller.signal.aborted) return;
          patchEntry(entry.key, { status: 'error', error: reason instanceof Error ? reason.message : '사진을 인식하지 못했습니다. 다시 시도해 주세요.' });
        }
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const selectFiles = (files: File[]) => {
    if (!files.length) return;
    if (files.length > remaining) {
      setError(`현재 ${remaining}장까지 선택할 수 있습니다. 작성 중인 행을 포함해 한 번에 100건까지 추가할 수 있습니다.`);
      return;
    }
    const next: PhotoEntry[] = files.map(file => ({ key: ++sequence.current, file, status: 'waiting' }));
    setEntries(next); setActiveKey(next[0].key);
    void analyze(next);
  };
  const retry = (entry: PhotoEntry) => {
    if (busy) return;
    void analyze([entry], entries.filter(other => other.key !== entry.key && other.photoId && other.status !== 'duplicate').map(other => other.photoId!));
  };

  const link = lookup(form?.vehiclePlate ?? '');
  const amount = parseRepairAmountInput(form?.amount ?? '');
  const missing = form ? missingFields(form) : [];
  const ready = entries.filter(entry => entry.status === 'ready' && entry.form && !missingFields(entry.form).length);
  const processed = entries.filter(entry => entry.status !== 'waiting' && entry.status !== 'reading').length;
  const update = (patch: Partial<PhotoForm>) => {
    if (active && form) patchEntry(active.key, { form: { ...form, ...patch } });
  };
  const add = () => {
    if (busy || !ready.length) return;
    const rows: PhotoRow[] = ready.flatMap(entry => {
      const value = entry.form!;
      const parsed = parseRepairAmountInput(value.amount);
      if (!parsed.valid || parsed.value === null || !value.category) return [];
      return [{
        id: value.id, date: value.date, vehiclePlate: value.vehiclePlate.trim(), ...lookup(value.vehiclePlate), vendor: value.vendor.trim(),
        description: value.description.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join(' / '),
        costs: { ...emptyCosts(), [value.category]: parsed.value },
      }];
    });
    if (!onAdd(rows)) { setError('대장에 추가하지 못했습니다. 남은 입력 가능 건수와 중복 내역을 확인해 주세요.'); return; }
    const added = new Set(ready.map(entry => entry.key));
    const rest = entries.filter(entry => !added.has(entry.key));
    setEntries(rest); setError('');
    if (!rest.length) onClose();
  };

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="repair-overlay" />
      <Dialog.Content className="repair-dialog repair-photo-dialog" onInteractOutside={event => event.preventDefault()}>
        <Dialog.Title>정비명세서 사진 인식</Dialog.Title>
        <Dialog.Description>사진 여러 장을 한 번에 선택하면 Gemini가 사진별로 차량번호, 작업내용과 최종 합계를 읽습니다. 목록에서 사진을 눌러 원본과 대조한 뒤 한꺼번에 대장에 추가하세요.</Dialog.Description>
        <div className="repair-photo-upload">
          <button type="button" onClick={() => input.current?.click()}><ImagePlus size={16} />{file ? '다른 사진 선택' : '사진 선택'}</button>
          <input ref={input} aria-label="정비명세서 사진 파일" type="file" accept="image/*,.heic,.heif" multiple hidden onChange={event => {
            const next = Array.from(event.target.files ?? []); event.target.value = ''; selectFiles(next);
          }} />
          <span>{entries.length ? `${entries.length}장 선택 · ` : ''}여러 장 선택 가능 · 사진당 최대 25MB · 현재 {remaining}장까지</span>
        </div>
        {Boolean(entries.length) && <>
          <p role="status" className="repair-help">{busy ? `Gemini가 정비명세서를 읽고 있습니다… ${processed}/${entries.length}장 처리` : `${entries.length}장 처리 완료 · 추가 가능 ${ready.length}건`}</p>
          <ul className="repair-photo-list" aria-label="선택한 정비명세서">{entries.map((entry, index) => <li key={entry.key}>
            <button type="button" className="repair-photo-select" aria-current={entry.key === active?.key ? 'true' : undefined} onClick={() => setActiveKey(entry.key)}>
              <span>{index + 1}. {entry.file.name}</span><span>{entryStatus(entry)}</span>
            </button>
            <button type="button" disabled={busy} aria-label={`${entry.file.name} 제외`} onClick={() => setEntries(current => current.filter(other => other.key !== entry.key))}>제외</button>
          </li>)}</ul>
        </>}
        {error && <div role="alert" className="repair-error">{error}</div>}
        {active?.error && <div role="alert" className="repair-error">{active.error} {active.status === 'error' && <button type="button" disabled={busy} onClick={() => retry(active)}>다시 인식</button>}</div>}
        {file && <div className="repair-photo-review">
          {url && <a className="repair-photo-original" href={url} target="_blank" rel="noreferrer"><img src={url} alt="첨부한 정비명세서" /><span>원본 크게 보기</span></a>}
          {form && <div className="repair-photo-fields">
            <label>정비일<input type="date" value={form.date} onChange={event => update({ date: event.target.value })} /></label>
            <label>차량번호<input list="repair-photo-vehicles" value={form.vehiclePlate} onChange={event => update({ vehiclePlate: event.target.value })} /></label>
            <datalist id="repair-photo-vehicles">{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.licensePlate}>{vehicle.model}</option>)}</datalist>
            <div className="repair-photo-team" role="status"><b>차량 대장 배정팀</b> {link.teamName ? <RepairTeamBadge team={link} /> : (link.vehicleId ? '등록된 배정팀이 없습니다.' : '일치하는 차량이 한 대인지 번호를 확인해 주세요.')}</div>
            <label className="repair-photo-wide">정비업체<input value={form.vendor} onChange={event => update({ vendor: event.target.value })} /></label>
            <label className="repair-photo-wide">정비내용<textarea rows={5} value={form.description} onChange={event => update({ description: event.target.value })} /></label>
            <label>합계금액 (원)<input inputMode="decimal" value={form.amount} aria-invalid={!amount.valid} onChange={event => update({ amount: event.target.value })} /></label>
            <label>비용 구분<select value={form.category} onChange={event => update({ category: event.target.value as CostKey | '' })}><option value="">선택해 주세요</option>
              {COST_KEYS.map(key => <option key={key} value={key}>{COST_LABELS[key]}</option>)}
            </select></label>
            <p className="repair-photo-wide repair-help">{missing.length ? missing.join(' · ') + ' 항목을 확인해 주세요.' : '선택한 비용 구분에 합계금액 전액을 넣습니다.'}</p>
          </div>}
        </div>}
        {entries.length > 1 && <p className="repair-help">필수 항목이 채워진 {ready.length}건을 함께 추가합니다. 확인이 필요한 사진과 실패·중복 사진은 목록에 남습니다. 실제 저장은 대장 상단의 저장 버튼을 눌러 주세요.</p>}
        <div className="repair-dialog-actions"><button type="button" onClick={onClose}>닫기</button>
          <button type="button" className="repair-primary" disabled={!ready.length || busy || ready.length > remaining} onClick={add}>{entries.length > 1 ? `인식된 ${ready.length}건 대장에 추가` : '대장에 추가'}</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
