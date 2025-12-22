import React, { useEffect, useRef, useState } from 'react';
import { companyService, Company } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faPlus, faEdit, faTrash, faSearch, faFilter,
    faIndustry, faHardHat, faMapMarkerAlt, faPhone, faEnvelope,
    faIdCard, faCalendar, faDollarSign, faCheckCircle, faTimesCircle,
    faChevronDown, faChevronUp, faSave, faUndo, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { useMasterData } from '../../contexts/MasterDataContext';
import InputPopover from '../../components/common/InputPopover';
import MultiSelectPopover from '../../components/common/MultiSelectPopover';

interface ConstructionCompanyStats {
    total: number;
    active: number;
    inactive: number;
    totalManDay: number;
    assignedSites: number;
}

interface ConstructionCompanyDatabaseProps {
    hideHeader?: boolean;
    highlightedId?: string | null;
}

const ConstructionCompanyDatabase: React.FC<ConstructionCompanyDatabaseProps> = ({
    hideHeader = false,
    highlightedId
}) => {
    const [loading, setLoading] = useState(false);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [isAddingCompany, setIsAddingCompany] = useState(false);


    const highlightScrolledRef = useRef(false);
    const lastHighlightIdRef = useRef<string | null>(null);

    const { refreshCompanies } = useMasterData();
    const [stats, setStats] = useState<ConstructionCompanyStats>({
        total: 0,
        active: 0,
        inactive: 0,
        totalManDay: 0,
        assignedSites: 0
    });

    // Form state
    const [formData, setFormData] = useState<Partial<Company>>({
        name: '',
        code: '',
        businessNumber: '',
        ceoName: '',
        address: '',
        phone: '',
        email: '',
        type: '건설사',
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        status: 'active'
    });

    useEffect(() => {
        loadConstructionCompanies();
    }, []);

    useEffect(() => {
        filterCompanies();
    }, [companies, searchTerm, statusFilter]);

    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

    const toggleSelectAll = () => {
        if (selectedCompanyIds.length === filteredCompanies.length) setSelectedCompanyIds([]);
        else setSelectedCompanyIds(filteredCompanies.map(c => c.id!).filter(Boolean));
    };

    const toggleSelect = (id: string) => {
        setSelectedCompanyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedCompanyIds.length === 0) return;
        if (!window.confirm(`${selectedCompanyIds.length}개의 건설사를 삭제 하시겠습니까?`)) return;

        try {
            setLoading(true);
            await Promise.all(selectedCompanyIds.map(id => companyService.deleteCompany(id)));
            // Refresh data logic needed, but simpler to just reload or optimistic update
            // Since this component doesn't have a 'loadData' exposed easily without refetch, assuming the parent or effect parses it.
            // But wait, the component uses 'companies' prop or state?
            // Ah, it uses 'constructionCompanyService.subscribeToCompanies' usually or similar?
            // Checking the file... it uses useEffect to load initial data.
            // We need to re-fetch.
            const data = await companyService.getCompaniesByType('건설사');
            setCompanies(data);
            setSelectedCompanyIds([]);
            alert('삭제되었습니다.');
        } catch (error) {
            console.error("Bulk delete failed:", error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const loadConstructionCompanies = async () => {
        setLoading(true);
        try {
            const [constructionCompanies, sitesData] = await Promise.all([
                companyService.getCompaniesByType('건설사'),
                siteService.getSites()
            ]);
            setCompanies(constructionCompanies);
            setSites(sitesData);
            calculateStats(constructionCompanies);
        } catch (error) {
            console.error('Failed to load construction companies:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (companyList: Company[]) => {
        const activeCount = companyList.filter(c => c.status === 'active' || !c.status).length;
        const inactiveCount = companyList.filter(c => c.status === 'inactive').length;
        const totalManDay = companyList.reduce((sum, c) => sum + (c.totalManDay || 0), 0);
        const assignedSites = companyList.filter(c => c.siteIds && c.siteIds.length > 0).length;

        setStats({
            total: companyList.length,
            active: activeCount,
            inactive: inactiveCount,
            totalManDay,
            assignedSites
        });
    };

    const filterCompanies = () => {
        let filtered = companies;

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(company =>
                (company.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (company.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (company.ceoName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (company.businessNumber || '').includes(searchTerm)
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(company => {
                if (statusFilter === 'active') {
                    return company.status === 'active' || !company.status;
                }
                return company.status === statusFilter;
            });
        }

        setFilteredCompanies(filtered);
    };

    const handleAddCompany = async () => {
        if (!formData.name || !formData.code || !formData.businessNumber || !formData.ceoName) {
            alert('필수 정보를 모두 입력해주세요.');
            return;
        }

        try {
            const newCompany = {
                ...formData,
                type: '건설사' as const,
                status: 'active' as const
            };
            await companyService.addCompany(newCompany as Omit<Company, 'id' | 'createdAt' | 'updatedAt'>);
            await loadConstructionCompanies();
            await refreshCompanies();
            setIsAddingCompany(false);
            resetForm();
        } catch (error) {
            console.error('Failed to add construction company:', error);
            alert('건설사 등록에 실패했습니다.');
        }
    };

    const handleUpdateCompany = async () => {
        if (!editingCompany?.id || !formData.name || !formData.code) {
            alert('필수 정보를 모두 입력해주세요.');
            return;
        }

        try {
            await companyService.updateCompany(editingCompany.id, formData);

            // Sync Name Change if updated
            if (formData.name && editingCompany.name && formData.name !== editingCompany.name) {
                await manpowerService.updateWorkersCompanyName(editingCompany.id, formData.name);
            }

            await loadConstructionCompanies();
            await refreshCompanies();
            setEditingCompany(null);
            resetForm();
        } catch (error) {
            console.error('Failed to update construction company:', error);
            alert('건설사 정보 수정에 실패했습니다.');
        }
    };

    const handleDeleteCompany = async (company: Company) => {
        if (!company.id) return;

        if (window.confirm(`${company.name} 건설사를 정말 삭제하시겠습니까?`)) {
            try {
                await companyService.deleteCompany(company.id);
                await loadConstructionCompanies();
                await refreshCompanies();
            } catch (error) {
                console.error('Failed to delete construction company:', error);
                alert('건설사 삭제에 실패했습니다.');
            }
        }
    };

    const handleCompanyFieldUpdate = async (id: string, field: keyof Company, value: any) => {
        // Optimistic Update
        setCompanies(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

        try {
            await companyService.updateCompany(id, { [field]: value });
            // Sync Name Change if updated
            if (field === 'name') {
                await manpowerService.updateWorkersCompanyName(id, value);
            }
            // Silent refresh if needed, but optimistic update is usually enough for this view
            // await refreshCompanies(); 
        } catch (error) {
            console.error("Failed to update company field", error);
            // Revert on failure
            await loadConstructionCompanies(); // Or revert specific item
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            code: '',
            businessNumber: '',
            ceoName: '',
            address: '',
            phone: '',
            email: '',
            type: '건설사',
            bankName: '',
            accountNumber: '',
            accountHolder: '',
            status: 'active'
        });
    };

    const startEdit = (company: Company) => {
        setEditingCompany(company);
        setFormData(company);
    };

    const cancelEdit = () => {
        setEditingCompany(null);
        setIsAddingCompany(false);
        resetForm();
    };

    return (
        <div className={`${hideHeader ? '' : 'p-6'} bg-slate-50 min-h-full pb-[400px]`}>
            {/* Header */}
            <div className="mb-8">
                <div className={`flex items-center mb-6 ${hideHeader ? 'justify-end' : 'justify-between'}`}>
                    {!hideHeader && (
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                                <FontAwesomeIcon icon={faIndustry} className="text-indigo-600" />
                                건설사 관리
                            </h1>
                            <p className="text-slate-600 mt-2">건설사 정보 및 현장 배정 현황을 관리합니다.</p>
                        </div>
                    )}
                    <div className="flex gap-2">
                        {selectedCompanyIds.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="px-3 py-1.5 rounded text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 flex items-center gap-1"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                                삭제 ({selectedCompanyIds.length})
                            </button>
                        )}
                        <button
                            onClick={() => setIsAddingCompany(true)}
                            className="px-3 py-1.5 rounded text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            건설사 등록
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">총 건설사</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                            </div>
                            <FontAwesomeIcon icon={faBuilding} className="text-2xl text-indigo-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">활성 건설사</p>
                                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                            </div>
                            <FontAwesomeIcon icon={faCheckCircle} className="text-2xl text-green-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">비활성 건설사</p>
                                <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
                            </div>
                            <FontAwesomeIcon icon={faTimesCircle} className="text-2xl text-red-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">총 공수</p>
                                <p className="text-2xl font-bold text-blue-600">{stats.totalManDay.toFixed(1)}</p>
                            </div>
                            <FontAwesomeIcon icon={faHardHat} className="text-2xl text-blue-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">배정 현장</p>
                                <p className="text-2xl font-bold text-purple-600">{stats.assignedSites}</p>
                            </div>
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-2xl text-purple-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <FontAwesomeIcon
                            icon={faSearch}
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="건설사명, 코드, 대표자, 사업자번호 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faFilter} className="text-slate-500" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="all">전체 상태</option>
                            <option value="active">활성</option>
                            <option value="inactive">비활성</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Add/Edit Form */}
            {(isAddingCompany || editingCompany) && (
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                        {editingCompany ? '건설사 정보 수정' : '신규 건설사 등록'}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                건설사명 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                코드 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.code || ''}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                사업자번호 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.businessNumber || ''}
                                onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                대표자명 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.ceoName || ''}
                                onChange={(e) => setFormData({ ...formData, ceoName: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                전화번호
                            </label>
                            <input
                                type="text"
                                value={formData.phone || ''}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                이메일
                            </label>
                            <input
                                type="email"
                                value={formData.email || ''}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                주소
                            </label>
                            <input
                                type="text"
                                value={formData.address || ''}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                상태
                            </label>
                            <select
                                value={formData.status || 'active'}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="active">활성</option>
                                <option value="inactive">비활성</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                은행명
                            </label>
                            <input
                                type="text"
                                value={formData.bankName || ''}
                                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                계좌번호
                            </label>
                            <input
                                type="text"
                                value={formData.accountNumber || ''}
                                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                예금주
                            </label>
                            <input
                                type="text"
                                value={formData.accountHolder || ''}
                                onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            onClick={cancelEdit}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faUndo} />
                            취소
                        </button>
                        <button
                            onClick={editingCompany ? handleUpdateCompany : handleAddCompany}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            {editingCompany ? '수정' : '등록'}
                        </button>
                    </div>
                </div>
            )}

            {/* Company List */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : filteredCompanies.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <FontAwesomeIcon icon={faBuilding} className="text-4xl mb-4 opacity-20" />
                        <p>등록된 건설사가 없습니다.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto min-h-[500px]">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 w-4">
                                        <input
                                            type="checkbox"
                                            checked={filteredCompanies.length > 0 && selectedCompanyIds.length === filteredCompanies.length}
                                            onChange={toggleSelectAll}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        건설사 정보
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        대표자
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        연락처
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        현장 배정
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        상태
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        관리
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredCompanies.map((company) => {
                                    const isHighlighted = Boolean(highlightedId && company.id === highlightedId);

                                    return (
                                        <React.Fragment key={company.id}>
                                            <tr
                                                onClick={() => toggleSelect(company.id!)}
                                                className={`transition-colors border-b cursor-pointer
                                                        ${isHighlighted ? 'bg-red-50 ring-1 ring-red-300' :
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
                                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCompanyIds.includes(company.id!)}
                                                        onChange={() => toggleSelect(company.id!)}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                            <FontAwesomeIcon icon={faIndustry} className="text-indigo-600" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-slate-900">{company.name}</div>
                                                            <div className="text-sm text-slate-500">코드: {company.code}</div>
                                                            <div className="text-xs text-slate-400">사업자번호: {company.businessNumber}</div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <InputPopover
                                                        value={company.ceoName || ''}
                                                        onChange={(val) => handleCompanyFieldUpdate(company.id!, 'ceoName', val)}
                                                        placeholder="대표자명"
                                                        minimal={true}
                                                        suffix={company.address ? ` (${company.address})` : ''}
                                                    />
                                                </td>

                                                <td className="px-4 py-4">
                                                    <InputPopover
                                                        value={company.phone || ''}
                                                        onChange={(val) => handleCompanyFieldUpdate(company.id!, 'phone', val)}
                                                        placeholder="연락처 입력"
                                                        minimal={true}
                                                    />
                                                    {company.email && (
                                                        <div className="text-xs text-slate-500 mt-1 pl-2">
                                                            {company.email}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <MultiSelectPopover
                                                        options={sites.map(s => ({ id: s.id!, name: s.name }))}
                                                        selectedIds={company.siteIds || []}
                                                        onSelect={(id) => {
                                                            const currentIds = company.siteIds || [];
                                                            const newIds = currentIds.includes(id)
                                                                ? currentIds.filter(i => i !== id)
                                                                : [...currentIds, id];
                                                            handleCompanyFieldUpdate(company.id!, 'siteIds', newIds);
                                                        }}
                                                        onSelectAll={() => {
                                                            const allIds = sites.map(s => s.id!);
                                                            const currentIds = company.siteIds || [];
                                                            const isAllSelected = currentIds.length === allIds.length;
                                                            const newIds = isAllSelected ? [] : allIds;
                                                            handleCompanyFieldUpdate(company.id!, 'siteIds', newIds);
                                                        }}
                                                        placeholder={`${company.siteIds?.length || 0}개 현장`}
                                                        minimal={true}
                                                    />
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleCompanyFieldUpdate(company.id!, 'status', company.status === 'active' ? 'inactive' : 'active')}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${company.status === 'active' ? 'bg-green-500' : 'bg-slate-300'
                                                                }`}
                                                        >
                                                            <span
                                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${company.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                                                                    }`}
                                                            />
                                                        </button>
                                                        <span className={`text-xs font-bold ${company.status === 'active' ? 'text-green-600' : 'text-slate-500'}`}>
                                                            {company.status === 'active' ? '활성' : '비활성'}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => startEdit(company)}
                                                            className="p-1 text-indigo-600 hover:text-indigo-800 transition-colors"
                                                            title="수정"
                                                        >
                                                            <FontAwesomeIcon icon={faEdit} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCompany(company)}
                                                            className="p-1 text-red-600 hover:text-red-800 transition-colors"
                                                            title="삭제"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>


                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
                }
            </div >
        </div >
    );
};

export default ConstructionCompanyDatabase;
