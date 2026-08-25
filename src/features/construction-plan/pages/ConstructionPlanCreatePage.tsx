import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileUp,
  GripVertical,
  ImagePlus,
  Layers3,
  ListChecks,
  Loader2,
  MapPin,
  PencilLine,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  createReferenceConstructionPlanFileName,
  estimateReferenceDrawingImagePrintDpi,
  generateReferenceConstructionPlanPdf,
  readReferenceDrawingFile,
  readLogoFileAsDataUrl,
  readReferenceSiteImageAsDataUrl,
  REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY,
  REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL,
  REFERENCE_CONSTRUCTION_PLAN_COVER_URL,
  REFERENCE_CONSTRUCTION_PLAN_PAGE_COUNT,
  type ReferenceConstructionPlanInput,
  type ReferenceConstructionPlanCoverTemplate,
  type ReferenceConstructionPlanUploadedDrawing,
} from '../services/referenceConstructionPlanPdfService';
import { downloadReferenceConstructionPlanExcel } from '../services/constructionPlanExcelService';
import {
  countReferenceConstructionPlanPages,
  getSelectedReferenceSections,
  normalizeReferenceSectionCatalog,
  referenceConstructionPlanPagePreviewUrl,
  REFERENCE_CONSTRUCTION_PLAN_ALL_SECTION_IDS,
  REFERENCE_CONSTRUCTION_PLAN_MAX_SOURCE_PAGE,
  REFERENCE_CONSTRUCTION_PLAN_MIN_SOURCE_PAGE,
  REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
  type ReferenceConstructionPlanSection,
  type ReferenceConstructionPlanSectionGroup,
} from '../domain/referenceConstructionPlanSections';
import {
  getReferenceSectionCatalogErrorMessage,
  loadReferenceConstructionPlanSectionCatalog,
  saveReferenceConstructionPlanSectionCatalog,
} from '../services/referenceConstructionPlanSectionCatalogService';
import {
  createGoogleMapsEmbedUrl,
  createGoogleMapsSearchUrl,
  fetchConstructionPlanMapSnapshot,
} from '../services/constructionPlanMapService';
import '../components/ConstructionPlanUI.css';

const WIZARD_STEPS = [
  { number: 1, label: '로고·상호 등록', helper: '기본값은 청연이엔지' },
  { number: 2, label: '현장정보 직접입력', helper: 'ERP 현장 선택 없이 작성' },
  { number: 3, label: '목차 선택·미리보기', helper: '필요한 내용만 PDF 등록' },
  { number: 4, label: 'PDF·Excel 구성 확인', helper: '같은 데이터로 문서 다운로드' },
] as const;

const COVER_TEMPLATES: Array<{
  id: ReferenceConstructionPlanCoverTemplate;
  name: string;
  tag: string;
  description: string;
}> = [
  {
    id: 'blueprint',
    name: '블루프린트',
    tag: '기본 표지',
    description: '첨부 원본의 아파트·도면 이미지를 살린 기술 문서형 표지',
  },
  {
    id: 'executive',
    name: '이그제큐티브 블루',
    tag: '프리미엄',
    description: '짙은 네이비와 청색 라인으로 구성한 대외 제출용 표지',
  },
  {
    id: 'minimal',
    name: '아키텍처 미니멀',
    tag: '모던',
    description: '화이트 도면 그리드와 정보 패널 중심의 설계 문서형 표지',
  },
];

const today = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const INITIAL_FORM: ReferenceConstructionPlanInput = {
  siteName: '',
  projectName: '공동주택(아파트) 신축공사 - 시스템동바리 설치 및 해체공사',
  siteAddress: '',
  clientName: '',
  contractorName: '',
  companyName: REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY,
  documentNo: 'CY-SSP-001',
  revision: 5,
  preparedDate: today(),
  constructionStartDate: '',
  constructionEndDate: '',
  applicationScope: '지하층 · 저층부 · 기준층 · 특수구간',
  structuralReviewNo: '',
  installationDrawingNo: '',
  buildings: '',
  floors: '',
  zones: '',
  coverTemplate: 'blueprint',
};

type FormTextKey = Exclude<
  keyof ReferenceConstructionPlanInput,
  'revision' | 'customLogoDataUrl' | 'coverTemplate'
>;

type UploadedDrawingState = ReferenceConstructionPlanUploadedDrawing & {
  previewUrl: string;
};

type SectionCatalogDraft = {
  id?: string;
  title: string;
  englishTitle: string;
  group: ReferenceConstructionPlanSectionGroup;
  sourcePages: string;
};

const EMPTY_SECTION_CATALOG_DRAFT: SectionCatalogDraft = {
  title: '',
  englishTitle: '',
  group: '시공·장비 계획',
  sourcePages: String(REFERENCE_CONSTRUCTION_PLAN_MIN_SOURCE_PAGE),
};

const formatSourcePagesInput = (sourcePages: number[]): string => sourcePages.join(', ');

const parseSourcePagesInput = (value: string): number[] => {
  const pages: number[] = [];
  value.split(',').map((token) => token.trim()).filter(Boolean).forEach((token) => {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start <= end && end - start <= REFERENCE_CONSTRUCTION_PLAN_MAX_SOURCE_PAGE) {
        for (let page = start; page <= end; page += 1) pages.push(page);
      }
      return;
    }
    if (/^\d+$/.test(token)) pages.push(Number(token));
  });
  return Array.from(new Set(pages)).sort((a, b) => a - b);
};

