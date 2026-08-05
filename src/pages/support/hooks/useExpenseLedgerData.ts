import { useCallback, useEffect, useMemo, useState } from 'react';
import { accommodationBillingService } from '../../../services/accommodationBillingService';
import { cardBillingService } from '../../../services/cardBillingService';
import { cardService } from '../../../services/cardService';
import { companyService } from '../../../services/companyService';
import { siteService, type Site } from '../../../services/siteService';
import {
  DEFAULT_TEAM_EXPENSE_CATEGORIES,
  teamExpenseCategoryService
} from '../../../services/teamExpenseCategoryService';
import { teamExpenseLedgerService } from '../../../services/teamExpenseLedgerService';
import { teamService, type Team } from '../../../services/teamService';
import { vehicleBillingService } from '../../../services/vehicleBillingService';
import { isSupportBillingMonthEnabled } from '../../../utils/supportBillingPeriod';
import {
  isPostedSettlementBillingStatus,
  normalizeSettlementBillingStatus
} from '../../../utils/supportSettlementBilling';
import { toast } from '../../../utils/swal';
import {
  OFFICE_ASSIGNMENT_TEAM_ID,
  OFFICE_ASSIGNMENT_TEAM_NAME,
  appendOfficeAssignmentTeam,
  isOfficeAssignmentReference
} from '../../../utils/supportAssignmentTargets';
import { normalizeVehicleExpenseType } from '../../../utils/vehicleExpenseType';
import type { AccommodationBillingDocument } from '../../../types/accommodationBilling';
import type { Card, CardBillingTargetRecord, CardBillingTargetType } from '../../../types/card';
import type { CardBillingDocument } from '../../../types/cardBilling';
import type { DailyReport } from '../../../services/dailyReportService';
import type { TeamExpenseCategory, TeamExpenseClaim, TeamExpenseClaimCategory, TeamExpenseClaimType } from '../../../types/teamExpenseLedger';
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
  vehicleLease: number;
  vehicleFuel: number;
  vehicleFine: number;
  vehicleRepair: number;
  vehicleToll: number;
  vehicleOther: number;
  card: number;
  otherClaim: number;
  officeExpense: number;
  receivable: number;
  payable: number;
};

export type BillingScope = 'all' | 'posted';

export type LedgerClaimGroup = {
  id: string;
  counterpartyTeamName: string;
  direction: 'receivable' | 'payable' | 'other' | 'office';
  rows: TeamExpenseClaim[];
  total: number;
};

export type SelectedClaimRows = {
  receivable: TeamExpenseClaim[];
  payable: TeamExpenseClaim[];
  other: TeamExpenseClaim[];
  office: TeamExpenseClaim[];
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
  lease: number;
  fuel: number;
  fine: number;
  repair: number;
  toll: number;
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

export type ExpenseCategoryOption = {
  value: TeamExpenseClaimCategory;
  label: string;
  scope?: TeamExpenseCategory['scope'];
  isDefault?: boolean;
};

const toCategoryOption = (category: TeamExpenseCategory): ExpenseCategoryOption => ({
  value: category.id,
  label: category.label,
  scope: category.scope,
  isDefault: category.isDefault
});

const matchesCategoryScope = (category: TeamExpenseCategory, claimType: TeamExpenseClaimType) =>
  category.isActive && (category.scope === 'both' || category.scope === claimType);

const DEFAULT_ACTIVE_CATEGORY_OPTIONS = DEFAULT_TEAM_EXPENSE_CATEGORIES.filter((category) => category.isActive);

export const CATEGORY_OPTIONS: ExpenseCategoryOption[] = DEFAULT_ACTIVE_CATEGORY_OPTIONS
  .filter((category) => category.scope === 'both' || category.scope === 'teamCharge')
  .map(toCategoryOption);

export const OTHER_CLAIM_CATEGORY_OPTIONS: ExpenseCategoryOption[] = DEFAULT_ACTIVE_CATEGORY_OPTIONS
  .filter((category) => category.scope === 'both' || category.scope === 'otherExpense')
  .map(toCategoryOption);

export const OFFICE_EXPENSE_CATEGORY_OPTIONS: ExpenseCategoryOption[] = DEFAULT_ACTIVE_CATEGORY_OPTIONS
  .filter((category) => category.scope === 'both' || category.scope === 'officeExpense')
  .map(toCategoryOption);

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

const uniqueTextValues = (values: unknown[]) =>
  [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];

const buildCardLabel = (card: Card) => {
  const name = String(card.name ?? '').trim() || '카드';
  const last4 = String(card.last4 ?? '').trim();
  return last4 ? `${name} (${last4})` : name;
};

const isActiveDuringMonth = (
  target: { startDate?: string | null; endDate?: string | null },
  yearMonth: string
) => {
  const monthStart = `${yearMonth}-01`;
  const monthEnd = `${yearMonth}-31`;
  const startDate = String(target.startDate ?? '').trim();
  const endDate = String(target.endDate ?? '').trim();
  return (!startDate || startDate <= monthEnd) && (!endDate || endDate >= monthStart);
};

const getLatestActiveBillingTarget = (
  records: CardBillingTargetRecord[],
  yearMonth: string
): CardBillingTargetRecord | undefined => (
  records
    .filter((record) => isActiveDuringMonth(record, yearMonth))
    .sort((a, b) => {
      const startDiff = String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''));
      if (startDiff !== 0) return startDiff;
      return String(b.id ?? '').localeCompare(String(a.id ?? ''));
    })[0]
);

