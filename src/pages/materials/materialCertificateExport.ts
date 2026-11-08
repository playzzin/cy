import type { SelectedMaterial } from './MaterialSelectionActionBar';
import { loadMaterialCertificateLogo } from './materialCertificateBrand';

export const MAX_MATERIAL_CERTIFICATE_PHOTOS = 40;
const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
export interface MaterialCertificateDocument {
    transactionDate: string;
    siteName: string;
    vehicleNumber: string;
    items: SelectedMaterial[];
}
export interface MaterialCertificateField { label: string; value: string; wide?: boolean; }
interface CertificatePresentation {
    title: string;
    filePrefix: string;
    confirmation: string;
    signature: string;
    details: MaterialCertificateField[];
}
export type MaterialPhotoDocument = Pick<MaterialCertificateDocument, 'transactionDate' | 'siteName' | 'vehicleNumber'> & { photos: Array<{ file: File }> };

const formatQuantity = (value: number) => value.toLocaleString('ko-KR');
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
    context.font = `600 23px ${FONT}`;
    const padding = 64, tableWidth = PAGE_WIDTH - padding * 2;
    const details = presentation.details;
    const metaRows: typeof details[] = [];
    details.forEach(detail => {
        const last = metaRows[metaRows.length - 1];
        if (detail.wide || !last || last[0].wide || last.length === 2) metaRows.push([detail]);
        else last.push(detail);
    });
    const metaHeights = metaRows.map(row => Math.max(...row.map(field => wrapText(context, field.value, (field.wide ? tableWidth : tableWidth / 2) - 178).length)) * 32 + 24);
    const columns = [64, 350, 330, 170, tableWidth - 914];
    const itemLines = data.items.map((item, index) => [String(index + 1), item.itemName, item.spec, formatQuantity(item.quantity), item.unit]
        .map((value, column) => wrapText(context, value || '-', columns[column] - 24)));
    const rowHeights = itemLines.map(row => Math.max(...row.map(lines => lines.length)) * 32 + 20);
    const metaTop = 246;
    const tableTop = metaTop + metaHeights.reduce((a, b) => a + b, 0) + 36;
    const tableBottom = tableTop + 54 + rowHeights.reduce((a, b) => a + b, 0);
    canvas.width = PAGE_WIDTH;
    canvas.height = Math.max(PAGE_HEIGHT, tableBottom + 240);
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#183955'; context.fillRect(padding, 36, tableWidth, 8);
    context.textAlign = 'left'; context.fillStyle = '#58778f'; context.font = `700 17px ${FONT}`;
    context.fillText('CHEONGYEON · MATERIALS', padding, 88);
    context.fillStyle = '#183955'; context.font = `700 52px ${FONT}`;
    context.fillText(presentation.title, padding, 153);
    context.fillStyle = '#8294a6'; context.font = `500 16px ${FONT}`;
    context.fillText(presentation.title.includes('입고') ? 'MATERIAL RECEIPT' : 'MATERIAL RELEASE', padding, 188);
    const logoRect = getContainedPhotoRect(logo.naturalWidth, logo.naturalHeight, 350, 80);
    context.drawImage(logo, PAGE_WIDTH - padding - 350 + logoRect.x, 73 + logoRect.y, logoRect.width, logoRect.height);
    context.fillStyle = '#a6bacb'; context.fillRect(padding, 216, tableWidth, 1);
    const cell = (x: number, y: number, width: number, height: number, lines: string[], background = '#ffffff', color = '#0f172a', bold = false) => {
        context.fillStyle = background; context.fillRect(x, y, width, height);
        context.strokeStyle = '#cbd5e1'; context.lineWidth = 1; context.strokeRect(x, y, width, height);
        context.fillStyle = color; context.font = `${bold ? 700 : 500} 23px ${FONT}`; context.textAlign = 'left';
        lines.forEach((line, index) => context.fillText(line, x + 12, y + (height - lines.length * 32) / 2 + 25 + index * 32));
    };
    let y = metaTop;
    metaRows.forEach((row, index) => {
        let x = padding;
        row.forEach(field => {
            const width = field.wide ? tableWidth : tableWidth / 2;
            cell(x, y, 154, metaHeights[index], [field.label], '#edf3f8', '#46627a', true);
            context.font = `600 23px ${FONT}`;
            cell(x + 154, y, width - 154, metaHeights[index], wrapText(context, field.value, width - 178));
            x += width;
        });
        y += metaHeights[index];
    });
    let x = padding;
    ['No', '품명', '규격', '수량', '단위'].forEach((title, index) => { cell(x, tableTop, columns[index], 54, [title], '#183955', '#ffffff', true); x += columns[index]; });
    y = tableTop + 54;
    itemLines.forEach((row, index) => {
        x = padding;
        row.forEach((lines, column) => { cell(x, y, columns[column], rowHeights[index], lines, index % 2 ? '#f8fafc' : '#ffffff'); x += columns[column]; });
        y += rowHeights[index];
    });
    context.textAlign = 'center'; context.fillStyle = '#334155'; context.font = `600 26px ${FONT}`;
    const footer = Math.max(tableBottom + 70, canvas.height - 190);
    context.fillText(presentation.confirmation, PAGE_WIDTH / 2, footer);
    context.fillText(presentation.signature, PAGE_WIDTH * 0.28, footer + 85);
    context.fillText('담당자 확인 __________________', PAGE_WIDTH * 0.72, footer + 85);
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
