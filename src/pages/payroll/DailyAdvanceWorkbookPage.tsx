import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faCalendarAlt,
  faSave,
  faSearch,
  faSpinner,
  faTable,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import {
  dailyAdvanceWorkbookProfileService,
  type DailyAdvanceWorkbookProfile,
} from '../../services/dailyAdvanceWorkbookProfileService';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { teamService, type Team } from '../../services/teamService';
import { storageService } from '../../services/storageService';
import DailyWageDraftPage from './DailyWageDraftPage';

type WorkbookTabKey =
  | 'input'
  | 'database'
  | 'workers'
  | 'team-summary'
  | 'statement'
  | 'day-lookup'
  | 'daily-wage';

type StatementPriceMode = 'actual' | 'claim' | 'report';

type GoyunjungCelebrationBurst = {
  id: number;
  imageUrl: string;
  messages: string[];
  position: {
    left: string;
    top: string;
    align: 'left' | 'center' | 'right';
  };
  hearts: Array<{
    id: string;
    left: number;
    size: number;
    duration: number;
    delay: number;
    drift: number;
  }>;
};

type WorkbookEntry = {
  key: string;
  reportId: string;
  date: string;
  day: number;
  teamKey: string;
  teamId: string;
  teamName: string;
  companyName: string;
  siteName: string;
  workerId: string;
  workerName: string;
  salaryType: string;
  idNumber: string;
  address: string;
  contact: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: string;
  manDay: number;
  actualUnitPrice: number;
  actualAmount: number;
  deductionAmount: number;
  claimUnitPrice: number;
  claimAmount: number;
  reportUnitPrice: number;
  recruiterFee: number;
  note: string;
};

type WorkerProfileDraft = {
  claimUnitPrice: string;
  recruiterFee: string;
  memo: string;
};

type TeamOption = {
  key: string;
  name: string;
  team: Team | null;
};

type WorkerMasterRow = {
  workerId: string;
  teamKey: string;
  teamName: string;
  workerName: string;
  salaryType: string;
  idNumber: string;
  address: string;
  contact: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  actualUnitPrice: number;
  claimUnitPrice: number;
  recruiterFee: number;
  memo: string;
  status: string;
  totalManDay: number;
  actualTotal: number;
  claimTotal: number;
};

const COLORS = {
  olive: '#4F6228',
  blue: '#0070C0',
  paleBlue: '#C6D9F1',
  paleYellow: '#FFFFCC',
  darkBrown: '#4A452A',
  blackBrown: '#1E1C11',
  goldBrown: '#948A54',
  beige: '#C4BD97',
  orange: '#FFC000',
  pink: '#E6B9B8',
  red: '#C00000',
  brightYellow: '#FFFF00',
  aqua: '#B7DEE8',
  wine: '#953735',
};

const TAB_OPTIONS: Array<{ key: WorkbookTabKey; label: string }> = [
  { key: 'input', label: '입력표' },
  { key: 'database', label: 'DB' },
  { key: 'workers', label: '인원DB' },
  { key: 'team-summary', label: '팀별출력' },
  { key: 'statement', label: '청구서' },
  { key: 'day-lookup', label: '일자별조회' },
  { key: 'daily-wage', label: '일급제' },
];

