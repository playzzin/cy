import React, { useEffect, useMemo, useRef, useState } from 'react';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { YearMonthPicker } from '../../components/common/YearMonthPicker';

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
};

type AttendanceMapEntry = {
  days: Record<number, number>;
  unitPrice?: number;
};

type AttendanceMap = Record<string, AttendanceMapEntry>;

type ReportTeamOption = {
  id: string;
  name: string;
};

type ReportWorkerOption = {
  key: string;
  workerId: string | null;
  name: string;
  teamId: string | null;
  teamName: string | null;
};

const normalizeKoreanKey = (value: string): string => {
  return String(value ?? '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, '')
    .trim();
};

const isDailyWageLabel = (value: string): boolean => {
  const k = normalizeKoreanKey(value);
  return k.includes('일급') || k.includes('일근');
};

const normalizeRawKey = (value: unknown): string => {
  return String(value ?? '').trim();
};

const toYearMonth = (value: string): string => {
  const s = String(value ?? '').trim();
  const m = s.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : '';
};

const getThisYearMonth = (): string => {
  return new Date().toISOString().slice(0, 7);
};

const MIN_ROW_COUNT = 20;

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
  const end = new Date(y, m, 0).toISOString().slice(0, 10);
  return { start, end };
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
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (m) {
    const day = Number(m[2]);
    return Number.isFinite(day) ? day : null;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDate();
};

const DailyWageStatementPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [showBankColumn, setShowBankColumn] = useState(true);
  const [showDelegationUi, setShowDelegationUi] = useState(true);

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [globalRate, setGlobalRate] = useState(150000);

  const [companyName, setCompanyName] = useState('');
  const [teamNameInput, setTeamNameInput] = useState('');

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [reportsLoadedKey, setReportsLoadedKey] = useState<string>('');
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<'ALL' | string>('ALL');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

  const [rows, setRows] = useState<RowState[]>(() => Array.from({ length: MIN_ROW_COUNT }, (_, i) => createEmptyRow(i + 1)));

  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const [attendanceLoadedKey, setAttendanceLoadedKey] = useState<string>('');
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const autoLoadKeyRef = useRef('');

  useEffect(() => {
    const qMonth = toYearMonth(searchParams.get('month') ?? '');
    if (qMonth) {
      setMonth(qMonth);
    }
    const qTeamId = String(searchParams.get('teamId') ?? '').trim();
    if (qTeamId) {
      setSelectedTeamId(qTeamId === 'ALL' ? 'ALL' : qTeamId);
    }
  }, [searchParams]);

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

  const dailyWageWorkers = useMemo(() => {
    return workers.filter((w) => {
      const salaryModel = String((w as any)?.salaryModel ?? '').trim();
      const payType = String((w as any)?.payType ?? '').trim();
      return isDailyWageLabel(salaryModel) || isDailyWageLabel(payType);
    });
  }, [workers]);

  const dailyWageWorkerIdSet = useMemo(() => {
    const set = new Set<string>();
    dailyWageWorkers.forEach((w) => {
      const id = normalizeRawKey(w.id);
      const legacyId = normalizeRawKey((w as any)?.legacyId);
      if (id) set.add(id);
      if (legacyId) set.add(legacyId);
    });
    return set;
  }, [dailyWageWorkers]);

  const dailyWageWorkerNameSet = useMemo(() => {
    const set = new Set<string>();
    dailyWageWorkers.forEach((w) => {
      const name = normalizeRawKey(w.name);
      if (name) set.add(name);
    });
    return set;
  }, [dailyWageWorkers]);

  const dailyWageWorkerByAnyId = useMemo(() => {
    const map = new Map<string, Worker>();
    dailyWageWorkers.forEach((w) => {
      const id = normalizeRawKey(w.id);
      const legacyId = normalizeRawKey((w as any)?.legacyId);
      if (id) map.set(id, w);
      if (legacyId && !map.has(legacyId)) map.set(legacyId, w);
    });
    return map;
  }, [dailyWageWorkers]);

  const dailyWageWorkerByName = useMemo(() => {
    const map = new Map<string, Worker>();
    dailyWageWorkers.forEach((w) => {
      const name = normalizeRawKey(w.name);
      if (!name || map.has(name)) return;
      map.set(name, w);
    });
    return map;
  }, [dailyWageWorkers]);

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

  const reportTeams = useMemo<ReportTeamOption[]>(() => {
    const map = new Map<string, string>();
    dailyWageWorkers.forEach((w) => {
      const teamId = normalizeRawKey(w.teamId);
      const teamName = normalizeRawKey(w.teamName);
      const key = teamId || teamName;
      if (!key) return;
      const name = teamName || key;
      if (!map.has(key)) map.set(key, name);
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dailyWageWorkers]);

  useEffect(() => {
    if (selectedTeamId === 'ALL') return;
    if (reportTeams.length === 0) return;
    const exists = reportTeams.some((t) => t.id === selectedTeamId);
    if (!exists) {
      setSelectedTeamId('ALL');
    }
  }, [reportTeams, selectedTeamId]);

  const selectedTeam = useMemo<ReportTeamOption | null>(() => {
    if (selectedTeamId === 'ALL') return null;
    return reportTeams.find((t) => t.id === selectedTeamId) ?? null;
  }, [reportTeams, selectedTeamId]);

  const selectedTeamLabel = useMemo(() => {
    if (selectedTeamId === 'ALL') return '전체 통합';
    const name = selectedTeam?.name ?? teamNameInput;
    return name && name.trim().length > 0 ? name : '미지정';
  }, [selectedTeam, selectedTeamId, teamNameInput]);

  const matchesSelectedWorkerTeam = (teamId: string | null | undefined, teamName: string | null | undefined): boolean => {
    if (selectedTeamId === 'ALL') return true;

    const selectedRaw = normalizeRawKey(selectedTeamId);
    if (!selectedRaw) return false;

    const selectedNormalizedName = normalizeKoreanKey(selectedRaw);
    const workerTeamId = normalizeRawKey(teamId);
    if (workerTeamId && workerTeamId === selectedRaw) return true;

    const workerTeamName = normalizeRawKey(teamName);
    if (!workerTeamName) return false;
    if (workerTeamName === selectedRaw) return true;
    return normalizeKoreanKey(workerTeamName) === selectedNormalizedName;
  };

  useEffect(() => {
    if (selectedTeamId === 'ALL') {
      setTeamNameInput('전체 통합');
      return;
    }
    const name = selectedTeam?.name ?? '';
    setTeamNameInput(name);
  }, [selectedTeamId, selectedTeam]);

  const reportWorkers = useMemo<ReportWorkerOption[]>(() => {
    const map = new Map<string, ReportWorkerOption>();
    reports.forEach((r) => {
      (r.workers ?? []).forEach((w: any) => {
        const workerId = w?.workerId ? String(w.workerId) : '';
        const name = w?.name ? String(w.name) : '';
        const manDay = typeof w?.manDay === 'number' ? w.manDay : Number(w?.manDay || 0);
        if (!name) return;
        if (!Number.isFinite(manDay) || manDay <= 0) return;
        const normalizedName = name.trim();

        const masterWorker =
          (workerId ? (dailyWageWorkerByAnyId.get(workerId) ?? null) : null)
          ?? (normalizedName ? (dailyWageWorkerByName.get(normalizedName) ?? null) : null);

        const salaryModel = String(w?.salaryModel ?? '').trim();
        const payType = String(w?.payType ?? '').trim();
        const isDailyWage =
          isDailyWageLabel(salaryModel)
          || isDailyWageLabel(payType)
          || (workerId && dailyWageWorkerIdSet.has(workerId))
          || (normalizedName && dailyWageWorkerNameSet.has(normalizedName))
          || Boolean(masterWorker);

        if (!isDailyWage) return;
        const resolvedWorkerTeamId = normalizeRawKey(masterWorker?.teamId ?? w?.teamId) || null;
        const resolvedWorkerTeamName = normalizeRawKey(masterWorker?.teamName ?? w?.teamName) || null;

        if (!matchesSelectedWorkerTeam(resolvedWorkerTeamId, resolvedWorkerTeamName)) return;

        const key = (!workerId || workerId === 'unknown') ? name : workerId;
        if (!map.has(key)) {
          map.set(key, {
            key,
            workerId: (!workerId || workerId === 'unknown') ? null : workerId,
            name,
            teamId: resolvedWorkerTeamId,
            teamName: resolvedWorkerTeamName
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [
    dailyWageWorkerByAnyId,
    dailyWageWorkerByName,
    dailyWageWorkerIdSet,
    dailyWageWorkerNameSet,
    reports,
    selectedTeamId
  ]);

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
    const targetCount = Math.max(MIN_ROW_COUNT, reportWorkers.length);
    setRows(Array.from({ length: targetCount }, (_, i) => createEmptyRow(i + 1)));
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
    const teamPart = selectedTeamId === 'ALL' ? 'ALL' : selectedTeamId;
    return `${teamPart}|${startDate}|${endDate}`;
  };

  const loadAttendance = async (): Promise<AttendanceMap> => {
    const key = buildAttendanceKey();
    if (attendanceLoadedKey === key) {
      return attendanceMap;
    }

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
      const map: AttendanceMap = {};
      sourceReports.forEach((report) => {
        const dayRaw = extractDayOfMonth((report as any)?.date);
        if (dayRaw == null) return;
        const day = dayRaw;
        if (!Number.isFinite(day) || day < 1 || day > 31) return;

        report.workers.forEach((w: any) => {
          const workerId = w?.workerId ? String(w.workerId) : '';
          const rawKey = (!workerId || workerId === 'unknown') ? w?.name : workerId;
          if (!rawKey) return;
          const workerKey = String(rawKey);

          const name = w?.name ? String(w.name).trim() : '';
          const masterWorker =
            (workerId ? (dailyWageWorkerByAnyId.get(workerId) ?? null) : null)
            ?? (name ? (dailyWageWorkerByName.get(name) ?? null) : null);
          const salaryModel = String(w?.salaryModel ?? '').trim();
          const payType = String(w?.payType ?? '').trim();
          const isDailyWage =
            isDailyWageLabel(salaryModel)
            || isDailyWageLabel(payType)
            || (workerId && dailyWageWorkerIdSet.has(workerId))
            || (name && dailyWageWorkerNameSet.has(name))
            || Boolean(masterWorker);

          if (!isDailyWage) return;
          const resolvedWorkerTeamId = normalizeRawKey(masterWorker?.teamId ?? w?.teamId) || null;
          const resolvedWorkerTeamName = normalizeRawKey(masterWorker?.teamName ?? w?.teamName) || null;
          if (!matchesSelectedWorkerTeam(resolvedWorkerTeamId, resolvedWorkerTeamName)) return;

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

  const statementSummary = useMemo(() => {
    const dayTotals = Array.from({ length: 31 }, () => 0);
    let totalDays = 0;
    let totalAmount = 0;

    rows.forEach((r) => {
      r.days.forEach((raw, idx) => {
        const v = parseFloat(String(raw).trim());
        if (!Number.isFinite(v) || v === 0) return;
        dayTotals[idx] += v;
      });

      const rowDays = sumDays(r.days);
      totalDays += rowDays;

      const unit = parseFloat(String(r.unitPrice).replace(/,/g, '').trim());
      const unitPrice = Number.isFinite(unit) ? unit : 0;
      totalAmount += Math.round(rowDays * unitPrice);
    });

    return {
      totalDays,
      totalAmount,
      dayTotals
    };
  }, [rows]);

  const activeRowCount = useMemo(() => {
    return rows.filter((r) => r.workerName.trim().length > 0).length;
  }, [rows]);

  const totalAmountLabel = useMemo(() => {
    return Number.isFinite(statementSummary.totalAmount)
      ? statementSummary.totalAmount.toLocaleString()
      : '0';
  }, [statementSummary.totalAmount]);

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
        for (let d = 1; d <= 31; d++) {
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

    let target = rows.find((r) => r.workerName.trim().length === 0) ?? null;
    if (!target) {
      const nextId = rows.length > 0 ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
      setRows((prev) => [...prev, createEmptyRow(nextId)]);
      target = { ...createEmptyRow(nextId), id: nextId };
    }

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
    const targetCount = Math.max(MIN_ROW_COUNT, reportWorkers.length);
    setRows(Array.from({ length: targetCount }, (_, i) => createEmptyRow(i + 1)));

    const map = await loadAttendance();
    const candidates = reportWorkers;

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

  useEffect(() => {
    if (!startDate || !endDate) return;
    const key = `${selectedTeamId}|${periodKey}|${reportWorkers.length}`;
    if (autoLoadKeyRef.current === key) return;
    autoLoadKeyRef.current = key;

    if (reportWorkers.length === 0) {
      setRows(Array.from({ length: MIN_ROW_COUNT }, (_, i) => createEmptyRow(i + 1)));
      return;
    }

    void loadAllByFilter();
  }, [endDate, periodKey, reportWorkers.length, selectedTeamId, startDate]);

  return (
    <div className={containerClass}>
      <style>{`
        .labor-statement-generator {
          font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
          background-color: #f8fafc;
          color: #0f172a;
          font-size: 11px;
          padding: 20px;
          --col-worker: 60px;
          --col-ssn: 105px;
          --col-addr: 300px;
          --col-day-total: 42px;
          --col-unit: 80px;
          --col-bank: 220px;
          --col-bank-active: var(--col-bank);
          --fixed-cols: calc(
            var(--col-worker) + var(--col-ssn) + var(--col-addr) + var(--col-day-total) + var(--col-unit) + var(--col-bank-active)
          );
          --day-col-min: 25px;
          --day-col-width: calc((100% - var(--fixed-cols)) / 31);
        }

        .labor-statement-generator .statement-toolbar {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        }

        .labor-statement-generator .toolbar-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .labor-statement-generator .toolbar-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .labor-statement-generator .toolbar-eyebrow {
          font-size: 10px;
          letter-spacing: 0.32em;
          font-weight: 700;
          color: #64748b;
        }

        .labor-statement-generator .toolbar-main {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
        }

        .labor-statement-generator .toolbar-sub {
          font-size: 12px;
          color: #475569;
          font-weight: 500;
        }

        .labor-statement-generator .toolbar-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .labor-statement-generator .btn-primary {
          background: #1d4ed8;
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 6px 16px rgba(30, 64, 175, 0.25);
          cursor: pointer;
        }

        .labor-statement-generator .btn-secondary {
          background: #0f766e;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .labor-statement-generator .btn-ghost {
          background: rgba(255, 255, 255, 0.9);
          color: #334155;
          border: 1px solid #cbd5f5;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .labor-statement-generator .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }

        .labor-statement-generator .summary-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
        }

        .labor-statement-generator .summary-card.highlight {
          background: linear-gradient(135deg, #1d4ed8, #2563eb);
          color: #fff;
          border-color: #1e40af;
        }

        .labor-statement-generator .summary-card.highlight .summary-label,
        .labor-statement-generator .summary-card.highlight .summary-sub {
          color: rgba(255, 255, 255, 0.8);
        }

        .labor-statement-generator .summary-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
        }

        .labor-statement-generator .summary-value {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }

        .labor-statement-generator .summary-sub {
          font-size: 11px;
          color: #94a3b8;
        }

        .labor-statement-generator .control-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .labor-statement-generator .control-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .labor-statement-generator .control-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #475569;
        }

        .labor-statement-generator .control-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .labor-statement-generator .control-meta {
          font-size: 10px;
          color: #64748b;
        }

        .labor-statement-generator .month-picker {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }

        .labor-statement-generator .month-input,
        .labor-statement-generator .rate-input {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 12px;
          background: #f8fafc;
          text-align: center;
          height: 32px;
        }

        .labor-statement-generator .rate-input {
          text-align: right;
          width: 120px;
        }

        .labor-statement-generator .month-chips {
          display: flex;
          gap: 6px;
        }

        .labor-statement-generator .month-chip {
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #334155;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .labor-statement-generator .month-chip.active {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }

        .labor-statement-generator .toggle-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .labor-statement-generator .toggle-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #334155;
        }

        .labor-statement-generator .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 12px;
        }

        .labor-statement-generator .control-box {
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 16px;
          background: #fff;
        }

        .labor-statement-generator .db-box {
          background-color: #ecfdf5;
          border-color: #bbf7d0;
        }

        .labor-statement-generator .team-button-group {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .labor-statement-generator .team-chip {
          border: 1px solid #86efac;
          color: #14532d;
          background: #f0fdf4;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .labor-statement-generator .team-chip.active {
          background: #15803d;
          color: #fff;
          border-color: #166534;
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
          min-width: calc(var(--fixed-cols) + (31 * var(--day-col-min)));
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

        .labor-statement-generator input.month-input,
        .labor-statement-generator input.rate-input {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 8px 12px;
          background: #fff;
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

        .labor-statement-generator .control-box { height: 100%; }

        @media print {
          .labor-statement-generator .no-print { display: none; }
          .labor-statement-generator { -webkit-print-color-adjust: exact; padding: 0; background: #fff; }
          .labor-statement-generator .cell-delegate { background-color: #ffff00 !important; -webkit-print-color-adjust: exact; }
          .labor-statement-generator.hide-bank-col .bank-col { display: none !important; }
          .labor-statement-generator .table-scroll { overflow: visible; }
          .labor-statement-generator #mainContainer { max-width: 1500px; margin: 0 auto; }
          .labor-statement-generator { --day-col-width: 25px; }
          .labor-statement-generator col.day-col { width: 25px !important; }
        }
      `}</style>

      <div className="w-full mb-6 flex flex-col gap-4 no-print">
        <div className="statement-toolbar">
          <div className="toolbar-header">
            <div className="toolbar-title">
              <span className="toolbar-eyebrow">DAILY WAGE STATEMENT</span>
              <h1 className="toolbar-main">일급제 명세서 통합 뷰</h1>
              <p className="toolbar-sub">
                지급월 {month} · 기간 {startDate} ~ {endDate} · 팀 {selectedTeamLabel}
              </p>
            </div>
            <div className="toolbar-actions">
              <button type="button" onClick={() => window.print()} className="btn-primary">
                명세서 인쇄
              </button>
              <button type="button" onClick={clearAllRows} className="btn-ghost">
                전체 비우기
              </button>
            </div>
          </div>

          <div className="settings-grid">
            <div className="control-box db-box flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-green-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">DATABASE</div>
                <span className="text-green-800 font-bold text-sm">작업자 불러오기</span>
              </div>

              <div className="summary-grid">
                <div className="summary-card">
                  <span className="summary-label">활성 인원</span>
                  <strong className="summary-value">{activeRowCount.toLocaleString()}명</strong>
                  <span className="summary-sub">명세서 입력된 작업자 기준</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">총 공수</span>
                  <strong className="summary-value">{formatDaysTotal(statementSummary.totalDays)}일</strong>
                  <span className="summary-sub">31일 전체 합산</span>
                </div>
                <div className="summary-card highlight">
                  <span className="summary-label">총 지급 예정액</span>
                  <strong className="summary-value">{totalAmountLabel}원</strong>
                  <span className="summary-sub">현재 입력 기준</span>
                </div>
              </div>

              <div className="control-grid">
                <div className="control-card">
                  <span className="control-title">지급 월 선택</span>
                  <div className="control-body">
                    <div className="relative">
                      <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-2.5 text-slate-400" />
                      <YearMonthPicker
                        value={month}
                        onChange={setMonth}
                        inputClassName="month-input pl-9"
                      />
                    </div>
                    <span className="control-meta">연도를 이동한 뒤 월을 선택할 수 있습니다.</span>
                  </div>
                </div>

                <div className="control-card">
                  <span className="control-title">보기 옵션</span>
                  <div className="control-body toggle-group">
                    <label className="toggle-item">
                      <input
                        type="checkbox"
                        checked={showBankColumn}
                        onChange={(e) => setShowBankColumn(e.target.checked)}
                      />
                      계좌번호 열 표시
                    </label>
                    <label className="toggle-item">
                      <input
                        type="checkbox"
                        checked={showDelegationUi}
                        onChange={(e) => setShowDelegationUi(e.target.checked)}
                      />
                      위임 선택 UI 표시
                    </label>
                  </div>
                </div>

                <div className="control-card">
                  <span className="control-title">기본 단가</span>
                  <div className="control-body">
                    <div className="month-picker">
                      <input
                        type="number"
                        className="rate-input"
                        value={globalRate}
                        step={1000}
                        onChange={(e) => setGlobalRate(Number(e.target.value || 0))}
                      />
                      <button type="button" onClick={applyRateToAll} className="btn-secondary">
                        단가 일괄 적용
                      </button>
                    </div>
                    <span className="control-meta">빈 단가 칸에 우선 적용됩니다.</span>
                  </div>
                </div>
              </div>

              <div className="team-button-group">
                <button
                  type="button"
                  className={`team-chip ${selectedTeamId === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSelectedTeamId('ALL')}
                >
                  전체팀
                </button>
                {reportTeams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`team-chip ${selectedTeamId === t.id ? 'active' : ''}`}
                    onClick={() => setSelectedTeamId(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-green-900/80">
                선택팀 로드 없이 자동으로 불러옵니다. (기본 20명, 작업자 수에 따라 자동 조정)
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="mainContainer" className="w-full">
        <div className="mb-6 flex flex-col gap-4 lg:grid lg:grid-cols-[350px_1fr_350px] lg:items-end">
          <div className="hidden lg:block" />
          <div className="text-center">
            <h1 className="text-3xl font-bold underline decoration-4 underline-offset-8 bg-yellow-50 inline-block px-6 py-2 border border-black shadow-sm">
              노무내역서
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
                  <th className="border border-black bg-yellow-100 p-1">팀명</th>
                  <td className="border border-black p-1 text-center">
                    <input type="text" placeholder="팀명 입력" value={teamNameInput} onChange={(e) => setTeamNameInput(e.target.value)} />
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
                  <span className="text-[9px] font-normal text-gray-600">(직불·위임 모두 개별 입력)</span>
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
                const bankName = r.bankName;
                const bankOwner = r.bankOwner;
                const bankAccount = r.bankAccount;

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
                          className="worker-ssn text-[10px] font-semibold"
                          value={r.workerSsn}
                          onChange={(e) => updateRow(r.id, { workerSsn: e.target.value })}
                        />
                        <div className="border-t border-gray-200 mt-1 pt-1">
                          <input
                            type="text"
                            className="worker-phone text-[9px] font-semibold"
                            value={r.workerPhone}
                            onChange={(e) => updateRow(r.id, { workerPhone: e.target.value })}
                          />
                        </div>
                      </td>

                      <td rowSpan={2} className="p-0 text-left">
                        <input
                          type="text"
                          className="worker-address text-left-input text-[10px] font-semibold"
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
                          className="unit-price-input text-right pr-2 font-bold text-slate-800"
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
                              onChange={(e) => updateRow(r.id, { bankName: e.target.value })}
                            />
                            <input
                              type="text"
                              className="bank-owner-input text-[10px] w-1/2"
                              placeholder="예금주"
                              value={bankOwner}
                              onChange={(e) => updateRow(r.id, { bankOwner: e.target.value })}
                            />
                          </div>
                          <input
                            type="text"
                            className="bank-account-input text-[10px] pt-1"
                            placeholder="계좌번호"
                            value={bankAccount}
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

            <tfoot>
              <tr className="total-row">
                <td rowSpan={2} colSpan={3} className="text-left font-bold pl-2">
                  합계
                </td>

                {Array.from({ length: 15 }, (_, i) => (
                  <td key={`sum-d1-${i}`} className="p-0">
                    <input type="text" className="day-input font-bold" readOnly value={formatDaysTotal(statementSummary.dayTotals[i] ?? 0)} />
                  </td>
                ))}

                <td rowSpan={2} className="p-0">
                  <input type="text" className="days-total font-bold" readOnly value={formatDaysTotal(statementSummary.totalDays)} />
                </td>

                <td className="p-0">
                  <input type="text" className="unit-price-input text-right pr-2" readOnly value="" />
                </td>

                <td rowSpan={2} className="bank-col" />
              </tr>

              <tr className="total-row">
                {Array.from({ length: 15 }, (_, i) => (
                  <td key={`sum-d2-${i}`} className="p-0">
                    <input
                      type="text"
                      className="day-input font-bold"
                      readOnly
                      value={formatDaysTotal(statementSummary.dayTotals[i + 15] ?? 0)}
                    />
                  </td>
                ))}

                <td className="p-0">
                  <input
                    type="text"
                    className="total-price-input font-bold text-right pr-2"
                    readOnly
                    value={Number.isFinite(statementSummary.totalAmount) ? statementSummary.totalAmount.toLocaleString() : '0'}
                  />
                </td>
              </tr>
            </tfoot>
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

export default DailyWageStatementPage;
