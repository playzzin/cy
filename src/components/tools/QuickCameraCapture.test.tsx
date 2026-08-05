/* eslint-disable testing-library/no-node-access */
import React from 'react';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import html2canvas from 'html2canvas';
import QuickCameraCapture, {
    getFrameSourceRect,
    getHighResolutionDisplayMediaConstraints,
    getPermissionFreeCaptureScale,
    hideFixedAndStickyInterference,
    isFrameAspectCompatible,
    makeCaptureTextCloneSafe,
    waitForCapturedFrame
} from './QuickCameraCapture';

jest.mock('html2canvas', () => jest.fn());

const html2canvasMock = html2canvas as jest.MockedFunction<typeof html2canvas>;
const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalClipboardItem = Object.getOwnPropertyDescriptor(window, 'ClipboardItem');
const originalElementsFromPoint = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint');
const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const originalCanvasGetContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
const originalCanvasToBlob = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toBlob');
const originalMediaReadyState = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState');
const originalMediaPaused = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'paused');
const originalMediaPlay = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'play');
const originalMediaPause = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'pause');
const originalVideoWidth = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoWidth');
const originalVideoHeight = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoHeight');

const restoreProperty = (
    target: object,
    property: PropertyKey,
    descriptor: PropertyDescriptor | undefined
) => {
    if (descriptor) {
        Object.defineProperty(target, property, descriptor);
        return;
    }
    delete (target as Record<PropertyKey, unknown>)[property];
};

const setWindowNumber = (
    property: 'innerWidth' | 'innerHeight',
    value: number
) => {
    Object.defineProperty(window, property, { configurable: true, value });
};

class ClipboardItemMock {
    constructor(readonly items: Record<string, Blob | Promise<Blob>>) {}
}

describe('capture geometry', () => {
    it('requests at least 2x pixels for the explicit full-board export', () => {
        expect(getPermissionFreeCaptureScale({ width: 800, height: 600 }, 1)).toBe(2);
        expect(getPermissionFreeCaptureScale({ width: 3840, height: 2160 }, 2)).toBe(2);
    });

    it('requests a high-resolution source for the optional shared-screen mode', () => {
        expect(getHighResolutionDisplayMediaConstraints(
            { width: 800, height: 600 },
            1
        )).toEqual({
            frameRate: { ideal: 30, max: 30 },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
            cursor: 'never',
            resizeMode: 'none'
        });
    });

    it('maps CSS selection coordinates to the matching source pixels', () => {
        expect(getFrameSourceRect(
            1200,
            900,
            { left: 100, top: 120, width: 300, height: 200 },
            { width: 800, height: 600 }
        )).toEqual({
            sourceX: 150,
            sourceY: 180,
            sourceW: 450,
            sourceH: 300,
            scaleX: 1.5,
            scaleY: 1.5
        });
        expect(isFrameAspectCompatible(1600, 1200, { width: 800, height: 600 })).toBe(true);
    });

    it('adds enough clone-only line height for Korean board labels', () => {
        const clonedDocument = document.implementation.createHTMLDocument('capture clone');
        const label = clonedDocument.createElement('span');
        label.dataset.captureTextSafe = 'true';
        label.style.fontSize = '12px';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.transform = 'translateY(1px)';
        label.textContent = '현장이름 차량번호';
        clonedDocument.body.appendChild(label);

        makeCaptureTextCloneSafe(clonedDocument);

        expect(label.style.lineHeight).toBe('18px');
        expect(label.style.height).toBe('22px');
        expect(label.style.minHeight).toBe('22px');
        expect(label.style.display).toBe('flex');
        expect(label.style.alignItems).toBe('center');
        expect(label.style.justifyContent).toBe('center');
        expect(label.style.paddingTop).toBe('0px');
        expect(label.style.paddingBottom).toBe('0px');
        expect(label.style.overflow).toBe('visible');
        expect(label.style.transform).toBe('none');
    });
});

