import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { storageService } from '../../services/storageService';
import MaterialPhotoPicker, {
    MaterialPhotoAttachment,
    uploadMaterialPhotoAttachments,
} from './MaterialPhotoPicker';

jest.mock('../../services/storageService', () => ({
    storageService: {
        uploadFileInfo: jest.fn(),
        deleteFile: jest.fn(),
    },
}));

const uploadFileInfoMock = storageService.uploadFileInfo as jest.MockedFunction<
    typeof storageService.uploadFileInfo
>;
const deleteFileMock = storageService.deleteFile as jest.MockedFunction<
    typeof storageService.deleteFile
>;

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
let objectUrlSequence = 0;
const createObjectURLMock = jest.fn(() => `blob:material-photo-${objectUrlSequence += 1}`);
const revokeObjectURLMock = jest.fn();

const MaterialPhotoPickerHarness: React.FC<{ maxPhotos?: number }> = ({ maxPhotos }) => {
    const [photos, setPhotos] = useState<MaterialPhotoAttachment[]>([]);

    return (
        <>
            <div data-testid="photo-count">{photos.length}</div>
            <MaterialPhotoPicker
                photos={photos}
                onPhotosChange={setPhotos}
                tone="blue"
                maxPhotos={maxPhotos}
            />
        </>
    );
};

const getGalleryInput = (container: HTMLElement): HTMLInputElement => {
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    if (!inputs[1]) throw new Error('Gallery input was not rendered.');
    return inputs[1];
};

const makeImageFiles = (count: number): File[] =>
    Array.from({ length: count }, (_, index) => (
        new File([`photo-${index}`], `photo-${index}.jpg`, { type: 'image/jpeg' })
    ));

const makeUploadAttachments = (count: number): MaterialPhotoAttachment[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `photo-${index}`,
        file: new File([`photo-${index}`], `photo-${index}.svg`, { type: 'image/svg+xml' }),
        previewUrl: `blob:photo-${index}`,
        source: 'gallery' as const,
    }));

beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: revokeObjectURLMock,
    });
});

afterAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
    });
});

beforeEach(() => {
    objectUrlSequence = 0;
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    uploadFileInfoMock.mockReset();
    deleteFileMock.mockReset();
    deleteFileMock.mockResolvedValue(undefined);
});

