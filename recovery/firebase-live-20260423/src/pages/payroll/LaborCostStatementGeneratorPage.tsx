import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar, Building2, User, CreditCard, Download,
  RotateCcw, Save, Search, Settings, FileText,
  ChevronLeft, ChevronRight, Calculator, Printer, Copy,
  Users, Briefcase, MinusCircle, PlusCircle, Check,
  MoreHorizontal, Filter, Table
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { siteService, Site } from '../../services/siteService';
import { companyService, Company } from '../../services/companyService';

// --- Types ---
type PayType = 'direct' | 'delegate';

type RowState = {
  id: number;
  workerId: string | null;
  workerName: string;
  workerSsn: string;
  workerPhone: string;
  workerAddress: string;
  unitPrice: string;
  days: string[]; // 1..31
  payType: PayType;
  bankName: string;
  bankOwner: string;
  bankAccount: string;
  teamName: string;
};

type AttendanceMapEntry = {
  days: Record<number, number>; // day -> manDay
  unitPrice?: number;
};

type AttendanceMap = Record<string, AttendanceMapEntry>;

type ReportSiteOption = {
  id: string;
  name: string;
  legacyId?: string;
  companyId?: string;
};

type ReportWorkerOption = {
  key: string; // workerId or name fallback
  workerId: string | null;
  name: string;
  siteId: string | null;
  siteName: string | null;
};

// --- Helpers ---
const toYearMonth = (value: string): string => {
  const s = String(value ?? '').trim();
  const m = s.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : '';
};

const getThisYearMonth = (): string => {
  return new Date().toISOString().slice(0, 7);
};

const getMonthLastDay = (month: string): number => {
  const [yearText, monthText] = String(month || '').split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!year || !monthNumber) {
    return 31;
  }
  return new Date(year, monthNumber, 0).getDate();
};

const createEmptyRow = (id: number): RowState => ({
  id,
  workerId: null,
  workerName: '',
  workerSsn: '',
  workerPhone: '',
  workerAddress: '',
  unitPrice: '',
  days: Array.from({ length: 31 }, () => ''),
  payType: 'direct',
  bankName: '',
  bankOwner: '',
  bankAccount: '',
  teamName: ''
});

const monthToPeriod = (month: string): { start: string; end: string } => {
  if (!month) {
    return { start: '', end: '' };
  }
  const [yStr, mStr] = month.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) {
    return { start: '', end: '' };
  }
  const start = `${yStr}-${mStr}-01`;
  const endDay = new Date(y, m, 0).getDate();
  const end = `${yStr}-${mStr}-${String(endDay).padStart(2, '0')}`;
  return { start, end };
};

