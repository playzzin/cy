import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Maximize2, X } from 'lucide-react';
import { ConversionOutput, SheetInfo, WorkbookFile } from './types';
import { columnName, columnNumber } from './workbook';
import './workbookPreview.css';

type Stage = 'source' | 'target' | 'result';
export default function WorkbookPreview({ source, target, outputs = [] }: { source?: WorkbookFile; target?: WorkbookFile; outputs?: ConversionOutput[] }) {
  const [stage, setStage] = useState<Stage>(outputs.length ? 'result' : target ? 'target' : 'source');
  const [fileIndex, setFileIndex] = useState(0), [sheetIndex, setSheetIndex] = useState(0), [zoom, setZoom] = useState<number | 'fit'>(100);
  const dialog = useRef<HTMLDialogElement>(null); const [expanded, setExpanded] = useState(false);
  useEffect(() => { if(expanded) dialog.current?.showModal(); else if(dialog.current?.open) dialog.current.close(); }, [expanded]);
  useEffect(() => { setStage(outputs.length ? 'result' : target ? 'target' : 'source'); setFileIndex(0); setSheetIndex(0); }, [source?.id, target?.id, outputs.length]);
  const files = stage === 'result' ? outputs : stage === 'source' ? source ? [source] : [] : target ? [target] : [];
  const file = files[fileIndex] || files[0]; const sheet = file?.sheets[sheetIndex] || file?.sheets[0];
  const content = (expanded: boolean) => <>
    <div className="wp-toolbar"><div className="wp-tabs" role="tablist" aria-label="미리보기 종류">{([['source','원본'],['target','받을 양식'],['result','완성 결과']] as [Stage,string][]).map(([value,label]) => <button key={value} role="tab" aria-selected={stage === value} disabled={value === 'source' ? !source : value === 'target' ? !target : !outputs.length} onClick={() => { setStage(value); setFileIndex(0); setSheetIndex(0); }}>{label}</button>)}</div><div className="wp-controls">{files.length > 1 && <select aria-label="미리보기 문서 선택" value={fileIndex} onChange={e => {setFileIndex(Number(e.target.value));setSheetIndex(0);}}>{files.map((f,i) => <option key={f.name} value={i}>{i+1}. {f.name}</option>)}</select>}{!!file && file.sheets.length > 1 && <select aria-label="미리보기 시트 선택" value={sheetIndex} onChange={e => setSheetIndex(Number(e.target.value))}>{file.sheets.map((s,i) => <option key={s.name} value={i}>{s.name}</option>)}</select>}<select aria-label="미리보기 배율" value={zoom} onChange={e => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}><option value="fit">너비 맞춤</option>{[25,50,60,85,100,125,150,200].map(n => <option key={n} value={n}>{n}%</option>)}</select>{!expanded && <button onClick={() => setExpanded(true)}><Maximize2 size={14}/>크게 보기</button>}</div></div>
    <div className="wp-file-caption">{file?.name} · {sheet?.name}</div>
    <SheetViewport sheet={sheet} zoom={zoom} expanded={expanded} documentKey={`${stage}-${file?.name}-${sheet?.name}`}/>
    <p className="wp-note">병합·글자색·배경·열 너비를 반영한 미리보기입니다. 서명 이미지·도형·인쇄 배치는 Excel에서 확인해 주세요.</p>
  </>;
  return <section className="wp-panel" aria-label="문서 미리보기"><h2><Eye size={18}/>미리보기 <span>다운로드 전에 내용을 확인하세요</span></h2>{content(false)}<dialog ref={dialog} className="wp-dialog" onCancel={() => setExpanded(false)} aria-label="크게 보는 문서 미리보기"><div className="wp-dialog-heading"><strong>문서 미리보기</strong><button aria-label="큰 미리보기 닫기" onClick={() => setExpanded(false)}><X size={20}/></button></div>{expanded && content(true)}</dialog></section>;
}

function visibleColumns(sheet: SheetInfo) {
  return Array.from({length: Math.min(100, sheet.columnCount)}, (_, i) => i + 1).filter(c => !sheet.hiddenColumns.includes(c));
}

