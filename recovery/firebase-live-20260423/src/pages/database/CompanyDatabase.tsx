import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch, faPenToSquare, faPlus, faTable, faTrash,
    faChevronDown, faChevronRight, faBuilding, faUserGroup,
    faList, faHandshake, faIndustry, faTimes
} from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { statisticsService } from '../../services/statisticsService';
import { useColumnSettings } from '../../hooks/useColumnSettings';
import { useMasterData } from '../../contexts/MasterDataContext';
import CompanyForm from '../../components/company/CompanyForm';
import SingleSelectPopover, { InputPopover } from '../../components/common/SingleSelectPopover';

const COMPANY_COLUMNS = [
    { key: 'name', label: '회사명' },
    { key: 'ceoName', label: '대표자' },
    { key: 'phone', label: '연락처' },
    { key: 'businessNumber', label: '사업자등록번호' },
    { key: 'bankName', label: '은행' },
    { key: 'accountNumber', label: '계좌번호' },
    { key: 'accountHolder', label: '예금주' },
    { key: 'siteCount', label: '현장배정' },
    { key: 'status', label: '상태' },
    { key: 'manage', label: '관리' }
];

interface CompanyDatabaseProps {
    hideHeader?: boolean;
    highlightedId?: string | null;
    includeTypes?: Company['type'][];
    excludeTypes?: Company['type'][];
    entityLabel?: string;
    showAddButton?: boolean;
    viewMode?: 'list' | 'form';
    defaultType?: string; // New: default type for "Add" action
}

type TabType = 'all' | 'company' | 'partner' | 'client';