describe('QuickCameraCapture exact-pixel current-tab capture', () => {
    let getDisplayMedia: jest.Mock;
    let clipboardWrite: jest.Mock;
    let drawImage: jest.Mock;
    let stopTrack: jest.Mock;
    let applyConstraints: jest.Mock;
    let toBlob: jest.Mock;

    beforeEach(() => {
        setWindowNumber('innerWidth', 800);
        setWindowNumber('innerHeight', 600);
        getDisplayMedia = jest.fn();
        clipboardWrite = jest.fn().mockResolvedValue(undefined);
        drawImage = jest.fn();
        stopTrack = jest.fn();
        applyConstraints = jest.fn().mockResolvedValue(undefined);
        toBlob = jest.fn((callback: BlobCallback) => {
            callback(new Blob(['fast-capture'], { type: 'image/png' }));
        });
        const track = {
            readyState: 'live',
            stop: stopTrack,
            applyConstraints,
            getSettings: () => ({ displaySurface: 'browser' })
        };
        getDisplayMedia.mockResolvedValue({
            getTracks: () => [track],
            getVideoTracks: () => [track]
        });
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getDisplayMedia }
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { write: clipboardWrite }
        });
        Object.defineProperty(window, 'ClipboardItem', {
            configurable: true,
            value: ClipboardItemMock
        });
        Object.defineProperty(document, 'elementsFromPoint', {
            configurable: true,
            value: jest.fn(() => [])
        });
        Object.defineProperty(window, 'requestAnimationFrame', {
            configurable: true,
            value: jest.fn((callback: FrameRequestCallback) => {
                callback(0);
                return 1;
            })
        });
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: jest.fn(() => 'blob:quick-camera-preview')
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: jest.fn()
        });
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value: jest.fn(() => ({ drawImage }))
        });
        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            configurable: true,
            value: toBlob
        });
        Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
            configurable: true,
            get: () => HTMLMediaElement.HAVE_CURRENT_DATA
        });
        Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
            configurable: true,
            get: () => false
        });
        Object.defineProperty(HTMLMediaElement.prototype, 'play', {
            configurable: true,
            value: jest.fn().mockResolvedValue(undefined)
        });
        Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
            configurable: true,
            value: jest.fn()
        });
        Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
            configurable: true,
            get: () => 1600
        });
        Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
            configurable: true,
            get: () => 1200
        });

        const viewportCanvas = document.createElement('canvas');
        Object.defineProperties(viewportCanvas, {
            width: { configurable: true, value: 1600, writable: true },
            height: { configurable: true, value: 1200, writable: true }
        });
        html2canvasMock.mockResolvedValue(viewportCanvas);
    });

    afterEach(() => {
        cleanup();
        html2canvasMock.mockReset();
        restoreProperty(window, 'innerWidth', originalInnerWidth);
        restoreProperty(window, 'innerHeight', originalInnerHeight);
        restoreProperty(navigator, 'mediaDevices', originalMediaDevices);
        restoreProperty(navigator, 'clipboard', originalClipboard);
        restoreProperty(window, 'ClipboardItem', originalClipboardItem);
        restoreProperty(document, 'elementsFromPoint', originalElementsFromPoint);
        restoreProperty(window, 'requestAnimationFrame', originalRequestAnimationFrame);
        restoreProperty(URL, 'createObjectURL', originalCreateObjectURL);
        restoreProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
        restoreProperty(HTMLCanvasElement.prototype, 'getContext', originalCanvasGetContext);
        restoreProperty(HTMLCanvasElement.prototype, 'toBlob', originalCanvasToBlob);
        restoreProperty(HTMLMediaElement.prototype, 'readyState', originalMediaReadyState);
        restoreProperty(HTMLMediaElement.prototype, 'paused', originalMediaPaused);
        restoreProperty(HTMLMediaElement.prototype, 'play', originalMediaPlay);
        restoreProperty(HTMLMediaElement.prototype, 'pause', originalMediaPause);
        restoreProperty(HTMLVideoElement.prototype, 'videoWidth', originalVideoWidth);
        restoreProperty(HTMLVideoElement.prototype, 'videoHeight', originalVideoHeight);
        jest.restoreAllMocks();
    });

    it('selects from a frozen real frame and crops the matching source pixels', async () => {
        render(
            <aside data-capture-exclude="true">
                <QuickCameraCapture />
            </aside>
        );

        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        const overlay = await waitFor(() => {
            const element = document.querySelector<HTMLElement>('[data-capture-overlay="true"]');
            expect(element).toBeInTheDocument();
            expect(document.querySelector('[data-frozen-capture-preview="true"]')).toBeInTheDocument();
            return element as HTMLElement;
        });
        expect(toBlob).not.toHaveBeenCalled();
        expect(document.querySelector<HTMLElement>('[data-capture-exclude="true"]')?.style.visibility).toBe('hidden');

        fireEvent(overlay, new MouseEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: 100,
            clientY: 120
        }));
        fireEvent(window, new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 400,
            clientY: 320
        }));
        fireEvent(window, new MouseEvent('pointerup', {
            bubbles: true,
            button: 0,
            clientX: 400,
            clientY: 320
        }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: '캡처 후 클립보드 복사' })).toBeInTheDocument();
        });
        expect(html2canvasMock).not.toHaveBeenCalled();
        expect(clipboardWrite).not.toHaveBeenCalled();
        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
        expect(document.querySelector<HTMLElement>('[data-capture-exclude="true"]')?.style.visibility).toBe('hidden');

        fireEvent.click(screen.getByRole('button', { name: '캡처 후 클립보드 복사' }));

        await waitFor(() => {
            expect(clipboardWrite).toHaveBeenCalledTimes(1);
            expect(document.querySelector('[data-capture-overlay="true"]')).not.toBeInTheDocument();
            expect(document.querySelector<HTMLElement>('[data-capture-exclude="true"]')?.style.visibility).toBe('');
        });

        expect(html2canvasMock).not.toHaveBeenCalled();
        expect(drawImage).toHaveBeenCalledWith(
            expect.any(HTMLCanvasElement),
            200,
            240,
            600,
            400,
            0,
            0,
            600,
            400
        );
        expect(stopTrack).not.toHaveBeenCalled();
    });

    it('uses an already drawable frame when the browser frame callback stalls', async () => {
        const video = document.createElement('video');
        Object.defineProperty(video, 'requestVideoFrameCallback', {
            configurable: true,
            value: jest.fn()
        });

        await expect(waitForCapturedFrame(video, 1, true)).resolves.toBeUndefined();
    });

    it('reuses the approved current tab for the next real-frame selection', async () => {
        render(<QuickCameraCapture />);

        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        let overlay = await waitFor(() => {
            const element = document.querySelector<HTMLElement>('[data-capture-overlay="true"]');
            expect(element).toBeInTheDocument();
            return element as HTMLElement;
        });
        fireEvent(overlay, new MouseEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: 100,
            clientY: 120
        }));
        fireEvent(window, new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 400,
            clientY: 320
        }));
        fireEvent(window, new MouseEvent('pointerup', {
            bubbles: true,
            button: 0,
            clientX: 400,
            clientY: 320
        }));
        fireEvent.click(await screen.findByRole('button', { name: '캡처 후 클립보드 복사' }));
        await waitFor(() => {
            expect(document.querySelector('[data-capture-overlay="true"]')).not.toBeInTheDocument();
            expect(clipboardWrite).toHaveBeenCalledTimes(1);
            expect(screen.getByRole('button', { name: '새 실제 영역 선택' })).toBeEnabled();
        });

        fireEvent.click(screen.getByRole('button', { name: '새 실제 영역 선택' }));
        overlay = await waitFor(() => {
            const element = document.querySelector<HTMLElement>('[data-capture-overlay="true"]');
            expect(element).toBeInTheDocument();
            expect(document.querySelector('[data-frozen-capture-preview="true"]')).toBeInTheDocument();
            return element as HTMLElement;
        });

        expect(overlay).toBeInTheDocument();
        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
        expect(html2canvasMock).not.toHaveBeenCalled();
    });

    it('keeps the explicit full-board export available below the visible viewport', async () => {
        const fullBoard = document.createElement('div');
        fullBoard.dataset.captureFullContent = 'true';
        Object.defineProperties(fullBoard, {
            scrollWidth: { configurable: true, value: 800 },
            scrollHeight: { configurable: true, value: 1200 },
            clientWidth: { configurable: true, value: 800 },
            clientHeight: { configurable: true, value: 600 }
        });
        document.body.appendChild(fullBoard);

        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        const overlay = await waitFor(() => {
            const element = document.querySelector<HTMLElement>('[data-capture-overlay="true"]');
            expect(element).toBeInTheDocument();
            return element as HTMLElement;
        });
        fireEvent(overlay, new MouseEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: 100,
            clientY: 120
        }));
        fireEvent(window, new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 400,
            clientY: 320
        }));
        fireEvent(window, new MouseEvent('pointerup', {
            bubbles: true,
            button: 0,
            clientX: 400,
            clientY: 320
        }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: '보드 전체 (아래까지)' })).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: '보드 전체 (아래까지)' }));

        await waitFor(() => {
            expect(html2canvasMock).toHaveBeenCalledWith(fullBoard, expect.objectContaining({
                scale: 2,
                width: 800,
                height: 1200,
                windowWidth: 800,
                windowHeight: 1200
            }));
            expect(clipboardWrite).toHaveBeenCalledTimes(1);
        });
        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
        fullBoard.remove();
    });
});

