import html2canvas from 'html2canvas';

export const payslipImageFilename = (workerName: string, month: string) =>
    Array.from(`급여명세서_${workerName}_${month}.png`)
        .map(character => character.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(character) ? '_' : character).join('');

export const capturePayslipImage = async (element: HTMLDivElement): Promise<Blob> => {
    await document.fonts?.ready;
    const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        logging: false,
        windowWidth: 1200,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDocument, clonedElement) => {
            // Capture the entire document at a readable width on phones as well.
            // Moving only the clone avoids clipping by the screen's scroll panels.
            clonedDocument.body.appendChild(clonedElement);
            Object.assign(clonedElement.style, {
                width: '960px', minWidth: '960px', maxWidth: 'none', height: 'auto',
                maxHeight: 'none', overflow: 'visible', margin: '0',
                position: 'absolute', left: '0', top: '0', transform: 'none',
            });
        },
    });
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob?.size) resolve(blob);
            else reject(new Error('급여명세서 이미지를 만들지 못했습니다.'));
        }, 'image/png');
    });
};
