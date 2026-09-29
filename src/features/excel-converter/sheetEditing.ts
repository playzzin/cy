import { CellStyle, SheetEdit } from './editingTypes';
import { CellTrace } from './types';
import { columnName, columnNumber, elements } from './workbook';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const node = (doc:Document,name:string,attrs:Record<string,string>={}) => {const el=doc.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));return el;};
export function editBounds(range:string) {
  const parse=(a:string)=>{const m=/^([A-Z]+)(\d+)$/.exec(a);if(!m)throw new Error('수정할 셀 범위를 확인해 주세요.');return {col:columnNumber(m[1]),row:Number(m[2])};};
  const [a,b=a]=range.split(':'),start=parse(a),end=parse(b);
  if(start.col<1||end.col>100||start.row<1||end.row>30000||start.col>end.col||start.row>end.row||(end.row-start.row+1)*(end.col-start.col+1)>30000)throw new Error('수정 범위는 100열·30,000칸 이내로 지정해 주세요.');
  return {start,end};
}
const inside=(a:{row:number;col:number},b:ReturnType<typeof editBounds>)=>a.row>=b.start.row&&a.row<=b.end.row&&a.col>=b.start.col&&a.col<=b.end.col;
const overlaps=(a:ReturnType<typeof editBounds>,b:ReturnType<typeof editBounds>)=>a.start.row<=b.end.row&&a.end.row>=b.start.row&&a.start.col<=b.end.col&&a.end.col>=b.start.col;
const indexes=new WeakMap<Document,{rows:Map<number,Element>;cells:Map<string,Element>}>();
function index(doc:Document){let found=indexes.get(doc);if(!found){found={rows:new Map(elements(doc,'row').map(r=>[Number(r.getAttribute('r')),r])),cells:new Map(elements(doc,'c').map(c=>[c.getAttribute('r')!,c]))};indexes.set(doc,found);}return found;}
function rowNode(doc:Document,r:number) {
  const data=elements(doc,'sheetData')[0],cache=index(doc);let row=cache.rows.get(r);
  if(!row){row=node(doc,'row',{r:String(r)});data.insertBefore(row,elements(data,'row').find(n=>Number(n.getAttribute('r'))>r)||null);cache.rows.set(r,row);}return row;
}
export function cellNode(doc:Document,r:number,c:number) {
  const cache=index(doc),address=`${columnName(c)}${r}`;let cell=cache.cells.get(address);
  if(!cell){const row=rowNode(doc,r);cell=node(doc,'c',{r:address});row.insertBefore(cell,elements(row,'c').find(n=>columnNumber((n.getAttribute('r')||'').replace(/\d/g,''))>c)||null);cache.cells.set(address,cell);}return cell;
}
const ORDER=['sheetPr','dimension','sheetViews','sheetFormatPr','cols','sheetData','sheetCalcPr','sheetProtection','protectedRanges','scenarios','autoFilter','sortState','dataConsolidate','customSheetViews','mergeCells','phoneticPr','conditionalFormatting','dataValidations','hyperlinks','printOptions','pageMargins','pageSetup','headerFooter','rowBreaks','colBreaks','customProperties','cellWatches','ignoredErrors','smartTags','drawing','legacyDrawing','legacyDrawingHF','picture','oleObjects','controls','webPublishItems','tableParts','extLst'];
function sheetNode(doc:Document,name:string) {
  let found=Array.from(doc.documentElement.children).find(c=>c.localName===name);
  if(!found){found=node(doc,name);doc.documentElement.insertBefore(found,Array.from(doc.documentElement.children).find(c=>ORDER.indexOf(c.localName)>ORDER.indexOf(name))||null);}return found;
}
function collection(styles:Document,name:string) {
  let parent=elements(styles,name)[0];
  if(!parent){parent=node(styles,name,{count:'0'});const order=['numFmts','fonts','fills','borders','cellStyleXfs','cellXfs','cellStyles','dxfs','tableStyles','colors','extLst'];styles.documentElement.insertBefore(parent,Array.from(styles.documentElement.children).find(c=>order.indexOf(c.localName)>order.indexOf(name))||null);}return parent;
}
function intern(parent:Element,entry:Element) {
  const serialize=(n:Element)=>new XMLSerializer().serializeToString(n);
  const serialized=serialize(entry),children=Array.from(parent.children),existing=children.findIndex(n=>serialize(n)===serialized);
  if(existing>=0)return existing;parent.appendChild(entry);parent.setAttribute('count',String(parent.children.length));return parent.children.length-1;
}
function replaceChild(parent:Element,name:string,attrs?:Record<string,string>) {
  Array.from(parent.children).filter(n=>n.localName===name).forEach(n=>parent.removeChild(n));
  if(attrs)parent.appendChild(node(parent.ownerDocument,name,attrs));
}
function styleId(styles:Document,baseId:number,patch:CellStyle,cache:Map<string,number>):number {
  const key=JSON.stringify([baseId,patch]);if(cache.has(key))return cache.get(key)!;
  const xfs=collection(styles,'cellXfs'),base=xfs.children[baseId]||xfs.children[0];
  const xf=(base?.cloneNode(true)||node(styles,'xf',{numFmtId:'0',fontId:'0',fillId:'0',borderId:'0',xfId:'0'})) as Element;
  if(['fontName','fontSize','bold','italic','underline','color'].some(k=>k in patch)){
    const fonts=collection(styles,'fonts'),font=(fonts.children[Number(xf.getAttribute('fontId')||0)]?.cloneNode(true)||node(styles,'font')) as Element;
    for(const [key,tag] of [['fontName','name'],['fontSize','sz'],['bold','b'],['italic','i'],['underline','u'],['color','color']] as const){
      const value=patch[key];if(value===undefined)continue;
      replaceChild(font,tag,value===false?undefined:key==='color'?{rgb:'FF'+String(value).slice(1)}:{val:value===true?'1':String(value)});
      if(key==='fontName')replaceChild(font,'scheme');
      if(key==='underline'&&value===true)elements(font,'u')[0].setAttribute('val','single');
    }
    xf.setAttribute('fontId',String(intern(fonts,font)));xf.setAttribute('applyFont','1');
  }
  if(patch.background){const fill=node(styles,'fill'),pattern=node(styles,'patternFill',{patternType:'solid'});pattern.appendChild(node(styles,'fgColor',{rgb:'FF'+patch.background.slice(1)}));pattern.appendChild(node(styles,'bgColor',{indexed:'64'}));fill.appendChild(pattern);xf.setAttribute('fillId',String(intern(collection(styles,'fills'),fill)));xf.setAttribute('applyFill','1');}
  if(patch.border!==undefined||patch.borderColor){
    const borders=collection(styles,'borders'),border=(borders.children[Number(xf.getAttribute('borderId')||0)]?.cloneNode(true)||node(styles,'border')) as Element;
    for(const side of ['left','right','top','bottom']){let edge=elements(border,side)[0];if(!edge){edge=node(styles,side);border.appendChild(edge);}if(patch.border==='none'){edge.removeAttribute('style');replaceChild(edge,'color');}else{if(patch.border)edge.setAttribute('style',patch.border);if(patch.borderColor)replaceChild(edge,'color',{rgb:'FF'+patch.borderColor.slice(1)});}}
    xf.setAttribute('borderId',String(intern(borders,border)));xf.setAttribute('applyBorder','1');
  }
  if(patch.align||patch.vertical||patch.wrap!==undefined){let align=elements(xf,'alignment')[0];if(!align){align=node(styles,'alignment');xf.insertBefore(align,elements(xf,'protection')[0]||null);}if(patch.align)align.setAttribute('horizontal',patch.align);if(patch.vertical)align.setAttribute('vertical',patch.vertical);if(patch.wrap!==undefined)align.setAttribute('wrapText',patch.wrap?'1':'0');xf.setAttribute('applyAlignment','1');}
  if(patch.numberFormat){const formats=collection(styles,'numFmts');let format=Array.from(formats.children).find(n=>n.getAttribute('formatCode')===patch.numberFormat);if(!format){const id=Math.max(163,...Array.from(formats.children).map(n=>Number(n.getAttribute('numFmtId'))))+1;format=node(styles,'numFmt',{numFmtId:String(id),formatCode:patch.numberFormat});formats.appendChild(format);formats.setAttribute('count',String(formats.children.length));}xf.setAttribute('numFmtId',format.getAttribute('numFmtId')!);xf.setAttribute('applyNumberFormat','1');}
  const id=intern(xfs,xf);if(id>4095)throw new Error('서식 종류가 너무 많습니다. 이전 결과에서 새로 편집해 주세요.');cache.set(key,id);return id;
}

