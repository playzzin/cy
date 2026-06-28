import { MaterialPhotoSource } from './MaterialPhotoPicker';
import { SelectedMaterial } from './MaterialSelectionActionBar';

export interface OutboundCertificatePhotoDraft {
    id: string;
    file: File;
    source: MaterialPhotoSource;
}

export interface OutboundCertificateDraft {
    id: string;
    transactionDate: string;
    siteId: string;
    siteName: string;
    vehicleNumber: string;
    recipient: string;
    rentalCompanyId: string;
    rentalCompanyName: string;
    registeredByName: string;
    items: SelectedMaterial[];
    photos: OutboundCertificatePhotoDraft[];
    createdAt: number;
}

const draftStore = new Map<string, OutboundCertificateDraft>();

export const createOutboundCertificateDraftId = (): string =>
    `outbound_certificate_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const saveOutboundCertificateDraft = (draft: OutboundCertificateDraft): void => {
    draftStore.set(draft.id, draft);
};

export const getOutboundCertificateDraft = (id: string): OutboundCertificateDraft | null =>
    draftStore.get(id) || null;

export const deleteOutboundCertificateDraft = (id: string): void => {
    draftStore.delete(id);
};
