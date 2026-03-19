import React, { forwardRef } from 'react';

interface WorkerWorkEntry {
    date: string;
    siteId?: string;
    siteName: string;
    manDay: number;
    unitPrice: number;
    description?: string;
    paymentMethod?: string;
    amount: number;
}

interface DeductionLine {
    label: string;
    amount: number;
}

interface DeductionBreakdown {
    standardLines: DeductionLine[];
    additionalLines: DeductionLine[];
    totalStandard?: number;
    totalAdditional?: number;
    total: number;
    hasData: boolean;
}

const TEMP_WITHHOLDING_PREFIX = '[원천세]';

type InsuranceAppliedReason = 'site' | 'client' | 'threshold' | 'manual' | 'all-labor';

interface InsuranceAppliedSiteSummary {
    siteId: string;
    siteName: string;
    clientCompanyId?: string;
    manDay: number;
    amount: number;
    reason?: InsuranceAppliedReason;
}

interface InsuranceAppliedSummary {
    thresholdManDay?: number;
    appliedManDay: number;
    appliedAmount: number;
    appliedSites?: InsuranceAppliedSiteSummary[];
}

interface BusinessIncomeAppliedSiteSummary {
    siteId: string;
    siteName: string;
    manDay: number;
    amount: number;
    reason?: '4대보험_제외';
}

interface BusinessIncomeAppliedSummary {
    appliedManDay?: number;
    appliedAmount: number;
    appliedSites?: BusinessIncomeAppliedSiteSummary[];
}

interface WithholdingAppliedSiteSummary {
    siteId: string;
    siteName: string;
    manDay: number;
    amount: number;
    reason?: '노무7이하' | '노무전체';
}

interface WithholdingAppliedSummary {
    thresholdManDay?: number;
    thresholdDays?: number;
    appliedManDay?: number;
    appliedAmount: number;
    grossAmount?: number;
    appliedSites?: WithholdingAppliedSiteSummary[];
}

interface TaxRateSnapshot {
    pensionRate: number;
    healthRate: number;
    careRateOfHealth?: number;
    employmentRate: number;
    incomeTaxRate: number;
    residentTaxRate: number;
    withholdingBaseDeduction?: number;
    withholdingIncomeBaseMultiplier?: number;
    businessIncomeTaxRate?: number;
    businessResidentTaxRate?: number;
}

export interface PaymentData {
    personalMemo?: string;
    workerId: string;
    workerName: string;
    idNumber?: string;
    companyId?: string;
    companyName?: string;
    teamId?: string;
    teamName?: string;
    month: string;
    totalManDay: number;
    unitPrice: number;
    grossAmount: number;
    totalDeduction: number;
    totalAmount: number;
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    accountHolder?: string;
    displayContent: string;
    workEntries: WorkerWorkEntry[];
    deductionBreakdown: DeductionBreakdown;
    taxBreakdown?: DeductionBreakdown;
    taxRateSnapshot?: TaxRateSnapshot;
    insuranceAppliedSummary?: InsuranceAppliedSummary;
    withholdingAppliedSummary?: WithholdingAppliedSummary;
    businessIncomeAppliedSummary?: BusinessIncomeAppliedSummary;
    isValid: boolean;
    errors: {
        bankName?: boolean;
        bankCode?: boolean;
        accountNumber?: boolean;
        accountHolder?: boolean;
    };
}

interface Props {
    data: PaymentData;
    month: string;
    applyUtilities?: boolean;
    insuranceTeamSiteOnly?: boolean;
    isTeamResponsibleSiteEntry?: (entry: WorkerWorkEntry, teamId?: string, teamName?: string) => boolean;
}

