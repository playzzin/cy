// Only non-sensitive catalog projections belong here. Membership, workers,
// assignments and financial records must always be read with current scope.
const TTL_MS = 30_000;
const entries = new Map<string, { expiresAt: number; json: string }>();
export async function readTeamCatalog<T>(uid: string, collection: string, ids: string[], bypass: boolean, load: () => Promise<T[]>): Promise<T[]> {
    const key = JSON.stringify([uid, collection, [...new Set(ids)].sort()]);
    const cached = entries.get(key);
    if (!bypass && cached && cached.expiresAt > Date.now()) return JSON.parse(cached.json);
    entries.delete(key);
    const rows = await load();
    const json = JSON.stringify(rows);
    // Bound instance memory, and avoid retaining large responses.
    if (json.length <= 128_000) {
        for (const [entryKey, entry] of entries) if (entry.expiresAt <= Date.now()) entries.delete(entryKey);
        if (entries.size >= 20) entries.delete(entries.keys().next().value!);
        entries.set(key, { expiresAt: Date.now() + TTL_MS, json });
    }
    return rows;
}
