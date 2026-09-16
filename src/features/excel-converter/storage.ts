import { ConversionPlan, ConversionResult, JoinSpec, WorkbookFile } from './types';
export interface SavedWork {
    id: string;
    name: string;
    updatedAt: number;
    expiresAt: number;
    sources: WorkbookFile[];
    targets: WorkbookFile[];
    primarySheet: string;
    headerRow: number;
    joins: JoinSpec[];
    plans: ConversionPlan[];
    prompt: string;
    appliedPrompts?: Record<string, string>;
    results: {
        targetId: string;
        result: ConversionResult;
        revision?: number;
    }[];
    revision: number;
    resultRevision: number;
    status: 'draft' | 'review' | 'approved';
    reviewNote: string;
}
export interface SavedRule {
    id: string;
    name: string;
    prompt: string;
    plan: ConversionPlan;
    updatedAt: number;
    signature: string;
}
export interface Library {
    rules: SavedRule[];
    dictionary: Record<string, string>;
    retentionDays: number;
    templates: WorkbookFile[];
}
export interface WorkVersion {
    id: string;
    createdAt: number;
    work: SavedWork;
}
const DB = 'cy-excel-conversion-v1';
function openDatabase(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(DB, 1); request.onupgradeneeded = () => { request.result.createObjectStore('entries'); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('브라우저 저장소를 열 수 없습니다. 저장 공간과 브라우저 설정을 확인해 주세요.')); }); }
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => { const tx = db.transaction('entries', mode); const req = action(tx.objectStore('entries')); let result: T; req.onsuccess = () => { result = req.result; }; tx.oncomplete = () => { db.close(); resolve(result); }; tx.onerror = () => { db.close(); reject(new Error('작업 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.')); }; tx.onabort = tx.onerror; });
}
const scope = (uid: string) => { if (!uid)
    throw new Error('로그인이 필요합니다.'); return `user:${uid}:`; };
export async function saveWork(uid: string, work: SavedWork): Promise<void> { await transaction('readwrite', store => store.put(work, `${scope(uid)}work:${work.id}`)); }
export async function listWorks(uid: string): Promise<SavedWork[]> {
    const prefix = `${scope(uid)}work:`;
    const range = IDBKeyRange.bound(prefix, prefix + '\uffff');
    const entries = await transaction<SavedWork[]>('readonly', store => store.getAll(range));
    const now = Date.now();
    for (const entry of entries.filter(e => e.expiresAt <= now))
        await deleteWork(uid, entry.id);
    return entries.filter(e => e.expiresAt > now).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function deleteWork(uid: string, id: string): Promise<void> { await transaction('readwrite', store => store.delete(`${scope(uid)}work:${id}`)); const prefix = `${scope(uid)}version:${id}:`; await transaction('readwrite', store => store.delete(IDBKeyRange.bound(prefix, prefix + '\uffff'))); }
export async function listVersions(uid: string, workId: string): Promise<WorkVersion[]> { const prefix = `${scope(uid)}version:${workId}:`; const entries = await transaction<WorkVersion[]>('readonly', store => store.getAll(IDBKeyRange.bound(prefix, prefix + '\uffff'))); return entries.sort((a, b) => b.createdAt - a.createdAt); }
export async function saveVersion(uid: string, work: SavedWork): Promise<void> { const entry: WorkVersion = { id: crypto.randomUUID(), createdAt: Date.now(), work }; await transaction('readwrite', store => store.put(entry, `${scope(uid)}version:${work.id}:${entry.id}`)); const entries = await listVersions(uid, work.id); for (const old of entries.slice(10))
    await transaction('readwrite', store => store.delete(`${scope(uid)}version:${work.id}:${old.id}`)); }
export async function loadLibrary(uid: string): Promise<Library> { return (await transaction<Library>('readonly', store => store.get(`${scope(uid)}library`))) || { rules: [], dictionary: {}, retentionDays: 30, templates: [] }; }
export async function saveLibrary(uid: string, library: Library): Promise<void> { await transaction('readwrite', store => store.put(library, `${scope(uid)}library`)); }
