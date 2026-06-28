import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faAddressBook,
    faBuilding,
    faCheck,
    faCircleNotch,
    faCloudArrowUp,
    faLink,
    faMagnifyingGlass,
    faPlus,
    faRotate,
    faRotateLeft,
    faRotateRight,
    faTrash,
    faTriangleExclamation,
    faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import { useMasterData } from '../../contexts/MasterDataContext';
import {
    DEFAULT_PARTNER_RELATIONSHIP_TYPES,
    isRecognitionImageFile,
    partnerRecognitionService,
    rotateImageFileForRecognition,
    resizeImageForRecognition,
} from '../../services/partnerRecognitionService';
import type {
    CompanyRelationshipType,
    ExtractedPartnerContact,
    PartnerRecognitionImage,
    PartnerRecognitionJob,
    PartnerRecognitionResult,
} from '../../types/partnerRecognition';
import PartnerMenuTopNav from '../../components/common/PartnerMenuTopNav';
import { getFriendlyErrorMessage, isDeadlineExceededError } from '../../utils/firebaseError';

const STATUS_LABELS: Record<string, string> = {
    draft: '작성중',
    uploading: '업로드중',
    queued: '분석대기',
    analyzing: '분석중',
    reviewing: '검수중',
    committing: '등록중',
    completed: '완료',
    failed: '실패',
    extracted: '추출',
    auto_matched: '자동매칭',
    needs_review: '확인필요',
    no_match: '미매칭',
    excluded: '제외',
    committed: '등록완료',
};

const RESULT_BADGE_CLASS: Record<string, string> = {
    auto_matched: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    needs_review: 'border-amber-200 bg-amber-50 text-amber-700',
    no_match: 'border-rose-200 bg-rose-50 text-rose-700',
    excluded: 'border-slate-200 bg-slate-100 text-slate-500',
    committed: 'border-blue-200 bg-blue-50 text-blue-700',
    failed: 'border-rose-200 bg-rose-50 text-rose-700',
};

const emptyContact: ExtractedPartnerContact = {
    sourceKind: 'unknown',
    companyName: '',
    companyNameAliases: [],
    businessNumber: '',
    personName: '',
    department: '',
    position: '',
    mobile: '',
    phone: '',
    fax: '',
    email: '',
    address: '',
    website: '',
    businessCategories: [],
    companyTypeGuess: [],
    memo: '',
    overallConfidence: 0,
    warnings: [],
    rawText: '',
};

const getEffectiveContact = (result: PartnerRecognitionResult): ExtractedPartnerContact => ({
    ...emptyContact,
    ...result.extracted,
    ...result.reviewed,
});

const formatPercent = (value: number | undefined): string =>
    `${Math.round((Number(value) || 0) * 100)}%`;

const getStatusLabel = (status: string | undefined): string =>
    STATUS_LABELS[status || ''] || status || '-';

type ContactShareData = {
    files?: File[];
    title?: string;
    text?: string;
};

type ContactShareNavigator = Navigator & {
    canShare?: (data: ContactShareData) => boolean;
    share?: (data: ContactShareData) => Promise<void>;
};

const escapeVCardText = (value?: string): string =>
    (value || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n/g, '\\n')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');

const formatVCardPhone = (value?: string): string =>
    (value || '')
        .trim()
        .replace(/[^\d+().\-\s]/g, '')
        .replace(/\s+/g, ' ');

const formatVCardDate = (): string =>
    new Date().toISOString().slice(0, 10).replace(/-/g, '');

