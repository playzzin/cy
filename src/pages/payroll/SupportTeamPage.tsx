import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarAlt,
    faCircleExclamation,
    faCopy,
    faDownload,
    faFileInvoiceDollar,
    faMoneyCheckDollar,
    faSpinner,
    faTriangleExclamation,
    faUsers,
    faXmark
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import {
    ExternalSupportRow,
    InternalSupportPairRow,
    SupportSettlementResult,
    supportSettlementService
} from '../../services/supportSettlementService';

type SupportTab = 'internal' | 'external';
type DetailState =
    | { kind: 'internal'; row: InternalSupportPairRow }
    | { kind: 'external'; row: ExternalSupportRow }
    | null;

const numberFormatter = new Intl.NumberFormat('ko-KR');
const formatCurrency = (value: number) => `${numberFormatter.format(Math.round(value))}원`;
const formatSignedCurrency = (value: number) => `${value > 0 ? '+' : value < 0 ? '-' : ''}${numberFormatter.format(Math.abs(Math.round(value)))}원`;
const formatManDay = (value: number) => `${Number(value.toFixed(2)).toString()}공수`;
const getDefaultMonth = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};
const teamKey = (id?: string, name?: string) => id || name || '';
const toneClass = (tone: 'emerald' | 'rose' | 'slate') =>
    tone === 'emerald'
        ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700'
        : tone === 'rose'
            ? 'rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700'
            : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700';
const settlementStatus = (row: ExternalSupportRow) =>
    row.netAmount > 0
        ? { tone: 'emerald' as const, label: `받을 것 ${formatCurrency(row.netAmount)}` }
        : row.netAmount < 0
            ? { tone: 'rose' as const, label: `줄 것 ${formatCurrency(Math.abs(row.netAmount))}` }
            : { tone: 'slate' as const, label: '상계' };

