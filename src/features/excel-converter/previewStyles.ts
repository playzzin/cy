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
      const edge=border&&Array.from(border.children).find(b=>!!b.getAttribute('style'));
      const vertical=align?.getAttribute('vertical');
      return { color: font ? colour(all(font, 'color')[0]) : undefined, background: fill ? colour(all(fill, 'fgColor')[0]) : undefined, bold: !!font && all(font, 'b').some(b => b.getAttribute('val') !== '0'), fontSize: Math.min(72, Math.max(6, size || 11)), fontName:font?all(font,'name')[0]?.getAttribute('val')||undefined:undefined,italic:!!font&&all(font,'i').some(n=>n.getAttribute('val')!=='0'),underline:!!font&&all(font,'u').some(n=>n.getAttribute('val')!=='none'),wrap:align?.hasAttribute('wrapText')?align.getAttribute('wrapText')==='1':undefined,vertical:vertical==='center'?'middle':vertical==='top'||vertical==='bottom'?vertical:undefined, align: ['left', 'center', 'right'].includes(align?.getAttribute('horizontal') || '') ? align.getAttribute('horizontal') as 'left' | 'center' | 'right' : undefined, bordered: !!edge,borderStyle:edge?.getAttribute('style')||undefined,borderColor:edge?colour(all(edge,'color')[0]):undefined, numberFormat: Number(xf.getAttribute('numFmtId')) };
    });
  }
  for (const col of all(sheet, 'col')) for (let c = Math.max(1, Number(col.getAttribute('min'))); c <= Math.min(100, Number(col.getAttribute('max'))); c++) result.widths[c] = Math.min(500, Math.max(22, Number(col.getAttribute('width') || 10) * 7 + 5));
  for (const row of all(sheet, 'row')) if (row.hasAttribute('ht')) result.heights[Number(row.getAttribute('r'))] = Math.min(200, Math.max(18, Number(row.getAttribute('ht')) * 4 / 3));
  return result;
}
