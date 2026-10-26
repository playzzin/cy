import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerForm from './WorkerForm';
import { geminiService } from '../../services/geminiService';
import { showErrorAlert, showSuccessAlert } from '../../utils/swal';

jest.mock('../../services/teamService', () => ({ teamService: {} }));
jest.mock('../../services/geminiService', () => ({ geminiService: { analyzeImage: jest.fn() } }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));
jest.mock('../../utils/swal', () => ({ showSuccessAlert: jest.fn(), showErrorAlert: jest.fn() }));

const props = { teams: [], companies: [], positions: [], onSave: jest.fn(), onCancel: jest.fn() };
const file = new File(['synthetic fixture'], 'fixture.png', { type: 'image/png' });
const result = { name: '테스트작업자', idNumber: '000000-0000000', address: '검증용 주소' };
const input = () => screen.getByLabelText('AI 신분증 사진 선택') as HTMLInputElement;

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

it.each([false, true])('attaches the recognized photo when saving (edit=%s)', async isEditMode => {
  (geminiService.analyzeImage as jest.Mock).mockResolvedValue(result);
  render(<WorkerForm {...props} isEditMode={isEditMode}
    initialData={isEditMode ? { id: 'fixture-worker', ...result, fileNameSaved: 'id_cards/old.png' } as any : null} />);
  fireEvent.change(input(), { target: { files: [file] } });
  await waitFor(() => expect(showSuccessAlert).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: isEditMode ? '변경사항 저장' : '등록 완료' }));
  await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining(result), file));
});

it('shows progress and prevents submitting until recognition finishes', async () => {
  let finish!: (value: typeof result) => void;
  (geminiService.analyzeImage as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<WorkerForm {...props} />);
  fireEvent.change(input(), { target: { files: [file] } });
  expect(screen.getByRole('status')).toHaveTextContent('신분증을 인식하고 있습니다');
  expect(screen.getByRole('button', { name: '등록 완료' })).toBeDisabled();
  await act(async () => finish(result));
  expect(screen.getByRole('button', { name: '등록 완료' })).toBeEnabled();
});

it('opens the picker belonging to the clicked form', () => {
  render(<><WorkerForm {...props} /><WorkerForm {...props} /></>);
  const inputs = screen.getAllByLabelText('AI 신분증 사진 선택');
  const firstClick = jest.spyOn(inputs[0], 'click').mockImplementation(() => {});
  const secondClick = jest.spyOn(inputs[1], 'click').mockImplementation(() => {});
  fireEvent.click(screen.getAllByTitle('AI 신분증 인식')[1]);
  expect(secondClick).toHaveBeenCalledTimes(1);
  expect(firstClick).not.toHaveBeenCalled();
});

it('preserves existing values after failure and allows retrying the same file', async () => {
  (geminiService.analyzeImage as jest.Mock).mockRejectedValueOnce(new Error('사진을 확인해 주세요.')).mockResolvedValueOnce(result);
  render(<WorkerForm {...props} initialData={{ id: 'fixture-worker', ...result } as any} isEditMode />);
  fireEvent.change(input(), { target: { files: [file] } });
  await waitFor(() => expect(showErrorAlert).toHaveBeenCalledWith('인식 실패', '사진을 확인해 주세요.'));
  expect(screen.getByPlaceholderText('이름 입력')).toHaveValue(result.name);
  expect(input().value).toBe('');
  fireEvent.change(input(), { target: { files: [file] } });
  await waitFor(() => expect(showSuccessAlert).toHaveBeenCalled());
  expect(geminiService.analyzeImage).toHaveBeenCalledTimes(2);
});

it('ignores an old response after switching to another worker', async () => {
  let finish!: (value: typeof result) => void;
  (geminiService.analyzeImage as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { rerender } = render(<WorkerForm {...props} />);
  fireEvent.change(input(), { target: { files: [file] } });
  rerender(<WorkerForm {...props} isEditMode initialData={{ id: 'another-worker', name: '다른검증작업자' } as any} />);
  await act(async () => finish(result));
  expect(screen.getByPlaceholderText('이름 입력')).toHaveValue('다른검증작업자');
  expect(showSuccessAlert).not.toHaveBeenCalled();
});

it('saves a photo with an inferred MIME type instead of an untyped upload', async () => {
  (geminiService.analyzeImage as jest.Mock).mockResolvedValue(result);
  render(<WorkerForm {...props} />);
  fireEvent.change(input(), { target: { files: [new File(['fixture'], 'fixture.png')] } });
  await waitFor(() => expect(showSuccessAlert).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '등록 완료' }));
  await waitFor(() => expect(props.onSave).toHaveBeenCalled());
  expect(props.onSave.mock.calls[0][1]).toMatchObject({ name: 'fixture.png', type: 'image/png' });
});

it('preserves unread fields and tells the user to review a partial result', async () => {
  (geminiService.analyzeImage as jest.Mock).mockResolvedValue({ name: result.name, idNumber: '', address: '' });
  render(<WorkerForm {...props} isEditMode initialData={{ id: 'fixture-worker', ...result } as any} />);
  fireEvent.change(input(), { target: { files: [file] } });
  await waitFor(() => expect(showSuccessAlert).toHaveBeenCalledWith('인식 성공', expect.stringContaining('주민번호, 주소')));
  expect(screen.getByPlaceholderText('000000-0000000')).toHaveValue(result.idNumber);
});
