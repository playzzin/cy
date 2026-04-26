import React, { useEffect, useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faPaperPlane, faEnvelope, faBell, faBullhorn, faLink, faPlus, faTrash, faSpinner, faCheckCircle, faExclamationCircle, faUpload, faMagic, faImages, faSave, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { UniversalRecipientSelector, Recipient } from '../../components/kakao/UniversalRecipientSelector';
import { kakaoService, AlimTalkRequest, FriendTalkRequest, KakaoResponse } from '../../services/newKakaoService';
import { storage } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateImage, saveGeneratedImage, listSavedImages, deleteSavedImage, IMAGE_SPECS, KakaoImageSpec, SavedImage } from '../../services/geminiImageService';

// --- Types ---
type SendMode = 'ALIMTALK' | 'FRIENDTALK';


interface KakaoChannelRaw {
    [key: string]: unknown;
    ChannelId?: unknown;
    channelId?: unknown;
    ChannelName?: unknown;
    channelName?: unknown;
    PhoneNum?: unknown;
    phoneNum?: unknown;
    SenderNum?: unknown;
    senderNum?: unknown;
    CallBackNum?: unknown;
    callBackNum?: unknown;
    ProfileImageUrl?: unknown;
    profileImageUrl?: unknown;
    ImageUrl?: unknown;
    imageUrl?: unknown;
    LogoUrl?: unknown;
    logoUrl?: unknown;
    Name?: unknown;
    name?: unknown;
}

interface KakaoTemplateRaw {
    [key: string]: unknown;
    TemplateCode?: unknown;
    templateCode?: unknown;
    TemplateName?: unknown;
    templateName?: unknown;
    TemplateContent?: unknown;
    templateContent?: unknown;
    Buttons?: unknown;
    buttons?: unknown;
    Status?: unknown;
    status?: unknown;
}


interface ButtonConfig {
    name: string;
    buttonType: 'WL' | 'AL' | 'AC' | 'DS' | 'BK' | 'MD'; // Web Link, App Link, Channel Add, Delivery Status, Legacy
    url1?: string; // Mobile
    url2?: string; // PC
}

type FriendTalkType = 'TEXT' | 'IMAGE' | 'WIDE';

interface FtImage {
    imgUrl: string;
    imgLink?: string;
}

interface SendResultLog {
    recipientName: string;
    phone: string;
    receiptNum?: string;
    success: boolean;
    message: string;
}

type IssuanceTemplateCategoryKey = 'TAX_INVOICE' | 'PAYSLIP' | 'TEAM_SETTLEMENT' | 'LABOR_COST_BILLING';

type IssuanceTemplateMapping = Partial<Record<IssuanceTemplateCategoryKey, string>>;

const ISSUANCE_TEMPLATE_CATEGORIES: Array<{ key: IssuanceTemplateCategoryKey; label: string; keywords: string[] }> = [
    { key: 'TAX_INVOICE', label: '계산서 발행', keywords: ['세금계산서', '계산서', 'TAX_INVOICE'] },
    { key: 'PAYSLIP', label: '급여명세서', keywords: ['급여명세서', 'PAYSLIP'] },
    { key: 'TEAM_SETTLEMENT', label: '팀정산내역서', keywords: ['팀정산', '정산내역서', 'TEAM_SETTLEMENT'] },
    { key: 'LABOR_COST_BILLING', label: '노무비청구서', keywords: ['노무비', '청구서', 'LABOR_COST'] }
];

const ISSUANCE_TEMPLATE_DRAFTS: Record<IssuanceTemplateCategoryKey, { title: string; content: string }> = {
    TAX_INVOICE: {
        title: '세금계산서 발행 안내',
        content: `안녕하세요, #{companyName} 담당자님.

#{senderName}에서 세금계산서를 발행했습니다.

■ 발행일: #{invoiceDate}
■ 합계금액: #{totalAmount}원
■ 세금계산서번호: #{invoiceNum}

확인 부탁드립니다.
문의: #{contactPhone}`
    },
    PAYSLIP: {
        title: '급여명세서 발행 안내',
        content: `안녕하세요, #{workerName}님.

#{senderName}에서 급여명세서를 발행했습니다.

■ 대상월: #{yearMonth}
■ 지급총액: #{grossPay}원
■ 공제합계: #{deductions}원
■ 실지급액: #{netPay}원

확인 부탁드립니다.
문의: #{contactPhone}`
    },
    TEAM_SETTLEMENT: {
        title: '팀정산 내역서 발행 안내',
        content: `안녕하세요, #{teamName} 담당자님.

#{senderName}에서 팀정산 내역서를 발행했습니다.

■ 정산월: #{yearMonth}
■ 매출합계: #{salesTotal}원
■ 매입합계: #{purchasesTotal}원
■ 공제합계: #{deductionsTotal}원
■ 추가합계: #{additionsTotal}원
■ 정산잔액: #{net}원

확인 부탁드립니다.
문의: #{contactPhone}`
    },
    LABOR_COST_BILLING: {
        title: '노무비 청구서 발행 안내',
        content: `안녕하세요, #{companyName} 담당자님.

#{senderName}에서 노무비 청구서를 발행했습니다.

■ 대상월: #{yearMonth}
■ 현장: #{siteName}
■ 청구금액: #{amount}원
■ 납부기한: #{dueDate}

확인 부탁드립니다.
문의: #{contactPhone}`
    }
};

const getTemplateCode = (t: unknown): string => {
    if (!t || typeof t !== 'object') return '';
    const r = t as Record<string, unknown>;
    return String(r.TemplateCode ?? r.templateCode ?? '').trim();
};

const getTemplateName = (t: unknown): string => {
    if (!t || typeof t !== 'object') return '';
    const r = t as Record<string, unknown>;
    return String(r.TemplateName ?? r.templateName ?? '').trim();
};

const getChannelDisplayName = (c: KakaoChannelRaw): string => {
    const name = String(c.ChannelName ?? c.channelName ?? c.Name ?? c.name ?? '').trim();
    const id = String(c.ChannelId ?? c.channelId ?? '').trim();
    return name || id || '채널';
};

const matchIssuanceCategory = (templateName: string): IssuanceTemplateCategoryKey | null => {
    const name = String(templateName ?? '').trim();
    if (!name) return null;
    for (const cat of ISSUANCE_TEMPLATE_CATEGORIES) {
        if (cat.keywords.some((k) => name.includes(k))) return cat.key;
    }
    return null;
};

const extractTemplateButtons = (tmpl: unknown): ButtonConfig[] => {
    if (!tmpl || typeof tmpl !== 'object') return [];
    const record = tmpl as Record<string, unknown>;
    const rawButtons = record.Buttons ?? record.buttons;
    if (!rawButtons || typeof rawButtons !== 'object') return [];
    const rawRecord = rawButtons as Record<string, unknown>;
    const kakaoButtonRaw = rawRecord.KakaotalkButton ?? rawRecord.kakaotalkButton;
    const arr = Array.isArray(kakaoButtonRaw) ? kakaoButtonRaw : (kakaoButtonRaw && typeof kakaoButtonRaw === 'object' ? [kakaoButtonRaw] : []);
    return arr
        .filter((b) => b && typeof b === 'object')
        .map((b) => b as Record<string, unknown>)
        .map((b) => ({
            name: String(b.Name ?? b.name ?? ''),
            buttonType: String(b.ButtonType ?? b.buttonType ?? 'WL') as ButtonConfig['buttonType'],
            url1: typeof b.Url1 === 'string' ? b.Url1 : (typeof b.url1 === 'string' ? b.url1 : undefined),
            url2: typeof b.Url2 === 'string' ? b.Url2 : (typeof b.url2 === 'string' ? b.url2 : undefined)
        }))
        .filter((b) => b.name && b.buttonType);
};

