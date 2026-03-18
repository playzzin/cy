import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faMagic, faImages, faTrash, faCopy, faDownload, faPen, faTimes, faSpinner,
    faCheck, faSave, faSearch, faExpand, faExclamationCircle, faUpload, faCog,
    faStar, faCrown, faCube, faFlag, faComment, faPlus, faGlobe, faBullhorn,
    faShareNodes, faAddressCard,
    faUserAstronaut,
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import {
    generateImage, saveGeneratedImage, listGalleryImages, deleteSavedImage, updateImageMetadata,
    uploadImageFile, applyAsFavicon, applyAsLogo, getCurrentFaviconUrl, getCurrentLogoUrl,
    getCustomCategories, addCustomCategory, deleteCustomCategory,
    migrateStorageToFirestore,
    IMAGE_PRESETS, ImageCategory, GalleryImage, CustomCategory
} from '../../services/geminiImageService';

// --- Preset Icon Map ---
const PRESET_ICONS: Record<ImageCategory, any> = {
    'favicon': faStar, 'logo': faCrown, 'icon': faCube, 'banner': faFlag,
    'og-image': faShareNodes,
    'character': faUserAstronaut,
    'business-card': faAddressCard,
    'kakao-square': faComment, 'kakao-wide': faComment, 'custom': faCube
};

const PRESET_COLORS: Record<ImageCategory, string> = {
    'favicon': 'from-blue-500 to-indigo-500',
    'logo': 'from-purple-500 to-pink-500',
    'icon': 'from-cyan-500 to-blue-500',
    'banner': 'from-orange-500 to-rose-500',
    'og-image': 'from-indigo-500 to-purple-500',
    'character': 'from-emerald-500 to-teal-500',
    'business-card': 'from-slate-600 to-slate-800',
    'kakao-square': 'from-yellow-400 to-yellow-600',
    'kakao-wide': 'from-yellow-500 to-yellow-700',
    'custom': 'from-slate-500 to-slate-700',
};

const BADGE_COLORS: Record<ImageCategory, string> = {
    'favicon': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'logo': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'icon': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'banner': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'og-image': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    'character': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'business-card': 'bg-slate-600/20 text-slate-300 border-slate-500/30',
    'kakao-square': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    'kakao-wide': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    'custom': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const FILTER_TABS: { key: ImageCategory | 'all'; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'favicon', label: '파비콘' },
    { key: 'logo', label: '로고' },
    { key: 'character', label: '캐릭터' },
    { key: 'icon', label: '아이콘' },
    { key: 'banner', label: '배너' },
    { key: 'business-card', label: '명함' },
    { key: 'og-image', label: 'OG' },
    { key: 'kakao-square', label: '카카오' },
    { key: 'custom', label: '커스텀' },
];

