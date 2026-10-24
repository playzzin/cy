import JSZip from 'jszip';
import { LayoutEdit, layoutEditSchema } from './editingTypes';
import { ConversionPlan, WorkbookFile } from './types';
import { columnName, columnNumber, elements, normalizeZipPath, readWorkbook, serializeXml, xml } from './workbook';
import { editBounds } from './sheetEditing';
import { translateFormula } from './formulaEditing';
import type { CellSelection, ResultVersion } from './review';

type AxisEdit = Extract<LayoutEdit, {at:number}>;
const isAxis = (edit:LayoutEdit):edit is AxisEdit => 'at' in edit;
const isRow = (edit:AxisEdit) => edit.kind.endsWith('Rows');
const isDelete = (edit:AxisEdit) => edit.kind.startsWith('delete');
const point = (n:number, edit:AxisEdit):number|null => n < edit.at ? n : !isDelete(edit) ? n + edit.count : n < edit.at + edit.count ? null : n - edit.count;
function interval(a:number,b:number,edit:AxisEdit):[number,number]|null {
  if (!isDelete(edit)) return [a >= edit.at ? a + edit.count : a, b >= edit.at ? b + edit.count : b];
  const end=edit.at+edit.count-1;
  if(b<edit.at)return[a,b];
  if(a>end)return[a-edit.count,b-edit.count];
  if(a>=edit.at&&b<=end)return null;
  return[a<edit.at?a:edit.at,b>end?b-edit.count:edit.at-1];
}

/** Excel insert/delete semantics also move absolute references. */
export function shiftLayoutRange(range:string,edit:AxisEdit):string|null {
  const parts=range.split(':');
  const cell=/^(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)$/i;
  const a=cell.exec(parts[0]),b=cell.exec(parts[1]||parts[0]);
  if(a&&b){
    const axis=isRow(edit),start=axis?Number(a[4]):columnNumber(a[2]),end=axis?Number(b[4]):columnNumber(b[2]);
    const moved=interval(start,end,edit);if(!moved)return null;
    const format=(m:RegExpExecArray,n:number)=>`${m[1]}${axis?m[2]:columnName(n)}${m[3]}${axis?n:m[4]}`;
    return parts.length===1?format(a,moved[0]):`${format(a,moved[0])}:${format(b,moved[1])}`;
  }
  const whole=isRow(edit)?/^(\$?)([1-9]\d*):(\$?)([1-9]\d*)$/:/^(\$?)([A-Z]{1,3}):(\$?)([A-Z]{1,3})$/i;
  const m=whole.exec(range);if(!m)return range;
  const moved=interval(isRow(edit)?Number(m[2]):columnNumber(m[2]),isRow(edit)?Number(m[4]):columnNumber(m[4]),edit);
  return moved?`${m[1]}${isRow(edit)?moved[0]:columnName(moved[0])}:${m[3]}${isRow(edit)?moved[1]:columnName(moved[1])}`:null;
}

const referencePattern=/(^|[^\w.\]])((?:'(?:[^']|'')+'|(?:\[[^\]]+\])?[\w.\u0080-\uFFFF]+)!)?(\$?[A-Z]{1,3}\$?[1-9]\d*(?::\$?[A-Z]{1,3}\$?[1-9]\d*)?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3}|\$?[1-9]\d*:\$?[1-9]\d*)(?![\w.[(])/gi;
export function shiftLayoutFormula(formula:string,edit:AxisEdit,changedSheet:string,currentSheet:string):string {
  return formula.split(/("(?:[^"]|"")*")/g).map((part,i)=>i%2?part:part.replace(referencePattern,(all,prefix:string,qualifier:string|undefined,ref:string,offset:number)=>{
    const before=part.slice(0,offset+prefix.length);
    if(before.lastIndexOf('[')>before.lastIndexOf(']'))return all;
    const name=qualifier?.slice(0,-1).replace(/^'|'$/g,'').replace(/''/g,"'");
    if(name?.includes('[')||(name!==undefined?name!==changedSheet:currentSheet!==changedSheet))return all;
    const shifted=shiftLayoutRange(ref,edit);
    return `${prefix}${qualifier||''}${shifted||'#REF!'}`;
  })).join('');
}
function moveFormula(formula:string,edit:Extract<LayoutEdit,{kind:'moveRange'}>,changedSheet:string,currentSheet:string):string {
  return formula.split(/("(?:[^"]|"")*")/g).map((part,i)=>i%2?part:part.replace(referencePattern,(all,prefix:string,qualifier:string|undefined,ref:string,offset:number)=>{
    const before=part.slice(0,offset+prefix.length);
    if(before.lastIndexOf('[')>before.lastIndexOf(']'))return all;
    const name=qualifier?.slice(0,-1).replace(/^'|'$/g,'').replace(/''/g,"'");
    if(name?.includes('[')||(name!==undefined?name!==changedSheet:currentSheet!==changedSheet)||!/[A-Z]\$?\d/i.test(ref))return all;
    const from=editBounds(edit.range),parts=ref.split(':'),clean=parts.map(p=>p.replace(/\$/g,''));
    if(!clean.every(p=>includes(from,p)))return all;
    const to=editBounds(edit.to).start,dr=to.row-from.start.row,dc=to.col-from.start.col;
    const shifted=parts.map(p=>{const m=/^(\$?)([A-Z]+)(\$?)(\d+)$/i.exec(p)!;return `${m[1]}${columnName(columnNumber(m[2])+dc)}${m[3]}${Number(m[4])+dr}`;}).join(':');
    return `${prefix}${qualifier||''}${shifted}`;
  })).join('');
}

