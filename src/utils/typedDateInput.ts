interface FormatTypedDateInputOptions {
    yearDigits?: 2 | 4;
}

export const sanitizeTypedDateInput = (value: string): string => {
    return value
        .replace(/[^\d./-]/g, '')
        .replace(/[./]/g, '-')
        .slice(0, 10);
};

const formatShortYearDigits = (digits: string): string => {
    const shortDigits = digits.startsWith('19') || digits.startsWith('20')
        ? digits.slice(2, 8)
        : digits.slice(0, 6);

    if (shortDigits.length <= 2) return shortDigits;
    if (shortDigits.length <= 4) return `${shortDigits.slice(0, 2)}-${shortDigits.slice(2)}`;
    return `${shortDigits.slice(0, 2)}-${shortDigits.slice(2, 4)}-${shortDigits.slice(4, 6)}`;
};

export const formatTypedDateInput = (
    value: string,
    options: FormatTypedDateInputOptions = {}
): string => {
    const yearDigits = options.yearDigits ?? 4;
    const separated = value
        .replace(/[^\d./-]/g, '')
        .replace(/[./]/g, '-')
        .slice(0, 10);

    if (yearDigits === 2) {
        const fullSeparatedMatch = separated.match(/^(\d{4})-(\d{0,2})(?:-(\d{0,2}))?/);
        if (fullSeparatedMatch) {
            const [, year, month = '', day = ''] = fullSeparatedMatch;
            return `${year.slice(2)}-${month}${day ? `-${day}` : ''}`.slice(0, 8);
        }
        if (/^\d{2}-/.test(separated)) return separated.slice(0, 8);
        return formatShortYearDigits(value.replace(/\D/g, '').slice(0, 8));
    }

    if (/^\d{4}-/.test(separated)) return separated;

    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};

const padDatePart = (value: string | number): string => String(value).padStart(2, '0');

const buildYmd = (year: number, month: number, day: number): string | null => {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
};

const currentYear = (): number => new Date().getFullYear();

const expandTwoDigitYear = (year: string | number): number => 2000 + Number(year);

export const normalizeTypedDateInput = (value: string): string | null => {
    const raw = value.trim();
    const fullKoreanMatch = raw.match(/^(\d{2}|\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
    if (fullKoreanMatch) {
        const year = fullKoreanMatch[1].length === 2
            ? expandTwoDigitYear(fullKoreanMatch[1])
            : Number(fullKoreanMatch[1]);
        return buildYmd(year, Number(fullKoreanMatch[2]), Number(fullKoreanMatch[3]));
    }

    const monthDayKoreanMatch = raw.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
    if (monthDayKoreanMatch) {
        return buildYmd(currentYear(), Number(monthDayKoreanMatch[1]), Number(monthDayKoreanMatch[2]));
    }

    const sanitized = sanitizeTypedDateInput(raw);
    if (!sanitized) return null;

    const fullDateMatch = sanitized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (fullDateMatch) {
        return buildYmd(Number(fullDateMatch[1]), Number(fullDateMatch[2]), Number(fullDateMatch[3]));
    }

    const shortYearDateMatch = sanitized.match(/^(\d{2})-(\d{1,2})-(\d{1,2})$/);
    if (shortYearDateMatch) {
        return buildYmd(
            expandTwoDigitYear(shortYearDateMatch[1]),
            Number(shortYearDateMatch[2]),
            Number(shortYearDateMatch[3])
        );
    }

    const monthDayMatch = sanitized.match(/^(\d{1,2})-(\d{1,2})$/);
    if (monthDayMatch) {
        return buildYmd(currentYear(), Number(monthDayMatch[1]), Number(monthDayMatch[2]));
    }

    const digits = sanitized.replace(/\D/g, '');
    if (digits.length === 8) {
        return buildYmd(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8)));
    }

    if (digits.length === 6) {
        return buildYmd(expandTwoDigitYear(digits.slice(0, 2)), Number(digits.slice(2, 4)), Number(digits.slice(4, 6)));
    }

    if (digits.length === 4) {
        return buildYmd(currentYear(), Number(digits.slice(0, 2)), Number(digits.slice(2, 4)));
    }

    if (digits.length === 3) {
        return buildYmd(currentYear(), Number(digits.slice(0, 1)), Number(digits.slice(1, 3)));
    }

    if (digits.length === 2) {
        return buildYmd(currentYear(), Number(digits.slice(0, 1)), Number(digits.slice(1, 2)));
    }

    return null;
};

export const toShortYearDateInputValue = (value?: string | null): string => {
    const normalized = value ? normalizeTypedDateInput(value) : null;
    if (!normalized) return '';
    return `${normalized.slice(2, 4)}-${normalized.slice(5, 7)}-${normalized.slice(8, 10)}`;
};
