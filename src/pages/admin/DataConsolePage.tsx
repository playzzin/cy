import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef, GridReadyEvent, ModuleRegistry } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faDatabase, faFileInvoice, faHardHat, faLayerGroup, faRefresh, faSearch, faSpinner, faTable, faUsers } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { listAllCompanies, listAllDailyReports, listAllDailyReportWorkers, listAllSites, listAllTeams, listAllWorkers } from '../../services/firestoreCrudCompat';

ModuleRegistry.registerModules([AllCommunityModule]);

type CollectionId = 'workers' | 'teams' | 'sites' | 'companies' | 'daily_reports' | 'daily_report_workers';
type CollectionConfig = { id: CollectionId; name: string; description: string; icon: any };

const GROUPS: Array<{ groupName: string; collections: CollectionConfig[] }> = [
  { groupName: 'Core data', collections: [
    { id: 'workers', name: 'Workers', description: 'Worker master data', icon: faHardHat },
    { id: 'teams', name: 'Teams', description: 'Team master data', icon: faUsers },
    { id: 'sites', name: 'Sites', description: 'Site master data', icon: faBuilding },
    { id: 'companies', name: 'Companies', description: 'Company master data', icon: faBuilding },
  ] },
  { groupName: 'Work data', collections: [
    { id: 'daily_reports', name: 'Daily reports', description: 'Daily work reports', icon: faFileInvoice },
    { id: 'daily_report_workers', name: 'Report rows', description: 'Daily report worker rows', icon: faTable },
  ] },
];

const FETCHERS: Record<CollectionId, () => Promise<any[]>> = {
  companies: async () => ((await listAllCompanies()) as any)?.data?.companies ?? [],
  teams: async () => ((await listAllTeams()) as any)?.data?.teams ?? [],
  workers: async () => ((await listAllWorkers()) as any)?.data?.workers ?? [],
  sites: async () => ((await listAllSites()) as any)?.data?.sites ?? [],
  daily_reports: async () => ((await listAllDailyReports()) as any)?.data?.dailyReports ?? [],
  daily_report_workers: async () => ((await listAllDailyReportWorkers()) as any)?.data?.dailyReportWorkers ?? [],
};

const toCellValue = (value: unknown): string | number | boolean => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
};

const isRecent = (value: unknown): boolean => {
  if (!value) return false;
  const parsed = new Date(String(value));
  return !Number.isNaN(parsed.getTime()) && Date.now() - parsed.getTime() <= 86400000;
};

