import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DailyReportZod } from '../types/zod/dailyReportSchema';
import type { SystemMessageEvent, SystemMessageEventConfig, SystemMessageEventGroup, SystemMessageSettings } from '../types/systemMessage';
import type { DailyReportLog } from '../types/dailyReportLog';
import type { DatabaseLog } from '../types/databaseLog';
import type { MaterialLog } from '../types/materialLog';
import type { VehicleBillingLog } from '../types/vehicleBillingLog';
import type { CardBillingLog } from '../types/cardBillingLog';
import type { AccommodationBillingLog } from '../types/accommodationBillingLog';
import type { LoginLog } from '../types/loginLog';
import type { ErpMessagePriority } from '../types/erpMessage';
import { messageService } from './messageService';
import {
  createDefaultRecipientRule,
  normalizeRecipientRule,
  resolveMessageRecipients,
  type MessageRecipientContext,
  type MessageRecipientData
} from './messageRecipientResolver';
import { manpowerService } from './manpowerService';
import { teamService } from './teamService';
import { userService } from './userService';

const COLLECTION_NAME = 'erp_message_settings';
const DAILY_REPORT_SETTINGS_ID = 'daily_report';

export const SYSTEM_MESSAGE_EVENT_LABELS: Record<SystemMessageEvent, string> = {
  'dailyReport.created': '출력일보 저장',
  'dailyReport.updated': '출력일보 수정',
  'dailyReport.deleted': '출력일보 삭제',
  'databaseLog.created': '통합 DB 저장 로그',
  'databaseLog.updated': '통합 DB 수정 로그',
  'databaseLog.deleted': '통합 DB 삭제 로그',
  'materialLog.created': '자재관리 저장 로그',
  'materialLog.updated': '자재관리 수정 로그',
  'materialLog.deleted': '자재관리 삭제 로그',
  'vehicleBillingLog.created': '차량 청구 저장 로그',
  'vehicleBillingLog.updated': '차량 청구 수정 로그',
  'vehicleBillingLog.deleted': '차량 청구 삭제 로그',
  'cardBillingLog.created': '카드 청구 저장 로그',
  'cardBillingLog.updated': '카드 청구 수정 로그',
  'cardBillingLog.deleted': '카드 청구 삭제 로그',
  'accommodationBillingLog.created': '숙소 청구 저장 로그',
  'accommodationBillingLog.updated': '숙소 청구 수정 로그',
  'accommodationBillingLog.deleted': '숙소 청구 삭제 로그',
  'loginLog.login_success': '로그인 성공',
  'loginLog.login_failed': '로그인 실패',
  'loginLog.logout': '로그아웃',
  'loginLog.signup_success': '회원가입',
};

export const SYSTEM_MESSAGE_EVENT_GROUPS: SystemMessageEventGroup[] = [
  {
    id: 'dailyReport',
    label: '출력일보 로그',
    description: '출력일보 저장, 수정, 삭제 이력',
    events: ['dailyReport.created', 'dailyReport.updated', 'dailyReport.deleted'],
  },
  {
    id: 'databaseLog',
    label: '통합 DB 로그',
    description: '작업자, 팀, 현장, 회사, 계좌 변경 이력',
    events: ['databaseLog.created', 'databaseLog.updated', 'databaseLog.deleted'],
  },
  {
    id: 'materialLog',
    label: '자재관리 로그',
    description: '자재 마스터, 입고, 출고 변경 이력',
    events: ['materialLog.created', 'materialLog.updated', 'materialLog.deleted'],
  },
  {
    id: 'vehicleBillingLog',
    label: '차량 청구 로그',
    description: '차량 청구서 생성, 수정, 확정, 취소 이력',
    events: ['vehicleBillingLog.created', 'vehicleBillingLog.updated', 'vehicleBillingLog.deleted'],
  },
  {
    id: 'cardBillingLog',
    label: '카드 청구 로그',
    description: '카드 청구서 생성, 수정, 확정, 취소 이력',
    events: ['cardBillingLog.created', 'cardBillingLog.updated', 'cardBillingLog.deleted'],
  },
  {
    id: 'accommodationBillingLog',
    label: '숙소 청구 로그',
    description: '숙소 청구서 생성, 수정, 확정, 취소 이력',
    events: ['accommodationBillingLog.created', 'accommodationBillingLog.updated', 'accommodationBillingLog.deleted'],
  },
  {
    id: 'loginLog',
    label: '로그인 접근 로그',
    description: '로그인, 로그아웃, 회원가입 접속 이력',
    events: ['loginLog.login_success', 'loginLog.login_failed', 'loginLog.logout', 'loginLog.signup_success'],
  },
];

