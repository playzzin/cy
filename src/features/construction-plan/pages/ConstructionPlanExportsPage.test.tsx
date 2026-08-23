import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ConstructionPlan } from '../types';
import { listConstructionPlans } from '../services/constructionPlanService';
import { fetchAuditedIssuedConstructionPlanPdfForPlan } from '../services/constructionPlanIssuedDownloadService';
import { downloadConstructionPlanPdf } from '../services/constructionPlanPdfService';
import ConstructionPlanExportsPage, { isDownloadableConstructionPlanExport } from './ConstructionPlanExportsPage';

jest.mock('../services/constructionPlanService', () => ({ listConstructionPlans: jest.fn() }));
jest.mock('../services/constructionPlanWorkflowApi', () => ({ getConstructionPlanWorkflowErrorMessage: jest.fn(() => '다운로드 실패') }));
jest.mock('../services/constructionPlanIssuedDownloadService', () => ({ fetchAuditedIssuedConstructionPlanPdfForPlan: jest.fn() }));
jest.mock('../services/constructionPlanPdfService', () => ({ downloadConstructionPlanPdf: jest.fn() }));

const listPlans = listConstructionPlans as jest.MockedFunction<typeof listConstructionPlans>;
const readPdf = fetchAuditedIssuedConstructionPlanPdfForPlan as jest.MockedFunction<typeof fetchAuditedIssuedConstructionPlanPdfForPlan>;
const serverIssuedPath = (suffix: string): string => (
  `construction-plans/site-1/plan-1/server-exports/issued/rev-01/field-use-a4-v2/${'b'.repeat(64)}/${suffix.repeat(64)}.pdf`
);
const plan = (status: ConstructionPlan['status'], path?: string): ConstructionPlan => ({
  id: `plan-${status}`, status, title: `${status} 계획서`, documentNo: 'CP-001', revision: 1,
  issuedExportStoragePath: path, issuedExportFileName: `${status}.pdf`, issuedExportSha256: 'a'.repeat(64),
  projectSnapshot: { siteName: '테스트 현장' }, updatedAt: '2026-08-21T00:00:00.000Z',
} as ConstructionPlan);

describe('ConstructionPlanExportsPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows only immutable issued-family exports and downloads the explicit path', async () => {
    const issuedPath = serverIssuedPath('a');
    listPlans.mockResolvedValue([
      plan('issued', issuedPath),
      plan('superseded', serverIssuedPath('c')),
      plan('draft'),
    ]);
    readPdf.mockResolvedValue({
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      fileName: 'issued.pdf',
      receiptId: 'receipt-1',
      artifact: {} as never,
    });
    render(<MemoryRouter><ConstructionPlanExportsPage /></MemoryRouter>);
    expect(await screen.findByText('issued 계획서')).toBeInTheDocument();
    expect(screen.queryByText('draft 계획서')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'PDF 다운로드' })[0]);
    expect(await screen.findByText('issued 계획서')).toBeInTheDocument();
    await waitFor(() => expect(readPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan-issued' })));
    expect(downloadConstructionPlanPdf).toHaveBeenCalled();
  });

  it('requires both an issued-family status and explicit storage path', () => {
    expect(isDownloadableConstructionPlanExport(plan('archived', serverIssuedPath('d')))).toBe(true);
    expect(isDownloadableConstructionPlanExport(plan('issued'))).toBe(false);
    expect(isDownloadableConstructionPlanExport(plan('draft', 'exports/forged.pdf'))).toBe(false);
    expect(isDownloadableConstructionPlanExport({
      ...plan('issued', serverIssuedPath('e')),
      issuedExportSha256: undefined,
    })).toBe(false);
  });
});