const getCardSnapshotBillingTarget = (card: Card): {
  targetId: string;
  targetType: CardBillingTargetType;
  targetName: string;
  startDate?: string | null;
  endDate?: string | null;
} | null => {
  const targetType = card.billingTargetType;
  const targetId = String(card.billingTargetId ?? '').trim();
  const targetName = String(card.billingTargetName ?? '').trim();
  if (!targetType || !targetId || !targetName) return null;

  return {
    targetId,
    targetType,
    targetName,
    startDate: String((card as any).billingTargetStartDate ?? '').trim() || undefined,
    endDate: String((card as any).billingTargetEndDate ?? '').trim() || undefined
  };
};

const getBillingTargetTeamKeys = (
  target: Pick<CardBillingTargetRecord, 'targetId' | 'targetType' | 'targetName'> | null | undefined,
  teams: Team[]
) => {
  if (!target) return [];

  if (target.targetType === 'OFFICE' || target.targetType === 'OFFICE_STAFF') {
    return uniqueTextValues([
      OFFICE_ASSIGNMENT_TEAM_ID,
      OFFICE_ASSIGNMENT_TEAM_NAME,
      target.targetId,
      target.targetName
    ]);
  }

  if (target.targetType === 'TEAM') {
    const targetId = String(target.targetId ?? '').trim();
    const targetName = String(target.targetName ?? '').trim();
    const targetTeam = teams.find((team) => {
      const ids = getTeamIdCandidates(team);
      return (targetId && ids.includes(targetId)) || (targetName && String(team.name ?? '').trim() === targetName);
    });

    return uniqueTextValues([
      targetId,
      targetName,
      ...getTeamIdCandidates(targetTeam)
    ]);
  }

  return [];
};

const isOfficeBillingTarget = (
  target: Pick<CardBillingTargetRecord, 'targetType'> | null | undefined
) => target?.targetType === 'OFFICE' || target?.targetType === 'OFFICE_STAFF';

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
  vehicleLease: 0,
  vehicleFuel: 0,
  vehicleFine: 0,
  vehicleRepair: 0,
  vehicleToll: 0,
  vehicleOther: 0,
  card: 0,
  otherClaim: 0,
  officeExpense: 0,
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
  row.vehicleLease +
  row.vehicleFuel +
  row.vehicleFine +
  row.vehicleRepair +
  row.vehicleToll +
  row.vehicleOther +
  row.card +
  row.otherClaim +
  row.officeExpense +
  row.payable -
  row.receivable;

export const getCategoryLabel = (category: TeamExpenseClaimCategory, options: ExpenseCategoryOption[] = []) => {
  const raw = String(category ?? '').trim();
  if (!raw) return '기타';
  return (
    options.find((option) => option.value === raw)?.label ??
    DEFAULT_TEAM_EXPENSE_CATEGORIES.find((option) => option.id === raw)?.label ??
    raw
  );
};

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

