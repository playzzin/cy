import type { SelectedMaterial } from './MaterialSelectionActionBar';
import { loadMaterialCertificateLogo } from './materialCertificateBrand';
import {
    CERTIFICATE_COLUMN_LABELS, CERTIFICATE_HEIGHT, CERTIFICATE_WIDTH,
    CERTIFICATE_FONT, CERTIFICATE_PADDING, CERTIFICATE_META_TOP, CERTIFICATE_META_LABEL_WIDTH,
    CERTIFICATE_TABLE_HEADER_HEIGHT, getMaterialCertificateLayout, MaterialCertificateField,
} from './materialCertificateLayout';
export type { MaterialCertificateField } from './materialCertificateLayout';

export const MAX_MATERIAL_CERTIFICATE_PHOTOS = 40;
const PAGE_WIDTH = CERTIFICATE_WIDTH;
const PAGE_HEIGHT = CERTIFICATE_HEIGHT;
const FONT = CERTIFICATE_FONT;
export interface MaterialCertificateDocument {
    transactionDate: string;
    siteName: string;
    vehicleNumber: string;
    items: SelectedMaterial[];
}
interface CertificatePresentation {
    title: string;
    filePrefix: string;
    confirmation: string;
    signature: string;
    details: MaterialCertificateField[];
}
export type MaterialPhotoDocument = Pick<MaterialCertificateDocument, 'transactionDate' | 'siteName' | 'vehicleNumber'> & { photos: Array<{ file: File }> };

const fileName = (prefix: string, data: Pick<MaterialCertificateDocument, 'transactionDate' | 'siteName' | 'vehicleNumber'>) =>
    `${prefix}_${data.transactionDate}_${data.siteName}_${data.vehicleNumber}`.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '_').slice(0, 150);

export const downloadMaterialCertificateFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const wrapText = (context: CanvasRenderingContext2D, text: string, width: number): string[] => {
    const lines: string[] = [];
    for (const paragraph of (text.trim() || '-').split('\n')) {
        let line = '';
        for (const character of paragraph) {
            if (line && context.measureText(line + character).width > width) { lines.push(line); line = ''; }
            line += character;
        }
        lines.push(line || '-');
    }
    return lines;
};

const jpegBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('문서 이미지를 만들지 못했습니다.')), 'image/jpeg', 0.92);
});

export const createMaterialCertificateImageFile = async (data: MaterialCertificateDocument, presentation: CertificatePresentation): Promise<File> => {
    await document.fonts?.ready;
    const logo = await loadMaterialCertificateLogo();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('증명서 이미지를 만들 수 없습니다.');
    const layout = getMaterialCertificateLayout(data.items, presentation.details, (text, fontSize) => {
        context.font = `500 ${fontSize}px ${FONT}`;
        return context.measureText(text).width;
    });
    const padding = CERTIFICATE_PADDING, tableWidth = PAGE_WIDTH - padding * 2;
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT * layout.pages.length;
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    const cell = (x: number, y: number, width: number, height: number, lines: string[], fontSize: number, lineHeight: number,
        background = '#ffffff', color = '#172b45', bold = false, align: CanvasTextAlign = 'left') => {
        context.fillStyle = background; context.fillRect(x, y, width, height);
        context.strokeStyle = '#cbd5e1'; context.lineWidth = 1; context.strokeRect(x, y, width, height);
        context.fillStyle = color; context.font = `${bold ? 700 : 500} ${fontSize}px ${FONT}`; context.textAlign = align; context.textBaseline = 'middle';
        const textX = align === 'center' ? x + width / 2 : align === 'right' ? x + width - 10 : x + 10;
        lines.forEach((line, index) => context.fillText(line, textX, y + height / 2 + (index - (lines.length - 1) / 2) * lineHeight));
    };
    layout.pages.forEach((page, pageIndex) => {
        context.save(); context.translate(0, pageIndex * PAGE_HEIGHT);
        context.fillStyle = '#183955'; context.fillRect(padding, 32, tableWidth, 5);
        context.textAlign = 'center'; context.textBaseline = 'alphabetic'; context.font = `700 44px ${FONT}`;
        context.fillText(presentation.title, PAGE_WIDTH / 2, 97);
        const rect = getContainedPhotoRect(logo.naturalWidth, logo.naturalHeight, 300, 50);
        context.drawImage(logo, PAGE_WIDTH - padding - 300 + rect.x, 60 + rect.y, rect.width, rect.height);
        let y = CERTIFICATE_META_TOP;
        layout.metadata.forEach(row => {
            let x = padding;
            row.cells.forEach(field => {
                const width = field.wide ? tableWidth : tableWidth / 2;
                cell(x, y, CERTIFICATE_META_LABEL_WIDTH, row.height, [field.label], 20, 25, '#edf3f8', '#46627a', true);
                cell(x + CERTIFICATE_META_LABEL_WIDTH, y, width - CERTIFICATE_META_LABEL_WIDTH, row.height, field.lines, 20, 25);
                x += width;
            });
            y += row.height;
        });
        page.tables.forEach(table => {
            let x = padding + table.offset;
            CERTIFICATE_COLUMN_LABELS.forEach((title, column) => {
                cell(x, layout.tableTop, table.columns[column], CERTIFICATE_TABLE_HEADER_HEIGHT, [title], page.tables.length > 1 ? 18 : 20, 25, '#183955', '#ffffff', true,
                    column === 0 || column === 4 ? 'center' : column === 3 ? 'right' : 'left');
                x += table.columns[column];
            });
            y = layout.tableTop + CERTIFICATE_TABLE_HEADER_HEIGHT;
            table.rows.forEach((row, index) => {
                x = padding + table.offset;
                row.cells.forEach((lines, column) => {
                    cell(x, y, table.columns[column], row.height, lines, page.fontSize, page.lineHeight, index % 2 ? '#f8fafc' : '#ffffff', '#172b45', false,
                        column === 0 || column === 4 ? 'center' : column === 3 ? 'right' : 'left');
                    x += table.columns[column];
                });
                y += row.height;
            });
        });
        context.textAlign = 'center'; context.textBaseline = 'alphabetic'; context.fillStyle = '#46627a'; context.font = `700 22px ${FONT}`;
        context.fillText(presentation.confirmation, PAGE_WIDTH / 2, 1645);
        context.fillStyle = '#a6bacb'; context.fillRect(223, 1680, 318, 1); context.fillRect(699, 1680, 318, 1);
        context.fillStyle = '#60788d'; context.font = `500 19px ${FONT}`;
        context.fillText(presentation.signature.replace(/_+/g, '').trim(), 382, 1710);
        context.fillText('담당자 확인', 858, 1710);
        if (layout.pages.length > 1) {
            context.font = `500 15px ${FONT}`;
            context.fillText(`${pageIndex + 1} / ${layout.pages.length}`, PAGE_WIDTH / 2, 1738);
        }
        context.restore();
    });
    return new File([await jpegBlob(canvas)], `${fileName(presentation.filePrefix, data)}.jpg`, { type: 'image/jpeg' });
};

