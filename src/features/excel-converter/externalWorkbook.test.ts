import fs from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';
import JSZip from 'jszip';
import { elements, readWorkbook, serializeXml, xml } from './workbook';
import { restoreChatSession } from './chatStorage';
import { convertWorkbook } from './writer';
import { ENGINE_VERSION, planSchema, WorkbookFile } from './types';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

const externalFormula = '[1]Sheet1!A1';

async function externalWorkbook(signed = false): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(process.cwd(), 'public/excel-converter/examples/01_우리회사_원본.xlsx')));
  const sheet = xml(await zip.file('xl/worksheets/sheet1.xml')!.async('string'));
  const cell = elements(sheet, 'c').find(value => value.getAttribute('r') === 'D5')!;
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  cell.removeAttribute('t');
  const formula = sheet.createElementNS(cell.namespaceURI, 'f');
  formula.textContent = externalFormula;
  const cached = sheet.createElementNS(cell.namespaceURI, 'v');
  cached.textContent = '37.75';
  cell.appendChild(formula);
  cell.appendChild(cached);
  zip.file('xl/worksheets/sheet1.xml', serializeXml(sheet));

  const workbook = xml(await zip.file('xl/workbook.xml')!.async('string'));
  const references = workbook.createElementNS(workbook.documentElement.namespaceURI, 'externalReferences');
  const reference = workbook.createElementNS(workbook.documentElement.namespaceURI, 'externalReference');
  reference.setAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'r:id', 'rIdExternalFixture');
  references.appendChild(reference);
  workbook.documentElement.appendChild(references);
  zip.file('xl/workbook.xml', serializeXml(workbook));
  const relationships = xml(await zip.file('xl/_rels/workbook.xml.rels')!.async('string'));
  const relationship = relationships.createElementNS(relationships.documentElement.namespaceURI, 'Relationship');
  relationship.setAttribute('Id', 'rIdExternalFixture');
  relationship.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink');
  relationship.setAttribute('Target', 'externalLinks/externalLink1.xml');
  relationships.documentElement.appendChild(relationship);
  zip.file('xl/_rels/workbook.xml.rels', serializeXml(relationships));
  zip.file('xl/externalLinks/externalLink1.xml', '<externalLink xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><externalBook r:id="rId1"><sheetNames><sheetName val="Sheet1"/></sheetNames><sheetDataSet><sheetData sheetId="0"><row r="1"><cell r="A1"><v>999</v></cell></row></sheetData></sheetDataSet></externalBook></externalLink>');
  zip.file('xl/externalLinks/_rels/externalLink1.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLinkPath" Target="https://example.invalid/source.xlsx" TargetMode="External"/></Relationships>');
  const types = xml(await zip.file('[Content_Types].xml')!.async('string'));
  const override = types.createElementNS(types.documentElement.namespaceURI, 'Override');
  override.setAttribute('PartName', '/xl/externalLinks/externalLink1.xml');
  override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml');
  types.documentElement.appendChild(override);
  zip.file('[Content_Types].xml', serializeXml(types));
  if (signed) zip.file('_xmlsignatures/sig1.xml', '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"/>');
  return zip.generateAsync({ type: 'arraybuffer' });
}

test('외부 연결 통합문서는 기본 읽기에서 계속 거부한다', async () => {
  await expect(readWorkbook(await externalWorkbook(), '외부연결_가상.xlsx')).rejects.toThrow('외부');
});

test('원본으로 허용한 외부 연결 통합문서는 네트워크 없이 시트에 저장된 계산값만 읽는다', async () => {
  const bytes = await externalWorkbook();
  const originalBytes = bytes.slice(0);
  const originalFetch = global.fetch;
  const fetch = jest.fn(() => { throw new Error('외부 연결을 요청하면 안 됩니다.'); });
  global.fetch = fetch;
  const open = jest.spyOn(XMLHttpRequest.prototype, 'open');
  try {
    const workbook = await readWorkbook(bytes, '외부연결_가상원본.xlsx', undefined, { allowExternalLinks: true });
    expect(workbook.hasExternalLinks).toBe(true);
    expect(workbook.sheets[0].cells.find(cell => cell.address === 'D5')).toMatchObject({ formula: externalFormula, value: 37.75, kind: 'number' });
    expect(workbook.bytes).toEqual(originalBytes);
    expect(bytes).toEqual(originalBytes);
    expect(fetch).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  } finally {
    global.fetch = originalFetch;
    open.mockRestore();
  }
});

test('원본 외부 연결 허용 옵션으로도 전자서명 문서는 허용하지 않는다', async () => {
  await expect(readWorkbook(await externalWorkbook(true), '전자서명_가상원본.xlsx', undefined, { allowExternalLinks: true })).rejects.toThrow('전자서명');
});

test('원본으로 읽은 외부 연결 파일을 대상 양식으로 넘겨도 작성기는 실제 패키지를 확인해 거부한다', async () => {
  const workbook = await readWorkbook(await externalWorkbook(), '외부연결_가상원본.xlsx', undefined, { allowExternalLinks: true });
  const plan = planSchema.parse({ version: 1, targetId: workbook.id, sheetName: workbook.sheets[0].name, headerRow: 4, startRow: 5, endRow: 10, mappings: [], rules: {} });
  await expect(convertWorkbook({ ...workbook, hasExternalLinks: false }, plan, { fields: [], rows: [], warnings: [], skipped: [] })).rejects.toThrow('데이터 원본으로만');
});

function savedSession(file: WorkbookFile, slot: 0 | 1) {
  return {
    schema: 1, engine: ENGINE_VERSION, id: 'external-fixture', ownerId: 'test', name: '가상 보관 작업', updatedAt: Date.now(), expiresAt: Date.now() + 86400000,
    files: slot === 0 ? [file, undefined] : [undefined, file], sheets: slot === 0 ? [file.sheets[0].name, ''] : ['', file.sheets[0].name],
    messages: [], activeHistory: [], versions: [], previewId: '', baseId: '', draft: '', accepted: [],
  };
}

test('외부 연결 원본을 보관한 작업은 저장된 계산값을 유지하며 복원한다', async () => {
  const workbook = await readWorkbook(await externalWorkbook(), '외부연결_가상원본.xlsx', undefined, { allowExternalLinks: true });
  const restored = await restoreChatSession(savedSession(workbook, 0), 'test');
  expect(restored.files[0]?.hasExternalLinks).toBe(true);
  expect(restored.files[0]?.sheets[0].cells.find(cell => cell.address === 'D5')).toMatchObject({ formula: externalFormula, value: 37.75 });
});

test('외부 연결 파일이 대상 양식으로 저장된 작업은 복원할 수 없다', async () => {
  const workbook = await readWorkbook(await externalWorkbook(), '외부연결_가상원본.xlsx', undefined, { allowExternalLinks: true });
  await expect(restoreChatSession(savedSession(workbook, 1), 'test')).rejects.toThrow('외부');
});
