import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faDownload, faExclamationTriangle, faEye, faRefresh, faSpinner, faTrash, faUpload } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { SYSTEM_COLLECTIONS } from '../../constants/collectionConfig';
import { exportCollectionToExcel, fetchCollectionData, fetchCollectionSample, getCollectionCapabilities, readExcelFile, resetCollection, restoreBatchData } from '../../services/backupService';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { UserRole } from '../../types/roles';
import { auditService } from '../../services/auditService';

const MySwal = withReactContent(Swal);

const PreviewTable = ({ data }: { data: Array<Record<string, unknown>> }) => {
  if (!data.length) return <p className="text-sm text-slate-500">No data.</p>;
  const headers = Object.keys(data[0]);
  return (
    <div className="mt-3 max-h-72 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm text-slate-600">
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="border-b px-3 py-2 whitespace-nowrap">{header}</th>)}</tr>
        </thead>
        <tbody>
          {data.slice(0, 20).map((row, index) => (
            <tr key={index} className="border-b bg-white hover:bg-slate-50">
              {headers.map((header) => <td key={`${index}-${header}`} className="max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2">{String(row[header] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 20 && <p className="p-2 text-center text-xs text-slate-400">...and {data.length - 20} more rows...</p>}
    </div>
  );
};

const DataBackupPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countErrors, setCountErrors] = useState<Record<string, string | undefined>>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [authzLoading, setAuthzLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const collections = SYSTEM_COLLECTIONS;

  const isAdminRole = useMemo(() => {
    const role = String(userRole ?? '').trim();
    return role === 'admin' || role === UserRole.ADMIN || role === 'manager';
  }, [userRole]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!currentUser) {
          if (!cancelled) {
            setUserRole(null);
            setAuthzLoading(false);
          }
          return;
        }
        const row = await userService.getUser(currentUser.uid);
        if (!cancelled) {
          setUserRole(row?.role ? String(row.role) : 'user');
          setAuthzLoading(false);
        }
      } catch {
        if (!cancelled) {
          setUserRole('user');
          setAuthzLoading(false);
        }
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [currentUser]);

  const writeAudit = useCallback(async (action: string, targetId: string, details?: Record<string, unknown>) => {
    if (!currentUser) return;
    await auditService.log({ action, category: 'SYSTEM', actorId: currentUser.uid, actorEmail: currentUser.email ?? 'unknown', targetId, details });
  }, [currentUser]);

  const fetchCounts = useCallback(async () => {
    setLoadingCounts(true);
    const nextCounts: Record<string, number> = {};
    const nextErrors: Record<string, string | undefined> = {};
    for (const collection of collections) {
      try {
        const data = await fetchCollectionData(collection.id);
        nextCounts[collection.id] = Array.isArray(data) ? data.length : 0;
        nextErrors[collection.id] = undefined;
      } catch (error) {
        nextCounts[collection.id] = 0;
        nextErrors[collection.id] = error instanceof Error ? error.message : String(error);
      }
    }
    setCounts(nextCounts);
    setCountErrors(nextErrors);
    setLoadingCounts(false);
  }, [collections]);

  useEffect(() => {
    if (authzLoading || !currentUser || !isAdminRole) return;
    void fetchCounts();
  }, [authzLoading, currentUser, isAdminRole, fetchCounts]);

  const getCapability = useCallback((collectionId: string) => {
    const caps = getCollectionCapabilities(collectionId);
    const canRestore = !!caps?.canRestore;
    const canReset = !!caps?.canReset;
    if (!canRestore && !canReset) return { canRestore, canReset, reason: 'Restore and reset are both unavailable.' };
    if (!canRestore) return { canRestore, canReset, reason: 'Restore is not available for this collection.' };
    if (!canReset) return { canRestore, canReset, reason: 'Reset is not available for this collection.' };
    return { canRestore, canReset };
  }, []);

  const handlePreview = useCallback(async (collectionId: string, label: string) => {
    if (processingId || previewingId) return;
    setPreviewingId(collectionId);
    try {
      const rows = await fetchCollectionSample(collectionId, 20);
      await MySwal.fire({ title: `${label} preview`, width: '90%', html: <div className="text-left"><p className="text-xs text-slate-500">Sample rows: {rows.length} (max 20)</p><PreviewTable data={rows as Array<Record<string, unknown>>} /></div>, confirmButtonText: 'Close' });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Preview failed', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setPreviewingId(null);
    }
  }, [previewingId, processingId]);

  const handleExport = useCallback(async (collectionId: string) => {
    if (processingId) return;
    setProcessingId(collectionId);
    try {
      await exportCollectionToExcel(collectionId);
      await writeAudit('BACKUP_EXPORT', collectionId);
      await Swal.fire({ icon: 'success', title: 'Export complete', text: `Downloaded ${collectionId}.` });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Export failed', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setProcessingId(null);
    }
  }, [processingId, writeAudit]);

  const handleRestore = useCallback(async (collectionId: string, label: string, file: File) => {
    if (processingId) return;
    setProcessingId(collectionId);
    try {
      const rows = await readExcelFile(file);
      if (!rows.length) throw new Error('No rows found in the selected file.');
      const confirm = await Swal.fire({ icon: 'warning', title: `${label} restore`, html: `<p>Restore <strong>${rows.length}</strong> rows from <strong>${file.name}</strong>.</p><p class="mt-2 text-sm text-slate-500">Existing IDs will be merged.</p>`, showCancelButton: true, confirmButtonText: 'Restore', cancelButtonText: 'Cancel' });
      if (!confirm.isConfirmed) return;
      setProgress({ current: 0, total: rows.length, message: `Restoring ${label}...` });
      const result = await restoreBatchData(collectionId, rows, (current, total) => setProgress({ current, total, message: `Restoring ${label}...` }));
      setProgress(null);
      await fetchCounts();
      await writeAudit('BACKUP_RESTORE', collectionId, { total: result.total, success: result.success, failed: result.failed });
      await Swal.fire({ icon: result.failed > 0 ? 'warning' : 'success', title: 'Restore complete', html: `<p>Success: ${result.success}</p><p>Failed: ${result.failed}</p>` });
    } catch (error) {
      setProgress(null);
      await Swal.fire({ icon: 'error', title: 'Restore failed', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setProcessingId(null);
    }
  }, [fetchCounts, processingId, writeAudit]);

  const handleReset = useCallback(async (collectionId: string, label: string) => {
    if (processingId) return;
    const confirm = await Swal.fire({ icon: 'warning', title: `${label} reset`, html: `<p>This will permanently delete the <strong>${label}</strong> collection data.</p><p class="mt-2 text-sm text-slate-500">Type <strong>${collectionId}</strong> to continue.</p>`, input: 'text', inputPlaceholder: collectionId, showCancelButton: true, confirmButtonText: 'Reset', cancelButtonText: 'Cancel', preConfirm: (value) => { if (String(value ?? '').trim() !== collectionId) Swal.showValidationMessage('Collection ID does not match.'); return value; } });
    if (!confirm.isConfirmed) return;
    setProcessingId(collectionId);
    try {
      setProgress({ current: 0, total: 1, message: `Resetting ${label}...` });
      const deletedCount = await resetCollection(collectionId);
      setProgress(null);
      await fetchCounts();
      await writeAudit('BACKUP_RESET', collectionId, { deletedCount });
      await Swal.fire({ icon: 'success', title: 'Reset complete', text: `Deleted ${deletedCount} rows.` });
    } catch (error) {
      setProgress(null);
      await Swal.fire({ icon: 'error', title: 'Reset failed', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setProcessingId(null);
    }
  }, [fetchCounts, processingId, writeAudit]);

  if (authzLoading) return <div className="p-8 text-sm text-slate-500">Checking permissions...</div>;
  if (!currentUser || !isAdminRole) return <div className="mx-auto max-w-3xl p-8"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">Only admins can use backup and reset tools.</div></div>;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-800"><FontAwesomeIcon icon={faDatabase} className="text-rose-500" />Firestore backup and reset</h1>
          <p className="mt-2 text-sm text-slate-500">Run preview, export, restore, and reset operations per collection.</p>
        </div>
        <button type="button" onClick={() => void fetchCounts()} disabled={loadingCounts} className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><FontAwesomeIcon icon={faRefresh} className={loadingCounts ? 'mr-2 animate-spin' : 'mr-2'} />Refresh</button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 lg:grid-cols-2">
        <div><p className="font-bold">Scope</p><p className="mt-1 text-slate-600">Backup, restore, and reset run per Firestore collection.</p></div>
        <div><p className="font-bold">Risk</p><p className="mt-1 text-slate-600">Reset is irreversible. Restore can pollute data if the source file is wrong.</p></div>
        <div><p className="font-bold">Verification</p><p className="mt-1 text-slate-600">Preview rows and refresh counts after each operation.</p></div>
        <div><p className="font-bold">Audit</p><p className="mt-1 text-slate-600">Exports, restores, and resets are logged through the audit service.</p></div>
      </div>

      <div className="mb-8 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4"><FontAwesomeIcon icon={faExclamationTriangle} className="mt-1 text-rose-500" /><div><h2 className="text-lg font-bold text-rose-800">Admin warning</h2><p className="mt-1 text-sm text-rose-700">Always export a backup before running reset.</p></div></div>

      {progress && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-2xl"><FontAwesomeIcon icon={faSpinner} spin className="mb-4 text-4xl text-indigo-600" /><h3 className="mb-2 text-xl font-bold">{progress.message}</h3><div className="mb-4 h-2.5 w-full rounded-full bg-slate-200"><div className="h-2.5 rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.max(1, Math.round((progress.current / progress.total) * 100))}%` }} /></div><p className="text-sm text-slate-500">{Math.round((progress.current / progress.total) * 100)}% complete</p></div></div>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection) => {
          const capability = getCapability(collection.id);
          const borderColor = processingId === collection.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200';
          return (
            <div key={collection.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${borderColor}`}>
              <div className="relative border-b border-slate-100 p-5">
                <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-800">{collection.label}</h2><span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-600">FS</span></div>
                <p className="font-mono text-xs text-slate-400">{collection.id}</p>
                <div className="absolute right-5 top-5 text-right"><div className={`text-3xl font-bold ${counts[collection.id] > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{loadingCounts ? '-' : (counts[collection.id] ?? 0)}</div><div className="text-xs text-slate-400">rows</div></div>
                <p className="mt-4 min-h-[40px] text-sm text-slate-500">{collection.description}</p>
                {countErrors[collection.id] ? <p className="mt-2 break-all text-xs text-rose-600">Load failed: {countErrors[collection.id]}</p> : null}
                {!capability.canRestore || !capability.canReset ? <p className="mt-2 text-xs text-amber-600">{capability.reason}</p> : null}
              </div>
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-4">
                <button type="button" onClick={() => void handlePreview(collection.id, collection.label)} disabled={!!processingId || !!previewingId} className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 transition hover:text-indigo-600 disabled:opacity-50"><FontAwesomeIcon icon={faEye} className="text-lg" /><span>Preview</span></button>
                <button type="button" onClick={() => void handleExport(collection.id)} disabled={!!processingId} className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 transition hover:text-indigo-600 disabled:opacity-50"><FontAwesomeIcon icon={faDownload} className="text-lg" /><span>Export</span></button>
                <label className={`flex h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-white text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 ${!!processingId || !capability.canRestore ? 'pointer-events-none opacity-50' : ''}`}><input type="file" accept=".xlsx,.xls" className="hidden" disabled={!!processingId || !capability.canRestore} onChange={(event) => { const file = event.target.files?.[0]; if (file) { void handleRestore(collection.id, collection.label, file); event.target.value = ''; } }} /><FontAwesomeIcon icon={faUpload} className="text-lg" /><span>Restore</span></label>
                <button type="button" onClick={() => void handleReset(collection.id, collection.label)} disabled={!!processingId || !capability.canReset} className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-rose-200 bg-white text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"><FontAwesomeIcon icon={faTrash} className="text-lg" /><span>Reset</span></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DataBackupPage;