import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';
import { CurrencyInput } from '../../components/common/CurrencyInput';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { accommodationBillingService } from '../../services/accommodationBillingService';
import { accommodationService } from '../../services/accommodationService';
import { cardBillingService } from '../../services/cardBillingService';
import { cardService } from '../../services/cardService';
import { companyService } from '../../services/companyService';
import { dailyReportService, type DailyReportWorkerRow } from '../../services/dailyReportService';
import { laborExchangeService, type LaborExchangeItem, type TeamExchangeSummary } from '../../services/laborExchangeService';
import { manpowerService, type Worker as ManpowerWorker } from '../../services/manpowerService';
import { teamService, type Team } from '../../services/teamService';
import { teamSettlementService } from '../../services/teamSettlementService';
import { vehicleBillingService } from '../../services/vehicleBillingService';
import { vehicleService } from '../../services/vehicleService';
import { officeService } from '../../services/officeService';
import { toast } from '../../utils/swal';
import type { UtilityRecord } from '../../types/accommodation';
import type { AccommodationAssignment } from '../../types/accommodationAssignment';
import type { AccommodationBillingDocument } from '../../types/accommodationBilling';
import type { Card, CardTransaction } from '../../types/card';
import type { CardBillingDocument } from '../../types/cardBilling';
import type {
  TeamSettlementAdditionItem,
  TeamSettlementDeductionItem,
  TeamSettlementDocument,
  TeamSettlementPurchaseItem,
  TeamSettlementSalesItem,
  TeamSettlementWorkKind
} from '../../types/teamSettlement';
import type { Vehicle, VehicleExpenseRecord } from '../../types/vehicle';
import type { VehicleBillingDocument } from '../../types/vehicleBilling';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string };

