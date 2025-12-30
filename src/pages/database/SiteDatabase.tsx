import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch, faFilter, faDownload, faPenToSquare, faPlus, faTable, faTrash,
    faChevronDown, faChevronRight, faBuilding, faMapMarkerAlt, faTimes, faUsers, faHardHat
} from '@fortawesome/free-solid-svg-icons';
import { siteService, Site } from '../../services/siteService';
import { Team } from '../../services/teamService';
import { Company } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { dailyReportService } from '../../services/dailyReportService';
import { statisticsService } from '../../services/statisticsService';
import SiteForm from '../../components/manpower/SiteForm';
import { Timestamp } from 'firebase/firestore';
import { useColumnSettings } from '../../hooks/useColumnSettings';
import { useMasterData } from '../../contexts/MasterDataContext';
import SingleSelectPopover from '../../components/common/SingleSelectPopover';
import InputPopover from '../../components/common/InputPopover';

const SITE_COLUMNS = [
    { key: 'name', label: '현장명' },
    { key: 'address', label: '주소' },
    { key: 'responsibleTeamName', label: '담당팀' },
    { key: 'clientCompanyName', label: '발주사' }, // Client (New)
    { key: 'companyName', label: '시공사' }, // Constructor (Main)
    { key: 'partnerName', label: '협력사' }, // Partner (New)
    { key: 'status', label: '상태' }
];

interface SiteDatabaseProps {
    hideHeader?: boolean;
    highlightedId?: string | null;
}

interface SiteHistoryData {
    teams: { id: string; name: string; lastDate: string; totalManDay: number }[];
    workers: { id: string; name: string; role: string; lastDate: string; totalManDay: number }[];
}

