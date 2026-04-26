import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Card, CardStatus, CardType } from '../../types/card';
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

const isValidLast4 = (value: string): boolean => {
    const v = String(value).trim();
    return /^[0-9]{4}$/.test(v);
};

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
            if (initialData?.id) {
                await cardService.updateCard(initialData.id, {
                    name,
                    issuer,
                    cardType: formData.cardType,
                    maskedNumber,
                    last4,
                    expiry: formData.expiry,
                    status: formData.status,
                    memo: formData.memo ?? undefined
                });
                await Swal.fire('수정 완료', '카드 정보가 수정되었습니다.', 'success');
            } else {
                await cardService.createCard({
                    name,
                    issuer,
                    cardType: formData.cardType,
                    maskedNumber,
                    last4,
                    expiry: formData.expiry,
                    status: formData.status,
                    memo: formData.memo ?? undefined
                });
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-[760px] max-h-[90vh] overflow-y-auto border border-slate-200 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900">{initialData ? '카드 정보 수정' : '신규 카드 등록'}</h2>
                        <p className="text-sm text-slate-500 font-medium mt-1">CVC는 절대 저장하지 않으며, 카드번호는 마스킹/끝 4자리만 저장합니다.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-2 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                        닫기
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 mt-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <h3 className="font-extrabold text-slate-800 mb-3">기본 정보</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">카드명</label>
                                <input
                                    className="border border-slate-200 p-2.5 w-full rounded-xl"
                                    value={formData.name}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">발급사</label>
                                <input
                                    className="border border-slate-200 p-2.5 w-full rounded-xl"
                                    value={formData.issuer}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, issuer: e.target.value }))}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">카드 종류</label>
                                <select
                                    className="border border-slate-200 p-2.5 w-full rounded-xl"
                                    value={formData.cardType}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, cardType: e.target.value as CardType }))}
                                >
                                    <option value="CREDIT">신용</option>
                                    <option value="CHECK">체크</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">상태</label>
                                <select
                                    className="border border-slate-200 p-2.5 w-full rounded-xl"
                                    value={formData.status}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as CardStatus }))}
                                >
                                    <option value="AVAILABLE">대기</option>
                                    <option value="ASSIGNED">배정</option>
                                    <option value="SUSPENDED">정지</option>
                                    <option value="CLOSED">해지</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                        <h3 className="font-extrabold text-indigo-900 mb-3">보안 입력</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">마스킹 번호</label>
                                <input
                                    className="border border-slate-200 p-2.5 w-full rounded-xl"
                                    placeholder="1234-****-****-5678"
                                    value={formData.maskedNumber}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, maskedNumber: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">끝 4자리</label>
                                <input
                                    className="border border-slate-200 p-2.5 w-full rounded-xl"
                                    placeholder="5678"
                                    value={formData.last4}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, last4: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">만료(표기용)</label>
                                <input
                                    className="border border-slate-200 p-2.5 w-full rounded-xl"
                                    placeholder="MM/YY"
                                    value={formData.expiry}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, expiry: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">메모</label>
                                <input
                                    className="border border-slate-200 p-2.5 w-full rounded-xl"
                                    value={formData.memo ?? ''}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all ${
                                saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 shadow-indigo-200'
                            }`}
                        >
                            {saving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
