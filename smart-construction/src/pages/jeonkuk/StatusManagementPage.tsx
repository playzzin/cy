import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faHardHat,
    faMapLocationDot,
    faSearch,
    faFilter,
    faCheckCircle,
    faTimesCircle,
    faClock,
    faUserSlash,
    faUserCheck,
    faUserClock,
    faArrowRight,
    faArrowLeft,
    faExchangeAlt
} from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';

type TabType = 'company' | 'site' | 'worker';

// --- Types ---
interface StatusItem {
    id: string;
    name: string;
    subText?: string; // CEO, Address, ID Number
    status: string;
    type: TabType;
    originalData: any;
}

interface StatusColumn {
    id: string;
    title: string;
    statusValues: string[]; // Which status values belong to this column
    items: StatusItem[];
    color: string;
    icon: any;
    position: 'left' | 'center' | 'right';
}

// --- Card Component ---
const StatusCard: React.FC<{
    item: StatusItem;
    columnPosition: 'left' | 'center' | 'right';
    onMove: (id: string, direction: 'next' | 'prev') => void;
}> = ({ item, columnPosition, onMove }) => {

    const handleDoubleClick = () => {
        // Double click logic:
        // Left -> Center (Next)
        // Center -> Right (Next)
        // Right -> Center (Prev) - Special case to bring back to active
        if (columnPosition === 'right') {
            onMove(item.id, 'prev');
        } else {
            onMove(item.id, 'next');
        }
    };

    return (
        <div
            onDoubleClick={handleDoubleClick}
            className={`
                p-4 rounded-xl border shadow-sm mb-3 bg-white transition-all
                border-slate-200 hover:border-blue-300 hover:shadow-md select-none
            `}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-slate-800 text-lg">{item.name}</div>
            </div>
            {item.subText && (
                <div className="text-sm text-slate-500 flex items-center gap-2 mb-3">
                    {item.subText}
                </div>
            )}

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                <span className={`text-xs px-2 py-1 rounded-full font-bold
                    ${item.status === 'active' || item.status === '재직' || item.status === 'ongoing' ? 'bg-green-100 text-green-700' : ''}
                    ${item.status === 'inactive' || item.status === '퇴사' || item.status === 'completed' ? 'bg-slate-100 text-slate-600' : ''}
                    ${item.status === 'planned' || item.status === '미배정' ? 'bg-orange-100 text-orange-700' : ''}
                    ${item.status === 'archived' ? 'bg-red-100 text-red-700' : ''}
                `}>
                    {item.status}
                </span>

                <div className="flex gap-1">
                    {/* Left Button */}
                    {(columnPosition === 'center' || columnPosition === 'right') && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMove(item.id, 'prev'); }}
                            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-colors"
                            title="이전 단계로 이동"
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                    )}

                    {/* Right Button */}
                    {(columnPosition === 'left' || columnPosition === 'center') && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMove(item.id, 'next'); }}
                            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-colors"
                            title="다음 단계로 이동"
                        >
                            <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Column Component ---
