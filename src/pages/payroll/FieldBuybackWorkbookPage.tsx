import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowsRotate,
    faDownload,
    faFileExcel,
    faPen,
    faPlus,
    faTrash,
} from '@fortawesome/free-solid-svg-icons';
import {
    buybackWorkbookService,
    type BuybackWorkbookEntry,
    type BuybackWorkbookEntryInput,
    type BuybackWorkbookPaymentStatus,
} from '../../services/buybackWorkbookService';
import {
    normalizeSettlementTargetAfterTaxRate,
    type SettlementTarget,
    settlementTargetService,
} from '../../services/settlementTargetService';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';
import BuybackTargetDialog, { type BuybackTargetEditor } from './components/BuybackTargetDialog';

type PaymentStatus = BuybackWorkbookPaymentStatus;

type GridColumnKey = 'date' | 'siteName' | 'preTax' | 'afterTax' | 'tax' | 'note' | 'paymentStatus';

const GRID_COLUMNS: GridColumnKey[] = ['date', 'siteName', 'preTax', 'afterTax', 'tax', 'note', 'paymentStatus'];

interface BuybackRow {
    id: string;
    year: string;
    month: string;
    /** 현장 DB 연결 전까지는 현장명만 직접 입력합니다. */
    siteName: string;
    preTax: number;
    afterTax?: number;
    afterTaxManual?: boolean;
    note: string;
    paymentStatus: PaymentStatus;
}

interface BuybackSheet {
    id: string;
    targetId: string;
    afterTaxRate: number;
    name: string;
    titleColor: string;
    rows: BuybackRow[];
}

interface BuybackWorkbook {
    sheets: BuybackSheet[];
}

