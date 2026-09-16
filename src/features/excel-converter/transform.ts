import { CellTrace, ConversionPlan, DataRow, DataTable, Issue, Mapping, Rules, Scalar, ValueKind } from './types';
export function numberValue(value: Scalar): number | null {
    if (value === null || value === '' || typeof value === 'boolean')
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    const raw = value.trim().replace(/,/g, '');
    if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw))
        return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}
// Fixed decimal operations avoid summing binary fractions (e.g. 0.1 + 0.2).
export function decimalSum(values: number[]): number {
    const digits = (value: number) => { const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e'); return Math.max(0, (mantissa.split('.')[1] || '').length - Number(exponent)); };
    const normalized = values.map(value => {
        if (!Number.isFinite(value)) throw new Error('합산할 값이 유효한 숫자가 아닙니다.');
        if (digits(value) <= 8) return value;
        const nearest = Number(value.toFixed(8));
        // Excel formula caches can store 14.6 as 14.600000000000001.
        // Accept only floating-point noise, capped well below the supported
        // decimal unit so larger values cannot hide meaningful extra digits.
        const tolerance = Math.min(1e-12, Number.EPSILON * Math.abs(value) * 4);
        if (Math.abs(value - nearest) <= tolerance) return nearest;
        throw new Error('합산은 소수 8자리까지 지원합니다. 반올림 기준을 먼저 정해 주세요.');
    });
    const precision = Math.max(0, ...normalized.map(digits));
    const factor = 10 ** precision;
    const scaled = normalized.map(v => Math.round(v * factor));
    if (scaled.some(v => !Number.isSafeInteger(v)))
        throw new Error('숫자의 자릿수가 안전한 계산 범위를 초과합니다.');
    const total = scaled.reduce((a, b) => a + b, 0);
    if (!Number.isSafeInteger(total))
        throw new Error('합계가 안전한 계산 범위를 초과합니다.');
    return total / factor;
}
export const roundValue = (value: number, decimals: number, mode: Mapping['rounding']): number => {
    const factor = 10 ** decimals;
    const shifted = value * factor;
    if (!Number.isSafeInteger(Math.trunc(shifted)))
        throw new Error('계산값이 지원하는 숫자 범위를 초과합니다.');
    const rounded = mode === 'floor' ? Math.floor(shifted) : mode === 'ceil' ? Math.ceil(shifted) : mode === 'truncate' ? Math.trunc(shifted) : Math.sign(shifted) * Math.round(Math.abs(shifted) + Number.EPSILON * Math.abs(shifted));
    return rounded / factor;
};
export function strictDate(value: Scalar): string | null {
    if (typeof value !== 'string')
        return null;
    const m = value.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
    if (!m)
        return null;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() + 1 !== Number(m[2]) || d.getUTCDate() !== Number(m[3]))
        return null;
    return d.toISOString().slice(0, 10);
}
export function runRules(table: DataTable, rules: Rules, usedKeys: string[]): {
    rows: DataRow[];
    excluded: {
        origin: string;
        reason: string;
    }[];
    issues: Issue[];
} {
    const excluded = [...table.skipped];
    const issues: Issue[] = table.warnings.map(message => ({ level: 'error', code: 'source', message }));
    let rows = table.rows.filter(row => {
        for (const filter of rules.filters) {
            const value = row.values[filter.key];
            const text = String(value ?? '');
            const number = numberValue(value);
            const expected = numberValue(filter.value);
            const matches = filter.op === 'eq' ? text === filter.value : filter.op === 'neq' ? text !== filter.value : filter.op === 'contains' ? text.includes(filter.value) : filter.op === 'notContains' ? !text.includes(filter.value) : filter.op === 'notEmpty' ? value !== null && text !== '' : filter.op === 'empty' ? value === null || text === '' : number === null || expected === null ? null : filter.op === 'gt' ? number > expected : filter.op === 'gte' ? number >= expected : filter.op === 'lt' ? number < expected : number <= expected;
            if (matches === null) {
                issues.push({ level: 'error', code: 'filter-number', message: '숫자 비교 조건에 숫자가 아닌 값이 있습니다.', location: row.origins[0] });
                return true;
            }
            if (!matches) {
                excluded.push({ origin: row.origins[0], reason: `${table.fields.find(f => f.key === filter.key)?.label} ${filter.op} ${filter.value} 조건에서 제외` });
                return false;
            }
        }
        return true;
    }).map(r => ({ ...r, values: { ...r.values }, origins: [...r.origins] }));
    if (rules.groupBy.length) {
        const groups = new Map<string, DataRow[]>();
        for (const row of rows) {
            const key = JSON.stringify([...rules.groupBy, ...(rules.splitBy ? [rules.splitBy] : [])].map(k => row.values[k]));
            if (!groups.has(key))
                groups.set(key, []);
            groups.get(key)!.push(row);
        }
        rows = Array.from(groups.values()).map(group => {
            const first = group[0];
            const values = { ...first.values };
            for (const key of rules.sums) {
                const numbers = group.map(r => numberValue(r.values[key]));
                if (numbers.some(n => n === null))
                    issues.push({ level: 'error', code: 'sum-missing', message: `${table.fields.find(f => f.key === key)?.label}: 합산할 값이 비어 있거나 숫자가 아닙니다.`, location: first.origins[0] });
                else
                    values[key] = decimalSum(numbers as number[]);
            }
            for (const key of usedKeys.filter(k => !rules.sums.includes(k) && !rules.groupBy.includes(k))) {
                if (group.some(r => r.values[key] !== first.values[key]))
                    issues.push({ level: 'error', code: 'group-conflict', message: `${table.fields.find(f => f.key === key)?.label || key}: 같은 그룹에 서로 다른 값이 있습니다. 합산 기준에 추가해 주세요.`, location: first.origins[0] });
            }
            return { id: first.id, values, origins: group.flatMap(r => r.origins) };
        });
    }
    if (rules.sort.length)
        rows.sort((a, b) => {
            for (const sort of rules.sort) {
                const av = a.values[sort.key];
                const bv = b.values[sort.key];
                const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), 'ko', { numeric: true });
                if (result)
                    return sort.direction === 'asc' ? result : -result;
            }
            return 0;
        });
    return { rows, excluded, issues };
}
export function mapValue(mapping: Mapping, row: DataRow): {
    value: Scalar;
    kind: ValueKind;
} {
    const source = mapping.sourceKeys.map(key => row.values[key] ?? null);
    let value: Scalar = mapping.mode === 'blank' ? null : mapping.mode === 'constant' ? mapping.constant : mapping.mode === 'concat' ? source.filter(v => v !== null && v !== '').join(mapping.separator) : source[0] ?? null;
    if (mapping.mode === 'product') {
        const numbers = source.map(numberValue);
        if (numbers.some(v => v === null))
            throw new Error(`${mapping.label}: 곱할 값이 비어 있거나 숫자가 아닙니다.`);
        value = (numbers as number[]).reduce((a, b) => a * b, 1);
    }
    if (mapping.required && (value === null || value === ''))
        throw new Error(`${mapping.label}: 필수값이 비어 있습니다.`);
    if (value === null || value === '')
        return { value, kind: 'blank' };
    if (mapping.format === 'date') {
        const date = strictDate(value);
        if (!date)
            throw new Error(`${mapping.label}: 날짜는 연-월-일로 구분할 수 있어야 합니다.`);
        return { value: date, kind: 'date' };
    }
    if (mapping.format === 'text')
        return { value: String(value), kind: 'text' };
    if (mapping.format === 'number' || mapping.mode === 'product' || mapping.scale !== 1 || mapping.decimals !== null) {
        const number = numberValue(value);
        if (number === null)
            throw new Error(`${mapping.label}: 숫자로 바꿀 수 없습니다.`);
        value = number * mapping.scale;
        if (mapping.decimals !== null)
            value = roundValue(value, mapping.decimals, mapping.rounding);
        else
            value = Number(value.toPrecision(15));
        if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
            throw new Error(`${mapping.label}: 계산 범위를 초과했습니다.`);
    }
    return { value, kind: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'text' };
}
export function buildTraces(plan: ConversionPlan, rows: DataRow[], sheetName: string, inputRows?: number[]): {
    traces: CellTrace[];
    issues: Issue[];
} {
    const traces: CellTrace[] = [];
    const issues: Issue[] = [];
    const add = (mapping: Mapping, row: DataRow, address: string, fixed = false) => { try {
        const override = !fixed && plan.overrides?.find(o => o.originsKey === row.origins.join('\n') && o.targetColumn === mapping.targetColumn && (o.rowOffset || 0) === (mapping.rowOffset || 0));
        const result = override ? { value: override.value, kind: override.kind } : mapValue(mapping, row);
        if (mapping.required && (result.value === null || result.value === ''))
            throw new Error(`${mapping.label}: 필수값을 빈칸으로 수정할 수 없습니다.`);
        traces.push({ sheet: sheetName, address, label: mapping.label, ...result, origins: mapping.mode === 'constant' ? ['사용자 고정값'] : row.origins, rule: override ? '사용자 직접 수정' : `${mapping.mode}${mapping.scale !== 1 ? ` × ${mapping.scale}` : ''}${mapping.decimals !== null ? ` / 소수 ${mapping.decimals}자리 ${mapping.rounding}` : ''}` });
    }
    catch (error) {
        issues.push({ level: 'error', code: 'value', message: (error as Error).message, location: `${sheetName}!${address}` });
    } };
    for (const fixed of plan.fixedCells) {
        const keys = fixed.mapping.sourceKeys;
        if (rows.some(row => keys.some(k => row.values[k] !== rows[0]?.values[k]))) {
            issues.push({ level: 'error', code: 'fixed-conflict', message: `${fixed.mapping.label}: 단일 입력 칸에 여러 값이 있습니다. 파일 분리 기준을 지정해 주세요.`, location: fixed.address });
            continue;
        }
        add(fixed.mapping, rows[0] || { id: '', values: {}, origins: [] }, fixed.address, true);
    }
    rows.forEach((row, i) => plan.mappings.forEach(mapping => {
        let n = mapping.targetColumn;
        let col = '';
        while (n) {
            n--;
            col = String.fromCharCode(65 + n % 26) + col;
            n = Math.floor(n / 26);
        }
        add(mapping, row, `${col}${(inputRows?.[i] ?? plan.startRow + i) + (mapping.rowOffset || 0)}`);
    }));
    return { traces, issues };
}