const KanbanColumn: React.FC<{
    column: StatusColumn;
    onMove: (id: string, direction: 'next' | 'prev') => void;
}> = ({ column, onMove }) => {
    return (
        <div className="flex-1 min-w-[320px] rounded-2xl p-4 flex flex-col h-full bg-slate-100/50">
            <div className={`
                flex items-center justify-between mb-4 p-3 rounded-xl
                ${column.color}
            `}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
                        <FontAwesomeIcon icon={column.icon} />
                    </div>
                    <h3 className="font-bold text-white text-lg">{column.title}</h3>
                </div>
                <span className="bg-white/20 text-white px-2 py-1 rounded-lg text-sm font-bold">
                    {column.items.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {column.items.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-sm">데이터 없음</p>
                    </div>
                ) : (
                    column.items.map(item => (
                        <StatusCard
                            key={item.id}
                            item={item}
                            columnPosition={column.position}
                            onMove={onMove}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

const StatusManagementPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('site');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    // Data states
    const [companies, setCompanies] = useState<Company[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'company') {
                const data = await companyService.getCompanies();
                setCompanies(data);
            } else if (activeTab === 'site') {
                const data = await siteService.getSites();
                setSites(data);
            } else if (activeTab === 'worker') {
                const data = await manpowerService.getWorkers();
                setWorkers(data);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMove = async (id: string, direction: 'next' | 'prev') => {
        // Find current item and its status
        let currentItem: StatusItem | undefined;
        let allItems: StatusItem[] = [];

        if (activeTab === 'company') {
            allItems = companies.map(c => ({ id: c.id!, name: c.name, status: c.status || 'active', type: 'company', originalData: c }));
        } else if (activeTab === 'site') {
            allItems = sites.map(s => ({ id: s.id!, name: s.name, status: s.status, type: 'site', originalData: s }));
        } else {
            allItems = workers.map(w => ({ id: w.id!, name: w.name, status: w.status, type: 'worker', originalData: w }));
        }

        currentItem = allItems.find(i => i.id === id);
        if (!currentItem) return;

        // Determine new status based on current status and direction
        const newStatus = getNextStatus(currentItem.status, direction);
        if (!newStatus || newStatus === currentItem.status) return;

        // Optimistic Update
        updateLocalState(id, newStatus);

        try {
            if (activeTab === 'company') {
                await companyService.updateCompany(id, { status: newStatus as any });
            } else if (activeTab === 'site') {
                await siteService.updateSite(id, { status: newStatus as any });
            } else if (activeTab === 'worker') {
                await manpowerService.updateWorker(id, { status: newStatus });
            }
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("상태 변경에 실패했습니다.");
            // Revert
            updateLocalState(id, currentItem.status);
        }
    };

    const getNextStatus = (currentStatus: string, direction: 'next' | 'prev'): string | null => {
        // Define status flows
        // Left <-> Center <-> Right

        if (activeTab === 'company') {
            // Left: pending
            // Center: active
            // Right: inactive, archived
            if (direction === 'next') {
                if (currentStatus === 'pending') return 'active';
                if (currentStatus === 'active') return 'inactive'; // Default to inactive for right
            } else {
                if (currentStatus === 'active') return 'pending';
                if (['inactive', 'archived'].includes(currentStatus)) return 'active';
            }
        } else if (activeTab === 'site') {
            // Left: planned
            // Center: active, ongoing
            // Right: completed
            if (direction === 'next') {
                if (currentStatus === 'planned') return 'active';
                if (['active', 'ongoing'].includes(currentStatus)) return 'completed';
            } else {
                if (['active', 'ongoing'].includes(currentStatus)) return 'planned';
                if (currentStatus === 'completed') return 'active';
            }
        } else if (activeTab === 'worker') {
            // Left: 미배정
            // Center: 재직
            // Right: 퇴사
            if (direction === 'next') {
                if (currentStatus === '미배정') return '재직';
                if (currentStatus === '재직') return '퇴사';
            } else {
                if (currentStatus === '재직') return '미배정';
                if (currentStatus === '퇴사') return '재직';
            }
        }
        return null;
    };

    const updateLocalState = (id: string, newStatus: string) => {
        if (activeTab === 'company') {
            setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: newStatus as any } : c));
        } else if (activeTab === 'site') {
            setSites(prev => prev.map(s => s.id === id ? { ...s, status: newStatus as any } : s));
        } else if (activeTab === 'worker') {
            setWorkers(prev => prev.map(w => w.id === id ? { ...w, status: newStatus } : w));
        }
    };

    const getColumns = (): StatusColumn[] => {
        const filteredItems = ((
            activeTab === 'company' ? companies.map(c => ({
                id: c.id!, name: c.name, subText: c.ceoName, status: c.status || 'active', type: 'company', originalData: c
            })) :
                activeTab === 'site' ? sites.map(s => ({
                    id: s.id!, name: s.name, subText: s.code, status: s.status, type: 'site', originalData: s
                })) :
                    workers.map(w => ({
                        id: w.id!, name: w.name, subText: w.idNumber, status: w.status, type: 'worker', originalData: w
                    }))
        ) as StatusItem[]).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

        if (activeTab === 'company') {
            return [
                {
                    id: 'col-left',
                    title: '신규/대기',
                    statusValues: ['pending'],
                    items: filteredItems.filter(i => ['pending'].includes(i.status)),
                    color: 'bg-slate-500',
                    icon: faClock,
                    position: 'left'
                },
                {
                    id: 'col-center',
                    title: '거래중 (Active)',
                    statusValues: ['active'],
                    items: filteredItems.filter(i => ['active'].includes(i.status)),
                    color: 'bg-green-600',
                    icon: faCheckCircle,
                    position: 'center'
                },
                {
                    id: 'col-right',
                    title: '거래중지/폐업',
                    statusValues: ['inactive', 'archived'],
                    items: filteredItems.filter(i => ['inactive', 'archived'].includes(i.status)),
                    color: 'bg-red-500',
                    icon: faTimesCircle,
                    position: 'right'
                }
            ];
        } else if (activeTab === 'site') {
            return [
                {
                    id: 'col-left',
                    title: '예정 (Planned)',
                    statusValues: ['planned'],
                    items: filteredItems.filter(i => ['planned'].includes(i.status)),
                    color: 'bg-orange-500',
                    icon: faClock,
                    position: 'left'
                },
                {
                    id: 'col-center',
                    title: '진행중 (Ongoing)',
                    statusValues: ['active', 'ongoing'],
                    items: filteredItems.filter(i => ['active', 'ongoing'].includes(i.status)),
                    color: 'bg-blue-600',
                    icon: faHardHat,
                    position: 'center'
                },
                {
                    id: 'col-right',
                    title: '완공 (Completed)',
                    statusValues: ['completed'],
                    items: filteredItems.filter(i => ['completed'].includes(i.status)),
                    color: 'bg-slate-600',
                    icon: faCheckCircle,
                    position: 'right'
                }
            ];
        } else { // worker
            return [
                {
                    id: 'col-left',
                    title: '미배정 (Unassigned)',
                    statusValues: ['미배정'],
                    items: filteredItems.filter(i => ['미배정'].includes(i.status)),
                    color: 'bg-orange-500',
                    icon: faUserClock,
                    position: 'left'
                },
                {
                    id: 'col-center',
                    title: '재직 (Employed)',
                    statusValues: ['재직'],
                    items: filteredItems.filter(i => ['재직'].includes(i.status)),
                    color: 'bg-green-600',
                    icon: faUserCheck,
                    position: 'center'
                },
                {
                    id: 'col-right',
                    title: '퇴사 (Resigned)',
                    statusValues: ['퇴사'],
                    items: filteredItems.filter(i => ['퇴사'].includes(i.status)),
                    color: 'bg-red-500',
                    icon: faUserSlash,
                    position: 'right'
                }
            ];
        }
    };

    const columns = getColumns();

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-800 mb-6">통합 상태 관리</h1>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('company')}
                        className={`px-6 py-3 font-bold text-sm rounded-t-lg transition-all flex items-center gap-2 ${activeTab === 'company'
                            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faBuilding} />
                        회사 관리
                    </button>
                    <button
                        onClick={() => setActiveTab('site')}
                        className={`px-6 py-3 font-bold text-sm rounded-t-lg transition-all flex items-center gap-2 ${activeTab === 'site'
                            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faMapLocationDot} />
                        현장 관리
                    </button>
                    <button
                        onClick={() => setActiveTab('worker')}
                        className={`px-6 py-3 font-bold text-sm rounded-t-lg transition-all flex items-center gap-2 ${activeTab === 'worker'
                            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faHardHat} />
                        작업자 관리
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="px-8 py-4 flex justify-between items-center">
                <div className="relative w-96">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="이름으로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-shadow"
                    />
                </div>
                <div className="text-sm font-medium text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                    총 <span className="text-slate-800 font-bold">{columns.reduce((acc, col) => acc + col.items.length, 0)}</span> 건
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-hidden px-8 pb-8">
                <div className="flex h-full gap-6 overflow-x-auto pb-2">
                    {columns.map(col => (
                        <KanbanColumn
                            key={col.id}
                            column={col}
                            onMove={handleMove}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StatusManagementPage;
