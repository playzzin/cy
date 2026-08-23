import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuildingColumns,
    faCreditCard,
    faFloppyDisk,
    faIdCard,
    faShieldHalved,
    faXmark
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { Card, CardType } from '../../types/card';
import { cardService } from '../../services/cardService';

interface CardFormProps {
    initialData?: Card | null;
    onClose: () => void;
    onSuccess: () => void;
}

const defaultFormData: Omit<Card, 'id'> = {
    name: '',
    issuer: '',
    cardType: 'CREDIT',
    last4: '',
    maskedNumber: '',
    expiry: '',
    status: 'AVAILABLE',
    memo: ''
};

const cardTypes: Array<{ value: CardType; label: string; helper: string }> = [
    { value: 'CREDIT', label: '신용', helper: '월 청구 카드' },
    { value: 'CHECK', label: '체크', helper: '즉시 출금 카드' }
];

const statusLabels: Record<Card['status'], string> = {
    AVAILABLE: '대기',
    ASSIGNED: '배정',
    SUSPENDED: '정지',
    CLOSED: '해지',
};

const isValidLast4 = (value: string): boolean => {
    const v = String(value).trim();
    return /^[0-9]{4}$/.test(v);
};

const fieldClassName = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100';
const labelClassName = 'mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500';

export const CardForm: React.FC<CardFormProps> = ({ initialData, onClose, onSuccess }) => {
    const [formData, setFormData] = useState<Omit<Card, 'id'>>({ ...defaultFormData });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!initialData) {
            setFormData({ ...defaultFormData });
            return;
        }

        setFormData({
            name: initialData.name,
            issuer: initialData.issuer,
            cardType: initialData.cardType,
            last4: initialData.last4,
            maskedNumber: initialData.maskedNumber,
            expiry: initialData.expiry,
            status: initialData.status,
            memo: initialData.memo ?? ''
        });
    }, [initialData]);

    const previewNumber = useMemo(() => {
        if (formData.maskedNumber.trim()) return formData.maskedNumber.trim();
        if (formData.last4.trim()) return `****-****-****-${formData.last4.trim()}`;
        return '****-****-****-0000';
    }, [formData.last4, formData.maskedNumber]);

    const handleMaskedNumberChange = (value: string) => {
        setFormData((prev) => {
            const digits = value.replace(/\D/g, '');
            return {
                ...prev,
                maskedNumber: value,
                last4: digits.length >= 4 ? digits.slice(-4) : prev.last4
            };
        });
    };

    const handleLast4Change = (value: string) => {
        const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
        setFormData((prev) => ({ ...prev, last4: digitsOnly }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;

        const name = formData.name.trim();
        const issuer = formData.issuer.trim();
        const maskedNumber = formData.maskedNumber.trim();
        const last4 = formData.last4.trim();

        if (!name || !issuer) {
            await Swal.fire('입력 오류', '카드명과 발급사는 필수입니다.', 'error');
            return;
        }

        if (!maskedNumber) {
            await Swal.fire('입력 오류', '마스킹 번호(예: 1234-****-****-5678)는 필수입니다.', 'error');
            return;
        }

        if (!isValidLast4(last4)) {
            await Swal.fire('입력 오류', '끝 4자리는 숫자 4자리여야 합니다.', 'error');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name,
                issuer,
                cardType: formData.cardType,
                maskedNumber,
                last4,
                expiry: formData.expiry?.trim() ?? '',
                memo: formData.memo?.trim() || ''
            };

            if (initialData?.id) {
                await cardService.updateCard(initialData.id, payload);
                await Swal.fire('수정 완료', '카드 정보가 수정되었습니다.', 'success');
            } else {
                await cardService.createCard({ ...payload, status: 'AVAILABLE' });
                await Swal.fire('등록 완료', '새 카드가 등록되었습니다.', 'success');
            }

            onSuccess();
        } catch (error: unknown) {
            console.error(error);
            await Swal.fire('오류', '저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-200">
                            <FontAwesomeIcon icon={faCreditCard} />
                        </div>
                        <div>
                            <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Card Master</div>
                            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                                {initialData ? '카드 정보 수정' : '신규 카드 등록'}
                            </h2>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{formData.issuer || '발급사 미입력'}</span>
                                <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">{formData.cardType === 'CREDIT' ? '신용카드' : '체크카드'}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                        title="닫기"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[300px_minmax(0,1fr)]">
                        <aside className="border-b border-slate-200 bg-slate-50 p-6 lg:border-b-0 lg:border-r">
                            <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-xl">
                                <div className="flex items-center justify-between">
                                    <FontAwesomeIcon icon={faCreditCard} className="text-xl text-slate-300" />
                                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-200">
                                        {formData.cardType === 'CREDIT' ? 'Credit' : 'Check'}
                                    </span>
                                </div>
                                <div className="mt-10">
                                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Card Name</div>
                                    <div className="mt-2 min-h-[28px] text-xl font-black tracking-tight">{formData.name || '카드명'}</div>
                                </div>
                                <div className="mt-6 font-mono text-sm font-bold tracking-wider text-slate-100">{previewNumber}</div>
                                <div className="mt-6 flex items-end justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Issuer</div>
                                        <div className="mt-1 text-sm font-bold">{formData.issuer || '-'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Valid</div>
                                        <div className="mt-1 text-sm font-bold">{formData.expiry || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                                    <FontAwesomeIcon icon={faShieldHalved} className="text-indigo-500" />
                                    보안 입력 기준
                                </div>
                                <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                                    카드번호는 마스킹 표기와 끝 4자리만 저장합니다.
                                </p>
                            </div>
                        </aside>

                        <div className="space-y-5 px-6 py-5">
                            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                <div className="mb-4 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faIdCard} className="text-slate-500" />
                                    <h3 className="text-base font-black text-slate-900">기본 정보</h3>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className={labelClassName}>카드명</label>
                                        <input
                                            className={fieldClassName}
                                            placeholder="예: 본사 운영카드"
                                            value={formData.name}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClassName}>발급사</label>
                                        <div className="relative">
                                            <FontAwesomeIcon icon={faBuildingColumns} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                className={`${fieldClassName} pl-9`}
                                                placeholder="예: 국민카드"
                                                value={formData.issuer}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, issuer: e.target.value }))}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClassName}>상태</label>
                                        <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-600">
                                            {statusLabels[initialData?.status ?? 'AVAILABLE']}
                                            <span className="ml-2 text-xs font-semibold text-slate-400">상태 변경은 배정·정지 처리 화면에서 합니다.</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClassName}>카드 종류</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {cardTypes.map((type) => {
                                                const selected = formData.cardType === type.value;
                                                return (
                                                    <button
                                                        key={type.value}
                                                        type="button"
                                                        onClick={() => setFormData((prev) => ({ ...prev, cardType: type.value }))}
                                                        className={`rounded-xl border px-3 py-2 text-left transition ${
                                                            selected
                                                                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="text-sm font-extrabold">{type.label}</div>
                                                        <div className={`mt-0.5 text-[10px] font-bold ${selected ? 'text-slate-300' : 'text-slate-400'}`}>{type.helper}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                <div className="mb-4 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faShieldHalved} className="text-slate-500" />
                                    <h3 className="text-base font-black text-slate-900">카드 번호</h3>
                                </div>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="md:col-span-2">
                                        <label className={labelClassName}>마스킹 번호</label>
                                        <input
                                            className={fieldClassName}
                                            placeholder="1234-****-****-5678"
                                            value={formData.maskedNumber}
                                            onChange={(e) => handleMaskedNumberChange(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClassName}>끝 4자리</label>
                                        <input
                                            className={fieldClassName}
                                            inputMode="numeric"
                                            maxLength={4}
                                            placeholder="5678"
                                            value={formData.last4}
                                            onChange={(e) => handleLast4Change(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClassName}>유효기간</label>
                                        <input
                                            className={fieldClassName}
                                            placeholder="MM/YY"
                                            value={formData.expiry ?? ''}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, expiry: e.target.value }))}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelClassName}>관리 메모</label>
                                        <input
                                            className={fieldClassName}
                                            placeholder="사용처, 보관 위치, 내부 참고사항"
                                            value={formData.memo ?? ''}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
                        >
                            <FontAwesomeIcon icon={faFloppyDisk} />
                            {saving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
