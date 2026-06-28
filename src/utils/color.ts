export const normalizeHexColor = (value: unknown, fallback = '#64748b'): string => {
    const raw = String(value ?? '').trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
};

export const hexToRgba = (hex: string, alpha: number): string => {
    const normalized = normalizeHexColor(hex).replace('#', '');
    const n = parseInt(normalized, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const hexToRgb = (hex: string): [number, number, number] => {
    const normalized = normalizeHexColor(hex).replace('#', '');
    const n = parseInt(normalized, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toLinearRgb = (value: number): number => {
    const channel = value / 255;
    return channel <= 0.03928
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4);
};

export const getRelativeLuminance = (hex: string): number => {
    const [r, g, b] = hexToRgb(hex);
    return (0.2126 * toLinearRgb(r)) + (0.7152 * toLinearRgb(g)) + (0.0722 * toLinearRgb(b));
};

export const getContrastRatio = (foreground: string, background: string): number => {
    const foregroundLuminance = getRelativeLuminance(foreground);
    const backgroundLuminance = getRelativeLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
};

const toHexChannel = (value: number): string => (
    Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')
);

export const mixHexColors = (base: string, overlay: string, overlayRatio: number): string => {
    const [br, bg, bb] = hexToRgb(base);
    const [or, og, ob] = hexToRgb(overlay);
    const ratio = Math.max(0, Math.min(1, overlayRatio));
    const inverse = 1 - ratio;
    return `#${toHexChannel((br * inverse) + (or * ratio))}${toHexChannel((bg * inverse) + (og * ratio))}${toHexChannel((bb * inverse) + (ob * ratio))}`;
};

export const getContrastingTextColor = (
    background: string,
    lightText = '#ffffff',
    darkText = '#0f172a'
): string => (
    getContrastRatio(lightText, background) >= getContrastRatio(darkText, background)
        ? lightText
        : darkText
);

export const getReadableAccentColor = (
    color: unknown,
    background = '#ffffff',
    minContrast = 7
): string => {
    const normalized = normalizeHexColor(color);
    const normalizedBackground = normalizeHexColor(background, '#ffffff');

    if (getContrastRatio(normalized, normalizedBackground) >= minContrast) {
        return normalized;
    }

    const mixTarget = getRelativeLuminance(normalizedBackground) > 0.45 ? '#0f172a' : '#ffffff';
    for (let ratio = 0.12; ratio <= 0.88; ratio += 0.08) {
        const candidate = mixHexColors(normalized, mixTarget, ratio);
        if (getContrastRatio(candidate, normalizedBackground) >= minContrast) {
            return candidate;
        }
    }

    return getContrastRatio('#334155', normalizedBackground) >= minContrast ? '#334155' : '#ffffff';
};
