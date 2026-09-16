import { ExcelError, evaluateCellFormula, FormulaContext, UnsupportedFormula } from './formula';
import { Scalar } from './types';
import { columnName, columnNumber, elements } from './workbook';
export interface FormulaCalculation {
    calculated: number;
    unresolved: number;
}
/** Refresh caches only; preserve every original formula and its shared definition. */
export function recalculateSheet(doc: Document, options: Omit<FormulaContext, 'lookup' | 'address'> & {
    sharedStrings?: string[];
} = {}): FormulaCalculation {
    const cells = new Map(elements(doc, 'c').map(c => [c.getAttribute('r')!, c]));
    const shared = new Map<string, {
        address: string;
        formula: string;
    }>();
    for (const [address, cell] of cells) {
        const f = elements(cell, 'f')[0];
        if (f?.getAttribute('t') === 'shared' && f.textContent && f.hasAttribute('si'))
            shared.set(f.getAttribute('si')!, { address, formula: f.textContent });
    }
    const formulaAt = (address: string, f: Element): string => {
        if (!f.hasAttribute('t') || f.getAttribute('t') === 'normal')
            return f.textContent || '';
        if (f.getAttribute('t') !== 'shared')
            throw new UnsupportedFormula('formula-type');
        const master = shared.get(f.getAttribute('si') || '');
        if (!master)
            throw new UnsupportedFormula('shared-master');
        const deltaCol = columnNumber(address.replace(/\d/g, '')) - columnNumber(master.address.replace(/\d/g, ''));
        const deltaRow = Number(address.match(/\d+$/)![0]) - Number(master.address.match(/\d+$/)![0]);
        return master.formula.split(/("(?:[^"]|"")*")/g).map((part, i) => i % 2 ? part : part.replace(/(\$?)([A-Z]+)(\$?)([1-9]\d*)\b/gi, (_, fixedCol: string, col: string, fixedRow: string, row: string) => {
            const c = columnNumber(col.toUpperCase()) + (fixedCol ? 0 : deltaCol), r = Number(row) + (fixedRow ? 0 : deltaRow);
            if (c < 1 || r < 1)
                throw new UnsupportedFormula('shared-reference');
            return `${fixedCol}${columnName(c)}${fixedRow}${r}`;
        })).join('');
    };
    const memo = new Map<string, Scalar>(), errors = new Map<string, unknown>(), active = new Set<string>();
    const today = options.today || new Date();
    const budget = options.budget || { remaining: 2000000 };
    const value = (address: string): Scalar => {
        if (memo.has(address))
            return memo.get(address)!;
        if (errors.has(address))
            throw errors.get(address);
        if (active.has(address) || active.size >= 100)
            throw new UnsupportedFormula('cycle-or-depth');
        active.add(address);
        try {
            const cell = cells.get(address), f = cell && elements(cell, 'f')[0];
            let result: Scalar = null;
            if (f)
                result = evaluateCellFormula(formulaAt(address, f), { ...options, today, budget, address, lookup: value });
            else if (cell) {
                const type = cell.getAttribute('t'), raw = elements(cell, 'v')[0]?.textContent;
                if (type === 'e')
                    throw new ExcelError(raw || '#VALUE!');
                if (type === 's') {
                    result = raw == null ? null : options.sharedStrings?.[Number(raw)] ?? null;
                    if (raw != null && result === null)
                        throw new UnsupportedFormula('shared-string');
                }
                else if (type === 'inlineStr')
                    result = elements(cell, 't').map(t => t.textContent || '').join('');
                else if (type === 'str')
                    result = raw ?? '';
                else if (type === 'b')
                    result = raw === '1';
                else if (type && type !== 'n')
                    throw new UnsupportedFormula('cell-type');
                else if (raw != null && raw !== '') {
                    result = Number(raw);
                    if (!Number.isFinite(result))
                        throw new UnsupportedFormula('cell-number');
                }
            }
            memo.set(address, result);
            return result;
        }
        catch (error) {
            errors.set(address, error);
            throw error;
        }
        finally {
            active.delete(address);
        }
    };
    const outcome: FormulaCalculation = { calculated: 0, unresolved: 0 };
    // Calculate before mutating caches so cell types cannot affect dependency reads.
    const formulas = [...cells].filter(([, c]) => elements(c, 'f').length);
    for (const [address] of formulas) {
        try {
            value(address);
            outcome.calculated++;
        }
        catch {
            outcome.unresolved++;
        }
    }
    for (const [address, cell] of formulas) {
        for (const child of Array.from(cell.children))
            if (['v', 'is'].includes(child.localName))
                cell.removeChild(child);
        cell.removeAttribute('t');
        if (errors.has(address))
            continue;
        const result = memo.get(address)!;
        if (typeof result === 'string')
            cell.setAttribute('t', 'str');
        if (typeof result === 'boolean')
            cell.setAttribute('t', 'b');
        const cache = doc.createElementNS(cell.namespaceURI, 'v');
        cache.textContent = typeof result === 'boolean' ? (result ? '1' : '0') : String(result ?? 0);
        cell.appendChild(cache);
    }
    return outcome;
}
