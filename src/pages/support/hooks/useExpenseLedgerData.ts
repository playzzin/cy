import { useCallback, useEffect, useMemo, useState } from 'react';
import { accommodationBillingService } from '../../../services/accommodationBillingService';
import { cardBillingService } from '../../../services/cardBillingService';
import { cardService } from '../../../services/cardService';
import { companyService } from '../../../services/companyService';
import { siteService, type Site } from '../../../services/siteService';
import { teamExpenseLedgerService } from '../../../services/teamExpenseLedgerService';
import { teamService, type Team } from '../../../services/teamService';
import { vehicleBillingService } from '../../../services/vehicleBillingService';
import { toast } from '../../../utils/swal';
import type { AccommodationBillingDocument } from '../../../types/accommodationBilling';
import type { Card } from '../../../types/card';
import type { CardBillingDocument } from '../../../types/cardBilling';
import type { TeamExpenseClaim, TeamExpenseClaimCategory } from '../../../types/teamExpenseLedger';
import type { VehicleBillingDocument } from '../../../types/vehicleBilling';

export type LedgerSummary = {
  teamId: string;
  teamName: string;
  color: string;
  accommodation: number;
  privateRoom: number;
  electricity: number;
  gas: number;
  water: number;
  internet: number;
  accommodationOther: number;
  vehicleRent: number;
  vehicleFine: number;
  vehicleRepair: number;
  vehicleOther: number;
  card: number;
  otherClaim: number;
  receivable: number;
  payable: number;
};

export type BillingScope = 'all' | 'posted';

export type LedgerClaimGroup = {
  id: string;
  counterpartyTeamName: string;
  direction: 'receivable' | 'payable' | 'other';
  rows: TeamExpenseClaim[];
  total: number;
};

export type SelectedClaimRows = {
  receivable: TeamExpenseClaim[];
  payable: TeamExpenseClaim[];
  other: TeamExpenseClaim[];
};

export type BillingStatusCounts = {
  accommodationDraft: number;
  accommodationConfirmed: number;
  vehicleDraft: number;
  vehiclePosted: number;
  cardDraft: number;
  cardPosted: number;
  claimDraft: number;
  claimCharged: number;
  claimSettled: number;
};

export type VehicleCostBreakdown = {
  rent: number;
  fine: number;
  repair: number;
  other: number;
  total: number;
};

export type ExpensePaymentOption = {
  value: string;
  label: string;
  kind: 'cash' | 'card';
  assigneeName?: string;
  teamIds: string[];
};

const ALL_CATEGORY_OPTIONS: Array<{ value: TeamExpenseClaimCategory; label: string }> = [
  { value: 'meal', label: '식대' },
  { value: 'parking', label: '주차비' },
  { value: 'fuel', label: '유류비' },
  { value: 'toll', label: '통행료' },
  { value: 'material', label: '자재비' },
  { value: 'tool', label: '공구비' },
  { value: 'deposit', label: '보증금' },
  { value: 'marking', label: '마이킹' },
  { value: 'fieldGoods', label: '현장물품' },
  { value: 'equipment', label: '장비비' },
  { value: 'etc', label: '기타' }
];

const HIDDEN_CATEGORY_VALUES: TeamExpenseClaimCategory[] = ['fuel', 'material', 'tool'];
const OTHER_CLAIM_CATEGORY_VALUES: TeamExpenseClaimCategory[] = ['deposit', 'marking', 'fieldGoods', 'equipment', 'etc'];
const OTHER_CLAIM_ONLY_CATEGORY_VALUES: TeamExpenseClaimCategory[] = ['deposit', 'marking', 'equipment'];

export const CATEGORY_OPTIONS: Array<{ value: TeamExpenseClaimCategory; label: string }> = ALL_CATEGORY_OPTIONS.filter(
  (option) => !HIDDEN_CATEGORY_VALUES.includes(option.value) && !OTHER_CLAIM_ONLY_CATEGORY_VALUES.includes(option.value)
);

export const OTHER_CLAIM_CATEGORY_OPTIONS: Array<{ value: TeamExpenseClaimCategory; label: string }> = ALL_CATEGORY_OPTIONS.filter(
  (option) => OTHER_CLAIM_CATEGORY_VALUES.includes(option.value)
);