const sumDaysForMonth = (days: string[], lastDay: number): number => {
  return days.slice(0, Math.max(lastDay, 0)).reduce((acc, raw) => {
    const v = parseFloat(String(raw).trim());
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
};

const extractDayOfMonth = (dateValue: unknown): number | null => {
  if (!dateValue) return null;
  const s = String(dateValue);
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (m) {
    const day = Number(m[2]);
    return Number.isFinite(day) ? day : null;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDate();
};

const formatWorkerNameCell = (row: RowState, includeTeam: boolean): string => {
  const parts = [row.workerName.trim()];
  if (includeTeam && row.teamName.trim()) {
    parts.push(row.teamName.trim());
  }
  return parts.filter(Boolean).join('\n');
};

const formatInlineBankInfo = (row: RowState): string => {
  const bankParts = [row.bankName.trim(), row.bankOwner.trim(), row.bankAccount.trim()].filter(Boolean);
  const payTypeLabel = row.payType === 'delegate' ? '위임' : '직불';
  if (bankParts.length === 0) return payTypeLabel;
  return `${bankParts.join(' / ')} (${payTypeLabel})`;
};

const formatAddressCell = (row: RowState, includeBankUnderAddress: boolean): string => {
  const parts = [row.workerAddress.trim()];
  if (includeBankUnderAddress) {
    const bankLine = formatInlineBankInfo(row);
    if (bankLine) parts.push(bankLine);
  }
  return parts.filter(Boolean).join('\n');
};

const getExcelDataRowHeight = (row: RowState, includeTeamUnderName: boolean, includeBankUnderAddress: boolean): number => {
  const nameLines = formatWorkerNameCell(row, includeTeamUnderName).split('\n').filter(Boolean).length;
  const addressLines = formatAddressCell(row, includeBankUnderAddress).split('\n').filter(Boolean).length;
  const lineCount = Math.max(nameLines, addressLines, 1);
  if (lineCount >= 3) return 48;
  if (lineCount === 2) return 38;
  return 24;
};

// --- UI Constants & Classes ---
const W_INDEX = 'w-[45px]';

const statementCellClass = 'border border-black align-middle text-center tabular-nums';
const statementFixedHeaderClass = `${statementCellClass} bg-[#fffacd] px-2 py-2 text-[11px] font-bold text-black`;
const statementPrimaryDayHeaderClass = `${statementCellClass} bg-[#008080] px-1 py-1.5 text-[10px] font-bold text-white`;
const statementSecondaryDayHeaderClass = `${statementCellClass} bg-[#a52a2a] px-1 py-1.5 text-[10px] font-bold text-white`;
const statementSummaryHeaderClass = `${statementCellClass} bg-[#fffacd] px-2 py-2 text-[11px] font-extrabold text-black`;

const getStatementHeaderCellClass = (
  tone: 'index' | 'name' | 'ssn' | 'address' | 'summary' | 'rate' | 'amount' | 'bank'
): string => {
  switch (tone) {
    case 'summary':
    case 'rate':
    case 'amount':
    case 'bank':
      return statementSummaryHeaderClass;
    case 'index':
    case 'name':
    case 'ssn':
    case 'address':
    default:
      return statementFixedHeaderClass;
  }
};

const getStatementDayHeaderClass = (dayNumber: number): string => (
  dayNumber <= 15 ? statementPrimaryDayHeaderClass : statementSecondaryDayHeaderClass
);

// --- Component ---
const LaborCostStatementGeneratorPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // --- UI Settings ---
  const [showBankColumn, setShowBankColumn] = useState(true);
  const [showDelegationUi, setShowDelegationUi] = useState(true);
  const [isSplitView, setIsSplitView] = useState(true);
  const [showBankUnderAddress, setShowBankUnderAddress] = useState(false);
  const [showTeamUnderName, setShowTeamUnderName] = useState(false);

  // --- Main Configuration ---
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<'ALL' | string>('ALL');

  // --- Statement Details ---
  const [companyName, setCompanyName] = useState('청연');
  const [siteNameInput, setSiteNameInput] = useState('');
  const [statementTitle, setStatementTitle] = useState('노무내역서');
  const [globalRate, setGlobalRate] = useState(150000);

  // --- Master Bank Info ---
  const [masterBank, setMasterBank] = useState('');
  const [masterOwner, setMasterOwner] = useState('');
  const [masterAccount, setMasterAccount] = useState('');

  // --- Data ---
  const [sites, setSites] = useState<Site[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);

  // --- Loading States ---
  const [reportsLoadedKey, setReportsLoadedKey] = useState<string>('');
  const [loadingReports, setLoadingReports] = useState(false);
  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const [attendanceLoadedKey, setAttendanceLoadedKey] = useState<string>('');
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [rows, setRows] = useState<RowState[]>(() => Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));

  // --- Constructor Company Info ---
  const [constructorCompany, setConstructorCompany] = useState<Company | null>(null);

  // --- Helper for row total calculation ---
  const getRowTotalAmount = useCallback((r: RowState, lastDay: number): number => {
    const totalDays = sumDaysForMonth(r.days, lastDay);
    const unit = parseFloat(String(r.unitPrice).replace(/,/g, '').trim());
    const unitPrice = Number.isFinite(unit) ? unit : 0;
    return Math.round(totalDays * unitPrice);
  }, []);

  // --- Queries ---
  useEffect(() => {
    const qMonth = toYearMonth(searchParams.get('month') ?? '');
    if (qMonth) setMonth(qMonth);
    const qSiteId = String(searchParams.get('siteId') ?? '').trim();
    if (qSiteId) setSelectedSiteId(qSiteId === 'ALL' ? 'ALL' : qSiteId);
  }, [searchParams]);

  useEffect(() => {
    const period = monthToPeriod(month);
    setStartDate(period.start);
    setEndDate(period.end);
  }, [month]);

  // --- Initial Load ---
  useEffect(() => {
    siteService.getSites().then(data => setSites(data.map(s => ({ ...s, id: s.id ?? '' }))));
    manpowerService.getWorkers().then(data => setWorkers(data.map(w => ({ ...w, id: w.id ?? '' }))));
  }, []);

  // Fetch Cheongyeon info on mount
  useEffect(() => {
    const loadCompanyInfo = async () => {
      try {
        const company = await companyService.getCompanyByName('청연');
        if (company) {
          if (company.bankName) setMasterBank(company.bankName);
          if (company.accountHolder) setMasterOwner(company.accountHolder);
          if (company.accountNumber) setMasterAccount(company.accountNumber);
        }
      } catch (err) {
        console.error("Failed to load Cheongyeon info:", err);
      }
    };
    loadCompanyInfo();
  }, []);

  // --- Memos & Derived State ---
  const periodKey = useMemo(() => `${startDate}|${endDate}`, [startDate, endDate]);

  useEffect(() => {
    const loadReports = async () => {
      if (!startDate || !endDate) {
        setReports([]);
        setReportsLoadedKey(periodKey);
        return;
      }
      if (reportsLoadedKey === periodKey) return;

      setLoadingReports(true);
      try {
        const res = await dailyReportService.getReportsByRange(startDate, endDate);
        setReports(res);
        setReportsLoadedKey(periodKey);
      } catch (e) {
        console.error(e);
        setReports([]);
        setReportsLoadedKey(periodKey);
      } finally {
        setLoadingReports(false);
      }
    };
    loadReports();
  }, [startDate, endDate, periodKey, reportsLoadedKey]);

  const siteNameById = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((s) => {
      const id = String(s.id ?? '').trim();
      const legacyId = String((s as any)?.legacyId ?? '').trim();
      const name = String(s.name ?? '').trim();
      if (id && name) {
        if (!map.has(id)) map.set(id, name);
        if (legacyId && !map.has(legacyId)) map.set(legacyId, name);
      }
    });
    return map;
  }, [sites]);

  const reportSites = useMemo<ReportSiteOption[]>(() => {
    const map = new Map<string, ReportSiteOption>();
    reports.forEach((r) => {
      const rawId = String((r as any)?.siteId ?? '').trim();
      if (!rawId) return;
      const nameFromMaster = siteNameById.get(rawId) ?? '';
      const nameFromReport = String((r as any)?.siteName ?? '').trim();
      const name = nameFromMaster || nameFromReport || rawId;
      if (!map.has(rawId)) map.set(rawId, { id: rawId, name });
    });

    if (map.size === 0) {
      sites.forEach((s) => {
        const id = String(s.id ?? '').trim();
        const name = String(s.name ?? '').trim();
        const companyId = s.companyId;
        const legacyId = s.legacyId;
        if (id && name) map.set(id, { id, name, companyId, legacyId });
      });
    }

    const result = Array.from(map.values()).map(option => {
      const siteDef = sites.find(s => s.id === option.id || s.legacyId === option.id);
      return {
        ...option,
        companyId: option.companyId ?? siteDef?.companyId,
        legacyId: option.legacyId ?? siteDef?.legacyId
      };
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [reports, siteNameById, sites]);

  const selectedSite = useMemo(() => {
    if (selectedSiteId === 'ALL') return null;
    return reportSites.find(s => s.id === selectedSiteId) ?? null;
  }, [selectedSiteId, reportSites]);

  useEffect(() => {
    if (selectedSiteId === 'ALL') setSiteNameInput('전체 통합');
    else setSiteNameInput(selectedSite?.name ?? '');
  }, [selectedSiteId, selectedSite]);

  useEffect(() => {
    const fetchCompany = async () => {
      if (selectedSite?.companyId) {
        try {
          const comp = await companyService.getCompanyById(selectedSite.companyId);
          setConstructorCompany(comp);
          if (comp) {
            setMasterBank(comp.bankName || '');
            setMasterOwner(comp.accountHolder || '');
            setMasterAccount(comp.accountNumber || '');
          }
        } catch (e) {
          console.error("Failed to fetch constructor company", e);
          setConstructorCompany(null);
        }
      } else {
        setConstructorCompany(null);
      }
    };
    fetchCompany();
  }, [selectedSite]);

  useEffect(() => {
    if (constructorCompany?.name) {
      setCompanyName(constructorCompany.name);
    }
  }, [constructorCompany]);

  const matchesSelectedSiteId = (siteId: string): boolean => {
    if (selectedSiteId === 'ALL') return true;
    const raw = String(siteId ?? '').trim();
    if (!raw) return false;

    const selectedRaw = String(selectedSiteId).trim();
    if (raw === selectedRaw) return true;

    const found = sites.find((s) => {
      const id = String(s.id ?? '').trim();
      const legacyId = String((s as any)?.legacyId ?? '').trim();
      return id === selectedRaw || (legacyId.length > 0 && legacyId === selectedRaw);
    });
    if (!found) return false;

    const foundId = String(found.id ?? '').trim();
    const foundLegacyId = String((found as any)?.legacyId ?? '').trim();
    return raw === foundId || (foundLegacyId.length > 0 && raw === foundLegacyId);
  };

  const reportWorkers = useMemo<ReportWorkerOption[]>(() => {
    const siteFiltered = selectedSiteId === 'ALL'
      ? reports
      : reports.filter((r) => matchesSelectedSiteId(String((r as any)?.siteId ?? '')));

    const map = new Map<string, ReportWorkerOption>();
    siteFiltered.forEach((r) => {
      const siteId = (r as any)?.siteId ? String((r as any).siteId) : null;
      const siteName = (r as any)?.siteName ? String((r as any).siteName) : null;

      (r.workers ?? []).forEach((w: any) => {
        const workerId = w?.workerId ? String(w.workerId) : '';
        const name = w?.name ? String(w.name) : '';
        const manDay = typeof w?.manDay === 'number' ? w.manDay : Number(w?.manDay || 0);

        if (!name) return;
        if (!Number.isFinite(manDay) || manDay <= 0) return;

        const key = (!workerId || workerId === 'unknown') ? name : workerId;
        if (!map.has(key)) {
          map.set(key, {
            key,
            workerId: (!workerId || workerId === 'unknown') ? null : workerId,
            name,
            siteId,
            siteName
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [reports, selectedSiteId, sites]);

  const workerById = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach(w => { if (w.id) map.set(w.id, w); });
    return map;
  }, [workers]);

  const workerByName = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach(w => { if (w.name) map.set(w.name, w); });
    return map;
  }, [workers]);

  const buildAttendanceKey = (): string => `${selectedSiteId}|${startDate}|${endDate}`;

  const loadAttendance = async (): Promise<AttendanceMap> => {
    const key = buildAttendanceKey();
    if (attendanceLoadedKey === key) return attendanceMap;

    setLoadingAttendance(true);
    try {
      const reportsForSite = selectedSiteId === 'ALL'
        ? reports
        : reports.filter((r) => matchesSelectedSiteId(String((r as any)?.siteId ?? '')));

      const map: AttendanceMap = {};
      reportsForSite.forEach((report) => {
        const day = extractDayOfMonth((report as any)?.date);
        if (day == null || day < 1 || day > 31) return;

        report.workers.forEach((w: any) => {
          const workerId = w?.workerId ? String(w.workerId) : '';
          const rawKey = (!workerId || workerId === 'unknown') ? w?.name : workerId;
          if (!rawKey) return;
          const workerKey = String(rawKey);

          if (!map[workerKey]) map[workerKey] = { days: {} };

          const manDay = Number(w?.manDay || 0);
          if (manDay !== 0) {
            map[workerKey].days[day] = (map[workerKey].days[day] ?? 0) + manDay;
          }

          const unitPrice = Number(w?.unitPrice || 0);
          if (!map[workerKey].unitPrice && unitPrice > 0) {
            map[workerKey].unitPrice = unitPrice;
          }
        });
      });
      setAttendanceLoadedKey(key);
      setAttendanceMap(map);
      return map;
    } catch (e) {
      console.error(e);
      return {};
    } finally {
      setLoadingAttendance(false);
    }
  };

  const applyAttendanceToRow = (rowId: number, workerKey: string, map: AttendanceMap) => {
    const entry = map[workerKey];
    if (!entry) return;

    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const days = r.days.slice();
      for (let d = 1; d <= 31; d++) {
        const v = entry.days[d];
        days[d - 1] = v == null || v === 0 ? '' : String(v);
      }
      const unitPrice = r.unitPrice ? r.unitPrice : (entry.unitPrice ? String(entry.unitPrice) : r.unitPrice);
      return { ...r, days, unitPrice };
    }));
  };

  const fillRowWithWorker = (rowId: number, worker: Worker | null, workerKey?: string) => {
    const w = worker ?? null;
    const unitPriceFromWorker = Number(w?.unitPrice || 0);
    const unitPrice = unitPriceFromWorker > 0 ? String(unitPriceFromWorker) : '';

    setRows(prev => prev.map(r => r.id === rowId ? {
      ...r,
      workerId: w?.id ?? (workerKey ? String(workerKey) : null),
      workerName: w?.name ?? (workerKey ? String(workerKey) : ''),
      workerSsn: w?.idNumber ?? '',
      workerPhone: w?.contact ?? '',
      workerAddress: w?.address ?? '',
      unitPrice,
      bankName: w?.bankName ?? '',
      bankOwner: w?.accountHolder ?? '',
      bankAccount: w?.accountNumber ?? '',
      teamName: w?.teamName ?? ''
    } : r));
  };

  const updateRow = (rowId: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const loadWorkerToNextEmptyRow = async () => {
    const selected = reportWorkers.find(w => w.key === selectedWorkerId);
    if (!selected) return;

    let target = rows.find(r => r.workerName.trim().length === 0);
    if (!target) {
      const nextId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
      const newMsg = createEmptyRow(nextId);
      setRows(prev => [...prev, newMsg]);
      target = { ...newMsg };
    }

    const masterWorker = selected.workerId
      ? (workerById.get(selected.workerId) ?? null)
      : (workerByName.get(selected.name) ?? null);

    fillRowWithWorker(target.id, masterWorker, selected.key);

    const map = await loadAttendance();
    if (selected.key && map[selected.key]) {
      applyAttendanceToRow(target.id, selected.key, map);
    }
  };

  const loadAllByFilter = async () => {
    const count = Math.max(reportWorkers.length, 10);
    const map = await loadAttendance();

    const newRows: RowState[] = [];
    for (let i = 0; i < count; i++) {
      const r = createEmptyRow(i + 1);
      const w = reportWorkers[i];

      if (w) {
        const masterWorker = w.workerId ? workerById.get(w.workerId) : workerByName.get(w.name);
        const entry = map[w.key];

        r.workerId = w.workerId ?? null;
        r.workerName = w.name;
        if (masterWorker) {
          r.workerSsn = masterWorker.idNumber ?? '';
          r.workerPhone = masterWorker.contact ?? '';
          r.workerAddress = masterWorker.address ?? '';
          r.bankName = masterWorker.bankName ?? '';
          r.bankOwner = masterWorker.accountHolder ?? '';
          r.bankAccount = masterWorker.accountNumber ?? '';
          if (masterWorker.unitPrice) r.unitPrice = String(masterWorker.unitPrice);
          if (masterWorker.teamName) r.teamName = masterWorker.teamName;
        }

        if (entry) {
          if (entry.unitPrice) r.unitPrice = String(entry.unitPrice);
          for (let d = 1; d <= 31; d++) {
            const v = entry.days[d];
            if (v) r.days[d - 1] = String(v);
          }
        }
      }
      newRows.push(r);
    }
    setRows(newRows);
  };

  const handleApplyGlobalRate = () => {
    setRows(prev => prev.map(r => ({ ...r, unitPrice: String(globalRate) })));
  };

  const handleClearAll = () => {
    if (window.confirm('작성된 모든 내용을 초기화하시겠습니까?')) {
      setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
    }
  };

  const getDayOfWeek = (month: string, day: number): string => {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return '';
  const date = new Date(y, m - 1, day);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
};

const handleExcelDownload = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Codex';
    workbook.lastModifiedBy = 'Codex';
    workbook.created = new Date();
    workbook.modified = new Date();

    const ws = workbook.addWorksheet('노무내역서', {
      views: [{ state: 'frozen', ySplit: 4, xSplit: 5, showGridLines: false }]
    });
    ws.properties.defaultRowHeight = 24;

    const [y, m] = (month || '').split('-');
    const lastDay = getMonthLastDay(month);
    const showBankDetailsColumn = showBankColumn;
    const trailingHeaders = showBankDetailsColumn
      ? ['은행', '예금주', '계좌번호', '지급구분']
      : ['지급구분'];
    const totalColumns = 5 + lastDay + 3 + trailingHeaders.length;
    const afterDays = 5 + lastDay;
    const daySplitPoint = Math.ceil(lastDay / 2);

    ws.pageSetup = {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.2,
        footer: 0.2
      }
    };
    ws.headerFooter.oddHeader = `&C&"Malgun Gothic,Bold"${statementTitle || '노무내역서'}`;
    ws.headerFooter.oddFooter = `&L출력일 ${new Date().toLocaleDateString('ko-KR')}&R&P / &N`;
    (ws.pageSetup as ExcelJS.PageSetup & { printTitlesRow?: string }).printTitlesRow = '$1:$4';

    // --- Title Row ---
    const titleRow = ws.addRow([statementTitle || '노무내역서']);
    ws.mergeCells(titleRow.number, 1, titleRow.number, totalColumns);
    titleRow.getCell(1).font = { bold: true, size: 16 };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    titleRow.height = 30;

    // --- Info Row ---
    const periodStr = y && m ? `${y}-${m}-01 ~ ${y}-${m}-${String(lastDay).padStart(2, '0')}` : '-';
    const optionLabels = [
      showTeamUnderName ? '이름하단팀명' : '',
      showBankUnderAddress ? '주소하단계좌' : '',
      showBankColumn ? '계좌컬럼' : ''
    ].filter(Boolean).join(', ') || '기본';

    ws.mergeCells(2, 1, 2, 4);
    ws.mergeCells(2, 5, 2, 7);
    ws.mergeCells(2, 8, 2, Math.min(12, totalColumns));
    ws.mergeCells(2, Math.min(13, totalColumns), 2, totalColumns);

    ws.getCell(2, 1).value = `기간: ${periodStr}`;
    ws.getCell(2, 5).value = `회사명: ${companyName || '-'}`;
    ws.getCell(2, 8).value = `현장명: ${siteNameInput || '전체 통합'}`;
    ws.getCell(2, Math.min(13, totalColumns)).value = `출력옵션: ${optionLabels}`;

    for (let col = 1; col <= totalColumns; col += 1) {
      const cell = ws.getCell(2, col);
      cell.font = { bold: true, size: 10, color: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
    ws.getRow(2).height = 22;

    ws.addRow([]);

    // --- Header Row ---
    const headerCells: string[] = ['No', '성명', '주민등록번호', '전화번호', '주소'];
    for (let d = 1; d <= lastDay; d++) {
      const dow = getDayOfWeek(month, d);
      headerCells.push(`${String(d).padStart(2, '0')}\n(${dow})`);
    }
    headerCells.push('공수', '단가', '총액', ...trailingHeaders);

    const headerRow = ws.addRow(headerCells);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 36; // 요일 추가로 인한 높이 증가
    ws.views = [{ state: 'frozen', ySplit: headerRow.number, xSplit: 5, showGridLines: false }];

    ws.getColumn(1).width = 5;   // No
    ws.getColumn(2).width = showTeamUnderName ? 14 : 10;  // 성명
    ws.getColumn(3).width = 16;  // 주민등록번호
    ws.getColumn(4).width = 14;  // 전화번호
    ws.getColumn(5).width = showBankUnderAddress ? 48 : 40;  // 주소
    for (let d = 1; d <= lastDay; d++) ws.getColumn(5 + d).width = 5.5; // 요일 표시를 위해 약간 넓힘
    ws.getColumn(afterDays + 1).width = 6;  // 공수
    ws.getColumn(afterDays + 2).width = 8; // 단가
    ws.getColumn(afterDays + 3).width = 10; // 총액
    if (showBankDetailsColumn) {
      ws.getColumn(afterDays + 4).width = 9;  // 은행
      ws.getColumn(afterDays + 5).width = 10; // 예금주
      ws.getColumn(afterDays + 6).width = 18; // 계좌번호
      ws.getColumn(afterDays + 7).width = 8;  // 지급구분
    } else {
      ws.getColumn(afterDays + 4).width = 8;  // 지급구분
    }

    for (let d = 1; d <= lastDay; d += 1) {
      const dayCell = headerRow.getCell(5 + d);
      const dow = getDayOfWeek(month, d);
      let bgColor = d <= daySplitPoint ? 'FF334155' : 'FF475569';
      if (dow === '일') bgColor = 'FFA52A2A'; // 일요일 강조
      if (dow === '토') bgColor = 'FF000080'; // 토요일 강조

      dayCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
      dayCell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
    }
    [1, 2, 3, 4, 5].forEach((col) => {
      headerRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });
    for (let col = afterDays + 1; col <= totalColumns; col += 1) {
      headerRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7DD' } };
    }

    const filledRows = rows.filter(r => r.workerName.trim().length > 0);
    let grandTotalDays = 0;
    let grandTotalAmount = 0;
    const dailyTotals = Array.from({ length: lastDay }, () => 0);

    filledRows.forEach((r, idx) => {
      const totalDaysVal = sumDaysForMonth(r.days, lastDay);
      const unitPriceVal = parseFloat(String(r.unitPrice).replace(/,/g, '').trim());
      const safeUnit = Number.isFinite(unitPriceVal) ? unitPriceVal : 0;
      const totalAmountVal = Math.round(totalDaysVal * safeUnit);
      grandTotalDays += totalDaysVal;
      grandTotalAmount += totalAmountVal;

      const cells: (string | number)[] = [
        idx + 1,
        formatWorkerNameCell(r, showTeamUnderName),
        r.workerSsn,
        r.workerPhone,
        formatAddressCell(r, showBankUnderAddress)
      ];
      for (let d = 0; d < lastDay; d++) {
        const v = parseFloat(r.days[d] || '');
        if (Number.isFinite(v)) {
          dailyTotals[d] += v;
        }
        cells.push(Number.isFinite(v) && v !== 0 ? v : '');
      }
      cells.push(totalDaysVal || '', safeUnit || '', totalAmountVal || '');
      if (showBankDetailsColumn) {
        cells.push(
          r.bankName,
          r.bankOwner,
          r.bankAccount,
          r.payType === 'delegate' ? '위임' : '직불'
        );
      } else {
        cells.push(r.payType === 'delegate' ? '위임' : '직불');
      }

      const dataRow = ws.addRow(cells);
      const rowFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
      dataRow.height = getExcelDataRowHeight(r, showTeamUnderName, showBankUnderAddress);
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { size: 9 };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', wrapText: colNumber === 2 || colNumber === 5 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
        if (colNumber === 1 || (colNumber >= 6 && colNumber <= 5 + lastDay) || colNumber === afterDays + 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        if (colNumber === 2) {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }
        if (colNumber === 5) {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }
        if (colNumber === afterDays + 2 || colNumber === afterDays + 3) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
        }
        if (colNumber >= 6 && colNumber <= 5 + lastDay) {
          cell.numFmt = '#,##0.0';
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
              argb: idx % 2 === 0
                ? (colNumber - 5 <= daySplitPoint ? 'FFF8FBFF' : 'FFF7FAFC')
                : (colNumber - 5 <= daySplitPoint ? 'FFF1F7FE' : 'FFEFF4F8')
            }
          };
        }
        if (colNumber === afterDays + 1) {
          cell.numFmt = '#,##0.0';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7DD' } };
          cell.font = { size: 9, bold: true };
        }
        if (colNumber === afterDays + 2 || colNumber === afterDays + 3) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7DD' } };
          cell.font = { size: 9, bold: colNumber === afterDays + 3 };
        }
        if (showBankDetailsColumn && colNumber >= afterDays + 4) {
          cell.alignment = { horizontal: colNumber === totalColumns ? 'center' : 'center', vertical: 'middle', wrapText: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFF7FDF9' : 'FFEEF8F1' } };
        }
      });
    });

    const footerCells: (string | number)[] = ['날짜별 공수합계', '', '', '', ''];
    for (let d = 0; d < lastDay; d++) {
      footerCells.push(dailyTotals[d] > 0 ? dailyTotals[d] : '');
    }
    footerCells.push(grandTotalDays || '', '', grandTotalAmount || '');
    if (showBankDetailsColumn) {
      footerCells.push('', '', '', '');
    } else {
      footerCells.push('');
    }

    const footerRow = ws.addRow(footerCells);
    ws.mergeCells(footerRow.number, 1, footerRow.number, 5);
    footerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10 };
      cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } };
    });
    footerRow.height = 26;
    const footerAmountCell = footerRow.getCell(afterDays + 3);
    footerAmountCell.numFmt = '#,##0';
    footerAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };
    const footerTotalDaysCell = footerRow.getCell(afterDays + 1);
    footerTotalDaysCell.numFmt = '#,##0.0';
    for (let d = 0; d < lastDay; d += 1) {
      const cell = footerRow.getCell(6 + d);
      cell.numFmt = '#,##0.0';
    }
    ws.getCell(footerRow.number, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    // 자동 필터 삭제 요청 반영: ws.autoFilter 설정 제거

    const printAreaEndColumn = ws.getColumn(totalColumns).letter;
    if (printAreaEndColumn) {
      ws.pageSetup.printArea = `A1:${printAreaEndColumn}${footerRow.number}`;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `노무내역서_${siteNameInput || '전체'}_${month || 'unknown'}.xlsx`;
    saveAs(blob, fileName);
  }, [rows, month, statementTitle, companyName, siteNameInput, showBankColumn, showBankUnderAddress, showTeamUnderName]);

  const statementSummary = useMemo(() => {
    const visibleLastDay = getMonthLastDay(month);
    let totalDays = 0;
    let totalAmount = 0;
    const dailyTotals = Array(visibleLastDay).fill(0);

    rows.forEach(r => {
      const d = sumDaysForMonth(r.days, visibleLastDay);
      const p = parseFloat(String(r.unitPrice).replace(/,/g, ''));
      totalDays += d;

      r.days.forEach((val, idx) => {
        if (idx < visibleLastDay) {
          const num = parseFloat(val);
          if (Number.isFinite(num)) {
            dailyTotals[idx] += num;
          }
        }
      });

      if (Number.isFinite(p)) totalAmount += Math.round(d * p);
    });
    return { totalDays, totalAmount, dailyTotals };
  }, [month, rows]);

  const statementPeriod = useMemo(() => {
    const monthPeriod = monthToPeriod(month);
    return {
      start: startDate || monthPeriod.start,
      end: endDate || monthPeriod.end
    };
  }, [endDate, month, startDate]);

  const statementLastDay = useMemo(() => {
    const endDay = extractDayOfMonth(statementPeriod.end);
    if (endDay && endDay > 0) return endDay;
    return getMonthLastDay(month);
  }, [month, statementPeriod.end]);

  const primaryDayNumbers = useMemo(() => {
    const visibleDayCount = isSplitView ? Math.floor(statementLastDay / 2) : statementLastDay;
    return Array.from({ length: visibleDayCount }, (_, idx) => idx + 1);
  }, [isSplitView, statementLastDay]);

  const secondaryDayNumbers = useMemo(() => {
    if (!isSplitView) return [];
    const secondaryCount = Math.max(statementLastDay - primaryDayNumbers.length, 0);
    return Array.from({ length: secondaryCount }, (_, idx) => primaryDayNumbers.length + idx + 1);
  }, [isSplitView, primaryDayNumbers.length, statementLastDay]);

  const hasSplitSpacerColumn = isSplitView && secondaryDayNumbers.length > primaryDayNumbers.length;

  const splitRowSectionClass = isSplitView ? 'h-[30px] min-h-[30px]' : 'h-[30px] min-h-[30px]';
  const spanningCellHeightClass = isSplitView ? 'min-h-[60px]' : 'min-h-[30px]';
  const namePrimaryCellHeightClass = showTeamUnderName ? splitRowSectionClass : spanningCellHeightClass;
  const addressPrimaryCellHeightClass = showBankUnderAddress ? splitRowSectionClass : spanningCellHeightClass;
  const footerSingleRowHeightClass = 'h-[30px] min-h-[30px]';
  const footerSpanningRowHeightClass = isSplitView ? 'h-[60px] min-h-[60px]' : 'h-[30px] min-h-[30px]';
  const widthClassByColumn = useMemo(() => {
    if (showBankColumn) {
      return {
        name: 'w-[60px]',
        ssn: 'w-[105px]',
        address: 'w-[300px]',
        day: 'w-[25px]',
        total: 'w-[42px]',
        unitPrice: 'w-[80px]',
        amount: 'w-[120px]',
        bank: 'w-[220px]'
      };
    }

    return {
      name: 'w-[85px]',
      ssn: 'w-[120px]',
      address: 'w-[360px]',
      day: 'w-[34px]',
      total: 'w-[60px]',
      unitPrice: 'w-[100px]',
      amount: 'w-[140px]',
      bank: 'w-0'
    };
  }, [showBankColumn]);

  const previewSurfaceMinWidth = useMemo(() => {
    const visibleDayCount = isSplitView ? primaryDayNumbers.length : statementLastDay;
    const fixedWidth = showBankColumn
      ? (45 + 60 + 105 + 300 + 42 + 80 + 120 + 220)
      : (45 + 85 + 120 + 360 + 60 + 100 + 140);
    const dayWidth = showBankColumn ? 25 : 34;
    return fixedWidth + visibleDayCount * dayWidth;
  }, [isSplitView, primaryDayNumbers.length, showBankColumn, statementLastDay]);

  const previewContentHeight = useMemo(() => {
    const pageHeaderHeight = 132;
    const tableHeadHeight = isSplitView ? 56 : 32;
    const rowHeight = isSplitView ? 60 : 30;
    const footerHeight = isSplitView ? 60 : 32;
    const outerGapHeight = 16;
    return pageHeaderHeight + tableHeadHeight + footerHeight + (rows.length * rowHeight) + outerGapHeight;
  }, [isSplitView, rows.length]);

  const printScale = useMemo(() => {
    const safeA4WidthPx = 1094;
    const safeA4HeightPx = 748;
    const widthScale = Math.min(1, safeA4WidthPx / Math.max(previewSurfaceMinWidth, 1));
    const heightScale = Math.min(1, safeA4HeightPx / Math.max(previewContentHeight, 1));
    const fittedWidthScale = Number((widthScale * 0.992).toFixed(3));
    const fittedHeightScale = Number((heightScale * (showBankColumn ? 0.972 : 0.978)).toFixed(3));
    return Math.max(0.4, Math.min(fittedWidthScale, fittedHeightScale));
  }, [previewContentHeight, previewSurfaceMinWidth, showBankColumn]);

  const printRootRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

  const handleCopyToClipboard = useCallback(async () => {
    const targetEl = previewViewportRef.current ?? printRootRef.current;
    if (!targetEl) return;

    const targetRect = targetEl.getBoundingClientRect();
    if (targetRect.width < 1 || targetRect.height < 1) {
      return;
    }

    setCopying(true);
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        window.alert('이 브라우저는 화면 캡처 API(getDisplayMedia)를 지원하지 않습니다.');
        return;
      }

      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const [track] = stream.getVideoTracks();
      if (!track) {
        throw new Error('No video track available');
      }

      video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          video?.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video?.removeEventListener('error', handleError);
        };

        const handleLoadedMetadata = () => {
          cleanup();
          resolve();
        };

        const handleError = () => {
          cleanup();
          reject(new Error('Failed to load captured display stream'));
        };

        video?.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        video?.addEventListener('error', handleError, { once: true });
      });

      await video.play();

      if ('requestVideoFrameCallback' in video) {
        await new Promise<void>((resolve) => {
          (video as HTMLVideoElement & {
            requestVideoFrameCallback?: (callback: () => void) => number;
          }).requestVideoFrameCallback?.(() => resolve());
        });
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      }

      const canvas = document.createElement('canvas');
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      const scaleX = video.videoWidth / viewportWidth;
      const scaleY = video.videoHeight / viewportHeight;

      const cropLeft = Math.max(0, targetRect.left);
      const cropTop = Math.max(0, targetRect.top);
      const cropRight = Math.min(viewportWidth, targetRect.right);
      const cropBottom = Math.min(viewportHeight, targetRect.bottom);

      const cropWidth = Math.max(1, cropRight - cropLeft);
      const cropHeight = Math.max(1, cropBottom - cropTop);

      const sourceX = Math.max(0, Math.round(cropLeft * scaleX));
      const sourceY = Math.max(0, Math.round(cropTop * scaleY));
      const sourceWidth = Math.min(video.videoWidth - sourceX, Math.max(1, Math.round(cropWidth * scaleX)));
      const sourceHeight = Math.min(video.videoHeight - sourceY, Math.max(1, Math.round(cropHeight * scaleY)));

      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas context unavailable');
      }

      context.drawImage(
        video,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/png');
      });

      if (!blob) {
        throw new Error('Failed to create screenshot blob');
      }

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
      } catch {
        saveAs(blob, 'labor-statement.png');
      }
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
        return;
      }
      console.error('Display capture failed', error);
      window.alert('화면 복사에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      stream?.getTracks().forEach((track) => track.stop());
      setCopying(false);
    }
  }, []);

  return (
    <div className="labor-statement-page flex flex-col h-full bg-[#f8fafc] text-slate-800 font-sans">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 4mm;
          }

          html, body, #root {
            width: 100%;
            height: auto;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          .labor-statement-print-root,
          .labor-statement-print-root * {
            visibility: visible !important;
          }

          .labor-statement-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            transform-origin: top left !important;
            zoom: var(--statement-print-scale, 0.7);
          }

          @supports not (zoom: 1) {
            .labor-statement-print-root {
              transform: scale(var(--statement-print-scale, 0.7));
              transform-origin: top left !important;
              width: calc(100% / var(--statement-print-scale, 0.7)) !important;
            }
          }

          .labor-statement-page {
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
          }

          .labor-statement-toolbar {
            display: none !important;
          }

          .labor-statement-shell {
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
          }

          .labor-statement-preview-frame,
          .labor-statement-preview-scroll {
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          .labor-statement-preview-scroll {
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }

          .labor-statement-print-sheet {
            width: 100%;
            max-width: 289mm;
            max-width: calc(297mm - 8mm);
            min-height: 0 !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .labor-statement-print-root table {
            border-color: #000000 !important;
          }

          .labor-statement-preview-surface {
            width: max-content !important;
            min-width: max-content !important;
            margin: 0 auto !important;
            transform: none !important;
          }

          .labor-statement-print-header {
            display: flex !important;
            justify-content: center !important;
            align-items: flex-end !important;
            margin: 0 0 2.5mm !important;
            min-width: 0 !important;
          }

          .labor-statement-print-header > div:first-child {
            display: none !important;
          }

          .labor-statement-print-header > div:last-child {
            display: none !important;
          }

          .labor-statement-print-header > div:nth-child(2) {
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
            font-size: 22px !important;
            line-height: 1.1 !important;
            box-shadow: none !important;
          }

          .labor-statement-print-header table {
            box-shadow: none !important;
          }

          .labor-statement-print-sheet > table {
            margin-top: 0 !important;
          }

          .labor-statement-preview-surface table {
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
          }

          .labor-statement-preview-surface .sticky {
            position: static !important;
          }

          .labor-statement-preview-surface thead,
          .labor-statement-preview-surface tbody,
          .labor-statement-preview-surface tfoot,
          .labor-statement-preview-surface tr {
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
          }

          .labor-statement-preview-surface th,
          .labor-statement-preview-surface td {
            line-height: 1.2 !important;
            padding-top: 1px !important;
            padding-bottom: 1px !important;
          }

          .labor-statement-preview-surface input,
          .labor-statement-preview-surface select {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            background: transparent !important;
            color: #000000 !important;
            -webkit-text-fill-color: #000000 !important;
            appearance: none !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }

          .labor-statement-print-root input[type='radio'] {
            display: none !important;
          }

          .labor-statement-preview-surface tbody td > div {
            min-height: auto !important;
          }

          .labor-statement-preview-surface tbody input {
            height: 7mm !important;
            min-height: 7mm !important;
          }

          .labor-statement-preview-surface tfoot td,
          .labor-statement-preview-surface thead th {
            font-size: 10px !important;
          }
        }
      `}</style>
      <div className="labor-statement-toolbar bg-white border-b border-slate-200 shadow-sm z-20 flex-shrink-0">
        <div className="h-16 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                <FileText className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight whitespace-nowrap">명세서 생성기</h1>
            </div>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors shadow-sm">
                <Calendar className="w-4 h-4 text-slate-500" />
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-800 outline-none w-[130px] cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 min-w-[200px] hover:border-indigo-300 transition-colors shadow-sm">
                <Building2 className="w-4 h-4 text-slate-500" />
                <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-800 outline-none w-full cursor-pointer"
                >
                  <option value="ALL">전체 통합</option>
                  {reportSites.map(s => <option key={s.id} value={s.id}>{s.name} {s.legacyId ? `(${s.legacyId})` : ''}</option>)}
                </select>
              </div>
              <button onClick={loadAllByFilter}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors active:scale-95 whitespace-nowrap"
              >
                <Briefcase className="w-4 h-4" />
                <span>자동채우기</span>
                {loadingAttendance && <span className="w-2 h-2 rounded-full bg-white animate-pulse ml-1"></span>}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-50 rounded-lg p-1.5 border border-slate-200 shadow-inner">
              <input type="text" value={statementTitle} onChange={e => setStatementTitle(e.target.value)}
                className="bg-transparent text-sm font-bold px-2 py-0.5 w-[200px] outline-none placeholder-slate-400 text-right focus:text-indigo-600"
                placeholder="명세서 제목 입력"
              />
            </div>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <button onClick={handleClearAll} title="초기화" className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={handleCopyToClipboard}
              disabled={copying}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition-all shadow-md active:scale-95"
            >
              <Copy className="w-4 h-4" />
              <span>{copying ? '복사 중…' : '화면복사'}</span>
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-bold transition-all shadow-md active:scale-95">
              <Printer className="w-4 h-4" /> <span>인쇄 / PDF</span>
            </button>
            <button onClick={handleExcelDownload} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-all shadow-md shadow-emerald-100 active:scale-95">
              <Download className="w-4 h-4" /> <span>엑셀 저장</span>
            </button>
          </div>
        </div>
        <div className="px-6 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Settings className="w-3.5 h-3.5" /> 보기 설정
            </span>
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
              <label className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity select-none">
                <input type="checkbox" checked={showBankColumn} onChange={(e) => setShowBankColumn(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span className="text-sm font-bold text-slate-700">계좌/지급구분</span>
              </label>
              <div className="w-px h-3 bg-slate-200"></div>
              <label className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity select-none">
                <input type="checkbox" checked={isSplitView} onChange={(e) => setIsSplitView(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span className="text-sm font-bold text-slate-700">2줄 보기 (1~15 / 16~말일)</span>
              </label>
              <div className="w-px h-3 bg-slate-200"></div>
              <label className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity select-none">
                <input type="checkbox" checked={showBankUnderAddress} onChange={(e) => setShowBankUnderAddress(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span className="text-sm font-medium text-slate-600">주소 하단 계좌</span>
              </label>
              <div className="w-px h-3 bg-slate-200"></div>
              <label className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity select-none">
                <input type="checkbox" checked={showTeamUnderName} onChange={(e) => setShowTeamUnderName(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span className="text-sm font-medium text-slate-600">이름 하단 팀명</span>
              </label>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 px-1">단가 일괄</span>
              <input type="number" value={globalRate} onChange={e => setGlobalRate(Number(e.target.value))}
                className="w-24 text-right text-sm font-bold bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
              <button onClick={handleApplyGlobalRate} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-xs font-bold transition-colors">적용</button>
            </div>
            <div className="flex items-center gap-2 bg-yellow-50/80 px-3 py-1.5 rounded-lg border border-yellow-200 shadow-sm">
              <span className="text-[11px] font-bold text-yellow-700 flex items-center gap-1 whitespace-nowrap">
                <Check className="w-3 h-3" /> 위임 계좌
              </span>
              <div className="flex gap-1.5">
                <input type="text" value={masterBank} onChange={e => setMasterBank(e.target.value)} placeholder="은행"
                  className="w-[50px] text-xs font-medium p-1 border border-yellow-200 rounded bg-white outline-none focus:border-yellow-500/50 text-center" />
                <input type="text" value={masterOwner} onChange={e => setMasterOwner(e.target.value)} placeholder="예금주"
                  className="w-[60px] text-xs font-medium p-1 border border-yellow-200 rounded bg-white outline-none focus:border-yellow-500/50 text-center" />
                <input type="text" value={masterAccount} onChange={e => setMasterAccount(e.target.value)} placeholder="계좌번호"
                  className="w-[120px] text-xs font-bold p-1 border border-yellow-200 rounded bg-white outline-none focus:border-yellow-500/50 tracking-tight text-slate-700" />
              </div>
            </div>
          </div>
        </div>
        <div className="h-14 px-6 border-t border-slate-200 flex items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3 w-full">
            <div className="flex items-center gap-2 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Users className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select value={selectedWorkerId} onChange={e => setSelectedWorkerId(e.target.value)}
                  className="pl-10 pr-4 py-2.5 text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all hover:border-blue-300 cursor-pointer"
                >
                  <option value="">작업자를 선택하세요 ({reportWorkers.length}명)</option>
                  {reportWorkers.map(w => <option key={w.key} value={w.key}>{w.name} {w.siteName ? `- ${w.siteName}` : ''}</option>)}
                </select>
              </div>
              <button onClick={loadWorkerToNextEmptyRow} disabled={!selectedWorkerId}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg font-bold shadow-md transition-colors flex items-center gap-2 whitespace-nowrap active:scale-95"
              >
                <PlusCircle className="w-5 h-5" /> <span>추가</span>
              </button>
            </div>
          </div>
          <div className="flex flex-col items-end min-w-[150px]">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">총 인건비 합계</span>
            <span className="text-xl font-black text-slate-800 tabular-nums leading-none mt-0.5">{statementSummary.totalAmount.toLocaleString()}<span className="text-xs font-medium text-slate-400 ml-1">원</span></span>
          </div>
        </div>
      </div>

      <div className="labor-statement-shell flex-1 min-h-0 px-2 pb-2 pt-2 overflow-hidden">
        <div className="labor-statement-preview-frame h-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div ref={previewViewportRef} className="labor-statement-preview-scroll overflow-auto custom-scrollbar flex-1">
            <div className="labor-statement-preview-capture min-h-full min-w-full bg-[#f6f4eb] p-2">
              <div
                className={`labor-statement-preview-surface w-full ${showBankColumn ? 'with-bank' : 'without-bank'}`}
                style={{ ['--statement-print-scale' as string]: String(printScale) }}
              >
                <div ref={printRootRef} className="labor-statement-print-root labor-statement-print-sheet">
            <div className="labor-statement-print-header mb-6 flex flex-col gap-4 lg:grid lg:grid-cols-[350px_1fr_350px] lg:items-end" style={{ width: '100%', minWidth: `${previewSurfaceMinWidth}px` }}>
              <div className="hidden lg:block" />
              <div className="text-center">
                <h1 className="text-3xl font-bold underline decoration-4 underline-offset-8 bg-yellow-50 inline-block px-6 py-2 border border-black shadow-sm">
                  {statementTitle || '노무내역서'}
                </h1>
              </div>
              <div className="lg:justify-self-end">
                <table className="border-collapse border border-black text-xs w-[350px] bg-yellow-50 shadow-sm">
                  <tbody>
                    <tr>
                      <th className="border border-black bg-yellow-100 p-1 w-12" rowSpan={2}>기<br />간</th>
                      <td className="border border-black p-1 text-center w-28">{statementPeriod.start}</td>
                      <th className="border border-black bg-yellow-100 p-1 w-16">회사명</th>
                      <td className="border border-black p-1 text-center">{companyName || '-'}</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 text-center">{statementPeriod.end}</td>
                      <th className="border border-black bg-yellow-100 p-1">현장명</th>
                      <td className="border border-black p-1 text-center">{siteNameInput || '전체 통합'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <table className="border-collapse border border-black bg-white shadow-sm table-fixed w-full" style={{ width: '100%', minWidth: `${previewSurfaceMinWidth}px` }}>
              <thead className="sticky top-0 z-10 text-[11px] font-bold">
                <tr>
                  <th className={`${getStatementHeaderCellClass('index')} ${W_INDEX}`} rowSpan={isSplitView ? 2 : 1}>No</th>
                  <th className={`${getStatementHeaderCellClass('name')} ${widthClassByColumn.name}`} rowSpan={isSplitView ? 2 : 1}>
                    <div className="flex flex-col items-center justify-center p-1">
                      <span>성명</span>
                      {showTeamUnderName && <span className="text-[9px] font-medium text-slate-500 mt-0.5">(소속팀)</span>}
                    </div>
                  </th>
                  <th className={`${getStatementHeaderCellClass('ssn')} ${widthClassByColumn.ssn}`} rowSpan={isSplitView ? 2 : 1}>
                    <div className="flex flex-col items-center justify-center p-1">
                      <span>주민등록번호</span>
                      <span className="text-[9px] font-medium text-slate-500">(연락처)</span>
                    </div>
                  </th>
                  <th className={`${getStatementHeaderCellClass('address')} ${widthClassByColumn.address}`} rowSpan={isSplitView ? 2 : 1}>
                    <div className="flex flex-col items-center justify-center p-1">
                      <span>주소</span>
                      {showBankUnderAddress && <span className="text-[9px] font-medium text-slate-500 mt-0.5">(개인 계좌정보)</span>}
                    </div>
                  </th>
                  {primaryDayNumbers.map((dayNumber) => (
                    <th key={dayNumber} className={`${getStatementDayHeaderClass(dayNumber)} ${widthClassByColumn.day}`}>{String(dayNumber).padStart(2, '0')}</th>
                  ))}
                  {hasSplitSpacerColumn && <th className={`${getStatementDayHeaderClass(primaryDayNumbers.length + 1)} ${widthClassByColumn.day}`}></th>}
                  <th className={`${getStatementHeaderCellClass('summary')} ${widthClassByColumn.total}`} rowSpan={isSplitView ? 2 : 1}>출역합계</th>
                  <th className={`${getStatementHeaderCellClass('rate')} ${widthClassByColumn.unitPrice}`} rowSpan={isSplitView ? 2 : 1}>단가</th>
                  <th className={`${getStatementHeaderCellClass('amount')} ${widthClassByColumn.amount}`} rowSpan={isSplitView ? 2 : 1}>인건비총액</th>
                  {showBankColumn && <th className={`${getStatementHeaderCellClass('bank')} ${widthClassByColumn.bank}`} rowSpan={isSplitView ? 2 : 1}>계좌번호 / 지급구분</th>}
                </tr>
                {isSplitView && (
                  <tr>
                    {secondaryDayNumbers.map((dayNumber) => (
                      <th key={dayNumber} className={`${getStatementDayHeaderClass(dayNumber)} ${widthClassByColumn.day}`}>{String(dayNumber).padStart(2, '0')}</th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <React.Fragment key={row.id}>
                    <tr className="border-b border-black bg-white text-slate-800">
                      <td className="border-r border-black text-center text-xs font-bold text-black bg-[#fffacd]" rowSpan={isSplitView ? 2 : 1}>{idx + 1}</td>
                      <td className="border-r border-black p-0" rowSpan={isSplitView ? 2 : 1}>
                        <div className={`flex flex-col h-full justify-center ${spanningCellHeightClass} ${showTeamUnderName ? 'divide-y divide-black' : ''}`}>
                          <input type="text" value={row.workerName} onChange={e => updateRow(row.id, { workerName: e.target.value })}
                            className={`w-full px-2 text-center text-[10px] font-bold bg-transparent outline-none focus:bg-indigo-50 placeholder-slate-300 leading-tight ${showTeamUnderName ? splitRowSectionClass : namePrimaryCellHeightClass}`} placeholder="이름"
                          />
                          {showTeamUnderName && (
                            <input type="text" value={row.teamName} onChange={e => updateRow(row.id, { teamName: e.target.value })}
                              className={`w-full px-2 text-center text-[10px] text-slate-500 bg-slate-50/50 outline-none focus:bg-indigo-50 placeholder-slate-300 leading-tight ${splitRowSectionClass}`} placeholder="팀명"
                            />
                          )}
                        </div>
                      </td>
                      <td className="border-r border-black p-0" rowSpan={isSplitView ? 2 : 1}>
                        <div className={`flex flex-col h-full justify-center ${spanningCellHeightClass} divide-y divide-black`}>
                          <input type="text" value={row.workerSsn} onChange={e => updateRow(row.id, { workerSsn: e.target.value })}
                            className={`w-full px-2 text-center text-[10px] font-semibold text-slate-700 bg-transparent outline-none focus:bg-indigo-50 tracking-tighter placeholder-slate-300 leading-tight ${splitRowSectionClass}`} placeholder="800101-1..."
                          />
                          <input type="text" value={row.workerPhone} onChange={e => updateRow(row.id, { workerPhone: e.target.value })}
                            className={`w-full px-2 text-center text-[10px] font-semibold text-slate-700 bg-transparent outline-none focus:bg-indigo-50 tracking-tight placeholder-slate-300 leading-tight ${splitRowSectionClass}`} placeholder="010-0000-0000"
                          />
                        </div>
                      </td>
                      <td className={`border-r border-black p-0 ${row.payType === 'delegate' && showBankUnderAddress ? 'bg-yellow-200' : ''}`} rowSpan={isSplitView ? 2 : 1}>
                        <div className={`flex flex-col h-full justify-center ${spanningCellHeightClass} ${showBankUnderAddress ? 'divide-y divide-black' : ''}`}>
                          <input type="text" value={row.workerAddress} onChange={e => updateRow(row.id, { workerAddress: e.target.value })}
                            className={`w-full px-2 text-left text-[10px] font-semibold text-slate-800 bg-transparent outline-none focus:bg-indigo-50 placeholder-slate-300 leading-tight ${showBankUnderAddress ? splitRowSectionClass : addressPrimaryCellHeightClass}`} placeholder="상세주소 입력"
                          />
                          {showBankUnderAddress && (
                            <div data-capture-bank-flat="true" className={`flex items-center divide-x divide-slate-700 bg-slate-50/50 ${splitRowSectionClass}`}>
                              <input type="text" value={row.bankName} onChange={e => updateRow(row.id, { bankName: e.target.value })} className="w-[60px] h-full px-2 text-center text-[10px] leading-tight outline-none placeholder-slate-400 bg-transparent font-bold" placeholder="은행" />
                              <input type="text" value={row.bankOwner} onChange={e => updateRow(row.id, { bankOwner: e.target.value })} className="w-[70px] h-full px-2 text-center text-[10px] leading-tight outline-none placeholder-slate-400 bg-transparent font-bold" placeholder="예금주" />
                              <input type="text" value={row.bankAccount} onChange={e => updateRow(row.id, { bankAccount: e.target.value })} className="flex-1 h-full px-2 text-[10px] leading-tight outline-none placeholder-slate-400 bg-transparent font-bold" placeholder="계좌번호" />
                            </div>
                          )}
                        </div>
                      </td>
                      {primaryDayNumbers.map((dayNumber) => {
                        const dayIndex = dayNumber - 1;
                        const value = row.days[dayIndex] ?? '';
                        return (
                          <td key={dayNumber} className="border-r border-black p-0">
                            <input type="text" value={value}
                              onChange={e => {
                                const newDays = [...row.days];
                                newDays[dayIndex] = e.target.value;
                                updateRow(row.id, { days: newDays });
                              }}
                              className={`w-full h-[30px] px-1 text-center text-[10px] font-bold leading-tight outline-none focus:bg-sky-100 transition-colors ${value ? 'text-slate-800 bg-white' : 'text-slate-300'}`}
                            />
                          </td>
                        );
                      })}
                      {hasSplitSpacerColumn && <td className="border-r border-black bg-slate-50"></td>}
                      <td className="border-r border-black text-center text-xs font-black text-black bg-[#fffacd]" rowSpan={isSplitView ? 2 : 1}>{sumDaysForMonth(row.days, statementLastDay).toFixed(1)}</td>
                      <td className="border-r border-black p-0" rowSpan={isSplitView ? 2 : 1}>
                        <input type="text" value={row.unitPrice} onChange={e => updateRow(row.id, { unitPrice: e.target.value })}
                          className="w-full h-full min-h-[30px] px-2 text-right text-[10px] font-bold text-slate-800 bg-transparent outline-none focus:bg-indigo-50 leading-tight"
                        />
                      </td>
                      <td className="border-r border-black text-right px-2 text-xs font-black text-black bg-[#fffacd]" rowSpan={isSplitView ? 2 : 1}>{getRowTotalAmount(row, statementLastDay).toLocaleString()}</td>
                      {showBankColumn && (
                        <td className={`border-black p-1 border-l ${row.payType === 'delegate' ? 'bg-yellow-200' : ''}`} rowSpan={isSplitView ? 2 : 1}>
                          <div className="flex flex-col gap-1 h-full justify-center">
                            <div className="flex items-center justify-center gap-4 text-[11px] border-b border-black pb-1 mb-1">
                              <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={row.payType === 'direct'} onChange={() => updateRow(row.id, { payType: 'direct' })} className="accent-blue-600" /><span className="font-medium text-slate-700">직불</span></label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={row.payType === 'delegate'} onChange={() => updateRow(row.id, { payType: 'delegate', bankName: masterBank, bankOwner: masterOwner, bankAccount: masterAccount })} className="accent-red-600" /><span className="font-bold text-red-600">위임</span></label>
                            </div>
                            <div data-capture-bank-flat="true" className="flex h-[30px] items-center divide-x divide-black border border-black rounded bg-white/50">
                              <input type="text" value={row.bankName} onChange={e => updateRow(row.id, { bankName: e.target.value })} className="w-[50px] h-full px-2 text-center text-[10px] leading-tight outline-none bg-transparent" placeholder="은행" />
                              <input type="text" value={row.bankOwner} onChange={e => updateRow(row.id, { bankOwner: e.target.value })} className="w-[60px] h-full px-2 text-center text-[10px] leading-tight outline-none bg-transparent" placeholder="예금주" />
                              <input type="text" value={row.bankAccount} onChange={e => updateRow(row.id, { bankAccount: e.target.value })} className="flex-1 h-full px-2 text-[10px] leading-tight outline-none bg-transparent" placeholder="계좌번호" />
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                    {isSplitView && (
                      <tr className="border-b border-black bg-white">
                        {secondaryDayNumbers.map((dayNumber) => {
                          const dayIndex = dayNumber - 1;
                          const value = row.days[dayIndex] ?? '';
                          return (
                            <td key={dayNumber} className="border-r border-black p-0">
                              <input type="text" value={value}
                                onChange={e => {
                                  const newDays = [...row.days];
                                  newDays[dayIndex] = e.target.value;
                                  updateRow(row.id, { days: newDays });
                                }}
                                className={`w-full h-[30px] px-1 text-center text-[10px] font-bold leading-tight outline-none focus:bg-sky-100 transition-colors ${value ? 'text-slate-800 bg-white' : 'text-slate-300'}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-black bg-[#fca5a5] font-bold text-[#7f1d1d]">
                <tr>
                  <td colSpan={4} className="border border-black p-0 text-center text-sm font-black" rowSpan={isSplitView ? 2 : 1}>
                    <div className={`flex items-center justify-center px-2 ${footerSpanningRowHeightClass}`}>날짜별 공수합계</div>
                  </td>
                  {primaryDayNumbers.map((dayNumber) => (
                    <td key={dayNumber} className="border border-black p-0 text-center text-[10px] text-[#7f1d1d] bg-[#fca5a5]">
                      <div className={`flex items-center justify-center px-1 ${footerSingleRowHeightClass}`}>
                        {statementSummary.dailyTotals[dayNumber - 1] > 0 ? statementSummary.dailyTotals[dayNumber - 1].toFixed(1) : ''}
                      </div>
                    </td>
                  ))}
                  {hasSplitSpacerColumn && <td className="border border-black p-0 bg-[#fca5a5]"></td>}
                  <td className="border border-black p-0 text-center text-sm font-black bg-[#fca5a5]" rowSpan={isSplitView ? 2 : 1}>
                    <div className={`flex items-center justify-center px-2 ${footerSpanningRowHeightClass}`}>{statementSummary.totalDays.toFixed(1)}</div>
                  </td>
                  <td className="border border-black p-0 text-center bg-[#fca5a5]" rowSpan={isSplitView ? 2 : 1}>
                    <div className={`${footerSpanningRowHeightClass}`}></div>
                  </td>
                  <td className="border border-black p-0 text-right text-sm font-black bg-[#fca5a5]" rowSpan={isSplitView ? 2 : 1}>
                    <div className={`flex items-center justify-end px-2 ${footerSpanningRowHeightClass}`}>{statementSummary.totalAmount.toLocaleString()}</div>
                  </td>
                  {showBankColumn && (
                    <td className="border border-black p-0" rowSpan={isSplitView ? 2 : 1}>
                      <div className={`${footerSpanningRowHeightClass}`}></div>
                    </td>
                  )}
                </tr>
                {isSplitView && (
                  <tr>
                    {secondaryDayNumbers.map((dayNumber) => (
                      <td key={dayNumber} className="border border-black p-0 text-center text-[10px] text-[#7f1d1d] bg-[#fca5a5]">
                        <div className={`flex items-center justify-center px-1 ${footerSingleRowHeightClass}`}>
                          {statementSummary.dailyTotals[dayNumber - 1] > 0 ? statementSummary.dailyTotals[dayNumber - 1].toFixed(1) : ''}
                        </div>
                      </td>
                    ))}
                  </tr>
                )}
              </tfoot>
            </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaborCostStatementGeneratorPage;
