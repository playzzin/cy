import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowUpRightFromSquare,
    faCheck,
    faCircleExclamation,
    faFileInvoice,
    faRotateLeft,
    faRotateRight,
    faSpinner,
    faTriangleExclamation,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {
    analyzeTaxInvoiceFiles,
    TaxInvoiceAnalysisError,
    TaxInvoiceAnalysisProgress,
    TaxInvoiceExtractedCandidate,
    validateTaxInvoiceCandidate,
} from '../../../services/taxInvoiceBulkImportService';
import './TaxInvoiceBulkImportModal.css';

interface ReviewCandidate extends TaxInvoiceExtractedCandidate {
    selected: boolean;
}

interface TaxInvoiceBulkImportModalProps {
    files: File[];
    companyLabel: string;
    knownFingerprints: ReadonlySet<string>;
    resolveKnownFingerprints?: (candidates: TaxInvoiceExtractedCandidate[]) => Promise<ReadonlySet<string>>;
    onClose: () => void;
    onApply: (candidates: TaxInvoiceExtractedCandidate[]) => void;
}

const formatNumber = (value: number) => Number.isFinite(value)
    ? new Intl.NumberFormat('ko-KR').format(value)
    : '-';

const toNumber = (value: string): number => {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const canPreviewAsImage = (file: File): boolean => {
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    return (
        type === 'image/jpeg'
        || type === 'image/png'
        || type === 'image/webp'
        || /\.(jpe?g|png|webp)$/.test(name)
    );
};

const canPreviewAsPdf = (file: File): boolean => (
    String(file.type || '').toLowerCase() === 'application/pdf'
    || String(file.name || '').toLowerCase().endsWith('.pdf')
);

const TaxInvoiceBulkImportModal: React.FC<TaxInvoiceBulkImportModalProps> = ({
    files,
    companyLabel,
    knownFingerprints,
    resolveKnownFingerprints,
    onClose,
    onApply,
}) => {
    const [rows, setRows] = useState<ReviewCandidate[]>([]);
    const [errors, setErrors] = useState<TaxInvoiceAnalysisError[]>([]);
    const [progress, setProgress] = useState<TaxInvoiceAnalysisProgress>({
        completedFiles: 0,
        totalFiles: files.length,
        currentFileName: '',
    });
    const [isAnalyzing, setIsAnalyzing] = useState(true);
    const [analysisError, setAnalysisError] = useState('');
    const [runVersion, setRunVersion] = useState(0);
    const [selectionMessage, setSelectionMessage] = useState('');
    const [resolvedFingerprints, setResolvedFingerprints] = useState<ReadonlySet<string>>(knownFingerprints);
    const [duplicateCheckError, setDuplicateCheckError] = useState('');
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [activeSourceFileIndex, setActiveSourceFileIndex] = useState(0);
    const [previewRotation, setPreviewRotation] = useState(0);

    useEffect(() => {
        if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
            setPreviewUrls(files.map(() => ''));
            return undefined;
        }

        const nextUrls = files.map((file) => URL.createObjectURL(file));
        setPreviewUrls(nextUrls);
        return () => {
            if (typeof URL.revokeObjectURL !== 'function') return;
            nextUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [files]);

    useEffect(() => {
        setActiveSourceFileIndex(0);
        setPreviewRotation(0);
    }, [files]);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;

        setRows([]);
        setErrors([]);
        setAnalysisError('');
        setSelectionMessage('');
        setResolvedFingerprints(knownFingerprints);
        setDuplicateCheckError('');
        setProgress({ completedFiles: 0, totalFiles: files.length, currentFileName: '' });
        setIsAnalyzing(true);

        analyzeTaxInvoiceFiles(files, {
            companyLabel,
            signal: controller.signal,
            onProgress: (nextProgress) => {
                if (active) setProgress(nextProgress);
            },
        })
            .then(async (batch) => {
                if (!active) return;
                let nextFingerprints = knownFingerprints;
                if (resolveKnownFingerprints && batch.candidates.length > 0) {
                    try {
                        nextFingerprints = await resolveKnownFingerprints(batch.candidates);
                    } catch (error) {
                        if (!active) return;
                        setDuplicateCheckError(error instanceof Error
                            ? error.message
                            : '기존 장부 중복 조회에 실패했습니다.');
                    }
                }
                if (!active) return;
                setResolvedFingerprints(nextFingerprints);
                setErrors(batch.errors);
                setRows(batch.candidates.map((candidate) => {
                    const validation = validateTaxInvoiceCandidate(candidate, nextFingerprints);
                    return {
                        ...candidate,
                        selected: validation.canApply && !validation.duplicate && validation.reviewIssues.length === 0,
                    };
                }));
            })
            .catch((error) => {
                if (!active || controller.signal.aborted) return;
                setAnalysisError(error instanceof Error ? error.message : '세금계산서 분석에 실패했습니다.');
            })
            .finally(() => {
                if (active) setIsAnalyzing(false);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [companyLabel, files, knownFingerprints, resolveKnownFingerprints, runVersion]);

    const validations = useMemo(() => new Map(rows.map((row) => [
        row.id,
        validateTaxInvoiceCandidate(row, resolvedFingerprints),
    ])), [resolvedFingerprints, rows]);

    const validRows = useMemo(() => rows.filter((row) => validations.get(row.id)?.canApply), [rows, validations]);
    const selectedRows = useMemo(() => validRows.filter((row) => row.selected), [validRows]);
    const duplicateCount = useMemo(() => rows.filter((row) => validations.get(row.id)?.duplicate).length, [rows, validations]);
    const blockingCount = rows.length - validRows.length;

    const updateRow = <K extends keyof ReviewCandidate>(id: string, field: K, value: ReviewCandidate[K]) => {
        setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
        setSelectionMessage('');
    };

    const toggleAllValid = (selected: boolean) => {
        setRows((current) => current.map((row) => {
            const validation = validateTaxInvoiceCandidate(row, resolvedFingerprints);
            return validation.canApply ? { ...row, selected } : row;
        }));
        setSelectionMessage('');
    };

    const handleApply = () => {
        if (selectedRows.length === 0) {
            setSelectionMessage('입력폼에 반영할 검수 완료 행을 선택하세요.');
            return;
        }
        onApply(selectedRows.map(({ selected: _selected, ...candidate }) => candidate));
    };

    const activeSourceFile = files[activeSourceFileIndex] ?? files[0];
    const activePreviewUrl = previewUrls[activeSourceFileIndex] ?? previewUrls[0] ?? '';

    const showSourceFile = (sourceFileIndex: number) => {
        setActiveSourceFileIndex(sourceFileIndex);
        setPreviewRotation(0);
    };

    return (
        <div className="tax-invoice-import-backdrop" role="presentation" onMouseDown={onClose}>
            <section
                className="tax-invoice-import-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tax-invoice-import-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="tax-invoice-import-header">
                    <div>
                        <div className="tax-invoice-import-eyebrow">
                            <FontAwesomeIcon icon={faFileInvoice} />
                            Gemini bulk review
                        </div>
                        <h2 id="tax-invoice-import-title">세금계산서 AI 대량 검수</h2>
                        <p>
                            {files.length}개 파일을 분석해 장부 입력 전에 날짜·거래처·금액·중복을 확인합니다.
                        </p>
                    </div>
                    <button type="button" className="tax-invoice-import-close" onClick={onClose} aria-label="닫기">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </header>

                <div className="tax-invoice-import-privacy">
                    선택한 문서는 AI 설정의 Gemini 모델 분석을 위해 Google Gemini API로 전송됩니다. 검수 완료 전에는 장부 DB에 저장되지 않습니다.
                </div>

                <div className="tax-invoice-import-summary" aria-live="polite">
                    <div>
                        <span>분석 진행</span>
                        <strong>{progress.completedFiles} / {progress.totalFiles}</strong>
                    </div>
                    <div>
                        <span>추출 행</span>
                        <strong>{rows.length}</strong>
                    </div>
                    <div>
                        <span>확인 필요</span>
                        <strong>{blockingCount + duplicateCount}</strong>
                    </div>
                    <div>
                        <span>선택</span>
                        <strong>{selectedRows.length}</strong>
                    </div>
                </div>

                {isAnalyzing && (
                    <div className="tax-invoice-import-loading" data-testid="tax-invoice-analysis-progress">
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <div>
                            <strong>Gemini가 문서를 분석하고 있습니다.</strong>
                            <span>{progress.currentFileName || '분석 준비 중...'}</span>
                        </div>
                    </div>
                )}

                {analysisError && (
                    <div className="tax-invoice-import-alert danger" role="alert">
                        <FontAwesomeIcon icon={faCircleExclamation} />
                        <div>
                            <strong>분석을 시작하지 못했습니다.</strong>
                            <span>{analysisError}</span>
                        </div>
                        <button type="button" onClick={() => setRunVersion((value) => value + 1)}>
                            <FontAwesomeIcon icon={faRotateRight} /> 다시 시도
                        </button>
                    </div>
                )}

                {errors.length > 0 && (
                    <div className="tax-invoice-import-file-errors" role="alert">
                        <strong><FontAwesomeIcon icon={faTriangleExclamation} /> 파일별 분석 실패 {errors.length}건</strong>
                        <ul>
                            {errors.map((error) => (
                                <li key={`${error.sourceFileIndex}-${error.sourceFileName}`}>
                                    <b>{error.sourceFileName}</b>: {error.message}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {duplicateCheckError && (
                    <div className="tax-invoice-import-file-errors" role="alert">
                        <strong><FontAwesomeIcon icon={faTriangleExclamation} /> DB 중복 검사를 완료하지 못했습니다.</strong>
                        <div>{duplicateCheckError} 입력폼 반영 전 기존 DB를 직접 확인하세요.</div>
                    </div>
                )}

                {!isAnalyzing && rows.length > 0 && (
                    <div className="tax-invoice-import-selection-bar">
                        <span>정상 행을 선택한 뒤 각 값을 원본과 대조하세요.</span>
                        <div>
                            <button type="button" onClick={() => toggleAllValid(true)}>정상 행 전체선택</button>
                            <button type="button" onClick={() => toggleAllValid(false)}>선택 해제</button>
                        </div>
                    </div>
                )}

                <div className="tax-invoice-import-workspace">
                    <aside className="tax-invoice-source-panel" aria-label="원본 문서 미리보기">
                        <div className="tax-invoice-source-panel-head">
                            <div>
                                <strong>원본 대조</strong>
                                <span>문서를 보면서 추출값을 직접 확인하세요.</span>
                            </div>
                            <div className="tax-invoice-source-tools">
                                {activeSourceFile && canPreviewAsImage(activeSourceFile) && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewRotation((value) => (value + 270) % 360)}
                                            aria-label="원본 왼쪽으로 회전"
                                            title="왼쪽으로 90도 회전"
                                        >
                                            <FontAwesomeIcon icon={faRotateLeft} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewRotation((value) => (value + 90) % 360)}
                                            aria-label="원본 오른쪽으로 회전"
                                            title="오른쪽으로 90도 회전"
                                        >
                                            <FontAwesomeIcon icon={faRotateRight} />
                                        </button>
                                    </>
                                )}
                                {activePreviewUrl && (
                                    <a
                                        href={activePreviewUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label="원본 새 창에서 열기"
                                        title="새 창에서 열기"
                                    >
                                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="tax-invoice-source-tabs" role="tablist" aria-label="업로드 문서 목록">
                            {files.map((file, index) => (
                                <button
                                    key={`${index}-${file.name}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeSourceFileIndex === index}
                                    className={activeSourceFileIndex === index ? 'active' : ''}
                                    onClick={() => showSourceFile(index)}
                                    title={file.name}
                                >
                                    {index + 1}. {file.name}
                                </button>
                            ))}
                        </div>

                        <div className="tax-invoice-source-preview">
                            {activeSourceFile && activePreviewUrl && canPreviewAsImage(activeSourceFile) && (
                                <img
                                    src={activePreviewUrl}
                                    alt={`${activeSourceFile.name} 원본`}
                                    style={{ transform: `rotate(${previewRotation}deg)` }}
                                />
                            )}
                            {activeSourceFile && activePreviewUrl && canPreviewAsPdf(activeSourceFile) && (
                                <iframe
                                    src={`${activePreviewUrl}#toolbar=1&navpanes=0`}
                                    title={`${activeSourceFile.name} 원본 미리보기`}
                                />
                            )}
                            {activeSourceFile && (!activePreviewUrl || (!canPreviewAsImage(activeSourceFile) && !canPreviewAsPdf(activeSourceFile))) && (
                                <div className="tax-invoice-source-preview-fallback">
                                    <FontAwesomeIcon icon={faFileInvoice} />
                                    <strong>{activeSourceFile.name}</strong>
                                    <span>이 형식은 브라우저에서 바로 보이지 않을 수 있습니다. 분석 결과와 원본 파일을 별도로 대조하세요.</span>
                                </div>
                            )}
                        </div>
                    </aside>

                    <div className="tax-invoice-import-content">
                        {!isAnalyzing && !analysisError && rows.length === 0 && (
                            <div className="tax-invoice-import-empty">
                                검수할 세금계산서 행이 없습니다. 파일별 오류를 확인하거나 다른 문서를 선택하세요.
                            </div>
                        )}

                        {rows.map((row, index) => {
                            const validation = validations.get(row.id)!;
                            const issueCount = validation.blockingIssues.length + validation.reviewIssues.length;
                            return (
                                <article
                                    key={row.id}
                                    className={`tax-invoice-review-card ${validation.canApply ? '' : 'has-blocking'} ${row.selected ? 'selected' : ''}`}
                                    data-testid={`tax-invoice-review-row-${index}`}
                                >
                                <div className="tax-invoice-review-card-head">
                                    <label className="tax-invoice-review-select">
                                        <input
                                            type="checkbox"
                                            checked={row.selected}
                                            disabled={!validation.canApply}
                                            onChange={(event) => updateRow(row.id, 'selected', event.target.checked)}
                                        />
                                        <span>{index + 1}번 행</span>
                                    </label>
                                    <div className="tax-invoice-review-source">
                                        <strong>{row.sourceFileName}</strong>
                                        <span>{row.documentKind} · 신뢰도 {Math.round(row.confidence * 100)}%</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="tax-invoice-review-show-source"
                                        onClick={() => showSourceFile(row.sourceFileIndex)}
                                    >
                                        원본 보기
                                    </button>
                                    <span className={`tax-invoice-review-status ${validation.canApply ? 'ready' : 'blocked'}`}>
                                        {validation.canApply ? <FontAwesomeIcon icon={faCheck} /> : <FontAwesomeIcon icon={faTriangleExclamation} />}
                                        {validation.canApply ? (issueCount ? `검토 ${issueCount}` : '정상') : `수정 필요 ${validation.blockingIssues.length}`}
                                    </span>
                                </div>

                                <div className="tax-invoice-review-grid">
                                    <label>
                                        <span>구분 *</span>
                                        <select
                                            value={row.transactionType}
                                            onChange={(event) => updateRow(row.id, 'transactionType', event.target.value as ReviewCandidate['transactionType'])}
                                        >
                                            <option value="">선택</option>
                                            <option value="매입">매입</option>
                                            <option value="매출">매출</option>
                                        </select>
                                    </label>
                                    <label>
                                        <span>작성일자 *</span>
                                        <input
                                            type="date"
                                            value={row.issueDate}
                                            onChange={(event) => updateRow(row.id, 'issueDate', event.target.value)}
                                        />
                                    </label>
                                    <label className="wide">
                                        <span>거래처명 *</span>
                                        <input
                                            type="text"
                                            value={row.partnerName}
                                            onChange={(event) => updateRow(row.id, 'partnerName', event.target.value)}
                                        />
                                    </label>
                                    <label className="wide">
                                        <span>현장명</span>
                                        <input
                                            type="text"
                                            value={row.siteName}
                                            placeholder="문서에 명시된 경우만 입력"
                                            onChange={(event) => updateRow(row.id, 'siteName', event.target.value)}
                                        />
                                    </label>
                                    <label className="description">
                                        <span>내용</span>
                                        <input
                                            type="text"
                                            value={row.description}
                                            onChange={(event) => updateRow(row.id, 'description', event.target.value)}
                                        />
                                    </label>
                                    <label>
                                        <span>공급가액 *</span>
                                        <input
                                            type="number"
                                            value={row.supplyAmount}
                                            onChange={(event) => updateRow(row.id, 'supplyAmount', toNumber(event.target.value))}
                                        />
                                    </label>
                                    <label>
                                        <span>부가세 *</span>
                                        <input
                                            type="number"
                                            value={row.taxAmount}
                                            onChange={(event) => updateRow(row.id, 'taxAmount', toNumber(event.target.value))}
                                        />
                                    </label>
                                    <label>
                                        <span>합계 *</span>
                                        <input
                                            type="number"
                                            value={row.totalAmount}
                                            onChange={(event) => updateRow(row.id, 'totalAmount', toNumber(event.target.value))}
                                        />
                                    </label>
                                    <label className="note">
                                        <span>비고</span>
                                        <input
                                            type="text"
                                            value={row.note}
                                            onChange={(event) => updateRow(row.id, 'note', event.target.value)}
                                        />
                                    </label>
                                </div>

                                <div className="tax-invoice-review-evidence">
                                    <span>공급자 <b>{row.supplierName || '-'}</b></span>
                                    <span>공급받는 자 <b>{row.recipientName || '-'}</b></span>
                                    <span>승인번호 <b>{row.approvalNumber || '-'}</b></span>
                                    <span>문서 합계 <b>{formatNumber(row.totalAmount)}원</b></span>
                                </div>

                                {(validation.blockingIssues.length > 0 || validation.reviewIssues.length > 0) && (
                                    <div className="tax-invoice-review-issues">
                                        {validation.blockingIssues.map((issue) => (
                                            <span key={`blocking-${issue}`} className="blocking">수정 필요 · {issue}</span>
                                        ))}
                                        {validation.reviewIssues.map((issue) => (
                                            <span key={`review-${issue}`} className="review">확인 · {issue}</span>
                                        ))}
                                    </div>
                                )}
                                </article>
                            );
                        })}
                    </div>
                </div>

                <footer className="tax-invoice-import-footer">
                    <div>
                        <strong>{selectedRows.length}건을 입력폼에 반영합니다.</strong>
                        <span>반영 후에도 DB 등록 전 그리드에서 다시 수정할 수 있습니다.</span>
                        {selectionMessage && <em role="alert">{selectionMessage}</em>}
                    </div>
                    <div className="tax-invoice-import-footer-actions">
                        <button type="button" className="secondary" onClick={onClose}>취소</button>
                        <button
                            type="button"
                            className="primary"
                            onClick={handleApply}
                            disabled={isAnalyzing || rows.length === 0}
                        >
                            <FontAwesomeIcon icon={faCheck} />
                            검수 완료 · 입력폼 반영 ({selectedRows.length})
                        </button>
                    </div>
                </footer>
            </section>
        </div>
    );
};

export default TaxInvoiceBulkImportModal;
