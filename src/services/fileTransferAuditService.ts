export type FileTransferKind = 'excel' | 'pdf';
export type FileTransferDirection = 'upload' | 'download';
export type FileTransferStatus = 'success' | 'failure';

const EXCEL_DOWNLOAD_EXTENSION = /\.(?:xlsx|xls|csv)$/i;
const PDF_DOWNLOAD_EXTENSION = /\.pdf$/i;
const DOWNLOAD_DEDUPLICATION_WINDOW_MS = 2000;

type BrowserDownloadAuditInput = Pick<FileTransferAuditInput, 'kind' | 'fileName'>;

const recentExplicitDownloads = new Map<string, number>();

const downloadKey = ({ kind, fileName }: BrowserDownloadAuditInput): string => (
    `${kind}:${String(fileName || '').trim().toLocaleLowerCase()}`
);

/** Returns the audit bucket for browser files that this feature tracks. */
export const getFileTransferKindForDownload = (fileName: string): FileTransferKind | undefined => {
    const normalized = String(fileName || '').trim();
    if (EXCEL_DOWNLOAD_EXTENSION.test(normalized)) return 'excel';
    if (PDF_DOWNLOAD_EXTENSION.test(normalized)) return 'pdf';
    return undefined;
};

export interface FileTransferAuditInput {
    kind: FileTransferKind;
    direction: FileTransferDirection;
    status: FileTransferStatus;
    source: string;
    operation?: string;
    fileName?: string;
    fileNames?: string[];
    fileSize?: number;
    fileCount?: number;
    recordCount?: number;
    details?: Record<string, unknown>;
    error?: unknown;
}

const errorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return error == null ? '' : String(error);
};

const loadAuditDependencies = async () => {
    const [{ auth }, { auditService }] = await Promise.all([
        import('../config/firebaseAuth'),
        import('./auditService'),
    ]);

    return { auth, auditService };
};

const currentActor = (user: {
    uid?: string | null;
    email?: string | null;
    displayName?: string | null;
} | null) => {
    return {
        actorId: user?.uid || 'system',
        actorEmail: user?.email || 'system',
        actorName: user?.displayName || undefined,
    };
};

const actionFor = (kind: FileTransferKind, direction: FileTransferDirection, status: FileTransferStatus): string => (
    `${kind.toUpperCase()}_${direction.toUpperCase()}_${status.toUpperCase()}`
);

const targetNameFor = (kind: FileTransferKind, direction: FileTransferDirection): string => {
    const fileLabel = kind === 'excel' ? 'Excel' : 'PDF';
    const directionLabel = direction === 'upload' ? 'upload' : 'download';
    return `${fileLabel} ${directionLabel}`;
};

/** Records metadata only: file contents are never stored in audit logs. */
export const fileTransferAuditService = {
    async log(input: FileTransferAuditInput): Promise<void> {
        try {
            const { auth, auditService } = await loadAuditDependencies();

            if (input.direction === 'download' && input.fileName) {
                recentExplicitDownloads.set(downloadKey({ kind: input.kind, fileName: input.fileName }), Date.now());
            }

            const names = Array.from(new Set([
                ...(input.fileNames || []),
                input.fileName || '',
            ].map((name) => String(name).trim()).filter(Boolean)));

            await auditService.log({
                action: actionFor(input.kind, input.direction, input.status),
                category: 'FILE_TRANSFER',
                ...currentActor(auth.currentUser),
                targetId: input.source,
                targetName: targetNameFor(input.kind, input.direction),
                details: {
                    fileKind: input.kind,
                    direction: input.direction,
                    status: input.status,
                    source: input.source,
                    operation: input.operation || input.direction,
                    fileNames: names,
                    fileCount: input.fileCount ?? names.length,
                    fileSize: input.fileSize,
                    recordCount: input.recordCount,
                    errorMessage: input.status === 'failure' ? errorMessage(input.error) : undefined,
                    ...input.details,
                },
            });
        } catch (error) {
            // Audit logging is deliberately non-blocking. A telemetry failure
            // must never turn a successful upload or download into an app error.
            if (process.env.NODE_ENV !== 'test') {
                console.warn('[FileTransferAudit] Audit log could not be recorded:', error);
            }
        }
    },
};

const fileNameFromAnchor = (anchor: HTMLAnchorElement): string => {
    const downloadName = anchor.download.trim();
    if (downloadName) return downloadName;

    try {
        return new URL(anchor.href, window.location.href).pathname.split('/').pop() || '';
    } catch {
        return '';
    }
};

/**
 * Records xlsx/xls/csv and PDF downloads triggered by third-party writers
 * (SheetJS, FileSaver, or ordinary download links). Explicit callers win over
 * this fallback, so richer metadata such as record counts is preserved.
 */
export const installBrowserDownloadAudit = (): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const installedFlag = '__cyFileTransferDownloadAuditInstalled__';
    const auditWindow = window as Window & { [installedFlag]?: boolean };
    if (auditWindow[installedFlag]) return;
    auditWindow[installedFlag] = true;

    const handledAnchors = new WeakSet<HTMLAnchorElement>();
    const queueAudit = (anchor: HTMLAnchorElement) => {
        if (handledAnchors.has(anchor)) return;
        handledAnchors.add(anchor);
        queueMicrotask(() => handledAnchors.delete(anchor));

        const fileName = fileNameFromAnchor(anchor);
        const kind = getFileTransferKindForDownload(fileName);
        if (!kind) return;

        window.setTimeout(() => {
            void import('../config/firebaseAuth')
                .then(({ auth }) => {
                    if (!auth.currentUser) return;

                    const key = downloadKey({ kind, fileName });
                    const lastExplicitAt = recentExplicitDownloads.get(key) || 0;
                    if (Date.now() - lastExplicitAt < DOWNLOAD_DEDUPLICATION_WINDOW_MS) return;

                    return fileTransferAuditService.log({
                        kind,
                        direction: 'download',
                        status: 'success',
                        source: window.location.pathname,
                        operation: 'browser_download',
                        fileName,
                        details: { href: anchor.href.startsWith('blob:') ? 'blob' : anchor.href },
                    });
                })
                .catch((error) => {
                    console.warn('[FileTransferAudit] Browser download audit failed:', error);
                });
        }, 0);
    };

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const anchor = target.closest('a[download]');
        if (anchor instanceof HTMLAnchorElement) queueAudit(anchor);
    }, true);

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function clickWithTransferAudit(this: HTMLAnchorElement): void {
        queueAudit(this);
        originalClick.call(this);
    };

    // FileSaver dispatches a synthetic click on a detached anchor, which does
    // not reach the document listener above. Scope this hook to anchors only.
    const originalDispatchEvent = HTMLAnchorElement.prototype.dispatchEvent;
    HTMLAnchorElement.prototype.dispatchEvent = function dispatchWithTransferAudit(this: HTMLAnchorElement, event: Event): boolean {
        if (event.type === 'click') queueAudit(this);
        return originalDispatchEvent.call(this, event);
    };
};