describe('MaterialPhotoPicker', () => {
    it('설정한 최대 장수까지만 추가하고 초과분을 안내한다', () => {
        const { container } = render(<MaterialPhotoPickerHarness maxPhotos={40} />);

        fireEvent.change(getGalleryInput(container), {
            target: { files: makeImageFiles(41) },
        });

        expect(screen.getByTestId('photo-count')).toHaveTextContent('40');
        expect(screen.getByText('촬영 또는 갤러리 선택, 최대 40장')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent(
            '최대 40장까지 첨부할 수 있어 1장은 제외했습니다.'
        );
        expect(screen.getByRole('button', { name: '사진 촬영' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '갤러리 선택' })).toBeDisabled();
    });

    it('maxPhotos를 생략하면 기존 기본값 20장을 유지한다', () => {
        const { container } = render(<MaterialPhotoPickerHarness />);

        fireEvent.change(getGalleryInput(container), {
            target: { files: makeImageFiles(21) },
        });

        expect(screen.getByTestId('photo-count')).toHaveTextContent('20');
        expect(screen.getByText('촬영 또는 갤러리 선택, 최대 20장')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('1장은 제외했습니다.');
    });

    it('MIME 정보가 없는 일반 이미지와 HEIC/HEIF 파일을 확장자로 허용한다', () => {
        const { container } = render(<MaterialPhotoPickerHarness maxPhotos={40} />);
        const jpeg = new File(['jpeg'], 'site-photo.jpg', { type: '' });
        const heic = new File(['heic'], 'site-photo.HEIC', { type: '' });
        const heif = new File(['heif'], 'site-photo.HEIF', { type: '' });
        const extensionless = new File(['not-an-image'], 'README', { type: '' });

        fireEvent.change(getGalleryInput(container), {
            target: { files: [jpeg, heic, heif, extensionless] },
        });

        expect(screen.getByTestId('photo-count')).toHaveTextContent('3');
        expect(screen.getAllByAltText('갤러리 사진')).toHaveLength(3);
        expect(getGalleryInput(container)).toHaveAttribute('accept', 'image/*,.heic,.heif');
    });
});

describe('uploadMaterialPhotoAttachments', () => {
    it('사진 업로드를 최대 4개까지만 동시에 실행하고 입력 순서를 보존한다', async () => {
        type UploadResult = Awaited<ReturnType<typeof storageService.uploadFileInfo>>;
        const completions: Array<() => void> = [];
        let activeUploads = 0;
        let maximumActiveUploads = 0;

        uploadFileInfoMock.mockImplementation((_path, file) => {
            activeUploads += 1;
            maximumActiveUploads = Math.max(maximumActiveUploads, activeUploads);
            return new Promise<UploadResult>((resolve) => {
                completions.push(() => {
                    activeUploads -= 1;
                    resolve({
                        fullPath: `materials/test/${file.name}`,
                        name: file.name,
                        contentType: file.type,
                        size: file.size,
                    });
                });
            });
        });

        const resultPromise = uploadMaterialPhotoAttachments({
            photos: makeUploadAttachments(8),
            transactionType: 'inbound',
            transactionDate: '2026-07-09',
            siteId: 'site-1',
        });

        await waitFor(() => expect(uploadFileInfoMock).toHaveBeenCalledTimes(4));
        completions.splice(0, 4).forEach((complete) => complete());
        await waitFor(() => expect(uploadFileInfoMock).toHaveBeenCalledTimes(8));
        completions.splice(0, 4).forEach((complete) => complete());

        const results = await resultPromise;
        expect(maximumActiveUploads).toBe(4);
        expect(results).toHaveLength(8);
        results.forEach((result, index) => {
            expect(result.name).toContain(`photo-${index}`);
        });
    });

    it('일부 업로드가 실패하면 완료된 성공 업로드를 내부에서 정리한다', async () => {
        type UploadResult = Awaited<ReturnType<typeof storageService.uploadFileInfo>>;
        type DeferredUpload = {
            fileName: string;
            resolve: (value: UploadResult) => void;
            reject: (reason?: unknown) => void;
        };
        const deferredUploads: DeferredUpload[] = [];

        uploadFileInfoMock.mockImplementation((_path, file) => (
            new Promise<UploadResult>((resolve, reject) => {
                deferredUploads.push({ fileName: file.name, resolve, reject });
            })
        ));

        const resultPromise = uploadMaterialPhotoAttachments({
            photos: makeUploadAttachments(5),
            transactionType: 'inbound',
            transactionDate: '2026-07-09',
            siteId: 'site-1',
        });
        const rejectionAssertion = expect(resultPromise).rejects.toThrow('두 번째 업로드 실패');

        await waitFor(() => expect(deferredUploads).toHaveLength(4));
        deferredUploads[1].reject(new Error('두 번째 업로드 실패'));
        await Promise.resolve();

        [0, 2, 3].forEach((index) => {
            const deferred = deferredUploads[index];
            deferred.resolve({
                fullPath: `materials/success-${index}`,
                name: deferred.fileName,
                contentType: 'image/svg+xml',
                size: 10,
            });
        });

        await rejectionAssertion;
        expect(uploadFileInfoMock).toHaveBeenCalledTimes(4);
        expect(deleteFileMock).toHaveBeenCalledTimes(3);
        expect(deleteFileMock.mock.calls.map(([path]) => path)).toEqual(
            expect.arrayContaining([
                'materials/success-0',
                'materials/success-2',
                'materials/success-3',
            ])
        );
    });

    it('MIME 없는 HEIC 파일을 올바른 image/heic 타입으로 업로드한다', async () => {
        uploadFileInfoMock.mockResolvedValue({
            fullPath: 'materials/test/site-photo.heic',
            name: 'site-photo.heic',
            contentType: 'image/heic',
            size: 4,
        });

        await uploadMaterialPhotoAttachments({
            photos: [{
                id: 'heic-photo',
                file: new File(['heic'], 'site-photo.heic', { type: '' }),
                previewUrl: 'blob:heic-photo',
                source: 'gallery',
            }],
            transactionType: 'inbound',
            transactionDate: '2026-07-09',
            siteId: 'site-1',
        });

        const [, uploadedFile, , options] = uploadFileInfoMock.mock.calls[0];
        expect(uploadedFile.type).toBe('image/heic');
        expect(options?.metadata?.contentType).toBe('image/heic');
    });

    it('MIME 없는 PNG 파일을 확장자에 맞는 image/png 타입으로 업로드한다', async () => {
        uploadFileInfoMock.mockResolvedValue({
            fullPath: 'materials/test/site-photo.png',
            name: 'site-photo.png',
            contentType: 'image/png',
            size: 3,
        });

        await uploadMaterialPhotoAttachments({
            photos: [{
                id: 'png-photo',
                file: new File(['png'], 'site-photo.png', { type: '' }),
                previewUrl: 'blob:png-photo',
                source: 'gallery',
            }],
            transactionType: 'inbound',
            transactionDate: '2026-07-09',
            siteId: 'site-1',
        });

        const [, uploadedFile, , options] = uploadFileInfoMock.mock.calls[0];
        expect(uploadedFile.type).toBe('image/png');
        expect(options?.metadata?.contentType).toBe('image/png');
    });
});
