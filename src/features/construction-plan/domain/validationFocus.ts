export type ConstructionPlanValidationFocusRequest = {
  path?: string;
  relatedId?: string;
  labelHint?: string;
  root?: ParentNode;
};

export type ConstructionPlanValidationFocusTarget = {
  record?: HTMLElement;
  fieldRoot?: HTMLElement;
  target?: HTMLElement;
  control?: HTMLElement;
};

/** Resolve the most specific record before the field so nested repeater rows win
 * over their top-level collection panel. */
export const resolveConstructionPlanValidationFocusTarget = ({
  path,
  relatedId,
  labelHint,
  root: requestedRoot,
}: ConstructionPlanValidationFocusRequest): ConstructionPlanValidationFocusTarget => {
  const root = requestedRoot ?? document;
  const pathParts = path?.split(/\.|\[|\]/).filter(Boolean) ?? [];
  const recordElements = Array.from(root.querySelectorAll<HTMLElement>('[data-validation-record-id]'));
  const recordIdCandidates = Array.from(new Set([
    ...(relatedId ? [relatedId] : []),
    ...pathParts.filter((part) => /^\d+$/.test(part)).reverse(),
    ...pathParts.slice(0, -1).reverse(),
    ...pathParts,
  ]));
  let record = recordIdCandidates.reduce<HTMLElement | undefined>((matched, recordId) => (
    matched ?? recordElements.find((element) => element.dataset.validationRecordId === recordId)
  ), undefined);
  if (record) {
    for (let index = pathParts.length - 1; index > 0; index -= 1) {
      if (!/^\d+$/.test(pathParts[index])) continue;
      const collectionKey = pathParts[index - 1];
      const collection = Array.from(record.querySelectorAll<HTMLElement>('[data-validation-collection]')).find(
        (element) => element.dataset.validationCollection === collectionKey,
      );
      if (!collection) continue;
      const row = Array.from(collection.querySelectorAll<HTMLElement>('[data-validation-row-index]')).find(
        (element) => element.dataset.validationRowIndex === pathParts[index],
      );
      if (row) record = row;
      break;
    }
  }
  const rowIndex = pathParts.map((part) => Number(part)).find(
    (value) => Number.isInteger(value) && value >= 0,
  );
  if (!record && rowIndex !== undefined) {
    record = root.querySelectorAll<HTMLElement>('.cp-editor-right .cp-repeater-list > fieldset').item(rowIndex)
      || undefined;
  }
  const finalPathPart = pathParts.at(-1);
  let fieldRoot = finalPathPart
    ? Array.from((record ?? root).querySelectorAll<HTMLElement>('[data-validation-field]')).find(
      (element) => element.dataset.validationField === finalPathPart,
    )
    : undefined;
  if (!fieldRoot && labelHint) {
    fieldRoot = Array.from((record ?? root).querySelectorAll<HTMLElement>('label')).find(
      (element) => element.textContent?.trim().startsWith(labelHint),
    );
  }
  const target = fieldRoot ?? record;
  const control: HTMLElement | undefined = target?.matches('input, textarea, select, button, [tabindex]')
    ? target
    : (target?.querySelector<HTMLElement>('input, textarea, select')
      ?? target?.querySelector<HTMLElement>('button, [tabindex]')
      ?? undefined);
  return { record, fieldRoot, target, control };
};
