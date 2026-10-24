import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getDownloadURL } from 'firebase/storage';
import WorkerTable from './WorkerTable';
import { recordIdentityDocumentLog } from '../../services/identityDocumentLogService';

jest.mock('../../config/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({ ref: jest.fn(), getDownloadURL: jest.fn() }));
jest.mock('../../services/identityDocumentLogService', () => ({ recordIdentityDocumentLog: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const open = () => render(<WorkerTable
  workers={[{ id: 'worker-1', name: '테스트', fileNameSaved: 'id_cards/private.jpg', idNumber: 'private-number' } as any]}
  columns={[{ id: 'fileNameSaved', label: '신분증' }]} visibleColumns={['fileNameSaved']} selectedWorkerIds={[]}
  toggleSelectAll={jest.fn()} toggleSelectWorker={jest.fn()} handleEditWorker={jest.fn()} handleDeleteClick={jest.fn()}
  teams={[]} stats={{ total: 1, active: 1, unassigned: 0 }} onStatusToggle={jest.fn()}
/>);

it.each(['success', 'failure'] as const)('records a %s individual download without the image URL or identity number', async (status) => {
  if (status === 'success') (getDownloadURL as jest.Mock).mockResolvedValue('https://example.test/private.jpg');
  else (getDownloadURL as jest.Mock).mockRejectedValue(new Error('unavailable'));
  open();
  fireEvent.click(screen.getByRole('button', { name: '다운로드' }));
  await waitFor(() => expect(recordIdentityDocumentLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'download_image', status, workerId: 'worker-1' })));
  expect(JSON.stringify((recordIdentityDocumentLog as jest.Mock).mock.calls)).not.toContain('private');
});
