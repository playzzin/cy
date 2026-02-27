// mm to px conversion utilities (96 DPI standard)
export const MM_TO_PX = 3.7795275591;

export const mmToPx = (mm: number): number => {
    return mm * MM_TO_PX;
};

export const pxToMm = (px: number): number => {
    return px / MM_TO_PX;
};

// Grid snap utility
export const snapToGrid = (value: number, gridSize: number = 5): number => {
    return Math.round(value / gridSize) * gridSize;
};
