import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  WalletCards
} from 'lucide-react';
import Swal from 'sweetalert2';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';
import { companyService } from '../../services/companyService';
import {
  createSystemConfig,
  listSystemConfigs,
  updateSystemConfig,
  type CreateSystemConfigVariables,
  type UpdateSystemConfigVariables
} from '../../services/firestoreCrudCompat';
import { officeService, type OfficeTransaction } from '../../services/officeService';
import { teamService, type Team } from '../../services/teamService';
import { teamSettlementService } from '../../services/teamSettlementService';
import { buildCheongyeonEngTeams } from '../../utils/cheongyeonTeams';
import { toast } from '../../utils/swal';
import { TeamSettlementDocumentSchema, type TeamSettlementDocument } from '../../types/teamSettlement';

type TeamSettlementRow = {
  teamId: string;
  teamName: string;
  doc: TeamSettlementDocument | null;
  confirmedAt: string | null;
  salesTotal: number;
  purchasesTotal: number;
  deductionsTotal: number;
  additionsTotal: number;
  officeFee: number;
  net: number;
  priorDebtCarryover: number;
  priorReserveCarryover: number;
  reserveTarget: number;
  reserveDrawdown: number;
  debtApplied: number;
  reserveApplied: number;
  reserveRequired: number;
  reserveBalance: number;
  reserveOutstanding: number;
  payoutDue: number;
  debtDue: number;
  payoutRecorded: number;
  debtCollected: number;
  payoutOutstanding: number;
  debtOutstanding: number;
  loadError?: string;
};

type SystemConfigRow = {
  id?: unknown;
  data?: unknown;
};

type TeamReservePolicy = {
  id: string;
  yearMonth: string;
  teamId: string;
  reserveTarget: number;
  updatedAt?: string;
};

type TeamSettlementLedgerState = {
  priorDebtCarryover: number;
  priorReserveCarryover: number;
  reserveTarget: number;
  reserveDrawdown: number;
  debtDue: number;
  debtApplied: number;
  reserveRequired: number;
  reserveApplied: number;
  reserveBalance: number;
  payoutDue: number;
  payoutRecorded: number;
  debtCollected: number;
  payoutOutstanding: number;
  debtOutstanding: number;
  reserveOutstanding: number;
};

const currencyFormatter = new Intl.NumberFormat('ko-KR');
const TEAM_SETTLEMENT_CONFIG_PREFIX = 'team_settlement_';
const RESERVE_POLICY_CONFIG_PREFIX = 'office_team_settlement_reserve_';

const formatCurrency = (value: number): string =>
  currencyFormatter.format(Math.round(Number.isFinite(value) ? value : 0));