function expandSharedFormulas(doc:Document) {
  const groups=new Map<string,{address:string;formula:string}>();
  for(const c of elements(doc,'c')){const f=elements(c,'f')[0];if(f?.getAttribute('t')==='shared'&&f.textContent)groups.set(f.getAttribute('si')!,{address:c.getAttribute('r')!,formula:f.textContent});}
  for(const c of elements(doc,'c')){const f=elements(c,'f')[0];if(f?.getAttribute('t')!=='shared')continue;
    const master=groups.get(f.getAttribute('si')!);if(!master)throw new Error('공유 수식의 기준 칸을 찾지 못했습니다.');
    const a=editBounds(master.address).start,b=editBounds(c.getAttribute('r')!).start;
    f.textContent=translateFormula(master.formula,b.row-a.row,b.col-a.col);['t','si','ref'].forEach(attr=>f.removeAttribute(attr));
  }
}
function refreshDimension(doc:Document) {
  let row=1,col=1;
  for(const c of elements(doc,'c')){const b=editBounds(c.getAttribute('r')!).start;row=Math.max(row,b.row);col=Math.max(col,b.col);}
  for(const m of elements(doc,'mergeCell')){const b=editBounds(m.getAttribute('ref')!).end;row=Math.max(row,b.row);col=Math.max(col,b.col);}
  elements(doc,'dimension')[0]?.setAttribute('ref',`A1:${columnName(col)}${row}`);
}
function shiftSheet(doc:Document,edit:AxisEdit) {
  for(const c of elements(doc,'c')){const next=shiftLayoutRange(c.getAttribute('r')!,edit);if(next){editBounds(next);c.setAttribute('r',next);}else c.remove();}
  if(isRow(edit))for(const row of elements(doc,'row')){const next=point(Number(row.getAttribute('r')),edit);if(next===null)row.remove();else row.setAttribute('r',String(next));}
  for(const row of elements(doc,'row'))row.removeAttribute('spans');
  for(const pane of elements(doc,'pane'))if(['frozen','frozenSplit'].includes(pane.getAttribute('state')||'')){
    const attr=isRow(edit)?'ySplit':'xSplit',split=Number(pane.getAttribute(attr));
    if(split)pane.setAttribute(attr,String(Math.max(0,(point(split+1,edit)??edit.at)-1)));
  }
  if(!isRow(edit))for(const col of elements(doc,'col')){const next=interval(Number(col.getAttribute('min')),Number(col.getAttribute('max')),edit);if(!next)col.remove();else{col.setAttribute('min',String(next[0]));col.setAttribute('max',String(next[1]));}}
  for(const el of Array.from(doc.getElementsByTagName('*'))){
    if(el.localName==='c')continue;
    for(const attr of ['ref','sqref','activeCell','topLeftCell']){
      if(!el.hasAttribute(attr))continue;
      const next=el.getAttribute(attr)!.split(/\s+/).map(range=>shiftLayoutRange(range,edit)).filter(Boolean).join(' ');
      if(next)el.setAttribute(attr,next);else if(['mergeCell','dataValidation','conditionalFormatting','hyperlink','autoFilter'].includes(el.localName))el.remove();else el.removeAttribute(attr);
    }
  }
  for(const container of ['mergeCells','dataValidations']){const el=elements(doc,container)[0];if(el)el.setAttribute('count',String(el.children.length));}
  const breaks=elements(doc,isRow(edit)?'rowBreaks':'colBreaks')[0];
  if(breaks){for(const brk of elements(breaks,'brk')){const n=point(Number(brk.getAttribute('id'))+1,edit);if(n===null)brk.remove();else brk.setAttribute('id',String(n-1));}breaks.setAttribute('count',String(breaks.children.length));breaks.setAttribute('manualBreakCount',String(breaks.children.length));}
  refreshDimension(doc);
}

