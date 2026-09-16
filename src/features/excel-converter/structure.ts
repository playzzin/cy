import { z } from 'zod';
import { ConversionPlan, DataRow, Field, SheetInfo, WorkbookFile, planSchema } from './types';
import { columnName, columnNumber, normalizeLabel } from './workbook';
import { businessMapping, createDocumentPlan, readSourceDocument, semanticKey, SourceDocument } from './businessDocuments';
import { mergeBounds, inputRecordRows } from './mergedLayout';
import { decimalSum, numberValue } from './transform';

const row = z.number().int().min(1).max(30000);
const col = z.number().int().min(1).max(100);
export const extractionSchema = z.object({
  headerRow: row, startRow: row, endRow: row, stride: z.number().int().min(1).max(10), identityKey: z.string().max(120),
  fields: z.array(z.object({key:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,119}$/),label:z.string().min(1).max(120),kind:z.enum(['text','number','date','boolean','blank']),column:col,rowOffset:z.number().int().min(0).max(9),fixedAddress:z.string().regex(/^$|^[A-Z]{1,3}[1-9]\d{0,4}$/)})).min(1).max(100),
});
export type ExtractionLayout = z.infer<typeof extractionSchema>;
export const targetLayoutSchema = z.object({headerRow:row,startRow:row,endRow:row,recordHeight:z.number().int().min(1).max(10),fields:z.array(z.object({label:z.string().min(1).max(120),column:col,rowOffset:z.number().int().min(0).max(9)})).max(100),fixed:z.array(z.object({label:z.string().max(120),address:z.string().regex(/^[A-Z]{1,3}[1-9]\d{0,4}$/)})).max(50)});
export type TargetLayout = z.infer<typeof targetLayoutSchema>;
export const structureResultSchema = z.object({useSuggestedSource:z.boolean(),useSuggestedTarget:z.boolean(),source:extractionSchema.nullable(),target:targetLayoutSchema.nullable(),questions:z.array(z.string().max(500)).max(10),summary:z.array(z.string().max(500)).max(10)});
export type StructureDecision = z.infer<typeof structureResultSchema>;
export interface AtlasPattern {rows:string;cells:[number,string,number][];merges:[number,number,number][]}
export interface SheetAtlas {id:string;rows:number;columns:number;hiddenRows:number[];hiddenColumns:number[];patterns:AtlasPattern[]}
export interface WorkbookAtlas {selected:string;sheets:SheetAtlas[]}
export interface StructureRequest {requestId:string;prompt:string;source:WorkbookAtlas;target:WorkbookAtlas;suggestedSource?:{kind:string;headerRow:number;records:number;verifiedReader?:boolean;fields:Pick<Field,'key'|'label'|'kind'>[]};suggestedTarget?:ConversionPlan;images?:{mimeType:'image/png';data:string}[]}
export interface StructureResult extends StructureDecision {model?:string;inputTokens?:number;outputTokens?:number}
export interface PreparedConversion {document:SourceDocument;plan:ConversionPlan;reused:boolean;structureSignature:string;sourceLayout:ExtractionLayout|null;targetLayout:TargetLayout|null;sourceAtlas:WorkbookAtlas;targetAtlas:WorkbookAtlas}
export type PrepareConversion = (source:WorkbookFile,target:WorkbookFile,sourceSheet:string,targetSheet:string,prompt:string,progress:(text:string)=>void,signal:AbortSignal)=>Promise<PreparedConversion>;

