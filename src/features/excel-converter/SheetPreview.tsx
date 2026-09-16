import React, { useMemo, useState } from 'react';
import { CellTrace, SheetInfo } from './types';
import { columnName } from './workbook';

export default function SheetPreview({ sheet, traces = [], onSelect }: { sheet?: SheetInfo; traces?: CellTrace[]; onSelect?: (trace: CellTrace) => void }) {
  const [page, setPage] = useState(0);
  const cells = useMemo(() => new Map(sheet?.cells.map(c => [c.address, c])), [sheet]);
  const traceMap = useMemo(() => new Map(traces.filter(t => t.sheet === sheet?.name).map(t => [t.address, t])), [sheet, traces]);
  if (!sheet) return <div className="xc-empty"><span>파일을 올리면 여기에 표시됩니다.</span><small>원본 데이터와 상대 회사 양식을 함께 확인하세요.</small></div>;
  const pages = Math.max(1, Math.ceil(sheet.rowCount / 25)); const activePage = Math.min(page, pages - 1); const start = activePage * 25 + 1; const columns = Math.min(100, Math.max(1, sheet.columnCount));
  return <div className="xc-preview"><div className="xc-preview-caption"><strong>{sheet.name}</strong><span>{sheet.rowCount}행 · {sheet.columnCount}열</span></div><div className="xc-grid-scroll"><table className="xc-sheet"><thead><tr><th aria-label="행 번호" />{Array.from({ length: columns }, (_, i) => <th key={i}>{columnName(i + 1)}</th>)}</tr></thead><tbody>{Array.from({ length: Math.min(25, sheet.rowCount - start + 1) }, (_, i) => start + i).map(row => <tr key={row} className={row === sheet.headerRow ? 'xc-sheet-header' : ''}><th>{row}</th>{Array.from({ length: columns }, (_, i) => { const address = `${columnName(i + 1)}${row}`; const cell = cells.get(address); const trace = traceMap.get(address); return <td key={address} className={`${cell?.kind === 'number' ? 'xc-number' : ''} ${trace ? 'xc-written' : ''}`} title={`${address}${cell?.formula ? ` =${cell.formula}` : ''}${trace ? ' · 클릭하여 원본 확인' : ''}`}>{trace && onSelect ? <button onClick={() => onSelect(trace)} aria-label={`${sheet.name} ${address} 원본 확인`}>{cell?.text || '빈칸'}</button> : cell?.text || (cell?.formula ? '재계산 필요' : '')}</td>; })}</tr>)}</tbody></table></div><div className="xc-preview-footer"><span>셀 값 미리보기 · 실제 파일의 서식과 병합은 다운로드 파일에 보존됩니다.</span><div><button disabled={activePage === 0} onClick={() => setPage(activePage - 1)} aria-label="이전 행">‹</button><span>{activePage + 1} / {pages}</span><button disabled={activePage >= pages - 1} onClick={() => setPage(activePage + 1)} aria-label="다음 행">›</button></div></div></div>;
}