/** Apply explicit appearance edits only; this function cannot write values or formulas. */
export function applySheetEdits(doc:Document,styles:Document,edits:SheetEdit[],traces:CellTrace[]=[],layoutOnly=false) {
  if(!edits.length)return;
  const cache=new Map<string,number>();let visited=0;
  for(const edit of edits){
    if(edit.kind==='page'){
      const setup=sheetNode(doc,'pageSetup');if(edit.orientation)setup.setAttribute('orientation',edit.orientation);if(edit.paper)setup.setAttribute('paperSize',({A4:'9',A3:'8',letter:'1'})[edit.paper]);
      if(edit.fitWidth!==undefined||edit.fitHeight!==undefined){const pr=sheetNode(doc,'sheetPr');let fit=elements(pr,'pageSetUpPr')[0];if(!fit){fit=node(doc,'pageSetUpPr');pr.appendChild(fit);}fit.setAttribute('fitToPage','1');setup.removeAttribute('scale');if(edit.fitWidth!==undefined)setup.setAttribute('fitToWidth',String(edit.fitWidth));if(edit.fitHeight!==undefined)setup.setAttribute('fitToHeight',String(edit.fitHeight));}continue;
    }
    if(edit.kind==='style'&&layoutOnly)continue;
    let b=editBounds(edit.range);
    if(edit.kind==='style'&&edit.anchor){const trace=traces.find(t=>t.recordKey===edit.anchor!.recordKey&&t.mappingKey===edit.anchor!.mappingKey);if(!trace)continue;const from=editBounds(edit.anchor.address).start,to=editBounds(trace.address).start;const dr=to.row-from.row,dc=to.col-from.col;b=editBounds(`${columnName(b.start.col+dc)}${b.start.row+dr}:${columnName(b.end.col+dc)}${b.end.row+dr}`);}
    if(edit.kind==='style'){
      visited+=(b.end.row-b.start.row+1)*(b.end.col-b.start.col+1);if(visited>150000)throw new Error('한 번에 바꾸는 서식 범위가 너무 큽니다. 나누어 요청해 주세요.');
      for(let r=b.start.row;r<=b.end.row;r++)for(let c=b.start.col;c<=b.end.col;c++){const cell=cellNode(doc,r,c);cell.setAttribute('s',String(styleId(styles,Number(cell.getAttribute('s')||0),edit.style,cache)));}
    }else if(edit.kind==='columns'){
      const cols=sheetNode(doc,'cols'),existing=elements(cols,'col');
      for(const col of existing){const min=Number(col.getAttribute('min')),max=Number(col.getAttribute('max'));if(max<b.start.col||min>b.end.col)continue;
        if(min<b.start.col){const left=col.cloneNode(true) as Element;left.setAttribute('max',String(b.start.col-1));cols.appendChild(left);}if(max>b.end.col){const right=col.cloneNode(true) as Element;right.setAttribute('min',String(b.end.col+1));cols.appendChild(right);}
        const changed=col.cloneNode(true) as Element;changed.setAttribute('min',String(Math.max(min,b.start.col)));changed.setAttribute('max',String(Math.min(max,b.end.col)));changed.setAttribute('width',String(edit.width));changed.setAttribute('customWidth','1');cols.appendChild(changed);cols.removeChild(col);
      }
      for(let c=b.start.col;c<=b.end.col;c++)if(!elements(cols,'col').some(n=>Number(n.getAttribute('min'))<=c&&Number(n.getAttribute('max'))>=c))cols.appendChild(node(doc,'col',{min:String(c),max:String(c),width:String(edit.width),customWidth:'1'}));
      elements(cols,'col').sort((a,b)=>Number(a.getAttribute('min'))-Number(b.getAttribute('min'))).forEach(n=>cols.appendChild(n));
    }else if(edit.kind==='rows'){
      for(let r=b.start.row;r<=b.end.row;r++){const row=rowNode(doc,r);row.setAttribute('ht',String(edit.height));row.setAttribute('customHeight','1');}
    }else{
      const merges=sheetNode(doc,'mergeCells'),intersecting=elements(merges,'mergeCell').filter(n=>overlaps(editBounds(n.getAttribute('ref')!),b));
      if(intersecting.some(n=>{const old=editBounds(n.getAttribute('ref')!);return !inside(old.start,b)||!inside(old.end,b);}))throw new Error('기존 병합 셀 전체가 포함되도록 범위를 지정해 주세요.');
      if(edit.kind==='merge'){
        const occupied=elements(doc,'c').filter(c=>inside(editBounds(c.getAttribute('r')!).start,b)&&(elements(c,'f').length||elements(c,'v').length||elements(c,'t').some(t=>!!t.textContent)));
        if(occupied.some(c=>c.getAttribute('r')!==`${columnName(b.start.col)}${b.start.row}`))throw new Error('병합하면 내용이 가려지는 칸이 있습니다. 내용을 옮기거나 빈 범위를 지정해 주세요.');
      }
      intersecting.forEach(n=>merges.removeChild(n));if(edit.kind==='merge'&&(b.start.row!==b.end.row||b.start.col!==b.end.col))merges.appendChild(node(doc,'mergeCell',{ref:edit.range}));
      merges.setAttribute('count',String(merges.children.length));if(!merges.children.length)merges.parentNode!.removeChild(merges);
    }
  }
  if(!layoutOnly){const extent=elements(doc,'c').reduce((size,c)=>{const a=editBounds(c.getAttribute('r')!).start;return {row:Math.max(size.row,a.row),col:Math.max(size.col,a.col)};},{row:1,col:1});const dim=elements(doc,'dimension')[0];if(dim)dim.setAttribute('ref',`A1:${columnName(extent.col)}${extent.row}`);}
}
