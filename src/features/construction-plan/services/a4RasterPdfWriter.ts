export const A4_PDF_WIDTH_PT = 595.28;
export const A4_PDF_HEIGHT_PT = 841.89;

export type A4RasterPdfPage = {
  jpegBytes: Uint8Array;
  width: number;
  height: number;
  auditText?: string;
  searchText?: string;
};

const encodeAscii = (value: string): Uint8Array => {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    if (codePoint > 0x7f) {
      throw new TypeError('PDF 구조 문자열에는 ASCII 문자만 사용할 수 있습니다.');
    }
    bytes[index] = codePoint;
  }
  return bytes;
};

/** Keeps audit markers deterministic, single-line, and safe for a PDF text stream. */
export const sanitizePdfAuditText = (value: string, maxLength = 480): string => {
  let ascii = '';
  for (const character of String(value)) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint >= 0x20 && codePoint <= 0x7e) {
      ascii += character;
    } else if (/\s/.test(character)) {
      ascii += ' ';
    } else {
      ascii += '_';
    }
  }
  return ascii.replace(/\s+/g, ' ').trim().slice(0, Math.max(0, maxLength));
};

const escapePdfLiteralString = (value: string): string => value
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const replacePdfSearchControlCharacters = (value: string): string => Array.from(value, (character) => {
  const codePoint = character.codePointAt(0) ?? 0;
  const isControl = (codePoint < 0x20 && character !== '\n' && character !== '\t') || codePoint === 0x7f;
  return isControl ? ' ' : character;
}).join('');

/** Keeps visible page copy searchable while removing PDF control characters. */
export const sanitizePdfSearchText = (value: string, maxLength = 24_000): string => replacePdfSearchControlCharacters(String(value))
  .normalize('NFKC')
  .replace(/\r\n?/g, '\n')
  .replace(/[\t ]+/g, ' ')
  .replace(/\s*\n\s*/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, Math.max(0, maxLength));

/** Encodes a PDF Type0/Identity-H string as UTF-16BE hexadecimal code units. */
const encodeUtf16BeHex = (value: string): string => {
  let hex = '';
  for (let index = 0; index < value.length; index += 1) {
    hex += value.charCodeAt(index).toString(16).padStart(4, '0').toUpperCase();
  }
  return hex;
};

