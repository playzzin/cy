import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Crop,
  Database,
  Download,
  Eye,
  FileArchive,
  FileImage,
  ImageDown,
  Images,
  Loader2,
  LockKeyhole,
  Plus,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  UserCheck,
  UsersRound,
  WandSparkles,
  X,
} from 'lucide-react';
import IdentityCropEditor from '../../components/identity/IdentityCropEditor';
import { identityBundleService } from '../../services/identityBundleService';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { storageService } from '../../services/storageService';
import type {
  IdentityBundleOutputOptions,
  IdentityCorrectionMode,
  IdentityDocumentAnalysis,
  IdentityOutputPreset,
  IdentityPersonGroup,
  IdentityPerspectiveQuad,
  IdentityUploadItem,
} from '../../types/identityBundle';
import {
  buildIdentityBundleManifestCsv,
  buildIdentityPersonGroups,
  createUniqueIdentityBundleFileName,
  sanitizeIdentityBundleFileName,
} from '../../utils/identityBundleUtils';
import { renderIdentityBundleBlob } from '../../utils/identityBundleComposer';
import { compressIdentityImageForStorage } from '../../utils/identityImageCompression';
import './IdentityBundlePage.css';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  RESIDENT_CARD: '주민등록증',
  DRIVERS_LICENSE: '운전면허증',
  PASSPORT: '여권',
  SAFETY_EDUCATION: '안전교육이수증',
  SCAFFOLD_TRAINING: '비계교육이수증',
  FOREIGN_REGISTRATION: '외국인등록증',
  CONSTRUCTION_WORKER_CARD: '건설근로자 카드',
  OTHER_ID: '기타 신분·자격증',
};

const OUTPUT_PRESETS: Array<{ value: IdentityOutputPreset; label: string; detail: string }> = [
  { value: 'A4_300', label: '자동 맞춤 · 고화질', detail: '최대 2480 × 3508' },
  { value: 'A4_150', label: '자동 맞춤 · 가벼운 파일', detail: '최대 1240 × 1754' },
  { value: 'MOBILE', label: '카카오·모바일 제출용', detail: '최대 2000 × 2828' },
];

const makeItemId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const buildReviewReasons = (documents: IdentityDocumentAnalysis[]): string[] => Array.from(new Set([
  ...documents.flatMap((document) => document.warnings || []),
  ...documents.filter((document) => !document.personName).map(() => '이름을 읽지 못한 문서가 있습니다.'),
  ...documents.filter((document) => document.matchingConfidence < 0.72).map(() => '동일인 판별 신뢰도가 낮습니다.'),
]));

interface PendingGroupAction {
  document: IdentityDocumentAnalysis;
  sourceGroupId: string;
  nextGroupId: string;
}

type IdentityRegistrationMode = 'new' | 'update';

interface IdentityRegistrationPreview {
  groupId: string;
  blob: Blob;
  previewUrl: string;
  name: string;
  idNumber: string;
  address: string;
  mode: IdentityRegistrationMode;
  workerId: string;
  matchMessage: string;
  analysisComplete: boolean;
  analysisError: string;
}

const normalizeIdentityNumber = (value: unknown): string =>
  String(value || '').replace(/[^0-9a-z]/gi, '').toLowerCase();

const resolveWorkerMatch = (
  workers: Worker[],
  name: string,
  idNumber: string,
): { worker?: Worker; message: string } => {
  const normalizedId = normalizeIdentityNumber(idNumber);
  if (normalizedId.length >= 6) {
    const worker = workers.find((candidate) => (
      normalizeIdentityNumber(candidate.idNumber || (candidate as Worker & { residentNumber?: string }).residentNumber) === normalizedId
    ));
    if (worker) return { worker, message: '주민·외국인번호가 일치하는 기존 작업자를 찾았습니다.' };
  }

  const normalizedName = name.replace(/\s+/g, '').toLowerCase();
  const nameMatches = normalizedName
    ? workers.filter((candidate) => String(candidate.name || '').replace(/\s+/g, '').toLowerCase() === normalizedName)
    : [];
  if (nameMatches.length === 1) {
    return { worker: nameMatches[0], message: '이름이 같은 기존 작업자 1명을 찾았습니다. 번호를 확인해 주세요.' };
  }
  if (nameMatches.length > 1) {
    return { message: `이름이 같은 작업자가 ${nameMatches.length}명 있습니다. 업데이트 대상을 직접 선택해 주세요.` };
  }
  return { message: '일치하는 기존 작업자가 없어 신규 등록으로 준비했습니다.' };
};

const getPersonnelDetails = (group: IdentityPersonGroup): Array<{ label: string; value: string }> => {
  const firstValue = (field: keyof IdentityDocumentAnalysis): string =>
    String(group.documents.find((document) => document[field])?.[field] || '');
  return [
    { label: '생년월일', value: firstValue('birthDate') },
    { label: '주민·외국인번호', value: firstValue('identityNumber') },
    { label: '주소', value: firstValue('address') },
    { label: '국적', value: firstValue('nationality') },
    { label: '여권·면허·이수증 번호', value: firstValue('documentNumber') },
    { label: '유효기간', value: firstValue('expirationDate') },
  ].filter((detail) => detail.value);
};

