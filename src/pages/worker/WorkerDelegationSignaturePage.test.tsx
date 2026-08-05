import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useLinkedWorker } from '../../hooks/useLinkedWorker';
import { delegationLetterTemplateService } from '../../services/delegationLetterTemplateService';
import WorkerDelegationSignaturePage from './WorkerDelegationSignaturePage';

jest.mock('../../hooks/useLinkedWorker', () => ({
    useLinkedWorker: jest.fn(),
}));

jest.mock('../../services/delegationLetterTemplateService', () => ({
    delegationLetterTemplateService: {
        subscribePublicTemplate: jest.fn(),
        savePublicTemplate: jest.fn(),
    },
}));

jest.mock('../../components/signatures/SignatureGeneratorModal', () => ({
    __esModule: true,
    default: () => null,
}));

const mockUseLinkedWorker = useLinkedWorker as jest.MockedFunction<typeof useLinkedWorker>;
const mockSubscribePublicTemplate = delegationLetterTemplateService.subscribePublicTemplate as jest.MockedFunction<typeof delegationLetterTemplateService.subscribePublicTemplate>;
const mockSavePublicTemplate = delegationLetterTemplateService.savePublicTemplate as jest.MockedFunction<typeof delegationLetterTemplateService.savePublicTemplate>;

describe('WorkerDelegationSignaturePage', () => {
    beforeEach(() => {
        mockSubscribePublicTemplate.mockReset();
        mockSavePublicTemplate.mockReset();
        mockSubscribePublicTemplate.mockImplementation((onChange) => {
            onChange({
                bodyText: '직불 방식으로 중복 지급된 선지급금을 확인 후 적법하게 정산하는 것에 동의합니다.',
            });
            return jest.fn();
        });
        mockSavePublicTemplate.mockResolvedValue(undefined);
    });

    it('renders only the worker linked to the signed-in account', async () => {
        mockUseLinkedWorker.mockReturnValue({
            loading: false,
            userId: 'user-1',
            profile: null,
            linkedWorker: {
                id: 'worker-1',
                name: '홍길동',
                idNumber: '900101-1234567',
                address: '서울시',
                status: '재직',
                teamName: '1팀',
                siteName: '강남 현장',
                leaderName: '김수임',
            },
        });

        render(<WorkerDelegationSignaturePage />);

        expect(screen.getByRole('heading', { name: '작업자 직접 서명' })).toBeInTheDocument();
        expect(screen.getByText('홍길동')).toBeInTheDocument();
        expect(screen.queryByText('현장명')).not.toBeInTheDocument();
        expect(screen.queryByText('귀속년월')).not.toBeInTheDocument();
        expect(screen.queryByText('수임인')).not.toBeInTheDocument();
        expect(screen.queryByText('작성일')).not.toBeInTheDocument();
        expect(await screen.findByText(/직불 방식으로 중복 지급된 선지급금을 확인 후 적법하게 정산/)).toBeInTheDocument();
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '위임장 내용 수정' })).not.toBeInTheDocument();
    });

    it('explains how to resolve a missing worker link', async () => {
        mockUseLinkedWorker.mockReturnValue({
            loading: false,
            userId: 'user-1',
            profile: null,
            linkedWorker: null,
        });

        render(<WorkerDelegationSignaturePage />);

        expect(screen.getByText('계정과 연결된 작업자 정보가 없습니다. 관리자에게 작업자 계정 연결을 요청해 주세요.')).toBeInTheDocument();
        await waitFor(() => expect(mockSubscribePublicTemplate).toHaveBeenCalled());
    });

    it('lets a manager edit and publish the shared delegation text', async () => {
        mockUseLinkedWorker.mockReturnValue({
            loading: false,
            userId: 'manager-1',
            profile: { role: '매니저1' } as any,
            linkedWorker: null,
        });

        render(<WorkerDelegationSignaturePage />);

        fireEvent.click(screen.getByRole('button', { name: '위임장 내용 수정' }));
        fireEvent.change(screen.getByLabelText('작업자에게 표시할 위임장 본문'), {
            target: { value: '관리자가 수정한 공용 위임장 본문입니다.' },
        });
        fireEvent.click(screen.getByRole('button', { name: '저장 및 전체 적용' }));

        await waitFor(() => expect(mockSavePublicTemplate).toHaveBeenCalledWith('관리자가 수정한 공용 위임장 본문입니다.'));
        expect(await screen.findByText('저장했습니다. 작업자 위임장 화면에 즉시 반영됩니다.')).toBeInTheDocument();
    });

    it('applies a live template update to the worker view', async () => {
        let publishTemplate: ((template: { bodyText: string } | null) => void) | undefined;
        mockSubscribePublicTemplate.mockImplementation((onChange) => {
            publishTemplate = onChange;
            onChange({ bodyText: '기존 공용 위임장 본문' });
            return jest.fn();
        });
        mockUseLinkedWorker.mockReturnValue({
            loading: false,
            userId: 'user-1',
            profile: { role: '작업자', accountType: 'worker' } as any,
            linkedWorker: {
                id: 'worker-1',
                name: '홍길동',
                status: '재직',
            },
        });

        render(<WorkerDelegationSignaturePage />);
        expect(await screen.findByText('기존 공용 위임장 본문')).toBeInTheDocument();

        act(() => publishTemplate?.({ bodyText: '관리자가 실시간으로 수정한 위임장 본문' }));

        expect(await screen.findByText('관리자가 실시간으로 수정한 위임장 본문')).toBeInTheDocument();
    });
});
