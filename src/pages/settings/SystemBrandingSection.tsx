import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faUpload, faSpinner, faImage, faGlobe, faBuilding } from '@fortawesome/free-solid-svg-icons';
import { storage, db } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Swal from 'sweetalert2';

type BrandingTarget = 'erp' | 'site';
type BrandingAsset = 'logo' | 'favicon';

interface BrandingState {
    erpLogoUrl: string | null;
    siteLogoUrl: string | null;
    erpFaviconUrl: string | null;
    siteFaviconUrl: string | null;
}

const SystemConfigurationSection: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [branding, setBranding] = useState<BrandingState>({
        erpLogoUrl: null,
        siteLogoUrl: null,
        erpFaviconUrl: null,
        siteFaviconUrl: null,
    });

    const erpLogoInputRef = useRef<HTMLInputElement>(null);
    const siteLogoInputRef = useRef<HTMLInputElement>(null);
    const erpFaviconInputRef = useRef<HTMLInputElement>(null);
    const siteFaviconInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchCurrentSettings();
    }, []);

    const getStoragePath = (target: BrandingTarget, asset: BrandingAsset): string => {
        if (asset === 'logo') {
            return target === 'site' ? 'settings/site_logo' : 'settings/erp_logo';
        }
        return target === 'site' ? 'settings/site_favicon' : 'settings/erp_favicon';
    };

    const getFieldName = (target: BrandingTarget, asset: BrandingAsset): keyof BrandingState => {
        if (target === 'site' && asset === 'logo') return 'siteLogoUrl';
        if (target === 'erp' && asset === 'logo') return 'erpLogoUrl';
        if (target === 'site' && asset === 'favicon') return 'siteFaviconUrl';
        return 'erpFaviconUrl';
    };

    const updateFaviconLink = (url: string) => {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
            link.href = url;
            return;
        }
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.href = url;
        document.head.appendChild(newLink);
    };

    const fetchCurrentSettings = async () => {
        try {
            const snap = await getDoc(doc(db, 'settings', 'system_config'));
            const data = snap.exists() ? snap.data() : {};

            let erpLogoUrl = (data.erpLogoUrl as string | undefined) || null;
            let siteLogoUrl = (data.siteLogoUrl as string | undefined) || (data.logoUrl as string | undefined) || null;
            let erpFaviconUrl = (data.erpFaviconUrl as string | undefined) || null;
            let siteFaviconUrl = (data.siteFaviconUrl as string | undefined) || (data.faviconUrl as string | undefined) || null;

            if (!erpLogoUrl) {
                try { erpLogoUrl = await getDownloadURL(ref(storage, 'settings/erp_logo')); } catch {}
            }
            if (!siteLogoUrl) {
                try { siteLogoUrl = await getDownloadURL(ref(storage, 'settings/site_logo')); } catch {}
            }
            if (!erpFaviconUrl) {
                try { erpFaviconUrl = await getDownloadURL(ref(storage, 'settings/erp_favicon')); } catch {}
            }
            if (!siteFaviconUrl) {
                try { siteFaviconUrl = await getDownloadURL(ref(storage, 'settings/site_favicon')); } catch {}
            }

            setBranding({ erpLogoUrl, siteLogoUrl, erpFaviconUrl, siteFaviconUrl });
        } catch (error) {
            console.error('Error fetching system settings:', error);
        }
    };

    const handleUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        target: BrandingTarget,
        asset: BrandingAsset
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (asset === 'logo') {
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
                Swal.fire('Error', '로고는 이미지 또는 동영상 파일만 업로드 가능합니다.', 'error');
                return;
            }
        } else {
            const validTypes = ['image/x-icon', 'image/png', 'image/svg+xml'];
            if (!validTypes.includes(file.type)) {
                Swal.fire('Error', '파비콘은 .ico, .png, .svg 파일만 가능합니다.', 'error');
                return;
            }
        }

        setLoading(true);
        try {
            const storagePath = getStoragePath(target, asset);
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file, { contentType: file.type });
            const url = await getDownloadURL(storageRef);

            const fieldName = getFieldName(target, asset);
            const patch: Record<string, any> = {
                [fieldName]: url,
                [`${fieldName}UpdatedAt`]: serverTimestamp(),
            };

            // Backward compatibility fields
            if (target === 'site' && asset === 'logo') {
                patch.logoUrl = url;
                patch.logoUpdatedAt = serverTimestamp();
            }
            if (target === 'site' && asset === 'favicon') {
                patch.faviconUrl = url;
                patch.faviconUpdatedAt = serverTimestamp();
                updateFaviconLink(url);
            }

            await setDoc(doc(db, 'settings', 'system_config'), patch, { merge: true });
            setBranding((prev) => ({ ...prev, [fieldName]: url }));

            Swal.fire({
                icon: 'success',
                title: '업데이트 완료',
                text: `${target.toUpperCase()} ${asset === 'logo' ? '로고' : '파비콘'}이 적용되었습니다.`,
                timer: 1500,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error('Branding upload failed:', error);
            Swal.fire('Error', '업로드 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const PreviewCard = ({
        title,
        description,
        url,
        onClickUpload,
        icon,
        isLogo = false,
    }: {
        title: string;
        description: string;
        url: string | null;
        onClickUpload: () => void;
        icon: any;
        isLogo?: boolean;
    }) => (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
            <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={icon} className="text-slate-500" />
                    {title}
                </h4>
                <p className="text-xs text-slate-500 mt-1">{description}</p>
            </div>

            <div className="w-full bg-white rounded-lg p-4 min-h-[120px] border border-dashed border-slate-300 flex items-center justify-center">
                {url ? (
                    isLogo ? (
                        url.includes('.mp4') ? (
                            <video src={url} autoPlay loop muted className="max-h-24 rounded" />
                        ) : (
                            <img src={url} alt={title} className="max-h-24 object-contain rounded" />
                        )
                    ) : (
                        <img src={url} alt={title} className="w-10 h-10 object-contain" />
                    )
                ) : (
                    <div className="text-center text-slate-400 text-xs">
                        <FontAwesomeIcon icon={faImage} className="text-2xl mb-2" />
                        <p>미등록</p>
                    </div>
                )}
            </div>

            <button
                onClick={onClickUpload}
                disabled={loading}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
                <FontAwesomeIcon icon={loading ? faSpinner : faUpload} spin={loading} />
                {loading ? '업로드 중...' : '파일 업로드'}
            </button>
        </div>
    );

    return (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCog} className="text-slate-500" />
                    시스템 브랜딩 설정 (ERP / SITE 분리)
                </h3>
                <p className="text-sm text-slate-500 mt-1">ERP 로고/파비콘과 SITE 로고/파비콘을 각각 등록하고 적용합니다.</p>
            </div>

            <div className="p-6 space-y-6">
                <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-3">로고 설정</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PreviewCard
                            title="ERP 로고"
                            description="ERP 헤더/사이드바에 표시"
                            url={branding.erpLogoUrl}
                            icon={faBuilding}
                            isLogo
                            onClickUpload={() => erpLogoInputRef.current?.click()}
                        />
                        <PreviewCard
                            title="SITE 로고"
                            description="청연 SITE 헤더/상단메뉴에 표시"
                            url={branding.siteLogoUrl}
                            icon={faGlobe}
                            isLogo
                            onClickUpload={() => siteLogoInputRef.current?.click()}
                        />
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-3">파비콘 설정</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PreviewCard
                            title="ERP 파비콘"
                            description="ERP 모드 브라우저 탭 아이콘"
                            url={branding.erpFaviconUrl}
                            icon={faBuilding}
                            onClickUpload={() => erpFaviconInputRef.current?.click()}
                        />
                        <PreviewCard
                            title="SITE 파비콘"
                            description="청연 SITE 모드 브라우저 탭 아이콘"
                            url={branding.siteFaviconUrl}
                            icon={faGlobe}
                            onClickUpload={() => siteFaviconInputRef.current?.click()}
                        />
                    </div>
                </div>
            </div>

            <input type="file" ref={erpLogoInputRef} className="hidden" accept="image/*,video/mp4" onChange={(e) => handleUpload(e, 'erp', 'logo')} />
            <input type="file" ref={siteLogoInputRef} className="hidden" accept="image/*,video/mp4" onChange={(e) => handleUpload(e, 'site', 'logo')} />
            <input type="file" ref={erpFaviconInputRef} className="hidden" accept=".ico,.png,.svg" onChange={(e) => handleUpload(e, 'erp', 'favicon')} />
            <input type="file" ref={siteFaviconInputRef} className="hidden" accept=".ico,.png,.svg" onChange={(e) => handleUpload(e, 'site', 'favicon')} />
        </section>
    );
};

export default SystemConfigurationSection;