const concatenate = (chunks: Uint8Array[], byteLength: number): Uint8Array => {
  const result = new Uint8Array(byteLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return result;
};

const assertJpegPage = (page: A4RasterPdfPage, index: number): void => {
  const pageNumber = index + 1;
  if (!(page.jpegBytes instanceof Uint8Array) || page.jpegBytes.byteLength < 4) {
    throw new TypeError(`PDF ${pageNumber}페이지의 JPEG 데이터가 올바르지 않습니다.`);
  }
  const last = page.jpegBytes.byteLength - 1;
  if (
    page.jpegBytes[0] !== 0xff
    || page.jpegBytes[1] !== 0xd8
    || page.jpegBytes[last - 1] !== 0xff
    || page.jpegBytes[last] !== 0xd9
  ) {
    throw new TypeError(`PDF ${pageNumber}페이지는 JPEG 형식이어야 합니다.`);
  }
  if (!Number.isInteger(page.width) || page.width <= 0 || !Number.isInteger(page.height) || page.height <= 0) {
    throw new RangeError(`PDF ${pageNumber}페이지의 이미지 크기가 올바르지 않습니다.`);
  }
};

/**
 * Creates a dependency-free PDF containing one full-bleed JPEG XObject per A4 page.
 * Visible DOM copy is mirrored into an invisible Unicode Type0 text layer so
 * the raster-perfect page remains searchable without affecting its layout.
 * The returned bytes include a classic xref table so byte offsets remain inspectable.
 */
export const writeA4RasterPdf = (pages: A4RasterPdfPage[]): Uint8Array => {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new RangeError('PDF에는 한 페이지 이상의 JPEG 이미지가 필요합니다.');
  }
  pages.forEach(assertJpegPage);

  const objectCount = 7 + (pages.length * 3);
  const objectOffsets = new Array<number>(objectCount + 1).fill(0);
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  const appendBytes = (value: Uint8Array): void => {
    chunks.push(value);
    byteLength += value.byteLength;
  };
  const appendAscii = (value: string): void => appendBytes(encodeAscii(value));
  const beginObject = (objectId: number): void => {
    objectOffsets[objectId] = byteLength;
    appendAscii(`${objectId} 0 obj\n`);
  };
  const endObject = (): void => appendAscii('endobj\n');

  appendAscii('%PDF-1.7\n%');
  appendBytes(new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  beginObject(1);
  appendAscii('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObject();

  const pageObjectIds = pages.map((_, index) => 8 + (index * 3));
  beginObject(2);
  appendAscii(`<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>\n`);
  endObject();

  beginObject(3);
  appendAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n');
  endObject();

  beginObject(4);
  appendAscii('<< /Type /Font /Subtype /Type0 /BaseFont /ConstructionPlanSearchLayer /Encoding /Identity-H /DescendantFonts [5 0 R] /ToUnicode 6 0 R >>\n');
  endObject();

  beginObject(5);
  appendAscii('<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ConstructionPlanSearchLayer /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 7 0 R /DW 1000 /CIDToGIDMap /Identity >>\n');
  endObject();

  const unicodeCMap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n1 beginbfrange\n<0000> <FFFF> <0000>\nendbfrange\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
  const unicodeCMapBytes = encodeAscii(unicodeCMap);
  beginObject(6);
  appendAscii(`<< /Length ${unicodeCMapBytes.byteLength} >>\nstream\n`);
  appendBytes(unicodeCMapBytes);
  appendAscii('endstream\n');
  endObject();

  beginObject(7);
  appendAscii('<< /Type /FontDescriptor /FontName /ConstructionPlanSearchLayer /Flags 32 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>\n');
  endObject();

  pages.forEach((page, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = pageObjectId + 1;
    const imageObjectId = pageObjectId + 2;
    const sanitizedAuditText = sanitizePdfAuditText(page.auditText ?? '');
    const auditContent = sanitizedAuditText
      ? `BT\n/F1 2.5 Tf\n0.25 g\n4 3 Td\n(${escapePdfLiteralString(sanitizedAuditText)}) Tj\nET\n`
      : '';
    const sanitizedSearchText = sanitizePdfSearchText(page.searchText ?? '');
    const searchContent = sanitizedSearchText
      ? `BT\n/F2 3 Tf\n3 Tr\n6 ${A4_PDF_HEIGHT_PT - 8} Td\n<${encodeUtf16BeHex(sanitizedSearchText)}> Tj\nET\n`
      : '';
    const content = `q\n${A4_PDF_WIDTH_PT} 0 0 ${A4_PDF_HEIGHT_PT} 0 0 cm\n/Im0 Do\nQ\n${searchContent}${auditContent}`;
    const contentBytes = encodeAscii(content);

    beginObject(pageObjectId);
    appendAscii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PDF_WIDTH_PT} ${A4_PDF_HEIGHT_PT}] `
      + `/Resources << /ProcSet [/PDF /Text /ImageC] /Font << /F1 3 0 R /F2 4 0 R >> `
      + `/XObject << /Im0 ${imageObjectId} 0 R >> >> `
      + `/Contents ${contentObjectId} 0 R >>\n`,
    );
    endObject();

    beginObject(contentObjectId);
    appendAscii(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    appendBytes(contentBytes);
    appendAscii('endstream\n');
    endObject();

    beginObject(imageObjectId);
    appendAscii(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} `
      + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.byteLength} >>\nstream\n`,
    );
    appendBytes(page.jpegBytes);
    appendAscii('\nendstream\n');
    endObject();
  });

  const xrefOffset = byteLength;
  appendAscii(`xref\n0 ${objectCount + 1}\n`);
  appendAscii('0000000000 65535 f \n');
  for (let objectId = 1; objectId <= objectCount; objectId += 1) {
    const offset = objectOffsets[objectId];
    if (offset >= 10_000_000_000) {
      throw new RangeError('PDF가 classic xref 오프셋 한도를 초과했습니다.');
    }
    appendAscii(`${String(offset).padStart(10, '0')} 00000 n \n`);
  }
  appendAscii(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return concatenate(chunks, byteLength);
};

const SHA_256_INITIAL = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const SHA_256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotateRight = (value: number, amount: number): number => (
  (value >>> amount) | (value << (32 - amount))
);

/** Computes a SHA-256 digest synchronously without WebCrypto or Node dependencies. */
export const sha256Hex = (input: Uint8Array | ArrayBuffer): string => {
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  const paddedLength = Math.ceil((source.byteLength + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(source);
  padded[source.byteLength] = 0x80;

  const bitLength = source.byteLength * 8;
  const paddedView = new DataView(padded.buffer);
  paddedView.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  paddedView.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const hash = new Uint32Array(SHA_256_INITIAL);
  const words = new Uint32Array(64);

  for (let chunkOffset = 0; chunkOffset < paddedLength; chunkOffset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = paddedView.getUint32(chunkOffset + (index * 4), false);
    }
    for (let index = 16; index < 64; index += 1) {
      const word15 = words[index - 15];
      const word2 = words[index - 2];
      const sigma0 = rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      const sigma1 = rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + SHA_256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return Array.from(hash)
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('');
};

const WINDOWS_RESERVED_BASE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

/** Normalizes user/site supplied text into a cross-platform safe PDF filename. */
export const normalizePdfFileName = (
  value: string,
  fallbackBaseName = 'construction-plan',
): string => {
  const sanitizeBase = (candidate: string): string => {
    const withoutExtension = candidate.normalize('NFKC').trim().replace(/(?:\.pdf)+$/gi, '');
    const withoutControlCharacters = Array.from(withoutExtension, (character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? '-' : character;
    }).join('');
    const replaced = withoutControlCharacters
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '-')
      .replace(/_+/g, '_')
      .replace(/^[.\s_-]+|[.\s_-]+$/g, '');
    return Array.from(replaced).slice(0, 120).join('').replace(/[.\s_-]+$/g, '');
  };

  let baseName = sanitizeBase(value);
  if (!baseName || WINDOWS_RESERVED_BASE_NAME.test(baseName)) {
    baseName = sanitizeBase(fallbackBaseName) || 'construction-plan';
  }
  if (WINDOWS_RESERVED_BASE_NAME.test(baseName)) {
    baseName = 'construction-plan';
  }
  return `${baseName}.pdf`;
};