export const buildDefaultYearMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const buildDefaultDate = (yearMonth: string) => `${yearMonth}-01`;

export const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR').format(Math.round(Number.isFinite(value) ? value : 0));

export const toFiniteNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeKey = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toLowerCase();

const getTeamStableId = (team: Team | null | undefined) =>
  String(team?.id ?? team?.legacyId ?? team?.name ?? '');

const getResolvedTeamId = (team: Team | null | undefined, fallbackId?: unknown, fallbackName?: unknown) =>
  String(team?.id ?? team?.legacyId ?? fallbackId ?? fallbackName ?? '');

const getTeamIdCandidates = (team: Team | null | undefined) =>
  [team?.id, team?.legacyId, team?.name].map((value) => String(value ?? '').trim()).filter(Boolean);

const buildCardLabel = (card: Card) => {
  const name = String(card.name ?? '').trim() || '카드';
  const last4 = String(card.last4 ?? '').trim();
  return last4 ? `${name} (${last4})` : name;
};

export const normalizeColor = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  return '#64748b';
};

const isCheongyeonCompanyName = (value: unknown) => {
  const name = String(value ?? '').trim();
  if (!name) return false;
  const lower = name.toLowerCase();
  return name.includes('청연') || lower.includes('cheongyeon');
};

export const hexToRgba = (hex: string, opacity: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(100, 116, 139, ${opacity})`;
  const n = parseInt(normalized, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
};

const makeEmptySummary = (team: Team): LedgerSummary => ({
  teamId: String(team.id ?? team.legacyId ?? team.name ?? ''),
  teamName: String(team.name ?? '팀 미지정'),
  color: normalizeColor((team as any).color),
  accommodation: 0,
  privateRoom: 0,
  electricity: 0,
  gas: 0,
  water: 0,
  internet: 0,
  accommodationOther: 0,
  vehicleRent: 0,
  vehicleFine: 0,
  vehicleRepair: 0,
  vehicleOther: 0,
  card: 0,
  otherClaim: 0,
  receivable: 0,
  payable: 0
});

export const getSummaryTotal = (row: LedgerSummary) =>
  row.accommodation +
  row.privateRoom +
  row.electricity +
  row.gas +
  row.water +
  row.internet +
  row.accommodationOther +
  row.vehicleRent +
  row.vehicleFine +
  row.vehicleRepair +
  row.vehicleOther +
  row.card +
  row.otherClaim +
  row.payable -
  row.receivable;

export const getCategoryLabel = (category: TeamExpenseClaimCategory) =>
  ALL_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? '기타';

export const getStatusLabel = (status: TeamExpenseClaim['status']) => {
  if (status === 'charged') return '청구완료';
  if (status === 'settled') return '정산완료';
  return '작성중';
};

export const getBillingStatusLabel = (status?: unknown) => {
  const raw = String(status ?? '').toLowerCase();
  if (raw === 'confirmed') return '확정';
  if (raw === 'paid') return '정산완료';
  if (raw === 'overdue') return '연체';
  if (raw === 'draft') return '작성중';
  return raw || '-';
};

const isPostedAccommodation = (doc: AccommodationBillingDocument) => doc.status === 'confirmed';
const isPostedVehicle = (doc: VehicleBillingDocument) => ['CONFIRMED', 'PAID', 'OVERDUE'].includes(String(doc.status ?? ''));
const isPostedCard = (doc: CardBillingDocument) => ['CONFIRMED', 'PAID', 'OVERDUE'].includes(String(doc.status ?? ''));
const isPostedClaim = (claim: TeamExpenseClaim) => claim.status === 'charged' || claim.status === 'settled';

export const summarizeVehicleBillingCosts = (doc: VehicleBillingDocument): VehicleCostBreakdown => {
  let rent = 0;
  let fine = 0;
  let repair = 0;
  let other = 0;
  let hasExplicitRentLine = false;
  let variableLineTotal = 0;

  (doc.lineItems ?? []).forEach((item) => {
    const amount = toFiniteNumber(item.amount);
    const label = normalizeKey(`${item.type ?? ''} ${item.category ?? ''} ${item.label ?? ''}`);
    const isRent =
      item.type === 'FIXED' ||
      label.includes('rent') ||
      label.includes('lease') ||
      label.includes('렌트') ||
      label.includes('월사용료') ||
      label.includes('사용료') ||
      label.includes('monthlyfee');

    if (isRent) {
      rent += amount;
      hasExplicitRentLine = true;
      return;
    }

    variableLineTotal += amount;
    if (label.includes('fine') || label.includes('penalty') || label.includes('과태료')) fine += amount;
    else if (label.includes('repair') || label.includes('maintenance') || label.includes('수리') || label.includes('정비')) repair += amount;
    else other += amount;
  });

  if (!hasExplicitRentLine) {
    rent += toFiniteNumber(doc.fixedCost);
  }

  if (variableLineTotal === 0 && toFiniteNumber(doc.variableCost) > 0) {
    other += toFiniteNumber(doc.variableCost);
  }

  return {
    rent,
    fine,
    repair,
    other,
    total: rent + fine + repair + other
  };
};

export const useExpenseLedgerData = (yearMonth: string, selectedTeamId: string, billingScope: BillingScope = 'all') => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [accommodationDocs, setAccommodationDocs] = useState<AccommodationBillingDocument[]>([]);
  const [vehicleDocs, setVehicleDocs] = useState<VehicleBillingDocument[]>([]);
  const [cardDocs, setCardDocs] = useState<CardBillingDocument[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [claims, setClaims] = useState<TeamExpenseClaim[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamList, siteList, accommodationList, vehicleList, cardBillingList, claimList, companyList, cardMasterList] = await Promise.all([
        teamService.getTeams(),
        siteService.getSites(),
        accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth }),
        vehicleBillingService.getBillingsByMonth(yearMonth),
        cardBillingService.getBillingsByMonth(yearMonth),
        teamExpenseLedgerService.getClaimsByMonth(yearMonth),
        companyService.getCompanies(),
        cardService.getCards()
      ]);

      const cheongyeonCompanies = companyList.filter((company) => isCheongyeonCompanyName((company as any).name));
      const cheongyeonIdSet = new Set(cheongyeonCompanies.map((company) => String((company as any).id ?? '')).filter(Boolean));
      const cheongyeonNameSet = new Set(
        cheongyeonCompanies
          .map((company) => String((company as any).name ?? '').trim())
          .filter(Boolean)
      );

      const filteredTeams = teamList.filter((team) => {
        const companyId = String((team as any).companyId ?? '').trim();
        const companyName = String((team as any).companyName ?? '').trim();
        if (companyId && cheongyeonIdSet.has(companyId)) return true;
        if (companyName && cheongyeonNameSet.has(companyName)) return true;
        if (companyName && isCheongyeonCompanyName(companyName)) return true;
        return false;
      });

      setTeams(filteredTeams);
      setSites(siteList);
      setAccommodationDocs(accommodationList);
      setVehicleDocs(vehicleList);
      setCardDocs(cardBillingList);
      setCards(cardMasterList);
      setClaims(claimList);
    } catch (error) {
      console.error('[useExpenseLedgerData] load failed', error);
      toast.error('경비내역 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teamOptions = useMemo(
    () => [...teams].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko-KR')),
    [teams]
  );

  const siteOptions = useMemo(
    () => [...sites].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko-KR')),
    [sites]
  );

  const teamLookup = useMemo(() => {
    const byKey = new Map<string, Team>();
    teams.forEach((team) => {
      [team.id, (team as any).legacyId, team.name].forEach((value) => {
        const key = normalizeKey(value);
        if (key) byKey.set(key, team);
      });
    });
    return byKey;
  }, [teams]);

  const resolveTeam = useCallback(
    (id?: unknown, name?: unknown) => {
      const byId = teamLookup.get(normalizeKey(id));
      if (byId) return byId;
      const byName = teamLookup.get(normalizeKey(name));
      if (byName) return byName;
      return null;
    },
    [teamLookup]
  );

  const scopedClaims = useMemo(
    () =>
      claims.filter(
        (claim) =>
          Boolean(resolveTeam(claim.payerTeamId, claim.payerTeamName)) ||
          Boolean(resolveTeam(claim.chargeToTeamId, claim.chargeToTeamName))
      ),
    [claims, resolveTeam]
  );

  const includedAccommodationDocs = useMemo(
    () => (billingScope === 'all' ? accommodationDocs : accommodationDocs.filter(isPostedAccommodation)),
    [accommodationDocs, billingScope]
  );

  const includedVehicleDocs = useMemo(
    () => (billingScope === 'all' ? vehicleDocs : vehicleDocs.filter(isPostedVehicle)),
    [billingScope, vehicleDocs]
  );

  const includedCardDocs = useMemo(
    () => (billingScope === 'all' ? cardDocs : cardDocs.filter(isPostedCard)),
    [billingScope, cardDocs]
  );

  const includedClaims = useMemo(
    () => (billingScope === 'all' ? scopedClaims : scopedClaims.filter(isPostedClaim)),
    [billingScope, scopedClaims]
  );

  const statusCounts = useMemo<BillingStatusCounts>(
    () => ({
      accommodationDraft: accommodationDocs.filter((doc) => !isPostedAccommodation(doc)).length,
      accommodationConfirmed: accommodationDocs.filter(isPostedAccommodation).length,
      vehicleDraft: vehicleDocs.filter((doc) => !isPostedVehicle(doc)).length,
      vehiclePosted: vehicleDocs.filter(isPostedVehicle).length,
      cardDraft: cardDocs.filter((doc) => !isPostedCard(doc)).length,
      cardPosted: cardDocs.filter(isPostedCard).length,
      claimDraft: scopedClaims.filter((claim) => claim.status === 'draft').length,
      claimCharged: scopedClaims.filter((claim) => claim.status === 'charged').length,
      claimSettled: scopedClaims.filter((claim) => claim.status === 'settled').length
    }),
    [accommodationDocs, cardDocs, scopedClaims, vehicleDocs]
  );

  const summaries = useMemo(() => {
    const map = new Map<string, LedgerSummary>();
    const ensure = (team: Team | null, fallbackId?: unknown, fallbackName?: unknown) => {
      const key = getResolvedTeamId(team, fallbackId, fallbackName) || 'unknown';
      const existing = map.get(key);
      if (existing) return existing;
      const row = team
        ? makeEmptySummary(team)
        : {
            ...makeEmptySummary({ id: String(fallbackId ?? fallbackName ?? 'unknown'), name: String(fallbackName ?? '팀 미지정') } as Team),
            color: '#64748b'
          };
      map.set(key, row);
      return row;
    };

    teams.forEach((team) => ensure(team));

    includedAccommodationDocs.forEach((doc) => {
      const team = resolveTeam(doc.teamId, doc.teamName);
      if (!team) return;
      const row = ensure(team);
      (doc.lineItems ?? []).forEach((item) => {
        const amount = toFiniteNumber(item.amount);
        if (item.targetField === 'accommodation') row.accommodation += amount;
        else if (item.targetField === 'privateRoom') row.privateRoom += amount;
        else if (item.targetField === 'electricity') row.electricity += amount;
        else if (item.targetField === 'gas') row.gas += amount;
        else if (item.targetField === 'water') row.water += amount;
        else if (item.targetField === 'internet') row.internet += amount;
        else row.accommodationOther += amount;
      });
    });

    includedVehicleDocs.forEach((doc) => {
      const team = resolveTeam(doc.teamId ?? doc.assignedTeamId, doc.teamName ?? doc.assignedTeamName);
      if (!team) return;
      const row = ensure(team);
      const breakdown = summarizeVehicleBillingCosts(doc);
      row.vehicleRent += breakdown.rent;
      row.vehicleFine += breakdown.fine;
      row.vehicleRepair += breakdown.repair;
      row.vehicleOther += breakdown.other;
    });

    includedCardDocs.forEach((doc) => {
      const team = resolveTeam(doc.teamId ?? doc.assignedTeamId, doc.teamName ?? doc.assignedTeamName);
      if (!team) return;
      const row = ensure(team);
      const lineTotal = (doc.lineItems ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
      row.card += lineTotal > 0 ? lineTotal : toFiniteNumber(doc.totalAmount);
    });

    includedClaims.forEach((claim) => {
      const amount = toFiniteNumber(claim.amount);
      const payerTeam = resolveTeam(claim.payerTeamId, claim.payerTeamName);
      const chargeToTeam = resolveTeam(claim.chargeToTeamId, claim.chargeToTeamName);
      const isOtherExpense = claim.claimType === 'otherExpense' || !String(claim.chargeToTeamId ?? '').trim();

      if (payerTeam && isOtherExpense) {
        const payer = ensure(payerTeam);
        payer.otherClaim += amount;
        return;
      }

      if (payerTeam) {
        const payer = ensure(payerTeam);
        payer.receivable += amount;
      }

      if (chargeToTeam) {
        const chargeTo = ensure(chargeToTeam);
        chargeTo.payable += amount;
      }
    });

    return Array.from(map.values())
      .filter((row) => selectedTeamId === 'all' || row.teamId === selectedTeamId)
      .filter((row) => selectedTeamId !== 'all' || getSummaryTotal(row) !== 0 || row.receivable !== 0 || row.payable !== 0)
      .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko-KR'));
  }, [includedAccommodationDocs, includedCardDocs, includedClaims, includedVehicleDocs, resolveTeam, selectedTeamId, teams]);

  const totals = useMemo(
    () =>
      summaries.reduce(
        (acc, row) => ({
          accommodation: acc.accommodation + row.accommodation + row.privateRoom,
          utility: acc.utility + row.electricity + row.gas + row.water + row.internet + row.accommodationOther,
          vehicle: acc.vehicle + row.vehicleRent + row.vehicleFine + row.vehicleRepair + row.vehicleOther,
          card: acc.card + row.card,
          otherClaim: acc.otherClaim + row.otherClaim,
          receivable: acc.receivable + row.receivable,
          payable: acc.payable + row.payable,
          total: acc.total + getSummaryTotal(row)
        }),
        { accommodation: 0, utility: 0, vehicle: 0, card: 0, otherClaim: 0, receivable: 0, payable: 0, total: 0 }
      ),
    [summaries]
  );

  const groupedClaims = useMemo(() => {
    const map = new Map<string, LedgerClaimGroup>();
    includedClaims
      .filter((claim) => {
        if (selectedTeamId === 'all') return true;
        const payerTeam = resolveTeam(claim.payerTeamId, claim.payerTeamName);
        const chargeToTeam = resolveTeam(claim.chargeToTeamId, claim.chargeToTeamName);
        const payerId = getTeamStableId(payerTeam);
        const chargeToId = getTeamStableId(chargeToTeam);
        if (claim.claimType === 'otherExpense' || !String(claim.chargeToTeamId ?? '').trim()) return payerId === selectedTeamId;
        return payerId === selectedTeamId || chargeToId === selectedTeamId;
      })
      .forEach((claim) => {
        const payerTeam = resolveTeam(claim.payerTeamId, claim.payerTeamName);
        const chargeToTeam = resolveTeam(claim.chargeToTeamId, claim.chargeToTeamName);
        const payerId = getTeamStableId(payerTeam);
        const chargeToId = getTeamStableId(chargeToTeam);
        const isOtherExpense = claim.claimType === 'otherExpense' || !String(claim.chargeToTeamId ?? '').trim();
        const direction = isOtherExpense
          ? 'other'
          : selectedTeamId !== 'all' && chargeToId === selectedTeamId
            ? 'payable'
            : 'receivable';
        let counterpartyTeamName = claim.chargeToTeamName || '상대팀 미지정';
        if (isOtherExpense) {
          counterpartyTeamName = '청구대상 없음';
        }
        if (selectedTeamId !== 'all') {
          counterpartyTeamName = isOtherExpense
            ? '청구대상 없음'
            : chargeToId === selectedTeamId
            ? (claim.payerTeamName || '사용팀 미지정')
            : (claim.chargeToTeamName || '상대팀 미지정');
        }
        const key = `${direction}:${counterpartyTeamName || 'unknown'}`;
        const existing = map.get(key);
        const nextRows = [...(existing?.rows ?? []), claim].sort((a, b) => String(a.date).localeCompare(String(b.date), 'ko-KR'));
        map.set(key, {
          id: key,
          counterpartyTeamName,
          direction: isOtherExpense ? 'other' : payerId === chargeToId ? 'payable' : direction,
          rows: nextRows,
          total: nextRows.reduce((sum, row) => sum + toFiniteNumber(row.amount), 0)
        });
      });
    return Array.from(map.values()).sort((a, b) => {
      const order = { receivable: 0, payable: 1, other: 2 } as const;
      if (a.direction !== b.direction) return order[a.direction] - order[b.direction];
      return a.counterpartyTeamName.localeCompare(b.counterpartyTeamName, 'ko-KR');
    });
  }, [includedClaims, resolveTeam, selectedTeamId]);

  const selectedClaims = useMemo<SelectedClaimRows>(() => {
    if (selectedTeamId === 'all') return { receivable: [], payable: [], other: [] };

    return includedClaims.reduce(
      (acc, claim) => {
        const payerTeam = resolveTeam(claim.payerTeamId, claim.payerTeamName);
        const chargeToTeam = resolveTeam(claim.chargeToTeamId, claim.chargeToTeamName);
        const isOtherExpense = claim.claimType === 'otherExpense' || !String(claim.chargeToTeamId ?? '').trim();
        if (isOtherExpense && getTeamStableId(payerTeam) === selectedTeamId) acc.other.push(claim);
        else if (getTeamStableId(payerTeam) === selectedTeamId) acc.receivable.push(claim);
        if (!isOtherExpense && getTeamStableId(chargeToTeam) === selectedTeamId) acc.payable.push(claim);
        return acc;
      },
      { receivable: [] as TeamExpenseClaim[], payable: [] as TeamExpenseClaim[], other: [] as TeamExpenseClaim[] }
    );
  }, [includedClaims, resolveTeam, selectedTeamId]);

  const cardLabelOptions = useMemo<ExpensePaymentOption[]>(() => {
    const cardOptions = cards
      .filter((card) => card.status === 'ASSIGNED' && card.currentAssigneeType === 'TEAM')
      .map((card) => {
        const label = buildCardLabel(card);
        const assigneeName = String(card.currentAssigneeName ?? '').trim();
        const assigneeId = String(card.currentAssigneeId ?? '').trim();
        const assignedTeam = teams.find((team) => {
          const ids = getTeamIdCandidates(team);
          return (assigneeId && ids.includes(assigneeId)) || (assigneeName && String(team.name ?? '').trim() === assigneeName);
        });
        const teamIds = [
          assigneeId,
          assigneeName,
          ...getTeamIdCandidates(assignedTeam)
        ].filter(Boolean);

        return {
          value: label,
          label: assigneeName ? `${label} - ${assigneeName}` : label,
          kind: 'card' as const,
          assigneeName,
          teamIds: [...new Set(teamIds)]
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'ko-KR'));

    return [
      { value: '현찰', label: '현찰', kind: 'cash', teamIds: [] },
      ...cardOptions
    ];
  }, [cards, teams]);

  const selectedRawDocs = useMemo(() => {
    if (selectedTeamId === 'all') {
      return { accommodationDocs: [], vehicleDocs: [], cardDocs: [] };
    }

    return {
      accommodationDocs: includedAccommodationDocs.filter(doc => {
        const team = resolveTeam(doc.teamId, doc.teamName);
        return getTeamStableId(team) === selectedTeamId;
      }),
      vehicleDocs: includedVehicleDocs.filter(doc => {
        const team = resolveTeam(doc.teamId ?? doc.assignedTeamId, doc.teamName ?? doc.assignedTeamName);
        return getTeamStableId(team) === selectedTeamId;
      }),
      cardDocs: includedCardDocs.filter(doc => {
        const team = resolveTeam(doc.teamId ?? doc.assignedTeamId, doc.teamName ?? doc.assignedTeamName);
        return getTeamStableId(team) === selectedTeamId;
      })
    };
  }, [includedAccommodationDocs, includedVehicleDocs, includedCardDocs, selectedTeamId, resolveTeam]);

  return {
    loading,
    teams,
    teamOptions,
    siteOptions,
    resolveTeam,
    summaries,
    totals,
    groupedClaims,
    selectedClaims,
    statusCounts,
    cardLabelOptions,
    loadData,
    selectedRawDocs,
    rawDocs: {
      accommodationDocs: includedAccommodationDocs,
      vehicleDocs: includedVehicleDocs,
      cardDocs: includedCardDocs,
      cards,
      claims: includedClaims
    }
  };
};
