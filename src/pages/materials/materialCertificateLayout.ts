import type { SelectedMaterial } from './MaterialSelectionActionBar';

export const CERTIFICATE_WIDTH = 1240;
export const CERTIFICATE_HEIGHT = 1754;
export const CERTIFICATE_PADDING = 60;
export const CERTIFICATE_FONT = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
export const CERTIFICATE_COLUMNS = [58, 420, 354, 178, 110];
export const CERTIFICATE_PAIRED_COLUMNS = [54, 180, 144, 108, 62];
const TABLE_GAP = 24;
const PREFERRED_MIN_FONT_SIZE = 20;
export const CERTIFICATE_COLUMN_LABELS = ['No', '품목', '규격', '수량', '단위'];
export const CERTIFICATE_META_TOP = 130;
export const CERTIFICATE_META_LABEL_WIDTH = 140;
export const CERTIFICATE_TABLE_HEADER_HEIGHT = 36;
export const CERTIFICATE_TABLE_BOTTOM = 1584;
export const MAX_CERTIFICATE_ITEMS_PER_PAGE = 40;

export interface MaterialCertificateField { label: string; value: string; wide?: boolean; }
export type CertificateTextMeasure = (text: string, fontSize: number) => number;

export const wrapCertificateText = (text: string, width: number, fontSize: number, measure: CertificateTextMeasure): string[] => {
    const lines: string[] = [];
    for (const paragraph of (text.trim() || '-').split('\n')) {
        let line = '';
        for (const character of paragraph) {
            while (line && measure(line + character, fontSize) > width) {
                const wordBoundary = line.lastIndexOf(' ');
                const split = wordBoundary > 0 ? wordBoundary + 1 : line.length;
                lines.push(line.slice(0, split));
                line = line.slice(split);
            }
            line += character;
        }
        lines.push(line || '-');
    }
    return lines;
};

export const createCertificateTextMeasure = (): CertificateTextMeasure => {
    const context = typeof CanvasRenderingContext2D !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    return (text, fontSize) => {
        if (!context) return Array.from(text).reduce((sum, character) => sum + (character.charCodeAt(0) > 255 ? 1 : .65), 0) * fontSize;
        context.font = `500 ${fontSize}px ${CERTIFICATE_FONT}`;
        return context.measureText(text).width;
    };
};

/** A single A4 layout drives both the print view and the downloadable image. */
export const getMaterialCertificateLayout = (
    items: SelectedMaterial[], details: MaterialCertificateField[], measure: CertificateTextMeasure,
) => {
    const contentWidth = CERTIFICATE_WIDTH - CERTIFICATE_PADDING * 2;
    const fields: MaterialCertificateField[][] = [];
    details.forEach(field => {
        const last = fields[fields.length - 1];
        if (field.wide || !last || last[0].wide || last.length === 2) fields.push([field]);
        else last.push(field);
    });
    const metadata = fields.map(row => {
        const cells = row.map(field => ({
            ...field,
            lines: wrapCertificateText(field.value, (field.wide ? contentWidth : contentWidth / 2) - CERTIFICATE_META_LABEL_WIDTH - 20, 20, measure),
        }));
        return { cells, height: Math.max(...cells.map(cell => cell.lines.length)) * 25 + 12 };
    });
    const tableTop = CERTIFICATE_META_TOP + metadata.reduce((sum, row) => sum + row.height, 0) + 18;
    const availableHeight = Math.max(100, CERTIFICATE_TABLE_BOTTOM - tableTop - CERTIFICATE_TABLE_HEADER_HEIGHT);
    const pages = Array.from({ length: Math.max(1, Math.ceil(items.length / MAX_CERTIFICATE_ITEMS_PER_PAGE)) }, (_, pageIndex) => {
        const start = pageIndex * MAX_CERTIFICATE_ITEMS_PER_PAGE;
        const pageItems = items.slice(start, start + MAX_CERTIFICATE_ITEMS_PER_PAGE);
        const fitTables = (columnCount: number) => {
            const perTable = Math.ceil(pageItems.length / columnCount) || 1;
            const columns = columnCount === 1 ? CERTIFICATE_COLUMNS : CERTIFICATE_PAIRED_COLUMNS;
            const width = columns.reduce((sum, value) => sum + value, 0);
            const makeTables = (fontSize: number, lineHeight: number, padding: number) => Array.from({ length: columnCount }, (_, tableIndex) => ({
                columns, width, offset: tableIndex * (width + TABLE_GAP),
                rows: pageItems.slice(tableIndex * perTable, (tableIndex + 1) * perTable).map((item, index) => {
                    const cells = [String(start + tableIndex * perTable + index + 1), item.itemName, item.spec, (item.quantity || 0).toLocaleString('ko-KR'), item.unit]
                        .map((value, column) => wrapCertificateText(value || '-', columns[column] - 20, fontSize, measure));
                    return { cells, height: Math.max(...cells.map(lines => lines.length)) * lineHeight + padding };
                }),
            }));
            const maximumHeight = (tables: ReturnType<typeof makeTables>) => Math.max(1, ...tables.map(table => table.rows.reduce((sum, row) => sum + row.height, 0)));
            let fontSize = 23, lineHeight = 29, padding = 14;
            let tables = makeTables(fontSize, lineHeight, padding);
            while (maximumHeight(tables) > availableHeight && fontSize > 8) {
                fontSize -= .5;
                lineHeight = Math.ceil(fontSize * 1.25);
                padding = Math.max(4, fontSize - 16);
                tables = makeTables(fontSize, lineHeight, padding);
            }
            const scale = Math.min(1, availableHeight / maximumHeight(tables));
            return { fontSize: fontSize * scale, lineHeight: lineHeight * scale,
                tables: tables.map(table => ({ ...table, rows: table.rows.map(row => ({ ...row, height: row.height * scale })) })) };
        };
        const single = fitTables(1);
        // Keep the familiar single table whenever it fits at a readable size.
        // Use two tables only when the narrower layout actually improves legibility.
        if (single.fontSize >= PREFERRED_MIN_FONT_SIZE || pageItems.length < 2) return single;
        const paired = fitTables(2);
        return paired.fontSize > single.fontSize ? paired : single;
    });
    return { metadata, tableTop, pages };
};
