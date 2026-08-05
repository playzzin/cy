import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignatureGeneratorModal from './SignatureGeneratorModal';
import { signatureService } from '../../services/signatureService';

jest.mock('../../services/signatureService', () => ({
    signatureService: {
        saveSignature: jest.fn(),
    },
}));

jest.mock('sweetalert2', () => ({
    __esModule: true,
    default: {
        fire: jest.fn(() => Promise.resolve({})),
    },
}));

jest.mock('./RealisticSignatureCanvas', () => {
    const ReactActual = jest.requireActual<typeof import('react')>('react');
    const MockCanvas = ReactActual.forwardRef((props: any, ref: React.ForwardedRef<any>) => {
        const [drawn, setDrawn] = ReactActual.useState(false);
        ReactActual.useImperativeHandle(ref, () => ({
            clear: jest.fn(),
            undo: jest.fn(),
            redo: jest.fn(),
            isEmpty: () => !drawn,
            isMeaningful: () => drawn,
            getMetrics: () => ({
                pointCount: drawn ? 10 : 0,
                strokeCount: drawn ? 1 : 0,
                totalLength: drawn ? 120 : 0,
                bounds: { width: drawn ? 100 : 0, height: drawn ? 40 : 0 },
            }),
            toDataURL: () => drawn ? 'data:image/png;base64,mock-signature' : null,
        }), [drawn]);

        return ReactActual.createElement(
            'button',
            {
                type: 'button',
                'data-testid': 'mock-signature-canvas',
                onClick: () => {
                    setDrawn(true);
                    props.onStateChange?.({
                        hasInk: true,
                        canUndo: true,
                        canRedo: false,
                        isMeaningful: true,
                    });
                },
            },
            '테스트 서명 그리기'
        );
    });
    MockCanvas.displayName = 'MockRealisticSignatureCanvas';

    return { __esModule: true, default: MockCanvas };
});

const mockedSaveSignature = signatureService.saveSignature as jest.MockedFunction<
    typeof signatureService.saveSignature
>;

describe('SignatureGeneratorModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedSaveSignature.mockResolvedValue('https://example.com/signature.png');
    });

    it('exposes an accessible dialog and switches writing tools', () => {
        const onClose = jest.fn();
        render(
            <SignatureGeneratorModal
                isOpen
                onClose={onClose}
                workerId="worker-1"
                workerName="홍길동"
                onSaveComplete={jest.fn()}
            />
        );

        expect(screen.getByRole('dialog', { name: '홍길동 서명 등록' })).toBeInTheDocument();
        const ballpointButton = screen.getByRole('button', { name: /^볼펜 속도와/ });
        const pencilButton = screen.getByRole('button', { name: /^연필 미세한/ });
        expect(ballpointButton).toHaveAttribute('aria-pressed', 'true');
        expect(pencilButton).toHaveAttribute('aria-pressed', 'false');

        userEvent.click(pencilButton);
        expect(pencilButton).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: '이 서명으로 등록' })).toBeDisabled();

        userEvent.click(screen.getByRole('button', { name: '서명 등록 닫기' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('saves only after a meaningful signature is drawn', async () => {
        const onClose = jest.fn();
        const onSaveComplete = jest.fn();
        render(
            <SignatureGeneratorModal
                isOpen
                onClose={onClose}
                workerId="worker-7"
                workerName="김서명"
                onSaveComplete={onSaveComplete}
            />
        );

        const saveButton = screen.getByRole('button', { name: '이 서명으로 등록' });
        expect(saveButton).toBeDisabled();
        await userEvent.click(screen.getByTestId('mock-signature-canvas'));
        expect(saveButton).toBeEnabled();
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(onSaveComplete).toHaveBeenCalledWith('https://example.com/signature.png');
        });
        expect(mockedSaveSignature).toHaveBeenCalledWith(
            'worker-7',
            'data:image/png;base64,mock-signature'
        );
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