export function ConstructionPlanCreatePage() {
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const mapImageInputRef = useRef<HTMLInputElement>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);
  const drawingPreviewUrlsRef = useRef<string[]>([]);
  const catalogSelectionTouchedRef = useRef(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ReferenceConstructionPlanInput>(INITIAL_FORM);
  const [sectionCatalog, setSectionCatalog] = useState<ReferenceConstructionPlanSection[]>(
    REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
  );
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogMessage, setCatalogMessage] = useState('목차 데이터베이스 연결 중');
  const [catalogDraft, setCatalogDraft] = useState<SectionCatalogDraft>();
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>(
    REFERENCE_CONSTRUCTION_PLAN_ALL_SECTION_IDS,
  );
  const [activeSectionId, setActiveSectionId] = useState(
    REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0].id,
  );
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [draggedSectionId, setDraggedSectionId] = useState<string>();
  const [uploadedDrawings, setUploadedDrawings] = useState<UploadedDrawingState[]>([]);
  const [drawingError, setDrawingError] = useState('');
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string>();
  const [logoError, setLogoError] = useState('');
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [excelGenerating, setExcelGenerating] = useState(false);
  const [excelError, setExcelError] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [pdfBlob, setPdfBlob] = useState<Blob>();
  const [pdfUrl, setPdfUrl] = useState('');

  const updateText = (key: FormTextKey, value: string) => {
    setForm((current) => key === 'siteAddress'
      ? {
        ...current,
        siteAddress: value,
        siteMapImageDataUrl: undefined,
        siteMapAddress: value.replace(/\s+/g, ' ').trim() || undefined,
        siteMapLink: createGoogleMapsSearchUrl(value) || undefined,
      }
      : { ...current, [key]: value });
    if (key === 'siteAddress') setMapError('');
    setGenerationError('');
  };

  const updateRevision = (value: string) => {
    const parsed = Number(value);
    setForm((current) => ({
      ...current,
      revision: Number.isInteger(parsed) && parsed >= 0 ? parsed : 5,
    }));
    setGenerationError('');
  };

  const directInputReady = Boolean(
    form.siteName.trim()
    && form.projectName.trim()
    && form.siteAddress?.trim()
    && form.documentNo.trim()
    && form.preparedDate.trim(),
  );
  const brandingReady = Boolean(form.companyName.trim());
  const selectedSections = useMemo(
    () => getSelectedReferenceSections(selectedSectionIds, sectionCatalog),
    [sectionCatalog, selectedSectionIds],
  );
  const uploadedDrawingPageCount = useMemo(
    () => uploadedDrawings.reduce((total, drawing) => total + drawing.pageCount, 0),
    [uploadedDrawings],
  );
  const uploadedImageCount = useMemo(
    () => uploadedDrawings.filter(({ sourceType }) => sourceType === 'image').length,
    [uploadedDrawings],
  );
  const uploadedPdfCount = uploadedDrawings.length - uploadedImageCount;
  const selectionReady = selectedSections.length > 0 || uploadedDrawingPageCount > 0;
  const selectedCoverTemplate = form.coverTemplate ?? 'blueprint';
  const selectedCoverDefinition = COVER_TEMPLATES.find(
    ({ id }) => id === selectedCoverTemplate,
  ) ?? COVER_TEMPLATES[0];
  const selectedPageCount = countReferenceConstructionPlanPages(
    selectedSectionIds,
    uploadedDrawingPageCount,
    sectionCatalog,
    form.siteAddress?.trim() ? 1 : 0,
    form.siteAddress?.trim() ? 1 : 0,
  );
  const activeSection = sectionCatalog.find(
    ({ id }) => id === activeSectionId,
  ) ?? sectionCatalog[0] ?? REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0];
  const activePreviewPage = activeSection.sourcePages[
    Math.min(previewPageIndex, activeSection.sourcePages.length - 1)
  ];
  const effectiveInput = useMemo<ReferenceConstructionPlanInput>(() => ({
    ...form,
    customLogoDataUrl,
  }), [customLogoDataUrl, form]);

  useEffect(() => {
    if (!pdfBlob) {
      setPdfUrl('');
      return undefined;
    }
    const nextUrl = URL.createObjectURL(pdfBlob);
    setPdfUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [pdfBlob]);

  const loadSectionCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const result = await loadReferenceConstructionPlanSectionCatalog();
      setSectionCatalog(result.sections);
      const resultIds = result.sections.map(({ id }) => id);
      setSelectedSectionIds((current) => catalogSelectionTouchedRef.current
        ? current.filter((id) => resultIds.includes(id))
        : resultIds);
      setActiveSectionId((current) => resultIds.includes(current) ? current : result.sections[0].id);
      setPreviewPageIndex(0);
      setCatalogMessage(result.source === 'seeded'
        ? '기본 33개 목차를 Firebase에 등록했습니다'
        : result.source === 'local'
          ? `브라우저 DB 목차 ${result.sections.length}개 불러옴 · Firebase 동기화 대기`
          : `Firebase 목차 ${result.sections.length}개 불러옴`);
    } catch (error) {
      setCatalogError(getReferenceSectionCatalogErrorMessage(error));
      setCatalogMessage('기본 목차로 임시 표시 중');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSectionCatalog();
  }, [loadSectionCatalog]);

  useEffect(() => () => {
    drawingPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const ensureSiteMap = useCallback(async (
    input: ReferenceConstructionPlanInput,
    forceRefresh = false,
  ): Promise<ReferenceConstructionPlanInput> => {
    const address = input.siteAddress?.replace(/\s+/g, ' ').trim() ?? '';
    if (!address) throw new Error('construction-plan-map-address-required');
    if (!forceRefresh && input.siteMapImageDataUrl && input.siteMapAddress === address) return input;
    setMapLoading(true);
    setMapError('');
    try {
      const snapshot = await fetchConstructionPlanMapSnapshot(address);
      const mappedInput: ReferenceConstructionPlanInput = {
        ...input,
        siteAddress: address,
        siteMapAddress: snapshot.address,
        siteMapImageDataUrl: snapshot.imageDataUrl,
        siteMapLink: snapshot.googleMapsUrl,
      };
      setForm((current) => current.siteAddress?.replace(/\s+/g, ' ').trim() === address
        ? {
          ...current,
          siteAddress: address,
          siteMapAddress: snapshot.address,
          siteMapImageDataUrl: snapshot.imageDataUrl,
          siteMapLink: snapshot.googleMapsUrl,
        }
        : current);
      setPdfBlob(undefined);
      return mappedInput;
    } catch (error) {
      console.info('[ConstructionPlanCreatePage] Static map unavailable; keeping the live map link', error);
      const siteMapLink = createGoogleMapsSearchUrl(address);
      const linkedInput: ReferenceConstructionPlanInput = {
        ...input,
        siteAddress: address,
        siteMapAddress: address,
        siteMapLink,
      };
      setForm((current) => current.siteAddress?.replace(/\s+/g, ' ').trim() === address
        ? {
          ...current,
          siteAddress: address,
          siteMapAddress: address,
          siteMapLink,
        }
        : current);
      setMapError('지도 이미지 자동 생성 서버에 연결하지 못했습니다. 실시간 Google 지도와 링크는 연결되며, PDF에 지도 이미지를 넣으려면 아래의 “지도 이미지 등록”을 이용해주세요.');
      return linkedInput;
    } finally {
      setMapLoading(false);
    }
  }, []);

  const handleMapImageFile = async (file?: File) => {
    if (!file) return;
    setMapError('');
    try {
      const siteMapImageDataUrl = await readReferenceSiteImageAsDataUrl(file);
      setForm((current) => {
        const address = current.siteAddress?.replace(/\s+/g, ' ').trim() ?? '';
        return {
          ...current,
          siteMapImageDataUrl,
          siteMapAddress: address,
          siteMapLink: createGoogleMapsSearchUrl(address),
        };
      });
      setPdfBlob(undefined);
      setGenerationError('');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setMapError(code.includes('size')
        ? '지도 이미지는 20MB 이하로 등록해주세요.'
        : code.includes('dimensions')
          ? '지도 이미지 해상도가 너무 큽니다. 4,800만 화소 이하로 줄여주세요.'
          : 'PNG, JPG, WebP 형식의 정상 지도 이미지를 등록해주세요.');
    } finally {
      if (mapImageInputRef.current) mapImageInputRef.current.value = '';
    }
  };

  const removeMapImage = () => {
    setForm((current) => {
      const address = current.siteAddress?.replace(/\s+/g, ' ').trim() ?? '';
      return {
        ...current,
        siteMapImageDataUrl: undefined,
        siteMapAddress: address || undefined,
        siteMapLink: createGoogleMapsSearchUrl(address) || undefined,
      };
    });
    setMapError('');
    setPdfBlob(undefined);
    if (mapImageInputRef.current) mapImageInputRef.current.value = '';
  };

  const generatePdf = useCallback(async () => {
    if (!directInputReady || !brandingReady) return;
    setGenerating(true);
    setGenerationError('');
    try {
      const mappedInput = await ensureSiteMap(effectiveInput);
      setPdfBlob(await generateReferenceConstructionPlanPdf(
        mappedInput,
        selectedSectionIds,
        uploadedDrawings,
        sectionCatalog,
      ));
    } catch (error) {
      console.warn('[ConstructionPlanCreatePage] Failed to build reference PDF', error);
      setPdfBlob(undefined);
      const code = error instanceof Error ? error.message : '';
      setGenerationError(code.includes('construction-plan-map-address-required')
        ? '현장주소를 입력한 뒤 다시 시도해주세요.'
        : 'PDF를 만들지 못했습니다. 원본 템플릿 연결과 입력값을 확인한 뒤 다시 시도해주세요.');
    } finally {
      setGenerating(false);
    }
  }, [brandingReady, directInputReady, effectiveInput, ensureSiteMap, sectionCatalog, selectedSectionIds, uploadedDrawings]);

  const showSectionPreview = (section: ReferenceConstructionPlanSection) => {
    setActiveSectionId(section.id);
    setPreviewPageIndex(0);
  };

  const toggleSection = (sectionId: string) => {
    catalogSelectionTouchedRef.current = true;
    setSelectedSectionIds((current) => (
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId]
    ));
    setPdfBlob(undefined);
    setGenerationError('');
  };

  const selectAllSections = () => {
    catalogSelectionTouchedRef.current = true;
    setSelectedSectionIds(sectionCatalog.map(({ id }) => id));
    setPdfBlob(undefined);
  };

  const clearAllSections = () => {
    catalogSelectionTouchedRef.current = true;
    setSelectedSectionIds([]);
    setPdfBlob(undefined);
  };

  const moveSelectedSection = (sectionId: string, offset: -1 | 1) => {
    catalogSelectionTouchedRef.current = true;
    setSelectedSectionIds((current) => {
      const currentIndex = current.indexOf(sectionId);
      const nextIndex = currentIndex + offset;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      return next;
    });
    setPdfBlob(undefined);
    setGenerationError('');
  };

  const dropSelectedSection = (targetSectionId: string) => {
    if (!draggedSectionId || draggedSectionId === targetSectionId) {
      setDraggedSectionId(undefined);
      return;
    }
    catalogSelectionTouchedRef.current = true;
    setSelectedSectionIds((current) => {
      const sourceIndex = current.indexOf(draggedSectionId);
      const targetIndex = current.indexOf(targetSectionId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, draggedSectionId);
      return next;
    });
    setDraggedSectionId(undefined);
    setPdfBlob(undefined);
    setGenerationError('');
  };

  const restoreOriginalSectionOrder = () => {
    catalogSelectionTouchedRef.current = true;
    const selected = new Set(selectedSectionIds);
    setSelectedSectionIds(sectionCatalog.map(({ id }) => id).filter((id) => selected.has(id)));
    setPdfBlob(undefined);
    setGenerationError('');
  };

  const handleDrawingFiles = async (files?: FileList | null) => {
    if (!files?.length) return;
    setDrawingError('');
    const additions: UploadedDrawingState[] = [];
    const failures: string[] = [];
    for (const [index, file] of Array.from(files).entries()) {
      try {
        const drawing = await readReferenceDrawingFile(file);
        const previewUrl = URL.createObjectURL(file);
        drawingPreviewUrlsRef.current.push(previewUrl);
        additions.push({
          ...drawing,
          id: `drawing-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          previewUrl,
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        failures.push(code.includes('image-size')
          ? `${file.name}: 사진은 20MB 이하만 등록할 수 있습니다.`
          : code.includes('dimensions')
            ? `${file.name}: 사진 해상도가 너무 큽니다. 4,800만 화소 이하로 줄여주세요.`
            : code.includes('size')
              ? `${file.name}: PDF는 50MB 이하만 등록할 수 있습니다.`
          : code.includes('type')
            ? `${file.name}: PDF, JPG, PNG, WebP 파일만 등록할 수 있습니다.`
            : `${file.name}: 열 수 있는 정상 PDF 또는 사진인지 확인해주세요.`);
      }
    }
    if (additions.length > 0) {
      setUploadedDrawings((current) => [...current, ...additions]);
      setPdfBlob(undefined);
      setGenerationError('');
    }
    if (failures.length > 0) setDrawingError(failures.join(' '));
    if (drawingInputRef.current) drawingInputRef.current.value = '';
  };

  const updateDrawingTitle = (drawingId: string, title: string) => {
    setUploadedDrawings((current) => current.map((drawing) => (
      drawing.id === drawingId ? { ...drawing, title } : drawing
    )));
    setPdfBlob(undefined);
    setGenerationError('');
  };

  const moveUploadedDrawing = (drawingId: string, offset: -1 | 1) => {
    setUploadedDrawings((current) => {
      const currentIndex = current.findIndex(({ id }) => id === drawingId);
      const nextIndex = currentIndex + offset;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      return next;
    });
    setPdfBlob(undefined);
  };

  const removeUploadedDrawing = (drawingId: string) => {
    setUploadedDrawings((current) => {
      const target = current.find(({ id }) => id === drawingId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        drawingPreviewUrlsRef.current = drawingPreviewUrlsRef.current.filter(
          (url) => url !== target.previewUrl,
        );
      }
      return current.filter(({ id }) => id !== drawingId);
    });
    setPdfBlob(undefined);
    setGenerationError('');
  };

  const handleLogoFile = async (file?: File) => {
    if (!file) return;
    setLogoError('');
    try {
      setCustomLogoDataUrl(await readLogoFileAsDataUrl(file));
      setPdfBlob(undefined);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setLogoError(code.includes('size')
        ? '로고 파일은 5MB 이하로 등록해주세요.'
        : 'PNG, JPG, WebP 형식의 로고만 등록할 수 있습니다.');
    }
  };

  const resetLogo = () => {
    setCustomLogoDataUrl(undefined);
    setLogoError('');
    setPdfBlob(undefined);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const selectCoverTemplate = (coverTemplate: ReferenceConstructionPlanCoverTemplate) => {
    setForm((current) => ({ ...current, coverTemplate }));
    setPdfBlob(undefined);
    setGenerationError('');
  };

  const openNewCatalogSection = () => {
    setCatalogError('');
    setCatalogDraft({ ...EMPTY_SECTION_CATALOG_DRAFT });
  };

  const openCatalogSectionEditor = (item: ReferenceConstructionPlanSection) => {
    setCatalogError('');
    setCatalogDraft({
      id: item.id,
      title: item.title,
      englishTitle: item.englishTitle,
      group: item.group,
      sourcePages: formatSourcePagesInput(item.sourcePages),
    });
  };

  const saveCatalogDraft = async () => {
    if (!catalogDraft || catalogSaving) return;
    const title = catalogDraft.title.trim();
    const englishTitle = catalogDraft.englishTitle.trim() || 'CUSTOM SECTION';
    const sourcePages = parseSourcePagesInput(catalogDraft.sourcePages);
    const pagesAreValid = sourcePages.length > 0 && sourcePages.every((page) => (
      page >= REFERENCE_CONSTRUCTION_PLAN_MIN_SOURCE_PAGE
      && page <= REFERENCE_CONSTRUCTION_PLAN_MAX_SOURCE_PAGE
    ));
    if (!title) {
      setCatalogError('목차 제목을 입력해주세요.');
      return;
    }
    if (!pagesAreValid) {
      setCatalogError(`원본 PDF 쪽은 ${REFERENCE_CONSTRUCTION_PLAN_MIN_SOURCE_PAGE}~${REFERENCE_CONSTRUCTION_PLAN_MAX_SOURCE_PAGE} 범위로 입력해주세요.`);
      return;
    }

    const editing = Boolean(catalogDraft.id);
    const id = catalogDraft.id
      ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextItem: ReferenceConstructionPlanSection = {
      id,
      number: editing
        ? sectionCatalog.find(({ id: candidateId }) => candidateId === id)?.number ?? sectionCatalog.length
        : sectionCatalog.length + 1,
      title,
      englishTitle,
      group: catalogDraft.group,
      sourcePages,
    };
    const nextCatalog = normalizeReferenceSectionCatalog(editing
      ? sectionCatalog.map((item) => item.id === id ? nextItem : item)
      : [...sectionCatalog, nextItem]);

    setCatalogSaving(true);
    setCatalogError('');
    try {
      const result = await saveReferenceConstructionPlanSectionCatalog(nextCatalog);
      const saved = result.sections;
      setSectionCatalog(saved);
      if (!editing) setSelectedSectionIds((current) => [...current, id]);
      setActiveSectionId(id);
      setPreviewPageIndex(0);
      setCatalogDraft(undefined);
      setCatalogMessage(`${title} 목차를 ${result.source === 'database' ? 'Firebase' : '브라우저 DB'}에 ${editing ? '수정' : '추가'}했습니다`);
      setPdfBlob(undefined);
      setGenerationError('');
    } catch (error) {
      setCatalogError(getReferenceSectionCatalogErrorMessage(error));
    } finally {
      setCatalogSaving(false);
    }
  };

  const deleteCatalogSection = async (item: ReferenceConstructionPlanSection) => {
    if (catalogSaving) return;
    if (sectionCatalog.length <= 1) {
      setCatalogError('목차는 최소 1개 이상 유지해야 합니다.');
      return;
    }
    if (!window.confirm(`“${item.title}” 목차를 데이터베이스에서 삭제할까요?\n원본 PDF 파일 자체는 삭제되지 않습니다.`)) return;
    setCatalogSaving(true);
    setCatalogError('');
    try {
      const result = await saveReferenceConstructionPlanSectionCatalog(
        sectionCatalog.filter(({ id }) => id !== item.id),
      );
      const saved = result.sections;
      setSectionCatalog(saved);
      setSelectedSectionIds((current) => current.filter((id) => id !== item.id));
      if (activeSectionId === item.id) {
        setActiveSectionId(saved[0].id);
        setPreviewPageIndex(0);
      }
      setCatalogMessage(`${item.title} 목차를 ${result.source === 'database' ? 'Firebase' : '브라우저 DB'}에서 삭제했습니다`);
      setPdfBlob(undefined);
      setGenerationError('');
    } catch (error) {
      setCatalogError(getReferenceSectionCatalogErrorMessage(error));
    } finally {
      setCatalogSaving(false);
    }
  };

  const moveToStep = async (nextStep: number) => {
    setGenerationError('');
    if (nextStep >= 2 && !brandingReady) {
      setGenerationError('PDF에 표시할 회사 상호를 입력해주세요.');
      return;
    }
    if (nextStep >= 3 && !directInputReady) {
      setGenerationError('현장명, 공사명, 현장주소, 문서번호, 작성일자를 입력해주세요.');
      return;
    }
    if (nextStep === 4 && !selectionReady) {
      setGenerationError('최종 PDF에 포함할 목차를 1개 이상 선택해주세요.');
      return;
    }
    if (nextStep === 4 && (!directInputReady || !selectionReady || !brandingReady)) {
      setGenerationError('현장정보와 상호를 확인해주세요.');
      return;
    }
    setStep(nextStep);
    if (nextStep === 4) await generatePdf();
  };

  const downloadPdf = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = createReferenceConstructionPlanFileName(effectiveInput);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const downloadExcel = async () => {
    if (!directInputReady || !brandingReady || !selectionReady || excelGenerating) return;
    setExcelGenerating(true);
    setExcelError('');
    try {
      const mappedInput = await ensureSiteMap(effectiveInput);
      await downloadReferenceConstructionPlanExcel({
        input: mappedInput,
        sections: selectedSections,
        drawings: uploadedDrawings,
      });
    } catch (error) {
      console.error('[ConstructionPlanCreatePage] Failed to build Excel workbook', error);
      const code = error instanceof Error ? error.message : '';
      setExcelError(code.includes('construction-plan-map-address-required')
        ? '현장주소를 입력한 뒤 다시 시도해주세요.'
        : 'Excel 파일을 만들지 못했습니다. 입력값과 브라우저 다운로드 권한을 확인한 뒤 다시 시도해주세요.');
    } finally {
      setExcelGenerating(false);
    }
  };

  const scopeSummary = [form.buildings, form.floors, form.zones]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' · ') || form.applicationScope;
  const customBranding = Boolean(
    customLogoDataUrl
    || form.companyName.trim() !== REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY,
  );

  return (
    <main className="cp-page cp-wizard-page cp-quick-pdf-page cp-reference-pdf-page">
      <header className="cp-page-header cp-page-header--compact">
        <div className="cp-page-header__copy">
          <button
            type="button"
            className="cp-back-button"
            onClick={() => navigate('/construction-plans/manage')}
            aria-label="시공계획서 관리로"
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <span className="cp-eyebrow">REV.5 REFERENCE PDF</span>
            <h1>시스템동바리 시공계획서 만들기</h1>
            <p>회사 로고와 상호를 등록하고 현장정보를 입력한 뒤 필요한 목차로 PDF와 Excel을 만듭니다.</p>
          </div>
        </div>
        <button
          type="button"
          className="cp-button cp-button--ghost cp-button--small"
          onClick={() => navigate('/construction-plans/manage')}
        >
          <FileText size={15} /> 기존 문서 관리
        </button>
      </header>

      <div className="cp-wizard-shell">
        <aside className="cp-wizard-steps" aria-label="직접입력 PDF 생성 단계">
          <div className="cp-wizard-steps__intro">
            <span><Sparkles size={18} /></span>
            <strong>4단계 선택 생성</strong>
            <p>브랜드 등록부터 현장정보, 목차 선택, PDF 확인까지 순서대로 진행합니다.</p>
          </div>
          <ol>
            {WIZARD_STEPS.map((item) => (
              <li
                key={item.number}
                className={`${step === item.number ? 'is-active' : ''}${step > item.number ? ' is-complete' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => void moveToStep(item.number)}
                  disabled={
                    (item.number >= 2 && !brandingReady)
                    || (item.number >= 3 && !directInputReady)
                    || (item.number === 4 && !selectionReady)
                  }
                  aria-current={step === item.number ? 'step' : undefined}
                >
                  <span>{step > item.number ? <Check size={15} /> : item.number}</span>
                  <div><strong>{item.label}</strong><small>{item.helper}</small></div>
                </button>
              </li>
            ))}
          </ol>
          <div className="cp-wizard-steps__tip">
            <ShieldCheck size={17} />
            <p><strong>선택한 목차만 등록</strong>각 목차의 실제 원본 페이지를 미리 본 뒤 최종 PDF 포함 여부를 결정합니다.</p>
          </div>
        </aside>

        <section className="cp-wizard-content">
          <div className="cp-reference-template-banner" aria-label="적용 PDF 템플릿">
            <span><FileText size={21} /></span>
            <div>
              <small>고정 템플릿</small>
              <strong>청연이엔지 시스템동바리 시공계획서 REV.5</strong>
              <p>도면·장비사용계획 완성본 · 원본 A4 {REFERENCE_CONSTRUCTION_PLAN_PAGE_COUNT}쪽 · DB 목차 {sectionCatalog.length}개 선택 가능</p>
            </div>
            <em>원본 적용</em>
          </div>

          <div className="cp-wizard-content__head">
            <span>STEP {step} OF 4</span>
            <h2>{WIZARD_STEPS[step - 1].label}</h2>
            <p>{step === 1
              ? 'PDF에 표시할 상호와 로고를 먼저 등록합니다. 변경하지 않으면 첨부 원본의 청연이엔지를 사용합니다.'
              : step === 2
                ? '현장정보와 주소를 입력하면 Google 지도를 미리보기·PDF·Excel에 자동으로 등록합니다.'
                : step === 3
                  ? '데이터베이스 목차를 선택하고 PDF·사진 도면을 여러 장 추가해 제목과 출력 순서를 함께 편집합니다.'
                  : `선택한 ${selectedSections.length}개 DB 목차와 업로드 도면 ${uploadedDrawingPageCount}장으로 구성된 ${selectedPageCount}쪽 PDF를 확인하고 다운로드합니다.`}</p>
          </div>

          {step === 2 && (
            <div className="cp-reference-form">
              <section>
                <div className="cp-reference-section-title"><span>1</span><div><strong>문서 기본정보</strong><p>* 표시는 PDF 생성에 필요한 항목입니다.</p></div></div>
                <div className="cp-form-grid cp-form-grid--2">
                  <label className="cp-reference-span-2"><span>현장명 *</span><input value={form.siteName} onChange={(event) => updateText('siteName', event.target.value)} placeholder="예: 서울 ○○아파트 신축공사" autoFocus /></label>
                  <label className="cp-reference-span-2"><span>공사명 *</span><input value={form.projectName} onChange={(event) => updateText('projectName', event.target.value)} /></label>
                  <label><span>발주처</span><input value={form.clientName} onChange={(event) => updateText('clientName', event.target.value)} placeholder="발주처 직접입력" /></label>
                  <label><span>원청사</span><input value={form.contractorName} onChange={(event) => updateText('contractorName', event.target.value)} placeholder="원청사 직접입력" /></label>
                  <label><span>문서번호 *</span><input value={form.documentNo} onChange={(event) => updateText('documentNo', event.target.value)} /></label>
                  <label><span>Revision</span><input type="number" min="0" value={form.revision} onChange={(event) => updateRevision(event.target.value)} /></label>
                  <label><span>작성일자 *</span><input type="date" value={form.preparedDate} onChange={(event) => updateText('preparedDate', event.target.value)} /></label>
                  <label><span>적용범위</span><input value={form.applicationScope} onChange={(event) => updateText('applicationScope', event.target.value)} /></label>
                  <label><span>공사 시작일</span><input type="date" value={form.constructionStartDate ?? ''} onChange={(event) => updateText('constructionStartDate', event.target.value)} /></label>
                  <label><span>공사 종료일</span><input type="date" value={form.constructionEndDate ?? ''} onChange={(event) => updateText('constructionEndDate', event.target.value)} /></label>
                </div>
              </section>

              <section>
                <div className="cp-reference-section-title"><span>2</span><div><strong>현장 위치 지도</strong><p>주소를 입력하면 지도 이미지가 자동 생성되어 미리보기·PDF·Excel에 동일하게 반영됩니다.</p></div></div>
                <div className="cp-form-grid cp-form-grid--2">
                  <label className="cp-reference-span-2"><span>현장주소 *</span><input value={form.siteAddress ?? ''} onChange={(event) => updateText('siteAddress', event.target.value)} onBlur={() => form.siteAddress?.trim() && void ensureSiteMap(effectiveInput)} placeholder="예: 서울특별시 강남구 테헤란로 123" /></label>
                </div>
                <div className="cp-site-visuals cp-site-visuals--map-only">
                  <article className="cp-site-visual-card">
                    <header><span><MapPin size={17} /></span><div><strong>현장 위치 지도</strong><p>입력 주소 기준 · PDF/Excel 공통</p></div></header>
                    <div className={`cp-site-visual-card__preview${form.siteMapImageDataUrl ? ' has-image' : ''}`}>
                      {form.siteMapImageDataUrl
                        ? <img src={form.siteMapImageDataUrl} alt={`${form.siteAddress} 현장 위치 지도`} />
                        : form.siteAddress?.trim()
                          ? <iframe title="Google 지도 실시간 미리보기" src={createGoogleMapsEmbedUrl(form.siteAddress)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                          : <div><MapPin size={28} /><strong>현장주소를 입력해주세요</strong><p>입력 즉시 Google 지도 미리보기가 연결됩니다.</p></div>}
                    </div>
                    <footer>
                      <div className="cp-site-visual-card__actions">
                        <button
                          type="button"
                          className="cp-button cp-button--secondary cp-button--small"
                          disabled={!form.siteAddress?.trim() || mapLoading}
                          onClick={() => void ensureSiteMap(effectiveInput, true)}
                        >
                          {mapLoading ? <Loader2 size={14} className="cp-spin" /> : <RefreshCw size={14} />}
                          지도 자동 생성
                        </button>
                        <button type="button" className="cp-button cp-button--ghost cp-button--small" onClick={() => mapImageInputRef.current?.click()} disabled={!form.siteAddress?.trim()}>
                          <Upload size={14} />지도 이미지 등록
                        </button>
                        <input
                          ref={mapImageInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          aria-label="지도 이미지 파일 선택"
                          hidden
                          onChange={(event) => void handleMapImageFile(event.target.files?.[0])}
                        />
                      </div>
                      {form.siteMapImageDataUrl && <button type="button" className="cp-site-visual-card__remove" onClick={removeMapImage}><Trash2 size={13} /> 삭제</button>}
                      {form.siteAddress?.trim() && <a href={form.siteMapLink || createGoogleMapsSearchUrl(form.siteAddress)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> 지도에서 열기</a>}
                    </footer>
                  </article>
                </div>
                <section className="cp-site-application-preview" aria-label="현장 위치 지도 문서 적용 예시">
                  <header>
                    <div><span>PDF 3쪽 · 목차 01</span><strong>현장 위치 지도</strong><p>지도 한 장이 A4 페이지의 본문 영역을 넓게 사용합니다.</p></div>
                    <div className="cp-site-application-preview__status">
                      <span className={form.siteMapImageDataUrl ? 'is-complete' : 'is-live'}><MapPin size={12} />{form.siteMapImageDataUrl ? '지도 이미지 등록' : '실시간 지도 연결'}</span>
                    </div>
                  </header>
                  <div className="cp-site-application-preview__sheet cp-site-application-preview__sheet--map-only">
                    <div className="cp-site-application-preview__address"><strong>현장주소</strong><span>{form.siteAddress?.trim() || '현장주소 입력 대기'}</span></div>
                    <div className="cp-site-application-preview__panel is-map">
                      <strong>현장 위치 지도</strong>
                      {form.siteMapImageDataUrl
                        ? <img src={form.siteMapImageDataUrl} alt="문서에 적용될 현장 위치 지도 예시" />
                        : form.siteAddress?.trim()
                          ? <iframe title="문서 적용 Google 지도 예시" src={createGoogleMapsEmbedUrl(form.siteAddress)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                          : <span>현장주소 입력 후 표시됩니다.</span>}
                    </div>
                  </div>
                </section>
                {mapError && <div className="cp-form-error" role="alert"><AlertCircle size={16} />{mapError}</div>}
              </section>

              <section>
                <div className="cp-reference-section-title"><span>3</span><div><strong>현장 적용정보</strong><p>비어 있는 항목은 원본 양식의 기입란으로 남습니다.</p></div></div>
                <div className="cp-form-grid cp-form-grid--2">
                  <label><span>동</span><input value={form.buildings} onChange={(event) => updateText('buildings', event.target.value)} placeholder="예: 101동, 102동" /></label>
                  <label><span>층</span><input value={form.floors} onChange={(event) => updateText('floors', event.target.value)} placeholder="예: 지하 2층~지상 20층" /></label>
                  <label><span>작업 구간</span><input value={form.zones} onChange={(event) => updateText('zones', event.target.value)} placeholder="예: A구간, 램프구간" /></label>
                  <label><span>구조검토서 No.</span><input value={form.structuralReviewNo} onChange={(event) => updateText('structuralReviewNo', event.target.value)} placeholder="미입력 시 [기입] 유지" /></label>
                  <label><span>설치도 No.</span><input value={form.installationDrawingNo} onChange={(event) => updateText('installationDrawingNo', event.target.value)} placeholder="미입력 시 [기입] 유지" /></label>
                </div>
              </section>
            </div>
          )}

          {step === 3 && (
            <div className="cp-toc-selection-step">
              <div className="cp-toc-selection-toolbar">
                <div>
                  <span><ListChecks size={18} /></span>
                  <div><strong>{selectedSections.length}/{sectionCatalog.length}개 DB 목차 · 업로드 도면 {uploadedDrawingPageCount}장</strong><p>도면은 원본 PDF 한 장당 A4 한 페이지 · 최종 {selectedPageCount}쪽</p></div>
                </div>
                <div>
                  <button type="button" className="cp-button cp-button--secondary cp-button--small" onClick={selectAllSections}>전체 선택</button>
                  <button type="button" className="cp-button cp-button--ghost cp-button--small" onClick={clearAllSections}>전체 해제</button>
                </div>
              </div>

              <section className="cp-toc-catalog-manager" aria-label="목차 데이터베이스 관리">
                <div className="cp-toc-catalog-manager__head">
                  <div>
                    <span><Database size={20} /></span>
                    <div><strong>목차 목록 데이터베이스</strong><small>제목·분류·연결할 원본 페이지를 추가, 수정, 삭제할 수 있습니다.</small></div>
                  </div>
                  <button type="button" className="cp-button cp-button--primary cp-button--small" onClick={openNewCatalogSection} disabled={catalogLoading || catalogSaving}>
                    <Plus size={15} /> 새 목차 추가
                  </button>
                </div>
                <div className={`cp-toc-catalog-manager__status${catalogError ? ' is-error' : ''}`}>
                  {catalogLoading || catalogSaving ? <Loader2 size={15} className="cp-spin" /> : catalogError ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                  <span>{catalogSaving ? '데이터베이스에 저장 중' : catalogMessage}</span>
                  {catalogError && <button type="button" onClick={() => void loadSectionCatalog()} disabled={catalogLoading}>다시 연결</button>}
                </div>
                {catalogError && <div className="cp-form-error" role="alert"><AlertCircle size={16} />{catalogError}</div>}
                <p>목차 제목을 바꾸면 선택 목록과 생성 PDF의 목차 페이지에 즉시 반영됩니다. 원본 본문 페이지의 인쇄된 제목은 원본 그대로 유지됩니다.</p>
              </section>

              {catalogDraft && (
                <div className="cp-catalog-dialog-backdrop" role="presentation" onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !catalogSaving) setCatalogDraft(undefined);
                }}>
                  <section className="cp-catalog-dialog" role="dialog" aria-modal="true" aria-labelledby="cp-catalog-dialog-title">
                    <div className="cp-catalog-dialog__head">
                      <div><span><PencilLine size={18} /></span><div><strong id="cp-catalog-dialog-title">{catalogDraft.id ? '목차 수정' : '새 목차 추가'}</strong><small>저장하면 모든 시공계획서 작성 화면에서 같은 목록을 사용합니다.</small></div></div>
                      <button type="button" onClick={() => setCatalogDraft(undefined)} disabled={catalogSaving} aria-label="목차 편집 닫기"><X size={17} /></button>
                    </div>
                    <div className="cp-catalog-dialog__form">
                      <label className="cp-catalog-dialog__wide"><span>목차 제목 *</span><input value={catalogDraft.title} onChange={(event) => setCatalogDraft((current) => current ? { ...current, title: event.target.value } : current)} placeholder="예: 현장별 추가 안전계획" autoFocus /></label>
                      <label><span>영문 제목</span><input value={catalogDraft.englishTitle} onChange={(event) => setCatalogDraft((current) => current ? { ...current, englishTitle: event.target.value } : current)} placeholder="예: ADDITIONAL SAFETY PLAN" /></label>
                      <label><span>목차 분류</span><select value={catalogDraft.group} onChange={(event) => setCatalogDraft((current) => current ? { ...current, group: event.target.value as ReferenceConstructionPlanSectionGroup } : current)}><option value="시공·장비 계획">시공·장비 계획</option><option value="도면·안전·품질 관리">도면·안전·품질 관리</option></select></label>
                      <label className="cp-catalog-dialog__wide"><span>연결할 원본 PDF 쪽 *</span><input value={catalogDraft.sourcePages} onChange={(event) => setCatalogDraft((current) => current ? { ...current, sourcePages: event.target.value } : current)} placeholder="예: 35 또는 39-40" /><small>{REFERENCE_CONSTRUCTION_PLAN_MIN_SOURCE_PAGE}~{REFERENCE_CONSTRUCTION_PLAN_MAX_SOURCE_PAGE}쪽 · 여러 쪽은 16, 17 또는 16-17 형식</small></label>
                    </div>
                    <div className="cp-catalog-dialog__actions">
                      <button type="button" className="cp-button cp-button--ghost" onClick={() => setCatalogDraft(undefined)} disabled={catalogSaving}>취소</button>
                      <button type="button" className="cp-button cp-button--primary" onClick={() => void saveCatalogDraft()} disabled={catalogSaving}>{catalogSaving ? <Loader2 size={15} className="cp-spin" /> : <Database size={15} />} 데이터베이스에 저장</button>
                    </div>
                  </section>
                </div>
              )}

              <section className="cp-drawing-upload-panel" aria-label="PDF 및 사진 도면 등록">
                <div className="cp-drawing-upload-panel__head">
                  <div><ImagePlus size={21} /><span><strong>PDF·사진 도면 등록</strong><small>PDF는 각 장마다, 사진은 한 장마다 A4 도면 영역에 비율을 유지해 자동 맞춤 등록됩니다.</small></span></div>
                  <div>
                    <input
                      ref={drawingInputRef}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
                      multiple
                      hidden
                      onChange={(event) => void handleDrawingFiles(event.target.files)}
                    />
                    <button type="button" className="cp-button cp-button--primary cp-button--small" onClick={() => drawingInputRef.current?.click()}><ImagePlus size={15} /> PDF·사진 여러 장 선택</button>
                  </div>
                </div>
                {drawingError && <div className="cp-form-error" role="alert"><AlertCircle size={16} />{drawingError}</div>}
                {uploadedDrawings.length > 0 ? (
                  <div className="cp-drawing-upload-list">
                    {uploadedDrawings.map((drawing, index) => (
                      <article key={drawing.id}>
                        <span className={`cp-drawing-upload-list__number${drawing.sourceType === 'image' ? ' is-image' : ''}`}>
                          {drawing.sourceType === 'image'
                            ? <img src={drawing.previewUrl} alt="" aria-hidden="true" />
                            : `D${String(index + 1).padStart(2, '0')}`}
                        </span>
                        <label>
                          <span>도면 제목</span>
                          <input value={drawing.title} onChange={(event) => updateDrawingTitle(drawing.id, event.target.value)} aria-label={`${index + 1}번 도면 제목`} />
                          <small className={drawing.sourceType === 'image' && drawing.pixelWidth && drawing.pixelHeight && estimateReferenceDrawingImagePrintDpi(drawing.pixelWidth, drawing.pixelHeight) < 150 ? 'is-warning' : undefined}>
                            {drawing.sourceType === 'image' && drawing.pixelWidth && drawing.pixelHeight
                              ? `${drawing.fileName} · ${drawing.pixelWidth}×${drawing.pixelHeight}px · 약 ${estimateReferenceDrawingImagePrintDpi(drawing.pixelWidth, drawing.pixelHeight)}DPI · A4 비율 유지 맞춤${estimateReferenceDrawingImagePrintDpi(drawing.pixelWidth, drawing.pixelHeight) < 150 ? ' · 저해상도 주의' : ' · 인쇄 적합'}`
                              : `${drawing.fileName} · PDF ${drawing.pageCount}장 → 최종 ${drawing.pageCount}쪽`}
                          </small>
                        </label>
                        <div className="cp-drawing-upload-list__actions">
                          <a href={drawing.previewUrl} target="_blank" rel="noreferrer" aria-label={`${drawing.title} 원본 미리보기`}><Eye size={15} /><span>미리보기</span></a>
                          <button type="button" onClick={() => moveUploadedDrawing(drawing.id, -1)} disabled={index === 0} aria-label={`${drawing.title} 도면 위로 이동`}><ArrowUp size={15} /></button>
                          <button type="button" onClick={() => moveUploadedDrawing(drawing.id, 1)} disabled={index === uploadedDrawings.length - 1} aria-label={`${drawing.title} 도면 아래로 이동`}><ArrowDown size={15} /></button>
                          <button type="button" onClick={() => removeUploadedDrawing(drawing.id)} aria-label={`${drawing.title} 도면 삭제`}><Trash2 size={15} /></button>
                        </div>
                      </article>
                    ))}
                    <div className="cp-drawing-upload-list__summary"><CheckCircle2 size={16} /><strong>PDF {uploadedPdfCount}개 · 사진 {uploadedImageCount}장 · 총 {uploadedDrawingPageCount}쪽 등록</strong><span>각 장은 목차와 A4 본문에 개별 등록됩니다.</span></div>
                  </div>
                ) : (
                  <div className="cp-drawing-upload-panel__empty"><ImagePlus size={22} /><div><strong>등록된 PDF·사진 도면이 없습니다</strong><p>PDF, JPG, PNG, WebP 도면을 여러 장 선택하면 A4 규격에 자동으로 맞춥니다.</p></div></div>
                )}
              </section>

              <section className="cp-toc-order-editor" aria-label="선택 목차 순서 편집">
                <div className="cp-toc-order-editor__head">
                  <div><GripVertical size={20} /><span><strong>선택 목차 순서</strong><small>끌어서 놓거나 화살표로 순서를 바꾸면 PDF 본문과 목차에 바로 반영됩니다.</small></span></div>
                  <button type="button" className="cp-button cp-button--ghost cp-button--small" onClick={restoreOriginalSectionOrder} disabled={!selectionReady}><RotateCcw size={15} /> DB 순서</button>
                </div>
                {form.siteAddress?.trim() || selectionReady ? (
                  <ol>
                    {form.siteAddress?.trim() && (
                      <li className={`cp-toc-order-editor__site-visuals${form.siteMapImageDataUrl ? ' has-map' : ''}`}>
                        <span className="cp-toc-order-editor__handle" aria-hidden="true"><MapPin size={16} /></span>
                        <span className="cp-toc-order-editor__number">01</span>
                        <button type="button" className="cp-toc-order-editor__title" onClick={() => setStep(2)}>
                          <strong>현장 위치 지도</strong>
                          <small className="cp-toc-order-editor__visual-status">
                            <span className={form.siteMapImageDataUrl ? 'is-complete' : 'is-live'}>{form.siteMapImageDataUrl ? '지도 이미지 등록' : '지도 링크 연결'}</span>
                            <span>PDF 3쪽</span>
                          </small>
                        </button>
                        <div className="cp-toc-order-editor__actions">
                          <button type="button" onClick={() => setStep(2)} aria-label="현장 위치 지도 수정"><PencilLine size={15} /></button>
                        </div>
                      </li>
                    )}
                    {selectedSections.map((item, index) => (
                      <li
                        key={item.id}
                        draggable
                        className={`${draggedSectionId === item.id ? 'is-dragging' : ''}${activeSection.id === item.id ? ' is-active' : ''}`}
                        onDragStart={() => setDraggedSectionId(item.id)}
                        onDragEnd={() => setDraggedSectionId(undefined)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => dropSelectedSection(item.id)}
                      >
                        <span className="cp-toc-order-editor__handle" aria-hidden="true"><GripVertical size={16} /></span>
                        <span className="cp-toc-order-editor__number">{String(index + 2).padStart(2, '0')}</span>
                        <button type="button" className="cp-toc-order-editor__title" onClick={() => showSectionPreview(item)}>
                          <strong>{item.title}</strong><small>DB 목록 {String(item.number).padStart(2, '0')} · 원본 {item.sourcePages.length > 1 ? `${item.sourcePages[0]}~${item.sourcePages[item.sourcePages.length - 1]}` : item.sourcePages[0]}쪽</small>
                        </button>
                        <div className="cp-toc-order-editor__actions">
                          <button type="button" onClick={() => moveSelectedSection(item.id, -1)} disabled={index === 0} aria-label={`${item.title} 위로 이동`}><ArrowUp size={15} /></button>
                          <button type="button" onClick={() => moveSelectedSection(item.id, 1)} disabled={index === selectedSections.length - 1} aria-label={`${item.title} 아래로 이동`}><ArrowDown size={15} /></button>
                          <button type="button" onClick={() => toggleSection(item.id)} aria-label={`${item.title} 목차 제외`}><X size={15} /></button>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : <p className="cp-toc-order-editor__empty">아래 목록에서 PDF에 넣을 목차를 선택해주세요.</p>}
              </section>

              <div className="cp-toc-selection-workspace">
                <div className="cp-toc-selection-list">
                  {(['시공·장비 계획', '도면·안전·품질 관리'] as const).map((group) => (
                    <section key={group}>
                      <div className="cp-toc-selection-group-title"><span>{group === '시공·장비 계획' ? 'PART 01' : 'PART 02'}</span><strong>{group}</strong></div>
                      <div>
                        {sectionCatalog.filter((item) => item.group === group).map((item) => {
                          const isSelected = selectedSectionIds.includes(item.id);
                          const isActive = activeSection.id === item.id;
                          return (
                            <article key={item.id} className={`${isSelected ? 'is-selected' : ''}${isActive ? ' is-active' : ''}`}>
                              <button type="button" className="cp-toc-selection-item__preview" onClick={() => showSectionPreview(item)}>
                                <span>{String(item.number).padStart(2, '0')}</span>
                                <div><strong>{item.title}</strong><small>원본 {item.sourcePages.length > 1 ? `${item.sourcePages[0]}~${item.sourcePages[item.sourcePages.length - 1]}` : item.sourcePages[0]}쪽 · {item.englishTitle}</small></div>
                                <Eye size={15} />
                              </button>
                              <div className="cp-toc-selection-item__controls">
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSection(item.id)}
                                    aria-label={`${item.title} PDF 포함`}
                                  />
                                  <span>{isSelected ? '포함' : '제외'}</span>
                                </label>
                                <div>
                                  <button type="button" onClick={() => openCatalogSectionEditor(item)} disabled={catalogSaving} aria-label={`${item.title} 목차 수정`}><PencilLine size={14} /></button>
                                  <button type="button" onClick={() => void deleteCatalogSection(item)} disabled={catalogSaving} aria-label={`${item.title} 목차 삭제`}><Trash2 size={14} /></button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>

                <aside className="cp-toc-page-preview" aria-label="선택 목차 원본 페이지 미리보기">
                  <div className="cp-toc-page-preview__head">
                    <div><small>원본 PDF 미리보기</small><strong>{String(activeSection.number).padStart(2, '0')}. {activeSection.title}</strong></div>
                    <span>{selectedSectionIds.includes(activeSection.id) ? 'PDF 포함' : 'PDF 제외'}</span>
                  </div>
                  <div className="cp-toc-page-preview__canvas">
                    <img
                      src={referenceConstructionPlanPagePreviewUrl(activePreviewPage)}
                      alt={`${activeSection.title} 원본 ${activePreviewPage}쪽 미리보기`}
                    />
                  </div>
                  <div className="cp-toc-page-preview__pager">
                    <button
                      type="button"
                      onClick={() => setPreviewPageIndex((current) => Math.max(0, current - 1))}
                      disabled={previewPageIndex === 0}
                      aria-label="이전 원본 페이지"
                    ><ChevronLeft size={16} /></button>
                    <span>원본 {activePreviewPage} / {REFERENCE_CONSTRUCTION_PLAN_PAGE_COUNT}쪽</span>
                    <button
                      type="button"
                      onClick={() => setPreviewPageIndex((current) => Math.min(activeSection.sourcePages.length - 1, current + 1))}
                      disabled={previewPageIndex >= activeSection.sourcePages.length - 1}
                      aria-label="다음 원본 페이지"
                    ><ChevronRight size={16} /></button>
                  </div>
                  <button
                    type="button"
                    className={`cp-button ${selectedSectionIds.includes(activeSection.id) ? 'cp-button--ghost' : 'cp-button--primary'}`}
                    onClick={() => toggleSection(activeSection.id)}
                  >
                    {selectedSectionIds.includes(activeSection.id) ? <X size={15} /> : <Check size={15} />}
                    {selectedSectionIds.includes(activeSection.id) ? '이 목차 PDF에서 제외' : '이 목차 PDF에 포함'}
                  </button>
                </aside>
              </div>

              <div className={`cp-toc-selection-note ${selectionReady ? 'is-ready' : 'is-error'}`}>
                <Layers3 size={18} />
                <div><strong>{selectionReady ? `선택 구성: DB 목차 ${selectedSections.length}개 · 업로드 도면 ${uploadedDrawingPageCount}장 · ${selectedPageCount}쪽` : 'DB 목차 또는 PDF·사진 도면을 1개 이상 등록해주세요'}</strong><p>PDF의 각 장과 사진 한 장은 목차 한 항목과 A4 한 페이지로 자동 등록됩니다.</p></div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="cp-branding-step">
              <div className="cp-branding-preview">
                <div className="cp-branding-preview__logo">
                  <img
                    src={customLogoDataUrl || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL}
                    alt={`${form.companyName || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY} 로고`}
                  />
                </div>
                <div>
                  <small>PDF 적용 브랜드</small>
                  <strong>{form.companyName || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_COMPANY}</strong>
                  <span>{customLogoDataUrl ? '사용자 등록 로고' : '첨부 원본 기본 로고'}</span>
                </div>
                <CheckCircle2 size={22} />
              </div>

              <section className="cp-cover-template-selector" aria-label="표지 디자인 선택">
                <div className="cp-cover-template-selector__head">
                  <div><Layers3 size={21} /><span><strong>표지 디자인 선택</strong><small>미리보기를 눌러 첫 페이지 디자인을 선택하세요. 실제 PDF 표지에 그대로 적용됩니다.</small></span></div>
                  <em>3가지 제공</em>
                </div>
                <div className="cp-cover-template-grid">
                  {COVER_TEMPLATES.map((template) => {
                    const isSelected = selectedCoverTemplate === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        className={`cp-cover-template-card${isSelected ? ' is-selected' : ''}`}
                        onClick={() => selectCoverTemplate(template.id)}
                        aria-pressed={isSelected}
                        aria-label={`${template.name} 표지 선택`}
                      >
                        <span className={`cp-cover-template-card__preview is-${template.id}`} aria-hidden="true">
                          {template.id === 'blueprint' ? (
                            <>
                              <img src={REFERENCE_CONSTRUCTION_PLAN_COVER_URL} alt="" />
                              <span className="cp-cover-thumb-brand"><img src={customLogoDataUrl || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL} alt="" />{form.companyName}</span>
                            </>
                          ) : template.id === 'executive' ? (
                            <>
                              <span className="cp-cover-thumb-brand"><img src={customLogoDataUrl || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL} alt="" />{form.companyName}</span>
                              <small>METHOD STATEMENT</small>
                              <b>시스템동바리<br />시공계획서</b>
                              <em>{form.documentNo} · REV.{form.revision}</em>
                            </>
                          ) : (
                            <>
                              <span className="cp-cover-thumb-side"><img src={customLogoDataUrl || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL} alt="" /><i>METHOD<br />STATEMENT</i></span>
                              <small>CONSTRUCTION PLAN</small>
                              <b>시스템동바리<br />시공계획서</b>
                              <em>{form.documentNo} · REV.{form.revision}</em>
                            </>
                          )}
                        </span>
                        <span className="cp-cover-template-card__copy">
                          <span><strong>{template.name}</strong><em>{template.tag}</em></span>
                          <small>{template.description}</small>
                        </span>
                        {isSelected && <span className="cp-cover-template-card__check"><Check size={15} /></span>}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="cp-branding-editor">
                <label className="cp-branding-company-field">
                  <span>상호 *</span>
                  <input value={form.companyName} onChange={(event) => updateText('companyName', event.target.value)} placeholder="회사 상호 입력" />
                  <small>표지, 문서관리표, 머리글과 꼬리글에 적용됩니다.</small>
                </label>

                <div className="cp-logo-uploader">
                  <div><ImagePlus size={25} /><strong>회사 로고 등록</strong><p>PNG, JPG, WebP · 최대 5MB</p></div>
                  <div className="cp-logo-uploader__actions">
                    <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void handleLogoFile(event.target.files?.[0])} />
                    <button type="button" className="cp-button cp-button--secondary" onClick={() => logoInputRef.current?.click()}><Upload size={15} /> 로고 파일 선택</button>
                    {customLogoDataUrl && <button type="button" className="cp-button cp-button--ghost" onClick={resetLogo}><X size={15} /> 기본 로고로 복원</button>}
                  </div>
                </div>
                {logoError && <div className="cp-form-error" role="alert"><AlertCircle size={16} />{logoError}</div>}

                <div className="cp-reference-preservation-note"><ShieldCheck size={19} /><div><strong>선택한 목차의 원본 내용은 로고를 바꿔도 그대로 유지됩니다</strong><p>선택한 표준 시공계획, 장비사용계획, 도면, 체크리스트 페이지의 내용은 변경하지 않고 회사 표시만 교체합니다.</p></div></div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="cp-reference-preview-step">
              <section className="cp-reference-quick-edit" aria-label="PDF 빠른 수정">
                <div><PencilLine size={19} /><span><strong>바로 수정하기</strong><small>필요한 항목만 고친 뒤 다시 PDF를 만들 수 있습니다.</small></span></div>
                <div>
                  <button type="button" onClick={() => setStep(1)}>로고·상호</button>
                  <button type="button" onClick={() => setStep(2)}>현장정보</button>
                  <button type="button" onClick={() => setStep(3)}>목차·순서</button>
                </div>
              </section>
              <div className="cp-reference-summary">
                <div><Building2 size={19} /><span><small>현장</small><strong>{form.siteName}</strong></span></div>
                <div><FileText size={19} /><span><small>문서</small><strong>{form.documentNo} · REV.{form.revision}</strong></span></div>
                <div><ListChecks size={19} /><span><small>선택 구성</small><strong>목차 {selectedSections.length}개 · 도면 {uploadedDrawingPageCount}장 · {selectedPageCount}쪽</strong></span></div>
              </div>

              {generating ? (
                <div className="cp-reference-preview-state"><Loader2 size={31} className="cp-spin" /><strong>DB 목차와 업로드 도면으로 PDF를 구성하고 있습니다</strong><p>업로드 도면 {uploadedDrawingPageCount}장을 장당 한 페이지로 배치해 {selectedPageCount}쪽 PDF를 만드는 중입니다.</p></div>
              ) : generationError ? (
                <div className="cp-reference-preview-state is-error" role="alert"><AlertCircle size={31} /><strong>PDF 생성 확인이 필요합니다</strong><p>{generationError}</p><button type="button" className="cp-button cp-button--secondary" onClick={() => void generatePdf()}><RefreshCw size={15} /> 다시 생성</button></div>
              ) : pdfUrl ? (
                <div className="cp-reference-pdf-frame">
                  <div className={`cp-reference-cover-preview is-${selectedCoverTemplate}`} aria-label="시스템동바리 시공계획서 A4 표지 미리보기">
                    {selectedCoverTemplate === 'blueprint' ? (
                      <>
                        <img src={REFERENCE_CONSTRUCTION_PLAN_COVER_URL} alt="첨부 원본 기반 A4 표지 미리보기" />
                        <div className="cp-reference-cover-header-brand"><img src={customLogoDataUrl || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL} alt="" /><span>{form.companyName}</span></div>
                        {customBranding && (
                          <>
                            <div className="cp-reference-cover-main-logo"><img src={customLogoDataUrl || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL} alt="" /></div>
                            <div className="cp-reference-cover-company-name">{form.companyName}</div>
                          </>
                        )}
                        <div className="cp-reference-cover-cell is-project">{form.projectName}</div>
                        <div className="cp-reference-cover-cell is-scope">{scopeSummary} / 현장 승인도서 적용</div>
                        <div className="cp-reference-cover-cell is-company">{form.companyName} (가설안전사업부)</div>
                        <div className="cp-reference-cover-cell is-date">{form.preparedDate.replaceAll('-', '. ')}.</div>
                        <div className="cp-reference-cover-cell is-document">{form.documentNo} / REV.{form.revision}</div>
                      </>
                    ) : selectedCoverTemplate === 'executive' ? (
                      <div className="cp-alternate-cover cp-alternate-cover--executive">
                        <div className="cp-alternate-cover__brand"><img src={customLogoDataUrl || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL} alt="" /><strong>{form.companyName}</strong></div>
                        <small>METHOD STATEMENT · REVISION CONTROLLED</small>
                        <h3>시스템동바리<br />시공계획서</h3>
                        <p>{form.projectName}</p>
                        <div className="cp-alternate-cover__meta"><span>DOCUMENT NO.<b>{form.documentNo}</b></span><span>REVISION<b>REV.{form.revision}</b></span><span>DATE<b>{form.preparedDate}</b></span></div>
                        <footer>{form.companyName}<small>CONSTRUCTION SAFETY DIVISION</small></footer>
                      </div>
                    ) : (
                      <div className="cp-alternate-cover cp-alternate-cover--minimal">
                        <aside><img src={customLogoDataUrl || REFERENCE_CONSTRUCTION_PLAN_DEFAULT_LOGO_URL} alt="" /><strong>{form.companyName}</strong><span>METHOD<br />STATEMENT</span></aside>
                        <div className="cp-alternate-cover__content"><small>CONSTRUCTION PLAN</small><h3>시스템동바리<br />시공계획서</h3><p>{form.projectName}</p><dl><div><dt>현장명</dt><dd>{form.siteName}</dd></div><div><dt>문서번호</dt><dd>{form.documentNo}</dd></div><div><dt>개정번호</dt><dd>REV.{form.revision}</dd></div><div><dt>작성일자</dt><dd>{form.preparedDate}</dd></div></dl></div>
                      </div>
                    )}
                  </div>
                  <div className="cp-reference-pdf-frame__footer">
                    <span><strong>{selectedCoverDefinition.name} 표지</strong> · 선택 구성 {selectedPageCount}쪽은 새 탭 또는 다운로드로 확인</span>
                    <a className="cp-button cp-button--secondary cp-button--small" href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 전체 PDF 보기</a>
                  </div>
                </div>
              ) : null}

              {pdfBlob && <div className="cp-reference-ready"><CheckCircle2 size={18} /><div><strong>선택 구성 PDF·Excel 준비 완료</strong><p>Excel의 ‘선택본문’ 시트에도 같은 목차 순서와 실제 기준 본문 페이지가 함께 들어갑니다. DB 목차 {selectedSections.length}개 · 업로드 도면 {uploadedDrawingPageCount}장 · PDF {selectedPageCount}쪽 구성입니다.</p></div></div>}
            </div>
          )}

          {generationError && step !== 4 && <div className="cp-form-error" role="alert"><AlertCircle size={16} />{generationError}</div>}

          <footer className="cp-wizard-actions">
            <button
              type="button"
              className="cp-button cp-button--ghost"
              onClick={() => step === 1 ? navigate('/construction-plans/manage') : setStep((current) => Math.max(1, current - 1))}
            >
              <ArrowLeft size={16} />{step === 1 ? '문서 관리' : '이전'}
            </button>
            <div>
              <span>{step}/4 단계</span>
              {step < 4 ? (
                <button
                  type="button"
                  className="cp-button cp-button--primary"
                  disabled={
                    (step === 1 && !brandingReady)
                    || (step === 2 && !directInputReady)
                    || (step === 3 && !selectionReady)
                    || generating
                  }
                  onClick={() => void moveToStep(step + 1)}
                >
                  {step === 1
                    ? '다음: 현장정보 직접입력'
                    : step === 2
                      ? '다음: 목차 선택·미리보기'
                      : '다음: PDF 구성 확인'} <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="cp-button cp-button--secondary cp-button--create"
                    disabled={!directInputReady || !brandingReady || !selectionReady || excelGenerating}
                    onClick={() => void downloadExcel()}
                  >
                    {excelGenerating ? <Loader2 size={16} className="cp-spin" /> : <FileSpreadsheet size={16} />}
                    {excelGenerating ? 'Excel 생성 중...' : 'Excel 다운로드'}
                  </button>
                  <button
                    type="button"
                    className="cp-button cp-button--primary cp-button--create"
                    disabled={!pdfBlob || generating}
                    onClick={downloadPdf}
                  >
                    {generating ? <Loader2 size={16} className="cp-spin" /> : <Download size={16} />}
                    {generating ? 'PDF 생성 중...' : `${selectedPageCount}쪽 PDF 다운로드`}
                  </button>
                </>
              )}
            </div>
          </footer>
          {excelError && step === 4 && <div className="cp-form-error" role="alert"><AlertCircle size={16} />{excelError}</div>}
        </section>
      </div>
    </main>
  );
}

export default ConstructionPlanCreatePage;
