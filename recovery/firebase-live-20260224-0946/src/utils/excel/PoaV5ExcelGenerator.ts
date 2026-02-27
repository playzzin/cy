import ExcelJS from 'exceljs';

export type PoaV5ExcelCellMapping = {
    address: string;
    value?: string | number | boolean | null;
    path?: string;
};

export type PoaV5ExcelTableColumnMapping = {
    offset: number;
    path?: string;
    value?: string | number | boolean | null;
};

export type PoaV5ExcelTableMapping = {
    sheetName?: string;
    startCell: string; // e.g. A10 (first data row, first column)
    itemsPath: string; // e.g. workers
    columns: PoaV5ExcelTableColumnMapping[];
    maxRows?: number;
};

export type PoaV5ExcelMapping = {
    version: 1;
    sheetName?: string;
    cells?: PoaV5ExcelCellMapping[];
    tables?: PoaV5ExcelTableMapping[];
    outputFileName?: string;
};

const getByPath = (obj: any, path: string): any => {
    if (!path) return undefined;
    const parts = path.split('.').map((p) => p.trim()).filter(Boolean);
    let cur = obj;
    for (const part of parts) {
        if (cur == null) return undefined;
        cur = cur[part];
    }
    return cur;
};

const renderTemplate = (template: string, data: any): string => {
    return template.replace(/{{\s*([^}]+)\s*}}/g, (_, rawPath) => {
        const v = getByPath(data, String(rawPath || '').trim());
        if (v === undefined || v === null) return '';
        return String(v);
    });
};

const parseA1 = (address: string): { row: number; col: number } => {
    const m = /^([A-Za-z]+)(\d+)$/.exec(address.trim());
    if (!m) {
        throw new Error(`Invalid A1 address: ${address}`);
    }
    const letters = m[1].toUpperCase();
    const row = Number(m[2]);
    if (!Number.isFinite(row) || row <= 0) {
        throw new Error(`Invalid A1 row: ${address}`);
    }
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
        col = col * 26 + (letters.charCodeAt(i) - 64);
    }
    if (!Number.isFinite(col) || col <= 0) {
        throw new Error(`Invalid A1 column: ${address}`);
    }
    return { row, col };
};

const colToLetters = (col: number): string => {
    let n = col;
    let s = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s || 'A';
};

const normalizeHeader = (v: unknown): string => {
    return String(v ?? '')
        .replace(/\s+/g, '')
        .replace(/[()\[\]{}:;,.\-_/\\|]/g, '')
        .trim();
};

const resolveWorkerPathByHeader = (raw: string): string | null => {
    const v = normalizeHeader(raw);
    if (!v) return null;
    if (v === '이름' || v === '성명' || v === '작업자' || v === '작업자명') return 'name';
    if (v === '주민번호' || v === '주민등록번호' || v === '주민등록번호앞' || v === '주민등록번호뒷' || v === '주민') return 'idNumber';
    if (v === '주소' || v === '거주지' || v === '현주소') return 'address';
    if (v === '공수' || v === '공수합' || v === '공수합계' || v === '출역' || v === '출역일수') return 'gongsu';
    if (v === '단가' || v === '노임단가' || v === '일당' || v === '일급') return 'unitPrice';
    if (v === '금액' || v === '총액' || v === '지급액' || v === '노임' || v === '총금액') return 'amount';
    if (v === '서명' || v === '싸인' || v === '사인' || v === 'signature') return 'signatureUrl';
    return null;
};

