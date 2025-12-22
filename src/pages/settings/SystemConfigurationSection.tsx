import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faUpload, faSpinner, faCheck, faImage, faFilm } from '@fortawesome/free-solid-svg-icons';
import { storage } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Swal from 'sweetalert2';

const SystemConfigurationSection: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoType, setLogoType] = useState<'image' | 'video' | null>(null);
    const [faviconUrl, setFaviconUrl] = useState<string | null>(null);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchCurrentSettings();
    }, []);

    const fetchCurrentSettings = async () => {
        try {
            // Fetch Logo
            try {
                // Try fetching as company_logo (no extension check, just get URL)
                // Note: Firebase Storage doesn't strictly enforce extensions for getDownloadURL if the path is generic, 
                // but usually we need to know the exact path. 
                // We'll try common paths or we'll list items (if we had list permission). 
                // For simplicity, we'll try to fetch 'settings/company_logo' directly. 
                // If the user uploads with metadata, we can determine type.
                const logoRef = ref(storage, 'settings/company_logo');
                const url = await getDownloadURL(logoRef);
                setLogoUrl(url);

                // Determine type roughly by extension or assume based on previous upload behavior?
                // Ideally we should store metadata. For now, we'll fetch metadata or just check if it plays as video.
                // Let's assume content-type verification happens on upload or via metadata fetch.
                // For UI, we'll default to Image unless we know better.
                // However, fetching metadata requires another call. 
                // Let's try to infer from the URL if possible, or just default to image validation.
                // Actually, let's try to see if it works as img or video on the UI side.
            } catch (e) {
                // Fallback to default or empty
                console.log("No custom logo found.");
            }

            // Fetch Favicon
            try {
                const faviconRef = ref(storage, 'settings/favicon');
                const url = await getDownloadURL(faviconRef);
                setFaviconUrl(url);
            } catch (e) {
                console.log("No custom favicon found.");
            }
        } catch (error) {
            console.error("Error fetching system settings:", error);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            Swal.fire('Error', '이미지 또는 동영상 파일만 업로드 가능합니다.', 'error');
            return;
        }

        setLoading(true);
        try {
            const storageRef = ref(storage, 'settings/company_logo');

            // Upload with metadata so we know the content type later!
            const metadata = { contentType: file.type };
            await uploadBytes(storageRef, file, metadata);

            const url = await getDownloadURL(storageRef);
            setLogoUrl(url);
            setLogoType(file.type.startsWith('video/') ? 'video' : 'image');

            Swal.fire({
                icon: 'success',
                title: '로고 업데이트 완료',
                text: '새로운 로고가 적용되었습니다. (새로고침 후 확인)',
                timer: 1500
            });
        } catch (error) {
            console.error("Logo upload failed:", error);
            Swal.fire('Error', '로고 업로드 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type (ICO, PNG, SVG)
        const validTypes = ['image/x-icon', 'image/png', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            Swal.fire('Error', '파비콘은 .ico, .png, .svg 파일만 가능합니다.', 'error');
            return;
        }

        setLoading(true);
        try {
            const storageRef = ref(storage, 'settings/favicon');

            // Upload with metadata
            const metadata = { contentType: file.type };
            await uploadBytes(storageRef, file, metadata);

            const url = await getDownloadURL(storageRef);
            setFaviconUrl(url);

            // Dynamically update favicon
            const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (link) {
                link.href = url;
            } else {
                const newLink = document.createElement('link');
                newLink.rel = 'icon';
                newLink.href = url;
                document.head.appendChild(newLink);
            }

            Swal.fire({
                icon: 'success',
                title: '파비콘 업데이트 완료',
                text: '브라우저 탭 아이콘이 변경되었습니다.',
                timer: 1500
            });
        } catch (error) {
            console.error("Favicon upload failed:", error);
            Swal.fire('Error', '파비콘 업로드 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCog} className="text-slate-500" />
                        시스템 브랜딩 설정
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">회사 로고와 브라우저 아이콘(Favicon)을 설정합니다.</p>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* Logo Section */}
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-full md:w-1/3">
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            회사 로고 (대시보드 메인)
                        </label>
                        <p className="text-xs text-slate-500 mb-4">
                            대시보드 상단에 표시될 로고입니다.<br />
                            동영상(MP4) 또는 이미지(PNG, JPG)를 지원합니다.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => logoInputRef.current?.click()}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={loading ? faSpinner : faUpload} spin={loading} />
                                {loading ? '업로드 중...' : '로고 업로드'}
                            </button>
                            <input
                                type="file"
                                ref={logoInputRef}
                                onChange={handleLogoUpload}
                                className="hidden"
                                accept="image/*,video/mp4"
                            />
                        </div>
                    </div>

                    <div className="w-full md:w-2/3 bg-slate-100 rounded-lg p-6 flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-slate-300">
                        {logoUrl ? (
                            <div className="relative group">
                                {logoType === 'video' || (logoUrl && logoUrl.includes('.mp4')) ? (
                                    <video src={logoUrl} autoPlay loop muted className="max-h-48 rounded-lg shadow-md" />
                                ) : (
                                    <img src={logoUrl} alt="Company Logo" className="max-h-48 rounded-lg shadow-md object-contain" />
                                )}
                                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                    현재 적용 중
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-400">
                                <FontAwesomeIcon icon={faImage} className="text-4xl mb-2" />
                                <p>등록된 로고가 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full h-px bg-slate-100 my-6"></div>

                {/* Favicon Section */}
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-full md:w-1/3">
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            파비콘 (브라우저 탭 아이콘)
                        </label>
                        <p className="text-xs text-slate-500 mb-4">
                            브라우저 탭에 표시되는 작은 아이콘입니다.<br />
                            SVG(권장), PNG, ICO 형식을 지원합니다.
                        </p>
                        <button
                            onClick={() => faviconInputRef.current?.click()}
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={loading ? faSpinner : faUpload} spin={loading} />
                            {loading ? '업로드 중...' : '파비콘 업로드'}
                        </button>
                        <input
                            type="file"
                            ref={faviconInputRef}
                            onChange={handleFaviconUpload}
                            className="hidden"
                            accept=".ico,.png,.svg"
                        />
                    </div>

                    <div className="w-full md:w-2/3 bg-slate-100 rounded-lg p-6 flex flex-col items-center justify-center min-h-[120px] border-2 border-dashed border-slate-300">
                        {faviconUrl ? (
                            <div className="flex items-center gap-4">
                                <div className="bg-white p-4 rounded-full shadow-sm">
                                    <img src={faviconUrl} alt="Favicon" className="w-8 h-8 object-contain" />
                                </div>
                                <span className="text-sm text-slate-600 font-medium">현재 적용된 파비콘</span>
                            </div>
                        ) : (
                            <div className="text-center text-slate-400">
                                <FontAwesomeIcon icon={faCog} className="text-3xl mb-2" />
                                <p>등록된 파비콘이 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SystemConfigurationSection;
