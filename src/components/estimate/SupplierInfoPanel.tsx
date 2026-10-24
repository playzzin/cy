import React, { useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import type { EstimateDraft } from '../../utils/estimateUtils';

type SupplierField = Extract<keyof EstimateDraft, `supplier${string}`>;

const SUPPLIER_FIELDS: { field: SupplierField; label: string; wide?: boolean; phone?: boolean }[] = [
    { field: 'supplierCompany', label: '상호' },
    { field: 'supplierBizNo', label: '사업자등록번호' },
    { field: 'supplierName', label: '대표자' },
    { field: 'supplierContact', label: '전화', phone: true },
    { field: 'supplierAddress', label: '주소', wide: true },
    { field: 'supplierFax', label: '팩스', phone: true },
    { field: 'supplierManager', label: '담당자' },
    { field: 'supplierAccount', label: '은행 / 계좌번호', wide: true },
    { field: 'supplierManagerContact', label: '담당자 연락처', wide: true, phone: true },
];

interface SupplierInfoPanelProps {
    draft: EstimateDraft;
    updateDraft: (field: SupplierField, value: string) => void;
    disabled?: boolean;
}

export const SupplierInfoPanel: React.FC<SupplierInfoPanelProps> = ({ draft, updateDraft, disabled = false }) => {
    const [expanded, setExpanded] = useState(false);
    const id = useId();
    const isTransaction = draft.documentType === 'transaction';
    const activeClass = isTransaction ? 'border-teal-600 text-teal-700' : 'border-indigo-600 text-indigo-700';
    const inputClass = isTransaction
        ? 'focus:border-teal-500 focus:ring-teal-500/10'
        : 'focus:border-indigo-500 focus:ring-indigo-500/10';

    return (
        <section className="flex-none border-b border-slate-200 bg-white print:hidden" aria-label="공급자 정보 편집">
            <div className="flex items-center gap-4 px-6">
                <button
                    id={`${id}-toggle`}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`${id}-fields`}
                    onClick={() => setExpanded(value => !value)}
                    className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-[14px] font-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${expanded ? activeClass : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
                >
                    <FontAwesomeIcon icon={faBuilding} />
                    공급자 정보
                    <FontAwesomeIcon icon={faChevronDown} className={`text-[11px] transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                <span className="min-w-0 truncate text-[13px] font-medium text-slate-500">{draft.supplierCompany || '공급자 정보를 입력해 주세요'}</span>
                <span className="ml-auto hidden shrink-0 text-[12px] text-slate-400 sm:block">{expanded ? '변경 후 상단 저장 버튼을 눌러 주세요' : '눌러서 바로 수정'}</span>
            </div>
            <div id={`${id}-fields`} hidden={!expanded}>
                <div className="max-h-[40vh] overflow-y-auto border-t border-slate-100 bg-slate-50/70 px-6 py-4">
                    <p className="mb-3 text-[13px] text-slate-500">
                        현재 {isTransaction ? '거래명세표' : '견적서'}에 사용할 공급자 정보입니다. 수정한 내용은 문서에 바로 반영되며, 상단 저장 버튼을 누르면 함께 저장됩니다.
                    </p>
                    <fieldset disabled={disabled} className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                        <legend className="sr-only">공급자 정보 입력</legend>
                        {SUPPLIER_FIELDS.map(({ field, label, wide, phone }) => (
                            <label key={field} className={`block min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
                                <span className="mb-1 block text-[13px] font-bold text-slate-600">{label}</span>
                                <input
                                    type={phone ? 'tel' : 'text'}
                                    name={field}
                                    value={draft[field] || ''}
                                    onChange={event => updateDraft(field, event.target.value)}
                                    placeholder={field === 'supplierAccount' ? '은행명 계좌번호' : label}
                                    className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none transition-colors focus:ring-4 disabled:bg-slate-100 disabled:text-slate-400 ${inputClass}`}
                                />
                            </label>
                        ))}
                    </fieldset>
                </div>
            </div>
        </section>
    );
};
