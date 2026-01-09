export interface BuilderElement {
    id: string;
    type: 'text' | 'table';
    x: number;      // mm
    y: number;      // mm
    width: number;  // mm
    height: number; // mm
    isSelected: boolean;
    style: {
        fontSize: number;    // pt
        fontWeight: string;  // 'normal' | 'bold'
        textAlign: 'left' | 'center' | 'right';
        backgroundColor?: string;
        color: string;
        border?: string; // e.g., '1px solid black'
    };
    content: {
        text?: string;        // HTML/Text content
        dataKey?: string;     // Binding key e.g. 'trustee.name'
        tableType?: 'dynamic' | 'static';
        autoFitHeight?: boolean;
        staticData?: string[][];
        columnWidths?: number[]; // percentages e.g., [30, 30, 40]
        dataOverrides?: Record<string, Record<string, string | number>>; // { workerId: { field: value } }
        headerOverrides?: Record<string, string>; // { colIndex: value }
    };
    locked?: boolean;
}

export interface HistoryState {
    past: BuilderElement[][];
    future: BuilderElement[][];
}
