// Native print settings are not exposed by the spreadsheet authoring library.
// Patch only the bundled synthetic examples, preserving cell data and styles.
const fs = require('node:fs/promises');
const path = require('node:path');
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');
const { DOMParser, XMLSerializer } = new JSDOM('').window;
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const examples = [
  ['11_타회사위임장_개인별양식.xlsx', 'A1:F25', 'portrait'],
  ['21_타회사노임명세서_한줄양식.xlsx', 'A1:G11', 'landscape'],
  ['30_병합셀_타회사노임양식.xlsx', 'A1:G15', 'landscape'],
  ['41_타회사세줄_열순서변경.xlsx', 'A1:I18', 'landscape'],
];
const elements = (doc, name) => [...doc.getElementsByTagNameNS('*', name)];
const parse = text => new DOMParser().parseFromString(text.replace(/^\uFEFF/, ''), 'application/xml');
const serialize = doc => new XMLSerializer().serializeToString(doc);
async function main() {
  for (const [name, expectedRange, orientation] of examples) {
    const file = path.resolve(__dirname, '../public/excel-converter/examples', name);
    const zip = await JSZip.loadAsync(await fs.readFile(file));
    const entry = 'xl/worksheets/sheet1.xml';
    const sheet = parse(await zip.file(entry).async('string'));
    const beforeData = serialize(elements(sheet, 'sheetData')[0]);
    const root = sheet.documentElement;
    let properties = elements(sheet, 'sheetPr')[0];
    if (!properties) { properties = sheet.createElementNS(ns, 'sheetPr'); root.insertBefore(properties, root.firstChild); }
    let fit = elements(properties, 'pageSetUpPr')[0];
    if (!fit) { fit = sheet.createElementNS(ns, 'pageSetUpPr'); properties.appendChild(fit); }
    fit.setAttribute('fitToPage', '1');
    let setup = elements(sheet, 'pageSetup')[0];
    if (!setup) {
      setup = sheet.createElementNS(ns, 'pageSetup');
      const following = ['headerFooter', 'rowBreaks', 'colBreaks', 'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags', 'drawing', 'legacyDrawing', 'legacyDrawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'];
      root.insertBefore(setup, [...root.children].find(e => following.includes(e.localName)) || null);
    }
    for (const [key, value] of Object.entries({ paperSize: '9', orientation, fitToWidth: '1', fitToHeight: '0' })) setup.setAttribute(key, value);
    setup.removeAttribute('scale');
    const workbook = parse(await zip.file('xl/workbook.xml').async('string'));
    let names = elements(workbook, 'definedNames')[0];
    if (!names) {
      names = workbook.createElementNS(ns, 'definedNames');
      const after = ['calcPr', 'oleSize', 'customWorkbookViews', 'pivotCaches', 'smartTagPr', 'smartTagTypes', 'webPublishing', 'fileRecoveryPr', 'webPublishObjects', 'extLst'];
      workbook.documentElement.insertBefore(names, [...workbook.documentElement.children].find(e => after.includes(e.localName)) || null);
    }
    elements(names, 'definedName').filter(e => e.getAttribute('name') === '_xlnm.Print_Area' && e.getAttribute('localSheetId') === '0').forEach(e => e.remove());
    const printArea = workbook.createElementNS(ns, 'definedName');
    printArea.setAttribute('name', '_xlnm.Print_Area'); printArea.setAttribute('localSheetId', '0');
    // Include every used cell; the explicit range documents each example's baseline.
    // Some generators leave dimension stale after appending totals or footnotes.
    const coordinates = [expectedRange, elements(sheet, 'dimension')[0]?.getAttribute('ref') || '', ...elements(sheet, 'c').map(e => e.getAttribute('r')), ...elements(sheet, 'mergeCell').map(e => e.getAttribute('ref'))].flatMap(ref => String(ref || '').split(':'));
    let lastRow = 1, lastColumn = 1;
    for (const address of coordinates) {
      const match = address.match(/^([A-Z]+)(\d+)$/); if (!match) continue;
      lastRow = Math.max(lastRow, Number(match[2]));
      lastColumn = Math.max(lastColumn, [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0));
    }
    let columnName = ''; for (let n = lastColumn; n > 0; n = Math.floor((n - 1) / 26)) columnName = String.fromCharCode(65 + (n - 1) % 26) + columnName;
    const sheetName = elements(workbook, 'sheet')[0].getAttribute('name').replace(/'/g, "''");
    printArea.textContent = `'${sheetName}'!$A$1:$${columnName}$${lastRow}`;
    names.appendChild(printArea);
    if (serialize(elements(sheet, 'sheetData')[0]) !== beforeData) throw new Error(`Cell data changed: ${name}`);
    zip.file(entry, serialize(sheet)); zip.file('xl/workbook.xml', serialize(workbook));
    await fs.writeFile(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    console.log(JSON.stringify({ name, orientation, printArea: printArea.textContent }));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
