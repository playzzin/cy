import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { receivableService } from './receivableService';
import { supportClaimService } from './supportClaimService';
import { teamExpenseLedgerService } from './teamExpenseLedgerService';
import {
  listAllAccommodationBillingDocuments,
  listAllCardBillingDocuments,
  listAllVehicleBillingDocuments,
} from './firestoreCrudCompat';
import {
  buildExpenseClaimAlerts,
  buildReceivableAlerts,
  buildSupportClaimIssueAlerts,
  buildUnconfirmedBillingAlerts,
  mergeAlertStates,
  normalizeYearMonth,
  summarizeSettlementAlerts,
} from '../features/settlement-alerts/settlementAlertRules';
import type {
  SettlementAlert,
  SettlementAlertQuery,
  SettlementAlertState,
  SettlementAlertStateStatus,
  SettlementAlertWithState,
} from '../features/settlement-alerts/settlementAlertTypes';

const STATE_COLLECTION = 'settlement_alert_states';
const LIST_LIMIT = 5000;

const validStateStatuses = new Set<SettlementAlertStateStatus>([
  'open',
  'acknowledged',
  'snoozed',
  'resolved',
]);

const toText = (value: unknown): string => String(value ?? '').trim();

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toRows = <T extends Record<string, unknown>>(response: unknown, key: string): T[] => {
  const data = (response as { data?: Record<string, unknown> })?.data;
  const rows = data?.[key];
  return Array.isArray(rows) ? rows as T[] : [];
};

const normalizeState = (id: string, data: Record<string, unknown>): SettlementAlertState => {
  const status = validStateStatuses.has(data.status as SettlementAlertStateStatus)
    ? data.status as SettlementAlertStateStatus
    : 'open';

  return {
    alertId: toText(data.alertId) || id,
    yearMonth: normalizeYearMonth(toText(data.yearMonth)),
    status,
    memo: toText(data.memo) || undefined,
    snoozedUntil: toText(data.snoozedUntil) || undefined,
    updatedBy: toText(data.updatedBy) || undefined,
    updatedByName: toText(data.updatedByName) || undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
    createdAt: data.createdAt as Timestamp | undefined,
  };
};

const getVehicleBillingAlerts = async (yearMonth: string): Promise<SettlementAlert[]> => {
  const response = await listAllVehicleBillingDocuments({ limit: LIST_LIMIT });
  const docs = toRows(response, 'vehicleBillingDocuments');

  return buildUnconfirmedBillingAlerts(docs, {
    yearMonth,
    config: {
      domain: 'vehicle',
      sourceCollection: 'vehicle_billing_documents',
      actionLabel: '차량 청구 로그',
      actionUrl: '/support/vehicles/logs',
      getLabel: (row) => toText(row.vehiclePlate) || toText(row.vehicleId) || toText(row.id),
      getAmount: (row) => toNumber(row.totalAmount),
      getTeamId: (row) => toText(row.teamId || row.assignedTeamId) || undefined,
      getTeamName: (row) => toText(row.teamName || row.assignedTeamName) || undefined,
    },
  });
};

const getCardBillingAlerts = async (yearMonth: string): Promise<SettlementAlert[]> => {
  const response = await listAllCardBillingDocuments({ limit: LIST_LIMIT });
  const docs = toRows(response, 'cardBillingDocuments');

  return buildUnconfirmedBillingAlerts(docs, {
    yearMonth,
    config: {
      domain: 'card',
      sourceCollection: 'cardBillings',
      actionLabel: '카드 청구 로그',
      actionUrl: '/support/cards/logs',
      getLabel: (row) => toText(row.cardLabel) || toText(row.cardId) || toText(row.id),
      getAmount: (row) => toNumber(row.totalAmount || row.variableCost),
      getTeamId: (row) => toText(row.teamId || row.assignedTeamId) || undefined,
      getTeamName: (row) => toText(row.teamName || row.assignedTeamName) || undefined,
    },
  });
};

