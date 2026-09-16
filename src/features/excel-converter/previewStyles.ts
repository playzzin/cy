import type { SheetPresentation } from './types';
const all = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS('*', tag));
const childList = (doc: Document, name: string) => Array.from(all(doc, name)[0]?.children || []);
const colour = (node?: Element) => {
  const rgb = node?.getAttribute('rgb')?.slice(-6);
  if (rgb && /^[a-f0-9]{6}$/i.test(rgb)) return `#${rgb}`;
  return undefined;
};
export function readPresentation(styles: Document | null, sheet: Document): SheetPresentation {
  const result: SheetPresentation = { styles: [], widths: {}, heights: {} };
  if (styles) {
    const fonts = childList(styles, 'fonts'), fills = childList(styles, 'fills'), borders = childList(styles, 'borders');
    result.styles = childList(styles, 'cellXfs').slice(0, 4096).map(xf => {
      const font = fonts[Number(xf.getAttribute('fontId'))], fill = fills[Number(xf.getAttribute('fillId'))], border = borders[Number(xf.getAttribute('borderId'))];
      const align = all(xf, 'alignment')[0];
      const size = font ? Number(all(font, 'sz')[0]?.getAttribute('val')) : 11;
      return { color: font ? colour(all(font, 'color')[0]) : undefined, background: fill ? colour(all(fill, 'fgColor')[0]) : undefined, bold: !!font && all(font, 'b').some(b => b.getAttribute('val') !== '0'), fontSize: Math.min(48, Math.max(8, size || 11)), align: ['left', 'center', 'right'].includes(align?.getAttribute('horizontal') || '') ? align.getAttribute('horizontal') as 'left' | 'center' | 'right' : undefined, bordered: !!border && Array.from(border.children).some(b => !!b.getAttribute('style')), numberFormat: Number(xf.getAttribute('numFmtId')) };
    });
  }
  for (const col of all(sheet, 'col')) for (let c = Math.max(1, Number(col.getAttribute('min'))); c <= Math.min(100, Number(col.getAttribute('max'))); c++) result.widths[c] = Math.min(500, Math.max(22, Number(col.getAttribute('width') || 10) * 7 + 5));
  for (const row of all(sheet, 'row')) if (row.hasAttribute('ht')) result.heights[Number(row.getAttribute('r'))] = Math.min(200, Math.max(18, Number(row.getAttribute('ht')) * 4 / 3));
  return result;
}
