import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ConstructionPlanRecordListPage from './ConstructionPlanRecordListPage';
import ConstructionPlanRecordDetailPage from './ConstructionPlanRecordDetailPage';
import {
  getConstructionPlanRecord,
  listConstructionPlanRecords,
  updateConstructionPlanRecord,
} from '../services/constructionPlanRecordService';
import { listConstructionPlansServer } from '../services/constructionPlanWorkflowApi';

jest.mock('../../../config/firebase', () => ({ functions: {}, storage: {} }));
jest.mock('../services/constructionPlanRecordService', () => {
  const actual = jest.requireActual('../services/constructionPlanRecordService');
  return {
    ...actual,
    listConstructionPlanRecords: jest.fn(),
    getConstructionPlanRecord: jest.fn(),
    createConstructionPlanRecord: jest.fn(),
    updateConstructionPlanRecord: jest.fn(),
    confirmConstructionPlanRecord: jest.fn(),
    createConstructionPlanRecordCorrection: jest.fn(),
    generateConstructionPlanRecordAppendixPdf: jest.fn(),
    downloadConstructionPlanRecordAppendixPdf: jest.fn(),
    downloadConstructionPlanRecordPhoto: jest.fn(),
  };
});
jest.mock('../services/constructionPlanWorkflowApi', () => ({ listConstructionPlansServer: jest.fn() }));
jest.mock('../services/constructionPlanRecordPhotoUploadService', () => ({
  createConstructionPlanRecordPhotoUploadOperation: jest.fn(),
  getConstructionPlanRecordPhotoUploadErrorMessage: jest.fn(() => '사진 오류'),
}));

const mockedList = listConstructionPlanRecords as jest.MockedFunction<typeof listConstructionPlanRecords>;
const mockedGet = getConstructionPlanRecord as jest.MockedFunction<typeof getConstructionPlanRecord>;
const mockedUpdate = updateConstructionPlanRecord as jest.MockedFunction<typeof updateConstructionPlanRecord>;
const mockedPlans = listConstructionPlansServer as jest.MockedFunction<typeof listConstructionPlansServer>;

const record = {
  schemaVersion: 1 as const, id: 'record-a', rootRecordId: 'record-a', recordRevision: 0,
  planId: 'plan-a', siteId: 'site-a', seriesId: 'series-a',
  planBinding: {
    planId: 'plan-a', siteId: 'site-a', seriesId: 'series-a', revision: 2, planStatusAtCreation: 'issued' as const,
    issuedExportId: 'export-a', issuedExportSha256: 'a'.repeat(64), tradeType: 'system-shoring' as const,
    templateId: 'system-shoring-standard', templateVersion: '1.0.0', documentNo: 'CP-SH-001',
    title: '시스템동바리 시공계획서', siteName: '테스트 현장',
  },
  recordType: 'installation_inspection' as const, catalogVersion: 'execution-record-catalog-v1', catalogHash: 'b'.repeat(64),
  questions: [{ id: 'installation-base', category: '기초', text: '기초 상태가 적합하다.', required: true as const, allowNotApplicable: false }],
  resourceCandidates: {
    source: 'issued-plan-snapshot' as const,
    workers: [{ workerId: 'worker-erp-a', name: '김작업', role: '설치팀장' }],
    equipment: [{ equipmentId: 'equipment-plan-a', name: '고소작업대', model: 'CY-20' }],
    confirmers: [{ uid: 'reviewer-a', name: '박검토', role: 'reviewer' as const }],
  },
  workDate: '2026-08-22', building: '101동', floor: '3층', zone: 'A구간', actualWorkers: [], actualEquipment: [],
  responses: [{ questionId: 'installation-base' }], photos: [], status: 'draft' as const, version: 1,
  createdBy: 'author-a', createdByName: '작성자', createdAt: '2026-08-22T00:00:00.000Z',
  updatedBy: 'author-a', updatedByName: '작성자', updatedAt: '2026-08-22T00:00:00.000Z',
};

const minimalPlan = {
  id: 'plan-a', siteId: 'site-a', status: 'issued', documentNo: 'CP-SH-001', revision: 2,
  projectSnapshot: { siteName: '테스트 현장' },
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockedList.mockResolvedValue([]);
  mockedPlans.mockResolvedValue([]);
  mockedGet.mockResolvedValue(record);
  mockedUpdate.mockResolvedValue({ ...record, version: 2, building: '102동', status: 'draft' });
});

const routerFuture = { v7_relativeSplatPath: true, v7_startTransition: true } as const;
const renderList = () => render(<MemoryRouter future={routerFuture}><ConstructionPlanRecordListPage /></MemoryRouter>);
const renderDetail = () => render(<MemoryRouter future={routerFuture} initialEntries={['/construction-plan-records/record-a']}><Routes><Route path="/construction-plan-records/:recordId" element={<ConstructionPlanRecordDetailPage />} /><Route path="/construction-plan-records" element={<div>목록</div>} /></Routes></MemoryRouter>);

test('record list exposes loading then an actionable empty state', async () => {
  renderList();
  expect(screen.getByText('현장 실행기록을 불러오는 중입니다.')).toBeInTheDocument();
  expect(await screen.findByText('아직 등록된 실행기록이 없습니다.')).toBeInTheDocument();
  expect(screen.getByText(/서버 표준 문항/)).toBeInTheDocument();
});

