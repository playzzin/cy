import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch, faPenToSquare, faPlus, faTable, faTrash,
    faChevronDown, faChevronRight, faBuilding, faTimes, faUserGroup
} from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { statisticsService } from '../../services/statisticsService';
import CompanyForm from '../../components/company/CompanyForm';
import { Timestamp } from 'firebase/firestore';
import { useColumnSettings } from '../../hooks/useColumnSettings';
import { useMasterData } from '../../contexts/MasterDataContext';
import InputPopover from '../../components/common/InputPopover';
import MultiSelectPopover from '../../components/common/MultiSelectPopover';

const COMPANY_COLUMNS = [
    { key: 'name', label: '회사명' },
    { key: 'ceoName', label: '대표자' },
    { key: 'totalGongsu', label: '누적공수' }, // Added
    { key: 'code', label: '사업자번호' },
    { key: 'idNumber', label: '주민번호' }, // 노무신고용
    { key: 'type', label: '구분' }, // Construction, Builder
    { key: 'siteCount', label: '배정 현장' },
    { key: 'status', label: '상태' }
];

interface CompanyDatabaseProps {
    hideHeader?: boolean;
    highlightedId?: string | null;
    includeTypes?: Company['type'][];
    excludeTypes?: Company['type'][];
    entityLabel?: string;
    defaultType?: Company['type'];
    showAddButton?: boolean;
}

