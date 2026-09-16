import { z } from 'zod';

export const ENGINE_VERSION = '1.0.0';
export const LIMITS = { fileBytes: 20 * 1024 * 1024, expandedBytes: 100 * 1024 * 1024, rows: 30000, columns: 100, sheets: 30, outputs: 100 };
export type Scalar = string | number | boolean | null;
export type ValueKind = 'text' | 'number' | 'date' | 'boolean' | 'blank';
export interface SheetCell { address: string; row: number; col: number; value: Scalar; kind: ValueKind; text: string; formula?: string; style: number; hidden?: boolean }
export interface SheetPresentation { styles: { color?: string; background?: string; bold: boolean; fontSize: number; align?: 'left' | 'center' | 'right'; bordered: boolean; numberFormat: number }[]; widths: Record<number, number>; heights: Record<number, number> }
export interface SheetInfo { name: string; path: string; cells: SheetCell[]; rowCount: number; columnCount: number; headerRow: number; merges: string[]; hiddenRows: number[]; hiddenColumns: number[]; warnings: string[]; presentation?: SheetPresentation }
export interface WorkbookFile { id: string; name: string; bytes: ArrayBuffer; sheets: SheetInfo[]; fingerprint: string; warnings: string[] }
export interface Field { key: string; label: string; col: number; kind: ValueKind }
export interface DataRow { id: string; values: Record<string, Scalar>; origins: string[] }
export interface DataTable { fields: Field[]; rows: DataRow[]; warnings: string[]; skipped: { origin: string; reason: string }[] }
const fieldKey = z.string().max(120);
export const mappingSchema = z.object({
  label: z.string().max(120), targetColumn: z.number().int().min(1).max(100),
  sourceKeys: z.array(fieldKey).max(8), mode: z.enum(['copy', 'concat', 'constant', 'blank', 'product']),
  constant: z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]).default(null),
  separator: z.string().max(40).default(' '), format: z.enum(['keep', 'text', 'number', 'date']).default('keep'),
  dateFormat: z.enum(['yyyy-mm-dd', 'yyyy.mm.dd', 'yyyy/mm/dd']).default('yyyy-mm-dd'),
  scale: z.number().finite().min(-1000000).max(1000000).default(1),
  decimals: z.number().int().min(0).max(8).nullable().default(null),
  rounding: z.enum(['round', 'floor', 'ceil', 'truncate']).default('round'),
  required: z.boolean().default(false), confirmed: z.boolean().default(false), reason: z.string().max(500).default(''),
  verifyKey: fieldKey.default(''),
});
export type Mapping = z.infer<typeof mappingSchema>;
export const ruleSchema = z.object({
  filters: z.array(z.object({ key: fieldKey, op: z.enum(['eq', 'neq', 'contains', 'notContains', 'gt', 'gte', 'lt', 'lte', 'notEmpty', 'empty']), value: z.string().max(200) })).max(20).default([]),
  groupBy: z.array(fieldKey).max(8).default([]), sums: z.array(fieldKey).max(20).default([]),
  sort: z.array(z.object({ key: fieldKey, direction: z.enum(['asc', 'desc']) })).max(5).default([]),
  splitBy: fieldKey.default(''), includeHidden: z.boolean().default(true),
});
export type Rules = z.infer<typeof ruleSchema>;
export const planSchema = z.object({
  version: z.literal(1), targetId: z.string().max(100), sheetName: z.string().max(31),
  headerRow: z.number().int().min(1).max(30000), startRow: z.number().int().min(1).max(30000), endRow: z.number().int().min(1).max(30000),
  mappings: z.array(mappingSchema).max(100),
  fixedCells: z.array(z.object({ address: z.string().regex(/^[A-Z]{1,3}[1-9]\d{0,4}$/), mapping: mappingSchema })).max(50).default([]),
  overflow: z.enum(['sheets', 'files', 'stop']).default('sheets'),
  rules: ruleSchema, questions: z.array(z.string().max(500)).max(30).default([]),
  summary: z.array(z.string().max(500)).max(30).default([]), origin: z.enum(['local', 'gemini', 'saved']).default('local'),
  overrides: z.array(z.object({ originsKey: z.string().max(10000), targetColumn: z.number().int().min(1).max(100), value: z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]), kind: z.enum(['text', 'number', 'date', 'boolean', 'blank']) })).max(500).default([]),
});
export type ConversionPlan = z.infer<typeof planSchema>;
export interface Issue { level: 'error' | 'warning' | 'info'; code: string; message: string; location?: string }
export interface CellTrace { sheet: string; address: string; label: string; value: Scalar; origins: string[]; rule: string; kind: ValueKind }
export interface ConversionOutput { name: string; bytes: ArrayBuffer; sheets: SheetInfo[]; traces: CellTrace[]; issues: Issue[]; inputCount: number; excludedCount: number; outputCount: number; group: string }
export interface ConversionResult { outputs: ConversionOutput[]; issues: Issue[]; excluded: { origin: string; reason: string }[]; inputCount: number; outputCount: number; elapsedMs: number }
export interface JoinSpec { fileId: string; sheetName: string; headerRow: number; leftKey: string; rightColumn: number; prefix: string }
export const emptyRules = (): Rules => ruleSchema.parse({});
export const blankMapping = (label: string, targetColumn: number): Mapping => mappingSchema.parse({ label, targetColumn, sourceKeys: [], mode: 'blank' });