export const getMaterialPhotoPageLayouts = (count: number) => {
    if (!Number.isInteger(count) || count < 0 || count > MAX_MATERIAL_CERTIFICATE_PHOTOS) throw new Error('첨부사진은 최대 40장까지 저장할 수 있습니다.');
    if (!count) return [];
    const perPage = count <= 20 ? count : Math.ceil(count / 2);
    return Array.from({ length: Math.ceil(count / perPage) }, (_, index) => {
        const start = index * perPage, length = Math.min(perPage, count - start);
        const columns = length <= 2 ? 1 : length <= 6 ? 2 : length <= 12 ? 3 : 4;
        return { start, count: length, columns, rows: Math.ceil(length / columns) };
    });
};

export const getContainedPhotoRect = (sourceWidth: number, sourceHeight: number, width: number, height: number) => {
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    return { x: (width - sourceWidth * scale) / 2, y: (height - sourceHeight * scale) / 2, width: sourceWidth * scale, height: sourceHeight * scale };
};

const loadPhoto = (file: File): Promise<{ image: HTMLImageElement; url: string }> => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`사진을 불러오지 못했습니다: ${file.name}`)); };
    image.src = url;
});

export const createMaterialPhotosPdfFile = async (data: MaterialPhotoDocument, presentation: { title: string; filePrefix: string }): Promise<File> => {
    const layouts = getMaterialPhotoPageLayouts(data.photos.length);
    if (!layouts.length) throw new Error('첨부사진을 선택하세요.');
    await document.fonts?.ready;
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    for (const [pageIndex, layout] of layouts.entries()) {
        const canvas = document.createElement('canvas'); canvas.width = PAGE_WIDTH; canvas.height = PAGE_HEIGHT;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('첨부사진 문서를 만들 수 없습니다.');
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
        context.fillStyle = '#0f172a'; context.font = `700 36px ${FONT}`; context.fillText(presentation.title, 64, 70);
        context.font = `500 20px ${FONT}`;
        const heading = `${data.transactionDate} · ${data.siteName || '현장 미지정'} · ${data.vehicleNumber || '차량 미지정'}`;
        const headerLines = wrapText(context, heading, PAGE_WIDTH - 128);
        headerLines.forEach((line, index) => context.fillText(line, 64, 108 + index * 27));
        const top = 140 + (headerLines.length - 1) * 27, gap = 16;
        const width = (PAGE_WIDTH - 128 - (layout.columns - 1) * gap) / layout.columns;
        const height = (PAGE_HEIGHT - top - 80 - (layout.rows - 1) * gap) / layout.rows;
        for (let index = 0; index < layout.count; index += 1) {
            const x = 64 + index % layout.columns * (width + gap), y = top + Math.floor(index / layout.columns) * (height + gap);
            const loaded = await loadPhoto(data.photos[layout.start + index].file);
            try {
                context.fillStyle = '#f8fafc'; context.fillRect(x, y, width, height);
                context.strokeStyle = '#cbd5e1'; context.strokeRect(x, y, width, height);
                const rect = getContainedPhotoRect(loaded.image.naturalWidth, loaded.image.naturalHeight, width - 16, height - 44);
                context.drawImage(loaded.image, x + 8 + rect.x, y + 8 + rect.y, rect.width, rect.height);
                context.fillStyle = '#475569'; context.textAlign = 'center'; context.font = `600 18px ${FONT}`;
                context.fillText(`사진 ${layout.start + index + 1}`, x + width / 2, y + height - 12);
            } finally { URL.revokeObjectURL(loaded.url); }
        }
        context.textAlign = 'center'; context.fillStyle = '#64748b'; context.font = `500 18px ${FONT}`;
        context.fillText(`${pageIndex + 1} / ${layouts.length} · 전체 ${data.photos.length}장`, PAGE_WIDTH / 2, PAGE_HEIGHT - 35);
        const image = await pdf.embedJpg(await (await jpegBlob(canvas)).arrayBuffer());
        const page = pdf.addPage([595.2756, 841.8898]);
        page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    }
    const bytes = await pdf.save();
    return new File([new Uint8Array(bytes)], `${fileName(presentation.filePrefix, data)}.pdf`, { type: 'application/pdf' });
};
