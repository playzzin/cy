import React, { useEffect, useMemo, useState } from 'react';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';

type PayType = 'direct' | 'delegate';

type RowState = {
  id: number;
  workerId: string | null;
  workerName: string;
  workerSsn: string;
  workerPhone: string;
  workerAddress: string;
  unitPrice: string;
  days: string[]; // 1..30
  payType: PayType;
  bankName: string;
  bankOwner: string;
  bankAccount: string;
};

type AttendanceMapEntry = {
  days: Record<number, number>; // day -> manDay
  unitPrice?: number;
};

type AttendanceMap = Record<string, AttendanceMapEntry>;

type ReportSiteOption = {
  id: string;
  name: string;
};

type ReportWorkerOption = {
  key: string; // workerId or name fallback
  workerId: string | null;
  name: string;
  siteId: string | null;
  siteName: string | null;
};

const createEmptyRow = (id: number): RowState => ({
  id,
  workerId: null,
  workerName: '',
  workerSsn: '',
  workerPhone: '',
  workerAddress: '',
  unitPrice: '',
  days: Array.from({ length: 30 }, () => ''),
  payType: 'direct',
  bankName: '',
  bankOwner: '',
  bankAccount: ''
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
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

const maskSsnForLabel = (value: string): string => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const base = s.length >= 8 ? s.slice(0, 8) : s;
  return `${base}***`;
};

const sumDays = (days: string[]): number => {
  return days.reduce((acc, raw) => {
    const v = parseFloat(String(raw).trim());
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
};

const formatDaysTotal = (total: number): string => {
  if (!Number.isFinite(total)) return '0';
  return total % 1 === 0 ? String(total) : total.toFixed(1);
};

const roundToThousand = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value / 1000) * 1000;
};

const extractDayOfMonth = (dateValue: unknown): number | null => {
  if (!dateValue) return null;
  const s = String(dateValue);
  // Prefer string parsing to avoid timezone shifts (YYYY-MM-DD)
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (m) {
    const day = Number(m[2]);
    return Number.isFinite(day) ? day : null;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDate();
};

const LaborCostStatementGeneratorPage: React.FC = () => {
  const [showBankColumn, setShowBankColumn] = useState(true);
  const [showDelegationUi, setShowDelegationUi] = useState(true);

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [globalRate, setGlobalRate] = useState(150000);

  const [masterBank, setMasterBank] = useState('농협');
  const [masterOwner, setMasterOwner] = useState('(주)건설안전');
  const [masterAccount, setMasterAccount] = useState('302-0000-0000-01');

  const [companyName, setCompanyName] = useState('');
  const [siteNameInput, setSiteNameInput] = useState('');

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [reportsLoadedKey, setReportsLoadedKey] = useState<string>('');
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<'ALL' | string>('ALL');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

  const [rows, setRows] = useState<RowState[]>(() => Array.from({ length: 10 }, (_, i) => createEmptyRow(i + 1)));

  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const [attendanceLoadedKey, setAttendanceLoadedKey] = useState<string>('');
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    const period = monthToPeriod(month);
    setStartDate(period.start);
    setEndDate(period.end);
  }, [month]);

  useEffect(() => {
    const load = async () => {
      try {
        const workerList = await manpowerService.getWorkers();
        setWorkers(workerList.map((w) => ({ ...w, id: w.id ?? '' })));
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, []);

  const periodKey = useMemo(() => {
    return `${startDate}|${endDate}`;
  }, [startDate, endDate]);

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

  const reportSites = useMemo<ReportSiteOption[]>(() => {
    const map = new Map<string, string>();
    reports.forEach((r) => {
      const id = typeof r.siteId === 'string' ? r.siteId.trim() : '';
      if (!id) return;
      const name = typeof r.siteName === 'string' && r.siteName.trim().length > 0 ? r.siteName.trim() : id;
      if (!map.has(id)) map.set(id, name);
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  useEffect(() => {
    if (selectedSiteId === 'ALL') return;
    const exists = reportSites.some((s) => s.id === selectedSiteId);
    if (!exists) {
      setSelectedSiteId(reportSites[0]?.id ?? 'ALL');
    }
  }, [reportSites, selectedSiteId]);

  const selectedSite = useMemo<ReportSiteOption | null>(() => {
    if (selectedSiteId === 'ALL') return null;
    return reportSites.find((s) => s.id === selectedSiteId) ?? null;
  }, [reportSites, selectedSiteId]);

  useEffect(() => {
    if (selectedSiteId === 'ALL') {
      setSiteNameInput('전체 통합');
      return;
    }
    const name = selectedSite?.name ?? '';
    setSiteNameInput(name);
  }, [selectedSiteId, selectedSite]);

  const reportWorkers = useMemo<ReportWorkerOption[]>(() => {
    const siteFiltered = selectedSiteId === 'ALL'
      ? reports
      : reports.filter((r) => String(r.siteId ?? '').trim() === selectedSiteId);

    const map = new Map<string, ReportWorkerOption>();
    siteFiltered.forEach((r) => {
      const siteId = typeof r.siteId === 'string' ? r.siteId : null;
      const siteName = typeof r.siteName === 'string' ? r.siteName : null;

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
  }, [reports, selectedSiteId]);

  const workerById = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach((w) => {
      if (typeof w.id === 'string' && w.id.trim().length > 0) {
        map.set(w.id, w);
      }
    });
    return map;
  }, [workers]);

  const workerByName = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach((w) => {
      const name = typeof w.name === 'string' ? w.name.trim() : '';
      if (!name) return;
      if (!map.has(name)) map.set(name, w);
    });
    return map;
  }, [workers]);

  useEffect(() => {
    if (reportWorkers.length === 0) {
      if (selectedWorkerId) setSelectedWorkerId('');
      return;
    }

    const existsInList = reportWorkers.some((w) => w.key === selectedWorkerId);
    if (!selectedWorkerId || !existsInList) {
      setSelectedWorkerId(reportWorkers[0].key ?? '');
    }
  }, [reportWorkers, selectedWorkerId]);

  useEffect(() => {
    const rate = roundToThousand(globalRate);
    setRows((prev) =>
      prev.map((r) => {
        if (String(r.unitPrice ?? '').trim().length > 0) return r;
        return { ...r, unitPrice: String(rate) };
      })
    );
  }, [globalRate]);

  const containerClass = useMemo(() => {
    const cls: string[] = ['labor-statement-generator'];
    if (!showBankColumn) cls.push('hide-bank-col');
    if (showDelegationUi) cls.push('show-delegation');
    return cls.join(' ');
  }, [showBankColumn, showDelegationUi]);

  const dayColWidthExpr = useMemo(() => {
    const fixedPx = showBankColumn ? 750 : 530;
    return `calc((100% - ${fixedPx}px) / 15)`;
  }, [showBankColumn]);

  const clearAllRows = () => {
    setRows(Array.from({ length: 10 }, (_, i) => createEmptyRow(i + 1)));
  };

  const applyRateToAll = () => {
    const rate = roundToThousand(globalRate);
    setRows((prev) => prev.map((r) => ({ ...r, unitPrice: String(rate) })));
  };

  const updateRow = (rowId: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const updateRowDay = (rowId: number, dayIndex: number, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const days = r.days.slice();
        days[dayIndex] = value;
        return { ...r, days };
      })
    );
  };

  const setRowPayType = (rowId: number, payType: PayType) => {
    updateRow(rowId, { payType });
  };

  const getRowTotalDays = (r: RowState): number => sumDays(r.days);

  const getRowUnitPrice = (r: RowState): number => {
    const v = parseFloat(String(r.unitPrice).replace(/,/g, '').trim());
    return Number.isFinite(v) ? v : 0;
  };

  const getRowTotalAmount = (r: RowState): number => {
    const totalDays = getRowTotalDays(r);
    const unitPrice = getRowUnitPrice(r);
    return Math.round(totalDays * unitPrice);
  };

  const buildAttendanceKey = (): string => {
    const sitePart = selectedSiteId === 'ALL' ? 'ALL' : selectedSiteId;
    return `${sitePart}|${startDate}|${endDate}`;
  };

  const loadAttendance = async (): Promise<AttendanceMap> => {
    const key = buildAttendanceKey();
    if (attendanceLoadedKey === key) {
      return attendanceMap;
    }

    // Ensure reports exist for the selected period
    let sourceReports = reports;
    if (reportsLoadedKey !== periodKey && startDate && endDate) {
      try {
        sourceReports = await dailyReportService.getReportsByRange(startDate, endDate);
        setReports(sourceReports);
        setReportsLoadedKey(periodKey);
      } catch {
        sourceReports = [];
      }
    }

    if (!startDate || !endDate) {
      setAttendanceLoadedKey(key);
      setAttendanceMap({});
      return {};
    }

    setLoadingAttendance(true);
    try {
      const reportsForSite = selectedSiteId === 'ALL'
        ? sourceReports
        : sourceReports.filter((r) => String((r as any)?.siteId ?? '').trim() === selectedSiteId);

      const map: AttendanceMap = {};
      reportsForSite.forEach((report) => {
        const dayRaw = extractDayOfMonth((report as any)?.date);
        if (dayRaw == null) return;
        const day = dayRaw;
        if (!Number.isFinite(day) || day < 1 || day > 30) return;

        report.workers.forEach((w: any) => {
          const workerId = w?.workerId ? String(w.workerId) : '';
          const rawKey = (!workerId || workerId === 'unknown') ? w?.name : workerId;
          if (!rawKey) return;
          const workerKey = String(rawKey);

          if (!map[workerKey]) map[workerKey] = { days: {} };

          const manDay = typeof w?.manDay === 'number' ? w.manDay : Number(w?.manDay || 0);
          if (Number.isFinite(manDay) && manDay !== 0) {
            map[workerKey].days[day] = (map[workerKey].days[day] ?? 0) + manDay;
          }

          const unitPrice = typeof w?.unitPrice === 'number' ? w.unitPrice : Number(w?.unitPrice || 0);
          if (!map[workerKey].unitPrice && Number.isFinite(unitPrice) && unitPrice > 0) {
            map[workerKey].unitPrice = unitPrice;
          }
        });
      });

      setAttendanceLoadedKey(key);
      setAttendanceMap(map);
      return map;
    } catch (e) {
      console.error(e);
      setAttendanceLoadedKey(key);
      setAttendanceMap({});
      return {};
    } finally {
      setLoadingAttendance(false);
    }
  };

  const fillRowWithWorker = (rowId: number, worker: Worker | null, workerKey?: string) => {
    const w = worker ?? null;

    const unitPriceFromWorker = typeof w?.unitPrice === 'number' ? w.unitPrice : Number((w as any)?.unitPrice || 0);
    const unitPrice = unitPriceFromWorker > 0 ? String(unitPriceFromWorker) : '';

    updateRow(rowId, {
      workerId: w?.id ?? (workerKey ? String(workerKey) : null),
      workerName: w?.name ?? (workerKey ? String(workerKey) : ''),
      workerSsn: w?.idNumber ?? '',
      workerPhone: w?.contact ?? '',
      workerAddress: w?.address ?? '',
      unitPrice,
      bankName: w?.bankName ?? '',
      bankOwner: w?.accountHolder ?? '',
      bankAccount: w?.accountNumber ?? ''
    });
  };

  const applyAttendanceToRow = (rowId: number, workerKey: string, map: AttendanceMap) => {
    const entry = map[workerKey];
    if (!entry) return;

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;

        const days = r.days.slice();
        for (let d = 1; d <= 30; d++) {
          const v = entry.days[d];
          days[d - 1] = v == null || v === 0 ? '' : String(v);
        }

        const unitPrice = String(r.unitPrice ?? '').trim().length > 0
          ? r.unitPrice
          : (entry.unitPrice && entry.unitPrice > 0 ? String(entry.unitPrice) : r.unitPrice);

        return { ...r, days, unitPrice };
      })
    );
  };

  const loadWorkerToNextEmptyRow = async () => {
    const selected = reportWorkers.find((w) => w.key === selectedWorkerId) ?? null;
    if (!selected) return;

    const target = rows.find((r) => r.workerName.trim().length === 0);
    if (!target) return;

    const masterWorker = selected.workerId
      ? (workerById.get(selected.workerId) ?? null)
      : (workerByName.get(selected.name) ?? null);

    fillRowWithWorker(target.id, masterWorker, selected.key);
    updateRow(target.id, {
      workerName: selected.name
    });

    const key = buildAttendanceKey();
    const cacheReady = attendanceLoadedKey === key;
    const map = cacheReady ? attendanceMap : await loadAttendance();
    const workerKey = selected.key;
    if (workerKey && map[workerKey]) {
      applyAttendanceToRow(target.id, workerKey, map);
    }
  };

  const loadAllByFilter = async () => {
    clearAllRows();

    const map = await loadAttendance();
    const candidates = reportWorkers.slice(0, 10);

    candidates.forEach((w, idx) => {
      const rowId = idx + 1;
      const masterWorker = w.workerId
        ? (workerById.get(w.workerId) ?? null)
        : (workerByName.get(w.name) ?? null);

      fillRowWithWorker(rowId, masterWorker, w.key);
      updateRow(rowId, {
        workerName: w.name
      });

      if (w.key && map[w.key]) {
        applyAttendanceToRow(rowId, w.key, map);
      }
    });
  };

  return (
    <div className={containerClass}>
      <style>{`
        .labor-statement-generator {
          font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif;
          background-color: #ffffff;
          font-size: 11px;
          padding: 16px;
          --col-worker: 70px;
          --col-ssn: 105px;
          --col-addr: 220px;
          --col-day-total: 45px;
          --col-unit: 90px;
          --col-bank: 220px;
          --col-bank-active: var(--col-bank);
          --fixed-cols: calc(
            var(--col-worker) + var(--col-ssn) + var(--col-addr) + var(--col-day-total) + var(--col-unit) + var(--col-bank-active)
          );
          --day-col-min: 25px;
          --day-col-width: calc((100% - var(--fixed-cols)) / 30);
        }

        .labor-statement-generator.hide-bank-col {
          --col-bank-active: 0px;
        }

        .labor-statement-generator .table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .labor-statement-generator .custom-table {
          width: 100%;
          min-width: calc(var(--fixed-cols) + (30 * var(--day-col-min)));
          border-collapse: collapse;
          border: 2px solid #000;
          table-layout: fixed;
        }

        .labor-statement-generator .custom-table th,
        .labor-statement-generator .custom-table td {
          border: 1px solid #000;
          padding: 2px;
          text-align: center;
          vertical-align: middle;
          height: 28px;
          overflow: hidden;
        }

        .labor-statement-generator input[type="text"],
        .labor-statement-generator input[type="number"],
        .labor-statement-generator input[type="month"] {
          width: 100%;
          border: none;
          background: transparent;
          text-align: center;
          outline: none;
          font-family: inherit;
          font-size: inherit;
        }

        .labor-statement-generator input:focus { background-color: #f0f9ff; }
        .labor-statement-generator .text-left-input { text-align: left; padding-left: 4px; }

        .labor-statement-generator .control-input {
          background-color: white !important;
          border: 1px solid #d1d5db !important;
          border-radius: 4px;
          padding: 2px 8px;
          height: 30px;
        }

        .labor-statement-generator .day-input { font-size: 10px; color: #333; }

        .labor-statement-generator .header-yellow { background-color: #fffacd; font-weight: bold; }
        .labor-statement-generator .header-blue { background-color: #008080; color: white; font-size: 10px; }
        .labor-statement-generator .header-red { background-color: #a52a2a; color: white; font-size: 10px; }
        .labor-statement-generator .total-row { background-color: #f08080; font-weight: bold; }

        .labor-statement-generator .cell-delegate { background-color: #ffff00 !important; }
        .labor-statement-generator .cell-delegate input { font-weight: bold; color: #b45309; }

        .labor-statement-generator td.bank-col,
        .labor-statement-generator th.bank-col {
          display: table-cell;
        }
        .labor-statement-generator col.bank-col {
          display: table-column;
        }
        .labor-statement-generator.hide-bank-col td.bank-col,
        .labor-statement-generator.hide-bank-col th.bank-col,
        .labor-statement-generator.hide-bank-col col.bank-col {
          display: none !important;
        }

        .labor-statement-generator .bank-info-container { display: flex; flex-direction: column; gap: 2px; }
        .labor-statement-generator .delegation-ui {
          display: none;
          font-size: 9px;
          justify-content: center;
          align-items: center;
          gap: 4px;
          margin-bottom: 2px;
          border-bottom: 1px solid #eee;
          padding-bottom: 2px;
        }
        .labor-statement-generator.show-delegation .delegation-ui { display: flex; }

        .labor-statement-generator .control-box { border-radius: 8px; border: 1px solid; padding: 10px; height: 100%; }
        .labor-statement-generator .master-box { background-color: #fffbeb; border-color: #fcd34d; }
        .labor-statement-generator .db-box { background-color: #f0fdf4; border-color: #86efac; }

        @media print {
          .labor-statement-generator .no-print { display: none; }
          .labor-statement-generator { -webkit-print-color-adjust: exact; padding: 0; }
          .labor-statement-generator .cell-delegate { background-color: #ffff00 !important; -webkit-print-color-adjust: exact; }
          .labor-statement-generator.hide-bank-col .bank-col { display: none !important; }
          .labor-statement-generator .table-scroll { overflow: visible; }
          .labor-statement-generator #mainContainer { max-width: 1500px; margin: 0 auto; }
          .labor-statement-generator { --day-col-width: 25px; }
          .labor-statement-generator col.day-col { width: 25px !important; }
        }
      `}</style>

      {/* Control Bar */}
      <div className="w-full mb-4 flex flex-col gap-4 no-print">
        <div className="flex flex-wrap items-center justify-between p-4 bg-gray-100 rounded-lg border border-gray-300 shadow-sm gap-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center cursor-pointer font-bold text-sm">
              <input
                type="checkbox"
                className="mr-2 w-4 h-4"
                checked={showBankColumn}
                onChange={(e) => setShowBankColumn(e.target.checked)}
              />
              계좌번호 열 표시
            </label>
            <label className="flex items-center cursor-pointer font-bold text-sm">
              <input
                type="checkbox"
                className="mr-2 w-4 h-4"
                checked={showDelegationUi}
                onChange={(e) => setShowDelegationUi(e.target.checked)}
              />
              위임 선택 항목 표시
            </label>
          </div>

          <div className="flex items-center gap-4 border-l pl-4 border-gray-300">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-blue-800">지급 월 선택:</span>
              <input
                type="month"
                className="control-input w-40 font-bold"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 border-l pl-4 border-gray-300">
              <span className="font-bold text-sm text-gray-700">기본 단가:</span>
              <input
                type="number"
                className="control-input w-24 text-right"
                value={globalRate}
                step={1000}
                onChange={(e) => setGlobalRate(Number(e.target.value || 0))}
              />
              <button
                onClick={applyRateToAll}
                className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 text-sm font-bold"
              >
                단가 일괄 적용
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={clearAllRows}
              className="bg-red-500 text-white px-4 py-1.5 rounded hover:bg-red-600 text-sm font-bold"
            >
              전체 비우기
            </button>
            <button
              onClick={() => window.print()}
              className="bg-blue-600 text-white px-5 py-1.5 rounded hover:bg-blue-700 text-sm font-bold shadow-sm"
            >
              명세서 인쇄
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Master Delegation */}
          <div className="control-box master-box flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-amber-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">MASTER</div>
              <span className="text-amber-800 font-bold text-sm">공통 위임 계좌 설정</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="bg-white border border-amber-200 rounded px-2 py-1 text-xs"
                placeholder="은행"
                value={masterBank}
                onChange={(e) => setMasterBank(e.target.value)}
              />
              <input
                type="text"
                className="bg-white border border-amber-200 rounded px-2 py-1 text-xs"
                placeholder="예금주"
                value={masterOwner}
                onChange={(e) => setMasterOwner(e.target.value)}
              />
              <input
                type="text"
                className="bg-white border border-amber-200 rounded px-2 py-1 text-xs flex-grow"
                placeholder="계좌번호"
                value={masterAccount}
                onChange={(e) => setMasterAccount(e.target.value)}
              />
            </div>
          </div>

          {/* Data Load */}
          <div className="control-box db-box flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-green-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">DATABASE</div>
                <span className="text-green-800 font-bold text-sm">작업자 불러오기 (순차 입력)</span>
              </div>
              <button
                onClick={loadAllByFilter}
                className="bg-green-700 text-white px-3 py-1 rounded text-xs hover:bg-green-800 font-bold"
                disabled={loadingAttendance}
              >
                {loadingAttendance ? '로딩 중...' : '선택 필터 전체 로드'}
              </button>
            </div>
            <div className="flex gap-2">
              <select
                className="bg-white border border-green-200 rounded px-2 py-1 text-xs w-48 font-bold text-green-800 focus:ring-1 focus:ring-green-500 outline-none"
                value={selectedSiteId}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedSiteId(v === 'ALL' ? 'ALL' : v);
                }}
              >
                <option value="ALL">전체현장 (전체작업자)</option>
                {reportSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                className="bg-white border border-green-200 rounded px-2 py-1 text-xs flex-grow font-medium outline-none"
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
              >
                {reportWorkers.length === 0 ? (
                  <option value="">해당 조건의 작업자 없음</option>
                ) : (
                  reportWorkers.map((w) => {
                    const master = w.workerId
                      ? workerById.get(w.workerId)
                      : workerByName.get(w.name);
                    const ssn = master?.idNumber ?? '';
                    const siteLabel = selectedSiteId === 'ALL' ? (w.siteName ?? '미지정') : (siteNameInput || w.siteName || '미지정');
                    return (
                      <option key={w.key} value={w.key}>
                        [{siteLabel}] {w.name} ({maskSsnForLabel(ssn)})
                      </option>
                    );
                  })
                )}
              </select>

              <button
                onClick={loadWorkerToNextEmptyRow}
                className="bg-green-600 text-white px-6 py-1 rounded hover:bg-green-700 text-xs font-bold shadow-sm"
                disabled={loadingAttendance}
              >
                입력
              </button>
            </div>
            <div className="text-[11px] text-green-900/80">
              {selectedSiteId === 'ALL'
                ? '전체현장 기준으로 출역 데이터를 불러옵니다. (표는 1~30일만 표시)'
                : '선택한 현장 기준으로 출역 데이터를 불러옵니다. (표는 1~30일만 표시)'}
            </div>
          </div>
        </div>
      </div>

      {/* Printable Document */}
      <div id="mainContainer" className="w-full">
        <div className="mb-6 flex flex-col gap-4 lg:grid lg:grid-cols-[350px_1fr_350px] lg:items-end">
          <div className="hidden lg:block" />
          <div className="text-center">
            <h1 className="text-3xl font-bold underline decoration-4 underline-offset-8 bg-yellow-50 inline-block px-6 py-2 border border-black shadow-sm">
              일용노무비 지급명세서
            </h1>
          </div>

          <div className="lg:justify-self-end">
            <table className="border-collapse border border-black text-xs w-[350px] bg-yellow-50">
              <tbody>
                <tr>
                  <th className="border border-black bg-yellow-100 p-1 w-12" rowSpan={2}>
                    기<br />간
                  </th>
                  <td className="border border-black p-1 text-center w-28">
                    <input type="text" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </td>
                  <th className="border border-black bg-yellow-100 p-1 w-16">회사명</th>
                  <td className="border border-black p-1 text-center">
                    <input type="text" placeholder="회사명 입력" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-1 text-center">
                    <input type="text" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </td>
                  <th className="border border-black bg-yellow-100 p-1">현장명</th>
                  <td className="border border-black p-1 text-center">
                    <input type="text" placeholder="현장명 입력" value={siteNameInput} onChange={(e) => setSiteNameInput(e.target.value)} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-scroll">
          <table className="custom-table" id="laborTable">
            <colgroup>
              <col style={{ width: 'var(--col-worker)' }} />
              <col style={{ width: 'var(--col-ssn)' }} />
              <col style={{ width: 'var(--col-addr)' }} />
              {Array.from({ length: 15 }, (_, i) => (
                <col key={`d1-${i}`} style={{ width: dayColWidthExpr }} className="day-col" />
              ))}
              <col style={{ width: 'var(--col-day-total)' }} />
              <col style={{ width: 'var(--col-unit)' }} />
              <col style={{ width: 'var(--col-bank-active)' }} className="bank-col" />
            </colgroup>

          <thead>
            <tr className="header-yellow">
              <th rowSpan={2}>성 명</th>
              <th rowSpan={2}>
                주민등록번호
                <br />
                <span className="text-[9px] font-normal text-gray-600">전화번호</span>
              </th>
              <th rowSpan={2}>주 소</th>
              {Array.from({ length: 15 }, (_, i) => (
                <th key={`h1-${i}`} className="header-blue">
                  {String(i + 1).padStart(2, '0')}
                </th>
              ))}
              <th rowSpan={2}>
                출역
                <br />
                일수
              </th>
              <th>단가</th>
              <th rowSpan={2} className="bank-col">
                은행 / 예금주 / 계좌번호
                <br />
                <span className="text-[9px] font-normal text-gray-600">(직불: 개인 / 위임: 마스터)</span>
              </th>
            </tr>
            <tr className="header-yellow">
              {Array.from({ length: 15 }, (_, i) => (
                <th key={`h2-${i}`} className="header-red">
                  {String(i + 16).padStart(2, '0')}
                </th>
              ))}
              <th>노무비 총액</th>
            </tr>
          </thead>

            <tbody>
              {rows.map((r) => {
                const totalDays = getRowTotalDays(r);
                const totalAmount = getRowTotalAmount(r);

                const isDelegate = r.payType === 'delegate';
                const bankName = isDelegate ? masterBank : r.bankName;
                const bankOwner = isDelegate ? masterOwner : r.bankOwner;
                const bankAccount = isDelegate ? masterAccount : r.bankAccount;

                return (
                  <React.Fragment key={r.id}>
                    <tr className="labor-row" data-row-id={r.id}>
                      <td rowSpan={2}>
                        <input
                          type="text"
                          className="worker-name font-bold"
                          value={r.workerName}
                          onChange={(e) => updateRow(r.id, { workerName: e.target.value })}
                        />
                      </td>

                    <td rowSpan={2} className="p-0">
                      <input
                        type="text"
                        className="worker-ssn text-[10px]"
                        value={r.workerSsn}
                        onChange={(e) => updateRow(r.id, { workerSsn: e.target.value })}
                      />
                      <div className="border-t border-gray-200 mt-1 pt-1">
                        <input
                          type="text"
                          className="worker-phone text-[9px]"
                          value={r.workerPhone}
                          onChange={(e) => updateRow(r.id, { workerPhone: e.target.value })}
                        />
                      </div>
                    </td>

                    <td rowSpan={2} className="p-0 text-left">
                      <input
                        type="text"
                        className="worker-address text-left-input text-[10px]"
                        value={r.workerAddress}
                        onChange={(e) => updateRow(r.id, { workerAddress: e.target.value })}
                      />
                    </td>

                    {Array.from({ length: 15 }, (_, i) => (
                      <td key={`d-${r.id}-${i}`} className="p-0">
                        <input
                          type="text"
                          className={`day-input day-${i + 1}`}
                          value={r.days[i]}
                          onChange={(e) => updateRowDay(r.id, i, e.target.value)}
                        />
                      </td>
                    ))}

                    <td rowSpan={2} className="p-0">
                      <input type="text" className="days-total font-bold" readOnly value={formatDaysTotal(totalDays)} />
                    </td>

                    <td className="p-0">
                      <input
                        type="number"
                        className="unit-price-input text-right pr-2"
                        step={1000}
                        value={r.unitPrice}
                        onChange={(e) => updateRow(r.id, { unitPrice: e.target.value })}
                      />
                    </td>

                    <td
                      rowSpan={2}
                      className={`p-1 bank-cell bank-col ${isDelegate ? 'cell-delegate' : ''}`}
                    >
                      <div className="delegation-ui">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name={`payType${r.id}`}
                            value="direct"
                            checked={r.payType === 'direct'}
                            onChange={() => setRowPayType(r.id, 'direct')}
                          />
                          직불
                        </label>
                        <label className="flex items-center cursor-pointer ml-2 text-red-600 font-bold">
                          <input
                            type="radio"
                            name={`payType${r.id}`}
                            value="delegate"
                            checked={r.payType === 'delegate'}
                            onChange={() => setRowPayType(r.id, 'delegate')}
                          />
                          위임
                        </label>
                      </div>

                      <div className="bank-info-container">
                        <div className="flex gap-1 border-b border-gray-300 pb-1">
                          <input
                            type="text"
                            className="bank-name-input text-[10px] w-1/2"
                            placeholder="은행"
                            value={bankName}
                            readOnly={isDelegate}
                            onChange={(e) => updateRow(r.id, { bankName: e.target.value })}
                          />
                          <input
                            type="text"
                            className="bank-owner-input text-[10px] w-1/2"
                            placeholder="예금주"
                            value={bankOwner}
                            readOnly={isDelegate}
                            onChange={(e) => updateRow(r.id, { bankOwner: e.target.value })}
                          />
                        </div>
                        <input
                          type="text"
                          className="bank-account-input text-[10px] pt-1"
                          placeholder="계좌번호"
                          value={bankAccount}
                          readOnly={isDelegate}
                          onChange={(e) => updateRow(r.id, { bankAccount: e.target.value })}
                        />
                      </div>
                    </td>
                  </tr>

                  <tr data-row-id={r.id}>
                    {Array.from({ length: 15 }, (_, i) => (
                      <td key={`d2-${r.id}-${i}`} className="p-0">
                        <input
                          type="text"
                          className={`day-input day-${i + 16}`}
                          value={r.days[i + 15]}
                          onChange={(e) => updateRowDay(r.id, i + 15, e.target.value)}
                        />
                      </td>
                    ))}

                    <td className="p-0">
                      <input
                        type="text"
                        className="total-price-input font-bold text-right pr-2"
                        readOnly
                        value={Number.isFinite(totalAmount) ? totalAmount.toLocaleString() : '0'}
                      />
                    </td>
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-[11px] text-gray-700">
          <div>단가 기준(참고): {unitPriceHint(unitPriceFromRows(rows, globalRate))}</div>
        </div>
      </div>

      <div className="w-full mt-4 text-xs text-gray-600 no-print">
        {loadingAttendance && <div>출역 데이터 로딩 중...</div>}
        {loadingReports && <div>출력일보 로딩 중...</div>}
      </div>
    </div>
  );
};

const unitPriceFromRows = (rows: RowState[], globalRate: number): number => {
  const existing = rows.find((r) => String(r.unitPrice ?? '').trim().length > 0);
  if (!existing) return roundToThousand(globalRate);
  const v = parseFloat(String(existing.unitPrice).replace(/,/g, '').trim());
  return Number.isFinite(v) ? v : roundToThousand(globalRate);
};

const unitPriceHint = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return `${value.toLocaleString()}원`;
};

export default LaborCostStatementGeneratorPage;
