export type ScrollStitchSegmentGeometry = {
    topContentY: number;
    bottomContentY: number;
    sourceHeight: number;
};

export type ScrollStitchSlice = {
    sourceY: number;
    sourceHeight: number;
    destY: number;
    destHeight: number;
    startContentY: number;
    endContentY: number;
};

const clamp = (value: number, min: number, max: number) => (
    Math.min(max, Math.max(min, value))
);

/**
 * Places the seam in the middle of the shared content instead of keeping the
 * bottom edge of the previous tab-capture frame. Browser tab streams can add a
 * one or two pixel edge at the bottom of a frame; a midpoint seam keeps both
 * the previous bottom edge and the next top edge out of the final image.
 */
export const getScrollStitchBoundaryContentY = (
    previous: ScrollStitchSegmentGeometry,
    next: ScrollStitchSegmentGeometry
): number => {
    const overlapStart = Math.max(previous.topContentY, next.topContentY);
    const overlapEnd = Math.min(previous.bottomContentY, next.bottomContentY);

    if (overlapEnd <= overlapStart) {
        return previous.bottomContentY;
    }

    return overlapStart + ((overlapEnd - overlapStart) / 2);
};

/**
 * Converts content coordinates to one source crop and one absolute output
 * rectangle. Destination coordinates are derived from the full selected range,
 * so fractional scale rounding cannot accumulate a gap between segments.
 */
export const createScrollStitchSlice = (
    segment: ScrollStitchSegmentGeometry,
    requestedStartContentY: number,
    requestedEndContentY: number,
    rangeTopContentY: number,
    rangeBottomContentY: number,
    outputHeight: number
): ScrollStitchSlice | null => {
    const segmentHeight = segment.bottomContentY - segment.topContentY;
    const rangeHeight = rangeBottomContentY - rangeTopContentY;

    if (
        segmentHeight <= 0
        || rangeHeight <= 0
        || segment.sourceHeight < 1
        || outputHeight < 1
    ) {
        return null;
    }

    const startContentY = clamp(
        requestedStartContentY,
        Math.max(rangeTopContentY, segment.topContentY),
        Math.min(rangeBottomContentY, segment.bottomContentY)
    );
    const endContentY = clamp(
        requestedEndContentY,
        startContentY,
        Math.min(rangeBottomContentY, segment.bottomContentY)
    );

    if (endContentY <= startContentY) {
        return null;
    }

    const sourceStartRatio = (startContentY - segment.topContentY) / segmentHeight;
    const sourceEndRatio = (endContentY - segment.topContentY) / segmentHeight;
    const sourceY = clamp(
        Math.floor(sourceStartRatio * segment.sourceHeight),
        0,
        Math.max(0, segment.sourceHeight - 1)
    );
    const sourceEndY = clamp(
        Math.ceil(sourceEndRatio * segment.sourceHeight),
        sourceY + 1,
        segment.sourceHeight
    );

    const destY = clamp(
        Math.round(
            ((startContentY - rangeTopContentY) / rangeHeight) * outputHeight
        ),
        0,
        outputHeight
    );
    const destEndY = clamp(
        Math.round(
            ((endContentY - rangeTopContentY) / rangeHeight) * outputHeight
        ),
        destY,
        outputHeight
    );

    if (destEndY <= destY) {
        return null;
    }

    return {
        sourceY,
        sourceHeight: sourceEndY - sourceY,
        destY,
        destHeight: destEndY - destY,
        startContentY,
        endContentY
    };
};
