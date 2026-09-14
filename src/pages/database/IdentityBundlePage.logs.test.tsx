import React from 'react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IdentityBundlePage from './IdentityBundlePage';
import { identityBundleService } from '../../services/identityBundleService';
import { identityBundleLogService } from '../../services/identityBundleLogService';
import { manpowerService } from '../../services/manpowerService';
import { storageService } from '../../services/storageService';
import { renderIdentityBundleBlob } from '../../utils/identityBundleComposer';
import { compressIdentityImageForStorage } from '../../utils/identityImageCompression';

jest.mock('../../services/identityBundleService', () => ({ identityBundleService: { validateFiles: jest.fn(), analyzeFiles: jest.fn(), analyzeRegistrationPreview: jest.fn() } }));
jest.mock('../../services/identityBundleLogService', () => ({ IDENTITY_LOG_PATH: '/database/identity-logs', identityBundleLogService: { log: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn(), addWorker: jest.fn(), updateWorker: jest.fn() } }));
jest.mock('../../services/storageService', () => ({ storageService: { uploadFileInfo: jest.fn(), deleteFile: jest.fn() } }));
jest.mock('../../utils/identityBundleComposer', () => ({ renderIdentityBundleBlob: jest.fn() }));
jest.mock('../../utils/identityImageCompression', () => ({ compressIdentityImageForStorage: jest.fn(async () => ({ file: new File(['compressed'], 'sample.jpg'), width: 100, height: 100 })) }));
jest.mock('../../components/identity/IdentityCropEditor', () => () => null);
const log = identityBundleLogService.log as jest.Mock;
const analysis = { fileIndex: 0, originalFileName: 'sample.png', personName: '테스트 대상', birthDate: '', identityHash: '',
  identityNumber: '', address: '', documentType: 'OTHER_ID', documentLabel: '신분증', crop: { x: 0, y: 0, width: 1, height: 1 },
  confidence: 1, matchingConfidence: 1, warnings: [] };
beforeEach(() => {
  jest.clearAllMocks();
  log.mockResolvedValue(true);
  URL.createObjectURL = jest.fn(() => 'blob:test');
  URL.revokeObjectURL = jest.fn();
  (identityBundleService.analyzeFiles as jest.Mock).mockResolvedValue([analysis]);
  (identityBundleService.analyzeRegistrationPreview as jest.Mock).mockResolvedValue({ name: '테스트 대상', idNumber: '', address: '테스트 주소' });
  (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
  (manpowerService.addWorker as jest.Mock).mockResolvedValue('created-worker');
  (manpowerService.updateWorker as jest.Mock).mockResolvedValue(undefined);
  (storageService.uploadFileInfo as jest.Mock).mockResolvedValue({ fullPath: 'id_cards/test.jpg' });
  (renderIdentityBundleBlob as jest.Mock).mockResolvedValue(new Blob(['test'], { type: 'image/jpeg' }));
  (compressIdentityImageForStorage as jest.Mock).mockResolvedValue({ file: new File(['compressed'], 'sample.jpg'), width: 100, height: 100 });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());
const openWithFile = () => {
  const view = render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><IdentityBundlePage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('신분증 사진 선택'), { target: { files: [new File(['test'], 'sample.png', { type: 'image/png' })] } });
  return view;
};
const analyze = async () => {
  fireEvent.click(screen.getByRole('button', { name: /1단계 · 빠르게/ }));
  await screen.findByRole('button', { name: 'JPG 받기' });
};
const previewForRegistration = async () => {
  await analyze();
  fireEvent.click(screen.getByRole('button', { name: '묶음사진 미리보기' }));
  fireEvent.click(await screen.findByRole('button', { name: 'AI 상세 분석' }));
};

it('records added files, analysis, identity confirmation and image downloads', async () => {
  openWithFile();
  expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'files_added', status: 'success', fileCount: 1 }));
  await analyze();
  expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'analysis', status: 'success', personCount: 1 }));
  fireEvent.click(screen.getByRole('button', { name: '이 묶음은 동일인입니다' }));
  expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'identity_confirmed' }));
  fireEvent.click(screen.getByRole('button', { name: 'JPG 받기' }));
  await waitFor(() => expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'download_image', status: 'success' })));
});

it('records analysis failure without claiming success', async () => {
  (identityBundleService.analyzeFiles as jest.Mock).mockRejectedValue(new Error('analysis failed'));
  openWithFile();
  fireEvent.click(screen.getByRole('button', { name: /1단계 · 빠르게/ }));
  await waitFor(() => expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'analysis', status: 'failure' })));
  expect(log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'analysis', status: 'success' }));
});

it('records the committed worker ID after DB registration without copying OCR data', async () => {
  openWithFile();
  await previewForRegistration();
  fireEvent.click(await screen.findByRole('button', { name: '통합DB에 신규 등록' }));
  await waitFor(() => expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'worker_created', status: 'success', workerId: 'created-worker' })));
  expect(JSON.stringify(log.mock.calls)).not.toContain('테스트 주소');
  expect(JSON.stringify(log.mock.calls)).not.toContain('id_cards/test.jpg');
});

it('records DB failure, cleans the uncommitted image and does not record successful registration', async () => {
  (manpowerService.addWorker as jest.Mock).mockRejectedValue(new Error('DB failed'));
  openWithFile();
  await previewForRegistration();
  fireEvent.click(await screen.findByRole('button', { name: '통합DB에 신규 등록' }));
  await waitFor(() => expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'worker_created', status: 'failure' })));
  expect(storageService.deleteFile).toHaveBeenCalledWith('id_cards/test.jpg');
  expect(log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'worker_created', status: 'success' }));
});

it('keeps the successful upload visible and warns when its log cannot be saved', async () => {
  log.mockResolvedValue(false);
  openWithFile();
  expect(await screen.findByRole('alert')).toHaveTextContent('신분증 로그 저장에 실패');
  expect(screen.getByRole('button', { name: 'sample.png 삭제' })).toBeInTheDocument();
});
