import type { Options } from 'html2canvas/dist/types';

export const certificateImageFilename = (title: string) =>
    Array.from(`${title}.png`).map(char => char.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(char) ? '_' : char).join('');

const imageDataUrl = async (source: string): Promise<string> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error('stamp unavailable');
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('stamp unreadable'));
            reader.readAsDataURL(blob);
        });
    } finally {
        window.clearTimeout(timeout);
    }
};

export const captureCertificateImage = async (element: HTMLDivElement): Promise<Blob> => {
    await document.fonts?.ready;
    // Inline stamps before capture: html2canvas otherwise silently omits failed CORS images.
    const images = await Promise.all(Array.from(element.querySelectorAll('img')).map(img => imageDataUrl(img.currentSrc || img.src)));
    const { default: html2canvas } = await import('html2canvas');
    const options: Partial<Options> = {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        logging: false,
        windowWidth: 1200,
        scrollX: 0,
        scrollY: 0,
        onclone: async (clonedDocument, clonedElement) => {
            // Preserve A4 dimensions regardless of mobile preview zoom or hidden panels.
            clonedDocument.body.appendChild(clonedElement);
            Object.assign(clonedElement.style, {
                width: '210mm', minWidth: '210mm', maxWidth: 'none', height: 'auto',
                maxHeight: 'none', overflow: 'visible', margin: '0', display: 'block',
                position: 'absolute', left: '0', top: '0', transform: 'none',
            });
            await Promise.all(Array.from(clonedElement.querySelectorAll('img')).map(async (img, index) => {
                img.src = images[index];
                img.removeAttribute('srcset');
                await img.decode();
            }));
        },
    };
    const canvas = await html2canvas(element, options);
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error('증명서 이미지를 만들지 못했습니다.')), 'image/png');
    });
};
