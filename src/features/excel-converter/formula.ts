import { Scalar } from './types';
import { columnName, columnNumber } from './workbook';
// A closed expression language. Formula text never reaches eval, Function,
// network APIs, external references, VBA, or an operating-system command.
export class UnsupportedFormula extends Error {
}
export class ExcelError extends Error {
}
const fail = (code = '#VALUE!'): never => { throw new ExcelError(code); };
type Matrix = {
    rows: number;
    columns: number;
    values: Scalar[];
};
type Value = Scalar | Matrix;
type Node = {
    type: 'value';
    value: Scalar;
} | {
    type: 'ref';
    address: string;
} | {
    type: 'range';
    from: string;
    to: string;
} | {
    type: 'unary';
    op: string;
    value: Node;
} | {
    type: 'binary';
    op: string;
    left: Node;
    right: Node;
} | {
    type: 'call';
    name: string;
    args: Node[];
};
export interface FormulaContext {
    lookup: (address: string) => Scalar;
    address?: string;
    today?: Date;
    date1904?: boolean;
    budget?: {
        remaining: number;
    };
}
const functions = new Set('SUM PRODUCT MIN MAX ROUND ROUNDDOWN ROUNDUP TRUNC INT ABS MOD IF IFERROR AND OR NOT TRUE FALSE ISNUMBER LEN VALUE LEFT RIGHT MID SUBSTITUTE SEARCH FIND COUNT COUNTA COUNTIF SUMPRODUCT ROW COLUMNS DATE DAY MONTH YEAR TODAY DATEDIF'.split(' '));
const matrix = (v: Value): v is Matrix => typeof v === 'object' && v !== null;
const scalar = (v: Value): Scalar => { if (matrix(v))
    throw new UnsupportedFormula('array-result'); return v; };
