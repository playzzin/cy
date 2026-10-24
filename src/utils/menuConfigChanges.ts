import type { SiteDataType } from '../types/menu';

// Firestore/schema normalization can change object key order without changing data.
export const menuConfigsEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => menuConfigsEqual(value, b[i]));
    }
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left).filter(key => left[key] !== undefined);
    return keys.length === Object.keys(right).filter(key => right[key] !== undefined).length
        && keys.every(key => menuConfigsEqual(left[key], right[key]));
};
const equal = menuConfigsEqual;

/** Merge only edited fields; concurrent edits to the same menu require a reload. */
export const mergeMenuConfigChanges = (latest: SiteDataType, base: SiteDataType, next: SiteDataType): SiteDataType => {
    const merged = JSON.parse(JSON.stringify(latest)) as SiteDataType;
    const conflict = () => { throw new Error('다른 창에서 같은 메뉴가 변경되었습니다. 최신 메뉴 불러오기를 눌러 확인한 뒤 다시 수정해주세요.'); };
    for (const key of new Set([...Object.keys(base), ...Object.keys(next)])) {
        if (equal(base[key], next[key])) continue;
        if (!base[key] || !next[key]) {
            if (!equal(latest[key], base[key]) && !equal(latest[key], next[key])) conflict();
            if (next[key]) merged[key] = next[key];
            else delete merged[key];
            continue;
        }
        if (!latest[key]) conflict();
        const before = base[key] as unknown as Record<string, unknown>;
        const after = next[key] as unknown as Record<string, unknown>;
        const current = latest[key] as unknown as Record<string, unknown>;
        const target = merged[key] as unknown as Record<string, unknown>;
        for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (equal(before[field], after[field])) continue;
            if (!equal(current[field], before[field]) && !equal(current[field], after[field])) conflict();
            if (after[field] === undefined) delete target[field];
            else target[field] = after[field];
        }
    }
    return JSON.parse(JSON.stringify(merged));
};

export interface MenuEditHistory { past: SiteDataType[]; future: SiteDataType[] }

/** Undo must not revert unrelated changes received from another editor. */
export const rebaseMenuHistory = (history: MenuEditHistory, base: SiteDataType, latest: SiteDataType): MenuEditHistory => {
    try {
        const rebase = (snapshot: SiteDataType) => mergeMenuConfigChanges(latest, base, snapshot);
        return { past: history.past.map(rebase), future: history.future.map(rebase) };
    } catch {
        return { past: [], future: [] };
    }
};
