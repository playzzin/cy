export const normalizeWorkerPhone = (value: unknown): string => {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (digits.startsWith('82') && digits.length >= 11) {
        digits = `0${digits.slice(2)}`;
    }
    return digits;
};

export const buildWorkerPhoneLookupValues = (value: unknown): string[] => {
    const raw = String(value ?? '').trim();
    const normalized = normalizeWorkerPhone(raw);
    const values = new Set<string>();
    if (raw) values.add(raw);
    if (normalized) values.add(normalized);

    if (normalized.length === 11) {
        const first = normalized.slice(0, 3);
        const middle = normalized.slice(3, 7);
        const last = normalized.slice(7);
        values.add(`${first}-${middle}-${last}`);
        values.add(`${first} ${middle} ${last}`);
        values.add(`+82 ${first.slice(1)}-${middle}-${last}`);
        values.add(`+82-${first.slice(1)}-${middle}-${last}`);
        values.add(`82${first.slice(1)}${middle}${last}`);
    } else if (normalized.length === 10) {
        const first = normalized.slice(0, 3);
        const middle = normalized.slice(3, 6);
        const last = normalized.slice(6);
        values.add(`${first}-${middle}-${last}`);
        values.add(`${first} ${middle} ${last}`);
        values.add(`+82 ${first.slice(1)}-${middle}-${last}`);
        values.add(`+82-${first.slice(1)}-${middle}-${last}`);
        values.add(`82${first.slice(1)}${middle}${last}`);
    }

    return Array.from(values);
};
