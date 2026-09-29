import { FormulaEdit } from './editingTypes';
import { CellTrace } from './types';
import { columnName, columnNumber, elements } from './workbook';
import { cellNode, editBounds } from './sheetEditing';

/** Translate references without touching quoted strings, sheet names or function names. */
export function translateFormula(formula:string,dr:number,dc:number):string {
  return formula.split(/("(?:[^"]|"")*"|'(?:[^']|'')*'|\[[^\]]*\])/g).map((part,i)=>i%2?part:part.replace(/(^|[^\w.])([$]?)([A-Z]{1,3})([$]?)([1-9]\d*)(?![\w.(!])/gi,(all,prefix:string,fc:string,col:string,fr:string,row:string)=>{
    const c=columnNumber(col.toUpperCase())+(fc?0:dc),r=Number(row)+(fr?0:dr);
    if(c<1||c>16384||r<1||r>1048576)throw new Error('수식의 상대 참조가 Excel 범위를 벗어납니다.');
    return `${prefix}${fc}${columnName(c)}${fr}${r}`;
  })).join('');
}
export function validateFormula(value:string):string {
  const formula=value.trim().replace(/^=/,'');
  if(!formula||formula.length>8192||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(formula))throw new Error('수식 내용을 확인해 주세요.'); // eslint-disable-line no-control-regex
  let quote='',depth=0;
  for(let i=0;i<formula.length;i++){
    const c=formula[i];
    if(quote){if(c===quote){if(formula[i+1]===quote)i++;else quote='';}continue;}
    if(c==='"'||c==="'")quote=c;
    else if(c==='(')depth++;
    else if(c===')'&&--depth<0)throw new Error('수식의 괄호가 맞지 않습니다.');
  }
  if(quote||depth)throw new Error('수식의 따옴표 또는 괄호가 닫히지 않았습니다.');
  // External connections and executable DDE are never introduced implicitly.
  const code=formula.replace(/"(?:[^"]|"")*"/g,'""');
  if(/\||(?:'(?:[^']|'')*\[[^\]]+\](?:[^']|'')*'|\[[^\]]+\][\w.\u0080-\uFFFF]*)!|\b(?:WEBSERVICE|RTD|CALL|REGISTER\.ID)\s*\(/i.test(code))throw new Error('외부 연결이나 프로그램 실행을 포함한 수식은 이 편집기에서 추가할 수 없습니다.');
  return formula;
}
export function resolveFormulaEdits(edits:FormulaEdit[],traces:CellTrace[]):Map<string,string> {
  const changes=new Map<string,string>();let visits=0;
  for(const edit of edits){
    const b=editBounds(edit.range);let dr=0,dc=0;
    if(edit.anchor){const trace=traces.find(t=>t.recordKey===edit.anchor!.recordKey&&t.mappingKey===edit.anchor!.mappingKey);if(!trace)continue;const a=editBounds(edit.anchor.address).start,to=editBounds(trace.address).start;dr=to.row-a.row;dc=to.col-a.col;}
    const formula=validateFormula(edit.formula);
    for(let r=b.start.row;r<=b.end.row;r++)for(let c=b.start.col;c<=b.end.col;c++){
      if(++visits>60000)throw new Error('한 번에 변경할 수식이 너무 많습니다. 범위를 나누어 주세요.');
      const address=`${columnName(c+dc)}${r+dr}`;editBounds(address);
      changes.set(address,translateFormula(formula,r-b.start.row+dr,c-b.start.col+dc));
    }
  }
  return changes;
}
/** Expand a touched shared group first, so unedited followers retain their formulas. */
export function applyFormulaEdits(doc:Document,edits:FormulaEdit[],traces:CellTrace[]=[]):Map<string,string> {
  const changes=resolveFormulaEdits(edits,traces);if(!changes.size)return changes;
  for(const merge of elements(doc,'mergeCell')){const range=merge.getAttribute('ref')!,b=editBounds(range),anchor=range.split(':')[0];
    for(const address of changes.keys()){const a=editBounds(address).start;if(address!==anchor&&a.row>=b.start.row&&a.row<=b.end.row&&a.col>=b.start.col&&a.col<=b.end.col){if(!changes.has(anchor))throw new Error('병합된 칸의 왼쪽 위 주소로 수식을 지정해 주세요.');changes.delete(address);}}
  }
  const formulas=elements(doc,'c').filter(c=>elements(c,'f').length);
  const touchedShared=new Set<string>();
  for(const cell of formulas){const f=elements(cell,'f')[0],address=cell.getAttribute('r')!;
    if(f.getAttribute('t')==='array'||f.getAttribute('t')==='dataTable'){
      const b=editBounds((f.getAttribute('ref')||address).replace(/\$/g,''));
      if([...changes.keys()].some(a=>{const p=editBounds(a).start;return p.row>=b.start.row&&p.row<=b.end.row&&p.col>=b.start.col&&p.col<=b.end.col;}))throw new Error('배열 수식이나 데이터 표는 Excel에서 범위 전체를 해제한 뒤 수정해 주세요.');
    }
    if(changes.has(address)&&f.getAttribute('t')==='shared')touchedShared.add(f.getAttribute('si')!);
  }
  for(const si of touchedShared){const group=formulas.filter(c=>elements(c,'f')[0].getAttribute('t')==='shared'&&elements(c,'f')[0].getAttribute('si')===si),master=group.find(c=>!!elements(c,'f')[0].textContent);
    if(!master)throw new Error('공유 수식의 기준 칸을 찾지 못했습니다.');
    const base=editBounds(master.getAttribute('r')!).start,source=elements(master,'f')[0].textContent!;
    for(const cell of group){const f=elements(cell,'f')[0],a=editBounds(cell.getAttribute('r')!).start;f.textContent=translateFormula(source,a.row-base.row,a.col-base.col);for(const attr of ['t','si','ref'])f.removeAttribute(attr);}
  }
  for(const [address,formula]of changes){const a=editBounds(address).start,cell=cellNode(doc,a.row,a.col);
    for(const child of Array.from(cell.children))if(['v','f','is'].includes(child.localName))cell.removeChild(child);
    cell.removeAttribute('t');const f=doc.createElementNS(cell.namespaceURI,'f');f.textContent=formula;cell.insertBefore(f,cell.firstChild);
  }
  const extent=elements(doc,'c').reduce((b,c)=>{const a=editBounds(c.getAttribute('r')!).start;return{row:Math.max(b.row,a.row),col:Math.max(b.col,a.col)};},{row:1,col:1});
  elements(doc,'dimension')[0]?.setAttribute('ref',`A1:${columnName(extent.col)}${extent.row}`);
  return changes;
}
