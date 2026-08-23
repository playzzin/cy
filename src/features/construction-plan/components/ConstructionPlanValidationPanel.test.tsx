import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ConstructionPlanValidationPanel from './ConstructionPlanValidationPanel';

describe('ConstructionPlanValidationPanel', () => {
  it('shows the exact field and responsible role and keeps issue navigation actionable', () => {
    const onSelectIssue = jest.fn();
    const issue = {
      id: 'DRAWING_REQUIRED-drawings-0',
      severity: 'error' as const,
      title: '필수 도면을 등록하세요.',
      description: '작성 단계 필수조건입니다.',
      sectionId: 'drawing-d01',
      field: '23쪽 · 도면',
      responsibleRole: '공사담당자',
    };

    render(<ConstructionPlanValidationPanel issues={[issue]} onSelectIssue={onSelectIssue} />);

    expect(screen.getByText('오류 · 23쪽 · 도면 · 담당 공사담당자')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /필수 도면을 등록하세요/ }));
    expect(onSelectIssue).toHaveBeenCalledWith(issue);
  });
});