// --- Helper: Parse Template Variables ---
const parseTemplateVariables = (templateContent: string): string[] => {
    const regex = /#\{([^}]+)\}/g;
    const vars = new Set<string>();
    let match;
    while ((match = regex.exec(templateContent)) !== null) {
        vars.add(match[1]);
    }
    return Array.from(vars);
};

const KakaoMessageCenterPage: React.FC = () => {
    // --- State: Layout & Mode ---
    const [mode, setMode] = useState<SendMode>('ALIMTALK');
    const [loadingInit, setLoadingInit] = useState(true);

    // --- State: Recipients ---
    const [recipients, setRecipients] = useState<Recipient[]>([]);

    // --- State: Common ---
    const [channels, setChannels] = useState<KakaoChannelRaw[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');
    const [selectedChannelPhone, setSelectedChannelPhone] = useState<string>('');
    const [selectedChannelLogo, setSelectedChannelLogo] = useState<string>('');
    const [configuredSenderNum, setConfiguredSenderNum] = useState<string>('');
    const [sending, setSending] = useState(false);
    const [results, setResults] = useState<SendResultLog[]>([]);

    // --- State: AlimTalk ---
    const [templates, setTemplates] = useState<KakaoTemplateRaw[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>('');
    const [selectedTemplate, setSelectedTemplate] = useState<KakaoTemplateRaw | null>(null);
    const [templateVars, setTemplateVars] = useState<Record<string, string>>({});

    const [issuanceTemplateMapping, setIssuanceTemplateMapping] = useState<IssuanceTemplateMapping>({});

    // --- State: Preview As ---
    const [previewRecipientId, setPreviewRecipientId] = useState<string>('');

    // --- State: FriendTalk ---
    const [ftType, setFtType] = useState<FriendTalkType>('TEXT');
    const [ftContent, setFtContent] = useState('');
    const [ftButtons, setFtButtons] = useState<ButtonConfig[]>([]);
    const [ftImage, setFtImage] = useState<FtImage>({ imgUrl: '', imgLink: '' });

    const [uploading, setUploading] = useState(false);

    // --- State: AI Image Generation ---
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiSpec, setAiSpec] = useState<KakaoImageSpec>('SQUARE');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiPreviewBase64, setAiPreviewBase64] = useState<string | null>(null);
    const [aiPreviewMime, setAiPreviewMime] = useState<string>('image/png');
    const [aiSaving, setAiSaving] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // --- State: Saved Image Gallery ---
    const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [imageTab, setImageTab] = useState<'upload' | 'ai' | 'gallery'>('upload');

    // --- Image Upload Handler ---
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const storageRef = ref(storage, `kakao/friendtalk/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);

            setFtImage(prev => ({ ...prev, imgUrl: url }));
            Swal.fire({
                icon: 'success',
                title: '업로드 성공',
                text: '이미지가 성공적으로 등록되었습니다.',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Image Upload Error:', error);
            Swal.fire('오류', '이미지 업로드에 실패했습니다.', 'error');
        } finally {
            setUploading(false);
            // Reset the input value to allow re-uploading the same file if needed
            e.target.value = '';
        }
    };

    // --- AI Image Generation Handler ---
    const handleAiGenerate = async () => {
        if (!aiPrompt.trim()) {
            Swal.fire('알림', '이미지 설명을 입력해주세요.', 'warning');
            return;
        }
        setAiGenerating(true);
        setAiError(null);
        setAiPreviewBase64(null);
        try {
            const result = await generateImage(aiPrompt, aiSpec);
            if (result.success && result.imageBase64) {
                setAiPreviewBase64(result.imageBase64);
                setAiPreviewMime(result.mimeType || 'image/png');
            } else {
                setAiError(result.error || '이미지 생성에 실패했습니다.');
            }
        } catch (err) {
            setAiError(err instanceof Error ? err.message : '알 수 없는 오류');
        } finally {
            setAiGenerating(false);
        }
    };

    // --- Save AI Generated Image ---
    const handleAiSave = async () => {
        if (!aiPreviewBase64) return;
        setAiSaving(true);
        try {
            const result = await saveGeneratedImage(aiPreviewBase64, aiPreviewMime, aiSpec, aiPrompt);
            if (result.success && result.url) {
                setFtImage(prev => ({ ...prev, imgUrl: result.url! }));
                Swal.fire({ icon: 'success', title: '저장 완료', text: '이미지가 저장되고 자동 적용되었습니다.', timer: 1500, showConfirmButton: false });
                setAiPreviewBase64(null);
                setAiPrompt('');
                // Refresh gallery
                loadSavedImages();
            } else {
                Swal.fire('오류', result.error || '저장 실패', 'error');
            }
        } catch (err) {
            Swal.fire('오류', '저장 중 오류가 발생했습니다.', 'error');
        } finally {
            setAiSaving(false);
        }
    };

    // --- Use AI Preview directly (without saving) ---
    const handleAiUseDirectly = () => {
        if (!aiPreviewBase64) return;
        const dataUrl = `data:${aiPreviewMime};base64,${aiPreviewBase64}`;
        setFtImage(prev => ({ ...prev, imgUrl: dataUrl }));
        Swal.fire({ icon: 'info', title: '임시 적용', text: '프리뷰에 적용했습니다. 발송 전 "저장 후 적용"을 권장합니다.', timer: 2000, showConfirmButton: false });
    };

    // --- Load Saved Images ---
    const loadSavedImages = async () => {
        setGalleryLoading(true);
        try {
            const images = await listSavedImages();
            setSavedImages(images);
        } finally {
            setGalleryLoading(false);
        }
    };

    // --- Select from Gallery ---
    const handleGallerySelect = (img: SavedImage) => {
        setFtImage(prev => ({ ...prev, imgUrl: img.url }));
        Swal.fire({ icon: 'success', title: '이미지 적용', text: `${img.name} 선택됨`, timer: 1200, showConfirmButton: false });
    };

    // --- Delete from Gallery ---
    const handleGalleryDelete = async (img: SavedImage) => {
        const confirm = await Swal.fire({
            title: '이미지 삭제',
            text: `"${img.name}"을 삭제하시겠습니까?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소',
            confirmButtonColor: '#ef4444'
        });
        if (!confirm.isConfirmed) return;
        const ok = await deleteSavedImage(img.fullPath);
        if (ok) {
            setSavedImages(prev => prev.filter(i => i.fullPath !== img.fullPath));
            if (ftImage.imgUrl === img.url) {
                setFtImage(prev => ({ ...prev, imgUrl: '' }));
            }
        } else {
            Swal.fire('오류', '삭제에 실패했습니다.', 'error');
        }
    };

    // Auto-sync aiSpec with ftType
    useEffect(() => {
        setAiSpec(ftType === 'WIDE' ? 'WIDE' : 'SQUARE');
    }, [ftType]);

    // Load gallery when switching to gallery tab
    useEffect(() => {
        if (imageTab === 'gallery' && savedImages.length === 0) {
            loadSavedImages();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageTab]);

    const handleOpenIssuanceDraftPicker = async () => {
        const options: Record<string, string> = {};
        ISSUANCE_TEMPLATE_CATEGORIES.forEach((c) => {
            options[c.key] = c.label;
        });

        const picked = await Swal.fire({
            title: '발행 템플릿 초안',
            text: '바로빌 템플릿 관리에 등록할 문구 초안입니다. 템플릿 변수(#{...})는 등록 시 동일하게 맞춰주세요.',
            icon: 'info',
            input: 'select',
            inputOptions: options,
            inputPlaceholder: '문서 종류 선택',
            showCancelButton: true,
            confirmButtonText: '다음',
            cancelButtonText: '닫기'
        });

        const key = typeof picked.value === 'string' ? picked.value.trim() : '';
        if (!picked.isConfirmed || !key) return;
        if (!(key in ISSUANCE_TEMPLATE_DRAFTS)) return;

        const draftKey = key as IssuanceTemplateCategoryKey;
        const draft = ISSUANCE_TEMPLATE_DRAFTS[draftKey];

        const copy = await Swal.fire({
            title: `${options[draftKey]} 초안`,
            input: 'textarea',
            inputValue: draft.content,
            inputAttributes: {
                rows: '14'
            },
            showCancelButton: true,
            confirmButtonText: '클립보드 복사',
            cancelButtonText: '닫기'
        });

        if (!copy.isConfirmed) return;
        const text = typeof copy.value === 'string' ? copy.value : draft.content;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                Swal.fire('복사 완료', '클립보드에 복사했습니다. 바로빌 템플릿 관리에 붙여넣기 하세요.', 'success');
                return;
            }
        } catch {
            // fallthrough
        }

        Swal.fire('안내', '자동 복사가 지원되지 않습니다. 텍스트 영역에서 직접 복사해서 사용해주세요.', 'info');
    };

    const issuanceMappingStorageKey = useMemo(() => {
        const channelId = typeof selectedChannelId === 'string' ? selectedChannelId.trim() : '';
        return channelId ? `kakao_issuance_template_mapping__${channelId}` : 'kakao_issuance_template_mapping__default';
    }, [selectedChannelId]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(issuanceMappingStorageKey);
            if (!raw) {
                setIssuanceTemplateMapping({});
                return;
            }
            const parsed = JSON.parse(raw) as unknown;
            if (!parsed || typeof parsed !== 'object') {
                setIssuanceTemplateMapping({});
                return;
            }
            const record = parsed as Record<string, unknown>;
            const next: IssuanceTemplateMapping = {};
            (Object.keys(record) as IssuanceTemplateCategoryKey[]).forEach((k) => {
                const v = record[k];
                if (typeof v === 'string' && v.trim()) next[k] = v.trim();
            });
            setIssuanceTemplateMapping(next);
        } catch {
            setIssuanceTemplateMapping({});
        }
    }, [issuanceMappingStorageKey]);

    const saveIssuanceTemplateMapping = (next: IssuanceTemplateMapping) => {
        setIssuanceTemplateMapping(next);
        try {
            localStorage.setItem(issuanceMappingStorageKey, JSON.stringify(next));
        } catch {
            // ignore
        }
    };

    const handleOpenTemplateManagement = async () => {
        try {
            const res = await kakaoService.getManagementUrl('TEMPLATE');
            if (res.success && res.url) {
                window.open(res.url, '_blank', 'width=1000,height=800');
                return;
            }
            Swal.fire('오류', res.message || '템플릿 관리 페이지 URL을 가져오지 못했습니다.', 'error');
        } catch (error) {
            const message = error instanceof Error ? error.message : '템플릿 관리 페이지를 열지 못했습니다.';
            Swal.fire('오류', message, 'error');
        }
    };

    const templatesSorted = useMemo(() => {
        const list = Array.isArray(templates) ? templates : [];
        const used = new Set<string>();
        const prioritized: KakaoTemplateRaw[] = [];

        ISSUANCE_TEMPLATE_CATEGORIES.forEach((cat) => {
            list.forEach((t) => {
                const name = getTemplateName(t);
                const code = getTemplateCode(t);
                if (!code) return;
                if (used.has(code)) return;
                const isMatch = cat.keywords.some((k) => name.includes(k));
                if (!isMatch) return;
                used.add(code);
                prioritized.push(t);
            });
        });

        const rest = list.filter((t) => {
            const code = getTemplateCode(t);
            if (!code) return true;
            return !used.has(code);
        });

        return [...prioritized, ...rest];
    }, [templates]);

    const handleSelectIssuanceTemplate = async (categoryKey: IssuanceTemplateCategoryKey) => {
        const cat = ISSUANCE_TEMPLATE_CATEGORIES.find((x) => x.key === categoryKey);
        const mappedCode = typeof issuanceTemplateMapping[categoryKey] === 'string' ? issuanceTemplateMapping[categoryKey]!.trim() : '';

        const mapped = mappedCode
            ? (templatesSorted ?? []).find((t) => getTemplateCode(t) === mappedCode)
            : null;

        const matchedByKeyword = (templatesSorted ?? []).find((t) => {
            const name = getTemplateName(t);
            return (cat?.keywords ?? []).some((k) => name.includes(k));
        });

        const matched = mapped ?? matchedByKeyword ?? null;

        if (!matched) {
            const templateOptions: Record<string, string> = {};
            (templatesSorted ?? []).forEach((t) => {
                const code = getTemplateCode(t);
                const name = getTemplateName(t);
                if (!code) return;
                templateOptions[code] = name || code;
            });

            const picked = await Swal.fire({
                title: `${cat?.label ?? '발행 템플릿'} 지정`,
                text: '해당 문서 발행에 사용할 승인 템플릿을 1회 지정하면, 다음부터는 버튼으로 바로 선택됩니다.',
                icon: 'question',
                input: 'select',
                inputOptions: templateOptions,
                inputPlaceholder: '템플릿 선택',
                showCancelButton: true,
                confirmButtonText: '지정',
                cancelButtonText: '취소'
            });

            const selectedCode = typeof picked.value === 'string' ? picked.value.trim() : '';
            if (!picked.isConfirmed || !selectedCode) {
                const result = await Swal.fire({
                    title: '발행 템플릿 없음',
                    text: `${cat?.label ?? '발행 템플릿'}에 해당하는 승인 템플릿을 찾지 못했습니다. 바로빌 템플릿 관리에서 등록/승인 후 다시 불러오기(새로고침) 해주세요.`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: '템플릿 관리 열기',
                    cancelButtonText: '닫기'
                });
                if (result.isConfirmed) {
                    await handleOpenTemplateManagement();
                }
                return;
            }

            saveIssuanceTemplateMapping({ ...issuanceTemplateMapping, [categoryKey]: selectedCode });
            handleTemplateChange(selectedCode);
            return;
        }

        const code = getTemplateCode(matched);
        if (!code) return;
        if (mappedCode && code !== mappedCode) {
            saveIssuanceTemplateMapping({ ...issuanceTemplateMapping, [categoryKey]: code });
        }
        handleTemplateChange(code);
    };

    // --- Init ---
    useEffect(() => {
        const init = async () => {
            try {
                const res = await kakaoService.getChannels();
                if (res.success && res.channels) {
                    console.log('[KakaoMessageCenter] Channels loaded:', res.channels);
                    setChannels(res.channels);
                    if (res.channels.length > 0) {
                        const ch = res.channels[0];
                        console.log('[KakaoMessageCenter] First channel keys:', Object.keys(ch));
                        console.log('[KakaoMessageCenter] First channel data:', ch);

                        const firstId = String(ch.ChannelId || ch.channelId || '');
                        const firstPhone = String(ch.PhoneNum || ch.phoneNum || ch.SenderNum || ch.senderNum || ch.CallBackNum || ch.callBackNum || '');
                        const firstLogo = String(ch.ProfileImageUrl || ch.profileImageUrl || ch.ImageUrl || ch.imageUrl || ch.LogoUrl || ch.logoUrl || '');

                        console.log('[KakaoMessageCenter] Extracted:', { firstId, firstPhone, firstLogo });

                        setSelectedChannelId(firstId);
                        setSelectedChannelPhone(firstPhone);
                        setSelectedChannelLogo(firstLogo);
                    }
                }

                const senderRes = await kakaoService.getDefaultSmsSenderNum();
                if (senderRes.success && senderRes.senderNum) {
                    setConfiguredSenderNum(senderRes.senderNum);
                }
            } catch (e) {
                console.error(e);
                Swal.fire('오류', '채널 목록을 불러오지 못했습니다.', 'error');
            } finally {
                setLoadingInit(false);
            }
        };
        init();
    }, []);

    // --- Load Templates when Channel/Mode changes ---
    useEffect(() => {
        if (mode === 'ALIMTALK' && selectedChannelId) {
            setLoadingTemplates(true);
            kakaoService.getTemplates(selectedChannelId)
                .then(res => {
                    if (res.success && res.templates) {
                        setTemplates(res.templates);
                    } else {
                        setTemplates([]);
                    }
                })
                .catch(e => {
                    console.error(e);
                })
                .finally(() => setLoadingTemplates(false));
        }
    }, [mode, selectedChannelId]);

    // --- Handle Template Selection ---
    const handleTemplateChange = (code: string) => {
        setSelectedTemplateCode(code);
        const tmpl = templates.find((t) => getTemplateCode(t) === code) ?? null;
        setSelectedTemplate(tmpl);

        if (tmpl) {
            const content = String(tmpl.TemplateContent || tmpl.templateContent || '');
            const vars = parseTemplateVariables(content);
            const initialVarState: Record<string, string> = {};
            vars.forEach(v => initialVarState[v] = '');
            setTemplateVars(initialVarState);
        } else {
            setTemplateVars({});
        }
    };

    // --- Auto Fill Variables from Preview Recipient ---
    const autoFillVariables = (recipient: Recipient) => {
        if (!recipient) return;
        setTemplateVars(prev => {
            const next = { ...prev };
            const keys = Object.keys(next);
            let changed = false;

            keys.forEach(key => {
                const k = key.replace(/\s+/g, ''); // remove spaces
                let value = '';

                if (['이름', '성명', 'name', '수신자', '받는사람'].some(x => k.includes(x))) {
                    value = recipient.name;
                } else if (['전화번호', '휴대폰', '연락처', 'phone', 'tel', 'mobile'].some(x => k.includes(x))) {
                    value = recipient.phone;
                } else if (['회사명', '업체명', 'company'].some(x => k.includes(x))) {
                    if (recipient.type === 'COMPANY') {
                        value = recipient.name;
                    } else if (recipient.originalData?.companyName) {
                        value = recipient.originalData.companyName;
                    }
                } else if (['팀명', '팀', 'team'].some(x => k.includes(x))) {
                    if (recipient.originalData?.teamName) {
                        value = recipient.originalData.teamName;
                    }
                }

                if (value) {
                    next[key] = value;
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    };

    useEffect(() => {
        if (!previewRecipientId) return;
        const recipient = recipients.find(r => r.id === previewRecipientId);
        if (recipient) {
            autoFillVariables(recipient);
        }
    }, [previewRecipientId, recipients, selectedTemplateCode]); // Re-run if template changes too


    // --- Render Content Preview ---
    const previewContent = useMemo(() => {
        if (mode === 'ALIMTALK') {
            if (!selectedTemplate) return '템플릿을 선택해주세요.';
            let content = String(selectedTemplate.TemplateContent || selectedTemplate.templateContent || '');
            Object.entries(templateVars).forEach(([key, val]) => {
                content = content.replace(new RegExp(`#{${key}}`, 'g'), val || `#{${key}}`);
            });
            return content;
        } else {
            if (ftType === 'TEXT') return ftContent || '내용을 입력해주세요.';
            if (ftType === 'IMAGE') return '(이미지 형식이 선택되었습니다)';
            if (ftType === 'WIDE') return '(와이드 이미지 형식이 선택되었습니다)';
            return '';
        }
    }, [mode, selectedTemplate, templateVars, ftContent, ftType]);

    const selectedTemplateButtons = useMemo(() => {
        if (mode !== 'ALIMTALK') return [];
        return extractTemplateButtons(selectedTemplate);
    }, [mode, selectedTemplate]);

    const selectedChannelName = useMemo(() => {
        const found = channels.find((c) => {
            const id = String(c?.ChannelId || c?.channelId || '');
            return id && id === selectedChannelId;
        });

        const name = found ? String(found?.ChannelName || found?.channelName || found?.Name || found?.name || '') : '';
        return name || '채널명';
    }, [channels, selectedChannelId]);

    // --- Sending Logic ---
    const handleSend = async () => {
        const getFriendTalkButtonNameMaxLen = (type: FriendTalkType): number => {
            if (type === 'WIDE') return 8;
            return 28;
        };

        if (recipients.length === 0) {
            Swal.fire('알림', '수신자를 선택해주세요.', 'warning');
            return;
        }
        if (!selectedChannelId) {
            Swal.fire('알림', '발신 채널을 선택해주세요.', 'warning');
            return;
        }

        if (mode === 'ALIMTALK') {
            if (!selectedTemplateCode) {
                Swal.fire('알림', '알림톡 템플릿을 선택해주세요.', 'warning');
                return;
            }
            const emptyVars = Object.entries(templateVars).filter(([_, v]) => !v.trim());
            if (emptyVars.length > 0) {
                Swal.fire('알림', `다음 변수 값을 입력해주세요: ${emptyVars.map(v => v[0]).join(', ')}`, 'warning');
                return;
            }
        } else {
            if (ftType === 'TEXT' && !ftContent.trim()) {
                Swal.fire('알림', '메시지 내용을 입력해주세요.', 'warning');
                return;
            }

            const trimmedFriendTalkContent = ftContent.trim();
            const friendTalkMaxLen = ftType === 'WIDE' ? 76 : ftType === 'IMAGE' ? 400 : 1000;
            if (trimmedFriendTalkContent.length > friendTalkMaxLen) {
                Swal.fire('알림', `친구톡 ${ftType === 'WIDE' ? '와이드 이미지형' : ftType === 'IMAGE' ? '이미지형' : '텍스트형'}은 최대 ${friendTalkMaxLen}자까지 가능합니다. (현재 ${trimmedFriendTalkContent.length}자)`, 'warning');
                return;
            }
            if ((ftType === 'IMAGE' || ftType === 'WIDE') && !ftImage.imgUrl) {
                Swal.fire('알림', '이미지 URL을 입력해주세요.', 'warning');
                return;
            }
            if ((ftType === 'IMAGE' || ftType === 'WIDE') && !ftContent.trim()) {
                Swal.fire('알림', ftType === 'WIDE' ? '와이드 이미지 메시지 내용을 입력해주세요.' : '이미지 메시지 내용을 입력해주세요.', 'warning');
                return;
            }

            if (ftButtons.length > 0) {
                const maxLen = getFriendTalkButtonNameMaxLen(ftType);
                const invalid = ftButtons.find((b) => (b?.name ?? '').trim().length > maxLen);
                if (invalid) {
                    Swal.fire('알림', `버튼명은 ${ftType === 'WIDE' ? '와이드 이미지형 기준' : '친구톡 기준'} 최대 ${maxLen}자까지 가능합니다.`, 'warning');
                    return;
                }

                const emptyName = ftButtons.find((b) => !(b?.name ?? '').trim());
                if (emptyName) {
                    Swal.fire('알림', '버튼명은 필수입니다.', 'warning');
                    return;
                }

                const emptyType = ftButtons.find((b) => !(b?.buttonType ?? '').trim());
                if (emptyType) {
                    Swal.fire('알림', '버튼 타입(ButtonType)은 필수입니다.', 'warning');
                    return;
                }

                const invalidUrl = ftButtons.find((b) => {
                    const t = (b?.buttonType ?? '').trim();
                    const url1 = (b?.url1 ?? '').trim();
                    const url2 = (b?.url2 ?? '').trim();
                    if (t !== 'WL') return true;
                    if (!url1) return true;
                    const isHttp = /^https?:\/\//i.test(url1);
                    const isHttp2 = !url2 || /^https?:\/\//i.test(url2);
                    return !isHttp || !isHttp2;
                });
                if (invalidUrl) {
                    Swal.fire('알림', '현재 친구톡 버튼은 WL(웹링크)만 지원합니다. WL은 모바일 URL(Url1)에 http/https 링크가 필수이며, PC URL(Url2)은 입력 시 http/https 링크여야 합니다.', 'warning');
                    return;
                }
            }
        }

        const confirm = await Swal.fire({
            title: `${mode === 'ALIMTALK' ? '알림톡' : '친구톡'} 발송`,
            text: `총 ${recipients.length}명에게 발송하시겠습니까?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '발송',
            cancelButtonText: '취소'
        });

        if (!confirm.isConfirmed) return;

        setSending(true);
        setResults([]);

        const templateButtons = mode === 'ALIMTALK' ? selectedTemplateButtons : [];

        try {
            const promises = recipients.map(async (recipient) => {
                let res: KakaoResponse;
                const cleanPhone = recipient.phone.replace(/-/g, '');

                if (mode === 'ALIMTALK') {
                    const req: AlimTalkRequest = {
                        to: cleanPhone,
                        templateCode: selectedTemplateCode,
                        templateName: String(selectedTemplate?.TemplateName || selectedTemplate?.templateName || ''),
                        content: previewContent,
                        receiverName: recipient.name,
                        ...(templateButtons.length > 0 ? { yellowId: selectedChannelId } : {}),
                        ...(templateButtons.length > 0 ? { buttons: templateButtons } : {}),
                    };
                    res = await kakaoService.sendAlimTalk(req);
                } else {
                    const friendTalkType = ftType;
                    const req: FriendTalkRequest = {
                        to: cleanPhone,
                        content: ftContent || '',
                        channelId: selectedChannelId,
                        receiverName: recipient.name,
                        adYN: true,
                        friendTalkType,
                        buttons: ftButtons.length > 0 ? ftButtons : undefined,
                        image: ftType === 'TEXT' ? undefined : ftImage,
                    };
                    res = await kakaoService.sendFriendTalk(req);
                }

                return {
                    recipientName: recipient.name,
                    phone: recipient.phone,
                    receiptNum: res.receiptNum,
                    success: res.success,
                    message: res.message
                };
            });

            const sentResults = await Promise.all(promises);
            setResults(sentResults);

            const successCount = sentResults.filter(r => r.success).length;
            const failCount = sentResults.length - successCount;

            Swal.fire('발송 완료', `성공: ${successCount}건, 실패: ${failCount}건`, failCount > 0 ? 'warning' : 'success');

        } catch (error) {
            console.error(error);
            Swal.fire('오류', '발송 중 시스템 오류가 발생했습니다.', 'error');
        } finally {
            setSending(false);
        }
    };

    if (loadingInit) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-yellow-500" />
                    <p className="text-gray-500 font-medium">카카오톡 서비스 연결 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-gray-100 overflow-hidden">
            <header className="flex-none bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-yellow-400 p-2 rounded-lg text-black">
                        <FontAwesomeIcon icon={faComments} className="text-xl" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">카카오톡 발송 센터 (Premium)</h1>
                        <p className="text-xs text-gray-500">알림톡 및 마케팅 친구톡 통합 발송</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <select
                            className="form-select text-sm border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                            value={selectedChannelId}
                            onChange={e => {
                                const selected = channels.find((c) => String(c?.ChannelId || c?.channelId || '') === e.target.value);
                                const phone = selected ? String(selected.PhoneNum || selected.phoneNum || selected.SenderNum || selected.senderNum || selected.CallBackNum || selected.callBackNum || '') : '';
                                const logo = selected ? String(selected.ProfileImageUrl || selected.profileImageUrl || selected.ImageUrl || selected.imageUrl || selected.LogoUrl || selected.logoUrl || '') : '';
                                setSelectedChannelId(e.target.value);
                                setSelectedChannelPhone(phone);
                                setSelectedChannelLogo(logo);
                            }}
                        >
                            {channels.length === 0 && <option value="">채널 없음</option>}
                            {channels.map((c) => {
                                const channelId = String(c.ChannelId || c.channelId || '');
                                const phone = String(c.PhoneNum || c.phoneNum || c.SenderNum || c.senderNum || c.CallBackNum || c.callBackNum || '');
                                const channelName = getChannelDisplayName(c);
                                return (
                                    <option key={channelId} value={channelId}>
                                        {channelName} {phone ? `(${phone})` : `(${channelId})`}
                                    </option>
                                );
                            })}
                        </select>
                        {selectedChannelPhone && (
                            <span className="text-xs text-gray-500 mt-1">발신번호: {selectedChannelPhone}</span>
                        )}
                        {!selectedChannelPhone && selectedChannelId && (
                            <span className="text-xs text-gray-400 mt-1">발신번호: 미제공(채널 API)</span>
                        )}
                        {configuredSenderNum && (
                            <span className="text-xs text-gray-500 mt-1">설정된 발신번호: {configuredSenderNum}</span>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                <aside className="w-[450px] flex-none p-6 flex flex-col min-h-0">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <FontAwesomeIcon icon={faEnvelope} className="text-blue-500" />
                        수신자 선택
                    </h2>
                    <div className="flex-1 min-h-0 bg-white rounded-xl shadow border border-gray-200">
                        <UniversalRecipientSelector onSelectionChange={setRecipients} />
                    </div>
                </aside>

                <main className="flex-1 p-6 overflow-y-auto min-w-0">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="flex bg-white p-1 rounded-xl shadow-sm border inline-flex w-full">
                            <button onClick={() => setMode('ALIMTALK')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'ALIMTALK' ? 'bg-yellow-400 text-black shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                                <FontAwesomeIcon icon={faBell} /> 알림톡 (정보성)
                            </button>
                            <button onClick={() => setMode('FRIENDTALK')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'FRIENDTALK' ? 'bg-yellow-400 text-black shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                                <FontAwesomeIcon icon={faBullhorn} /> 친구톡 (광고/마케팅)
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                {mode === 'ALIMTALK' ? (
                                    <>
                                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                            <h3 className="text-md font-bold text-gray-800 mb-4">템플릿 설정</h3>
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">공식 템플릿 선택</label>
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {ISSUANCE_TEMPLATE_CATEGORIES.map((cat) => (
                                                            <button
                                                                key={cat.key}
                                                                type="button"
                                                                className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                                                                onClick={() => {
                                                                    void handleSelectIssuanceTemplate(cat.key);
                                                                }}
                                                                disabled={loadingTemplates}
                                                            >
                                                                {cat.label}
                                                            </button>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                                                            onClick={() => {
                                                                void handleOpenTemplateManagement();
                                                            }}
                                                        >
                                                            <FontAwesomeIcon icon={faLink} /> 템플릿 관리
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                                                            onClick={() => {
                                                                void handleOpenIssuanceDraftPicker();
                                                            }}
                                                        >
                                                            발행 템플릿 초안
                                                        </button>
                                                    </div>
                                                    <select className="w-full border-gray-300 rounded-lg focus:ring-yellow-500" value={selectedTemplateCode} onChange={e => handleTemplateChange(e.target.value)} disabled={loadingTemplates}>
                                                        <option value="">템플릿 선택</option>
                                                        {templatesSorted.map((t) => {
                                                            const code = getTemplateCode(t);
                                                            const name = getTemplateName(t);
                                                            if (!code) return null;
                                                            const categoryKey = matchIssuanceCategory(name);
                                                            const categoryLabel = categoryKey
                                                                ? ISSUANCE_TEMPLATE_CATEGORIES.find((x) => x.key === categoryKey)?.label
                                                                : null;
                                                            const inactiveSuffix = (t.Status === 1 || t.status === 'Active') ? '' : ' (비활성)';
                                                            return (
                                                                <option key={code} value={code}>
                                                                    {categoryLabel ? `[${categoryLabel}] ` : ''}
                                                                    {name}
                                                                    {inactiveSuffix}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {selectedTemplate && (
                                            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border">
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h4 className="text-sm font-semibold text-gray-600">변수 입력</h4>
                                                        {recipients.length > 0 && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-gray-500">미리보기 대상:</span>
                                                                <select
                                                                    className="text-xs border-gray-300 rounded focus:ring-yellow-500 py-1"
                                                                    value={previewRecipientId}
                                                                    onChange={(e) => setPreviewRecipientId(e.target.value)}
                                                                >
                                                                    <option value="">직접 입력</option>
                                                                    {recipients.slice(0, 50).map(r => (
                                                                        <option key={r.id} value={r.id}>{r.name}</option>
                                                                    ))}
                                                                    {recipients.length > 50 && <option value="" disabled>...외 {recipients.length - 50}명</option>}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {Object.keys(templateVars).length === 0 ? (
                                                        <p className="text-xs text-gray-400">입력할 변수가 없는 템플릿입니다.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {Object.keys(templateVars).map(vKey => (
                                                                <div key={vKey}>
                                                                    <label className="block text-xs font-medium text-gray-500 mb-1">#{`{${vKey}}`}</label>
                                                                    <input type="text" className="w-full text-sm border-gray-300 rounded bg-white focus:ring-yellow-500" placeholder="내용 입력" value={templateVars[vKey]} onChange={e => setTemplateVars(prev => ({ ...prev, [vKey]: e.target.value }))} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                        <div className="flex items-center gap-2 mb-6 border-b pb-4">
                                            {['TEXT', 'IMAGE', 'WIDE'].map((t) => (
                                                <button
                                                    key={t}
                                                    onClick={() => setFtType(t as FriendTalkType)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${ftType === t ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                >
                                                    {t === 'TEXT' && '텍스트형'}
                                                    {t === 'IMAGE' && '이미지형(정사각/일반)'}
                                                    {t === 'WIDE' && '와이드 이미지형'}
                                                </button>
                                            ))}
                                        </div>

                                        {ftType === 'TEXT' && (
                                            <>
                                                <h3 className="text-md font-bold text-gray-800 mb-4">내용 작성</h3>
                                                <textarea className="w-full p-3 border border-gray-300 rounded-lg focus:ring-yellow-500 min-h-[200px]" placeholder="친구톡 내용을 입력하세요. (광고성 메시지 포함 가능)" value={ftContent} onChange={e => setFtContent(e.target.value)} />
                                                <p className="text-xs text-right text-gray-400 mt-1">{ftContent.length} / 1000자</p>

                                                <div className="mt-4 space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-sm font-medium text-gray-700">버튼 설정 (최대 5개)</label>
                                                        <button
                                                            onClick={() => {
                                                                if (ftButtons.length >= 5) return;
                                                                setFtButtons([...ftButtons, { name: '', buttonType: 'WL', url1: '' }]);
                                                            }}
                                                            className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                                                        >
                                                            <FontAwesomeIcon icon={faPlus} /> 버튼 추가
                                                        </button>
                                                    </div>
                                                    {ftButtons.map((btn, idx) => (
                                                        <div key={idx} className="p-3 bg-gray-50 rounded border flex flex-col gap-2">
                                                            <div className="flex gap-2">
                                                                <input
                                                                    className="flex-1 text-sm border-gray-300 rounded"
                                                                    placeholder="버튼명"
                                                                    value={btn.name}
                                                                    onChange={e => {
                                                                        const copy = [...ftButtons];
                                                                        copy[idx].name = e.target.value;
                                                                        setFtButtons(copy);
                                                                    }}
                                                                />
                                                                <select
                                                                    className="text-sm border-gray-300 rounded"
                                                                    value={btn.buttonType}
                                                                    onChange={e => {
                                                                        const copy = [...ftButtons];
                                                                        copy[idx].buttonType = e.target.value as ButtonConfig['buttonType'];
                                                                        setFtButtons(copy);
                                                                    }}
                                                                >
                                                                    <option value="WL">WL</option>
                                                                </select>
                                                                <button
                                                                    onClick={() => setFtButtons(ftButtons.filter((_, i) => i !== idx))}
                                                                    className="text-red-500 px-2"
                                                                >
                                                                    <FontAwesomeIcon icon={faTrash} />
                                                                </button>
                                                            </div>
                                                            <input
                                                                className="text-sm border-gray-300 rounded"
                                                                placeholder="모바일 URL (Url1)"
                                                                value={btn.url1}
                                                                onChange={e => {
                                                                    const copy = [...ftButtons];
                                                                    copy[idx].url1 = e.target.value;
                                                                    setFtButtons(copy);
                                                                }}
                                                            />
                                                            <input
                                                                className="text-sm border-gray-300 rounded"
                                                                placeholder="PC URL (Url2)"
                                                                value={btn.url2 ?? ''}
                                                                onChange={e => {
                                                                    const copy = [...ftButtons];
                                                                    copy[idx].url2 = e.target.value;
                                                                    setFtButtons(copy);
                                                                }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        {(ftType === 'IMAGE' || ftType === 'WIDE') && (
                                            <div className="space-y-4">
                                                <h3 className="text-md font-bold text-gray-800">{ftType === 'WIDE' ? '와이드 이미지 설정' : '이미지 설정'}</h3>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">메시지 내용</label>
                                                    <textarea
                                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-yellow-500 min-h-[140px]"
                                                        placeholder={ftType === 'WIDE' ? '와이드 이미지 친구톡 메시지 내용을 입력하세요.' : '이미지 친구톡 메시지 내용을 입력하세요.'}
                                                        value={ftContent}
                                                        onChange={e => setFtContent(e.target.value)}
                                                    />
                                                    <p className="text-xs text-right text-gray-400 mt-1">{ftContent.length} / 76자(권장)</p>
                                                </div>

                                                {/* === Image Source Tabs === */}
                                                <div className="border rounded-lg overflow-hidden">
                                                    <div className="flex bg-gray-50 border-b">
                                                        {([
                                                            { key: 'upload' as const, icon: faUpload, label: '직접 업로드' },
                                                            { key: 'ai' as const, icon: faMagic, label: 'AI 생성' },
                                                            { key: 'gallery' as const, icon: faImages, label: '저장된 이미지' }
                                                        ]).map(tab => (
                                                            <button
                                                                key={tab.key}
                                                                onClick={() => setImageTab(tab.key)}
                                                                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${imageTab === tab.key ? 'bg-white text-yellow-600 border-b-2 border-yellow-500' : 'text-gray-400 hover:text-gray-600'}`}
                                                            >
                                                                <FontAwesomeIcon icon={tab.icon} />
                                                                {tab.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="p-4">
                                                        {/* Tab: 직접 업로드 */}
                                                        {imageTab === 'upload' && (
                                                            <div className="space-y-3">
                                                                <label className="block text-xs font-medium text-gray-500">
                                                                    {ftType === 'WIDE'
                                                                        ? '이미지 URL (800x600 고정, 2MB 이하)'
                                                                        : '이미지 URL (가로 500px 이상, 720x720 권장, 500KB 이하)'}
                                                                </label>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        className="flex-1 text-sm border-gray-300 rounded focus:ring-yellow-500"
                                                                        placeholder="https://..."
                                                                        value={ftImage.imgUrl}
                                                                        onChange={e => setFtImage({ ...ftImage, imgUrl: e.target.value })}
                                                                    />
                                                                    <div className="relative">
                                                                        <input
                                                                            type="file"
                                                                            id="ft-image-upload"
                                                                            className="hidden"
                                                                            accept="image/*"
                                                                            onChange={handleImageUpload}
                                                                            disabled={uploading}
                                                                        />
                                                                        <label
                                                                            htmlFor="ft-image-upload"
                                                                            className={`flex items-center gap-2 px-4 py-2 rounded border text-sm font-bold cursor-pointer transition-colors ${uploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                                                        >
                                                                            {uploading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUpload} />}
                                                                            <span className="hidden sm:inline">업로드</span>
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                                {ftImage.imgUrl && (
                                                                    <div className="mt-2">
                                                                        <img src={ftImage.imgUrl} alt="현재 이미지" className="max-h-32 rounded border object-contain" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Tab: AI 생성 */}
                                                        {imageTab === 'ai' && (
                                                            <div className="space-y-3">
                                                                <div className="flex gap-2">
                                                                    <div className="flex-1">
                                                                        <label className="block text-xs font-medium text-gray-500 mb-1">이미지 규격</label>
                                                                        <div className="flex gap-2">
                                                                            {(['SQUARE', 'WIDE'] as KakaoImageSpec[]).map(s => (
                                                                                <button
                                                                                    key={s}
                                                                                    onClick={() => setAiSpec(s)}
                                                                                    className={`flex-1 py-1.5 text-xs rounded font-bold transition-colors ${aiSpec === s ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                                                >
                                                                                    {IMAGE_SPECS[s].label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-500 mb-1">이미지 설명 (프롬프트)</label>
                                                                    <textarea
                                                                        className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-yellow-500 min-h-[80px]"
                                                                        placeholder="예: 봄맞이 할인 이벤트 이미지, 벚꽃이 날리는 배경에 따뜻한 느낌"
                                                                        value={aiPrompt}
                                                                        onChange={e => setAiPrompt(e.target.value)}
                                                                        disabled={aiGenerating}
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={handleAiGenerate}
                                                                    disabled={aiGenerating || !aiPrompt.trim()}
                                                                    className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${aiGenerating ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : !aiPrompt.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600'}`}
                                                                >
                                                                    {aiGenerating ? (
                                                                        <><FontAwesomeIcon icon={faSpinner} spin /> AI 이미지 생성 중...</>
                                                                    ) : (
                                                                        <><FontAwesomeIcon icon={faMagic} /> AI 이미지 생성</>
                                                                    )}
                                                                </button>

                                                                {aiError && (
                                                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                                                                        <FontAwesomeIcon icon={faExclamationCircle} className="mr-1" />
                                                                        {aiError}
                                                                    </div>
                                                                )}

                                                                {aiPreviewBase64 && (
                                                                    <div className="space-y-3">
                                                                        <div className="border rounded-lg overflow-hidden bg-gray-50">
                                                                            <img
                                                                                src={`data:${aiPreviewMime};base64,${aiPreviewBase64}`}
                                                                                alt="AI 생성 이미지"
                                                                                className="w-full object-contain max-h-48"
                                                                            />
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={handleAiSave}
                                                                                disabled={aiSaving}
                                                                                className="flex-1 py-2 rounded-lg text-xs font-bold bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center justify-center gap-1.5"
                                                                            >
                                                                                {aiSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                                                                                저장 후 적용
                                                                            </button>
                                                                            <button
                                                                                onClick={handleAiUseDirectly}
                                                                                className="flex-1 py-2 rounded-lg text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5"
                                                                            >
                                                                                <FontAwesomeIcon icon={faCheck} />
                                                                                바로 적용
                                                                            </button>
                                                                            <button
                                                                                onClick={() => { setAiPreviewBase64(null); setAiError(null); }}
                                                                                className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                                                                            >
                                                                                <FontAwesomeIcon icon={faTimes} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Tab: 저장된 이미지 갤러리 */}
                                                        {imageTab === 'gallery' && (
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-xs text-gray-500">{savedImages.length}개 저장됨</span>
                                                                    <button
                                                                        onClick={loadSavedImages}
                                                                        disabled={galleryLoading}
                                                                        className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                                                                    >
                                                                        {galleryLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : '새로고침'}
                                                                    </button>
                                                                </div>
                                                                {galleryLoading ? (
                                                                    <div className="flex justify-center py-8">
                                                                        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-300" />
                                                                    </div>
                                                                ) : savedImages.length === 0 ? (
                                                                    <div className="text-center py-8 text-gray-400 text-sm">
                                                                        저장된 AI 이미지가 없습니다.<br />
                                                                        <span className="text-xs">AI 생성 탭에서 이미지를 생성하고 저장해보세요.</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                                                        {savedImages.map(img => (
                                                                            <div
                                                                                key={img.fullPath}
                                                                                className={`group relative border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-md ${ftImage.imgUrl === img.url ? 'ring-2 ring-yellow-400 border-yellow-400' : 'border-gray-200'}`}
                                                                                onClick={() => handleGallerySelect(img)}
                                                                            >
                                                                                <img src={img.url} alt={img.name} className="w-full h-24 object-cover" />
                                                                                <div className="p-1.5">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${img.spec === 'WIDE' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                                                            {img.spec === 'WIDE' ? '와이드' : '정사각'}
                                                                                        </span>
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); handleGalleryDelete(img); }}
                                                                                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                                                        >
                                                                                            <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                                                                        </button>
                                                                                    </div>
                                                                                    {img.prompt && (
                                                                                        <p className="text-[10px] text-gray-400 mt-1 truncate" title={img.prompt}>{img.prompt}</p>
                                                                                    )}
                                                                                </div>
                                                                                {ftImage.imgUrl === img.url && (
                                                                                    <div className="absolute top-1 right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                                                                                        <FontAwesomeIcon icon={faCheck} className="text-[10px] text-black" />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 현재 적용된 이미지 URL 표시 */}
                                                {ftImage.imgUrl && (
                                                    <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                                                        <div className="flex items-center gap-2">
                                                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-xs" />
                                                            <span className="text-xs text-green-700 font-medium">이미지 적용됨</span>
                                                            <input
                                                                className="flex-1 text-xs border-gray-200 rounded bg-white px-2 py-1"
                                                                value={ftImage.imgUrl}
                                                                onChange={e => setFtImage({ ...ftImage, imgUrl: e.target.value })}
                                                                placeholder="이미지 URL"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">이미지 클릭 링크</label>
                                                    <input
                                                        className="w-full text-sm border-gray-300 rounded"
                                                        placeholder="https://..."
                                                        value={ftImage.imgLink}
                                                        onChange={e => setFtImage({ ...ftImage, imgLink: e.target.value })}
                                                    />
                                                </div>

                                                <div className="mt-2 space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-sm font-medium text-gray-700">
                                                            버튼 설정 (최대 5개, {ftType === 'WIDE' ? '버튼명 8자' : '버튼명 28자'} 제한)
                                                        </label>
                                                        <button
                                                            onClick={() => {
                                                                if (ftButtons.length >= 5) return;
                                                                setFtButtons([...ftButtons, { name: '', buttonType: 'WL', url1: '' }]);
                                                            }}
                                                            className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                                                        >
                                                            <FontAwesomeIcon icon={faPlus} /> 버튼 추가
                                                        </button>
                                                    </div>
                                                    {ftButtons.map((btn, idx) => (
                                                        <div key={idx} className="p-3 bg-gray-50 rounded border flex flex-col gap-2">
                                                            <div className="flex gap-2">
                                                                <input
                                                                    className="flex-1 text-sm border-gray-300 rounded"
                                                                    placeholder={ftType === 'WIDE' ? '버튼명(8자)' : '버튼명(28자)'}
                                                                    value={btn.name}
                                                                    onChange={e => {
                                                                        const copy = [...ftButtons];
                                                                        copy[idx].name = e.target.value;
                                                                        setFtButtons(copy);
                                                                    }}
                                                                />
                                                                <select
                                                                    className="text-sm border-gray-300 rounded"
                                                                    value={btn.buttonType}
                                                                    onChange={e => {
                                                                        const copy = [...ftButtons];
                                                                        copy[idx].buttonType = e.target.value as ButtonConfig['buttonType'];
                                                                        setFtButtons(copy);
                                                                    }}
                                                                >
                                                                    <option value="WL">WL</option>
                                                                </select>
                                                                <button
                                                                    onClick={() => setFtButtons(ftButtons.filter((_, i) => i !== idx))}
                                                                    className="text-red-500 px-2"
                                                                >
                                                                    <FontAwesomeIcon icon={faTrash} />
                                                                </button>
                                                            </div>
                                                            <input
                                                                className="text-sm border-gray-300 rounded"
                                                                placeholder="모바일 URL (Url1)"
                                                                value={btn.url1}
                                                                onChange={e => {
                                                                    const copy = [...ftButtons];
                                                                    copy[idx].url1 = e.target.value;
                                                                    setFtButtons(copy);
                                                                }}
                                                            />
                                                            <input
                                                                className="text-sm border-gray-300 rounded"
                                                                placeholder="PC URL (Url2)"
                                                                value={btn.url2 ?? ''}
                                                                onChange={e => {
                                                                    const copy = [...ftButtons];
                                                                    copy[idx].url2 = e.target.value;
                                                                    setFtButtons(copy);
                                                                }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="sticky top-6">
                                <h3 className="text-md font-bold text-gray-800 mb-4 text-center">미리보기</h3>
                                <div className="mx-auto w-[320px] bg-[#ABC1D1] rounded-[30px] p-4 shadow-xl border-4 border-gray-800 relative min-h-[500px]">
                                    <div className="h-6 w-full flex justify-between px-4 mb-4 text-xs font-bold text-black opacity-50">
                                        <span>SKT</span>
                                        <span>12:30</span>
                                    </div>
                                    {/* Sender Info - Not usually shown inside the chat room like this, but kept for context */}
                                    <div className="flex items-center gap-2 mb-4 px-2 opacity-50 hidden"> {/* Hidden to look more like chat room */}
                                        {selectedChannelLogo ? (
                                            <img src={selectedChannelLogo} alt="Channel Logo" className="w-8 h-8 rounded-full object-cover bg-gray-300" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                                        ) : null}
                                        <div className={`w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 ${selectedChannelLogo ? 'hidden' : ''}`}>
                                            {selectedChannelName.substring(0, 2)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-700">{selectedChannelName}</span>
                                            {selectedChannelPhone && (
                                                <span className="text-xs text-gray-500">{selectedChannelPhone}</span>
                                            )}
                                        </div>
                                        <div className="px-2 pb-4 h-[420px] overflow-y-auto no-scrollbar flex flex-col gap-3">
                                            {/* Date Divider */}
                                            <div className="flex justify-center mb-2">
                                                <span className="bg-black/10 text-white text-[10px] px-2 py-0.5 rounded-full">
                                                    {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                                                </span>
                                            </div>

                                            {/* Message Bubble - Left Aligned (Received) */}
                                            <div className="flex gap-2">
                                                <div className="flex-none flex flex-col items-center gap-1">
                                                    {selectedChannelLogo ? (
                                                        <img src={selectedChannelLogo} alt="Channel" className="w-9 h-9 rounded-[14px] object-cover border border-black/5" />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-[14px] bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
                                                            {selectedChannelName.substring(0, 2)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1 max-w-[210px]">
                                                    <span className="text-xs text-black/70 ml-1">{selectedChannelName}</span>
                                                    <div className={`p-3 rounded-[3px] text-sm relative shadow-sm ${mode === 'FRIENDTALK' ? 'bg-white' : 'bg-white text-black'}`} style={{ borderRadius: '0px 12px 12px 12px' }}>


                                                        {mode === 'ALIMTALK' ? (
                                                            // AlimTalk Content
                                                            <div className="whitespace-pre-wrap leading-relaxed text-gray-800">
                                                                {previewContent}
                                                            </div>
                                                        ) : (
                                                            // FriendTalk Content based on Type
                                                            <div className="leading-relaxed text-gray-800">
                                                                {ftType === 'TEXT' && (
                                                                    <div className="whitespace-pre-wrap">{ftContent || '내용을 입력해주세요.'}</div>
                                                                )}

                                                                {ftType === 'IMAGE' && (
                                                                    <div>
                                                                        {ftImage.imgUrl ? (
                                                                            <img src={ftImage.imgUrl} alt="Preview" className="w-full rounded mb-2" />
                                                                        ) : (
                                                                            <div className="w-full h-32 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500 mb-2">이미지 영역</div>
                                                                        )}
                                                                        <div className="text-xs text-blue-600 underline">링크 연결됨</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {mode === 'FRIENDTALK' && ftType === 'TEXT' && ftButtons.length > 0 && (
                                                            <div className="mt-3 space-y-2 border-t border-black/10 pt-2">
                                                                {ftButtons.map((b, i) => (
                                                                    <div key={i} className="bg-black/5 rounded py-2 text-center text-xs font-bold cursor-pointer hover:bg-black/10 transition">
                                                                        {b.name || '버튼명'}
                                                                        <FontAwesomeIcon icon={faLink} className="ml-1 text-[10px] opacity-50" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {mode === 'ALIMTALK' && selectedTemplateButtons.length > 0 && (
                                                            <div className="mt-3 space-y-2 border-t border-gray-100 pt-2">
                                                                <div className="bg-gray-100 rounded py-2 text-center text-xs text-gray-500">
                                                                    (템플릿 버튼 영역)
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col justify-end pb-1">
                                            <span className="text-[10px] text-black/40">오후 12:30</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="pt-6 border-t">
                            <button onClick={handleSend} disabled={sending} className={`w-full py-4 rounded-xl text-lg font-bold shadow-lg transition-transform active:scale-[0.99] flex items-center justify-center gap-3 ${sending ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white'}`}>
                                {sending ? (<><FontAwesomeIcon icon={faSpinner} spin /> 발송 중...</>) : (<><FontAwesomeIcon icon={faPaperPlane} /> {recipients.length}명에게 {mode === 'ALIMTALK' ? '알림톡' : '친구톡'} 발송</>)}
                            </button>
                        </div>
                        {results.length > 0 && (
                            <div className="bg-white p-6 rounded-xl shadow border border-gray-200 animate-slideUp">
                                <h3 className="text-lg font-bold mb-4">발송 결과</h3>
                                <div className="max-h-60 overflow-y-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2">수신자</th>
                                                <th className="px-4 py-2">연락처</th>
                                                <th className="px-4 py-2">영수증번호</th>
                                                <th className="px-4 py-2">결과</th>
                                                <th className="px-4 py-2">메시지</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {results.map((r, i) => (
                                                <tr key={i}>
                                                    <td className="px-4 py-2 font-medium">{r.recipientName}</td>
                                                    <td className="px-4 py-2 text-gray-500">{r.phone}</td>
                                                    <td className="px-4 py-2 text-gray-500 text-xs">{r.receiptNum ?? '-'}</td>
                                                    <td className="px-4 py-2">
                                                        {r.success ? (<span className="text-green-600 flex items-center gap-1"><FontAwesomeIcon icon={faCheckCircle} /> 성공</span>) : (<span className="text-red-500 flex items-center gap-1"><FontAwesomeIcon icon={faExclamationCircle} /> 실패</span>)}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-400 text-xs">
                                                        <div className="flex flex-col gap-2">
                                                            <div>{r.message}</div>
                                                            {r.receiptNum && (
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                                                                        onClick={async () => {
                                                                            const res = await kakaoService.getSendKakaotalkEx(r.receiptNum!);
                                                                            if (!res.success) {
                                                                                Swal.fire('조회 실패', res.message ?? '조회 실패', 'error');
                                                                                return;
                                                                            }
                                                                            Swal.fire({
                                                                                title: '전송상태 조회',
                                                                                html: `<pre style="text-align:left; white-space:pre-wrap;">${JSON.stringify(res.result ?? {}, null, 2)}</pre>`,
                                                                                width: 900
                                                                            });
                                                                        }}
                                                                    >
                                                                        상태조회
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default KakaoMessageCenterPage;