const buildDefaultYearMonth = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const buildLocalId = (prefix: string): string => {
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}_${Date.now()}_${rand}`;
};

const formatCurrency = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('ko-KR').format(safe);
};

const formatManDay1 = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return (Math.round(safe * 10) / 10).toFixed(1);
};

const safeAverage = (numerator: number, denominator: number): number | null => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
};

const formatAverageCurrency = (value: number | null): string => {
  if (value === null) return '-';
  return `${formatCurrency(Math.round(value))}원`;
};

const formatAverageNumber = (value: number | null, digits: number): string => {
  if (value === null) return '-';
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toFixed(digits);
};

const safeNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const parseYmdDate = (value: string): Date | null => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const calculateOverlapDays = (params: {
  monthStart: Date;
  monthEnd: Date;
  startDate: Date;
  endDate?: Date | null;
}): number => {
  const actualStart = params.startDate.getTime() > params.monthStart.getTime() ? params.startDate : params.monthStart;
  const rawEnd = params.endDate && Number.isFinite(params.endDate.getTime()) ? params.endDate : params.monthEnd;
  const actualEnd = rawEnd.getTime() < params.monthEnd.getTime() ? rawEnd : params.monthEnd;
  if (actualEnd.getTime() < actualStart.getTime()) return 0;

  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.floor((actualEnd.getTime() - actualStart.getTime()) / oneDayMs) + 1;
};

const normalizeBillingStatus = (value: unknown): string => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === '확정') return 'confirmed';
  return raw;
};

const selectPreferredTeamBillings = <T extends { status?: unknown }>(docs: T[]): T[] => {
  if (!Array.isArray(docs) || docs.length === 0) return [];
  const confirmed = docs.filter((doc) => normalizeBillingStatus(doc.status) === 'confirmed');
  if (confirmed.length > 0) return confirmed;
  return docs;
};

const isTeamIssuedTo = (value: unknown): boolean => {
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === 'team' || raw === 'team_leader';
};

const isTeamBillingTarget = (params: {
  issuedToType?: unknown;
  teamId?: unknown;
  teamName?: unknown;
  issuedToWorkerId?: unknown;
  issuedToWorkerName?: unknown;
}): boolean => {
  if (isTeamIssuedTo(params.issuedToType)) return true;

  const issuedType = String(params.issuedToType ?? '').trim().toLowerCase();
  if (issuedType === 'worker') return false;

  const workerId = String(params.issuedToWorkerId ?? '').trim();
  if (workerId) return false;

  const workerName = String(params.issuedToWorkerName ?? '').trim();
  const teamName = String(params.teamName ?? '').trim();
  if (workerName && teamName && workerName !== teamName) return false;

  return (
    String(params.teamId ?? '').trim().length > 0 ||
    String(params.teamName ?? '').trim().length > 0
  );
};

const mapAccommodationTargetFieldLabel = (field: string): string => {
  if (field === 'accommodation') return '숙소비';
  if (field === 'privateRoom') return '개인실';
  if (field === 'electricity') return '전기';
  if (field === 'gas') return '가스';
  if (field === 'internet') return '인터넷';
  if (field === 'water') return '수도';
  if (field === 'fines') return '공과금';
  if (field === 'deposit') return '보증금';
  if (field === 'gloves') return '장갑비';
  return field;
};

const stripSupportOriginalLines = (doc: TeamSettlementDocument): TeamSettlementDocument => {
  return {
    ...doc,
    sales: (doc.sales ?? []).filter((s) => s.origin !== 'support_outgoing'),
    purchases: (doc.purchases ?? []).filter((p) => p.origin !== 'support_incoming')
  };
};

const isEditable = (doc: TeamSettlementDocument | null): boolean => {
  return Boolean(doc && !doc.confirmedAt);
};

const getKindBadgeClassName = (kind: TeamSettlementWorkKind): string => {
  if (kind === '도급') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (kind === '직영') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
};

const formatSalesOrigin = (origin: TeamSettlementSalesItem['origin']): string => {
  if (origin === 'daily_report') return '출력';
  if (origin === 'tax_invoice') return '계산서';
  if (origin === 'support_fee_outgoing') return '지원간것';
  return '수기';
};

const formatPurchaseOrigin = (origin: TeamSettlementPurchaseItem['origin']): string => {
  if (origin === 'daily_report') return '출력';
  if (origin === 'support_fee_incoming') return '지원온것';
  return '수기';
};

const formatAdditionOrigin = (origin: TeamSettlementAdditionItem['origin']): string => {
  if (origin === 'manual') return '수기';
  return '수기';
};

const formatDeductionOrigin = (origin: TeamSettlementDeductionItem['origin']): string => {
  if (origin === 'office_expense') return '사무실비';
  if (origin === 'daily_wage_payroll') return '일급제 급여';
  if (origin === 'monthly_wage_payroll') return '월급제 급여';
  if (origin === 'accommodation_billing') return '숙소';
  if (origin === 'vehicle_billing') return '차량';
  if (origin === 'card_billing') return '카드';
  return '수기';
};

const KINDS: TeamSettlementWorkKind[] = ['도급', '직영', '지원'];

type SettlementDirection = 'sales' | 'purchase';

type SettlementUnifiedOrigin = TeamSettlementSalesItem['origin'] | TeamSettlementPurchaseItem['origin'];

type SettlementUnifiedLine = {
  id: string;
  direction: SettlementDirection;
  source: 'auto' | 'manual';
  origin: SettlementUnifiedOrigin;
  originLabel: string;
  kind: TeamSettlementWorkKind;
  siteId?: string;
  siteName: string;
  counterTeamId?: string;
  counterTeamName?: string;
  manDay: number;
  quantity?: number;
  amount: number;
  memo?: string;
};

type SiteSkkumiRow = {
  siteName: string;
  quantity: number;
  manDay: number;
  amount: number;
};

type LineDetailRow = {
  id: string;
  date: string;
  siteName: string;
  workerName: string;
  workerTeamName: string;
  manDay: number;
  unitPrice: number;
  amount: number;
};

type DeductionSourceData = {
  accommodationDocs: AccommodationBillingDocument[];
  accommodationAssignments: AccommodationAssignment[];
  utilityRecords: UtilityRecord[];
  vehicleDocs: VehicleBillingDocument[];
  vehicles: Vehicle[];
  vehicleExpenses: VehicleExpenseRecord[];
  cardDocs: CardBillingDocument[];
  cards: Card[];
  cardTransactions: CardTransaction[];
  workers: ManpowerWorker[];
};

const createEmptyDeductionSourceData = (): DeductionSourceData => ({
  accommodationDocs: [],
  accommodationAssignments: [],
  utilityRecords: [],
  vehicleDocs: [],
  vehicles: [],
  vehicleExpenses: [],
  cardDocs: [],
  cards: [],
  cardTransactions: [],
  workers: []
});

const buildMonthRange = (yearMonth: string): { startDate: string; endDate: string } => {
  const [y, m] = String(yearMonth).split('-');
  const year = Number(y);
  const month = Number(m);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1;

  const start = new Date(safeYear, safeMonth - 1, 1);
  const end = new Date(safeYear, safeMonth, 0);

  const toIsoDate = (d: Date) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
};

export const TeamSettlementPage: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [yearMonth, setYearMonth] = useState<string>(buildDefaultYearMonth());
  const [doc, setDoc] = useState<TeamSettlementDocument | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });
  const [detailRows, setDetailRows] = useState<DailyReportWorkerRow[]>([]);
  const [laborExchangeSummary, setLaborExchangeSummary] = useState<TeamExchangeSummary | null>(null);
  const [expandedLineIds, setExpandedLineIds] = useState<Set<string>>(() => new Set());
  const [expandedSiteKeys, setExpandedSiteKeys] = useState<Set<string>>(() => new Set());
  const [expandedDeductionIds, setExpandedDeductionIds] = useState<Set<string>>(() => new Set());
  const [deductionSourceData, setDeductionSourceData] = useState<DeductionSourceData>(() => createEmptyDeductionSourceData());

  useEffect(() => {
    let cancelled = false;
    const loadTeams = async () => {
      try {
        const [teamList, constructionCompanies] = await Promise.all([
          teamService.getTeams(),
          companyService.getCompaniesByType('시공사')
        ]);

        if (cancelled) return;

        const constructionCompanyIdSet = new Set(
          constructionCompanies
            .map((c) => c.id)
            .filter((id): id is string => Boolean(id))
        );
        const constructionCompanyNameSet = new Set(constructionCompanies.map((c) => c.name));

        const constructionCompanyTeams = teamList.filter((team) => {
          if (team.companyId) return constructionCompanyIdSet.has(team.companyId);
          if (team.companyName) return constructionCompanyNameSet.has(team.companyName);
          return false;
        });

        const siteConstructionTeams = constructionCompanyTeams.filter((team) => {
          const raw = String(team.type ?? '').trim();
          return raw === '시공팀' || raw === '시공사팀';
        });

        const rows = siteConstructionTeams.length > 0 ? siteConstructionTeams : constructionCompanyTeams;
        setTeams(rows);
      } catch (error) {
        console.error(error);
        toast.error('팀 목록 로드 실패');
      }
    };
    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  // Set default selected team when teams are loaded
  useEffect(() => {
    if (teams.length > 0) {
      const currentExists = teams.some((t) => String(t.id ?? '') === String(selectedTeamId));
      if (!currentExists) {
        setSelectedTeamId(String(teams[0].id ?? ''));
      }
    }
  }, [teams, selectedTeamId]);

  useEffect(() => {
    let cancelled = false;
    const loadDetails = async () => {
      if (!doc) {
        setDetailRows([]);
        return;
      }
      try {
        const range = buildMonthRange(yearMonth);
        const rows = await dailyReportService.getReportWorkerRowsByRange({
          startDate: range.startDate,
          endDate: range.endDate
        });
        if (cancelled) return;
        setDetailRows(rows);
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setDetailRows([]);
      }
    };

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [doc, yearMonth]);

  useEffect(() => {
    let cancelled = false;

    const parseYearMonth = (value: string): { year: number; month: number } => {
      const [y, m] = String(value).split('-');
      const year = Number(y);
      const month = Number(m);
      return {
        year: Number.isFinite(year) ? year : new Date().getFullYear(),
        month: Number.isFinite(month) ? month : new Date().getMonth() + 1
      };
    };

    const loadLaborExchange = async () => {
      if (!selectedTeamId) {
        setLaborExchangeSummary(null);
        return;
      }

      try {
        const { year, month } = parseYearMonth(yearMonth);
        const snapshotInfo = await laborExchangeService.getMonthSnapshotInfo(year, month);
        const reports = await laborExchangeService.getExchangeReport(year, month, selectedTeamId, {
          preferSnapshot: Boolean(snapshotInfo?.confirmedAt)
        });
        if (cancelled) return;
        setLaborExchangeSummary(reports.length > 0 ? reports[0] : null);
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setLaborExchangeSummary(null);
      }
    };

    void loadLaborExchange();
    return () => {
      cancelled = true;
    };
  }, [selectedTeamId, yearMonth]);

  useEffect(() => {
    let cancelled = false;

    const loadDeductionSources = async () => {
      if (!selectedTeamId || !yearMonth) {
        setDeductionSourceData(createEmptyDeductionSourceData());
        return;
      }

      try {
        const [
          accommodationDocs,
          accommodationAssignments,
          utilityRecords,
          vehicleDocs,
          vehicles,
          vehicleExpenses,
          cardDocs,
          cards,
          cardTransactions,
          workers
        ] = await Promise.all([
          accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth }),
          accommodationAssignmentService.getAllAssignments(),
          accommodationService.getMonthlyLedger(yearMonth),
          vehicleBillingService.getBillingsByMonth(yearMonth),
          vehicleService.getVehicles(),
          vehicleService.getExpensesByMonth(yearMonth),
          cardBillingService.getBillingsByMonth(yearMonth),
          cardService.getCards(),
          cardService.getTransactionsByMonth(yearMonth),
          manpowerService.getWorkers()
        ]);

        if (cancelled) return;
        setDeductionSourceData({
          accommodationDocs,
          accommodationAssignments,
          utilityRecords,
          vehicleDocs,
          vehicles,
          vehicleExpenses,
          cardDocs,
          cards,
          cardTransactions,
          workers
        });
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setDeductionSourceData(createEmptyDeductionSourceData());
      }
    };

    void loadDeductionSources();
    return () => {
      cancelled = true;
    };
  }, [selectedTeamId, yearMonth]);

  const loadSettlement = useCallback(async () => {
    if (!selectedTeamId || !yearMonth) return;

    setLoadState({ status: 'loading' });
    try {
      const loaded = await teamSettlementService.getTeamSettlement({ yearMonth, teamId: selectedTeamId });
      setDoc(stripSupportOriginalLines(loaded));
      setLoadState({ status: 'idle' });
    } catch (error) {
      console.error(error);
      setLoadState({ status: 'error', message: '팀정산 데이터를 불러오지 못했습니다.' });
    }
  }, [selectedTeamId, yearMonth]);

  useEffect(() => {
    void loadSettlement();
  }, [loadSettlement]);

  const selectedTeamName = useMemo(() => {
    const t = teams.find((x) => String(x.id ?? '') === String(selectedTeamId));
    return t?.name ?? '';
  }, [selectedTeamId, teams]);

  const teamIdVariants = useMemo(() => {
    const variants = new Set<string>();
    if (selectedTeamId) variants.add(String(selectedTeamId));
    const matched = teams.find((x) => String(x.id ?? '') === String(selectedTeamId));
    if (matched?.id) variants.add(String(matched.id));
    if (matched?.legacyId) variants.add(String(matched.legacyId));
    return variants;
  }, [selectedTeamId, teams]);

  const matchesTeam = useCallback(
    (value: unknown): boolean => {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (!trimmed) return false;
      return teamIdVariants.has(trimmed);
    },
    [teamIdVariants]
  );

  const teamNameVariants = useMemo(() => {
    const variants = new Set<string>();
    const matched = teams.find((x) => String(x.id ?? '') === String(selectedTeamId));
    if (matched?.name) variants.add(String(matched.name).trim());
    if (selectedTeamName) variants.add(String(selectedTeamName).trim());
    return variants;
  }, [selectedTeamId, selectedTeamName, teams]);

  const matchesTeamByIdOrName = useCallback(
    (id: unknown, name: unknown): boolean => {
      const idText = typeof id === 'string' ? id.trim() : '';
      if (idText && matchesTeam(idText)) return true;

      const nameText = typeof name === 'string' ? name.trim() : '';
      if (nameText && teamNameVariants.has(nameText)) return true;

      return false;
    },
    [matchesTeam, teamNameVariants]
  );

  const totals = useMemo(() => {
    const salesTotal = (doc?.sales ?? []).reduce((sum, x) => sum + safeNumber(x.amount), 0);
    const purchasesTotal = (doc?.purchases ?? []).reduce((sum, x) => sum + safeNumber(x.amount), 0);
    const deductionsTotal = (doc?.deductions ?? []).reduce((sum, x) => sum + safeNumber(x.amount), 0);
    const additionsTotal = (doc?.additions ?? []).reduce((sum, x) => sum + safeNumber(x.amount), 0);
    const prevCarryover = safeNumber(doc?.summary?.prevCarryover ?? 0);
    const deposit = safeNumber(doc?.summary?.deposit ?? 0);

    const net = salesTotal - purchasesTotal - deductionsTotal + additionsTotal + prevCarryover + deposit;

    return { salesTotal, purchasesTotal, deductionsTotal, additionsTotal, prevCarryover, deposit, net };
  }, [doc]);

  const dashboardMetrics = useMemo(() => {
    const salesSupportManDay = (doc?.sales ?? [])
      .filter((x) => x.source === 'auto' && x.origin === 'support_fee_outgoing')
      .reduce((sum, x) => sum + safeNumber(x.manDay), 0);

    const salesSupportFeeTotal = (doc?.sales ?? [])
      .filter((x) => x.source === 'auto' && x.origin === 'support_fee_outgoing')
      .reduce((sum, x) => sum + safeNumber(x.amount), 0);

    const purchasesSupportManDay = (doc?.purchases ?? [])
      .filter((x) => x.source === 'auto' && x.origin === 'support_fee_incoming')
      .reduce((sum, x) => sum + safeNumber(x.manDay), 0);

    const purchasesSupportFeeTotal = (doc?.purchases ?? [])
      .filter((x) => x.source === 'auto' && x.origin === 'support_fee_incoming')
      .reduce((sum, x) => sum + safeNumber(x.amount), 0);

    const contractSalesTotal = (doc?.sales ?? [])
      .filter((x) => x.kind === '도급')
      .reduce((sum, x) => sum + safeNumber(x.amount), 0);

    return {
      salesSupportManDay,
      salesSupportFeeTotal,
      purchasesSupportManDay,
      purchasesSupportFeeTotal,
      contractSalesTotal
    };
  }, [doc]);

  const siteSkkumiRows = useMemo<SiteSkkumiRow[]>(() => {
    if (!doc) return [];

    const bySite = new Map<string, SiteSkkumiRow>();
    doc.sales
      .filter((s) => s.source === 'auto' && s.origin === 'daily_report' && (s.kind === '도급' || s.kind === '직영'))
      .forEach((s) => {
        const siteName = String(s.siteName ?? '').trim() || '현장 미지정';
        const prev = bySite.get(siteName) ?? { siteName, quantity: 0, manDay: 0, amount: 0 };
        const nextQuantity = s.kind === '도급' ? safeNumber(s.quantity ?? 0) : 0;
        bySite.set(siteName, {
          siteName,
          quantity: prev.quantity + nextQuantity,
          manDay: prev.manDay + safeNumber(s.manDay),
          amount: prev.amount + safeNumber(s.amount)
        });
      });

    return Array.from(bySite.values()).sort((a, b) => b.amount - a.amount);
  }, [doc]);

  const avgUnitPrice = useMemo(() => {
    const payrollAmountTotal = (doc?.deductions ?? [])
      .filter((d) => d.origin === 'daily_wage_payroll' || d.origin === 'monthly_wage_payroll')
      .reduce((sum, d) => sum + safeNumber(d.amount), 0);

    const getWorkerTeamId = (r: DailyReportWorkerRow): string => {
      const v = r.workerTeamId ?? r.teamId ?? '';
      return String(v ?? '').trim();
    };

    const normalizeSalaryModel = (r: DailyReportWorkerRow): string => {
      const raw = typeof r.salaryModel === 'string' ? r.salaryModel : (typeof r.payType === 'string' ? r.payType : '');
      const trimmed = String(raw ?? '').trim();
      return trimmed || '일급제';
    };

    const payrollManDayTotal = detailRows
      .filter((r) => {
        const workerTeamId = getWorkerTeamId(r);
        if (!workerTeamId || !matchesTeam(workerTeamId)) return false;
        const model = normalizeSalaryModel(r);
        return model === '일급제' || model === '월급제';
      })
      .reduce((sum, r) => sum + safeNumber(r.manDay), 0);

    const siteTotalAmount = siteSkkumiRows.reduce((sum, r) => sum + safeNumber(r.amount), 0);
    const siteTotalManDay = siteSkkumiRows.reduce((sum, r) => sum + safeNumber(r.manDay), 0);

    const teamAvgPerManDay = safeAverage(payrollAmountTotal, payrollManDayTotal);
    const siteAvgPerManDay = safeAverage(siteTotalAmount, siteTotalManDay);

    return { teamAvgPerManDay, siteAvgPerManDay };
  }, [detailRows, doc, matchesTeam, siteSkkumiRows]);

  const updateDoc = useCallback((updater: (prev: TeamSettlementDocument) => TeamSettlementDocument) => {
    setDoc((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
  }, []);

  const handleAddManualSale = useCallback(() => {
    updateDoc((prev) => {
      const item: TeamSettlementSalesItem = {
        id: buildLocalId('sale_manual'),
        source: 'manual',
        origin: 'manual',
        kind: '직영',
        siteName: '수기',
        manDay: 0,
        amount: 0
      };
      return { ...prev, sales: [...prev.sales, item] };
    });
  }, [updateDoc]);

  const handleAddManualPurchase = useCallback(() => {
    updateDoc((prev) => {
      const item: TeamSettlementPurchaseItem = {
        id: buildLocalId('purchase_manual'),
        source: 'manual',
        origin: 'manual',
        kind: '지원',
        siteName: '수기',
        manDay: 0,
        amount: 0
      };
      return { ...prev, purchases: [...prev.purchases, item] };
    });
  }, [updateDoc]);

  const handleAddManualDeduction = useCallback(() => {
    updateDoc((prev) => {
      const item: TeamSettlementDeductionItem = {
        id: buildLocalId('deduction_manual'),
        source: 'manual',
        origin: 'manual',
        category: '수기',
        amount: 0
      };
      return { ...prev, deductions: [...prev.deductions, item] };
    });
  }, [updateDoc]);

  const handleAddManualAddition = useCallback(() => {
    updateDoc((prev) => {
      const item: TeamSettlementAdditionItem = {
        id: buildLocalId('addition_manual'),
        source: 'manual',
        origin: 'manual',
        category: '수기',
        amount: 0
      };
      const additions = prev.additions ?? [];
      return { ...prev, additions: [...additions, item] };
    });
  }, [updateDoc]);

  const handleSave = useCallback(async () => {
    if (!doc) return;

    try {
      await teamSettlementService.saveTeamSettlement({
        ...doc,
        teamName: doc.teamName || selectedTeamName,
        updatedAt: new Date().toISOString()
      });
      toast.success('저장 완료');
      await loadSettlement();
    } catch (error) {
      console.error(error);
      toast.error('저장 실패');
    }
  }, [doc, loadSettlement, selectedTeamName]);

  const handleRecalculate = useCallback(async () => {
    if (!selectedTeamId || !yearMonth) return;

    const isConfirmed = Boolean(doc?.confirmedAt);

    if (isConfirmed) {
      const result = await Swal.fire({
        title: '강제 재집계',
        text: '확정된 팀정산입니다. 최신 자동집계(지원비 포함)로 다시 계산하여 저장할까요?',
        icon: 'warning',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '확정 유지하고 재집계',
        denyButtonText: '확정 해제하고 재집계',
        cancelButtonText: '취소'
      });

      if (result.isConfirmed) {
        await teamSettlementService.recalculateAndSaveTeamSettlement({ yearMonth, teamId: selectedTeamId, keepConfirmed: true });
        toast.success('재집계 완료 (확정 유지)');
        await loadSettlement();
        return;
      }

      if (result.isDenied) {
        await teamSettlementService.recalculateAndSaveTeamSettlement({ yearMonth, teamId: selectedTeamId, keepConfirmed: false });
        toast.success('재집계 완료 (확정 해제)');
        await loadSettlement();
        return;
      }

      return;
    }

    try {
      await teamSettlementService.recalculateAndSaveTeamSettlement({ yearMonth, teamId: selectedTeamId, keepConfirmed: false });
      toast.success('재집계 완료');
      await loadSettlement();
    } catch (error) {
      console.error(error);
      toast.error('재집계 실패');
    }
  }, [doc?.confirmedAt, loadSettlement, selectedTeamId, yearMonth]);

  const handleConfirm = useCallback(async () => {
    if (!doc) return;

    const result = await Swal.fire({
      title: '팀정산 확정',
      text: '확정 후에는 자동집계/수기 수정이 잠깁니다. 확정하시겠습니까?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '확정',
      cancelButtonText: '취소'
    });

    if (!result.isConfirmed) return;

    try {
      await teamSettlementService.confirmTeamSettlement({ yearMonth: doc.yearMonth, teamId: doc.teamId });

      // Sync Office Fee to Office Management
      await officeService.syncTeamFeeFromSettlement({
        ...doc,
        teamName: doc.teamName || selectedTeamName
      });

      toast.success('확정 완료');
      await loadSettlement();
    } catch (error) {
      console.error(error);
      toast.error('확정 실패');
    }
  }, [doc, loadSettlement]);

  const handleUnconfirm = useCallback(async () => {
    if (!doc) return;

    const result = await Swal.fire({
      title: '확정 취소',
      text: '확정된 팀정산을 취소하시겠습니까? 취소 후에는 다시 편집할 수 있습니다.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '확정 취소',
      cancelButtonText: '닫기'
    });

    if (!result.isConfirmed) return;

    try {
      await teamSettlementService.unconfirmTeamSettlement({ yearMonth: doc.yearMonth, teamId: doc.teamId });

      // Remove Office Fee from Office Management
      await officeService.deleteTeamFeeTransaction(doc.teamId, doc.yearMonth);

      toast.success('확정 취소 완료');
      await loadSettlement();
    } catch (error) {
      console.error(error);
      toast.error('확정 취소 실패');
    }
  }, [doc, loadSettlement]);

  const confirmedAtLabel = useMemo(() => {
    if (!doc?.confirmedAt) return '';
    const d = new Date(doc.confirmedAt);
    if (Number.isNaN(d.getTime())) return doc.confirmedAt;
    return d.toLocaleString('ko-KR');
  }, [doc?.confirmedAt]);

  const canEdit = isEditable(doc);

  const primaryButtonClassName =
    'inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed';
  const secondaryButtonClassName =
    'inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold border bg-white text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed';
  const ghostButtonClassName =
    'inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed';
  const addButtonClassName =
    'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed';

  const toggleLineExpanded = useCallback((id: string) => {
    setExpandedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSiteExpanded = useCallback((key: string) => {
    setExpandedSiteKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleDeductionExpanded = useCallback((id: string) => {
    setExpandedDeductionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const unifiedLines = useMemo<SettlementUnifiedLine[]>(() => {
    if (!doc) return [];

    const shouldHideSupportOriginal = (origin: SettlementUnifiedOrigin): boolean => {
      return origin === 'support_outgoing' || origin === 'support_incoming';
    };

    const sales: SettlementUnifiedLine[] = doc.sales
      .filter((s) => !shouldHideSupportOriginal(s.origin))
      .map((s) => ({
        id: s.id,
        direction: 'sales',
        source: s.source,
        origin: s.origin,
        originLabel: formatSalesOrigin(s.origin),
        kind: s.kind,
        siteId: s.siteId,
        siteName: s.siteName,
        counterTeamId: s.counterTeamId,
        counterTeamName: s.counterTeamName,
        manDay: safeNumber(s.manDay),
        quantity: typeof s.quantity === 'number' ? s.quantity : undefined,
        amount: safeNumber(s.amount),
        memo: s.memo
      }));

    const purchases: SettlementUnifiedLine[] = doc.purchases
      .filter((p) => !shouldHideSupportOriginal(p.origin))
      .map((p) => ({
        id: p.id,
        direction: 'purchase',
        source: p.source,
        origin: p.origin,
        originLabel: formatPurchaseOrigin(p.origin),
        kind: p.kind,
        siteId: p.siteId,
        siteName: p.siteName,
        counterTeamId: p.counterTeamId,
        counterTeamName: p.counterTeamName,
        manDay: safeNumber(p.manDay),
        amount: safeNumber(p.amount),
        memo: p.memo
      }));

    const lines = [...sales, ...purchases];
    lines.sort((a, b) => {
      const s = a.siteName.localeCompare(b.siteName, 'ko');
      if (s !== 0) return s;
      if (a.direction !== b.direction) return a.direction === 'sales' ? -1 : 1;
      return a.kind.localeCompare(b.kind, 'ko');
    });
    return lines;
  }, [doc]);

  const getDeductionDetail = useCallback(
    (item: TeamSettlementDeductionItem):
      | { kind: 'office_expense'; sites: SiteSkkumiRow[]; totalManDay: number; totalAmount: number }
      | { kind: 'payroll'; rows: Array<{ workerId: string; workerName: string; manDay: number; amount: number }>; totalManDay: number; totalAmount: number }
      | {
        kind: 'accommodation_billing';
        mode: 'document' | 'ledger';
        rows: Array<{
          subject: string;
          label: string;
          amount: number;
          teamDays?: number;
          totalDays?: number;
        }>;
        totalAmount: number;
      }
      | {
        kind: 'vehicle_billing';
        mode: 'document' | 'ledger';
        rows: Array<{ subject: string; label: string; amount: number; date?: string; note?: string }>;
        totalAmount: number;
      }
      | {
        kind: 'card_billing';
        mode: 'document' | 'ledger';
        rows: Array<{ subject: string; label: string; amount: number; date?: string; note?: string }>;
        totalAmount: number;
      }
      | null => {
      if (!doc) return null;

      const deductionCategory = String(item.category ?? '').trim();
      const itemIdText = String(item.id ?? '');
      const extractBracketValue = (value: string, prefix: string): string => {
        const regex = new RegExp(`^${prefix}\\s*\\((.+)\\)$`);
        const matched = regex.exec(String(value ?? '').trim());
        return matched ? matched[1].trim() : '';
      };

      if (item.origin === 'office_expense') {
        const bySite = new Map<string, SiteSkkumiRow>();
        doc.sales
          .filter((s) => s.source === 'auto' && s.origin === 'daily_report' && (s.kind === '도급' || s.kind === '직영'))
          .forEach((s) => {
            const siteName = String(s.siteName ?? '').trim() || '현장 미지정';
            const prev = bySite.get(siteName) ?? { siteName, quantity: 0, manDay: 0, amount: 0 };
            bySite.set(siteName, {
              siteName,
              quantity: prev.quantity,
              manDay: prev.manDay + safeNumber(s.manDay),
              amount: prev.amount + safeNumber(s.amount)
            });
          });

        const sites = Array.from(bySite.values()).sort((a, b) => b.manDay - a.manDay);
        const totalManDay = sites.reduce((sum, x) => sum + x.manDay, 0);
        const totalAmount = sites.reduce((sum, x) => sum + x.amount, 0);
        return { kind: 'office_expense', sites, totalManDay, totalAmount };
      }

      if (item.origin === 'daily_wage_payroll' || item.origin === 'monthly_wage_payroll') {
        const salaryModel = item.origin === 'daily_wage_payroll' ? '일급제' : '월급제';

        const getWorkerTeamId = (r: DailyReportWorkerRow): string => {
          const v = r.workerTeamId ?? r.teamId ?? '';
          return String(v ?? '').trim();
        };

        const normalizeSalaryModel = (r: DailyReportWorkerRow): string => {
          const raw = typeof r.salaryModel === 'string' ? r.salaryModel : (typeof r.payType === 'string' ? r.payType : '');
          const trimmed = String(raw ?? '').trim();
          return trimmed || '일급제';
        };

        const grouped = new Map<string, { workerId: string; workerName: string; manDay: number; amount: number }>();

        detailRows
          .filter((r) => {
            const workerTeamId = getWorkerTeamId(r);
            if (!workerTeamId || !matchesTeam(workerTeamId)) return false;
            return normalizeSalaryModel(r) === salaryModel;
          })
          .forEach((r) => {
            const workerId = String(r.workerId ?? '').trim();
            if (!workerId) return;
            const prev = grouped.get(workerId) ?? { workerId, workerName: r.workerName, manDay: 0, amount: 0 };
            grouped.set(workerId, {
              workerId,
              workerName: prev.workerName || r.workerName,
              manDay: prev.manDay + safeNumber(r.manDay),
              amount: prev.amount + safeNumber(r.amount)
            });
          });

        const rows = Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
        const totalManDay = rows.reduce((sum, x) => sum + x.manDay, 0);
        const totalAmount = rows.reduce((sum, x) => sum + x.amount, 0);
        return { kind: 'payroll', rows, totalManDay, totalAmount };
      }

      if (item.origin === 'accommodation_billing') {
        const selectedDocs = selectPreferredTeamBillings(
          deductionSourceData.accommodationDocs.filter((row) =>
            isTeamBillingTarget({
              issuedToType: row.issuedToType,
              teamId: row.teamId,
              teamName: row.teamName,
              issuedToWorkerId: row.issuedToWorkerId,
              issuedToWorkerName: row.issuedToWorkerName
            }) && matchesTeamByIdOrName(row.teamId, row.teamName)
          )
        );

        const itemIdParts = itemIdText.split(':');
        const rawKey = itemIdParts.length >= 3 ? itemIdParts.slice(2).join(':') : '';
        const isLedgerItem = rawKey.startsWith('ledger:');
        const targetDocId = !isLedgerItem && rawKey ? rawKey : '';

        const docRows = selectedDocs
          .filter((billing) => {
            if (isLedgerItem) return false;
            if (!targetDocId) return true;
            return String(billing.id ?? '') === targetDocId;
          })
          .flatMap((billing) => {
            const billedTo = billing.teamName ? String(billing.teamName) : selectedTeamName || '팀';
            return (billing.lineItems ?? []).map((li) => ({
              subject: billedTo,
              label: String(li.label ?? '').trim() || mapAccommodationTargetFieldLabel(String(li.targetField ?? '')),
              amount: safeNumber(li.amount)
            }));
          })
          .filter((row) => row.amount > 0);

        if (docRows.length > 0) {
          const totalAmount = docRows.reduce((sum, row) => sum + row.amount, 0);
          return { kind: 'accommodation_billing', mode: 'document', rows: docRows, totalAmount };
        }

        const range = buildMonthRange(yearMonth);
        const monthStart = parseYmdDate(range.startDate);
        const monthEnd = parseYmdDate(range.endDate);
        if (!monthStart || !monthEnd) return { kind: 'accommodation_billing', mode: 'ledger', rows: [], totalAmount: 0 };

        const targetAccommodationId = isLedgerItem ? rawKey.replace(/^ledger:/, '').trim() : '';

        const teamDaysByAccommodation = new Map<string, number>();
        const totalDaysByAccommodation = new Map<string, number>();
        const workerTeamByAnyId = new Map<string, { teamId?: string; teamName?: string }>();
        const workerTeamByName = new Map<string, { teamId?: string; teamName?: string }>();
        deductionSourceData.workers.forEach((w) => {
          const info = { teamId: w.teamId, teamName: w.teamName };
          const id = String(w.id ?? '').trim();
          const legacyId = String(w.legacyId ?? '').trim();
          const name = String(w.name ?? '').trim();
          if (id) workerTeamByAnyId.set(id, info);
          if (legacyId) workerTeamByAnyId.set(legacyId, info);
          if (name) workerTeamByName.set(name, info);
        });

        deductionSourceData.accommodationAssignments.forEach((assignment) => {

          const accommodationId = String(assignment.accommodationId ?? '').trim();
          if (!accommodationId) return;

          const startDate = parseYmdDate(String(assignment.startDate ?? '').trim());
          if (!startDate) return;
          const endDate = assignment.endDate ? parseYmdDate(String(assignment.endDate).trim()) : null;
          const overlapDays = calculateOverlapDays({ monthStart, monthEnd, startDate, endDate });
          if (overlapDays <= 0) return;

          totalDaysByAccommodation.set(accommodationId, (totalDaysByAccommodation.get(accommodationId) ?? 0) + overlapDays);

          let teamMatched = matchesTeamByIdOrName(assignment.teamId, assignment.teamName);
          if (!teamMatched) {
            const workerId = String(assignment.workerId ?? '').trim();
            const workerName = String(assignment.workerName ?? '').trim();
            const workerTeam =
              (workerId ? workerTeamByAnyId.get(workerId) : undefined) ??
              (workerName ? workerTeamByName.get(workerName) : undefined);
            if (workerTeam) {
              teamMatched = matchesTeamByIdOrName(workerTeam.teamId, workerTeam.teamName);
            }
          }

          if (teamMatched) {
            teamDaysByAccommodation.set(accommodationId, (teamDaysByAccommodation.get(accommodationId) ?? 0) + overlapDays);
          }
        });

        const ledgerRows = deductionSourceData.utilityRecords
          .map((record) => {
            const accommodationId = String(record.accommodationId ?? '').trim();
            if (!accommodationId) return [] as Array<{ subject: string; label: string; amount: number; teamDays: number; totalDays: number }>;
            if (targetAccommodationId && accommodationId !== targetAccommodationId) return [] as Array<{ subject: string; label: string; amount: number; teamDays: number; totalDays: number }>;

            const teamDays = teamDaysByAccommodation.get(accommodationId) ?? 0;
            const totalDays = totalDaysByAccommodation.get(accommodationId) ?? 0;
            if (teamDays <= 0 || totalDays <= 0) return [] as Array<{ subject: string; label: string; amount: number; teamDays: number; totalDays: number }>;

            const ratio = teamDays / totalDays;
            const subject = String(record.accommodationName ?? '').trim() || accommodationId;

            const rows = [
              { label: '월세', amount: Math.round(safeNumber(record.costs?.rent) * ratio) },
              { label: '전기', amount: Math.round(safeNumber(record.costs?.electricity) * ratio) },
              { label: '가스', amount: Math.round(safeNumber(record.costs?.gas) * ratio) },
              { label: '수도', amount: Math.round(safeNumber(record.costs?.water) * ratio) },
              { label: '인터넷', amount: Math.round(safeNumber(record.costs?.internet) * ratio) },
              { label: '관리비', amount: Math.round(safeNumber(record.costs?.maintenance) * ratio) },
              { label: '기타', amount: Math.round(safeNumber(record.costs?.other) * ratio) }
            ]
              .filter((row) => row.amount > 0)
              .map((row) => ({
                subject,
                label: row.label,
                amount: row.amount,
                teamDays,
                totalDays
              }));

            return rows;
          })
          .flat()
          .sort((a, b) => b.amount - a.amount);

        const totalAmount = ledgerRows.reduce((sum, row) => sum + row.amount, 0);
        return { kind: 'accommodation_billing', mode: 'ledger', rows: ledgerRows, totalAmount };
      }

      if (item.origin === 'vehicle_billing') {
        const selectedDocs = selectPreferredTeamBillings(
          deductionSourceData.vehicleDocs.filter((row) =>
            isTeamBillingTarget({
              issuedToType: row.issuedToType,
              teamId: row.teamId ?? row.assignedTeamId,
              teamName: row.teamName ?? row.assignedTeamName,
              issuedToWorkerId: row.issuedToWorkerId,
              issuedToWorkerName: row.issuedToWorkerName
            }) &&
            matchesTeamByIdOrName(row.teamId ?? row.assignedTeamId, row.teamName ?? row.assignedTeamName)
          )
        );
        const isLedgerVehicleItem = itemIdText.endsWith(':ledger');
        const targetPlate = extractBracketValue(deductionCategory, '차량비');

        const matchedDocs = selectedDocs.filter((row) => {
          if (isLedgerVehicleItem) return false;
          const plate = String(row.vehiclePlate ?? '').trim();
          const id = String(row.vehicleId ?? '').trim();
          if (targetPlate && plate === targetPlate) return true;
          if (id && itemIdText.includes(id)) return true;
          if (plate && itemIdText.includes(plate)) return true;
          return false;
        });

        const docRows = matchedDocs
          .flatMap((billing) => {
            const plate = String(billing.vehiclePlate ?? '').trim() || String(billing.vehicleId ?? '').trim();
            if ((billing.lineItems ?? []).length === 0) {
              return [
                { subject: plate, label: '고정비', amount: safeNumber(billing.fixedCost), note: 'FIXED' },
                { subject: plate, label: '변동비', amount: safeNumber(billing.variableCost), note: 'VARIABLE' }
              ];
            }
            return (billing.lineItems ?? []).map((li) => ({
              subject: plate,
              label: String(li.label ?? '').trim() || '차량비',
              amount: safeNumber(li.amount),
              note: String(li.category ?? li.type ?? '').trim() || undefined
            }));
          })
          .filter((row) => row.amount > 0);

        if (docRows.length > 0) {
          const totalAmount = docRows.reduce((sum, row) => sum + row.amount, 0);
          return { kind: 'vehicle_billing', mode: 'document', rows: docRows, totalAmount };
        }

        const workerTeamByAnyId = new Map<string, { teamId?: string; teamName?: string }>();
        const workerTeamByName = new Map<string, { teamId?: string; teamName?: string }>();
        deductionSourceData.workers.forEach((w) => {
          const info = { teamId: w.teamId, teamName: w.teamName };
          const id = String(w.id ?? '').trim();
          const legacyId = String(w.legacyId ?? '').trim();
          const name = String(w.name ?? '').trim();
          if (id) workerTeamByAnyId.set(id, info);
          if (legacyId) workerTeamByAnyId.set(legacyId, info);
          if (name) workerTeamByName.set(name, info);
        });

        const expenseByVehicleId = new Map<string, VehicleExpenseRecord[]>();
        deductionSourceData.vehicleExpenses.forEach((expense) => {
          const vehicleId = String(expense.vehicleId ?? '').trim();
          if (!vehicleId) return;
          const list = expenseByVehicleId.get(vehicleId) ?? [];
          list.push(expense);
          expenseByVehicleId.set(vehicleId, list);
        });

        const ledgerRows = deductionSourceData.vehicles
          .flatMap((vehicle) => {
            const plate = String(vehicle.licensePlate ?? '').trim();
            const vehicleId = String(vehicle.id ?? '').trim();
            if (targetPlate && plate !== targetPlate) return [];
            if (!targetPlate && vehicleId && !itemIdText.includes(vehicleId) && plate && !itemIdText.includes(plate)) return [];

            let isAssignedTeam = false;
            if (vehicle.currentAssigneeType === 'TEAM') {
              isAssignedTeam = matchesTeamByIdOrName(vehicle.currentAssigneeId, vehicle.currentAssigneeName);
            } else if (vehicle.currentAssigneeType === 'WORKER') {
              const workerId = String(vehicle.currentAssigneeId ?? '').trim();
              const workerName = String(vehicle.currentAssigneeName ?? '').trim();
              const info = (workerId ? workerTeamByAnyId.get(workerId) : undefined) ?? (workerName ? workerTeamByName.get(workerName) : undefined);
              isAssignedTeam = info ? matchesTeamByIdOrName(info.teamId, info.teamName) : false;
            }

            if (!isAssignedTeam) return [];

            const rows: Array<{ subject: string; label: string; amount: number; date?: string; note?: string }> = [];
            const fixedCost =
              vehicle.type === 'RENT' || vehicle.type === 'LEASE'
                ? safeNumber(vehicle.contract?.monthlyFee)
                : 0;
            if (fixedCost > 0) {
              rows.push({
                subject: plate || vehicleId,
                label: '월 고정비',
                amount: fixedCost,
                note: 'FIXED'
              });
            }

            const expenses = [...(expenseByVehicleId.get(vehicleId) ?? [])].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
            expenses.forEach((expense) => {
              rows.push({
                subject: plate || vehicleId,
                label: String(expense.type ?? '').trim() || '변동비',
                amount: safeNumber(expense.amount),
                date: String(expense.date ?? '').trim() || undefined,
                note: 'VARIABLE'
              });
            });
            return rows;
          })
          .filter((row) => row.amount > 0);

        const totalAmount = ledgerRows.reduce((sum, row) => sum + row.amount, 0);
        return { kind: 'vehicle_billing', mode: 'ledger', rows: ledgerRows, totalAmount };
      }

      if (item.origin === 'card_billing') {
        const selectedDocs = selectPreferredTeamBillings(
          deductionSourceData.cardDocs.filter((row) =>
            isTeamBillingTarget({
              issuedToType: row.issuedToType,
              teamId: row.teamId ?? row.assignedTeamId,
              teamName: row.teamName ?? row.assignedTeamName,
              issuedToWorkerId: row.issuedToWorkerId,
              issuedToWorkerName: row.issuedToWorkerName
            }) &&
            matchesTeamByIdOrName(row.teamId ?? row.assignedTeamId, row.teamName ?? row.assignedTeamName)
          )
        );
        const isLedgerCardItem = itemIdText.endsWith(':ledger');
        const targetCardLabel = extractBracketValue(deductionCategory, '카드비');

        const matchedDocs = selectedDocs.filter((row) => {
          if (isLedgerCardItem) return false;
          const cardId = String(row.cardId ?? '').trim();
          const cardLabel = String(row.cardLabel ?? '').trim();
          if (targetCardLabel && cardLabel === targetCardLabel) return true;
          if (cardId && itemIdText.includes(cardId)) return true;
          if (cardLabel && itemIdText.includes(cardLabel)) return true;
          return false;
        });

        const docRows = matchedDocs
          .flatMap((billing) => {
            const label = String(billing.cardLabel ?? '').trim() || String(billing.cardId ?? '').trim();
            return (billing.lineItems ?? []).map((li) => ({
              subject: label,
              label: String(li.label ?? '').trim() || '카드비',
              amount: safeNumber(li.amount),
              note: String(li.category ?? '').trim() || undefined
            }));
          })
          .filter((row) => row.amount > 0);

        if (docRows.length > 0) {
          const totalAmount = docRows.reduce((sum, row) => sum + row.amount, 0);
          return { kind: 'card_billing', mode: 'document', rows: docRows, totalAmount };
        }

        const workerTeamByAnyId = new Map<string, { teamId?: string; teamName?: string }>();
        const workerTeamByName = new Map<string, { teamId?: string; teamName?: string }>();
        deductionSourceData.workers.forEach((w) => {
          const info = { teamId: w.teamId, teamName: w.teamName };
          const id = String(w.id ?? '').trim();
          const legacyId = String(w.legacyId ?? '').trim();
          const name = String(w.name ?? '').trim();
          if (id) workerTeamByAnyId.set(id, info);
          if (legacyId) workerTeamByAnyId.set(legacyId, info);
          if (name) workerTeamByName.set(name, info);
        });

        const txByCardId = new Map<string, CardTransaction[]>();
        deductionSourceData.cardTransactions.forEach((tx) => {
          const cardId = String(tx.cardId ?? '').trim();
          if (!cardId) return;
          const list = txByCardId.get(cardId) ?? [];
          list.push(tx);
          txByCardId.set(cardId, list);
        });

        const ledgerRows = deductionSourceData.cards
          .flatMap((card) => {
            const cardId = String(card.id ?? '').trim();
            const cardLabel = `${String(card.name ?? '').trim()} (${String(card.last4 ?? '').trim()})`.trim();

            if (targetCardLabel && cardLabel !== targetCardLabel) return [];
            if (!targetCardLabel && cardId && !itemIdText.includes(cardId) && cardLabel && !itemIdText.includes(cardLabel)) return [];

            let isAssignedTeam = false;
            if (card.currentAssigneeType === 'TEAM') {
              isAssignedTeam = matchesTeamByIdOrName(card.currentAssigneeId, card.currentAssigneeName);
            } else if (card.currentAssigneeType === 'WORKER') {
              const workerId = String(card.currentAssigneeId ?? '').trim();
              const workerName = String(card.currentAssigneeName ?? '').trim();
              const info = (workerId ? workerTeamByAnyId.get(workerId) : undefined) ?? (workerName ? workerTeamByName.get(workerName) : undefined);
              isAssignedTeam = info ? matchesTeamByIdOrName(info.teamId, info.teamName) : false;
            }
            if (!isAssignedTeam) return [];

            const txs = [...(txByCardId.get(cardId) ?? [])].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
            return txs.map((tx) => ({
              subject: cardLabel,
              label: String(tx.merchant ?? '').trim() || '카드 사용',
              amount: safeNumber(tx.amount),
              date: String(tx.date ?? '').trim() || undefined,
              note: String(tx.category ?? '').trim() || undefined
            }));
          })
          .filter((row) => row.amount > 0);

        const totalAmount = ledgerRows.reduce((sum, row) => sum + row.amount, 0);
        return { kind: 'card_billing', mode: 'ledger', rows: ledgerRows, totalAmount };
      }

      return null;
    },
    [deductionSourceData, detailRows, doc, matchesTeam, matchesTeamByIdOrName, selectedTeamName, yearMonth]
  );

  const getLineDetailRows = useCallback(
    (line: SettlementUnifiedLine): LineDetailRow[] => {
      if (line.source !== 'auto') return [];

      const isSupportOrigin =
        line.origin === 'support_outgoing' ||
        line.origin === 'support_incoming' ||
        line.origin === 'support_fee_outgoing' ||
        line.origin === 'support_fee_incoming';

      const matchesSiteByIdOrName = (args: { lineSiteId?: string; lineSiteName: string; rowSiteId?: string; rowSiteName?: string }): boolean => {
        const lineSiteId = args.lineSiteId ? String(args.lineSiteId).trim() : '';
        const rowSiteId = args.rowSiteId ? String(args.rowSiteId).trim() : '';
        const lineSiteName = String(args.lineSiteName ?? '').trim();
        if (!lineSiteId && !lineSiteName) return true;
        if (lineSiteId && rowSiteId && lineSiteId === rowSiteId) return true;
        const rowSiteName = String(args.rowSiteName ?? '').trim();
        if (lineSiteName && rowSiteName && lineSiteName === rowSiteName) return true;
        return false;
      };

      if (isSupportOrigin) {
        const items: LaborExchangeItem[] =
          line.origin === 'support_outgoing' || line.origin === 'support_fee_outgoing'
            ? (laborExchangeSummary?.outgoing.items ?? [])
            : (laborExchangeSummary?.incoming.items ?? []);

        const isFeeLine = line.origin === 'support_fee_outgoing' || line.origin === 'support_fee_incoming';
        const lineCounterId = line.counterTeamId ? String(line.counterTeamId).trim() : '';
        const lineCounterName = line.counterTeamName ? String(line.counterTeamName).trim() : '';

        return items
          .filter((item) => {
            const okSite = matchesSiteByIdOrName({
              lineSiteId: line.siteId,
              lineSiteName: line.siteName,
              rowSiteId: item.siteId,
              rowSiteName: item.siteName
            });
            if (!okSite) return false;

            const counterId =
              line.origin === 'support_outgoing' || line.origin === 'support_fee_outgoing'
                ? String(item.reportTeamId ?? '').trim()
                : String(item.workerTeamId ?? '').trim();
            const counterName =
              line.origin === 'support_outgoing' || line.origin === 'support_fee_outgoing'
                ? String(item.reportTeamName ?? '').trim()
                : String(item.workerTeamName ?? '').trim();

            if (lineCounterId) return counterId === lineCounterId;
            if (lineCounterName) return counterName === lineCounterName;
            return true;
          })
          .map((item) => {
            const manDay = safeNumber(item.manDay);
            const unitPrice = isFeeLine ? safeNumber(item.supportRate) : safeNumber(item.unitPrice);
            const amount = isFeeLine ? safeNumber(item.amount) : Math.round(manDay * unitPrice);
            const siteName = String(item.siteName ?? '').trim() || '현장 미지정';
            const workerTeamName = String(item.workerTeamName ?? '').trim() || (item.workerTeamId ? String(item.workerTeamId) : '-');
            return {
              id: `${item.date}__${item.siteId}__${item.workerId}__${line.origin}`,
              date: item.date,
              siteName,
              workerName: item.workerName,
              workerTeamName,
              manDay,
              unitPrice,
              amount
            };
          });
      }

      if (line.origin !== 'daily_report') return [];

      const matchesSite = (r: DailyReportWorkerRow): boolean => {
        return matchesSiteByIdOrName({
          lineSiteId: line.siteId,
          lineSiteName: line.siteName,
          rowSiteId: r.siteId,
          rowSiteName: r.siteName
        });
      };

      const getWorkerTeamId = (r: DailyReportWorkerRow): string => {
        const v = r.workerTeamId ?? r.teamId ?? '';
        return String(v ?? '').trim();
      };

      const getResponsibleTeamId = (r: DailyReportWorkerRow): string => {
        const v = r.responsibleTeamId ?? r.teamId ?? '';
        return String(v ?? '').trim();
      };

      return detailRows
        .filter((r) => {
          if (!matchesSite(r)) return false;

          const workerTeamId = getWorkerTeamId(r);
          const responsibleTeamId = getResponsibleTeamId(r);

          if (line.direction === 'sales') {
            if (!matchesTeam(responsibleTeamId)) return false;
            if (line.counterTeamId || line.counterTeamName) return false;
            return true;
          }

          if (!matchesTeam(responsibleTeamId)) return false;
          if (line.counterTeamId || line.counterTeamName) return false;
          if (matchesTeam(workerTeamId)) return false;
          return true;
        })
        .map((r) => {
          const manDay = safeNumber(r.manDay);
          const unitPrice = safeNumber(r.unitPrice);
          const amount = safeNumber(r.amount);
          const siteName = String(r.siteName ?? '').trim() || '현장 미지정';
          const workerTeamName = String(r.workerTeamName ?? r.teamName ?? '').trim() || '-';
          return {
            id: `${r.reportId}:${r.workerId}`,
            date: r.date,
            siteName,
            workerName: r.workerName,
            workerTeamName,
            manDay,
            unitPrice,
            amount
          };
        });
    },
    [detailRows, laborExchangeSummary, matchesTeam]
  );

  const salesLines = useMemo(() => unifiedLines.filter((x) => x.direction === 'sales'), [unifiedLines]);
  const purchaseLines = useMemo(() => unifiedLines.filter((x) => x.direction === 'purchase'), [unifiedLines]);

  const mergeSupportLines = useCallback((lines: SettlementUnifiedLine[]): SettlementUnifiedLine[] => {
    const autoLines = lines.filter((x) => x.source === 'auto');
    const manualLines = lines.filter((x) => x.source === 'manual');

    const grouped = new Map<string, SettlementUnifiedLine>();
    const passthrough: SettlementUnifiedLine[] = [];

    autoLines.forEach((line) => {
      const counterKey = String(line.counterTeamId ?? '').trim() || String(line.counterTeamName ?? '').trim() || '-';
      if (counterKey === '-') {
        passthrough.push(line);
        return;
      }

      const key = `${line.direction}__${line.origin}__${counterKey}`;
      const prev = grouped.get(key);

      if (!prev) {
        grouped.set(key, {
          ...line,
          id: `merged_support:${line.direction}:${line.origin}:${encodeURIComponent(counterKey)}`,
          siteId: undefined,
          siteName: '',
          counterTeamName: line.counterTeamName ?? counterKey,
          quantity: undefined,
          manDay: safeNumber(line.manDay),
          amount: safeNumber(line.amount)
        });
        return;
      }

      grouped.set(key, {
        ...prev,
        manDay: safeNumber(prev.manDay) + safeNumber(line.manDay),
        amount: safeNumber(prev.amount) + safeNumber(line.amount)
      });
    });

    const merged = Array.from(grouped.values()).sort((a, b) => {
      const aName = String(a.counterTeamName ?? '').trim();
      const bName = String(b.counterTeamName ?? '').trim();
      const nameSort = aName.localeCompare(bName, 'ko');
      if (nameSort !== 0) return nameSort;
      return b.amount - a.amount;
    });

    const passSorted = [...passthrough].sort((a, b) => {
      const originSort = a.originLabel.localeCompare(b.originLabel, 'ko');
      if (originSort !== 0) return originSort;
      const manDaySort = safeNumber(b.manDay) - safeNumber(a.manDay);
      if (manDaySort !== 0) return manDaySort;
      return safeNumber(b.amount) - safeNumber(a.amount);
    });

    return [...merged, ...passSorted, ...manualLines];
  }, []);

  const salesSupportLinesMerged = useMemo(() => {
    return mergeSupportLines(salesLines.filter((x) => x.kind === '지원'));
  }, [mergeSupportLines, salesLines]);

  const salesContractDirectLines = useMemo(() => {
    const lines = salesLines.filter((x) => x.kind === '도급' || x.kind === '직영');
    return [...lines].sort((a, b) => a.kind.localeCompare(b.kind, 'ko'));
  }, [salesLines]);

  const purchaseSupportLinesMerged = useMemo(() => {
    return mergeSupportLines(purchaseLines.filter((x) => x.kind === '지원'));
  }, [mergeSupportLines, purchaseLines]);

  const renderTransactionLineRows = (lines: SettlementUnifiedLine[]) => {
    return lines.map((line) => {
      const isExpanded = expandedLineIds.has(line.id);
      const editableManual = canEdit && line.source === 'manual';
      const isMergedSupportLine = line.source === 'auto' && line.id.startsWith('merged_support:');
      const showSiteInsteadOfCounterTeam = line.kind === '도급' || line.kind === '직영';
      const editableAmount =
        canEdit && (line.source === 'manual' || (line.direction === 'sales' && (line.kind === '도급' || line.kind === '직영')));

      const isSupportSales = line.direction === 'sales' && line.kind === '지원';
      const isSupportPurchase = line.direction === 'purchase' && line.kind === '지원';

      const summaryRowClassName =
        isSupportSales
          ? 'bg-purple-50'
          : isSupportPurchase
            ? 'bg-orange-50'
            : line.source === 'manual'
              ? 'bg-amber-50'
              : 'bg-white';

      const detail = isExpanded ? getLineDetailRows(line) : [];
      const isSupportFeeLine = line.origin === 'support_fee_outgoing' || line.origin === 'support_fee_incoming';
      const isSupportOrigin =
        line.origin === 'support_outgoing' ||
        line.origin === 'support_incoming' ||
        line.origin === 'support_fee_outgoing' ||
        line.origin === 'support_fee_incoming';
      const supportRateAvg = isSupportFeeLine
        ? safeAverage(
          detail.reduce((sum, r) => sum + safeNumber(r.amount), 0),
          detail.reduce((sum, r) => sum + safeNumber(r.manDay), 0)
        )
        : null;

      const siteSummaries = (() => {
        if (detail.length === 0) return [] as Array<{ siteName: string; manDay: number; amount: number; rows: LineDetailRow[] }>;
        const grouped = new Map<string, { siteName: string; manDay: number; amount: number; rows: LineDetailRow[] }>();
        detail.forEach((r) => {
          const siteName = String(r.siteName ?? '').trim() || '현장 미지정';
          const prev = grouped.get(siteName) ?? { siteName, manDay: 0, amount: 0, rows: [] as LineDetailRow[] };
          grouped.set(siteName, {
            siteName,
            manDay: prev.manDay + safeNumber(r.manDay),
            amount: prev.amount + safeNumber(r.amount),
            rows: [...prev.rows, r]
          });
        });
        return Array.from(grouped.values()).sort((a, b) => b.manDay - a.manDay);
      })();

      return (
        <React.Fragment key={line.id}>
          <tr className={summaryRowClassName}>
            <td className="px-2 py-2 border whitespace-nowrap">
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full border text-xs font-semibold ${getKindBadgeClassName(
                  line.kind
                )}`}
              >
                {line.kind}
              </span>
            </td>
            <td className="px-2 py-2 border text-slate-700 whitespace-nowrap">{line.originLabel}</td>
            <td className="px-2 py-2 border whitespace-nowrap">
              {showSiteInsteadOfCounterTeam ? (
                editableManual ? (
                  <input
                    className="w-full border rounded px-2 py-1"
                    value={line.siteName}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (line.direction === 'sales') {
                        updateDoc((prev) => ({
                          ...prev,
                          sales: prev.sales.map((x) => (x.id === line.id ? { ...x, siteName: next } : x))
                        }));
                      } else {
                        updateDoc((prev) => ({
                          ...prev,
                          purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, siteName: next } : x))
                        }));
                      }
                    }}
                  />
                ) : (
                  <div className="text-slate-800 font-medium">{String(line.siteName ?? '').trim() || '-'}</div>
                )
              ) : editableManual ? (
                <input
                  className="w-full border rounded px-2 py-1"
                  value={line.counterTeamName ?? ''}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (line.direction === 'sales') {
                      updateDoc((prev) => ({
                        ...prev,
                        sales: prev.sales.map((x) => (x.id === line.id ? { ...x, counterTeamName: next } : x))
                      }));
                    } else {
                      updateDoc((prev) => ({
                        ...prev,
                        purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, counterTeamName: next } : x))
                      }));
                    }
                  }}
                />
              ) : (
                <div className="text-slate-700">{line.counterTeamName ?? '-'}</div>
              )}
            </td>
            <td className="px-1 py-2 border text-right whitespace-nowrap">
              <input
                className="w-20 border rounded px-2 py-1 text-right"
                value={formatManDay1(line.manDay)}
                disabled={!editableManual}
                onChange={(e) => {
                  const n = safeNumber(e.target.value);
                  if (line.direction === 'sales') {
                    updateDoc((prev) => ({
                      ...prev,
                      sales: prev.sales.map((x) => (x.id === line.id ? { ...x, manDay: n } : x))
                    }));
                  } else {
                    updateDoc((prev) => ({
                      ...prev,
                      purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, manDay: n } : x))
                    }));
                  }
                }}
              />
            </td>
            <td className="px-1 py-2 border text-right whitespace-nowrap">
              <CurrencyInput
                className="w-28 border rounded px-2 py-1 text-right"
                value={line.amount}
                disabled={!editableAmount}
                onChange={(n) => {
                  if (line.direction === 'sales') {
                    updateDoc((prev) => ({
                      ...prev,
                      sales: prev.sales.map((x) => (x.id === line.id ? { ...x, amount: n } : x))
                    }));
                  } else {
                    updateDoc((prev) => ({
                      ...prev,
                      purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, amount: n } : x))
                    }));
                  }
                }}
              />
            </td>
            <td className="px-2 py-2 border">
              <input
                className="w-full border rounded px-2 py-1"
                value={line.memo ?? ''}
                disabled={!canEdit || isMergedSupportLine}
                onChange={(e) => {
                  const next = e.target.value;
                  if (line.direction === 'sales') {
                    updateDoc((prev) => ({
                      ...prev,
                      sales: prev.sales.map((x) => (x.id === line.id ? { ...x, memo: next } : x))
                    }));
                  } else {
                    updateDoc((prev) => ({
                      ...prev,
                      purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, memo: next } : x))
                    }));
                  }
                }}
              />
            </td>
            <td className="px-2 py-2 border text-center">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => toggleLineExpanded(line.id)}
                >
                  {isExpanded ? '닫기' : '상세'}
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={!editableManual}
                  onClick={() => {
                    if (line.direction === 'sales') {
                      updateDoc((prev) => ({
                        ...prev,
                        sales: prev.sales.filter((x) => x.id !== line.id)
                      }));
                    } else {
                      updateDoc((prev) => ({
                        ...prev,
                        purchases: prev.purchases.filter((x) => x.id !== line.id)
                      }));
                    }
                  }}
                >
                  삭제
                </button>
              </div>
            </td>
          </tr>

          {isExpanded && (
            <tr className={summaryRowClassName}>
              <td className="px-3 py-3 border" colSpan={7}>
                <div className="rounded-lg border bg-white p-3">
                  <div className="text-sm font-semibold text-slate-800">{isSupportOrigin ? '인력교류 상세' : '출력 상세'}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {detail.length > 0
                      ? `총 ${detail.length}건 / ${siteSummaries.length}개 현장`
                      : '상세 데이터 없음 (수기 항목이거나 필터 조건에 해당 없음)'}
                  </div>

                  {editableManual && (
                    <div className="mt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">현장</div>
                          <input
                            className="w-full border rounded px-2 py-1"
                            value={line.siteName}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (line.direction === 'sales') {
                                updateDoc((prev) => ({
                                  ...prev,
                                  sales: prev.sales.map((x) => (x.id === line.id ? { ...x, siteName: next } : x))
                                }));
                              } else {
                                updateDoc((prev) => ({
                                  ...prev,
                                  purchases: prev.purchases.map((x) => (x.id === line.id ? { ...x, siteName: next } : x))
                                }));
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {isSupportFeeLine && (
                    <div className="text-xs text-slate-500 mt-1">평균 지원단가: {formatAverageCurrency(supportRateAvg)}</div>
                  )}

                  {detail.length > 0 && (
                    <div className="mt-3 space-y-3">
                      <div className="overflow-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600">
                              <th className="text-left px-2 py-2 border">현장</th>
                              <th className="text-right px-2 py-2 border">작업자수</th>
                              <th className="text-right px-2 py-2 border">공수 합계</th>
                              <th className="text-right px-2 py-2 border">금액 합계</th>
                              <th className="text-center px-2 py-2 border">상세</th>
                            </tr>
                          </thead>
                          <tbody>
                            {siteSummaries.map((site) => {
                              const siteKey = `${line.id}__${site.siteName}`;
                              const isSiteExpanded = expandedSiteKeys.has(siteKey);
                              const workerKeySet = new Set(site.rows.map((r) => `${r.workerName}__${r.workerTeamName || ''}`));
                              const workerCount = workerKeySet.size;

                              const workerSummaries = (() => {
                                const grouped = new Map<
                                  string,
                                  { workerName: string; workerTeamName: string; manDay: number; amount: number }
                                >();

                                site.rows.forEach((r) => {
                                  const workerName = String(r.workerName ?? '').trim() || '-';
                                  const workerTeamName = String(r.workerTeamName ?? '').trim() || '-';
                                  const key = `${workerName}__${workerTeamName}`;
                                  const prev = grouped.get(key) ?? { workerName, workerTeamName, manDay: 0, amount: 0 };
                                  grouped.set(key, {
                                    workerName,
                                    workerTeamName,
                                    manDay: prev.manDay + safeNumber(r.manDay),
                                    amount: prev.amount + safeNumber(r.amount)
                                  });
                                });

                                return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
                              })();

                              return (
                                <React.Fragment key={siteKey}>
                                  <tr className="bg-white">
                                    <td className="px-2 py-2 border">{site.siteName}</td>
                                    <td className="px-2 py-2 border text-right">{workerCount}</td>
                                    <td className="px-2 py-2 border text-right">{formatManDay1(site.manDay)}</td>
                                    <td className="px-2 py-2 border text-right">{formatCurrency(site.amount)}</td>
                                    <td className="px-2 py-2 border text-center">
                                      <button
                                        type="button"
                                        className={ghostButtonClassName}
                                        onClick={() => toggleSiteExpanded(siteKey)}
                                      >
                                        {isSiteExpanded ? '닫기' : '상세'}
                                      </button>
                                    </td>
                                  </tr>

                                  {isSiteExpanded && (
                                    <tr className="bg-white">
                                      <td className="px-3 py-3 border" colSpan={5}>
                                        <div className="rounded-lg border bg-slate-50 p-3">
                                          <div className="text-xs font-semibold text-slate-700">작업자 상세 ({site.siteName})</div>
                                          <div className="mt-2 overflow-auto">
                                            <table className="w-full text-xs border-collapse">
                                              <thead>
                                                <tr className="bg-white text-slate-600">
                                                  <th className="text-left px-2 py-2 border">작업자</th>
                                                  <th className="text-left px-2 py-2 border">소속팀</th>
                                                  <th className="text-right px-2 py-2 border">공수</th>
                                                  <th className="text-right px-2 py-2 border">평균단가</th>
                                                  <th className="text-right px-2 py-2 border">금액</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {workerSummaries.map((w) => {
                                                  const avgUnit = safeAverage(w.amount, w.manDay);
                                                  return (
                                                    <tr key={`${siteKey}__${w.workerName}__${w.workerTeamName}`} className="bg-white">
                                                      <td className="px-2 py-2 border">{w.workerName}</td>
                                                      <td className="px-2 py-2 border">{w.workerTeamName}</td>
                                                      <td className="px-2 py-2 border text-right">{formatManDay1(w.manDay)}</td>
                                                      <td className="px-2 py-2 border text-right">{formatAverageCurrency(avgUnit)}</td>
                                                      <td className="px-2 py-2 border text-right">{formatCurrency(w.amount)}</td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="w-full p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-2xl font-bold text-slate-800">팀정산 관리</div>
          <div className="text-sm text-slate-500 mt-1">월/팀 기준 자동집계 + 수기 조정 후 저장/확정</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={loadSettlement}
            disabled={loadState.status === 'loading'}
          >
            새로고침
          </button>

          <button
            type="button"
            className={`${primaryButtonClassName} bg-indigo-600 text-white hover:bg-indigo-700`}
            onClick={handleRecalculate}
            disabled={!selectedTeamId || !yearMonth || loadState.status === 'loading'}
          >
            강제 재집계
          </button>

          <button
            type="button"
            className={`${primaryButtonClassName} bg-blue-600 text-white hover:bg-blue-700`}
            onClick={handleSave}
            disabled={!doc || !canEdit}
          >
            저장
          </button>

          <button
            type="button"
            className={`${primaryButtonClassName} bg-emerald-600 text-white hover:bg-emerald-700`}
            onClick={handleConfirm}
            disabled={!doc || !canEdit}
          >
            확정
          </button>

          <button
            type="button"
            className={`${primaryButtonClassName} bg-rose-600 text-white hover:bg-rose-700`}
            onClick={handleUnconfirm}
            disabled={!doc || canEdit}
          >
            확정취소
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-700">정산월</div>
          <div className="mt-2">
            <YearMonthPicker
              value={yearMonth}
              onChange={setYearMonth}
              inputClassName="month-input w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-left"
            />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-700">팀</div>
          <div className="mt-2">
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
            >
              {teams.map((t) => (
                <option key={String(t.id ?? '')} value={String(t.id ?? '')}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-700">상태</div>
          <div className="mt-2 text-sm text-slate-700">
            <div>
              <span className="font-semibold">팀명</span>
              <span className="ml-2">{doc?.teamName || selectedTeamName || '-'}</span>
            </div>
            <div className="mt-1">
              <span className="font-semibold">확정일시</span>
              <span className="ml-2">{confirmedAtLabel || '미확정'}</span>
            </div>
          </div>
        </div>
      </div>

      {doc && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-xs text-slate-500">매출 합계</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">{formatCurrency(totals.salesTotal)}원</div>
              <div className="mt-2 text-xs text-slate-500">도급/직영/지원 + 지원비 포함</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-xs text-slate-500">매입 합계</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">{formatCurrency(totals.purchasesTotal)}원</div>
              <div className="mt-2 text-xs text-slate-500">지원(받음) + 지원비 포함</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-xs text-slate-500">공제 합계</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">{formatCurrency(totals.deductionsTotal)}원</div>
              <div className="mt-2 text-xs text-slate-500">숙소/차량/카드 + 수기</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-xs text-slate-500">추가 합계</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">{formatCurrency(totals.additionsTotal)}원</div>
              <div className="mt-2 text-xs text-slate-500">수기 추가</div>
            </div>

            <div className="rounded-2xl border bg-slate-900 p-5 shadow-sm text-white">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-300">정산 잔액</div>
                <div
                  className={`text-xs font-semibold px-2 py-1 rounded-full border ${doc.confirmedAt ? 'border-emerald-400 text-emerald-300' : 'border-amber-400 text-amber-300'
                    }`}
                >
                  {doc.confirmedAt ? '확정' : '미확정'}
                </div>
              </div>
              <div className="mt-1 text-2xl font-extrabold">{formatCurrency(totals.net)}원</div>
              <div className="mt-2 text-xs text-slate-300">매출 - 매입 - 공제 + 추가 + 전월이월 + 입금조정</div>
              <div className="mt-1 text-xs text-slate-300">
                {formatCurrency(totals.salesTotal)} - {formatCurrency(totals.purchasesTotal)} - {formatCurrency(totals.deductionsTotal)} +
                {formatCurrency(totals.additionsTotal)} + {formatCurrency(totals.prevCarryover)} + {formatCurrency(totals.deposit)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-xs text-slate-500">도급 매출</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">{formatCurrency(dashboardMetrics.contractSalesTotal)}원</div>
              <div className="mt-2 text-xs text-slate-500">도급(전체 원천) 합계</div>
            </div>
          </div>
        </div>
      )}

      {loadState.status === 'loading' && (
        <div className="mt-6 rounded-xl border bg-white p-4 text-slate-600">불러오는 중...</div>
      )}

      {loadState.status === 'error' && (
        <div className="mt-6 rounded-xl border bg-rose-50 p-4 text-rose-700">{loadState.message}</div>
      )}

      {doc && (
        <div className="mt-6 grid grid-cols-1 2xl:grid-cols-3 gap-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm 2xl:col-span-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-bold text-slate-800">거래내역 (매출/매입)</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  도급/직영/지원 공수 기반 자동집계 + 상세(출력/인력교류) 아코디언
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-semibold text-slate-800">매출</div>
                  <button type="button" className={addButtonClassName} onClick={handleAddManualSale} disabled={!canEdit}>
                    + 수기 매출
                  </button>
                </div>

                <div className="mt-3">
                  <div className="text-sm font-semibold text-slate-700">지원</div>
                  <div className="mt-2 overflow-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600">
                          <th className="text-left px-2 py-2 border whitespace-nowrap">구분</th>
                          <th className="text-left px-2 py-2 border whitespace-nowrap">원천</th>
                          <th className="text-left px-2 py-2 border whitespace-nowrap">상대팀</th>
                          <th className="text-right px-1 py-2 border whitespace-nowrap">공수</th>
                          <th className="text-right px-1 py-2 border whitespace-nowrap">금액</th>
                          <th className="text-left px-2 py-2 border">비고</th>
                          <th className="px-2 py-2 border"></th>
                        </tr>
                      </thead>
                      <tbody>{renderTransactionLineRows(salesSupportLinesMerged)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold text-slate-700">도급/직영</div>
                  <div className="mt-2 overflow-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600">
                          <th className="text-left px-2 py-2 border whitespace-nowrap">구분</th>
                          <th className="text-left px-2 py-2 border whitespace-nowrap">원천</th>
                          <th className="text-left px-2 py-2 border whitespace-nowrap">현장</th>
                          <th className="text-right px-1 py-2 border whitespace-nowrap">공수</th>
                          <th className="text-right px-1 py-2 border whitespace-nowrap">금액</th>
                          <th className="text-left px-2 py-2 border">비고</th>
                          <th className="px-2 py-2 border"></th>
                        </tr>
                      </thead>
                      <tbody>{renderTransactionLineRows(salesContractDirectLines)}</tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-semibold text-slate-800">매입</div>
                  <button type="button" className={addButtonClassName} onClick={handleAddManualPurchase} disabled={!canEdit}>
                    + 수기 매입
                  </button>
                </div>

                <div className="mt-3 overflow-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600">
                        <th className="text-left px-2 py-2 border whitespace-nowrap">구분</th>
                        <th className="text-left px-2 py-2 border whitespace-nowrap">원천</th>
                        <th className="text-left px-2 py-2 border whitespace-nowrap">상대팀</th>
                        <th className="text-right px-1 py-2 border whitespace-nowrap">공수</th>
                        <th className="text-right px-1 py-2 border whitespace-nowrap">금액</th>
                        <th className="text-left px-2 py-2 border">비고</th>
                        <th className="px-2 py-2 border"></th>
                      </tr>
                    </thead>
                    <tbody>{renderTransactionLineRows(purchaseSupportLinesMerged)}</tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <div className="text-slate-600">매출 합계 / 매입 합계</div>
              <div className="font-bold text-slate-800">
                {formatCurrency(totals.salesTotal)}원 / {formatCurrency(totals.purchasesTotal)}원
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-800">공제</div>
                <div className="text-xs text-slate-500 mt-0.5">숙소/차량/카드 청구 + 수기 공제</div>
              </div>
              <button type="button" className={addButtonClassName} onClick={handleAddManualDeduction} disabled={!canEdit}>
                + 수기 공제
              </button>
            </div>

            <div className="mt-3 overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="text-left px-2 py-2 border">구분</th>
                    <th className="text-left px-2 py-2 border">항목</th>
                    <th className="text-right px-2 py-2 border">금액</th>
                    <th className="text-left px-2 py-2 border">비고</th>
                    <th className="text-center px-2 py-2 border whitespace-nowrap">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.deductions.map((item) => {
                    const editableRow = canEdit && item.source === 'manual';
                    const canExpand =
                      item.source === 'auto' &&
                      (
                        item.origin === 'office_expense' ||
                        item.origin === 'daily_wage_payroll' ||
                        item.origin === 'monthly_wage_payroll' ||
                        item.origin === 'accommodation_billing' ||
                        item.origin === 'vehicle_billing' ||
                        item.origin === 'card_billing'
                      );
                    const isExpanded = canExpand && expandedDeductionIds.has(item.id);
                    const detail = isExpanded ? getDeductionDetail(item) : null;
                    return (
                      <React.Fragment key={item.id}>
                        <tr className={item.source === 'auto' ? 'bg-white' : 'bg-amber-50'}>
                          <td className="px-2 py-2 border text-slate-700">{formatDeductionOrigin(item.origin)}</td>
                          <td className="px-2 py-2 border">
                            <input
                              className="w-full border rounded px-2 py-1"
                              value={item.category}
                              disabled={!editableRow}
                              onChange={(e) => {
                                const next = e.target.value;
                                updateDoc((prev) => ({
                                  ...prev,
                                  deductions: prev.deductions.map((x) => (x.id === item.id ? { ...x, category: next } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border text-right">
                            <CurrencyInput
                              className="w-full border rounded px-2 py-1 text-right"
                              value={item.amount}
                              disabled={!editableRow}
                              onChange={(n) => {
                                updateDoc((prev) => ({
                                  ...prev,
                                  deductions: prev.deductions.map((x) => (x.id === item.id ? { ...x, amount: n } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border">
                            <input
                              className="w-full border rounded px-2 py-1"
                              value={item.memo ?? ''}
                              disabled={!editableRow}
                              onChange={(e) => {
                                const next = e.target.value;
                                updateDoc((prev) => ({
                                  ...prev,
                                  deductions: prev.deductions.map((x) => (x.id === item.id ? { ...x, memo: next } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canExpand && (
                                <button
                                  type="button"
                                  className={ghostButtonClassName}
                                  onClick={() => toggleDeductionExpanded(item.id)}
                                >
                                  {isExpanded ? '닫기' : '상세'}
                                </button>
                              )}
                              <button
                                type="button"
                                className="px-2 py-1 rounded border bg-white text-slate-700 disabled:opacity-50"
                                disabled={!editableRow}
                                onClick={() => {
                                  updateDoc((prev) => ({
                                    ...prev,
                                    deductions: prev.deductions.filter((x) => x.id !== item.id)
                                  }));
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && detail && (
                          <tr className={item.source === 'auto' ? 'bg-white' : 'bg-amber-50'}>
                            <td className="px-3 py-3 border" colSpan={5}>
                              <div className="rounded-lg border bg-white p-3">
                                {detail.kind === 'office_expense' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">사무실비 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      도급+직영 총공수 {formatManDay1(detail.totalManDay)} 기준
                                    </div>
                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">현장</th>
                                            <th className="text-right px-2 py-2 border">공수</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                            <th className="text-right px-2 py-2 border">원/공수</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.sites.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={4}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.sites.map((s) => (
                                              <tr key={s.siteName} className="bg-white">
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{s.siteName}</td>
                                                <td className="px-2 py-2 border text-right">{formatManDay1(s.manDay)}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(s.amount)}</td>
                                                <td className="px-2 py-2 border text-right">
                                                  {formatAverageCurrency(safeAverage(s.amount, s.manDay))}
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between">
                                        <div className="text-slate-600">총공수</div>
                                        <div className="font-bold text-slate-900">{formatManDay1(detail.totalManDay)}</div>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">사무실비(총공수×10,000)</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(Math.round(detail.totalManDay * 10000))}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detail.kind === 'payroll' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">급여 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      작업자별 공수·금액 합계
                                    </div>

                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">작업자</th>
                                            <th className="text-right px-2 py-2 border">공수</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                            <th className="text-right px-2 py-2 border">원/공수</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.rows.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={4}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.rows.map((r) => (
                                              <tr key={r.workerId} className="bg-white">
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{r.workerName}</td>
                                                <td className="px-2 py-2 border text-right">{formatManDay1(r.manDay)}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(r.amount)}</td>
                                                <td className="px-2 py-2 border text-right">
                                                  {formatAverageCurrency(safeAverage(r.amount, r.manDay))}
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between">
                                        <div className="text-slate-600">총공수</div>
                                        <div className="font-bold text-slate-900">{formatManDay1(detail.totalManDay)}</div>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">총금액</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(detail.totalAmount)}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detail.kind === 'accommodation_billing' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">숙소 공제 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {detail.mode === 'document' ? '숙소 청구서 기준' : '월별 공과금 대장 배분 기준'}
                                    </div>

                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">대상</th>
                                            <th className="text-left px-2 py-2 border">항목</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                            {detail.mode === 'ledger' && (
                                              <th className="text-right px-2 py-2 border">배분일수(팀/전체)</th>
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.rows.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={detail.mode === 'ledger' ? 4 : 3}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.rows.map((row, idx) => (
                                              <tr key={`accommodation-row-${idx}`} className="bg-white">
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{row.subject}</td>
                                                <td className="px-2 py-2 border">{row.label}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(row.amount)}</td>
                                                {detail.mode === 'ledger' && (
                                                  <td className="px-2 py-2 border text-right">
                                                    {safeNumber(row.teamDays)}/{safeNumber(row.totalDays)}
                                                  </td>
                                                )}
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">총금액</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(detail.totalAmount)}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detail.kind === 'vehicle_billing' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">차량 공제 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {detail.mode === 'document' ? '차량 청구서 기준' : '월별 차량 대장 자동집계 기준'}
                                    </div>

                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">차량</th>
                                            <th className="text-left px-2 py-2 border">항목</th>
                                            <th className="text-left px-2 py-2 border">구분</th>
                                            <th className="text-left px-2 py-2 border">일자</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.rows.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={5}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.rows.map((row, idx) => (
                                              <tr key={`vehicle-row-${idx}`} className="bg-white">
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{row.subject}</td>
                                                <td className="px-2 py-2 border">{row.label}</td>
                                                <td className="px-2 py-2 border">{row.note ?? '-'}</td>
                                                <td className="px-2 py-2 border">{row.date ?? '-'}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(row.amount)}</td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">총금액</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(detail.totalAmount)}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {detail.kind === 'card_billing' && (
                                  <div>
                                    <div className="text-sm font-semibold text-slate-800">카드 공제 상세</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {detail.mode === 'document' ? '카드 청구서 기준' : '월별 카드 대장 자동집계 기준'}
                                    </div>

                                    <div className="mt-3 overflow-auto">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-600">
                                            <th className="text-left px-2 py-2 border">카드</th>
                                            <th className="text-left px-2 py-2 border">사용처</th>
                                            <th className="text-left px-2 py-2 border">구분</th>
                                            <th className="text-left px-2 py-2 border">일자</th>
                                            <th className="text-right px-2 py-2 border">금액</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.rows.length === 0 ? (
                                            <tr>
                                              <td className="px-2 py-2 border text-slate-500" colSpan={5}>
                                                데이터 없음
                                              </td>
                                            </tr>
                                          ) : (
                                            detail.rows.map((row, idx) => (
                                              <tr key={`card-row-${idx}`} className="bg-white">
                                                <td className="px-2 py-2 border text-slate-800 font-medium">{row.subject}</td>
                                                <td className="px-2 py-2 border">{row.label}</td>
                                                <td className="px-2 py-2 border">{row.note ?? '-'}</td>
                                                <td className="px-2 py-2 border">{row.date ?? '-'}</td>
                                                <td className="px-2 py-2 border text-right">{formatCurrency(row.amount)}</td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="mt-3 text-sm">
                                      <div className="flex items-center justify-between mt-1">
                                        <div className="text-slate-600">총금액</div>
                                        <div className="font-bold text-slate-900">{formatCurrency(detail.totalAmount)}원</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-800">추가</div>
                  <div className="text-xs text-slate-500 mt-0.5">공제와 반대로 (+) 더해지는 항목</div>
                </div>
                <button type="button" className={addButtonClassName} onClick={handleAddManualAddition} disabled={!canEdit}>
                  + 수기 추가
                </button>
              </div>

              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="text-left px-2 py-2 border">구분</th>
                      <th className="text-left px-2 py-2 border">항목</th>
                      <th className="text-right px-2 py-2 border">금액</th>
                      <th className="text-left px-2 py-2 border">비고</th>
                      <th className="text-center px-2 py-2 border whitespace-nowrap">상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(doc.additions ?? []).map((item) => {
                      const editableRow = canEdit && item.source === 'manual';
                      return (
                        <tr key={item.id} className={item.source === 'auto' ? 'bg-white' : 'bg-emerald-50'}>
                          <td className="px-2 py-2 border text-slate-700">{formatAdditionOrigin(item.origin)}</td>
                          <td className="px-2 py-2 border">
                            <input
                              className="w-full border rounded px-2 py-1"
                              value={item.category}
                              disabled={!editableRow}
                              onChange={(e) => {
                                const next = e.target.value;
                                updateDoc((prev) => ({
                                  ...prev,
                                  additions: (prev.additions ?? []).map((x) => (x.id === item.id ? { ...x, category: next } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border text-right">
                            <CurrencyInput
                              className="w-full border rounded px-2 py-1 text-right"
                              value={item.amount}
                              disabled={!editableRow}
                              onChange={(n) => {
                                updateDoc((prev) => ({
                                  ...prev,
                                  additions: (prev.additions ?? []).map((x) => (x.id === item.id ? { ...x, amount: n } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border">
                            <input
                              className="w-full border rounded px-2 py-1"
                              value={item.memo ?? ''}
                              disabled={!editableRow}
                              onChange={(e) => {
                                const next = e.target.value;
                                updateDoc((prev) => ({
                                  ...prev,
                                  additions: (prev.additions ?? []).map((x) => (x.id === item.id ? { ...x, memo: next } : x))
                                }));
                              }}
                            />
                          </td>
                          <td className="px-2 py-2 border text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                className={ghostButtonClassName}
                                onClick={() => {
                                  Swal.fire({
                                    title: '추가 상세',
                                    html: `<div style="text-align:left; font-size:12px;">
                                      <div><b>항목</b>: ${String(item.category ?? '')}</div>
                                      <div style="margin-top:4px;"><b>금액</b>: ${formatCurrency(safeNumber(item.amount))}원</div>
                                      <div style="margin-top:4px;"><b>비고</b>: ${String(item.memo ?? '') || '-'}</div>
                                    </div>`,
                                    confirmButtonText: '닫기'
                                  });
                                }}
                              >
                                상세
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 rounded border bg-white text-slate-700 disabled:opacity-50"
                                disabled={!editableRow}
                                onClick={() => {
                                  updateDoc((prev) => ({
                                    ...prev,
                                    additions: (prev.additions ?? []).filter((x) => x.id !== item.id)
                                  }));
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-600">공제 합계</div>
                <div className="font-bold text-slate-800">{formatCurrency(totals.deductionsTotal)}원</div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-slate-600">추가 합계</div>
                <div className="font-bold text-slate-800">{formatCurrency(totals.additionsTotal)}원</div>
              </div>

              <div className="rounded-lg border bg-slate-50 px-3 py-3">
                <div className="text-sm font-semibold text-slate-800">평균 단가</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-slate-600">팀 평균단가 (원/공수)</div>
                    <div className="font-bold text-slate-900">{formatAverageCurrency(avgUnitPrice.teamAvgPerManDay)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-slate-600">현장 평균단가 (원/공수)</div>
                    <div className="font-bold text-slate-900">{formatAverageCurrency(avgUnitPrice.siteAvgPerManDay)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-white px-3 py-3">
                <div className="text-sm font-semibold text-slate-800">현장별 쓰꾸미</div>
                <div className="mt-2 overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600">
                        <th className="text-left px-2 py-2 border">현장</th>
                        <th className="text-right px-2 py-2 border">공수</th>
                        <th className="text-right px-2 py-2 border">금액</th>
                        <th className="text-right px-2 py-2 border">쓰꾸미(원/공수)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siteSkkumiRows.length === 0 ? (
                        <tr>
                          <td className="px-2 py-2 border text-slate-500" colSpan={4}>
                            데이터 없음
                          </td>
                        </tr>
                      ) : (
                        siteSkkumiRows.map((r) => {
                          const skkumi = safeAverage(r.amount, r.manDay);

                          return (
                            <tr key={r.siteName} className="bg-white">
                              <td className="px-2 py-2 border text-slate-800 font-medium">{r.siteName}</td>
                              <td className="px-2 py-2 border text-right">{formatManDay1(r.manDay)}</td>
                              <td className="px-2 py-2 border text-right">{formatCurrency(r.amount)}</td>
                              <td className="px-2 py-2 border text-right">{formatAverageCurrency(skkumi)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-slate-600">전월 이월</div>
                  <CurrencyInput
                    className="w-full border rounded px-2 py-1 text-right"
                    value={totals.prevCarryover}
                    disabled={!canEdit}
                    onChange={(n) => {
                      updateDoc((prev) => ({
                        ...prev,
                        summary: { ...prev.summary, prevCarryover: n }
                      }));
                    }}
                  />
                </div>

                <div>
                  <div className="text-xs text-slate-600">입금/정산조정</div>
                  <CurrencyInput
                    className="w-full border rounded px-2 py-1 text-right"
                    value={totals.deposit}
                    disabled={!canEdit}
                    onChange={(n) => {
                      updateDoc((prev) => ({
                        ...prev,
                        summary: { ...prev.summary, deposit: n }
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-slate-900 text-white px-3 py-3 flex items-center justify-between">
                <div className="font-semibold">정산 잔액</div>
                <div className="text-xl font-bold">{formatCurrency(totals.net)}원</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamSettlementPage;
