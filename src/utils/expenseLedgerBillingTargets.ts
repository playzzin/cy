import type { Team } from '../services/teamService';
import type { AccommodationBillingDocument, AccommodationBillingLineItem } from '../types/accommodationBilling';
import type { AccommodationBillingTarget } from '../types/accommodationBillingTarget';
import type { CardBillingTargetRecord } from '../types/card';
import type { CardBillingDocument, CardBillingCostItem } from '../types/cardBilling';
import { OFFICE_ASSIGNMENT_TEAM_ID, OFFICE_ASSIGNMENT_TEAM_NAME } from './supportAssignmentTargets';
import { normalizeSettlementBillingStatus } from './supportSettlementBilling';

type Recipient = Pick<AccommodationBillingDocument, 'teamId' | 'teamName' | 'issuedToType' | 'issuedToWorkerId' | 'issuedToWorkerName'>;
type PeriodTarget = { startDate?: string; endDate?: string; recipient: Recipient; updatedAt?: { toMillis: () => number } };
const text = (value: unknown) => String(value ?? '').trim();
const identity = (recipient: Partial<Recipient>) => recipient.issuedToType === 'worker'
  ? `worker:${text(recipient.issuedToWorkerId) || text(recipient.issuedToWorkerName)}`
  : `team:${text(recipient.teamId) || text(recipient.teamName)}`;

const monthRange = (yearMonth: string): [string, string] => {
  const [year, month] = yearMonth.split('-').map(Number);
  return [`${yearMonth}-01`, `${yearMonth}-${new Date(year, month, 0).getDate()}`];
};

const lineRange = (yearMonth: string, item: { label: string; sourceStartDate?: string; sourceEndDate?: string }): [string, string] => {
  const range = /\b(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})\s*$/.exec(item.label);
  const [monthStart, monthEnd] = monthRange(yearMonth);
  return [item.sourceStartDate || range?.[1] || monthStart, item.sourceEndDate || range?.[2] || monthEnd];
};