const ALL_SYSTEM_MESSAGE_EVENTS = SYSTEM_MESSAGE_EVENT_GROUPS.flatMap((group) => group.events);

const DEFAULT_EVENT_SETTINGS: Record<SystemMessageEvent, SystemMessageEventConfig> = {
  'dailyReport.created': { enabled: true },
  'dailyReport.updated': { enabled: true },
  'dailyReport.deleted': { enabled: true },
  'databaseLog.created': { enabled: false },
  'databaseLog.updated': { enabled: false },
  'databaseLog.deleted': { enabled: false },
  'materialLog.created': { enabled: false },
  'materialLog.updated': { enabled: false },
  'materialLog.deleted': { enabled: false },
  'vehicleBillingLog.created': { enabled: false },
  'vehicleBillingLog.updated': { enabled: false },
  'vehicleBillingLog.deleted': { enabled: false },
  'cardBillingLog.created': { enabled: false },
  'cardBillingLog.updated': { enabled: false },
  'cardBillingLog.deleted': { enabled: false },
  'accommodationBillingLog.created': { enabled: false },
  'accommodationBillingLog.updated': { enabled: false },
  'accommodationBillingLog.deleted': { enabled: false },
  'loginLog.login_success': { enabled: false },
  'loginLog.login_failed': { enabled: false },
  'loginLog.logout': { enabled: false },
  'loginLog.signup_success': { enabled: false },
};

export const DEFAULT_DAILY_REPORT_SYSTEM_SETTINGS: SystemMessageSettings = {
  id: DAILY_REPORT_SETTINGS_ID,
  enabled: false,
  recipientScope: 'users',
  recipientIds: [],
  recipientNames: [],
  events: DEFAULT_EVENT_SETTINGS,
};

const normalizeSettings = (data?: Partial<SystemMessageSettings> | null): SystemMessageSettings => {
  const incomingEvents = (data?.events || {}) as Partial<Record<SystemMessageEvent, SystemMessageEventConfig>>;
  const normalizedEvents = ALL_SYSTEM_MESSAGE_EVENTS.reduce<Record<SystemMessageEvent, SystemMessageEventConfig>>((events, event) => {
    events[event] = {
      enabled: Boolean(incomingEvents[event]?.enabled ?? DEFAULT_EVENT_SETTINGS[event].enabled),
      recipientRule: normalizeRecipientRule(incomingEvents[event]?.recipientRule, 'global'),
    };
    return events;
  }, {} as Record<SystemMessageEvent, SystemMessageEventConfig>);

  return {
    ...DEFAULT_DAILY_REPORT_SYSTEM_SETTINGS,
    ...(data || {}),
    id: DAILY_REPORT_SETTINGS_ID,
    recipientScope: data?.recipientScope === 'all' ? 'all' : 'users',
    recipientIds: Array.isArray(data?.recipientIds) ? data.recipientIds.map(String).filter(Boolean) : [],
    recipientNames: Array.isArray(data?.recipientNames) ? data.recipientNames.map(String).filter(Boolean) : [],
    events: normalizedEvents,
  };
};