function includes(range:ReturnType<typeof editBounds>,address:string){const p=editBounds(address).start;return p.row>=range.start.row&&p.row<=range.end.row&&p.col>=range.start.col&&p.col<=range.end.col;}
function rewriteRange(doc:Document,edit:Extract<LayoutEdit,{range:string}>) {
  const source=editBounds(edit.range),cells=elements(doc,'c').filter(c=>includes(source,c.getAttribute('r')!));
  for(const f of elements(doc,'f').filter(f=>['array','dataTable'].includes(f.getAttribute('t')||''))){const ref=f.getAttribute('ref');if(!ref)continue;const b=editBounds(ref.replace(/\$/g,''));if(b.start.row<=source.end.row&&b.end.row>=source.start.row&&b.start.col<=source.end.col&&b.end.col>=source.start.col&&(!includes(source,`${columnName(b.start.col)}${b.start.row}`)||!includes(source,`${columnName(b.end.col)}${b.end.row}`)))throw new Error('배열 수식 범위 전체를 포함해 이동·복사·비워 주세요.');}
  if(edit.kind==='clearRange'){for(const c of cells){for(const child of Array.from(c.children))if(['v','f','is'].includes(child.localName))child.remove();c.removeAttribute('t');}return;}
  const to=editBounds(edit.to).start,dr=to.row-source.start.row,dc=to.col-source.start.col;
  const destination=`${edit.to}:${columnName(source.end.col+dc)}${source.end.row+dr}`;editBounds(destination);
  const snapshots=cells.map(c=>c.cloneNode(true) as Element);
  const merges=elements(doc,'mergeCell').filter(m=>{const ref=m.getAttribute('ref')!,b=editBounds(ref);const intersects=b.start.row<=source.end.row&&b.end.row>=source.start.row&&b.start.col<=source.end.col&&b.end.col>=source.start.col;if(intersects&&(!includes(source,ref.split(':')[0])||!includes(source,ref.split(':')[1]||ref)))throw new Error('이동·복사할 범위에 병합 셀 전체를 포함해 주세요.');return intersects;});
  const dest=editBounds(destination);
  for(const m of elements(doc,'mergeCell')){if(merges.includes(m)&&edit.kind==='moveRange')continue;const ref=m.getAttribute('ref')!,b=editBounds(ref);if(b.start.row<=dest.end.row&&b.end.row>=dest.start.row&&b.start.col<=dest.end.col&&b.end.col>=dest.start.col){if(!includes(dest,ref.split(':')[0])||!includes(dest,ref.split(':')[1]||ref))throw new Error('붙여넣을 범위에 병합 셀 전체를 포함해 주세요.');m.remove();}}
  if(edit.kind==='moveRange')cells.forEach(c=>c.remove());
  elements(doc,'c').filter(c=>includes(dest,c.getAttribute('r')!)).forEach(c=>c.remove());
  for(const c of snapshots){const from=editBounds(c.getAttribute('r')!).start,address=`${columnName(from.col+dc)}${from.row+dr}`;c.setAttribute('r',address);const f=elements(c,'f')[0];if(f){if(edit.kind==='copyRange')f.textContent=translateFormula(f.textContent||'',dr,dc);if(f.hasAttribute('ref'))f.setAttribute('ref',f.getAttribute('ref')!.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g,(_,fc,col,fr,row)=>`${fc}${columnName(columnNumber(col)+dc)}${fr}${Number(row)+dr}`));}let row=elements(doc,'row').find(r=>r.getAttribute('r')===String(from.row+dr));if(!row){row=doc.createElementNS(doc.documentElement.namespaceURI,'row');row.setAttribute('r',String(from.row+dr));const data=elements(doc,'sheetData')[0];data.insertBefore(row,elements(data,'row').find(r=>Number(r.getAttribute('r'))>from.row+dr)||null);}row.appendChild(c);}
  const mergeContainer=elements(doc,'mergeCells')[0];
  for(const m of merges){const copy=m.cloneNode(true) as Element;const b=editBounds(m.getAttribute('ref')!);copy.setAttribute('ref',`${columnName(b.start.col+dc)}${b.start.row+dr}:${columnName(b.end.col+dc)}${b.end.row+dr}`);if(edit.kind==='moveRange')m.remove();mergeContainer!.appendChild(copy);}
  if(mergeContainer)mergeContainer.setAttribute('count',String(mergeContainer.children.length));
  for(const row of elements(doc,'row'))elements(row,'c').sort((a,b)=>columnNumber(a.getAttribute('r')!.replace(/\d/g,''))-columnNumber(b.getAttribute('r')!.replace(/\d/g,''))).forEach(c=>row.appendChild(c));
  refreshDimension(doc);
}

