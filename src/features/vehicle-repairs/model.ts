import * as XLSX from 'xlsx';

export const COST_LABELS = { personal: '개인', joeun: '조은', cheongyeon: '청연', corporate: '법인(미구분)' } as const;
export type CostKey = keyof typeof COST_LABELS;
export const COST_KEYS = Object.keys(COST_LABELS) as CostKey[];
export type RepairCosts = Record<CostKey, number | null>;
export interface RepairRecord {
  id: string;
  date: string;
  yearMonth: string;
  originalDate: string;
  vehiclePlate: string;
  vehicleId: string;
  description: string;
  driver: string;
  vendor: string;
  costs: RepairCosts;
  memo: string;
  issues: string[];
  archived: boolean;
  revision: number;
  source?: { fileName: string; sheet: string; cell: string; signature: string; costHeaders: string[] };
}

export const emptyCosts = (): RepairCosts => ({ personal: null, joeun: null, cheongyeon: null, corporate: null });
export const normalizePlate = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();
export const repairTotal = (row: Pick<RepairRecord, 'costs'>) => Math.round(COST_KEYS.reduce((total, key) => total + (row.costs[key] ?? 0), 0) * 100) / 100;
export const formatRepairAmount = (amount: number | null) => amount === null ? '—' : amount.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const text = (value: unknown) => String(value ?? '').trim();
export const isValidRepairDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

export const repairIssues = (row: Pick<RepairRecord, 'date' | 'vehiclePlate' | 'description' | 'costs'>) => {
  const issues: string[] = [];
  if (!isValidRepairDate(row.date)) issues.push('날짜 확인 필요');
  if (!row.vehiclePlate.trim()) issues.push('차량번호 확인 필요');
  if (!row.description.trim()) issues.push('정비내용 확인 필요');
  if (COST_KEYS.every(key => row.costs[key] === null)) issues.push('금액 확인 필요');
  if (COST_KEYS.some(key => row.costs[key] !== null && (!Number.isFinite(row.costs[key]) || row.costs[key]! < 0))) issues.push('금액 형식 확인 필요');
  return issues;
};

function parseDate(value: unknown, year: string) {
  let candidate = text(value);
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) candidate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  } else if (value instanceof Date) {
    candidate = `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  } else {
    const full = candidate.match(/^(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})일?$/);
    const short = candidate.match(/^(\d{1,2})월\s*(\d{1,2})일$/);
    if (full) candidate = `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
    else if (short) candidate = `${year}-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}`;
  }
  return { date: isValidRepairDate(candidate) ? candidate : '', yearMonth: /^\d{4}-(0[1-9]|1[0-2])/.test(candidate) ? candidate.slice(0, 7) : `${year}-00`, originalDate: text(value) };
}

function costKey(header: string, sheet: string): CostKey | null {
  if (header === '개인') return 'personal';
  if (header.includes('청연')) return 'cheongyeon';
  if (header.includes('조은')) return 'joeun';
  if (header === '법인') return sheet.includes('청연') ? 'cheongyeon' : sheet.includes('조은') ? 'joeun' : 'corporate';
  return null;
}

export function parseRepairWorkbook(workbook: XLSX.WorkBook, fileName: string): RepairRecord[] {
  const records: RepairRecord[] = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
    const headerIndex = rows.findIndex(row => row.some((cell, i) => cell === '날짜' && row[i + 1] === '차량번호' && row[i + 2] === '내역'));
    if (headerIndex < 0) continue;
    const header = rows[headerIndex];
    const starts = header.flatMap((cell, index) => cell === '날짜' ? [index] : []);
    const year = sheetName.match(/20\d{2}/)?.[0] || '';
    for (const start of starts) {
      const next = starts.find(index => index > start) ?? header.length;
      const columns = header.flatMap((cell, index) => {
        const key = index > start + 3 && index < next ? costKey(text(cell), sheetName) : null;
        return key ? [{ index, key, label: text(cell) }] : [];
      });
      for (let index = headerIndex + 1; index < rows.length; index++) {
        const row = rows[index];
        // Monthly/yearly totals and empty template rows are never repair records.
        if (!text(row[start + 1]) && !text(row[start + 2])) continue;
        if (/총\s*수리|합계/.test(text(row[start]))) continue;
        const costs = emptyCosts();
        const issues: string[] = [];
        const notes: string[] = [];
        for (const column of columns) {
          const value = row[column.index];
          if (value === null || value === undefined || value === '') continue;
          const amount = typeof value === 'number' ? value : Number(text(value).replace(/[,원\s]/g, ''));
          if (!Number.isFinite(amount)) {
            notes.push(`${column.label}: ${text(value)}`);
            issues.push(`${column.label} 비용란 메모 확인`);
            continue;
          }
          costs[column.key] = Math.round(((costs[column.key] ?? 0) + amount) * 100) / 100;
        }
        const cell = XLSX.utils.encode_cell({ r: index, c: start });
        const record: RepairRecord = {
          id: `vehicle_repair_shindaeji_${encodeURIComponent(sheetName)}_${cell}`,
          ...parseDate(row[start], year),
          vehiclePlate: text(row[start + 1]), vehicleId: '', description: text(row[start + 2]), driver: text(row[start + 3]),
          vendor: '신대지자동차', costs, memo: notes.join(' / '), issues: [], archived: false, revision: 1,
        };
        record.issues = [...repairIssues(record), ...issues];
        const signature = JSON.stringify([record.date, record.originalDate, record.vehiclePlate, record.description, record.driver, costs, record.memo]);
        record.source = { fileName, sheet: sheetName, cell, signature, costHeaders: columns.map(column => column.label) };
        records.push(record);
      }
    }
  }
  if (!records.length) throw new Error('날짜·차량번호·내역·운전자 열이 있는 정비내역을 찾지 못했습니다.');
  return records;
}

export function matchRepairVehicles(records: RepairRecord[], vehicles: Array<{ id: string; licensePlate: string }>): RepairRecord[] {
  return records.map(record => {
    const matches = vehicles.filter(vehicle => normalizePlate(vehicle.licensePlate) === normalizePlate(record.vehiclePlate));
    return { ...record, vehicleId: matches.length === 1 ? matches[0].id : '' };
  });
}

export function classifyRepairImport(records: RepairRecord[], existing: RepairRecord[]) {
  const byId = new Map(existing.map(row => [row.id, row]));
  return {
    added: records.filter(row => !byId.has(row.id)),
    duplicates: records.filter(row => byId.has(row.id) && byId.get(row.id)?.source?.signature === row.source?.signature),
    conflicts: records.filter(row => byId.has(row.id) && byId.get(row.id)?.source?.signature !== row.source?.signature),
  };
}