function SheetViewport({sheet, zoom, expanded, documentKey}: {sheet?: SheetInfo; zoom: number | 'fit'; expanded: boolean; documentKey: string}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      setAvailableWidth(element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Include the document's 20px padding and 1px border on both sides.
  const documentWidth = sheet ? visibleColumns(sheet).reduce((width, col) => width + (sheet.presentation?.widths[col] || 88), 42) : 42;
  const scale = zoom === 'fit' ? (availableWidth > 0 ? Math.min(1, availableWidth / documentWidth) : 1) : zoom / 100;
  return <div ref={viewport} className={`wp-paper-scroll ${expanded ? 'expanded' : ''}`}><div className="wp-zoom" style={{zoom: scale} as React.CSSProperties}>{sheet && <DocumentSheet key={documentKey} sheet={sheet}/>}</div></div>;
}

export function DocumentSheet({ sheet }: { sheet: SheetInfo }) {
  const [page, setPage] = useState(0); const pageSize = 60;
  const pages = Math.max(1, Math.ceil(sheet.rowCount / pageSize)); const current = Math.min(page, pages - 1); const start = current * pageSize + 1, end = Math.min(sheet.rowCount, start + pageSize - 1);
  const cells = useMemo(() => new Map(sheet.cells.map(c => [c.address,c])), [sheet]);
  const columns = visibleColumns(sheet);
  const rows = Array.from({length:Math.max(0,end-start+1)},(_,i) => start+i).filter(r => !sheet.hiddenRows.includes(r));
  const merged = useMemo(() => {
    const covered = new Set<string>(); const anchors = new Map<string,{origin:string;colSpan:number;rowSpan:number}>();
    for (const merge of sheet.merges) {
      const match = merge.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/); if(!match) continue;
      const c1=columnNumber(match[1]),r1=Number(match[2]),c2=columnNumber(match[3]),r2=Number(match[4]);
      const visibleCols=columns.filter(c=>c>=c1&&c<=c2),visibleRows=rows.filter(r=>r>=r1&&r<=r2); if(!visibleCols.length||!visibleRows.length)continue;
      for(const r of visibleRows)for(const c of visibleCols)covered.add(`${columnName(c)}${r}`);
      const anchor=`${columnName(visibleCols[0])}${visibleRows[0]}`;covered.delete(anchor);anchors.set(anchor,{origin:`${match[1]}${r1}`,colSpan:visibleCols.length,rowSpan:visibleRows.length});
    }
    return {covered,anchors};
  // The visible coordinates depend only on the selected sheet and page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sheet,current]);
  return <div className="wp-document"><table aria-label={`${sheet.name} 문서 내용`} style={{width:columns.reduce((n,c)=>n+(sheet.presentation?.widths[c]||88),0)}}><colgroup>{columns.map(c=><col key={c} style={{width:sheet.presentation?.widths[c]||88}}/>)}</colgroup><tbody>{rows.map(row=><tr key={row} style={{height:sheet.presentation?.heights[row]||28}}>{columns.map(col=>{
    const address=`${columnName(col)}${row}`;if(merged.covered.has(address))return null;const merge=merged.anchors.get(address);const cell=cells.get(merge?.origin||address);const style=sheet.presentation?.styles[cell?.style||0];
    const displayed=cell?.kind==='number'&&typeof cell.value==='number'?cell.value.toLocaleString('ko-KR',{maximumFractionDigits:8}):cell?.text|| (cell?.formula?'재계산 필요':'');
    return <td key={address} data-address={address} colSpan={merge?.colSpan} rowSpan={merge?.rowSpan} title={`${address}${cell?.formula?` · =${cell.formula}`:''}`} style={{color:style?.color,background:style?.background,fontWeight:style?.bold?700:400,fontSize:`${style?.fontSize||11}pt`,textAlign:style?.align||(cell?.kind==='number'?'right':'left'),border:style?.bordered?'1px solid #8491a3':'1px solid #eef0f4'}}>{displayed}</td>;
  })}</tr>)}</tbody></table>{pages>1 && <div className="wp-pagination"><button disabled={!current} onClick={()=>setPage(current-1)}>이전 60행</button><span>{start}~{end}행 / {sheet.rowCount}행</span><button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>다음 60행</button></div>}</div>;
}