// --- Detail Modal ---
const ImageDetailModal = ({ image, onClose, onDelete, onUpdate, onApplyFavicon, onApplyLogo }: {
    image: GalleryImage;
    onClose: () => void;
    onDelete: (img: GalleryImage) => void;
    onUpdate: (img: GalleryImage, updates: { customName?: string; tags?: string[] }) => void;
    onApplyFavicon: (img: GalleryImage) => void;
    onApplyLogo: (img: GalleryImage) => void;
}) => {
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(image.customName || image.name);
    const [editTags, setEditTags] = useState((image.tags || []).join(', '));

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => { document.body.style.overflow = 'unset'; window.removeEventListener('keydown', handleKey); };
    }, [onClose]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(image.url);
            Swal.fire({ icon: 'success', title: 'URL 복사 완료', timer: 1200, showConfirmButton: false });
        } catch {
            Swal.fire('실패', 'URL 복사에 실패했습니다.', 'error');
        }
    };

    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = image.url;
        a.download = image.customName || image.name;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleSaveEdit = () => {
        const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
        onUpdate(image, { customName: editName, tags });
        setEditing(false);
    };

    const preset = IMAGE_PRESETS[image.category];
    const dateStr = image.createdAt ? new Date(image.createdAt).toLocaleString('ko-KR') : '-';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col md:flex-row"
                onClick={e => e.stopPropagation()}
            >
                {/* Image */}
                <div className="md:w-3/5 bg-slate-950 flex items-center justify-center p-4 min-h-[300px]">
                    <img src={image.url} alt={image.name} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                </div>

                {/* Info */}
                <div className="md:w-2/5 p-6 overflow-y-auto flex flex-col">
                    <button onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>

                    <div className="mb-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${BADGE_COLORS[image.category]}`}>
                            <FontAwesomeIcon icon={PRESET_ICONS[image.category]} />
                            {preset?.label || image.category}
                        </span>
                    </div>

                    {editing ? (
                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">이름</label>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500"
                                    value={editName} onChange={e => setEditName(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">태그 (쉼표 구분)</label>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500"
                                    value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="로고, 브랜드, 메인" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleSaveEdit} className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors">
                                    <FontAwesomeIcon icon={faCheck} className="mr-1" /> 저장
                                </button>
                                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors">
                                    취소
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-white mb-1">{image.customName || image.name}</h2>
                            {image.tags && image.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {image.tags.map((tag, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">#{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-3 text-sm flex-1">
                        <div className="bg-slate-800/50 rounded-xl p-4 space-y-2 border border-slate-700/50">
                            <div className="flex justify-between"><span className="text-slate-400">크기</span><span className="text-slate-200">{preset?.width}×{preset?.height}px</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">생성일</span><span className="text-slate-200">{dateStr}</span></div>
                        </div>
                        {image.prompt && (
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                <p className="text-xs text-slate-400 mb-1 font-bold">프롬프트</p>
                                <p className="text-slate-300 text-xs leading-relaxed">{image.prompt}</p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800">
                        <button onClick={handleCopy} className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                            <FontAwesomeIcon icon={faCopy} /> URL 복사
                        </button>
                        <button onClick={handleDownload} className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                            <FontAwesomeIcon icon={faDownload} /> 다운로드
                        </button>
                        <button onClick={() => setEditing(true)} className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                            <FontAwesomeIcon icon={faPen} /> 수정
                        </button>
                        <button onClick={() => onDelete(image)} className="py-2.5 bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                            <FontAwesomeIcon icon={faTrash} /> 삭제
                        </button>
                        <button onClick={() => onApplyFavicon(image)} className="py-2.5 bg-teal-900/50 hover:bg-teal-800/50 text-teal-300 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                            <FontAwesomeIcon icon={faGlobe} /> 파비콘 적용
                        </button>
                        <button onClick={() => onApplyLogo(image)} className="py-2.5 bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                            <FontAwesomeIcon icon={faCrown} /> 로고 적용
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const SkeletonCard = () => (
    <div className="bg-slate-900 rounded-2xl border border-slate-800/50 overflow-hidden animate-pulse">
        <div className="aspect-square bg-slate-800" />
        <div className="p-4 space-y-2">
            <div className="h-4 bg-slate-800 rounded w-3/4" />
            <div className="h-3 bg-slate-800 rounded w-1/2" />
        </div>
    </div>
);

// --- Main Page ---
export const AiImageGalleryPage = () => {
    // Generation state
    const [category, setCategory] = useState<ImageCategory>('logo');
    const [prompt, setPrompt] = useState('');
    const [charRef, setCharRef] = useState(''); // Character consistency reference
    const [generating, setGenerating] = useState(false);
    const [previewBase64, setPreviewBase64] = useState<string | null>(null);
    const [previewMime, setPreviewMime] = useState('image/png');
    const [genError, setGenError] = useState<string | null>(null);

    // Save state
    const [saving, setSaving] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [saveTags, setSaveTags] = useState('');

    // Gallery state
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchingMore, setFetchingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [filterCategory, setFilterCategory] = useState<ImageCategory | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

    // Panel state
    const [showGenPanel, setShowGenPanel] = useState(true);
    const [panelTab, setPanelTab] = useState<'generate' | 'upload'>('generate');

    // Upload state
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadName, setUploadName] = useState('');
    const [uploadTags, setUploadTags] = useState('');

    // Category management
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCatLabel, setNewCatLabel] = useState('');
    const [newCatWidth, setNewCatWidth] = useState(512);
    const [newCatHeight, setNewCatHeight] = useState(512);
    const [newCatDesc, setNewCatDesc] = useState('');
    const [newCatColor, setNewCatColor] = useState('from-teal-500 to-cyan-500');

    // Applied favicon/logo
    const [currentFavicon, setCurrentFavicon] = useState<string | null>(null);
    const [currentLogo, setCurrentLogo] = useState<string | null>(null);

    // Business Card State
    const [bizName, setBizName] = useState('');
    const [bizTitle, setBizTitle] = useState('');
    const [bizCompany, setBizCompany] = useState('');
    const [bizPhone, setBizPhone] = useState('');
    const [bizEmail, setBizEmail] = useState('');
    const [bizAddress, setBizAddress] = useState('');
    const [bizStyle, setBizStyle] = useState('Modern');

    const GRADIENT_OPTIONS = [
        'from-teal-500 to-cyan-500', 'from-violet-500 to-fuchsia-500', 'from-lime-500 to-green-500',
        'from-sky-500 to-indigo-500', 'from-pink-500 to-rose-500', 'from-amber-500 to-yellow-500',
    ];

    const loadImages = useCallback(async (isNext = false) => {
        if (!isNext) {
            setLoading(true);
            setImages([]);
            setLastDoc(null);
        } else {
            setFetchingMore(true);
        }

        try {
            const result = await listGalleryImages(
                filterCategory === 'all' ? undefined : filterCategory,
                24,
                isNext ? lastDoc : undefined
            );
            
            if (isNext) {
                setImages(prev => [...prev, ...result.images]);
            } else {
                setImages(result.images);
            }
            
            setLastDoc(result.lastDoc);
            setHasMore(result.images.length === 24);
        } finally {
            setLoading(false);
            setFetchingMore(false);
        }
    }, [filterCategory, lastDoc]);

    useEffect(() => { loadImages(); }, [filterCategory]);

    const handleMigrate = async () => {
        const confirm = await Swal.fire({
            title: '이미지 마이그레이션',
            text: '기존 Storage 이미지를 Firestore로 인덱싱 하시겠습니까? (최초 1회 권장)',
            icon: 'info', showCancelButton: true, confirmButtonText: '시작', cancelButtonText: '취소'
        });
        if (!confirm.isConfirmed) return;
        
        Swal.fire({
            title: '마이그레이션 진행 중...',
            text: '잠시만 기다려주세요.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            await migrateStorageToFirestore();
            Swal.fire('완료', '마이그레이션이 완료되었습니다.', 'success');
            loadImages();
        } catch (e) {
            Swal.fire('오류', '마이그레이션 중 오류가 발생했습니다.', 'error');
        }
    };

    useEffect(() => {
        setCustomCategories(getCustomCategories());
        getCurrentFaviconUrl().then(setCurrentFavicon);
        getCurrentLogoUrl().then(setCurrentLogo);
    }, []);

    // File upload handlers
    const handleFileSelect = (file: File) => {
        setUploadFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setUploadPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!uploadFile) { Swal.fire('알림', '파일을 선택해주세요.', 'warning'); return; }
        setUploading(true);
        try {
            const tags = uploadTags.split(',').map(t => t.trim()).filter(Boolean);
            const result = await uploadImageFile(uploadFile, category, uploadName || undefined, tags);
            if (result.success) {
                Swal.fire({ icon: 'success', title: '업로드 완료!', timer: 1500, showConfirmButton: false });
                setUploadFile(null); setUploadPreview(null); setUploadName(''); setUploadTags('');
                loadImages();
            } else {
                Swal.fire('업로드 실패', result.error || '오류 발생', 'error');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleFileSelect(file);
    };

    // Favicon/Logo handlers
    const handleApplyFavicon = async (img: GalleryImage) => {
        const confirm = await Swal.fire({
            title: '파비콘 적용', text: '이 이미지를 웹사이트 파비콘으로 적용하시겠습니까?',
            icon: 'question', showCancelButton: true, confirmButtonText: '적용', cancelButtonText: '취소'
        });
        if (!confirm.isConfirmed) return;
        const result = await applyAsFavicon(img.url);
        if (result.success) {
            setCurrentFavicon(img.url);
            Swal.fire({ icon: 'success', title: '파비콘 적용 완료!', text: '브라우저에 즉시 반영됩니다.', timer: 2000, showConfirmButton: false });
        } else {
            Swal.fire('오류', result.error || '파비콘 적용 실패', 'error');
        }
    };

    const handleApplyLogo = async (img: GalleryImage) => {
        const confirm = await Swal.fire({
            title: '로고 적용', text: '이 이미지를 사이트 로고로 적용하시겠습니까?',
            icon: 'question', showCancelButton: true, confirmButtonText: '적용', cancelButtonText: '취소'
        });
        if (!confirm.isConfirmed) return;
        const result = await applyAsLogo(img.url);
        if (result.success) {
            setCurrentLogo(result.url || img.url);
            Swal.fire({ icon: 'success', title: '로고 적용 완료!', text: '사이드바의 로고가 변경됩니다.', timer: 2000, showConfirmButton: false });
        } else {
            Swal.fire('오류', result.error || '로고 적용 실패', 'error');
        }
    };

    // Category management
    const handleAddCategory = () => {
        if (!newCatLabel.trim()) return;
        const key = newCatLabel.trim().toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').substring(0, 30);
        const cat: CustomCategory = {
            key, label: newCatLabel.trim(), width: newCatWidth, height: newCatHeight,
            description: newCatDesc || `${newCatLabel} (${newCatWidth}×${newCatHeight})`, color: newCatColor
        };
        const updated = addCustomCategory(cat);
        setCustomCategories(updated);
        setNewCatLabel(''); setNewCatDesc(''); setNewCatWidth(512); setNewCatHeight(512);
    };

    const handleDeleteCategory = (key: string) => {
        const updated = deleteCustomCategory(key);
        setCustomCategories(updated);
    };

    const filteredImages = useMemo(() => {
        let result = images;
        // Filtering is now handled by Firestore, but we still do client-side search for now
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(i =>
                (i.customName || i.name).toLowerCase().includes(q) ||
                (i.prompt || '').toLowerCase().includes(q) ||
                (i.tags || []).some(t => t.toLowerCase().includes(q))
            );
        }
        return result;
    }, [images, searchQuery]);

    const handleGenerate = async () => {
        if (!prompt.trim()) { Swal.fire('알림', '이미지 설명을 입력해주세요.', 'warning'); return; }
        setGenerating(true); setGenError(null); setPreviewBase64(null);

        // Character consistency handling: prepending the character reference if it exists
        let finalPrompt = prompt;

        if (category === 'character' && charRef.trim()) {
            finalPrompt = `Character Reference: ${charRef}\n\nAction/Scene: ${prompt}`;
        } else if (category === 'business-card') {
            finalPrompt = `Design a ${bizStyle || 'Modern'} style business card.\n` +
                `Layout: Professional, clean, balanced composition.\n` +
                `Color Scheme: ${bizStyle === 'Luxury' ? 'Black and Gold' : bizStyle === 'Creative' ? 'Vibrant and bold' : 'Professional corporate colors'}.\n` +
                `Text to include (Mockup): \n` +
                `- Company: ${bizCompany}\n` +
                `- Name: ${bizName}\n` +
                `- Title: ${bizTitle}\n` +
                `- Contact: ${bizPhone}, ${bizEmail}\n` +
                `- Address: ${bizAddress}\n\n` +
                `Additional Instructions: ${prompt || 'Create a high-quality, realistic mockup of the business card.'}`;
        }

        try {
            const result = await generateImage(finalPrompt, category);
            if (result.success && result.imageBase64) {
                setPreviewBase64(result.imageBase64);
                setPreviewMime(result.mimeType || 'image/png');
                setSaveName('');
                setSaveTags('');
            } else {
                setGenError(result.error || '생성 실패');
            }
        } catch (err) {
            setGenError(err instanceof Error ? err.message : '알 수 없는 오류');
        } finally {
            setGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!previewBase64) return;
        setSaving(true);
        try {
            const tags = saveTags.split(',').map(t => t.trim()).filter(Boolean);
            const result = await saveGeneratedImage(previewBase64, previewMime, category, prompt, saveName || undefined, tags);
            if (result.success) {
                Swal.fire({ icon: 'success', title: '저장 완료!', text: '이미지가 갤러리에 추가되었습니다.', timer: 1500, showConfirmButton: false });
                setPreviewBase64(null);
                setPrompt('');
                setSaveName('');
                setSaveTags('');
                loadImages();
            } else {
                Swal.fire('저장 실패', result.error || '저장 중 오류', 'error');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (img: GalleryImage) => {
        const confirm = await Swal.fire({
            title: '이미지 삭제', text: `"${img.customName || img.name}"을(를) 삭제하시겠습니까?`,
            icon: 'warning', showCancelButton: true, confirmButtonText: '삭제', cancelButtonText: '취소', confirmButtonColor: '#ef4444'
        });
        if (!confirm.isConfirmed) return;
        const ok = await deleteSavedImage(img.fullPath);
        if (ok) {
            setImages(prev => prev.filter(i => i.fullPath !== img.fullPath));
            if (selectedImage?.fullPath === img.fullPath) setSelectedImage(null);
            Swal.fire({ icon: 'success', title: '삭제 완료', timer: 1000, showConfirmButton: false });
        } else {
            Swal.fire('오류', '삭제에 실패했습니다.', 'error');
        }
    };

    const handleUpdate = async (img: GalleryImage, updates: { customName?: string; tags?: string[] }) => {
        const ok = await updateImageMetadata(img.fullPath, updates);
        if (ok) {
            setImages(prev => prev.map(i => i.fullPath === img.fullPath ? { ...i, ...updates } : i));
            if (selectedImage?.fullPath === img.fullPath) {
                setSelectedImage(prev => prev ? { ...prev, ...updates } : prev);
            }
            Swal.fire({ icon: 'success', title: '수정 완료', timer: 1000, showConfirmButton: false });
        } else {
            Swal.fire('오류', '수정에 실패했습니다.', 'error');
        }
    };

    const preset = IMAGE_PRESETS[category];

    return (
        <div className="min-h-[calc(100vh+60px)] -m-[30px] w-[calc(100%+60px)] bg-slate-950 text-slate-100 overflow-x-hidden">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl relative z-30">
                <div className="max-w-[1920px] mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400">
                            AI 이미지 스튜디오
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Gemini AI로 파비콘, 로고, 아이콘, 배너 등을 생성하고 관리합니다.
                            <span className="ml-2 text-slate-500">{images.length}개 보유</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Current Favicon/Logo Status */}
                        {(currentFavicon || currentLogo) && (
                            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                                {currentFavicon && (
                                    <div className="flex items-center gap-1.5" title="현재 파비콘">
                                        <FontAwesomeIcon icon={faGlobe} className="text-teal-400 text-[10px]" />
                                        <img src={currentFavicon} alt="Favicon" className="w-5 h-5 rounded object-cover" />
                                    </div>
                                )}
                                {currentFavicon && currentLogo && <div className="w-px h-4 bg-slate-700" />}
                                {currentLogo && (
                                    <div className="flex items-center gap-1.5" title="현재 로고">
                                        <FontAwesomeIcon icon={faCrown} className="text-purple-400 text-[10px]" />
                                        <img src={currentLogo} alt="Logo" className="w-5 h-5 rounded object-cover" />
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="relative">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                            <input
                                className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-purple-500 focus:border-purple-500 w-48 md:w-64"
                                placeholder="이름, 프롬프트, 태그 검색..."
                                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button onClick={handleMigrate} 
                            className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all"
                            title="기존 이미지 인덱싱">
                            <FontAwesomeIcon icon={faCog} /> 마이그레이션
                        </button>
                        <button onClick={() => setShowGenPanel(!showGenPanel)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${showGenPanel ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>
                            <FontAwesomeIcon icon={faMagic} /> {showGenPanel ? '생성 패널 닫기' : 'AI 생성'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1920px] mx-auto flex flex-col lg:flex-row gap-0">
                {/* Generation Panel */}
                <AnimatePresence>
                    {showGenPanel && (
                        <motion.aside
                            initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="lg:w-[420px] flex-none border-r border-slate-800 bg-slate-900/50 overflow-hidden sticky top-0 h-screen"
                        >
                            <div className="p-6 space-y-5 h-full overflow-y-auto">
                                {/* Panel Tab Switcher */}
                                <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
                                    <button onClick={() => setPanelTab('generate')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${panelTab === 'generate' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                                        <FontAwesomeIcon icon={faMagic} /> AI 생성
                                    </button>
                                    <button onClick={() => setPanelTab('upload')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${panelTab === 'upload' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                                        <FontAwesomeIcon icon={faUpload} /> 파일 업로드
                                    </button>
                                </div>

                                {/* Category Preset Grid (shared between tabs) */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">이미지 유형</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(Object.keys(IMAGE_PRESETS) as ImageCategory[]).map(key => {
                                            const p = IMAGE_PRESETS[key];
                                            const active = category === key;
                                            return (
                                                <button key={key} onClick={() => setCategory(key)}
                                                    className={`relative p-2.5 rounded-xl text-center transition-all group ${active ? 'bg-slate-800 ring-2 ring-purple-500 shadow-lg shadow-purple-500/10' : 'bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50'}`}>
                                                    <div className={`w-8 h-8 mx-auto rounded-lg bg-gradient-to-br ${PRESET_COLORS[key]} flex items-center justify-center mb-1.5 ${active ? 'shadow-lg' : 'opacity-70 group-hover:opacity-100'}`}>
                                                        <FontAwesomeIcon icon={PRESET_ICONS[key]} className="text-white text-xs" />
                                                    </div>
                                                    <span className={`text-[10px] font-bold block ${active ? 'text-white' : 'text-slate-400'}`}>{p.label}</span>
                                                    <span className="text-[8px] text-slate-500 block">{p.width}×{p.height}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Selected Preset Info */}
                                <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${PRESET_COLORS[category]} flex items-center justify-center`}>
                                            <FontAwesomeIcon icon={PRESET_ICONS[category]} className="text-white text-[10px]" />
                                        </div>
                                        <span className="text-sm font-bold text-white">{preset.label}</span>
                                        <span className="text-xs text-slate-500 ml-auto">{preset.width}×{preset.height}px</span>
                                    </div>
                                    <p className="text-xs text-slate-400">{preset.description}</p>
                                </div>

                                {/* === AI Generation Tab === */}
                                {panelTab === 'generate' && (<>
                                    {/* Character Reference Description (Conditional) */}
                                    {category === 'character' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-2"
                                        >
                                            <div className="flex items-center justify-between">
                                                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                                                    <FontAwesomeIcon icon={faUserAstronaut} /> 캐릭터 기본 설정 (일관성 유지용)
                                                </label>
                                                <div className="text-[10px] text-slate-500">일관되게 유지할 외형을 입력하세요</div>
                                            </div>
                                            <textarea
                                                className="w-full p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-sm text-white placeholder-slate-600 focus:ring-emerald-500 focus:border-emerald-500 min-h-[80px] resize-none"
                                                placeholder="예: 파란색 슈트를 입은 은발의 남성, 고글 착용, 사이버펑크 스타일..."
                                                value={charRef} onChange={e => setCharRef(e.target.value)} disabled={generating}
                                            />
                                        </motion.div>
                                    )}

                                    {/* Business Card Form */}
                                    {category === 'business-card' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-3 mb-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                                    <FontAwesomeIcon icon={faAddressCard} className="text-purple-400" /> 명함 기본 정보
                                                </label>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500">회사명</label>
                                                    <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500 placeholder-slate-600"
                                                        value={bizCompany} onChange={e => setBizCompany(e.target.value)} placeholder="ABC Corp" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500">직책</label>
                                                    <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500 placeholder-slate-600"
                                                        value={bizTitle} onChange={e => setBizTitle(e.target.value)} placeholder="CEO" />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500">이름</label>
                                                <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500 placeholder-slate-600"
                                                    value={bizName} onChange={e => setBizName(e.target.value)} placeholder="홍길동" />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500">연락처</label>
                                                    <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500 placeholder-slate-600"
                                                        value={bizPhone} onChange={e => setBizPhone(e.target.value)} placeholder="010-1234-5678" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-500">이메일</label>
                                                    <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500 placeholder-slate-600"
                                                        value={bizEmail} onChange={e => setBizEmail(e.target.value)} placeholder="user@company.com" />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500">주소 (선택)</label>
                                                <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500 placeholder-slate-600"
                                                    value={bizAddress} onChange={e => setBizAddress(e.target.value)} placeholder="서울시..." />
                                            </div>

                                            <div className="space-y-1.5 pt-2">
                                                <label className="text-[10px] font-bold text-slate-500">디자인 스타일</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {['Modern', 'Minimal', 'Luxury', 'Creative', 'Tech', 'Simple'].map(s => (
                                                        <button key={s} onClick={() => setBizStyle(s)}
                                                            className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${bizStyle === s ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Prompt Input */}
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                                            {category === 'character' ? '추가 상황/동작 입력' : category === 'business-card' ? '추가 요청사항 (선택)' : '이미지 설명'}
                                        </label>
                                        <textarea
                                            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-purple-500 focus:border-purple-500 min-h-[100px] resize-none"
                                            placeholder={category === 'character' ? '예: 숲속을 달리고 있는 모습, 웃고 있는 표정...' : category === 'business-card' ? '예: 배경에 은은한 기하학 패턴을 넣어주세요, 로고는 우측 상단에 배치...' : preset.promptHint}
                                            value={prompt} onChange={e => setPrompt(e.target.value)} disabled={generating}
                                        />
                                    </div>

                                    {/* Generate Button */}
                                    <button onClick={handleGenerate} disabled={generating || !prompt.trim()}
                                        className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${generating || !prompt.trim() ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/25 active:scale-[0.98]'}`}>
                                        {generating ? <><FontAwesomeIcon icon={faSpinner} spin /> 생성 중... (약 10-30초)</> : <><FontAwesomeIcon icon={faMagic} /> AI 이미지 생성</>}
                                    </button>

                                    {/* Error */}
                                    {genError && (
                                        <div className="p-3 bg-red-900/30 border border-red-800/50 rounded-xl text-xs text-red-300">
                                            <FontAwesomeIcon icon={faExclamationCircle} className="mr-1.5" />{genError}
                                        </div>
                                    )}

                                    {/* Preview */}
                                    {previewBase64 && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                            <div className="relative rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                                                <img src={`data:${previewMime};base64,${previewBase64}`} alt="AI Preview"
                                                    className="w-full object-contain max-h-[250px]" />
                                                <div className="absolute top-2 right-2">
                                                    <span className="px-2 py-1 bg-green-500/90 text-white text-[10px] font-bold rounded-full backdrop-blur-sm">생성 완료</span>
                                                </div>
                                            </div>

                                            {/* Save form */}
                                            <div className="space-y-2">
                                                <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-purple-500"
                                                    placeholder="이미지 이름 (선택사항)" value={saveName} onChange={e => setSaveName(e.target.value)} />
                                                <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-purple-500"
                                                    placeholder="태그: 쉼표로 구분 (선택사항)" value={saveTags} onChange={e => setSaveTags(e.target.value)} />
                                            </div>

                                            <div className="flex gap-2">
                                                <button onClick={handleSave} disabled={saving}
                                                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]">
                                                    {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />} 갤러리에 저장
                                                </button>
                                                <button onClick={() => { setPreviewBase64(null); setGenError(null); }}
                                                    className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors">
                                                    <FontAwesomeIcon icon={faTimes} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </>)}

                                {/* === File Upload Tab === */}
                                {panelTab === 'upload' && (<>
                                    {/* Drop Zone */}
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={e => e.preventDefault()}
                                        onClick={() => document.getElementById('gallery-file-input')?.click()}
                                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${uploadPreview ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-700 hover:border-slate-500 bg-slate-800/30'}`}
                                    >
                                        {uploadPreview ? (
                                            <div className="space-y-2">
                                                <img src={uploadPreview} alt="Upload preview" className="max-h-[200px] mx-auto rounded-lg object-contain" />
                                                <p className="text-xs text-slate-400">{uploadFile?.name}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <FontAwesomeIcon icon={faUpload} className="text-3xl text-slate-500" />
                                                <p className="text-sm text-slate-400">클릭하거나 파일을 드래그하세요</p>
                                                <p className="text-xs text-slate-500">PNG, JPG, SVG, WebP</p>
                                            </div>
                                        )}
                                        <input id="gallery-file-input" type="file" accept="image/*" className="hidden"
                                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                                    </div>

                                    {/* Upload form */}
                                    <div className="space-y-2">
                                        <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-purple-500"
                                            placeholder="이미지 이름 (선택사항)" value={uploadName} onChange={e => setUploadName(e.target.value)} />
                                        <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-purple-500"
                                            placeholder="태그: 쉼표로 구분 (선택사항)" value={uploadTags} onChange={e => setUploadTags(e.target.value)} />
                                    </div>

                                    <button onClick={handleUpload} disabled={uploading || !uploadFile}
                                        className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${uploading || !uploadFile ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-indigo-600/25 active:scale-[0.98]'}`}>
                                        {uploading ? <><FontAwesomeIcon icon={faSpinner} spin /> 업로드 중...</> : <><FontAwesomeIcon icon={faUpload} /> 갤러리에 업로드</>}
                                    </button>

                                    {uploadPreview && (
                                        <button onClick={() => { setUploadFile(null); setUploadPreview(null); setUploadName(''); setUploadTags(''); }}
                                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold transition-colors">
                                            <FontAwesomeIcon icon={faTimes} className="mr-1" /> 초기화
                                        </button>
                                    )}
                                </>)}
                            </div>
                        </motion.aside>
                    )}
                </AnimatePresence>

                {/* Gallery */}
                <main className="flex-1 p-6 overflow-y-auto min-h-screen">
                    {/* Filter Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6 items-center">
                        {FILTER_TABS.map(tab => (
                            <button key={tab.key} onClick={() => setFilterCategory(tab.key)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterCategory === tab.key ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/50'}`}>
                                {tab.label}
                                {tab.key !== 'all' && (
                                    <span className="ml-1.5 text-[10px] opacity-60">
                                        {images.filter(i => tab.key === 'kakao-square' ? (i.category === 'kakao-square' || i.category === 'kakao-wide') : i.category === tab.key).length}
                                    </span>
                                )}
                            </button>
                        ))}
                        {customCategories.map(cc => (
                            <button key={cc.key} onClick={() => setFilterCategory(cc.key as ImageCategory)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterCategory === cc.key ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/50'}`}>
                                {cc.label}
                                <span className="ml-1.5 text-[10px] opacity-60">
                                    {images.filter(i => i.category === cc.key as ImageCategory).length}
                                </span>
                            </button>
                        ))}
                        <button onClick={() => setShowCategoryModal(true)}
                            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/50 flex items-center justify-center transition-all"
                            title="카테고리 관리">
                            <FontAwesomeIcon icon={faCog} className="text-xs" />
                        </button>
                    </div>

                    {/* Image Grid */}
                    {loading && images.length === 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
                            {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    ) : filteredImages.length > 0 ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
                                {filteredImages.map((img, idx) => (
                                    <motion.div
                                        key={img.fullPath}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: (idx % 12) * 0.05 }}
                                        layoutId={img.fullPath}
                                        onClick={() => setSelectedImage(img)}
                                        className="group relative bg-slate-900 rounded-2xl border border-slate-800/50 overflow-hidden cursor-pointer hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-900/10 transition-all active:scale-[0.98]"
                                    >
                                        <div className="aspect-square bg-slate-950 overflow-hidden">
                                            <img
                                                src={img.url}
                                                alt={img.name}
                                                loading="lazy"
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                                <p className="text-white text-xs font-bold truncate">{img.customName || img.name}</p>
                                                <p className="text-slate-400 text-[10px] mt-1">#{(IMAGE_PRESETS[img.category] || { label: img.category }).label}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Load More */}
                            {hasMore && (
                                <div className="mt-12 flex justify-center">
                                    <button
                                        onClick={() => loadImages(true)}
                                        disabled={fetchingMore}
                                        className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold border border-slate-700 transition-all hover:border-purple-500/50 flex items-center gap-2"
                                    >
                                        {fetchingMore ? (
                                            <><FontAwesomeIcon icon={faSpinner} spin /> 가저오는 중...</>
                                        ) : (
                                            '더 보기'
                                        )}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <FontAwesomeIcon icon={faImages} className="text-5xl mb-4 opacity-20" />
                            <p>저장된 이미지가 없습니다.</p>
                        </div>
                    )}
                </main>
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <ImageDetailModal
                        image={selectedImage}
                        onClose={() => setSelectedImage(null)}
                        onDelete={handleDelete}
                        onUpdate={handleUpdate}
                        onApplyFavicon={handleApplyFavicon}
                        onApplyLogo={handleApplyLogo}
                    />
                )}
            </AnimatePresence>

            {/* Category Management Modal */}
            <AnimatePresence>
                {showCategoryModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)} />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-lg bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <FontAwesomeIcon icon={faCog} className="text-slate-400" /> 카테고리 관리
                                    </h3>
                                    <button onClick={() => setShowCategoryModal(false)}
                                        className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all">
                                        <FontAwesomeIcon icon={faTimes} />
                                    </button>
                                </div>

                                {/* Existing Custom Categories */}
                                {customCategories.length > 0 && (
                                    <div className="space-y-2 mb-5">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">등록된 카테고리</label>
                                        {customCategories.map(cc => (
                                            <div key={cc.key} className="flex items-center gap-3 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                                                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cc.color} flex items-center justify-center flex-none`}>
                                                    <FontAwesomeIcon icon={faCube} className="text-white text-xs" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">{cc.label}</p>
                                                    <p className="text-[10px] text-slate-500">{cc.width}×{cc.height}px · {cc.description}</p>
                                                </div>
                                                <button onClick={() => handleDeleteCategory(cc.key)}
                                                    className="w-7 h-7 rounded-lg bg-red-900/30 hover:bg-red-800/50 text-red-400 hover:text-red-300 flex items-center justify-center transition-colors flex-none">
                                                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add New Category */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">새 카테고리 추가</label>
                                    <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-purple-500 focus:border-purple-500"
                                        placeholder="카테고리 이름" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">가로 (px)</label>
                                            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500"
                                                value={newCatWidth} onChange={e => setNewCatWidth(Number(e.target.value))} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-500 mb-1">세로 (px)</label>
                                            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500 focus:border-purple-500"
                                                value={newCatHeight} onChange={e => setNewCatHeight(Number(e.target.value))} />
                                        </div>
                                    </div>
                                    <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-purple-500 focus:border-purple-500"
                                        placeholder="설명 (선택사항)" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} />
                                    <div>
                                        <label className="block text-[10px] text-slate-500 mb-1.5">색상</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {GRADIENT_OPTIONS.map(g => (
                                                <button key={g} onClick={() => setNewCatColor(g)}
                                                    className={`w-8 h-8 rounded-lg bg-gradient-to-br ${g} transition-all ${newCatColor === g ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-60 hover:opacity-100'}`} />
                                            ))}
                                        </div>
                                    </div>
                                    <button onClick={handleAddCategory} disabled={!newCatLabel.trim()}
                                        className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${!newCatLabel.trim() ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500'}`}>
                                        <FontAwesomeIcon icon={faPlus} /> 카테고리 추가
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AiImageGalleryPage;
