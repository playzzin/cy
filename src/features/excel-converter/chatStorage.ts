import { z } from 'zod';
import { ChatMessage, ResultVersion } from './review';
import { ConversationMessage } from './conversation';
import { ConversionPlan, ENGINE_VERSION, planSchema, WorkbookFile } from './types';
import { PreparedConversion, extractionSchema, extractWithLayout, targetLayoutSchema, workbookAtlas } from './structure';
import { readSourceDocument } from './businessDocuments';
import { readWorkbook } from './workbook';

export interface ChatSession {
  id: string; ownerId: string; name: string; updatedAt: number; expiresAt: number;
  files: [WorkbookFile | undefined, WorkbookFile | undefined]; sheets: [string, string];
  messages: ChatMessage[]; activeHistory: ConversationMessage[]; versions: ResultVersion[];
  plan?: ConversionPlan; prepared?: PreparedConversion; previewId: string; baseId: string; draft: string; accepted: string[];
}
export type SessionSummary = Pick<ChatSession, 'id' | 'name' | 'updatedAt' | 'expiresAt'>;
const DB = 'cy-excel-chat-v1';
const key = (ownerId: string, id: string) => `${encodeURIComponent(ownerId)}:${id}`;
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('이 브라우저에서는 작업 보관을 사용할 수 없습니다. 결과를 다운로드해 주세요.')); return; }
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('sessions'); request.result.createObjectStore('summaries'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('작업 보관함을 열지 못했습니다. 브라우저 저장 권한을 확인해 주세요.'));
    request.onblocked = () => reject(new Error('다른 탭의 작업 보관함을 닫은 뒤 다시 시도해 주세요.'));
  });
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  if (!session.ownerId) throw new Error('작업을 보관할 계정이 없습니다.');
  const db = await openDatabase();
  // A session owns the input bytes once; result versions keep their own outputs.
  const saved = { ...session, schema: 1, engine: ENGINE_VERSION,
    files: session.files.map(file => file && ({ id: file.id, name: file.name, bytes: file.bytes })),
    versions: session.versions.map(version => ({ ...version, result: { ...version.result, outputs: version.result.outputs.map(({ sheets, ...output }) => output) } })),
    prepared: session.prepared && { sourceLayout: session.prepared.sourceLayout, targetLayout: session.prepared.targetLayout, structureSignature: session.prepared.structureSignature },
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sessions', 'summaries'], 'readwrite');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('저장 공간이 부족하거나 보관에 실패했습니다. 현재 결과를 다운로드해 주세요.')); };
    try {
      tx.objectStore('sessions').put(saved, key(session.ownerId, session.id));
      tx.objectStore('summaries').put({ id: session.id, name: session.name, updatedAt: session.updatedAt, expiresAt: session.expiresAt }, key(session.ownerId, session.id));
    } catch { tx.abort(); db.close(); reject(new Error('작업을 보관하지 못했습니다. 현재 결과를 다운로드해 주세요.')); }
  });
}

async function readEntry(store: 'sessions' | 'summaries', ownerId: string, id?: string): Promise<unknown> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly'), entries = tx.objectStore(store), prefix = `${encodeURIComponent(ownerId)}:`;
    const request = id ? entries.get(key(ownerId, id)) : entries.getAll(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(new Error('보관한 작업을 읽지 못했습니다.')); };
  });
}
const summarySchema = z.object({ id: z.string(), name: z.string().max(120), updatedAt: z.number(), expiresAt: z.number() });
export async function listChatSessions(ownerId: string): Promise<SessionSummary[]> {
  const entries = z.array(summarySchema).parse(await readEntry('summaries', ownerId));
  for (const entry of entries.filter(entry => entry.expiresAt <= Date.now())) await removeChatSession(ownerId, entry.id);
  return entries.filter(entry => entry.expiresAt > Date.now()).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function removeChatSession(ownerId: string, id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sessions', 'summaries'], 'readwrite');
    tx.objectStore('sessions').delete(key(ownerId, id)); tx.objectStore('summaries').delete(key(ownerId, id));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('보관한 작업을 지우지 못했습니다.')); };
  });
}

