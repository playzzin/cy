import type { InboundCertificateDraft } from './materialInboundCertificateDraftStore';
import { createMaterialCertificateImageFile, createMaterialPhotosPdfFile, MaterialPhotoDocument } from './materialCertificateExport';
export { MAX_MATERIAL_CERTIFICATE_PHOTOS as MAX_INBOUND_CERTIFICATE_PHOTOS, downloadMaterialCertificateFile as downloadInboundFile, getMaterialPhotoPageLayouts as getInboundPhotoPageLayouts } from './materialCertificateExport';

type CertificateDocument = Pick<InboundCertificateDraft, 'transactionDate' | 'siteName' | 'siteAddress' | 'vehicleNumber' | 'rentalCompanyName' | 'rentalCompanyAddress' | 'registeredByName' | 'items'> & { supplier?: string };

export const getInboundCertificateDetails = (data: CertificateDocument) => [
    { label: '입고일자', value: data.transactionDate },
    { label: '차량번호', value: data.vehicleNumber },
    { label: '현장명', value: data.siteName },
    data.rentalCompanyName === undefined
        ? { label: '공급업체', value: data.supplier || '' }
        : { label: '임대사', value: data.rentalCompanyName },
    { label: '현장주소', value: data.siteAddress || '', wide: true },
    { label: '임대사 주소', value: data.rentalCompanyAddress || '', wide: true },
    { label: '총품목', value: `${data.items.length}개` },
    { label: '총수량', value: data.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0).toLocaleString('ko-KR') },
];

export const createInboundCertificateImageFile = (data: CertificateDocument): Promise<File> => createMaterialCertificateImageFile(data, {
    title: '자재 입고증', filePrefix: '입고증', confirmation: '위 자재를 입고함.', signature: '입고 확인 __________________', details: getInboundCertificateDetails(data),
});
export const createInboundPhotosPdfFile = (data: MaterialPhotoDocument): Promise<File> => createMaterialPhotosPdfFile(data, { title: '자재 입고 첨부사진', filePrefix: '입고_첨부사진' });
