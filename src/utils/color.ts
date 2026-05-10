export const normalizeHexColor = (value: unknown, fallback = '#64748b'): string => {
    const raw = String(value ?? '').trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
};

export const hexToRgba = (hex: string, alpha: number): string => {
    const normalized = normalizeHexColor(hex).replace('#', '');
    const n = parseInt(normalized, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