// Only known field captions and day headers leave the browser. Names, account
// numbers, addresses, document titles and data values are replaced by types.
const captions = new Set(('번호 순번 성명 이름 근로자명 작업자명 직원명 근로자 이름 주민등록번호 주민번호 생년월일 전화번호 휴대전화 연락처 핸드폰 주소 거주지 현주소 공수 총공수 총출역 출역 출역공수 일당 단가 노임단가 총액 보수총액 금액 노임금액 노무비 지급액 지급총액 실지급액 차감지급액 청구단가 공급가액 청구금액 은행 은행명 계좌번호 입금계좌 예금주 지급구분 현장명 공사명 대상월 귀속월 작업월 연도 월 년 년도 기간 직종 팀명칭 팀명 팀장 서명 날인 서명날인 서명또는인 위임인 수임인 수임인성명 수임인연락처 수임인주소 수임인은행 수임인계좌 수임인계좌번호 수임인예금주 합계 총계 소계 총합계 품명 품목명 품목코드 제품명 상품명 수량 규격 단위 납기 납품일 거래처 납품처 비고 메모 부서 직책 사번 사원번호 우편번호 사업자등록번호 대표자 공급받는자 공급자 세액 부가세 세전금액 공제금액 소득세 주민세 고용보험 건강보험 국민연금 장기요양보험 체류자격 영문성명 email name quantity qty price amount total date address phone bank account signature company product item code unit description').split(' ').map(normalizeLabel));
export function structuralText(value: unknown): string {
  const text = String(value ?? '').trim(); const normalized=normalizeLabel(text);
  if(captions.has(normalized)||semanticKey(text)) return text;
  if(/^\d{1,2}(?:일|일공수)?$/.test(normalized)&&Number(normalized.match(/^\d+/)?.[0])>=1&&Number(normalized.match(/^\d+/)?.[0])<=31)return text;
  if(/^(기간|현장명|공사명|귀속월|대상월)\s*[:：]/.test(text))return `${text.split(/[:：]/)[0]}: [값]`;
  const parts=text.split(/\s*[/\n]\s*/);if(parts.length>1&&parts.every(p=>captions.has(normalizeLabel(p))||!!semanticKey(p)))return text;
  return '';
}
export function structureOnlyPlan(plan:ConversionPlan):ConversionPlan {
  const clean=(m:ConversionPlan['mappings'][number],index:number)=>({...m,label:structuralText(m.label)||`항목 ${index+1}`,reason:''});
  return{...plan,mappings:plan.mappings.map(clean),fixedCells:plan.fixedCells.map((f,i)=>({...f,mapping:clean(f.mapping,i)})),summary:[],questions:[],overrides:[]};
}
const ranges = (values:number[]) => {const result:string[]=[];let start=values[0],end=start;for(const n of values.slice(1)){if(n===end+1)end=n;else{result.push(start===end?`${start}`:`${start}-${end}`);start=end=n;}}if(start!==undefined)result.push(start===end?`${start}`:`${start}-${end}`);return result.join(',');};
export function workbookAtlas(file:WorkbookFile,selectedSheet:string):WorkbookAtlas {
  return {selected:`s${file.sheets.findIndex(s=>s.name===selectedSheet)+1}`,sheets:file.sheets.map((sheet,index)=>{
    const byRow=new Map<number,SheetInfo['cells']>();for(const c of sheet.cells){const cells=byRow.get(c.row)||[];cells.push(c);byRow.set(c.row,cells);}
    const mergesByRow=new Map<number,[number,number,number][]>();for(const range of sheet.merges){const b=mergeBounds(range);const entries=mergesByRow.get(b.start.row)||[];entries.push([b.start.col,b.end.col-b.start.col+1,b.end.row-b.start.row+1]);mergesByRow.set(b.start.row,entries);}
    const groups=new Map<string,{rows:number[];cells:AtlasPattern['cells'];merges:AtlasPattern['merges']}>();
    for(let r=1;r<=sheet.rowCount;r++){
      const cells:AtlasPattern['cells']=(byRow.get(r)||[]).map(c=>[c.col,structuralText(c.value)||(c.formula?'[수식]':c.kind==='blank'?'':`[${c.kind}]`),c.style]);
      const merges=mergesByRow.get(r)||[];const key=JSON.stringify([cells,merges]);const group=groups.get(key)||{rows:[],cells,merges};group.rows.push(r);groups.set(key,group);
    }
    return{id:`s${index+1}`,rows:sheet.rowCount,columns:sheet.columnCount,hiddenRows:sheet.hiddenRows,hiddenColumns:sheet.hiddenColumns,patterns:[...groups.values()].map(g=>({...g,rows:ranges(g.rows)}))};
  })};
}

