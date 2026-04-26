const pad2 = (value: number): string => String(value).padStart(2, '0');

const buildDateString = (year: number, month: number, day: number): string | null => {
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const date = new Date(year, month - 1, day);
    if (
        Number.isNaN(date.getTime())
        || date.getFullYear() !== year
        || date.getMonth() !== month - 1
        || date.getDate() !== day
    ) {
        return null;
    }
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const normalizeYear = (yearToken: string): number => {
    const year = Number(yearToken);
    if (yearToken.length !== 2) return year;
    return year >= 70 ? 1900 + year : 2000 + year;
};

export const normalizeLooseDateString = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;

    if (value instanceof Date) {
        return buildDateString(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    if (typeof value === 'number' && Number.isFinite(value) && value > 20000) {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return buildDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const compactMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
        return buildDateString(Number(compactMatch[1]), Number(compactMatch[2]), Number(compactMatch[3]));
    }

    const ymdMatch = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:\s.*)?$/);
    if (ymdMatch) {
        return buildDateString(Number(ymdMatch[1]), Number(ymdMatch[2]), Number(ymdMatch[3]));
    }

    const mdyMatch = raw.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})(?:\s.*)?$/);
    if (mdyMatch) {
        return buildDateString(normalizeYear(mdyMatch[3]), Number(mdyMatch[1]), Number(mdyMatch[2]));
    }

    return null;
};

export const normalizeLooseDateText = (value: unknown): string => {
    return normalizeLooseDateString(value) ?? String(value ?? '').trim();
};
