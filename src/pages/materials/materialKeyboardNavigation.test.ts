import type { KeyboardEvent } from 'react';
import { handleMaterialQuantityInputKeyDown } from './materialKeyboardNavigation';

type ArrowKey = 'ArrowDown' | 'ArrowRight';

const visibleClientRects = [{}] as unknown as DOMRectList;
const hiddenClientRects = [] as unknown as DOMRectList;

const setRendered = (element: HTMLElement, rendered: boolean) => {
    jest.spyOn(element, 'getClientRects').mockReturnValue(
        rendered ? visibleClientRects : hiddenClientRects
    );
};

const pressArrow = (input: HTMLInputElement, key: ArrowKey) => {
    const preventDefault = jest.fn();

    handleMaterialQuantityInputKeyDown({
        key,
        currentTarget: input,
        preventDefault,
    } as unknown as KeyboardEvent<HTMLInputElement>);

    return preventDefault;
};

describe('handleMaterialQuantityInputKeyDown', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div data-material-nav-section="true" data-section-index="0">
                <input id="hidden-origin" data-material-nav="true" data-section-index="0" data-column-index="0" data-row-index="0" />
                <input id="hidden-down" data-material-nav="true" data-section-index="0" data-column-index="0" data-row-index="1" />
                <input id="hidden-right" data-material-nav="true" data-section-index="0" data-column-index="1" data-row-index="0" />
            </div>
            <div data-material-nav-section="true" data-section-index="0">
                <input id="visible-origin" data-material-nav="true" data-section-index="0" data-column-index="0" data-row-index="0" />
                <input id="visible-down" data-material-nav="true" data-section-index="0" data-column-index="0" data-row-index="1" />
                <input id="visible-right" data-material-nav="true" data-section-index="0" data-column-index="1" data-row-index="0" />
            </div>
        `;

        Array.from(document.body.children).forEach((section, sectionIndex) => {
            setRendered(section as HTMLElement, sectionIndex === 1);
            section.querySelectorAll<HTMLElement>('input').forEach((input) => {
                setRendered(input, sectionIndex === 1);
                Object.defineProperty(input, 'scrollIntoView', {
                    configurable: true,
                    value: jest.fn(),
                });
            });
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it.each([
        ['ArrowDown', 'visible-down'],
        ['ArrowRight', 'visible-right'],
    ] as const)('ignores an earlier hidden duplicate when pressing %s', (key, expectedTargetId) => {
        const origin = document.getElementById('visible-origin') as HTMLInputElement;
        const expectedTarget = document.getElementById(expectedTargetId) as HTMLInputElement;
        origin.focus();

        const preventDefault = pressArrow(origin, key);

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(expectedTarget);
    });
});
