import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  initializeConstructionPlanTemplateServer,
  listConstructionPlanTemplatesServer,
  transitionConstructionPlanTemplateLifecycleServer,
  type ConstructionPlanTemplateListItem,
  type ConstructionPlanTemplateListResponse,
} from '../services/constructionPlanTemplateService';
import ConstructionPlanTemplateAdminPage from './ConstructionPlanTemplateAdminPage';

jest.mock('../../../config/firebase', () => ({ functions: { name: 'test-functions' } }));
jest.mock('../services/constructionPlanTemplateService', () => ({
  ...jest.requireActual('../services/constructionPlanTemplateService'),
  listConstructionPlanTemplatesServer: jest.fn(),
  initializeConstructionPlanTemplateServer: jest.fn(),
  transitionConstructionPlanTemplateLifecycleServer: jest.fn(),
}));

const item = (
  overrides: Partial<ConstructionPlanTemplateListItem> = {},
): ConstructionPlanTemplateListItem => ({
  schemaVersion: 1,
  id: `tpl_${'a'.repeat(40)}`,
  key: 'system-shoring:system-shoring-standard@1.0.0',
  name: '시스템동바리 시공계획서 표준',
  tradeType: 'system-shoring',
  templateId: 'system-shoring-standard',
  templateVersion: '1.0.0',
  rendererVersion: 'field-use-a4-v3',
  pageCount: 42,
  manifestHash: 'b'.repeat(64),
  templateBundleHash: 'c'.repeat(64),
  initialized: false,
  lifecycle: 'uninitialized',
  lifecycleVersion: 0,
  isLatest: false,
  selectableForNewPlan: false,
  ...overrides,
});

const response = (
  templates: ConstructionPlanTemplateListItem[],
  canManage = true,
): ConstructionPlanTemplateListResponse => ({
  schemaVersion: 1,
  generatedAt: '2026-08-22T00:00:00.000Z',
  canManage,
  templates,
});

describe('ConstructionPlanTemplateAdminPage', () => {
  const list = listConstructionPlanTemplatesServer as jest.MockedFunction<
    typeof listConstructionPlanTemplatesServer
  >;
  const initialize = initializeConstructionPlanTemplateServer as jest.MockedFunction<
    typeof initializeConstructionPlanTemplateServer
  >;
  const transition = transitionConstructionPlanTemplateLifecycleServer as jest.MockedFunction<
    typeof transitionConstructionPlanTemplateLifecycleServer
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    list.mockResolvedValue(response([item()]));
    initialize.mockResolvedValue({
      schemaVersion: 1,
      template: item({ initialized: true, lifecycle: 'draft', lifecycleVersion: 1 }),
      affectedTemplateKeys: ['system-shoring:system-shoring-standard@1.0.0'],
      idempotent: false,
    });
  });

  it('initializes only the exact server identity with a persisted reason', async () => {
    render(<MemoryRouter><ConstructionPlanTemplateAdminPage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: /서버 등록/ }));
    fireEvent.change(screen.getByLabelText('상태 전이 사유 *'), {
      target: { value: '최초 표준 계약 등록' },
    });
    fireEvent.click(screen.getByRole('button', { name: /작성 중으로 등록/ }));

    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      tradeType: 'system-shoring',
      templateId: 'system-shoring-standard',
      templateVersion: '1.0.0',
      reason: '최초 표준 계약 등록',
      idempotencyKey: expect.stringMatching(/^cp-template-initialize-/),
    }));
    expect(initialize.mock.calls[0][0]).not.toHaveProperty('manifest');
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it('requires a reason and optimistic lifecycle version when retiring a published template', async () => {
    const published = item({
      initialized: true,
      lifecycle: 'published',
      lifecycleVersion: 3,
      isLatest: true,
      selectableForNewPlan: true,
      createdAt: '2026-08-22T00:00:00.000Z',
      createdBy: 'admin-1',
      updatedAt: '2026-08-22T01:00:00.000Z',
      updatedBy: 'admin-1',
      publishedAt: '2026-08-22T01:00:00.000Z',
      publishedBy: 'admin-1',
      lastTransitionReason: '현장사용 표준 게시',
    });
    list.mockResolvedValue(response([published]));
    transition.mockResolvedValue({
      schemaVersion: 1,
      template: { ...published, lifecycle: 'retired', lifecycleVersion: 4, isLatest: false, selectableForNewPlan: false },
      affectedTemplateKeys: [published.key],
      idempotent: false,
    });
    render(<MemoryRouter><ConstructionPlanTemplateAdminPage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: /폐기/ }));
    const confirm = screen.getByRole('button', { name: /게시본 폐기/ });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('상태 전이 사유 *'), {
      target: { value: '새 표준 게시로 구버전 폐기' },
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(transition).toHaveBeenCalledWith(expect.objectContaining({
      toLifecycle: 'retired',
      expectedLifecycleVersion: 3,
      reason: '새 표준 게시로 구버전 폐기',
    })));
  });

  it('shows lifecycle records read-only without central management permission', async () => {
    list.mockResolvedValue(response([item()], false));
    render(<MemoryRouter><ConstructionPlanTemplateAdminPage /></MemoryRouter>);

    expect(await screen.findByText('조회 전용 권한')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /서버 등록/ })).not.toBeInTheDocument();
    expect(screen.getByText('조회 전용')).toBeInTheDocument();
  });

  it('renders a recoverable server error state', async () => {
    list.mockRejectedValue({ code: 'functions/unavailable' });
    render(<MemoryRouter><ConstructionPlanTemplateAdminPage /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('템플릿 목록을 불러오지 못했습니다');
    fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});
