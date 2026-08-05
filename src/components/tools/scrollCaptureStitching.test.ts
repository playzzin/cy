import {
    createScrollStitchSlice,
    getScrollStitchBoundaryContentY,
    ScrollStitchSegmentGeometry,
    ScrollStitchSlice
} from './scrollCaptureStitching';

type SyntheticFrame = ScrollStitchSegmentGeometry & {
    rows: number[];
};

const createSlices = (
    frames: SyntheticFrame[],
    rangeTop: number,
    rangeBottom: number,
    outputHeight: number
): ScrollStitchSlice[] => {
    let committedUntil = rangeTop;
    const slices: ScrollStitchSlice[] = [];

    frames.forEach((frame, index) => {
        const next = frames[index + 1];
        const end = next
            ? getScrollStitchBoundaryContentY(frame, next)
            : rangeBottom;
        const slice = createScrollStitchSlice(
            frame,
            committedUntil,
            end,
            rangeTop,
            rangeBottom,
            outputHeight
        );
        if (slice) slices.push(slice);
        committedUntil = end;
    });

    return slices;
};

describe('scroll capture stitching geometry', () => {
    it('removes bottom frame edges and keeps every content row exactly once', () => {
        const frames: SyntheticFrame[] = [
            {
                topContentY: 0,
                bottomContentY: 100,
                sourceHeight: 100,
                rows: [...Array.from({ length: 98 }, (_, y) => y), -1, -1]
            },
            {
                topContentY: 80,
                bottomContentY: 180,
                sourceHeight: 100,
                rows: [
                    ...Array.from({ length: 98 }, (_, y) => y + 80),
                    -1,
                    -1
                ]
            },
            {
                topContentY: 160,
                bottomContentY: 260,
                sourceHeight: 100,
                rows: Array.from({ length: 100 }, (_, y) => y + 160)
            }
        ];

        const slices = createSlices(frames, 0, 260, 260);
        const output = new Array<number>(260);

        slices.forEach((slice, index) => {
            const sourceRows = frames[index].rows.slice(
                slice.sourceY,
                slice.sourceY + slice.sourceHeight
            );
            expect(sourceRows).toHaveLength(slice.destHeight);
            sourceRows.forEach((row, offset) => {
                output[slice.destY + offset] = row;
            });
        });

        expect(slices.map(({ destY, destHeight }) => [destY, destHeight])).toEqual([
            [0, 90],
            [90, 80],
            [170, 90]
        ]);
        expect(output).toEqual(Array.from({ length: 260 }, (_, y) => y));
        expect(output).not.toContain(-1);
    });

    it.each([0.63, 0.5, 1.25])(
        'uses absolute destination coordinates without cumulative gaps at scale %s',
        (scale) => {
            const frames: SyntheticFrame[] = [
                {
                    topContentY: 0,
                    bottomContentY: 100,
                    sourceHeight: 125,
                    rows: []
                },
                {
                    topContentY: 80,
                    bottomContentY: 180,
                    sourceHeight: 125,
                    rows: []
                },
                {
                    topContentY: 160,
                    bottomContentY: 260,
                    sourceHeight: 125,
                    rows: []
                }
            ];
            const outputHeight = Math.round(260 * scale);
            const slices = createSlices(frames, 0, 260, outputHeight);

            expect(slices[0].destY).toBe(0);
            slices.slice(1).forEach((slice, index) => {
                const previous = slices[index];
                expect(slice.destY).toBe(previous.destY + previous.destHeight);
            });
            const last = slices[slices.length - 1];
            expect(last.destY + last.destHeight).toBe(outputHeight);
        }
    );

    it('chooses the overlap midpoint without depending on repeating table pixels', () => {
        const previous = {
            topContentY: 0,
            bottomContentY: 240,
            sourceHeight: 300
        };
        const next = {
            topContentY: 216,
            bottomContentY: 456,
            sourceHeight: 300
        };

        expect(getScrollStitchBoundaryContentY(previous, next)).toBe(228);

        const previousSlice = createScrollStitchSlice(
            previous,
            0,
            228,
            0,
            456,
            570
        );
        const nextSlice = createScrollStitchSlice(
            next,
            228,
            456,
            0,
            456,
            570
        );

        expect(previousSlice).not.toBeNull();
        expect(nextSlice).not.toBeNull();
        expect(nextSlice?.destY).toBe(
            (previousSlice?.destY ?? 0) + (previousSlice?.destHeight ?? 0)
        );
        expect((nextSlice?.destY ?? 0) + (nextSlice?.destHeight ?? 0)).toBe(570);
    });
});
