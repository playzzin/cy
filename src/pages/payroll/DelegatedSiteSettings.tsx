import React, { useMemo, useRef, useState } from 'react';
import { Check, Percent } from 'lucide-react';
import { calculateExpectedAmount, DelegatedClaim, entryKindLabels } from '../../features/delegated-receipts/model';
import { getSiteTeam, ReceiptDirectory } from '../../features/delegated-receipts/teamDirectory';
import { parseSiteTax, SiteTaxRequest, SiteTaxSetting, siteTaxTarget } from '../../features/delegated-receipts/siteTax';
import { newEntryId } from '../../features/delegated-receipts/bulkEntry';
import ReceiptColorFilter from './ReceiptColorFilter';
import './DelegatedSiteSettings.css';

const won = (value: number | null) => value === null ? '미확정' : `${value.toLocaleString('ko-KR')}원`;
export default function DelegatedSiteSettings({ month, claims, directory, settings, initialKey, onSave, onBusy, onClose }: {
  month: string; claims: DelegatedClaim[]; directory: ReceiptDirectory; settings: SiteTaxSetting[]; initialKey?: string;
  onSave: (request: SiteTaxRequest) => Promise<void>; onBusy: (value: boolean) => void; onClose: () => void;
}) {
  const targets = useMemo(() => {
    const values = [...directory.sites.map(site => ({ siteId: site.id, siteName: site.name })), ...claims];
    return [...new Map(values.map(value => { const target = siteTaxTarget(value, directory); return [target.key, { ...target, color: getSiteTeam(value, directory)?.color }]; })).values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [claims, directory]);
  const [key, setKey] = useState(initialKey || '');
  const [rate, setRate] = useState(() => { const setting = settings.find(value => value.key === initialKey); return setting?.taxRate == null ? '' : String(setting.taxRate); });
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const pending = useRef<SiteTaxRequest>();
  const target = targets.find(value => value.key === key);
  let taxRate: number | null = null; let invalid = false;
  try { taxRate = parseSiteTax(rate); } catch { invalid = true; }
  const rows = claims.filter(claim => claim.month === month && siteTaxTarget(claim, directory).key === key);
  const eligible = rows.filter(claim => claim.grossAmount !== null);
  const chooseSite = (value: string) => { setKey(value); setRate(String(settings.find(setting => setting.key === value)?.taxRate ?? '')); setSelected([]); setError(''); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy.current || !target || invalid) return;
    pending.current ??= { target: { key: target.key, name: target.name }, taxRate, revision: settings.find(value => value.key === key)?.revision ?? 0,
      operationId: newEntryId(), month, selected: rows.filter(claim => selected.includes(claim.id)).map(claim => ({ id: claim.id, updatedAt: claim.updatedAt })) };
    busy.current = true; setSaving(true); onBusy(true); setError('');
    try { await onSave(pending.current); }
    catch (failure) { setRetry(true); setError(failure instanceof Error ? failure.message : '저장 결과를 확인하지 못했습니다. 같은 내용으로 다시 저장 확인해 주세요.'); }
    finally { busy.current = false; setSaving(false); onBusy(false); }
  };
  return <form className="dr-site-settings dr-form" onSubmit={save}>
    <fieldset disabled={saving || retry}>
      <div className="dr-site-tax-fields"><div><span className="dr-site-tax-label">설정할 현장</span><ReceiptColorFilter label="세율 설정 현장" kind="site" value={key} options={[{ value: '', label: '현장을 선택하세요' }, ...targets.map(value => ({ value: value.key, label: value.name, color: value.color }))]} onChange={chooseSite} /></div>
        <label>기본 공제 세율 (%)<input aria-label="현장 기본 세율" inputMode="decimal" placeholder="미설정" value={rate} disabled={!target} onChange={event => { setRate(event.target.value); if (!event.target.value.trim()) setSelected([]); }} /></label></div>
      <p className="dr-form-help"><Percent size={14} /> 세전 금액에서 설정한 세율을 공제하고, 세금은 원 단위 반올림합니다. 새 내역에 자동 적용되며 각 행에서 바꿀 수 있습니다.</p>
      {invalid && <p role="alert" className="dr-form-error">세율은 0~100%로 입력하거나 비워 두세요.</p>}
      {target && <section aria-label="기존 내역 세율 재계산" className="dr-tax-existing"><div className="dr-tax-existing-heading"><h3>{month} 기존 내역</h3><span>선택 {selected.length}건 / {rows.length}건</span></div>
        <p className="dr-form-help">선택한 내역만 아래 예정 금액으로 변경됩니다. 세전 금액·입금 기록·입금여부는 유지합니다.</p>
        {rows.length ? <><button className="dr-text-button" type="button" disabled={invalid || taxRate === null || !eligible.length} onClick={() => setSelected(selected.length ? [] : eligible.slice(0, 400).map(claim => claim.id))}>{selected.length ? '재계산 선택 해제' : `금액 있는 내역 선택${eligible.length > 400 ? ' (앞 400건)' : ''}`}</button>
          <div className="dr-tax-existing-rows">{rows.map(claim => {
            const possible = !invalid && taxRate !== null && claim.grossAmount !== null;
            return <label key={claim.id} className={selected.includes(claim.id) ? 'dr-tax-selected' : ''}><input type="checkbox" aria-label={`${claim.workerName} 세율 재계산`} disabled={!possible || (!selected.includes(claim.id) && selected.length >= 400)} checked={selected.includes(claim.id)} onChange={event => setSelected(event.target.checked ? [...selected, claim.id] : selected.filter(id => id !== claim.id))} />
              <span><b>{claim.workerName}</b><small>{entryKindLabels[claim.entryKind ?? 'worker']} · 세전 {won(claim.grossAmount)}</small></span><span className="dr-tax-compare"><small>받을 예정 {won(claim.expectedAmount)}</small><strong>→ {possible ? won(calculateExpectedAmount(claim.grossAmount!, taxRate!).expectedAmount) : '재계산 불가'}</strong></span></label>;
          })}</div></> : <p className="dr-form-help">이 달에 등록된 내역이 없습니다. 기본 세율만 저장할 수 있습니다.</p>}
      </section>}
    </fieldset>
    {error && <p role="alert" className="dr-form-error">{error}</p>}
    <footer className="dr-site-tax-actions"><button type="button" className="dr-button" disabled={saving} onClick={onClose}>닫기</button><button className="dr-button dr-button-primary" disabled={!target || invalid || saving || (selected.length > 0 && taxRate === null)}><Check size={16} />{saving ? '저장 중…' : retry ? '다시 저장 확인' : selected.length ? `세율 저장 · ${selected.length}건 재계산` : '기본 세율 저장'}</button></footer>
  </form>;
}