const CompanyDatabase: React.FC<CompanyDatabaseProps> = ({
    hideHeader = false,
    highlightedId,
    includeTypes,
    excludeTypes,
    entityLabel = '회사',
    defaultType,
    showAddButton = true
}) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [companyStats, setCompanyStats] = useState<{ [id: string]: number }>({});
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Selection & Edit State
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
    const [expandedCompanyIds, setExpandedCompanyIds] = useState<string[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    // Highlight scroll control (for Integrity "관리" navigation)
    const highlightScrolledRef = useRef(false);
    const lastHighlightIdRef = useRef<string | null>(null);


    // Context Hook
    const { refreshCompanies } = useMasterData();

    // Column Settings Hook
    const {
        visibleColumns,
        toggleColumn,
        showColumnSettings,
        setShowColumnSettings
    } = useColumnSettings('company_db', COMPANY_COLUMNS);

    useEffect(() => {
        loadData();
    }, []);

    const applyTypeScope = (list: Company[]) => {
        return list.filter(company => {
            if (includeTypes && includeTypes.length > 0 && !includeTypes.includes(company.type)) return false;
            if (excludeTypes && excludeTypes.includes(company.type)) return false;
            return true;
        });
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [companiesData, sitesData, teamsData, workersData, statsData] = await Promise.all([
                companyService.getCompanies(),
                siteService.getSites(),
                teamService.getTeams(),
                manpowerService.getWorkers(),
                statisticsService.getCumulativeManpower() // Fetch stats
            ]);
            setCompanies(applyTypeScope(companiesData));
            setSites(sitesData);
            setTeams(teamsData);
            setWorkers(workersData);
            setCompanyStats(statsData.companyStats); // Set stats
        } catch (error) {
            console.error("Failed to load company data:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderCellValue = (company: Company, key: string) => {
        if (key === 'totalGongsu') {
            const gongsu = companyStats[company.id!] || 0;
            return (
                <span className="font-bold text-blue-600">
                    {gongsu.toFixed(1)}공수
                </span>
            );
        }

        if (key === 'idNumber') {
            // 작업자 테이블에서 대표자/팀장의 주민번호 찾기
            const ceo = workers.find(w =>
                w.companyId === company.id &&
                (w.role === '대표' || w.role === '팀장')
            );
            return ceo?.idNumber || '';
        }

        if (key === 'status') {
            // ... existing status logic if any
            return (
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${company.status === 'inactive' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-600'}`}>
                    {company.status === 'inactive' ? '폐업' : '정상'}
                </span>
            );
        }

        if (key === 'siteCount') {
            // Find sites belonging to this company (simple filter on loaded sites if schema supports, or just rely on manual count?)
            // Usually Company->Sites is not direct 1:N in this DB structure unless 'companyId' in Site.
            // Let's assume Filter is enough.
            const count = sites.filter(s => s.companyId === company.id).length;
            return (
                <span className={`font-bold ${count > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {count}개 현장
                </span>
            );
        }

        const value = company[key as keyof Company];
        if (value === undefined || value === null) return '';
        if (typeof value === 'object' && 'toDate' in value) {
            return (value as any).toDate().toLocaleDateString();
        }
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    const toggleSelectAll = () => {
        if (selectedCompanyIds.length === companies.length) setSelectedCompanyIds([]);
        else setSelectedCompanyIds(companies.map(c => c.id!).filter(Boolean));
    };

    const toggleSelect = (id: string) => {
        setSelectedCompanyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleCompanyExpand = (id: string) => {
        setExpandedCompanyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedCompanyIds.length === 0) return;
        if (!window.confirm(`${selectedCompanyIds.length}개의 회사를 삭제 하시겠습니까?`)) return;

        try {
            setLoading(true);
            await Promise.all(selectedCompanyIds.map(id => companyService.deleteCompany(id)));
            await loadData();
            await refreshCompanies(); // Sync Context
            setSelectedCompanyIds([]);
            alert('삭제되었습니다.');
        } catch (error) {
            console.error("Bulk delete failed:", error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleCompanyChange = (id: string, field: keyof Company, value: any) => {
        setCompanies(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleCompanyBlur = async (id: string, field: keyof Company, value: any) => {
        // Optimistic Update
        setCompanies(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

        try {
            await companyService.updateCompany(id, { [field]: value });
            await refreshCompanies(); // Sync Context for other components


            if (field === 'type') {
                // For type change, we might need to remove it from view if scope changes, so reload is safer but maybe silent?
                await loadData();
            }
        } catch (error) {
            console.error("Failed to update company", error);
            // Revert or Reload
            loadData();
        }
    };

    const handleCompanySave = async (companyData: Omit<Company, 'id'> | Partial<Company>) => {
        try {
            if (editingCompany && editingCompany.id) {
                await companyService.updateCompany(editingCompany.id, companyData);

            } else {
                await companyService.addCompany(companyData as Company);
            }
            await loadData();
            await refreshCompanies(); // Sync Context
            setShowCompanyModal(false);
            setEditingCompany(null);
            alert('회사 정보가 저장되었습니다.');
        } catch (error) {
            console.error("Failed to save company", error);
            alert("회사 정보 저장에 실패했습니다.");
        }
    };



    // Filter Logic
    const filteredCompanies = companies.filter(company => {
        // Search Filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                company.name.toLowerCase().includes(searchLower) ||
                company.code?.toLowerCase().includes(searchLower) ||
                company.businessNumber?.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    const getTypePriority = (type: Company['type']) => {
        switch (type) {
            case '시공사':
                return 1;
            case '건설사':
                return 2;
            case '협력사':
                return 3;
            case '기타':
                return 4;
            case '미지정':
            default:
                return 5;
        }
    };

    const sortedCompanies = [...filteredCompanies].sort((a, b) => {
        const pa = getTypePriority(a.type);
        const pb = getTypePriority(b.type);
        if (pa !== pb) return pa - pb;
        const nameA = (a.name || '').toString();
        const nameB = (b.name || '').toString();
        return nameA.localeCompare(nameB, 'ko');
    });

    return (
        <div className="flex flex-col h-full bg-slate-50 pb-[400px]">
            {/* Header & Toolbar - Single Row */}
            <div className={`bg-white border-b border-slate-200 p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 flex-shrink-0 ${!hideHeader ? 'border-t-0' : ''}`}>
                {!hideHeader && (
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
                        <FontAwesomeIcon icon={faBuilding} className="text-indigo-600" />
                        <span>{entityLabel} 등록 관리</span>
                    </h2>
                )}

                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:ml-auto justify-end">
                    <button
                        onClick={handleBulkDelete}
                        disabled={selectedCompanyIds.length === 0}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${selectedCompanyIds.length > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
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
                                    {COMPANY_COLUMNS.map(col => (
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

                    <button
                        onClick={() => {
                            setEditingCompany(null);
                            setShowCompanyModal(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
                    >
                        <FontAwesomeIcon icon={faPlus} /> <span className="hidden sm:inline">{entityLabel} 등록</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className={`flex-1 overflow-auto ${!hideHeader ? 'p-6 pb-80' : 'pb-80'}`}>
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faBuilding} className="text-indigo-600" />
                            등록된 {entityLabel} ({filteredCompanies.length}개)
                        </h3>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={`${entityLabel}명, 사업자번호 검색`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="border-none focus:ring-0 text-sm text-gray-600 w-48 placeholder-gray-400"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto min-h-[500px]">
                        <table className="w-full text-sm text-left text-slate-500">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 w-4">
                                        <input
                                            type="checkbox"
                                            checked={companies.length > 0 && selectedCompanyIds.length === companies.length}
                                            onChange={toggleSelectAll}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </th>
                                    <th className="px-2 py-3 w-8"></th>
                                    {COMPANY_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => (
                                        <th key={col.key} className="px-6 py-3 font-semibold">{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedCompanies.length > 0 ? (
                                    sortedCompanies.map((company) => {
                                        const isHighlighted = company.id === highlightedId;

                                        return (
                                            <React.Fragment key={company.id}>
                                                <tr
                                                    onClick={(e) => {
                                                        // Prevent toggle if clicking on interactive elements (inputs are handled by stopPropagation on td usually)
                                                        toggleSelect(company.id!);
                                                    }}
                                                    className={`transition-colors border-b cursor-pointer
                                                    ${isHighlighted ? 'bg-red-50 border border-red-300 ring-1 ring-red-300 z-10 relative' :
                                                            expandedCompanyIds.includes(company.id!) ? 'bg-slate-50' :
                                                                selectedCompanyIds.includes(company.id!) ? 'bg-indigo-50/50' :
                                                                    'bg-white hover:bg-slate-50'}
                                                `}
                                                    ref={isHighlighted
                                                        ? (el) => {
                                                            if (!el) return;
                                                            const currentId = highlightedId || null;
                                                            if (lastHighlightIdRef.current !== currentId) {
                                                                lastHighlightIdRef.current = currentId;
                                                                highlightScrolledRef.current = false;
                                                            }
                                                            if (!highlightScrolledRef.current) {
                                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                highlightScrolledRef.current = true;
                                                            }
                                                        }
                                                        : null}
                                                >
                                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCompanyIds.includes(company.id!)}
                                                            onChange={() => toggleSelect(company.id!)}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-4 text-center cursor-pointer" onClick={() => toggleCompanyExpand(company.id!)}>
                                                        <FontAwesomeIcon
                                                            icon={expandedCompanyIds.includes(company.id!) ? faChevronDown : faChevronRight}
                                                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                        />
                                                    </td>
                                                    {COMPANY_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => (
                                                        <td key={`${company.id}-${col.key}`} className="px-6 py-4">
                                                            {isEditMode && company.id ? (
                                                                col.key === 'totalGongsu' ? (
                                                                    <span className="font-bold text-blue-600">
                                                                        {(companyStats[company.id!] || 0).toFixed(1)}공수
                                                                    </span>
                                                                ) : col.key === 'type' ? (
                                                                    <select
                                                                        value={company.type}
                                                                        onChange={(e) => company.id && handleCompanyChange(company.id, 'type', e.target.value)}
                                                                        onBlur={(e) => company.id && handleCompanyBlur(company.id, 'type', e.target.value)}
                                                                        className="border rounded px-2 py-1 w-full text-sm"
                                                                    >
                                                                        <option value="미지정">미지정</option>
                                                                        <option value="시공사">시공사</option>
                                                                        <option value="협력사">협력사</option>
                                                                        <option value="건설사">건설사</option>
                                                                        <option value="기타">기타</option>
                                                                    </select>
                                                                ) : col.key === 'totalGongsu' ? (
                                                                    <span className="font-bold text-blue-600">
                                                                        {(companyStats[company.id!] || 0).toFixed(1)}공수
                                                                    </span>
                                                                ) : col.key === 'name' ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="color"
                                                                            value={company.color || '#4f46e5'}
                                                                            onChange={(e) => company.id && handleCompanyChange(company.id, 'color', e.target.value)}
                                                                            onBlur={(e) => company.id && handleCompanyBlur(company.id, 'color', e.target.value)}
                                                                            className="h-8 w-8 rounded border border-slate-300 cursor-pointer"
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            value={company.name || ''}
                                                                            onChange={(e) => company.id && handleCompanyChange(company.id, 'name', e.target.value)}
                                                                            onBlur={(e) => company.id && handleCompanyBlur(company.id, 'name', e.target.value)}
                                                                            className="flex-1 border rounded px-2 py-1 w-full text-sm"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        value={String(company[col.key as keyof Company] || '')}
                                                                        onChange={(e) => company.id && handleCompanyChange(company.id, col.key as keyof Company, e.target.value)}
                                                                        onBlur={(e) => company.id && handleCompanyBlur(company.id, col.key as keyof Company, e.target.value)}
                                                                        className="border rounded px-2 py-1 w-full text-sm"
                                                                    />
                                                                )
                                                            ) : (
                                                                col.key === 'name' ? (
                                                                    <div
                                                                        className="flex items-center gap-2 cursor-pointer hover:text-indigo-600"
                                                                        onClick={() => {
                                                                            setEditingCompany(company);
                                                                            setShowCompanyModal(true);
                                                                        }}
                                                                    >
                                                                        <span
                                                                            className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 flex-shrink-0"
                                                                            style={{ backgroundColor: company.color || '#e5e7eb' }}
                                                                        >
                                                                            <FontAwesomeIcon icon={faBuilding} className="text-white text-xs" />
                                                                        </span>
                                                                        <span className="font-semibold text-slate-800">{company.name}</span>
                                                                    </div>
                                                                ) : col.key === 'code' ? (
                                                                    <InputPopover
                                                                        value={company.code || ''}
                                                                        onChange={(val) => handleCompanyBlur(company.id!, 'code', val)}
                                                                        placeholder="사업자번호"
                                                                        minimal={true}
                                                                    />
                                                                ) : col.key === 'siteCount' ? (
                                                                    <MultiSelectPopover
                                                                        options={sites.map(s => ({ id: s.id!, name: s.name }))}
                                                                        selectedIds={company.siteIds || []}
                                                                        onSelect={(id) => {
                                                                            const currentIds = company.siteIds || [];
                                                                            const newIds = currentIds.includes(id) ? currentIds.filter(i => i !== id) : [...currentIds, id];
                                                                            handleCompanyBlur(company.id!, 'siteIds', newIds);
                                                                        }}
                                                                        onSelectAll={() => {
                                                                            const allIds = sites.map(s => s.id!);
                                                                            const currentIds = company.siteIds || [];
                                                                            const newIds = currentIds.length === allIds.length ? [] : allIds;
                                                                            handleCompanyBlur(company.id!, 'siteIds', newIds);
                                                                        }}
                                                                        placeholder="현장 배정"
                                                                        minimal={true}
                                                                    />
                                                                ) : col.key === 'status' ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => handleCompanyBlur(company.id!, 'status', company.status === 'active' ? 'inactive' : 'active')}
                                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${company.status === 'active' ? 'bg-green-500' : 'bg-slate-300'
                                                                                }`}
                                                                        >
                                                                            <span
                                                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${company.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                                                                                    }`}
                                                                            />
                                                                        </button>
                                                                        <span className={`text-xs font-bold ${company.status === 'active' ? 'text-green-600' : 'text-slate-500'}`}>
                                                                            {company.status === 'active' ? '정상' : '폐업'}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    renderCellValue(company, col.key)
                                                                )
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                                {
                                                    expandedCompanyIds.includes(company.id!) && (
                                                        <tr className="bg-slate-50/50">
                                                            <td colSpan={visibleColumns.length + 2} className="px-6 py-4">
                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                    {/* Sites */}
                                                                    <div>
                                                                        <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                                            <FontAwesomeIcon icon={faBuilding} className="text-indigo-500" />
                                                                            <span>회사 기준 현장 현황</span>
                                                                        </div>
                                                                        {sites.filter(s => s.companyId === company.id).length > 0 ? (
                                                                            <ul className="text-xs text-slate-600 space-y-1 max-h-40 overflow-y-auto pr-1">
                                                                                {sites
                                                                                    .filter(s => s.companyId === company.id)
                                                                                    .map(site => (
                                                                                        <li key={site.id} className="flex items-center justify-between">
                                                                                            <span>{site.name}</span>
                                                                                            <span className="text-slate-400 text-[10px]">{site.status === 'completed' ? '종료' : '진행중'}</span>
                                                                                        </li>
                                                                                    ))}
                                                                            </ul>
                                                                        ) : (
                                                                            <div className="text-xs text-slate-400">등록된 현장이 없습니다.</div>
                                                                        )}
                                                                    </div>

                                                                    {/* Teams */}
                                                                    <div>
                                                                        <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                                            <FontAwesomeIcon icon={faUserGroup} className="text-orange-500" />
                                                                            배정 팀 목록
                                                                            <span className="text-xs text-slate-400 font-normal">
                                                                                ({teams.filter(t => t.companyId === company.id).length}팀)
                                                                            </span>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            {teams.filter(t => t.companyId === company.id).length > 0 ? (
                                                                                teams.filter(t => t.companyId === company.id).map(team => (
                                                                                    <div key={team.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                                                                                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                                                                            <FontAwesomeIcon icon={faUserGroup} />
                                                                                        </div>
                                                                                        <div>
                                                                                            <div className="text-sm font-semibold text-slate-800">{team.name}</div>
                                                                                            <div className="text-xs text-slate-500">
                                                                                                팀장: {team.leaderName || '미지정'}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))
                                                                            ) : (
                                                                                <div className="text-slate-400 text-sm italic p-2">배정된 팀이 없습니다.</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                }
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={visibleColumns.length + 2} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <FontAwesomeIcon icon={faBuilding} className="text-4xl text-slate-300 mb-2" />
                                                <p>{searchTerm ? '검색 결과가 없습니다.' : '등록된 회사가 없습니다.'}</p>
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
            {
                showCompanyModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">{entityLabel} 등록</h2>
                                <button onClick={() => setShowCompanyModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <FontAwesomeIcon icon={faTimes} className="text-lg" />
                                </button>
                            </div>
                            <CompanyForm
                                initialData={editingCompany || undefined}
                                onSave={handleCompanySave}
                                onCancel={() => setShowCompanyModal(false)}
                                allCompanies={companies}
                                defaultType={defaultType}
                            />
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default CompanyDatabase;
