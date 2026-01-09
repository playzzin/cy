import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

type TypeName = 'null' | 'string' | 'number' | 'boolean' | 'array' | 'object';

type FieldStats = {
  types: Record<TypeName, number>;
};

type ValueCount = Record<string, number>;

type Report = {
  totalReports: number;
  totalWorkerRows: number;
  workerFields: Record<string, FieldStats>;
  statusCounts: ValueCount;
  payTypeCounts: ValueCount;
  salaryModelCounts: ValueCount;
  roleCounts: ValueCount;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const argValue = (name: string): string | null => {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  return value ? String(value) : null;
};

const classify = (v: unknown): TypeName => {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  return 'object';
};

const initFieldStats = (): FieldStats => ({
  types: { null: 0, string: 0, number: 0, boolean: 0, array: 0, object: 0 }
});

const bumpType = (stats: FieldStats, t: TypeName) => {
  stats.types[t] = (stats.types[t] ?? 0) + 1;
};

const bumpValue = (bag: ValueCount, v: unknown) => {
  const key = v === null || v === undefined ? '__null__' : String(v);
  bag[key] = (bag[key] ?? 0) + 1;
};

const main = () => {
  const backupDir = argValue('--backup') ?? path.join(PROJECT_ROOT, 'backups');
  const outJson = argValue('--out-json') ?? 'daily_report_workers_report.json';

  const absBackup = path.isAbsolute(backupDir) ? backupDir : path.join(PROJECT_ROOT, backupDir);
  const dailyReportsPath = fs.statSync(absBackup).isDirectory()
    ? path.join(absBackup, 'daily_reports.json')
    : absBackup;

  if (!fs.existsSync(dailyReportsPath)) {
    console.error(`❌ daily_reports.json not found at: ${dailyReportsPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(dailyReportsPath, 'utf8');
  const reports = JSON.parse(raw) as any[];

  const report: Report = {
    totalReports: Array.isArray(reports) ? reports.length : 0,
    totalWorkerRows: 0,
    workerFields: {},
    statusCounts: {},
    payTypeCounts: {},
    salaryModelCounts: {},
    roleCounts: {}
  };

  if (!Array.isArray(reports)) {
    console.error('❌ daily_reports.json is not an array');
    process.exit(1);
  }

  for (const r of reports) {
    const workers = r?.workers;
    if (!Array.isArray(workers)) continue;

    for (const w of workers) {
      if (!w || typeof w !== 'object') continue;
      report.totalWorkerRows += 1;

      for (const key of Object.keys(w)) {
        const v = (w as any)[key];
        const t = classify(v);
        if (!report.workerFields[key]) report.workerFields[key] = initFieldStats();
        bumpType(report.workerFields[key], t);
      }

      bumpValue(report.statusCounts, (w as any).status);
      bumpValue(report.payTypeCounts, (w as any).payType);
      bumpValue(report.salaryModelCounts, (w as any).salaryModel);
      bumpValue(report.roleCounts, (w as any).role);
    }
  }

  const absOut = path.isAbsolute(outJson) ? outJson : path.join(PROJECT_ROOT, outJson);
  fs.writeFileSync(absOut, JSON.stringify({
    dailyReportsPath: path.relative(PROJECT_ROOT, dailyReportsPath),
    ...report
  }, null, 2), 'utf8');

  console.log(`✅ Wrote report: ${path.relative(PROJECT_ROOT, absOut)}`);
  console.log(`- reports: ${report.totalReports}`);
  console.log(`- worker rows: ${report.totalWorkerRows}`);
};

main();
