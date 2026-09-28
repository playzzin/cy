import React from 'react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import IdentityLogPage from './IdentityLogPage';
import { identityBundleLogService } from '../../services/identityBundleLogService';

jest.mock('../../services/identityBundleLogService', () => ({
  ...jest.requireActual('../../services/identityBundleLogService'),
  identityBundleLogService: { subscribe: jest.fn() },
}));
jest.mock('../../config/firebase', () => ({ db: {}, auth: {} }));
jest.mock('../../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
const fixture = { actorId: 'actor', actorName: '로그 담당자', actorEmail: 'logs@example.test', fileCount: 1, personCount: 1, personNames: ['테스트 대상'], fileNames: ['sample.png'] };
const unsubscribe = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (identityBundleLogService.subscribe as jest.Mock).mockImplementation((onLogs) => {
    onLogs([
    { ...fixture, id: 'success', action: 'worker_created', status: 'success', workerId: 'worker-1', createdAt: '2026-09-09T03:00:00Z' },
    { ...fixture, id: 'failure', action: 'analysis', status: 'failure', reason: 'processing_failed', personNames: ['다른 대상'], createdAt: '2026-09-08T03:00:00Z' },
    ]);
    return unsubscribe;
  });
});
const open = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><IdentityLogPage /></MemoryRouter>);

it('shows identity history, filters by actor/action/status/date and expands details', async () => {
  open();
  await screen.findByRole('button', { name: 'DB 신규 등록 상세 보기' });
  fireEvent.change(screen.getByLabelText('신분증 로그 검색'), { target: { value: '로그 담당자' } });
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-09-09' } });
  expect(screen.queryByRole('button', { name: 'AI 빠른 묶기 상세 보기' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'DB 신규 등록 상세 보기' }));
  expect(screen.getByText('worker-1')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('작업 종류'), { target: { value: 'analysis' } });
  fireEvent.change(screen.getByLabelText('처리 결과'), { target: { value: 'failure' } });
  expect(screen.getByRole('button', { name: 'AI 빠른 묶기 상세 보기' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'DB 신규 등록 상세 보기' })).not.toBeInTheDocument();
});

it('distinguishes an unavailable history from a truly empty history', async () => {
  (identityBundleLogService.subscribe as jest.Mock).mockImplementation((_onLogs, onError) => { onError(new Error('denied')); return unsubscribe; });
  open();
  expect(await screen.findByRole('alert')).toHaveTextContent('신분증 로그를 불러오지 못했습니다');
  expect(screen.queryByText('조건에 맞는 신분증 로그가 없습니다.')).not.toBeInTheDocument();
  (identityBundleLogService.subscribe as jest.Mock).mockImplementation((onLogs) => { onLogs([]); return unsubscribe; });
  fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
  expect(await screen.findByText('조건에 맞는 신분증 로그가 없습니다.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('updates an already open history when a database registration arrives and stops listening on unmount', async () => {
  const view = open();
  const onLogs = (identityBundleLogService.subscribe as jest.Mock).mock.calls[0][0];
  act(() => onLogs([{ ...fixture, id: 'new-document', action: 'document_registered', source: 'worker_database', status: 'success', createdAt: '2026-09-29T03:00:00Z' }]));
  expect(await screen.findByRole('button', { name: '신분증 자료 등록 상세 보기' })).toBeInTheDocument();
  expect(screen.getByText('작업자·통합DB')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'DB 신규 등록 상세 보기' })).not.toBeInTheDocument();
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
