import {
  A4_PDF_HEIGHT_PT,
  A4_PDF_WIDTH_PT,
  normalizePdfFileName,
  sha256Hex,
  writeA4RasterPdf,
  type A4RasterPdfPage,
} from './a4RasterPdfWriter';

const jpegPage = (seed = 0, auditText?: string, searchText?: string): A4RasterPdfPage => ({
  jpegBytes: new Uint8Array([0xff, 0xd8, seed & 0xff, 0xff, 0xd9]),
  width: 1240,
  height: 1754,
  auditText,
  searchText,
});

const asLatin1 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('latin1');

describe('writeA4RasterPdf', () => {
  it('writes every JPEG as an exact A4 page with a valid classic xref table', () => {
    const bytes = writeA4RasterPdf([jpegPage(1), jpegPage(2)]);
    const pdf = asLatin1(bytes);

    expect(pdf.startsWith('%PDF-1.7\n%')).toBe(true);
    expect(pdf).toContain('/Count 2');
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(pdf.match(/\/Subtype \/Image\b/g)).toHaveLength(2);
    expect(pdf.match(new RegExp(`/MediaBox \\[0 0 ${A4_PDF_WIDTH_PT} ${A4_PDF_HEIGHT_PT}\\]`, 'g'))).toHaveLength(2);

    const startXrefMatch = pdf.match(/startxref\n(\d+)\n%%EOF\n$/);
    expect(startXrefMatch).not.toBeNull();
    const xrefOffset = Number(startXrefMatch?.[1]);
    expect(pdf.slice(xrefOffset, xrefOffset + 4)).toBe('xref');

    const xrefRows = pdf.slice(xrefOffset).split('\n');
    expect(xrefRows[1]).toBe('0 14');
    for (let objectId = 1; objectId <= 13; objectId += 1) {
      const objectOffset = Number(xrefRows[2 + objectId].slice(0, 10));
      expect(pdf.slice(objectOffset, objectOffset + `${objectId} 0 obj`.length)).toBe(`${objectId} 0 obj`);
    }
  });

  it('supports the fixed 42-page construction-plan contract', () => {
    const bytes = writeA4RasterPdf(Array.from({ length: 42 }, (_, index) => jpegPage(
      index,
      `PLAN_ID=plan-123 | DOCUMENT_NO=CP-2026-001 | REV=5 | TEMPLATE_VERSION=shoring-v1 | PAGE ${index + 1}/42 | SNAPSHOT_HASH=abc123`,
    )));
    const pdf = asLatin1(bytes);

    expect(pdf).toContain('/Count 42');
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(42);
    expect(pdf.match(/\/Filter \/DCTDecode\b/g)).toHaveLength(42);
    expect(pdf).toContain('/Subtype /Type1 /BaseFont /Helvetica');
    expect(pdf.match(/\/Font << \/F1 3 0 R \/F2 4 0 R >>/g)).toHaveLength(42);
    expect(pdf).toContain('PLAN_ID=plan-123');
    expect(pdf).toContain('DOCUMENT_NO=CP-2026-001');
    expect(pdf).toContain('REV=5');
    expect(pdf).toContain('TEMPLATE_VERSION=shoring-v1');
    expect(pdf).toContain('SNAPSHOT_HASH=abc123');
    expect(pdf).toContain('PAGE 1/42');
    expect(pdf).toContain('PAGE 42/42');
    expect(pdf).toContain('0 134\n');
  });

  it('adds visible Korean DOM copy as an invisible searchable Unicode layer', () => {
    const searchText = '시스템동바리 시공계획서 현장명 광주';
    const expectedHex = Array.from(searchText)
      .map((character) => character.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase())
      .join('');
    const pdf = asLatin1(writeA4RasterPdf([jpegPage(1, undefined, searchText)]));

    expect(pdf).toContain('/Subtype /Type0');
    expect(pdf).toContain('/Encoding /Identity-H');
    expect(pdf).toContain('/ToUnicode 6 0 R');
    expect(pdf).toContain('3 Tr');
    expect(pdf).toContain(`<${expectedHex}> Tj`);
  });

  it('escapes PDF literal delimiters and removes control/non-ASCII audit text', () => {
    const pdf = asLatin1(writeA4RasterPdf([
      jpegPage(1, 'PLAN_ID=plan(1)\\source\nPAGE 1/42 한글'),
    ]));

    expect(pdf).toContain('(PLAN_ID=plan\\(1\\)\\\\source PAGE 1/42 __) Tj');
    expect(pdf).not.toContain('한글');
  });

  it('rejects empty documents and non-JPEG input', () => {
    expect(() => writeA4RasterPdf([])).toThrow('한 페이지 이상의 JPEG');
    expect(() => writeA4RasterPdf([{
      jpegBytes: new Uint8Array([1, 2, 3, 4]),
      width: 100,
      height: 100,
    }])).toThrow('JPEG 형식');
  });
});

describe('sha256Hex', () => {
  const utf8 = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'utf8'));

  it('matches the standard empty and abc vectors', () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex(utf8('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('handles data spanning multiple SHA-256 blocks', () => {
    expect(sha256Hex(utf8('The quick brown fox jumps over the lazy dog'))).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    );
  });
});

describe('normalizePdfFileName', () => {
  it('keeps Korean names, removes duplicate extensions, and replaces unsafe characters', () => {
    expect(normalizePdfFileName(' 청연 / 시스템동바리 : REV5.pdf.pdf ')).toBe(
      '청연_-_시스템동바리_-_REV5.pdf',
    );
  });

  it('uses a safe fallback for empty and Windows-reserved names', () => {
    expect(normalizePdfFileName('***')).toBe('construction-plan.pdf');
    expect(normalizePdfFileName('CON.pdf', '현장_시공계획서')).toBe('현장_시공계획서.pdf');
  });
});
