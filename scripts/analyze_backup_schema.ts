import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

type TypeName = 'null' | 'string' | 'number' | 'boolean' | 'array' | 'object';

type FieldStats = {
  types: Record<TypeName, number>;
};

type FileReport = {
  file: string;
  rows: number;
  fields: Record<string, FieldStats>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.join(PROJECT_ROOT, 'backups');

const argValue = (name: string): string | null => {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  return value ? String(value) : null;
};

const getLatestBackupDir = (): string | null => {
  if (!fs.existsSync(BACKUPS_DIR)) return null;
  const dirs = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => fs.statSync(path.join(BACKUPS_DIR, f)).isDirectory())
    .sort()
    .reverse();
  return dirs.length > 0 ? path.join(BACKUPS_DIR, dirs[0]) : null;
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

const bump = (stats: FieldStats, type: TypeName) => {
  stats.types[type] = (stats.types[type] ?? 0) + 1;
};

const analyzeFile = (absPath: string): FileReport | null => {
  const raw = fs.readFileSync(absPath, 'utf8');
  let rows: any;
  try {
    rows = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;

  const fields: Record<string, FieldStats> = {};

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      const v = (row as any)[key];
      const t = classify(v);
      if (!fields[key]) {
        fields[key] = { types: { null: 0, string: 0, number: 0, boolean: 0, array: 0, object: 0 } };
      }
      bump(fields[key], t);
    }
  }

  return {
    file: path.basename(absPath),
    rows: rows.length,
    fields
  };
};

const main = () => {
  const backupArg = argValue('--backup');
  const outJson = argValue('--out-json') ?? 'backup_schema_report.json';

  const backupDir = backupArg ? path.resolve(backupArg) : getLatestBackupDir();
  if (!backupDir || !fs.existsSync(backupDir)) {
    console.error('❌ Backup directory not found. Use --backup <dir>.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort();

  const reports: FileReport[] = [];
  for (const f of files) {
    const abs = path.join(backupDir, f);
    try {
      const rep = analyzeFile(abs);
      if (rep) reports.push(rep);
    } catch {
      // ignore
    }
  }

  const absOut = path.isAbsolute(outJson) ? outJson : path.join(PROJECT_ROOT, outJson);
  fs.writeFileSync(
    absOut,
    JSON.stringify(
      {
        backupDir: path.relative(PROJECT_ROOT, backupDir),
        files: reports
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`✅ Wrote schema report: ${path.relative(PROJECT_ROOT, absOut)}`);
  console.log(`- backup: ${path.relative(PROJECT_ROOT, backupDir)}`);
  console.log(`- files: ${reports.length}`);
};

main();
