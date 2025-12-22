
export interface CellCoordinate {
    row: number;
    col: number;
}

export const getColumnLabel = (index: number): string => {
    let label = '';
    let i = index;
    while (i >= 0) {
        label = String.fromCharCode((i % 26) + 65) + label;
        i = Math.floor(i / 26) - 1;
    }
    return label;
};

export const getCoordinateFromLabel = (label: string): CellCoordinate | null => {
    const match = label.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return null;

    const colStr = match[1];
    const rowStr = match[2];

    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 64);
    }

    return {
        col: col - 1,
        row: parseInt(rowStr, 10) - 1
    };
};

export const evaluateFormula = (formula: string, getData: (row: number, col: number) => any): string | number => {
    if (!formula.startsWith('=')) return formula;

    const expression = formula.substring(1).toUpperCase();

    // Simple cell reference replacement (e.g., A1, B2)
    // This is a basic implementation. For complex formulas, a parser is needed.
    const parsedExpression = expression.replace(/([A-Z]+)([0-9]+)/g, (match) => {
        const coord = getCoordinateFromLabel(match);
        if (coord) {
            const val = getData(coord.row, coord.col);
            return isNaN(Number(val)) ? `"${val}"` : val;
        }
        return match;
    });

    try {
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${parsedExpression}`)();
        return result;
    } catch (error) {
        console.error("Formula evaluation error:", error);
        return "#ERROR";
    }
};

export const parseTSV = (tsv: string): string[][] => {
    return tsv.split(/\r\n|\r|\n/).map(row => row.split('\t'));
};

export const generateTSV = (data: string[][]): string => {
    return data.map(row => row.join('\t')).join('\n');
};