const getAccommodationBillingAlerts = async (yearMonth: string): Promise<SettlementAlert[]> => {
  const response = await listAllAccommodationBillingDocuments({ limit: LIST_LIMIT });
  const docs = toRows(response, 'accommodationBillingDocuments');

  return buildUnconfirmedBillingAlerts(docs, {
    yearMonth,
    config: {
      domain: 'accommodation',
      sourceCollection: 'accommodation_billing_documents',
      actionLabel: '숙소 청구 로그',
      actionUrl: '/support/accommodation/logs',
      getLabel: (row) => toText(row.issuedToWorkerName) || toText(row.teamName) || toText(row.id),
      getAmount: (row) => {
        const lineItems = Array.isArray(row.lineItems) ? row.lineItems as Array<Record<string, unknown>> : [];
        return lineItems.reduce((sum, item) => sum + toNumber(item.amount), 0);
      },
      getTeamId: (row) => toText(row.teamId) || undefined,
      getTeamName: (row) => toText(row.teamName) || undefined,
    },
  });
};

const getSupportClaimAlerts = async (yearMonth: string): Promise<SettlementAlert[]> => {
  const result = await supportClaimService.fetchClaims({ month: yearMonth });
  return buildSupportClaimIssueAlerts(result.issues, { yearMonth });
};

const safeLoadAlerts = async (
  label: string,
  loader: () => Promise<SettlementAlert[]>
): Promise<SettlementAlert[]> => {
  try {
    return await loader();
  } catch (error) {
    console.warn(`[settlementAlertService] Failed to load ${label} alerts`, error);
    return [];
  }
};

const loadComputedAlerts = async (yearMonth: string): Promise<SettlementAlert[]> => {
  const alertGroups = await Promise.all([
    safeLoadAlerts('receivable', async () => buildReceivableAlerts(
      await receivableService.getReceivables(),
      { yearMonth }
    )),
    safeLoadAlerts('expense', async () => buildExpenseClaimAlerts(
      await teamExpenseLedgerService.getClaimsByMonth(yearMonth),
      { yearMonth }
    )),
    safeLoadAlerts('support-claim', () => getSupportClaimAlerts(yearMonth)),
    safeLoadAlerts('vehicle-billing', () => getVehicleBillingAlerts(yearMonth)),
    safeLoadAlerts('card-billing', () => getCardBillingAlerts(yearMonth)),
    safeLoadAlerts('accommodation-billing', () => getAccommodationBillingAlerts(yearMonth)),
  ]);

  return alertGroups.flat().sort((left, right) => {
    const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
    return severityRank[right.severity] - severityRank[left.severity]
      || Math.abs(toNumber(right.amount)) - Math.abs(toNumber(left.amount))
      || left.domain.localeCompare(right.domain)
      || left.title.localeCompare(right.title, 'ko-KR');
  });
};

export const settlementAlertService = {
  stateCollection: STATE_COLLECTION,

  async getAlertStates(yearMonth: string): Promise<SettlementAlertState[]> {
    const normalizedMonth = normalizeYearMonth(yearMonth);
    const q = query(
      collection(db, STATE_COLLECTION),
      where('yearMonth', '==', normalizedMonth)
    );
    const snap = await getDocs(q);
    return snap.docs.map((row) => normalizeState(row.id, row.data() as Record<string, unknown>));
  },

  async getAlerts(options: SettlementAlertQuery): Promise<{
    alerts: SettlementAlertWithState[];
    summary: ReturnType<typeof summarizeSettlementAlerts>;
  }> {
    const yearMonth = normalizeYearMonth(options.yearMonth);
    const [alerts, states] = await Promise.all([
      loadComputedAlerts(yearMonth),
      this.getAlertStates(yearMonth),
    ]);
    const merged = mergeAlertStates(alerts, states, { includeResolved: options.includeResolved });
    return {
      alerts: merged,
      summary: summarizeSettlementAlerts(merged),
    };
  },

  async updateAlertState(
    alertId: string,
    patch: {
      yearMonth: string;
      status: SettlementAlertStateStatus;
      memo?: string;
      snoozedUntil?: string;
      updatedBy?: string;
      updatedByName?: string;
    }
  ): Promise<void> {
    const normalizedMonth = normalizeYearMonth(patch.yearMonth);
    const ref = doc(db, STATE_COLLECTION, alertId);
    const existing = await getDoc(ref);
    const now = Timestamp.now();

    await setDoc(ref, {
      alertId,
      yearMonth: normalizedMonth,
      status: patch.status,
      memo: toText(patch.memo) || null,
      snoozedUntil: toText(patch.snoozedUntil) || null,
      updatedBy: toText(patch.updatedBy) || null,
      updatedByName: toText(patch.updatedByName) || null,
      createdAt: existing.exists() ? (existing.data().createdAt || now) : now,
      updatedAt: now,
    }, { merge: true });
  },
};