export function extractWithLayout(file:WorkbookFile,sheetName:string,raw:ExtractionLayout):SourceDocument {
  const layout=extractionSchema.parse(raw),sheet=file.sheets.find(s=>s.name===sheetName)!;
  if(!sheet||layout.startRow<=layout.headerRow||layout.endRow>sheet.rowCount||layout.endRow<layout.startRow)throw new Error('원본의 데이터 구간을 다시 확인해야 합니다.');
  const keys=layout.fields.map(f=>f.key);if(new Set(keys).size!==keys.length||!keys.includes(layout.identityKey))throw new Error('원본의 인원 구분 항목을 확인해야 합니다.');
  const cells=new Map(sheet.cells.map(c=>[c.address,c]));const merges=sheet.merges.map(mergeBounds);
  const value=(address:string)=>{const cell=cells.get(address);return cell?.value??null;};
  const records:DataRow[]=[];const covered=new Set<number>();
  for(let r=layout.startRow;r<=layout.endRow;r+=layout.stride){
    const values:DataRow['values']={};
    for(const f of layout.fields){
      if(f.column>sheet.columnCount||f.rowOffset>=layout.stride)throw new Error('원본 항목이 한 사람의 입력 구간을 벗어납니다.');
      const address=f.fixedAddress||`${columnName(f.column)}${r+f.rowOffset}`;const cr=Number(address.match(/\d+$/)![0]),cc=columnNumber(address.replace(/\d/g,''));
      if(cr>sheet.rowCount||cc>sheet.columnCount||(!f.fixedAddress&&cr>layout.endRow))throw new Error('원본 항목 위치가 시트 범위를 벗어납니다.');
      const merge=merges.find(m=>cr>=m.start.row&&cr<=m.end.row&&cc>=m.start.col&&cc<=m.end.col);
      if(merge&&(merge.start.row!==cr||merge.start.col!==cc))throw new Error('원본의 병합 시작 칸을 다시 확인해야 합니다.');
      values[f.key]=value(address);
    }
    const identity=values[layout.identityKey];if(identity===null||identity===''){
      if(layout.fields.some(f=>!f.fixedAddress&&values[f.key]!==null&&values[f.key]!==''))throw new Error(`${r}행의 인원 구분 값이 비어 있습니다. 누락 방지를 위해 확인이 필요합니다.`);
      continue;
    }
    if(/^(합계|총계|소계|총합계)$/.test(normalizeLabel(String(identity))))throw new Error('원본 합계 행이 인원에 포함되었습니다. 데이터 범위를 다시 확인해야 합니다.');
    records.push({id:`${file.id}:${r}`,values,origins:[`${file.name} / ${sheet.name} / ${r}~${r+layout.stride-1}행`]});
    for(let offset=0;offset<layout.stride;offset++)covered.add(r+offset);
  }
  const identityField=layout.fields.find(f=>f.key===layout.identityKey)!;
  // A shortened endRow must not silently drop later records.
  for(const cell of sheet.cells.filter(c=>c.col===identityField.column&&c.row>layout.headerRow&&c.value!==null&&c.value!==''&&!covered.has(c.row))){
    const caption=normalizeLabel(String(cell.value));
    if(!/^(합계|총계|소계|총합계)$/.test(caption)&&!structuralText(cell.value))throw new Error('원본 데이터 구간 밖에 남은 인원이 있습니다. 전체 인원을 포함해 다시 분석해야 합니다.');
  }
  if(!records.length)throw new Error('원본에서 옮길 인원을 찾지 못했습니다.');
  const dayKeys=keys.filter(k=>/^day\d+$/.test(k));
  for(const record of records){
    const days=numberValue(record.values.man_days??null),price=numberValue(record.values.unit_price??null),amount=numberValue(record.values.gross_amount??null);
    if(days!==null&&dayKeys.length){
      const values=dayKeys.map(k=>numberValue(record.values[k]??null)??0);
      if(Math.abs(decimalSum(values)-days)>1e-7)throw new Error('읽어낸 날짜별 공수와 원본 총공수가 다릅니다. 날짜가 빠졌거나 다른 줄에 연결되었는지 확인해 주세요.');
    }
    if(days!==null&&price!==null&&amount!==null&&Math.abs(days*price-amount)>0.01)throw new Error('읽어낸 공수·단가와 원본 금액이 다릅니다. 실제 금액 항목의 위치를 확인해 주세요.');
  }
  return{kind:layout.fields.some(f=>/^day\d+$|man_days|gross_amount/.test(f.key))?'labor':'general',label:'Gemini가 확인한 원본 구조',sheetName,headerRow:layout.headerRow,table:{fields:layout.fields.map(f=>({key:f.key,label:f.label,col:f.column,kind:f.kind})),rows:records,warnings:[],skipped:[]},notes:['원본 반복 구간과 항목 위치를 확인했습니다.']};
}