const isAccommodationLedgerClaim = (doc: AccommodationBillingDocument) =>
  (doc.lineItems ?? []).some((item) => item.sourceType === 'utility_ledger');
const isPostedAccommodation = (doc: AccommodationBillingDocument) =>
  isPostedSettlementBillingStatus(doc.status) || (normalizeSettlementBillingStatus(doc.status) === 'draft' && isAccommodationLedgerClaim(doc));
const isVehicleLedgerClaim = (doc: VehicleBillingDocument) =>
  (doc.lineItems ?? []).some((item) => item.sourceType === 'vehicle_ledger');
const isPostedVehicle = (doc: VehicleBillingDocument) => {
  const status = normalizeSettlementBillingStatus(doc.status);
  return isPostedSettlementBillingStatus(status) || (status === 'draft' && isVehicleLedgerClaim(doc));
};
const isCardLedgerClaim = (doc: CardBillingDocument) =>
  (doc.lineItems ?? []).some((item) => item.sourceType === 'card_ledger');
const isPostedCard = (doc: CardBillingDocument) => {
  const status = normalizeSettlementBillingStatus(doc.status);
  return isPostedSettlementBillingStatus(status) || (status === 'draft' && isCardLedgerClaim(doc));
};
const isPostedClaim = (claim: TeamExpenseClaim) => claim.status === 'charged' || claim.status === 'settled';
const isTeamExpenseBillingDocument = (doc: { issuedToType?: unknown }) =>
  String(doc.issuedToType ?? '').trim().toLowerCase() !== 'worker';

const hasChargeTarget = (claim: TeamExpenseClaim) =>
  Boolean(String(claim.chargeToTeamId ?? '').trim() || String(claim.chargeToTeamName ?? '').trim());

export const isOfficeExpenseClaim = (claim: TeamExpenseClaim) =>
  claim.claimType === 'officeExpense' ||
  (
    (claim.claimType === 'otherExpense' || !hasChargeTarget(claim)) &&
    isOfficeAssignmentReference(claim.payerTeamId, claim.payerTeamName)
  );

export const isOtherExpenseClaim = (claim: TeamExpenseClaim) =>
  !isOfficeExpenseClaim(claim) && (claim.claimType === 'otherExpense' || !hasChargeTarget(claim));

export const getEffectiveClaimType = (claim: TeamExpenseClaim): TeamExpenseClaimType => {
  if (isOfficeExpenseClaim(claim)) return 'officeExpense';
  if (isOtherExpenseClaim(claim)) return 'otherExpense';
  return 'teamCharge';
};

const hasAttendance = (report: DailyReport) => {
  if (toFiniteNumber((report as any).totalManDay) > 0) return true;

  return (report.workers ?? []).some((worker) => {
    const manDay = toFiniteNumber((worker as any).manDay);
    const status = String((worker as any).status ?? '');
    return manDay > 0 || status === 'attendance' || status === 'half';
  });
};

export const getAttendedSiteOptions = (siteOptions: Site[], dailyReports: DailyReport[], endDate: string) => {
  const normalizedEndDate = String(endDate ?? '').slice(0, 10);
  const yearMonth = normalizedEndDate.slice(0, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedEndDate) || !yearMonth) return [];

  const startDate = `${yearMonth}-01`;
  const attendedSiteIds = new Set<string>();
  const attendedSiteNames = new Set<string>();

  dailyReports.forEach((report) => {
    const reportDate = String(report.date ?? '').slice(0, 10);
    if (reportDate < startDate || reportDate > normalizedEndDate) return;
    if (!hasAttendance(report)) return;

    const siteId = String(report.siteId ?? '').trim();
    const siteNameKey = normalizeKey(report.siteName);
    if (siteId) attendedSiteIds.add(siteId);
    if (siteNameKey) attendedSiteNames.add(siteNameKey);
  });

  return siteOptions.filter((site) => {
    const siteId = String(site.id ?? '').trim();
    const legacyId = String((site as any).legacyId ?? '').trim();
    const siteNameKey = normalizeKey(site.name);
    return (
      (siteId && attendedSiteIds.has(siteId)) ||
      (legacyId && attendedSiteIds.has(legacyId)) ||
      (siteNameKey && attendedSiteNames.has(siteNameKey))
    );
  });
};