/** Produce a new template; never mutate the supplied workbook or its ZIP. */
export async function editWorkbookLayout(file:WorkbookFile,sheetName:string,raw:LayoutEdit[]):Promise<WorkbookFile> {
  if(!raw.length)return file;
  const edits=raw.map(e=>layoutEditSchema.parse(e)),sheet=file.sheets.find(s=>s.name===sheetName);
  if(!sheet)throw new Error('편집할 양식의 시트를 찾을 수 없습니다.');
  const zip=await JSZip.loadAsync(file.bytes),workbook=xml(await zip.file('xl/workbook.xml')!.async('string'));
  const docs=new Map<string,Document>();
  for(const s of file.sheets){const doc=xml(await zip.file(s.path)!.async('string'));expandSharedFormulas(doc);docs.set(s.name,doc);}
  const doc=docs.get(sheetName)!;
  if(elements(doc,'pivotTableParts').length)throw new Error('피벗 테이블의 구조는 Excel에서 변경해 주세요. 일반 입력표의 행·열·범위는 이 화면에서 편집할 수 있습니다.');
  for(const edit of edits){
    if(!isAxis(edit)){
      rewriteRange(doc,edit);
      if(edit.kind==='moveRange'){
        for(const s of file.sheets)for(const name of ['f','formula','formula1','formula2'])for(const f of elements(docs.get(s.name)!,name))f.textContent=moveFormula(f.textContent||'',edit,sheetName,s.name);
        for(const name of elements(workbook,'definedName'))name.textContent=moveFormula(name.textContent||'',edit,sheetName,name.getAttribute('localSheetId')===String(file.sheets.indexOf(sheet))?sheetName:'');
      }
      continue;
    }
    for(const s of file.sheets){const other=docs.get(s.name)!;for(const name of ['f','formula','formula1','formula2'])for(const f of elements(other,name))f.textContent=shiftLayoutFormula(f.textContent||'',edit,sheetName,s.name);}
    const local=String(file.sheets.indexOf(sheet));
    for(const name of elements(workbook,'definedName'))name.textContent=shiftLayoutFormula(name.textContent||'',edit,sheetName,name.getAttribute('localSheetId')===local?sheetName:'');
    shiftSheet(doc,edit);
    const relPath=sheet.path.replace(/([^/]+)$/,'_rels/$1.rels'),entry=zip.file(relPath);
    if(entry){const rels=xml(await entry.async('string'));for(const rel of elements(rels,'Relationship')){
      if(rel.getAttribute('TargetMode')==='External')continue;
      const path=normalizeZipPath(sheet.path,rel.getAttribute('Target')||''),part=zip.file(path);if(!part)continue;
      const type=rel.getAttribute('Type')||'';
      if(type.endsWith('/drawing')){const drawing=xml(await part.async('string'));for(const anchor of [...elements(drawing,'from'),...elements(drawing,'to')]){const axis=elements(anchor,isRow(edit)?'row':'col')[0];if(axis)axis.textContent=String(Math.max(0,(point(Number(axis.textContent)+1,edit)??edit.at)-1));}zip.file(path,serializeXml(drawing));}
      if(type.endsWith('/comments')){const comments=xml(await part.async('string'));for(const comment of elements(comments,'comment')){const next=shiftLayoutRange(comment.getAttribute('ref')!,edit);if(next)comment.setAttribute('ref',next);else comment.remove();}zip.file(path,serializeXml(comments));}
      if(type.endsWith('/table')){const table=xml(await part.async('string'));const tableRef=table.documentElement.getAttribute('ref')!,bounds=editBounds(tableRef);
        if(!isRow(edit)&&edit.at<=bounds.end.col&&edit.at+ (isDelete(edit)?edit.count-1:0)>=bounds.start.col)throw new Error('Excel 표의 열 변경은 표를 일반 셀 범위로 바꾼 사본에서 적용해 주세요. 다른 변경과 원본 파일은 유지됩니다.');
        for(const el of Array.from(table.getElementsByTagName('*')))if(el.hasAttribute('ref')){const next=shiftLayoutRange(el.getAttribute('ref')!,edit);if(!next)throw new Error('Excel 표 전체를 지우는 요청입니다. 표를 일반 셀 범위로 바꾼 뒤 다시 요청해 주세요.');el.setAttribute('ref',next);}zip.file(path,serializeXml(table));}
    }}
  }
  for(const s of file.sheets)zip.file(s.path,serializeXml(docs.get(s.name)!));
  // Cached dependency order no longer describes the modified cell addresses.
  zip.remove('xl/calcChain.xml');
  for(const [path,tag,attribute,value] of [['xl/_rels/workbook.xml.rels','Relationship','Type','/calcChain'],['[Content_Types].xml','Override','PartName','/xl/calcChain.xml']]){
    const entry=zip.file(path);if(!entry)continue;const part=xml(await entry.async('string'));
    elements(part,tag).filter(e=>(e.getAttribute(attribute)||'').endsWith(value)).forEach(e=>e.remove());zip.file(path,serializeXml(part));
  }
  const calc=elements(workbook,'calcPr')[0];if(calc){calc.setAttribute('fullCalcOnLoad','1');calc.setAttribute('forceFullCalc','1');}
  zip.file('xl/workbook.xml',serializeXml(workbook));
  return readWorkbook(await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'}),file.name,file.id);
}

/** Keep earlier appearance requests at their new coordinates when the template changes. */
export function movePlanEdits(plan:ConversionPlan,edits:LayoutEdit[]):Pick<ConversionPlan,'edits'|'formulaEdits'|'macroEdits'> {
  const anchor=(value:{recordKey:string;mappingKey:string;address:string}|undefined)=>value?{...value,address:moveLayoutAddress(value.address,edits)||value.address,mappingKey:moveMappingKey(value.mappingKey,edits)}:undefined;
  return {edits:plan.edits.flatMap<ConversionPlan['edits'][number]>(edit=>{if(edit.kind==='page')return[edit];const range=moveLayoutAddress(edit.range,edits);return range?[{...edit,range,...(edit.kind==='style'?{anchor:anchor(edit.anchor)}:{})}]:[];}),
    formulaEdits:plan.formulaEdits.flatMap(edit=>{const range=moveLayoutAddress(edit.range,edits);return range?[{...edit,range,anchor:anchor(edit.anchor),formula:edits.reduce((formula,e)=>isAxis(e)?shiftLayoutFormula(formula,e,plan.sheetName,plan.sheetName):e.kind==='moveRange'?moveFormula(formula,e,plan.sheetName,plan.sheetName):formula,edit.formula)}]:[];}),macroEdits:plan.macroEdits};
}

export function moveLayoutAddress(range:string,edits:LayoutEdit[]):string|null {
  let next:string|null=range;
  for(const edit of edits){if(!next)break;if(isAxis(edit)){next=shiftLayoutRange(next,edit);continue;}
    if(edit.kind==='moveRange'){const from=editBounds(edit.range),b=editBounds(next),to=editBounds(edit.to).start;if(includes(from,next.split(':')[0])&&includes(from,next.split(':')[1]||next)){const dr=to.row-from.start.row,dc=to.col-from.start.col;next=`${columnName(b.start.col+dc)}${b.start.row+dr}${next.includes(':')?`:${columnName(b.end.col+dc)}${b.end.row+dr}`:''}`;}}
  }
  return next;
}
function retainedValueAddress(address:string,edits:LayoutEdit[]):string|null {
  let next:string|null=address;
  for(const edit of edits){if(!next)return null;if(edit.kind==='clearRange'&&includes(editBounds(edit.range),next))return null;next=moveLayoutAddress(next,[edit]);}
  return next;
}
function moveMappingKey(key:string,edits:LayoutEdit[]):string {
  if(key.startsWith('fixed:'))return `fixed:${moveLayoutAddress(key.slice(6),edits)||key.slice(6)}`;
  if(!key.startsWith('column:'))return key;
  let col=Number(key.split(':')[1]);for(const edit of edits)if(isAxis(edit)&&!isRow(edit))col=point(col,edit)??col;
  return `column:${col}:${key.split(':')[2]}`;
}
function rebaseMappingKey(key:string,previous:ConversionPlan,next:ConversionPlan,edits:LayoutEdit[]):string {
  if(!key.startsWith('column:'))return moveMappingKey(key,edits);
  const [,col,offset]=key.split(':');
  const old=previous.mappings.find(m=>m.targetColumn===Number(col)&&(m.rowOffset||0)===Number(offset));
  const matches=old?next.mappings.filter(m=>m.label===old.label&&JSON.stringify(m.sourceKeys)===JSON.stringify(old.sourceKeys)):[];
  return matches.length===1?`column:${matches[0].targetColumn}:${matches[0].rowOffset||0}`:moveMappingKey(key,edits);
}
export function rebaseLayoutPlan(previous:ConversionPlan,next:ConversionPlan,edits:LayoutEdit[]):ConversionPlan {
  const mappings=next.mappings.map(mapping=>{const old=previous.mappings.find(m=>m.label===mapping.label&&JSON.stringify(m.sourceKeys)===JSON.stringify(mapping.sourceKeys));return old?{...old,targetColumn:mapping.targetColumn,rowOffset:mapping.rowOffset}:mapping;});
  const fixedCells=[...next.fixedCells];
  for(const fixed of previous.fixedCells){const address=retainedValueAddress(fixed.address,edits);if(!address)continue;
    const index=fixedCells.findIndex(f=>f.address===address);
    const moved={address,mapping:{...fixed.mapping,targetColumn:editBounds(address).start.col}};
    if(index>=0)fixedCells[index]=moved;else fixedCells.push(moved);
  }
  const overrides=previous.overrides.flatMap<ConversionPlan['overrides'][number]>(override=>{
    if(override.fixedAddress){const fixedAddress=moveLayoutAddress(override.fixedAddress,edits);return fixedAddress&&fixedCells.some(f=>f.address===fixedAddress)?[{...override,fixedAddress,targetColumn:columnNumber(fixedAddress.replace(/\d/g,''))}]:[];}
    const old=previous.mappings.find(m=>m.targetColumn===override.targetColumn&&(m.rowOffset||0)===(override.rowOffset||0));
    const mapping=old&&mappings.find(m=>m.label===old.label&&JSON.stringify(m.sourceKeys)===JSON.stringify(old.sourceKeys));
    return mapping?[{...override,targetColumn:mapping.targetColumn,rowOffset:mapping.rowOffset}]:[];
  });
  const appearance=movePlanEdits(previous,edits);
  for(const collection of [appearance.edits,appearance.formulaEdits])for(const edit of collection){
    if(!('anchor' in edit)||!edit.anchor)continue;
    const prior=[...previous.edits,...previous.formulaEdits].find(e=>'anchor' in e&&e.anchor&&moveLayoutAddress(e.range,edits)===('range' in edit?edit.range:'')&&e.anchor.recordKey===edit.anchor!.recordKey);
    if(prior&&'anchor' in prior&&prior.anchor)edit.anchor.mappingKey=rebaseMappingKey(prior.anchor.mappingKey,previous,{...next,mappings},edits);
  }
  return {...next,mappings,fixedCells,rules:previous.rules,overrides,...appearance};
}
export async function moveEditingVersion(version:ResultVersion|undefined,selection:CellSelection|undefined,plan:ConversionPlan,edits:LayoutEdit[]) {
  if(!version)return {version,selection:undefined};
  const outputs=[];
  for(const output of version.result.outputs){const file=await readWorkbook(output.bytes,output.name);const changed=await editWorkbookLayout(file,plan.sheetName,edits);outputs.push({...output,bytes:changed.bytes,sheets:changed.sheets,traces:output.traces.flatMap(trace=>{const address=trace.sheet===plan.sheetName?moveLayoutAddress(trace.address,edits):trace.address;return address?[{...trace,address,mappingKey:trace.mappingKey?rebaseMappingKey(trace.mappingKey,version.plan,plan,edits):undefined}]:[];})});}
  const address=selection&&moveLayoutAddress(selection.address,edits);
  return {version:{...version,plan,result:{...version.result,outputs}},selection:selection&&address?{...selection,address}:undefined};
}