export async function suggestPoaV5MappingFromTemplate(params: {
    templateBuffer: ArrayBuffer;
    sheetName?: string | null;
    maxScanRows?: number;
    maxScanCols?: number;
}): Promise<PoaV5ExcelMapping> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(params.templateBuffer);

    const maxScanRows = typeof params.maxScanRows === 'number' && params.maxScanRows > 0 ? params.maxScanRows : 80;
    const maxScanCols = typeof params.maxScanCols === 'number' && params.maxScanCols > 0 ? params.maxScanCols : 40;

    const worksheet = params.sheetName
        ? workbook.getWorksheet(String(params.sheetName))
        : workbook.worksheets[0];

    if (!worksheet) {
        throw new Error('Worksheet not found in template');
    }

    type Hit = { row: number; col: number; path: string };
    let bestRow: number | null = null;
    let bestHits: Hit[] = [];

    for (let r = 1; r <= Math.min(maxScanRows, worksheet.rowCount || maxScanRows); r++) {
        const row = worksheet.getRow(r);
        const hits: Hit[] = [];

        for (let c = 1; c <= maxScanCols; c++) {
            const cell = row.getCell(c);
            const raw = (cell as any)?.text ?? (cell as any)?.value ?? '';
            const path = resolveWorkerPathByHeader(String(raw));
            if (!path) continue;
            hits.push({ row: r, col: c, path });
        }

        const uniq = new Set(hits.map((h) => h.path));
        if (uniq.size >= 3) {
            if (!bestRow || uniq.size > new Set(bestHits.map((h) => h.path)).size) {
                bestRow = r;
                bestHits = hits;
            }
        }
    }

    if (!bestRow || bestHits.length === 0) {
        throw new Error('표 헤더(이름/주민번호/주소/공수/단가/금액/서명)를 찾지 못했습니다. 헤더 행에 텍스트가 있는지 확인해주세요.');
    }

    const byPath = new Map<string, Hit>();
    for (const h of bestHits) {
        if (!byPath.has(h.path)) byPath.set(h.path, h);
    }

    const hitsOrdered = Array.from(byPath.values()).sort((a, b) => a.col - b.col);
    const minCol = hitsOrdered.reduce((min, h) => Math.min(min, h.col), Number.POSITIVE_INFINITY);
    const startCell = `${colToLetters(minCol)}${bestRow + 1}`;

    const columns = hitsOrdered.map((h) => ({
        offset: h.col - minCol,
        path: h.path
    }));

    return {
        version: 1,
        sheetName: worksheet.name,
        cells: [],
        tables: [
            {
                sheetName: worksheet.name,
                startCell,
                itemsPath: 'workers',
                maxRows: 30,
                columns
            }
        ]
    };
}

export async function generatePoaExcelFromTemplate(params: {
    templateBuffer: ArrayBuffer;
    mapping: PoaV5ExcelMapping;
    data: any;
}): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(params.templateBuffer);

    const worksheet = params.mapping.sheetName
        ? workbook.getWorksheet(params.mapping.sheetName)
        : workbook.worksheets[0];

    if (!worksheet) {
        throw new Error('Worksheet not found in template');
    }

    for (const m of params.mapping.cells || []) {
        const address = typeof m?.address === 'string' ? m.address.trim() : '';
        if (!address) continue;

        let nextValue: any = undefined;

        if (m.path && typeof m.path === 'string' && m.path.trim().length > 0) {
            nextValue = getByPath(params.data, m.path.trim());
        } else if (typeof m.value === 'string') {
            nextValue = renderTemplate(m.value, params.data);
        } else if (m.value !== undefined) {
            nextValue = m.value;
        }

        if (nextValue === undefined) continue;

        const cell = worksheet.getCell(address);
        cell.value = nextValue as any;
    }

    for (const t of params.mapping.tables || []) {
        const sheet = t.sheetName
            ? workbook.getWorksheet(t.sheetName)
            : worksheet;
        if (!sheet) continue;

        const startCell = typeof t?.startCell === 'string' ? t.startCell.trim() : '';
        const itemsPath = typeof t?.itemsPath === 'string' ? t.itemsPath.trim() : '';
        if (!startCell || !itemsPath) continue;

        const { row: startRow, col: startCol } = parseA1(startCell);
        const items = getByPath(params.data, itemsPath);
        if (!Array.isArray(items)) continue;

        const max = typeof t.maxRows === 'number' && t.maxRows > 0 ? Math.min(items.length, t.maxRows) : items.length;
        const cols = Array.isArray(t.columns) ? t.columns : [];

        for (let r = 0; r < max; r++) {
            const item = items[r];
            const excelRow = startRow + r;
            cols.forEach((c) => {
                const offset = typeof c?.offset === 'number' ? c.offset : NaN;
                if (!Number.isFinite(offset)) return;
                const excelCol = startCol + offset;

                let nextValue: any = undefined;
                if (c.path && typeof c.path === 'string' && c.path.trim().length > 0) {
                    nextValue = getByPath(item, c.path.trim());
                } else if (typeof c.value === 'string') {
                    nextValue = renderTemplate(c.value, { ...params.data, item });
                } else if (c.value !== undefined) {
                    nextValue = c.value;
                }

                if (nextValue === undefined) return;
                sheet.getCell(excelRow, excelCol).value = nextValue as any;
            });
        }
    }

    const buf = await workbook.xlsx.writeBuffer();
    return buf as ArrayBuffer;
}
