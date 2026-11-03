import React, { useState } from 'react';
import type { RentalCatalogEntry } from '../../services/rentalCatalogService';
import type { RentalWorkType } from '../../utils/rentalTransactionGenerator';

interface RentalCatalogSettingsProps {
    rates: RentalCatalogEntry[];
    workType: RentalWorkType;
    needsRegistration?: boolean;
    onSave: (next: RentalCatalogEntry[]) => Promise<void>;
    onInsert: (rate: RentalCatalogEntry) => void;
}

const WORK_TYPES: Record<RentalWorkType, string> = { shoring: '시스템동바리', scaffold: '시스템비계' };
const TEXT_FIELDS = [
    { key: 'itemName', label: '품목', width: 'w-40' },
    { key: 'spec', label: '규격', width: 'w-40' },
    { key: 'unit', label: '단위', width: 'w-16' },
] as const;
const NUMBER_FIELDS = [
    { key: 'quantity', label: '기본 수량', min: 1 },
    { key: 'baseFee', label: '기본료', min: 0 },
    { key: 'dailyFee', label: '일단가', min: 0 },
    { key: 'maxQuantity', label: '자동생성 최대수량', min: 1 },
] as const;
const INPUT_CLASS = 'h-9 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 focus:border-amber-500 focus:outline-none';
const BUTTON_CLASS = 'rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold hover:border-amber-400 disabled:cursor-default disabled:opacity-50';

export default function RentalCatalogSettings({ rates, workType, needsRegistration = false, onSave, onInsert }: RentalCatalogSettingsProps) {
    const [draft, setDraft] = useState<RentalCatalogEntry[] | null>(null);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const rows = draft ?? rates;
    const query = search.trim().toLowerCase();
    const visibleRows = rows.filter(row => row.workType === workType && `${row.itemName} ${row.spec}`.toLowerCase().includes(query));

    function updateRow(id: string, changes: Partial<RentalCatalogEntry>) {
        setDraft(current => (current ?? rates).map(row => row.materialId === id ? { ...row, ...changes } : row));
        setError('');
        setNotice('');
    }

    function addRow() {
        const row: RentalCatalogEntry = {
            materialId: `rental-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            workType, category: WORK_TYPES[workType], itemName: '', spec: '', unit: 'EA',
            quantity: 1, baseFee: 0, dailyFee: 0, maxQuantity: 5000, active: true,
        };
        setDraft(current => [row, ...(current ?? rates)]);
        setSearch('');
        setError('');
        setNotice('');
    }

    async function save() {
        const invalid = rows.find(row => !row.itemName.trim() || !row.unit.trim() || NUMBER_FIELDS.some(field =>
            !Number.isSafeInteger(row[field.key]) || row[field.key] < field.min
        ));
        if (invalid) {
            setError(`${WORK_TYPES[invalid.workType]} ${invalid.itemName || '새 품목'}의 품목명, 단위, 수량 및 금액을 확인하세요. 수량은 1 이상, 금액은 0 이상의 정수로 입력하세요.`);
            return;
        }
        setSaving(true);
        setError('');
        setNotice('');
        try {
            await onSave(rows);
            setDraft(null);
            setNotice('임대거래자재를 저장했습니다.');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '임대거래자재를 저장하지 못했습니다. 다시 시도하세요.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <fieldset disabled={saving} aria-busy={saving} className="mt-5 min-w-0 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-black text-slate-900">{WORK_TYPES[workType]} 임대거래자재 설정</h3>
                    <p className="mt-1 text-sm text-slate-600">기본 수량은 거래표에 넣을 때 사용합니다. 견적서에 단위가 없어 EA로 설정했습니다.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={BUTTON_CLASS} onClick={addRow}>품목 추가</button>
                    <button type="button" className={BUTTON_CLASS} disabled={!draft} onClick={() => { setDraft(null); setError(''); setNotice('변경을 취소했습니다.'); }}>변경 취소</button>
                    <button type="button" className={`${BUTTON_CLASS} border-amber-600 bg-amber-600 text-white`} disabled={!draft && !needsRegistration} onClick={save}>
                        {saving ? '저장 중…' : needsRegistration ? '견적 품목 DB 등록' : '설정 저장'}
                    </button>
                </div>
            </div>
            <div className="my-3 flex flex-wrap items-center gap-3">
                <input type="search" aria-label="품목·규격 검색" placeholder="품목·규격 검색" value={search} onChange={e => setSearch(e.target.value)} className={`${INPUT_CLASS} w-full sm:w-64`} />
                {error && <span role="alert" className="text-sm font-bold text-rose-700">{error}</span>}
                <span role="status" className="text-sm font-bold text-slate-600">{notice || (draft ? '변경사항을 저장하면 거래표에 사용할 수 있습니다.' : needsRegistration ? '견적 품목을 DB에 등록한 뒤 거래표에 넣을 수 있습니다.' : '')}</span>
            </div>
            <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
                <table aria-label={`${WORK_TYPES[workType]} 자재 목록`} className="w-full whitespace-nowrap text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                        <tr>{['거래표', '사용', ...TEXT_FIELDS.map(f => f.label), ...NUMBER_FIELDS.map(f => f.label)].map(label => <th key={label} scope="col" className="px-3 py-2">{label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {visibleRows.map(row => (
                            <tr key={row.materialId} className="hover:bg-amber-50/50">
                                <td className="p-2"><button type="button" className={BUTTON_CLASS} disabled={!!draft || needsRegistration || !row.active || row.dailyFeeMissing} onClick={() => { onInsert(row); setNotice(`${row.itemName} ${row.spec} 품목을 거래표에 넣었습니다.`); }}>거래표에 넣기</button></td>
                                <td className="p-2 text-center"><input type="checkbox" aria-label="사용" checked={row.active} disabled={row.dailyFeeMissing} onChange={e => updateRow(row.materialId, { active: e.target.checked })} /></td>
                                {TEXT_FIELDS.map(field => <td key={field.key} className="p-2"><input aria-label={field.label} className={`${INPUT_CLASS} ${field.width}`} value={row[field.key]} onChange={e => updateRow(row.materialId, { [field.key]: e.target.value })} /></td>)}
                                {NUMBER_FIELDS.map(field => {
                                    const value = row[field.key];
                                    const missingDailyFee = field.key === 'dailyFee' && row.dailyFeeMissing;
                                    return <td key={field.key} className="p-2"><input type="number" aria-label={field.label} min={field.min} step={1} value={missingDailyFee || !Number.isFinite(value) ? '' : value}
                                        placeholder={missingDailyFee ? '미기재' : undefined} className={`${INPUT_CLASS} w-24 text-right`}
                                        onChange={e => {
                                            if (field.key === 'dailyFee' && e.target.value === '') {
                                                updateRow(row.materialId, { dailyFee: 0, dailyFeeMissing: true, active: false });
                                            } else {
                                                updateRow(row.materialId, { [field.key]: e.target.valueAsNumber, ...(field.key === 'dailyFee' && { dailyFeeMissing: false }) });
                                            }
                                        }} /></td>;
                                })}
                            </tr>
                        ))}
                        {!visibleRows.length && <tr><td colSpan={9} className="p-5 text-center text-slate-500">{query ? '검색 결과가 없습니다.' : '등록된 품목이 없습니다.'}</td></tr>}
                    </tbody>
                </table>
            </div>
        </fieldset>
    );
}
