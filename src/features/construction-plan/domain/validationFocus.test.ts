import '@testing-library/jest-dom';
import { resolveConstructionPlanValidationFocusTarget } from './validationFocus';

describe('resolveConstructionPlanValidationFocusTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers a related repeater record over its collection panel', () => {
    document.body.innerHTML = `
      <section data-validation-record-id="equipmentPlan">
        <button data-validation-field="equipmentPlan">장비 추가</button>
        <fieldset data-validation-record-id="equipment-1">
          <input data-validation-field="inspectionValidUntil" />
        </fieldset>
      </section>
    `;

    const resolved = resolveConstructionPlanValidationFocusTarget({
      path: 'equipmentPlan.0.inspectionValidUntil',
      relatedId: 'equipment-1',
    });

    expect(resolved.record?.dataset.validationRecordId).toBe('equipment-1');
    expect(resolved.control?.dataset.validationField).toBe('inspectionValidUntil');
  });

  it('uses a numeric path segment to select the exact row for grouped row errors', () => {
    document.body.innerHTML = `
      <section data-validation-record-id="engineeringValues">
        <fieldset data-validation-record-id="0"><input data-validation-field="key" /></fieldset>
        <fieldset data-validation-record-id="1"><input data-validation-field="key" /></fieldset>
      </section>
    `;

    const resolved = resolveConstructionPlanValidationFocusTarget({ path: 'engineeringValues.1' });

    expect(resolved.record?.dataset.validationRecordId).toBe('1');
    expect(resolved.control?.dataset.validationField).toBe('key');
  });

  it('resolves a section field marker and focuses its nested textarea', () => {
    document.body.innerHTML = `
      <section data-validation-record-id="general">
        <label data-validation-field="standardTextModified">
          <textarea data-validation-field="standardTextCurrent"></textarea>
        </label>
        <textarea data-validation-field="standardTextModificationReason"></textarea>
      </section>
    `;

    const resolved = resolveConstructionPlanValidationFocusTarget({
      path: 'sections.4.standardTextModificationReason',
      relatedId: 'general',
    });

    expect(resolved.record?.dataset.validationRecordId).toBe('general');
    expect(resolved.control?.dataset.validationField).toBe('standardTextModificationReason');
  });

  it('narrows an outer section record to the exact structured repeater row', () => {
    document.body.innerHTML = `
      <section data-validation-record-id="quality-control">
        <div data-validation-collection="holdPoints" data-validation-field="holdPoints">
          <fieldset data-validation-record-id="hold-point-0" data-validation-row-index="0">
            <textarea data-validation-field="completionCondition">첫 번째 조건</textarea>
          </fieldset>
          <fieldset data-validation-record-id="hold-point-1" data-validation-row-index="1">
            <textarea data-validation-field="completionCondition">두 번째 조건</textarea>
          </fieldset>
        </div>
      </section>
    `;

    const resolved = resolveConstructionPlanValidationFocusTarget({
      path: 'sections.14.content.holdPoints.1.completionCondition',
      relatedId: 'quality-control',
    });

    expect(resolved.record?.dataset.validationRecordId).toBe('hold-point-1');
    expect(resolved.control).toHaveValue('두 번째 조건');
  });
});
