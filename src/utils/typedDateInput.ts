export const sanitizeTypedDateInput = (value: string): string => {
    return value
        .replace(/[^\d./-]/g, '')
        .replace(/[./]/g, '-')
        .slice(0, 10);
};

export const normalizeTypedDateInput = (value: string): string | null => {
    const sanitized = sanitizeTypedDateInput(value.trim());
    if (!sanitized) return null;

    const digits = sanitized.replace(/\D/g, '');
    if (digits.length === 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) {
        return sanitized;
    }

    return null;
};
