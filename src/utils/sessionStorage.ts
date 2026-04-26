export const loadSessionState = <T>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') {
        return fallback;
    }

    try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) {
            return fallback;
        }

        const parsed = JSON.parse(raw) as T;
        if (
            parsed
            && typeof parsed === 'object'
            && !Array.isArray(parsed)
            && fallback
            && typeof fallback === 'object'
            && !Array.isArray(fallback)
        ) {
            return {
                ...(fallback as Record<string, unknown>),
                ...(parsed as Record<string, unknown>)
            } as T;
        }

        return parsed;
    } catch (error) {
        console.warn(`[sessionStorage] failed to read "${key}"`, error);
        return fallback;
    }
};

export const saveSessionState = (key: string, value: unknown): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`[sessionStorage] failed to write "${key}"`, error);
    }
};
