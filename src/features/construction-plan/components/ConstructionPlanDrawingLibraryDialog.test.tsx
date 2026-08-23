import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createConstructionPlanDrawingLibraryImportIdempotencyKey,
  importConstructionPlanDrawingFromLibrary,
  listConstructionPlanDrawingLibrary,
} from '../services/constructionPlanDrawingLibraryService';
import ConstructionPlanDrawingLibraryDialog from './ConstructionPlanDrawingLibraryDialog';

jest.mock('../services/constructionPlanDrawingLibraryService', () => ({
  createConstructionPlanDrawingLibraryImportIdempotencyKey: jest.fn(() => 'cp-drawing-reuse-test'),
  importConstructionPlanDrawingFromLibrary: jest.fn(),
  listConstructionPlanDrawingLibrary: jest.fn(),
}));

const mockedList = listConstructionPlanDrawingLibrary as jest.MockedFunction<
  typeof listConstructionPlanDrawingLibrary
>;
const mockedImport = importConstructionPlanDrawingFromLibrary as jest.MockedFunction<
  typeof importConstructionPlanDrawingFromLibrary
>;
const mockedCreateKey = createConstructionPlanDrawingLibraryImportIdempotencyKey as jest.MockedFunction<
  typeof createConstructionPlanDrawingLibraryImportIdempotencyKey
>;

const reusableItem = {
  sourcePlanId: 'plan-source',
  sourcePlanTitle: '기준 계획서',
  sourceDocumentNo: 'CP-001',
  sourcePlanRevision: 2,
  sourcePlanStatus: 'issued',
  drawingId: 'drawing-source',
  drawingNo: 'D-01',
  title: '설치 평면도',
  originalFileName: 'drawing.pdf',
  mimeType: 'application/pdf' as const,
  sizeBytes: 1024,
  sourceSha256: 'a'.repeat(64),
  approvalStatus: 'approved',
  reusable: true,
};

describe('ConstructionPlanDrawingLibraryDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateKey.mockReturnValue('cp-drawing-reuse-test');
  });

  it('shows load failure and recovers through an explicit retry', async () => {
    mockedList
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ items: [reusableItem] });
    render(
      <ConstructionPlanDrawingLibraryDialog
        open
        targetPlanId="plan-target"
        targetSectionId="section-drawing"
        expectedLockVersion={3}
        onClose={jest.fn()}
        onImported={jest.fn()}
      />,
    );
    expect(await screen.findByText('network unavailable')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /다시 조회/ }));
    expect(await screen.findByText(/D-01 · 설치 평면도/)).not.toBeNull();
    expect(mockedList).toHaveBeenCalledTimes(2);
  });

  it('keeps legacy unsafe drawings visible but impossible to select', async () => {
    mockedList.mockResolvedValue({
      items: [{
        ...reusableItem,
        drawingId: 'legacy-drawing',
        sourceSha256: '',
        reusable: false,
        reuseBlockReason: '원본 Storage generation이 없는 legacy 도면입니다.',
      }],
    });
    render(
      <ConstructionPlanDrawingLibraryDialog
        open
        targetPlanId="plan-target"
        targetSectionId="section-drawing"
        expectedLockVersion={3}
        onClose={jest.fn()}
        onImported={jest.fn()}
      />,
    );
    const item = await screen.findByRole('button', { name: /D-01 · 설치 평면도/ });
    expect((item as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/generation이 없는 legacy/)).not.toBeNull();
  });

  it('prevents double submit, keeps the same request key, and reports re-review state', async () => {
    mockedList.mockResolvedValue({ items: [reusableItem] });
    let completeImport!: (value: Awaited<ReturnType<typeof importConstructionPlanDrawingFromLibrary>>) => void;
    mockedImport.mockImplementation(() => new Promise((resolve) => { completeImport = resolve; }));
    const onImported = jest.fn();
    render(
      <ConstructionPlanDrawingLibraryDialog
        open
        targetPlanId="plan-target"
        targetSectionId="section-drawing"
        expectedLockVersion={3}
        onClose={jest.fn()}
        onImported={onImported}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /D-01 · 설치 평면도/ }));
    const submit = screen.getByRole('button', { name: '이 도면 가져오기' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(mockedImport).toHaveBeenCalledTimes(1);
    expect(mockedImport).toHaveBeenCalledWith(expect.objectContaining({
      targetPlanId: 'plan-target',
      sourcePlanId: 'plan-source',
      sourceDrawingId: 'drawing-source',
      expectedLockVersion: 3,
      idempotencyKey: 'cp-drawing-reuse-test',
    }));

    await act(async () => {
      completeImport({
        planId: 'plan-target',
        sourcePlanId: 'plan-source',
        sourceDrawingId: 'drawing-source',
        targetDrawingId: 'drawing-imported',
        lockVersion: 4,
        plan: {} as never,
        drawing: { drawingNo: 'D-01' } as never,
        section: {} as never,
        idempotent: false,
      });
    });
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/D-01을 가져왔습니다/)).not.toBeNull();
    expect(screen.getByText(/승인정보와 적용구간을 다시 확인/)).not.toBeNull();
  });
});