const CompanyDatabase: React.FC<CompanyDatabaseProps> = ({
    hideHeader = false,
    highlightedId,
    includeTypes,
    excludeTypes,
    entityLabel = '회사',
    showAddButton = true,
    defaultType
}) => {
    // Data State
    const [companies, setCompanies] = useState<Company[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [companyStats, setCompanyStats] = useState<{ [id: string]: number }>({});
    const [loading, setLoading] = useState(false);

    // View State
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isStickyHeader, setIsStickyHeader] = useState(false); // Sticky header toggle

    // Selection & Edit State
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
    const [expandedCompanyIds, setExpandedCompanyIds] = useState<string[]>([]);

    // Highlight scroll control
    const highlightScrolledRef = useRef(false);

    // Context Hook
    const { refreshCompanies } = useMasterData();

    // Column Settings Hook
    const {
        visibleColumns,
        toggleColumn,
        showColumnSettings,
        setShowColumnSettings
    } = useColumnSettings('company_db', COMPANY_COLUMNS);

    // Initial Load
    useEffect(() => {
        loadData();
    }, []);

    // Load Data
    const loadData = async () => {
        setLoading(true);
        try {
            const [companiesData, sitesData, teamsData, workersData, statsData] = await Promise.all([
                companyService.getCompanies(),
                siteService.getSites(),
                teamService.getTeams(),
                manpowerService.getWorkers(),
                statisticsService.getCumulativeManpower()
            ]);

            // Apply external type constraints
            let filtered = companiesData;
            if (includeTypes && includeTypes.length > 0) {
                filtered = filtered.filter(c => includeTypes.includes(c.type));
            }
            if (excludeTypes && excludeTypes.length > 0) {
                filtered = filtered.filter(c => !excludeTypes.includes(c.type));
            }

            setCompanies(filtered);
            setSites(sitesData);
            setTeams(teamsData);
            setWorkers(workersData);
            setCompanyStats(statsData.companyStats);
        } catch (error) {
            console.error("Failed to load company data:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Modal State ---
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    // --- Modal Logic ---
    const openCompanyModal = (companyId?: string) => {
        if (companyId) {
            const company = companies.find(c => c.id === companyId);
            setEditingCompany(company || null);
        } else {
            setEditingCompany(null);
        }
        setShowCompanyModal(true);
    };

    const handleCompanySave = async () => {
        await refreshCompanies(); // Context 새로고침
        setShowCompanyModal(false);
        setEditingCompany(null);
        // alert is handled in CompanyForm usually, or we can add it here if form doesn't
        // CompanyForm's onSave prop typically expects us to handle the refresh
    };

    const handleBulkDelete = async () => {
        if (selectedCompanyIds.length === 0) return;
        if (!window.confirm(`${selectedCompanyIds.length}개의 회사를 삭제 하시겠습니까?`)) return;

        try {
            setLoading(true);
            await Promise.all(selectedCompanyIds.map(id => companyService.deleteCompany(id)));
            await loadData();
            await refreshCompanies();
            setSelectedCompanyIds([]);
            alert('삭제되었습니다.');
        } catch (error) {
            console.error("Bulk delete failed:", error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredCompanies = companies.filter(company => {
        if (activeTab === 'company' && !['시공사', '미지정'].includes(company.type || '')) return false;
        if (activeTab === 'partner' && company.type !== '협력사') return false;
        if (activeTab === 'client' && company.type !== '건설사') return false;

        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                company.name.toLowerCase().includes(searchLower) ||
                company.businessNumber?.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    const getTypePriority = (type: Company['type']) => {
        switch (type) {
            case '시공사': return 1;
            case '건설사': return 2;
            case '협력사': return 3;
            default: return 9;
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

    // Helper Functions
    const toggleSelectAll = () => {
        if (selectedCompanyIds.length === filteredCompanies.length) setSelectedCompanyIds([]);
        else setSelectedCompanyIds(filteredCompanies.map(c => c.id!).filter(Boolean));
    };

    const toggleSelect = (id: string) => {
        setSelectedCompanyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleCompanyExpand = (id: string) => {
        setExpandedCompanyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleCompanyInlineUpdate = async (id: string, updates: Partial<Company>) => {
        setCompanies(prev => prev.map(company => company.id === id ? { ...company, ...updates } : company));
        try {
            await companyService.updateCompany(id, updates);
        } catch (error) {
            console.error('Failed to update company inline:', error);
            await loadData();
        }
    };

    const renderCellValue = (company: Company, key: string) => {
        if (key === 'totalGongsu') {
            const gongsu = companyStats[company.id!] || 0;
            return <span className="font-bold text-blue-600">{gongsu.toFixed(1)}공수</span>;
        }
        if (key === 'ceoResidentNumber') {
            return company.ceoResidentNumber ? company.ceoResidentNumber.substring(0, 8) + '******' : '-';
        }
        if (key === 'siteCount') {
            const count = sites.filter(s => s.companyId === company.id).length;
            return <span className={`font-bold ${count > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>{count}개 현장</span>;
        }
        if (key === 'bankName' || key === 'accountNumber' || key === 'accountHolder') {
            const value = company[key as keyof Company];
            return value ? String(value) : '-';
        }
        if (key === 'manage') {
            return (
                <button
                    onClick={(e) => { e.stopPropagation(); openCompanyModal(company.id); }}
                    className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                    title="수정"
                >
                    <FontAwesomeIcon icon={faPenToSquare} />
                </button>
            );
        }
        const value = company[key as keyof Company];
        if (value === undefined || value === null) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    const TabButton = ({ id, label, icon }: { id: TabType, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
        >
            <FontAwesomeIcon icon={icon} />
            {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-slate-50 pb-[100px]">
            {/* Header / Tabs */}
            {!hideHeader && (
                <div className="bg-white border-b border-slate-200 px-4 pt-2 flex-shrink-0">
                    <div className="flex justify-between items-end">
                        <div className="flex space-x-2">
                            <TabButton id="all" label="전체" icon={faList} />
                            <TabButton id="company" label="시공사" icon={faBuilding} />
                            <TabButton id="partner" label="협력사" icon={faHandshake} />
                            <TabButton id="client" label="건설사(원청)" icon={faIndustry} />
                        </div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="bg-white border-b border-slate-200 p-4 flex flex-col xl:flex-row items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faBuilding} className="text-indigo-600" />
                        <span>
                            {activeTab === 'all' && '전체 회사 목록'}
                            {activeTab === 'company' && '시공사 관리'}
                            {activeTab === 'partner' && '협력사 관리'}
                            {activeTab === 'client' && '건설사(원청) 관리'}
                        </span>
                        <span className="text-sm font-normal text-slate-500 ml-2">({filteredCompanies.length})</span>
                    </h2>
                </div>

                <div className="flex items-center gap-2 w-full xl:w-auto justify-end">
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="검색어 입력..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-48 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
                        <input
                            type="checkbox"
                            checked={isStickyHeader}
                            onChange={(e) => setIsStickyHeader(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-600">목록 고정</span>
                    </label>

                    <button
                        onClick={handleBulkDelete}
                        disabled={selectedCompanyIds.length === 0}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${selectedCompanyIds.length > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <FontAwesomeIcon icon={faTrash} /> <span className="hidden sm:inline">삭제</span>
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowColumnSettings(!showColumnSettings)}
                            className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm font-medium"
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

                    {showAddButton && (
                        <button
                            onClick={() => openCompanyModal()}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <FontAwesomeIcon icon={faPlus} /> <span>회사 등록</span>
                        </button>
                    )}
                </div>
            </div>

            {/* List View */}
            <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className={`min-h-[500px] ${isStickyHeader ? 'overflow-auto h-[calc(100vh-300px)]' : 'overflow-x-auto'}`}>
                        <table className="w-full text-sm text-left text-slate-500 border-collapse">
                            <thead className={`text-xs uppercase bg-slate-900 text-white ${isStickyHeader ? 'sticky top-0 z-10' : ''}`}>
                                <tr>
                                    <th className="px-6 py-3 w-4 border border-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={filteredCompanies.length > 0 && selectedCompanyIds.length === filteredCompanies.length}
                                            onChange={toggleSelectAll}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-600"
                                        />
                                    </th>
                                    <th className="px-2 py-3 w-8 border border-slate-700"></th>
                                    {COMPANY_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => (
                                        <th key={col.key} className="px-6 py-3 font-semibold border border-slate-700 whitespace-nowrap">{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 cursor-pointer">
                                {loading ? (
                                    <tr><td colSpan={visibleColumns.length + 2} className="text-center py-20 text-slate-500">데이터를 불러오는 중입니다...</td></tr>
                                ) : sortedCompanies.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleColumns.length + 2} className="px-6 py-20 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <FontAwesomeIcon icon={faBuilding} className="text-4xl text-slate-300 mb-2" />
                                                <p>{searchTerm ? '검색 결과가 없습니다.' : '등록된 회사가 없습니다.'}</p>
                                                <button onClick={() => openCompanyModal()} className="mt-2 text-indigo-600 font-bold hover:underline">첫 회사 등록하기</button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedCompanies.map((company) => {
                                        const isHighlighted = company.id === highlightedId;
                                        return (
                                            <React.Fragment key={company.id}>
                                                <tr
                                                    onClick={() => toggleSelect(company.id!)}
                                                    className={`transition-colors border-b cursor-pointer ${isHighlighted ? 'bg-red-50 border-red-200' :
                                                        selectedCompanyIds.includes(company.id!) ? 'bg-indigo-50/50' : 'bg-white hover:bg-slate-50'
                                                        }`}
                                                    ref={isHighlighted ? (el) => {
                                                        if (el && !highlightScrolledRef.current) {
                                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            highlightScrolledRef.current = true;
                                                        }
                                                    } : null}
                                                >
                                                    <td className="px-6 py-4 border border-slate-200" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCompanyIds.includes(company.id!)}
                                                            onChange={() => toggleSelect(company.id!)}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-4 text-center cursor-pointer border border-slate-200" onClick={(e) => { e.stopPropagation(); toggleCompanyExpand(company.id!); }}>
                                                        <FontAwesomeIcon
                                                            icon={expandedCompanyIds.includes(company.id!) ? faChevronDown : faChevronRight}
                                                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                        />
                                                    </td>
                                                    {COMPANY_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => (
                                                        <td key={`${company.id}-${col.key}`} className="px-6 py-4 border border-slate-200">
                                                            {col.key === 'name' ? (
                                                                <div
                                                                    className="flex items-center gap-2 hover:text-indigo-600 font-semibold text-slate-800 cursor-pointer"
                                                                    onClick={(e) => { e.stopPropagation(); openCompanyModal(company.id); }}
                                                                >
                                                                    {company.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: company.color }} />}
                                                                    {company.name}
                                                                </div>
                                                            ) : col.key === 'status' ? (
                                                                <SingleSelectPopover
                                                                    options={[
                                                                        { id: 'active', name: '정상' },
                                                                        { id: 'inactive', name: '폐업' },
                                                                        { id: 'archived', name: '보관' }
                                                                    ]}
                                                                    selectedId={company.status || 'active'}
                                                                    onSelect={(id) => company.id && handleCompanyInlineUpdate(company.id, { status: id as Company['status'] })}
                                                                    placeholder="상태 선택"
                                                                    minimal={true}
                                                                />
                                                            ) : col.key === 'bankName' ? (
                                                                <InputPopover
                                                                    value={company.bankName || ''}
                                                                    onChange={(value) => company.id && handleCompanyInlineUpdate(company.id, { bankName: String(value || '') })}
                                                                    placeholder="은행명"
                                                                    minimal={true}
                                                                />
                                                            ) : col.key === 'accountNumber' ? (
                                                                <InputPopover
                                                                    value={company.accountNumber || ''}
                                                                    onChange={(value) => company.id && handleCompanyInlineUpdate(company.id, { accountNumber: String(value || '') })}
                                                                    placeholder="계좌번호"
                                                                    minimal={true}
                                                                />
                                                            ) : col.key === 'accountHolder' ? (
                                                                <InputPopover
                                                                    value={company.accountHolder || ''}
                                                                    onChange={(value) => company.id && handleCompanyInlineUpdate(company.id, { accountHolder: String(value || '') })}
                                                                    placeholder="예금주"
                                                                    minimal={true}
                                                                />
                                                            ) : (
                                                                renderCellValue(company, col.key)
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>

                                                {/* Expanded Detail Row */}
                                                {expandedCompanyIds.includes(company.id!) && (
                                                    <tr className="bg-slate-50/50">
                                                        <td colSpan={visibleColumns.length + 2} className="px-6 py-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="bg-white p-4 rounded-lg border border-slate-200">
                                                                    <h4 className="font-bold text-slate-700 mb-2 border-b pb-2">기본 정보</h4>
                                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                                        <div className="text-slate-500">구분</div><div className="font-medium text-slate-800">{company.type}</div>
                                                                        <div className="text-slate-500">사업자번호</div><div>{company.businessNumber || '-'}</div>
                                                                        <div className="text-slate-500">대표자 (주민번호)</div><div>{company.ceoName} {company.ceoResidentNumber ? `(${company.ceoResidentNumber})` : ''}</div>
                                                                        <div className="text-slate-500">연락처</div><div>{company.phone || '-'}</div>
                                                                        <div className="text-slate-500">이메일</div><div>{company.email || '-'}</div>
                                                                        <div className="text-slate-500">주소</div><div className="col-span-1">{company.address || '-'}</div>
                                                                        <div className="text-slate-500">계좌정보</div><div className="col-span-1">{[company.bankName, company.accountNumber, company.accountHolder ? `(${company.accountHolder})` : ''].filter(Boolean).join(' ') || '-'}</div>
                                                                        <div className="text-slate-500">색상</div><div className="col-span-1 flex items-center gap-2">{company.color ? <span className="w-4 h-4 rounded-full" style={{ backgroundColor: company.color }}></span> : '-'} {company.color || ''}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-white p-4 rounded-lg border border-slate-200">
                                                                    <h4 className="font-bold text-slate-700 mb-2 border-b pb-2 flex justify-between">
                                                                        <span>배정 현장 ({sites.filter(s => s.companyId === company.id).length})</span>
                                                                    </h4>
                                                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                                                        {sites.filter(s => s.companyId === company.id || s.clientCompanyId === company.id || s.partnerId === company.id).map(site => (
                                                                            <div key={site.id} className="text-xs flex items-center justify-between p-1 hover:bg-slate-50 rounded">
                                                                                <span className="font-medium text-slate-800">{site.name}</span>
                                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${site.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                                    {site.status === 'active' ? '진행' : '종료'}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                        {sites.filter(s => s.companyId === company.id).length === 0 && (
                                                                            <div className="text-xs text-slate-400 italic">배정된 현장이 없습니다.</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showCompanyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingCompany ? '회사 정보 수정' : '회사 등록'}
                            </h2>
                            <button onClick={() => setShowCompanyModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <FontAwesomeIcon icon={faTimes} className="text-lg" />
                            </button>
                        </div>
                        <CompanyForm
                            initialData={editingCompany || undefined}
                            onSave={async (data) => {
                                try {
                                    if (editingCompany && editingCompany.id) {
                                        await companyService.updateCompany(editingCompany.id, data);
                                    } else {
                                        await companyService.addCompany(data as Company);
                                    }
                                    await handleCompanySave();
                                    alert('저장되었습니다.');
                                } catch (e) {
                                    console.error(e);
                                    alert('저장 중 오류가 발생했습니다.');
                                }
                            }}
                            onCancel={() => setShowCompanyModal(false)}
                            defaultType={(() => {
                                if (defaultType) return defaultType as Company['type'];
                                const map: Record<string, string> = { 'company': '시공사', 'partner': '협력사', 'client': '건설사' };
                                return (map[activeTab] || '미지정') as Company['type'];
                            })()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanyDatabase;
