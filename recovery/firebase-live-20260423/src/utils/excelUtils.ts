
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

// =====================================================
// 대량 업로드용 유틸리티 함수들
// =====================================================

/**
 * Excel Serial Date를 YYYY-MM-DD 형식으로 변환
 * Excel은 1900-01-01을 1로 시작하는 시리얼 넘버 사용
 */
export const formatExcelDate = (val: any): string => {
    if (!val) return '';

    // 1. 숫자인 경우 (Excel Serial Date)
    if (typeof val === 'number') {
        if (val > 20000) { // 대략 1954년 이후
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }

    // 2. 문자열인 경우
    const str = String(val).trim();

    // 2-1. YYYY-MM-DD 또는 YYYY.MM.DD 또는 YYYY/MM/DD 형식
    if (str.match(/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/)) {
        return str.replace(/[./]/g, '-');
    }

    // 2-2. MM-DD-YYYY 형식 (미국식)
    const usMatch = str.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
    if (usMatch) {
        return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
    }

    // 2-3. YYYYMMDD 형식
    if (str.match(/^\d{8}$/)) {
        return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }

    return str;
};

/**
 * 숫자 문자열 정규화
 * "150,000" → 150000
 * "15만" → 150000
 * "15만원" → 150000
 */
export const normalizeNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;

    let str = String(val).trim();
    str = str.replace(/,/g, '').replace(/원/g, '');

    const units: { [key: string]: number } = {
        '만': 10000,
        '천': 1000,
        '백': 100,
        '십': 10,
        '억': 100000000,
    };

    for (const [unit, multiplier] of Object.entries(units)) {
        const regex = new RegExp(`([\\d.]+)\\s*${unit}`);
        const match = str.match(regex);
        if (match) {
            return Math.round(parseFloat(match[1]) * multiplier);
        }
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.round(num);
};

/**
 * 문자열 정규화 (앞뒤 공백 제거, 중복 공백 단일화)
 */
export const normalizeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val).trim().replace(/\s+/g, ' ');
};

/**
 * 이름 정규화 (공백 완전 제거 - 비교용)
 */
export const normalizeNameForCompare = (name: string): string => {
    return name.replace(/\s+/g, '').toLowerCase();
};

/**
 * 전화번호 정규화
 */
export const normalizePhone = (val: any): string => {
    if (!val) return '';
    const digits = String(val).replace(/\D/g, '');

    if (digits.length === 11 && digits.startsWith('010')) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10 && digits.startsWith('02')) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return String(val).trim();
};

/**
 * 사업자번호 정규화
 */
export const normalizeBusinessNumber = (val: any): string => {
    if (!val) return '';
    const digits = String(val).replace(/\D/g, '');
    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    }
    return String(val).trim();
};

/**
 * 중복 체크 키 생성
 */
export const createDuplicateKey = (...values: (string | undefined)[]): string => {
    return values
        .map(v => normalizeNameForCompare(v || ''))
        .filter(v => v)
        .join('_');
};
