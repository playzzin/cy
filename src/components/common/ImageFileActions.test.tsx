import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ImageFileActions from './ImageFileActions';
import { canShareImageFile, imageFileFromUrl, shareImageFile } from '../../utils/imageFileDelivery';
import { saveAs } from 'file-saver';
jest.mock('../../utils/imageFileDelivery', () => ({ canShareImageFile: jest.fn(), imageFileFromUrl: jest.fn(), shareImageFile: jest.fn(), copyImageFile: jest.fn() }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); URL.createObjectURL = jest.fn(() => 'blob:synthetic'); URL.revokeObjectURL = jest.fn(); });
test('지원하지 않는 브라우저는 사진 저장을 제공하며 링크를 공유하지 않는다', async () => {
    const file = new File(['sample'], 'synthetic.png', { type: 'image/png' });
    (imageFileFromUrl as jest.Mock).mockResolvedValue(file);
    (canShareImageFile as jest.Mock).mockReturnValue(false);
    render(<ImageFileActions imageUrl="https://example.test/photo" name="합성 사진" />);
    fireEvent.click(screen.getByText('사진 공유·저장'));
    fireEvent.click(await screen.findByText('사진 저장'));
    expect(saveAs).toHaveBeenCalledWith(file, 'synthetic.png');
    expect(screen.queryByText('공유창 열기')).not.toBeInTheDocument();
    expect(shareImageFile).not.toHaveBeenCalled();
});
test('공유 취소는 성공으로 표시하지 않는다', async () => {
    (imageFileFromUrl as jest.Mock).mockResolvedValue(new File(['sample'], 'test.png', { type: 'image/png' }));
    (canShareImageFile as jest.Mock).mockReturnValue(true);
    (shareImageFile as jest.Mock).mockRejectedValue(new DOMException('cancel', 'AbortError'));
    render(<ImageFileActions imageUrl="https://example.test/a" name="합성 사진" />);
    fireEvent.click(screen.getByText('사진 공유·저장'));
    fireEvent.click(await screen.findByText('공유창 열기'));
    await screen.findByText('공유를 취소했습니다.');
});
test('다른 작업자로 전환한 뒤 도착한 이전 사진 응답은 폐기한다', async () => {
    let resolve: (file: File) => void = () => undefined;
    (imageFileFromUrl as jest.Mock).mockReturnValue(new Promise<File>(done => { resolve = done; }));
    const view = render(<ImageFileActions imageUrl="https://example.test/a" name="가" />);
    fireEvent.click(screen.getByText('사진 공유·저장'));
    view.rerender(<ImageFileActions imageUrl="https://example.test/b" name="나" />);
    await act(async () => resolve(new File(['old'], 'old.png', { type: 'image/png' })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
});