const formatManDay = (value: unknown): string =>
  Number(value || 0).toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('ko-KR') : '-';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (Array.isArray(value)) return value.length > 0 ? value.map(formatValue).join(', ') : '-';
  if (typeof (value as { toDate?: unknown })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleString('ko-KR');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const formatCreatedAt = (value?: { toDate?: () => Date } | null): string =>
  value?.toDate ? value.toDate().toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR');

const buildFieldChangeLines = (
  changes: Array<{ label: string; before: unknown; after: unknown }>,
  maxCount = 12
): string[] => {
  if (changes.length === 0) return ['- 상세 변경 항목 없음'];

  const lines = changes.slice(0, maxCount).map((change) => (
    `- ${change.label}: ${formatValue(change.before)} → ${formatValue(change.after)}`
  ));
  if (changes.length > maxCount) lines.push(`- 외 ${changes.length - maxCount}개 항목 추가 변경`);
  return lines;
};

const buildLogMessageBody = (params: {
  headline: string;
  eventLabel: string;
  occurredAt: string;
  actorName: string;
  actorEmail?: string | null;
  identityLines: string[];
  summaryLines: string[];
  detailLines: string[];
}): string => {
  const actor = `${params.actorName}${params.actorEmail ? ` (${params.actorEmail})` : ''}`;
  return [
    params.headline,
    `구분: ${params.eventLabel}`,
    `발생일시: ${params.occurredAt}`,
    `처리자: ${actor}`,
    '',
    ...params.identityLines,
    '',
    '변동 요약',
    ...params.summaryLines.map((line) => `- ${line}`),
    '',
    '상세 변동내용',
    ...params.detailLines,
  ].join('\n');
};

const buildDailyReportBody = (event: SystemMessageEvent, report: DailyReportZod, log?: DailyReportLog): string => {
  const actionLabel = SYSTEM_MESSAGE_EVENT_LABELS[event];
  const siteName = report.siteName || report.siteId || '현장 미지정';
  const teamName = report.teamName || report.responsibleTeamName || report.teamId || '팀 미지정';
  const workerCount = Array.isArray(report.workers) ? report.workers.length : 0;
  const summaryLines = log?.summaryLines?.length ? log.summaryLines : [`출력일보 ${actionLabel} 처리가 완료되었습니다.`];
  const fieldChanges = log?.fieldChanges || [];
  const workerChanges = log?.workerChanges;
  const changedBy = log?.actor?.name || 'ERP 시스템';
  const changedAt = formatCreatedAt(log?.createdAt);

  const detailLines: string[] = [];
  fieldChanges.slice(0, 12).forEach((change) => {
    detailLines.push(`- ${change.label}: ${formatValue(change.before)} → ${formatValue(change.after)}`);
  });

  workerChanges?.added.slice(0, 8).forEach((worker) => {
    const after = worker.after as any;
    detailLines.push(`- 작업자 추가: ${worker.name} / ${after?.manDay ?? 0}공수 / ${after?.workContent || '작업내용 없음'}`);
  });
  workerChanges?.removed.slice(0, 8).forEach((worker) => {
    const before = worker.before as any;
    detailLines.push(`- 작업자 삭제: ${worker.name} / ${before?.manDay ?? 0}공수 / ${before?.workContent || '작업내용 없음'}`);
  });
  workerChanges?.updated.slice(0, 8).forEach((worker) => {
    const fields = worker.changes?.map((change) => `${change.label}(${formatValue(change.before)}→${formatValue(change.after)})`).join(', ');
    detailLines.push(`- 작업자 수정: ${worker.name}${fields ? ` - ${fields}` : ''}`);
  });

  if (detailLines.length === 0) {
    detailLines.push('- 주요 변경 항목 없음');
  }

  return [
    '출력일보가 변동되었습니다.',
    `구분: ${actionLabel}`,
    `변경일시: ${changedAt}`,
    `처리자: ${changedBy}${log?.actor?.email ? ` (${log.actor.email})` : ''}`,
    `일보 ID: ${report.id || log?.reportId || '-'}`,
    '',
    `현장: ${siteName}`,
    `팀: ${teamName}`,
    `날짜: ${report.date || '-'}`,
    `총공수: ${formatManDay(report.totalManDay)}공수`,
    `작업자: ${workerCount.toLocaleString('ko-KR')}명`,
    '',
    '변동 요약',
    ...summaryLines.map((line) => `- ${line}`),
    '',
    '상세 변동내용',
    ...detailLines,
  ].join('\n');
};

const buildDatabaseLogBody = (log: DatabaseLog): string =>
  buildLogMessageBody({
    headline: '통합 DB 로그가 변동되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`databaseLog.${log.action}` as SystemMessageEvent],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.name || 'ERP 시스템',
    actorEmail: log.actor.email,
    identityLines: [
      `대상: ${log.entityLabel} / ${log.entityName}`,
      `대상 ID: ${log.entityId || '-'}`,
      log.entitySubtitle ? `식별 정보: ${log.entitySubtitle}` : '',
      log.siteName ? `현장: ${log.siteName}` : '',
      log.teamName ? `팀: ${log.teamName}` : '',
      log.companyName ? `회사: ${log.companyName}` : '',
    ].filter(Boolean),
    summaryLines: log.summaryLines?.length ? log.summaryLines : [`${log.entityLabel} ${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: buildFieldChangeLines(log.fieldChanges || []),
  });

const buildMaterialLogBody = (log: MaterialLog): string =>
  buildLogMessageBody({
    headline: '자재관리 로그가 변동되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`materialLog.${log.action}` as SystemMessageEvent],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.name || 'ERP 시스템',
    actorEmail: log.actor.email,
    identityLines: [
      `대상: ${log.entityLabel} / ${log.materialName}`,
      `대상 ID: ${log.entityId || '-'}`,
      log.category ? `분류: ${log.category}` : '',
      log.spec ? `규격: ${log.spec}` : '',
      log.siteName ? `현장: ${log.siteName}` : '',
      log.transactionDate ? `거래일자: ${log.transactionDate}` : '',
      log.quantity !== undefined ? `수량: ${formatValue(log.quantity)}${log.unit ? ` ${log.unit}` : ''}` : '',
    ].filter(Boolean),
    summaryLines: log.summaryLines?.length ? log.summaryLines : [`${log.entityLabel} ${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: buildFieldChangeLines(log.fieldChanges || []),
  });

const buildVehicleBillingLogBody = (log: VehicleBillingLog): string => {
  const lineItemChanges = log.lineItemChanges || { added: [], removed: [], updated: [] };
  const lineItemDetailLines = [
    ...lineItemChanges.added.slice(0, 8).map((item) => `- 청구 항목 추가: ${item.label}`),
    ...lineItemChanges.removed.slice(0, 8).map((item) => `- 청구 항목 삭제: ${item.label}`),
    ...lineItemChanges.updated.slice(0, 8).map((item) => {
      const fields = item.changes?.map((change) => `${change.label}(${formatValue(change.before)}→${formatValue(change.after)})`).join(', ');
      return `- 청구 항목 수정: ${item.label}${fields ? ` - ${fields}` : ''}`;
    }),
  ];

  return buildLogMessageBody({
    headline: '차량 청구 로그가 변동되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`vehicleBillingLog.${log.action}` as SystemMessageEvent],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.name || 'ERP 시스템',
    actorEmail: log.actor.email,
    identityLines: [
      `청구서 ID: ${log.billingId || '-'}`,
      `차량: ${log.vehiclePlate || '차량 미지정'}`,
      `청구월: ${log.yearMonth || '-'}`,
      `청구대상: ${log.teamName || log.issuedToWorkerName || '-'}`,
      `상태: ${log.status || '-'}`,
    ],
    summaryLines: log.summaryLines?.length ? log.summaryLines : [`차량 청구서 ${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: [
      ...buildFieldChangeLines(log.fieldChanges || []),
      ...lineItemDetailLines,
    ],
  });
};

const buildCardBillingLogBody = (log: CardBillingLog): string => {
  const lineItemChanges = log.lineItemChanges || { added: [], removed: [], updated: [] };
  const lineItemDetailLines = [
    ...lineItemChanges.added.slice(0, 8).map((item) => `- 청구 항목 추가: ${item.label}`),
    ...lineItemChanges.removed.slice(0, 8).map((item) => `- 청구 항목 삭제: ${item.label}`),
    ...lineItemChanges.updated.slice(0, 8).map((item) => {
      const fields = item.changes?.map((change) => `${change.label}(${formatValue(change.before)}→${formatValue(change.after)})`).join(', ');
      return `- 청구 항목 수정: ${item.label}${fields ? ` - ${fields}` : ''}`;
    }),
  ];

  return buildLogMessageBody({
    headline: '카드 청구 로그가 변동되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`cardBillingLog.${log.action}` as SystemMessageEvent],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.name || 'ERP 시스템',
    actorEmail: log.actor.email,
    identityLines: [
      `청구서 ID: ${log.billingId || '-'}`,
      `카드: ${log.cardLabel || '카드 미지정'}`,
      `청구월: ${log.yearMonth || '-'}`,
      `청구대상: ${log.teamName || log.issuedToWorkerName || '-'}`,
      `상태: ${log.status || '-'}`,
    ],
    summaryLines: log.summaryLines?.length ? log.summaryLines : [`카드 청구서 ${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: [
      ...buildFieldChangeLines(log.fieldChanges || []),
      ...lineItemDetailLines,
    ],
  });
};

const buildAccommodationBillingLogBody = (log: AccommodationBillingLog): string => {
  const lineItemChanges = log.lineItemChanges || { added: [], removed: [], updated: [] };
  const lineItemDetailLines = [
    ...lineItemChanges.added.slice(0, 8).map((item) => `- 청구 항목 추가: ${item.label}`),
    ...lineItemChanges.removed.slice(0, 8).map((item) => `- 청구 항목 삭제: ${item.label}`),
    ...lineItemChanges.updated.slice(0, 8).map((item) => {
      const fields = item.changes?.map((change) => `${change.label}(${formatValue(change.before)}→${formatValue(change.after)})`).join(', ');
      return `- 청구 항목 수정: ${item.label}${fields ? ` - ${fields}` : ''}`;
    }),
  ];

  return buildLogMessageBody({
    headline: '숙소 청구 로그가 변동되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`accommodationBillingLog.${log.action}` as SystemMessageEvent],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.name || 'ERP 시스템',
    actorEmail: log.actor.email,
    identityLines: [
      `청구서 ID: ${log.billingId || '-'}`,
      `청구월: ${log.yearMonth || '-'}`,
      `팀: ${log.teamName || '-'}`,
      `청구대상: ${log.issuedToWorkerName || log.teamName || '-'}`,
      `상태: ${log.status || '-'}`,
      `총 청구액: ${formatValue(log.totalAmount)}원`,
    ],
    summaryLines: log.summaryLines?.length ? log.summaryLines : [`숙소 청구서 ${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: [
      ...buildFieldChangeLines(log.fieldChanges || []),
      ...lineItemDetailLines,
    ],
  });
};

const buildLoginLogBody = (log: LoginLog): string =>
  buildLogMessageBody({
    headline: '로그인 접근 로그가 생성되었습니다.',
    eventLabel: SYSTEM_MESSAGE_EVENT_LABELS[`loginLog.${log.action}` as SystemMessageEvent],
    occurredAt: formatCreatedAt(log.createdAt),
    actorName: log.actor.displayName || log.actor.email || '알 수 없는 사용자',
    actorEmail: log.actor.email,
    identityLines: [
      `상태: ${log.actionLabel} / ${log.status}`,
      `계정: ${log.actor.displayName || log.actor.email || log.email || '-'}`,
      `접속 방식: ${log.provider} / ${log.method}`,
      `접속 환경: ${log.client.browser}, ${log.client.os}, ${log.client.viewport}`,
      `접속 경로: ${log.client.path || '-'}`,
      log.errorMessage ? `실패 사유: ${log.errorCode ? `${log.errorCode} - ` : ''}${log.errorMessage}` : '',
    ].filter(Boolean),
    summaryLines: log.summaryLines?.length ? log.summaryLines : [`${log.actionLabel} 로그가 생성되었습니다.`],
    detailLines: [
      `- 브라우저: ${log.client.browser}`,
      `- 운영체제: ${log.client.os}`,
      `- 화면: ${log.client.screen || '-'}`,
      `- 언어/시간대: ${log.client.language || '-'} / ${log.client.timezone || '-'}`,
    ],
  });

let recipientDataCache: { data: MessageRecipientData; timestamp: number } | null = null;
const RECIPIENT_DATA_TTL = 1000 * 60 * 3;

const getRecipientData = async (): Promise<MessageRecipientData> => {
  const now = Date.now();
  if (recipientDataCache && now - recipientDataCache.timestamp < RECIPIENT_DATA_TTL) {
    return recipientDataCache.data;
  }

  const [users, workers, teams] = await Promise.all([
    userService.getAllUsers(),
    manpowerService.getWorkers(true),
    teamService.getTeams(),
  ]);
  const data = { users, workers, teams };
  recipientDataCache = { data, timestamp: now };
  return data;
};

const getSettings = async (): Promise<SystemMessageSettings> => {
  const snap = await getDoc(doc(db, COLLECTION_NAME, DAILY_REPORT_SETTINGS_ID));
  return normalizeSettings(snap.exists() ? snap.data() as Partial<SystemMessageSettings> : null);
};

const saveSettings = async (settings: SystemMessageSettings): Promise<void> => {
  const normalized = normalizeSettings(settings);
  await setDoc(doc(db, COLLECTION_NAME, DAILY_REPORT_SETTINGS_ID), {
    ...normalized,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

const notifyConfiguredEvent = async (
  event: SystemMessageEvent,
  payload: {
    title: string;
    body: string;
    priority?: ErpMessagePriority;
  },
  context?: MessageRecipientContext
): Promise<void> => {
  const settings = await getSettings();
  if (!settings.enabled || !settings.events[event]?.enabled) return;
  const eventRule = normalizeRecipientRule(
    settings.events[event]?.recipientRule || createDefaultRecipientRule('global'),
    'global'
  );
  const resolvedRecipients = eventRule.mode === 'global'
    ? {
      recipientScope: settings.recipientScope,
      recipientIds: settings.recipientScope === 'users' ? settings.recipientIds : [],
      recipientNames: settings.recipientScope === 'users' ? settings.recipientNames : ['전체 사용자'],
    }
    : resolveMessageRecipients(eventRule, await getRecipientData(), context);

  if (resolvedRecipients.recipientScope === 'users' && resolvedRecipients.recipientIds.length === 0) return;

  settings.recipientScope = resolvedRecipients.recipientScope;
  settings.recipientIds = resolvedRecipients.recipientScope === 'users' ? resolvedRecipients.recipientIds : [];
  settings.recipientNames = resolvedRecipients.recipientNames;

  await messageService.createMessage({
    type: 'system',
    title: payload.title,
    body: payload.body,
    category: '시스템',
    priority: payload.priority || 'normal',
    senderId: 'system',
    senderName: 'ERP 시스템',
    recipientScope: settings.recipientScope,
    recipientIds: settings.recipientScope === 'users' ? settings.recipientIds : [],
    recipientNames: settings.recipientScope === 'users' ? settings.recipientNames : ['전체 사용자'],
  });
};

export const systemMessageService = {
  getDailyReportSettings: getSettings,
  saveDailyReportSettings: saveSettings,
  getLogAutomationSettings: getSettings,
  saveLogAutomationSettings: saveSettings,

  notifyDailyReportEvent: async (event: SystemMessageEvent, report: DailyReportZod, log?: DailyReportLog): Promise<void> => {
    try {
      const reportWithTeam = report as DailyReportZod & { responsibleTeamId?: string | null };
      await notifyConfiguredEvent(event, {
        title: '출력일보가 변동되었습니다',
        body: buildDailyReportBody(event, report, log),
        priority: event === 'dailyReport.deleted' ? 'high' : 'normal',
      }, {
        teamId: log?.teamId || reportWithTeam.teamId || reportWithTeam.responsibleTeamId,
        teamName: log?.teamName || reportWithTeam.teamName || reportWithTeam.responsibleTeamName,
      });
    } catch (error) {
      console.warn('[systemMessageService] daily report notification failed:', error);
    }
  },

  notifyDatabaseLogEvent: async (log: DatabaseLog): Promise<void> => {
    try {
      const event = `databaseLog.${log.action}` as SystemMessageEvent;
      await notifyConfiguredEvent(event, {
        title: `[통합 DB] ${log.entityLabel} ${log.actionLabel}: ${log.entityName}`,
        body: buildDatabaseLogBody(log),
        priority: log.action === 'deleted' ? 'high' : 'normal',
      }, {
        teamId: log.teamId,
        teamName: log.teamName,
      });
    } catch (error) {
      console.warn('[systemMessageService] database log notification failed:', error);
    }
  },

  notifyMaterialLogEvent: async (log: MaterialLog): Promise<void> => {
    try {
      const event = `materialLog.${log.action}` as SystemMessageEvent;
      await notifyConfiguredEvent(event, {
        title: `[자재관리] ${log.entityLabel} ${log.actionLabel}: ${log.materialName}`,
        body: buildMaterialLogBody(log),
        priority: log.action === 'deleted' ? 'high' : 'normal',
      });
    } catch (error) {
      console.warn('[systemMessageService] material log notification failed:', error);
    }
  },

  notifyVehicleBillingLogEvent: async (log: VehicleBillingLog): Promise<void> => {
    try {
      const event = `vehicleBillingLog.${log.action}` as SystemMessageEvent;
      await notifyConfiguredEvent(event, {
        title: `[차량 청구] ${log.actionLabel}: ${log.vehiclePlate || '차량 미지정'} / ${log.yearMonth || '-'}`,
        body: buildVehicleBillingLogBody(log),
        priority: log.action === 'deleted' ? 'high' : 'normal',
      }, {
        teamId: log.teamId,
        teamName: log.teamName,
      });
    } catch (error) {
      console.warn('[systemMessageService] vehicle billing log notification failed:', error);
    }
  },

  notifyCardBillingLogEvent: async (log: CardBillingLog): Promise<void> => {
    try {
      const event = `cardBillingLog.${log.action}` as SystemMessageEvent;
      await notifyConfiguredEvent(event, {
        title: `[카드 청구] ${log.actionLabel}: ${log.cardLabel || '카드 미지정'} / ${log.yearMonth || '-'}`,
        body: buildCardBillingLogBody(log),
        priority: log.action === 'deleted' ? 'high' : 'normal',
      }, {
        teamId: log.teamId,
        teamName: log.teamName,
      });
    } catch (error) {
      console.warn('[systemMessageService] card billing log notification failed:', error);
    }
  },

  notifyAccommodationBillingLogEvent: async (log: AccommodationBillingLog): Promise<void> => {
    try {
      const event = `accommodationBillingLog.${log.action}` as SystemMessageEvent;
      await notifyConfiguredEvent(event, {
        title: `[숙소 청구] ${log.actionLabel}: ${log.issuedToWorkerName || log.teamName || '청구대상 미지정'} / ${log.yearMonth || '-'}`,
        body: buildAccommodationBillingLogBody(log),
        priority: log.action === 'deleted' ? 'high' : 'normal',
      }, {
        teamId: log.teamId,
        teamName: log.teamName,
      });
    } catch (error) {
      console.warn('[systemMessageService] accommodation billing log notification failed:', error);
    }
  },

  notifyLoginLogEvent: async (log: LoginLog): Promise<void> => {
    try {
      const event = `loginLog.${log.action}` as SystemMessageEvent;
      await notifyConfiguredEvent(event, {
        title: `[로그인] ${log.actionLabel}: ${log.actor.displayName || log.actor.email || log.email || '알 수 없는 사용자'}`,
        body: buildLoginLogBody(log),
        priority: log.action === 'login_failed' ? 'high' : 'normal',
      });
    } catch (error) {
      console.warn('[systemMessageService] login log notification failed:', error);
    }
  },
};
