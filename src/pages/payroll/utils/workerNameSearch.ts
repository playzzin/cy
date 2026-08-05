type WorkerNamedRow = {
    workerName?: string;
};

export const normalizeWorkerNameSearch = (value: unknown): string => (
    String(value ?? '')
        .normalize('NFC')
        .replace(/\s+/g, '')
        .toLocaleLowerCase('ko-KR')
);

export const filterRowsByWorkerName = <T extends WorkerNamedRow>(
    rows: T[],
    query: string
): T[] => {
    const normalizedQuery = normalizeWorkerNameSearch(query);
    if (!normalizedQuery) return rows;

    return rows.filter((row) => (
        normalizeWorkerNameSearch(row.workerName).includes(normalizedQuery)
    ));
};
