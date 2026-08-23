import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ConstructionPlan } from '../types';
import ConstructionPlanRowActions, {
  findActiveRevisionSuccessor,
} from './ConstructionPlanRowActions';

const plan = (status: ConstructionPlan['status'], path?: string): ConstructionPlan => ({
  id: `plan-${status}`,
  title: `${status} 계획서`,
  status,
  issuedExportStoragePath: path,
} as ConstructionPlan);

const handlers = {
  onOpen: jest.fn(),
  onOpenActiveRevision: jest.fn(),
  onCreateRevision: jest.fn(),
  onClone: jest.fn(),
  onDownloadIssued: jest.fn(),
  onOpenHistory: jest.fn(),
};

describe('ConstructionPlanRowActions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers revision and immutable PDF download for an issued row', () => {
    render(<ConstructionPlanRowActions plan={plan('issued', 'exports/issued.pdf')} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /issued 계획서 작업 메뉴/ }));

    expect(screen.getByRole('menuitem', { name: /개정본 만들기/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /발행 PDF 다운로드/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /개정본 만들기/ }));
    expect(handlers.onCreateRevision).toHaveBeenCalledTimes(1);
  });

  it('keeps superseded PDF/history actions but does not offer a new revision', () => {
    render(<ConstructionPlanRowActions plan={plan('superseded', 'exports/rev-01.pdf')} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /superseded 계획서 작업 메뉴/ }));

    expect(screen.queryByRole('menuitem', { name: /개정본 만들기/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /복제/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /발행 PDF 다운로드/ }));
    expect(handlers.onDownloadIssued).toHaveBeenCalledTimes(1);
  });

  it('opens the existing active successor instead of offering another revision', () => {
    render(
      <ConstructionPlanRowActions
        plan={{ ...plan('issued'), seriesId: 'series-1', revision: 0 }}
        activeRevision={{ id: 'plan-r1', seriesId: 'series-1', revision: 1, status: 'draft' }}
        {...handlers}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /issued 계획서 작업 메뉴/ }));

    expect(screen.queryByRole('menuitem', { name: /개정본 만들기/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /진행 중 개정본 열기/ }));
    expect(handlers.onOpenActiveRevision).toHaveBeenCalledTimes(1);
    expect(handlers.onCreateRevision).not.toHaveBeenCalled();
  });

  it('finds the highest active successor and skips void or archived revisions', () => {
    const source = { id: 'r0', seriesId: 'series-1', revision: 0, status: 'issued' as const };
    const plans = [
      source,
      { id: 'r1', seriesId: 'series-1', revision: 1, status: 'void' as const },
      { id: 'r2', seriesId: 'series-1', revision: 2, status: 'draft' as const },
      { id: 'r3', seriesId: 'series-1', revision: 3, status: 'archived' as const },
      { id: 'other', seriesId: 'series-2', revision: 9, status: 'draft' as const },
    ];

    expect(findActiveRevisionSuccessor(plans, source)?.id).toBe('r2');
    expect(findActiveRevisionSuccessor(plans, { ...source, seriesId: undefined })).toBeUndefined();
  });

  it('disables the trigger while a server action is in progress', () => {
    render(<ConstructionPlanRowActions plan={plan('draft')} busyAction="clone" {...handlers} />);
    expect(screen.getByRole('button', { name: /draft 계획서 작업 메뉴/ })).toBeDisabled();
  });
});
