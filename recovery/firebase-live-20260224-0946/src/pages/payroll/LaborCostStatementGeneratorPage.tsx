import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar, Building2, User, CreditCard, Download,
  RotateCcw, Save, Search, Settings, FileText,
  ChevronLeft, ChevronRight, Calculator, Printer,
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

const getPrevYearMonth = (yearMonth: string): string => {
  const safe = toYearMonth(yearMonth) || getThisYearMonth();
  const [yStr, mStr] = safe.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return getThisYearMonth();
  const d = new Date(y, m - 2, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
};

const getNextYearMonth = (yearMonth: string): string => {
  const safe = toYearMonth(yearMonth) || getThisYearMonth();
  const [yStr, mStr] = safe.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return getThisYearMonth();
  const d = new Date(y, m, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
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
  const end = new Date(y, m, 0).toISOString().slice(0, 10);
  return { start, end };
};

const sumDays = (days: string[]): number => {
  return days.reduce((acc, raw) => {
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

const roundToThousand = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value / 1000) * 1000;
};

// --- Component ---
const LaborCostStatementGeneratorPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // --- UI Settings ---
  const [showBankColumn, setShowBankColumn] = useState(true);
  const [showDelegationUi, setShowDelegationUi] = useState(true);
  const [isSplitView, setIsSplitView] = useState(false);
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
  const [masterBank, setMasterBank] = useState('농협');
  const [masterOwner, setMasterOwner] = useState('(주)건설안전');
  const [masterAccount, setMasterAccount] = useState('302-0000-0000-01');

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

    // Enrich with Company info & LegacyID if not present
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

  // Fetch Constructor Company when Site changes
  useEffect(() => {
    const fetchCompany = async () => {
      if (selectedSite?.companyId) {
        try {
          // companyId on Site refers to the Constructor Company
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



  // Auto-generate Company Name Only (Title is fixed/manual)
  useEffect(() => {
    // Auto-update Company Name from Constructor Company
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
      const siteId = typeof (r as any)?.siteId === 'string' ? String((r as any).siteId) : null;
      const siteName = typeof (r as any)?.siteName === 'string' ? String((r as any).siteName) : null;

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

  // --- Logic : Loader ---
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
    // Reset or extend rows
    const count = Math.max(reportWorkers.length, 10);
    setRows(Array.from({ length: count }, (_, i) => createEmptyRow(i + 1)));

    const map = await loadAttendance();

    // We can't update state in a loop effectively without batched updates or improved logic.
    // Instead, build the new rows array and set it once.
    const newRows: RowState[] = [];

    for (let i = 0; i < count; i++) {
      const r = createEmptyRow(i + 1);
      const w = reportWorkers[i]; // might be undefined if count > reportWorkers.length

      if (w) {
        const masterWorker = w.workerId ? workerById.get(w.workerId) : workerByName.get(w.name);
        const entry = map[w.key];

        // Fill basic info
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

        // Fill attendance
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

  const handleExcelDownload = useCallback(async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('노무내역서');

    const [y, m] = (month || '').split('-');
    const lastDay = y && m ? new Date(Number(y), Number(m), 0).getDate() : 31;

    // --- Title Row ---
    const titleRow = ws.addRow([statementTitle || '노무내역서']);
    ws.mergeCells(titleRow.number, 1, titleRow.number, 6 + lastDay);
    titleRow.getCell(1).font = { bold: true, size: 16 };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    // --- Info Row ---
    const periodStr = y && m ? `${y}-${m}-01 ~ ${y}-${m}-${lastDay}` : '-';
    const infoRow = ws.addRow(['기간', periodStr, '', '회사명', companyName || '-', '현장명', siteNameInput || '전체 통합']);
    infoRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10 };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    ws.addRow([]);

    // --- Header Row ---
    const headerCells: string[] = ['No', '성명', '주민등록번호', '전화번호', '주소'];
    for (let d = 1; d <= lastDay; d++) headerCells.push(String(d));
    headerCells.push('공수', '단가', '총액', '은행', '예금주', '계좌번호', '지급구분');

    const headerRow = ws.addRow(headerCells);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 24;

    // --- Column widths ---
    ws.getColumn(1).width = 5;   // No
    ws.getColumn(2).width = 10;  // 성명
    ws.getColumn(3).width = 16;  // 주민등록번호
    ws.getColumn(4).width = 14;  // 전화번호
    ws.getColumn(5).width = 40;  // 주소
    for (let d = 1; d <= lastDay; d++) ws.getColumn(5 + d).width = 4;
    const afterDays = 5 + lastDay;
    ws.getColumn(afterDays + 1).width = 6;  // 공수
    ws.getColumn(afterDays + 2).width = 8; // 단가
    ws.getColumn(afterDays + 3).width = 10; // 총액
    ws.getColumn(afterDays + 4).width = 7;  // 은행
    ws.getColumn(afterDays + 5).width = 8;  // 예금주
    ws.getColumn(afterDays + 6).width = 16; // 계좌번호
    ws.getColumn(afterDays + 7).width = 7;  // 지급구분

    // --- Data Rows ---
    const filledRows = rows.filter(r => r.workerName.trim().length > 0);
    let grandTotalDays = 0;
    let grandTotalAmount = 0;

    filledRows.forEach((r, idx) => {
      const totalDaysVal = sumDays(r.days);
      const unitPriceVal = parseFloat(String(r.unitPrice).replace(/,/g, '').trim());
      const safeUnit = Number.isFinite(unitPriceVal) ? unitPriceVal : 0;
      const totalAmountVal = Math.round(totalDaysVal * safeUnit);
      grandTotalDays += totalDaysVal;
      grandTotalAmount += totalAmountVal;

      const cells: (string | number)[] = [
        idx + 1,
        r.workerName,
        r.workerSsn,
        r.workerPhone,
        r.workerAddress
      ];
      for (let d = 0; d < lastDay; d++) {
        const v = parseFloat(r.days[d] || '');
        cells.push(Number.isFinite(v) && v !== 0 ? v : '');
      }
      cells.push(
        totalDaysVal || '',
        safeUnit || '',
        totalAmountVal || '',
        r.bankName,
        r.bankOwner,
        r.bankAccount,
        r.payType === 'delegate' ? '위임' : '직불'
      );

      const dataRow = ws.addRow(cells);
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { size: 9 };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle' };
        if (colNumber === 1 || (colNumber >= 6 && colNumber <= 5 + lastDay) || colNumber === afterDays + 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        if (colNumber === afterDays + 2 || colNumber === afterDays + 3) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
        }
      });
    });

    // --- Footer (합계) Row ---
    const footerCells: (string | number)[] = ['', '합 계', '', '', ''];
    for (let d = 0; d < lastDay; d++) footerCells.push('');
    footerCells.push(grandTotalDays || '', '', grandTotalAmount || '', '', '', '', '');

    const footerRow = ws.addRow(footerCells);
    footerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10 };
      cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    const footerAmountCell = footerRow.getCell(afterDays + 3);
    footerAmountCell.numFmt = '#,##0';
    footerAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // --- Generate & Download ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `노무내역서_${siteNameInput || '전체'}_${month || 'unknown'}.xlsx`;
    saveAs(blob, fileName);
  }, [rows, month, statementTitle, companyName, siteNameInput]);

  // --- Render Helpers ---
  const statementSummary = useMemo(() => {
    let totalDays = 0;
    let totalAmount = 0;
    const dailyTotals = Array(31).fill(0);

    rows.forEach(r => {
      const d = sumDays(r.days);
      const p = parseFloat(String(r.unitPrice).replace(/,/g, ''));
      totalDays += d;

      // Calculate daily totals
      r.days.forEach((val, idx) => {
        if (idx < 31) {
          const num = parseFloat(val);
          if (Number.isFinite(num)) {
            dailyTotals[idx] += num;
          }
        }
      });

      if (Number.isFinite(p)) totalAmount += Math.round(d * p);
    });
    return { totalDays, totalAmount, dailyTotals };
  }, [rows]);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] text-slate-800 font-sans">

      {/* 1. Header & Unified Control Panel (Exposed Settings + Larger Text) */}
      <div className="bg-white border-b border-slate-200 shadow-sm z-20 flex-shrink-0">

        {/* Top Row: Title, Filters, Main Actions */}
        <div className="h-16 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                <FileText className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight whitespace-nowrap">명세서 생성기</h1>
            </div>

            <div className="h-6 w-px bg-slate-200 mx-2"></div>

            {/* Filters (Month/Site) */}
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

              {/* Auto-Fill Button (Moved to Header) */}
              <button onClick={loadAllByFilter}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors active:scale-95 whitespace-nowrap"
                title="해당 현장 인원 전체 불러오기"
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
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-bold transition-all shadow-md active:scale-95">
              <Printer className="w-4 h-4" /> <span>인쇄 / PDF</span>
            </button>
            <button onClick={handleExcelDownload} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-all shadow-md shadow-emerald-100 active:scale-95">
              <Download className="w-4 h-4" /> <span>엑셀 저장</span>
            </button>
          </div>
        </div>

        {/* Middle Row: View Options & Rate Settings (Exposed) */}
        <div className="px-6 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">

          {/* View Options Toggles */}
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
                <span className="text-sm font-bold text-slate-700">2줄 보기 (16+15일)</span>
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

          {/* Global Rate & Delegate Info */}
          <div className="flex items-center gap-4">
            {/* Global Rate */}
            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 px-1">단가 일괄</span>
              <input type="number" value={globalRate} onChange={e => setGlobalRate(Number(e.target.value))}
                className="w-24 text-right text-sm font-bold bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
              <button onClick={handleApplyGlobalRate} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-xs font-bold transition-colors">
                적용
              </button>
            </div>

            {/* Delegate Info */}
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

        {/* Bottom Row: Worker Operations */}
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

      {/* 2. Main Table Area */}
      <div className="flex-1 min-h-0 px-6 pb-6 pt-6 overflow-hidden">
        <div className="h-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="overflow-auto custom-scrollbar flex-1 relative p-8">

            {/* Print Header Section */}
            <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                {/* Placeholder for left side if needed */}
              </div>

              <div className="flex-1 min-w-[300px] text-center">
                <h1 className="text-3xl font-extrabold text-slate-800 underline decoration-double decoration-slate-400 underline-offset-8 whitespace-nowrap">
                  {statementTitle || '노무내역서'}
                </h1>
              </div>

              <div className="flex-1 min-w-[300px] flex justify-end">
                <table className="text-[11px] border-collapse bg-white border border-black shadow-sm">
                  <tbody>
                    <tr>
                      <th className="border border-black bg-amber-100/50 px-3 py-1.5 font-bold text-slate-700 w-[60px] text-center">기간</th>
                      <td className="border border-black px-3 py-1.5 font-bold text-slate-800 bg-white min-w-[160px] text-center" colSpan={3}>
                        {(() => {
                          if (!month) return '-';
                          const [y, m] = month.split('-');
                          const lastDay = new Date(Number(y), Number(m), 0).getDate();
                          return `${y}-${m}-01 ~ ${y}-${m}-${lastDay}`;
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-black bg-amber-100/50 px-3 py-1.5 font-bold text-slate-700 w-[60px] text-center">회사명</th>
                      <td className="border border-black px-3 py-1.5 font-bold text-slate-800 bg-white min-w-[100px] text-center">
                        {companyName || '-'}
                      </td>
                      <th className="border border-black bg-amber-100/50 px-3 py-1.5 font-bold text-slate-700 w-[60px] text-center">현장명</th>
                      <td className="border border-black px-3 py-1.5 font-bold text-slate-800 bg-white min-w-[100px] text-center">
                        {siteNameInput || '전체 통합'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <table className="w-full border-collapse min-w-[1200px] border border-black">
              <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm text-[11px] font-bold text-slate-500">
                <tr>
                  <th className="border border-black p-2 w-[40px] text-center" rowSpan={isSplitView ? 2 : 1}>No</th>
                  <th className="border border-black p-2 w-[95px] text-center text-indigo-600 font-bold bg-slate-50 border-r-2 border-r-slate-300" rowSpan={isSplitView ? 2 : 1}>
                    <div>성명</div>
                    {showTeamUnderName && <div className="text-[10px] font-normal text-slate-400 mt-1">소속팀</div>}
                  </th>
                  <th className="border border-black p-2 w-[100px] text-center" rowSpan={isSplitView ? 2 : 1}>
                    <div>주민등록번호</div>
                    <div className="text-[10px] font-normal text-slate-400">전화번호</div>
                  </th>
                  <th className="border border-black p-2 w-[300px] text-center text-indigo-600" rowSpan={isSplitView ? 2 : 1}>
                    <div>주소</div>
                    {showBankUnderAddress && <div className="text-[10px] font-normal text-slate-400 mt-1">계좌정보</div>}
                  </th>

                  {/* Days 1-16 or 1-31 */}
                  {Array.from({ length: isSplitView ? 16 : 31 }).map((_, i) => (
                    <th key={i} className="border border-black p-1 w-[30px] text-center bg-slate-50 text-[10px] text-slate-400">
                      {i + 1}
                    </th>
                  ))}

                  <th className="border border-black p-2 w-[50px] text-center bg-orange-50 text-slate-700" rowSpan={isSplitView ? 2 : 1}>공수</th>
                  <th className="border border-black p-2 w-[90px] text-center bg-slate-50 text-slate-600" rowSpan={isSplitView ? 2 : 1}>단가</th>
                  <th className="border border-black p-2 w-[105px] text-center bg-emerald-50 text-emerald-800" rowSpan={isSplitView ? 2 : 1}>총액</th>

                  {showBankColumn && (
                    <th className="border border-black p-2 w-[260px] text-center" rowSpan={isSplitView ? 2 : 1}>
                      계좌정보 / 지급구분
                      <div className="text-[9px] font-normal text-slate-400 mt-1">(직불·위임 선택)</div>
                    </th>
                  )}
                </tr>
                {isSplitView && (
                  <tr>
                    {/* Days 17-31 */}
                    {Array.from({ length: 15 }).map((_, i) => (
                      <th key={i + 16} className="border border-black p-1 w-[30px] text-center bg-slate-50 text-[10px] text-slate-400">
                        {i + 17}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-indigo-50/20 group transition-colors border-b border-black font-semibold text-slate-800">
                      <td className="border-r border-black text-center text-xs font-bold text-slate-400 bg-slate-50/50" rowSpan={isSplitView ? 2 : 1}>{idx + 1}</td>
                      <td className="border-r border-black p-0" rowSpan={isSplitView ? 2 : 1}>
                        <div className="flex flex-col h-full justify-center">
                          <input type="text" value={row.workerName} onChange={e => updateRow(row.id, { workerName: e.target.value })}
                            className="w-full h-8 min-h-[32px] px-2 text-center text-xs font-bold bg-transparent outline-none focus:bg-indigo-50 placeholder-slate-300 border-b border-transparent" placeholder="이름"
                          />
                          {showTeamUnderName && (
                            <input type="text" value={row.teamName} onChange={e => updateRow(row.id, { teamName: e.target.value })}
                              className="w-full h-6 min-h-[24px] px-2 text-center text-[10px] text-slate-500 bg-slate-50/50 outline-none focus:bg-indigo-50 placeholder-slate-300 border-t border-slate-100" placeholder="팀명"
                            />
                          )}
                        </div>
                      </td>
                      <td className="border-r border-black p-0" rowSpan={isSplitView ? 2 : 1}>
                        <div className="flex flex-col h-full justify-center">
                          <input type="text" value={row.workerSsn} onChange={e => updateRow(row.id, { workerSsn: e.target.value })}
                            className="w-full h-8 px-2 text-center text-xs font-semibold text-slate-700 bg-transparent outline-none focus:bg-indigo-50 tracking-tighter placeholder-slate-300 border-b border-slate-100" placeholder="800101-1..."
                          />
                          <input type="text" value={row.workerPhone} onChange={e => updateRow(row.id, { workerPhone: e.target.value })}
                            className="w-full h-8 px-2 text-center text-[10px] font-semibold text-slate-700 bg-transparent outline-none focus:bg-indigo-50 tracking-tight placeholder-slate-300" placeholder="010-0000-0000"
                          />
                        </div>
                      </td>
                      <td className={`border-r border-black p-0 ${row.payType === 'delegate' && showBankUnderAddress ? 'bg-yellow-200' : ''}`} rowSpan={isSplitView ? 2 : 1}>
                        <div className="flex flex-col h-full justify-center">
                          <input type="text" value={row.workerAddress} onChange={e => updateRow(row.id, { workerAddress: e.target.value })}
                            className="w-full h-8 min-h-[32px] px-2 text-left text-[11px] font-semibold text-slate-800 bg-transparent outline-none focus:bg-indigo-50 placeholder-slate-300 border-b border-transparent" placeholder="상세주소 입력"
                          />
                          {showBankUnderAddress && (
                            <div className="flex h-7 items-center divide-x divide-slate-300/50 border-t border-slate-200 bg-slate-50/50">
                              <input type="text" value={row.bankName} onChange={e => updateRow(row.id, { bankName: e.target.value })}
                                className={`w-[50px] h-full text-center text-[10px] outline-none focus:bg-indigo-50 placeholder-slate-400 bg-transparent border-none ${row.payType === 'delegate' ? 'font-bold text-orange-800' : ''}`}
                                placeholder="은행"
                              />
                              <input type="text" value={row.bankOwner} onChange={e => updateRow(row.id, { bankOwner: e.target.value })}
                                className={`w-[60px] h-full text-center text-[10px] outline-none focus:bg-indigo-50 placeholder-slate-400 bg-transparent border-none ${row.payType === 'delegate' ? 'font-bold text-orange-800' : ''}`}
                                placeholder="예금주"
                              />
                              <input type="text" value={row.bankAccount} onChange={e => updateRow(row.id, { bankAccount: e.target.value })}
                                className={`flex-1 h-full px-2 text-[10px] outline-none focus:bg-indigo-50 placeholder-slate-400 bg-transparent text-slate-700 font-medium border-none ${row.payType === 'delegate' ? 'font-bold text-orange-800' : ''}`}
                                placeholder="계좌번호"
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Days 1-16 or 1-31 */}
                      {row.days.slice(0, isSplitView ? 16 : 31).map((val, dIdx) => (
                        <td key={dIdx} className="border-r border-black p-0">
                          <input type="text" value={val}
                            onChange={e => {
                              const newDays = [...row.days];
                              newDays[dIdx] = e.target.value;
                              updateRow(row.id, { days: newDays });
                            }}
                            className={`w-full h-9 text-center text-xs font-bold outline-none focus:bg-indigo-100 transition-colors ${val ? 'text-indigo-600 bg-indigo-50/30' : 'text-slate-300'}`}
                          />
                        </td>
                      ))}

                      <td className="border-r border-black text-center text-xs font-black text-slate-700 bg-orange-50/30" rowSpan={isSplitView ? 2 : 1}>
                        {sumDays(row.days).toFixed(1)}
                      </td>
                      <td className="border-r border-black p-0" rowSpan={isSplitView ? 2 : 1}>
                        <input type="text" value={row.unitPrice} onChange={e => updateRow(row.id, { unitPrice: e.target.value })}
                          className="w-full h-full min-h-[36px] px-2 text-right text-xs font-bold text-slate-800 bg-transparent outline-none focus:bg-indigo-50"
                        />
                      </td>
                      <td className="border-r border-black text-right px-2 text-xs font-bold text-slate-800 bg-emerald-50/30" rowSpan={isSplitView ? 2 : 1}>
                        {getRowTotalAmount(row).toLocaleString()}
                      </td>

                      {showBankColumn && (
                        <td className={`border-black p-1 border-l ${row.payType === 'delegate' ? 'bg-yellow-200' : ''}`} rowSpan={isSplitView ? 2 : 1}>
                          <div className="flex flex-col gap-1 h-full justify-center">
                            {/* Pay Type */}
                            <div className="flex items-center justify-center gap-4 text-[11px] border-b border-slate-200/50 pb-1 mb-1">
                              <label className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                                <input
                                  type="radio"
                                  name={`payType-${row.id}`}
                                  checked={row.payType === 'direct'}
                                  onChange={() => updateRow(row.id, { payType: 'direct' })}
                                  className="accent-blue-600"
                                />
                                <span className="font-medium text-slate-700">직불</span>
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                                <input
                                  type="radio"
                                  name={`payType-${row.id}`}
                                  checked={row.payType === 'delegate'}
                                  onChange={() => {
                                    const updates: Partial<RowState> = { payType: 'delegate' };
                                    if (masterBank && masterAccount) {
                                      updates.bankName = masterBank;
                                      updates.bankOwner = masterOwner;
                                      updates.bankAccount = masterAccount;
                                    }
                                    updateRow(row.id, updates);
                                  }}
                                  className="accent-red-600"
                                />
                                <span className="font-bold text-red-600">위임</span>
                              </label>
                            </div>
                            {/* Bank Inputs */}
                            <div className="flex h-7 items-center divide-x divide-slate-300/50 border border-slate-300/30 rounded bg-white/50">
                              <input type="text" value={row.bankName} onChange={e => updateRow(row.id, { bankName: e.target.value })}
                                className={`w-[50px] h-full text-center text-[10px] outline-none focus:bg-indigo-50 placeholder-slate-400 bg-transparent ${row.payType === 'delegate' ? 'font-bold text-orange-800' : ''}`}
                                placeholder="은행"
                              />
                              <input type="text" value={row.bankOwner} onChange={e => updateRow(row.id, { bankOwner: e.target.value })}
                                className={`w-[60px] h-full text-center text-[10px] outline-none focus:bg-indigo-50 placeholder-slate-400 bg-transparent ${row.payType === 'delegate' ? 'font-bold text-orange-800' : ''}`}
                                placeholder="예금주"
                              />
                              <input type="text" value={row.bankAccount} onChange={e => updateRow(row.id, { bankAccount: e.target.value })}
                                className={`flex-1 h-full px-2 text-[10px] outline-none focus:bg-indigo-50 placeholder-slate-400 bg-transparent text-slate-700 font-medium ${row.payType === 'delegate' ? 'font-bold text-orange-800' : ''}`}
                                placeholder="계좌번호"
                              />
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                    {isSplitView && (
                      <tr className="hover:bg-indigo-50/20 group transition-colors border-b border-black">
                        {/* Days 17-31 */}
                        {row.days.slice(16, 31).map((val, dIdx) => (
                          <td key={dIdx + 16} className="border-r border-black p-0">
                            <input type="text" value={val}
                              onChange={e => {
                                const newDays = [...row.days];
                                newDays[dIdx + 16] = e.target.value;
                                updateRow(row.id, { days: newDays });
                              }}
                              className={`w-full h-9 text-center text-xs font-bold outline-none focus:bg-indigo-100 transition-colors ${val ? 'text-indigo-600 bg-indigo-50/30' : 'text-slate-300'}`}
                            />
                          </td>
                        ))}
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-slate-800 border-t-2 border-black">
                <tr>
                  <td colSpan={4} className="border border-black p-2 text-center text-sm" rowSpan={isSplitView ? 2 : 1}>합 계</td>

                  {/* Footer Days 1-16 or 1-31 */}
                  {statementSummary.dailyTotals.slice(0, isSplitView ? 16 : 31).map((val, idx) => (
                    <td key={idx} className="border border-black p-1 text-center text-[10px] text-slate-600 bg-slate-50">
                      {val > 0 ? val.toFixed(1) : ''}
                    </td>
                  ))}

                  <td className="border border-black p-2 text-center text-sm bg-orange-100" rowSpan={isSplitView ? 2 : 1}>{statementSummary.totalDays.toFixed(1)}</td>
                  <td className="border border-black p-2 text-center" rowSpan={isSplitView ? 2 : 1}></td>
                  <td className="border border-black p-2 text-right text-sm bg-emerald-100" rowSpan={isSplitView ? 2 : 1}>{statementSummary.totalAmount.toLocaleString()}</td>
                  {showBankColumn && <td className="border border-black p-2" rowSpan={isSplitView ? 2 : 1}></td>}
                </tr>
                {isSplitView && (
                  <tr>
                    {/* Footer Days 17-31 */}
                    {statementSummary.dailyTotals.slice(16, 31).map((val, idx) => (
                      <td key={idx + 16} className="border border-black p-1 text-center text-[10px] text-slate-600 bg-slate-50">
                        {val > 0 ? val.toFixed(1) : ''}
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
  );
};

// Helper for total amount calculation in render
const getRowTotalAmount = (r: RowState): number => {
  const totalDays = sumDays(r.days);
  const unit = parseFloat(String(r.unitPrice).replace(/,/g, '').trim());
  const unitPrice = Number.isFinite(unit) ? unit : 0;
  return Math.round(totalDays * unitPrice);
};

export default LaborCostStatementGeneratorPage;
