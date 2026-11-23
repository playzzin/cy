import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

// Keep fonts, CMaps and image decoders on our own origin, including Korean PDFs.
class LocalPdfDataFactory {
    async fetch({ kind, filename }: { kind: string; filename: string }) {
        if (!/^[\w.-]+$/.test(filename)) throw new Error('Invalid PDF asset');
        const url = kind === 'cMapUrl' ? new URL(`pdfjs-dist/cmaps/${filename}`, import.meta.url)
            : kind === 'standardFontDataUrl' ? new URL(`pdfjs-dist/standard_fonts/${filename}`, import.meta.url)
                : kind === 'wasmUrl' ? new URL(`pdfjs-dist/wasm/${filename}`, import.meta.url) : null;
        if (!url) throw new Error('Unknown PDF asset');
        const response = await fetch(url);
        if (!response.ok) throw new Error('PDF asset unavailable');
        return new Uint8Array(await response.arrayBuffer());
    }
}

export const openPdfDocument = (url: string) => getDocument({ url, BinaryDataFactory: LocalPdfDataFactory, useWorkerFetch: false });

export function renderPdfThumbnail(url: string, canvas: HTMLCanvasElement) {
    const task = openPdfDocument(url);
    const promise = task.promise.then(async document => {
        const page = await document.getPage(1);
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(1.5, 640 / original.width) });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        return document.numPages;
    });
    return { promise, destroy: () => { void task.destroy().catch(() => undefined); } };
}