const formatSignedCurrency = (value: number): string => {
  const abs = formatCurrency(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
};

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toText = (value: unknown): string => String(value ?? '').trim();

const getCurrentYearMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthPeriod = (yearMonth: string) => {
  const [yearRaw, monthRaw] = yearMonth.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) ? month : new Date().getMonth() + 1;
  const lastDay = new Date(safeYear, safeMonth, 0).getDate();
  return {
    endDate: `${safeYear}-${String(safeMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  };
};

const formatLocalDate = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultTransactionDate = (yearMonth: string): string => {
  const today = formatLocalDate();
  if (today.startsWith(`${yearMonth}-`)) return today;
  return getMonthPeriod(yearMonth).endDate;
};

const buildTransactionId = (prefix: string, parts: Array<string | number | undefined>) => {
  const cleaned = parts
    .map((part) => String(part ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '_'))
    .filter(Boolean)
    .join('_');
  return `${prefix}_${cleaned}_${Date.now()}`;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const safeJsonParse = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const extractSystemConfigRows = (value: unknown): SystemConfigRow[] => {
  if (!value || typeof value !== 'object') return [];
  const root = value as { data?: unknown };
  const data = root.data;
  if (!data || typeof data !== 'object') return [];
  const rows = (data as { systemConfigs?: unknown }).systemConfigs;
  return Array.isArray(rows) ? (rows as SystemConfigRow[]) : [];
};

const normalizeConfigIdPart = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');

const buildReservePolicyId = (params: { yearMonth: string; teamId: string }): string =>
  `${RESERVE_POLICY_CONFIG_PREFIX}${normalizeConfigIdPart(params.yearMonth)}__${normalizeConfigIdPart(params.teamId)}`;

const isYearMonth = (value: unknown): value is string => {
  const matched = /^(\d{4})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!matched) return false;
  const month = Number(matched[2]);
  return Number.isFinite(month) && month >= 1 && month <= 12;
};

const getYearMonthFromSearchParams = (params: URLSearchParams): string | null => {
  const value = params.get('yearMonth') || params.get('month');
  return isYearMonth(value) ? value : null;
};

const compareYearMonth = (left: string, right: string): number => left.localeCompare(right);

const getPriorMonthsInSelectedYear = (yearMonth: string): string[] => {
  const [yearRaw, monthRaw] = yearMonth.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month <= 1) return [];

  return Array.from({ length: month - 1 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
};

const getTransactionYearMonth = (transaction: OfficeTransaction): string => {
  const relatedYearMonth = toText(transaction.relatedYearMonth);
  if (isYearMonth(relatedYearMonth)) return relatedYearMonth;
  const dateMonth = toText(transaction.date).slice(0, 7);
  return isYearMonth(dateMonth) ? dateMonth : '';
};

const parseSavedSettlementDocs = (rows: SystemConfigRow[]): TeamSettlementDocument[] =>
  rows.flatMap((row) => {
    const id = toText(row.id);
    if (!id.startsWith(TEAM_SETTLEMENT_CONFIG_PREFIX) || typeof row.data !== 'string') return [];
    const parsed = safeJsonParse<unknown>(row.data);
    const result = TeamSettlementDocumentSchema.safeParse(parsed);
    return result.success ? [result.data] : [];
  });

const parseReservePolicies = (rows: SystemConfigRow[]): TeamReservePolicy[] =>
  rows.flatMap((row) => {
    const id = toText(row.id);
    if (!id.startsWith(RESERVE_POLICY_CONFIG_PREFIX) || typeof row.data !== 'string') return [];
    const parsed = safeJsonParse<Record<string, unknown>>(row.data);
    if (!parsed) return [];

    const yearMonth = toText(parsed.yearMonth);
    const teamId = toText(parsed.teamId);
    if (!isYearMonth(yearMonth) || !teamId) return [];

    return [
      {
        id,
        yearMonth,
        teamId,
        reserveTarget: Math.max(0, toFiniteNumber(parsed.reserveTarget)),
        updatedAt: toText(parsed.updatedAt) || undefined
      }
    ];
  });

const getSettlementDocKey = (doc: TeamSettlementDocument): string => `${doc.yearMonth}__${toText(doc.teamId)}`;

const mergeSettlementDocs = (docs: TeamSettlementDocument[]): TeamSettlementDocument[] => {
  const byKey = new Map<string, TeamSettlementDocument>();
  docs.forEach((doc) => {
    const key = getSettlementDocKey(doc);
    if (!key.endsWith('__')) byKey.set(key, doc);
  });
  return Array.from(byKey.values());
};

const saveReservePolicy = async (policy: Omit<TeamReservePolicy, 'id'>): Promise<void> => {
  const id = buildReservePolicyId({ yearMonth: policy.yearMonth, teamId: policy.teamId });
  const payload = JSON.stringify({ ...policy, id, updatedAt: new Date().toISOString() });
  const updateVars: UpdateSystemConfigVariables = { id, data: payload };
  const createVars: CreateSystemConfigVariables = { id, data: payload };

  try {
    const updateRes = await updateSystemConfig(updateVars);
    const updated = Boolean((updateRes as any)?.data?.systemConfig_update?.id);
    if (!updated) await createSystemConfig(createVars);
  } catch {
    try {
      await createSystemConfig(createVars);
    } catch {
      await updateSystemConfig(updateVars);
    }
  }
};

const getTeamId = (team: Team): string => String(team.id ?? team.legacyId ?? team.name ?? '').trim();

const getTeamCandidates = (team: Team): string[] =>
  [team.id, (team as any).legacyId, team.name].map((value) => String(value ?? '').trim()).filter(Boolean);

const transactionMatchesTeam = (transaction: OfficeTransaction, team: Team): boolean => {
  const relatedTeamId = String(transaction.relatedTeamId ?? '').trim();
  if (!relatedTeamId) return false;
  return getTeamCandidates(team).includes(relatedTeamId);
};

const sumTransactions = (rows: OfficeTransaction[], predicate: (row: OfficeTransaction) => boolean): number =>
  rows.filter(predicate).reduce((sum, row) => sum + toFiniteNumber(row.amount), 0);

const calculateSettlementParts = (doc: TeamSettlementDocument | null) => {
  const salesTotal = (doc?.sales ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
  const purchasesTotal = (doc?.purchases ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
  const deductionsTotal = (doc?.deductions ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
  const additionsTotal = (doc?.additions ?? []).reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);
  const prevCarryover = toFiniteNumber(doc?.summary?.prevCarryover);
  const deposit = toFiniteNumber(doc?.summary?.deposit);
  const net = salesTotal - purchasesTotal - deductionsTotal + additionsTotal + prevCarryover + deposit;
  const officeFee = (doc?.deductions ?? [])
    .filter((item) => item.origin === 'office_expense')
    .reduce((sum, item) => sum + toFiniteNumber(item.amount), 0);

  return { salesTotal, purchasesTotal, deductionsTotal, additionsTotal, net, officeFee };
};

const teamMatchesSettlementDoc = (doc: TeamSettlementDocument, team: Team): boolean => {
  const candidates = getTeamCandidates(team);
  const docTeamId = toText(doc.teamId);
  const docTeamName = toText(doc.teamName);
  return candidates.includes(docTeamId) || Boolean(docTeamName && candidates.includes(docTeamName));
};

const getSavedSettlementDoc = (
  docs: TeamSettlementDocument[],
  team: Team,
  yearMonth: string
): TeamSettlementDocument | null =>
  docs.find((doc) => doc.yearMonth === yearMonth && teamMatchesSettlementDoc(doc, team)) ?? null;

const getReserveTarget = (policies: TeamReservePolicy[], team: Team, yearMonth: string): number => {
  const candidates = getTeamCandidates(team);
  const policy = policies.find((item) => item.yearMonth === yearMonth && candidates.includes(item.teamId));
  return Math.max(0, toFiniteNumber(policy?.reserveTarget));
};

const collectLedgerMonths = (params: {
  team: Team;
  selectedYearMonth: string;
  savedDocs: TeamSettlementDocument[];
  transactions: OfficeTransaction[];
  reservePolicies: TeamReservePolicy[];
}): string[] => {
  const months = new Set<string>([params.selectedYearMonth]);
  const teamCandidates = getTeamCandidates(params.team);

  params.savedDocs.forEach((doc) => {
    if (doc.yearMonth <= params.selectedYearMonth && teamMatchesSettlementDoc(doc, params.team)) {
      months.add(doc.yearMonth);
    }
  });

  params.reservePolicies.forEach((policy) => {
    if (policy.yearMonth <= params.selectedYearMonth && teamCandidates.includes(policy.teamId)) {
      months.add(policy.yearMonth);
    }
  });

  params.transactions.forEach((transaction) => {
    if (transaction.category !== 'TEAM_DEBT_COLLECTION' && transaction.category !== 'TEAM_SETTLEMENT_PAYOUT') return;
    if (!transactionMatchesTeam(transaction, params.team)) return;
    const transactionYearMonth = getTransactionYearMonth(transaction);
    if (transactionYearMonth && transactionYearMonth <= params.selectedYearMonth) {
      months.add(transactionYearMonth);
    }
  });

  return Array.from(months).sort(compareYearMonth);
};

const buildLedgerState = (params: {
  team: Team;
  selectedYearMonth: string;
  currentDoc: TeamSettlementDocument | null;
  savedDocs: TeamSettlementDocument[];
  transactions: OfficeTransaction[];
  reservePolicies: TeamReservePolicy[];
}): TeamSettlementLedgerState => {
  let debtCarryover = 0;
  let reserveBalance = 0;
  let selectedState: TeamSettlementLedgerState | null = null;
  const months = collectLedgerMonths(params);

  months.forEach((month) => {
    const isSelectedMonth = month === params.selectedYearMonth;
    const savedDoc = getSavedSettlementDoc(params.savedDocs, params.team, month);
    const doc = isSelectedMonth ? params.currentDoc : savedDoc;
    const net = calculateSettlementParts(doc).net;
    const reserveTarget = getReserveTarget(params.reservePolicies, params.team, month);
    const monthTransactions = params.transactions.filter(
      (transaction) => transactionMatchesTeam(transaction, params.team) && getTransactionYearMonth(transaction) === month
    );
    const debtCollected = sumTransactions(monthTransactions, (row) => row.category === 'TEAM_DEBT_COLLECTION');
    const payoutRecorded = sumTransactions(monthTransactions, (row) => row.category === 'TEAM_SETTLEMENT_PAYOUT');

    const positiveNet = Math.max(0, net);
    const negativeNet = Math.max(0, -net);
    const priorDebtCarryover = debtCarryover;
    const priorReserveCarryover = reserveBalance;
    const reserveDrawdown = Math.min(priorReserveCarryover, negativeNet);
    const reserveAfterDrawdown = Math.max(0, priorReserveCarryover - reserveDrawdown);
    const debtBeforeCollection = priorDebtCarryover + Math.max(0, negativeNet - reserveDrawdown);
    const debtCollectionApplied = Math.min(debtBeforeCollection, Math.max(0, debtCollected));
    const debtAfterCollection = Math.max(0, debtBeforeCollection - debtCollectionApplied);
    const debtApplied = Math.min(positiveNet, debtAfterCollection);
    const debtOutstanding = Math.max(0, debtAfterCollection - debtApplied);
    const afterDebt = Math.max(0, positiveNet - debtApplied);
    const reserveRequired = Math.max(0, reserveTarget - reserveAfterDrawdown);
    const reserveApplied = Math.min(afterDebt, reserveRequired);
    const closingReserveBalance = reserveAfterDrawdown + reserveApplied;
    const reserveOutstanding = Math.max(0, reserveTarget - closingReserveBalance);
    const payoutDue = Math.max(0, afterDebt - reserveApplied);
    const payoutOutstanding = Math.max(0, payoutDue - payoutRecorded);

    const state: TeamSettlementLedgerState = {
      priorDebtCarryover,
      priorReserveCarryover,
      reserveTarget,
      reserveDrawdown,
      debtDue: debtBeforeCollection,
      debtApplied,
      reserveRequired,
      reserveApplied,
      reserveBalance: closingReserveBalance,
      payoutDue,
      payoutRecorded,
      debtCollected,
      payoutOutstanding,
      debtOutstanding,
      reserveOutstanding
    };

    if (isSelectedMonth) selectedState = state;
    debtCarryover = debtOutstanding;
    reserveBalance = closingReserveBalance;
  });

  return (
    selectedState ?? {
      priorDebtCarryover: 0,
      priorReserveCarryover: 0,
      reserveTarget: 0,
      reserveDrawdown: 0,
      debtDue: 0,
      debtApplied: 0,
      reserveRequired: 0,
      reserveApplied: 0,
      reserveBalance: 0,
      payoutDue: 0,
      payoutRecorded: 0,
      debtCollected: 0,
      payoutOutstanding: 0,
      debtOutstanding: 0,
      reserveOutstanding: 0
    }
  );
};

const buildTeamSettlementRows = (
  teams: Team[],
  docs: Array<TeamSettlementDocument | null>,
  transactions: OfficeTransaction[],
  yearMonth: string,
  savedDocs: TeamSettlementDocument[],
  reservePolicies: TeamReservePolicy[],
  errors: Record<string, string>
): TeamSettlementRow[] =>
  teams.map((team, index) => {
    const teamId = getTeamId(team);
    const teamName = toText(team.name) || teamId || '팀 미지정';
    const doc = docs[index];
    const { salesTotal, purchasesTotal, deductionsTotal, additionsTotal, net, officeFee } = calculateSettlementParts(doc);
    const ledger = buildLedgerState({
      team,
      selectedYearMonth: yearMonth,
      currentDoc: doc,
      savedDocs,
      transactions,
      reservePolicies
    });

    return {
      teamId,
      teamName,
      doc,
      confirmedAt: doc?.confirmedAt ?? null,
      salesTotal,
      purchasesTotal,
      deductionsTotal,
      additionsTotal,
      officeFee,
      net,
      priorDebtCarryover: ledger.priorDebtCarryover,
      priorReserveCarryover: ledger.priorReserveCarryover,
      reserveTarget: ledger.reserveTarget,
      reserveDrawdown: ledger.reserveDrawdown,
      debtApplied: ledger.debtApplied,
      reserveApplied: ledger.reserveApplied,
      reserveRequired: ledger.reserveRequired,
      reserveBalance: ledger.reserveBalance,
      reserveOutstanding: ledger.reserveOutstanding,
      payoutDue: ledger.payoutDue,
      debtDue: ledger.debtDue,
      payoutRecorded: ledger.payoutRecorded,
      debtCollected: ledger.debtCollected,
      payoutOutstanding: ledger.payoutOutstanding,
      debtOutstanding: ledger.debtOutstanding,
      loadError: errors[teamId]
    };
  });

const getStatusBadge = (row: TeamSettlementRow) => {
  if (row.loadError) return { label: '오류', className: 'border-red-200 bg-red-50 text-red-700' };
  if (row.debtOutstanding > 0) return { label: '마이너스 이월', className: 'border-rose-200 bg-rose-50 text-rose-700' };
  if (row.reserveOutstanding > 0) return { label: '유보금 미충당', className: 'border-sky-200 bg-sky-50 text-sky-700' };
  if (row.reserveDrawdown > 0) return { label: '유보금 차감', className: 'border-violet-200 bg-violet-50 text-violet-700' };
  if (row.payoutOutstanding > 0) return { label: '지급대기', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  if (row.payoutDue === 0 && row.net === 0) return { label: '정산없음', className: 'border-slate-200 bg-slate-50 text-slate-600' };
  return { label: '처리완료', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
};

const OfficeTeamSettlementManagementPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [yearMonth, setYearMonth] = useState(() => getYearMonthFromSearchParams(searchParams) ?? getCurrentYearMonth());
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamSettlementDocs, setTeamSettlementDocs] = useState<Array<TeamSettlementDocument | null>>([]);
  const [savedSettlementDocs, setSavedSettlementDocs] = useState<TeamSettlementDocument[]>([]);
  const [reservePolicies, setReservePolicies] = useState<TeamReservePolicy[]>([]);
  const [settlementErrors, setSettlementErrors] = useState<Record<string, string>>({});
  const [transactions, setTransactions] = useState<OfficeTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const nextYearMonth = getYearMonthFromSearchParams(searchParams) ?? getCurrentYearMonth();
    setYearMonth((prev) => (prev === nextYearMonth ? prev : nextYearMonth));
  }, [searchParams]);

  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const shouldKeepYearMonth =
        yearMonth !== getCurrentYearMonth() || prev.has('yearMonth') || prev.has('month');

      if (shouldKeepYearMonth) {
        next.set('yearMonth', yearMonth);
      } else {
        next.delete('yearMonth');
      }
      next.delete('month');

      return next.toString() === prev.toString() ? prev : next;
    }, { replace: true });
  }, [setSearchParams, yearMonth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [teamRows, companyRows, transactionRows, configRowsResult] = await Promise.all([
        teamService.getTeams(),
        companyService.getCompanies(),
        officeService.getAllTransactions(),
        listSystemConfigs()
      ]);
      const configRows = extractSystemConfigRows(configRowsResult);
      const persistedSettlementDocs = parseSavedSettlementDocs(configRows);
      const persistedReservePolicies = parseReservePolicies(configRows);

      const sortedTeams = buildCheongyeonEngTeams(teamRows, companyRows);
      const settlementResults = await Promise.allSettled(
        sortedTeams.map((team) => {
          const teamId = getTeamId(team);
          if (!teamId) return Promise.resolve(null);
          return teamSettlementService.getTeamSettlement({ yearMonth, teamId });
        })
      );

      const nextErrors: Record<string, string> = {};
      const docs = settlementResults.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        const teamId = getTeamId(sortedTeams[index]);
        nextErrors[teamId] = '팀정산 데이터를 불러오지 못했습니다.';
        console.error('[OfficeTeamSettlementManagementPage] settlement load failed:', result.reason);
        return null;
      });

      const priorMonths = getPriorMonthsInSelectedYear(yearMonth);
      const historicalRequests = priorMonths.flatMap((month) =>
        sortedTeams.flatMap((team) => {
          const teamId = getTeamId(team);
          if (!teamId || getSavedSettlementDoc(persistedSettlementDocs, team, month)) return [];
          return [
            teamSettlementService.getTeamSettlement({ yearMonth: month, teamId })
          ];
        })
      );
      const historicalResults = await Promise.allSettled(historicalRequests);
      const historicalDocs = historicalResults.flatMap((result) => {
        if (result.status === 'fulfilled') return [result.value];
        console.error('[OfficeTeamSettlementManagementPage] historical settlement load failed:', result.reason);
        return [];
      });

      setTeams(sortedTeams);
      setTeamSettlementDocs(docs);
      setSavedSettlementDocs(mergeSettlementDocs([...persistedSettlementDocs, ...historicalDocs]));
      setReservePolicies(persistedReservePolicies);
      setSettlementErrors(nextErrors);
      setTransactions([...transactionRows].sort((left, right) => String(right.date).localeCompare(String(left.date), 'ko-KR')));
    } catch (error) {
      console.error('[OfficeTeamSettlementManagementPage] load failed:', error);
      setLoadError('팀정산 관리 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teamRows = useMemo(
    () => buildTeamSettlementRows(teams, teamSettlementDocs, transactions, yearMonth, savedSettlementDocs, reservePolicies, settlementErrors),
    [reservePolicies, savedSettlementDocs, settlementErrors, teamSettlementDocs, teams, transactions, yearMonth]
  );

  const summary = useMemo(
    () => ({
      officeFee: teamRows.reduce((sum, row) => sum + row.officeFee, 0),
      debtCarryover: teamRows.reduce((sum, row) => sum + row.debtOutstanding, 0),
      reserveOutstanding: teamRows.reduce((sum, row) => sum + row.reserveOutstanding, 0),
      reserveApplied: teamRows.reduce((sum, row) => sum + row.reserveApplied, 0),
      reserveDrawdown: teamRows.reduce((sum, row) => sum + row.reserveDrawdown, 0),
      reserveBalance: teamRows.reduce((sum, row) => sum + row.reserveBalance, 0),
      payoutDue: teamRows.reduce((sum, row) => sum + row.payoutDue, 0),
      payoutRecorded: teamRows.reduce((sum, row) => sum + row.payoutRecorded, 0),
      debtCollected: teamRows.reduce((sum, row) => sum + row.debtCollected, 0),
      payoutOutstanding: teamRows.reduce((sum, row) => sum + row.payoutOutstanding, 0),
      debtOutstanding: teamRows.reduce((sum, row) => sum + row.debtOutstanding, 0),
      confirmedCount: teamRows.filter((row) => row.confirmedAt).length
    }),
    [teamRows]
  );

  const handleConfirmSettlement = useCallback(
    async (row: TeamSettlementRow) => {
      if (!row.doc || !row.teamId) return;
      const result = await Swal.fire({
        title: '팀정산 확정',
        text: `${row.teamName} ${yearMonth} 정산을 확정하고 사무실비를 반영합니다.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '확정',
        cancelButtonText: '취소'
      });
      if (!result.isConfirmed) return;

      await teamSettlementService.confirmTeamSettlement({ yearMonth, teamId: row.teamId });
      await officeService.syncTeamFeeFromSettlement(row.doc);
      toast.success('팀정산을 확정했습니다.');
      await loadData();
    },
    [loadData, yearMonth]
  );

  const handleReservePolicy = useCallback(
    async (row: TeamSettlementRow) => {
      if (!row.teamId) return;

      const result = await Swal.fire({
        title: '유보금 설정',
        html: `
          <div class="space-y-3 text-left">
            <div class="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              ${escapeHtml(row.teamName)} / ${escapeHtml(yearMonth)}
            </div>
            <label class="block text-sm font-semibold text-slate-700">목표 유보금</label>
            <input id="office-team-reserve-target" type="text" inputmode="numeric" value="${formatCurrency(row.reserveTarget)}" class="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm" />
            <div class="text-xs font-semibold text-slate-500">
              현재 유보 ${formatCurrency(row.priorReserveCarryover)}원을 기준으로 부족분만 지급 전에 충당합니다. 마이너스가 발생하면 유보 잔액에서 먼저 차감됩니다.
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '저장',
        cancelButtonText: '취소',
        preConfirm: () => {
          const reserveTarget = toFiniteNumber((document.getElementById('office-team-reserve-target') as HTMLInputElement | null)?.value);
          if (reserveTarget < 0) {
            Swal.showValidationMessage('유보금은 0원 이상으로 입력하세요.');
            return false;
          }
          return { reserveTarget };
        }
      });

      if (!result.isConfirmed || !result.value) return;

      await saveReservePolicy({
        yearMonth,
        teamId: row.teamId,
        reserveTarget: result.value.reserveTarget,
        updatedAt: new Date().toISOString()
      });
      toast.success('유보금 설정을 저장했습니다.');
      await loadData();
    },
    [loadData, yearMonth]
  );

  const recordTeamTransaction = useCallback(
    async (row: TeamSettlementRow, mode: 'payout' | 'collection') => {
      const isPayout = mode === 'payout';
      const outstanding = isPayout ? row.payoutOutstanding : row.debtOutstanding;
      if (outstanding <= 0) return;

      const defaultDate = getDefaultTransactionDate(yearMonth);
      const title = isPayout ? '팀 정산 지급 등록' : '팀 미수 입금 등록';
      const result = await Swal.fire({
        title,
        html: `
          <div class="space-y-3 text-left">
            <div class="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              ${escapeHtml(row.teamName)} / ${isPayout ? '지급 가능 잔액' : '마이너스 이월'} ${formatCurrency(outstanding)}원
            </div>
            <label class="block text-sm font-semibold text-slate-700">${isPayout ? '지급일' : '입금일'}</label>
            <input id="office-team-date" type="date" value="${defaultDate}" class="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            <label class="block text-sm font-semibold text-slate-700">금액</label>
            <input id="office-team-amount" type="text" inputmode="numeric" value="${formatCurrency(outstanding)}" class="w-full rounded border border-slate-300 px-3 py-2 text-right text-sm" />
            <label class="block text-sm font-semibold text-slate-700">메모</label>
            <input id="office-team-desc" type="text" class="w-full rounded border border-slate-300 px-3 py-2 text-sm" value="${escapeHtml(row.teamName)} ${isPayout ? '팀정산 지급' : '미수 입금'}" />
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '등록',
        cancelButtonText: '취소',
        preConfirm: () => {
          const date = (document.getElementById('office-team-date') as HTMLInputElement | null)?.value || defaultDate;
          const amount = toFiniteNumber((document.getElementById('office-team-amount') as HTMLInputElement | null)?.value);
          const description = toText((document.getElementById('office-team-desc') as HTMLInputElement | null)?.value);
          if (!date || amount <= 0) {
            Swal.showValidationMessage('날짜와 금액을 확인하세요.');
            return false;
          }
          return { date, amount: Math.min(amount, outstanding), description };
        }
      });

      if (!result.isConfirmed || !result.value) return;

      const now = new Date().toISOString();
      await officeService.setTransaction({
        id: buildTransactionId(isPayout ? 'team_payout' : 'team_debt_collection', [row.teamId, yearMonth]),
        date: result.value.date,
        type: isPayout ? 'expense' : 'income',
        category: isPayout ? 'TEAM_SETTLEMENT_PAYOUT' : 'TEAM_DEBT_COLLECTION',
        amount: result.value.amount,
        description: result.value.description || `${row.teamName} ${isPayout ? '팀정산 지급' : '미수 입금'}`,
        relatedTeamId: row.teamId,
        relatedYearMonth: yearMonth,
        source: 'team_settlement',
        createdAt: now,
        updatedAt: now
      });

      toast.success(isPayout ? '팀 정산 지급을 등록했습니다.' : '팀 미수 입금을 등록했습니다.');
      await loadData();
    },
    [loadData, yearMonth]
  );

  const summaryCards = [
    { label: '사무실비 공제', value: summary.officeFee, className: 'text-emerald-700', icon: Users },
    { label: '누적 마이너스', value: summary.debtCarryover, className: 'text-rose-700', icon: WalletCards },
    { label: '현재 유보', value: summary.reserveBalance, className: 'text-sky-700', icon: ShieldCheck },
    { label: '유보 차감', value: summary.reserveDrawdown, className: 'text-violet-700', icon: ShieldCheck },
    { label: '지급 가능', value: summary.payoutDue, className: 'text-amber-700', icon: Banknote },
    { label: '남은 지급', value: summary.payoutOutstanding, className: 'text-amber-700', icon: Banknote }
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 xl:p-6">
      <div className="mx-auto max-w-[1900px] space-y-4">
        <header className="flex flex-col gap-3 border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2">
              <Link to="/office/management" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900">
                <ArrowLeft size={14} />
                사무실 정산
              </Link>
            </div>
            <h1 className="text-xl font-black text-slate-950">사무실 팀정산 관리</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              팀정산 순액에서 마이너스는 유보 잔액으로 먼저 차감하고, 부족분과 목표 유보금을 정리한 뒤 남은 금액만 지급합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <YearMonthPicker
              value={yearMonth}
              onChange={setYearMonth}
              inputClassName="h-10 w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
            <Link
              to="/payroll/team-settlement"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800"
            >
              원본 팀정산
              <ExternalLink size={14} />
            </Link>
          </div>
        </header>

        {loadError ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{loadError}</div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">{card.label}</div>
                  <Icon size={18} className="text-slate-400" />
                </div>
                <div className={`mt-2 text-2xl font-black tabular-nums ${card.className}`}>{formatCurrency(card.value)}</div>
                <div className="mt-1 text-xs font-semibold text-slate-400">원</div>
              </div>
            );
          })}
        </section>

        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
              <Users size={18} className="text-slate-600" />
              팀정산 관리
            </h2>
            <div className="text-xs font-bold text-slate-500">
              확정 {summary.confirmedCount.toLocaleString('ko-KR')}팀 / 전체 {teamRows.length.toLocaleString('ko-KR')}팀
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[1700px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-600">
                  <th className="border-b border-slate-200 px-3 py-2 text-left">팀</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">사무실비</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">팀정산 순액</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">유보 목표</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">유보 차감</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">마이너스 충당</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">유보 충당</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">현재 유보</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">지급가능</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">지급완료</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">남은 지급</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">누적 마이너스</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-center">상태</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-center">확정</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.length > 0 ? (
                  teamRows.map((row) => {
                    const badge = getStatusBadge(row);
                    return (
                      <tr key={row.teamId || row.teamName} className="hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-3 py-2">
                          <div className="font-black text-slate-900">{row.teamName}</div>
                          <div className="mt-1 text-[11px] font-semibold text-slate-400">
                            전월 누적 마이너스 {formatCurrency(row.priorDebtCarryover)} / 전월 유보 {formatCurrency(row.priorReserveCarryover)}
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-right font-bold text-emerald-700 tabular-nums">
                          {formatCurrency(row.officeFee)}
                        </td>
                        <td className={`border-b border-slate-100 px-3 py-2 text-right font-black tabular-nums ${row.net >= 0 ? 'text-amber-700' : 'text-rose-700'}`}>
                          {formatSignedCurrency(row.net)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void handleReservePolicy(row)}
                            disabled={!row.teamId || loading}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 text-xs font-black text-sky-700 hover:bg-sky-100 disabled:opacity-40"
                          >
                            <Settings size={13} />
                            {formatCurrency(row.reserveTarget)}
                          </button>
                          <div className="mt-1 text-[11px] font-semibold text-slate-400">
                            부족 {formatCurrency(row.reserveOutstanding)}
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-right font-bold text-violet-700 tabular-nums">
                          {formatCurrency(row.reserveDrawdown)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums">
                          <div className="font-bold text-rose-700">{formatCurrency(row.debtApplied)}</div>
                          <div className="mt-1 text-[11px] font-semibold text-slate-400">입금 {formatCurrency(row.debtCollected)}</div>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-right font-bold text-sky-700 tabular-nums">
                          {formatCurrency(row.reserveApplied)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-right font-bold text-sky-700 tabular-nums">
                          {formatCurrency(row.reserveBalance)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-right font-black text-amber-700 tabular-nums">
                          {formatCurrency(row.payoutDue)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums">{formatCurrency(row.payoutRecorded)}</td>
                        <td className="border-b border-slate-100 px-3 py-2 text-right font-bold text-amber-700 tabular-nums">
                          {formatCurrency(row.payoutOutstanding)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-right font-bold text-rose-700 tabular-nums">
                          {formatCurrency(row.debtOutstanding)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-center">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-black ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-center">
                          {row.confirmedAt ? (
                            <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                              <CheckCircle2 size={14} />
                              확정
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleConfirmSettlement(row)}
                              disabled={!row.doc || loading}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              <CheckCircle2 size={14} />
                              확정
                            </button>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => void recordTeamTransaction(row, 'payout')}
                              disabled={row.payoutOutstanding <= 0 || loading}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-600 px-2 text-xs font-bold text-white hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400"
                            >
                              <Banknote size={14} />
                              지급
                            </button>
                            <button
                              type="button"
                              onClick={() => void recordTeamTransaction(row, 'collection')}
                              disabled={row.debtOutstanding <= 0 || loading}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-2 text-xs font-bold text-white hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400"
                            >
                              <WalletCards size={14} />
                              입금
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={15} className="px-4 py-8 text-center text-sm font-bold text-slate-400">
                      팀정산 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export { OfficeTeamSettlementManagementPage };
export default OfficeTeamSettlementManagementPage;