const STATEMENT_PRICE_MODE_OPTIONS: Array<{
  key: StatementPriceMode;
  label: string;
  amountLabel: string;
  buttonClassName: string;
}> = [
  {
    key: 'actual',
    label: '지급단가',
    amountLabel: '노무지급금',
    buttonClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  {
    key: 'claim',
    label: '청구단가',
    amountLabel: '노무청구금',
    buttonClassName: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  {
    key: 'report',
    label: '신고단가',
    amountLabel: '노무신고금',
    buttonClassName: 'border-sky-200 bg-sky-50 text-sky-700',
  },
];

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

const normalizeTeamName = (value: unknown): string =>
  String(value ?? '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, '')
    .trim();

const displayText = (value: unknown): string => String(value ?? '').trim();

const isDailyWageLabel = (value: unknown): boolean => {
  const normalized = normalizeText(value);
  return normalized.includes('일급제') || normalized.includes('일급');
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: number, digits = 1): string => {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value % 1) < 0.000001) {
    return value.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  }

  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatCurrency = (value: number): string =>
  `${Math.round(value || 0).toLocaleString('ko-KR')}`;

const parseMoneyInput = (value: string): number => {
  const sanitized = String(value ?? '').replace(/[^\d.-]/g, '').trim();
  if (!sanitized) return 0;
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthToPeriod = (month: string): { startDate: string; endDate: string; lastDay: number } => {
  const [yearRaw, monthRaw] = String(month ?? '').split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw);
  if (!year || !monthIndex) {
    return { startDate: '', endDate: '', lastDay: 31 };
  }

  const lastDay = new Date(year, monthIndex, 0).getDate();
  return {
    startDate: `${yearRaw}-${monthRaw}-01`,
    endDate: `${yearRaw}-${monthRaw}-${String(lastDay).padStart(2, '0')}`,
    lastDay,
  };
};

const getMonthTitle = (month: string): string => {
  const [yearRaw, monthRaw] = String(month ?? '').split('-');
  if (!yearRaw || !monthRaw) return month;
  return `${yearRaw}년 ${Number(monthRaw)}월`;
};
const getDayNumber = (date: string): number => {
  const match = String(date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 0;
  return Number(match[3]) || 0;
};

const getDefaultClaimUnitPrice = (actualUnitPrice: number): number => {
  if (!actualUnitPrice) return 0;
  return actualUnitPrice + 15000;
};

const getSalaryTypeLabel = (...values: Array<unknown>): string => {
  const labels = values.map((value) => displayText(value)).filter(Boolean);
  const matched = labels.find((label) => isDailyWageLabel(label));
  return matched || labels[0] || '일급제';
};

const resolveWorkerStableId = (worker?: Partial<Worker> | null): string => {
  if (!worker) return '';
  return (
    String(worker.id ?? '').trim() ||
    String(worker.legacyId ?? '').trim() ||
    normalizeText(worker.name)
  );
};

const buildEmptyDraft = (): WorkerProfileDraft => ({
  claimUnitPrice: '',
  recruiterFee: '',
  memo: '',
});

const GOYUNJUNG_MODE_STORAGE_KEY = 'daily-advance-workbook:goyunjung-mode';
const DAILY_ADVANCE_STATEMENT_DEDUCTION_STORAGE_KEY =
  'daily-advance-workbook:statement-deductions';
const DAILY_ADVANCE_DAILY_WAGE_DEDUCTION_STORAGE_KEY =
  'daily-advance-workbook:daily-wage-deductions';
const GOYUNJUNG_IMAGE_ROOTS = ['goyumjung', 'goyunjung'];
const GOYUNJUNG_MESSAGES = [
  '경복 오빠 화이팅',
  '경복 오빠 제가 있잔아요',
  '경복 오빠 힘내세요',
];

const GOYUNJUNG_SAFE_POSITIONS: Array<{
  left: string;
  top: string;
  align: 'left' | 'center' | 'right';
}> = [
  { left: '6%', top: '10%', align: 'left' },
  { left: '74%', top: '10%', align: 'right' },
  { left: '5%', top: '58%', align: 'left' },
  { left: '75%', top: '58%', align: 'right' },
  { left: '10%', top: '32%', align: 'left' },
  { left: '70%', top: '34%', align: 'right' },
];

const DailyAdvanceWorkbookPage: React.FC = () => {
  const currentMonth = getCurrentMonth();
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState(monthToPeriod(currentMonth).endDate);
  const [selectedTeamKey, setSelectedTeamKey] = useState('ALL');
  const [statementTeamKey, setStatementTeamKey] = useState('');
  const [statementPriceMode, setStatementPriceMode] = useState<StatementPriceMode>('claim');
  const [statementActualDeductionDraft, setStatementActualDeductionDraft] = useState(0);
  const [statementClaimDeductionDraft, setStatementClaimDeductionDraft] = useState(0);
  const [statementReportDeductionDraft, setStatementReportDeductionDraft] = useState(0);
  const [statementActualDeductionApplied, setStatementActualDeductionApplied] = useState(0);
  const [statementClaimDeductionApplied, setStatementClaimDeductionApplied] = useState(0);
  const [statementReportDeductionApplied, setStatementReportDeductionApplied] = useState(0);
  const [activeTab, setActiveTab] = useState<WorkbookTabKey>('input');
  const [entries, setEntries] = useState<WorkbookEntry[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Record<string, DailyAdvanceWorkbookProfile>>({});
  const [profileDrafts, setProfileDrafts] = useState<Record<string, WorkerProfileDraft>>({});
  const [loading, setLoading] = useState(false);
  const [savingProfiles, setSavingProfiles] = useState(false);
  const [isGoyunjungMode, setIsGoyunjungMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(GOYUNJUNG_MODE_STORAGE_KEY) === 'true';
  });
  const [goyunjungImagePaths, setGoyunjungImagePaths] = useState<string[]>([]);
  const [goyunjungBackgroundUrl, setGoyunjungBackgroundUrl] = useState('');
  const [goyunjungCurrentPath, setGoyunjungCurrentPath] = useState('');
  const [goyunjungBursts, setGoyunjungBursts] = useState<GoyunjungCelebrationBurst[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(DAILY_ADVANCE_STATEMENT_DEDUCTION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        actual: number;
        claim: number;
        report: number;
      }>;
      const actual = Number(parsed.actual) || 0;
      const claim = Number(parsed.claim) || 0;
      const report = Number(parsed.report) || 0;

      setStatementActualDeductionDraft(actual);
      setStatementClaimDeductionDraft(claim);
      setStatementReportDeductionDraft(report);
      setStatementActualDeductionApplied(actual);
      setStatementClaimDeductionApplied(claim);
      setStatementReportDeductionApplied(report);
    } catch (error) {
      console.warn('Failed to load statement deduction preset:', error);
    }
  }, []);

  useEffect(() => {
    if (!selectedDate.startsWith(month)) {
      setSelectedDate(monthToPeriod(month).endDate);
    }
  }, [month, selectedDate]);

  const loadGoyunjungImagePaths = useCallback(async (): Promise<string[]> => {
    if (goyunjungImagePaths.length > 0) return goyunjungImagePaths;

    const imagePathSet = new Set<string>();
    const pendingPaths = [...GOYUNJUNG_IMAGE_ROOTS];
    const visitedPaths = new Set<string>();

    while (pendingPaths.length > 0) {
      const currentPath = pendingPaths.shift();
      if (!currentPath) continue;
      if (visitedPaths.has(currentPath)) continue;
      visitedPaths.add(currentPath);

      let items;
      try {
        items = await storageService.listFiles(currentPath);
      } catch (error) {
        console.warn(`Failed to list storage path: ${currentPath}`, error);
        continue;
      }

      items.forEach((item) => {
        if (item.isFolder) {
          pendingPaths.push(item.fullPath);
          return;
        }

        if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(item.fullPath)) {
          imagePathSet.add(item.fullPath);
        }
      });
    }

    const imagePaths = Array.from(imagePathSet);
    setGoyunjungImagePaths(imagePaths);
    return imagePaths;
  }, [goyunjungImagePaths]);

  const applyRandomGoyunjungBackground = useCallback(
    async (paths?: string[]) => {
      const candidates = paths && paths.length > 0 ? paths : await loadGoyunjungImagePaths();
      if (candidates.length === 0) {
        setGoyunjungBackgroundUrl('');
        setGoyunjungCurrentPath('');
        return;
      }

      const availableCandidates =
        candidates.length > 1 && goyunjungCurrentPath
          ? candidates.filter((candidate) => candidate !== goyunjungCurrentPath)
          : candidates;
      const pool = availableCandidates.length > 0 ? availableCandidates : candidates;
      const randomPath = pool[Math.floor(Math.random() * pool.length)];
      const downloadUrl = await storageService.getDownloadUrl(randomPath);
      const burstId = Date.now() + Math.floor(Math.random() * 1000);
      const safePositions =
        typeof window !== 'undefined' && window.innerWidth < 1024
          ? [{ left: '50%', top: '8%', align: 'center' as const }]
          : GOYUNJUNG_SAFE_POSITIONS;
      const position = safePositions[Math.floor(Math.random() * safePositions.length)];
      const nextBurst: GoyunjungCelebrationBurst = {
        id: burstId,
        imageUrl: downloadUrl,
        messages: GOYUNJUNG_MESSAGES,
        position,
        hearts: Array.from({ length: 18 }, (_, index) => ({
          id: `${burstId}-${index}`,
          left:
            position.align === 'left'
              ? 8 + Math.random() * 24
              : position.align === 'right'
                ? 68 + Math.random() * 24
                : 26 + Math.random() * 48,
          size: 14 + Math.round(Math.random() * 18),
          duration: 2.6 + Math.random() * 1.8,
          delay: Math.random() * 0.8,
          drift: -80 + Math.random() * 160,
        })),
      };

      setGoyunjungCurrentPath(randomPath);
      setGoyunjungBackgroundUrl(downloadUrl);
      setGoyunjungBursts((prev) => [...prev, nextBurst]);

      window.setTimeout(() => {
        setGoyunjungBursts((prev) => prev.filter((burst) => burst.id !== burstId));
      }, 4200);
    },
    [goyunjungCurrentPath, loadGoyunjungImagePaths]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      GOYUNJUNG_MODE_STORAGE_KEY,
      isGoyunjungMode ? 'true' : 'false'
    );
  }, [isGoyunjungMode]);

  useEffect(() => {
    if (!isGoyunjungMode) {
      setGoyunjungBackgroundUrl('');
      setGoyunjungCurrentPath('');
      setGoyunjungBursts([]);
      return;
    }

    let cancelled = false;

    const loadBackground = async () => {
      try {
        const paths = await loadGoyunjungImagePaths();
        if (cancelled) return;
        if (paths.length === 0) {
          setGoyunjungBackgroundUrl('');
          return;
        }

        if (!cancelled) {
          await applyRandomGoyunjungBackground(paths);
        }
      } catch (error) {
        console.error('Failed to load goyunjung background images:', error);
        if (!cancelled) {
          setGoyunjungBackgroundUrl('');
          setGoyunjungCurrentPath('');
        }
      }
    };

    void loadBackground();

    const intervalId = window.setInterval(() => {
      void applyRandomGoyunjungBackground();
    }, 9000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyRandomGoyunjungBackground, isGoyunjungMode, loadGoyunjungImagePaths]);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const period = monthToPeriod(month);
      const [reportRows, workerRows, teamRows, profileRows] = await Promise.all([
        dailyReportService.getWorkerRows({ startDate: period.startDate, endDate: period.endDate }),
        manpowerService.getWorkers(),
        teamService.getTeams(),
        dailyAdvanceWorkbookProfileService.getProfiles(),
      ]);

      const workerByAnyId = new Map<string, Worker>();
      const workerByName = new Map<string, Worker>();
      workerRows.forEach((worker) => {
        const stableId = resolveWorkerStableId(worker);
        const currentId = String(worker.id ?? '').trim();
        const legacyId = String(worker.legacyId ?? '').trim();
        const nameKey = normalizeText(worker.name);
        if (currentId) workerByAnyId.set(currentId, worker);
        if (legacyId && !workerByAnyId.has(legacyId)) workerByAnyId.set(legacyId, worker);
        if (stableId && !workerByAnyId.has(stableId)) workerByAnyId.set(stableId, worker);
        if (nameKey && !workerByName.has(nameKey)) workerByName.set(nameKey, worker);
      });

      const teamByAnyId = new Map<string, Team>();
      const teamByName = new Map<string, Team>();
      teamRows.forEach((team) => {
        const currentId = String(team.id ?? '').trim();
        const legacyId = String(team.legacyId ?? '').trim();
        const nameKey = normalizeTeamName(team.name);
        if (currentId) teamByAnyId.set(currentId, team);
        if (legacyId && !teamByAnyId.has(legacyId)) teamByAnyId.set(legacyId, team);
        if (nameKey && !teamByName.has(nameKey)) teamByName.set(nameKey, team);
      });

      const nextProfiles: Record<string, DailyAdvanceWorkbookProfile> = {};
      profileRows.forEach((profile) => {
        const workerId = String(profile.workerId ?? '').trim();
        if (!workerId) return;
        nextProfiles[workerId] = profile;
      });

      const nextEntries = reportRows
        .map((row) => {
          const worker =
            workerByAnyId.get(String(row.workerId ?? '').trim()) ||
            workerByName.get(normalizeText(row.workerName || row.name));

          const labels = [row.salaryModel, row.payType, worker?.salaryModel, worker?.payType];
          if (!labels.some((label) => isDailyWageLabel(label))) return null;

          const workerId =
            resolveWorkerStableId(worker) ||
            String(row.workerId ?? '').trim() ||
            normalizeText(row.workerName || row.name);

          const workerName = displayText(worker?.name || row.workerName || row.name || '');
          const team =
            teamByAnyId.get(String(row.workerTeamId ?? '').trim()) ||
            teamByAnyId.get(String(row.teamId ?? '').trim()) ||
            teamByAnyId.get(String(worker?.teamId ?? '').trim()) ||
            teamByName.get(normalizeTeamName(row.workerTeamName || worker?.teamName || row.teamName || '')) ||
            null;

          const teamName = displayText(
            team?.name || row.workerTeamName || worker?.teamName || row.teamName || '미지정팀'
          );
          const teamId = String(team?.id ?? row.workerTeamId ?? row.teamId ?? worker?.teamId ?? '').trim();
          const teamKey = teamId || `unresolved:${normalizeTeamName(teamName || workerName || 'unknown')}`;

          const actualUnitPrice = toNumber(row.unitPrice || worker?.unitPrice || 0);
          const profile = nextProfiles[workerId];
          const claimUnitPrice = toNumber(
            profile?.claimUnitPrice ?? getDefaultClaimUnitPrice(actualUnitPrice)
          );
          const reportUnitPrice = actualUnitPrice;
          const recruiterFee = toNumber(profile?.recruiterFee ?? 0);
          const manDay = toNumber(row.manDay);
          const date = displayText(row.date);
          const day = getDayNumber(date);
          const note = displayText(row.workContent || profile?.memo || '');
          const salaryType = getSalaryTypeLabel(
            worker?.salaryModel,
            row.salaryModel,
            worker?.payType,
            row.payType
          );

          return {
            key: `${date}__${teamKey}__${workerId}__${String(row.reportId ?? '')}`,
            reportId: String(row.reportId ?? ''),
            date,
            day,
            teamKey,
            teamId,
            teamName,
            companyName: displayText(team?.companyName || worker?.companyName || ''),
            siteName: displayText(row.siteName || worker?.siteName || ''),
            workerId,
            workerName,
            salaryType,
            idNumber: displayText(worker?.idNumber || ''),
            address: displayText(worker?.address || ''),
            contact: displayText(worker?.contact || ''),
            bankName: displayText(worker?.bankName || ''),
            accountNumber: displayText(worker?.accountNumber || ''),
            accountHolder: displayText(worker?.accountHolder || worker?.name || ''),
            status: displayText(worker?.status || ''),
            manDay,
            actualUnitPrice,
            actualAmount: manDay * actualUnitPrice,
            deductionAmount: 0,
            claimUnitPrice,
            claimAmount: manDay * claimUnitPrice,
            reportUnitPrice,
            recruiterFee,
            note,
          } satisfies WorkbookEntry;
        })
        .filter((entry): entry is WorkbookEntry => Boolean(entry))
        .sort((left, right) => {
          const dateCompare = left.date.localeCompare(right.date);
          if (dateCompare !== 0) return dateCompare;
          const teamCompare = left.teamName.localeCompare(right.teamName, 'ko');
          if (teamCompare !== 0) return teamCompare;
          return left.workerName.localeCompare(right.workerName, 'ko');
        });

      setEntries(nextEntries);
      setWorkers(workerRows);
      setTeams(teamRows);
      setProfiles(nextProfiles);
    } catch (error) {
      console.error('Failed to load daily advance workbook data:', error);
      window.alert('대납출력부 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const dailyWageWorkers = useMemo(() => {
    return workers
      .filter((worker) => isDailyWageLabel(worker.salaryModel) || isDailyWageLabel(worker.payType))
      .sort((left, right) => {
        const leftTeam = displayText(left.teamName || '');
        const rightTeam = displayText(right.teamName || '');
        const teamCompare = leftTeam.localeCompare(rightTeam, 'ko');
        if (teamCompare !== 0) return teamCompare;
        return displayText(left.name).localeCompare(displayText(right.name), 'ko');
      });
  }, [workers]);

  const teamOptions = useMemo<TeamOption[]>(() => {
    const optionMap = new Map<string, TeamOption>();
    entries.forEach((entry) => {
      if (!entry.teamKey || optionMap.has(entry.teamKey)) return;
      const team = teams.find((candidate) => String(candidate.id ?? '').trim() === entry.teamId) || null;
      optionMap.set(entry.teamKey, {
        key: entry.teamKey,
        name: entry.teamName,
        team,
      });
    });
    return Array.from(optionMap.values()).sort((left, right) => left.name.localeCompare(right.name, 'ko'));
  }, [entries, teams]);

  useEffect(() => {
    if (selectedTeamKey !== 'ALL' && !teamOptions.some((option) => option.key === selectedTeamKey)) {
      setSelectedTeamKey('ALL');
    }

    if (!teamOptions.length) {
      setStatementTeamKey('');
      return;
    }

    if (!statementTeamKey || !teamOptions.some((option) => option.key === statementTeamKey)) {
      setStatementTeamKey(teamOptions[0].key);
    }
  }, [selectedTeamKey, statementTeamKey, teamOptions]);

  const allWorkerMasterRows = useMemo<WorkerMasterRow[]>(() => {
    return dailyWageWorkers.map((worker) => {
      const workerId = resolveWorkerStableId(worker);
      const workerEntries = entries.filter((entry) => entry.workerId === workerId);
      const actualUnitPrice = toNumber(worker.unitPrice);
      const profile = profiles[workerId];
      const claimUnitPrice = toNumber(
        profile?.claimUnitPrice ?? getDefaultClaimUnitPrice(actualUnitPrice)
      );
      const recruiterFee = toNumber(profile?.recruiterFee ?? 0);
      const memo = displayText(profile?.memo || '');
      const totalManDay = workerEntries.reduce((sum, entry) => sum + entry.manDay, 0);
      const actualTotal = workerEntries.reduce((sum, entry) => sum + entry.actualAmount, 0);
      const claimTotal = workerEntries.reduce((sum, entry) => sum + entry.claimAmount, 0);
      const teamName = displayText(worker.teamName || workerEntries[0]?.teamName || '미지정팀');
      const teamKey =
        String(worker.teamId ?? '').trim() ||
        workerEntries[0]?.teamKey ||
        `unresolved:${normalizeTeamName(teamName || worker.name)}`;

      return {
        workerId,
        teamKey,
        teamName,
        workerName: displayText(worker.name),
        salaryType: getSalaryTypeLabel(worker.salaryModel, worker.payType, workerEntries[0]?.salaryType),
        idNumber: displayText(worker.idNumber || ''),
        address: displayText(worker.address || ''),
        contact: displayText(worker.contact || ''),
        bankName: displayText(worker.bankName || ''),
        accountNumber: displayText(worker.accountNumber || ''),
        accountHolder: displayText(worker.accountHolder || worker.name || ''),
        actualUnitPrice,
        claimUnitPrice,
        recruiterFee,
        memo,
        status: displayText(worker.status || ''),
        totalManDay,
        actualTotal,
        claimTotal,
      };
    });
  }, [dailyWageWorkers, entries, profiles]);

  const workerMasterRows = useMemo(() => {
    if (selectedTeamKey === 'ALL') return allWorkerMasterRows;
    return allWorkerMasterRows.filter((row) => row.teamKey === selectedTeamKey);
  }, [allWorkerMasterRows, selectedTeamKey]);

  useEffect(() => {
    const nextDrafts: Record<string, WorkerProfileDraft> = {};
    allWorkerMasterRows.forEach((row) => {
      nextDrafts[row.workerId] = {
        claimUnitPrice: row.claimUnitPrice ? String(row.claimUnitPrice) : '',
        recruiterFee: row.recruiterFee ? String(row.recruiterFee) : '',
        memo: row.memo || '',
      };
    });
    setProfileDrafts((prev) => ({ ...nextDrafts, ...prev }));
  }, [allWorkerMasterRows]);

  const filteredEntries = useMemo(() => {
    if (selectedTeamKey === 'ALL') return entries;
    return entries.filter((entry) => entry.teamKey === selectedTeamKey);
  }, [entries, selectedTeamKey]);

  const selectedDateEntries = useMemo(() => {
    return filteredEntries.filter((entry) => entry.date === selectedDate);
  }, [filteredEntries, selectedDate]);

  const workbookStats = useMemo(() => {
    const totalManDay = filteredEntries.reduce((sum, entry) => sum + entry.manDay, 0);
    const totalActualAmount = filteredEntries.reduce((sum, entry) => sum + entry.actualAmount, 0);
    const totalClaimAmount = filteredEntries.reduce((sum, entry) => sum + entry.claimAmount, 0);
    const workerCount = new Set(filteredEntries.map((entry) => entry.workerId)).size;
    const teamCount = new Set(filteredEntries.map((entry) => entry.teamKey)).size;

    return {
      totalManDay,
      totalActualAmount,
      totalClaimAmount,
      workerCount,
      teamCount,
    };
  }, [filteredEntries]);

  const statementTeamOption = useMemo(
    () => teamOptions.find((option) => option.key === statementTeamKey) || null,
    [statementTeamKey, teamOptions]
  );

  const statementPriceOption = useMemo(
    () =>
      STATEMENT_PRICE_MODE_OPTIONS.find((option) => option.key === statementPriceMode) ||
      STATEMENT_PRICE_MODE_OPTIONS[1],
    [statementPriceMode]
  );

  const statementAppliedDeductionMap = useMemo(
    () => ({
      actual: statementActualDeductionApplied,
      claim: statementClaimDeductionApplied,
      report: statementReportDeductionApplied,
    }),
    [
      statementActualDeductionApplied,
      statementClaimDeductionApplied,
      statementReportDeductionApplied,
    ]
  );

  const getStatementBaseUnitPrice = useCallback(
    (entry: WorkbookEntry, mode: StatementPriceMode): number => {
      if (mode === 'actual') return entry.actualUnitPrice;
      if (mode === 'report') return entry.reportUnitPrice;
      return entry.claimUnitPrice;
    },
    []
  );

  const getStatementAdjustedUnitPrice = useCallback(
    (entry: WorkbookEntry, mode: StatementPriceMode): number => {
      const deduction = statementAppliedDeductionMap[mode] || 0;
      return Math.max(0, getStatementBaseUnitPrice(entry, mode) - deduction);
    },
    [getStatementBaseUnitPrice, statementAppliedDeductionMap]
  );

  const getStatementAmount = useCallback(
    (entry: WorkbookEntry, mode: StatementPriceMode): number => {
      return entry.manDay * getStatementAdjustedUnitPrice(entry, mode);
    },
    [getStatementAdjustedUnitPrice]
  );

  const statementEntries = useMemo(() => {
    if (!statementTeamKey) return [];
    return entries.filter((entry) => entry.teamKey === statementTeamKey);
  }, [entries, statementTeamKey]);

  const statementLastDay = useMemo(() => monthToPeriod(month).lastDay, [month]);
  const statementDayNumbers = useMemo(
    () => Array.from({ length: statementLastDay }, (_, index) => index + 1),
    [statementLastDay]
  );

  const statementRows = useMemo(() => {
    const rowMap = new Map<
      string,
      {
        workerId: string;
        workerName: string;
        idNumber: string;
        address: string;
        days: number[];
        totalManDay: number;
        recruiterFee: number;
        selectedAmount: number;
      }
    >();

    statementEntries.forEach((entry) => {
      const key = entry.workerId || normalizeText(entry.workerName);
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          workerId: entry.workerId,
          workerName: entry.workerName,
          idNumber: entry.idNumber,
          address: entry.address,
          days: Array.from({ length: statementLastDay }, () => 0),
          totalManDay: 0,
          recruiterFee: entry.recruiterFee,
          selectedAmount: 0,
        });
      }

      const target = rowMap.get(key)!;
      if (entry.day >= 1 && entry.day <= statementLastDay) {
        target.days[entry.day - 1] += entry.manDay;
      }
      target.totalManDay += entry.manDay;
      target.selectedAmount += getStatementAmount(entry, statementPriceMode);
      if (!target.idNumber && entry.idNumber) target.idNumber = entry.idNumber;
      if (!target.address && entry.address) target.address = entry.address;
      if (!target.recruiterFee && entry.recruiterFee) target.recruiterFee = entry.recruiterFee;
    });

    return Array.from(rowMap.values()).sort((left, right) =>
      left.workerName.localeCompare(right.workerName, 'ko')
    );
  }, [getStatementAmount, statementEntries, statementLastDay, statementPriceMode]);

  const handleApplyStatementDeductions = useCallback(() => {
    setStatementActualDeductionApplied(Math.max(0, statementActualDeductionDraft || 0));
    setStatementClaimDeductionApplied(Math.max(0, statementClaimDeductionDraft || 0));
    setStatementReportDeductionApplied(Math.max(0, statementReportDeductionDraft || 0));
  }, [
    statementActualDeductionDraft,
    statementClaimDeductionDraft,
    statementReportDeductionDraft,
  ]);

  const handleResetStatementDeductions = useCallback(() => {
    setStatementActualDeductionDraft(0);
    setStatementClaimDeductionDraft(0);
    setStatementReportDeductionDraft(0);
    setStatementActualDeductionApplied(0);
    setStatementClaimDeductionApplied(0);
    setStatementReportDeductionApplied(0);
  }, []);

  const handleSaveStatementDeductions = useCallback(() => {
    if (typeof window === 'undefined') return;

    const payload = {
      actual: Math.max(0, statementActualDeductionDraft || 0),
      claim: Math.max(0, statementClaimDeductionDraft || 0),
      report: Math.max(0, statementReportDeductionDraft || 0),
    };

    window.localStorage.setItem(
      DAILY_ADVANCE_STATEMENT_DEDUCTION_STORAGE_KEY,
      JSON.stringify(payload)
    );
    setStatementActualDeductionApplied(payload.actual);
    setStatementClaimDeductionApplied(payload.claim);
    setStatementReportDeductionApplied(payload.report);
    window.alert('청구서 차감 저장값을 저장했습니다.');
  }, [
    statementActualDeductionDraft,
    statementClaimDeductionDraft,
    statementReportDeductionDraft,
  ]);

  const statementDailyTotals = useMemo(() => {
    const totals = Array.from({ length: statementLastDay }, () => 0);
    statementEntries.forEach((entry) => {
      if (entry.day >= 1 && entry.day <= statementLastDay) {
        totals[entry.day - 1] += entry.manDay;
      }
    });
    return totals;
  }, [statementEntries, statementLastDay]);

  const teamSummaryRows = useMemo(() => {
    const rowMap = new Map<string, { name: string; days: number[]; total: number }>();
    entries.forEach((entry) => {
      if (!rowMap.has(entry.teamKey)) {
        rowMap.set(entry.teamKey, {
          name: entry.teamName,
          days: Array.from({ length: statementLastDay }, () => 0),
          total: 0,
        });
      }
      const target = rowMap.get(entry.teamKey)!;
      if (entry.day >= 1 && entry.day <= statementLastDay) {
        target.days[entry.day - 1] += entry.manDay;
      }
      target.total += entry.manDay;
    });

    return Array.from(rowMap.entries())
      .map(([teamKey, row]) => ({ teamKey, ...row }))
      .sort((left, right) => left.name.localeCompare(right.name, 'ko'));
  }, [entries, statementLastDay]);
  const teamSummaryTotals = useMemo(() => {
    const totals = Array.from({ length: statementLastDay }, () => 0);
    teamSummaryRows.forEach((row) => {
      row.days.forEach((value, index) => {
        totals[index] += value;
      });
    });
    return totals;
  }, [statementLastDay, teamSummaryRows]);

  const profileDirtyWorkerIds = useMemo(() => {
    return allWorkerMasterRows
      .filter((row) => {
        const draft = profileDrafts[row.workerId] || buildEmptyDraft();
        const baselineClaim = row.claimUnitPrice ? String(row.claimUnitPrice) : '';
        const baselineRecruiter = row.recruiterFee ? String(row.recruiterFee) : '';
        const baselineMemo = row.memo || '';
        return (
          String(draft.claimUnitPrice ?? '') !== baselineClaim ||
          String(draft.recruiterFee ?? '') !== baselineRecruiter ||
          String(draft.memo ?? '') !== baselineMemo
        );
      })
      .map((row) => row.workerId);
  }, [allWorkerMasterRows, profileDrafts]);

  const handleProfileDraftChange = useCallback(
    (workerId: string, field: keyof WorkerProfileDraft, value: string) => {
      setProfileDrafts((prev) => ({
        ...prev,
        [workerId]: {
          ...(prev[workerId] || buildEmptyDraft()),
          [field]: value,
        },
      }));
    },
    []
  );

  const handleSaveProfiles = useCallback(async () => {
    const dirtyRows = allWorkerMasterRows.filter((row) => profileDirtyWorkerIds.includes(row.workerId));
    if (!dirtyRows.length) return;

    setSavingProfiles(true);
    try {
      await dailyAdvanceWorkbookProfileService.saveProfiles(
        dirtyRows.map((row) => {
          const draft = profileDrafts[row.workerId] || buildEmptyDraft();
          return {
            workerId: row.workerId,
            claimUnitPrice: parseMoneyInput(draft.claimUnitPrice),
            recruiterFee: parseMoneyInput(draft.recruiterFee),
            memo: String(draft.memo || '').trim(),
          };
        })
      );

      await loadData();
      window.alert('대납출력부 인원DB 수정사항을 저장했습니다.');
    } catch (error) {
      console.error('Failed to save daily advance workbook profiles:', error);
      window.alert('인원DB 수정 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingProfiles(false);
    }
  }, [allWorkerMasterRows, loadData, profileDirtyWorkerIds, profileDrafts]);

  const renderSheetTabs = () => (
    <div className="flex flex-wrap gap-2 border-b border-[#d8cfb1] pb-3">
      {TAB_OPTIONS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
              active
                ? 'border-[#4F6228] bg-[#4F6228] text-white'
                : 'border-[#d7cfb5] bg-white text-[#4A452A] hover:border-[#948A54] hover:bg-[#fff9dd]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  const renderInputTab = () => (
    <div className="overflow-hidden rounded-xl border border-[#d5ccb0] bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <div className="border-r border-[#d5ccb0]">
          <div
            className="flex items-center justify-center px-4 py-3 text-xl font-black tracking-[0.35em] text-white"
            style={{ backgroundColor: COLORS.olive }}
          >
            입력표
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr style={{ backgroundColor: COLORS.olive }} className="text-white">
                  {['no', '이름', '공수', '실지급금', '공제금', '비고', '일당'].map((header) => (
                    <th
                      key={header}
                      className="border border-[#d5ccb0] px-3 py-2 text-center font-bold"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedDateEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      선택한 일자에 일급제 출역 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  selectedDateEntries.map((entry, index) => (
                    <tr key={entry.key} className="odd:bg-white even:bg-[#faf8ef]">
                      <td className="border border-[#e3dcc4] px-3 py-2 text-center">{index + 1}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2 font-semibold">{entry.workerName}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2 text-center">
                        {formatNumber(entry.manDay)}
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2 text-right">
                        {formatCurrency(entry.actualAmount)}
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2 text-right">
                        {entry.deductionAmount ? formatCurrency(entry.deductionAmount) : '-'}
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2">{entry.note || '-'}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2 text-right">
                        {formatCurrency(entry.actualUnitPrice)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#f7f2df]">
          <div className="grid grid-cols-[92px_1fr] text-sm">
            <div className="border-b border-r border-[#d5ccb0] px-3 py-3 font-bold text-white" style={{ backgroundColor: COLORS.blue }}>
              일자
            </div>
            <div className="border-b border-[#d5ccb0] px-3 py-3 font-bold text-[#4A452A]" style={{ backgroundColor: COLORS.paleYellow }}>
              {selectedDate}
            </div>
            <div className="border-r border-[#d5ccb0] px-3 py-3 font-bold text-white" style={{ backgroundColor: COLORS.blue }}>
              팀
            </div>
            <div className="px-3 py-3 font-bold text-[#4A452A]" style={{ backgroundColor: COLORS.paleYellow }}>
              {selectedTeamKey === 'ALL'
                ? '전체 팀'
                : teamOptions.find((option) => option.key === selectedTeamKey)?.name || '-'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 text-sm">
            <div className="rounded-md border border-[#d5ccb0] bg-white px-3 py-3">
              <div className="text-xs font-bold text-slate-500">선택일 총공수</div>
              <div className="mt-1 text-lg font-black text-[#4A452A]">
                {formatNumber(selectedDateEntries.reduce((sum, entry) => sum + entry.manDay, 0))}
              </div>
            </div>
            <div className="rounded-md border border-[#d5ccb0] bg-white px-3 py-3">
              <div className="text-xs font-bold text-slate-500">선택일 실지급금</div>
              <div className="mt-1 text-lg font-black text-[#4A452A]">
                {formatCurrency(selectedDateEntries.reduce((sum, entry) => sum + entry.actualAmount, 0))}
              </div>
            </div>
            <div className="col-span-2 rounded-md border border-[#d5ccb0] bg-white px-3 py-3">
              <div className="text-xs font-bold text-slate-500">메모</div>
              <div className="mt-1 leading-6 text-[#4A452A]">
                공제금은 출력일보 기준이며, 청구단가와 인력소개비 조정은 인원DB에서 관리합니다.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDatabaseTab = () => (
    <div className="overflow-hidden rounded-xl border border-[#d5ccb0] bg-white shadow-sm">
      <div className="grid gap-px bg-[#d5ccb0] sm:grid-cols-4">
        {[
          ['총공수', formatNumber(workbookStats.totalManDay)],
          ['총 실지급금', formatCurrency(workbookStats.totalActualAmount)],
          ['총 청구금', formatCurrency(workbookStats.totalClaimAmount)],
          ['작업자 수', `${workbookStats.workerCount}명`],
        ].map(([label, value]) => (
          <div key={label} className="bg-[#faf8ef] px-4 py-3">
            <div className="text-xs font-bold text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-black text-[#4A452A]">{value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: COLORS.darkBrown }} className="text-white">
              {['일자', '팀', '이름', '공수', '실지급금', '공제금', '비고'].map((header) => (
                <th
                  key={header}
                  className="border border-[#d5ccb0] px-3 py-2 text-center font-bold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  조회 조건에 맞는 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.key} className="odd:bg-white even:bg-[#faf8ef]">
                  <td className="border border-[#e3dcc4] px-3 py-2 text-center">{entry.date}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2">{entry.teamName}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2 font-semibold">{entry.workerName}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-center">
                    {formatNumber(entry.manDay)}
                  </td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right">
                    {formatCurrency(entry.actualAmount)}
                  </td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right">
                    {entry.deductionAmount ? formatCurrency(entry.deductionAmount) : '-'}
                  </td>
                  <td className="border border-[#e3dcc4] px-3 py-2">{entry.note || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderWorkersTab = () => (
    <div className="overflow-hidden rounded-xl border border-[#d5ccb0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#d5ccb0] bg-[#faf8ef] px-4 py-3">
        <div>
          <div className="text-sm font-black text-[#4A452A]">인원DB</div>
          <div className="text-xs text-slate-500">
            청구단가 기본값은 일당 + 15,000원이며 인력소개비와 비고를 인원별로 조정합니다.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveProfiles()}
          disabled={savingProfiles || profileDirtyWorkerIds.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-[#4F6228] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#43541f] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <FontAwesomeIcon icon={savingProfiles ? faSpinner : faSave} spin={savingProfiles} />
          <span>
            수정 저장{profileDirtyWorkerIds.length > 0 ? ` (${profileDirtyWorkerIds.length})` : ''}
          </span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1480px] border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: COLORS.olive }} className="text-white">
              {[
                '팀',
                '이름',
                '주민등록번호',
                '주소',
                '연락처',
                '은행명(예금주)',
                '계좌번호',
                '인력소개비',
                '일당',
                '청구단가',
                '상태',
                '비고',
              ].map((header) => (
                <th
                  key={header}
                  className="border border-[#d5ccb0] px-3 py-2 text-center font-bold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workerMasterRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-sm text-slate-500">
                  표시할 일급제 작업자가 없습니다.
                </td>
              </tr>
            ) : (
              workerMasterRows.map((row) => {
                const draft = profileDrafts[row.workerId] || buildEmptyDraft();
                const isDirty = profileDirtyWorkerIds.includes(row.workerId);
                return (
                  <tr
                    key={row.workerId}
                    className={isDirty ? 'bg-[#fff7df]' : 'odd:bg-white even:bg-[#faf8ef]'}
                  >
                    <td className="border border-[#e3dcc4] px-3 py-2">{row.teamName}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2 font-semibold">{row.workerName}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2">{row.idNumber || '-'}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2">{row.address || '-'}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2">{row.contact || '-'}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2">
                      {row.bankName
                        ? `${row.bankName}${row.accountHolder ? ` (${row.accountHolder})` : ''}`
                        : '-'}
                    </td>
                    <td className="border border-[#e3dcc4] px-3 py-2">{row.accountNumber || '-'}</td>
                    <td className="border border-[#e3dcc4] px-2 py-2">
                      <input
                        type="text"
                        value={draft.recruiterFee}
                        onChange={(event) =>
                          handleProfileDraftChange(row.workerId, 'recruiterFee', event.target.value)
                        }
                        className="w-full rounded border border-[#d7cfb5] px-2 py-1 text-right outline-none focus:border-[#948A54]"
                      />
                    </td>
                    <td className="border border-[#e3dcc4] px-3 py-2 text-right font-bold text-[#4A452A]">
                      {formatCurrency(row.actualUnitPrice)}
                    </td>
                    <td className="border border-[#e3dcc4] px-2 py-2">
                      <input
                        type="text"
                        value={draft.claimUnitPrice}
                        onChange={(event) =>
                          handleProfileDraftChange(row.workerId, 'claimUnitPrice', event.target.value)
                        }
                        className="w-full rounded border border-[#d7cfb5] px-2 py-1 text-right outline-none focus:border-[#948A54]"
                      />
                    </td>
                    <td className="border border-[#e3dcc4] px-3 py-2 text-center">
                      {row.status === '신규' ? (
                        <span className="rounded bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">
                          신규
                        </span>
                      ) : (
                        row.status || '-'
                      )}
                    </td>
                    <td className="border border-[#e3dcc4] px-2 py-2">
                      <input
                        type="text"
                        value={draft.memo}
                        onChange={(event) =>
                          handleProfileDraftChange(row.workerId, 'memo', event.target.value)
                        }
                        className="w-full rounded border border-[#d7cfb5] px-2 py-1 outline-none focus:border-[#948A54]"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTeamSummaryTab = () => (
    <div className="overflow-hidden rounded-xl border border-[#d5ccb0] bg-white shadow-sm">
      <div className="border-b border-[#d5ccb0] bg-[#faf8ef] px-4 py-3">
        <div className="text-sm font-black text-[#4A452A]">{getMonthTitle(month)} 팀별출력 현황</div>
        <div className="text-xs text-slate-500">
          작업팀별 출력 시트처럼 팀 단위 일자별 공수와 월 합계를 같이 봅니다.
        </div>
      </div>

      <div className="grid gap-px bg-[#d5ccb0] sm:grid-cols-3">
        <div className="px-4 py-3 text-white" style={{ backgroundColor: COLORS.red }}>
          <div className="text-xs font-bold opacity-80">팀 수</div>
          <div className="mt-1 text-xl font-black">{teamSummaryRows.length}</div>
        </div>
        <div className="px-4 py-3 text-[#4A452A]" style={{ backgroundColor: COLORS.brightYellow }}>
          <div className="text-xs font-bold opacity-80">총 공수</div>
          <div className="mt-1 text-xl font-black">
            {formatNumber(teamSummaryTotals.reduce((sum, value) => sum + value, 0))}
          </div>
        </div>
        <div className="bg-[#faf8ef] px-4 py-3">
          <div className="text-xs font-bold text-slate-500">조회월</div>
          <div className="mt-1 text-xl font-black text-[#4A452A]">{getMonthTitle(month)}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1200px] border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: COLORS.goldBrown }} className="text-white">
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold">팀명</th>
              {statementDayNumbers.map((day) => (
                <th key={day} className="border border-[#d5ccb0] px-2 py-2 font-bold">
                  {day}
                </th>
              ))}
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold">합계</th>
            </tr>
          </thead>
          <tbody>
            {teamSummaryRows.length === 0 ? (
              <tr>
                <td
                  colSpan={statementDayNumbers.length + 2}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  팀별 출력 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              teamSummaryRows.map((row) => (
                <tr key={row.teamKey} className="odd:bg-white even:bg-[#faf8ef]">
                  <td className="border border-[#e3dcc4] px-3 py-2 font-semibold">{row.name}</td>
                  {row.days.map((value, index) => (
                    <td key={`${row.teamKey}-${index}`} className="border border-[#e3dcc4] px-2 py-2 text-center">
                      {value ? formatNumber(value) : '-'}
                    </td>
                  ))}
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right font-black text-[#4A452A]">
                    {formatNumber(row.total)}
                  </td>
                </tr>
              ))
            )}
            {teamSummaryRows.length > 0 && (
              <tr style={{ backgroundColor: COLORS.pink }}>
                <td className="border border-[#d5ccb0] px-3 py-2 font-black">일자별 합계</td>
                {teamSummaryTotals.map((value, index) => (
                  <td key={`team-summary-total-${index}`} className="border border-[#d5ccb0] px-2 py-2 text-center font-black">
                    {value ? formatNumber(value) : '-'}
                  </td>
                ))}
                <td className="border border-[#d5ccb0] px-3 py-2 text-right font-black text-[#4A452A]">
                  {formatNumber(teamSummaryTotals.reduce((sum, value) => sum + value, 0))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStatementTab = () => (
    <div className="overflow-hidden rounded-xl border border-[#d5ccb0] bg-white shadow-sm">
      <div className="border-b border-[#d5ccb0] px-4 py-4" style={{ backgroundColor: COLORS.paleYellow }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-lg font-black text-[#4A452A]">
              {`${getMonthTitle(month)} ${statementTeamOption?.name || ''} 청구서`.trim()}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              선택한 단가기준으로 노무금액을 계산하며, 차감값은 이 청구서 화면에만 반영됩니다.
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-[#d5ccb0] bg-white px-3 py-3 shadow-sm lg:min-w-[520px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">단가기준</span>
              {STATEMENT_PRICE_MODE_OPTIONS.map((option) => {
                const isActive = option.key === statementPriceMode;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setStatementPriceMode(option.key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      isActive
                        ? option.buttonClassName
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
              <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                현재 {statementPriceOption.label}
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="mb-1 text-[11px] text-slate-500">지급차감</div>
                <input
                  type="number"
                  value={statementActualDeductionDraft}
                  onChange={(event) => setStatementActualDeductionDraft(Number(event.target.value))}
                  step={5000}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-right"
                  placeholder="0"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] text-slate-500">청구차감</div>
                <input
                  type="number"
                  value={statementClaimDeductionDraft}
                  onChange={(event) => setStatementClaimDeductionDraft(Number(event.target.value))}
                  step={5000}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-right"
                  placeholder="0"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] text-slate-500">신고차감</div>
                <input
                  type="number"
                  value={statementReportDeductionDraft}
                  onChange={(event) => setStatementReportDeductionDraft(Number(event.target.value))}
                  step={5000}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-right"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyStatementDeductions}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
                >
                  차감 적용
                </button>
                <button
                  type="button"
                  onClick={handleSaveStatementDeductions}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                  차감 저장
                </button>
                <button
                  type="button"
                  onClick={handleResetStatementDeductions}
                  className="rounded-lg bg-slate-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-600"
                >
                  차감 초기화
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-500">
              적용 차감: {statementPriceOption.label} {formatCurrency(statementAppliedDeductionMap[statementPriceMode] || 0)}원. 저장한 값은 자동으로 다시 불러옵니다.
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-b border-[#d5ccb0] p-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-[#d5ccb0] p-4" style={{ backgroundColor: COLORS.beige }}>
          <div className="text-xs font-bold text-[#4A452A]">입금 계좌</div>
          <div className="mt-2 space-y-1 text-sm leading-6 text-[#1E1C11]">
            <div>은행명: {statementTeamOption?.team?.bankName || '-'}</div>
            <div>예금주: {statementTeamOption?.team?.accountHolder || '-'}</div>
            <div>계좌번호: {statementTeamOption?.team?.accountNumber || '-'}</div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[#d5ccb0] p-4" style={{ backgroundColor: COLORS.orange }}>
            <div className="text-xs font-bold text-[#4A452A]">회사</div>
            <div className="mt-2 text-base font-black text-[#1E1C11]">
              {statementTeamOption?.team?.companyName || statementEntries[0]?.companyName || '-'}
            </div>
          </div>
          <div className="rounded-lg border border-[#d5ccb0] p-4" style={{ backgroundColor: COLORS.orange }}>
            <div className="text-xs font-bold text-[#4A452A]">팀명</div>
            <div className="mt-2 text-base font-black text-[#1E1C11]">{statementTeamOption?.name || '-'}</div>
          </div>
          <div className="rounded-lg border border-[#d5ccb0] p-4" style={{ backgroundColor: COLORS.orange }}>
            <div className="text-xs font-bold text-[#4A452A]">청구기간</div>
            <div className="mt-2 text-base font-black text-[#1E1C11]">{getMonthTitle(month)}</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1800px] border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: COLORS.darkBrown }} className="text-white">
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold">번호</th>
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold">이름</th>
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold">주민등록번호</th>
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold">주소</th>
              {statementDayNumbers.map((day) => (
                <th key={day} className="border border-[#d5ccb0] px-2 py-2 font-bold">
                  {day}
                </th>
              ))}
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold">출역</th>
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold" style={{ backgroundColor: COLORS.aqua }}>
                인력소개비
              </th>
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold" style={{ backgroundColor: COLORS.wine }}>
                {statementPriceOption.amountLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {statementRows.length === 0 ? (
              <tr>
                <td
                  colSpan={statementDayNumbers.length + 7}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  청구서로 만들 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              statementRows.map((row, index) => (
                <tr key={row.workerId || row.workerName} className="odd:bg-white even:bg-[#faf8ef]">
                  <td className="border border-[#e3dcc4] px-3 py-2 text-center">{index + 1}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2 font-semibold">{row.workerName}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2">{row.idNumber || '-'}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2">{row.address || '-'}</td>
                  {row.days.map((value, dayIndex) => (
                    <td
                      key={`${row.workerId}-${dayIndex}`}
                      className="border border-[#e3dcc4] px-2 py-2 text-center"
                    >
                      {value ? formatNumber(value) : '-'}
                    </td>
                  ))}
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right font-black text-[#4A452A]">
                    {formatNumber(row.totalManDay)}
                  </td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right">
                    {row.recruiterFee ? formatCurrency(row.recruiterFee) : '-'}
                  </td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right font-black text-[#7a2c2c]">
                    {formatCurrency(row.selectedAmount)}
                  </td>
                </tr>
              ))
            )}
            {statementRows.length > 0 && (
              <tr style={{ backgroundColor: COLORS.pink }}>
                <td colSpan={4} className="border border-[#d5ccb0] px-3 py-2 font-black">
                  일자별 공수합계
                </td>
                {statementDailyTotals.map((value, index) => (
                  <td key={`statement-total-${index}`} className="border border-[#d5ccb0] px-2 py-2 text-center font-black">
                    {value ? formatNumber(value) : '-'}
                  </td>
                ))}
                <td className="border border-[#d5ccb0] px-3 py-2 text-right font-black">
                  {formatNumber(statementRows.reduce((sum, row) => sum + row.totalManDay, 0))}
                </td>
                <td className="border border-[#d5ccb0] px-3 py-2 text-right font-black">
                  {formatCurrency(statementRows.reduce((sum, row) => sum + row.recruiterFee, 0))}
                </td>
                <td className="border border-[#d5ccb0] px-3 py-2 text-right font-black">
                  {formatCurrency(statementRows.reduce((sum, row) => sum + row.selectedAmount, 0))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDayLookupTab = () => (
    <div className="overflow-hidden rounded-xl border border-[#d5ccb0] bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
        <div className="border-r border-[#d5ccb0] bg-[#f7f2df]">
          <div className="grid grid-cols-[88px_1fr] text-sm">
            <div className="border-b border-r border-[#d5ccb0] px-3 py-3 font-bold text-white" style={{ backgroundColor: COLORS.blue }}>
              일자
            </div>
            <div className="border-b border-[#d5ccb0] px-3 py-3 font-bold text-[#4A452A]" style={{ backgroundColor: COLORS.paleYellow }}>
              {selectedDate}
            </div>
          </div>

          <div className="space-y-3 p-4 text-sm">
            <div className="rounded-md border border-[#d5ccb0] bg-white px-3 py-3">
              <div className="text-xs font-bold text-slate-500">선택일 공수</div>
              <div className="mt-1 text-lg font-black text-[#4A452A]">
                {formatNumber(selectedDateEntries.reduce((sum, entry) => sum + entry.manDay, 0))}
              </div>
            </div>
            <div className="rounded-md border border-[#d5ccb0] bg-white px-3 py-3">
              <div className="text-xs font-bold text-slate-500">선택일 실지급금</div>
              <div className="mt-1 text-lg font-black text-[#4A452A]">
                {formatCurrency(selectedDateEntries.reduce((sum, entry) => sum + entry.actualAmount, 0))}
              </div>
            </div>
            <div className="rounded-md border border-[#d5ccb0] bg-white px-3 py-3">
              <div className="text-xs font-bold text-slate-500">선택일 청구금</div>
              <div className="mt-1 text-lg font-black text-[#4A452A]">
                {formatCurrency(selectedDateEntries.reduce((sum, entry) => sum + entry.claimAmount, 0))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] border-collapse text-sm">
              <thead>
                <tr style={{ backgroundColor: COLORS.blackBrown }} className="text-white">
                  {[
                    '팀',
                    '이름',
                    '현장',
                    '공수',
                    '실지급금',
                    '청구금',
                    '은행명',
                    '예금주명',
                    '계좌번호',
                    '비고',
                  ].map((header, index) => (
                    <th
                      key={header}
                      className="border border-[#d5ccb0] px-3 py-2 text-center font-bold"
                      style={index === 8 ? { backgroundColor: COLORS.red } : undefined}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedDateEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                      선택한 일자에 조회 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  selectedDateEntries.map((entry) => (
                    <tr key={entry.key} className="odd:bg-white even:bg-[#faf8ef]">
                      <td className="border border-[#e3dcc4] px-3 py-2">{entry.teamName}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2 font-semibold">{entry.workerName}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2">{entry.siteName || '-'}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2 text-center">
                        {formatNumber(entry.manDay)}
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2 text-right">
                        {formatCurrency(entry.actualAmount)}
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2 text-right">
                        {formatCurrency(entry.claimAmount)}
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2">{entry.bankName || '-'}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2">{entry.accountHolder || '-'}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2 font-medium text-[#7a2c2c]">
                        {entry.accountNumber || '-'}
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2">{entry.note || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'input':
        return renderInputTab();
      case 'database':
        return renderDatabaseTab();
      case 'workers':
        return renderWorkersTab();
      case 'team-summary':
        return renderTeamSummaryTab();
      case 'statement':
        return renderStatementTab();
      case 'day-lookup':
        return renderDayLookupTab();
      case 'daily-wage':
        return (
          <DailyWageDraftPage
            embedded
            dateOverride={selectedDate}
            monthOverride={month}
            deductionStorageKey={DAILY_ADVANCE_DAILY_WAGE_DEDUCTION_STORAGE_KEY}
          />
        );
      default:
        return null;
    }
  };

  const summaryPanelClassName = isGoyunjungMode
    ? 'rounded-xl border border-[#d9cfb2] bg-white/82 p-6 shadow-sm backdrop-blur-sm'
    : 'rounded-xl border border-[#d9cfb2] bg-white p-6 shadow-sm';

  const filterPanelClassName = isGoyunjungMode
    ? 'rounded-xl border border-[#d9cfb2] bg-white/82 p-5 shadow-sm backdrop-blur-sm'
    : 'rounded-xl border border-[#d9cfb2] bg-white p-5 shadow-sm';

  const tabPanelClassName = isGoyunjungMode
    ? 'space-y-4 rounded-xl border border-[#d9cfb2] bg-[#fbf8ee]/88 p-5 shadow-sm backdrop-blur-sm'
    : 'space-y-4 rounded-xl border border-[#d9cfb2] bg-[#fbf8ee] p-5 shadow-sm';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <style>
        {`
          @keyframes goyunjungBurstCard {
            0% { opacity: 0; transform: translate(-50%, 28px) scale(0.82); }
            12% { opacity: 1; transform: translate(-50%, 0) scale(1); }
            78% { opacity: 1; transform: translate(-50%, -6px) scale(1.02); }
            100% { opacity: 0; transform: translate(-50%, -34px) scale(0.9); }
          }

          @keyframes goyunjungMessageFloat {
            0% { opacity: 0; transform: translateY(18px) scale(0.92); }
            18% { opacity: 1; transform: translateY(0) scale(1); }
            76% { opacity: 1; transform: translateY(-10px) scale(1.02); }
            100% { opacity: 0; transform: translateY(-26px) scale(0.95); }
          }

          @keyframes goyunjungHeartBurst {
            0% { opacity: 0; transform: translate3d(0, 30px, 0) scale(0.7) rotate(0deg); }
            15% { opacity: 1; }
            100% { opacity: 0; transform: translate3d(var(--heart-drift), -220px, 0) scale(1.3) rotate(22deg); }
          }
        `}
      </style>
      {isGoyunjungMode && goyunjungBackgroundUrl && (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-fixed opacity-[0.78] saturate-[1.12]"
            style={{ backgroundImage: `url("${goyunjungBackgroundUrl}")` }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.10),_rgba(255,255,255,0.28)_55%,_rgba(255,255,255,0.42))]" />
        </>
      )}

      {isGoyunjungMode && goyunjungBursts.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {goyunjungBursts.map((burst) => (
            <div key={burst.id} className="absolute inset-0">
              <div
                className="absolute w-[240px] max-w-[34vw] min-w-[180px] overflow-hidden rounded-[28px] border border-white/70 bg-white/18 shadow-[0_25px_80px_rgba(190,24,93,0.33)] backdrop-blur-md xl:w-[280px]"
                style={{
                  left: burst.position.left,
                  top: burst.position.top,
                  transform:
                    burst.position.align === 'left'
                      ? 'translate(0, 0)'
                      : burst.position.align === 'right'
                        ? 'translate(0, 0)'
                        : 'translate(-50%, 0)',
                  animation: 'goyunjungBurstCard 4.2s ease forwards',
                }}
              >
                <div className="bg-gradient-to-r from-rose-500/80 via-pink-500/75 to-fuchsia-500/80 px-4 py-2 text-center text-sm font-black tracking-[0.18em] text-white">
                  GOYUNJUNG MODE
                </div>
                <div className="bg-white/82 p-3">
                  <img
                    src={burst.imageUrl}
                    alt="고윤정"
                    className="h-[340px] w-full rounded-[20px] object-cover object-center shadow-lg"
                  />
                </div>
              </div>

              <div
                className={`absolute flex flex-col gap-3 px-2 ${
                  burst.position.align === 'left'
                    ? 'items-start'
                    : burst.position.align === 'right'
                      ? 'items-end'
                      : 'items-center'
                }`}
                style={{
                  left:
                    burst.position.align === 'left'
                      ? burst.position.left
                      : burst.position.align === 'right'
                        ? 'auto'
                        : burst.position.left,
                  right: burst.position.align === 'right' ? burst.position.left : 'auto',
                  top: `calc(${burst.position.top} + 360px)`,
                  width: burst.position.align === 'center' ? '70vw' : '260px',
                  maxWidth: '70vw',
                  transform: burst.position.align === 'center' ? 'translateX(-50%)' : 'none',
                }}
              >
                {burst.messages.map((message, index) => (
                  <div
                    key={`${burst.id}-message-${index}`}
                    className="rounded-full border border-white/70 bg-white/80 px-5 py-2 text-center text-sm font-black text-rose-700 shadow-[0_14px_40px_rgba(225,29,72,0.22)] backdrop-blur-md"
                    style={{
                      animation: 'goyunjungMessageFloat 3.2s ease forwards',
                      animationDelay: `${0.18 * index}s`,
                    }}
                  >
                    {message}
                  </div>
                ))}
              </div>

              {burst.hearts.map((heart) => (
                <div
                  key={heart.id}
                  className="absolute top-[56%] text-rose-500 drop-shadow-[0_6px_14px_rgba(244,63,94,0.35)]"
                  style={{
                    left: `${heart.left}%`,
                    fontSize: `${heart.size}px`,
                    animation: `goyunjungHeartBurst ${heart.duration}s ease-out forwards`,
                    animationDelay: `${heart.delay}s`,
                    ['--heart-drift' as string]: `${heart.drift}px`,
                  }}
                >
                  ♥
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="relative space-y-6">
        <div className={summaryPanelClassName}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-2xl font-black text-[#4A452A]">대납출력부</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                일급제 인원 기준으로 일자별 출역, 청구, 계좌 정보를 한 화면에서 관리합니다.
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#4A452A] px-3 py-1 text-xs font-bold text-white">
                급여구분
              </span>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                일급제
              </span>
              <span className="text-xs font-medium text-slate-500">
                일급제 인원만 지급 대상으로 집계합니다.
              </span>
              <button
                type="button"
                onClick={() => setIsGoyunjungMode((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  isGoyunjungMode
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-[#d7cfb5] bg-white text-[#4A452A] hover:border-[#948A54]'
                }`}
              >
                <span>고윤정모드</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isGoyunjungMode ? 'bg-rose-500' : 'bg-slate-300'
                  }`}
                />
              </button>
              {isGoyunjungMode && (
                <button
                  type="button"
                  onClick={() => void applyRandomGoyunjungBackground()}
                  className="inline-flex items-center rounded-full border border-rose-200 bg-white/85 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                >
                  배경 변경
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: '조회월',
                  value: getMonthTitle(month),
                  icon: faCalendarAlt,
                  bg: COLORS.paleBlue,
                },
                {
                  label: '작업자',
                  value: `${workbookStats.workerCount}명`,
                  icon: faUsers,
                  bg: COLORS.paleYellow,
                },
                {
                  label: '팀수',
                  value: `${workbookStats.teamCount}팀`,
                  icon: faBuilding,
                  bg: '#f5ebc8',
                },
                {
                  label: '총공수',
                  value: formatNumber(workbookStats.totalManDay),
                  icon: faTable,
                  bg: '#f4e0c2',
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="flex min-w-[140px] items-center gap-3 rounded-lg border border-[#d5ccb0] px-4 py-3"
                  style={{ backgroundColor: card.bg }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-[#4A452A]">
                    <FontAwesomeIcon icon={card.icon} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500">{card.label}</div>
                    <div className="text-lg font-black text-[#4A452A]">{card.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={filterPanelClassName}>
          <div className="grid gap-4 xl:grid-cols-[180px_180px_220px_220px_1fr_auto]">
            <label className="space-y-2 text-sm">
              <div className="font-bold text-[#4A452A]">조회월</div>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-full rounded-md border border-[#d7cfb5] px-3 py-2 outline-none focus:border-[#948A54]"
              />
            </label>

            <label className="space-y-2 text-sm">
              <div className="font-bold text-[#4A452A]">일자</div>
              <input
                type="date"
                value={selectedDate}
                min={monthToPeriod(month).startDate}
                max={monthToPeriod(month).endDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full rounded-md border border-[#d7cfb5] px-3 py-2 outline-none focus:border-[#948A54]"
              />
            </label>

            <label className="space-y-2 text-sm">
              <div className="font-bold text-[#4A452A]">팀 필터</div>
              <select
                value={selectedTeamKey}
                onChange={(event) => setSelectedTeamKey(event.target.value)}
                className="w-full rounded-md border border-[#d7cfb5] px-3 py-2 outline-none focus:border-[#948A54]"
              >
                <option value="ALL">전체 팀</option>
                {teamOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <div className="font-bold text-[#4A452A]">청구서 팀</div>
              <select
                value={statementTeamKey}
                onChange={(event) => setStatementTeamKey(event.target.value)}
                className="w-full rounded-md border border-[#d7cfb5] px-3 py-2 outline-none focus:border-[#948A54]"
              >
                {teamOptions.length === 0 ? (
                  <option value="">팀 없음</option>
                ) : (
                  teamOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="flex items-end">
              <div className="rounded-lg border border-[#d7cfb5] px-4 py-3 text-sm text-slate-600">
                실지급금은 일당 기준, 노무청구금은 청구단가 기준으로 계산합니다.
              </div>
            </div>

            <div className="flex items-end">
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                <div className="font-bold">급여구분</div>
                <div className="mt-1">일급제만 지급 대상으로 집계합니다.</div>
              </div>
            </div>

            <div className="flex items-end justify-end">
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-[#4A452A] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#3a361f] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <FontAwesomeIcon icon={loading ? faSpinner : faSearch} spin={loading} />
                <span>새로고침</span>
              </button>
            </div>
          </div>
        </div>

        <div className={tabPanelClassName}>
          {renderSheetTabs()}
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[#d5ccb0] bg-white">
              <div className="flex items-center gap-3 text-sm font-bold text-[#4A452A]">
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>대납출력부 데이터를 불러오는 중입니다.</span>
              </div>
            </div>
          ) : (
            renderActiveTab()
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyAdvanceWorkbookPage;
