import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeamRequestDraftMaintenance from './TeamRequestDraftMaintenance';

test('빈 검색 페이지를 이어서 조회하고 취소·실패 시 삭제 대상을 유지한다', async () => {
  const draft = { id: 'old-request', lastActivityAt: '2000-01-01T00:00:00Z', retry: false };
  const service = { listDrafts: jest.fn().mockResolvedValueOnce({ retentionDays: 30, drafts: [], nextCursor: 'cursor' }).mockResolvedValueOnce({ retentionDays: 30, drafts: [draft], nextCursor: null }), discardDraft: jest.fn().mockRejectedValueOnce(new Error('정리 실패')).mockResolvedValue({}) };
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<TeamRequestDraftMaintenance service={service} />);
  expect(service.listDrafts).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('정리 대상 확인'));
  fireEvent.click(await screen.findByText('다음 정리 대상 확인'));
  const remove = await screen.findByText('첨부와 임시 신청 삭제');
  expect(service.listDrafts).toHaveBeenLastCalledWith('cursor');
  fireEvent.click(remove); expect(service.discardDraft).not.toHaveBeenCalled();
  confirm.mockReturnValue(true); fireEvent.click(remove);
  expect(await screen.findByRole('alert')).toHaveTextContent('정리 실패');
  expect(remove).toBeInTheDocument();
  fireEvent.click(remove);
  await waitFor(() => expect(screen.queryByText('첨부와 임시 신청 삭제')).not.toBeInTheDocument());
  confirm.mockRestore();
});
