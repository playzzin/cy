import React, { useRef, useState } from 'react';
import { FileImage, FileText, Trash2, UploadCloud, X } from 'lucide-react';
import { fileTransferAuditService } from '../../services/fileTransferAuditService';

interface AiDocumentDropzoneProps {
    files: File[];
    title: string;
    description: string;
    disabled?: boolean;
    maxFiles?: number;
    onFilesChange: (files: File[]) => void;
}

const ACCEPTED_FILE_TYPES = 'image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf';

const fileKey = (file: File): string => `${file.name}:${file.size}:${file.lastModified}`;
const isPdf = (file: File): boolean => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const mergeFiles = (current: File[], incoming: File[], maxFiles: number): File[] => {
    const merged = new Map(current.map((file) => [fileKey(file), file]));
    incoming.forEach((file) => merged.set(fileKey(file), file));
    return Array.from(merged.values()).slice(0, maxFiles);
};

const AiDocumentDropzone: React.FC<AiDocumentDropzoneProps> = ({
    files,
    title,
    description,
    disabled = false,
    maxFiles = 20,
    onFilesChange,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);

    const addFiles = (incoming: File[]) => {
        if (disabled || incoming.length === 0) return;
        const nextFiles = mergeFiles(files, incoming, maxFiles);
        const currentKeys = new Set(files.map(fileKey));
        const addedPdfFiles = nextFiles.filter((file) => !currentKeys.has(fileKey(file)) && isPdf(file));
        onFilesChange(nextFiles);

        if (addedPdfFiles.length > 0) {
            void fileTransferAuditService.log({
                kind: 'pdf',
                direction: 'upload',
                status: 'success',
                source: title,
                operation: 'selected',
                fileNames: addedPdfFiles.map((file) => file.name),
                fileCount: addedPdfFiles.length,
                fileSize: addedPdfFiles.reduce((total, file) => total + file.size, 0),
            });
        }
    };

    const openFilePicker = () => {
        if (!disabled) inputRef.current?.click();
    };

    return (
        <div className="min-w-0">
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                className="hidden"
                aria-label={`${title} 파일 선택`}
                disabled={disabled}
                onChange={(event) => {
                    addFiles(Array.from(event.target.files ?? []));
                    event.target.value = '';
                }}
            />

            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                data-testid="ai-document-dropzone"
                aria-label={`${title} 파일 드롭 영역`}
                aria-disabled={disabled}
                onClick={openFilePicker}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openFilePicker();
                    }
                }}
                onDragEnter={(event) => {
                    event.preventDefault();
                    if (!disabled) setDragActive(true);
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    if (!disabled) setDragActive(true);
                }}
                onDragLeave={(event) => {
                    event.preventDefault();
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragActive(false);
                    addFiles(Array.from(event.dataTransfer.files ?? []));
                }}
                className={`flex min-h-[250px] flex-col items-center justify-center border-2 border-dashed px-6 py-8 text-center transition ${
                    dragActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/60'
                } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
                <span className={`flex h-14 w-14 items-center justify-center rounded-full ${dragActive ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200'}`}>
                    <UploadCloud className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-extrabold text-slate-900">{dragActive ? '여기에 놓아주세요' : title}</h3>
                <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-500">{description}</p>
                <span className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-xs font-extrabold text-white">파일 선택</span>
                <p className="mt-3 text-[11px] font-semibold text-slate-400">JPG · PNG · WEBP · PDF · 최대 {maxFiles}개</p>
            </div>

            <div className="mt-4 border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
                    <div>
                        <p className="text-xs font-extrabold text-slate-700">선택 파일 {files.length}개</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-400">같은 파일은 한 번만 추가됩니다.</p>
                    </div>
                    {files.length > 0 && (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onFilesChange([]);
                            }}
                            disabled={disabled}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> 전체 비우기
                        </button>
                    )}
                </div>
                {files.length === 0 ? (
                    <div className="px-3 py-8 text-center text-xs font-semibold text-slate-400">아직 선택한 파일이 없습니다.</div>
                ) : (
                    <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto">
                        {files.map((file) => {
                            const pdfFile = isPdf(file);
                            const FileIcon = pdfFile ? FileText : FileImage;
                            return (
                                <li key={fileKey(file)} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                                    <FileIcon className={`h-4 w-4 shrink-0 ${pdfFile ? 'text-rose-500' : 'text-blue-500'}`} aria-hidden="true" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-bold text-slate-700">{file.name}</p>
                                        <p className="mt-0.5 text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label={`${file.name} 삭제`}
                                        title="선택에서 삭제"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onFilesChange(files.filter((item) => fileKey(item) !== fileKey(file)));
                                        }}
                                        disabled={disabled}
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default AiDocumentDropzone;
