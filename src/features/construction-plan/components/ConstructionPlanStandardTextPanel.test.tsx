import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PlanSection } from '../types';
import { getStandardTextSectionCatalogEntry } from '../domain/standardTextCatalog';
import ConstructionPlanStandardTextPanel from './ConstructionPlanStandardTextPanel';

const section = (input: Partial<PlanSection> = {}): PlanSection => ({
  id: 'general',
  key: 'general',
  title: '일반사항',
  kind: 'static-content',
  order: 4,
  pageNumbers: [5],
  required: true,
  status: 'in_progress',
  content: {},
  placeholders: [],
  containsExampleValues: false,
  standardTextModified: false,
  ...input,
});

const shoringGeneral = getStandardTextSectionCatalogEntry({
  tradeType: 'system-shoring',
  sectionKey: 'general',
})!;

describe('ConstructionPlanStandardTextPanel', () => {
  it('stores a versioned current copy, modifier identity and mandatory reason flow', () => {
    const onChange = jest.fn();
    render(
      <ConstructionPlanStandardTextPanel
        section={section()}
        entry={shoringGeneral}
        updatedBy="현장 작성자"
        onChange={onChange}
      />,
    );

    const editor = screen.getByRole('textbox', { name: '현재 적용할 표준문구' });
    fireEvent.change(editor, { target: { value: `${shoringGeneral.originalText}\n\n현장 추가 기준` } });

    const changed = onChange.mock.calls[0][0] as PlanSection;
    expect(changed).toEqual(expect.objectContaining({
      standardTextModified: true,
      updatedBy: '현장 작성자',
      updatedAt: expect.any(String),
    }));
    expect(changed.content).toEqual(expect.objectContaining({
      standardTextVersion: shoringGeneral.standardTextVersion,
      standardTextCurrent: `${shoringGeneral.originalText}\n\n현장 추가 기준`,
    }));

    render(
      <ConstructionPlanStandardTextPanel
        section={changed}
        entry={shoringGeneral}
        updatedBy="현장 작성자"
        onChange={onChange}
      />,
    );
    expect(screen.getAllByRole('textbox', { name: '표준문구 변경사유' })[0]).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText('수정본을 검토·발행하려면 변경사유가 필수입니다.')[0]).toBeInTheDocument();
  });

  it('restores the catalog original without deleting legacy free-text fields', () => {
    const onChange = jest.fn();
    const modified = section({
      content: {
        body: '기존 body 원본',
        scope: '101동 A구간',
        standardTextVersion: shoringGeneral.standardTextVersion,
        standardTextCurrent: `${shoringGeneral.originalText}\n변경`,
      },
      standardTextModified: true,
      standardTextModificationReason: '현장 조건 반영',
    });

    render(
      <ConstructionPlanStandardTextPanel
        section={modified}
        entry={shoringGeneral}
        updatedBy="현장 작성자"
        onChange={onChange}
      />,
    );

    expect(screen.getByText('기존 자유서술 기록 2건 · 원본 보존')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '원문 복원' }));

    const restored = onChange.mock.calls[0][0] as PlanSection;
    expect(restored.standardTextModified).toBe(false);
    expect(restored.standardTextModificationReason).toBeUndefined();
    expect(restored.content).toMatchObject({
      body: '기존 body 원본',
      scope: '101동 A구간',
      standardTextVersion: shoringGeneral.standardTextVersion,
      standardTextCurrent: shoringGeneral.originalText,
    });
    expect(onChange.mock.calls[0][1]).toBe(true);
  });

  it('keeps template-catalog sections locked and shows only the official original', () => {
    const entry = getStandardTextSectionCatalogEntry({
      tradeType: 'system-shoring',
      sectionKey: 'system-overview',
    })!;
    const onChange = jest.fn();

    render(
      <ConstructionPlanStandardTextPanel
        section={section({
          id: 'system-overview',
          key: 'system-overview',
          title: '시스템동바리 개요',
          order: 14,
          pageNumbers: [15],
          status: 'complete',
        })}
        entry={entry}
        updatedBy="작성자"
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('표준 카탈로그 잠금')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '현재 적용할 표준문구' })).not.toBeInTheDocument();
    expect(screen.getByText('템플릿 버전이 바뀌기 전에는 현장 문서에서 수정할 수 없습니다.')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves and explicitly identifies a legacy body override', () => {
    render(
      <ConstructionPlanStandardTextPanel
        section={section({
          content: { body: '기존 표준문구 변경본' },
          standardTextModified: true,
          standardTextModificationReason: '기존 변경사유',
        })}
        entry={shoringGeneral}
        updatedBy="작성자"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText('기존 body 변경본을 현재문으로 불러왔습니다.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '현재 적용할 표준문구' })).toHaveValue('기존 표준문구 변경본');
    expect(screen.getByText('기존 자유서술 기록 1건 · 원본 보존')).toBeInTheDocument();
  });

  it('marks the section and standard-text controls for exact validation focus', () => {
    const { container } = render(
      <ConstructionPlanStandardTextPanel
        section={section({
          status: 'not_applicable',
          notApplicableReason: '',
          content: {
            standardTextVersion: shoringGeneral.standardTextVersion,
            standardTextCurrent: `${shoringGeneral.originalText}\n현장 변경`,
          },
          standardTextModified: true,
          standardTextModificationReason: '',
        })}
        entry={shoringGeneral}
        updatedBy="작성자"
        onChange={jest.fn()}
      />,
    );

    const record = container.querySelector('[data-validation-record-id="general"]');
    expect(record).toBeInTheDocument();
    [
      'standardTextVersion', 'status', 'notApplicableReason', 'content',
      'standardTextModified', 'standardTextCurrent', 'standardTextModificationReason',
    ].forEach((field) => {
      expect(record?.querySelector(`[data-validation-field="${field}"]`)).toBeInTheDocument();
    });
  });
});
