import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ConstructionPlan } from '../types';
import {
  getConstructionPlanTemplateUpgradeProposal,
  loadConstructionPlanCreationTemplateCatalog,
} from '../services/constructionPlanTemplateService';
import ConstructionPlanDeriveDialog, {
  type ConstructionPlanDeriveSubmission,
} from './ConstructionPlanDeriveDialog';

jest.mock('../services/constructionPlanTemplateService', () => ({
  loadConstructionPlanCreationTemplateCatalog: jest.fn(),
  getConstructionPlanTemplateUpgradeProposal: jest.fn((input: {
    tradeType: string;
    templateId: string;
    templateVersion: string;
  }) => ({
    available: false,
    mode: 'new-revision-only',
    currentKey: `${input.tradeType}:${input.templateId}@${input.templateVersion}`,
  })),
}));

const loadTemplateCatalog = loadConstructionPlanCreationTemplateCatalog as jest.MockedFunction<
  typeof loadConstructionPlanCreationTemplateCatalog
>;
const getUpgradeProposal = getConstructionPlanTemplateUpgradeProposal as jest.MockedFunction<
  typeof getConstructionPlanTemplateUpgradeProposal
>;

const sourcePlan = {
  id: 'plan-with-a-very-long-legacy-id-that-must-never-be-copied-into-the-idempotency-key',
  title: 'A현장 시스템동바리 시공계획서',
  documentNo: 'CY-A-2026-SD-01',
  revision: 2,
  status: 'issued',
  tradeType: 'system-shoring',
  templateId: 'system-shoring-standard',
  templateVersion: '1.0.0',
  projectSnapshot: {
    capturedAt: '2026-08-20T00:00:00.000Z',
    siteName: 'A현장',
    buildings: ['101동'],
    floors: ['B1F'],
    zones: ['A구간'],
  },
} as Pick<ConstructionPlan,
  'id' | 'title' | 'documentNo' | 'revision' | 'status' | 'projectSnapshot'
  | 'tradeType' | 'templateId' | 'templateVersion'>;

describe('ConstructionPlanDeriveDialog', () => {
  beforeEach(() => {
    getUpgradeProposal.mockImplementation((input) => ({
      available: false,
      mode: 'new-revision-only',
      currentKey: `${input.tradeType}:${input.templateId}@${input.templateVersion}`,
    }));
    loadTemplateCatalog.mockResolvedValue({
      source: 'server',
      templates: [],
      serverTemplates: [],
    });
  });

  it('validates a revision, defaults drawing copy on, and uses a bounded idempotency key', async () => {
    const onSubmit = jest.fn<Promise<void>, [ConstructionPlanDeriveSubmission]>().mockResolvedValue();
    render(
      <ConstructionPlanDeriveDialog
        open
        mode="revision"
        sourcePlan={sourcePlan}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    const submit = screen.getByRole('button', { name: /다음 Rev\. 초안 만들기/ });
    const copyDrawings = screen.getByRole('checkbox', { name: /도면과 구간 표시 복사/ });
    expect(copyDrawings).toBeChecked();
    expect(submit).toBeDisabled();
    expect(await screen.findByText('현재 게시 최신 버전입니다')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /변경유형/ }), {
      target: { value: 'site_condition' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /개정 사유/ }), {
      target: { value: '지하층 현장 조건 변경' },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submission = onSubmit.mock.calls[0][0];
    expect(submission).toMatchObject({
      mode: 'revision',
      sourcePlanId: sourcePlan.id,
      revisionReason: '지하층 현장 조건 변경',
      revisionType: 'site_condition',
      copyDrawings: true,
    });
    expect(submission).not.toHaveProperty('targetTemplate');
    expect(submission.idempotencyKey).toMatch(/^cp-revision-/);
    expect(submission.idempotencyKey.length).toBeLessThanOrEqual(128);
  });

  it('keeps the same key and form values after an API error, then allows retry', async () => {
    const onSubmit = jest.fn<Promise<void>, [ConstructionPlanDeriveSubmission]>()
      .mockRejectedValueOnce(new Error('일시적인 서버 오류입니다.'))
      .mockResolvedValueOnce();
    render(
      <ConstructionPlanDeriveDialog
        open
        mode="clone"
        sourcePlan={sourcePlan}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /도면과 구간 표시 복사/ })).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: /새 계획서 제목/ })).toHaveValue(`${sourcePlan.title} 복제본`);
    expect(screen.getByText(/조직 배정은 서버의 안전 기본값/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '독립 초안 복제' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('일시적인 서버 오류입니다.');
    fireEvent.click(screen.getByRole('button', { name: '독립 초안 복제' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0].idempotencyKey).toBe(onSubmit.mock.calls[0][0].idempotencyKey);
    expect(screen.getByRole('textbox', { name: /새 계획서 제목/ })).toHaveValue(`${sourcePlan.title} 복제본`);
  });

  it('focuses the first field and synchronously blocks duplicate submits', async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = jest.fn<Promise<void>, [ConstructionPlanDeriveSubmission]>(() => new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    }));
    render(
      <ConstructionPlanDeriveDialog
        open
        mode="clone"
        sourcePlan={sourcePlan}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    const titleInput = screen.getByRole('textbox', { name: /새 계획서 제목/ });
    await waitFor(() => expect(titleInput).toHaveFocus());
    const submit = screen.getByRole('button', { name: '독립 초안 복제' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolveSubmit?.();
  });
});
