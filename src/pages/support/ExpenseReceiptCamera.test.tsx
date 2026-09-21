import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExpenseReceiptCamera from './ExpenseReceiptCamera';

const getUserMedia = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});
afterEach(() => jest.restoreAllMocks());

test('후면 카메라로 촬영한 JPEG를 첨부하고 닫으면 카메라를 종료한다', async () => {
  const stop = jest.fn();
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });
  const onCapture = jest.fn();
  const drawImage = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as any);
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['jpeg'], { type: 'image/jpeg' })));
  const { unmount } = render(<ExpenseReceiptCamera onCapture={onCapture} onClose={jest.fn()} onDeviceCamera={jest.fn()} />);
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
  expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: 'environment' } }) }));
  const video = screen.getByLabelText('영수증 카메라 미리보기');
  Object.defineProperties(video, { videoWidth: { value: 4000 }, videoHeight: { value: 3000 } });
  fireEvent.loadedData(video);
  fireEvent.click(screen.getByRole('button', { name: '촬영해서 첨부' }));
  expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 2048, 1536);
  expect(onCapture.mock.calls[0][0]).toBeInstanceOf(File);
  expect(onCapture.mock.calls[0][0].type).toBe('image/jpeg');
  unmount();
  expect(stop).toHaveBeenCalledTimes(1);
});

test('권한 거절 시 안내와 기기 카메라 대체 수단을 표시한다', async () => {
  getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
  const onDeviceCamera = jest.fn();
  render(<ExpenseReceiptCamera onCapture={jest.fn()} onClose={jest.fn()} onDeviceCamera={onDeviceCamera} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('카메라 권한');
  expect(screen.getByRole('button', { name: '촬영해서 첨부' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '기기 카메라 열기' }));
  expect(onDeviceCamera).toHaveBeenCalledTimes(1);
});

test('카메라 권한 응답 전에 닫아도 늦게 열린 카메라를 종료한다', async () => {
  let resolveStream!: (value: any) => void;
  getUserMedia.mockImplementation(() => new Promise(resolve => { resolveStream = resolve; }));
  const stop = jest.fn();
  const { unmount } = render(<ExpenseReceiptCamera onCapture={jest.fn()} onClose={jest.fn()} onDeviceCamera={jest.fn()} />);
  unmount();
  resolveStream({ getTracks: () => [{ stop }] });
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
});
