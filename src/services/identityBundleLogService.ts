import { collection, doc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { isDevAdminSessionEnabled, createDevAdminUser } from '../utils/devAdminSession';

export const IDENTITY_LOG_CATEGORY = 'IDENTITY_BUNDLE';
export const IDENTITY_LOG_PATH = '/database/identity-logs';
const DEV_STORAGE_KEY = 'cy_dev_identity_logs_v1';
const MAX_LOGS = 500;

export const IDENTITY_LOG_ACTIONS = {
  files_added: '파일 추가',
  files_removed: '파일 제거',
  analysis: 'AI 빠른 묶기',
  detail_analysis: 'AI 인적정보 분석',
  group_moved: '묶음 합치기',
  group_split: '묶음 분리',
  name_changed: '대상자 이름 수정',
  crop_updated: '문서 영역 보정',
  identity_confirmed: '동일인 확인',
  identity_unconfirmed: '동일인 확인 해제',
  preview_created: '묶음 미리보기',
  download_image: '사진 다운로드 요청',
  download_zip: 'ZIP 다운로드 요청',
  worker_created: 'DB 신규 등록',
  worker_updated: 'DB 업데이트',
} as const;

export type IdentityLogAction = keyof typeof IDENTITY_LOG_ACTIONS;
export type IdentityLogStatus = 'success' | 'partial' | 'failure';
export interface IdentityLogInput {
  action: IdentityLogAction;
  status: IdentityLogStatus;
  fileNames?: string[];
  personNames?: string[];
  fileCount?: number;
  personCount?: number;
  workerId?: string;
  correctionMode?: string;
  reason?: 'invalid_files' | 'too_many_files' | 'processing_failed' | 'missing_results';
}

export interface IdentityBundleLog extends IdentityLogInput {
  id: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  fileNames: string[];
  personNames: string[];
  fileCount: number;
  personCount: number;
}

// The audit stores operation metadata, never OCR contents, identity images, or download URLs.
const safeText = (value: unknown): string => String(value ?? '')
  .replace(/\d{6}[\s-]?[1-8]\d{6}/g, '[식별번호 숨김]')
  .replace(/(?:data|blob|https?):\S+/gi, '[주소 숨김]')
  .trim().slice(0, 180);
const names = (values: unknown): string[] => Array.isArray(values)
  ? Array.from(new Set(values.slice(0, 60).map(safeText).filter(Boolean))) : [];
const count = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;

export const buildIdentityLogDetails = (input: IdentityLogInput): IdentityLogInput => {
  const fileNames = names(input.fileNames);
  const personNames = names(input.personNames);
  return {
    action: input.action,
    status: input.status,
    fileNames,
    personNames,
    fileCount: count(input.fileCount, fileNames.length),
    personCount: count(input.personCount, personNames.length),
    ...(input.workerId ? { workerId: safeText(input.workerId) } : {}),
    ...(['AUTO', 'MANUAL', 'ORIGINAL'].includes(input.correctionMode || '') ? { correctionMode: input.correctionMode } : {}),
    ...(['invalid_files', 'too_many_files', 'processing_failed', 'missing_results'].includes(input.reason || '') ? { reason: input.reason } : {}),
  };
};

const normalizeLog = (id: string, data: Record<string, any>): IdentityBundleLog | null => {
  if (data.category !== IDENTITY_LOG_CATEGORY) return null;
  let details: IdentityLogInput;
  try { details = typeof data.details === 'string' ? JSON.parse(data.details) : data.details; }
  catch { return null; }
  if (!details || !Object.prototype.hasOwnProperty.call(IDENTITY_LOG_ACTIONS, details.action)
    || !['success', 'partial', 'failure'].includes(details.status)) return null;
  const normalized = buildIdentityLogDetails(details);
  return {
    ...normalized,
    id,
    createdAt: typeof data.timestamp === 'string' ? data.timestamp : '',
    actorId: safeText(data.actorId),
    actorName: safeText(data.actorName),
    actorEmail: safeText(data.actorEmail),
    fileNames: normalized.fileNames || [],
    personNames: normalized.personNames || [],
    fileCount: normalized.fileCount || 0,
    personCount: normalized.personCount || 0,
  };
};

const readDevRows = (): Record<string, any>[] => {
  const rows = JSON.parse(window.localStorage.getItem(DEV_STORAGE_KEY) || '[]');
  return Array.isArray(rows) ? rows : [];
};

export const identityBundleLogService = {
  async log(input: IdentityLogInput): Promise<boolean> {
    try {
      const isDev = isDevAdminSessionEnabled();
      const actor = isDev ? createDevAdminUser() : auth.currentUser;
      if (!actor) return false;
      const details = buildIdentityLogDetails(input);
      const ref = doc(collection(db, 'audit_logs'));
      const payload = {
        category: IDENTITY_LOG_CATEGORY,
        action: `IDENTITY_${input.action.toUpperCase()}_${input.status.toUpperCase()}`,
        actorId: actor.uid,
        actorName: actor.displayName || actor.email || '사용자',
        actorEmail: actor.email || '',
        targetId: details.workerId || '/database/identity-bundle',
        targetName: IDENTITY_LOG_ACTIONS[input.action],
        timestamp: new Date().toISOString(),
        details: JSON.stringify(details),
      };
      if (isDev) {
        window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify([
          { id: ref.id, ...payload }, ...readDevRows(),
        ].slice(0, MAX_LOGS)));
      } else {
        // Append directly: creating a log must not require permission to read the audit collection.
        await setDoc(ref, payload);
      }
      return true;
    } catch {
      console.warn('[IdentityBundleLog] 작업 로그를 저장하지 못했습니다.');
      return false;
    }
  },

  async getLogs(): Promise<IdentityBundleLog[]> {
    const rows = isDevAdminSessionEnabled()
      ? readDevRows()
      : (await getDocs(query(collection(db, 'audit_logs'),
        where('category', '==', IDENTITY_LOG_CATEGORY), orderBy('timestamp', 'desc'), limit(MAX_LOGS))))
        .docs.map((row) => ({ ...row.data(), id: row.id }));
    return rows.map((row) => normalizeLog(String(row.id), row))
      .filter((row): row is IdentityBundleLog => row !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_LOGS);
  },
};
