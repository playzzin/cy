import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DelegationConsentSignaturePanel from './DelegationConsentSignaturePanel';

jest.mock('../signatures/SignatureGeneratorModal', () => ({
    __esModule: true,
    default: (props: any) => props.isOpen ? (
        <div role="dialog" aria-label={`${props.workerName} 테스트 서명`}>
            <button type="button" onClick={() => props.onSaveComplete('https://example.com/new-signature.png')}>
                테스트 서명 저장
            </button>
        </div>
    ) : null,
}));

const workers = [{
    workerId: 'worker-1',
    workerName: '홍길동',
    idNumber: '900101-1234567',
    address: '서울시',
}];

describe('DelegationConsentSignaturePanel', () => {
    it('requires agreement before opening the direct-signature flow', async () => {
        const onSignatureSaved = jest.fn();
        render(
            <DelegationConsentSignaturePanel
                workers={workers}
                delegationText="급여 청구 및 수령 권한을 위임합니다."
                documentDate="2026-08-04"
                selectedMonth="2026-08"
                siteName="강남 현장"
                mandataryName="김수임"
                onSignatureSaved={onSignatureSaved}
            />
        );

        expect(screen.getByText('급여 청구 및 수령 권한을 위임합니다.')).toBeInTheDocument();
        expect(screen.getByText('900101-1******', { exact: false })).toBeInTheDocument();

        const openButton = screen.getByRole('button', { name: '동의하고 직접 서명' });
        expect(openButton).toBeDisabled();

        await userEvent.click(screen.getByRole('checkbox', { name: '위임장 내용 확인 및 서명 동의' }));
        expect(openButton).toBeEnabled();
        await userEvent.click(openButton);

        expect(screen.getByRole('dialog', { name: '홍길동 테스트 서명' })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: '테스트 서명 저장' }));

        expect(onSignatureSaved).toHaveBeenCalledWith(
            'worker-1',
            'https://example.com/new-signature.png'
        );
        expect(screen.getByRole('status')).toHaveTextContent('홍길동님의 서명이 반영되었습니다');
    });

    it('shows the setup guidance when no delegation workers are selected', () => {
        render(
            <DelegationConsentSignaturePanel
                workers={[]}
                delegationText="위임장 본문"
                documentDate="2026-08-04"
                selectedMonth="2026-08"
                siteName=""
                mandataryName=""
                onSignatureSaved={jest.fn()}
            />
        );

        expect(screen.getByText('직접 서명할 작업자가 없습니다')).toBeInTheDocument();
    });

    it('shows only the signed-in worker in self-service mode', () => {
        render(
            <DelegationConsentSignaturePanel
                selfService
                workers={workers}
                delegationText="위임장 본문"
                documentDate="2026-08-04"
                selectedMonth="2026-08"
                siteName="강남 현장"
                mandataryName="김수임"
                onSignatureSaved={jest.fn()}
            />
        );

        expect(screen.getByText('위임장 내용을 확인하고 동의한 뒤 본인이 직접 서명해 주세요.')).toBeInTheDocument();
        expect(screen.queryByRole('listbox', { name: '직접 서명 작업자 선택' })).not.toBeInTheDocument();
        expect(screen.getByText('홍길동')).toBeInTheDocument();
    });
});
