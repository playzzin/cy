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
type Props = {
  vehicles: Vehicle[];
  lookup: (plate: string) => RepairVehicleLink;
  alreadyAdded: (id: string) => boolean;
  onAdd: (row: PhotoRow) => void;
  onClose: () => void;
};

export default function RepairPhotoImport({ vehicles, lookup, alreadyAdded, onAdd, onClose }: Props) {
  const [file, setFile] = useState<File>();
  const [url, setUrl] = useState('');
  const [form, setForm] = useState<PhotoForm>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController>();
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const analyze = async (next?: File) => {
    if (!next) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFile(next); setForm(undefined); setBusy(true); setError('');
    try {
      const id = await identifyRepairPhoto(next);
      if (controller.signal.aborted) return;
      if (alreadyAdded(id)) throw new Error('이미 대장 또는 작성 중인 행에 있는 사진입니다. 기존 내역과 휴지통을 확인해 주세요.');
      const result = await analyzeRepairPhoto(next, controller.signal);
      if (controller.signal.aborted) return;
      setForm({ ...result, id, amount: result.total === null ? '' : formatRepairAmount(result.total) });
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '사진을 인식하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const link = lookup(form?.vehiclePlate ?? '');
  const amount = parseRepairAmountInput(form?.amount ?? '');
  const missing = form ? [
    !isValidRepairDate(form.date) && '정비일', !form.vehiclePlate.trim() && '차량번호', !form.description.trim() && '정비내용',
    (!amount.valid || amount.value === null) && '합계금액', !form.category && '비용 구분',
  ].filter(Boolean) : [];
  const update = (patch: Partial<PhotoForm>) => setForm(current => current && { ...current, ...patch });
  const add = () => {
    if (!form || missing.length || !amount.valid || amount.value === null || !form.category) return;
    onAdd({
      id: form.id, date: form.date, vehiclePlate: form.vehiclePlate.trim(), ...link, vendor: form.vendor.trim(),
      description: form.description.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join(' / '),
      costs: { ...emptyCosts(), [form.category]: amount.value },
    });
  };

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="repair-overlay" />
      <Dialog.Content className="repair-dialog repair-photo-dialog" onInteractOutside={event => event.preventDefault()}>
        <Dialog.Title>정비명세서 사진 인식</Dialog.Title>
        <Dialog.Description>사진을 선택하면 Gemini가 차량번호, 작업내용과 최종 합계를 읽습니다. 원본과 대조한 뒤 대장에 추가하세요.</Dialog.Description>
        <div className="repair-photo-upload">
          <button type="button" onClick={() => input.current?.click()}><ImagePlus size={16} />{file ? '다른 사진 선택' : '사진 선택'}</button>
          <input ref={input} aria-label="정비명세서 사진 파일" type="file" accept="image/*,.heic,.heif" hidden onChange={event => {
            const next = event.target.files?.[0]; event.target.value = ''; void analyze(next);
          }} />
          <span>{file ? file.name : '정비명세서 한 장 · 최대 25MB'}</span>
        </div>
        {busy && <p role="status" className="repair-help">Gemini가 정비명세서를 읽고 있습니다…</p>}
        {error && <div role="alert" className="repair-error">{error} <button type="button" onClick={() => void analyze(file)}>다시 인식</button></div>}
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
        <div className="repair-dialog-actions"><button type="button" onClick={onClose}>닫기</button>
          <button type="button" className="repair-primary" disabled={!form || busy || Boolean(missing.length)} onClick={add}>대장에 추가</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