const buildPhoneContactFile = (selectedResults: PartnerRecognitionResult[]): File => {
    const cards = selectedResults.map((result) => {
        const contact = getEffectiveContact(result);
        const companyName = contact.companyName || result.selectedCompanyName || '';
        const displayName = contact.personName || companyName || '명함 연락처';
        const title = [contact.department, contact.position].filter(Boolean).join(' ');
        const mobile = formatVCardPhone(contact.mobile);
        const phone = formatVCardPhone(contact.phone);
        const fax = formatVCardPhone(contact.fax);
        const noteParts = [
            contact.memo,
            contact.businessNumber ? `사업자번호: ${contact.businessNumber}` : '',
            (contact.businessCategories || []).length > 0 ? `업종: ${(contact.businessCategories || []).join(', ')}` : '',
            result.selectedCompanyName && result.selectedCompanyName !== companyName ? `통합DB: ${result.selectedCompanyName}` : '',
        ].filter(Boolean);

        return [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${escapeVCardText(displayName)}`,
            `N:${escapeVCardText(displayName)};;;;`,
            companyName ? `ORG:${escapeVCardText(companyName)}` : '',
            title ? `TITLE:${escapeVCardText(title)}` : '',
            mobile ? `TEL;TYPE=CELL:${mobile}` : '',
            phone ? `TEL;TYPE=WORK:${phone}` : '',
            fax ? `TEL;TYPE=FAX:${fax}` : '',
            contact.email ? `EMAIL;TYPE=WORK:${escapeVCardText(contact.email)}` : '',
            contact.address ? `ADR;TYPE=WORK:;;${escapeVCardText(contact.address)};;;;` : '',
            contact.website ? `URL:${escapeVCardText(contact.website)}` : '',
            noteParts.length > 0 ? `NOTE:${escapeVCardText(noteParts.join('\n'))}` : '',
            'END:VCARD',
        ].filter(Boolean).join('\r\n');
    });

    const fileName = `business-card-contacts-${formatVCardDate()}-${selectedResults.length}.vcf`;
    return new File([`${cards.join('\r\n')}\r\n`], fileName, { type: 'text/vcard;charset=utf-8' });
};

const downloadPhoneContactFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const shareOrDownloadPhoneContactFile = async (file: File): Promise<'shared' | 'downloaded'> => {
    const nav = navigator as ContactShareNavigator;
    const shareData: ContactShareData = {
        files: [file],
        title: '명함 연락처 저장',
        text: '명함에서 등록한 연락처 파일입니다.',
    };

    if (nav.share && nav.canShare?.(shareData)) {
        await nav.share(shareData);
        return 'shared';
    }

    downloadPhoneContactFile(file);
    return 'downloaded';
};

const PartnerPhotoRegistrationPage: React.FC = () => {
    const { companies, sites, refreshCompanies } = useMasterData();
    const [jobId, setJobId] = useState('');
    const [job, setJob] = useState<PartnerRecognitionJob | null>(null);
    const [images, setImages] = useState<PartnerRecognitionImage[]>([]);
    const [results, setResults] = useState<PartnerRecognitionResult[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
    const [title, setTitle] = useState(`사진 거래처 등록 ${new Date().toLocaleDateString('ko-KR')}`);
    const [baseCompanyId, setBaseCompanyId] = useState('');
    const [relationshipType, setRelationshipType] = useState<CompanyRelationshipType>('협력사');
    const [relationshipTypes, setRelationshipTypes] = useState<CompanyRelationshipType[]>(DEFAULT_PARTNER_RELATIONSHIP_TYPES);
    const [newRelationshipType, setNewRelationshipType] = useState('');
    const [savingRelationshipTypes, setSavingRelationshipTypes] = useState(false);
    const [siteId, setSiteId] = useState('');
    const [createRelationships, setCreateRelationships] = useState(true);
    const [saveContactsToPhoneOnCommit, setSaveContactsToPhoneOnCommit] = useState(true);
    const [lastPhoneContactFile, setLastPhoneContactFile] = useState<File | null>(null);
    const [phoneContactSaveMessage, setPhoneContactSaveMessage] = useState('');
    const [savingPhoneContacts, setSavingPhoneContacts] = useState(false);
    const [busy, setBusy] = useState(false);
    const [preparingFiles, setPreparingFiles] = useState(false);
    const [rotatingFileIndex, setRotatingFileIndex] = useState<number | null>(null);

    useEffect(() => {
        const unsubscribe = partnerRecognitionService.subscribeRelationshipTypes((nextTypes) => {
            setRelationshipTypes(nextTypes);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (relationshipTypes.length > 0 && !relationshipTypes.includes(relationshipType)) {
            setRelationshipType(relationshipTypes[0]);
        }
    }, [relationshipType, relationshipTypes]);

    useEffect(() => {
        if (!jobId) {
            setJob(null);
            setImages([]);
            setResults([]);
            return undefined;
        }

        const unsubJob = partnerRecognitionService.subscribeJob(jobId, setJob);
        const unsubImages = partnerRecognitionService.subscribeImages(jobId, setImages);
        const unsubResults = partnerRecognitionService.subscribeResults(jobId, setResults);

        return () => {
            unsubJob();
            unsubImages();
            unsubResults();
        };
    }, [jobId]);

    useEffect(() => {
        setSelectedResultIds((prev) =>
            prev.filter((id) => results.some((result) => result.id === id && canCommitResult(result)))
        );
    }, [results]);

    const companyById = useMemo(() => {
        const map = new Map<string, any>();
        companies.forEach((company) => {
            if (company.id) map.set(company.id, company);
        });
        return map;
    }, [companies]);

    const siteById = useMemo(() => {
        const map = new Map<string, any>();
        sites.forEach((site) => {
            if (site.id) map.set(site.id, site);
        });
        return map;
    }, [sites]);

    const commitableResults = useMemo(
        () => results.filter(canCommitResult),
        [results]
    );

    const selectedBaseCompany = baseCompanyId ? companyById.get(baseCompanyId) : null;
    const selectedSite = siteId ? siteById.get(siteId) : null;
    const analyzedCount = images.filter((image) => image.status === 'completed' || image.status === 'failed').length;
    const failedImages = images.filter((image) => image.status === 'failed');
    const uploadSummary = preparingFiles ? '사진 방향 보정 중...' : (files.length > 0 ? `${files.length}개 선택됨` : '사진을 선택하세요');

    const prepareFilesForPreview = async (inputFiles: File[]) => {
        const selected = inputFiles.filter(isRecognitionImageFile);
        if (selected.length === 0) {
            setFiles([]);
            return;
        }

        setPreparingFiles(true);
        try {
            const normalized = await Promise.all(selected.map(async (file) => {
                try {
                    const result = await resizeImageForRecognition(file);
                    return result.file;
                } catch {
                    return file;
                }
            }));
            setFiles(normalized);
        } finally {
            setPreparingFiles(false);
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(event.target.files || []);
        await prepareFilesForPreview(selected);
        event.target.value = '';
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const dropped = Array.from(event.dataTransfer.files || []);
        await prepareFilesForPreview(dropped);
    };

    const handleRotateSelectedFile = async (index: number, degrees: number) => {
        const targetFile = files[index];
        if (!targetFile) return;
        setRotatingFileIndex(index);
        try {
            const rotated = await rotateImageFileForRecognition(targetFile, degrees);
            setFiles((prev) => prev.map((file, fileIndex) => fileIndex === index ? rotated.file : file));
        } catch (error) {
            console.error('Failed to rotate business card image:', error);
            alert(error instanceof Error ? error.message : '사진 회전에 실패했습니다.');
        } finally {
            setRotatingFileIndex(null);
        }
    };

    const handleAddRelationshipType = async () => {
        const nextType = newRelationshipType.trim();
        if (!nextType) return;
        if (relationshipTypes.includes(nextType)) {
            setRelationshipType(nextType);
            setNewRelationshipType('');
            return;
        }

        const nextTypes = [...relationshipTypes, nextType];
        setSavingRelationshipTypes(true);
        try {
            await partnerRecognitionService.saveRelationshipTypes(nextTypes);
            setRelationshipTypes(nextTypes);
            setRelationshipType(nextType);
            setNewRelationshipType('');
        } catch (error) {
            console.error('Failed to add relationship type:', error);
            alert(error instanceof Error ? error.message : '관계유형 추가에 실패했습니다.');
        } finally {
            setSavingRelationshipTypes(false);
        }
    };

    const handleDeleteRelationshipType = async (type: CompanyRelationshipType) => {
        if (relationshipTypes.length <= 1) {
            alert('관계유형은 최소 1개 이상 필요합니다.');
            return;
        }
        const confirmed = window.confirm(`'${type}' 관계유형을 삭제할까요?`);
        if (!confirmed) return;

        const nextTypes = relationshipTypes.filter((item) => item !== type);
        setSavingRelationshipTypes(true);
        try {
            await partnerRecognitionService.saveRelationshipTypes(nextTypes);
            setRelationshipTypes(nextTypes);
            if (relationshipType === type) {
                setRelationshipType(nextTypes[0] || '협력사');
            }
        } catch (error) {
            console.error('Failed to delete relationship type:', error);
            alert(error instanceof Error ? error.message : '관계유형 삭제에 실패했습니다.');
        } finally {
            setSavingRelationshipTypes(false);
        }
    };

    const handleCreateAndAnalyze = async (mode: 'instant' | 'batch' = 'instant') => {
        if (files.length === 0) {
            alert('업로드할 사진을 선택해 주세요.');
            return;
        }

        setBusy(true);
        let nextJobId = '';
        try {
            nextJobId = await partnerRecognitionService.createJob({
                title,
                baseCompanyId: baseCompanyId || undefined,
                baseCompanyName: selectedBaseCompany?.name,
                defaultRelationshipType: relationshipType,
                defaultSiteId: siteId || undefined,
                defaultSiteName: selectedSite?.name,
            });
            setJobId(nextJobId);
            await partnerRecognitionService.uploadJobImages(nextJobId, files);
            setFiles([]);
            if (mode === 'batch') {
                await partnerRecognitionService.startBatchAnalysis(nextJobId);
                alert('Batch 분석 예약이 완료되었습니다. 완료 후 Batch 결과 동기화를 눌러 주세요.');
            } else {
                await partnerRecognitionService.startAnalysis(nextJobId);
                alert('사진 분석이 완료되었습니다. 인식 결과를 검수해 주세요.');
            }
        } catch (error) {
            console.error('Failed to create partner recognition job:', error);
            if (nextJobId && isDeadlineExceededError(error)) {
                alert('사진 업로드와 분석 요청은 접수되었습니다. 서버 분석이 아직 진행 중이라 응답 확인만 지연되었습니다. 완료되면 진행 상태와 인식 결과에 자동으로 표시됩니다.');
                return;
            }
            alert(getFriendlyErrorMessage(error, '사진 거래처 등록을 시작하지 못했습니다.'));
        } finally {
            setBusy(false);
        }
    };

    const handleSyncBatch = async () => {
        if (!jobId) return;
        setBusy(true);
        try {
            const result = await partnerRecognitionService.syncBatchAnalysis(jobId);
            if (!result.done) {
                alert(`Batch 분석이 아직 진행 중입니다. 현재 상태: ${result.state}`);
            } else if (result.success) {
                alert(`Batch 결과를 동기화했습니다. 생성 결과: ${result.createdResults}건`);
            } else {
                alert(`Batch 분석이 완료되지 못했습니다. 상태: ${result.state}`);
            }
        } catch (error) {
            console.error('Failed to sync batch job:', error);
            alert(error instanceof Error ? error.message : 'Batch 결과 동기화에 실패했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const handleAnalyzeAgain = async () => {
        if (!jobId) return;
        setBusy(true);
        try {
            await partnerRecognitionService.startAnalysis(jobId);
            alert('사진 분석이 완료되었습니다. 인식 결과를 검수해 주세요.');
        } catch (error) {
            console.error('Failed to analyze job:', error);
            if (isDeadlineExceededError(error)) {
                alert('분석 요청은 접수되었습니다. 서버 분석이 아직 진행 중이라 응답 확인만 지연되었습니다. 완료되면 진행 상태와 인식 결과에 자동으로 표시됩니다.');
                return;
            }
            alert(getFriendlyErrorMessage(error, '분석을 시작하지 못했습니다.'));
        } finally {
            setBusy(false);
        }
    };

    const handleUpdateField = async (
        result: PartnerRecognitionResult,
        field: keyof ExtractedPartnerContact,
        value: string,
    ) => {
        if (!result.id) return;
        const reviewed = {
            ...(result.reviewed || {}),
            [field]: field === 'businessCategories' || field === 'companyTypeGuess'
                ? value.split(',').map((part) => part.trim()).filter(Boolean)
                : value,
        };
        await partnerRecognitionService.updateResultReview(result.id, { reviewed });
    };

    const handleSelectCompany = async (result: PartnerRecognitionResult, companyId: string) => {
        if (!result.id) return;
        const company = companyById.get(companyId);
        await partnerRecognitionService.updateResultReview(result.id, {
            selectedCompanyId: companyId || '',
            selectedCompanyName: company?.name || '',
            status: result.status === 'committed' ? result.status : (companyId ? 'needs_review' : 'no_match'),
        });
    };

    const handleSelectCompanyByName = async (result: PartnerRecognitionResult, companyName: string) => {
        if (!result.id) return;
        const trimmed = companyName.trim();
        const found = companies.find((company) => company.name === trimmed);
        if (!found?.id) return;
        await handleSelectCompany(result, found.id);
    };

    const handleExclude = async (result: PartnerRecognitionResult) => {
        if (!result.id) return;
        const reason = window.prompt('제외 사유', '오인식 또는 등록 제외') || '사용자 제외';
        await partnerRecognitionService.excludeResult(result.id, reason);
    };

    const handleCompanyRequest = async (result: PartnerRecognitionResult) => {
        try {
            await partnerRecognitionService.requestCompanyMaster(result);
            alert('통합DB 신규 회사 등록 요청으로 보냈습니다.');
        } catch (error) {
            console.error('Failed to request company master:', error);
            alert(error instanceof Error ? error.message : '신규 회사 요청에 실패했습니다.');
        }
    };

    const toggleResult = (resultId: string) => {
        setSelectedResultIds((prev) =>
            prev.includes(resultId) ? prev.filter((id) => id !== resultId) : [...prev, resultId]
        );
    };

    const toggleAllCommitable = () => {
        const ids = commitableResults.map((result) => result.id).filter(Boolean) as string[];
        if (selectedResultIds.length === ids.length) {
            setSelectedResultIds([]);
        } else {
            setSelectedResultIds(ids);
        }
    };

    const getResultsByIds = (ids: string[]): PartnerRecognitionResult[] =>
        ids
            .map((id) => results.find((result) => result.id === id))
            .filter((result): result is PartnerRecognitionResult => !!result);

    const handleSharePhoneContactFile = async (file: File) => {
        setLastPhoneContactFile(file);
        setSavingPhoneContacts(true);
        try {
            const saveMode = await shareOrDownloadPhoneContactFile(file);
            setPhoneContactSaveMessage(
                saveMode === 'shared'
                    ? '휴대폰 연락처 저장 창을 열었습니다.'
                    : '연락처 파일을 다운로드했습니다. 휴대폰에서 파일을 열어 주소록에 추가하세요.'
            );
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                setPhoneContactSaveMessage('휴대폰 연락처 저장이 취소되었습니다. 다시 저장할 수 있습니다.');
                return;
            }

            console.error('Failed to share phone contact file:', error);
            downloadPhoneContactFile(file);
            setPhoneContactSaveMessage('공유가 실패해 연락처 파일을 다운로드했습니다. 휴대폰에서 파일을 열어 주소록에 추가하세요.');
        } finally {
            setSavingPhoneContacts(false);
        }
    };

    const handleSaveSelectedPhoneContacts = async () => {
        const selectedResults = getResultsByIds(selectedResultIds);
        if (selectedResults.length === 0) {
            alert('휴대폰에 저장할 연락처를 선택해 주세요.');
            return;
        }

        await handleSharePhoneContactFile(buildPhoneContactFile(selectedResults));
    };

    const handleCommit = async () => {
        const resultIds = selectedResultIds.filter((id) =>
            results.some((result) => result.id === id && canCommitResult(result))
        );
        if (!jobId || resultIds.length === 0) {
            alert('확정 등록할 결과를 선택해 주세요.');
            return;
        }

        const phoneContactResults = getResultsByIds(resultIds);
        const phoneContactFile = saveContactsToPhoneOnCommit && phoneContactResults.length > 0
            ? buildPhoneContactFile(phoneContactResults)
            : null;

        setBusy(true);
        try {
            const outcome = await partnerRecognitionService.commitResults({
                jobId,
                resultIds,
                createRelationships,
            });
            setSelectedResultIds([]);
            await refreshCompanies();
            if (phoneContactFile && outcome.committed > 0) {
                await handleSharePhoneContactFile(phoneContactFile);
            }
            alert(`등록 ${outcome.committed}건, 건너뜀 ${outcome.skipped}건, 실패 ${outcome.failed}건${phoneContactFile && outcome.committed > 0 ? '\n휴대폰 연락처 파일을 생성했습니다.' : ''}`);
        } catch (error) {
            console.error('Failed to commit recognition results:', error);
            alert(error instanceof Error ? error.message : '확정 등록에 실패했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const handleNewJob = () => {
        setJobId('');
        setJob(null);
        setImages([]);
        setResults([]);
        setFiles([]);
        setSelectedResultIds([]);
        setLastPhoneContactFile(null);
        setPhoneContactSaveMessage('');
        setTitle(`사진 거래처 등록 ${new Date().toLocaleDateString('ko-KR')}`);
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
            <datalist id="partner-companies">
                {companies.map((company) => (
                    <option key={company.id || company.name} value={company.name} />
                ))}
            </datalist>

            <div className="mx-auto flex w-full max-w-none flex-col gap-4">
                <PartnerMenuTopNav className="rounded-lg" />

                <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900">사진 거래처 등록</h1>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            명함/업체자료 사진을 Gemini로 인식하고 통합DB 회사와 연결합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleNewJob}
                            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                            <FontAwesomeIcon icon={faRotateRight} />
                            새 작업
                        </button>
                        <button
                            type="button"
                            onClick={handleCommit}
                            disabled={busy || selectedResultIds.length === 0}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {busy ? <FontAwesomeIcon icon={faCircleNotch} spin /> : <FontAwesomeIcon icon={faCheck} />}
                            선택 확정 등록
                        </button>
                    </div>
                </header>

                <section className="grid w-full grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <aside className="flex flex-col gap-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <h2 className="text-base font-extrabold text-slate-900">작업 설정</h2>
                            <div className="mt-4 flex flex-col gap-3">
                                <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">
                                    작업명
                                    <input
                                        value={title}
                                        onChange={(event) => setTitle(event.target.value)}
                                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">
                                    기준 회사
                                    <select
                                        value={baseCompanyId}
                                        onChange={(event) => setBaseCompanyId(event.target.value)}
                                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">선택 안 함</option>
                                        {companies.map((company) => (
                                            <option key={company.id || company.name} value={company.id || ''}>
                                                {company.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">
                                    기본 관계유형
                                    <select
                                        value={relationshipType}
                                        onChange={(event) => setRelationshipType(event.target.value)}
                                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        {relationshipTypes.map((type) => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </label>
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex gap-2">
                                        <input
                                            value={newRelationshipType}
                                            onChange={(event) => setNewRelationshipType(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    handleAddRelationshipType();
                                                }
                                            }}
                                            placeholder="관계유형 추가"
                                            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddRelationshipType}
                                            disabled={savingRelationshipTypes || !newRelationshipType.trim()}
                                            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {savingRelationshipTypes ? <FontAwesomeIcon icon={faCircleNotch} spin /> : <FontAwesomeIcon icon={faPlus} />}
                                            추가
                                        </button>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {relationshipTypes.map((type) => (
                                            <div key={type} className="inline-flex max-w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                                                <button
                                                    type="button"
                                                    onClick={() => setRelationshipType(type)}
                                                    className={`max-w-[150px] truncate text-left ${relationshipType === type ? 'text-blue-700' : 'text-slate-700'}`}
                                                    title={type}
                                                >
                                                    {type}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteRelationshipType(type)}
                                                    disabled={savingRelationshipTypes || relationshipTypes.length <= 1}
                                                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                                                    title={`${type} 삭제`}
                                                    aria-label={`${type} 삭제`}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">
                                    관련 현장
                                    <select
                                        value={siteId}
                                        onChange={(event) => setSiteId(event.target.value)}
                                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">선택 안 함</option>
                                        {sites.map((site) => (
                                            <option key={site.id || site.name} value={site.id || ''}>
                                                {site.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={createRelationships}
                                        onChange={(event) => setCreateRelationships(event.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    확정 시 거래처 관계도 생성
                                </label>
                                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={saveContactsToPhoneOnCommit}
                                        onChange={(event) => setSaveContactsToPhoneOnCommit(event.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    확정 시 휴대폰 연락처도 저장
                                </label>
                                {lastPhoneContactFile && (
                                    <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-xs font-bold text-blue-800">
                                        <div>{phoneContactSaveMessage || '휴대폰 연락처 파일을 준비했습니다.'}</div>
                                        <button
                                            type="button"
                                            onClick={() => handleSharePhoneContactFile(lastPhoneContactFile)}
                                            disabled={savingPhoneContacts}
                                            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            <FontAwesomeIcon icon={savingPhoneContacts ? faCircleNotch : faAddressBook} spin={savingPhoneContacts} />
                                            휴대폰 연락처 저장
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <h2 className="text-base font-extrabold text-slate-900">사진 업로드</h2>
                            <div
                                onDrop={handleDrop}
                                onDragOver={(event) => event.preventDefault()}
                                className="mt-4 flex min-h-[160px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center"
                            >
                                <FontAwesomeIcon icon={faCloudArrowUp} className="text-3xl text-blue-500" />
                                <p className="mt-3 text-sm font-extrabold text-slate-800">{uploadSummary}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    명함 여러 장 또는 업체자료 사진을 선택하세요.
                                </p>
                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                    <label className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
                                        사진 선택
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                    </label>
                                    <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                        카메라 촬영
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            multiple
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>
                            {files.length > 0 && (
                                <div className="mt-3 max-h-32 overflow-auto rounded-md border border-slate-200">
                                    {files.map((file, index) => (
                                        <SelectedFileRow
                                            key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                                            file={file}
                                            disabled={busy || preparingFiles || rotatingFileIndex !== null}
                                            rotating={rotatingFileIndex === index}
                                            onRotate={(degrees) => handleRotateSelectedFile(index, degrees)}
                                        />
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => handleCreateAndAnalyze('instant')}
                                disabled={busy || preparingFiles || files.length === 0}
                                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {busy ? <FontAwesomeIcon icon={faCircleNotch} spin /> : <FontAwesomeIcon icon={faWandMagicSparkles} />}
                                업로드 후 즉시 분석
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCreateAndAnalyze('batch')}
                                disabled={busy || preparingFiles || files.length === 0}
                                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-extrabold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {busy ? <FontAwesomeIcon icon={faCircleNotch} spin /> : <FontAwesomeIcon icon={faCloudArrowUp} />}
                                업로드 후 Batch 예약
                            </button>
                        </div>

                        {job && (
                            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <h2 className="text-base font-extrabold text-slate-900">진행 상태</h2>
                                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                    <StatusItem label="상태" value={getStatusLabel(job.status)} />
                                    <StatusItem label="사진" value={`${analyzedCount}/${images.length || job.totalImages}`} />
                                    <StatusItem label="추출" value={`${job.totalItems || results.length}건`} />
                                    <StatusItem label="자동매칭" value={`${job.autoMatchedItems || 0}건`} />
                                    <StatusItem label="확인필요" value={`${job.needsReviewItems || 0}건`} />
                                    <StatusItem label="미매칭" value={`${job.noMatchItems || 0}건`} />
                                    {job.processingMode === 'batch' && (
                                        <>
                                            <StatusItem label="분석방식" value="Batch" />
                                            <StatusItem label="Batch상태" value={job.geminiBatchState || '-'} />
                                        </>
                                    )}
                                </dl>
                                {job.errorMessage && (
                                    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                                        <div className="flex items-start gap-2">
                                            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />
                                            <span>{job.errorMessage}</span>
                                        </div>
                                    </div>
                                )}
                                {failedImages.length > 0 && (
                                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                                        <div className="text-xs font-extrabold text-amber-800">
                                            실패한 사진 {failedImages.length}개
                                        </div>
                                        <div className="mt-2 max-h-28 overflow-auto space-y-1 text-xs font-semibold text-amber-800">
                                            {failedImages.slice(0, 8).map((image) => (
                                                <div key={image.id || image.originalFileName} className="flex gap-2">
                                                    <span className="min-w-0 flex-1 truncate">{image.originalFileName}</span>
                                                    <span className="max-w-[180px] truncate text-amber-700">
                                                        {image.errorMessage || '분석 실패'}
                                                    </span>
                                                </div>
                                            ))}
                                            {failedImages.length > 8 && (
                                                <div className="text-amber-700">외 {failedImages.length - 8}개</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {job.geminiBatchName && (
                                    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                                        <div className="truncate">Batch: {job.geminiBatchName}</div>
                                        <button
                                            type="button"
                                            onClick={handleSyncBatch}
                                            disabled={busy || !jobId}
                                            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                        >
                                            {busy ? <FontAwesomeIcon icon={faCircleNotch} spin /> : <FontAwesomeIcon icon={faRotateRight} />}
                                            Batch 결과 동기화
                                        </button>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleAnalyzeAgain}
                                    disabled={busy || !jobId || job.status === 'analyzing'}
                                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                >
                                    <FontAwesomeIcon icon={faWandMagicSparkles} />
                                    미처리 사진 다시 분석
                                </button>
                            </div>
                        )}
                    </aside>

                    <main className="min-w-0 w-full rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-900">인식 결과 검수</h2>
                                <p className="mt-1 text-sm font-semibold text-slate-500">
                                    회사는 기존 통합DB 회사에 연결해야 확정 등록됩니다.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={toggleAllCommitable}
                                    disabled={commitableResults.length === 0}
                                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <FontAwesomeIcon icon={faCheck} />
                                    등록 가능 전체 선택
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveSelectedPhoneContacts}
                                    disabled={selectedResultIds.length === 0 || savingPhoneContacts}
                                    className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                >
                                    <FontAwesomeIcon icon={savingPhoneContacts ? faCircleNotch : faAddressBook} spin={savingPhoneContacts} />
                                    휴대폰 저장
                                </button>
                                <div className="rounded-md bg-slate-100 px-3 py-2 text-sm font-extrabold text-slate-700">
                                    선택 {selectedResultIds.length}건
                                </div>
                            </div>
                        </div>

                        {results.length === 0 ? (
                            <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                                <FontAwesomeIcon
                                    icon={job?.status === 'failed' ? faTriangleExclamation : faMagnifyingGlass}
                                    className={`text-4xl ${job?.status === 'failed' ? 'text-rose-300' : 'text-slate-300'}`}
                                />
                                <p className="mt-4 text-base font-extrabold text-slate-700">
                                    {job?.status === 'failed' ? '분석이 실패했습니다.' : '아직 인식 결과가 없습니다.'}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-500">
                                    {job?.status === 'failed'
                                        ? (job.errorMessage || failedImages[0]?.errorMessage || '진행 상태의 실패 사유를 확인해 주세요.')
                                        : '사진을 업로드하면 Gemini 분석 결과가 여기에 표시됩니다.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-auto">
                                <table className="min-w-[1280px] w-full border-collapse text-left text-sm">
                                    <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
                                        <tr>
                                            <th className="border-b border-slate-200 px-3 py-3">선택</th>
                                            <th className="border-b border-slate-200 px-3 py-3">상태</th>
                                            <th className="border-b border-slate-200 px-3 py-3">사진</th>
                                            <th className="border-b border-slate-200 px-3 py-3">추출 회사</th>
                                            <th className="border-b border-slate-200 px-3 py-3">통합DB 연결</th>
                                            <th className="border-b border-slate-200 px-3 py-3">담당자</th>
                                            <th className="border-b border-slate-200 px-3 py-3">연락처</th>
                                            <th className="border-b border-slate-200 px-3 py-3">신뢰도/경고</th>
                                            <th className="border-b border-slate-200 px-3 py-3">작업</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((result) => {
                                            const contact = getEffectiveContact(result);
                                            const canCommit = canCommitResult(result);
                                            const selected = !!result.id && selectedResultIds.includes(result.id);
                                            return (
                                                <tr key={result.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selected}
                                                            disabled={!canCommit || !result.id}
                                                            onChange={() => result.id && toggleResult(result.id)}
                                                            className="h-4 w-4"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-xs font-extrabold ${RESULT_BADGE_CLASS[result.status] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                                                            {getStatusLabel(result.status)}
                                                        </span>
                                                        {result.duplicateWarning && (
                                                            <div className="mt-2 text-xs font-bold text-amber-700">
                                                                {result.duplicateWarning}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        {result.imageDownloadUrl ? (
                                                            <a href={result.imageDownloadUrl} target="_blank" rel="noreferrer">
                                                                <img
                                                                    src={result.imageDownloadUrl}
                                                                    alt="인식 원본"
                                                                    className="h-20 w-28 rounded-md border border-slate-200 bg-white object-contain"
                                                                />
                                                            </a>
                                                        ) : (
                                                            <div className="flex h-20 w-28 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs font-bold text-slate-400">
                                                                이미지 없음
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex flex-col gap-2">
                                                            <InlineEdit
                                                                value={contact.companyName}
                                                                placeholder="회사명"
                                                                onBlur={(value) => handleUpdateField(result, 'companyName', value)}
                                                            />
                                                            <InlineEdit
                                                                value={contact.businessNumber}
                                                                placeholder="사업자번호"
                                                                onBlur={(value) => handleUpdateField(result, 'businessNumber', value)}
                                                            />
                                                            <InlineEdit
                                                                value={contact.address}
                                                                placeholder="주소"
                                                                onBlur={(value) => handleUpdateField(result, 'address', value)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex min-w-[220px] flex-col gap-2">
                                                            <select
                                                                value={result.selectedCompanyId || ''}
                                                                onChange={(event) => handleSelectCompany(result, event.target.value)}
                                                                className="rounded-md border border-slate-300 px-2 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                                                            >
                                                                <option value="">회사 선택</option>
                                                                {result.candidates.map((candidate) => (
                                                                    <option key={candidate.companyId} value={candidate.companyId}>
                                                                        {candidate.companyName} ({candidate.score})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <input
                                                                list="partner-companies"
                                                                defaultValue={result.selectedCompanyName || ''}
                                                                onBlur={(event) => handleSelectCompanyByName(result, event.target.value)}
                                                                placeholder="회사명 직접 검색"
                                                                className="rounded-md border border-slate-300 px-2 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                                                            />
                                                            {result.matchReasons.length > 0 && (
                                                                <div className="text-xs font-semibold text-slate-500">
                                                                    {result.matchReasons.join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex min-w-[180px] flex-col gap-2">
                                                            <InlineEdit
                                                                value={contact.personName}
                                                                placeholder="이름"
                                                                onBlur={(value) => handleUpdateField(result, 'personName', value)}
                                                            />
                                                            <InlineEdit
                                                                value={contact.department}
                                                                placeholder="부서"
                                                                onBlur={(value) => handleUpdateField(result, 'department', value)}
                                                            />
                                                            <InlineEdit
                                                                value={contact.position}
                                                                placeholder="직책"
                                                                onBlur={(value) => handleUpdateField(result, 'position', value)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex min-w-[200px] flex-col gap-2">
                                                            <InlineEdit
                                                                value={contact.mobile}
                                                                placeholder="휴대폰"
                                                                onBlur={(value) => handleUpdateField(result, 'mobile', value)}
                                                            />
                                                            <InlineEdit
                                                                value={contact.phone}
                                                                placeholder="대표전화"
                                                                onBlur={(value) => handleUpdateField(result, 'phone', value)}
                                                            />
                                                            <InlineEdit
                                                                value={contact.email}
                                                                placeholder="이메일"
                                                                onBlur={(value) => handleUpdateField(result, 'email', value)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="min-w-[180px]">
                                                            <div className="text-sm font-extrabold text-slate-800">
                                                                {formatPercent(contact.overallConfidence)}
                                                            </div>
                                                            {(contact.warnings || []).length > 0 && (
                                                                <ul className="mt-2 space-y-1 text-xs font-semibold text-amber-700">
                                                                    {contact.warnings.slice(0, 3).map((warning, index) => (
                                                                        <li key={`${warning}-${index}`} className="flex gap-1">
                                                                            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />
                                                                            <span>{warning}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex min-w-[150px] flex-col gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCompanyRequest(result)}
                                                                disabled={result.status === 'committed'}
                                                                className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                                                            >
                                                                <FontAwesomeIcon icon={faBuilding} />
                                                                신규요청
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleExclude(result)}
                                                                disabled={result.status === 'committed'}
                                                                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                                            >
                                                                <FontAwesomeIcon icon={faTrash} />
                                                                제외
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </main>
                </section>

                {job && (
                    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <SummaryCard icon={faCloudArrowUp} label="업로드 사진" value={`${images.length}개`} />
                        <SummaryCard icon={faMagnifyingGlass} label="인식 결과" value={`${results.length}건`} />
                        <SummaryCard icon={faLink} label="등록 가능" value={`${commitableResults.length}건`} />
                    </section>
                )}
            </div>
        </div>
    );
};

const canCommitResult = (result: PartnerRecognitionResult): boolean =>
    !!result.selectedCompanyId &&
    !['committed', 'excluded', 'failed'].includes(result.status);

const StatusItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-md bg-slate-50 p-3">
        <dt className="text-xs font-bold text-slate-500">{label}</dt>
        <dd className="mt-1 text-sm font-extrabold text-slate-900">{value}</dd>
    </div>
);

const InlineEdit: React.FC<{
    value?: string;
    placeholder: string;
    onBlur: (value: string) => void;
}> = ({ value, placeholder, onBlur }) => (
    <input
        defaultValue={value || ''}
        placeholder={placeholder}
        onBlur={(event) => onBlur(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />
);

const SelectedFileRow: React.FC<{
    file: File;
    disabled: boolean;
    rotating: boolean;
    onRotate: (degrees: number) => void;
}> = ({ file, disabled, rotating, onRotate }) => {
    const [previewUrl, setPreviewUrl] = useState('');

    useEffect(() => {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    return (
        <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 text-xs font-semibold last:border-b-0">
            <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded border border-slate-200 bg-white">
                {previewUrl && (
                    <img
                        src={previewUrl}
                        alt={file.name}
                        className="max-h-full max-w-full object-contain"
                    />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-slate-800">{file.name}</div>
                <div className="mt-1 text-slate-500">{Math.round(file.size / 1024)}KB</div>
            </div>
            <div className="flex shrink-0 gap-1">
                <button
                    type="button"
                    onClick={() => onRotate(-90)}
                    disabled={disabled}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    title="왼쪽으로 회전"
                    aria-label={`${file.name} 왼쪽으로 회전`}
                >
                    <FontAwesomeIcon icon={rotating ? faCircleNotch : faRotateLeft} spin={rotating} />
                </button>
                <button
                    type="button"
                    onClick={() => onRotate(180)}
                    disabled={disabled}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    title="위아래 뒤집기"
                    aria-label={`${file.name} 위아래 뒤집기`}
                >
                    <FontAwesomeIcon icon={rotating ? faCircleNotch : faRotate} spin={rotating} />
                </button>
                <button
                    type="button"
                    onClick={() => onRotate(90)}
                    disabled={disabled}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    title="오른쪽으로 회전"
                    aria-label={`${file.name} 오른쪽으로 회전`}
                >
                    <FontAwesomeIcon icon={rotating ? faCircleNotch : faRotateRight} spin={rotating} />
                </button>
            </div>
        </div>
    );
};

const SummaryCard: React.FC<{ icon: any; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
            <div>
                <div className="text-sm font-bold text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <FontAwesomeIcon icon={icon} />
            </div>
        </div>
    </div>
);

export default PartnerPhotoRegistrationPage;
