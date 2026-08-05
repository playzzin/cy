import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MaterialPhotoViewerModal, {
    createMaterialPhotoUrlResolver,
    getMaterialPhotoDisplayCount,
    hasMaterialPhotoReference,
} from './MaterialPhotoViewerModal';

describe('material photo URL resolver', () => {
    it('legacy photoUrls를 정리해 반환하고 batch 조회를 생략한다', async () => {
        const loadBatchUrls = jest.fn<Promise<string[]>, [string]>();
        const resolver = createMaterialPhotoUrlResolver(loadBatchUrls);

        await expect(resolver.resolve({
            photoUrls: [' https://example.com/one.jpg ', '', 'https://example.com/one.jpg'],
        })).resolves.toEqual(['https://example.com/one.jpg']);
        expect(loadBatchUrls).not.toHaveBeenCalled();
        expect(hasMaterialPhotoReference({ photoUrls: ['https://example.com/one.jpg'] })).toBe(true);
        expect(getMaterialPhotoDisplayCount({ photoUrls: ['one', 'two', 'two'] })).toBe(2);
    });

    it('동일 photoBatchId의 조회 결과를 캐시하고 legacy URL과 중복 없이 합친다', async () => {
        const loadBatchUrls = jest.fn(async () => [
            'https://example.com/batch-one.jpg',
            'https://example.com/shared.jpg',
        ]);
        const resolver = createMaterialPhotoUrlResolver(loadBatchUrls);
        const reference = {
            photoBatchId: 'batch-1',
            photoCount: 3,
            photoUrls: ['https://example.com/shared.jpg', 'https://example.com/legacy.jpg'],
        };

        await expect(resolver.resolve(reference)).resolves.toEqual([
            'https://example.com/batch-one.jpg',
            'https://example.com/shared.jpg',
            'https://example.com/legacy.jpg',
        ]);
        await resolver.resolve(reference);

        expect(loadBatchUrls).toHaveBeenCalledTimes(1);
        expect(loadBatchUrls).toHaveBeenCalledWith('batch-1');
        expect(getMaterialPhotoDisplayCount(reference)).toBe(3);
    });

    it('동시에 열린 동일 batch 요청을 한 번만 실행한다', async () => {
        let completeRequest: ((urls: string[]) => void) | undefined;
        const loadBatchUrls = jest.fn(() => new Promise<string[]>((resolve) => {
            completeRequest = resolve;
        }));
        const resolver = createMaterialPhotoUrlResolver(loadBatchUrls);

        const first = resolver.resolve({ photoBatchId: 'batch-pending' });
        const second = resolver.resolve({ photoBatchId: 'batch-pending' });
        await Promise.resolve();

        expect(loadBatchUrls).toHaveBeenCalledTimes(1);
        completeRequest?.(['https://example.com/photo.jpg']);
        await expect(Promise.all([first, second])).resolves.toEqual([
            ['https://example.com/photo.jpg'],
            ['https://example.com/photo.jpg'],
        ]);
    });

    it('batch 조회 실패 시 legacy URL이 있으면 안전하게 대체한다', async () => {
        const loadBatchUrls = jest.fn(async () => {
            throw new Error('permission denied');
        });
        const resolver = createMaterialPhotoUrlResolver(loadBatchUrls);

        await expect(resolver.resolve({
            photoBatchId: 'migrating-batch',
            photoUrls: ['https://example.com/legacy.jpg'],
        })).resolves.toEqual(['https://example.com/legacy.jpg']);
        await expect(resolver.resolve({ photoBatchId: 'batch-without-fallback' })).rejects.toThrow('permission denied');
    });
});

describe('MaterialPhotoViewerModal', () => {
    const defaultProps = {
        isOpen: true,
        title: '2026-07-09 · 테스트 현장 · 시스템 동바리',
        expectedCount: 2,
        urls: [] as string[],
        loading: false,
        error: '',
        onClose: jest.fn(),
    };

    beforeEach(() => {
        defaultProps.onClose.mockClear();
    });

    it('로딩, 빈 데이터, 권한 오류 상태를 구분해 안내한다', () => {
        const { rerender } = render(<MaterialPhotoViewerModal {...defaultProps} loading />);
        expect(screen.getByText('사진을 불러오는 중입니다...')).toBeInTheDocument();
        expect(screen.getByText('2장 불러오는 중')).toBeInTheDocument();

        rerender(<MaterialPhotoViewerModal {...defaultProps} />);
        expect(screen.getByText('저장된 사진을 찾을 수 없습니다.')).toBeInTheDocument();

        rerender(<MaterialPhotoViewerModal {...defaultProps} error="저장된 사진을 볼 권한이 없습니다." />);
        expect(screen.getByRole('alert')).toHaveTextContent('저장된 사진을 볼 권한이 없습니다.');
    });

    it('썸네일과 원본 링크를 표시하고 Escape 키로 닫는다', () => {
        render(
            <MaterialPhotoViewerModal
                {...defaultProps}
                expectedCount={1}
                urls={['https://example.com/material-photo.jpg']}
            />
        );

        expect(screen.getByAltText('입출고 첨부사진 1')).toHaveAttribute(
            'src',
            'https://example.com/material-photo.jpg'
        );
        expect(screen.getByRole('link', { name: '사진 1 원본 보기' })).toHaveAttribute(
            'href',
            'https://example.com/material-photo.jpg'
        );

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
});