export function planWithLayout(target:WorkbookFile,source:SourceDocument,sheetName:string,raw:TargetLayout):ConversionPlan {
  const layout=targetLayoutSchema.parse(raw),sheet=target.sheets.find(s=>s.name===sheetName)!;
  if(layout.endRow>sheet.rowCount||layout.startRow<=layout.headerRow)throw new Error('받을 양식의 입력 범위가 올바르지 않습니다.');
  const map=(label:string,column:number,offset:number,address:string)=>{
    const mapping={...businessMapping(label,column,source.table.fields),rowOffset:offset};
    if(sheet.cells.some(c=>c.address===address&&c.formula))return{...mapping,mode:'blank' as const,sourceKeys:[],verifyKey:mapping.sourceKeys[0]||'',confirmed:true};
    return mapping;
  };
  const plan=planSchema.parse({version:1,targetId:target.id,sheetName,headerRow:layout.headerRow,startRow:layout.startRow,endRow:layout.endRow,recordHeight:layout.recordHeight,mappings:layout.fields.map(f=>map(f.label,f.column,f.rowOffset,`${columnName(f.column)}${layout.startRow+f.rowOffset}`)),fixedCells:layout.fixed.map(f=>({address:f.address,mapping:map(f.label,columnNumber(f.address.replace(/\d/g,'')),0,f.address)})),rules:{},overflow:'files',origin:'gemini',summary:['새 양식의 입력 구간을 확인했습니다.']});
  inputRecordRows(sheet,plan);return plan;
}

export function suggestedDocuments(source:WorkbookFile,target:WorkbookFile,sourceSheet:string,targetSheet:string){
  let document:SourceDocument|undefined,plan:ConversionPlan|undefined;
  try{document=readSourceDocument(source,sourceSheet);plan=createDocumentPlan(target,document,targetSheet);}catch{/* Gemini may recover an unfamiliar layout before extraction. */}
  return{document,plan};
}

export function renderStructureImage(sheet:SheetInfo):{mimeType:'image/png';data:string}|undefined {
  if(typeof document==='undefined'||/jsdom/i.test(navigator.userAgent))return;
  const canvas=document.createElement('canvas');const columns=Math.min(sheet.columnCount,60),rows=Math.min(sheet.rowCount,24);canvas.width=Math.min(2400,columns*88+48);canvas.height=rows*30+48;
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='11px sans-serif';const width=(canvas.width-48)/columns;
  const cells=new Map(sheet.cells.map(c=>[c.address,c]));const merges=sheet.merges.map(mergeBounds);
  for(let r=1;r<=rows;r++)for(let c=1;c<=columns;c++){
    const merge=merges.find(m=>r>=m.start.row&&r<=m.end.row&&c>=m.start.col&&c<=m.end.col);if(merge&&(merge.start.row!==r||merge.start.col!==c))continue;
    const cell=cells.get(`${columnName(c)}${r}`),x=24+(c-1)*width,y=24+(r-1)*30,w=width*(merge?merge.end.col-c+1:1),h=30*(merge?Math.min(rows,merge.end.row)-r+1:1);
    ctx.strokeStyle='#b8c2d0';ctx.strokeRect(x,y,w,h);ctx.fillStyle='#334155';ctx.save();ctx.beginPath();ctx.rect(x+2,y,w-4,h);ctx.clip();ctx.fillText(cell?(structuralText(cell.value)||(cell.formula?'수식':cell.value!==null?'…':'')):'',x+3,y+18);ctx.restore();
  }
  return{mimeType:'image/png',data:canvas.toDataURL('image/png').split(',')[1]};
}