export const summarizeVehicleBillingCosts = (doc: VehicleBillingDocument): VehicleCostBreakdown => {
  let rent = 0;
  let lease = 0;
  let fuel = 0;
  let fine = 0;
  let repair = 0;
  let toll = 0;
  let other = 0;
  let hasExplicitFixedLine = false;
  let variableLineTotal = 0;

  (doc.lineItems ?? []).forEach((item) => {
    const amount = toFiniteNumber(item.amount);
    const category = normalizeKey(item.category);
    const label = normalizeKey(`${item.type ?? ''} ${item.category ?? ''} ${item.label ?? ''} ${item.id ?? ''}`);

    if (category === 'lease' || label.includes('lease') || label.includes('리스')) {
      lease += amount;
      hasExplicitFixedLine = true;
      return;
    }

    if (
      category === 'rent' ||
      item.type === 'FIXED' ||
      label.includes('rent') ||
      label.includes('rental') ||
      label.includes('monthlyfee') ||
      label.includes('monthly fee') ||
      label.includes('렌트') ||
      label.includes('월사용료')
    ) {
      rent += amount;
      hasExplicitFixedLine = true;
      return;
    }

    variableLineTotal += amount;
    const expenseType = normalizeVehicleExpenseType(category, label, item.id);
    if (expenseType === 'FUEL') fuel += amount;
    else if (expenseType === 'REPAIR') repair += amount;
    else if (expenseType === 'TOLL') toll += amount;
    else if (expenseType === 'FINE') fine += amount;
    else other += amount;
  });

  if (!hasExplicitFixedLine) {
    rent += toFiniteNumber(doc.fixedCost);
  }

  if (variableLineTotal === 0 && toFiniteNumber(doc.variableCost) > 0) {
    other += toFiniteNumber(doc.variableCost);
  }

  return {
    rent,
    lease,
    fuel,
    fine,
    repair,
    toll,
    other,
    total: rent + lease + fuel + fine + repair + toll + other
  };
};

const makeEmptyVehicleCostBreakdown = (): VehicleCostBreakdown => ({
  rent: 0,
  lease: 0,
  fuel: 0,
  fine: 0,
  repair: 0,
  toll: 0,
  other: 0,
  total: 0
});

const addVehicleCostBreakdown = (target: VehicleCostBreakdown, source: VehicleCostBreakdown) => {
  target.rent += source.rent;
  target.lease += source.lease;
  target.fuel += source.fuel;
  target.fine += source.fine;
  target.repair += source.repair;
  target.toll += source.toll;
  target.other += source.other;
  target.total += source.total;
};

const summarizeVehicleBillingCostsFromDetailRows = (doc: VehicleBillingDocument): VehicleCostBreakdown => {
  if (!isTeamExpenseBillingDocument(doc)) return makeEmptyVehicleCostBreakdown();

  const items = doc.lineItems ?? [];
  if (items.length === 0) {
    const breakdown = summarizeVehicleBillingCosts(doc);
    return breakdown.total > 0 ? breakdown : makeEmptyVehicleCostBreakdown();
  }

  return items.reduce((acc, item) => {
    const amount = toFiniteNumber(item.amount);
    const breakdown = summarizeVehicleBillingCosts({
      ...doc,
      fixedCost: 0,
      variableCost: 0,
      totalAmount: amount,
      lineItems: [item]
    });
    if (breakdown.total > 0) addVehicleCostBreakdown(acc, breakdown);
    return acc;
  }, makeEmptyVehicleCostBreakdown());
};

const summarizeCardBillingAmountFromDetailRows = (doc: CardBillingDocument): number => {
  if (!isTeamExpenseBillingDocument(doc)) return 0;

  const items = doc.lineItems ?? [];
  if (items.length === 0) {
    const amount = toFiniteNumber(doc.totalAmount);
    return amount > 0 ? amount : 0;
  }

  return items.reduce((sum, item) => {
    const amount = toFiniteNumber(item.amount);
    return amount > 0 ? sum + amount : sum;
  }, 0);
};