// A saved monthly amount must never be prorated merely because a target changed.
// Remap only when every day of the saved source period has the same recipient.
const resolvePeriodRecipient = (targets: PeriodTarget[], range: [string, string], fallback: Recipient): Recipient | null => {
  const [start, end] = range;
  const candidates = targets.filter(target => (!target.startDate || target.startDate <= end) && (!target.endDate || target.endDate >= start))
    .sort((a, b) => text(b.startDate).localeCompare(text(a.startDate)) || (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
  if (!candidates.length) return fallback;
  const points = new Set([start, end]);
  candidates.forEach(target => {
    if (target.startDate && target.startDate > start && target.startDate <= end) points.add(target.startDate);
    if (target.endDate && target.endDate >= start && target.endDate < end) {
      const nextDay = new Date(`${target.endDate}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      points.add(nextDay.toISOString().slice(0, 10));
    }
  });
  const recipients = [...points].map(date => candidates.find(target => (!target.startDate || target.startDate <= date) && (!target.endDate || target.endDate >= date))?.recipient ?? fallback);
  return recipients.every(recipient => identity(recipient) === identity(recipients[0])) ? recipients[0] : null;
};

const canonicalTeam = (teams: Team[], id?: string, name?: string) => {
  const team = teams.find(row => [row.id, row.legacyId].some(key => Boolean(id) && text(key) === text(id)))
    ?? teams.find(row => Boolean(name) && text(row.name) === text(name));
  return { teamId: text(team?.id || id), teamName: text(team?.name || name) };
};

const recipientFor = (teams: Team[], type: string, id: string | undefined, name: string | undefined, fallback: Recipient): Recipient => {
  if (type === 'worker' || type === 'office_staff') return {
    ...fallback,
    ...(type === 'office_staff' ? { teamId: OFFICE_ASSIGNMENT_TEAM_ID, teamName: OFFICE_ASSIGNMENT_TEAM_NAME } : {}),
    issuedToType: 'worker', issuedToWorkerId: text(id), issuedToWorkerName: text(name)
  };
  return {
    ...(type === 'office' ? { teamId: OFFICE_ASSIGNMENT_TEAM_ID, teamName: OFFICE_ASSIGNMENT_TEAM_NAME } : canonicalTeam(teams, id, name)),
    issuedToType: 'team', issuedToWorkerId: '', issuedToWorkerName: ''
  };
};

/** Read-only projection for expense views. Never writes or modifies posted bills. */
export const resolveExpenseLedgerBillingTargets = (input: {
  accommodationDocs: AccommodationBillingDocument[];
  cardDocs: CardBillingDocument[];
  accommodationTargets: AccommodationBillingTarget[];
  cardTargets: CardBillingTargetRecord[];
  teams: Team[];
}) => {
  const reviewIds = new Set<string>();
  const accommodationTargets = new Map<string, AccommodationBillingTarget[]>();
  input.accommodationTargets.forEach(target => {
    const key = text(target.accommodationId);
    accommodationTargets.set(key, [...(accommodationTargets.get(key) ?? []), target]);
  });
  const cardTargets = new Map<string, CardBillingTargetRecord[]>();
  input.cardTargets.forEach(target => {
    const key = text(target.cardId);
    cardTargets.set(key, [...(cardTargets.get(key) ?? []), target]);
  });

  const accommodationDocs = input.accommodationDocs.flatMap(doc => {
    const fallback: Recipient = {
      ...canonicalTeam(input.teams, doc.teamId, doc.teamName),
      issuedToType: doc.issuedToType, issuedToWorkerId: doc.issuedToWorkerId, issuedToWorkerName: doc.issuedToWorkerName
    };
    const groups = new Map<string, { recipient: Recipient; items: AccommodationBillingLineItem[] }>();
    (doc.lineItems ?? []).forEach(item => {
      let recipient = fallback;
      if (item.sourceType === 'utility_ledger' && item.sourceAccommodationId) {
        const targets = (accommodationTargets.get(text(item.sourceAccommodationId)) ?? []).map(target => ({
          ...target, recipient: recipientFor(input.teams, target.targetType, target.workerId || target.teamId, target.workerName || target.teamName, fallback)
        }));
        const resolved = resolvePeriodRecipient(targets, lineRange(doc.yearMonth, item), fallback);
        if (!resolved || (identity(resolved) !== identity(fallback) && normalizeSettlementBillingStatus(doc.status) !== 'draft')) {
          reviewIds.add(`accommodation:${doc.id}`);
        } else if (normalizeSettlementBillingStatus(doc.status) === 'draft') recipient = resolved;
      }
      const key = identity(recipient);
      const group = groups.get(key) ?? { recipient, items: [] };
      group.items.push(item);
      groups.set(key, group);
    });
    if (!groups.size || (groups.size === 1 && groups.has(identity(fallback)))) return [doc];
    return [...groups.entries()].map(([key, group]) => ({
      ...doc, ...group.recipient,
      id: groups.size === 1 ? doc.id : `${doc.id}::expense:${key}`,
      lineItems: group.items
    }));
  });

  const cardDocs = input.cardDocs.flatMap(doc => {
    const fallback: Recipient = {
      ...canonicalTeam(input.teams, doc.teamId || doc.assignedTeamId, doc.teamName || doc.assignedTeamName),
      issuedToType: doc.issuedToType || 'team', issuedToWorkerId: text(doc.issuedToWorkerId), issuedToWorkerName: text(doc.issuedToWorkerName)
    };
    const targets = (cardTargets.get(text(doc.cardId)) ?? []).map(target => ({
      ...target, recipient: recipientFor(input.teams, target.targetType.toLowerCase(), target.targetId, target.targetName, fallback)
    }));
    if (!targets.length) return [doc];
    const groups = new Map<string, { recipient: Recipient; items: CardBillingCostItem[] }>();
    (doc.lineItems ?? []).forEach(item => {
      let recipient = fallback;
      if (item.sourceType === 'card_ledger') {
        const resolved = resolvePeriodRecipient(targets, lineRange(doc.yearMonth, item), fallback);
        if (!resolved || (identity(resolved) !== identity(fallback) && normalizeSettlementBillingStatus(doc.status) !== 'draft')) {
          reviewIds.add(`card:${doc.id}`);
        } else if (normalizeSettlementBillingStatus(doc.status) === 'draft') recipient = resolved;
      }
      const key = identity(recipient);
      const group = groups.get(key) ?? { recipient, items: [] };
      group.items.push(item);
      groups.set(key, group);
    });
    if (!groups.size || (groups.size === 1 && groups.has(identity(fallback)))) return [doc];
    return [...groups.entries()].map(([key, group]): CardBillingDocument => {
      const amount = group.items.reduce((sum, item) => sum + item.amount, 0);
      return {
        ...doc, ...group.recipient, issuedToType: group.recipient.issuedToType === 'worker' ? 'worker' : 'team',
        id: groups.size === 1 ? doc.id : `${doc.id}::expense:${key}`,
        lineItems: group.items, totalAmount: amount, variableCost: amount
      };
    });
  });
  return { accommodationDocs, cardDocs, reviewCount: reviewIds.size };
};