describe('scroll capture interference cleanup', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('hides vertical sticky and fixed UI inside a scroller but preserves horizontal sticky cells', () => {
        const target = document.createElement('div');
        target.style.overflowY = 'auto';
        const verticalSticky = document.createElement('div');
        verticalSticky.style.position = 'sticky';
        verticalSticky.style.top = '0px';
        const horizontalSticky = document.createElement('div');
        horizontalSticky.style.position = 'sticky';
        horizontalSticky.style.left = '0px';
        const fixedChild = document.createElement('div');
        fixedChild.style.position = 'fixed';
        target.append(verticalSticky, horizontalSticky, fixedChild);
        document.body.appendChild(target);

        const rect = (top: number, height: number) => ({
            x: 0, y: top, top, right: 300, bottom: top + height, left: 0, width: 300, height,
            toJSON: () => ({})
        });
        jest.spyOn(verticalSticky, 'getBoundingClientRect').mockReturnValue(rect(0, 40));
        jest.spyOn(horizontalSticky, 'getBoundingClientRect').mockReturnValue(rect(40, 100));
        jest.spyOn(fixedChild, 'getBoundingClientRect').mockReturnValue(rect(0, 24));

        const hidden = hideFixedAndStickyInterference(target);

        expect(hidden.hiddenCount).toBe(2);
        expect(verticalSticky.style.visibility).toBe('hidden');
        expect(fixedChild.style.visibility).toBe('hidden');
        expect(horizontalSticky.style.visibility).toBe('');

        hidden.restore();
        expect(verticalSticky.style.visibility).toBe('');
        expect(fixedChild.style.visibility).toBe('');
    });
});