export const useExpenseLedgerData = (yearMonth: string, selectedTeamId: string, billingScope: BillingScope = 'all', includeDailyReports = false) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [accommodationDocs, setAccommodationDocs] = useState<AccommodationBillingDocument[]>([]);
  const [vehicleDocs, setVehicleDocs] = useState<VehicleBillingDocument[]>([]);
  const [cardDocs, setCardDocs] = useState<CardBillingDocument[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [cardBillingTargets, setCardBillingTargets] = useState<CardBillingTargetRecord[]>([]);
  const [claims, setClaims] = useState<TeamExpenseClaim[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<TeamExpenseCategory[]>(DEFAULT_TEAM_EXPENSE_CATEGORIES);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = `${yearMonth}-01`;
      const monthEnd = `${yearMonth}-31`;
      const dailyReportsPromise = includeDailyReports
        ? import('../../../services/dailyReportService')
          .then(({ dailyReportService }) => dailyReportService.getReports({ startDate: monthStart, endDate: monthEnd }))
          .catch((error) => {
            console.warn('[useExpenseLedgerData] daily reports load failed', error);
            return [] as DailyReport[];
          })
        : Promise.resolve([] as DailyReport[]);
      const [teamList, siteList, accommodationList, vehicleList, cardBillingList, claimList, companyList, cardMasterList, cardBillingTargetList, categoryList, dailyReportList] = await Promise.all([
        teamService.getTeams(),
        siteService.getSites(),
        accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth }),
        vehicleBillingService.getBillingsByMonth(yearMonth),
        cardBillingService.getBillingsByMonth(yearMonth),
        teamExpenseLedgerService.getClaimsByMonth(yearMonth),
        companyService.getCompanies(),
        cardService.getCards(),
        cardService.listAllCardBillingTargets().catch((error) => {
          console.warn('[useExpenseLedgerData] card billing targets load failed', error);
          return [] as CardBillingTargetRecord[];
        }),
        teamExpenseCategoryService.getCategories({ includeInactive: true }).catch((error) => {
          console.warn('[useExpenseLedgerData] expense categories load failed', error);
          return DEFAULT_TEAM_EXPENSE_CATEGORIES;
        }),
        dailyReportsPromise
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

      setTeams(appendOfficeAssignmentTeam(filteredTeams, teamList));
      setSites(siteList);
      const supportBillingEnabled = isSupportBillingMonthEnabled(yearMonth);
      setAccommodationDocs(supportBillingEnabled ? accommodationList : []);
      setVehicleDocs(supportBillingEnabled ? vehicleList : []);
      setCardDocs(supportBillingEnabled ? cardBillingList : []);
      setCards(cardMasterList);
      setCardBillingTargets(cardBillingTargetList);
      setClaims(claimList);
      setExpenseCategories(categoryList);
      setDailyReports(dailyReportList);
    } catch (error) {
      console.error('[useExpenseLedgerData] load failed', error);
      toast.error('경비내역 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [includeDailyReports, yearMonth]);

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

  const teamExpenseAccommodationDocs = useMemo(
    () => includedAccommodationDocs.filter(isTeamExpenseBillingDocument),
    [includedAccommodationDocs]
  );

  const baseIncludedVehicleDocs = useMemo(
    () => (billingScope === 'all' ? vehicleDocs : vehicleDocs.filter(isPostedVehicle)),
    [billingScope, vehicleDocs]
  );

  const includedVehicleDocs = useMemo(
    () => baseIncludedVehicleDocs,
    [baseIncludedVehicleDocs]
  );

  const baseTeamExpenseVehicleDocs = useMemo(
    () => baseIncludedVehicleDocs.filter(isTeamExpenseBillingDocument),
    [baseIncludedVehicleDocs]
  );

  const teamExpenseVehicleDocs = useMemo(
    () => baseTeamExpenseVehicleDocs,
    [baseTeamExpenseVehicleDocs]
  );

  const includedCardDocs = useMemo(
    () => (billingScope === 'all' ? cardDocs : cardDocs.filter(isPostedCard)),
    [billingScope, cardDocs]
  );

  const teamExpenseCardDocs = useMemo(
    () => includedCardDocs.filter(isTeamExpenseBillingDocument),
    [includedCardDocs]
  );

  const includedClaims = useMemo(
    () => (billingScope === 'all' ? scopedClaims : scopedClaims.filter(isPostedClaim)),
    [billingScope, scopedClaims]
  );

  const statusCounts = useMemo<BillingStatusCounts>(
    () => ({
      accommodationDraft: accommodationDocs.filter((doc) => isTeamExpenseBillingDocument(doc) && !isPostedAccommodation(doc)).length,
      accommodationConfirmed: accommodationDocs.filter((doc) => isTeamExpenseBillingDocument(doc) && isPostedAccommodation(doc)).length,
      vehicleDraft: vehicleDocs.filter((doc) => isTeamExpenseBillingDocument(doc) && !isPostedVehicle(doc)).length,
      vehiclePosted: vehicleDocs.filter((doc) => isTeamExpenseBillingDocument(doc) && isPostedVehicle(doc)).length,
      cardDraft: cardDocs.filter((doc) => isTeamExpenseBillingDocument(doc) && !isPostedCard(doc)).length,
      cardPosted: cardDocs.filter((doc) => isTeamExpenseBillingDocument(doc) && isPostedCard(doc)).length,
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

    teamExpenseAccommodationDocs.forEach((doc) => {
      const team = resolveTeam(doc.teamId, doc.teamName);
      if (!team) return;
      const row = ensure(team);
      (doc.lineItems ?? []).forEach((item) => {
        const amount = toFiniteNumber(item.amount);
        if (amount <= 0) return;
        if (item.targetField === 'accommodation') row.accommodation += amount;
        else if (item.targetField === 'privateRoom') row.privateRoom += amount;
        else if (item.targetField === 'electricity') row.electricity += amount;
        else if (item.targetField === 'gas') row.gas += amount;
        else if (item.targetField === 'water') row.water += amount;
        else if (item.targetField === 'internet') row.internet += amount;
        else row.accommodationOther += amount;
      });
    });

    teamExpenseVehicleDocs.forEach((doc) => {
      const team = resolveTeam(doc.teamId ?? doc.assignedTeamId, doc.teamName ?? doc.assignedTeamName);
      if (!team) return;
      const row = ensure(team);
      const breakdown = summarizeVehicleBillingCostsFromDetailRows(doc);
      row.vehicleRent += breakdown.rent;
      row.vehicleLease += breakdown.lease;
      row.vehicleFuel += breakdown.fuel;
      row.vehicleFine += breakdown.fine;
      row.vehicleRepair += breakdown.repair;
      row.vehicleToll += breakdown.toll;
      row.vehicleOther += breakdown.other;
    });

    teamExpenseCardDocs.forEach((doc) => {
      const team = resolveTeam(doc.teamId ?? doc.assignedTeamId, doc.teamName ?? doc.assignedTeamName);
      if (!team) return;
      const row = ensure(team);
      row.card += summarizeCardBillingAmountFromDetailRows(doc);
    });

    includedClaims.forEach((claim) => {
      const amount = toFiniteNumber(claim.amount);
      const payerTeam = resolveTeam(claim.payerTeamId, claim.payerTeamName);
      const chargeToTeam = resolveTeam(claim.chargeToTeamId, claim.chargeToTeamName);
      const isOfficeExpense = isOfficeExpenseClaim(claim);
      const isOtherExpense = isOtherExpenseClaim(claim);

      if (payerTeam && isOfficeExpense) {
        const payer = ensure(payerTeam);
        payer.officeExpense += amount;
        return;
      }

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
  }, [includedClaims, resolveTeam, selectedTeamId, teamExpenseAccommodationDocs, teamExpenseCardDocs, teamExpenseVehicleDocs, teams]);

  const totals = useMemo(
    () =>
      summaries.reduce(
        (acc, row) => ({
          accommodation: acc.accommodation + row.accommodation + row.privateRoom,
          utility: acc.utility + row.electricity + row.gas + row.water + row.internet + row.accommodationOther,
          vehicle: acc.vehicle + row.vehicleRent + row.vehicleLease + row.vehicleFuel + row.vehicleFine + row.vehicleRepair + row.vehicleToll + row.vehicleOther,
          card: acc.card + row.card,
          otherClaim: acc.otherClaim + row.otherClaim,
          officeExpense: acc.officeExpense + row.officeExpense,
          receivable: acc.receivable + row.receivable,
          payable: acc.payable + row.payable,
          total: acc.total + getSummaryTotal(row)
        }),
        { accommodation: 0, utility: 0, vehicle: 0, card: 0, otherClaim: 0, officeExpense: 0, receivable: 0, payable: 0, total: 0 }
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
        if (getEffectiveClaimType(claim) !== 'teamCharge') return payerId === selectedTeamId;
        return payerId === selectedTeamId || chargeToId === selectedTeamId;
      })
      .forEach((claim) => {
        const payerTeam = resolveTeam(claim.payerTeamId, claim.payerTeamName);
        const chargeToTeam = resolveTeam(claim.chargeToTeamId, claim.chargeToTeamName);
        const payerId = getTeamStableId(payerTeam);
        const chargeToId = getTeamStableId(chargeToTeam);
        const effectiveClaimType = getEffectiveClaimType(claim);
        const isStandaloneExpense = effectiveClaimType !== 'teamCharge';
        const direction = effectiveClaimType === 'officeExpense'
          ? 'office'
          : effectiveClaimType === 'otherExpense'
            ? 'other'
            : selectedTeamId !== 'all' && chargeToId === selectedTeamId
              ? 'payable'
              : 'receivable';
        let counterpartyTeamName = claim.chargeToTeamName || '상대팀 미지정';
        if (effectiveClaimType === 'officeExpense') {
          counterpartyTeamName = '사무실경비';
        } else if (effectiveClaimType === 'otherExpense') {
          counterpartyTeamName = '청구대상 없음';
        }
        if (selectedTeamId !== 'all') {
          counterpartyTeamName = isStandaloneExpense
            ? (effectiveClaimType === 'officeExpense' ? '사무실경비' : '청구대상 없음')
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
          direction: isStandaloneExpense ? direction : payerId === chargeToId ? 'payable' : direction,
          rows: nextRows,
          total: nextRows.reduce((sum, row) => sum + toFiniteNumber(row.amount), 0)
        });
      });
    return Array.from(map.values()).sort((a, b) => {
      const order = { receivable: 0, payable: 1, other: 2, office: 3 } as const;
      if (a.direction !== b.direction) return order[a.direction] - order[b.direction];
      return a.counterpartyTeamName.localeCompare(b.counterpartyTeamName, 'ko-KR');
    });
  }, [includedClaims, resolveTeam, selectedTeamId]);

  const selectedClaims = useMemo<SelectedClaimRows>(() => {
    if (selectedTeamId === 'all') return { receivable: [], payable: [], other: [], office: [] };

    return includedClaims.reduce(
      (acc, claim) => {
        const payerTeam = resolveTeam(claim.payerTeamId, claim.payerTeamName);
        const chargeToTeam = resolveTeam(claim.chargeToTeamId, claim.chargeToTeamName);
        const effectiveClaimType = getEffectiveClaimType(claim);
        if (effectiveClaimType === 'officeExpense' && getTeamStableId(payerTeam) === selectedTeamId) acc.office.push(claim);
        else if (effectiveClaimType === 'otherExpense' && getTeamStableId(payerTeam) === selectedTeamId) acc.other.push(claim);
        else if (getTeamStableId(payerTeam) === selectedTeamId) acc.receivable.push(claim);
        if (effectiveClaimType === 'teamCharge' && getTeamStableId(chargeToTeam) === selectedTeamId) acc.payable.push(claim);
        return acc;
      },
      { receivable: [] as TeamExpenseClaim[], payable: [] as TeamExpenseClaim[], other: [] as TeamExpenseClaim[], office: [] as TeamExpenseClaim[] }
    );
  }, [includedClaims, resolveTeam, selectedTeamId]);

  const cardLabelOptions = useMemo<ExpensePaymentOption[]>(() => {
    const billingTargetsByCardId = new Map<string, CardBillingTargetRecord[]>();
    cardBillingTargets.forEach((target) => {
      const cardId = String(target.cardId ?? '').trim();
      if (!cardId) return;
      const existing = billingTargetsByCardId.get(cardId) ?? [];
      existing.push(target);
      billingTargetsByCardId.set(cardId, existing);
    });

    const cardOptions = cards
      .filter((card) => card.status === 'ASSIGNED' && card.currentAssigneeType === 'TEAM')
      .map((card): ExpensePaymentOption => {
        const label = buildCardLabel(card);
        const assigneeName = String(card.currentAssigneeName ?? '').trim();
        const assigneeId = String(card.currentAssigneeId ?? '').trim();
        const assignedTeam = teams.find((team) => {
          const ids = getTeamIdCandidates(team);
          return (assigneeId && ids.includes(assigneeId)) || (assigneeName && String(team.name ?? '').trim() === assigneeName);
        });
        const latestBillingTarget = getLatestActiveBillingTarget(billingTargetsByCardId.get(card.id) ?? [], yearMonth);
        const snapshotBillingTarget = getCardSnapshotBillingTarget(card);
        const billingTarget = latestBillingTarget
          ?? (snapshotBillingTarget && isActiveDuringMonth(snapshotBillingTarget, yearMonth) ? snapshotBillingTarget : null);

        const billingTargetTeamIds = getBillingTargetTeamKeys(billingTarget, teams);
        // 사무실로 청구하는 청연카드는 팀별 선택 목록에서 제외하고,
        // 사무실을 선택했을 때만 보이도록 한다. 이전에는 이 카드를
        // 아예 제거해 사무실에서도 결제수단으로 선택할 수 없었다.
        const teamIds = isOfficeBillingTarget(billingTarget)
          ? billingTargetTeamIds
          : uniqueTextValues([
              assigneeId,
              assigneeName,
              ...getTeamIdCandidates(assignedTeam),
              ...billingTargetTeamIds
            ]);

        return {
          value: label,
          label: assigneeName ? `${label} - ${assigneeName}` : label,
          kind: 'card' as const,
          assigneeName,
          teamIds
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'ko-KR'));

    return [
      { value: '현찰', label: '현찰', kind: 'cash', teamIds: [] },
      ...cardOptions
    ];
  }, [cardBillingTargets, cards, teams, yearMonth]);

  const activeExpenseCategories = useMemo(
    () => expenseCategories.filter((category) => category.isActive),
    [expenseCategories]
  );

  const allCategoryOptions = useMemo<ExpenseCategoryOption[]>(
    () => expenseCategories.map(toCategoryOption),
    [expenseCategories]
  );

  const categoryOptions = useMemo<ExpenseCategoryOption[]>(
    () => expenseCategories.filter((category) => matchesCategoryScope(category, 'teamCharge')).map(toCategoryOption),
    [expenseCategories]
  );

  const otherClaimCategoryOptions = useMemo<ExpenseCategoryOption[]>(
    () => expenseCategories.filter((category) => matchesCategoryScope(category, 'otherExpense')).map(toCategoryOption),
    [expenseCategories]
  );

  const officeExpenseCategoryOptions = useMemo<ExpenseCategoryOption[]>(
    () => expenseCategories.filter((category) => matchesCategoryScope(category, 'officeExpense')).map(toCategoryOption),
    [expenseCategories]
  );

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
  }, [includedAccommodationDocs, includedCardDocs, includedVehicleDocs, resolveTeam, selectedTeamId]);

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
    expenseCategories,
    activeExpenseCategories,
    allCategoryOptions,
    categoryOptions,
    otherClaimCategoryOptions,
    officeExpenseCategoryOptions,
    loadData,
    selectedRawDocs,
    rawDocs: {
      accommodationDocs: includedAccommodationDocs,
      vehicleDocs: includedVehicleDocs,
      cardDocs: includedCardDocs,
      cards,
      dailyReports,
      claims: includedClaims
    }
  };
};
