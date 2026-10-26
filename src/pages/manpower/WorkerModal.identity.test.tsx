import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { uploadBytes } from 'firebase/storage';
import WorkerModal from './WorkerModal';
import { geminiService } from '../../services/geminiService';
import { showErrorAlert, showSuccessAlert } from '../../utils/swal';

jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({ ref: (_storage: unknown, path: string) => ({ fullPath: path }), uploadBytes: jest.fn() }));
jest.mock('../../services/teamService', () => ({ teamService: {} }));
jest.mock('../../services/geminiService', () => ({ geminiService: { analyzeImage: jest.fn() } }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../utils/swal', () => ({ showSuccessAlert: jest.fn(), showErrorAlert: jest.fn() }));

const fields = { name: '검증작업자', idNumber: '000000-0000000', address: '검증용 주소' };
const file = new File(['fixture'], 'fixture.png', { type: 'image/png' });
beforeEach(() => { jest.clearAllMocks(); (geminiService.analyzeImage as jest.Mock).mockResolvedValue(fields); (uploadBytes as jest.Mock).mockResolvedValue({}); });
afterEach(() => jest.restoreAllMocks());

it.each([false, true])('uploads the recognized image before saving its Storage path (edit=%s)', async edit => {
  const save = jest.fn().mockResolvedValue(undefined), close = jest.fn();
  render(<WorkerModal isOpen onClose={close} onSave={save} teams={[]} companies={[]} positions={[]}
    initialData={edit ? { id: 'fixture-worker', ...fields } : null} />);
  fireEvent.change(screen.getByLabelText('AI 신분증 사진 선택'), { target: { files: [file] } });
  await waitFor(() => expect(showSuccessAlert).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: edit ? '변경사항 저장' : '등록 완료' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(uploadBytes).toHaveBeenCalledWith(expect.objectContaining({ fullPath: expect.stringMatching(/^id_cards\/\d+_fixture\.png$/) }), file);
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ ...fields, fileNameSaved: (uploadBytes as jest.Mock).mock.calls[0][0].fullPath }));
  expect(close).toHaveBeenCalled();
});

it('keeps the modal open and does not save a broken path after an upload failure', async () => {
  const save = jest.fn(), close = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (uploadBytes as jest.Mock).mockRejectedValueOnce(new Error('사진 업로드 실패'));
  render(<WorkerModal isOpen onClose={close} onSave={save} teams={[]} companies={[]} positions={[]} />);
  fireEvent.change(screen.getByLabelText('AI 신분증 사진 선택'), { target: { files: [file] } });
  await waitFor(() => expect(showSuccessAlert).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '등록 완료' }));
  await waitFor(() => expect(showErrorAlert).toHaveBeenCalledWith('저장 실패', '사진 업로드 실패'));
  expect(save).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
