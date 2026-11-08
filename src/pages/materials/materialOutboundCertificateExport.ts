import type { OutboundCertificateDraft } from './materialOutboundCertificateDraftStore';
import { createMaterialCertificateImageFile, createMaterialPhotosPdfFile, MaterialPhotoDocument } from './materialCertificateExport';
export { MAX_MATERIAL_CERTIFICATE_PHOTOS as MAX_OUTBOUND_CERTIFICATE_PHOTOS, downloadMaterialCertificateFile as downloadOutboundFile, getMaterialPhotoPageLayouts as getOutboundPhotoPageLayouts, getContainedPhotoRect } from './materialCertificateExport';
type CertificateDocument = Pick<OutboundCertificateDraft, 'transactionDate' | 'siteName' | 'siteAddress' | 'vehicleNumber' | 'recipient' | 'rentalCompanyName' | 'rentalCompanyAddress' | 'registeredByName' | 'items'>;
const formatQuantity = (value: number) => value.toLocaleString('ko-KR');

export const getOutboundCertificateDetails = (data: CertificateDocument) => [
    { label: '출고일자', value: data.transactionDate },
    { label: '차량번호', value: data.vehicleNumber },
    { label: '현장명', value: data.siteName },
    { label: '임대사', value: data.rentalCompanyName },
    { label: '현장주소', value: data.siteAddress || '', wide: true },
    { label: '임대사 주소', value: data.rentalCompanyAddress || '', wide: true },
    { label: '총품목', value: `${data.items.length}개` },
    { label: '총수량', value: formatQuantity(data.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)) },
];

export const createOutboundCertificateImageFile = (data: CertificateDocument): Promise<File> => createMaterialCertificateImageFile(data, {
    title: '자재 반출증', filePrefix: '반출증', confirmation: '위 자재를 반출함.', signature: '인수자 확인 __________________', details: getOutboundCertificateDetails(data),
});
export const createOutboundPhotosPdfFile = (data: MaterialPhotoDocument): Promise<File> => createMaterialPhotosPdfFile(data, { title: '자재 반출 첨부사진', filePrefix: '반출_첨부사진' });
