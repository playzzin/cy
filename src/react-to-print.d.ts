declare module 'react-to-print' {
    import * as React from 'react';

    export type UseReactToPrintHookContent = () => React.ReactInstance | null;

    export interface UseReactToPrintOptions {
        content?: UseReactToPrintHookContent;
        contentRef?: React.RefObject<Element | Text | null>;
        documentTitle?: string;
        onBeforeGetContent?: () => void | Promise<void>;
        onBeforePrint?: () => Promise<void>;
        onAfterPrint?: () => void;
        onPrintError?: (errorLocation: string, error: Error) => void;
        removeAfterPrint?: boolean;
        preserveAfterPrint?: boolean;
        pageStyle?: string | (() => string);
        copyStyles?: boolean;
        bodyClass?: string;
        print?: (target: HTMLIFrameElement) => Promise<any>;
        printIframeProps?: {
            allow?: React.IframeHTMLAttributes<HTMLIFrameElement>['allow'];
            referrerPolicy?: React.IframeHTMLAttributes<HTMLIFrameElement>['referrerPolicy'];
            sandbox?: React.IframeHTMLAttributes<HTMLIFrameElement>['sandbox'];
        };
    }

    export function useReactToPrint(options: UseReactToPrintOptions): (content?: UseReactToPrintHookContent) => void;
}
