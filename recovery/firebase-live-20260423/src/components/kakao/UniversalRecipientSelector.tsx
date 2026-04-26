import React, { useEffect, useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faCheck, faUser, faBuilding, faSpinner, faWarning } from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { companyService, Company } from '../../services/companyService';

export interface Recipient {
    id: string;
    name: string;
    phone: string;
    type: 'WORKER' | 'COMPANY';
    subType: string; // 'worker', '건설사', '협력사', etc.
    originalData?: any;
}

interface UniversalRecipientSelectorProps {
    onSelectionChange: (selectedRecipients: Recipient[]) => void;
    initialSelectedIds?: Set<string>;
}

type TabType = 'WORKER' | 'CONSTRUCTION' | 'PARTNER';

export const UniversalRecipientSelector: React.FC<UniversalRecipientSelectorProps> = ({
    onSelectionChange,
    initialSelectedIds = new Set(),
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('WORKER');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const [workers, setWorkers] = useState<Recipient[]>([]);
    const [companies, setCompanies] = useState<Recipient[]>([]);

    // Manage selection internally, but sync with parent
    const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelectedIds);
    const [selectedRecipients, setSelectedRecipients] = useState<Map<string, Recipient>>(new Map());

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [workerData, companyData] = await Promise.all([
                    manpowerService.getWorkers(),
                    companyService.getCompanies(),
                ]);

                const parsedWorkers: Recipient[] = workerData
                    .filter(w => w.contact && w.id)
                    .map(w => ({
                        id: w.id!,
                        name: w.name,
                        phone: w.contact!,
                        type: 'WORKER',
                        subType: 'worker',
                        originalData: w,
                    }));

                const parsedCompanies: Recipient[] = companyData
                    .filter(c => c.phone && c.id) // Only companies with phone (CEO or Office)
                    .map(c => ({
                        id: c.id!,
                        name: c.name,
                        phone: c.phone || '', // Fallback though filter handles it
                        type: 'COMPANY',
                        subType: c.type || '기타',
                        originalData: c,
                    }));

                setWorkers(parsedWorkers);
                setCompanies(parsedCompanies);

            } catch (error) {
                console.error("Failed to fetch recipients", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Notify parent on change
    useEffect(() => {
        onSelectionChange(Array.from(selectedRecipients.values()));
    }, [selectedRecipients, onSelectionChange]);


    const filteredList = useMemo(() => {
        let source: Recipient[] = [];
        if (activeTab === 'WORKER') {
            source = workers;
        } else if (activeTab === 'CONSTRUCTION') {
            source = companies.filter(c => c.subType === '건설사' || c.subType === '시공사');
        } else if (activeTab === 'PARTNER') {
            source = companies.filter(c => c.subType === '협력사');
        }

        if (!searchTerm) return source;
        const lowerTerm = searchTerm.toLowerCase();
        return source.filter(r =>
            r.name.toLowerCase().includes(lowerTerm) ||
            r.phone.replace(/-/g, '').includes(lowerTerm)
        );
    }, [activeTab, workers, companies, searchTerm]);

    const handleToggle = (recipient: Recipient) => {
        const newSet = new Set(selectedIds);
        const newMap = new Map(selectedRecipients);

        if (newSet.has(recipient.id)) {
            newSet.delete(recipient.id);
            newMap.delete(recipient.id);
        } else {
            newSet.add(recipient.id);
            newMap.set(recipient.id, recipient);
        }

        setSelectedIds(newSet);
        setSelectedRecipients(newMap);
    };

    const handleSelectAll = () => {
        const newSet = new Set(selectedIds);
        const newMap = new Map(selectedRecipients);

        const isAllSelected = filteredList.length > 0 && filteredList.every(r => newSet.has(r.id));

        if (isAllSelected) {
            filteredList.forEach(r => {
                newSet.delete(r.id);
                newMap.delete(r.id);
            });
        } else {
            filteredList.forEach(r => {
                newSet.add(r.id);
                newMap.set(r.id, r);
            });
        }

        setSelectedIds(newSet);
        setSelectedRecipients(newMap);
    };

    const getCount = (tab: TabType) => {
        if (tab === 'WORKER') return workers.length;
        if (tab === 'CONSTRUCTION') return companies.filter(c => c.subType === '건설사' || c.subType === '시공사').length;
        if (tab === 'PARTNER') return companies.filter(c => c.subType === '협력사').length;
        return 0;
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header / Tabs */}
            <div className="flex border-b bg-gray-50">
                <button
                    onClick={() => setActiveTab('WORKER')}
                    className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'WORKER'
                            ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <FontAwesomeIcon icon={faUser} />
                    작업자 ({getCount('WORKER')})
                </button>
                <button
                    onClick={() => setActiveTab('CONSTRUCTION')}
                    className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'CONSTRUCTION'
                            ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <FontAwesomeIcon icon={faBuilding} />
                    건설사 ({getCount('CONSTRUCTION')})
                </button>
                <button
                    onClick={() => setActiveTab('PARTNER')}
                    className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'PARTNER'
                            ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <FontAwesomeIcon icon={faBuilding} />
                    협력사 ({getCount('PARTNER')})
                </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 border-b bg-white flex gap-2">
                <div className="relative flex-grow">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="이름 또는 전화번호 검색..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all"
                    />
                </div>
                <button
                    onClick={handleSelectAll}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium whitespace-nowrap"
                >
                    {filteredList.every(r => selectedIds.has(r.id)) && filteredList.length > 0 ? '해제' : '전체'}
                </button>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-white">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2">
                        <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                        <span className="text-sm">데이터를 불러오는 중...</span>
                    </div>
                ) : filteredList.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2">
                        <FontAwesomeIcon icon={faWarning} size="2x" />
                        <span className="text-sm">검색 결과가 없습니다.</span>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {filteredList.map(recipient => {
                            const isSelected = selectedIds.has(recipient.id);
                            return (
                                <li
                                    key={recipient.id}
                                    onClick={() => handleToggle(recipient)}
                                    className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-white'
                                        }`}>
                                        {isSelected && <FontAwesomeIcon icon={faCheck} size="xs" />}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <div className="font-semibold text-gray-900 truncate">{recipient.name}</div>
                                        <div className="text-xs text-gray-500">{recipient.phone}</div>
                                    </div>
                                    <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                                        {recipient.type === 'WORKER' ? '작업자' : recipient.subType}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Footer Status */}
            <div className="p-3 border-t bg-gray-50 text-sm text-gray-600 flex justify-between items-center">
                <span>총 <strong className="text-blue-600">{selectedIds.size}</strong>명 선택됨</span>
                {selectedIds.size > 0 && (
                    <button
                        onClick={() => {
                            setSelectedIds(new Set());
                            setSelectedRecipients(new Map());
                        }}
                        className="text-xs text-gray-500 hover:text-red-500 underline"
                    >
                        모두 해제
                    </button>
                )}
            </div>
        </div>
    );
};
