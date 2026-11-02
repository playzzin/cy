import React, { useMemo, useRef, useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import LaborCostStatementGeneratorPage, { type LaborEditorOutput, type LaborStatementSheet } from './LaborCostStatementGeneratorPage';
import { downloadLaborStatementWorkbook, getMonthLastDay, sumDaysForMonth, type LaborStatementDocument } from './utils/laborStatementWorkbook';
import type { Worker } from '../../services/manpowerService';
import type { PrimaryAccountPage } from '../../services/primaryAccountService';
import { statementOutputService } from '../../services/statementOutputService';
import {
    getLaborStatementWorkerIdentityKeys,
    loadSavedLaborStatementPreset, loadLaborStatementPresetDefaults, loadStatementIssueOptionPreset, saveLaborStatementPresetDefaults,
    saveStatementIssueOptionPreset, STATEMENT_ISSUE_OPTION_PRESETS, type StatementIssueOptionPreset,
} from '../../utils/payrollLaborStatementDefaults';

export interface SupportStatementSheet extends LaborStatementSheet {
    aggregateId: string;
    direction: string;
    companyName: string;
    counterpartyName: string;
    siteId: string;
    teamName: string;
    expenseAmount: number;
    additionalAmount: number;
    remark: string;
}

interface Props {
    month: string;
    sheets: SupportStatementSheet[];
    workers: Worker[];
    title: string;
    accountScope: PrimaryAccountPage;
    onClose: () => void;
    onMonthChange: (month: string) => void;
    autoDownload: boolean;
    onDownloadSettled: () => void;
    capture: (node: HTMLElement) => Promise<Blob>;
    copy: (blob: Blob) => Promise<void>;
}

const toolButton = 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-indigo-300 disabled:opacity-50';

function summarizeSheet(doc: LaborStatementDocument) {
    const workers = doc.rows.filter(row => row.workerName.trim() || row.days.some(Boolean)).map(row => {
        const days = sumDaysForMonth(row.days, getMonthLastDay(doc.month));
        return { name: row.workerName, days, amount: Math.round(days * Number(row.unitPrice.replace(/,/g, '') || 0)) };
    });
    return { workers, totalManDay: workers.reduce((sum, row) => sum + row.days, 0), totalAmount: workers.reduce((sum, row) => sum + row.amount, 0) };
}

export default function SupportLaborStatementWorkspace(props: Props) {
    const { month, sheets, workers, title, accountScope, onClose, onMonthChange } = props;
    const [preset, setPreset] = useState(loadStatementIssueOptionPreset);
    const savedOptions = useMemo(() => loadSavedLaborStatementPreset(preset), [preset]);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [showText, setShowText] = useState(false);
    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setMessage('');
        try { await action(); }
        catch (error) {
            if ((error as DOMException)?.name !== 'AbortError') setMessage('작업을 완료하지 못했습니다. 다시 시도해 주세요.');
        } finally { setBusy(false); }
    };
    if (!sheets.length) return <section className="space-y-3 p-6">
        <h2 className="font-bold">{title}</h2><p>{month}에 표시할 노임명세서가 없습니다.</p>
        <input type="month" aria-label="선택 월" value={month} onChange={e => e.target.value && onMonthChange(e.target.value)} />
        <button type="button" onClick={onClose} aria-label="노임명세서 닫기">명세서 접기</button>
    </section>;

    const renderTools = (editor: LaborEditorOutput) => {
        const sheet = sheets[editor.activeIndex];
        const doc = editor.documents[editor.activeIndex];
        const downloadAll = async (closeAfter = false) => {
            if (!editor.accountReady()) return;
            await downloadLaborStatementWorkbook(editor.documents, `노무내역서_${month}_${title}.xlsx`);
            setMessage('전체 현장 엑셀 파일을 저장했습니다.');
            if (closeAfter) onClose();
        };
        const image = async (action: 'copy' | 'save' | 'share') => {
            if (!editor.accountReady() || !editor.sheetRef.current) return;
            const blob = await props.capture(editor.sheetRef.current);
            const file = new File([blob], `${doc.statementTitle}_${month}_${sheet.companyName}_${sheet.siteName}.png`, { type: 'image/png' });
            if (action === 'copy') { await props.copy(blob); setMessage('현재 명세서 이미지를 복사했습니다.'); }
            else if (action === 'share' && navigator.share && navigator.canShare?.({ files: [file] }) && navigator.userActivation?.isActive !== false) {
                await navigator.share({ files: [file] }); setMessage('공유창을 열었습니다.');
            } else { saveAs(file, file.name); setMessage('현재 명세서를 PNG로 저장했습니다.'); }
        };
        const save = async () => {
            if (!editor.accountReady()) return;
            const previews = editor.documents.flatMap((item, i) => {
                const target = sheets[i];
                if (target.aggregateId !== sheet.aggregateId) return [];
                const summary = summarizeSheet(item);
                return [{ aggregateId: target.aggregateId, siteId: target.siteId, siteName: target.siteName,
                    workerCount: summary.workers.length, totalManDay: summary.totalManDay, totalAmount: summary.totalAmount }];
            });
            const total = previews.reduce((sum, item) => sum + item.totalAmount, 0);
            const filledRows = doc.rows.filter(row => row.workerName.trim());
            const workerPayTypes = Object.fromEntries(filledRows.flatMap(row =>
                getLaborStatementWorkerIdentityKeys(row).map(key => [key, row.payType])));
            const options = { showBankColumn: doc.showBankColumn, showBillingColumns: doc.showBillingColumns, isSplitView: doc.isSplitView,
                showBankUnderAddress: doc.showBankUnderAddress, showTeamUnderName: doc.showTeamUnderName,
                useWorkerMasterPayType: editor.dbPayType, workerPayTypes, unitPriceOverride: editor.appliedRate };
            saveLaborStatementPresetDefaults(preset, options);
            await statementOutputService.upsertOutput({ source: 'support-team-payment', kind: 'labor', status: preset, yearMonth: month,
                statementKey: `support-team-payment::${month}::${sheet.aggregateId}`, optionPreset: preset,
                optionSnapshot: { ...options, delegateBankName: doc.masterBank, delegateAccountHolder: doc.masterOwner, delegateAccountNumber: doc.masterAccount },
                targetTitle: sheet.companyName, targetSubtitle: `${sheet.direction} · ${sheet.siteName}`, teamName: sheet.teamName,
                clientCompanyName: sheet.counterpartyName, documentTitle: doc.statementTitle,
                siteId: previews.length === 1 ? sheet.siteId : undefined, siteName: previews.map(item => item.siteName).join(', '),
                amountSummary: { manDay: previews.reduce((sum, item) => sum + item.totalManDay, 0), supplyAmount: total, totalAmount: total },
                snapshot: { previewCount: previews.length, workerCount: previews.reduce((sum, item) => sum + item.workerCount, 0), previews },
            });
            setMessage('옵션을 저장하고 현재 명세서를 문서대장에 반영했습니다.');
        };
        const applyPreset = async (value: StatementIssueOptionPreset) => {
            setPreset(value);
            saveStatementIssueOptionPreset(value);
            await editor.applyViewOptions(loadLaborStatementPresetDefaults(value));
        };
        const text = showText ? editor.documents.flatMap((item, i) => {
            const target = sheets[i];
            if (target.aggregateId !== sheet.aggregateId) return [];
            const summary = summarizeSheet(item);
            return [`[${item.statementTitle}] ${month} · ${target.direction} · ${target.companyName} · ${target.siteName}`,
                ...summary.workers.map(row => `${row.name} · ${row.days}공수${item.showBillingColumns ? ` · ${row.amount.toLocaleString()}원` : ''}`),
                `공수합계 ${summary.totalManDay}`, ...(item.showBillingColumns ? [`청구합계 ${summary.totalAmount.toLocaleString()}원`,
                    `후청구 경비 ${target.expenseAmount.toLocaleString()}원 · 팀 추가금액 ${target.additionalAmount.toLocaleString()}원`] : []),
                target.remark, ''];
        }).join('\n') : '';
        return <div role="group" aria-label="지원비 출력 도구" className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-6 py-2 text-sm">
            <strong className="mr-2 text-slate-700">{title}</strong>
            <select className={toolButton} aria-label="발행 옵션" value={preset} disabled={busy} onChange={e => void run(() => applyPreset(e.target.value as StatementIssueOptionPreset))}>
                {STATEMENT_ISSUE_OPTION_PRESETS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button className={toolButton} type="button" disabled={busy} onClick={() => void run(save)}>옵션 저장</button>
            <button className={toolButton} type="button" disabled={busy} onClick={() => void run(() => image('copy'))}>이미지 복사</button>
            <button className={toolButton} type="button" disabled={busy} onClick={() => void run(() => image('save'))}>PNG 저장</button>
            <button className={toolButton} type="button" disabled={busy} onClick={() => void run(() => image('share'))}>보내기</button>
            {sheets.length > 1 && <button className={toolButton} type="button" disabled={busy} onClick={() => void run(() => downloadAll())}>전체 현장 엑셀 저장</button>}
            <button className={toolButton} type="button" aria-expanded={showText} onClick={() => setShowText(!showText)}>공유 문구</button>
            {showText && <textarea readOnly aria-label="공유 문구" rows={5} value={text} className="w-full rounded-lg border p-2" />}
            <span role="status" className="text-xs text-slate-600">{message}</span>
            {props.autoDownload && <RequestedWorkbookDownload ready={editor.accountsLoaded}
                download={() => run(() => downloadAll(true)).finally(props.onDownloadSettled)} />}
        </div>;
    };
    return <LaborCostStatementGeneratorPage source={{ month, sheets, workers, primaryAccountScope: accountScope,
        onClose, onMonthChange, renderTools, savedOptions }} />;
}

function RequestedWorkbookDownload({ ready, download }: { ready: boolean; download: () => Promise<void> }) {
    const started = useRef(false);
    useEffect(() => {
        if (ready && !started.current) { started.current = true; void download(); }
    }, [ready, download]);
    return null;
}
