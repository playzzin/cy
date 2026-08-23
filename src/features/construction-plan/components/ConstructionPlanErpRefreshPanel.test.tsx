import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ConstructionPlanErpSnapshot } from '../types';
import ConstructionPlanErpRefreshPanel from './ConstructionPlanErpRefreshPanel';

const base = (): ConstructionPlanErpSnapshot => ({
  schemaVersion: 1,
  capturedAt: '2026-08-22T00:00:00.000Z',
  site: {
    source: 'site', sourceId: 'site-1', capturedAt: '2026-08-22T00:00:00.000Z',
    value: { id: 'site-1', name: '기존 현장', address: '서울' },
  },
});

describe('ConstructionPlanErpRefreshPanel', () => {
  it('shows field-level before/after values and applies only selected fields with a reason', async () => {
    const onApply = jest.fn().mockResolvedValue(undefined);
    const latest: ConstructionPlanErpSnapshot = {
      ...base(),
      site: {
        ...base().site,
        sourceUpdatedAt: '2026-08-22T10:00:00.000Z',
        value: { ...base().site.value, name: '변경 현장', address: '서울 강남구' },
      },
    };
    render(<ConstructionPlanErpRefreshPanel current={base()} latest={latest} onRefresh={jest.fn()} onApply={onApply} />);

    expect(screen.getByText('기존 현장')).toBeTruthy();
    expect(screen.getByText('변경 현장')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: '현장 주소 반영' }));
    fireEvent.change(screen.getByLabelText('반영 사유 *'), { target: { value: '현장 마스터 변경 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '선택 1개 반영' }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(['site.name'], '현장 마스터 변경 확인'));
  });

  it('does not allow updates while read-only and reports an unchanged source', () => {
    const onRefresh = jest.fn();
    render(<ConstructionPlanErpRefreshPanel current={base()} latest={base()} readOnly onRefresh={onRefresh} onApply={jest.fn()} />);
    expect(screen.getByText('현재 계획서와 ERP 원천 데이터가 일치합니다.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '최신 원천 다시 비교' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('supports select-all, per-group apply selection, and explicit existing-value retention', () => {
    const latest: ConstructionPlanErpSnapshot = {
      ...base(),
      site: {
        ...base().site,
        value: { ...base().site.value, name: '변경 현장', address: '서울 강남구' },
      },
    };
    render(<ConstructionPlanErpRefreshPanel current={base()} latest={latest} onRefresh={jest.fn()} onApply={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '모두 기존값 유지' }));
    expect(screen.getByText('선택 0/2개')).toBeTruthy();
    expect(screen.getAllByText('현재 계획서 값 유지')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '이 구분 반영' }));
    expect(screen.getByText('선택 2/2개')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '기존값 유지' }));
    expect(screen.getByText('선택 0/2개')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '전체 반영 선택' }));
    expect(screen.getByText('선택 2/2개')).toBeTruthy();
  });

  it('shows loading, retry, and canonical apply success feedback', () => {
    const onRefresh = jest.fn();
    const { rerender } = render(<ConstructionPlanErpRefreshPanel
      current={base()}
      loading
      onRefresh={onRefresh}
      onApply={jest.fn()}
    />);
    expect(screen.getByText(/ERP 원천 마스터를 안전하게 비교/)).toBeTruthy();

    rerender(<ConstructionPlanErpRefreshPanel
      current={base()}
      error="원천 조회 실패"
      success="1개 필드를 서버 권위 문서에 반영했습니다."
      onRefresh={onRefresh}
      onApply={jest.fn()}
    />);
    expect(screen.getByRole('alert').textContent).toContain('원천 조회 실패');
    expect(screen.getByText(/1개 필드를 서버 권위/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 비교' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
