/* eslint-disable testing-library/no-node-access */
import React from 'react';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import html2canvas from 'html2canvas';
import QuickCameraCapture, {
    getContentYForViewportPoint,
    getFrameSourceRect,
    getHighResolutionDisplayMediaConstraints,
    getPermissionFreeCaptureScale,
    getScrollCaptureFailureMessage,
    getScreenCaptureFailureMessage,
    hideFixedAndStickyInterference,
    isFrameAspectCompatible,
    makeCaptureTextCloneSafe,
    resolveScrollRangeCapturePlan,
    waitForCapturedFrame
} from './QuickCameraCapture';
import LayoutBottomPanel from '../layout/LayoutBottomPanel';
import * as frameReadiness from './captureFrameReadiness';

jest.mock('html2canvas', () => jest.fn());

const html2canvasMock = html2canvas as jest.MockedFunction<typeof html2canvas>;
const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
const originalPixelRatio = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalClipboardItem = Object.getOwnPropertyDescriptor(window, 'ClipboardItem');
const originalElementsFromPoint = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint');
const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(window, 'cancelAnimationFrame');
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
const originalRequestVideoFrameCallback = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'requestVideoFrameCallback');

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
        const largeScale = getPermissionFreeCaptureScale({ width: 3840, height: 2160 }, 2);
        expect(3840 * 2160 * largeScale * largeScale).toBeLessThanOrEqual(12_000_001);
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

    it('returns actionable messages for browser capture failures', () => {
        expect(getScreenCaptureFailureMessage(
            new DOMException('user activation required', 'InvalidStateError')
        )).toContain('현재 앱 탭을 활성화');
        expect(getScreenCaptureFailureMessage(new Error('video-frame-timeout'))).toContain('영상 프레임');
        expect(getScreenCaptureFailureMessage(new Error('track-ended'))).toContain('화면 공유가 종료');
        expect(getScrollCaptureFailureMessage(
            new DOMException('user activation required', 'InvalidStateError')
        )).toContain('현재 앱 탭을 활성화');
        expect(getScrollCaptureFailureMessage(new Error('scroll-frame-gap'))).toContain('프레임이 건너뛰어');
    });

    it('maps partially clipped scrollers and clamps the range to the target width', () => {
        const target = document.createElement('div');
        target.style.overflowY = 'auto';
        document.body.appendChild(target);
        Object.defineProperties(target, {
            clientHeight: { configurable: true, value: 600 },
            clientWidth: { configurable: true, value: 500 },
            scrollHeight: { configurable: true, value: 2000 },
            scrollTop: { configurable: true, value: 300, writable: true }
        });
        target.getBoundingClientRect = () => ({
            x: 200,
            y: -100,
            left: 200,
            top: -100,
            right: 700,
            bottom: 500,
            width: 500,
            height: 600,
            toJSON: () => ({})
        });

        expect(getContentYForViewportPoint(target, 10)).toBe(410);

        const anchor = {
            point: { x: 250, y: 10 },
            target,
            scrollTop: 300,
            contentY: 410
        };
        target.scrollTop = 900;
        const plan = resolveScrollRangeCapturePlan(anchor, { x: 760, y: 400 });

        expect(plan.range).toEqual(expect.objectContaining({
            left: 250,
            width: 450,
            topContentY: 410,
            bottomContentY: 1400
        }));
        expect(plan.captureRect.left).toBe(250);
        expect(plan.captureRect.width).toBe(450);
        target.remove();
    });
});

