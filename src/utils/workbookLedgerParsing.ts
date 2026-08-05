const normalizeWorkbookNumericText = (value: string): { text: string; negative: boolean } => {
    let text = value
        .trim()
        .replace(/[−–—]/g, '-');
    let negative = false;

    const parenthesized = text.match(/^\((.*)\)$/);
    if (parenthesized) {
        negative = true;
        text = parenthesized[1];
    }

    text = text
        .replace(/[₩￦원\s]/g, '')
        .replace(/,/g, '');

    if (text.endsWith('-')) {
        negative = true;
        text = text.slice(0, -1);
    }

    if (text.startsWith('-')) {
        negative = true;
        text = text.slice(1);
    } else if (text.startsWith('+')) {
        text = text.slice(1);
    }

    return { text, negative };
};

export const parseWorkbookNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;

    const { text, negative } = normalizeWorkbookNumericText(value);
    if (!text || !/^(?:\d+\.?\d*|\.\d+)$/.test(text)) return null;

    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return null;

    return negative ? -Math.abs(parsed) : parsed;
};

export const normalizeWorkbookNumber = (value: unknown, fallback = 0): number => {
    const parsed = parseWorkbookNumber(value);
    return parsed === null ? fallback : parsed;
};
