import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Calculator, ChevronLeft, ChevronRight, RefreshCw, Save, X, ExternalLink } from 'lucide-react';
import { corporateTaxService, CorporateTaxSources } from '../../services/corporateTaxService';
import { AMOUNT_COLUMNS, AmountField, AutoField, buildCorporateTaxReport, CorporateTaxManual, CORPORATE_TAX_COMPANIES, CorporateTaxCompany, emptyManual, ManualField } from './corporateTaxModel';
import './CorporateTaxPage.css';
import { useIssueNavigationGuard } from '../taxinvoice/useIssueNavigationGuard';
import { describeCorporateTaxLoadError } from './corporateTaxLoadError';

const money = (value: number) => value.toLocaleString('ko-KR');
const fieldSource = (key: AmountField) => key === 'sales' || key === 'purchases' ? 'ledger' : key === 'lodging' ? key : null;
const getYear = () => Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date()));

function MoneyInput({ label, value, onChange, onValidity, disabled = false, allowNegative = true, decimalPlaces = 0, maxValue = Number.MAX_SAFE_INTEGER }: {
    label: string; value: number; onChange: (value: number) => void; onValidity: (label: string, invalid: boolean) => void; disabled?: boolean; allowNegative?: boolean; decimalPlaces?: number; maxValue?: number;
}) {
    const [draft, setDraft] = useState(value ? money(value) : '');
    const [invalid, setInvalid] = useState(false);
    useEffect(() => { setDraft(value ? money(value) : ''); setInvalid(false); }, [value]);
    return <input aria-label={label} title={invalid ? (decimalPlaces ? '0~100%, 소수 둘째 자리까지 입력해 주세요.' : '원 단위 정수를 입력해 주세요.') : label} aria-invalid={invalid}
        disabled={disabled} inputMode={decimalPlaces ? 'decimal' : 'text'} className="ct-money-input" value={draft} placeholder="0"
        onChange={event => {
            const raw = event.target.value.replace(/,/g, '').trim();
            setDraft(event.target.value);
            const parsed = Number(raw);
            const pattern = decimalPlaces ? new RegExp(`^-?\\d+(?:\\.\\d{1,${decimalPlaces}})?$`) : /^-?\d+$/;
            const bad = (raw !== '' && !pattern.test(raw)) || (decimalPlaces > 0 && raw === '') || !Number.isFinite(parsed)
                || Math.abs(parsed) > maxValue || (!decimalPlaces && !Number.isInteger(parsed)) || (!allowNegative && parsed < 0);
            setInvalid(bad); onValidity(label, bad);
            if (!bad) onChange(parsed);
        }} onBlur={() => { if (!invalid) setDraft(value ? money(value) : ''); }} />;
}

