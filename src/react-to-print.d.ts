declare module 'react-to-print' {
    import type { IframeHTMLAttributes, RefObject } from 'react';

    type ContentNode = Element | Text | null | undefined;

    interface Font {
        family: string;
        source: string;
        weight?: string;
        style?: string;
    }

    export interface UseReactToPrintOptions {
        bodyClass?: string;
        contentRef?: RefObject<ContentNode>;
        documentTitle?: string;
        fonts?: Font[];
        ignoreGlobalStyles?: boolean;
        nonce?: string;
        onAfterPrint?: () => void;
        onBeforePrint?: () => Promise<void>;
        onPrintError?: (errorLocation: 'onBeforePrint' | 'print', error: Error) => void;
        pageStyle?: string;
        preserveAfterPrint?: boolean;
        print?: (target: HTMLIFrameElement) => Promise<any>;
        printIframeProps?: {
            allow?: IframeHTMLAttributes<HTMLIFrameElement>['allow'];
            referrerPolicy?: IframeHTMLAttributes<HTMLIFrameElement>['referrerPolicy'];
            sandbox?: IframeHTMLAttributes<HTMLIFrameElement>['sandbox'];
        };
        suppressErrors?: boolean;
        copyShadowRoots?: boolean;
    }

    export type UseReactToPrintFn = (content?: () => ContentNode) => void;

    export function useReactToPrint(options: UseReactToPrintOptions): UseReactToPrintFn;
}
