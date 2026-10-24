import { normalizeActivity } from '../../src/features/activity-center/activityModel';
import type { ActivitySource } from '../../src/features/activity-center/activitySources';
import type { ActivityFilter } from '../../src/features/activity-center/activityQuery';
export const useAuth = () => ({ currentUser: user });
const user = { uid: 'preview-admin' };
export const userService = { getUser: async () => ({ role: 'admin', status: 'active' }) };
export const isDevAdminSessionEnabled = () => false;
export const activityErrorMessage = () => '내역을 불러오지 못했습니다. 다시 시도해 주세요.';
let queries = 0;
export const fetchActivityPage = async (source: ActivitySource, filter: ActivityFilter, cursor?: { id: string }) => {
  document.body.dataset.queryCount = String(++queries);
  await new Promise(resolve => setTimeout(resolve, 180));
  const offset = cursor ? Number(cursor.id) + 1 : 0;
  const names = ['테스트 관리자', '테스트 사무담당', '테스트 현장담당'];
  const rows = Array.from({ length: 63 }, (_, index) => ({
    id: String(index), actor: { uid: `person-${index % 3}`, name: names[index % 3] }, actorId: `person-${index % 3}`, actorName: names[index % 3],
    createdAt: new Date(Date.now() - index * 600000).toISOString(), timestamp: new Date(Date.now() - index * 600000).toISOString(),
    action: source.id === 'login' ? 'session_access' : source.id === 'permissions' ? 'USER_ACCESS_UPDATED' : 'updated',
    status: index % 7 === 0 ? 'failed' : 'success',
    entityName: `테스트 현장 ${index + 1}`, targetName: `테스트 대상 ${index + 1}`,
    summaryLines: source.id === 'login' ? ['저장된 로그인으로 앱에 다시 접속했습니다.'] : ['기록된 업무 변경 내용을 확인할 수 있습니다.'],
    fieldChanges: source.id === 'login' ? [] : [{ field: 'quantity', label: '수량', before: 12, after: 15 }],
    client: source.id === 'login' ? { browser: 'Chrome', os: 'Windows', path: '/dashboard' } : {},
  })).filter(row => Number(row.id) >= offset && (!filter.actorId || row.actorId === filter.actorId));
  const selected = rows.slice(0, 50);
  return { records: selected.map(row => normalizeActivity(row.id, row, source)), hasMore: rows.length > 50,
    cursor: selected.length ? { id: selected[selected.length - 1].id } : null };
};
export const geminiUsageLogService = { list: async () => ({ logs: [], nextCursor: null }) };
export const GEMINI_USAGE_CHANGED = 'preview:usage';
