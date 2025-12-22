declare module 'react-to-print' {
    import * as React from 'react';

    export interface UseReactToPrintOptions {
        content: () => React.ReactInstance | null;
        documentTitle?: string;
        onBeforeGetContent?: () => void | Promise<void>;
        onAfterPrint?: () => void;
        onPrintError?: (errorLocation: string, error: Error) => void;
        removeAfterPrint?: boolean;
        pageStyle?: string | (() => string);
        copyStyles?: boolean;
        bodyClass?: string;
    }

    export function useReactToPrint(options: UseReactToPrintOptions): () => void;
}
