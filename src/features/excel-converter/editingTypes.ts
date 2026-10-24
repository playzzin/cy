import { z } from 'zod';

const address = z.string().regex(/^[A-Z]{1,2}[1-9]\d{0,4}$/);
const range = z.string().regex(/^[A-Z]{1,2}[1-9]\d{0,4}(?::[A-Z]{1,2}[1-9]\d{0,4})?$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const cellStyleSchema = z.object({
  fontName: z.string().min(1).max(80).optional(), fontSize: z.number().min(6).max(72).optional(),
  bold: z.boolean().optional(), italic: z.boolean().optional(), underline: z.boolean().optional(),
  color: color.optional(), background: color.optional(),
  align: z.enum(['left','center','right']).optional(), vertical: z.enum(['top','center','bottom']).optional(),
  wrap: z.boolean().optional(), numberFormat: z.string().min(1).max(120).optional(),
  border: z.enum(['none','thin','medium','thick','dashed','dotted','double']).optional(), borderColor: color.optional(),
}).strict();
const anchor = z.object({ recordKey:z.string().max(10000), mappingKey:z.string().max(150), address }).optional();
export const sheetEditSchema = z.discriminatedUnion('kind', [
  z.object({kind:z.literal('style'),range,style:cellStyleSchema,anchor}).strict(),
  z.object({kind:z.literal('columns'),range,width:z.number().min(2).max(80)}).strict(),
  z.object({kind:z.literal('rows'),range,height:z.number().min(8).max(150)}).strict(),
  z.object({kind:z.literal('merge'),range}).strict(),
  z.object({kind:z.literal('unmerge'),range}).strict(),
  z.object({kind:z.literal('page'),orientation:z.enum(['portrait','landscape']).optional(),paper:z.enum(['A4','A3','letter']).optional(),fitWidth:z.number().int().min(0).max(5).optional(),fitHeight:z.number().int().min(0).max(5).optional()}).strict(),
]);
export type SheetEdit = z.infer<typeof sheetEditSchema>;
export type CellStyle = z.infer<typeof cellStyleSchema>;
export const formulaEditSchema = z.object({range,formula:z.string().min(1).max(8192),anchor}).strict();
export const macroEditSchema = z.object({module:z.string().min(1).max(80),code:z.string().min(1).max(60000)}).strict();
export type FormulaEdit = z.infer<typeof formulaEditSchema>;
export type MacroEdit = z.infer<typeof macroEditSchema>;
export const layoutEditSchema = z.discriminatedUnion('kind', [
  z.object({kind:z.literal('insertRows'),at:z.number().int().min(1).max(30000),count:z.number().int().min(1).max(30000)}).strict(),
  z.object({kind:z.literal('deleteRows'),at:z.number().int().min(1).max(30000),count:z.number().int().min(1).max(30000)}).strict(),
  z.object({kind:z.literal('insertColumns'),at:z.number().int().min(1).max(100),count:z.number().int().min(1).max(100)}).strict(),
  z.object({kind:z.literal('deleteColumns'),at:z.number().int().min(1).max(100),count:z.number().int().min(1).max(100)}).strict(),
  z.object({kind:z.literal('copyRange'),range,to:address}).strict(),
  z.object({kind:z.literal('moveRange'),range,to:address}).strict(),
  z.object({kind:z.literal('clearRange'),range}).strict(),
]);
export type LayoutEdit = z.infer<typeof layoutEditSchema>;
// AI describes only this turn. The browser owns accumulated edits and lineage.
export const editDecisionSchema = z.object({
  dataRequest:z.string().max(2000), summary:z.array(z.string().max(500)).max(10), questions:z.array(z.string().max(500)).max(6),
  resetAppearance:z.boolean(), edits:z.array(sheetEditSchema).max(40),
  values:z.array(z.object({address,value:z.union([z.string().max(2000),z.number().finite(),z.boolean(),z.null()])}).strict()).max(50),
  formulas:z.array(formulaEditSchema).max(40).default([]),
  macros:z.array(macroEditSchema).max(10).default([]),
  layout:z.array(layoutEditSchema).max(100).optional(),
}).strict();
export type EditDecision = z.infer<typeof editDecisionSchema>;
