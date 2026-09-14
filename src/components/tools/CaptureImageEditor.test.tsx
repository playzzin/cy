import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CaptureImageEditor from './CaptureImageEditor';
import { drawCaptureAnnotations } from './captureAnnotations';

jest.mock('./captureAnnotations', () => ({
    ...jest.requireActual('./captureAnnotations'),
    drawCaptureAnnotations: jest.fn()
}));

it('preserves earlier cover marks when the annotation limit is reached, and permits undo', async () => {
    const originalImage = window.Image;
    const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    let load: (() => void) | undefined;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:editor-test' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    window.Image = class {
        onload?: () => void;
        set src(_value: string) { load = () => this.onload?.(); }
    } as unknown as typeof Image;
    const context = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: jest.fn() } as unknown as CanvasRenderingContext2D);
    const view = render(<CaptureImageEditor parts={[{ blob: new Blob(['png']), width: 400, height: 300 }]} onSave={jest.fn()} onClose={jest.fn()} />);
    try {
        act(() => load?.());
        const canvas = screen.getByLabelText('편집할 캡처 이미지');
        jest.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 300 } as DOMRect);
        fireEvent.click(screen.getByRole('button', { name: '완전 가림' }));
        fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
        fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
        fireEvent.click(screen.getByRole('button', { name: '글자' }));
        fireEvent.change(screen.getByLabelText('이미지에 넣을 글자'), { target: { value: '확인' } });
        for (let index = 0; index < 100; index += 1) {
            fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 200, clientY: 200 }));
        }
        expect(screen.getByRole('alert')).toHaveTextContent('100개까지');
        await waitFor(() => {
            const marks = (drawCaptureAnnotations as jest.Mock).mock.calls.slice(-1)[0]?.[1];
            expect(marks).toHaveLength(100);
        });
        expect((drawCaptureAnnotations as jest.Mock).mock.calls.slice(-1)[0][1][0].tool).toBe('cover');
        fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
        fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 200, clientY: 200 }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('표시 100개');
    } finally {
        view.unmount();
        context.mockRestore();
        window.Image = originalImage;
        if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
        else delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
        if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
        else delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    }
});