export const PayslipTemplate = forwardRef<HTMLDivElement, Props>(({ data, month, applyUtilities = false, insuranceTeamSiteOnly = false, isTeamResponsibleSiteEntry }, ref) => {
    const workEntries = data.workEntries ?? [];
    const deductionBreakdown = data.deductionBreakdown ?? {
        standardLines: [],
        additionalLines: [],
        totalStandard: 0,
        totalAdditional: 0,
        total: 0,
        hasData: false
    };
    const taxBreakdown = data.taxBreakdown ?? {
        standardLines: [],
        additionalLines: [],
        totalStandard: 0,
        totalAdditional: 0,
        total: 0,
        hasData: false
    };
    const taxLines: DeductionLine[] = [...taxBreakdown.standardLines, ...taxBreakdown.additionalLines];
    const isInsuranceSectionTaxLabel = (labelRaw: string): boolean => {
        const label = String(labelRaw ?? '').trim();
        if (!label) return false;
        return label.startsWith('[4대보험]');
    };
    const isWithholdingSectionTaxLabel = (labelRaw: string): boolean => {
        const label = String(labelRaw ?? '').trim();
        if (!label) return false;
        return label.startsWith('[원천세]') || label.startsWith('[세금]');
    };
    const isBusinessSectionTaxLabel = (labelRaw: string): boolean => {
        const label = String(labelRaw ?? '').trim();
        if (!label) return false;
        return label.startsWith('[3.0%]') || label.startsWith('[0.3%]');
    };
    const insuranceTaxLines = taxLines.filter((line) => isInsuranceSectionTaxLabel(line.label));
    const withholdingTaxLines = taxLines.filter((line) => isWithholdingSectionTaxLabel(line.label));
    const businessTaxLines = taxLines.filter((line) => isBusinessSectionTaxLabel(line.label));
    const otherTaxLines = taxLines.filter((line) => (
        !isInsuranceSectionTaxLabel(line.label)
        && !isWithholdingSectionTaxLabel(line.label)
        && !isBusinessSectionTaxLabel(line.label)
    ));
    const insuranceSectionTaxTotal = insuranceTaxLines.reduce((sum, line) => sum + line.amount, 0);
    const withholdingSectionTaxTotal = withholdingTaxLines.reduce((sum, line) => sum + line.amount, 0);
    const businessSectionTaxTotal = businessTaxLines.reduce((sum, line) => sum + line.amount, 0);
    const otherTaxTotal = otherTaxLines.reduce((sum, line) => sum + line.amount, 0);
    const insuranceAfterTaxAmount = Math.max(0, Math.floor((data.insuranceAppliedSummary?.appliedAmount ?? 0) - insuranceSectionTaxTotal));
    const withholdingGrossAmount = data.withholdingAppliedSummary
        ? Math.floor(data.withholdingAppliedSummary.grossAmount ?? data.withholdingAppliedSummary.appliedAmount)
        : 0;
    const withholdingAfterTaxAmount = Math.max(0, withholdingGrossAmount - withholdingSectionTaxTotal);
    const businessAfterTaxAmount = Math.max(0, Math.floor((data.businessIncomeAppliedSummary?.appliedAmount ?? 0) - businessSectionTaxTotal));
    const showInsuranceSection = insuranceTaxLines.length > 0;
    const hasInsuranceTargetSummary = Boolean(data.insuranceAppliedSummary && data.insuranceAppliedSummary.appliedManDay > 0);
    const insuranceScopeLabel = insuranceTeamSiteOnly ? '적용범위: 팀 매칭 현장' : '적용범위: 전체 기준';
    const utilityDeductionLabels = new Set(['숙소비', '전기세', '도시가스', '수도세', '인터넷', '관리비', '과태료', '기타']);
    const allDeductionLines = [...deductionBreakdown.standardLines, ...deductionBreakdown.additionalLines];
    const utilityDeductionLines = allDeductionLines
        .filter((line) => utilityDeductionLabels.has(String(line.label ?? '').trim()));
    const nonUtilityDeductionLines = allDeductionLines
        .filter((line) => !utilityDeductionLabels.has(String(line.label ?? '').trim()));
    const utilitySectionTotal = utilityDeductionLines.reduce((sum, line) => sum + line.amount, 0);
    const showUtilitySection = applyUtilities || utilitySectionTotal > 0;

    const totalWorkManDay = workEntries.reduce((sum: number, entry: WorkerWorkEntry) => sum + entry.manDay, 0);

    const formatRatePercent = (rate: number, maxFractionDigits: number = 3): string => {
        if (!Number.isFinite(rate)) return '-';
        const percent = rate * 100;
        const text = percent.toLocaleString('ko-KR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: maxFractionDigits
        });
        return `${text}%`;
    };

    const resolveTaxLineRateText = (lineLabel: string, snapshot?: TaxRateSnapshot): string => {
        const label = String(lineLabel ?? '').trim();
        if (!label) return '-';

        const prefixed = label.match(/^\[(\d+(?:\.\d+)?)%\]/);
        if (prefixed) return `${prefixed[1]}%`;

        if (!snapshot) return '-';

        if (label.startsWith('[4대보험]')) {
            if (label.includes('국민연금')) return formatRatePercent(snapshot.pensionRate, 2);
            if (label.includes('건강보험')) return formatRatePercent(snapshot.healthRate, 3);
            if (label.includes('장기요양')) return formatRatePercent(snapshot.careRateOfHealth, 2);
            if (label.includes('고용보험')) return formatRatePercent(snapshot.employmentRate, 3);
        }
        if (label.startsWith('[원천세]') || label.startsWith('[세금]')) {
            const incomeRate = formatRatePercent(snapshot.incomeTaxRate, 2);
            const residentRate = formatRatePercent(snapshot.residentTaxRate, 2);
            if (label.includes('근로소득세') || label.includes('갑근세')) return incomeRate;
            if (label.includes('지방소득세') || label.includes('지방세')) return residentRate;
        }
        if (label.includes('사업소득세')) return formatRatePercent(snapshot.businessIncomeTaxRate, 1);
        if (label.includes('소득세')) return formatRatePercent(snapshot.businessResidentTaxRate, 1);

        return '-';
    };

    const resolveWithholdingDetailText = (snapshot?: TaxRateSnapshot): string => {
        const deduction = Math.max(0, Math.floor(Number(snapshot?.withholdingBaseDeduction ?? 150000))).toLocaleString('ko-KR');
        const incomeRate = formatRatePercent(Number(snapshot?.incomeTaxRate ?? 0.06), 2);
        const taxCredit = formatRatePercent(Number(snapshot?.withholdingIncomeBaseMultiplier ?? 0.55), 2);
        const residentRate = formatRatePercent(Number(snapshot?.residentTaxRate ?? 0.1), 2);
        return `상세: (단가-${deduction})×${incomeRate}×(1-${taxCredit}), 지방세=갑근세×${residentRate}`;
    };
    const withholdingDetailText = resolveWithholdingDetailText(data.taxRateSnapshot);

    return (
        <div ref={ref} className="bg-white border-2 border-slate-200 rounded-xl shadow-sm w-full max-w-none mx-auto text-slate-900 mb-8 page-break-inside-avoid">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white text-center py-4 rounded-t-xl print:bg-purple-700 print:text-white">
                <h2 className="text-xl font-bold">{month} 노임명세서</h2>
                <p className="text-xs mt-1 font-medium text-white/80">근무내역 · 가불항목 · 총공제까지 한 번에 확인</p>
                {insuranceTeamSiteOnly && (
                    <div className="mt-2 inline-flex items-center rounded-full border border-white/40 bg-white/20 px-3 py-1 text-[11px] font-semibold text-white">
                        4대보험 기준: 팀 매칭 현장만 공제
                    </div>
                )}
            </div>

            {/* Employee Info */}
            <section className="border-b border-slate-200">
                <div className="text-center py-2 font-semibold text-slate-700 bg-slate-50 border-b border-slate-200">사원 정보</div>
                <div className="grid grid-cols-4 text-sm">
                    <div className="border-r border-b border-slate-200 p-2 text-center font-medium bg-slate-50">성명</div>
                    <div className="border-r border-b border-slate-200 p-2 text-center font-bold">{data.workerName}</div>
                    <div className="border-r border-b border-slate-200 p-2 text-center font-medium bg-slate-50">팀</div>
                    <div className="border-b border-slate-200 p-2 text-center">{data.teamName}</div>
                </div>
                <div className="grid grid-cols-4 text-sm">
                    <div className="border-r border-b border-slate-200 p-2 text-center font-medium bg-slate-50">주민번호</div>
                    <div className="border-r border-b border-slate-200 p-2 text-center font-mono">{data.idNumber || '-'}</div>
                    <div className="border-r border-b border-slate-200 p-2 text-center font-medium bg-slate-50">시공사</div>
                    <div className="border-b border-slate-200 p-2 text-center">{data.companyName || '-'}</div>
                </div>
            </section>

            {/* Summary Grid */}
            <section className="grid grid-cols-3 text-sm divide-x divide-slate-200 bg-white">
                <div className="p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">총 공수</p>
                    <p className="text-lg font-bold text-slate-800">{data.totalManDay.toFixed(1)}</p>
                </div>
                <div className="p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">지급전</p>
                    <p className="text-lg font-bold text-slate-800">{data.grossAmount.toLocaleString()}원</p>
                </div>
                <div className="p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">실 지급</p>
                    <p className="text-lg font-bold text-emerald-600">{data.totalAmount.toLocaleString()}원</p>
                </div>
            </section>

            {/* Details */}
            <section className="p-4 border-t border-slate-200">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Work Entries */}
                    <div className="space-y-2 bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-700">근무내역</h4>
                            <span className="text-xs text-slate-500">총 {workEntries.length}건</span>
                        </div>
                        {workEntries.length > 0 ? (
                            <div className="border border-slate-200 rounded-lg bg-white">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">일자</th>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">현장</th>
                                            <th className="px-3 py-2 text-center font-semibold text-slate-600 border-b border-slate-200">구분</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200">공수</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200">단가</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200">금액</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workEntries.map((entry: WorkerWorkEntry, index: number) => {
                                            const isTeamResponsibleSite = Boolean(
                                                isTeamResponsibleSiteEntry?.(entry, data.teamId, data.teamName)
                                            );

                                            return (
                                            <tr
                                                key={`${entry.date}-${index}`}
                                                className={isTeamResponsibleSite ? 'bg-sky-50/80' : 'odd:bg-white even:bg-slate-50/60'}
                                            >
                                                <td className="px-3 py-2 border-b border-slate-100 font-mono">{entry.date}</td>
                                                <td className={`px-3 py-2 border-b border-slate-100 ${isTeamResponsibleSite ? 'font-semibold text-sky-800' : ''}`}>{entry.siteName}</td>
                                                <td className={`px-3 py-2 border-b border-slate-100 text-center text-xs ${isTeamResponsibleSite ? 'text-sky-700 font-semibold' : 'text-slate-500'}`}>
                                                    {entry.paymentMethod || '-'}
                                                </td>
                                                <td className="px-3 py-2 border-b border-slate-100 text-right">{entry.manDay.toFixed(1)}</td>
                                                <td className="px-3 py-2 border-b border-slate-100 text-right">{entry.unitPrice.toLocaleString()}</td>
                                                <td className="px-3 py-2 border-b border-slate-100 text-right font-medium text-slate-700">{(entry.amount || 0).toLocaleString()}</td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-purple-50 font-semibold text-purple-700">
                                            <td className="px-3 py-2 border-t border-slate-200" colSpan={3}>근무 합계</td>
                                            <td className="px-3 py-2 border-t border-slate-200 text-right">{totalWorkManDay.toFixed(1)}</td>
                                            <td className="px-3 py-2 border-t border-slate-200 text-right"></td>
                                            <td className="px-3 py-2 border-t border-slate-200 text-right">{data.grossAmount.toLocaleString()}원</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 bg-white">근무내역이 없습니다.</div>
                        )}
                    </div>

                    <div className="space-y-3 bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-700">공제내역</h4>
                            <span className="text-xs text-slate-500">
                                총 {(deductionBreakdown.standardLines.length + deductionBreakdown.additionalLines.length)}건
                            </span>
                        </div>

                        {deductionBreakdown.hasData ? (
                            <div className="border border-slate-200 rounded-lg bg-white">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">항목</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200">금액</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {showUtilitySection && (
                                            <tr className="bg-rose-50">
                                                <td className="px-3 py-2 border-b border-slate-100 font-bold text-rose-900">공과금 적용 내역</td>
                                                <td className="px-3 py-2 border-b border-slate-100 text-right font-bold text-rose-700">-{utilitySectionTotal.toLocaleString()}원</td>
                                            </tr>
                                        )}

                                        {utilityDeductionLines.map((line: DeductionLine, idx: number) => (
                                            <tr key={`deduction-utility-${line.label}-${idx}`} className="odd:bg-white even:bg-rose-50/30">
                                                <td className="px-3 py-2 border-b border-slate-100">{line.label}</td>
                                                <td className="px-3 py-2 border-b border-slate-100 text-right text-red-600">-{line.amount.toLocaleString()}원</td>
                                            </tr>
                                        ))}

                                        {nonUtilityDeductionLines.map((line: DeductionLine, idx: number) => (
                                            <tr key={`deduction-${line.label}-${idx}`} className="odd:bg-white even:bg-slate-50/60">
                                                <td className="px-3 py-2 border-b border-slate-100">{line.label}</td>
                                                <td className="px-3 py-2 border-b border-slate-100 text-right text-red-600">-{line.amount.toLocaleString()}원</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-amber-100 font-bold text-amber-800">
                                            <td className="px-3 py-2 border-t border-slate-200">공제 합계</td>
                                            <td className="px-3 py-2 border-t border-slate-200 text-right">-{deductionBreakdown.total.toLocaleString()}원</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 bg-white">공제 내역이 없습니다.</div>
                        )}

                        {data.personalMemo && (
                            <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">개인 메모</div>
                                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {data.personalMemo}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <h4 className="text-sm font-bold text-slate-700">세금내역</h4>
                            <span className="text-xs text-slate-500">
                                총 {(taxBreakdown.standardLines.length + taxBreakdown.additionalLines.length)}건
                            </span>
                        </div>

                        {showInsuranceSection && (
                            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-xs">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                    <div className="text-emerald-800 font-bold">
                                        {hasInsuranceTargetSummary
                                            ? `4대보험 적용 공수 ${data.insuranceAppliedSummary!.appliedManDay.toFixed(1)} (기준 ${data.insuranceAppliedSummary!.thresholdManDay})`
                                            : '4대보험 공제내역'}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-emerald-700 font-mono">
                                            {hasInsuranceTargetSummary
                                                ? `대상금액 ${data.insuranceAppliedSummary!.appliedAmount.toLocaleString()}원`
                                                : `공제금액 ${insuranceSectionTaxTotal.toLocaleString()}원`}
                                        </div>
                                        <div className="text-[11px] text-emerald-700/90 font-semibold">
                                            {insuranceScopeLabel}
                                        </div>
                                    </div>
                                </div>
                                {hasInsuranceTargetSummary && (
                                    <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead className="bg-emerald-100 text-emerald-800">
                                                <tr>
                                                    <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                    <th className="px-2 py-1 text-center font-bold w-20">사유</th>
                                                    <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                    <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.insuranceAppliedSummary!.appliedSites.map((s) => (
                                                    <tr key={`ins-site-${s.siteId}`} className="odd:bg-white even:bg-slate-50/60">
                                                        <td className="px-2 py-1 border-b border-slate-100 text-slate-700">{s.siteName}</td>
                                                        <td className="px-2 py-1 border-b border-slate-100 text-center text-emerald-700 font-semibold">
                                                            {s.reason === 'site' ? '노무현장8+' : '발주8+'}
                                                        </td>
                                                        <td className="px-2 py-1 border-b border-slate-100 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                        <td className="px-2 py-1 border-b border-slate-100 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-emerald-100 text-emerald-800">
                                            <tr>
                                                <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {insuranceTaxLines.map((line, idx) => (
                                                <tr key={`ins-tax-${idx}`} className="odd:bg-white even:bg-slate-50/60">
                                                    <td className="px-2 py-1 border-b border-slate-100 text-slate-700">{line.label.replace('[세금]', TEMP_WITHHOLDING_PREFIX)}</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, data.taxRateSnapshot)}</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}원</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-emerald-50 font-bold text-emerald-900">
                                                <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                <td className="px-2 py-1 text-right">-{insuranceSectionTaxTotal.toLocaleString()}원</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                {hasInsuranceTargetSummary && (
                                    <div className="mt-2 border border-emerald-200 rounded bg-white overflow-hidden">
                                        <table className="w-full text-xs">
                                            <tbody>
                                                <tr className="bg-emerald-50">
                                                    <td className="px-2 py-1.5 text-center text-emerald-900 font-bold w-1/4">세전 금액</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{data.insuranceAppliedSummary!.appliedAmount.toLocaleString()}</td>
                                                    <td className="px-2 py-1.5 text-center text-emerald-900 font-bold w-1/4">세후 금액</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-emerald-700 font-bold w-1/4">{insuranceAfterTaxAmount.toLocaleString()}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {data.withholdingAppliedSummary && data.withholdingAppliedSummary.appliedManDay > 0 && (
                            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs mt-2">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                    <div className="text-amber-900 font-bold">
                                        갑근세·지방세 적용공수 {data.withholdingAppliedSummary.appliedManDay.toFixed(1)}공수
                                        {data.withholdingAppliedSummary.thresholdManDay > 0
                                            ? ` (기준 ${data.withholdingAppliedSummary.thresholdManDay}공수 이하)`
                                            : ' (노무 전체 공수 적용)'}
                                    </div>
                                    <div className="text-amber-800 font-mono">
                                        과세대상금액 {data.withholdingAppliedSummary.appliedAmount.toLocaleString()}원
                                    </div>
                                </div>
                                <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-amber-100 text-amber-900">
                                            <tr>
                                                <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                <th className="px-2 py-1 text-center font-bold w-24">사유</th>
                                                <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.withholdingAppliedSummary.appliedSites.map((s) => (
                                                <tr key={`withholding-site-${s.siteId}`} className="odd:bg-white even:bg-slate-50/60">
                                                    <td className="px-2 py-1 border-b border-slate-100 text-slate-700">{s.siteName}</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-center text-amber-700 font-semibold">
                                                        {s.reason === '노무전체' ? '노무전체' : '노무-7'}
                                                    </td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-amber-100 text-amber-900">
                                            <tr>
                                                <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {withholdingTaxLines.map((line, idx) => (
                                                <tr key={`withholding-tax-${idx}`} className="odd:bg-white even:bg-slate-50/60">
                                                    <td className="px-2 py-1 border-b border-slate-100 text-slate-700">{line.label.replace('[세금]', TEMP_WITHHOLDING_PREFIX)}</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, data.taxRateSnapshot)}</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}원</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-amber-50 font-bold text-amber-900">
                                                <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                <td className="px-2 py-1 text-right">-{withholdingSectionTaxTotal.toLocaleString()}원</td>
                                            </tr>
                                            <tr className="font-normal text-[10px] text-amber-900/90">
                                                <td className="px-2 py-1 text-left" colSpan={3}>{withholdingDetailText}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <div className="mt-2 border border-amber-200 rounded bg-white overflow-hidden">
                                    <table className="w-full text-xs">
                                        <tbody>
                                            <tr className="bg-amber-50">
                                                <td className="px-2 py-1.5 text-center text-amber-900 font-bold w-1/4">세전 금액</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{Math.floor(data.withholdingAppliedSummary.grossAmount ?? data.withholdingAppliedSummary.appliedAmount).toLocaleString()}원</td>
                                                <td className="px-2 py-1.5 text-center text-amber-900 font-bold w-1/4">세후 금액</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-amber-700 font-bold w-1/4">{withholdingAfterTaxAmount.toLocaleString()}원</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {data.businessIncomeAppliedSummary && data.businessIncomeAppliedSummary.appliedManDay > 0 && (
                            <div className="border border-sky-200 bg-sky-50 rounded-lg p-3 text-xs mt-2">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                    <div className="text-sky-900 font-bold">
                                        사업소득 3.3% 적용 공수 {data.businessIncomeAppliedSummary.appliedManDay.toFixed(1)}
                                    </div>
                                    <div className="text-sky-800 font-mono">
                                        대상금액 {data.businessIncomeAppliedSummary.appliedAmount.toLocaleString()}원
                                    </div>
                                </div>
                                <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-sky-100 text-sky-900">
                                            <tr>
                                                <th className="px-2 py-1 text-left font-bold">대상 현장</th>
                                                <th className="px-2 py-1 text-center font-bold w-24">사유</th>
                                                <th className="px-2 py-1 text-right font-bold w-16">공수</th>
                                                <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.businessIncomeAppliedSummary.appliedSites.map((s) => (
                                                <tr key={`biz-site-${s.siteId}`} className="odd:bg-white even:bg-slate-50/60">
                                                    <td className="px-2 py-1 border-b border-slate-100 text-slate-700">{s.siteName}</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-center text-sky-700 font-semibold">4대보험·갑근세 제외</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-right font-mono text-slate-700">{s.manDay.toFixed(1)}</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-right font-mono text-slate-700">{s.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-sky-100 text-sky-900">
                                            <tr>
                                                <th className="px-2 py-1 text-left font-bold">공제내역</th>
                                                <th className="px-2 py-1 text-center font-bold w-20">세액요율</th>
                                                <th className="px-2 py-1 text-right font-bold w-24">금액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {businessTaxLines.map((line, idx) => (
                                                <tr key={`biz-tax-${idx}`} className="odd:bg-white even:bg-slate-50/60">
                                                    <td className="px-2 py-1 border-b border-slate-100 text-slate-700">{line.label.replace('[세금]', TEMP_WITHHOLDING_PREFIX)}</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, data.taxRateSnapshot)}</td>
                                                    <td className="px-2 py-1 border-b border-slate-100 text-right font-mono text-slate-700">-{line.amount.toLocaleString()}원</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-sky-50 font-bold text-sky-900">
                                                <td className="px-2 py-1 text-right" colSpan={2}>합계</td>
                                                <td className="px-2 py-1 text-right">-{businessSectionTaxTotal.toLocaleString()}원</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <div className="mt-2 border border-sky-200 rounded bg-white overflow-hidden">
                                    <table className="w-full text-xs">
                                        <tbody>
                                            <tr className="bg-sky-50">
                                                <td className="px-2 py-1.5 text-center text-sky-900 font-bold w-1/4">세전 금액</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-slate-800 w-1/4">{data.businessIncomeAppliedSummary.appliedAmount.toLocaleString()}</td>
                                                <td className="px-2 py-1.5 text-center text-sky-900 font-bold w-1/4">세후 금액</td>
                                                <td className="px-2 py-1.5 text-right font-mono text-sky-700 font-bold w-1/4">{businessAfterTaxAmount.toLocaleString()}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {otherTaxLines.length > 0 ? (
                            <div className="border border-slate-200 rounded-lg bg-white">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">항목</th>
                                            <th className="px-3 py-2 text-center font-semibold text-slate-600 border-b border-slate-200 w-24">세액요율</th>
                                            <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200">금액</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {otherTaxLines.map((line: DeductionLine, idx: number) => (
                                            <tr key={`tax-${line.label}-${idx}`} className="odd:bg-white even:bg-slate-50/60">
                                                <td className="px-3 py-2 border-b border-slate-100">{line.label.replace('[세금]', TEMP_WITHHOLDING_PREFIX)}</td>
                                                <td className="px-3 py-2 border-b border-slate-100 text-center font-mono text-slate-600">{resolveTaxLineRateText(line.label, data.taxRateSnapshot)}</td>
                                                <td className="px-3 py-2 border-b border-slate-100 text-right text-red-600">-{line.amount.toLocaleString()}원</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-rose-100 font-bold text-rose-800">
                                            <td className="px-3 py-2 border-t border-slate-200" colSpan={2}>세금 합계</td>
                                            <td className="px-3 py-2 border-t border-slate-200 text-right">-{otherTaxTotal.toLocaleString()}원</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : null}

                        <div className="border-t border-slate-200 pt-3 text-sm space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-700">세전 금액</span>
                                <span className="font-mono font-bold text-slate-800">{data.grossAmount.toLocaleString()}원</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-700">세후 금액</span>
                                <span className="font-mono font-bold text-emerald-700">{data.totalAmount.toLocaleString()}원</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-700">총 차감액(공제+세금)</span>
                                <span className="font-mono font-bold text-red-700">-{data.totalDeduction.toLocaleString()}원</span>
                            </div>
                        </div>
                        {data.personalMemo && (
                            <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg">
                                <h4 className="text-xs font-bold text-slate-500 mb-1">메모</h4>
                                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{data.personalMemo}</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Footer Summary */}
            <section className="p-4 border-t border-slate-200 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-b-xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <p className="text-xs text-emerald-600 font-semibold">총 공제금</p>
                        <p className="text-lg font-bold text-emerald-700">{data.totalDeduction.toLocaleString()}원</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-slate-500">실 지급액</p>
                        <p className="text-3xl font-black text-emerald-700">{data.totalAmount.toLocaleString()}원</p>
                        <p className="text-xs text-slate-400 mt-1">지급전 {data.grossAmount.toLocaleString()}원 - 차감 {data.totalDeduction.toLocaleString()}원</p>
                    </div>
                </div>
            </section>
        </div>
    );
});