const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const issue = z.object({ level: z.enum(['error','warning','info']), code: z.string(), message: z.string(), location: z.string().optional() });
const bytes = z.custom<ArrayBuffer>(value => Object.prototype.toString.call(value) === '[object ArrayBuffer]');
const fileSchema = z.object({ id: z.string(), name: z.string(), bytes });
const messageSchema = z.object({ id: z.string(), role: z.enum(['user','assistant']), text: z.string(), versionId: z.string().optional() });
const trace = z.object({ sheet: z.string(), address: z.string().regex(/^[A-Z]{1,3}\d+$/), label: z.string(), value: scalar, origins: z.array(z.string()), rule: z.string(), kind: z.enum(['text','number','date','boolean','blank']), recordKey: z.string().optional(), mappingKey: z.string().optional() });
const count = z.number().int().nonnegative();
const verification = z.object({ records: count, cells: count, identityChecked: z.boolean(), daysChecked: count, preservationChecked: z.boolean(), unverifiedFormulas: z.boolean(), missingInputs: count, repairs: count });
const output = z.object({ name: z.string(), bytes, traces: z.array(trace), issues: z.array(issue), inputCount: count, excludedCount: count, outputCount: count, group: z.string(), formulaCalculation: z.object({calculated:count,unresolved:count}).optional() });
const versionSchema = z.object({ id:z.string(), number:count, parentId:z.string().optional(), createdAt:z.number(), plan:planSchema, history:z.array(messageSchema), request:z.string(), verification, reused:z.boolean(), result:z.object({outputs:z.array(output).max(100),issues:z.array(issue),excluded:z.array(z.object({origin:z.string(),reason:z.string()})),inputCount:count,outputCount:count,elapsedMs:z.number()}) });
const sessionSchema = summarySchema.extend({ schema:z.literal(1), engine:z.literal(ENGINE_VERSION), ownerId:z.string(), files:z.tuple([fileSchema.nullish(),fileSchema.nullish()]), sheets:z.tuple([z.string(),z.string()]), messages:z.array(messageSchema), activeHistory:z.array(messageSchema), versions:z.array(versionSchema), plan:planSchema.optional(), prepared:z.object({sourceLayout:extractionSchema.nullable(),targetLayout:targetLayoutSchema.nullable(),structureSignature:z.string()}).optional(), previewId:z.string(),baseId:z.string(),draft:z.string().max(2000),accepted:z.array(z.string()) });

export async function restoreChatSession(raw: unknown, ownerId: string): Promise<ChatSession> {
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success || parsed.data.ownerId !== ownerId) throw new Error('보관한 작업 형식 또는 계정이 맞지 않습니다. 원본 파일로 새 작업을 시작해 주세요.');
  const saved = parsed.data;
  if (saved.expiresAt <= Date.now()) throw new Error('작업 보관 기간이 지났습니다. 원본 파일로 새 작업을 시작해 주세요.');
  const files = await Promise.all(saved.files.map(file => file ? readWorkbook(file.bytes, file.name, file.id) : undefined)) as ChatSession['files'];
  if (files.some((file, index) => file && !file.sheets.some(sheet => sheet.name === saved.sheets[index]))) throw new Error('보관한 작업의 시트 정보가 맞지 않습니다.');
  const versions: ResultVersion[] = [];
  for (const version of saved.versions) {
    if (!files[1] || version.plan.targetId !== files[1].id || version.plan.sheetName !== saved.sheets[1] || (version.parentId && !versions.some(v => v.id === version.parentId))) throw new Error('보관한 작업의 결과 연결이 올바르지 않습니다.');
    const outputs = [];
    for (const out of version.result.outputs) outputs.push({ ...out, sheets: (await readWorkbook(out.bytes, out.name)).sheets });
    versions.push({ ...version, result: { ...version.result, outputs } });
  }
  if ([saved.baseId,saved.previewId].some(id => id && !versions.some(v => v.id === id))) throw new Error('보관한 작업의 선택 결과를 찾지 못했습니다.');
  const prepared = saved.prepared && files[0] && files[1] && saved.plan ? {
    ...saved.prepared, plan:saved.plan, reused:true,
    document:saved.prepared.sourceLayout ? extractWithLayout(files[0],saved.sheets[0],saved.prepared.sourceLayout) : readSourceDocument(files[0],saved.sheets[0]),
    sourceAtlas:workbookAtlas(files[0],saved.sheets[0]),targetAtlas:workbookAtlas(files[1],saved.sheets[1]),
  } : undefined;
  return { ...saved, files, versions, prepared };
}
export async function loadChatSession(ownerId: string, id: string) { return restoreChatSession(await readEntry('sessions', ownerId, id), ownerId); }