const flat = (v: Value): Scalar[] => matrix(v) ? v.values : [v];
const numeric = (v: Scalar): number => {
    if (v === null)
        return 0;
    if (v === '')
        return fail();
    if (typeof v === 'boolean')
        return v ? 1 : 0;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : fail('#NUM!');
    const clean = v.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(clean))
        return fail();
    return Number.isFinite(Number(clean)) ? Number(clean) : fail('#NUM!');
};
const string = (v: Scalar) => v === null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
const truth = (v: Scalar): boolean => typeof v === 'string' ? /^(true|false)$/i.test(v) ? v.toUpperCase() === 'TRUE' : fail() : !!v;
const finite = (n: number) => Number.isFinite(n) ? n : fail('#NUM!');
const point = (address: string) => ({ col: columnNumber(address.replace(/\d/g, '')), row: Number(address.match(/\d+$/)![0]) });
function parse(formula: string): Node {
    const text = formula.replace(/^=/, '');
    if (text.length > 16000)
        throw new UnsupportedFormula('length');
    const tokens = text.match(/"(?:[^"]|"")*"|(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?|\$?[A-Z]+\$?[1-9]\d*|[A-Z_][A-Z0-9_.]*|<>|<=|>=|[+*/^%&():,=<>-]/gi) || [];
    // Whitespace inside string literals is significant.
    const compact = (s: string) => s.replace(/"(?:[^"]|"")*"|\s+/g, m => m[0] === '"' ? m : '');
    if (tokens.join('') !== compact(text) || tokens.length > 4096)
        throw new UnsupportedFormula('syntax');
    let i = 0, depth = 0;
    const expect = (t: string) => { if (tokens[i++] !== t)
        throw new UnsupportedFormula('syntax'); };
    const precedence: Record<string, number> = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
    const expression = (min = 1): Node => {
        if (++depth > 64)
            throw new UnsupportedFormula('depth');
        let left = atom();
        while ((precedence[tokens[i]] || 0) >= min) {
            const op = tokens[i++];
            left = { type: 'binary', op, left, right: expression(precedence[op] + 1) };
        }
        depth--;
        return left;
    };
    const atom = (): Node => {
        const token = tokens[i++];
        let node: Node;
        if (token === '+' || token === '-')
            node = { type: 'unary', op: token, value: expression(6) };
        else if (token === '(') {
            node = expression();
            expect(')');
        }
        else if (token?.startsWith('"'))
            node = { type: 'value', value: token.slice(1, -1).replace(/""/g, '"') };
        else if (/^(?:\d|\.)/.test(token || ''))
            node = { type: 'value', value: Number(token) };
        else if (/^\$?[A-Z]+\$?[1-9]\d*$/i.test(token || '')) {
            const address = token.replace(/\$/g, '').toUpperCase();
            const p = point(address);
            if (p.row > 30000 || p.col > 100)
                throw new UnsupportedFormula('reference-limit');
            if (tokens[i] === ':') {
                i++;
                const to = (tokens[i++] || '').replace(/\$/g, '').toUpperCase();
                if (!/^[A-Z]+[1-9]\d*$/.test(to))
                    throw new UnsupportedFormula('range');
                const end = point(to);
                if (end.row < p.row || end.col < p.col || end.row > 30000 || end.col > 100 || (end.row - p.row + 1) * (end.col - p.col + 1) > 30000)
                    throw new UnsupportedFormula('range');
                node = { type: 'range', from: address, to };
            }
            else
                node = { type: 'ref', address };
        }
        else {
            const name = token?.toUpperCase();
            if ((name === 'TRUE' || name === 'FALSE') && tokens[i] !== '(')
                node = { type: 'value', value: name === 'TRUE' };
            else {
                if (!functions.has(name))
                    throw new UnsupportedFormula('unsupported-function');
                expect('(');
                const args: Node[] = [];
                if (tokens[i] !== ')')
                    do {
                        if (args.length)
                            expect(',');
                        args.push(expression());
                    } while (tokens[i] === ',');
                expect(')');
                node = { type: 'call', name, args };
            }
        }
        while (tokens[i] === '%') {
            i++;
            node = { type: 'unary', op: '%', value: node };
        }
        return node;
    };
    const root = expression();
    if (i !== tokens.length)
        throw new UnsupportedFormula('syntax');
    return root;
}
function lift(a: Value, b: Value, operation: (a: Scalar, b: Scalar) => Scalar): Value {
    if (!matrix(a) && !matrix(b))
        return operation(a, b);
    const shape = matrix(a) ? a : b as Matrix;
    if (matrix(a) && matrix(b) && (a.rows !== b.rows || a.columns !== b.columns))
        return fail();
    return { rows: shape.rows, columns: shape.columns, values: shape.values.map((_, i) => operation(matrix(a) ? a.values[i] : a, matrix(b) ? b.values[i] : b)) };
}
function compare(a: Scalar, b: Scalar): number {
    if (a === null)
        a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
    if (b === null)
        b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
    if (typeof a !== typeof b) {
        const rank = (v: Scalar) => typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2;
        return rank(a) - rank(b);
    }
    if (typeof a === 'string' && typeof b === 'string') {
        a = a.toUpperCase();
        b = b.toUpperCase();
    }
    return a === b ? 0 : a! > b! ? 1 : -1;
}
function binary(op: string, a: Scalar, b: Scalar): Scalar {
    if (op === '&')
        return string(a) + string(b);
    if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
        const c = compare(a, b);
        return op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
    }
    const x = numeric(a), y = numeric(b);
    if (op === '/' && y === 0)
        return fail('#DIV/0!');
    return finite(op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : op === '/' ? x / y : x ** y);
}
function rounded(value: number, digits: number, mode: string) {
    digits = Math.trunc(digits);
    if (Math.abs(digits) > 15)
        throw new UnsupportedFormula('rounding-limit');
    // Decimal exponent shifting avoids manufacturing 1.004999... for 1.005.
    const shift = (n: number, d: number) => { const [base, exponent = '0'] = String(n).split('e'); return Number(`${base}e${Number(exponent) + d}`); };
    const scaled = shift(Number(Math.abs(value).toPrecision(15)), digits);
    const n = mode === 'ROUND' ? Math.round(scaled) : mode === 'ROUNDUP' ? Math.ceil(scaled) : Math.floor(scaled);
    return finite(Math.sign(value) * shift(n, -digits));
}
const utc = (year: number, month: number, day: number) => { const d = new Date(0); d.setUTCFullYear(year, month, day); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
const epoch = utc(1899, 11, 31), leapBoundary = utc(1900, 2, 1), dayMs = 86400000;
function dateSerial(year: number, month: number, day: number, date1904: boolean): number {
    year = Math.trunc(year);
    month = Math.trunc(month);
    day = Math.trunc(day);
    if (year < 0 || year >= 10000)
        return fail('#NUM!');
    if (year < 1900)
        year += 1900;
    const first = utc(year, month - 1, 1);
    const serial = (first - (date1904 ? utc(1904, 0, 1) : epoch)) / dayMs + (!date1904 && first >= leapBoundary ? 1 : 0) + day - 1;
    if (serial < 0 || serial > 2958465 - (date1904 ? 1462 : 0))
        return fail('#NUM!');
    return serial;
}
function dateParts(serial: number, date1904: boolean): [
    number,
    number,
    number
] {
    const n = Math.floor(serial);
    if (n < 0 || n > 2958465 - (date1904 ? 1462 : 0))
        return fail('#NUM!');
    if (!date1904 && n === 60)
        return [1900, 2, 29];
    if (!date1904 && n === 0)
        return [1900, 1, 0];
    const d = new Date((date1904 ? utc(1904, 0, 1) : epoch) + (n - (!date1904 && n > 60 ? 1 : 0)) * dayMs);
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}
// Bounded wildcard matching avoids regular-expression backtracking from workbook text.
function wildcardFind(pattern: string, input: string, search = false): number {
    const tokens: {
        text: string;
        wildcard: boolean;
    }[] = [];
    const chars = Array.from(pattern.toUpperCase()), values = Array.from(input.toUpperCase());
    for (let i = 0; i < chars.length; i++) {
        const escaped = chars[i] === '~' && i + 1 < chars.length;
        tokens.push({ text: escaped ? chars[++i] : chars[i], wildcard: !escaped });
    }
    if ((tokens.length + 1) * (values.length + 1) > 1000000)
        throw new UnsupportedFormula('wildcard-limit');
    let state = Array<number>(tokens.length + 1).fill(Infinity);
    state[0] = 0;
    let best = Infinity;
    for (let i = 0; i <= values.length; i++) {
        if (search)
            state[0] = Math.min(state[0], i);
        for (let j = 0; j < tokens.length; j++)
            if (tokens[j].wildcard && tokens[j].text === '*')
                state[j + 1] = Math.min(state[j + 1], state[j]);
        if (search || i === values.length)
            best = Math.min(best, state[tokens.length]);
        if (i === values.length)
            break;
        const next = Array<number>(tokens.length + 1).fill(Infinity);
        for (let j = 0; j < tokens.length; j++) {
            const token = tokens[j];
            if (token.wildcard && token.text === '*')
                next[j] = Math.min(next[j], state[j]);
            else if ((token.wildcard && token.text === '?') || token.text === values[i])
                next[j + 1] = Math.min(next[j + 1], state[j]);
        }
        state = next;
    }
    return Number.isFinite(best) ? best : -1;
}
export function evaluateCellFormula(formula: string, context: FormulaContext): Scalar {
    const root = parse(formula);
    let operations = 0;
    const charge = (amount = 1) => {
        operations += amount;
        if (context.budget)
            context.budget.remaining -= amount;
        if (operations > 200000 || (context.budget && context.budget.remaining < 0))
            throw new UnsupportedFormula('work-limit');
    };
    const evaluate = (node: Node): Value => {
        charge();
        if (node.type === 'value')
            return node.value;
        if (node.type === 'ref')
            return context.lookup(node.address);
        if (node.type === 'range') {
            const from = point(node.from), to = point(node.to), values: Scalar[] = [];
            charge((to.row - from.row + 1) * (to.col - from.col + 1));
            for (let r = from.row; r <= to.row; r++)
                for (let c = from.col; c <= to.col; c++)
                    values.push(context.lookup(`${columnName(c)}${r}`));
            return { rows: to.row - from.row + 1, columns: to.col - from.col + 1, values };
        }
        if (node.type === 'unary')
            return lift(evaluate(node.value), 0, a => node.op === '-' ? -numeric(a) : node.op === '%' ? numeric(a) / 100 : numeric(a));
        if (node.type === 'binary')
            return lift(evaluate(node.left), evaluate(node.right), (a, b) => binary(node.op, a, b));
        return call(node.name, node.args);
    };
    const call = (name: string, args: Node[]): Value => {
        const arity = (min: number, max = min) => { if (args.length < min || args.length > max)
            throw new UnsupportedFormula('arguments'); };
        const value = (i: number) => scalar(evaluate(args[i]));
        const num = (i: number) => numeric(value(i));
        const text = (i: number) => string(value(i));
        if (name === 'IF') {
            arity(2, 3);
            return truth(value(0)) ? evaluate(args[1]) : args[2] ? evaluate(args[2]) : false;
        }
        if (name === 'IFERROR') {
            arity(2);
            try {
                return evaluate(args[0]);
            }
            catch (e) {
                if (e instanceof ExcelError)
                    return evaluate(args[1]);
                throw e;
            }
        }
        if (name === 'ISNUMBER') {
            arity(1);
            try {
                return typeof value(0) === 'number';
            }
            catch (e) {
                if (e instanceof ExcelError)
                    return false;
                throw e;
            }
        }
        if (name === 'TRUE' || name === 'FALSE') {
            arity(0);
            return name === 'TRUE';
        }
        if (name === 'NOT') {
            arity(1);
            return !truth(value(0));
        }
        if (name === 'AND' || name === 'OR') {
            arity(1, 255);
            const booleans = args.flatMap(a => { const v = evaluate(a); return a.type === 'ref' || a.type === 'range' || matrix(v) ? flat(v).filter(x => x !== null && typeof x !== 'string').map(truth) : [truth(scalar(v))]; });
            if (!booleans.length)
                return fail();
            return name === 'AND' ? booleans.every(Boolean) : booleans.some(Boolean);
        }
        if (['SUM', 'PRODUCT', 'MIN', 'MAX', 'COUNT', 'COUNTA'].includes(name)) {
            arity(1, 255);
            const items = args.flatMap(a => { const result = evaluate(a); return flat(result).map(v => ({ v, reference: a.type === 'ref' || a.type === 'range' || matrix(result) })); });
            if (name === 'COUNTA')
                return items.filter(({ v }) => v !== null).length;
            if (name === 'COUNT')
                return items.filter(({ v, reference }) => typeof v === 'number' || (!reference && v !== null && v !== '' && (typeof v === 'boolean' || (typeof v === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))))).length;
            const numbers = items.filter(({ v, reference }) => !reference || typeof v === 'number').map(({ v }) => numeric(v));
            if (!numbers.length)
                return 0;
            return finite(name === 'SUM' ? numbers.reduce((a, b) => a + b, 0) : name === 'PRODUCT' ? numbers.reduce((a, b) => a * b, 1) : name === 'MIN' ? Math.min(...numbers) : Math.max(...numbers));
        }
        if (['ROUND', 'ROUNDDOWN', 'ROUNDUP', 'TRUNC'].includes(name)) {
            arity(name === 'TRUNC' ? 1 : 2, 2);
            return rounded(num(0), args[1] ? num(1) : 0, name);
        }
        if (name === 'ABS' || name === 'INT') {
            arity(1);
            return name === 'ABS' ? Math.abs(num(0)) : Math.floor(num(0));
        }
        if (name === 'MOD') {
            arity(2);
            return lift(evaluate(args[0]), evaluate(args[1]), (a, b) => { const n = numeric(a), d = numeric(b); return d ? finite(n - d * Math.floor(n / d)) : fail('#DIV/0!'); });
        }
        if (name === 'LEN') {
            arity(1);
            return Array.from(text(0)).length;
        }
        if (name === 'VALUE') {
            arity(1);
            const s = text(0).trim();
            if (!s)
                return fail();
            return numeric(s);
        }
        if (name === 'LEFT' || name === 'RIGHT') {
            arity(1, 2);
            const count = args[1] ? Math.trunc(num(1)) : 1;
            if (count < 0)
                return fail();
            const chars = Array.from(text(0));
            return (name === 'LEFT' ? chars.slice(0, count) : count ? chars.slice(-count) : []).join('');
        }
        if (name === 'MID') {
            arity(3);
            const start = Math.trunc(num(1)), count = Math.trunc(num(2));
            if (start < 1 || count < 0)
                return fail();
            return Array.from(text(0)).slice(start - 1, start - 1 + count).join('');
        }
        if (name === 'SUBSTITUTE') {
            arity(3, 4);
            const input = text(0), old = text(1), replacement = text(2);
            if (!old)
                return input;
            if (!args[3])
                return input.split(old).join(replacement);
            const n = Math.trunc(num(3));
            if (n < 1)
                return fail();
            let count = 0;
            return input.split(old).reduce((a, b, i) => i ? a + (++count === n ? replacement : old) + b : b, '');
        }
        if (name === 'FIND' || name === 'SEARCH') {
            arity(2, 3);
            const needle = text(0), input = Array.from(text(1)), start = args[2] ? Math.trunc(num(2)) : 1;
            if (start < 1 || start > input.length + 1)
                return fail();
            const rest = input.slice(start - 1).join('');
            const index = name === 'FIND' ? rest.indexOf(needle) : -1;
            const at = name === 'FIND' ? (index < 0 ? -1 : Array.from(rest.slice(0, index)).length) : wildcardFind(needle, rest, true);
            return at < 0 ? fail() : at + start;
        }
        if (name === 'ROW' || name === 'COLUMNS') {
            arity(name === 'ROW' ? 0 : 1, 1);
            const ref = args[0];
            if (ref && ref.type !== 'ref' && ref.type !== 'range')
                return fail();
            const from = point(ref ? ref.type === 'ref' ? ref.address : ref.from : context.address || 'A1');
            const to = ref?.type === 'range' ? point(ref.to) : from;
            if (name === 'COLUMNS')
                return to.col - from.col + 1;
            return from.row === to.row ? from.row : { rows: to.row - from.row + 1, columns: 1, values: Array.from({ length: to.row - from.row + 1 }, (_, i) => from.row + i) };
        }
        if (name === 'SUMPRODUCT') {
            arity(1, 255);
            const values = args.map(evaluate), first = values[0];
            const rows = matrix(first) ? first.rows : 1, columns = matrix(first) ? first.columns : 1;
            if (values.some(v => (matrix(v) ? v.rows : 1) !== rows || (matrix(v) ? v.columns : 1) !== columns))
                return fail();
            return finite(flat(first).reduce<number>((total, _, i) => total + values.reduce<number>((p, v) => p * (typeof flat(v)[i] === 'number' ? flat(v)[i] as number : 0), 1), 0));
        }
        if (name === 'COUNTIF') {
            arity(2);
            if (args[0].type !== 'range' && args[0].type !== 'ref')
                return fail();
            const criteria = value(1);
            const match = typeof criteria === 'string' ? /^(<=|>=|<>|=|<|>)?(.*)$/.exec(criteria)! : null;
            const op = match?.[1] || '=', pattern = match?.[2];
            const isNumber = pattern !== undefined && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(pattern);
            return flat(evaluate(args[0])).filter(v => {
                if (isNumber) {
                    if (v === null || v === '' || typeof v === 'boolean')
                        return false;
                    try {
                        return binary(op, numeric(v), Number(pattern)) === true;
                    }
                    catch {
                        return false;
                    }
                }
                if (pattern !== undefined) {
                    const matches = (typeof v === 'string' || (v === null && pattern === '')) && wildcardFind(pattern, string(v)) >= 0;
                    return op === '=' ? matches : op === '<>' ? !matches : binary(op, v, pattern) === true;
                }
                return binary(op, v, criteria === null ? 0 : criteria) === true;
            }).length;
        }
        const date1904 = !!context.date1904;
        if (name === 'DATE') {
            arity(3);
            return dateSerial(num(0), num(1), num(2), date1904);
        }
        if (name === 'TODAY') {
            arity(0);
            const now = context.today || new Date();
            return dateSerial(now.getFullYear(), now.getMonth() + 1, now.getDate(), date1904);
        }
        if (['DAY', 'MONTH', 'YEAR'].includes(name)) {
            arity(1);
            return dateParts(num(0), date1904)[name === 'YEAR' ? 0 : name === 'MONTH' ? 1 : 2];
        }
        if (name === 'DATEDIF') {
            arity(3);
            const start = Math.floor(num(0)), end = Math.floor(num(1)), unit = text(2).toUpperCase();
            if (end < start)
                return fail('#NUM!');
            const a = dateParts(start, date1904), b = dateParts(end, date1904);
            if (unit === 'D')
                return end - start;
            if (unit === 'Y')
                return b[0] - a[0] - (b[1] < a[1] || (b[1] === a[1] && b[2] < a[2]) ? 1 : 0);
            if (unit === 'M')
                return (b[0] - a[0]) * 12 + b[1] - a[1] - (b[2] < a[2] ? 1 : 0);
            throw new UnsupportedFormula('datedif-unit');
        }
        throw new UnsupportedFormula('unsupported-function');
    };
    const result = scalar(evaluate(root));
    return result === null ? 0 : typeof result === 'number' ? finite(result) : result;
}
// Compatibility for the original numeric-only public helper.
export function evaluateFormula(formula: string, lookup: (address: string) => number): number {
    const result = evaluateCellFormula(formula, { lookup });
    if (typeof result !== 'number')
        throw new UnsupportedFormula('numeric-result');
    return result;
}
