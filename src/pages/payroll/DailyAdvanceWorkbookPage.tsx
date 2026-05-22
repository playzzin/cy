
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faCalendarAlt,
  faDownload,
  faSave,
  faSearch,
  faSpinner,
  faTable,
  faUsers,
  faArrowRight,
  faCheckCircle,
} from '@fortawesome/free-solid-svg-icons';
import { dailyReportService } from '../../services/dailyReportService';
import {
  dailyAdvanceWorkbookProfileService,
  type DailyAdvanceWorkbookProfile,
} from '../../services/dailyAdvanceWorkbookProfileService';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { teamService, type Team } from '../../services/teamService';
import { storageService } from '../../services/storageService';

// 인원DB/일급제/용역팀 등에서 공통적으로 사용하는 엔트리 타입 (WorkerMasterRow와 동일 구조)
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
  workerAmount: number;
  recruiterFee: number;
  note: string;
  cumulativeCount?: number;
};

type WorkbookTabKey =
  | 'workers'
  | 'team-summary'
  | 'statement'
  | 'day-lookup'
  | 'daily-wage'
  | 'service-team';

type WorkerProfileDraft = {
  claimUnitPrice: string;
  memo: string;
};

type TeamOption = {
  key: string;
  name: string;
  team: Team | null;
  isServiceTeam?: boolean;
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
  isServiceTeam?: boolean;
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
  { key: 'workers', label: '인원DB' },
  { key: 'team-summary', label: '팀별출력' },
  { key: 'statement', label: '청구서' },
  { key: 'service-team', label: '용역팀' },
  { key: 'day-lookup', label: '일자별조회' },
  { key: 'daily-wage', label: '일급제' },
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

const isStrictDailyWageLabel = (value: unknown): boolean => {
  const normalized = normalizeText(value);
  return normalized.includes('일급제') || normalized.includes('일급');
};

const isStrictServiceTeamLabel = (value: unknown): boolean => {
  const normalized = normalizeText(value);
  return (
    normalized.includes('용역') ||
    normalized.includes('인력') ||
    normalized.includes('소개') ||
    normalized.includes('agency')
  );
};

const isDailyWageLabel = (value: unknown): boolean => 
  isStrictDailyWageLabel(value) || isStrictServiceTeamLabel(value);

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

const getTodayStamp = (): string => new Date().toISOString().slice(0, 10);

const sanitizeFileName = (value: string): string =>
  String(value || 'download')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

type ExcelCellValue = string | number;

type ExcelStyleOptions = {
  titleRowIndex?: number;
  headerRowIndex?: number;
  totalRowIndex?: number;
  titleFill?: string;
  headerFill?: string;
  totalFill?: string;
  bodyAlternateFill?: string;
  specialHeaderFills?: Record<number, string>;
  specialColumnFills?: Record<number, string>;
  highlightedCells?: Set<string>;
  highlightedCellFill?: string;
  centerColumns?: Set<number>;
  rightColumns?: Set<number>;
  moneyColumns?: Set<number>;
  manDayColumns?: Set<number>;
  titleHeight?: number;
  headerHeight?: number;
  rowHeight?: number;
  merges?: XLSX.Range[];
};

const excelRgb = (color: string): string => color.replace('#', '').toUpperCase();

const makeExcelFill = (color: string) => ({
  fgColor: { rgb: excelRgb(color) },
  patternType: 'solid' as const,
});

const downloadAoaAsExcel = (
  fileName: string,
  sheetName: string,
  rows: Array<Array<ExcelCellValue>>,
  columnWidths: number[],
  options: ExcelStyleOptions = {}
) => {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = columnWidths.map((width) => ({ wch: width }));
  if (options.merges?.length) {
    worksheet['!merges'] = options.merges;
  }
  const titleRowIndex = options.titleRowIndex;
  const headerRowIndex = options.headerRowIndex ?? 0;
  worksheet['!rows'] = rows.map((_, index) => ({
    hpt: index === titleRowIndex
      ? options.titleHeight ?? 28
      : index === headerRowIndex
        ? options.headerHeight ?? 24
        : options.rowHeight ?? 22,
  }));

  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const border = {
    top: { style: 'thin' as const, color: { rgb: 'D5CCB0' } },
    bottom: { style: 'thin' as const, color: { rgb: 'D5CCB0' } },
    left: { style: 'thin' as const, color: { rgb: 'D5CCB0' } },
    right: { style: 'thin' as const, color: { rgb: 'D5CCB0' } },
  };

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      if (!worksheet[address]) {
        worksheet[address] = { t: 's', v: '' };
      }

      const cell = worksheet[address] as XLSX.CellObject & { s?: unknown };
      const isTitle = rowIndex === titleRowIndex;
      const isHeader = rowIndex === headerRowIndex;
      const isTotal = rowIndex === options.totalRowIndex;
      const horizontal = isTitle
        ? 'center'
        : isTotal && columnIndex === 0
        ? 'left'
        : options.rightColumns?.has(columnIndex)
        ? 'right'
        : options.centerColumns?.has(columnIndex)
          ? 'center'
          : 'left';

      const fillColor = isTitle
        ? options.titleFill ?? options.headerFill
        : isHeader
        ? options.specialHeaderFills?.[columnIndex] ?? options.headerFill
        : isTotal
          ? options.totalFill
          : options.highlightedCells?.has(`${rowIndex}:${columnIndex}`)
            ? options.highlightedCellFill
            : options.specialColumnFills?.[columnIndex] ??
              (
                options.bodyAlternateFill && rowIndex > headerRowIndex && (rowIndex - headerRowIndex) % 2 === 0
                  ? options.bodyAlternateFill
                  : undefined
              );

      cell.s = {
        fill: fillColor ? makeExcelFill(fillColor) : undefined,
        font: {
          name: '맑은 고딕',
          sz: isTitle ? 12 : isHeader || isTotal ? 10 : 9,
          bold: isTitle || isHeader || isTotal || options.highlightedCells?.has(`${rowIndex}:${columnIndex}`),
          color: isTitle || isHeader ? { rgb: 'FFFFFF' } : undefined,
        },
        alignment: {
          horizontal,
          vertical: 'center',
          wrapText: true,
        },
        border,
        numFmt: options.moneyColumns?.has(columnIndex)
          ? '#,##0'
          : options.manDayColumns?.has(columnIndex)
            ? '#,##0.##'
            : undefined,
      };

      if (typeof cell.v === 'number') {
        cell.t = 'n';
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${sanitizeFileName(fileName)}.xlsx`);
};

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

const DAILY_WAGE_DEDUCTION_AMOUNT = 15000;
const SERVICE_RECRUITER_FEE_PER_DAY = 60000;
const SERVICE_RECRUITER_FEE_MAX_DAYS = 5;

const getDefaultClaimUnitPrice = (unitPrice: number): number => {
  if (!unitPrice) return 0;
  return unitPrice;
};

const getActualUnitPrice = (claimUnitPrice: number): number => {
  if (!claimUnitPrice) return 0;
  return Math.max(0, claimUnitPrice - DAILY_WAGE_DEDUCTION_AMOUNT);
};

const getSalaryTypeLabel = (...values: Array<unknown>): string => {
  const labels = values.map((value) => displayText(value)).filter(Boolean);
  const matched = labels.find((label) => isStrictDailyWageLabel(label) || isStrictServiceTeamLabel(label));
  return matched || labels[0] || '일급제';
};

const getNormalizedSalaryTypeLabel = (...values: Array<unknown>): string => {
  const label = getSalaryTypeLabel(...values);
  if (isStrictServiceTeamLabel(label)) return '용역팀';
  if (isStrictDailyWageLabel(label)) return '일급제';
  return label || '일급제';
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
  memo: '',
});

const GOYUNJUNG_MODE_STORAGE_KEY = 'daily-advance-workbook:goyunjung-mode';
const DAILY_ADVANCE_STATEMENT_RECRUITER_FEE_STORAGE_KEY =
  'daily-advance-workbook:statement-recruiter-fees';
const GOYUNJUNG_IMAGE_ROOTS = ['goyumjung', 'goyunjung'];
const GOYUNJUNG_BACKGROUND_INTERVAL_MS = 10000;
const GOYUNJUNG_BACKGROUND_FADE_MS = 1800;
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

const buildStatementRecruiterFeeKey = (month: string, teamKey: string, workerId: string): string =>
  `${month}__${teamKey}__${workerId}`;

const isServiceTeamNode = (team: Team | null): boolean => {
  if (!team) return false;
  const target = normalizeText(`${team.type || ''} ${team.name || ''} ${team.defaultSalaryModel || ''} ${team.companyName || ''}`);
  return (
    target.includes('용역') ||
    target.includes('인력') ||
    target.includes('소개') ||
    target.includes('outsourcing') ||
    target.includes('agency') ||
    target.includes('daily') ||
    // 특정 팀 명칭 예외 허용 (사용자 데이터 기반)
    target.includes('덕기') 
  );
};

const DailyAdvanceWorkbookPage: React.FC = () => {
  const currentMonth = getCurrentMonth();
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState(monthToPeriod(currentMonth).endDate);
  const [selectedTeamKey, setSelectedTeamKey] = useState('ALL');
  const [statementTeamKey, setStatementTeamKey] = useState('');
  const [activeTab, setActiveTab] = useState<WorkbookTabKey>('workers');
  const [manDayDrafts, setManDayDrafts] = useState<Record<string, string>>({});
  const [statementRecruiterFeeValues, setStatementRecruiterFeeValues] = useState<Record<string, number>>({});
  const [statementRecruiterFeeDrafts, setStatementRecruiterFeeDrafts] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<WorkbookEntry[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Record<string, DailyAdvanceWorkbookProfile>>({});
  const [profileDrafts, setProfileDrafts] = useState<Record<string, WorkerProfileDraft>>({});
  const [loading, setLoading] = useState(false);
  const [savingProfiles, setSavingProfiles] = useState(false);
  const [savingStatementRecruiterFees, setSavingStatementRecruiterFees] = useState(false);
  const [isGoyunjungMode, setIsGoyunjungMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(GOYUNJUNG_MODE_STORAGE_KEY) === 'true';
  });
  const goyunjungImagePathsRef = useRef<string[]>([]);
  const [goyunjungPreviousBackgroundUrl, setGoyunjungPreviousBackgroundUrl] = useState('');
  const [goyunjungBackgroundUrl, setGoyunjungBackgroundUrl] = useState('');
  const [goyunjungBackgroundVersion, setGoyunjungBackgroundVersion] = useState(0);
  const goyunjungCurrentPathRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(DAILY_ADVANCE_STATEMENT_RECRUITER_FEE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const nextValues = Object.entries(parsed).reduce<Record<string, number>>((accumulator, [key, value]) => {
        const amount = toNumber(value);
        if (amount > 0) {
          accumulator[key] = amount;
        }
        return accumulator;
      }, {});
      setStatementRecruiterFeeValues(nextValues);
    } catch (error) {
      console.warn('Failed to load statement recruiter fees:', error);
    }
  }, []);

  useEffect(() => {
    if (!selectedDate.startsWith(month)) {
      setSelectedDate(monthToPeriod(month).endDate);
    }
  }, [month, selectedDate]);

  const loadGoyunjungImagePaths = useCallback(async (): Promise<string[]> => {
    if (goyunjungImagePathsRef.current.length > 0) return goyunjungImagePathsRef.current;

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
    goyunjungImagePathsRef.current = imagePaths;
    return imagePaths;
  }, []);

  const applyRandomGoyunjungBackground = useCallback(
    async (paths?: string[]) => {
      const candidates = paths && paths.length > 0 ? paths : await loadGoyunjungImagePaths();
      if (candidates.length === 0) {
        setGoyunjungPreviousBackgroundUrl('');
        setGoyunjungBackgroundUrl('');
        setGoyunjungBackgroundVersion(0);
        goyunjungCurrentPathRef.current = '';
        return;
      }

      const currentPath = goyunjungCurrentPathRef.current;
      const availableCandidates =
        candidates.length > 1 && currentPath
          ? candidates.filter((candidate) => candidate !== currentPath)
          : candidates;
      const pool = availableCandidates.length > 0 ? availableCandidates : candidates;
      const randomPath = pool[Math.floor(Math.random() * pool.length)];
      const downloadUrl = await storageService.getDownloadUrl(randomPath);

      goyunjungCurrentPathRef.current = randomPath;
      setGoyunjungBackgroundUrl((currentUrl) => {
        if (currentUrl && currentUrl !== downloadUrl) {
          setGoyunjungPreviousBackgroundUrl(currentUrl);
        }
        return downloadUrl;
      });
      setGoyunjungBackgroundVersion((version) => version + 1);
    },
    [loadGoyunjungImagePaths]
  );

  useEffect(() => {
    if (!goyunjungPreviousBackgroundUrl || typeof window === 'undefined') return;

    const timeoutId = window.setTimeout(() => {
      setGoyunjungPreviousBackgroundUrl('');
    }, GOYUNJUNG_BACKGROUND_FADE_MS + 250);

    return () => window.clearTimeout(timeoutId);
  }, [goyunjungPreviousBackgroundUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      GOYUNJUNG_MODE_STORAGE_KEY,
      isGoyunjungMode ? 'true' : 'false'
    );
  }, [isGoyunjungMode]);

  useEffect(() => {
    if (!isGoyunjungMode) {
      setGoyunjungPreviousBackgroundUrl('');
      setGoyunjungBackgroundUrl('');
      setGoyunjungBackgroundVersion(0);
      goyunjungCurrentPathRef.current = '';
      return;
    }

    let cancelled = false;

    const loadBackground = async () => {
      try {
        const paths = await loadGoyunjungImagePaths();
        if (cancelled) return;
        if (paths.length === 0) {
          setGoyunjungPreviousBackgroundUrl('');
          setGoyunjungBackgroundUrl('');
          setGoyunjungBackgroundVersion(0);
          goyunjungCurrentPathRef.current = '';
          return;
        }

        if (!cancelled) {
          await applyRandomGoyunjungBackground(paths);
        }
      } catch (error) {
        console.error('Failed to load goyunjung background images:', error);
        if (!cancelled) {
          setGoyunjungPreviousBackgroundUrl('');
          setGoyunjungBackgroundUrl('');
          setGoyunjungBackgroundVersion(0);
          goyunjungCurrentPathRef.current = '';
        }
      }
    };

    void loadBackground();

    const intervalId = window.setInterval(() => {
      void applyRandomGoyunjungBackground();
    }, GOYUNJUNG_BACKGROUND_INTERVAL_MS);

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

      // --- 신규: 누적 작업일수 계산을 위한 과거 데이터 로드 ---
      // 1. 현재 표시될 모든 작업자의 안정적인 ID 추출
      const getWorkerForRow = (row: any) =>
        workerByAnyId.get(String(row.workerId ?? '').trim()) ||
        workerByName.get(normalizeText(row.workerName || row.name));

      const getRowSalaryType = (row: any, worker?: Worker | null) =>
        getNormalizedSalaryTypeLabel(
          row.salaryModel,
          row.payType,
          worker?.salaryModel,
          worker?.payType
        );

      const getStableIdForRow = (row: any) => {
        const worker = getWorkerForRow(row);
        return (
          resolveWorkerStableId(worker) ||
          String(row.workerId ?? '').trim() ||
          normalizeText(row.workerName || row.name)
        );
      };

      const activeWorkerStableIds = new Set(reportRows.map(r => getStableIdForRow(r)).filter(Boolean));
      
      // 2. 전체 히스토리를 가져옴 (조회 월 말일까지)
      // startDate를 넣지 않으면 서비스가 endDate 하루만 조회하므로 누적 근무일 계산이 깨진다.
      const rawHistoryRows = await dailyReportService.getWorkerRows({
        startDate: '1900-01-01',
        endDate: period.endDate
      });

      // 3. 작업자별로 날짜순 정렬하여 누적 번호 매기기
      const workerDateMap = new Map<string, string[]>(); // stableId -> [serviceDates]
      rawHistoryRows.forEach(row => {
        const stableId = getStableIdForRow(row);
        if (!stableId || !activeWorkerStableIds.has(stableId)) return;
        const worker = getWorkerForRow(row);
        const salaryType = getRowSalaryType(row, worker);
        if (salaryType !== '용역팀') return;
        
        const date = String(row.date || '').trim();
        if (!workerDateMap.has(stableId)) workerDateMap.set(stableId, []);
        const dates = workerDateMap.get(stableId)!;
        if (!dates.includes(date)) dates.push(date);
      });

      // 각 작업자별 날짜 정렬
      workerDateMap.forEach((dates, sid) => {
        workerDateMap.set(sid, dates.sort());
      });

      const getCumulativeIndex = (sid: string, date: string): number => {
        const dates = workerDateMap.get(sid);
        if (!dates) return 999;
        const idx = dates.indexOf(date);
        return idx >= 0 ? idx + 1 : 999;
      };
      // ----------------------------------------------------

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

      const serviceRecruiterFeeAppliedDateKeys = new Set<string>();

      const nextEntries: WorkbookEntry[] = reportRows
        .map((row) => {
          const worker = getWorkerForRow(row);
          const salaryType = getRowSalaryType(row, worker);
          if (!isDailyWageLabel(salaryType)) return null;

          const workerId = getStableIdForRow(row);
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

          const claimUnitPrice = toNumber(
            getDefaultClaimUnitPrice(toNumber(row.unitPrice || worker?.unitPrice || 0))
          );
          const actualUnitPrice = getActualUnitPrice(claimUnitPrice);
          const reportUnitPrice = toNumber(row.unitPrice || worker?.unitPrice || 0);
          const manDay = toNumber(row.manDay);
          const date = displayText(row.date);
          const day = getDayNumber(date);
          const note = displayText(row.workContent || nextProfiles[workerId]?.memo || '');
          
          // 누적 순번 계산
          const cumulativeCount = getCumulativeIndex(workerId, date);
          
          const isServiceEntry = salaryType === '용역팀';
          const serviceDateKey = `${workerId}__${date}`;
          const isRecruiterFeeDay =
            isServiceEntry &&
            cumulativeCount >= 1 &&
            cumulativeCount <= SERVICE_RECRUITER_FEE_MAX_DAYS &&
            !serviceRecruiterFeeAppliedDateKeys.has(serviceDateKey);
          const recruiterFee = isRecruiterFeeDay ? SERVICE_RECRUITER_FEE_PER_DAY : 0;
          if (isRecruiterFeeDay) {
            serviceRecruiterFeeAppliedDateKeys.add(serviceDateKey);
          }

          const entry: WorkbookEntry = {
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
            claimAmount: manDay * reportUnitPrice,
            reportUnitPrice,
            workerAmount: toNumber((row as any)?.amount ?? manDay * reportUnitPrice),
            recruiterFee,
            note,
            cumulativeCount,
          };
          return entry;
        })
        .filter((entry): entry is WorkbookEntry => entry !== null);

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
    setManDayDrafts((prev) => {
      const validKeys = new Set(entries.map((entry) => entry.key));
      const nextEntries = Object.entries(prev).filter(([key]) => validKeys.has(key));
      return Object.fromEntries(nextEntries);
    });
  }, [entries]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const dailyWageWorkers = useMemo(() => {
    const workerIdSet = new Set(entries.map((entry) => entry.workerId));

    return workers
      .filter((worker) => {
        const stableId = resolveWorkerStableId(worker);
        const currentId = String(worker.id ?? '').trim();
        const legacyId = String(worker.legacyId ?? '').trim();
        return (
          (stableId && workerIdSet.has(stableId)) ||
          (currentId && workerIdSet.has(currentId)) ||
          (legacyId && workerIdSet.has(legacyId))
        );
      })
      .sort((left, right) => {
        const leftTeam = displayText(left.teamName || '');
        const rightTeam = displayText(right.teamName || '');
        const teamCompare = leftTeam.localeCompare(rightTeam, 'ko');
        if (teamCompare !== 0) return teamCompare;
        return displayText(left.name).localeCompare(displayText(right.name), 'ko');
      });
  }, [entries, workers]);

  const teamOptions = useMemo<TeamOption[]>(() => {
    const optionMap = new Map<string, TeamOption>();
    entries.forEach((entry) => {
      if (!entry.teamKey || optionMap.has(entry.teamKey)) return;
      const team = teams.find((candidate) => String(candidate.id ?? '').trim() === entry.teamId) || null;
      const isServiceTeam = isServiceTeamNode(team);
      
      optionMap.set(entry.teamKey, {
        key: entry.teamKey,
        name: entry.teamName,
        team,
        isServiceTeam,
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

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (activeTab === 'service-team') {
      // 급여 구분이 '용역팀'인 경우만 필터링
      result = entries.filter(e => e.salaryType === '용역팀');
    } else {
      result = entries.filter(e => isStrictDailyWageLabel(e.salaryType));
    }

    if (selectedTeamKey !== 'ALL') {
      result = result.filter((entry) => entry.teamKey === selectedTeamKey);
    }
    return result;
  }, [entries, activeTab, selectedTeamKey, teamOptions, workers]);

  const allWorkerMasterRows = useMemo<WorkerMasterRow[]>(() => {
    const workerIds = new Set(filteredEntries.map(e => e.workerId));
    
    return dailyWageWorkers
      .filter(w => workerIds.has(resolveWorkerStableId(w)))
      .map((worker) => {
        const workerId = resolveWorkerStableId(worker);
        const workerEntries = filteredEntries.filter((entry) => entry.workerId === workerId);
        const profile = profiles[workerId];
        const latestWorkerEntry = workerEntries[workerEntries.length - 1];
        const claimUnitPrice = toNumber(
          getDefaultClaimUnitPrice(
            toNumber(latestWorkerEntry?.claimUnitPrice || latestWorkerEntry?.reportUnitPrice || worker.unitPrice || 0)
          )
        );
        const actualUnitPrice = getActualUnitPrice(claimUnitPrice);
        const memo = displayText(profile?.memo || '');
        const teamName = displayText(worker.teamName || workerEntries[0]?.teamName || '미지정팀');
        const teamKey =
          String(worker.teamId ?? '').trim() ||
          workerEntries[0]?.teamKey ||
          `unresolved:${normalizeTeamName(teamName || worker.name)}`;

        const isServiceTeam = teamOptions.find(t => t.key === teamKey)?.isServiceTeam;

        // 용역팀 소개비는 첫 근무일부터 근무일 기준 5일까지 일자당 60,000원만 반영한다.
        const totalManDay = workerEntries.reduce((sum, entry) => {
          const draftValue = manDayDrafts[entry.key];
          const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
          return sum + nextManDay;
        }, 0);
        let recruiterFee = 0;
        if (activeTab === 'service-team') {
          recruiterFee = workerEntries.reduce((sum, entry) => sum + entry.recruiterFee, 0);
        } else {
          recruiterFee = statementRecruiterFeeValues[buildStatementRecruiterFeeKey(month, teamKey, workerId)] || 0;
        }
        const actualTotal = workerEntries.reduce((sum, entry) => {
          const draftValue = manDayDrafts[entry.key];
          const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
          return sum + nextManDay * entry.actualUnitPrice;
        }, 0);
        const claimTotal = workerEntries.reduce((sum, entry) => {
          const draftValue = manDayDrafts[entry.key];
          const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
          return sum + nextManDay * entry.reportUnitPrice;
        }, 0);

        return {
          workerId,
          teamKey,
          teamName,
          workerName: displayText(worker.name),
          salaryType: getNormalizedSalaryTypeLabel(worker.salaryModel, worker.payType, workerEntries[0]?.salaryType),
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
          isServiceTeam,
        };
      });
  }, [dailyWageWorkers, filteredEntries, manDayDrafts, month, profiles, statementRecruiterFeeValues, teamOptions]);

  const workerMasterRows = allWorkerMasterRows;

  useEffect(() => {
    const nextDrafts: Record<string, WorkerProfileDraft> = {};
    allWorkerMasterRows.forEach((row) => {
      nextDrafts[row.workerId] = {
        claimUnitPrice: row.claimUnitPrice ? String(row.claimUnitPrice) : '',
        memo: row.memo || '',
      };
    });
    setProfileDrafts(nextDrafts);
  }, [allWorkerMasterRows]);

  const selectedDateEntries = useMemo(() => {
    return filteredEntries.filter((entry) => entry.date === selectedDate);
  }, [filteredEntries, selectedDate]);

  const workbookStats = useMemo(() => {
    const totalManDay = filteredEntries.reduce((sum, entry) => {
      const draftValue = manDayDrafts[entry.key];
      const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
      return sum + nextManDay;
    }, 0);
    const totalActualAmount = filteredEntries.reduce((sum, entry) => {
      const draftValue = manDayDrafts[entry.key];
      const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
      return sum + nextManDay * entry.actualUnitPrice;
    }, 0);
    const totalClaimAmount = filteredEntries.reduce((sum, entry) => {
      const draftValue = manDayDrafts[entry.key];
      const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
      return sum + nextManDay * entry.reportUnitPrice;
    }, 0);
    const workerCount = new Set(filteredEntries.map((entry) => entry.workerId)).size;
    const teamCount = new Set(filteredEntries.map((entry) => entry.teamKey)).size;

    return {
      totalManDay,
      totalActualAmount,
      totalClaimAmount,
      workerCount,
      teamCount,
    };
  }, [filteredEntries, manDayDrafts]);

  const statementTeamOption = useMemo(
    () => teamOptions.find((option) => option.key === statementTeamKey) || null,
    [statementTeamKey, teamOptions]
  );

  const getStatementAmount = useCallback(
    (entry: WorkbookEntry): number => {
      const draftValue = manDayDrafts[entry.key];
      const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
      return nextManDay * entry.claimUnitPrice;
    },
    [manDayDrafts]
  );

  const statementEntries = useMemo(() => {
    if (!statementTeamKey) return [];
    return filteredEntries.filter((entry) => entry.teamKey === statementTeamKey);
  }, [filteredEntries, statementTeamKey]);

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
        salaryType: string;
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
          salaryType: entry.salaryType,
          days: Array.from({ length: statementLastDay }, () => 0),
          totalManDay: 0,
          recruiterFee: entry.recruiterFee || (statementRecruiterFeeValues[buildStatementRecruiterFeeKey(month, statementTeamKey, entry.workerId)] || 0),
          selectedAmount: 0,
        });
      }

      const target = rowMap.get(key)!;
      const draftValue = manDayDrafts[entry.key];
      const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
      if (entry.day >= 1 && entry.day <= statementLastDay) {
        target.days[entry.day - 1] += nextManDay;
      }
      target.totalManDay += nextManDay;
      target.selectedAmount += getStatementAmount(entry);
      if (!target.idNumber && entry.idNumber) target.idNumber = entry.idNumber;
      if (!target.address && entry.address) target.address = entry.address;
      if (!target.salaryType && entry.salaryType) target.salaryType = entry.salaryType;
    });

    return Array.from(rowMap.values()).sort((left, right) =>
      left.workerName.localeCompare(right.workerName, 'ko')
    );
  }, [getStatementAmount, manDayDrafts, month, statementEntries, statementLastDay, statementRecruiterFeeValues, statementTeamKey]);

  const statementDailyTotals = useMemo(() => {
    const totals = Array.from({ length: statementLastDay }, () => 0);
    statementEntries.forEach((entry) => {
      const draftValue = manDayDrafts[entry.key];
      const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
      if (entry.day >= 1 && entry.day <= statementLastDay) {
        totals[entry.day - 1] += nextManDay;
      }
    });
    return totals;
  }, [manDayDrafts, statementEntries, statementLastDay]);

  const serviceRows = useMemo(() => {
    const groupedRows = new Map<string, {
      teamKey: string;
      teamName: string;
      workerId: string;
      workerName: string;
      idNumber: string;
      entriesByDay: Record<number, WorkbookEntry>;
      totalManDay: number;
      totalRecruiterFee: number;
    }>();

    filteredEntries.forEach((entry) => {
      const rowKey = `${entry.teamKey}__${entry.workerId || normalizeText(entry.workerName)}`;
      if (!groupedRows.has(rowKey)) {
        groupedRows.set(rowKey, {
          teamKey: entry.teamKey,
          teamName: entry.teamName,
          workerId: entry.workerId,
          workerName: entry.workerName,
          idNumber: entry.idNumber,
          entriesByDay: {},
          totalManDay: 0,
          totalRecruiterFee: 0,
        });
      }

      const workerRow = groupedRows.get(rowKey)!;
      const existingDayEntry = workerRow.entriesByDay[entry.day];
      if (existingDayEntry) {
        workerRow.entriesByDay[entry.day] = {
          ...existingDayEntry,
          manDay: existingDayEntry.manDay + entry.manDay,
          recruiterFee: existingDayEntry.recruiterFee + entry.recruiterFee,
          cumulativeCount: existingDayEntry.recruiterFee > 0
            ? existingDayEntry.cumulativeCount
            : entry.cumulativeCount,
        };
      } else {
        workerRow.entriesByDay[entry.day] = entry;
      }
      workerRow.totalManDay += entry.manDay;
      workerRow.totalRecruiterFee += entry.recruiterFee;
    });

    return Array.from(groupedRows.values()).sort((left, right) => {
      const teamCompare = left.teamName.localeCompare(right.teamName, 'ko');
      if (teamCompare !== 0) return teamCompare;
      return left.workerName.localeCompare(right.workerName, 'ko');
    });
  }, [filteredEntries]);

  const handleDownloadStatementExcel = useCallback(() => {
    if (statementRows.length === 0) {
      window.alert('엑셀로 다운로드할 청구서 데이터가 없습니다.');
      return;
    }

    const dayHeaders = statementDayNumbers.map((day) => `${day}`);
    const dayStartColumn = 2;
    const totalManDayColumn = dayStartColumn + statementDayNumbers.length;
    const recruiterFeeColumn = totalManDayColumn + 1;
    const amountColumn = recruiterFeeColumn + 1;
    const totalColumnCount = amountColumn + 1;
    const dayColumns = statementDayNumbers.map((_, index) => dayStartColumn + index);
    const centerColumns = new Set([0, ...dayColumns]);
    const rightColumns = new Set([totalManDayColumn, recruiterFeeColumn, amountColumn]);
    const statementCompanyName = displayText(
      statementTeamOption?.team?.companyName ||
      statementEntries.find((entry) => displayText(entry.companyName))?.companyName ||
      '청연이엔지'
    );
    const statementTeamName = statementTeamOption?.name || statementEntries[0]?.teamName || '-';
    const statementPeriod = monthToPeriod(month);
    const statementPeriodLabel = statementPeriod.startDate && statementPeriod.endDate
      ? `${getMonthTitle(month)} (${statementPeriod.startDate} ~ ${statementPeriod.endDate})`
      : getMonthTitle(month);
    const titleRow = [
      `${statementCompanyName} / ${statementTeamName} / 청구기간: ${statementPeriodLabel}`,
      ...Array.from({ length: totalColumnCount - 1 }, () => ''),
    ];
    const rows: Array<Array<ExcelCellValue>> = [
      titleRow,
      [
        '번호',
        '이름',
        ...dayHeaders,
        '출역',
        '인력소개비',
        '청구금액',
      ],
      ...statementRows.map((row, index) => {
        const storageKey = buildStatementRecruiterFeeKey(month, statementTeamKey, row.workerId);
        const recruiterFeeDraft = statementRecruiterFeeDrafts[storageKey];
        const recruiterFee = recruiterFeeDraft === undefined
          ? row.recruiterFee
          : parseMoneyInput(recruiterFeeDraft);

        return [
          index + 1,
          row.workerName,
          ...row.days.map((value) => (value ? Number(value.toFixed(1)) : '-')),
          Number(row.totalManDay.toFixed(1)),
          recruiterFee ? Math.round(recruiterFee) : '',
          Math.round(row.selectedAmount + recruiterFee),
        ];
      }),
      [
        '일자별 공수합계',
        '',
        ...statementDailyTotals.map((value) => (value ? Number(value.toFixed(1)) : '-')),
        Number(statementRows.reduce((sum, row) => sum + row.totalManDay, 0).toFixed(1)),
        Math.round(statementRows.reduce((sum, row) => {
          const storageKey = buildStatementRecruiterFeeKey(month, statementTeamKey, row.workerId);
          const recruiterFeeDraft = statementRecruiterFeeDrafts[storageKey];
          const recruiterFee = recruiterFeeDraft === undefined
            ? row.recruiterFee
            : parseMoneyInput(recruiterFeeDraft);
          return sum + recruiterFee;
        }, 0)),
        Math.round(statementRows.reduce((sum, row) => {
          const storageKey = buildStatementRecruiterFeeKey(month, statementTeamKey, row.workerId);
          const recruiterFeeDraft = statementRecruiterFeeDrafts[storageKey];
          const recruiterFee = recruiterFeeDraft === undefined
            ? row.recruiterFee
            : parseMoneyInput(recruiterFeeDraft);
          return sum + row.selectedAmount + recruiterFee;
        }, 0)),
      ],
    ];

    downloadAoaAsExcel(
      `${month}_${statementTeamOption?.name || '청구서'}_청구서_${getTodayStamp()}`,
      '청구서',
      rows,
      [8, 16, ...statementDayNumbers.map(() => 5), 9, 12, 14],
      {
        titleRowIndex: 0,
        headerRowIndex: 1,
        titleFill: COLORS.darkBrown,
        headerFill: COLORS.darkBrown,
        totalFill: COLORS.pink,
        bodyAlternateFill: '#FAF8EF',
        specialHeaderFills: {
          [recruiterFeeColumn]: COLORS.aqua,
          [amountColumn]: COLORS.wine,
        },
        centerColumns,
        rightColumns,
        moneyColumns: new Set([recruiterFeeColumn, amountColumn]),
        manDayColumns: new Set([...dayColumns, totalManDayColumn]),
        totalRowIndex: rows.length - 1,
        merges: [
          {
            s: { r: 0, c: 0 },
            e: { r: 0, c: amountColumn },
          },
          {
            s: { r: rows.length - 1, c: 0 },
            e: { r: rows.length - 1, c: 1 },
          },
        ],
      }
    );
  }, [
    month,
    statementDailyTotals,
    statementDayNumbers,
    statementRecruiterFeeDrafts,
    statementRows,
    statementTeamKey,
    statementEntries,
    statementTeamOption?.name,
    statementTeamOption?.team?.companyName,
  ]);

  const handleDownloadServiceTeamExcel = useCallback(() => {
    if (serviceRows.length === 0) {
      window.alert('엑셀로 다운로드할 용역팀 데이터가 없습니다.');
      return;
    }

    const dayHeaders = statementDayNumbers.map((day) => `${day}`);
    const dayStartColumn = 2;
    const totalManDayColumn = dayStartColumn + statementDayNumbers.length;
    const recruiterFeeColumn = totalManDayColumn + 1;
    const dayColumns = statementDayNumbers.map((_, index) => dayStartColumn + index);
    const highlightedCells = new Set<string>();
    const rows: Array<Array<ExcelCellValue>> = [
      ['팀명', '이름', ...dayHeaders, '총공수', '인력소개비', '비고'],
      ...serviceRows.map((row, rowIndex) => [
        row.teamName,
        row.workerName,
        ...statementDayNumbers.map((day, dayIndex) => {
          const entry = row.entriesByDay[day];
          if (entry?.recruiterFee && entry.recruiterFee > 0) {
            highlightedCells.add(`${rowIndex + 1}:${dayStartColumn + dayIndex}`);
          }
          const value = entry?.manDay || 0;
          return value ? Number(value.toFixed(1)) : '-';
        }),
        Number(row.totalManDay.toFixed(1)),
        Math.round(row.totalRecruiterFee),
        row.totalRecruiterFee > 0 ? `소개비 ${Math.round(row.totalRecruiterFee / SERVICE_RECRUITER_FEE_PER_DAY)}일분 포함` : '-',
      ]),
    ];

    downloadAoaAsExcel(
      `${month}_용역팀_정산_${getTodayStamp()}`,
      '용역팀',
      rows,
      [16, 16, ...statementDayNumbers.map(() => 7), 10, 14, 22],
      {
        headerFill: COLORS.blue,
        specialHeaderFills: {
          [recruiterFeeColumn]: COLORS.orange,
        },
        specialColumnFills: {
          0: '#FAF8EF',
          [recruiterFeeColumn]: '#FFF7ED',
        },
        highlightedCells,
        highlightedCellFill: '#DBEAFE',
        centerColumns: new Set(dayColumns),
        rightColumns: new Set([totalManDayColumn, recruiterFeeColumn]),
        moneyColumns: new Set([recruiterFeeColumn]),
        manDayColumns: new Set([...dayColumns, totalManDayColumn]),
        rowHeight: 30,
      }
    );
  }, [month, serviceRows, statementDayNumbers]);

  const teamSummaryRows = useMemo(() => {
    const rowMap = new Map<string, { name: string; days: number[]; total: number }>();
    filteredEntries.forEach((entry) => {
      if (!rowMap.has(entry.teamKey)) {
        rowMap.set(entry.teamKey, {
          name: entry.teamName,
          days: Array.from({ length: statementLastDay }, () => 0),
          total: 0,
        });
      }
      const target = rowMap.get(entry.teamKey)!;
      const draftValue = manDayDrafts[entry.key];
      const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
      if (entry.day >= 1 && entry.day <= statementLastDay) {
        target.days[entry.day - 1] += nextManDay;
      }
      target.total += nextManDay;
    });

    return Array.from(rowMap.entries())
      .map(([teamKey, row]) => ({ teamKey, ...row }))
      .sort((left, right) => left.name.localeCompare(right.name, 'ko'));
  }, [filteredEntries, manDayDrafts, statementLastDay]);

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
        const baselineMemo = row.memo || '';
        return String(draft.memo ?? '') !== baselineMemo;
      })
      .map((row) => row.workerId);
  }, [allWorkerMasterRows, profileDrafts]);

  const handleManDayDraftChange = useCallback((entryKey: string, value: string) => {
    setManDayDrafts((prev) => ({
      ...prev,
      [entryKey]: value,
    }));
  }, []);

  const statementRecruiterFeeDirtyKeys = useMemo(() => {
    if (!statementTeamKey) return [] as string[];

    return statementRows
      .map((row) => buildStatementRecruiterFeeKey(month, statementTeamKey, row.workerId))
      .filter((storageKey) => {
        const draftValue = statementRecruiterFeeDrafts[storageKey];
        const baselineValue = statementRecruiterFeeValues[storageKey] || 0;
        if (draftValue === undefined) return false;
        return parseMoneyInput(draftValue) !== baselineValue;
      });
  }, [month, statementRecruiterFeeDrafts, statementRecruiterFeeValues, statementRows, statementTeamKey]);

  const handleStatementRecruiterFeeDraftChange = useCallback((storageKey: string, value: string) => {
    setStatementRecruiterFeeDrafts((prev) => ({
      ...prev,
      [storageKey]: value,
    }));
  }, []);

  const handleSaveStatementRecruiterFees = useCallback(() => {
    if (typeof window === 'undefined' || !statementTeamKey) return;

    setSavingStatementRecruiterFees(true);
    try {
      const nextValues = { ...statementRecruiterFeeValues };

      statementRows.forEach((row) => {
        const storageKey = buildStatementRecruiterFeeKey(month, statementTeamKey, row.workerId);
        const draftValue = statementRecruiterFeeDrafts[storageKey];
        const nextValue = draftValue === undefined
          ? (statementRecruiterFeeValues[storageKey] || 0)
          : parseMoneyInput(draftValue);

        if (nextValue > 0) {
          nextValues[storageKey] = nextValue;
        } else {
          delete nextValues[storageKey];
        }
      });

      window.localStorage.setItem(
        DAILY_ADVANCE_STATEMENT_RECRUITER_FEE_STORAGE_KEY,
        JSON.stringify(nextValues)
      );
      setStatementRecruiterFeeValues(nextValues);
      window.alert('청구서 인력소개비를 저장했습니다.');
    } catch (error) {
      console.error('Failed to save statement recruiter fees:', error);
      window.alert('청구서 인력소개비 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingStatementRecruiterFees(false);
    }
  }, [month, statementRecruiterFeeDrafts, statementRecruiterFeeValues, statementRows, statementTeamKey]);

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
        <table className="min-w-[900px] border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: COLORS.olive }} className="text-white">
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">팀</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">이름</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">일자</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">공수</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">일당</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">실지급액</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold" style={{ backgroundColor: COLORS.aqua, color: COLORS.blackBrown }}>청구금액</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">비고</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0
              ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    조회 조건에 맞는 데이터가 없습니다.
                  </td>
                </tr>
              )
              : filteredEntries.map((entry) => {
                  const draftValue = manDayDrafts[entry.key];
                  const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
                  const actualAmount = nextManDay * entry.actualUnitPrice;
                  const claimAmount = nextManDay * entry.reportUnitPrice;

                  return (
                    <tr key={entry.key} className="odd:bg-white even:bg-[#faf8ef]">
                      <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center">{entry.teamName}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center">{entry.workerName}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center">{entry.date}</td>
                      <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={draftValue ?? String(entry.manDay)}
                          onChange={(event) => handleManDayDraftChange(entry.key, event.target.value)}
                          className="w-20 rounded border border-[#d7cfb5] px-2 py-1 text-right text-xs outline-none focus:border-[#948A54]"
                        />
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center font-bold text-[#4A452A]">
                        {formatCurrency(entry.actualUnitPrice)}
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center font-black text-[#4A452A]">
                        {formatCurrency(actualAmount)}
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center font-semibold text-sky-700">
                        {formatCurrency(claimAmount)}
                      </td>
                      <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center">{entry.note || '-'}</td>
                    </tr>
                  );
                })}
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
            청구단가는 인원DB에 저장된 DB 청구단가를 사용하고, 일당은 청구단가에서 15,000원을 차감해 계산합니다. 청구금액은 일보 작업자금액 기준으로 계산합니다.
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
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">팀</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">이름</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">주민등록번호</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">급여구분</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">주소</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">연락처</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">은행명(예금주)</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">계좌번호</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">일당</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">청구단가</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">상태</th>
              <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">비고</th>
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
                    <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center">{row.teamName}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center">{row.workerName}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center">{row.idNumber || '-'}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2 align-middle text-center">{row.salaryType || '-'}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2 align-middle">{row.address || '-'}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2">{row.contact || '-'}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2">
                      {row.bankName
                        ? `${row.bankName}${row.accountHolder ? ` (${row.accountHolder})` : ''}`
                        : '-'}
                    </td>
                    <td className="border border-[#e3dcc4] px-3 py-2">{row.accountNumber || '-'}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2 text-right font-bold text-[#4A452A]">
                      {formatCurrency(row.actualUnitPrice)}
                    </td>
                    <td className="border border-[#e3dcc4] px-2 py-2">
                      <input
                        type="text"
                        value={draft.claimUnitPrice}
                        readOnly
                        className="w-full cursor-not-allowed rounded border border-slate-200 bg-slate-50 px-2 py-1 text-right text-slate-600 outline-none"
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
              청구단가 기준으로 노무금액을 계산하며, 인력소개비는 이 청구서 화면에서 입력 후 저장합니다.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-[#d5ccb0] bg-white px-3 py-3 shadow-sm">
            <button
              type="button"
              onClick={handleSaveStatementRecruiterFees}
              disabled={savingStatementRecruiterFees}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              인력소개비 저장{statementRecruiterFeeDirtyKeys.length > 0 ? ` (${statementRecruiterFeeDirtyKeys.length})` : ''}
            </button>
            <button
              type="button"
              onClick={handleDownloadStatementExcel}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
            >
              <FontAwesomeIcon icon={faDownload} />
              <span>엑셀 다운로드</span>
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-[#d5ccb0] p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[#d5ccb0] p-4" style={{ backgroundColor: COLORS.orange }}>
            <div className="text-xs font-bold text-[#4A452A]">회사</div>
            <div className="mt-2 text-base font-black text-[#1E1C11]">
              {statementTeamOption?.team?.companyName || filteredEntries.find(e => e.teamKey === statementTeamKey)?.companyName || '청연이엔지'}
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
        <table className="min-w-[1280px] border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: COLORS.darkBrown }} className="text-white">
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold">번호</th>
              <th className="border border-[#d5ccb0] px-3 py-2 font-bold">이름</th>
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
                청구금액
              </th>
            </tr>
          </thead>
          <tbody>
            {statementRows.length === 0 ? (
              <tr>
                <td
                  colSpan={statementDayNumbers.length + 5}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  청구서로 만들 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              statementRows.map((row, index) => {
                const storageKey = buildStatementRecruiterFeeKey(month, statementTeamKey, row.workerId);
                const recruiterFeeDraft = statementRecruiterFeeDrafts[storageKey];
                const recruiterFee = recruiterFeeDraft === undefined
                  ? row.recruiterFee
                  : parseMoneyInput(recruiterFeeDraft);
                const totalInvoiceAmount = row.selectedAmount + recruiterFee;

                return (
                  <tr key={row.workerId || row.workerName} className="odd:bg-white even:bg-[#faf8ef]">
                    <td className="border border-[#e3dcc4] px-3 py-2 text-center">{index + 1}</td>
                    <td className="border border-[#e3dcc4] px-3 py-2 font-semibold">{row.workerName}</td>
                    {row.days.map((value, dayIndex) => (
                      <td
                        key={`${row.workerId}-${dayIndex}`}
                        className="border border-[#e3dcc4] px-2 py-2 text-center align-middle"
                      >
                        {value ? formatNumber(value) : '-'}
                      </td>
                    ))}
                    <td className="border border-[#e3dcc4] px-3 py-2 text-right font-black text-[#4A452A]">
                      {formatNumber(row.totalManDay)}
                    </td>
                    <td className="border border-[#e3dcc4] px-2 py-2 text-right">
                      <input
                        type="text"
                        value={recruiterFeeDraft ?? (recruiterFee ? String(recruiterFee) : '')}
                        onChange={(event) => handleStatementRecruiterFeeDraftChange(storageKey, event.target.value)}
                        className="w-full rounded border border-[#d7cfb5] px-2 py-1 text-right outline-none focus:border-[#948A54]"
                        placeholder="0"
                      />
                    </td>
                    <td className="border border-[#e3dcc4] px-3 py-2 text-right font-black text-[#7a2c2c]">
                      {formatCurrency(totalInvoiceAmount)}
                    </td>
                  </tr>
                );
              })
            )}
            {statementRows.length > 0 && (
              <tr style={{ backgroundColor: COLORS.pink }}>
                <td colSpan={2} className="border border-[#d5ccb0] px-3 py-2 font-black">
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
                  {formatCurrency(
                    statementRows.reduce((sum, row) => {
                      const storageKey = buildStatementRecruiterFeeKey(month, statementTeamKey, row.workerId);
                      const recruiterFeeDraft = statementRecruiterFeeDrafts[storageKey];
                      const recruiterFee = recruiterFeeDraft === undefined
                        ? row.recruiterFee
                        : parseMoneyInput(recruiterFeeDraft);
                      return sum + recruiterFee;
                    }, 0)
                  )}
                </td>
                <td className="border border-[#d5ccb0] px-3 py-2 text-right font-black">
                  {formatCurrency(statementRows.reduce((sum, row) => {
                    const storageKey = buildStatementRecruiterFeeKey(month, statementTeamKey, row.workerId);
                    const recruiterFeeDraft = statementRecruiterFeeDrafts[storageKey];
                    const recruiterFee = recruiterFeeDraft === undefined
                      ? row.recruiterFee
                      : parseMoneyInput(recruiterFeeDraft);
                    return sum + row.selectedAmount + recruiterFee;
                  }, 0))}
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
                {formatNumber(
                  selectedDateEntries.reduce((sum, entry) => {
                    const draftValue = manDayDrafts[entry.key];
                    const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
                    return sum + nextManDay;
                  }, 0)
                )}
              </div>
            </div>
            <div className="rounded-md border border-[#d5ccb0] bg-white px-3 py-3">
              <div className="text-xs font-bold text-slate-500">선택일 실지급금</div>
              <div className="mt-1 text-lg font-black text-[#4A452A]">
                {formatCurrency(
                  selectedDateEntries.reduce(
                    (sum, entry) => {
                      const draftValue = manDayDrafts[entry.key];
                      const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
                      return sum + nextManDay * getActualUnitPrice(entry.claimUnitPrice);
                    },
                    0
                  )
                )}
              </div>
            </div>
            <div className="rounded-md border border-[#d5ccb0] bg-white px-3 py-3">
              <div className="text-xs font-bold text-slate-500">선택일 청구금 합계</div>
              <div className="mt-1 text-lg font-black text-[#4A452A]">
                {formatCurrency(
                  selectedDateEntries.reduce((sum, entry) => {
                    const draftValue = manDayDrafts[entry.key];
                    const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
                    return sum + nextManDay * entry.reportUnitPrice;
                  }, 0)
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] border-collapse text-sm">
              <thead>
                <tr style={{ backgroundColor: COLORS.blackBrown }} className="text-white">
                  {['팀', '이름', '현장', '공수'].map((header) => (
                    <th key={header} className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">{header}</th>
                  ))}
                  <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">실지급금</th>
                  <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold" style={{ backgroundColor: COLORS.aqua, color: COLORS.blackBrown }}>청구금액</th>
                  {['은행명', '예금주명'].map((header) => (
                    <th key={header} className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">{header}</th>
                  ))}
                  <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold" style={{ backgroundColor: COLORS.red }}>
                    계좌번호
                  </th>
                  <th className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">비고</th>
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
                  selectedDateEntries.map((entry) => {
                    const draftValue = manDayDrafts[entry.key];
                    const nextManDay = draftValue === undefined ? entry.manDay : toNumber(draftValue);
                    const actualAmount = nextManDay * getActualUnitPrice(entry.claimUnitPrice);
                    const claimAmount = nextManDay * entry.reportUnitPrice;
                    return (
                      <tr key={entry.key} className="odd:bg-white even:bg-[#faf8ef]">
                        <td className="border border-[#e3dcc4] px-3 py-2">{entry.teamName}</td>
                        <td className="border border-[#e3dcc4] px-3 py-2 font-semibold">{entry.workerName}</td>
                        <td className="border border-[#e3dcc4] px-3 py-2">{entry.siteName || '-'}</td>
                        <td className="border border-[#e3dcc4] px-2 py-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={draftValue ?? String(entry.manDay)}
                            onChange={(event) => handleManDayDraftChange(entry.key, event.target.value)}
                            className="w-20 rounded border border-[#d7cfb5] px-2 py-1 text-right text-xs outline-none focus:border-[#948A54]"
                          />
                        </td>
                        <td className="border border-[#e3dcc4] px-3 py-2 text-right font-black text-[#4A452A]">
                          {formatCurrency(actualAmount)}
                        </td>
                        <td className="border border-[#e3dcc4] px-3 py-2 text-right font-semibold text-sky-700">
                          {formatCurrency(claimAmount)}
                        </td>
                        <td className="border border-[#e3dcc4] px-3 py-2">{entry.bankName || '-'}</td>
                        <td className="border border-[#e3dcc4] px-3 py-2">{entry.accountHolder || '-'}</td>
                        <td className="border border-[#e3dcc4] px-3 py-2 font-medium text-[#7a2c2c]">
                          {entry.accountNumber || '-'}
                        </td>
                        <td className="border border-[#e3dcc4] px-3 py-2">{entry.note || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDailyWageTab = () => (
    <div className="overflow-hidden rounded-xl border border-[#d5ccb0] bg-white shadow-sm">
      <div className="border-b border-[#d5ccb0] bg-[#faf8ef] px-4 py-3">
        <div className="text-sm font-black text-[#4A452A]">일급제 인원 현황</div>
        <div className="text-xs text-slate-500">
          {getMonthTitle(month)} 기준 일급제 인원별 총공수, 실지급금, 청구금 현황
        </div>
      </div>
      <div className="grid gap-px bg-[#d5ccb0] sm:grid-cols-4">
        {[
          ['인원수', `${workerMasterRows.length}명`],
          ['총공수', formatNumber(workerMasterRows.reduce((s, r) => s + r.totalManDay, 0))],
          ['총 실지급금', formatCurrency(workerMasterRows.reduce((s, r) => s + r.actualTotal, 0))],
          ['총 청구금', formatCurrency(workerMasterRows.reduce((s, r) => s + r.claimTotal, 0))],
        ].map(([label, value]) => (
          <div key={label} className="bg-[#faf8ef] px-4 py-3">
            <div className="text-xs font-bold text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-black text-[#4A452A]">{value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: COLORS.olive }} className="text-white">
              {['번호', '팀', '이름', '총공수', '실지급금', '청구금', '일당', '청구단가', '인력소개비', '상태'].map((header) => (
                <th key={header} className="border border-[#d5ccb0] px-3 py-2 text-center font-bold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workerMasterRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                  표시할 일급제 작업자가 없습니다.
                </td>
              </tr>
            ) : (
              workerMasterRows.map((row, index) => (
                <tr key={row.workerId} className="odd:bg-white even:bg-[#faf8ef]">
                  <td className="border border-[#e3dcc4] px-3 py-2 text-center">{index + 1}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2 align-middle">
                    <span>{row.teamName}</span>
                    <span className="ml-2 text-xs text-slate-500 align-middle">[{row.salaryType}]</span>
                  </td>
                  <td className="border border-[#e3dcc4] px-3 py-2 font-semibold">{row.workerName}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-center font-bold">{formatNumber(row.totalManDay)}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right font-bold text-[#4A452A]">
                    {formatCurrency(row.actualTotal)}
                  </td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right font-bold text-sky-700">
                    {formatCurrency(row.claimTotal)}
                  </td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right">{formatCurrency(row.actualUnitPrice)}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right">{formatCurrency(row.claimUnitPrice)}</td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-right">
                    {row.recruiterFee ? formatCurrency(row.recruiterFee) : '-'}
                  </td>
                  <td className="border border-[#e3dcc4] px-3 py-2 text-center">
                    {row.status === '신규' ? (
                      <span className="rounded bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">신규</span>
                    ) : (
                      row.status || '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderServiceTeamTab = () => {
    const serviceStickyHeaderStyle = {
      backgroundColor: COLORS.blue,
      height: '48px',
      minHeight: '48px',
    } as const;

    const serviceStickyCellStyle = {
      height: '48px',
      minHeight: '48px',
    } as const;

    return (
      <div className="overflow-hidden rounded-xl border border-[#d5ccb0] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#d5ccb0] bg-blue-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
          <div className="text-sm font-black text-blue-900">용역팀 정산 관리 (인력소개비 자동계산)</div>
          <div className="text-xs text-blue-700">
            작업자별 첫 근무일부터 근무일 기준 5일간 일 60,000원, 최대 300,000원의 소개비를 자동 부과합니다.
          </div>
        </div>

          <button
            type="button"
            onClick={handleDownloadServiceTeamExcel}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            <FontAwesomeIcon icon={faDownload} />
            <span>엑셀 다운로드</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1800px] border-collapse text-sm">
            <thead>
              <tr style={{ backgroundColor: COLORS.blue }} className="text-white">
                <th
                  className="h-12 w-[120px] min-w-[120px] max-w-[120px] border border-white/20 px-3 py-2 font-bold sticky left-0 z-10 align-middle whitespace-nowrap"
                  style={serviceStickyHeaderStyle}
                >
                  팀명
                </th>
                <th
                  className="h-12 w-[120px] min-w-[120px] max-w-[120px] border border-white/20 px-3 py-2 font-bold sticky left-[120px] z-10 align-middle whitespace-nowrap"
                  style={serviceStickyHeaderStyle}
                >
                  이름
                </th>
                {statementDayNumbers.map((day) => (
                  <th key={day} className="h-12 border border-white/20 px-2 py-2 font-bold align-middle">{day}</th>
                ))}
                <th className="h-12 border border-white/20 px-3 py-2 font-bold text-center align-middle">총공수</th>
                <th className="h-12 border border-white/20 px-3 py-2 font-bold text-center align-middle" style={{ backgroundColor: COLORS.orange }}>인력소개비</th>
                <th className="h-12 border border-white/20 px-3 py-2 font-bold text-center align-middle">비고</th>
              </tr>
            </thead>
            <tbody>
              {serviceRows.length === 0 ? (
                <tr>
                  <td colSpan={statementDayNumbers.length + 5} className="px-4 py-10 text-center text-sm text-slate-500">
                    용역팀 데이터가 없습니다. (팀 유형을 '용역'으로 설정해주세요)
                  </td>
                </tr>
              ) : (
                serviceRows.map((row) => (
                  <tr key={`${row.teamKey}__${row.workerId || normalizeText(row.workerName)}`} className="h-12 hover:bg-blue-50/30">
                    <td
                      className="h-12 w-[120px] min-w-[120px] max-w-[120px] border border-[#e3dcc4] px-3 py-2 font-bold text-[#4A452A] bg-[#faf8ef] sticky left-0 z-10 align-middle whitespace-nowrap"
                      style={serviceStickyCellStyle}
                    >
                      {row.teamName}
                    </td>
                    <td
                      className="h-12 w-[120px] min-w-[120px] max-w-[120px] border border-[#e3dcc4] px-3 py-2 font-semibold bg-white sticky left-[120px] z-10 align-middle whitespace-nowrap"
                      style={serviceStickyCellStyle}
                    >
                      {row.workerName}
                    </td>
                    {statementDayNumbers.map((day) => {
                      const entry = row.entriesByDay[day];
                      const isIntroFeeDay = !!entry && entry.recruiterFee > 0;
                      return (
                        <td
                          key={day}
                          className={`h-12 border border-[#e3dcc4] px-2 py-2 text-center align-middle ${isIntroFeeDay ? 'bg-blue-100 font-bold text-blue-700' : ''}`}
                          title={isIntroFeeDay ? `누적 ${entry?.cumulativeCount}일차` : ''}
                        >
                          {entry ? formatNumber(entry.manDay) : '-'}
                        </td>
                      );
                    })}
                    <td className="h-12 border border-[#e3dcc4] px-3 py-2 text-right font-black align-middle">{formatNumber(row.totalManDay)}</td>
                    <td className="h-12 border border-[#e3dcc4] px-3 py-2 text-right font-black text-orange-600 bg-orange-50 align-middle">
                      {formatCurrency(row.totalRecruiterFee)}
                    </td>
                    <td className="h-12 border border-[#e3dcc4] px-3 py-2 text-xs text-slate-400 italic align-middle">
                      {row.totalRecruiterFee > 0 ? `소개비 ${Math.round(row.totalRecruiterFee / SERVICE_RECRUITER_FEE_PER_DAY)}일분 포함` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'workers':
        return renderWorkersTab();
      case 'team-summary':
        return renderTeamSummaryTab();
      case 'statement':
        return renderStatementTab();
      case 'day-lookup':
        return renderDayLookupTab();
      case 'daily-wage':
        return renderDailyWageTab();
      case 'service-team':
        return renderServiceTeamTab();
      default:
        return null;
    }
  };

  const summaryPanelClassName = isGoyunjungMode
    ? 'rounded-xl border border-white/50 bg-white/40 p-6 shadow-sm'
    : 'rounded-xl border border-[#d9cfb2] bg-white p-6 shadow-sm';

  const filterPanelClassName = isGoyunjungMode
    ? 'rounded-xl border border-white/50 bg-white/40 p-5 shadow-sm'
    : 'rounded-xl border border-[#d9cfb2] bg-white p-5 shadow-sm';

  const tabPanelClassName = isGoyunjungMode
    ? 'space-y-4 rounded-xl border border-white/45 bg-white/25 p-5 shadow-sm'
    : 'space-y-4 rounded-xl border border-[#d9cfb2] bg-[#fbf8ee] p-5 shadow-sm';

  return (
    <div className={`relative min-h-screen overflow-hidden ${isGoyunjungMode ? 'goyunjung-mode' : ''}`}>
      <style>
        {`
          .goyunjung-mode table {
            background-color: transparent !important;
          }

          .goyunjung-mode .overflow-hidden.rounded-xl,
          .goyunjung-mode .overflow-x-auto,
          .goyunjung-mode table tbody {
            background-color: rgba(255, 255, 255, 0.16) !important;
          }

          .goyunjung-mode table thead tr,
          .goyunjung-mode table thead th {
            background-color: rgba(74, 69, 42, 0.64) !important;
          }

          .goyunjung-mode table tbody tr,
          .goyunjung-mode table tbody td {
            background-color: rgba(255, 255, 255, 0.34) !important;
          }

          .goyunjung-mode table tbody tr:nth-child(even) td {
            background-color: rgba(250, 248, 239, 0.24) !important;
          }

          .goyunjung-mode table tbody tr:hover td {
            background-color: rgba(255, 255, 255, 0.48) !important;
          }

          .goyunjung-mode table input {
            background-color: rgba(255, 255, 255, 0.58) !important;
          }

          @keyframes goyunjungBackgroundFadeIn {
            from { opacity: 0; transform: scale(1.015); }
            to { opacity: 0.9; transform: scale(1); }
          }

          @keyframes goyunjungBackgroundFadeOut {
            from { opacity: 0.9; transform: scale(1); }
            to { opacity: 0; transform: scale(1.015); }
          }

          .goyunjung-background-in {
            animation: goyunjungBackgroundFadeIn ${GOYUNJUNG_BACKGROUND_FADE_MS}ms ease-in-out forwards;
          }

          .goyunjung-background-out {
            animation: goyunjungBackgroundFadeOut ${GOYUNJUNG_BACKGROUND_FADE_MS}ms ease-in-out forwards;
          }
        `}
      </style>
      {isGoyunjungMode && (goyunjungBackgroundUrl || goyunjungPreviousBackgroundUrl) && (
        <>
          {goyunjungPreviousBackgroundUrl && (
            <div
              key={`previous-${goyunjungPreviousBackgroundUrl}`}
              className="goyunjung-background-out pointer-events-none absolute inset-0 bg-cover bg-center bg-fixed saturate-[1.08]"
              style={{ backgroundImage: `url("${goyunjungPreviousBackgroundUrl}")` }}
            />
          )}
          {goyunjungBackgroundUrl && (
            <div
              key={`current-${goyunjungBackgroundVersion}-${goyunjungBackgroundUrl}`}
              className="goyunjung-background-in pointer-events-none absolute inset-0 bg-cover bg-center bg-fixed saturate-[1.08]"
              style={{ backgroundImage: `url("${goyunjungBackgroundUrl}")` }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-white/10" />
        </>
      )}

      {/*
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
      */}

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
                실지급금은 일당 기준, 노무청구금은 일보 작업자금액(작업자 단가) 기준으로 계산합니다.
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
