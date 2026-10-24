import type { ActivitySource } from './activitySources';

type Row = Record<string, any>;
export interface ActivityChange { label: string; before: string; after: string }
export interface ActivityRecord {
  id: string;
  time: number;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  outcome: 'failed' | 'success' | 'info';
  summary: string[];
  changes: ActivityChange[];
  facts: Array<{ label: string; value: string }>;
}

const actions: Record<string, string> = {
  created: '등록', updated: '수정', deleted: '삭제', CREATE: '등록', UPDATE: '수정', DELETE: '삭제',
  login_success: '로그인', login_failed: '로그인 실패', logout: '로그아웃', signup_success: '회원가입', session_access: '앱 재접속',
  USER_ACCESS_UPDATED: '사용자 권한 변경', MENU_ACCESS_UPDATED: '메뉴 권한 변경',
  SYNC_USER_ACCESS_CLAIMS: '계정 권한 동기화', SYNC_ALL_USER_ACCESS_CLAIMS: '전체 계정 권한 동기화',
  LINK_ACCOUNT_CONNECTION: '계정 연결', UPDATE_USER_ACCESS: '계정 접근 변경', UNLINK_ACCOUNT_CONNECTION: '계정 연결 해제',
  SUBMIT_ACCOUNT_LINK_REQUEST: '계정 승인 요청', REVOKE_USER_ACCESS_APPROVAL: '계정 승인 취소',
  APPROVE_ACCOUNT_LINK_REQUEST: '계정 승인', REJECT_ACCOUNT_LINK_REQUEST: '계정 승인 거절',
  APPROVE_TEAM_ACCOUNT_LINK: '팀 계정 승인', APPROVE_TEAM_ACCOUNT_LINK_FAILED: '팀 계정 승인 실패',
  MESSAGE_AUTOMATION_SENT: '메시지 발송', MESSAGE_AUTOMATION_FAILED: '메시지 발송 실패', MESSAGE_AUTOMATION_SKIPPED: '메시지 발송 제외',
};
const privateField = /password|secret|token|idnumber|resident|ocr|base64/i;
export const activityText = (value: unknown): string => {
  if (value == null) return '—';
  const text = typeof value === 'object' ? JSON.stringify(value, (key, item) => privateField.test(key) ? '[숨김]' : item) : String(value);
  return text.replace(/\d{6}[\s-]?[1-8]\d{6}/g, '[식별번호 숨김]')
    .replace(/(?:https?:\/\/|data:|blob:)\S+/gi, '[주소 숨김]').slice(0, 1200);
};
const object = (value: unknown): Row => {
  if (typeof value === 'string') { try { return object(JSON.parse(value)); } catch { return {}; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
};
const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
const first = (...values: unknown[]) => values.find(value => value !== undefined && value !== null && value !== '') ?? '';
export const activityMillis = (value: any): number => {
  const result = typeof value?.toMillis === 'function' ? value.toMillis()
    : value && typeof value.seconds === 'number' ? value.seconds * 1000 + (value.nanoseconds || 0) / 1e6
      : typeof value === 'number' ? value : Date.parse(value || '');
  return Number.isFinite(result) ? result : 0;
};
export const koreanDay = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date);
export const initialActivityDates = () => ({
  from: koreanDay(new Date(Date.now() - 6 * 86400000)), to: koreanDay(),
});
export function activityRange(from: string, to: string) {
  const validDay = (day: string) => {
    const parsed = new Date(`${day}T00:00:00Z`);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
  };
  if (!validDay(from) || !validDay(to)) throw new Error('조회할 시작일과 종료일을 선택해 주세요.');
  const start = Date.parse(`${from}T00:00:00+09:00`), end = Date.parse(`${to}T00:00:00+09:00`) + 86400000;
  if (start >= end || end - start > 366 * 86400000) throw new Error('조회 기간은 시작일부터 최대 366일까지 선택해 주세요.');
  return { start, end };
}

export function normalizeActivity(id: string, row: Row, source: ActivitySource): ActivityRecord {
  const actor = object(row.actor), details = object(row.details), client = object(row.client);
  const rawAction = String(row.action || '');
  const fileAction = /^(EXCEL|PDF)_(UPLOAD|DOWNLOAD)_(SUCCESS|FAILURE|CANCELLED|REQUESTED)$/.exec(rawAction);
  const fileLabel = fileAction ? `${fileAction[1] === 'EXCEL' ? '엑셀' : 'PDF'} ${fileAction[2] === 'UPLOAD' ? '업로드' : '다운로드'}${fileAction[3] === 'FAILURE' ? ' 실패' : fileAction[3] === 'CANCELLED' ? ' 취소' : fileAction[3] === 'REQUESTED' ? ' 요청' : ''}` : '';
  const result = String(first(details.result, details.status, source.id === 'login' ? row.status : '', rawAction)).toLowerCase();
  const changes: ActivityChange[] = list(row.fieldChanges).map(change => ({
    label: activityText(change.label || change.field),
    before: privateField.test(change.field || '') ? '[숨김]' : activityText(change.before),
    after: privateField.test(change.field || '') ? '[숨김]' : activityText(change.after),
  }));
  for (const change of list(details.changes)) {
    changes.push({ label: activityText(first(change.menuText, change.label, '메뉴 권한')),
      before: activityText(change.beforeRoles), after: activityText(change.afterRoles) });
  }
  if (source.id === 'permissions' && details.before && details.after) {
    for (const [field, label] of [['systemRole', '시스템 역할'], ['position', '기본 직책'], ['additionalPositions', '추가 직책']]) {
      changes.push({ label, before: activityText(details.before[field]), after: activityText(details.after[field]) });
    }
  }
  for (const group of [row.workerChanges, row.lineItemChanges]) {
    for (const kind of ['added', 'removed', 'updated']) {
      for (const item of list(group?.[kind])) {
        const name = activityText(first(item.name, item.label, item.key));
        if (kind === 'updated') for (const change of list(item.changes)) {
          changes.push({ label: `${name} · ${activityText(change.label || change.field)}`,
            before: privateField.test(change.field || '') ? '[숨김]' : activityText(change.before),
            after: privateField.test(change.field || '') ? '[숨김]' : activityText(change.after) });
        }
        else changes.push({ label: name, before: kind === 'removed' ? '포함' : '없음', after: kind === 'added' ? '추가' : '삭제' });
      }
    }
  }
  const facts: ActivityRecord['facts'] = [];
  const add = (label: string, value: unknown) => { if (value !== undefined && value !== null && value !== '') facts.push({ label, value: activityText(value) }); };
  add('브라우저', client.browser); add('운영체제', client.os); add('접속 경로', client.path);
  add('소속 팀', row.teamName); add('현장', row.siteName); add('업무 일자', first(row.reportDate, row.transactionDate, row.date, row.yearMonth));
  add('대상 ID', first(row.targetId, row.entityId, row.reportId, row.entryId, row.billingId));
  add('연결 대상 종류', row.entityType); add('연결 대상 ID', row.entityId); add('직책', row.position);
  add('파일 종류', details.fileKind); add('파일', details.fileNames); add('파일 수', details.fileCount);
  add('처리 건수', details.recordCount); add('대상자', details.personNames);
  add('메시지', details.messageTitle); add('수신 대상', details.recipientDescription); add('수신 인원', details.recipientCount);
  add('사유', first(details.reason, details.errorMessage, row.errorMessage));
  const summary = list(row.summaryLines).map(activityText);
  if (!summary.length && row.summaryText) summary.push(activityText(row.summaryText));
  if (!summary.length && details.eventLabel) summary.push(activityText(details.eventLabel));
  return {
    id, time: activityMillis(row[source.timeField] ?? row.createdAtIso),
    actorId: String(first(actor.uid, row.actorId)),
    actorName: activityText(first(actor.name, actor.displayName, row.actorName, actor.email, row.actorEmail, row.actorId, '기록된 사용자 없음')),
    action: activityText(first(row.actionLabel, actions[rawAction], fileLabel, source.id === 'identity' ? row.targetName : '', rawAction, '활동')),
    target: activityText(first(row.entityName, row.materialName, row.vehiclePlate, row.cardLabel, row.cardName, row.accommodationName,
      row.partnerName, row.siteName, row.targetName, source.id === 'accommodation' ? row.teamName : '', client.path, row.targetId, row.billingId, '—')),
    outcome: /fail|error|실패/.test(result) ? 'failed' : /success|sent|성공/.test(result) ? 'success' : 'info',
    summary, changes, facts,
  };
}
