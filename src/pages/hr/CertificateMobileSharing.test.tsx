import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { saveAs } from 'file-saver';
import { captureCertificateImage } from '../../utils/certificateImage';
import EmploymentCertificatePage from './EmploymentCertificatePage';
import TerminationCertificatePage from './TerminationCertificatePage';

jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: async () => [{ id: 'company', name: '청연', type: '시공사' }] } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: async () => [{ id: 'worker', name: '테스트근로자', companyId: 'company' }] } }));
jest.mock('../../hooks/useDocumentStamp', () => ({ useDocumentStamp: () => null }));
jest.mock('react-to-print', () => ({ useReactToPrint: () => jest.fn() }));
jest.mock('date-fns/locale', () => ({ ko: undefined }));
jest.mock('../../utils/certificateImage', () => ({ captureCertificateImage: jest.fn(), certificateImageFilename: (title: string) => `${title}.png` }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

const capture = captureCertificateImage as jest.Mock;
const share = jest.fn();
const canShare = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    capture.mockResolvedValue(new Blob(['certificate'], { type: 'image/png' }));
    share.mockResolvedValue(undefined);
    canShare.mockReturnValue(true);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
    URL.createObjectURL = jest.fn(() => 'blob:certificate');
    URL.revokeObjectURL = jest.fn();
});

describe.each([
    ['재직증명서', EmploymentCertificatePage],
    ['해촉증명서', TerminationCertificatePage],
] as const)('%s 모바일 공유', (title, Page) => {
    const open = async () => {
        render(<Page />);
        expect(screen.getByRole('button', { name: '카카오톡 공유 · 이미지 준비' })).toBeDisabled();
        fireEvent.click(await screen.findByText(/테스트근로자 \(/));
        fireEvent.click(screen.getByRole('button', { name: '미리보기 · 공유' }));
        expect(screen.getByRole('button', { name: '미리보기 · 공유' })).toHaveAttribute('aria-pressed', 'true');
    };
    const prepare = async () => {
        fireEvent.click(screen.getByRole('button', { name: '카카오톡 공유 · 이미지 준비' }));
        return screen.findByRole('button', { name: '카카오톡 공유' });
    };

    it('현재 증명서 파일만 공유하고 확대/축소 및 취소 후 재시도를 지원한다', async () => {
        await open();
        fireEvent.click(screen.getByRole('button', { name: '원본 크기' }));
        fireEvent.click(screen.getByRole('button', { name: '화면에 맞추기' }));
        const button = await prepare();
        expect(capture.mock.calls[0][0]).toHaveTextContent(title);
        expect(capture.mock.calls[0][0]).toHaveTextContent('테스트근로자');
        expect(capture.mock.calls[0][0]).not.toHaveTextContent('카카오톡');
        expect(share).not.toHaveBeenCalled();
        share.mockRejectedValueOnce(new DOMException('cancel', 'AbortError'));
        fireEvent.click(button);
        expect(await screen.findByText('공유를 취소했습니다. 다시 공유할 수 있습니다.')).toBeInTheDocument();
        fireEvent.click(button);
        await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
        const payload = share.mock.calls[1][0];
        expect(payload.files).toHaveLength(1);
        expect(payload.files[0].name).toMatch(new RegExp(`^${title}_테스트근로자_\\d{8}\\.png$`));
        expect(payload.files[0].type).toBe('image/png');
        expect(payload.url).toBeUndefined();
    });

    it('도장 또는 대상이 바뀌면 준비된 이미지를 폐기한다', async () => {
        await open();
        await prepare();
        fireEvent.change(screen.getByRole('combobox', { name: '도장 인쇄' }), { target: { value: 'exclude' } });
        expect(screen.queryByRole('button', { name: '카카오톡 공유' })).not.toBeInTheDocument();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:certificate');
        await prepare();
        fireEvent.click(screen.getByRole('button', { name: '취소' }));
        expect(screen.getByRole('button', { name: '카카오톡 공유 · 이미지 준비' })).toBeDisabled();
        expect(screen.queryByAltText('공유할 증명서 이미지')).not.toBeInTheDocument();
    });

    it('생성 도중 설정이 변경되면 이전 결과를 사용하지 않는다', async () => {
        await open();
        let finish!: (blob: Blob) => void;
        capture.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        fireEvent.click(screen.getByRole('button', { name: '카카오톡 공유 · 이미지 준비' }));
        fireEvent.change(screen.getByRole('combobox', { name: '도장 인쇄' }), { target: { value: 'exclude' } });
        await act(async () => { finish(new Blob(['stale'])); });
        expect(screen.queryByAltText('공유할 증명서 이미지')).not.toBeInTheDocument();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('파일 공유 미지원 시 저장을 제공하고 생성 실패를 표시한다', async () => {
        canShare.mockReturnValue(false);
        await open();
        capture.mockRejectedValueOnce(new Error('image unavailable'));
        fireEvent.click(screen.getByRole('button', { name: '카카오톡 공유 · 이미지 준비' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('도장 이미지');
        fireEvent.click(screen.getByRole('button', { name: '카카오톡 공유 · 이미지 준비' }));
        fireEvent.click(await screen.findByRole('button', { name: '이미지 저장' }));
        expect(saveAs).toHaveBeenCalledWith(expect.any(File), expect.stringContaining(title));
        expect(screen.queryByRole('button', { name: '카카오톡 공유' })).not.toBeInTheDocument();
        expect(share).not.toHaveBeenCalled();
    });
});
