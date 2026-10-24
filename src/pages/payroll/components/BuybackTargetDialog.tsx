import React, { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, LoaderCircle, Plus, Trash2, UserRound, Wallet, X } from 'lucide-react';
import {
    normalizeSettlementTargetAfterTaxRate,
    settlementTargetService,
    type SettlementTarget,
} from '../../../services/settlementTargetService';

export type BuybackTargetEditor = { mode: 'create' } | { mode: 'edit' | 'delete'; target: SettlementTarget & { id: string } };

interface Props {
    editor: BuybackTargetEditor;
    onSaved: (target: SettlementTarget & { id: string }) => void;
    onDeleted: (id: string) => void;
    onClose: () => void;
}

const inputClassName = 'mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50';
const labelClassName = 'block min-w-0 text-xs font-semibold text-slate-600';

const BuybackTargetDialog: React.FC<Props> = ({ editor, onSaved, onDeleted, onClose }) => {
    const target = editor.mode === 'create' ? undefined : editor.target;
    const deleting = editor.mode === 'delete';
    const [form, setForm] = useState({
        name: target?.name || '',
        positionTitle: target?.positionTitle || '',
        afterTaxPercent: String(Number((normalizeSettlementTargetAfterTaxRate(target?.defaultAfterTaxRate) * 100).toFixed(4))),
        contact: target?.contact || '',
        bankName: target?.bankName || '',
        accountNumber: target?.accountNumber || '',
        accountHolder: target?.accountHolder || '',
        memo: target?.memo || '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const inFlight = useRef(false);
    const returnFocusRef = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const firstInputRef = useRef<HTMLInputElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const title = deleting ? '정산 관계자 삭제' : editor.mode === 'edit' ? '정산 관계자 수정' : '정산 관계자 등록';
    const update = (field: keyof typeof form, value: string) => setForm(current => ({ ...current, [field]: value }));
    const previewPercent = Number(form.afterTaxPercent);
    const previewAmount = form.afterTaxPercent.trim() && Number.isFinite(previewPercent) && previewPercent >= 0 && previewPercent <= 100
        ? `${Math.round(100000 * previewPercent / 100).toLocaleString('ko-KR')}원`
        : '—';

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (inFlight.current) return;
        const percent = Number(form.afterTaxPercent);
        if (!deleting) {
            if (!form.name.trim()) {
                setError('관계자 이름을 입력해 주세요.');
                firstInputRef.current?.focus();
                return;
            }
            if (!form.afterTaxPercent.trim() || !Number.isFinite(percent) || percent < 0 || percent > 100) {
                setError('기본 세후율은 0% 이상 100% 이하로 입력해 주세요.');
                return;
            }
        }

        inFlight.current = true;
        setSaving(true);
        setError('');
        try {
            if (editor.mode === 'delete') {
                await settlementTargetService.deactivateTarget(editor.target.id);
                onDeleted(editor.target.id);
            } else {
                const changes = {
                    name: form.name.trim(),
                    positionTitle: form.positionTitle.trim(),
                    defaultAfterTaxRate: percent / 100,
                    contact: form.contact.trim(),
                    bankName: form.bankName.trim(),
                    accountNumber: form.accountNumber.trim(),
                    accountHolder: form.accountHolder.trim(),
                    memo: form.memo.trim(),
                };
                if (editor.mode === 'edit') {
                    await settlementTargetService.updateTarget(editor.target.id, changes);
                    onSaved({ ...editor.target, ...changes });
                } else {
                    const payload: SettlementTarget = {
                        ...changes,
                        targetType: 'client_contact',
                        defaultProcessType: 'payable',
                        buybackEnabled: true,
                        evidenceRequired: false,
                        status: 'active',
                    };
                    const id = await settlementTargetService.addTarget(payload);
                    onSaved({ ...payload, id });
                }
            }
        } catch {
            setError(deleting ? '관계자를 삭제하지 못했습니다. 권한과 연결 상태를 확인한 뒤 다시 시도해 주세요.' : '관계자를 저장하지 못했습니다. 권한과 연결 상태를 확인한 뒤 다시 시도해 주세요.');
        } finally {
            inFlight.current = false;
            setSaving(false);
        }
    };

    return (
        <Dialog.Root open onOpenChange={open => { if (!open && !inFlight.current) onClose(); }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm" />
                <Dialog.Content
                    onOpenAutoFocus={event => { event.preventDefault(); (deleting ? cancelRef.current : firstInputRef.current)?.focus(); }}
                    onCloseAutoFocus={event => { event.preventDefault(); returnFocusRef.current?.focus(); }}
                    onInteractOutside={event => event.preventDefault()}
                    className={`fixed left-1/2 top-1/2 z-[111] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-black/5 ${deleting ? 'max-w-md' : 'max-w-3xl'}`}
                >
                    <header className="flex shrink-0 items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${deleting ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-[#217346]'}`}>
                            {deleting ? <Trash2 size={21} aria-hidden="true" /> : <UserRound size={21} aria-hidden="true" />}
                        </span>
                        <div className="min-w-0 flex-1">
                            <Dialog.Title className="text-lg font-bold tracking-tight">{title}</Dialog.Title>
                            <Dialog.Description className="mt-1 text-xs leading-5 text-slate-500">
                                {deleting ? '목록에서 제외할 관계자를 확인해 주세요.' : editor.mode === 'edit' ? '관계자 정보와 정산 기준을 한곳에서 관리하세요.' : '새 관계자를 추가하고 바로 바이백 정산을 시작하세요.'}
                            </Dialog.Description>
                        </div>
                        <button type="button" aria-label={`${title} 닫기`} disabled={saving} onClick={onClose} className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X size={19} aria-hidden="true" /></button>
                    </header>
                    <form onSubmit={submit} aria-label={title} className="flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
                            {deleting ? <p className="text-sm leading-7 text-slate-600"><strong className="font-bold text-slate-900">{target?.name}</strong> 관계자를 바이백 목록에서 삭제하시겠습니까? 정산 대상자는 미사용으로 변경되며 기존 정산 내역은 보존됩니다. 정산 대상자 DB에서 다시 사용으로 바꿀 수 있습니다.</p> : (
                                <fieldset disabled={saving} className="min-w-0 space-y-5">
                                    <div className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1fr)_210px]">
                                        <section aria-labelledby="buyback-target-basic-title" className="min-w-0">
                                            <h3 id="buyback-target-basic-title" className="mb-3 text-sm font-bold text-slate-800">기본 정보</h3>
                                            <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3">
                                                <label className={labelClassName}>관계자 이름 (필수)
                                                    <input ref={firstInputRef} required value={form.name} onChange={event => update('name', event.target.value)} className={inputClassName} placeholder="이름 입력" />
                                                </label>
                                                <label className={labelClassName}>직책/직급
                                                    <input value={form.positionTitle} onChange={event => update('positionTitle', event.target.value)} className={inputClassName} placeholder="예: 부장, 소장" />
                                                </label>
                                                <label className={`${labelClassName} col-span-2`}>연락처
                                                    <input type="tel" value={form.contact} onChange={event => update('contact', event.target.value)} className={inputClassName} placeholder="연락처 입력 (선택)" />
                                                </label>
                                            </div>
                                        </section>
                                        <section aria-label="세후율 설정" className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                                            <label className="block text-xs font-bold text-emerald-900" htmlFor="buyback-target-rate">기본 세후율 (%)</label>
                                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
                                                <input id="buyback-target-rate" type="number" required min="0" max="100" step="any" value={form.afterTaxPercent} onChange={event => update('afterTaxPercent', event.target.value)} className="h-12 w-full min-w-0 bg-transparent text-2xl font-bold tracking-tight text-emerald-900 outline-none" />
                                                <span aria-hidden="true" className="text-lg font-semibold text-emerald-600">%</span>
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center justify-between gap-1 text-xs text-emerald-800">
                                                <span>세전 100,000원 기준</span><strong className="font-bold">세후 {previewAmount}</strong>
                                            </div>
                                        </section>
                                    </div>
                                    <section aria-labelledby="buyback-target-bank-title" className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                                        <div className="mb-3 flex items-center gap-2"><Wallet size={16} className="text-slate-400" aria-hidden="true" /><h3 id="buyback-target-bank-title" className="text-sm font-bold text-slate-800">입금 계좌</h3><span className="ml-auto text-xs text-slate-400">선택 입력</span></div>
                                        <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_1.5fr_1fr]">
                                            <label className={labelClassName}>은행
                                                <input value={form.bankName} onChange={event => update('bankName', event.target.value)} className={inputClassName} placeholder="은행명" />
                                            </label>
                                            <label className={labelClassName}>계좌번호
                                                <input value={form.accountNumber} onChange={event => update('accountNumber', event.target.value)} className={inputClassName} placeholder="계좌번호 입력" />
                                            </label>
                                            <label className={labelClassName}>예금주
                                                <input value={form.accountHolder} onChange={event => update('accountHolder', event.target.value)} className={inputClassName} placeholder="예금주명" />
                                            </label>
                                        </div>
                                    </section>
                                    <label className={labelClassName}>메모
                                        <textarea rows={2} value={form.memo} onChange={event => update('memo', event.target.value)} className={`${inputClassName} resize-y`} placeholder="정산 시 참고할 내용을 남겨 주세요. (선택)" />
                                    </label>
                                    {editor.mode === 'edit' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">세후율 변경은 자동 계산 중인 정산 행에 반영되며, 직접 입력한 세후 금액은 유지됩니다.</p>}
                                </fieldset>
                            )}
                        </div>
                        <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-5 py-3 sm:px-6">
                            {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
                            <div className="flex items-center justify-between gap-3">
                                <span className="hidden text-xs text-slate-400 sm:block">{deleting ? '기존 정산 내역은 유지됩니다.' : '이름과 세후율은 필수 항목입니다.'}</span>
                                <div className="ml-auto flex gap-2">
                                    <button ref={cancelRef} type="button" disabled={saving} onClick={onClose} className="min-h-11 rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50">취소</button>
                                    <button type="submit" disabled={saving} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white shadow-sm transition disabled:opacity-50 ${deleting ? 'bg-rose-700 hover:bg-rose-800' : 'bg-[#217346] hover:bg-emerald-800'}`}>
                                        {saving ? <LoaderCircle size={16} aria-hidden="true" className="animate-spin" /> : deleting ? <Trash2 size={16} aria-hidden="true" /> : editor.mode === 'edit' ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                                        {saving ? '처리 중…' : deleting ? '관계자 삭제' : editor.mode === 'edit' ? '변경사항 저장' : '관계자 등록'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default BuybackTargetDialog;
