import { ConversionPlan, DataTable, WorkbookFile } from './types';
import { PreparedConversion, structuralText, structureOnlyPlan, WorkbookAtlas } from './structure';
export interface PlannerRequest { requestId: string; prompt: string; plan: ConversionPlan; sourceFields: { key: string; label: string; kind: string }[]; target: { sheetName: string; headerRow: number; cells: { address: string; text: string; formula?: string }[]; merges: string[] }; example?: { headers: string[]; formats: string[] }; structure?:{source:WorkbookAtlas;target:WorkbookAtlas}; }
export interface PlannerResult { plan: ConversionPlan; model: string; inputTokens: number; outputTokens: number; elapsedMs: number; }
export function makeStructuredPlannerRequest(prompt:string,plan:ConversionPlan,prepared:PreparedConversion,target:WorkbookFile):PlannerRequest {
 const sheet=target.sheets.find(s=>s.name===plan.sheetName)!;
 return{requestId:crypto.randomUUID(),prompt,plan:structureOnlyPlan(plan),sourceFields:prepared.document.table.fields.map(({key,label,kind},index)=>({key,label:structuralText(label)||`항목 ${index+1}`,kind})),target:{sheetName:sheet.name,headerRow:plan.headerRow,cells:sheet.cells.filter(c=>structuralText(c.value)&&c.row<=plan.headerRow+10).map(c=>({address:c.address,text:structuralText(c.value)})),merges:sheet.merges},structure:{source:prepared.sourceAtlas,target:prepared.targetAtlas}};
}
export function makePlannerRequest(prompt: string, plan: ConversionPlan, table: DataTable, target: WorkbookFile, example?: WorkbookFile): PlannerRequest {
  const sheet = target.sheets.find(s => s.name === plan.sheetName)!;
  const inputAddresses = new Set(plan.fixedCells.map(f => f.address));
  const inputColumns = new Set(plan.mappings.map(m => m.targetColumn));
  return { requestId: crypto.randomUUID(), prompt, plan, sourceFields: table.fields.map(({ key, label, kind }) => ({ key, label, kind })), target: { sheetName: sheet.name, headerRow: plan.headerRow, cells: sheet.cells.filter(c => c.formula || (c.value !== null && !inputAddresses.has(c.address) && !(c.row >= plan.startRow && c.row <= plan.endRow && inputColumns.has(c.col)))).slice(0, 500).map(c => ({ address: c.address, text: c.formula ? '' : c.text.replace(/\d{6}-[1-4][\d*]{6}|01\d-\d{3,4}-\d{4}/g, '[개인정보]').slice(0, 200), ...(c.formula ? { formula: c.formula } : {}) })), merges: sheet.merges.slice(0, 100) }, ...(example ? { example: { headers: example.sheets[0].cells.filter(c => c.row === example.sheets[0].headerRow).map(c => c.text), formats: example.sheets[0].cells.filter(c => c.row > example.sheets[0].headerRow && c.row < example.sheets[0].headerRow + 4).map(c => `${c.address}:${c.kind}`) } } : {}) };
}