const IdentityBundlePage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<IdentityUploadItem[]>([]);
  const [items, setItems] = useState<IdentityUploadItem[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [verifiedGroupIds, setVerifiedGroupIds] = useState<Record<string, boolean>>({});
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);
  const [pendingGroupAction, setPendingGroupAction] = useState<PendingGroupAction | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadingGroupId, setDownloadingGroupId] = useState('');
  const [previewLoadingGroupId, setPreviewLoadingGroupId] = useState('');
  const [registrationPreview, setRegistrationPreview] = useState<IdentityRegistrationPreview | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [registrationAnalyzing, setRegistrationAnalyzing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registrationProgress, setRegistrationProgress] = useState('');
  const [progressText, setProgressText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [outputOptions, setOutputOptions] = useState<IdentityBundleOutputOptions>({
    preset: 'A4_300',
    includeHeader: false,
    jpegQuality: 0.94,
  });

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  useEffect(() => () => {
    if (registrationPreview?.previewUrl) URL.revokeObjectURL(registrationPreview.previewUrl);
  }, [registrationPreview?.previewUrl]);

  const analyzedDocuments = useMemo(
    () => items.map((item) => item.analysis).filter((value): value is IdentityDocumentAnalysis => Boolean(value)),
    [items],
  );

  const groups = useMemo<IdentityPersonGroup[]>(() => {
    const clustered = new Map<string, IdentityDocumentAnalysis[]>();
    analyzedDocuments.forEach((document) => {
      const groupId = assignments[document.fileIndex] || `person-${document.fileIndex}`;
      clustered.set(groupId, [...(clustered.get(groupId) || []), document]);
    });
    return Array.from(clustered.entries())
      .map(([id, documents]) => {
        const sorted = [...documents].sort((left, right) => left.fileIndex - right.fileIndex);
        const reviewReasons = buildReviewReasons(sorted);
        return {
          id,
          personName: groupNames[id] || sorted.find((document) => document.personName)?.personName || '이름 미확인',
          birthDate: sorted.find((document) => document.birthDate)?.birthDate || '',
          identityHash: sorted.find((document) => document.identityHash)?.identityHash || '',
          documents: sorted,
          requiresReview: reviewReasons.length > 0,
          reviewReasons,
        };
      })
      .sort((left, right) => left.documents[0].fileIndex - right.documents[0].fileIndex);
  }, [analyzedDocuments, assignments, groupNames]);

  const resetAnalysis = (nextItems: IdentityUploadItem[]) => {
    setItems(nextItems.map((item) => ({ ...item, status: 'queued', analysis: undefined, error: undefined })));
    setAssignments({});
    setGroupNames({});
    setVerifiedGroupIds({});
    setEditingFileIndex(null);
    setPendingGroupAction(null);
    setErrorMessage('');
    setSuccessMessage('');
    setProgressText('');
  };

  const addFiles = (selected: File[]) => {
    if (selected.length === 0) return;
    const existingKeys = new Set(items.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
    const accepted = selected.filter((file) => !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`));
    if (items.length + accepted.length > 60) {
      setErrorMessage('한 번에 최대 60장까지 올릴 수 있습니다. 파일 수를 줄여 주세요.');
      return;
    }
    try {
      identityBundleService.validateFiles([...items.map((item) => item.file), ...accepted]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '파일을 추가하지 못했습니다.');
      return;
    }
    const created: IdentityUploadItem[] = accepted.map((file) => ({
      id: makeItemId(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'queued',
    }));
    resetAnalysis([...items, ...created]);
  };

  const removeItem = (id: string) => {
    if (busy) return;
    const target = items.find((item) => item.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    resetAnalysis(items.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    if (busy) return;
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    resetAnalysis([]);
  };

  const analyze = async () => {
    setBusy(true);
    setErrorMessage('');
    setSuccessMessage('');
    setItems((current) => current.map((item) => ({ ...item, status: 'analyzing', error: undefined })));
    try {
      const documents = await identityBundleService.analyzeFiles(
        items.map((item) => item.file),
        (progress) => {
          const percent = Math.round((progress.completedFiles / Math.max(1, progress.totalFiles)) * 100);
          setProgressText(`Gemini가 이름과 문서 영역만 빠르게 확인하고 있습니다 · ${percent}%`);
        },
      );
      const byIndex = new Map(documents.map((document) => [document.fileIndex, document]));
      setItems((current) => current.map((item, index) => ({
        ...item,
        status: byIndex.has(index) ? 'completed' : 'failed',
        analysis: byIndex.get(index),
        error: byIndex.has(index) ? undefined : '분석 결과가 없습니다.',
      })));

      const autoGroups = buildIdentityPersonGroups(documents);
      const nextAssignments: Record<number, string> = {};
      const nextNames: Record<string, string> = {};
      autoGroups.forEach((group) => {
        nextNames[group.id] = group.personName;
        group.documents.forEach((document) => { nextAssignments[document.fileIndex] = group.id; });
      });
      setAssignments(nextAssignments);
      setGroupNames(nextNames);
      setVerifiedGroupIds({});
      setProgressText('');
      setSuccessMessage(`${documents.length}장 빠른 묶기 완료 · ${autoGroups.length}명으로 분류했습니다. 묶음사진을 미리본 뒤 필요한 사람만 상세 분석하세요.`);
    } catch (error) {
      setItems((current) => current.map((item) => ({ ...item, status: 'failed' })));
      setProgressText('');
      setErrorMessage(error instanceof Error ? error.message : '신분증 분석에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const moveDocument = (document: IdentityDocumentAnalysis, sourceGroupId: string, nextGroupId: string) => {
    if (nextGroupId === '__new__') {
      const newGroupId = `manual-${Date.now()}-${document.fileIndex}`;
      setAssignments((current) => ({ ...current, [document.fileIndex]: newGroupId }));
      setGroupNames((current) => ({
        ...current,
        [newGroupId]: document.personName ? `${document.personName} (분리)` : '새 사람',
      }));
      setVerifiedGroupIds((current) => ({ ...current, [sourceGroupId]: false, [newGroupId]: false }));
      return;
    }
    setAssignments((current) => ({ ...current, [document.fileIndex]: nextGroupId }));
    setVerifiedGroupIds((current) => ({ ...current, [sourceGroupId]: false, [nextGroupId]: false }));
  };

  const confirmPendingGroupAction = () => {
    if (!pendingGroupAction) return;
    moveDocument(
      pendingGroupAction.document,
      pendingGroupAction.sourceGroupId,
      pendingGroupAction.nextGroupId,
    );
    setPendingGroupAction(null);
    setSuccessMessage(pendingGroupAction.nextGroupId === '__new__'
      ? '선택한 문서를 새 사람 묶음으로 분리했습니다.'
      : '선택한 문서를 확인한 사람 묶음으로 합쳤습니다.');
  };

  const saveDocumentCorrection = (
    fileIndex: number,
    perspectiveQuad: IdentityPerspectiveQuad | undefined,
    correctionMode: IdentityCorrectionMode,
  ) => {
    setItems((current) => current.map((item, index) => (
      index === fileIndex && item.analysis
        ? {
          ...item,
          analysis: {
            ...item.analysis,
            correctionMode,
            perspectiveQuad,
          },
        }
        : item
    )));
    const affectedGroupId = assignments[fileIndex];
    if (affectedGroupId) setVerifiedGroupIds((current) => ({ ...current, [affectedGroupId]: false }));
    setEditingFileIndex(null);
    setSuccessMessage(correctionMode === 'MANUAL'
      ? '수동 자르기와 원근 보정을 적용했습니다.'
      : correctionMode === 'ORIGINAL'
        ? '이 문서는 원본 전체를 사용합니다.'
        : 'AI 자동 문서 영역으로 되돌렸습니다.');
  };

  const filesByIndex = useMemo(
    () => new Map(items.map((item, index) => [index, item.file])),
    [items],
  );

  const openRegistrationPreview = async (group: IdentityPersonGroup) => {
    setPreviewLoadingGroupId(group.id);
    setErrorMessage('');
    try {
      const blob = await renderIdentityBundleBlob(group, filesByIndex, outputOptions);
      const name = group.personName === '이름 미확인' ? '' : group.personName;
      setRegistrationPreview({
        groupId: group.id,
        blob,
        previewUrl: URL.createObjectURL(blob),
        name,
        idNumber: '',
        address: '',
        mode: 'new',
        workerId: '',
        matchMessage: '2단계 AI 상세 분석 전입니다. 묶음사진을 먼저 확인해 주세요.',
        analysisComplete: false,
        analysisError: '',
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '미리보기 이미지를 만들지 못했습니다.');
    } finally {
      setPreviewLoadingGroupId('');
    }
  };

  const closeRegistrationPreview = () => {
    if (registering || registrationAnalyzing) return;
    setRegistrationPreview(null);
    setRegistrationProgress('');
  };

  const updateRegistrationPreview = (updates: Partial<IdentityRegistrationPreview>) => {
    setRegistrationPreview((current) => current ? { ...current, ...updates } : current);
  };

  const analyzeRegistrationPreview = async () => {
    if (!registrationPreview || registrationAnalyzing || registering) return;
    const preview = registrationPreview;
    setRegistrationAnalyzing(true);
    setErrorMessage('');
    setRegistrationProgress('AI가 묶음사진에서 이름·주민번호·주소를 분석하고 있습니다.');
    updateRegistrationPreview({ analysisError: '' });
    try {
      const analysisFile = new File(
        [preview.blob],
        `${sanitizeIdentityBundleFileName(preview.name)}_신분증묶음.jpg`,
        { type: 'image/jpeg' },
      );
      const [analysis, workerRows] = await Promise.all([
        identityBundleService.analyzeRegistrationPreview(analysisFile),
        manpowerService.getWorkers(),
      ]);
      const name = analysis.name || preview.name;
      const match = resolveWorkerMatch(workerRows, name, analysis.idNumber);
      setWorkers(workerRows);
      setRegistrationPreview((current) => current?.groupId === preview.groupId ? {
        ...current,
        name,
        idNumber: analysis.idNumber,
        address: analysis.address,
        mode: match.worker ? 'update' : 'new',
        workerId: String(match.worker?.id || ''),
        matchMessage: match.message,
        analysisComplete: true,
        analysisError: '',
      } : current);
      setRegistrationProgress('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '묶음사진 인적정보 분석에 실패했습니다.';
      setRegistrationPreview((current) => current?.groupId === preview.groupId ? {
        ...current,
        analysisComplete: false,
        analysisError: message,
      } : current);
      setRegistrationProgress('');
    } finally {
      setRegistrationAnalyzing(false);
    }
  };

  const registerPreviewInWorkerDatabase = async () => {
    if (!registrationPreview || registering) return;
    if (!registrationPreview.analysisComplete) {
      setErrorMessage('묶음사진의 2단계 AI 인적정보 분석을 먼저 완료해 주세요.');
      return;
    }
    const name = registrationPreview.name.trim();
    if (!name) {
      setErrorMessage('통합DB에 등록할 작업자 이름을 입력해 주세요.');
      return;
    }
    if (registrationPreview.mode === 'update' && !registrationPreview.workerId) {
      setErrorMessage('업데이트할 기존 작업자를 선택해 주세요.');
      return;
    }

    const targetWorker = workers.find((worker) => String(worker.id || '') === registrationPreview.workerId);
    const actionLabel = registrationPreview.mode === 'new'
      ? `${name} 작업자를 통합DB에 신규 등록`
      : `${targetWorker?.name || name} 작업자의 신분증과 인적정보를 업데이트`;
    if (!window.confirm(`${actionLabel}할까요?\n미리보기 이미지는 가볍게 압축한 뒤 저장됩니다.`)) return;

    setRegistering(true);
    setErrorMessage('');
    setRegistrationProgress('저장용 이미지를 가볍게 변환하고 있습니다.');
    let uploadedPath = '';
    let databaseCommitted = false;
    try {
      const compressed = await compressIdentityImageForStorage(
        registrationPreview.blob,
        `${Date.now()}_${makeItemId()}_${sanitizeIdentityBundleFileName(name)}_신분증묶음.jpg`,
      );
      setRegistrationProgress(`이미지 업로드 중 · ${formatBytes(compressed.file.size)}`);
      const uploadResult = await storageService.uploadFileInfo(
        'id_cards',
        compressed.file,
        (progress) => setRegistrationProgress(`이미지 업로드 중 · ${Math.round(progress)}%`),
        {
          includeDownloadUrl: false,
          metadata: {
            contentType: 'image/jpeg',
            customMetadata: {
              source: 'identity-bundle-preview',
              optimized: 'true',
              dimensions: `${compressed.width}x${compressed.height}`,
            },
          },
        },
      );
      uploadedPath = uploadResult.fullPath;

      if (registrationPreview.mode === 'new') {
        await manpowerService.addWorker({
          name,
          idNumber: registrationPreview.idNumber.trim(),
          address: registrationPreview.address.trim(),
          role: '작업자',
          teamType: '미배정',
          status: '미배정',
          unitPrice: 0,
          fileNameSaved: uploadedPath,
        });
      } else {
        const updates: Partial<Worker> = { fileNameSaved: uploadedPath };
        if (registrationPreview.name.trim()) updates.name = registrationPreview.name.trim();
        if (registrationPreview.idNumber.trim()) updates.idNumber = registrationPreview.idNumber.trim();
        if (registrationPreview.address.trim()) updates.address = registrationPreview.address.trim();
        await manpowerService.updateWorker(registrationPreview.workerId, updates);
      }
      databaseCommitted = true;

      const reduction = registrationPreview.blob.size > 0
        ? Math.max(0, Math.round((1 - compressed.file.size / registrationPreview.blob.size) * 100))
        : 0;
      setSuccessMessage(`${actionLabel}했습니다. 저장 이미지 ${formatBytes(compressed.file.size)}${reduction > 0 ? ` · ${reduction}% 절감` : ''}`);
      setRegistrationPreview(null);
      setRegistrationProgress('');
      try {
        setWorkers(await manpowerService.getWorkers(true));
      } catch (refreshError) {
        console.warn('Worker registration succeeded but worker cache refresh failed:', refreshError);
      }
    } catch (error) {
      if (uploadedPath && !databaseCommitted) {
        try {
          await storageService.deleteFile(uploadedPath);
        } catch (cleanupError) {
          console.warn('Failed to clean up identity image after registration error:', cleanupError);
        }
      }
      setErrorMessage(error instanceof Error ? error.message : '통합DB 작업자 등록에 실패했습니다.');
      setRegistrationProgress('');
    } finally {
      setRegistering(false);
    }
  };

  const downloadGroup = async (group: IdentityPersonGroup) => {
    setDownloadingGroupId(group.id);
    setErrorMessage('');
    try {
      const blob = await renderIdentityBundleBlob(group, filesByIndex, outputOptions);
      downloadBlob(blob, `${sanitizeIdentityBundleFileName(group.personName)}_신분증묶음.jpg`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '결과 이미지를 만들지 못했습니다.');
    } finally {
      setDownloadingGroupId('');
    }
  };

  const downloadAll = async () => {
    setDownloadingGroupId('__all__');
    setErrorMessage('');
    try {
      const zip = new JSZip();
      const usedNames = new Map<string, number>();
      const manifestRows: Array<{
        personName: string;
        documentCount: number;
        confirmed: boolean;
        outputFileName: string;
        originalFileNames: string[];
      }> = [];
      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        setProgressText(`묶음사진 생성 중 · ${index + 1}/${groups.length}`);
        const blob = await renderIdentityBundleBlob(group, filesByIndex, outputOptions);
        const confirmed = Boolean(verifiedGroupIds[group.id]);
        const outputFileName = createUniqueIdentityBundleFileName(
          group.personName,
          usedNames,
          confirmed ? '' : '미확인_',
        );
        zip.file(outputFileName, blob);
        manifestRows.push({
          personName: group.personName,
          documentCount: group.documents.length,
          confirmed,
          outputFileName,
          originalFileNames: group.documents.map((document) => document.originalFileName),
        });
      }
      zip.file('묶음목록.csv', buildIdentityBundleManifestCsv(manifestRows));
      const archive = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (metadata) => setProgressText(`ZIP 압축 중 · ${Math.round(metadata.percent)}%`),
      );
      downloadBlob(archive, `신분증_묶음사진_${new Date().toISOString().slice(0, 10)}.zip`);
      setSuccessMessage(`${groups.length}명의 묶음사진을 ZIP으로 만들었습니다.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'ZIP 파일을 만들지 못했습니다.');
    } finally {
      setProgressText('');
      setDownloadingGroupId('');
    }
  };

  const analysisComplete = analyzedDocuments.length > 0 && analyzedDocuments.length === items.length;
  const reviewCount = groups.filter((group) => !verifiedGroupIds[group.id]).length;
  const editingItem = editingFileIndex === null ? undefined : items[editingFileIndex];
  const pendingSourceGroup = pendingGroupAction
    ? groups.find((group) => group.id === pendingGroupAction.sourceGroupId)
    : undefined;
  const pendingTargetGroup = pendingGroupAction && pendingGroupAction.nextGroupId !== '__new__'
    ? groups.find((group) => group.id === pendingGroupAction.nextGroupId)
    : undefined;
  const pendingDocumentItem = pendingGroupAction ? items[pendingGroupAction.document.fileIndex] : undefined;

  return (
    <main className="identity-bundle-page">
      <section className="identity-bundle-hero">
        <div className="identity-bundle-hero__glow" />
        <div className="identity-bundle-hero__content">
          <div className="identity-bundle-eyebrow"><Sparkles size={14} /> AI DOCUMENT STUDIO</div>
          <h1>신분증 묶음사진</h1>
          <p>1차 AI로 사진을 빠르게 묶고 완성 이미지를 먼저 확인하세요.<br className="identity-desktop-break" /> DB 등록할 묶음만 2차 AI가 인적정보를 상세 분석합니다.</p>
          <div className="identity-bundle-hero__chips">
            <span><Check size={14} /> 최대 60장</span>
            <span><Check size={14} /> 빈틈 없는 자동 맞춤</span>
            <span><Check size={14} /> 사람별 자동 묶음</span>
          </div>
        </div>
        <div className="identity-bundle-hero__visual" aria-hidden="true">
          <div className="identity-visual-card identity-visual-card--back"><span>SAFETY PASS</span></div>
          <div className="identity-visual-card identity-visual-card--mid"><span>DRIVER LICENSE</span></div>
          <div className="identity-visual-card identity-visual-card--front">
            <div className="identity-visual-avatar"><UserRound size={25} /></div>
            <div><strong>ID BUNDLE</strong><span>AI SORTED</span></div>
            <ScanLine className="identity-scan-line" size={88} />
          </div>
        </div>
      </section>

      <section className="identity-bundle-workspace">
        <div className="identity-stepper" aria-label="작업 단계">
          {[
            { number: '01', title: '사진 올리기', detail: `${items.length}장 선택됨`, done: items.length > 0 },
            { number: '02', title: '빠른 AI 묶기', detail: analysisComplete ? `${groups.length}명 분류됨` : '이름·문서영역만 분석', done: analysisComplete },
            { number: '03', title: '미리보기·DB 등록', detail: '선택 묶음만 상세 분석', done: false },
          ].map((step, index) => (
            <React.Fragment key={step.number}>
              <div className={`identity-step ${step.done ? 'is-done' : ''} ${index === 0 && items.length === 0 ? 'is-current' : ''} ${index === 1 && items.length > 0 && !analysisComplete ? 'is-current' : ''} ${index === 2 && analysisComplete ? 'is-current' : ''}`}>
                <span className="identity-step__number">{step.done ? <Check size={16} /> : step.number}</span>
                <span><strong>{step.title}</strong><small>{step.detail}</small></span>
              </div>
              {index < 2 && <ArrowRight className="identity-step__arrow" size={17} />}
            </React.Fragment>
          ))}
        </div>

        {errorMessage && (
          <div className="identity-message identity-message--error" role="alert">
            <AlertCircle size={18} /><span>{errorMessage}</span><button onClick={() => setErrorMessage('')} aria-label="닫기"><X size={16} /></button>
          </div>
        )}
        {successMessage && (
          <div className="identity-message identity-message--success">
            <CheckCircle2 size={18} /><span>{successMessage}</span><button onClick={() => setSuccessMessage('')} aria-label="닫기"><X size={16} /></button>
          </div>
        )}
        {progressText && (
          <div className="identity-message identity-message--progress">
            <Loader2 className="identity-spin" size={18} /><span>{progressText}</span>
          </div>
        )}

        <div className="identity-work-grid">
          <section className="identity-panel identity-upload-panel">
            <div className="identity-panel__heading">
              <div><span className="identity-section-kicker">UPLOAD</span><h2>신분증 사진 올리기</h2></div>
              {items.length > 0 && <button className="identity-text-button" onClick={clearAll} disabled={busy}><Trash2 size={14} /> 전체 비우기</button>}
            </div>

            <input
              ref={fileInputRef}
              className="identity-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={(event) => {
                addFiles(Array.from(event.target.files || []));
                event.target.value = '';
              }}
            />
            <button
              className={`identity-dropzone ${isDragging ? 'is-dragging' : ''}`}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFiles(Array.from(event.dataTransfer.files || []));
              }}
              disabled={busy}
            >
              <span className="identity-dropzone__icon"><UploadCloud size={28} /></span>
              <strong>사진을 여기로 끌어오세요</strong>
              <span>또는 눌러서 여러 장 선택</span>
              <small>주민등록증 · 안전교육이수증 · 운전면허증 · 비계교육이수증 · 여권 등</small>
            </button>

            {items.length > 0 && (
              <div className="identity-file-list">
                <div className="identity-file-list__summary">
                  <span><Images size={16} /> 업로드 목록</span>
                  <strong>{items.length}<small>/60장</small></strong>
                </div>
                <div className="identity-file-list__items">
                  {items.map((item, index) => (
                    <div className="identity-file-row" key={item.id}>
                      <div className="identity-file-thumb"><img src={item.previewUrl} alt="" /></div>
                      <span className="identity-file-order">{String(index + 1).padStart(2, '0')}</span>
                      <div className="identity-file-info">
                        <strong>{item.file.name}</strong>
                        <span>{formatBytes(item.file.size)}{item.analysis ? ` · ${item.analysis.documentLabel || DOCUMENT_TYPE_LABELS[item.analysis.documentType]}` : ''}</span>
                      </div>
                      <span className={`identity-status-dot is-${item.status}`} title={item.status} />
                      <button onClick={() => removeItem(item.id)} disabled={busy} aria-label={`${item.file.name} 삭제`}><X size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="identity-internal-mode">
              <ShieldCheck size={17} />
              <span><strong>두 번으로 나눈 빠른 분석</strong><small>1차는 이름·문서영역만 확인하고, 미리보기에서 DB 등록할 묶음만 주민번호·주소를 2차 분석합니다.</small></span>
            </div>

            <button className="identity-primary-button" onClick={analyze} disabled={busy || items.length === 0}>
              {busy ? <><Loader2 className="identity-spin" size={19} /> 빠르게 묶는 중</> : <><WandSparkles size={19} /> 1단계 · 빠르게 분석하고 묶기</>}
            </button>
          </section>

          <aside className="identity-side-stack">
            <section className="identity-panel identity-privacy-panel">
              <span className="identity-privacy-icon"><LockKeyhole size={21} /></span>
              <div><span className="identity-section-kicker">INTERNAL HR MODE</span><h3>사내 원문 처리 방식</h3></div>
              <ul>
                <li><ShieldCheck size={16} /><span><strong>가림 처리 안 함</strong>번호·주소·사진을 원문 그대로 유지</span></li>
                <li><ScanLine size={16} /><span><strong>선택 묶음만 상세 판독</strong>미리보기에서 이름·주민번호·주소 분석</span></li>
                <li><LockKeyhole size={16} /><span><strong>선택한 결과만 저장</strong>DB에 등록한 묶음사진만 압축 저장</span></li>
              </ul>
            </section>
            <section className="identity-panel identity-format-panel">
              <div className="identity-panel__heading"><div><span className="identity-section-kicker">OUTPUT</span><h3>출력 규격</h3></div></div>
              <div className="identity-preset-list">
                {OUTPUT_PRESETS.map((preset) => (
                  <button key={preset.value} className={outputOptions.preset === preset.value ? 'is-selected' : ''} onClick={() => setOutputOptions((current) => ({ ...current, preset: preset.value }))}>
                    <span className="identity-radio"><span /></span><span><strong>{preset.label}</strong><small>{preset.detail}px · JPG</small></span>
                  </button>
                ))}
              </div>
              <div className="identity-tight-output-note">
                <ScanLine size={15} />
                <span><strong>문서 모서리를 모두 살려 출력</strong><small>원래 비율 유지 · 문서 사이 여백 0px · 빈 공간 자동 제거</small></span>
              </div>
              <label className="identity-toggle-row">
                <span><strong>상단에 이름 표시</strong><small>끄면 신분증 이미지만 출력</small></span>
                <input type="checkbox" checked={outputOptions.includeHeader} onChange={(event) => setOutputOptions((current) => ({ ...current, includeHeader: event.target.checked }))} />
                <span className="identity-toggle" />
              </label>
            </section>
          </aside>
        </div>

        {analysisComplete && (
          <section className="identity-results-section">
            <div className="identity-results-header">
              <div>
                <span className="identity-section-kicker">RESULT</span>
                <h2>사람별 묶음 결과</h2>
                <p>먼저 완성된 묶음사진을 확인하세요. 통합DB 등록을 선택한 묶음만 인적정보를 2차 분석합니다.</p>
              </div>
              <div className="identity-result-actions">
                <span className="identity-result-stat"><UsersRound size={17} /><strong>{groups.length}</strong>명</span>
                {reviewCount > 0 && <span className="identity-result-stat is-warning"><AlertCircle size={16} /><strong>{reviewCount}</strong>명 미확인</span>}
                <button className="identity-zip-button" onClick={downloadAll} disabled={Boolean(downloadingGroupId)}>
                  {downloadingGroupId === '__all__' ? <Loader2 className="identity-spin" size={17} /> : <FileArchive size={17} />} 전체 ZIP 받기
                </button>
              </div>
            </div>

            <div className="identity-group-grid">
              {groups.map((group, groupIndex) => (
                <article className="identity-group-card" key={group.id}>
                  <div className="identity-group-card__top">
                    <span className="identity-person-avatar"><UserRound size={19} /></span>
                    <div className="identity-person-heading">
                      <span>PERSON {String(groupIndex + 1).padStart(2, '0')}</span>
                      <input
                        value={group.personName}
                        aria-label="사람 이름"
                        onChange={(event) => {
                          setGroupNames((current) => ({ ...current, [group.id]: event.target.value }));
                          setVerifiedGroupIds((current) => ({ ...current, [group.id]: false }));
                        }}
                      />
                    </div>
                    <span className={`identity-review-badge ${verifiedGroupIds[group.id] ? '' : 'is-warning'}`}>
                      {verifiedGroupIds[group.id]
                        ? <><UserCheck size={13} /> 동일인 확인</>
                        : <><AlertCircle size={13} /> 확인 필요</>}
                    </span>
                  </div>

                  <div className="identity-document-grid">
                    {group.documents.map((document) => {
                      const item = items[document.fileIndex];
                      return (
                        <div className="identity-document-card" key={`${group.id}-${document.fileIndex}`}>
                          <button
                            type="button"
                            className="identity-document-preview"
                            onClick={() => setEditingFileIndex(document.fileIndex)}
                            aria-label={`${document.documentLabel} 자르기 및 원근 보정`}
                          >
                            <img src={item?.previewUrl} alt={document.documentLabel} />
                            <span><Crop size={13} /> 자르기·원근</span>
                          </button>
                          <div className="identity-document-meta">
                            <strong>{document.documentLabel || DOCUMENT_TYPE_LABELS[document.documentType]}</strong>
                            <span>
                              {document.correctionMode === 'MANUAL' ? '수동 보정 완료' : document.correctionMode === 'ORIGINAL' ? '원본 전체 사용' : `${Math.round(document.confidence * 100)}% 인식`}
                            </span>
                          </div>
                          <select
                            value={group.id}
                            onChange={(event) => {
                              if (event.target.value !== group.id) {
                                setPendingGroupAction({
                                  document,
                                  sourceGroupId: group.id,
                                  nextGroupId: event.target.value,
                                });
                              }
                            }}
                            aria-label={`${document.documentLabel} 묶음 변경`}
                          >
                            {groups.map((target) => <option key={target.id} value={target.id}>{target.personName}</option>)}
                            <option value="__new__">＋ 새 사람으로 분리</option>
                          </select>
                        </div>
                      );
                    })}
                    <button className="identity-add-more" onClick={() => fileInputRef.current?.click()}><Plus size={18} /><span>사진 추가</span></button>
                  </div>

                  {getPersonnelDetails(group).length > 0 && (
                    <div className="identity-personnel-data">
                      <div className="identity-personnel-data__title"><LockKeyhole size={13} /> 추출 인사정보 · 원문 표시</div>
                      <dl>
                        {getPersonnelDetails(group).map((detail) => (
                          <div key={detail.label}>
                            <dt>{detail.label}</dt>
                            <dd>{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {group.requiresReview && (
                    <div className="identity-group-warning"><AlertCircle size={15} /><span>{group.reviewReasons[0]}</span></div>
                  )}
                  <button
                    type="button"
                    className={`identity-verify-button ${verifiedGroupIds[group.id] ? 'is-verified' : ''}`}
                    onClick={() => setVerifiedGroupIds((current) => ({ ...current, [group.id]: !current[group.id] }))}
                  >
                    {verifiedGroupIds[group.id]
                      ? <><CheckCircle2 size={16} /> 동일인 확인 완료 · 다시 확인하기</>
                      : <><UserCheck size={16} /> 이 묶음은 동일인입니다</>}
                  </button>
                  <div className="identity-group-output-actions">
                    <button className="identity-preview-button" onClick={() => { void openRegistrationPreview(group); }} disabled={Boolean(previewLoadingGroupId) || Boolean(downloadingGroupId)}>
                      {previewLoadingGroupId === group.id ? <Loader2 className="identity-spin" size={17} /> : <Eye size={17} />}
                      묶음사진 미리보기
                    </button>
                    <button className="identity-download-button" onClick={() => downloadGroup(group)} disabled={Boolean(downloadingGroupId) || Boolean(previewLoadingGroupId)}>
                      {downloadingGroupId === group.id ? <Loader2 className="identity-spin" size={17} /> : <Download size={17} />}
                      JPG 받기
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {items.length === 0 && (
          <section className="identity-empty-guide">
            <div><FileImage size={22} /><span>1</span><strong>사진 선택</strong><small>섞여 있어도 괜찮아요</small></div>
            <ArrowRight size={18} />
            <div><Sparkles size={22} /><span>2</span><strong>빠른 AI 묶기</strong><small>이름과 문서영역만 확인</small></div>
            <ArrowRight size={18} />
            <div><Download size={22} /><span>3</span><strong>묶음 미리보기</strong><small>선택 묶음만 상세 분석·등록</small></div>
          </section>
        )}

        {editingItem?.analysis && (
          <IdentityCropEditor
            item={editingItem}
            onClose={() => setEditingFileIndex(null)}
            onSave={(quad, mode) => saveDocumentCorrection(editingFileIndex as number, quad, mode)}
          />
        )}

        {registrationPreview && (
          <div className="identity-modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeRegistrationPreview();
          }}>
            <section className="identity-register-preview" role="dialog" aria-modal="true" aria-labelledby="identity-register-preview-title">
              <header>
                <span className="identity-register-preview__icon"><Eye size={21} /></span>
                <div>
                  <span className="identity-section-kicker">FINAL PREVIEW · WORKER DB</span>
                  <h2 id="identity-register-preview-title">묶음사진 미리보기</h2>
                </div>
                <button type="button" className="identity-icon-button" onClick={closeRegistrationPreview} disabled={registering || registrationAnalyzing} aria-label="미리보기 닫기"><X size={19} /></button>
              </header>

              <div className="identity-register-preview__body">
                <figure className="identity-register-preview__image">
                  <img src={registrationPreview.previewUrl} alt={`${registrationPreview.name || '작업자'} 신분증 묶음 미리보기`} />
                  <figcaption><ImageDown size={14} /> 화면에서 압축 후 Firebase Storage에 한 번만 업로드</figcaption>
                </figure>

                <div className="identity-register-preview__form">
                  <div className={`identity-register-analysis ${registrationPreview.analysisComplete ? 'is-complete' : ''}`}>
                    {registrationAnalyzing ? <Loader2 className="identity-spin" size={18} /> : registrationPreview.analysisComplete ? <CheckCircle2 size={18} /> : <ScanLine size={18} />}
                    <span>
                      <strong>{registrationPreview.analysisComplete ? '2단계 인적정보 분석 완료' : '2단계 · DB 등록용 인적정보 분석'}</strong>
                      <small>{registrationPreview.analysisComplete ? '아래 이름·주민번호·주소를 확인한 뒤 등록하세요.' : '현재 보이는 묶음사진 한 장만 AI가 분석합니다.'}</small>
                    </span>
                    {!registrationPreview.analysisComplete && (
                      <button type="button" onClick={() => { void analyzeRegistrationPreview(); }} disabled={registrationAnalyzing || registering}>
                        {registrationAnalyzing ? '분석 중' : registrationPreview.analysisError ? '다시 분석' : 'AI 상세 분석'}
                      </button>
                    )}
                  </div>
                  {registrationPreview.analysisError && <div className="identity-register-analysis-error"><AlertCircle size={14} /> {registrationPreview.analysisError}</div>}
                  {registrationPreview.analysisComplete && (
                    <div className="identity-register-match">
                      <Database size={17} />
                      <span><strong>통합DB 자동 확인</strong><small>{registrationPreview.matchMessage}</small></span>
                    </div>
                  )}
                  <label>
                    <span>이름</span>
                    <input value={registrationPreview.name} onChange={(event) => updateRegistrationPreview({ name: event.target.value })} placeholder="AI 분석 후 확인" disabled={registrationAnalyzing} />
                  </label>
                  <label>
                    <span>주민·외국인번호</span>
                    <input value={registrationPreview.idNumber} onChange={(event) => updateRegistrationPreview({ idNumber: event.target.value })} placeholder="AI 분석 후 확인" disabled={registrationAnalyzing} />
                  </label>
                  <label>
                    <span>주소</span>
                    <textarea value={registrationPreview.address} onChange={(event) => updateRegistrationPreview({ address: event.target.value })} placeholder="AI 분석 후 확인" rows={3} disabled={registrationAnalyzing} />
                  </label>
                  <label>
                    <span>등록 방식</span>
                    <select
                      value={registrationPreview.mode}
                      disabled={registrationAnalyzing || !registrationPreview.analysisComplete}
                      onChange={(event) => {
                        const mode = event.target.value as IdentityRegistrationMode;
                        updateRegistrationPreview({ mode, workerId: mode === 'new' ? '' : registrationPreview.workerId });
                      }}
                    >
                      <option value="new">신규 작업자 등록</option>
                      <option value="update">기존 작업자 업데이트</option>
                    </select>
                  </label>
                  {registrationPreview.mode === 'update' && (
                    <label>
                      <span>업데이트 대상</span>
                      <select value={registrationPreview.workerId} onChange={(event) => updateRegistrationPreview({ workerId: event.target.value })} disabled={registrationAnalyzing}>
                        <option value="">기존 작업자 선택</option>
                        {workers
                          .slice()
                          .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'ko'))
                          .map((worker) => (
                            <option key={String(worker.id)} value={String(worker.id)}>
                              {worker.name || '이름 없음'}{worker.idNumber ? ` · ${String(worker.idNumber).slice(0, 8)}…` : ''}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <div className="identity-register-compression-note">
                    <ImageDown size={16} />
                    <span><strong>저장 용량 자동 최적화</strong><small>긴 변 최대 1600px · 목표 650KB · 순차 1건 업로드</small></span>
                  </div>
                  {registrationProgress && <div className="identity-register-progress"><Loader2 className="identity-spin" size={15} /> {registrationProgress}</div>}
                </div>
              </div>

              <footer>
                <span>묶음사진을 먼저 확인하고, 2단계 AI 분석 결과가 같은 사람인지 확인한 뒤 등록해 주세요.</span>
                <button type="button" className="identity-secondary-button" onClick={closeRegistrationPreview} disabled={registering || registrationAnalyzing}>닫기</button>
                <button type="button" className="identity-confirm-button" onClick={() => { void registerPreviewInWorkerDatabase(); }} disabled={registering || registrationAnalyzing || !registrationPreview.analysisComplete}>
                  {registering ? <Loader2 className="identity-spin" size={16} /> : <Database size={16} />}
                  {!registrationPreview.analysisComplete ? 'AI 상세 분석 후 등록' : registrationPreview.mode === 'new' ? '통합DB에 신규 등록' : '선택 작업자에 바로 등록'}
                </button>
              </footer>
            </section>
          </div>
        )}

        {pendingGroupAction && pendingSourceGroup && (
          <div className="identity-modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.currentTarget === event.target) setPendingGroupAction(null);
          }}>
            <section className="identity-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="identity-group-confirm-title">
              <header>
                <span className="identity-confirm-dialog__icon"><UsersRound size={21} /></span>
                <div>
                  <span className="identity-section-kicker">PERSON MATCH REVIEW</span>
                  <h2 id="identity-group-confirm-title">
                    {pendingTargetGroup ? '다른 사람 묶음으로 합칠까요?' : '새 사람 묶음으로 분리할까요?'}
                  </h2>
                </div>
                <button type="button" className="identity-icon-button" onClick={() => setPendingGroupAction(null)} aria-label="확인 창 닫기"><X size={19} /></button>
              </header>

              <div className="identity-confirm-dialog__document">
                {pendingDocumentItem && <img src={pendingDocumentItem.previewUrl} alt="이동할 문서" />}
                <span>
                  <strong>{pendingGroupAction.document.documentLabel}</strong>
                  <small>{pendingGroupAction.document.originalFileName}</small>
                </span>
              </div>

              <div className="identity-person-compare">
                <div>
                  <span>현재 묶음</span>
                  <strong>{pendingSourceGroup.personName}</strong>
                  <small>{pendingSourceGroup.birthDate || '생년월일 정보 없음'} · {pendingSourceGroup.documents.length}개 문서</small>
                  <div className="identity-person-compare__thumbs">
                    {pendingSourceGroup.documents.slice(0, 3).map((document) => (
                      <img key={document.fileIndex} src={items[document.fileIndex]?.previewUrl} alt="" />
                    ))}
                  </div>
                </div>
                <ArrowRight size={20} />
                <div className="is-target">
                  <span>{pendingTargetGroup ? '합칠 묶음' : '분리 결과'}</span>
                  <strong>{pendingTargetGroup?.personName || '새 사람'}</strong>
                  <small>{pendingTargetGroup ? `${pendingTargetGroup.birthDate || '생년월일 정보 없음'} · ${pendingTargetGroup.documents.length}개 문서` : '독립된 새 묶음으로 생성'}</small>
                  {pendingTargetGroup && (
                    <div className="identity-person-compare__thumbs">
                      {pendingTargetGroup.documents.slice(0, 3).map((document) => (
                        <img key={document.fileIndex} src={items[document.fileIndex]?.previewUrl} alt="" />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="identity-confirm-dialog__notice">
                <AlertCircle size={16} />
                <span>{pendingTargetGroup
                  ? '이름뿐 아니라 생년월일과 문서 사진도 같은 사람인지 확인해 주세요.'
                  : '선택한 문서만 현재 묶음에서 빠져나갑니다.'}</span>
              </div>

              <footer>
                <button type="button" className="identity-secondary-button" onClick={() => setPendingGroupAction(null)}>취소</button>
                <button type="button" className="identity-confirm-button" onClick={confirmPendingGroupAction}>
                  <Check size={16} /> {pendingTargetGroup ? '확인하고 합치기' : '확인하고 분리'}
                </button>
              </footer>
            </section>
          </div>
        )}
      </section>
    </main>
  );
};

export default IdentityBundlePage;