const CorporateTaxPage: React.FC = () => {
    const [year, setYear] = useState(getYear);
    const [company, setCompany] = useState<CorporateTaxCompany>('cheongyeon');
    const companyInfo = CORPORATE_TAX_COMPANIES.find(item => item.key === company)!;
    const sourceLinks = { ledger: companyInfo.ledgerPath, lodging: '/support/accommodation?view=ledger' };
    const [manual, setManual] = useState<CorporateTaxManual>(emptyManual);
    const [revision, setRevision] = useState(0);
    const [manualReady, setManualReady] = useState(false);
    const [manualLoading, setManualLoading] = useState(true);
    const [manualError, setManualError] = useState('');
    const [sources, setSources] = useState<CorporateTaxSources | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [notice, setNotice] = useState('');
    const [invalidFields, setInvalidFields] = useState<string[]>([]);
    const [detail, setDetail] = useState<{ month: number; field: AmountField | 'profit' } | null>(null);
    const generation = useRef(0);
    useIssueNavigationGuard(dirty || invalidFields.length > 0 || saving, () => !saving && window.confirm('저장하지 않은 수기 입력값이 있습니다. 변경사항을 버리고 이동할까요?'));
    const report = useMemo(() => buildCorporateTaxReport(sources?.evidence || [], manual), [sources, manual]);
    const failed = !sources || Object.keys(sources.errors).length > 0;
    const blocked = failed || !manualReady || invalidFields.length > 0;
    const change = (update: (current: CorporateTaxManual) => CorporateTaxManual) => {
        setManual(update); setDirty(true); setNotice('');
    };
    const validity = useCallback((label: string, invalid: boolean) => {
        setInvalidFields(current => invalid ? [...new Set([...current, label])] : current.filter(item => item !== label));
    }, []);
    const loadManual = useCallback(async (requestedYear: number, requestedCompany: CorporateTaxCompany, token: number) => {
        setManualError(''); setManualReady(false); setManualLoading(true);
        try {
            const saved = await corporateTaxService.loadManual(requestedYear, requestedCompany);
            if (generation.current !== token) return;
            setManual(saved.manual); setRevision(saved.revision); setManualReady(true); setDirty(false); setInvalidFields([]);
        } catch (error) {
            if (generation.current === token) setManualError(`수기 저장 자료: ${describeCorporateTaxLoadError(error)}`);
        } finally { if (generation.current === token) setManualLoading(false); }
    }, []);
    const loadSources = useCallback(async (requestedYear: number, requestedCompany: CorporateTaxCompany, token: number) => {
        setLoading(true); setSources(null);
        try {
            const result = await corporateTaxService.loadSources(requestedYear, requestedCompany);
            if (generation.current === token) setSources(result);
        } catch (error) {
            const reason = describeCorporateTaxLoadError(error);
            if (generation.current === token) setSources({ evidence: [], errors: { ledger: `매입·매출 장부: ${reason}`, lodging: `숙소 자료: ${reason}` } });
        } finally { if (generation.current === token) setLoading(false); }
    }, []);
    useEffect(() => {
        const token = ++generation.current;
        setManual(emptyManual()); setRevision(0); setNotice(''); setDetail(null); setDirty(false); setInvalidFields([]);
        void loadManual(year, company, token); void loadSources(year, company, token);
        return () => { generation.current += 1; };
    }, [year, company, loadManual, loadSources]);
    const selectYear = (next: number) => {
        if (next < 2000 || next > 2100 || next === year || saving) return;
        if ((dirty || invalidFields.length > 0) && !window.confirm('저장하지 않은 수기 입력값이 있습니다. 변경사항을 버리고 연도를 이동할까요?')) return;
        setYear(next);
    };
    const selectCompany = (next: CorporateTaxCompany) => {
        if (next === company || saving) return;
        if ((dirty || invalidFields.length > 0) && !window.confirm('저장하지 않은 수기 입력값이 있습니다. 변경사항을 버리고 회사를 이동할까요?')) return;
        setCompany(next);
    };
    const reloadManual = () => {
        if (manualLoading || saving) return;
        if ((dirty || invalidFields.length > 0) && !window.confirm('현재 수기 입력을 버리고 서버에 저장된 자료를 다시 불러올까요?')) return;
        setNotice('');
        void loadManual(year, company, generation.current);
    };
    const save = async () => {
        if (!manualReady || saving || invalidFields.length) return;
        setSaving(true); setNotice('');
        try {
            const next = await corporateTaxService.saveManual(year, manual, revision, company);
            setRevision(next); setDirty(false); setNotice(`${companyInfo.label} ${year}년 수기 입력값을 저장했습니다.`);
        } catch (error) { setNotice(error instanceof Error ? error.message : '저장하지 못했습니다. 입력값은 유지됩니다.'); }
        finally { setSaving(false); }
    };
    const updateAmount = (month: number, field: ManualField, value: number) => change(current => {
        const row = current.months[month] || { amounts: {}, notes: {} };
        return { ...current, months: { ...current.months, [month]: { ...row, amounts: { ...row.amounts, [field]: value } } } };
    });
    const sourceFailed = (key: AmountField, month?: number) => {
        const source = fieldSource(key);
        if (!source) return false;
        if (!sources) return true;
        if (!sources.errors[source]) return false;
        const months = sources.failedMonths?.[source];
        return month === undefined || !months || months.includes(month);
    };
    const monthBlocked = (month: number) => !manualReady || invalidFields.length > 0 || AMOUNT_COLUMNS.some(col => sourceFailed(col.key, month));
    const renderAmount = (key: AmountField, value: number, month?: number) => {
        if (sourceFailed(key, month)) return loading ? '집계 중' : '조회 실패';
        return money(value);
    };
    const details = detail ? (sources?.evidence || []).filter(row => row.month === detail.month && row.field === detail.field) : [];
    const selectedColumn = AMOUNT_COLUMNS.find(col => col.key === detail?.field);
    const selectedMonth = detail ? report.months[detail.month - 1] : null;
    const manualDetail = detail && detail.field !== 'profit' && !selectedColumn?.auto ? detail.field as ManualField : null;
    const origin = detail && detail.field !== 'profit' ? fieldSource(detail.field) : null;

    return <main className="corporate-tax-page">
        <header className="ct-header">
            <div><p className="ct-eyebrow">세무관리 / 연간 정산</p><h1><Calculator size={26} /> 법인세 관리</h1>
                <p>월별 수익과 비용을 모아 보고, 금액을 눌러 산출 근거를 확인하세요.</p></div>
            <div className="ct-actions">
                <button onClick={() => void loadSources(year, company, generation.current)} disabled={loading || saving}><RefreshCw size={16} /> 자동금액 새로고침</button>
                <button onClick={reloadManual} disabled={manualLoading || saving}><RefreshCw size={16} /> {manualLoading ? '저장 자료 불러오는 중…' : '저장 자료 다시 불러오기'}</button>
                <button className="ct-primary" onClick={() => void save()} disabled={!manualReady || saving || !dirty || invalidFields.length > 0}><Save size={16} /> {saving ? '저장 중…' : '수기 입력 저장'}</button>
            </div>
        </header>
        <div className="ct-period-bar">
            <div className="ct-year"><button aria-label="이전 연도" disabled={year <= 2000 || saving} onClick={() => selectYear(year - 1)}><ChevronLeft size={18} /></button>
                <select aria-label="정산 연도" value={year} disabled={saving} onChange={event => selectYear(Number(event.target.value))}>{Array.from({ length: 101 }, (_, i) => 2000 + i).map(y => <option key={y} value={y}>{y}년</option>)}</select>
                <button aria-label="다음 연도" disabled={year >= 2100 || saving} onClick={() => selectYear(year + 1)}><ChevronRight size={18} /></button></div>
            <div className="ct-company-tabs" role="group" aria-label="정산 회사">
                {CORPORATE_TAX_COMPANIES.map(item => <button key={item.key} aria-pressed={company === item.key} disabled={saving} onClick={() => selectCompany(item.key)}>{item.label}</button>)}
            </div><span className="ct-save-status">{dirty ? '저장하지 않은 변경사항' : manualReady ? (revision ? '수기 저장 자료 불러옴' : '새 정산 · 수기 미입력') : '수기 자료 확인 중'}</span>
        </div>
        {notice && <div role="status" className="ct-notice">{notice}</div>}
        {invalidFields.length > 0 && <div role="alert" className="ct-error">{invalidFields.map(label => `${label}: ${label === '적용 예상 세율' ? '0~100%, 소수 둘째 자리까지' : '원 단위 정수를'} 입력해 주세요.`).join(' ')} 입력을 수정하면 이익·세액 계산과 저장이 가능합니다.</div>}
        {manualError && <div role="alert" className="ct-error">{manualError} 상단의 저장 자료 다시 불러오기를 눌러 주세요.</div>}
        {sources && Object.keys(sources.errors).length > 0 && <div role="alert" className="ct-error"><ul>{Object.entries(sources.errors).map(([source, message]) => <li key={source}>{message}</li>)}</ul>조회에 실패한 월의 이익과 연간 합계·예상 세액은 자료를 모두 불러온 뒤 표시합니다.</div>}
        <section className="ct-summary" aria-label="연간 정산 요약">
            {[['연간 매출 · 공급가액', renderAmount('sales', report.totals.sales)], ['전체 비용', blocked ? '확인 필요' : `${money(report.expenses)}원`], ['연간 이익', blocked ? '확인 필요' : `${money(report.profit)}원`], ['예상 납부 법인세', blocked ? '확인 필요' : `${money(report.payableTax)}원`]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </section>
        <section className="ct-sheet" aria-labelledby="ct-sheet-title">
            <div className="ct-sheet-heading"><h2 id="ct-sheet-title">{companyInfo.title} {year}년 정산 내역서</h2><div className="ct-legend"><span className="ct-auto-dot" /> 자동 집계 · 클릭하여 근거 <span className="ct-manual-dot" /> 수기 입력 <span>단위: 원</span></div></div>
            <div className="ct-table-scroll" tabIndex={0} aria-label="월별 정산 표, 좌우로 스크롤할 수 있습니다">
                <table className="ct-table"><thead><tr><th scope="col">월</th>{AMOUNT_COLUMNS.map(col => <th key={col.key} scope="col">{col.label}<small>{col.auto ? (col.key === 'sales' || col.key === 'purchases' ? '공급가액 · 자동' : '월세 + 관리비 · 자동') : '수기 입력'}</small></th>)}<th scope="col">이익<small>자동 계산</small></th></tr></thead>
                    <tbody>{report.months.map(row => <tr key={row.month}><th scope="row">{row.month}월</th>{AMOUNT_COLUMNS.map(col => <td key={col.key} className={col.auto ? 'ct-auto-cell' : 'ct-manual-cell'}>
                        {col.auto ? <button className="ct-amount" onClick={() => setDetail({ month: row.month, field: col.key })} aria-label={`${row.month}월 ${col.label} 근거`}>
                            {renderAmount(col.key, row.amounts[col.key], row.month)}</button>
                            : <><MoneyInput key={`${company}-${year}-${row.month}-${col.key}`} label={`${row.month}월 ${col.label}`} value={row.amounts[col.key]} disabled={!manualReady || saving} onValidity={validity} onChange={value => updateAmount(row.month, col.key as ManualField, value)} />
                                <button className={`ct-note-button ${manual.months[row.month]?.notes[col.key as ManualField] ? 'ct-has-note' : ''}`} onClick={() => setDetail({ month: row.month, field: col.key })} aria-label={`${row.month}월 ${col.label} 입력 근거`}>근거</button></>}
                    </td>)}<td className={`ct-profit ${row.profit < 0 ? 'ct-negative' : ''}`}><button className="ct-amount" onClick={() => setDetail({ month: row.month, field: 'profit' })} aria-label={`${row.month}월 이익 계산 근거`}>{monthBlocked(row.month) ? '—' : money(row.profit)}</button></td></tr>)}</tbody>
                    <tfoot><tr><th scope="row">합계</th>{AMOUNT_COLUMNS.map(col => <td key={col.key}>{col.auto ? renderAmount(col.key, report.totals[col.key]) : manualReady ? money(report.totals[col.key]) : '—'}</td>)}<td className={report.profit < 0 ? 'ct-negative' : ''}>{blocked ? '—' : money(report.profit)}</td></tr></tfoot>
                </table>
            </div>
            <div className="ct-formula">이익 = 매출액 − 매입액 − 계산서발행 − 노무비신고 − 급여 − 카드사용금액 − 숙소비 − 감가상각비 − 경조사비 − 기타비용</div>
        </section>
        <div className="ct-bottom">
            <section className="ct-basis"><h2>집계 기준과 확인할 사항</h2>
                <p><b>매출·매입</b> 거래장 원본의 거래일 기준 공급가액입니다. 부가세와 입출금은 제외하고, 음수 수정 거래는 차감합니다. <Link to={sourceLinks.ledger} target="_blank" rel="noreferrer">원본 장부 <ExternalLink size={12} /></Link></p>
                <p><b>노무비·급여</b> 선택한 회사의 월별 금액을 수기로 입력합니다. 프리랜서 신고·사무실 직원급여 자료는 자동으로 더하지 않습니다.</p>
                <p><b>카드사용금액</b> 회사별로 확인한 금액을 수기로 입력합니다. 카드 원본에 법인 구분이 없어 전체 카드금액을 자동 합산하지 않습니다.</p>
                <p><b>숙소비</b> {companyInfo.label} 명의 숙소의 월세와 관리비만 1~12월 집계합니다. 다른 법인·개인 명의 숙소와 전기·가스·수도·인터넷·기타·보증금은 제외합니다. <Link to={sourceLinks.lodging} target="_blank" rel="noreferrer">숙소 대장 <ExternalLink size={12} /></Link></p>
                <p>숙소의 월별 저장값을 우선하며, 없는 금액은 계약기간 내 월세·고정 관리비 기본값을 반영합니다. 월세에 포함된 관리비는 별도로 더하지 않습니다. 숙소비 금액을 누르면 항목별 근거를 확인할 수 있습니다.</p>
                <p>모든 수기 금액과 근거·메모는 회사·연도별로 저장합니다. 미입력 수기 금액은 0원으로 계산하므로 정산 전 월별 입력을 확인해 주세요. 매입에 이미 포함된 비용을 중복 입력하지 않도록 확인해 주세요.</p>
                <label htmlFor="ct-memo">정산 메모</label><textarea id="ct-memo" value={manual.memo} disabled={!manualReady || saving} maxLength={3000} placeholder="예: 인테리어 비용 중 올해 비용처리 금액 및 산출 근거" onChange={event => change(current => ({ ...current, memo: event.target.value }))} />
            </section>
            <section className="ct-tax-card"><h2>법인세 예상 계산</h2><p>첨부 양식의 10%를 초기값으로 적용합니다. 세무조정 전 참고용 예상액입니다.</p>
                <div><span>적용 예상 세율</span><span><MoneyInput key={`rate-${company}-${year}`} label="적용 예상 세율" value={manual.taxRate} decimalPlaces={2} maxValue={100} allowNegative={false} disabled={!manualReady || saving} onValidity={validity}
                    onChange={taxRate => change(current => ({ ...current, taxRate }))} /> %</span></div>
                <div><span>예상 법인세</span><strong>{blocked ? '확인 필요' : `${money(report.estimatedTax)}원`}</strong></div>
                <div><label>중간예납금액</label><MoneyInput key={`interim-${company}-${year}`} label="중간예납금액" value={manual.interimPayment} allowNegative={false} disabled={!manualReady || saving} onValidity={validity} onChange={value => change(current => ({ ...current, interimPayment: value }))} /></div>
                <div><label>세금공제금액(예상)</label><MoneyInput key={`credit-${company}-${year}`} label="세금공제금액 예상" value={manual.taxCredit} allowNegative={false} disabled={!manualReady || saving} onValidity={validity} onChange={value => change(current => ({ ...current, taxCredit: value }))} /></div>
                <div className="ct-tax-total"><span>납부할 법인세</span><strong>{blocked ? '확인 필요' : `${money(report.payableTax)}원`}</strong></div>
                <small>연간 이익 × 예상 세율 − 중간예납 − 예상 공제액<br />이익이 음수이거나 차감 후 음수이면 0원으로 표시합니다.</small>
            </section>
        </div>
        <Dialog.Root open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><Dialog.Portal><Dialog.Overlay className="ct-dialog-overlay" /><Dialog.Content className="ct-dialog">
            <Dialog.Title>{detail?.month}월 {detail?.field === 'profit' ? '이익 계산' : selectedColumn?.label} 근거</Dialog.Title>
            <Dialog.Description>{manualDetail ? '금액의 출처와 산식을 기록하세요. 수기 입력 저장 버튼으로 함께 저장됩니다.' : detail?.field === 'profit' ? '매출에서 아래 비용 전부를 차감합니다.' : '합계에 반영한 원본별 금액입니다.'}</Dialog.Description>
            <Dialog.Close className="ct-dialog-close" aria-label="근거 닫기"><X size={20} /></Dialog.Close>
            {manualDetail && detail && <><label>수기 입력 금액</label><strong className="ct-detail-total">{money(manual.months[detail.month]?.amounts[manualDetail] || 0)}원</strong><label htmlFor="ct-note">입력 근거</label>
                <textarea id="ct-note" aria-label="입력 근거" maxLength={500} disabled={!manualReady || saving} value={manual.months[detail.month]?.notes[manualDetail] || ''}
                    onChange={event => { const note = event.target.value; change(current => { const row = current.months[detail.month] || { amounts: {}, notes: {} }; return { ...current, months: { ...current.months, [detail.month]: { ...row, notes: { ...row.notes, [manualDetail]: note } } } }; }); }} placeholder="영수증, 계산서 번호, 비용처리 기준 등을 입력하세요." /></>}
            {detail?.field === 'profit' && selectedMonth && <><div className="ct-detail-formula">{AMOUNT_COLUMNS.map(col => <div key={col.key}><span>{col.key === 'sales' ? '+' : '−'} {col.label}</span><strong>{renderAmount(col.key, selectedMonth.amounts[col.key], detail.month)}</strong></div>)}<div><b>이익</b><strong>{monthBlocked(detail.month) ? '확인 필요' : `${money(selectedMonth.profit)}원`}</strong></div></div></>}
            {selectedColumn?.auto && detail && <>
                {sourceFailed(detail.field as AutoField, detail.month) ? <p role="alert">{origin && sources?.errors[origin]} 자동금액 새로고침을 눌러 다시 확인해 주세요.</p> : <>
                    <div className="ct-evidence-scroll"><table className="ct-evidence-table"><thead><tr><th>일자 / 항목</th><th>상세 근거</th><th>반영 금액</th></tr></thead><tbody>{details.map(row => <tr key={row.id}><td>{row.date && <small>{row.date}<br /></small>}{row.label}</td><td>{row.description}</td><td>{money(row.amount)}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>{details.length}건 합계</th><td>{money(details.reduce((sum, row) => sum + row.amount, 0))}원</td></tr></tfoot></table></div>
                    {details.length === 0 && <p>반영할 내역이 없습니다.</p>}</>}
                {origin && <Link className="ct-origin" target="_blank" rel="noreferrer" to={sourceLinks[origin]}>원본 화면 열기 <ExternalLink size={14} /></Link>}
            </>}
        </Dialog.Content></Dialog.Portal></Dialog.Root>
    </main>;
};
export default CorporateTaxPage;