const DataConsolePage: React.FC = () => {
  const [selectedCollectionId, setSelectedCollectionId] = useState<CollectionId>('workers');
  const [rowData, setRowData] = useState<any[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [gridApi, setGridApi] = useState<any>(null);

  const currentCollection = useMemo(() => GROUPS.flatMap((group) => group.collections).find((item) => item.id === selectedCollectionId) ?? GROUPS[0].collections[0], [selectedCollectionId]);

  const buildColumns = useCallback((docs: any[]) => {
    const keys = new Set<string>();
    docs.slice(0, 50).forEach((doc) => doc && typeof doc === 'object' && Object.keys(doc).forEach((key) => keys.add(key)));
    const ordered = ['id', ...Array.from(keys).filter((key) => key !== 'id').sort((a, b) => a.localeCompare(b))];
    setColumnDefs(ordered.map((key) => ({
      field: key,
      headerName: key,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: key === 'id' ? 220 : 140,
      valueGetter: (params: any) => toCellValue(params.data?.[key]),
      tooltipValueGetter: (params: any) => toCellValue(params.data?.[key]),
    })));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await FETCHERS[selectedCollectionId]();
      const nextRows = Array.isArray(rows) ? rows : [];
      setRowData(nextRows);
      buildColumns(nextRows);
    } catch (error: any) {
      console.error('[DataConsolePage] load failed', error);
      setRowData([]);
      setColumnDefs([]);
      await Swal.fire({ icon: 'error', title: 'Load failed', text: error?.message ?? 'Failed to load Firestore data.' });
    } finally {
      setLoading(false);
    }
  }, [buildColumns, selectedCollectionId]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { if (gridApi) gridApi.setGridOption('quickFilterText', searchText); }, [gridApi, searchText]);

  const stats = useMemo(() => ({
    totalDocs: rowData.length,
    activeDocs: rowData.filter((row) => row?.isActive !== false && row?.status !== 'inactive' && row?.status !== 'completed').length,
    recentDocs: rowData.filter((row) => isRecent(row?.updatedAt ?? row?.createdAt)).length,
  }), [rowData]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="mx-auto flex max-w-[1800px]">
        <aside className="w-[280px] border-r border-white/10 bg-slate-950/60 p-6">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-3 text-xl font-black"><FontAwesomeIcon icon={faDatabase} className="text-indigo-400" /><span>Data console</span></div>
            <p className="text-sm text-slate-400">Firestore read-only viewer.</p>
          </div>
          <div className="space-y-6">
            {GROUPS.map((group) => (
              <div key={group.groupName}>
                <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{group.groupName}</div>
                <div className="space-y-2">
                  {group.collections.map((collection) => {
                    const selected = collection.id === selectedCollectionId;
                    return (
                      <button key={collection.id} type="button" onClick={() => setSelectedCollectionId(collection.id)} className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selected ? 'border-indigo-500/50 bg-indigo-500/10 shadow-lg shadow-indigo-900/20' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'}`}>
                        <div className="mb-1 flex items-center gap-3 text-sm font-semibold text-white"><FontAwesomeIcon icon={collection.icon} className={selected ? 'text-indigo-300' : 'text-slate-400'} /><span>{collection.name}</span></div>
                        <p className="text-xs text-slate-400">{collection.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-3"><h1 className="text-3xl font-black">{currentCollection.name}</h1><span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-mono text-emerald-200">Read-only</span></div>
              <p className="max-w-2xl text-sm text-slate-400">{currentCollection.description}</p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center"><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Total</div><div className="text-2xl font-black">{stats.totalDocs.toLocaleString()}</div></div>
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-5 py-3 text-center"><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-200">Active</div><div className="text-2xl font-black text-indigo-300">{stats.activeDocs.toLocaleString()}</div></div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-center"><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-200">Recent 24h</div><div className="text-2xl font-black text-emerald-300">{stats.recentDocs.toLocaleString()}</div></div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative max-w-md flex-1 min-w-[280px]"><FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search collection data" className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-400 outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20" /></div>
            <button type="button" onClick={() => void fetchData()} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white" title="Refresh"><FontAwesomeIcon icon={faRefresh} spin={loading} /></button>
            <div className="flex h-11 items-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 text-sm font-semibold text-indigo-200"><FontAwesomeIcon icon={faLayerGroup} className="mr-2" />Firestore</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/60 shadow-2xl backdrop-blur-xl">
            <div className="border-b border-white/10 px-6 py-4 text-sm text-slate-400">Current collection: <span className="font-mono text-slate-200">{selectedCollectionId}</span></div>
            <div className="relative h-[720px] p-6">
              {loading && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-slate-900/75 backdrop-blur-sm"><FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-indigo-400" /><div className="text-sm font-semibold text-slate-300">Loading Firestore data...</div></div>}
              <div className="ag-theme-quartz-dark h-full w-full" style={{ '--ag-background-color': 'transparent', '--ag-header-background-color': 'rgba(255, 255, 255, 0.03)', '--ag-row-hover-color': 'rgba(99, 102, 241, 0.16)', '--ag-header-foreground-color': '#94a3b8', '--ag-foreground-color': '#f1f5f9', '--ag-border-color': 'rgba(255, 255, 255, 0.05)', '--ag-row-border-color': 'rgba(255, 255, 255, 0.03)' } as React.CSSProperties}>
                <AgGridReact rowData={rowData} columnDefs={columnDefs} onGridReady={(event: GridReadyEvent) => setGridApi(event.api)} defaultColDef={{ sortable: true, filter: true, resizable: true, floatingFilter: true, flex: 1, minWidth: 140 }} pagination={true} paginationPageSize={20} paginationPageSizeSelector={[20, 50, 100]} animateRows={true} rowSelection="multiple" suppressRowClickSelection={true} />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 text-xs font-mono text-slate-500"><span>Status: <span className="text-emerald-400">Connected</span> <span className="text-slate-500">(Firestore read-only)</span></span><span>{new Date().toLocaleTimeString()}</span></div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DataConsolePage;