test('record list renders bound plan/status rows and filters', async () => {
  mockedList.mockResolvedValue([record]);
  mockedPlans.mockResolvedValue([minimalPlan]);
  renderList();
  expect(await screen.findByRole('heading', { name: '설치 검측' })).toBeInTheDocument();
  expect(screen.getAllByText('작성 전')).toHaveLength(2);
  expect(screen.getAllByText(/CP-SH-001/)).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('실행기록 검색'), { target: { value: '없는 현장' } });
  expect(screen.getByText('조건에 맞는 실행기록이 없습니다.')).toBeInTheDocument();
});

test('record list provides error recovery', async () => {
  mockedList.mockRejectedValue(new Error('network'));
  renderList();
  expect(await screen.findByText(/처리하지 못했습니다/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /다시 시도/ })).toBeInTheDocument();
});

test('record detail renders mobile-first scope, server catalog, evidence and confirmation gate', async () => {
  renderDetail();
  expect(screen.getByText('실행기록을 불러오는 중입니다.')).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: '설치 검측' })).toBeInTheDocument();
  expect(screen.getByText('서버 표준 체크리스트')).toBeInTheDocument();
  expect(screen.getByText('기초 상태가 적합하다.')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '박검토 · 검토자' })).toBeInTheDocument();
  expect(screen.queryByText(/지정 확인자 UID/)).not.toBeInTheDocument();
  expect(screen.getByText(/확인 필요/)).toBeInTheDocument();
  expect(screen.getByText(/자동 합격으로 전환되지 않습니다/)).toBeInTheDocument();
});

test('record detail surfaces load failure with a retry action', async () => {
  mockedGet.mockRejectedValue(new Error('network'));
  renderDetail();
  expect(await screen.findByText(/처리하지 못했습니다/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /다시 시도/ })).toBeInTheDocument();
});

test('record detail autosaves a structured scope change', async () => {
  renderDetail();
  await screen.findByRole('heading', { name: '설치 검측' });
  jest.useFakeTimers();
  fireEvent.change(screen.getByDisplayValue('101동'), { target: { value: '102동' } });
  expect(screen.getByText('저장 대기')).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(1000); });
  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({ building: '102동', expectedVersion: 1 })));
  jest.useRealTimers();
});

test('record detail selects ERP/plan resources and preserves their source IDs', async () => {
  renderDetail();
  await screen.findByRole('heading', { name: '설치 검측' });
  jest.useFakeTimers();
  fireEvent.change(screen.getByLabelText('ERP/계획 스냅샷 작업자 선택'), { target: { value: 'worker-erp-a' } });
  fireEvent.change(screen.getByLabelText('계획 장비 선택'), { target: { value: 'equipment-plan-a' } });
  expect(screen.getByText(/ERP\/계획 ID worker-erp-a/)).toBeInTheDocument();
  expect(screen.getByText(/계획 ID equipment-plan-a/)).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(1000); });
  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({
    actualWorkers: [expect.objectContaining({ workerId: 'worker-erp-a', name: '김작업' })],
    actualEquipment: [expect.objectContaining({ equipmentId: 'equipment-plan-a', name: '고소작업대' })],
  })));
  jest.useRealTimers();
});

test('record detail retries an ambiguous autosave with the exact same idempotency key', async () => {
  mockedUpdate.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ...record, version: 2, building: '102동', status: 'draft' });
  renderDetail();
  await screen.findByRole('heading', { name: '설치 검측' });
  jest.useFakeTimers();
  fireEvent.change(screen.getByDisplayValue('101동'), { target: { value: '102동' } });
  await act(async () => { jest.advanceTimersByTime(1000); });
  await waitFor(() => expect(screen.getByText('저장 실패')).toBeInTheDocument());
  const firstKey = mockedUpdate.mock.calls[0][0].idempotencyKey;
  fireEvent.click(screen.getByRole('button', { name: '재시도' }));
  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(2));
  expect(mockedUpdate.mock.calls[1][0].idempotencyKey).toBe(firstKey);
  jest.useRealTimers();
});

test('record detail keeps dirty input offline and retries the frozen request after reconnect', async () => {
  renderDetail();
  await screen.findByRole('heading', { name: '설치 검측' });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  act(() => { window.dispatchEvent(new Event('offline')); });
  jest.useFakeTimers();
  fireEvent.change(screen.getByDisplayValue('101동'), { target: { value: '103동' } });
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(screen.getByText('오프라인 작성 중')).toBeInTheDocument();
  expect(mockedUpdate).not.toHaveBeenCalled();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  act(() => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({ building: '103동' })));
  jest.useRealTimers();
});

test('record detail warns and starts a best-effort flush before leaving with dirty input', async () => {
  renderDetail();
  await screen.findByRole('heading', { name: '설치 검측' });
  fireEvent.change(screen.getByDisplayValue('101동'), { target: { value: '104동' } });
  const beforeUnload = new Event('beforeunload', { cancelable: true });
  act(() => { window.dispatchEvent(beforeUnload); });
  expect(beforeUnload.defaultPrevented).toBe(true);
  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({ building: '104동' })));
});
