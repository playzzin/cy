import { MaterialPhotoSource } from './MaterialPhotoPicker';
import { SelectedMaterial } from './MaterialSelectionActionBar';
import type { MaterialPhotoReference } from './MaterialPhotoViewerModal';

export interface InboundCertificatePhotoDraft {
    id: string;
    file: File;
    source: MaterialPhotoSource;
}

export interface InboundCertificateDraft {
    id: string;
    transactionDate: string;
    siteId: string;
    siteName: string;
    siteAddress?: string;
    vehicleNumber: string;
    supplier: string;
    rentalCompanyName?: string;
    rentalCompanyAddress?: string;
    registeredByName: string;
    items: SelectedMaterial[];
    photos: InboundCertificatePhotoDraft[];
    createdAt: number;
    returnTo?: '/materials/transactions';
    photoReferences?: MaterialPhotoReference[];
}

const draftStore = new Map<string, InboundCertificateDraft>();

export const createInboundCertificateDraftId = (): string =>
    `inbound_certificate_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const saveInboundCertificateDraft = (draft: InboundCertificateDraft): void => {
    draftStore.set(draft.id, draft);
};

export const getInboundCertificateDraft = (id: string): InboundCertificateDraft | null =>
    draftStore.get(id) || null;

export const deleteInboundCertificateDraft = (id: string): void => {
    draftStore.delete(id);
};
