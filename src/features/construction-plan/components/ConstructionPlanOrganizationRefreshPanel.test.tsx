import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ConstructionPlanOrganizationRefreshPanel from './ConstructionPlanOrganizationRefreshPanel';
import type { ConstructionPlanOrganizationRefreshComparison } from '../services/constructionPlanErpRefreshService';

const capturedAt = '2026-08-22T00:00:00.000Z';
const currentWorker = { id: 'worker-old', name: '기존 안전담당', status: 'active' as const, teamId: 'team-1' };
const replacement = { id: 'worker-new', name: '신규 안전담당', status: 'active' as const, teamId: 'team-1' };

const comparison = (): ConstructionPlanOrganizationRefreshComparison => ({
  current: {
    capturedAt,
    sourceSiteId: 'site-1',
    assignments: [{
      id: 'assignment-safety', role: 'safety_manager', label: '안전담당자', required: true,
      worker: currentWorker, responsibilities: ['안전 관리'], order: 0, externalAssignment: false,
    }],
    additionalWorkers: [currentWorker],
  },
  latestWorkers: [{ ...currentWorker, status: 'inactive' }, replacement],
  changes: [
    { id: 'worker.worker-old.inactive', kind: 'inactive', workerId: 'worker-old', before: currentWorker, after: { ...currentWorker, status: 'inactive' }, assignmentIds: ['assignment-safety'] },
    { id: 'worker.worker-new.new', kind: 'new', workerId: 'worker-new', after: replacement, assignmentIds: [] },
  ],
  assignmentIssues: [{
    assignmentId: 'assignment-safety', role: 'safety_manager', required: true,
    kind: 'inactive', worker: { ...currentWorker, status: 'inactive' },
  }],
  suggestedAdditionalWorkers: [replacement],
  additionalWorkersChanged: true,
  changed: true,
});

describe('ConstructionPlanOrganizationRefreshPanel', () => {
  it('starts with no automatic overwrite selection and requires an explicit replacement', () => {
    const onApply = jest.fn();
    render(<ConstructionPlanOrganizationRefreshPanel comparison={comparison()} onApply={onApply} />);

    expect(screen.getByText('비활성 작업자')).toBeInTheDocument();
    expect(screen.getByText('신규 작업자')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택 0건 반영' })).toBeDisabled();
    expect(screen.getByLabelText('safety_manager 대체 작업자')).toHaveValue('');
    expect(screen.getByText(/자동으로 지우지 않습니다/)).toBeInTheDocument();
  });

  it('submits only the user-selected safe roster and explicit reassignment', () => {
    const onApply = jest.fn();
    render(<ConstructionPlanOrganizationRefreshPanel comparison={comparison()} onApply={onApply} />);

    fireEvent.change(screen.getByLabelText('safety_manager 대체 작업자'), { target: { value: 'worker-new' } });
    fireEvent.click(screen.getByText('추가 작업자 명부 갱신'));
    fireEvent.change(screen.getByPlaceholderText(/조직·작업자 변경을 반영/), {
      target: { value: '비활성 안전담당자 재배정 및 명부 갱신' },
    });
    fireEvent.click(screen.getByRole('button', { name: '선택 2건 반영' }));

    expect(onApply).toHaveBeenCalledWith({
      refreshAssignedWorkers: false,
      refreshAdditionalWorkers: true,
      reassignments: [{ assignmentId: 'assignment-safety', workerId: 'worker-new' }],
    }, '비활성 안전담당자 재배정 및 명부 갱신');
  });
});
