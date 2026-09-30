import { useEffect, useState } from 'react';
import { createDefaultStampSettings, StampDocument } from '../features/document-stamps/model';
import { documentStampService } from '../services/documentStampService';

export function useDocumentStamp(document: StampDocument, companyName?: string | null): string | null {
    const key = `${document}:${companyName || ''}`;
    const [result, setResult] = useState<{ key: string; url: string | null } | null>(null);
    useEffect(() => {
        let serial = 0;
        let active = true;
        const show = async (settings: Parameters<typeof documentStampService.resolveUrl>[0]) => {
            const request = ++serial;
            // Clear the previous company/asset immediately while its replacement loads.
            setResult({ key, url: null });
            const url = await documentStampService.resolveUrl(settings, document, companyName);
            if (active && request === serial) setResult({ key, url });
        };
        const unsubscribe = documentStampService.subscribe(settings => { void show(settings); }, () => { void show(createDefaultStampSettings()); });
        return () => { active = false; unsubscribe(); };
    }, [document, companyName, key]);
    return result?.key === key ? result.url : null;
}