describe('QuickCameraCapture exact-pixel current-tab capture', () => {
    let getDisplayMedia: jest.Mock;
    let clipboardWrite: jest.Mock;
    let drawImage: jest.Mock;
    let stopTrack: jest.Mock;
    let applyConstraints: jest.Mock;
    let getTrackConstraints: jest.Mock;
    let addTrackEventListener: jest.Mock;
    let removeTrackEventListener: jest.Mock;
    let toBlob: jest.Mock;

    beforeEach(() => {
        setWindowNumber('innerWidth', 800);
        setWindowNumber('innerHeight', 600);
        getDisplayMedia = jest.fn();
        clipboardWrite = jest.fn().mockResolvedValue(undefined);
        drawImage = jest.fn();
        stopTrack = jest.fn();
        applyConstraints = jest.fn().mockResolvedValue(undefined);
        getTrackConstraints = jest.fn().mockReturnValue({ width: { ideal: 1600 }, height: { ideal: 1200 }, frameRate: { ideal: 30, max: 30 }, resizeMode: 'none' });
        addTrackEventListener = jest.fn();
        removeTrackEventListener = jest.fn();
        toBlob = jest.fn((callback: BlobCallback) => {
            callback(new Blob(['fast-capture'], { type: 'image/png' }));
        });
        let captureHandle = '';
        const track = {
            readyState: 'live',
            stop: stopTrack,
            applyConstraints,
            getConstraints: getTrackConstraints,
            addEventListener: addTrackEventListener,
            removeEventListener: removeTrackEventListener,
            getSettings: () => ({ displaySurface: 'browser' }),
            getCaptureHandle: () => ({ handle: captureHandle })
        };
        getDisplayMedia.mockResolvedValue({
            getTracks: () => [track],
            getVideoTracks: () => [track]
        });
        Object.defineProperty(navigator, 'mediaDevices', {
            configurable: true,
            value: { getDisplayMedia, setCaptureHandleConfig: (config: { handle: string }) => { captureHandle = config.handle; } }
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
        Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: jest.fn() });
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
        restoreProperty(window, 'devicePixelRatio', originalPixelRatio);
        restoreProperty(navigator, 'mediaDevices', originalMediaDevices);
        restoreProperty(navigator, 'clipboard', originalClipboard);
        restoreProperty(window, 'ClipboardItem', originalClipboardItem);
        restoreProperty(document, 'elementsFromPoint', originalElementsFromPoint);
        restoreProperty(window, 'requestAnimationFrame', originalRequestAnimationFrame);
        restoreProperty(window, 'cancelAnimationFrame', originalCancelAnimationFrame);
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
        restoreProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', originalRequestVideoFrameCallback);
        jest.restoreAllMocks();
    });

    const chooseRectangle = async () => {
        const overlay = await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' });
        fireEvent(overlay, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 120 }));
        fireEvent(window, new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 400, clientY: 320 }));
    };

    it('starts with sharp capture instead of shrinking a high-DPI display by default', () => {
        render(<QuickCameraCapture />);
        expect(screen.getByRole('combobox', { name: '캡처 화질' })).toHaveValue('high');
    });

    it.each(['screen', 'scroll'])('preserves source pixels while hiding the cursor for %s capture', async (mode) => {
        let sourceWidth = 1600;
        Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => sourceWidth });
        Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => sourceWidth * 0.75 });
        // applyConstraints replaces constraints, including omitted dimensions.
        applyConstraints.mockImplementation((constraints: MediaTrackConstraints) => {
            sourceWidth = (constraints.width as ConstrainULongRange)?.ideal as number || 800;
            return Promise.resolve();
        });
        render(<QuickCameraCapture />);
        fireEvent.change(screen.getByRole('combobox', { name: '캡처 화질' }), { target: { value: 'high' } });
        if (mode === 'scroll') fireEvent.click(screen.getByRole('radio', { name: /긴 화면 구간/ }));
        fireEvent.click(screen.getByRole('button', { name: mode === 'scroll' ? '스크롤 구간 선택 시작' : '실제 영역 선택 시작' }));
        const overlay = await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' });
        fireEvent(overlay, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 120 }));
        fireEvent(mode === 'scroll' ? overlay : window, new MouseEvent(mode === 'scroll' ? 'pointerdown' : 'pointerup', { bubbles: true, button: 0, clientX: 400, clientY: 320 }));
        if (mode === 'screen') fireEvent.click(screen.getByRole('button', { name: '캡처 후 클립보드 복사' }));
        expect(await screen.findByAltText('최근 캡처 미리보기')).toBeInTheDocument();
        expect(sourceWidth).toBe(1600);
        expect(screen.getByText('600 × 400 px')).toBeInTheDocument();
        expect(applyConstraints).toHaveBeenCalledWith(expect.objectContaining({
            width: { ideal: 1600 }, height: { ideal: 1200 }, resizeMode: 'none', cursor: 'never'
        }));
    });

    it('preserves the native 4K frame before cropping small text at the default quality', async () => {
        setWindowNumber('innerWidth', 1920);
        setWindowNumber('innerHeight', 1080);
        Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 3840 });
        Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 2160 });
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        await chooseRectangle();
        expect(drawImage).toHaveBeenCalledWith(expect.any(HTMLVideoElement), 0, 0, 3840, 2160);
        fireEvent.click(screen.getByRole('button', { name: '캡처 후 클립보드 복사' }));
        await screen.findByAltText('최근 캡처 미리보기');
        expect(screen.getByText('600 × 400 px')).toBeInTheDocument();
    });

    it('does not leave future captures at reduced quality after a temporary preparation timeout', async () => {
        jest.spyOn(frameReadiness, 'prepareCaptureVideo')
            .mockRejectedValueOnce(new Error('video-load-timeout')).mockResolvedValue(undefined);
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        await chooseRectangle();
        fireEvent.click(screen.getByRole('button', { name: '캡처 후 클립보드 복사' }));
        await screen.findByAltText('최근 캡처 미리보기');
        expect(screen.getByRole('combobox', { name: '캡처 화질' })).toHaveValue('high');
        expect(screen.getByText(/이번 캡처만 표준 화질/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '새 실제 영역 선택' }));
        await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' });
        expect(getDisplayMedia).toHaveBeenCalledTimes(2);
        expect(getDisplayMedia.mock.calls[1][0].video).toMatchObject({ width: { ideal: 1600 }, height: { ideal: 1200 }, resizeMode: 'none' });
    });

    it('rejects a different browser tab before selection opens', async () => {
        jest.spyOn(navigator.mediaDevices as MediaDevices & { setCaptureHandleConfig: (config: unknown) => void }, 'setCaptureHandleConfig').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        expect(await screen.findByText(/다른 탭이 선택되었습니다/)).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: '화면 캡처 영역 선택' })).not.toBeInTheDocument();
        expect(stopTrack).toHaveBeenCalledTimes(1);
    });

    it('requires visible source confirmation on browsers without capture identity', async () => {
        Object.defineProperty(navigator.mediaDevices, 'setCaptureHandleConfig', { value: undefined });
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        await chooseRectangle();
        expect(screen.getByRole('button', { name: '캡처 후 클립보드 복사' })).toBeDisabled();
        expect(clipboardWrite).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '현재 앱 화면이 맞습니다' }));
        fireEvent.click(screen.getByRole('button', { name: '캡처 후 클립보드 복사' }));
        expect(await screen.findByAltText('최근 캡처 미리보기')).toBeInTheDocument();
    });

    it('invalidates selection when browser geometry changes', async () => {
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        await chooseRectangle();
        setWindowNumber('innerWidth', 900);
        fireEvent(window, new Event('resize'));
        expect(screen.queryByRole('dialog', { name: '화면 캡처 영역 선택' })).not.toBeInTheDocument();
        expect(screen.getByText(/화면 크기 또는 배율이 바뀌었습니다/)).toBeInTheDocument();
        expect(clipboardWrite).not.toHaveBeenCalled();
    });

    it('keeps the PNG accessible even when clipboard writing never settles', async () => {
        clipboardWrite.mockReturnValue(new Promise(() => {}));
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        await chooseRectangle();
        fireEvent.click(screen.getByRole('button', { name: '캡처 후 클립보드 복사' }));
        expect(await screen.findByAltText('최근 캡처 미리보기')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^PNG 저장$/ })).toBeEnabled();
        expect(await screen.findByText(/복사 응답이 지연되고 있습니다/, {}, { timeout: 4500 })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '새 실제 영역 선택' })).toBeEnabled();
    }, 10000);

    it('keeps history and the last region across camera panel close and reopen', async () => {
        const props = { togglePanel: jest.fn(), activeTool: 'camera' as const };
        const view = render(<LayoutBottomPanel {...props} isOpen />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        await chooseRectangle();
        fireEvent.click(screen.getByRole('button', { name: '캡처 후 클립보드 복사' }));
        await waitFor(() => expect(screen.getByRole('button', { name: '마지막 영역 다시 캡처' })).toBeEnabled());
        view.rerender(<LayoutBottomPanel {...props} isOpen={false} />);
        expect(stopTrack).toHaveBeenCalledTimes(1);
        view.rerender(<LayoutBottomPanel {...props} isOpen />);
        expect(screen.getByAltText('최근 캡처 미리보기')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: '마지막 영역 다시 캡처' }));
        expect(await screen.findByRole('button', { name: '캡처 후 클립보드 복사' })).toBeInTheDocument();
        expect(document.querySelector('[data-selection-box="true"]')).toHaveStyle({ left: '100px', top: '120px', width: '300px', height: '200px' });
        expect(getDisplayMedia).toHaveBeenCalledTimes(2);
    });

    it('prepares a fresh frame with the last region during continuous capture', async () => {
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('checkbox', { name: /캡처 후 다음 화면 준비/ }));
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        await chooseRectangle();
        fireEvent.click(screen.getByRole('button', { name: '캡처 후 클립보드 복사' }));
        expect(await screen.findByRole('button', { name: '캡처 후 클립보드 복사' })).toBeInTheDocument();
        expect(clipboardWrite).toHaveBeenCalledTimes(1);
        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: '화면 캡처 영역 선택' })).not.toBeInTheDocument();
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
            return element as HTMLElement;
        });
        expect(document.querySelector('[data-frozen-capture-preview="true"]')).toBeInTheDocument();
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
        });
        expect(document.querySelector('[data-capture-overlay="true"]')).not.toBeInTheDocument();
        expect(document.querySelector<HTMLElement>('[data-capture-exclude="true"]')?.style.visibility).toBe('');

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

    it('requests display permission synchronously from the button gesture', () => {
        const queuedAnimationFrames: FrameRequestCallback[] = [];
        Object.defineProperty(window, 'requestAnimationFrame', {
            configurable: true,
            value: jest.fn((callback: FrameRequestCallback) => {
                queuedAnimationFrames.push(callback);
                return queuedAnimationFrames.length;
            })
        });
        getDisplayMedia.mockReturnValue(new Promise(() => {}));

        render(
            <aside data-capture-exclude="true">
                <QuickCameraCapture />
            </aside>
        );
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));

        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
        expect(queuedAnimationFrames).toHaveLength(0);
        const hostPanel = document.querySelector<HTMLElement>('[data-capture-exclude="true"]');
        expect(hostPanel?.style.visibility).toBe('hidden');
        expect(hostPanel?.style.pointerEvents).toBe('none');
    });

    it('keeps long-page capture available without an extra confirmation for a safe range', async () => {
        const confirmCapture = jest.spyOn(window, 'confirm').mockReturnValue(true);

        render(
            <aside data-capture-exclude="true">
                <QuickCameraCapture />
            </aside>
        );

        fireEvent.click(screen.getByRole('radio', { name: /긴 화면 구간/ }));
        fireEvent.click(screen.getByRole('button', { name: '스크롤 구간 선택 시작' }));

        const overlay = await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' });
        expect(overlay).toBeInTheDocument();

        fireEvent(overlay as HTMLElement, new MouseEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: 100,
            clientY: 120
        }));
        fireEvent(overlay as HTMLElement, new MouseEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: 400,
            clientY: 320
        }));

        expect(confirmCapture).not.toHaveBeenCalled();
        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
        expect(clipboardWrite).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(clipboardWrite).toHaveBeenCalledTimes(1);
        });
    });

    it('captures a long range when the sharing UI changes viewport height during permission', async () => {
        const originalRequest = getDisplayMedia.getMockImplementation()!;
        getDisplayMedia.mockImplementation(() => {
            // Chromium can lay out a sharing infobar when sharing starts.
            setWindowNumber('innerHeight', 550);
            window.dispatchEvent(new Event('resize'));
            return originalRequest();
        });
        Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
            configurable: true, get: () => window.innerHeight * 2
        });
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('radio', { name: /긴 화면 구간/ }));
        fireEvent.click(screen.getByRole('button', { name: '스크롤 구간 선택 시작' }));
        const overlay = await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' });
        fireEvent(overlay, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 120 }));
        fireEvent(overlay, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 400, clientY: 320 }));
        expect(await screen.findByText(/선택한 긴 화면을 끝까지 확인해 PNG로 만들고 복사했습니다/)).toBeInTheDocument();
        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
        expect(stopTrack).toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '마지막 캡처 복사' }));
        await waitFor(() => expect(clipboardWrite).toHaveBeenCalledTimes(2));
        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    });

    it('keeps the long-page selection open after a too-small range so it can be retried', async () => {
        render(
            <aside data-capture-exclude="true">
                <QuickCameraCapture />
            </aside>
        );

        fireEvent.click(screen.getByRole('radio', { name: /긴 화면 구간/ }));
        fireEvent.click(screen.getByRole('button', { name: '스크롤 구간 선택 시작' }));
        const overlay = await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' });

        fireEvent(overlay as HTMLElement, new MouseEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: 100,
            clientY: 100
        }));
        fireEvent(overlay as HTMLElement, new MouseEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: 105,
            clientY: 105
        }));

        expect(document.querySelector('[data-capture-overlay="true"]')).toBeInTheDocument();
        expect(screen.getAllByText(/선택 화면을 유지했으니 시작점을 다시 지정/)).toHaveLength(2);
        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    });

    it('offers an on-screen cancel action for long-page selection', async () => {
        render(
            <aside data-capture-exclude="true">
                <QuickCameraCapture />
            </aside>
        );

        fireEvent.click(screen.getByRole('radio', { name: /긴 화면 구간/ }));
        fireEvent.click(screen.getByRole('button', { name: '스크롤 구간 선택 시작' }));
        fireEvent.click(await screen.findByRole('button', { name: '긴 화면 구간 선택 취소' }));

        expect(document.querySelector('[data-capture-overlay="true"]')).not.toBeInTheDocument();
        expect(document.querySelector<HTMLElement>('[data-capture-exclude="true"]')?.style.visibility).toBe('');
        expect(stopTrack).toHaveBeenCalled();
    });

    it.each(['resize', 'dpi'])('invalidates long-range coordinates after a real %s change', async (change) => {
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('radio', { name: /긴 화면 구간/ }));
        fireEvent.click(screen.getByRole('button', { name: '스크롤 구간 선택 시작' }));
        const overlay = await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' });
        fireEvent(overlay, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 120 }));
        if (change === 'resize') setWindowNumber('innerHeight', 550);
        else Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1.25 });
        // Even a browser that does not dispatch resize before the next pointer
        // gesture must never use the stale start point.
        fireEvent(overlay, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 400, clientY: 320 }));
        expect(screen.queryByRole('dialog', { name: '화면 캡처 영역 선택' })).not.toBeInTheDocument();
        expect(screen.getByText(/화면 크기 또는 배율이 바뀌었습니다/)).toBeInTheDocument();
        expect(toBlob).not.toHaveBeenCalled();
        expect(stopTrack).toHaveBeenCalled();
    });

    it('discards the image when the viewport changes while a long-range frame is arriving', async () => {
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('radio', { name: /긴 화면 구간/ }));
        fireEvent.click(screen.getByRole('button', { name: '스크롤 구간 선택 시작' }));
        const overlay = await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' });
        Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
            configurable: true, value: jest.fn((callback) => {
                setWindowNumber('innerHeight', 550);
                window.setTimeout(() => callback(0, {}), 0);
                return 1;
            })
        });
        fireEvent(overlay, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 120 }));
        fireEvent(overlay, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 400, clientY: 320 }));
        expect(await screen.findByText(/화면 크기 또는 배율이 바뀌었습니다/)).toBeInTheDocument();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(stopTrack).toHaveBeenCalled();
    });

    it('cancels delayed long-range permission and stops its late stream without closing a retry', async () => {
        let resolveOld!: (stream: MediaStream) => void;
        getDisplayMedia.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('radio', { name: /긴 화면 구간/ }));
        fireEvent.click(screen.getByRole('button', { name: '스크롤 구간 선택 시작' }));
        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog', { name: '화면 캡처 영역 선택' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '긴 화면 캡처 취소' }));
        await screen.findByText('긴 화면 캡처를 취소했습니다.');
        fireEvent.click(screen.getByRole('button', { name: '스크롤 구간 선택 시작' }));
        await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' });
        const stopOldTrack = jest.fn();
        resolveOld({ getTracks: () => [{ stop: stopOldTrack }] } as unknown as MediaStream);
        await waitFor(() => expect(stopOldTrack).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('dialog', { name: '화면 캡처 영역 선택' })).toBeInTheDocument();
        expect(stopTrack).not.toHaveBeenCalled();
    });

    it('rejects a different tab before opening long-range selection', async () => {
        jest.spyOn(navigator.mediaDevices as MediaDevices & { setCaptureHandleConfig: (config: unknown) => void }, 'setCaptureHandleConfig').mockImplementation(() => {});
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('radio', { name: /긴 화면 구간/ }));
        fireEvent.click(screen.getByRole('button', { name: '스크롤 구간 선택 시작' }));
        expect(await screen.findByText(/다른 탭이 선택되었습니다/)).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: '화면 캡처 영역 선택' })).not.toBeInTheDocument();
        expect(stopTrack).toHaveBeenCalled();
    });

    it('uses an already drawable frame when the browser frame callback stalls', async () => {
        const video = document.createElement('video');
        Object.defineProperty(video, 'requestVideoFrameCallback', {
            configurable: true,
            value: jest.fn()
        });

        await expect(waitForCapturedFrame(video, 1, true)).resolves.toBeUndefined();
    });

    it('opens selection within a bounded delay when the frame callback stalls', async () => {
        Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
            configurable: true,
            value: jest.fn()
        });

        const startedAt = Date.now();
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));

        await waitFor(() => {
            expect(document.querySelector('[data-capture-overlay="true"]')).toBeInTheDocument();
        }, { timeout: 2200 });
        expect(Date.now() - startedAt).toBeLessThan(1800);
    });

    it('keeps a visible retry message after a too-small drag', async () => {
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
            clientY: 100
        }));
        fireEvent(window, new MouseEvent('pointerup', {
            bubbles: true,
            button: 0,
            clientX: 105,
            clientY: 105
        }));

        expect(await screen.findAllByText('영역이 너무 작습니다. 화면에서 다시 드래그해 주세요.')).toHaveLength(2);
        expect(document.querySelector('[data-capture-overlay="true"]')).toBeInTheDocument();
    });

    it('shows preparation cancellation and protects a retry from a late permission result', async () => {
        let resolveOldRequest!: (stream: MediaStream) => void;
        getDisplayMedia.mockImplementationOnce(() => new Promise((resolve) => { resolveOldRequest = resolve; }));
        const oldStop = jest.fn();
        render(<aside data-capture-exclude="true"><QuickCameraCapture /></aside>);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        expect(screen.getByRole('button', { name: '화면 캡처 준비 취소' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: '화면 캡처 준비 취소' }));
        expect(screen.getByRole('button', { name: '실제 영역 선택 시작' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        const overlay = await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' });
        resolveOldRequest({ getTracks: () => [{ stop: oldStop }] } as unknown as MediaStream);
        await waitFor(() => expect(oldStop).toHaveBeenCalledTimes(1));
        expect(overlay).toBeInTheDocument();
        expect(stopTrack).not.toHaveBeenCalled();
        expect(getDisplayMedia).toHaveBeenCalledTimes(2);
        expect(document.querySelector<HTMLElement>('[data-capture-exclude="true"]')?.style.visibility).toBe('hidden');
    });

    it('cancels pending video playback with Escape and starts a fresh attempt', async () => {
        const play = HTMLMediaElement.prototype.play as jest.Mock;
        play.mockImplementationOnce(() => new Promise(() => {}));
        render(<aside data-capture-exclude="true"><QuickCameraCapture /></aside>);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(stopTrack).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: '실제 영역 선택 시작' })).toBeEnabled();
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        expect(await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' })).toBeInTheDocument();
        expect(stopTrack).toHaveBeenCalledTimes(1);
    });

    it('waits for delayed first-frame data before enabling selection', async () => {
        let frameReady = false;
        Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
            configurable: true,
            get: () => frameReady ? HTMLMediaElement.HAVE_CURRENT_DATA : HTMLMediaElement.HAVE_METADATA
        });
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
        expect(screen.queryByRole('dialog', { name: '화면 캡처 영역 선택' })).not.toBeInTheDocument();
        expect(drawImage).not.toHaveBeenCalled();
        frameReady = true;
        expect(await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' })).toBeInTheDocument();
    });

    it('continues selection when optional cursor constraints stop responding', async () => {
        applyConstraints.mockReturnValue(new Promise(() => {}));
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        expect(await screen.findByRole('dialog', { name: '화면 캡처 영역 선택' }, { timeout: 2200 })).toBeInTheDocument();
    });

    it('keeps a valid drag selection when the browser briefly loses focus', async () => {
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
            clientX: 420,
            clientY: 340
        }));
        fireEvent(window, new Event('blur'));

        expect(await screen.findByRole('button', { name: '캡처 후 클립보드 복사' })).toBeInTheDocument();
        expect(screen.getByText('포인터가 중단되었지만 마지막 유효 영역을 유지했습니다.')).toBeInTheDocument();
        const selectionBox = document.querySelector<HTMLElement>('[data-selection-box="true"]');
        expect(selectionBox).toHaveStyle({
            left: '100px',
            top: '120px',
            width: '320px',
            height: '220px'
        });
    });

    it('ignores pointercancel from a different pointer while dragging', async () => {
        render(<QuickCameraCapture />);
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        const overlay = await waitFor(() => {
            const element = document.querySelector<HTMLElement>('[data-capture-overlay="true"]');
            expect(element).toBeInTheDocument();
            return element as HTMLElement;
        });

        const pointerDown = new MouseEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: 100,
            clientY: 120
        });
        Object.defineProperty(pointerDown, 'pointerId', { value: 7 });
        fireEvent(overlay, pointerDown);

        const pointerMove = new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 420,
            clientY: 340
        });
        Object.defineProperty(pointerMove, 'pointerId', { value: 7 });
        fireEvent(window, pointerMove);

        const unrelatedCancel = new Event('pointercancel');
        Object.defineProperty(unrelatedCancel, 'pointerId', { value: 8 });
        fireEvent(window, unrelatedCancel);

        expect(screen.queryByRole('button', { name: '캡처 후 클립보드 복사' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '영역 선택 중...' })).toBeDisabled();

        fireEvent(window, new Event('blur'));
        expect(await screen.findByRole('button', { name: '캡처 후 클립보드 복사' })).toBeInTheDocument();
    });

    it('restores an actionable state when browser activation is rejected', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        getDisplayMedia.mockRejectedValueOnce(
            new DOMException('user activation required', 'InvalidStateError')
        );

        render(
            <aside data-capture-exclude="true">
                <QuickCameraCapture />
            </aside>
        );
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));

        expect(await screen.findByText(/현재 앱 탭을 활성화한 뒤 버튼을 다시 눌러 주세요/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '실제 영역 선택 시작' })).toBeEnabled();
        expect(document.querySelector<HTMLElement>('[data-capture-exclude="true"]')?.style.visibility).toBe('');
        consoleError.mockRestore();
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
            expect(screen.getByRole('button', { name: '새 실제 영역 선택' })).toBeEnabled();
        });
        expect(document.querySelector('[data-capture-overlay="true"]')).not.toBeInTheDocument();
        expect(clipboardWrite).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: '새 실제 영역 선택' }));
        overlay = await waitFor(() => {
            const element = document.querySelector<HTMLElement>('[data-capture-overlay="true"]');
            expect(element).toBeInTheDocument();
            return element as HTMLElement;
        });
        expect(document.querySelector('[data-frozen-capture-preview="true"]')).toBeInTheDocument();

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
        });
        await waitFor(() => expect(clipboardWrite).toHaveBeenCalledTimes(1));
        expect(getDisplayMedia).toHaveBeenCalledTimes(1);
        fullBoard.remove();
    });

    it('stops the approved capture stream when the camera panel closes', async () => {
        const togglePanel = jest.fn();
        const { rerender } = render(
            <LayoutBottomPanel
                isOpen
                togglePanel={togglePanel}
                activeTool="camera"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '실제 영역 선택 시작' }));
        await waitFor(() => {
            expect(document.querySelector('[data-capture-overlay="true"]')).toBeInTheDocument();
        });

        rerender(
            <LayoutBottomPanel
                isOpen={false}
                togglePanel={togglePanel}
                activeTool="camera"
            />
        );

        expect(stopTrack).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[data-capture-overlay="true"]')).not.toBeInTheDocument();
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
