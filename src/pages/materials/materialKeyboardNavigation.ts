import type { KeyboardEvent } from 'react';

const MATERIAL_NAV_INPUT_SELECTOR = 'input[data-material-nav="true"]';
const MATERIAL_NAV_SECTION_SELECTOR = '[data-material-nav-section="true"]';

const toNumber = (value: string | undefined): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const uniqueSorted = (values: number[]) => Array.from(new Set(values)).sort((a, b) => a - b);

const pickClosest = (values: number[], preferred: number): number | null => {
    if (values.length === 0) return null;
    if (values.includes(preferred)) return preferred;

    const min = values[0];
    const max = values[values.length - 1];
    if (preferred <= min) return min;
    if (preferred >= max) return max;

    return values.reduce((closest, value) => (
        Math.abs(value - preferred) < Math.abs(closest - preferred) ? value : closest
    ), values[0]);
};

const getSectionIndices = () => uniqueSorted(
    Array.from(document.querySelectorAll<HTMLElement>(MATERIAL_NAV_SECTION_SELECTOR))
        .map((section) => toNumber(section.dataset.sectionIndex))
);

const getColumnIndices = (sectionIndex: number) => uniqueSorted(
    Array.from(document.querySelectorAll<HTMLInputElement>(
        `${MATERIAL_NAV_INPUT_SELECTOR}[data-section-index="${sectionIndex}"]`
    )).map((input) => toNumber(input.dataset.columnIndex))
);

const getRowIndices = (sectionIndex: number, columnIndex: number) => uniqueSorted(
    Array.from(document.querySelectorAll<HTMLInputElement>(
        `${MATERIAL_NAV_INPUT_SELECTOR}[data-section-index="${sectionIndex}"][data-column-index="${columnIndex}"]`
    )).map((input) => toNumber(input.dataset.rowIndex))
);

const getInput = (sectionIndex: number, columnIndex: number, rowIndex: number) => (
    document.querySelector<HTMLInputElement>(
        `${MATERIAL_NAV_INPUT_SELECTOR}[data-section-index="${sectionIndex}"][data-column-index="${columnIndex}"][data-row-index="${rowIndex}"]`
    )
);

const findInExactColumn = (
    sectionIndex: number,
    columnIndex: number,
    preferredRowIndex: number,
    clampRow = true
) => {
    const rowIndices = getRowIndices(sectionIndex, columnIndex);
    const rowIndex = clampRow
        ? pickClosest(rowIndices, preferredRowIndex)
        : (rowIndices.includes(preferredRowIndex) ? preferredRowIndex : null);
    return rowIndex == null ? null : getInput(sectionIndex, columnIndex, rowIndex);
};

const findInSection = (sectionIndex: number, preferredColumnIndex: number, preferredRowIndex: number) => {
    const columnIndex = pickClosest(getColumnIndices(sectionIndex), preferredColumnIndex);
    return columnIndex == null ? null : findInExactColumn(sectionIndex, columnIndex, preferredRowIndex);
};

const getAdjacentSectionIndex = (sectionIndex: number, offset: -1 | 1) => {
    const sectionIndices = getSectionIndices();
    const currentPosition = sectionIndices.indexOf(sectionIndex);
    if (currentPosition === -1) return null;
    return sectionIndices[currentPosition + offset] ?? null;
};

const focusInput = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    input.select();
    input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};

export const handleMaterialQuantityInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;

    event.preventDefault();

    const current = event.currentTarget;
    const sectionIndex = toNumber(current.dataset.sectionIndex);
    const columnIndex = toNumber(current.dataset.columnIndex);
    const rowIndex = toNumber(current.dataset.rowIndex);

    let target: HTMLInputElement | null = null;

    if (event.key === 'ArrowUp') {
        target = findInExactColumn(sectionIndex, columnIndex, rowIndex - 1, false);
        if (!target) {
            const previousSectionIndex = getAdjacentSectionIndex(sectionIndex, -1);
            target = previousSectionIndex == null ? null : findInSection(previousSectionIndex, columnIndex, Number.MAX_SAFE_INTEGER);
        }
    }

    if (event.key === 'ArrowDown') {
        target = findInExactColumn(sectionIndex, columnIndex, rowIndex + 1, false);
        if (!target) {
            const nextSectionIndex = getAdjacentSectionIndex(sectionIndex, 1);
            target = nextSectionIndex == null ? null : findInSection(nextSectionIndex, columnIndex, 0);
        }
    }

    if (event.key === 'ArrowLeft') {
        target = findInExactColumn(sectionIndex, columnIndex - 1, rowIndex);
        if (!target) {
            const previousSectionIndex = getAdjacentSectionIndex(sectionIndex, -1);
            target = previousSectionIndex == null ? null : findInSection(previousSectionIndex, Number.MAX_SAFE_INTEGER, rowIndex);
        }
    }

    if (event.key === 'ArrowRight') {
        target = findInExactColumn(sectionIndex, columnIndex + 1, rowIndex);
        if (!target) {
            const nextSectionIndex = getAdjacentSectionIndex(sectionIndex, 1);
            target = nextSectionIndex == null ? null : findInSection(nextSectionIndex, 0, rowIndex);
        }
    }

    focusInput(target);
};
