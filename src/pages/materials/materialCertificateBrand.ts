/** The same company artwork is used by the print view and the downloadable document. */
export const MATERIAL_CERTIFICATE_LOGO_URL = `${process.env.PUBLIC_URL || ''}/assets/estimate/cheongyeon-logo.png`;

export const loadMaterialCertificateLogo = (): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('청연 로고를 불러오지 못했습니다. 잠시 후 다시 저장해 주세요.'));
    image.src = MATERIAL_CERTIFICATE_LOGO_URL;
});
