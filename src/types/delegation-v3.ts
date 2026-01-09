// 위임장v3 타입 정의

// ============================================
// Base Types
// ============================================

export interface Position {
    x: number; // mm
    y: number; // mm
}

export interface Size {
    width: number; // mm
    height: number; // mm
}

export interface BorderStyle {
    width: number; // pt
    style: 'solid' | 'dashed' | 'dotted' | 'none';
    color: string;
}

export interface ElementStyle {
    fontSize?: number; // pt
    fontWeight?: 'normal' | 'bold' | '600' | '700';
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
    backgroundColor?: string;
    padding?: number; // pt
    border?: BorderStyle;
    lineHeight?: number;
}

// ============================================
// Element Types
// ============================================

export type ElementType = 'field' | 'table' | 'image' | 'text' | 'header';
export type DataSource = 'trustee' | 'delegator' | 'custom';

export interface BaseElement {
    id: string;
    type: ElementType;
    position: Position;
    size: Size;
    style: ElementStyle;
    zIndex: number;
    locked?: boolean;
    visible?: boolean;
    name?: string; // User-friendly name for layers panel
}

// ============================================
// Field Element
// ============================================

export interface FieldElement extends BaseElement {
    type: 'field';
    dataSource: DataSource;
    dataKey: string; // 'name', 'idNumber', 'contact', 'address', etc.
    showLabel: boolean;
    label?: string;
    labelPosition?: 'left' | 'top';
    labelWidth?: number; // % (for horizontal layout)
    labelStyle?: ElementStyle;
    valueStyle?: ElementStyle;
    format?: 'text' | 'number' | 'date' | 'currency';
    placeholder?: string;
}

// ============================================
// Table Element
// ============================================

export interface TableColumn {
    id: string;
    key: string; // 'number', 'name', 'idNumber', 'address', 'claimAmount', 'signature'
    label: string;
    width: number; // % or px
    alignment?: 'left' | 'center' | 'right';
    format?: 'text' | 'number' | 'currency';
    style?: ElementStyle;
    visible?: boolean;
}

export interface TableElement extends BaseElement {
    type: 'table';
    dataSource: 'delegators';
    columns: TableColumn[];
    showHeader: boolean;
    showTotal: boolean;
    headerStyle?: ElementStyle;
    bodyStyle?: ElementStyle;
    totalRowStyle?: ElementStyle;
    rowHeight?: number; // mm
    alternateRowColor?: string;
    borderCollapse?: boolean;
}

// ============================================
// Image Element
// ============================================

export type ImageFit = 'contain' | 'cover' | 'fill' | 'none';

export interface ImageElement extends BaseElement {
    type: 'image';
    src: string;
    alt: string;
    fit: ImageFit;
    dataSource?: 'trustee.signature' | 'delegator.signature';
}

// ============================================
// Text Element
// ============================================

export interface TextElement extends BaseElement {
    type: 'text';
    content: string;
    editable?: boolean;
}

// ============================================
// Header Element
// ============================================

export interface HeaderElement extends BaseElement {
    type: 'header';
    content: string;
    showDate?: boolean;
    dateFormat?: string;
}

// ============================================
// Union Type
// ============================================

export type AnyElement =
    | FieldElement
    | TableElement
    | ImageElement
    | TextElement
    | HeaderElement;

// ============================================
// Layout Template
// ============================================

export interface LayoutTemplate {
    id: string;
    name: string;
    description?: string;
    elements: AnyElement[];
    pageSize: Size; // A4: 210mm x 297mm
    metadata: {
        version: string;
        createdAt: Date;
        updatedAt: Date;
        author?: string;
    };
}

// ============================================
// Editor State
// ============================================

export interface EditorState {
    elements: AnyElement[];
    selectedIds: string[];
    clipboard: AnyElement[];
    zoom: number;
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number; // mm
    canvasSize: Size;
}

// ============================================
// Trustee & Delegator Data
// ============================================

export interface TrusteeData {
    name: string;
    idNumber: string;
    address: string;
    contact: string;
    signature?: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
}

export interface DelegatorData {
    id: string;
    name: string;
    idNumber: string;
    address: string;
    unitPrice: number;
    workDays: number;
    claimAmount: number;
    signature?: string;
}

// ============================================
// History (Undo/Redo)
// ============================================

export interface HistoryState {
    past: EditorState[];
    present: EditorState;
    future: EditorState[];
}

// ============================================
// Utility Types
// ============================================

export type Alignment = 'left' | 'center' | 'right' | 'justify';
export type VerticalAlignment = 'top' | 'middle' | 'bottom';
export type ResizeDirection =
    | 'n' | 's' | 'e' | 'w'
    | 'ne' | 'nw' | 'se' | 'sw';
