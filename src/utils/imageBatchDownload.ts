import JSZip from 'jszip';

type DirectoryPickerWindow = Window & {
    showDirectoryPicker?: (options: { mode: 'readwrite'; startIn: 'downloads' }) => Promise<FileSystemDirectoryHandle>;
};

export const canSaveImageFolder = (): boolean => typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';

type ImageBatchLabel = '신분증' | '계좌' | '통장사본';

const batchName = (label: ImageBatchLabel): string => {
    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const suffix = Array.from(crypto.getRandomValues(new Uint32Array(2)), value => value.toString(16).padStart(8, '0')).join('');
    return `${label}_사진_${timestamp}_${suffix}`;
};

export const saveImageFolder = async (files: File[], signal: AbortSignal, label: ImageBatchLabel = '신분증'): Promise<{
    folderName: string; saved: File[]; failed: File[];
}> => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker || !files.length) throw new Error('folder-save-unavailable');
    // Invoke the picker before the first await to preserve the button's user activation.
    const parent = await picker.call(window, { mode: 'readwrite', startIn: 'downloads' });
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    let folderName = batchName(label);
    // Never reuse an existing folder or overwrite the user's files.
    for (let suffix = 1; ; suffix += 1) {
        try { await parent.getDirectoryHandle(folderName); }
        catch (error) {
            if ((error as DOMException).name === 'NotFoundError') break;
            throw error;
        }
        folderName = `${batchName(label)}_${suffix}`;
    }
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const folder = await parent.getDirectoryHandle(folderName, { create: true });
    const saved: File[] = [], failed: File[] = [];
    for (const file of files) {
        if (signal.aborted) break;
        let writable: FileSystemWritableFileStream | undefined;
        try {
            const handle = await folder.getFileHandle(file.name, { create: true });
            writable = await handle.createWritable();
            if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
            await writable.write(file);
            if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
            await writable.close();
            saved.push(file);
        } catch {
            await writable?.abort().catch(() => undefined);
            // Only remove a failed file in the new folder created for this operation.
            await folder.removeEntry(file.name).catch(() => undefined);
            if (!signal.aborted) failed.push(file);
        }
    }
    return { folderName, saved, failed };
};

export const zipImageFiles = async (files: File[], label: ImageBatchLabel = '신분증'): Promise<File> => {
    if (!files.length) throw new Error('no-images');
    const zip = new JSZip();
    files.forEach(file => zip.file(file.name, file));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    return new File([blob], `${batchName(label)}.zip`, { type: 'application/zip' });
};