const downloadExternalRows = (month: string, rows: ExternalSupportRow[]) => {
    const workbook = XLSX.utils.book_new();
    const summaryRows = [
        ['지원팀정산 외부지원', month],
        [],
        ['외부팀', '외부회사', '줄 것', '받을 것', '정산차액', '은행', '계좌번호', '예금주', '계좌출처', '내부 상대팀', '현장 수', '경고'],
        ...rows.map((row) => [
            row.externalTeamName,
            row.externalCompanyName,
            row.payableAmount,
            row.receivableAmount,
            row.netAmount,
            row.bankName,
            row.accountNumber,
            row.accountHolder,
            row.bankSource === 'company' ? '회사' : row.bankSource === 'leader' ? '팀장' : '없음',
            row.internalTeamNames.join(', '),
            row.siteCount,
            row.warnings.join(', ')
        ]),
        ['합계', '', rows.reduce((sum, row) => sum + row.payableAmount, 0), rows.reduce((sum, row) => sum + row.receivableAmount, 0), rows.reduce((sum, row) => sum + row.netAmount, 0), '', '', '', '', '', '', '']
    ];
    const detailRows = [
        ['외부팀', '구분', '내부팀', '현장', '작업자', '일자', '공수', '단가', '금액'],
        ...rows.flatMap((row) =>
            row.details.map((detail) => [
                row.externalTeamName,
                detail.direction === 'payable' ? '줄 것' : '받을 것',
                detail.internalTeamName,
                detail.siteName,
                detail.workerName,
                detail.date,
                detail.manDay,
                detail.unitPrice,
                detail.amount
            ])
        )
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    const detailSheet = XLSX.utils.aoa_to_sheet(detailRows);
    summarySheet['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 8 }, { wch: 24 }];
    detailSheet['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, '외부지원');
    XLSX.utils.book_append_sheet(workbook, detailSheet, '상세내역');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `지원팀정산_외부지원_${month}.xlsx`);
};

const SupportTeamPage: React.FC = () => {
    const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
    const [activeTab, setActiveTab] = useState<SupportTab>('external');
    const [selectedInternalTeamKey, setSelectedInternalTeamKey] = useState('');
    const [selectedExternalTeamKey, setSelectedExternalTeamKey] = useState('');
    const [warningOnly, setWarningOnly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SupportSettlementResult | null>(null);
    const [detailState, setDetailState] = useState<DetailState>(null);
    const [copyNotice, setCopyNotice] = useState<string | null>(null);

    const fetchSettlement = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setResult(await supportSettlementService.getMonthlySettlement(selectedMonth));
        } catch (fetchError) {
            console.error(fetchError);
            setResult(null);
            setError('지원팀 정산 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        void fetchSettlement();
    }, [fetchSettlement]);

    const internalTeamOptions = useMemo(() => {
        const optionMap = new Map<string, string>();
        result?.internalPairs.forEach((row) => {
            optionMap.set(teamKey(row.providerTeamId, row.providerTeamName), row.providerTeamName);
            optionMap.set(teamKey(row.consumerTeamId, row.consumerTeamName), row.consumerTeamName);
        });
        result?.externalRows.forEach((row) =>
            row.details.forEach((detail) => optionMap.set(teamKey(detail.internalTeamId, detail.internalTeamName), detail.internalTeamName))
        );
        return Array.from(optionMap.entries()).filter(([id]) => id).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    }, [result]);

    const externalTeamOptions = useMemo(
        () => (result?.externalRows ?? []).map((row) => ({ id: teamKey(row.externalTeamId, row.externalTeamName), name: row.externalTeamName })).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')),
        [result]
    );

    useEffect(() => {
        if (selectedInternalTeamKey && !internalTeamOptions.some((option) => option.id === selectedInternalTeamKey)) setSelectedInternalTeamKey('');
    }, [internalTeamOptions, selectedInternalTeamKey]);
    useEffect(() => {
        if (selectedExternalTeamKey && !externalTeamOptions.some((option) => option.id === selectedExternalTeamKey)) setSelectedExternalTeamKey('');
    }, [externalTeamOptions, selectedExternalTeamKey]);

    const internalRows = useMemo(() => {
        let rows = result?.internalPairs ?? [];
        if (selectedInternalTeamKey) {
            rows = rows.filter((row) => [teamKey(row.providerTeamId, row.providerTeamName), teamKey(row.consumerTeamId, row.consumerTeamName)].includes(selectedInternalTeamKey));
        }
        return rows;
    }, [result, selectedInternalTeamKey]);

    const externalRows = useMemo(() => {
        let rows = result?.externalRows ?? [];
        if (selectedInternalTeamKey) rows = rows.filter((row) => row.details.some((detail) => teamKey(detail.internalTeamId, detail.internalTeamName) === selectedInternalTeamKey));
        if (selectedExternalTeamKey) rows = rows.filter((row) => teamKey(row.externalTeamId, row.externalTeamName) === selectedExternalTeamKey);
        if (warningOnly) rows = rows.filter((row) => row.warnings.length > 0);
        return rows;
    }, [result, selectedExternalTeamKey, selectedInternalTeamKey, warningOnly]);

    const bankWarnings = useMemo(() => (result?.externalRows ?? []).filter((row) => row.warnings.length > 0), [result]);
    const internalAmount = internalRows.reduce((sum, row) => sum + row.totalAmount, 0);
    const internalManDay = internalRows.reduce((sum, row) => sum + row.totalManDay, 0);
    const externalPayable = externalRows.reduce((sum, row) => sum + row.payableAmount, 0);
    const externalReceivable = externalRows.reduce((sum, row) => sum + row.receivableAmount, 0);
    const externalNet = externalRows.reduce((sum, row) => sum + row.netAmount, 0);

    const handleCopyExternal = useCallback(async () => {
        if (externalRows.length === 0) return;
        const text = [
            ['외부팀', '외부회사', '줄 것', '받을 것', '정산차액', '은행', '계좌번호', '예금주', '내부 상대팀', '경고'].join('\t'),
            ...externalRows.map((row) => [row.externalTeamName, row.externalCompanyName, row.payableAmount, row.receivableAmount, row.netAmount, row.bankName, row.accountNumber, row.accountHolder, row.internalTeamNames.join(', '), row.warnings.join(', ')].join('\t'))
        ].join('\n');
        try {
            await navigator.clipboard.writeText(text);
            setCopyNotice('외부지원 정산표를 복사했습니다.');
            window.setTimeout(() => setCopyNotice(null), 2500);
        } catch (copyError) {
            console.error(copyError);
            setError('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.');
        }
    }, [externalRows]);

    return (
        <div className="space-y-6 p-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-2xl bg-amber-100 px-4 py-3 text-amber-700"><FontAwesomeIcon icon={faUsers} className="text-2xl" /></div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">지원팀정산</h1>
                                <p className="mt-1 text-sm text-slate-500">일보 작성팀과 작업자 실제 소속팀만 기준으로 내부지원과 외부지원을 다시 정산합니다.</p>
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            {[
                                ['내부지원', '청연 소속팀끼리 주고받은 출력만 남기고 제공팀과 수령팀 쌍으로 묶습니다.'],
                                ['외부지원', '청연 팀과 외부팀 사이 출력만 남기고 외부팀별로 정산합니다.'],
                                ['정산전달', '외부지원은 줄 것, 받을 것, 계좌정보, 차액까지 바로 전달할 수 있게 정리합니다.']
                            ].map(([title, description]) => (
                                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"><FontAwesomeIcon icon={faTriangleExclamation} />{title}</div>
                                    <p className="text-sm leading-6 text-slate-600">{description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <label className="text-sm font-semibold text-slate-700">
                            정산 월
                            <div className="mt-2 flex items-center rounded-xl border border-slate-300 bg-white px-3"><FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-slate-400" /><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="w-full border-none bg-transparent py-2 text-slate-900 focus:outline-none" /></div>
                        </label>
                        <button type="button" onClick={fetchSettlement} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"><FontAwesomeIcon icon={loading ? faSpinner : faTriangleExclamation} spin={loading} />다시 집계</button>
                    </div>
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {[
                    ['내부지원 금액', formatCurrency(result?.stats.internalAmount ?? 0), `${formatManDay(result?.stats.internalManDay ?? 0)} / ${numberFormatter.format(result?.stats.internalPairCount ?? 0)}쌍`, faFileInvoiceDollar, 'amber'],
                    ['외부지원 줄 것', formatCurrency(result?.stats.externalPayableAmount ?? 0), `${numberFormatter.format(result?.stats.externalCount ?? 0)}팀 기준`, faMoneyCheckDollar, 'rose'],
                    ['외부지원 받을 것', formatCurrency(result?.stats.externalReceivableAmount ?? 0), `${numberFormatter.format(result?.stats.externalCount ?? 0)}팀 기준`, faFileInvoiceDollar, 'emerald'],
                    ['외부지원 차액', formatSignedCurrency(result?.stats.externalNetAmount ?? 0), '받을 것 - 줄 것', faUsers, 'slate'],
                    ['계좌 보완 필요', `${numberFormatter.format(result?.stats.bankWarningCount ?? 0)}팀`, '은행, 계좌번호, 예금주 누락', faTriangleExclamation, 'amber']
                ].map(([label, value, detail, icon, tone]) => {
                    const cardLabel = String(label);
                    const cardValue = String(value);
                    const cardDetail = String(detail);
                    const cardTone = String(tone);

                    return (
                    <div key={cardLabel} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl ${cardTone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : cardTone === 'rose' ? 'bg-rose-50 text-rose-700' : cardTone === 'slate' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700'}`}><FontAwesomeIcon icon={icon as any} /></div>
                        <p className="text-sm text-slate-500">{cardLabel}</p>
                        <p className="mt-1 text-xl font-semibold text-slate-900">{cardValue}</p>
                        <p className="mt-1 text-xs text-slate-500">{cardDetail}</p>
                    </div>
                    );
                })}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
                    <label className="text-sm font-medium text-slate-700">청연 내부팀<select value={selectedInternalTeamKey} onChange={(event) => setSelectedInternalTeamKey(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-amber-500 focus:outline-none"><option value="">전체 내부팀</option>{internalTeamOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
                    <label className="text-sm font-medium text-slate-700">외부팀<select value={selectedExternalTeamKey} onChange={(event) => setSelectedExternalTeamKey(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-amber-500 focus:outline-none"><option value="">전체 외부팀</option>{externalTeamOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={warningOnly} onChange={(event) => setWarningOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />계좌 보완 필요만 보기</label>
                    <button type="button" onClick={() => { setSelectedInternalTeamKey(''); setSelectedExternalTeamKey(''); setWarningOnly(false); }} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">필터 초기화</button>
                </div>
                {bankWarnings.length > 0 && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"><FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />{bankWarnings.map((row) => row.externalTeamName).join(', ')} 팀은 외부지원 정산 전에 계좌 정보 보완이 필요합니다.</div>}
                {copyNotice && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{copyNotice}</div>}
            </section>

            {error && <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><FontAwesomeIcon icon={faCircleExclamation} className="mr-2" />{error}</section>}

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setActiveTab('external')} className={`rounded-2xl border px-4 py-3 text-left transition ${activeTab === 'external' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}><div className="text-sm font-semibold">외부지원</div><div className="mt-1 text-xs">줄 것, 받을 것, 계좌정보</div></button>
                    <button type="button" onClick={() => setActiveTab('internal')} className={`rounded-2xl border px-4 py-3 text-left transition ${activeTab === 'internal' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}><div className="text-sm font-semibold">내부지원</div><div className="mt-1 text-xs">청연 팀 간 지원 정산</div></button>
                </div>

                {loading ? <div className="flex items-center justify-center py-16 text-slate-500"><FontAwesomeIcon icon={faSpinner} spin className="mr-2 text-amber-600" />정산 데이터를 집계하고 있습니다.</div> : activeTab === 'external' ? (
                    <div className="mt-6 space-y-4">
                        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div><h2 className="text-lg font-semibold text-slate-900">외부지원 정산표</h2><p className="mt-1 text-sm text-slate-500">현재 조건 기준 줄 것 {formatCurrency(externalPayable)}, 받을 것 {formatCurrency(externalReceivable)}, 차액 {formatSignedCurrency(externalNet)}</p></div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" disabled={externalRows.length === 0} onClick={handleCopyExternal} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"><FontAwesomeIcon icon={faCopy} />정산표 복사</button>
                                <button type="button" disabled={externalRows.length === 0} onClick={() => downloadExternalRows(selectedMonth, externalRows)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"><FontAwesomeIcon icon={faDownload} />엑셀 다운로드</button>
                            </div>
                        </div>
                        {externalRows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">조건에 맞는 외부지원 정산이 없습니다.</div> : <div className="overflow-x-auto"><table className="min-w-[1280px] text-sm"><thead><tr className="bg-slate-100 text-left text-xs font-semibold text-slate-600"><th className="border border-slate-200 px-3 py-3">외부팀</th><th className="border border-slate-200 px-3 py-3">외부회사</th><th className="border border-slate-200 px-3 py-3">내부 상대팀</th><th className="border border-slate-200 px-3 py-3 text-right">줄 것</th><th className="border border-slate-200 px-3 py-3 text-right">받을 것</th><th className="border border-slate-200 px-3 py-3 text-right">정산차액</th><th className="border border-slate-200 px-3 py-3">은행 / 계좌 / 예금주</th><th className="border border-slate-200 px-3 py-3">상태</th><th className="border border-slate-200 px-3 py-3 text-center">상세</th></tr></thead><tbody>{externalRows.map((row) => { const status = settlementStatus(row); return <tr key={row.key} className="border-b border-slate-100 align-top"><td className="border border-slate-200 px-3 py-3"><div className="font-semibold text-slate-900">{row.externalTeamName}</div><div className="mt-1 text-xs text-slate-500">현장 {row.siteCount}곳</div></td><td className="border border-slate-200 px-3 py-3 text-slate-700">{row.externalCompanyName || '-'}</td><td className="border border-slate-200 px-3 py-3 text-slate-700">{row.internalTeamNames.join(', ') || '-'}</td><td className="border border-slate-200 px-3 py-3 text-right font-semibold text-rose-600">{formatCurrency(row.payableAmount)}</td><td className="border border-slate-200 px-3 py-3 text-right font-semibold text-emerald-700">{formatCurrency(row.receivableAmount)}</td><td className="border border-slate-200 px-3 py-3 text-right"><div className="font-semibold text-slate-900">{formatSignedCurrency(row.netAmount)}</div><div className={`mt-2 inline-flex ${toneClass(status.tone)}`}>{status.label}</div></td><td className="border border-slate-200 px-3 py-3 text-slate-700"><div>{row.bankName || '-'}</div><div className="mt-1 font-mono text-xs text-slate-500">{row.accountNumber || '계좌번호 없음'}</div><div className="mt-1 text-xs text-slate-500">{row.accountHolder || '예금주 없음'} / {row.bankSource === 'company' ? '회사' : row.bankSource === 'leader' ? '팀장' : '없음'}</div></td><td className="border border-slate-200 px-3 py-3">{row.warnings.length === 0 ? <span className={toneClass('emerald')}>전달 가능</span> : <div className="flex flex-wrap gap-1.5">{row.warnings.map((warning) => <span key={`${row.key}-${warning}`} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">{warning}</span>)}</div>}</td><td className="border border-slate-200 px-3 py-3 text-center"><button type="button" onClick={() => setDetailState({ kind: 'external', row })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">상세보기</button></td></tr>; })}</tbody></table></div>}
                    </div>
                ) : (
                    <div className="mt-6 space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h2 className="text-lg font-semibold text-slate-900">내부지원 정산표</h2><p className="mt-1 text-sm text-slate-500">현재 조건 기준 내부지원 금액 {formatCurrency(internalAmount)} / {formatManDay(internalManDay)}</p></div>
                        {internalRows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-sm text-slate-500">조건에 맞는 내부지원 정산이 없습니다.</div> : <div className="overflow-x-auto"><table className="min-w-[900px] text-sm"><thead><tr className="bg-slate-100 text-left text-xs font-semibold text-slate-600"><th className="border border-slate-200 px-3 py-3">지원 제공팀</th><th className="border border-slate-200 px-3 py-3">지원 받은팀</th><th className="border border-slate-200 px-3 py-3">현장</th><th className="border border-slate-200 px-3 py-3 text-right">건수</th><th className="border border-slate-200 px-3 py-3 text-right">공수</th><th className="border border-slate-200 px-3 py-3 text-right">금액</th><th className="border border-slate-200 px-3 py-3 text-center">상세</th></tr></thead><tbody>{internalRows.map((row) => <tr key={row.key} className="border-b border-slate-100"><td className="border border-slate-200 px-3 py-3 font-semibold text-slate-900">{row.providerTeamName}</td><td className="border border-slate-200 px-3 py-3 font-semibold text-slate-900">{row.consumerTeamName}</td><td className="border border-slate-200 px-3 py-3 text-slate-600">{row.siteNames.join(', ')}</td><td className="border border-slate-200 px-3 py-3 text-right text-slate-700">{numberFormatter.format(row.entryCount)}건</td><td className="border border-slate-200 px-3 py-3 text-right text-slate-700">{formatManDay(row.totalManDay)}</td><td className="border border-slate-200 px-3 py-3 text-right font-semibold text-slate-900">{formatCurrency(row.totalAmount)}</td><td className="border border-slate-200 px-3 py-3 text-center"><button type="button" onClick={() => setDetailState({ kind: 'internal', row })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">상세보기</button></td></tr>)}</tbody></table></div>}
                    </div>
                )}
            </section>

            {detailState && <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"><div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">{detailState.kind === 'external' ? '외부지원 상세' : '내부지원 상세'}</h3><button type="button" onClick={() => setDetailState(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="닫기"><FontAwesomeIcon icon={faXmark} className="text-lg" /></button></div><div className="overflow-y-auto p-6">{detailState.kind === 'external' ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-5">{[['외부팀', detailState.row.externalTeamName], ['줄 것', formatCurrency(detailState.row.payableAmount)], ['받을 것', formatCurrency(detailState.row.receivableAmount)], ['차액', formatSignedCurrency(detailState.row.netAmount)], ['경고', detailState.row.warnings.join(', ') || '없음']].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs font-medium text-slate-500">{label}</div><div className="mt-2 text-sm font-semibold text-slate-900">{value}</div></div>)}</div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">은행 {detailState.row.bankName || '-'} / 계좌번호 {detailState.row.accountNumber || '-'} / 예금주 {detailState.row.accountHolder || '-'}</div><div className="overflow-x-auto"><table className="min-w-[960px] text-sm"><thead><tr className="bg-slate-100 text-left text-xs font-semibold text-slate-600"><th className="border border-slate-200 px-3 py-2">구분</th><th className="border border-slate-200 px-3 py-2">내부팀</th><th className="border border-slate-200 px-3 py-2">현장</th><th className="border border-slate-200 px-3 py-2">작업자</th><th className="border border-slate-200 px-3 py-2">일자</th><th className="border border-slate-200 px-3 py-2 text-right">공수</th><th className="border border-slate-200 px-3 py-2 text-right">단가</th><th className="border border-slate-200 px-3 py-2 text-right">금액</th></tr></thead><tbody>{detailState.row.details.map((detail) => <tr key={detail.key} className="border-b border-slate-100"><td className="border border-slate-200 px-3 py-2"><span className={toneClass(detail.direction === 'payable' ? 'rose' : 'emerald')}>{detail.direction === 'payable' ? '줄 것' : '받을 것'}</span></td><td className="border border-slate-200 px-3 py-2">{detail.internalTeamName}</td><td className="border border-slate-200 px-3 py-2">{detail.siteName}</td><td className="border border-slate-200 px-3 py-2">{detail.workerName}</td><td className="border border-slate-200 px-3 py-2">{detail.date}</td><td className="border border-slate-200 px-3 py-2 text-right">{formatManDay(detail.manDay)}</td><td className="border border-slate-200 px-3 py-2 text-right">{formatCurrency(detail.unitPrice)}</td><td className="border border-slate-200 px-3 py-2 text-right font-semibold">{formatCurrency(detail.amount)}</td></tr>)}</tbody></table></div></div> : <div className="space-y-4"><div className="grid gap-4 md:grid-cols-4">{[['지원 제공팀', detailState.row.providerTeamName], ['지원 받은팀', detailState.row.consumerTeamName], ['공수', formatManDay(detailState.row.totalManDay)], ['금액', formatCurrency(detailState.row.totalAmount)]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs font-medium text-slate-500">{label}</div><div className="mt-2 text-sm font-semibold text-slate-900">{value}</div></div>)}</div><div className="overflow-x-auto"><table className="min-w-[760px] text-sm"><thead><tr className="bg-slate-100 text-left text-xs font-semibold text-slate-600"><th className="border border-slate-200 px-3 py-2">일자</th><th className="border border-slate-200 px-3 py-2">현장</th><th className="border border-slate-200 px-3 py-2">작업자</th><th className="border border-slate-200 px-3 py-2 text-right">공수</th><th className="border border-slate-200 px-3 py-2 text-right">단가</th><th className="border border-slate-200 px-3 py-2 text-right">금액</th></tr></thead><tbody>{detailState.row.details.map((detail) => <tr key={detail.key} className="border-b border-slate-100"><td className="border border-slate-200 px-3 py-2">{detail.date}</td><td className="border border-slate-200 px-3 py-2">{detail.siteName}</td><td className="border border-slate-200 px-3 py-2">{detail.workerName}</td><td className="border border-slate-200 px-3 py-2 text-right">{formatManDay(detail.manDay)}</td><td className="border border-slate-200 px-3 py-2 text-right">{formatCurrency(detail.unitPrice)}</td><td className="border border-slate-200 px-3 py-2 text-right font-semibold">{formatCurrency(detail.amount)}</td></tr>)}</tbody></table></div></div>}</div></div></div>}
        </div>
    );
};

export default SupportTeamPage;
