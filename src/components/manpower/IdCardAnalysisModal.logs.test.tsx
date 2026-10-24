import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import IdCardAnalysisModal from './IdCardAnalysisModal';
import { geminiService } from '../../services/geminiService';
import { recordIdentityDocumentLog } from '../../services/identityDocumentLogService';

jest.mock('../../services/geminiService', () => ({ geminiService: { getKey: () => 'test', analyzeImage: jest.fn() } }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  URL.createObjectURL = jest.fn(() => 'blob:test');
});
afterEach(() => { jest.useRealTimers(); });

it('records added files and each final bulk analysis result without private OCR data', async () => {
  (geminiService.analyzeImage as jest.Mock)
    .mockResolvedValueOnce({ name: '테스트', idNumber: 'private-number', address: 'private-address' })
    .mockRejectedValueOnce(new Error('analysis failed'));
  render(<IdCardAnalysisModal isOpen onClose={jest.fn()} existingWorkers={[]} onAddWorkers={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('대량 등록 신분증 사진 선택'), { target: { files: [
    new File(['a'], 'first.png', { type: 'image/png' }), new File(['b'], 'second.png', { type: 'image/png' }),
  ] } });
  expect(recordIdentityDocumentLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'files_added', fileCount: 2 }));
  fireEvent.click(screen.getByRole('button', { name: 'AI 분석 시작' }));
  await waitFor(() => expect(recordIdentityDocumentLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'document_analysis', status: 'success', fileNames: ['first.png'] })));
  await act(async () => { jest.advanceTimersByTime(2000); });
  await waitFor(() => expect(recordIdentityDocumentLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'document_analysis', status: 'failure', fileNames: ['second.png'] })));
  expect(JSON.stringify((recordIdentityDocumentLog as jest.Mock).mock.calls)).not.toContain('private');
});
