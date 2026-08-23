import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ConstructionPlanDwgConversionGuide,
  ConstructionPlanOnboardingChecklist,
  ConstructionPlanPolygonPractice,
  hasCompletedConstructionPlanPolygonPractice,
} from './ConstructionPlanOnboarding';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe('ConstructionPlanOnboarding', () => {
  it('derives the first-entry checklist from actual plan completion and navigates to missing work', () => {
    const onNavigate = jest.fn();
    const storage = memoryStorage();
    render(
      <ConstructionPlanOnboardingChecklist
        planId="plan-a"
        siteConnected
        organizationConfirmed={false}
        drawingMarked={false}
        onNavigate={onNavigate}
        storage={storage}
      />,
    );

    expect(screen.getByText('완료 1/3')).not.toBeNull();
    expect(screen.getByText('현장 연결').closest('li')?.classList.contains('is-complete')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '조직도 확인' }));
    expect(onNavigate).toHaveBeenCalledWith('organization');

    fireEvent.click(screen.getByRole('button', { name: '이 안내 숨기기' }));
    expect(storage.getItem('construction-plan:onboarding:plan-a:v1')).toBe('done');
    fireEvent.click(screen.getByRole('button', { name: '첫 작성 안내 보기 · 1/3' }));
    expect(screen.getByText('첫 작성 체크리스트')).not.toBeNull();
  });

  it('requires three polygon practice points before completion and persists completion', () => {
    const storage = memoryStorage();
    const onComplete = jest.fn();
    render(<ConstructionPlanPolygonPractice storage={storage} onComplete={onComplete} onSkip={jest.fn()} />);

    const complete = screen.getByRole('button', { name: '연습 완료' });
    expect((complete as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '점 1 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '점 2 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '점 3 추가' }));
    expect(screen.getByText(/다각형이 완성됐습니다/)).not.toBeNull();
    expect((complete as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(complete);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(hasCompletedConstructionPlanPolygonPractice(undefined, storage)).toBe(true);
  });

  it('allows the practice to be skipped and provides concrete DWG conversion instructions', () => {
    const storage = memoryStorage();
    const onSkip = jest.fn();
    const { rerender } = render(
      <ConstructionPlanPolygonPractice storage={storage} onComplete={jest.fn()} onSkip={onSkip} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(hasCompletedConstructionPlanPolygonPractice(undefined, storage)).toBe(true);

    rerender(<ConstructionPlanDwgConversionGuide />);
    expect(screen.getByText(/DWG는 승인도면 PDF로 변환/)).not.toBeNull();
    expect(screen.getByText(/암호를 설정하지 말고 50MB 이하/)).not.toBeNull();
  });
});
