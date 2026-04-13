import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useMasterData } from '../../contexts/MasterDataContext';
import { Site } from '../../services/siteService';
import { listGalleryImages } from '../../services/geminiImageService';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faMapMarkerAlt,
    faCalendarAlt,
    faBuilding,
    faHardHat,
    faSearch,
    faTimes,
    faImages,
    faExpand,
    faChevronLeft,
    faChevronRight,
    faInfoCircle,
    faExternalLinkAlt,
    faMoneyBillWave,
    faPaintBrush,
    faUsers
} from '@fortawesome/free-solid-svg-icons';
import { differenceInDays, parseISO, isValid, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// --- Types ---
type ProjectStatus = 'all' | 'active' | 'planned' | 'completed';

// --- Mock Data Helper ---
// Backend doesn't support images yet, so we generate deterministic mock data based on Site ID
const enrichSiteWithMockData = (site: Site, birdseyeUrls: string[] = []): Site => {
    const seed = site.id ? site.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
    const getRandom = (arr: string[]) => arr[seed % arr.length];

    // High quality architectural perspective shots
    const perspectives = [
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1591955506264-3f75b7809999?q=80&w=1000&auto=format&fit=crop"
    ];

    // Construction site and interior photos for gallery
    const galleryPhotos = [
        "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1621251996238-6f68e8203598?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1531834685032-c34bf0d84c71?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1464938050520-ef2270bb8ce8?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1590642916589-592bca10dfbf?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1535732759880-bbd5c7265e3f?q=80&w=800&auto=format&fit=crop"
    ];

    const fallbackPool = birdseyeUrls.length > 0 ? birdseyeUrls : galleryPhotos;

    // Select 4-8 photos deterministically
    const numPhotos = Math.min((seed % 5) + 4, Math.max(fallbackPool.length, 1));
    const selectedPhotos: string[] = [];
    for (let i = 0; i < numPhotos; i++) {
        selectedPhotos.push(fallbackPool[(seed + i) % fallbackPool.length]);
    }

    const hasRegisteredPhotos = Array.isArray(site.photos) && site.photos.filter(Boolean).length > 0;

    return {
        ...site,
        imageUrl: site.imageUrl || getRandom(birdseyeUrls.length > 0 ? birdseyeUrls : perspectives),
        photos: hasRegisteredPhotos ? site.photos : selectedPhotos
    };
};

// --- Components ---

const ProgressBar = ({ start, end }: { start?: string; end?: string }) => {
    const progress = useMemo(() => {
        if (!start || !end) return 0;
        try {
            const startDate = parseISO(start);
            const endDate = parseISO(end);

            if (!isValid(startDate) || !isValid(endDate)) return 0;

            const total = differenceInDays(endDate, startDate);
            const elapsed = differenceInDays(new Date(), startDate);

            if (total <= 0) return 100;
            return Math.min(Math.max((elapsed / total) * 100, 0), 100);
        } catch (e) {
            return 0;
        }
    }, [start, end]);

    return (
        <div className="w-full">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>공정률</span>
                <span className="text-blue-400 font-bold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                />
            </div>
        </div>
    );
};

// Lightbox for full screen image viewing
const PhotoLightbox = ({
    images,
    initialIndex,
    onClose
}: {
    images: string[],
    initialIndex: number,
    onClose: () => void
}) => {
    const [index, setIndex] = useState(initialIndex);

    const nextImage = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIndex((prev) => (prev + 1) % images.length);
    }, [images.length]);

    const prevImage = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIndex((prev) => (prev - 1 + images.length) % images.length);
    }, [images.length]);

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, nextImage, prevImage]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center"
            onClick={onClose}
        >
            <button onClick={onClose} className="absolute top-6 right-6 text-white/70 hover:text-white p-2 z-[70]">
                <FontAwesomeIcon icon={faTimes} size="2x" />
            </button>

            <button onClick={prevImage} className="absolute left-4 md:left-8 text-white/50 hover:text-white transition-colors p-4 z-[70] hidden md:block">
                <FontAwesomeIcon icon={faChevronLeft} size="3x" />
            </button>

            <div className="relative w-full h-full flex items-center justify-center p-4">
                <motion.img
                    key={index}
                    src={images[index]}
                    alt={`Gallery ${index + 1}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />

                <div className="absolute bottom-6 left-0 right-0 text-center text-white/80 font-medium tracking-widest bg-black/50 py-2 backdrop-blur-sm">
                    {index + 1} / {images.length}
                </div>
            </div>

            <button onClick={nextImage} className="absolute right-4 md:right-8 text-white/50 hover:text-white transition-colors p-4 z-[70] hidden md:block">
                <FontAwesomeIcon icon={faChevronRight} size="3x" />
            </button>
        </motion.div>
    );
};

const ProjectCard = ({ site, onClick }: { site: Site; onClick: () => void }) => {
    return (
        <motion.div
            layoutId={`card-${site.id}`}
            onClick={onClick}
            className="group relative w-full aspect-[4/5] cursor-pointer rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 shadow-xl hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-500"
            whileHover={{ y: -8 }}
        >
            {/* Background Image (Perspective View) */}
            <div className="absolute inset-0 overflow-hidden">
                <img
                    src={site.imageUrl}
                    alt={site.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-300" />
            </div>

            {/* Status Badge */}
            <div className="absolute top-4 left-4 z-10">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-md border border-white/10 ${site.status === 'active' ? 'bg-green-500/90 text-white' :
                    site.status === 'completed' ? 'bg-slate-500/90 text-white' :
                        'bg-yellow-500/90 text-white'
                    }`}>
                    {site.status === 'active' ? '진행중' : site.status === 'completed' ? '완공' : '예정'}
                </span>
            </div>

            {/* Content Content - Always visible summary */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-20 flex flex-col justify-end h-full">
                <div className="mt-auto transition-transform duration-300 group-hover:-translate-y-2">
                    <h3 className="text-xl font-bold text-white mb-2 leading-tight drop-shadow-md group-hover:text-blue-200 transition-colors">
                        {site.name}
                    </h3>
                    <div className="flex items-center gap-2 text-slate-300 text-xs mb-3">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-blue-400" />
                        <span className="truncate">{site.address || '주소 미입력'}</span>
                    </div>
                </div>

                {/* Hidden Details - Slide up on hover */}
                <div className="h-0 opacity-0 group-hover:h-auto group-hover:opacity-100 overflow-hidden transition-all duration-500 ease-in-out">
                    <div className="pt-2 border-t border-white/10 space-y-2 pb-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 flex items-center gap-2">
                                <FontAwesomeIcon icon={faBuilding} /> 시공사
                            </span>
                            <span className="text-slate-200 font-medium truncate max-w-[120px]">
                                {site.companyName || '-'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCalendarAlt} /> 기간
                            </span>
                            <span className="text-slate-200 font-medium">
                                {site.startDate ? format(parseISO(site.startDate), 'yy.MM.dd') : '-'} ~
                            </span>
                        </div>

                        {site.status === 'active' && (
                            <div className="mt-3">
                                <ProgressBar start={site.startDate} end={site.endDate} />
                            </div>
                        )}

                        <div className="pt-3 text-center">
                            <span className="inline-flex items-center gap-2 text-xs font-bold text-blue-300 group-hover:text-blue-100 transition-colors">
                                상세 보기 <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const ProjectDetailModal = ({ site, onClose }: { site: Site; onClose: () => void }) => {
    const navigate = useNavigate();
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const validPhotos = site.photos?.filter(Boolean) || [];

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    // Enrich missing visual data for display if needed
    const enrichedSite = useMemo(() => enrichSiteWithMockData(site), [site]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
                layoutId={`card-${site.id}`}
                className="relative w-full max-w-6xl max-h-[90vh] bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-700 ring-1 ring-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* --- Left Column: Hero Image & Key Actions --- */}
                <div className="w-full md:w-2/5 relative flex flex-col">
                    <div className="relative flex-grow h-64 md:h-auto overflow-hidden">
                        <img
                            src={enrichedSite.imageUrl}
                            alt="Perspective View"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-80" />

                        <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg backdrop-blur-md ${site.status === 'active' ? 'bg-green-600/90' :
                                site.status === 'completed' ? 'bg-slate-600/90' : 'bg-yellow-600/90'
                                }`}>
                                {site.status === 'active' ? 'ACTIVE' : site.status === 'completed' ? 'COMPLETED' : 'PLANNED'}
                            </span>
                        </div>

                        <div className="absolute bottom-6 left-6 right-6 z-10">
                            <h2 className="text-3xl font-extrabold text-white mb-2 leading-tight text-shadow-lg">{site.name}</h2>
                            <p className="text-blue-300 font-medium flex items-center gap-2 text-sm bg-slate-900/50 backdrop-blur-md px-3 py-1 rounded-lg inline-flex border border-white/10">
                                <span>CODE: {site.code}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* --- Right Column: Details & Gallery --- */}
                <div className="w-full md:w-3/5 overflow-y-auto custom-scrollbar bg-slate-900 flex flex-col">
                    <div className="p-6 md:p-8 flex-grow">
                        <div className="flex justify-end mb-4 absolute top-4 right-4 z-20">
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all border border-slate-700"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase mb-1">총 투입 공수</p>
                                <p className="text-2xl font-bold text-blue-400">
                                    {site.totalManDay?.toFixed(1) || '0'} <span className="text-sm text-slate-500 font-normal">MD</span>
                                </p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                <p className="text-slate-400 text-xs font-bold uppercase mb-1">현장 구분</p>
                                <p className="text-xl font-bold text-slate-200">
                                    {site.siteType || '미지정'}
                                </p>
                            </div>
                        </div>

                        {/* Project Info */}
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500" /> 프로젝트 정보
                            </h3>
                            <div className="bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50 space-y-4 text-sm">
                                <div className="grid grid-cols-[100px_1fr] items-start gap-2">
                                    <span className="text-slate-400 font-medium flex items-center gap-2"><FontAwesomeIcon icon={faMapMarkerAlt} className="w-3" /> 주소</span>
                                    <span className="text-slate-200 break-words">{site.address || '-'}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                                    <span className="text-slate-400 font-medium flex items-center gap-2"><FontAwesomeIcon icon={faCalendarAlt} className="w-3" /> 공사 기간</span>
                                    <span className="text-slate-200">
                                        {site.startDate || '미정'} ~ {site.endDate || '미정'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                                    <span className="text-slate-400 font-medium flex items-center gap-2"><FontAwesomeIcon icon={faMoneyBillWave} className="w-3" /> 결제 구분</span>
                                    <span className="text-slate-200">{site.paymentMethod || '-'}</span>
                                </div>
                                {site.color && (
                                    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                                        <span className="text-slate-400 font-medium flex items-center gap-2"><FontAwesomeIcon icon={faPaintBrush} className="w-3" /> 식별 색상</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full border border-slate-600" style={{ backgroundColor: site.color }} />
                                            <span className="text-slate-300 font-mono text-xs">{site.color}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Companies */}
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faBuilding} className="text-purple-500" /> 관련 기업
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex items-center p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mr-3">
                                        <FontAwesomeIcon icon={faBuilding} />
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-bold uppercase">시공사 (본사)</div>
                                        <div className="text-slate-200 font-medium">{site.companyName || '-'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mr-3">
                                        <FontAwesomeIcon icon={faHardHat} />
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-bold uppercase">발주사</div>
                                        <div className="text-slate-200 font-medium">{site.clientCompanyName || '-'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mr-3">
                                        <FontAwesomeIcon icon={faUsers} />
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 font-bold uppercase">협력사</div>
                                        <div className="text-slate-200 font-medium">{site.partnerName || '-'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Gallery Grid */}
                        <div>
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faImages} className="text-pink-500" /> 현장 갤러리
                                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded ml-2">{validPhotos.length} Photos</span>
                            </h3>
                            {validPhotos.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                    {validPhotos.map((photo, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setLightboxIndex(idx)}
                                            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                                        >
                                            <img
                                                src={photo}
                                                alt={`site-${idx}`}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                <FontAwesomeIcon icon={faExpand} className="text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-slate-800/30 rounded-xl p-8 text-center border border-slate-700/50 border-dashed">
                                    <FontAwesomeIcon icon={faImages} className="text-slate-600 text-3xl mb-3" />
                                    <p className="text-slate-500 text-sm">등록된 현장 사진이 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-slate-800 bg-slate-900/90 backdrop-blur-sm sticky bottom-0">
                        <button
                            onClick={() => navigate(`/site/management?siteId=${site.id}`)}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-600/25 active:scale-95"
                        >
                            <FontAwesomeIcon icon={faExternalLinkAlt} /> 현장 관리 시스템으로 이동
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Lightbox Overlay */}
            <AnimatePresence>
                {lightboxIndex !== null && validPhotos.length > 0 && (
                    <PhotoLightbox
                        images={validPhotos}
                        initialIndex={lightboxIndex}
                        onClose={() => setLightboxIndex(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export const ProjectGalleryPage = () => {
    // Use consistent MasterData context
    const { sites } = useMasterData();

    const [filter, setFilter] = useState<ProjectStatus>('all');
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [birdseyeUrls, setBirdseyeUrls] = useState<string[]>([]);

    useEffect(() => {
        let mounted = true;

        const loadBirdseyeImages = async () => {
            try {
                const { images } = await listGalleryImages('birdseye', 200);
                if (!mounted) return;
                const urls = images.map((image) => String(image.url || '').trim()).filter(Boolean);
                setBirdseyeUrls(urls);
            } catch (error) {
                console.error('Failed to load birdseye images for project gallery fallback:', error);
            }
        };

        loadBirdseyeImages();
        return () => {
            mounted = false;
        };
    }, []);

    // Filter logic
    const filteredSites = useMemo(() => {
        if (!sites) return [];
        let result = sites;
        if (filter !== 'all') {
            result = sites.filter(site => site.status === filter);
        }
        // Use AI 조감도 images as fallback when a site has no registered photos/image
        return result.map((site) => enrichSiteWithMockData(site, birdseyeUrls));
    }, [sites, filter, birdseyeUrls]);

    const activeCount = sites.filter(s => s.status === 'active').length || 0;
    const totalCount = sites.length || 0;

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10 font-sans text-slate-100">
            {/* --- Header --- */}
            <div className="mb-12 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 w-fit">
                            Project Gallery
                        </h1>
                        <p className="text-slate-400 font-medium text-lg leading-relaxed">
                            전체 <span className="text-white font-bold">{totalCount}</span>개의 프로젝트 포트폴리오.<br />
                            현재 <span className="text-green-400 font-bold">{activeCount}</span>개의 스마트 건설 현장이 운영되고 있습니다.
                        </p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'all', label: '전체 보기' },
                        { id: 'active', label: '진행중' },
                        { id: 'planned', label: '공사 예정' },
                        { id: 'completed', label: '공사 완료' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id as ProjectStatus)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${filter === tab.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- Gallery Grid --- */}
            <div className="max-w-[1920px] mx-auto">
                <motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 md:gap-8"
                >
                    <AnimatePresence mode='popLayout'>
                        {filteredSites.map(site => (
                            <motion.div
                                layout
                                key={site.id}
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.3 }}
                            >
                                <ProjectCard site={site} onClick={() => setSelectedSite(site)} />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>

                {/* --- Empty State --- */}
                {filteredSites.length === 0 && (
                    <div className="text-center py-32">
                        <div className="bg-slate-800/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700">
                            <FontAwesomeIcon icon={faSearch} size="3x" className="opacity-20 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">검색 결과가 없습니다</h3>
                        <p className="text-slate-400">필터 조건을 변경하거나 새로운 프로젝트를 등록하세요.</p>
                    </div>
                )}
            </div>

            {/* --- Detail Modal --- */}
            <AnimatePresence>
                {selectedSite && (
                    <ProjectDetailModal site={selectedSite} onClose={() => setSelectedSite(null)} />
                )}
            </AnimatePresence>
        </div>
    );
};
