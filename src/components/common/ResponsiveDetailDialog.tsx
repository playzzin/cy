import React, { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import './ResponsiveDetailDialog.css';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    children: React.ReactNode;
}

/** A focus-trapped desktop dialog that becomes a scrollable sheet on phones. */
export default function ResponsiveDetailDialog({ open, onOpenChange, title, description, children }: Props) {
    const returnFocus = useRef<HTMLElement | null>(null);
    const close = useRef(onOpenChange);
    close.current = onOpenChange;
    useEffect(() => {
        if (!open || window.innerWidth > 640) return;
        const marker = `detail-${Date.now()}-${Math.random()}`;
        const initial = window.history.state;
        window.history.pushState({ ...initial, cyDetailDialog: marker }, '');
        let popped = false;
        const onPop = () => { popped = true; close.current(false); };
        window.addEventListener('popstate', onPop);
        return () => {
            window.removeEventListener('popstate', onPop);
            if (!popped && window.history.state?.cyDetailDialog === marker) window.history.back();
        };
    }, [open]);
    return <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
            <Dialog.Overlay className="cy-detail-dialog__overlay" />
            <Dialog.Content className="cy-detail-dialog"
                onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement; }}
                onCloseAutoFocus={event => { event.preventDefault(); if (returnFocus.current?.isConnected) returnFocus.current.focus(); }}>
                <header className="cy-detail-dialog__header">
                    <div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div>
                    <Dialog.Close className="cy-detail-dialog__close" aria-label="상세 닫기"><X size={20} /></Dialog.Close>
                </header>
                <div className="cy-detail-dialog__body">{children}</div>
            </Dialog.Content>
        </Dialog.Portal>
    </Dialog.Root>;
}
