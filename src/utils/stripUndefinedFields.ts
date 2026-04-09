export const stripUndefinedFields = <T extends Record<string, unknown>>(data: T): Record<string, unknown> => {
    return Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
    );
};