const SiteDatabase: React.FC<SiteDatabaseProps> = ({ hideHeader = false, highlightedId }) => {
    // Context에서 마스터 데이터 가져오기 (Firebase 호출 없이 바로 사용!)
    const { companies, teams, sites, refreshSites } = useMasterData();

    const [siteStats, setSiteStats] = useState<{ [id: string]: number }>({});
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);

    // Selection & Edit State
    const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showSiteModal, setShowSiteModal] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);

    // Accordion State
    const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [siteHistory, setSiteHistory] = useState<SiteHistoryData | null>(null);

    // Highlight scroll control (for Integrity "관리" navigation)
    const highlightScrolledRef = useRef(false);
    const lastHighlightIdRef = useRef<string | null>(null);

    // Column Settings Hook
    const {
        visibleColumns,
        toggleColumn,
        showColumnSettings,
        setShowColumnSettings
    } = useColumnSettings('site_db_v4', SITE_COLUMNS);

    // 통계 데이터만 별도 로드
    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const statsData = await statisticsService.getCumulativeManpower();
            setSiteStats(statsData.siteStats);
        } catch (error) {
            console.error("Failed to load stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderCellValue = (site: Site, column: any) => {
        const value = site[column.key as keyof Site];

        if (column.key === 'totalGongsu') {
            // Try matching by ID first, then Name
            const gongsu = siteStats[site.id!] || siteStats[site.name] || 0;
            return (
                <span className="font-bold text-blue-600">
                    {gongsu.toFixed(1)}공수
                </span>
            );
        }

        if (column.key === 'status') {
            return (
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${site.status === 'completed' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-600'}`}>
                    {site.status === 'completed' ? '종료' : '진행중'}
                </span>
            );
        }

        if (value === undefined || value === null) return '';
        if (typeof value === 'object' && 'toDate' in value) {
            return (value as any).toDate().toLocaleDateString();
        }
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    const toggleSelectAll = () => {
        if (selectedSiteIds.length === sites.length) setSelectedSiteIds([]);
        else setSelectedSiteIds(sites.map(s => s.id!).filter(Boolean));
    };

    const toggleSelect = (id: string) => {
        setSelectedSiteIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedSiteIds.length === 0) return;
        if (!window.confirm(`${selectedSiteIds.length}개의 현장을 삭제 하시겠습니까?`)) return;

        try {
            setLoading(true);
            await Promise.all(selectedSiteIds.map(id => siteService.deleteSite(id)));
            await refreshSites(); // Context 새로고침
            setSelectedSiteIds([]);
            alert('삭제되었습니다.');
        } catch (error) {
            console.error("Bulk delete failed:", error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleSiteChange = async (id: string, field: keyof Site, value: any) => {
        // Context 데이터는 불변이므로 직접 수정하지 않고 DB만 업데이트
        try {
            await siteService.updateSite(id, { [field]: value });
        } catch (error) {
            console.error("Failed to update site", error);
        }
    };

    const handleSiteBlur = async (id: string, field: keyof Site, value: any) => {
        try {
            await siteService.updateSite(id, { [field]: value });
            if (field === 'name') {
                await manpowerService.updateWorkersSiteName(id, value);
            }
            await refreshSites(); // Context 새로고침
        } catch (error) {
            console.error("Failed to update site", error);
            await refreshSites();
        }
    };

    const handleSiteSelectChange = async (id: string, updates: Partial<Site>) => {
        try {
            await siteService.updateSite(id, updates);
            await refreshSites(); // Context 새로고침
        } catch (error) {
            console.error("Failed to update site select", error);
            await refreshSites();
        }
    };

    const handleSiteSave = async () => {
        await refreshSites(); // Context 새로고침
        setShowSiteModal(false);
        setEditingSite(null);
        alert('현장 정보가 저장되었습니다.');
    };



    const toggleExpand = async (siteId: string) => {
        if (expandedSiteId === siteId) {
            setExpandedSiteId(null);
            setSiteHistory(null);
            return;
        }

        setExpandedSiteId(siteId);
        setHistoryLoading(true);
        setSiteHistory(null);

        try {
            const reports = await dailyReportService.getReportsBySite(siteId);

            // Aggregate Data
            const teamMap = new Map<string, { name: string; lastDate: string; totalManDay: number }>();
            const workerMap = new Map<string, { name: string; role: string; lastDate: string; totalManDay: number }>();

            reports.forEach(report => {
                // Team Aggregation
                if (report.teamId) {
                    const existing = teamMap.get(report.teamId);
                    const currentTotal = existing ? existing.totalManDay : 0;
                    const newTotal = currentTotal + (report.totalManDay || 0);

                    if (!existing) {
                        teamMap.set(report.teamId, {
                            name: report.teamName,
                            lastDate: report.date,
                            totalManDay: newTotal
                        });
                    } else {
                        teamMap.set(report.teamId, {
                            ...existing,
                            totalManDay: newTotal
                        });
                    }
                }

                // Worker Aggregation
                report.workers.forEach(worker => {
                    const existing = workerMap.get(worker.workerId);
                    const currentTotal = existing ? existing.totalManDay : 0;
                    const newTotal = currentTotal + (worker.manDay || 0);

                    if (!existing) {
                        workerMap.set(worker.workerId, {
                            name: worker.name,
                            role: worker.role || '작업자',
                            lastDate: report.date,
                            totalManDay: newTotal
                        });
                    } else {
                        workerMap.set(worker.workerId, {
                            ...existing,
                            totalManDay: newTotal
                        });
                    }
                });
            });

            const teamsArr = Array.from(teamMap.entries())
                .map(([id, data]) => ({ id, ...data }))
                .filter(t => t.totalManDay > 0);

            const workersArr = Array.from(workerMap.entries())
                .map(([id, data]) => ({ id, ...data }))
                .filter(w => w.totalManDay > 0);

            setSiteHistory({
                teams: teamsArr,
                workers: workersArr
            });

        } catch (error) {
            console.error("Failed to fetch site history:", error);
            alert("히스토리 불러오기 실패");
        } finally {
            setHistoryLoading(false);
        }
    };

    // Filter Logic
    const filteredSites = sites.filter(site => {
        // Status Filter
        if (!showInactive && site.status === 'completed') return false;

        // Search Filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                site.name.toLowerCase().includes(searchLower) ||
                site.address?.toLowerCase().includes(searchLower) ||
                site.companyName?.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header & Toolbar */}
            <div className={`bg-white border-b border-slate-200 p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 flex-shrink-0 ${!hideHeader ? 'border-t-0' : ''}`}>
                {!hideHeader && (
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-emerald-600" />
                        <span>현장 등록 관리</span>
                    </h2>
                )}

                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:ml-auto justify-end">
                    <button
                        onClick={handleBulkDelete}
                        disabled={selectedSiteIds.length === 0}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${selectedSiteIds.length > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    >
                        <FontAwesomeIcon icon={faTrash} /> <span className="hidden sm:inline">삭제</span>
                    </button>

                    <button onClick={() => setIsEditMode(!isEditMode)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${isEditMode ? 'bg-indigo-50 text-indigo-600' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <FontAwesomeIcon icon={faPenToSquare} /> <span className="hidden sm:inline">{isEditMode ? '수정 종료' : '수정모드'}</span>
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowColumnSettings(!showColumnSettings)}
                            className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                        >
                            <FontAwesomeIcon icon={faTable} /> <span className="hidden sm:inline">열 설정</span>
                        </button>
                        {showColumnSettings && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-2 text-left">
                                <div className="text-xs font-bold text-slate-500 mb-2 px-2">표시할 열 선택</div>
                                <div className="space-y-1">
                                    {SITE_COLUMNS.map(col => (
                                        <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns.includes(col.key)}
                                                onChange={() => toggleColumn(col.key)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-slate-700">{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="fixed inset-0 -z-10" onClick={() => setShowColumnSettings(false)}></div>
                            </div>
                        )}
                    </div>

                    <button onClick={() => setShowSiteModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap">
                        <FontAwesomeIcon icon={faPlus} /> <span className="hidden sm:inline">현장 등록</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className={`flex-1 overflow-auto ${!hideHeader ? 'p-6 pb-[400px]' : 'pb-[400px]'}`}>
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-emerald-600" />
                            등록된 현장 ({filteredSites.length}개)
                        </h3>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showInactive}
                                    onChange={(e) => setShowInactive(e.target.checked)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                마감현장 포함
                            </label>
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="현장명, 주소, 회사 검색"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="border-none focus:ring-0 text-sm text-gray-600 w-48 placeholder-gray-400"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={filteredSites.length > 0 && selectedSiteIds.length === filteredSites.length}
                                            onChange={toggleSelectAll}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </th>
                                    <th className="px-2 py-3 w-8"></th>
                                    {SITE_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => (
                                        <th key={col.key} className="px-6 py-3 font-semibold text-left text-slate-700 whitespace-nowrap">
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredSites.length > 0 ? (
                                    filteredSites.map((site) => {
                                        const isHighlighted = site.id === highlightedId;

                                        const responsibleTeam = site.responsibleTeamId
                                            ? teams.find(t => t.id === site.responsibleTeamId)
                                            : undefined;
                                        const responsibleTeamColor = responsibleTeam?.color || '#6366f1';

                                        const siteCompany = site.companyId
                                            ? companies.find(c => c.id === site.companyId)
                                            : undefined;
                                        const siteCompanyColor = siteCompany?.color || '#e5e7eb';

                                        return (
                                            <React.Fragment key={site.id || site.name}>
                                                <tr
                                                    className={`transition-colors border-b ${isHighlighted
                                                        ? 'bg-red-50 border border-red-300 ring-1 ring-red-300 z-10 relative'
                                                        : expandedSiteId === site.id
                                                            ? 'bg-slate-50'
                                                            : 'bg-white hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <td className="px-6 py-4 align-top">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!site.id && selectedSiteIds.includes(site.id)}
                                                            onChange={() => site.id && toggleSelect(site.id)}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                    </td>
                                                    <td
                                                        className="px-2 py-4 text-center align-top cursor-pointer"
                                                        onClick={() => site.id && toggleExpand(site.id)}
                                                    >
                                                        {site.id && (
                                                            <FontAwesomeIcon
                                                                icon={expandedSiteId === site.id ? faChevronDown : faChevronRight}
                                                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                            />
                                                        )}
                                                    </td>
                                                    {SITE_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => (
                                                        <td key={`${site.id || site.name}-${col.key}`} className="px-6 py-4 align-top">
                                                            {isEditMode && site.id ? (
                                                                col.key === 'status' ? (
                                                                    <select
                                                                        value={site.status}
                                                                        onChange={(e) => handleSiteSelectChange(site.id!, { status: e.target.value as Site['status'] })}
                                                                        className="border rounded px-2 py-1 w-full text-sm"
                                                                    >
                                                                        <option value="planned">예정</option>
                                                                        <option value="active">진행중</option>
                                                                        <option value="completed">종료</option>
                                                                    </select>
                                                                ) : col.key === 'responsibleTeamName' ? (
                                                                    <SingleSelectPopover
                                                                        options={teams.map(t => ({
                                                                            id: t.id || '',
                                                                            name: t.name,
                                                                            icon: (
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-200 flex-shrink-0"
                                                                                    style={{ backgroundColor: t.color || '#6366f1' }}
                                                                                >
                                                                                    <FontAwesomeIcon icon={faUsers} className="text-white text-[8px]" />
                                                                                </span>
                                                                            )
                                                                        }))}
                                                                        selectedId={site.responsibleTeamId || null}
                                                                        onSelect={(id) => {
                                                                            const team = teams.find(t => t.id === id);
                                                                            handleSiteSelectChange(site.id!, {
                                                                                responsibleTeamId: id,
                                                                                responsibleTeamName: team?.name || ''
                                                                            });
                                                                        }}
                                                                        placeholder="담당팀 선택"
                                                                    />
                                                                ) : col.key === 'clientCompanyName' ? (
                                                                    <select
                                                                        value={site.clientCompanyId || ''}
                                                                        onChange={(e) => {
                                                                            const companyId = e.target.value;
                                                                            const company = companies.find(c => c.id === companyId);
                                                                            handleSiteSelectChange(site.id!, {
                                                                                clientCompanyId: companyId || '',
                                                                                clientCompanyName: company?.name || ''
                                                                            });
                                                                        }}
                                                                        className="border rounded px-2 py-1 w-full text-sm"
                                                                    >
                                                                        <option value="">발주사 선택</option>
                                                                        {companies
                                                                            .filter(c => c.type === '건설사')
                                                                            .map(company => (
                                                                                <option key={company.id} value={company.id}>{company.name}</option>
                                                                            ))}
                                                                    </select>
                                                                ) : col.key === 'companyName' ? (
                                                                    <select
                                                                        value={site.companyId || ''}
                                                                        onChange={(e) => {
                                                                            const companyId = e.target.value;
                                                                            const company = companies.find(c => c.id === companyId);
                                                                            handleSiteSelectChange(site.id!, {
                                                                                companyId: companyId || '',
                                                                                companyName: company?.name || ''
                                                                            });
                                                                        }}
                                                                        className="border rounded px-2 py-1 w-full text-sm"
                                                                    >
                                                                        <option value="">시공사 선택</option>
                                                                        {companies
                                                                            .filter(c => c.type === '시공사')
                                                                            .map(company => (
                                                                                <option key={company.id} value={company.id}>{company.name}</option>
                                                                            ))}
                                                                    </select>
                                                                ) : col.key === 'partnerName' ? (
                                                                    <select
                                                                        value={site.partnerId || ''}
                                                                        onChange={(e) => {
                                                                            const companyId = e.target.value;
                                                                            const company = companies.find(c => c.id === companyId);
                                                                            handleSiteSelectChange(site.id!, {
                                                                                partnerId: companyId || '',
                                                                                partnerName: company?.name || ''
                                                                            });
                                                                        }}
                                                                        className="border rounded px-2 py-1 w-full text-sm"
                                                                    >
                                                                        <option value="">협력사 선택</option>
                                                                        {companies
                                                                            .filter(c => c.type === '협력사')
                                                                            .map(company => (
                                                                                <option key={company.id} value={company.id}>{company.name}</option>
                                                                            ))}
                                                                    </select>
                                                                ) : col.key === 'name' ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="color"
                                                                            value={site.color || '#6366f1'}
                                                                            onChange={(e) => handleSiteSelectChange(site.id!, { color: e.target.value })}
                                                                            className="h-8 w-8 rounded border border-slate-300 cursor-pointer p-0"
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            value={site.name}
                                                                            onChange={(e) => handleSiteChange(site.id!, 'name', e.target.value)}
                                                                            onBlur={(e) => handleSiteBlur(site.id!, 'name', e.target.value)}
                                                                            className="border rounded px-2 py-1 w-full text-sm font-medium"
                                                                        />
                                                                    </div>
                                                                ) : col.key === 'totalGongsu' ? (
                                                                    <span className="font-bold text-blue-600">
                                                                        {(siteStats[site.id!] || siteStats[site.name] || 0).toFixed(1)}공수
                                                                    </span>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        value={String(site[col.key as keyof Site] || '')}
                                                                        onChange={(e) => handleSiteChange(site.id!, col.key as keyof Site, e.target.value)}
                                                                        onBlur={(e) => handleSiteBlur(site.id!, col.key as keyof Site, e.target.value)}
                                                                        className="border rounded px-2 py-1 w-full text-sm"
                                                                    />
                                                                )
                                                            ) : (
                                                                col.key === 'status' ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => handleSiteSelectChange(site.id!, { status: site.status === 'active' ? 'completed' : 'active' })}
                                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${site.status === 'active' ? 'bg-green-500' : 'bg-slate-300'
                                                                                }`}
                                                                        >
                                                                            <span
                                                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${site.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                                                                                    }`}
                                                                            />
                                                                        </button>
                                                                        <span className={`text-xs font-bold ${site.status === 'active' ? 'text-green-600' : 'text-slate-500'}`}>
                                                                            {site.status === 'active' ? '진행중' : '종료'}
                                                                        </span>
                                                                    </div>
                                                                ) : col.key === 'name' ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 flex-shrink-0"
                                                                            style={{ backgroundColor: site.color || siteCompanyColor || '#F3F4F6' }}
                                                                        >
                                                                            <FontAwesomeIcon icon={faHardHat} className={`text-xs ${site.color || siteCompanyColor ? 'text-white' : 'text-slate-400'}`} />
                                                                        </span>
                                                                        <span className="font-bold text-slate-800">{site.name}</span>
                                                                    </div>
                                                                ) : col.key === 'responsibleTeamName' ? (
                                                                    <SingleSelectPopover
                                                                        options={teams.map(t => ({
                                                                            id: t.id || '',
                                                                            name: t.name,
                                                                            icon: (
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-200 flex-shrink-0"
                                                                                    style={{ backgroundColor: t.color || '#6366f1' }}
                                                                                >
                                                                                    <FontAwesomeIcon icon={faUsers} className="text-white text-[8px]" />
                                                                                </span>
                                                                            )
                                                                        }))}
                                                                        selectedId={site.responsibleTeamId || null}
                                                                        onSelect={(id) => {
                                                                            const team = teams.find(t => t.id === id);
                                                                            handleSiteSelectChange(site.id!, {
                                                                                responsibleTeamId: id,
                                                                                responsibleTeamName: team?.name || ''
                                                                            });
                                                                        }}
                                                                        placeholder="-"
                                                                        minimal={true}
                                                                        renderSelected={(opt) => {
                                                                            const team = teams.find(t => t.id === opt.id);
                                                                            const color = team?.color || '#6366f1';
                                                                            return (
                                                                                <div className="flex items-center gap-2">
                                                                                    <span
                                                                                        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 flex-shrink-0"
                                                                                        style={{ backgroundColor: color }}
                                                                                    >
                                                                                        <FontAwesomeIcon icon={faUsers} className="text-white text-xs" />
                                                                                    </span>
                                                                                    <span className="font-semibold text-slate-800">
                                                                                        {opt.name}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        }}
                                                                    />
                                                                ) : col.key === 'clientCompanyName' ? (
                                                                    <div className="flex items-center gap-2">
                                                                        {(() => {
                                                                            const clientCompany = companies.find(c => c.id === site.clientCompanyId);
                                                                            // 발주사인데 타입이 '건설사'가 아니면 경고
                                                                            const isInvalid = clientCompany && clientCompany.type !== '건설사';
                                                                            return (
                                                                                <div className="flex flex-col">
                                                                                    <span className={`font-semibold text-slate-800 ${isInvalid ? 'text-red-500 decoration-red-500' : ''}`}>
                                                                                        {site.clientCompanyName || '-'}
                                                                                    </span>
                                                                                    {isInvalid && <span className="text-[10px] text-red-500">(타입 오류: {clientCompany.type})</span>}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                ) : col.key === 'companyName' ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 flex-shrink-0"
                                                                            style={{ backgroundColor: siteCompanyColor ?? '#F3F4F6' }}
                                                                        >
                                                                            <FontAwesomeIcon icon={faBuilding} className="text-white text-xs" />
                                                                        </span>
                                                                        {(() => {
                                                                            const compNames = site.companyName || siteCompany?.name || '-';
                                                                            // 시공사인데 타입이 '시공사'가 아니면 경고 (단, 미지정은 허용할 수도 있으나 Strict 모드에서는 경고)
                                                                            const isInvalid = siteCompany && siteCompany.type !== '시공사';

                                                                            return (
                                                                                <div className="flex flex-col">
                                                                                    <span className={`font-semibold text-slate-800 ${isInvalid ? 'text-red-500 decoration-red-500' : ''}`}>
                                                                                        {compNames}
                                                                                    </span>
                                                                                    {isInvalid && <span className="text-[10px] text-red-500">(타입 오류: {siteCompany.type})</span>}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                ) : col.key === 'partnerName' ? (
                                                                    <div className="flex items-center gap-2">
                                                                        {(() => {
                                                                            const partnerCompany = companies.find(c => c.id === site.partnerId);
                                                                            const isInvalid = partnerCompany && partnerCompany.type !== '협력사';
                                                                            return (
                                                                                <div className="flex flex-col">
                                                                                    <span className={`font-semibold text-slate-800 ${isInvalid ? 'text-red-500 decoration-red-500' : ''}`}>
                                                                                        {site.partnerName || '-'}
                                                                                    </span>
                                                                                    {isInvalid && <span className="text-[10px] text-red-500">(타입 오류: {partnerCompany ? partnerCompany.type : '미지정'})</span>}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                ) : col.key === 'address' ? (
                                                                    <InputPopover
                                                                        value={site.address || ''}
                                                                        onChange={(val) => handleSiteBlur(site.id!, 'address', val)}
                                                                        placeholder="주소 입력"
                                                                        minimal={true}
                                                                    />
                                                                ) : (
                                                                    renderCellValue(site, col)
                                                                )
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                                {/* Accordion Row */}
                                                {expandedSiteId === site.id && (
                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                        <td colSpan={visibleColumns.length + 2} className="p-4 px-8">
                                                            {historyLoading ? (
                                                                <div className="text-center py-4 text-slate-500">
                                                                    <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-indigo-600 rounded-full" role="status" aria-label="loading"></div>
                                                                    <span className="ml-2">데이터 불러오는 중...</span>
                                                                </div>
                                                            ) : siteHistory ? (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                    {/* Entered Teams */}
                                                                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                                                                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                                                            <FontAwesomeIcon icon={faUsers} className="text-indigo-500" />
                                                                            <span>들어왔던 팀목록 ({siteHistory.teams.length})</span>
                                                                        </h4>
                                                                        <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                                                            <table className="w-full text-xs text-left">
                                                                                <thead className="bg-slate-100 text-slate-600 sticky top-0">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 rounded-tl-md">팀명</th>
                                                                                        <th className="px-3 py-2">최근 진입</th>
                                                                                        <th className="px-3 py-2 rounded-tr-md text-right">총 공수</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {siteHistory.teams.length > 0 ? (
                                                                                        siteHistory.teams.map(team => (
                                                                                            <tr key={team.id} className="hover:bg-slate-50">
                                                                                                <td className="px-3 py-2 font-medium text-slate-800">{team.name}</td>
                                                                                                <td className="px-3 py-2 text-slate-500">{team.lastDate}</td>
                                                                                                <td className="px-3 py-2 text-right font-medium text-indigo-600">{team.totalManDay.toFixed(1)}</td>
                                                                                            </tr>
                                                                                        ))
                                                                                    ) : (
                                                                                        <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">데이터 없음</td></tr>
                                                                                    )}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>

                                                                    {/* Entered Workers */}
                                                                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                                                                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                                                            <FontAwesomeIcon icon={faUsers} className="text-emerald-500" />
                                                                            <span>들어왔던 인원들 ({siteHistory.workers.length})</span>
                                                                        </h4>
                                                                        <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                                                            <table className="w-full text-xs text-left">
                                                                                <thead className="bg-slate-100 text-slate-600 sticky top-0">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 rounded-tl-md">이름</th>
                                                                                        <th className="px-3 py-2">직종</th>
                                                                                        <th className="px-3 py-2">최근 진입</th>
                                                                                        <th className="px-3 py-2 rounded-tr-md text-right">총 공수</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {siteHistory.workers.length > 0 ? (
                                                                                        siteHistory.workers.map(worker => (
                                                                                            <tr key={worker.id} className="hover:bg-slate-50">
                                                                                                <td className="px-3 py-2 font-medium text-slate-800">{worker.name}</td>
                                                                                                <td className="px-3 py-2 text-slate-500">{worker.role}</td>
                                                                                                <td className="px-3 py-2 text-slate-500">{worker.lastDate}</td>
                                                                                                <td className="px-3 py-2 text-right font-medium text-emerald-600">{worker.totalManDay.toFixed(1)}</td>
                                                                                            </tr>
                                                                                        ))
                                                                                    ) : (
                                                                                        <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">데이터 없음</td></tr>
                                                                                    )}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center text-slate-400 py-4">데이터를 불러올 수 없습니다.</div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={visibleColumns.length + 2} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <FontAwesomeIcon icon={faBuilding} className="text-4xl text-slate-300 mb-2" />
                                                <p>{searchTerm ? '검색 결과가 없습니다.' : '등록된 현장이 없습니다.'}</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showSiteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">현장 등록</h2>
                            <button onClick={() => setShowSiteModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <FontAwesomeIcon icon={faTimes} className="text-lg" />
                            </button>
                        </div>
                        <SiteForm
                            initialData={editingSite || undefined}
                            teams={teams}
                            companies={companies}
                            onSave={handleSiteSave}
                            onCancel={() => setShowSiteModal(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SiteDatabase;