const VISIBLE_ROW_COUNT = 12;
const AUTO_AFTER_TAX_RATE = 0.75;
const SHEET_COLORS = ['#e31b23', '#ed7d31', '#ffc000', '#00b050', '#00b0f0', '#5b9bd5', '#70ad47', '#4472c4'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_MONTH_PICKER_MIN_DATE = new Date(CURRENT_YEAR - 27, 0, 1);
const YEAR_MONTH_PICKER_MAX_DATE = new Date(CURRENT_YEAR + 2, 11, 1);

const createId = () => `buyback_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const createBlankRow = (): BuybackRow => ({
    id: createId(),
    year: '',
    month: '',
    siteName: '',
    preTax: 0,
    note: '',
    paymentStatus: 'unpaid',
});

const createEmptyWorkbook = (): BuybackWorkbook => ({ sheets: [] });

const getTargetName = (target: Pick<SettlementTarget, 'name' | 'positionTitle'>): string =>
    [target.name, target.positionTitle].filter(Boolean).join(' ').trim();

const normalizeYearMonth = (value: string): string => {
    const match = String(value || '').trim().match(/^(\d{4})[-./년\s]+(\d{1,2})/);
    if (!match) return '';
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? `${match[1]}-${String(month).padStart(2, '0')}` : '';
};

const getCurrentYearMonth = (): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const getYearMonthParts = (value: string): Pick<BuybackRow, 'year' | 'month'> => {
    const normalized = normalizeYearMonth(value);
    return normalized ? { year: normalized.slice(0, 4), month: normalized.slice(5, 7) } : { year: '', month: '' };
};

const getRowYearMonth = (row: Pick<BuybackRow, 'year' | 'month'>): string =>
    row.year && row.month ? `${row.year}-${row.month}` : '';


const toBuybackRow = (entry: BuybackWorkbookEntry): BuybackRow => ({
    id: entry.id,
    year: entry.year || getYearMonthParts(entry.date).year,
    month: entry.month || getYearMonthParts(entry.date).month,
    siteName: entry.siteName,
    preTax: entry.preTax,
    afterTax: entry.afterTax,
    afterTaxManual: entry.afterTaxManual,
    note: entry.note,
    paymentStatus: entry.paymentStatus,
});

const toNumber = (value: string): number => Math.max(0, Number(value.replace(/[^0-9.-]/g, '')) || 0);
const formatNumber = (value: number): string => Math.round(value || 0).toLocaleString('ko-KR');
const getAfterTax = (row: BuybackRow, afterTaxRate = AUTO_AFTER_TAX_RATE): number =>
    row.afterTaxManual ? Math.max(0, row.afterTax || 0) : Math.round(row.preTax * afterTaxRate);
const getTax = (row: BuybackRow, afterTaxRate = AUTO_AFTER_TAX_RATE): number => Math.max(0, row.preTax - getAfterTax(row, afterTaxRate));
const isFilledRow = (row: BuybackRow): boolean => Boolean(row.year || row.month || row.siteName || row.preTax || row.afterTax || row.note || row.paymentStatus === 'paid');
const escapeTsv = (value: string | number): string => String(value).replace(/[\t\r\n]+/g, ' ').trim();

const FieldBuybackWorkbookPage: React.FC = () => {
    const [workbook, setWorkbook] = useState<BuybackWorkbook>(createEmptyWorkbook);
    const [activeSheetId, setActiveSheetId] = useState('');
    const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
    const [buybackTargets, setBuybackTargets] = useState<SettlementTarget[]>([]);
    const [targetLoading, setTargetLoading] = useState(true);
    const [targetError, setTargetError] = useState<string | null>(null);
    const [targetRefreshKey, setTargetRefreshKey] = useState(0);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [pendingSaveCount, setPendingSaveCount] = useState(0);
    const [showTargetScrollHint, setShowTargetScrollHint] = useState(false);
    const [targetEditor, setTargetEditor] = useState<BuybackTargetEditor | null>(null);
    const saveTimersRef = useRef(new Map<string, number>());
    const pendingRowIdsRef = useRef(new Set<string>());
    const gridCellRefs = useRef(new Map<string, HTMLElement>());
    const mobilePreTaxRefs = useRef(new Map<string, HTMLInputElement>());
    const targetTabRefs = useRef(new Map<string, HTMLButtonElement>());
    const targetTabListRef = useRef<HTMLDivElement | null>(null);

    const activeSheet = workbook.sheets.find((sheet) => sheet.id === activeSheetId) || workbook.sheets[0];
    const activeSheetIndex = Math.max(0, workbook.sheets.findIndex((sheet) => sheet.id === activeSheet?.id));
    const activeAfterTaxPercent = Number((normalizeSettlementTargetAfterTaxRate(activeSheet?.afterTaxRate) * 100).toFixed(4));
    const displayRows = useMemo(() => {
        if (!activeSheet) return [];
        return activeSheet.rows.length >= VISIBLE_ROW_COUNT
            ? activeSheet.rows
            : [...activeSheet.rows, ...Array.from({ length: VISIBLE_ROW_COUNT - activeSheet.rows.length }, createBlankRow)];
    }, [activeSheet]);
    const totals = useMemo(() => {
        const rows = activeSheet?.rows || [];
        return {
            preTax: rows.reduce((sum, row) => sum + row.preTax, 0),
            buyback: rows.reduce((sum, row) => sum + getAfterTax(row, activeSheet?.afterTaxRate), 0),
            tax: rows.reduce((sum, row) => sum + getTax(row, activeSheet?.afterTaxRate), 0),
            paid: rows.filter((row) => row.paymentStatus === 'paid').reduce((sum, row) => sum + getAfterTax(row, activeSheet?.afterTaxRate), 0),
            count: rows.filter(isFilledRow).length,
        };
    }, [activeSheet]);
    const hasActiveRows = Boolean(activeSheet?.rows.length);
    const activeTarget = buybackTargets.find((target): target is SettlementTarget & { id: string } => Boolean(target.id) && target.id === activeSheet?.targetId);

    const handleTargetSaved = (target: SettlementTarget & { id: string }) => {
        const sheetId = `target_${target.id}`;
        setBuybackTargets(current => current.some(item => item.id === target.id)
            ? current.map(item => item.id === target.id ? target : item)
            : [...current, target]);
        // Keep in-progress rows when the relationship changes; reloading would replace them.
        setWorkbook(current => {
            const existing = current.sheets.some(sheet => sheet.targetId === target.id);
            const details = { name: getTargetName(target), afterTaxRate: normalizeSettlementTargetAfterTaxRate(target.defaultAfterTaxRate) };
            return { sheets: existing
                ? current.sheets.map(sheet => sheet.targetId === target.id ? { ...sheet, ...details } : sheet)
                : [...current.sheets, { id: sheetId, targetId: target.id, ...details, titleColor: SHEET_COLORS[current.sheets.length % SHEET_COLORS.length], rows: [] }] };
        });
        setActiveSheetId(sheetId);
        setSelectedRowIds([]);
        setTargetEditor(null);
        if (targetEditor?.mode === 'create') {
            window.requestAnimationFrame(() => {
                const tab = targetTabRefs.current.get(sheetId);
                tab?.focus({ preventScroll: true });
                tab?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
            });
        }
    };

    const handleTargetDeleted = (id: string) => {
        setBuybackTargets(current => current.filter(target => target.id !== id));
        setWorkbook(current => ({ sheets: current.sheets.filter(sheet => sheet.targetId !== id) }));
        setActiveSheetId('');
        setSelectedRowIds([]);
        setTargetEditor(null);
    };

    const targetDialog = targetEditor && <BuybackTargetDialog editor={targetEditor} onSaved={handleTargetSaved} onDeleted={handleTargetDeleted} onClose={() => setTargetEditor(null)} />;

    const updateTargetScrollHint = useCallback(() => {
        const tabList = targetTabListRef.current;
        if (!tabList) {
            setShowTargetScrollHint(false);
            return;
        }
        const remainingScroll = tabList.scrollWidth - tabList.clientWidth - tabList.scrollLeft;
        setShowTargetScrollHint(remainingScroll > 2);
    }, []);

    useEffect(() => {
        const frame = window.requestAnimationFrame(updateTargetScrollHint);
        window.addEventListener('resize', updateTargetScrollHint);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', updateTargetScrollHint);
        };
    }, [updateTargetScrollHint, workbook.sheets.length]);

    const toEntryInput = (sheet: BuybackSheet, row: BuybackRow): BuybackWorkbookEntryInput => ({
        id: row.id,
        targetId: sheet.targetId,
        targetName: sheet.name,
        date: getRowYearMonth(row),
        year: row.year,
        month: row.month,
        siteName: row.siteName,
        preTax: row.preTax,
        afterTax: row.afterTax,
        afterTaxManual: Boolean(row.afterTaxManual),
        note: row.note,
        paymentStatus: row.paymentStatus,
    });

    const updatePendingSaveCount = () => setPendingSaveCount(pendingRowIdsRef.current.size);

    const persistRowAfterTyping = (sheet: BuybackSheet, row: BuybackRow) => {
        const previousTimer = saveTimersRef.current.get(row.id);
        if (previousTimer) window.clearTimeout(previousTimer);
        pendingRowIdsRef.current.add(row.id);
        updatePendingSaveCount();

        const timer = window.setTimeout(async () => {
            try {
                if (isFilledRow(row)) {
                    await buybackWorkbookService.saveEntry(toEntryInput(sheet, row));
                } else {
                    await buybackWorkbookService.deleteEntry(row.id);
                }
                setLastSavedAt(new Date());
            } catch (error) {
                console.error('[FieldBuybackWorkbookPage] failed to save buyback entry:', error);
                setTargetError('바이백 정산 행을 저장하지 못했습니다. 네트워크를 확인한 뒤 다시 입력해 주세요.');
            } finally {
                saveTimersRef.current.delete(row.id);
                pendingRowIdsRef.current.delete(row.id);
                updatePendingSaveCount();
            }
        }, 550);
        saveTimersRef.current.set(row.id, timer);
    };

    const flushRowPersistence = (sheet: BuybackSheet, row: BuybackRow, force = false) => {
        const timer = saveTimersRef.current.get(row.id);
        if (!timer && !force) return;
        if (timer) {
            window.clearTimeout(timer);
            saveTimersRef.current.delete(row.id);
        } else {
            pendingRowIdsRef.current.add(row.id);
            updatePendingSaveCount();
        }

        void (async () => {
            try {
                if (isFilledRow(row)) {
                    await buybackWorkbookService.saveEntry(toEntryInput(sheet, row));
                } else {
                    await buybackWorkbookService.deleteEntry(row.id);
                }
                setTargetError(null);
                setLastSavedAt(new Date());
            } catch (error) {
                console.error('[FieldBuybackWorkbookPage] failed to flush buyback entry:', error);
                setTargetError('바이백 정산 행을 저장하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.');
            } finally {
                pendingRowIdsRef.current.delete(row.id);
                updatePendingSaveCount();
            }
        })();
    };

    useEffect(() => () => {
        saveTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    }, []);

    useEffect(() => {
        let active = true;
        const loadWorkbook = async () => {
            setTargetLoading(true);
            setTargetError(null);
            try {
                const targets = (await settlementTargetService.getTargets(true))
                    .filter((target) => target.targetType === 'client_contact' && target.buybackEnabled && target.status !== 'inactive');
                const entries = await buybackWorkbookService.getEntriesByTargetIds(targets.map((target) => target.id || ''));
                if (!active) return;

                const entriesByTargetId = new Map<string, BuybackWorkbookEntry[]>();
                entries.forEach((entry) => {
                    const rows = entriesByTargetId.get(entry.targetId) || [];
                    rows.push(entry);
                    entriesByTargetId.set(entry.targetId, rows);
                });

                const sheets = targets
                    .filter((target): target is SettlementTarget & { id: string } => Boolean(target.id))
                    .map((target, index): BuybackSheet => ({
                        id: `target_${target.id}`,
                        targetId: target.id,
                        afterTaxRate: normalizeSettlementTargetAfterTaxRate(target.defaultAfterTaxRate),
                        name: getTargetName(target),
                        titleColor: SHEET_COLORS[index % SHEET_COLORS.length],
                        rows: (entriesByTargetId.get(target.id) || []).map(toBuybackRow),
                    }));

                setBuybackTargets(targets);
                setWorkbook({ sheets });
                setActiveSheetId((current) => sheets.some((sheet) => sheet.id === current) ? current : sheets[0]?.id || '');
                setSelectedRowIds([]);
            } catch (error) {
                console.error('[FieldBuybackWorkbookPage] failed to load workbook:', error);
                if (active) setTargetError('관계자 DB 또는 바이백 정산 데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
            } finally {
                if (active) setTargetLoading(false);
            }
        };
        void loadWorkbook();
        return () => { active = false; };
    }, [targetRefreshKey]);

    const updateActiveSheet = (updater: (sheet: BuybackSheet) => BuybackSheet) => {
        if (!activeSheet) return;
        setWorkbook((current) => ({
            sheets: current.sheets.map((sheet) => sheet.id === activeSheet.id ? updater(sheet) : sheet),
        }));
    };

    const updateRow = (rowId: string, patch: Partial<BuybackRow>) => {
        if (!activeSheet) return;
        const previous = activeSheet.rows.find((row) => row.id === rowId) || { ...createBlankRow(), id: rowId };
        const nextRow = { ...previous, ...patch };
        updateActiveSheet((sheet) => ({
            ...sheet,
            rows: sheet.rows.some((row) => row.id === rowId)
                ? sheet.rows.map((row) => row.id === rowId ? nextRow : row)
                : [...sheet.rows, nextRow],
        }));
        persistRowAfterTyping(activeSheet, nextRow);
    };

    const appendRows = (count = 1, focusFirstRow = false) => {
        const newRows = Array.from({ length: count }, createBlankRow);
        updateActiveSheet((sheet) => ({
            ...sheet,
            rows: [...sheet.rows, ...newRows],
        }));

        if (focusFirstRow && newRows[0]) {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    const rowId = newRows[0].id;
                    const useMobileCard = window.matchMedia('(max-width: 767px)').matches;
                    const input = useMobileCard
                        ? mobilePreTaxRefs.current.get(rowId)
                        : gridCellRefs.current.get(getGridCellKey(rowId, 'preTax'));
                    input?.focus({ preventScroll: true });
                    input?.scrollIntoView({ block: 'center', inline: 'nearest' });
                    if (input instanceof HTMLInputElement) input.select();
                });
            });
        }
    };

    const activateSheet = (sheet: BuybackSheet) => {
        setActiveSheetId(sheet.id);
        setSelectedRowIds([]);
    };

    const handleTargetTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, sheetIndex: number) => {
        let nextIndex = sheetIndex;
        if (event.key === 'ArrowLeft') nextIndex = sheetIndex === 0 ? workbook.sheets.length - 1 : sheetIndex - 1;
        else if (event.key === 'ArrowRight') nextIndex = sheetIndex === workbook.sheets.length - 1 ? 0 : sheetIndex + 1;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = workbook.sheets.length - 1;
        else return;

        const nextSheet = workbook.sheets[nextIndex];
        if (!nextSheet) return;
        event.preventDefault();
        activateSheet(nextSheet);
        window.requestAnimationFrame(() => {
            const nextTab = targetTabRefs.current.get(nextSheet.id);
            nextTab?.focus({ preventScroll: true });
            nextTab?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
            updateTargetScrollHint();
        });
    };

    const getGridCellKey = (rowId: string, column: GridColumnKey) => `${rowId}:${column}`;

    const registerGridCell = (rowId: string, column: GridColumnKey) => (element: HTMLElement | null) => {
        const key = getGridCellKey(rowId, column);
        if (element) gridCellRefs.current.set(key, element);
        else gridCellRefs.current.delete(key);
    };

    const focusGridCell = (rowIndex: number, columnIndex: number) => {
        const nextRowIndex = Math.min(Math.max(rowIndex, 0), displayRows.length - 1);
        const nextColumnIndex = Math.min(Math.max(columnIndex, 0), GRID_COLUMNS.length - 1);
        const nextRow = displayRows[nextRowIndex];
        const nextColumn = GRID_COLUMNS[nextColumnIndex];
        if (!nextRow || !nextColumn) return;

        window.requestAnimationFrame(() => {
            const element = gridCellRefs.current.get(getGridCellKey(nextRow.id, nextColumn));
            if (!element) return;
            element.focus({ preventScroll: true });
            element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            if (element instanceof HTMLInputElement && !['date', 'month'].includes(element.type)) element.select();
        });
    };

    const clearGridCell = (row: BuybackRow, column: GridColumnKey) => {
        switch (column) {
            case 'date': updateRow(row.id, { year: '', month: '' }); break;
            case 'siteName': updateRow(row.id, { siteName: '' }); break;
            case 'preTax': updateRow(row.id, { preTax: 0 }); break;
            case 'afterTax': updateRow(row.id, { afterTax: undefined, afterTaxManual: false }); break;
            case 'note': updateRow(row.id, { note: '' }); break;
            case 'paymentStatus': updateRow(row.id, { paymentStatus: 'unpaid' }); break;
            case 'tax': break;
        }
    };

    const getGridCellValue = (row: BuybackRow, column: GridColumnKey): string => {
        switch (column) {
            case 'date': return getRowYearMonth(row);
            case 'siteName': return row.siteName;
            case 'preTax': return row.preTax ? String(row.preTax) : '';
            case 'afterTax': return getAfterTax(row, activeSheet.afterTaxRate) ? String(getAfterTax(row, activeSheet.afterTaxRate)) : '';
            case 'tax': return getTax(row, activeSheet.afterTaxRate) ? String(getTax(row, activeSheet.afterTaxRate)) : '';
            case 'note': return row.note;
            case 'paymentStatus': return row.paymentStatus === 'paid' ? '입금 완료' : '입금 전';
        }
    };

    const pasteIntoGridCell = (row: BuybackRow, column: GridColumnKey, clipboardValue: string) => {
        const value = clipboardValue.split(/\r?\n/)[0].split('\t')[0].trim();
        if (!value) {
            clearGridCell(row, column);
            return;
        }

        switch (column) {
            case 'date':
                {
                    const parts = getYearMonthParts(value);
                    if (parts.year && parts.month) updateRow(row.id, parts);
                }
                break;
            case 'siteName': updateRow(row.id, { siteName: value }); break;
            case 'preTax': updateRow(row.id, { preTax: toNumber(value) }); break;
            case 'afterTax': updateRow(row.id, { afterTax: toNumber(value), afterTaxManual: true }); break;
            case 'note': updateRow(row.id, { note: value }); break;
            case 'paymentStatus': updateRow(row.id, { paymentStatus: value === 'paid' || value.includes('완료') ? 'paid' : 'unpaid' }); break;
            case 'tax': break;
        }
    };

    const getClipboardCell = (eventTarget: EventTarget | null) => {
        if (!(eventTarget instanceof HTMLElement)) return null;
        const cell = eventTarget.closest<HTMLElement>('[data-grid-row][data-grid-column]');
        if (!cell) return null;
        const rowIndex = Number(cell.dataset.gridRow);
        const column = cell.dataset.gridColumn as GridColumnKey;
        const row = displayRows[rowIndex];
        return row && GRID_COLUMNS.includes(column) ? { row, column } : null;
    };

    const handleGridCopy = (event: React.ClipboardEvent<HTMLTableElement>) => {
        const cell = getClipboardCell(event.target);
        if (!cell) return;
        event.preventDefault();
        event.clipboardData.setData('text/plain', getGridCellValue(cell.row, cell.column));
    };

    const handleGridCut = (event: React.ClipboardEvent<HTMLTableElement>) => {
        const cell = getClipboardCell(event.target);
        if (!cell) return;
        event.preventDefault();
        event.clipboardData.setData('text/plain', getGridCellValue(cell.row, cell.column));
        clearGridCell(cell.row, cell.column);
    };

    const handleGridPaste = (event: React.ClipboardEvent<HTMLTableElement>) => {
        const cell = getClipboardCell(event.target);
        if (!cell) return;
        event.preventDefault();
        pasteIntoGridCell(cell.row, cell.column, event.clipboardData.getData('text/plain'));
    };

    const fillDownGridCell = (rowIndex: number, column: GridColumnKey) => {
        const row = displayRows[rowIndex];
        const source = displayRows[rowIndex - 1];
        if (!row || !source) return;

        switch (column) {
            case 'date': updateRow(row.id, { year: source.year, month: source.month }); break;
            case 'siteName': updateRow(row.id, { siteName: source.siteName }); break;
            case 'preTax': updateRow(row.id, { preTax: source.preTax }); break;
            case 'afterTax':
                updateRow(row.id, {
                    afterTax: source.afterTaxManual ? source.afterTax : undefined,
                    afterTaxManual: Boolean(source.afterTaxManual),
                });
                break;
            case 'note': updateRow(row.id, { note: source.note }); break;
            case 'paymentStatus': updateRow(row.id, { paymentStatus: source.paymentStatus }); break;
            case 'tax': break;
        }
    };

    const handleGridCellKeyDown = (
        event: React.KeyboardEvent<HTMLElement>,
        rowIndex: number,
        columnIndex: number,
        row: BuybackRow,
    ) => {
        const column = GRID_COLUMNS[columnIndex];
        const primaryKey = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();

        if (primaryKey && key === 's') {
            event.preventDefault();
            flushRowPersistence(activeSheet, row, true);
            return;
        }

        if (primaryKey && key === 'd') {
            event.preventDefault();
            fillDownGridCell(rowIndex, column);
            return;
        }

        if (primaryKey && event.key === ';') {
            event.preventDefault();
            if (column === 'date') updateRow(row.id, getYearMonthParts(getCurrentYearMonth()));
            return;
        }

        if (!primaryKey && !event.altKey && event.key === 'Delete') {
            event.preventDefault();
            clearGridCell(row, column);
            return;
        }

        if (primaryKey && event.key === 'Home') {
            event.preventDefault();
            focusGridCell(0, 0);
            return;
        }

        if (primaryKey && event.key === 'End') {
            event.preventDefault();
            focusGridCell(displayRows.length - 1, GRID_COLUMNS.length - 1);
            return;
        }

        let nextRowIndex = rowIndex;
        let nextColumnIndex = columnIndex;
        if (event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey)) nextRowIndex -= 1;
        else if (event.key === 'ArrowDown' || event.key === 'Enter') nextRowIndex += 1;
        else if (event.key === 'ArrowLeft') nextColumnIndex -= 1;
        else if (event.key === 'ArrowRight') nextColumnIndex += 1;
        else if (event.key === 'Home') nextColumnIndex = 0;
        else if (event.key === 'End') nextColumnIndex = GRID_COLUMNS.length - 1;
        else if (event.key === 'Tab') {
            if (event.shiftKey) {
                if (columnIndex === 0) {
                    nextRowIndex -= 1;
                    nextColumnIndex = GRID_COLUMNS.length - 1;
                } else nextColumnIndex -= 1;
            } else if (columnIndex === GRID_COLUMNS.length - 1) {
                nextRowIndex += 1;
                nextColumnIndex = 0;
            } else nextColumnIndex += 1;
        } else return;

        event.preventDefault();
        focusGridCell(nextRowIndex, nextColumnIndex);
    };

    const handleYearMonthPickerKeyDown = (event: React.KeyboardEvent<HTMLElement>, rowIndex: number, row: BuybackRow) => {
        const opensPicker = !event.ctrlKey
            && !event.metaKey
            && !event.altKey
            && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter');
        if (opensPicker) return;
        handleGridCellKeyDown(event, rowIndex, 0, row);
    };

    const handleYearMonthBlur = (event: React.FocusEvent<HTMLTableCellElement>, row: BuybackRow) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        flushRowPersistence(activeSheet, row);
    };

    const toggleRowSelection = (rowId: string) => {
        setSelectedRowIds((current) => current.includes(rowId)
            ? current.filter((id) => id !== rowId)
            : [...current, rowId]);
    };

    const deleteSelectedRows = () => {
        if (selectedRowIds.length === 0 || !activeSheet) return;
        if (!window.confirm(`선택한 ${selectedRowIds.length}개 행을 삭제할까요?`)) return;
        selectedRowIds.forEach((id) => {
            const timer = saveTimersRef.current.get(id);
            if (timer) window.clearTimeout(timer);
            saveTimersRef.current.delete(id);
            pendingRowIdsRef.current.delete(id);
        });
        updatePendingSaveCount();
        const idsToDelete = [...selectedRowIds];
        updateActiveSheet((sheet) => ({ ...sheet, rows: sheet.rows.filter((row) => !idsToDelete.includes(row.id)) }));
        setSelectedRowIds([]);
        void Promise.all(idsToDelete.map((id) => buybackWorkbookService.deleteEntry(id)))
            .then(() => setLastSavedAt(new Date()))
            .catch((error) => {
                console.error('[FieldBuybackWorkbookPage] failed to delete buyback entries:', error);
                setTargetError('선택한 바이백 정산 행을 삭제하지 못했습니다. 다시 시도해 주세요.');
            });
    };

    const applyAutoCalculation = () => {
        if (!activeSheet) return;
        const nextRows = activeSheet.rows.map((row) => ({ ...row, afterTax: undefined, afterTaxManual: false }));
        updateActiveSheet((sheet) => ({ ...sheet, rows: nextRows }));
        void Promise.all(nextRows.filter(isFilledRow).map((row) => buybackWorkbookService.saveEntry(toEntryInput(activeSheet, row))))
            .then(() => setLastSavedAt(new Date()))
            .catch((error) => {
                console.error('[FieldBuybackWorkbookPage] failed to apply automatic calculation:', error);
                setTargetError('자동 계산값을 저장하지 못했습니다. 다시 시도해 주세요.');
            });
    };

    const exportCsv = () => {
        if (!activeSheet) return;
        const csvRows = [
            [`${activeSheet.name} 바이백`],
            ['바이백', totals.buyback, '세금', totals.tax, '세전 합계', totals.preTax, '입금 합계', totals.paid],
            ['년월', '현장', '세전', '세후', '세금', '비고', '입금'],
            ...activeSheet.rows.filter(isFilledRow).map((row) => [
                getRowYearMonth(row),
                row.siteName,
                row.preTax,
                getAfterTax(row, activeSheet.afterTaxRate),
                getTax(row, activeSheet.afterTaxRate),
                row.note,
                row.paymentStatus === 'paid' ? '입금 완료' : '입금 전',
            ]),
        ];
        const blob = new Blob([`\ufeff${csvRows.map((row) => row.map(escapeTsv).join('\t')).join('\r\n')}`], { type: 'text/tab-separated-values;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${activeSheet.name}_바이백.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    if (!activeSheet) {
        return (
            <div className="min-h-screen bg-[#f3f4f6] p-5 font-['Malgun_Gothic',Arial,sans-serif] text-slate-900">
                <div className="mx-auto max-w-3xl border-2 border-slate-800 bg-white p-8 text-center shadow-sm">
                    <FontAwesomeIcon icon={faFileExcel} className="text-3xl text-[#217346]" />
                    <h1 className="mt-3 text-xl font-black">관계자별 바이백</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        {targetLoading ? '바이백 관계자 DB를 불러오는 중입니다.' : '등록된 바이백 관계자가 없습니다. 정산 관계자를 등록하고 바로 정산을 시작하세요.'}
                    </p>
                    {targetError && <p className="mt-3 text-sm font-bold text-rose-700">{targetError}</p>}
                    <button type="button" disabled={targetLoading} onClick={() => setTargetEditor({ mode: 'create' })} className="mr-2 mt-5 min-h-11 rounded-lg bg-[#217346] px-4 py-2 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-50">
                        <FontAwesomeIcon icon={faPlus} className="mr-2" />정산 관계자 등록
                    </button>
                    <button type="button" disabled={targetLoading} onClick={() => setTargetRefreshKey((value) => value + 1)} className="mt-5 min-h-11 rounded-lg border border-slate-600 bg-white px-4 py-2 text-sm font-black hover:bg-slate-100 disabled:opacity-50">
                        <FontAwesomeIcon icon={faArrowsRotate} className="mr-2" />관계자 새로고침
                    </button>
                </div>
                {targetDialog}
            </div>
        );
    }

    return (
        <div className="min-h-screen max-w-full overflow-x-hidden bg-[#f4f6f8] p-3 font-['Malgun_Gothic',Arial,sans-serif] text-slate-900 md:p-3">
            <div className="mx-auto min-w-0 max-w-[1800px]">
                <section aria-label="바이백 정산 도구" className="mb-2 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#217346]"><FontAwesomeIcon icon={faFileExcel} /></span>
                            <h1 className="truncate text-sm font-black sm:text-base">관계자별 바이백 정산</h1>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs">
                            <span className="hidden whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-emerald-800 sm:inline"><span className="mr-1 text-emerald-700">세후율</span><strong>{activeAfterTaxPercent}%</strong></span>
                            <span role="status" className={`hidden items-center whitespace-nowrap text-xs sm:inline-flex ${targetError ? 'text-rose-700' : pendingSaveCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                                {targetLoading ? '불러오는 중' : targetError ? '저장 상태 확인' : pendingSaveCount > 0 ? `저장 중 ${pendingSaveCount}건` : lastSavedAt ? '저장 완료' : '자동 저장 준비'}
                            </span>
                            <button type="button" onClick={() => setTargetRefreshKey((value) => value + 1)} disabled={targetLoading} title="관계자 DB 새로고침" aria-label="관계자 DB 새로고침" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><FontAwesomeIcon icon={faArrowsRotate} className={targetLoading ? 'animate-spin' : ''} /></button>
                        </div>
                    </div>
                    {targetError && <p role="alert" className="mx-3 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{targetError}</p>}

                    <div className="flex min-w-0 items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-2 py-1.5">
                        <div className="relative min-w-0 flex-1">
                            <div
                                ref={targetTabListRef}
                                role="tablist"
                                aria-label="정산 관계자"
                                onScroll={updateTargetScrollHint}
                                className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto pr-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            >
                            {workbook.sheets.map((sheet, sheetIndex) => {
                                const active = sheet.id === activeSheet.id;
                                return (
                                    <button
                                        key={sheet.id}
                                        ref={(element) => {
                                            if (element) targetTabRefs.current.set(sheet.id, element);
                                            else targetTabRefs.current.delete(sheet.id);
                                        }}
                                        type="button"
                                        role="tab"
                                        id={`buyback-target-tab-${sheetIndex}`}
                                        aria-controls="buyback-workbook-panel"
                                        aria-selected={active}
                                        tabIndex={active ? 0 : -1}
                                        onClick={() => activateSheet(sheet)}
                                        onKeyDown={(event) => handleTargetTabKeyDown(event, sheetIndex)}
                                        className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#217346] md:min-h-9 ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm' : 'border-transparent text-slate-500 hover:bg-white hover:text-slate-900'}`}
                                    >
                                        <span aria-hidden="true" className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${active ? 'bg-[#217346]' : 'bg-slate-300'}`} />
                                        {sheet.name}
                                    </button>
                                );
                            })}
                            </div>
                            {showTargetScrollHint && (
                                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-end bg-gradient-to-l from-slate-50 via-slate-50/95 to-transparent pr-1 text-sm font-black text-slate-400">
                                    <span>›</span>
                                </div>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1 border-l border-slate-200 pl-2 text-xs font-bold">
                            <button type="button" aria-label="정산 관계자 등록" title="정산 관계자 등록" disabled={targetLoading} onClick={() => setTargetEditor({ mode: 'create' })} className="flex min-h-11 min-w-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#217346] px-2.5 text-white hover:bg-emerald-800 disabled:opacity-50 md:min-h-9"><FontAwesomeIcon icon={faPlus} /><span className="hidden sm:inline">등록</span></button>
                            <button type="button" aria-label="관계자 수정" title="선택한 관계자 수정" disabled={targetLoading || !activeTarget} onClick={() => { if (activeTarget) setTargetEditor({ mode: 'edit', target: activeTarget }); }} className="flex min-h-11 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-[#217346] disabled:opacity-50 md:min-h-9"><FontAwesomeIcon icon={faPen} /></button>
                            <button type="button" aria-label="관계자 삭제" title="선택한 관계자 삭제" disabled={targetLoading || !activeTarget} onClick={() => { if (activeTarget) setTargetEditor({ mode: 'delete', target: activeTarget }); }} className="flex min-h-11 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 md:min-h-9"><FontAwesomeIcon icon={faTrash} /></button>
                        </div>
                    </div>

                    {hasActiveRows && <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-slate-100 px-3 py-1.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="whitespace-nowrap text-slate-500">세전 <strong className="ml-1 font-mono text-slate-800">{formatNumber(totals.preTax)}</strong></span>
                            <span className="whitespace-nowrap text-emerald-700">세후 <strong className="ml-1 font-mono text-emerald-900">{formatNumber(totals.buyback)}</strong></span>
                            <span className="whitespace-nowrap text-amber-700">미입금 <strong className="ml-1 font-mono text-amber-900">{formatNumber(Math.max(0, totals.buyback - totals.paid))}</strong></span>
                        </div>
                        <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto whitespace-nowrap text-xs font-bold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <button type="button" onClick={() => appendRows(1, true)} className="min-h-11 shrink-0 rounded-md bg-emerald-50 px-2.5 py-1.5 text-[#217346] hover:bg-emerald-100 md:min-h-8"><FontAwesomeIcon icon={faPlus} className="mr-1.5" />새 정산 행</button>
                            <button type="button" onClick={applyAutoCalculation} className="min-h-11 shrink-0 rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100 md:min-h-8"><FontAwesomeIcon icon={faArrowsRotate} className="mr-1.5" />세후율 다시 적용</button>
                            <button type="button" onClick={deleteSelectedRows} disabled={selectedRowIds.length === 0} className="min-h-11 shrink-0 rounded-md px-2 py-1.5 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 md:min-h-8"><FontAwesomeIcon icon={faTrash} className="mr-1.5" />선택 삭제</button>
                            <button type="button" onClick={exportCsv} className="min-h-11 shrink-0 rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100 md:min-h-8"><FontAwesomeIcon icon={faDownload} className="mr-1.5" />엑셀 다운로드</button>
                        </div>
                    </div>}
                </section>

                <div
                    id="buyback-workbook-panel"
                    role="tabpanel"
                    aria-labelledby={`buyback-target-tab-${activeSheetIndex}`}
                    className="min-w-0"
                >
                {!hasActiveRows ? (
                    <div className="rounded-xl border border-dashed border-emerald-300 bg-white px-5 py-10 text-center shadow-sm md:py-14">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-[#217346]"><FontAwesomeIcon icon={faPlus} /></div>
                        <h2 className="mt-4 text-base font-black text-slate-900">아직 정산 내역이 없습니다.</h2>
                        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">첫 행에 세전 금액을 입력하거나 붙여넣으세요.</p>
                        <button type="button" onClick={() => appendRows(1, true)} className="mt-5 min-h-11 rounded-lg bg-[#217346] px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#217346]">
                            <FontAwesomeIcon icon={faPlus} className="mr-2" />새 정산 행 시작
                        </button>
                    </div>
                ) : (
                    <>
                <div data-testid="field-buyback-mobile-cards" className="space-y-3 md:hidden">
                    {activeSheet.rows.map((row, index) => {
                        const selected = selectedRowIds.includes(row.id);
                        const paid = row.paymentStatus === 'paid';
                        const afterTax = getAfterTax(row, activeSheet.afterTaxRate);
                        const tax = getTax(row, activeSheet.afterTaxRate);
                        return (
                            <article key={row.id} aria-label={`${index + 1}번째 정산 행`} className={`min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm ${selected ? 'border-sky-400 ring-2 ring-sky-100' : paid ? 'border-amber-300' : 'border-slate-200'}`}>
                                <div className={`flex min-h-11 items-center justify-between gap-3 border-b px-4 py-2 ${paid ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                                    <div><span className="text-xs font-black text-slate-800">정산 행 {index + 1}</span>{paid && <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-black text-amber-900">입금 완료</span>}</div>
                                    <button type="button" onClick={() => toggleRowSelection(row.id)} aria-pressed={selected} className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-black ${selected ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>{selected ? '선택됨' : '삭제할 행 선택'}</button>
                                </div>
                                <div className="grid gap-4 p-4">
                                    <label className="grid gap-1.5 text-xs font-black text-slate-700">
                                        <span>연월</span>
                                        <YearMonthPicker
                                            value={getRowYearMonth(row)}
                                            onChange={(yearMonth) => updateRow(row.id, getYearMonthParts(yearMonth))}
                                            onBlur={() => flushRowPersistence(activeSheet, row)}
                                            ariaLabel={`${index + 1}번째 정산 행 연월 선택`}
                                            placeholderText="연월 선택"
                                            minDate={YEAR_MONTH_PICKER_MIN_DATE}
                                            maxDate={YEAR_MONTH_PICKER_MAX_DATE}
                                            portalId="field-buyback-mobile-year-month-picker-portal"
                                            popperClassName="z-[100]"
                                            className="w-full [&_.react-datepicker-wrapper]:block [&_.react-datepicker-wrapper]:w-full [&_.react-datepicker__input-container]:w-full"
                                            inputClassName="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-left text-sm font-bold text-slate-800 outline-none focus:border-[#217346] focus:ring-2 focus:ring-emerald-100"
                                        />
                                    </label>

                                    <label className="grid gap-1.5 text-xs font-black text-slate-700">
                                        <span>현장</span>
                                        <input aria-label={`${index + 1}번째 정산 행 현장`} value={row.siteName} onChange={(event) => updateRow(row.id, { siteName: event.target.value })} onBlur={() => flushRowPersistence(activeSheet, row)} placeholder="현장명 입력" className="h-11 min-w-0 rounded-lg border border-slate-300 px-3 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-[#217346] focus:ring-2 focus:ring-emerald-100" />
                                    </label>

                                    <label className="grid gap-1.5 text-xs font-black text-slate-700">
                                        <span>세전</span>
                                        <div className="relative min-w-0">
                                            <input
                                                ref={(element) => {
                                                    if (element) mobilePreTaxRefs.current.set(row.id, element);
                                                    else mobilePreTaxRefs.current.delete(row.id);
                                                }}
                                                aria-label={`${index + 1}번째 정산 행 세전`}
                                                value={row.preTax ? formatNumber(row.preTax) : ''}
                                                onChange={(event) => updateRow(row.id, { preTax: toNumber(event.target.value) })}
                                                onBlur={() => flushRowPersistence(activeSheet, row)}
                                                onFocus={(event) => event.currentTarget.select()}
                                                inputMode="numeric"
                                                placeholder="세전 금액 입력 또는 붙여넣기"
                                                className="h-12 w-full min-w-0 rounded-lg border-2 border-emerald-500 px-3 pr-8 text-right font-mono text-base font-black outline-none placeholder:text-left placeholder:font-sans placeholder:text-sm placeholder:font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-100"
                                            />
                                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">원</span>
                                        </div>
                                    </label>

                                    <div className="grid gap-1.5" aria-live="polite">
                                        <span className="text-xs font-black text-slate-700">자동 계산 세후 / 세금</span>
                                        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-emerald-200">
                                            <div className="min-w-0 bg-emerald-50 px-3 py-3"><span className="block text-[11px] font-bold text-emerald-700">세후</span><output aria-label={`${index + 1}번째 정산 행 자동 계산 세후`} className="mt-1 block truncate text-right font-mono text-sm font-black text-emerald-950">{formatNumber(afterTax)}원</output></div>
                                            <div className="min-w-0 border-l border-emerald-200 bg-white px-3 py-3"><span className="block text-[11px] font-bold text-slate-500">세금</span><output aria-label={`${index + 1}번째 정산 행 자동 계산 세금`} className="mt-1 block truncate text-right font-mono text-sm font-black text-slate-800">{formatNumber(tax)}원</output></div>
                                        </div>
                                    </div>

                                    <label className="grid gap-1.5 text-xs font-black text-slate-700">
                                        <span>입금 상태</span>
                                        <select aria-label={`${index + 1}번째 정산 행 입금 상태`} value={row.paymentStatus} onChange={(event) => updateRow(row.id, { paymentStatus: event.target.value as PaymentStatus })} onBlur={() => flushRowPersistence(activeSheet, row)} className={`h-11 w-full rounded-lg border px-3 text-sm font-black outline-none focus:border-[#217346] focus:ring-2 focus:ring-emerald-100 ${paid ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-300 bg-white text-slate-700'}`}><option value="unpaid">입금 전</option><option value="paid">입금 완료</option></select>
                                    </label>

                                    <label className="grid gap-1.5 text-xs font-black text-slate-700">
                                        <span>비고</span>
                                        <textarea aria-label={`${index + 1}번째 정산 행 비고`} value={row.note} onChange={(event) => updateRow(row.id, { note: event.target.value })} onBlur={() => flushRowPersistence(activeSheet, row)} placeholder="필요한 내용을 입력하세요" rows={2} className="min-h-[72px] min-w-0 resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none placeholder:text-slate-400 focus:border-[#217346] focus:ring-2 focus:ring-emerald-100" />
                                    </label>
                                </div>
                            </article>
                        );
                    })}
                </div>

                <details className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-950 md:hidden">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 py-2 font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#217346]">
                        <span>키보드 단축키 안내</span><span aria-hidden="true">펼치기 ▾</span>
                    </summary>
                    <div className="grid gap-1.5 border-t border-emerald-200 px-3 py-3 text-[11px] font-bold">
                        <span>방향키: 셀 이동</span><span>Enter / Shift+Enter: 아래 / 위</span><span>Tab: 다음 셀</span>
                        <span>Ctrl+S: 즉시 저장</span><span>Ctrl+C/X/V: 복사·잘라내기·붙여넣기</span>
                        <span>Ctrl+D: 위 셀 복사</span><span>Ctrl+;: 현재 연월</span><span>Delete: 셀 비우기</span>
                    </div>
                </details>

                <div data-testid="field-buyback-desktop-grid" className="hidden max-h-[calc(100vh-245px)] overflow-auto rounded-xl border-2 border-slate-700 bg-white shadow-sm md:block">
                    <table aria-label="관계자별 바이백 엑셀 입력표" onCopy={handleGridCopy} onCut={handleGridCut} onPaste={handleGridPaste} className="min-w-[1170px] w-full table-fixed border-collapse text-[13px]">
                        <colgroup>
                            <col className="w-10" /><col className="w-[75px]" /><col className="w-[192px]" /><col className="w-[140px]" />
                            <col className="w-[140px]" /><col className="w-[120px]" /><col className="w-[393px]" /><col className="w-[110px]" />
                        </colgroup>
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr className="h-6 bg-[#e7e6e6] text-center text-[11px] font-bold text-slate-500">
                                <th className="border border-slate-500">#</th>
                                {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((column) => <th key={column} className="border border-slate-300">{column}</th>)}
                            </tr>
                            <tr>
                                <th className="border border-slate-800 bg-[#e7e6e6] text-xs text-slate-500">1</th>
                                <th colSpan={7} className={`border border-slate-800 px-4 py-3 text-center text-lg font-black tracking-wide ${activeSheet.titleColor === '#ffc000' ? 'text-slate-950' : 'text-white'}`} style={{ backgroundColor: activeSheet.titleColor }}>{activeSheet.name} 바이백</th>
                            </tr>
                            <tr>
                                <th className="border border-slate-800 bg-[#e7e6e6] text-xs text-slate-500">2</th>
                                <th colSpan={2} className="border border-slate-800 bg-slate-100 px-3 py-2 text-center font-black">바이백</th>
                                <th className="border border-slate-800 bg-[#fff200] px-3 py-2 text-right font-mono text-base font-black">{formatNumber(totals.buyback)}</th>
                                <th className="border border-slate-800 bg-slate-100 px-3 py-2 text-center font-black">세금</th>
                                <th className="border border-slate-800 bg-[#fff200] px-3 py-2 text-right font-mono text-base font-black">{formatNumber(totals.tax)}</th>
                                <th className="border border-slate-800 bg-slate-100 px-3 py-2 text-center font-black">입금</th>
                                <th className="border border-slate-800 bg-[#fff200] px-3 py-2 text-right font-mono text-base font-black">{formatNumber(totals.paid)}</th>
                            </tr>
                            <tr className="h-9 bg-[#f2f2f2] text-center text-xs font-black">
                                <th className="border border-slate-800 bg-[#e7e6e6] text-slate-500">3</th>
                                {['연도 / 월', '현장 (추후 연결)', '세전', '세후', '세금', '비고', '입금'].map((header) => <th key={header} className="border border-slate-800 px-2">{header}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {displayRows.map((row, index) => {
                                const selected = selectedRowIds.includes(row.id);
                                const paid = row.paymentStatus === 'paid';
                                const afterTax = getAfterTax(row, activeSheet.afterTaxRate);
                                const tax = getTax(row, activeSheet.afterTaxRate);
                                const filled = isFilledRow(row);
                                return (
                                    <tr key={row.id} data-payment-status={row.paymentStatus} className={paid ? 'bg-[#fff200]' : selected ? 'bg-[#d9eaf7]' : filled ? 'bg-white' : 'bg-[#fcfcfc]'}>
                                        <td><button type="button" onClick={() => toggleRowSelection(row.id)} aria-label={`${index + 4}행 선택`} className={`h-9 w-full border border-slate-500 text-center text-xs font-bold ${selected ? 'bg-[#5b9bd5] text-white' : paid ? 'bg-[#fff200] text-slate-700 hover:bg-[#ffea00]' : 'bg-[#e7e6e6] text-slate-500 hover:bg-slate-300'}`}>{index + 4}</button></td>
                                        <td data-grid-row={index} data-grid-column="date" onBlur={(event) => handleYearMonthBlur(event, row)} className="border border-slate-500 p-0">
                                            <YearMonthPicker
                                                value={getRowYearMonth(row)}
                                                onChange={(yearMonth) => updateRow(row.id, getYearMonthParts(yearMonth))}
                                                inputRef={registerGridCell(row.id, 'date') as React.Ref<HTMLInputElement>}
                                                onKeyDown={(event) => handleYearMonthPickerKeyDown(event, index, row)}
                                                ariaLabel={`${index + 4}행 연월 선택`}
                                                placeholderText="연월 선택"
                                                minDate={YEAR_MONTH_PICKER_MIN_DATE}
                                                maxDate={YEAR_MONTH_PICKER_MAX_DATE}
                                                portalId="field-buyback-year-month-picker-portal"
                                                popperClassName="z-[100]"
                                                className={`h-9 w-full [&_.react-datepicker-wrapper]:block [&_.react-datepicker-wrapper]:h-full [&_.react-datepicker-wrapper]:w-full [&_.react-datepicker__input-container]:h-full [&_.react-datepicker__input-container]:w-full ${paid ? 'bg-[#fff200]' : 'bg-slate-50'}`}
                                                inputClassName="h-9 w-full cursor-pointer border-0 bg-transparent px-2 text-center text-xs font-black text-slate-700 outline-none transition placeholder:text-slate-400 hover:bg-emerald-50 focus:bg-[#fff2cc] focus:ring-2 focus:ring-inset focus:ring-[#217346]"
                                            />
                                        </td>
                                        <td className="border border-slate-500 p-0"><input ref={registerGridCell(row.id, 'siteName')} data-grid-row={index} data-grid-column="siteName" aria-label={`${index + 4}행 현장`} value={row.siteName} onChange={(event) => updateRow(row.id, { siteName: event.target.value })} onKeyDown={(event) => handleGridCellKeyDown(event, index, 1, row)} onBlur={() => flushRowPersistence(activeSheet, row)} placeholder="현장명 입력 (추후 DB 연결)" className="h-9 w-full bg-transparent px-2 outline-none placeholder:text-slate-300 focus:bg-[#fff2cc] focus:ring-2 focus:ring-inset focus:ring-[#217346]" /></td>
                                        <td className="border border-slate-500 p-0"><input ref={registerGridCell(row.id, 'preTax')} data-grid-row={index} data-grid-column="preTax" aria-label={`${index + 4}행 세전`} value={row.preTax ? formatNumber(row.preTax) : ''} onChange={(event) => updateRow(row.id, { preTax: toNumber(event.target.value) })} onKeyDown={(event) => handleGridCellKeyDown(event, index, 2, row)} onBlur={() => flushRowPersistence(activeSheet, row)} inputMode="numeric" className="h-9 w-full bg-transparent px-2 text-right font-mono outline-none focus:bg-[#fff2cc] focus:ring-2 focus:ring-inset focus:ring-[#217346]" /></td>
                                        <td className={`border border-slate-500 p-0 ${paid ? 'bg-[#fff200]' : 'bg-[#e2f0d9]'}`}><input ref={registerGridCell(row.id, 'afterTax')} data-grid-row={index} data-grid-column="afterTax" aria-label={`${index + 4}행 세후`} value={afterTax ? formatNumber(afterTax) : ''} onChange={(event) => updateRow(row.id, { afterTax: toNumber(event.target.value), afterTaxManual: true })} onKeyDown={(event) => handleGridCellKeyDown(event, index, 3, row)} onBlur={() => flushRowPersistence(activeSheet, row)} inputMode="numeric" className="h-9 w-full bg-transparent px-2 text-right font-mono font-black outline-none focus:bg-[#fff2cc] focus:ring-2 focus:ring-inset focus:ring-[#217346]" title="기본값은 관계자 DB의 세후율이며, 직접 수정한 행은 수기 세후 금액으로 고정됩니다." /></td>
                                        <td ref={registerGridCell(row.id, 'tax')} data-grid-row={index} data-grid-column="tax" tabIndex={0} aria-label={`${index + 4}행 세금 ${tax ? formatNumber(tax) : '0'}`} onKeyDown={(event) => handleGridCellKeyDown(event, index, 4, row)} className="border border-slate-500 px-2 text-right font-mono text-slate-700 outline-none focus:bg-[#fff2cc] focus:ring-2 focus:ring-inset focus:ring-[#217346]">{tax ? formatNumber(tax) : ''}</td>
                                        <td className="border border-slate-500 p-0"><input ref={registerGridCell(row.id, 'note')} data-grid-row={index} data-grid-column="note" aria-label={`${index + 4}행 비고`} value={row.note} onChange={(event) => updateRow(row.id, { note: event.target.value })} onKeyDown={(event) => handleGridCellKeyDown(event, index, 5, row)} onBlur={() => flushRowPersistence(activeSheet, row)} placeholder="비고" className={`h-9 w-full bg-transparent px-2 text-xs outline-none placeholder:text-slate-300 focus:bg-[#fff2cc] focus:ring-2 focus:ring-inset focus:ring-[#217346] ${row.note ? 'text-red-600' : ''}`} /></td>
                                        <td className="border border-slate-500 p-0"><select ref={registerGridCell(row.id, 'paymentStatus')} data-grid-row={index} data-grid-column="paymentStatus" aria-label={`${index + 4}행 입금`} value={row.paymentStatus} onChange={(event) => updateRow(row.id, { paymentStatus: event.target.value as PaymentStatus })} onKeyDown={(event) => handleGridCellKeyDown(event, index, 6, row)} onBlur={() => flushRowPersistence(activeSheet, row)} className={`h-9 w-full border-0 bg-transparent px-2 text-center text-xs font-black outline-none focus:ring-2 focus:ring-inset focus:ring-[#217346] ${row.paymentStatus === 'paid' ? 'bg-[#fff200] text-slate-950' : 'text-slate-400'}`}><option value="unpaid">입금 전</option><option value="paid">입금 완료</option></select></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-10">
                            <tr className="h-[37px] whitespace-nowrap bg-[#fff200] font-black">
                                <td className="border border-slate-800 text-center">합계</td>
                                <td colSpan={2} className="border border-slate-800 px-3 text-center">입력 {totals.count.toLocaleString('ko-KR')}건 · 세전 {formatNumber(totals.preTax)}</td>
                                <td className="border border-slate-800 px-2 text-right font-mono">{formatNumber(totals.preTax)}</td>
                                <td className="border border-slate-800 px-2 text-right font-mono">{formatNumber(totals.buyback)}</td>
                                <td className="border border-slate-800 px-2 text-right font-mono">{formatNumber(totals.tax)}</td>
                                <td className="border border-slate-800 px-2 text-left">현장 DB 연결은 추후 적용</td>
                                <td className="border border-slate-800 px-2 text-right font-mono">{formatNumber(totals.paid)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-bold text-slate-500">
                    <span><span className="text-sky-700">관계자 DB: 연결됨</span> · 바이백 관계자 {buybackTargets.length}명</span>
                    <span className="text-amber-700">현장 DB: 미연동</span>
                    <span>{lastSavedAt ? `최근 저장 ${lastSavedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '입력하면 자동으로 DB에 저장됩니다.'}</span>
                    <details className="relative hidden md:block">
                        <summary className="cursor-pointer rounded px-2 py-1 text-slate-500 hover:bg-slate-100">키보드 빠른 입력</summary>
                        <div className="absolute bottom-full right-0 z-30 mb-2 grid w-72 gap-1.5 rounded-xl border border-slate-200 bg-white p-4 text-xs font-medium leading-5 text-slate-600 shadow-lg">
                            <span>방향키: 셀 이동 · Tab: 다음 셀</span><span>Enter / Shift+Enter: 아래 / 위</span><span>Ctrl+S: 즉시 저장</span><span>Ctrl+C/X/V: 복사·잘라내기·붙여넣기</span><span>Ctrl+D: 위 셀 복사</span><span>Ctrl+;: 현재 연월 · Delete: 셀 비우기</span>
                        </div>
                    </details>
                </div>
                    </>
                )}
                </div>
            </div>
            {targetDialog}
        </div>
    );
};

export default FieldBuybackWorkbookPage;
