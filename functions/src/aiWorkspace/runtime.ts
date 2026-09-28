import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

export type WorkspaceRuntime = { version: 1; revision: number; mode: 'off' | 'pilot' | 'on'; pilotUids: string[]; schedulerEnabled: boolean };
const stopped = (): WorkspaceRuntime => ({ version: 1, revision: 0, mode: 'off', pilotUids: [], schedulerEnabled: false });
// Missing or malformed configuration never enables an accidentally deployed feature.
export function parseWorkspaceRuntime(value: any): WorkspaceRuntime {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1
    || !['off', 'pilot', 'on'].includes(value.mode) || typeof value.schedulerEnabled !== 'boolean'
    || !Array.isArray(value.pilotUids) || value.pilotUids.length > 20
    || value.pilotUids.some((uid: unknown) => typeof uid !== 'string' || uid.length < 1 || uid.length > 128 || uid.includes('/') || uid.trim() !== uid || [...uid].some(char => char.charCodeAt(0) < 32))) return stopped();
  return { version: 1, revision: value.revision, mode: value.mode, pilotUids: [...new Set<string>(value.pilotUids)].sort(), schedulerEnabled: value.schedulerEnabled };
}
export const readWorkspaceRuntime = async (transaction?: FirebaseFirestore.Transaction): Promise<WorkspaceRuntime> => {
  const ref = admin.firestore().doc('server_settings/ai_workspace');
  return parseWorkspaceRuntime((await (transaction ? transaction.get(ref) : ref.get())).data()?.runtime);
};
export const workspaceRuntimeAllows = (value: WorkspaceRuntime, uid: string, scheduled = false): boolean =>
  (value.mode === 'on' || (value.mode === 'pilot' && value.pilotUids.includes(uid))) && (!scheduled || value.schedulerEnabled);
export class WorkspaceUnavailableError extends functions.https.HttpsError {
  constructor(message = 'AI 업무 도우미 운영이 중지되었거나 시범 운영 대상 계정이 아닙니다. 관리자에게 운영 설정을 확인해 주세요.') { super('failed-precondition', message); }
}
export async function requireWorkspaceRuntime(uid: string, scheduled = false, transaction?: FirebaseFirestore.Transaction, revision?: number): Promise<WorkspaceRuntime> {
  const value = await readWorkspaceRuntime(transaction);
  if (!workspaceRuntimeAllows(value, uid, scheduled)) throw new WorkspaceUnavailableError(scheduled
    ? '정기 보고 실행이 운영 설정에서 중지되어 있습니다. 기존 예약과 보관 결과는 유지됩니다.' : undefined);
  if (revision !== undefined && value.revision !== revision) throw new functions.https.HttpsError('permission-denied', '운영 정책이 변경되었습니다. 현재 권한으로 다시 조회해 주세요.');
  return value;
}
