// Use the displayed cell values so the export includes the current filters and unsaved 공수.
// Drawing the sheet directly also keeps scroll offsets and cloned-page CSS out of the PNG.
export const renderDayLookupCanvas = (
  root: HTMLElement,
  getScale: (width: number, height: number) => number
): HTMLCanvasElement => {
  const table = root.querySelector('table');
  const header = table?.tHead?.rows[0];
  if (!table || !header || !table.tBodies[0]?.rows.length) {
    throw new Error('일자별조회 표를 찾을 수 없습니다.');
  }

  const widths = Array.from(header.cells, cell => cell.getBoundingClientRect().width);
  const width = widths.reduce((sum, cellWidth) => sum + cellWidth, 0);
  if (width <= 0) throw new Error('일자별조회 표의 너비를 확인할 수 없습니다.');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지 캔버스를 만들 수 없습니다.');

  const font = '14px "Malgun Gothic", sans-serif';
  const padding = 10;
  const lineHeight = 20;
  const wrap = (value: string, available: number): string[] => {
    const lines: string[] = [];
    for (const paragraph of value.split(/\r?\n/)) {
      if (ctx.measureText(paragraph).width <= available) {
        lines.push(paragraph);
        continue;
      }
      let line = '';
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > available) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
      lines.push(line);
    }
    return lines;
  };

  const rows = Array.from(table.rows, row => {
    const isHeader = row === header;
    ctx.font = isHeader ? `bold ${font}` : font;
    let column = 0;
    const cells = Array.from(row.cells, cell => {
      const cellWidth = widths.slice(column, column + cell.colSpan).reduce((sum, w) => sum + w, 0);
      column += cell.colSpan;
      const input = cell.querySelector('input');
      const value = input?.value ?? cell.textContent ?? '';
      return {
        width: cellWidth, lines: wrap(value, cellWidth - 2 * padding),
        align: isHeader ? 'center' : input ? 'right' : getComputedStyle(cell).textAlign,
        fill: isHeader ? cell.style.backgroundColor || header.style.backgroundColor : '',
        color: getComputedStyle(input || cell).color || (isHeader ? '#ffffff' : '#1E1C11'),
      };
    });
    return { cells, isHeader, height: Math.max(...cells.map(cell => cell.lines.length)) * lineHeight + 16 };
  });
  const summary = Array.from(root.querySelectorAll('dl'));
  if (!summary.length) throw new Error('일자별조회 요약을 찾을 수 없습니다.');
  const summaryHeight = 64;
  const height = rows.reduce((sum, row) => sum + row.height, summaryHeight);
  const scale = getScale(width, height);
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#d5ccb0';

  const summaryWidth = width / summary.length;
  summary.forEach((item, index) => {
    const x = index * summaryWidth;
    ctx.fillStyle = '#faf8ef';
    ctx.fillRect(x, 0, summaryWidth, summaryHeight);
    ctx.strokeRect(x, 0, summaryWidth, summaryHeight);
    ctx.fillStyle = '#4A452A';
    ctx.font = font;
    ctx.fillText(item.querySelector('dt')?.textContent ?? '', x + padding, 18);
    ctx.font = `bold ${font}`;
    ctx.fillText(item.querySelector('dd')?.textContent ?? '', x + padding, 43);
  });

  let y = summaryHeight;
  rows.forEach(({ cells, isHeader, height: rowHeight }, rowIndex) => {
    ctx.font = isHeader ? `bold ${font}` : font;
    let x = 0;
    cells.forEach(cell => {
      ctx.fillStyle = cell.fill || (rowIndex % 2 === 0 ? '#faf8ef' : '#ffffff');
      ctx.fillRect(x, y, cell.width, rowHeight);
      ctx.strokeRect(x, y, cell.width, rowHeight);
      ctx.fillStyle = cell.color;
      ctx.textAlign = cell.align === 'center' || cell.align === 'right' ? cell.align : 'left';
      const textX = ctx.textAlign === 'center' ? x + cell.width / 2 :
        ctx.textAlign === 'right' ? x + cell.width - padding : x + padding;
      const firstY = y + (rowHeight - (cell.lines.length - 1) * lineHeight) / 2;
      cell.lines.forEach((line, index) => ctx.fillText(line, textX, firstY + index * lineHeight));
      x += cell.width;
    });
    y += rowHeight;
  });
  return canvas;
};
