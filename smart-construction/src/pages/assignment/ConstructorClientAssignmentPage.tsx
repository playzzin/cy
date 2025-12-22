import React, { useEffect, useMemo, useState } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    closestCenter,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faBuilding, faHardHat, faLink, faSearch, faSave } from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';

interface ConstructorAssignmentState {
    [constructorId: string]: string[]; // client company ids
}

interface DraggableClientProps {
    client: Company;
    isOverlay?: boolean;
}

const DraggableClient: React.FC<DraggableClientProps> = ({ client, isOverlay = false }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: client.id || '',
        data: { client },
    });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs bg-white shadow-sm transition-all ${
                isOverlay ? 'border-indigo-300 shadow-lg scale-105 z-50' : 'border-slate-200 hover:border-indigo-300'
            }`}
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 bg-slate-50 flex-shrink-0">
                    <FontAwesomeIcon icon={faBuilding} className="text-slate-600 text-xs" />
                </span>
                <div className="flex flex-col truncate">
                    <span className="font-semibold text-slate-800 truncate">{client.name}</span>
                    {client.code && (
                        <span className="text-[10px] text-slate-400 truncate">{client.code}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

interface DroppableConstructorProps {
    constructorCompany: Company;
    clients: Company[];
}

const DroppableConstructor: React.FC<DroppableConstructorProps> = ({ constructorCompany, clients }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `constructor-${constructorCompany.id}`,
        data: { type: 'constructor', constructorId: constructorCompany.id },
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col rounded-xl border-2 bg-white transition-colors h-full min-h-[140px] ${
                isOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
            }`}
        >
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 flex-shrink-0"
                        style={{ backgroundColor: constructorCompany.color || '#e5e7eb' }}
                    >
                        <FontAwesomeIcon icon={faHardHat} className="text-white text-xs" />
                    </span>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800">
                            {constructorCompany.name}
                        </span>
                        <span className="text-[10px] text-slate-400">배정 건설사 {clients.length}개</span>
                    </div>
                </div>
            </div>

            <div className="p-2 flex-1 space-y-2 overflow-y-auto max-h-60 bg-white rounded-b-xl">
                {clients.length > 0 ? (
                    clients.map(client => <DraggableClient key={client.id} client={client} />)
                ) : (
                    <div className="text-[11px] text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">
                        건설사를 드래그하여 배정하세요.
                    </div>
                )}
            </div>
        </div>
    );
};

interface DroppableUnassignedProps {
    clients: Company[];
    searchTerm: string;
    onSearchChange: (term: string) => void;
}

const DroppableUnassigned: React.FC<DroppableUnassignedProps> = ({ clients, searchTerm, onSearchChange }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'unassigned',
        data: { type: 'unassigned' },
    });

    const filtered = useMemo(
        () =>
            clients.filter(client => {
                if (!searchTerm) return true;
                const lower = searchTerm.toLowerCase();
                return (
                    client.name.toLowerCase().includes(lower) ||
                    (client.code || '').toLowerCase().includes(lower)
                );
            }),
        [clients, searchTerm]
    );

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-220px)]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-3">
                    <FontAwesomeIcon icon={faBuilding} className="text-slate-500" />
                    미배정 건설사
                    <span className="ml-auto bg-slate-200 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                        {clients.length}개
                    </span>
                </h3>
                <div className="relative">
                    <FontAwesomeIcon
                        icon={faSearch}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
                    />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="건설사 이름/코드 검색..."
                        className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>

            <div
                ref={setNodeRef}
                className={`flex-1 overflow-y-auto p-3 space-y-2 transition-colors ${
                    isOver ? 'bg-slate-50' : 'bg-white'
                }`}
            >
                {filtered.length === 0 ? (
                    <div className="text-[11px] text-slate-400 text-center py-8">
                        {searchTerm ? '검색 결과가 없습니다.' : '미배정 건설사가 없습니다.'}
                    </div>
                ) : (
                    filtered.map(client => <DraggableClient key={client.id} client={client} />)
                )}
            </div>
        </div>
    );
};

const ConstructorClientAssignmentPage: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [assignments, setAssignments] = useState<ConstructorAssignmentState>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeClientId, setActiveClientId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                setLoading(true);
                const data = await companyService.getCompanies();
                setCompanies(data);
            } catch (error) {
                console.error('Failed to fetch companies for assignment', error);
                alert('회사 정보를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        fetchCompanies();
    }, []);

    const constructors = useMemo(
        () => companies.filter(c => c.type === '시공사'),
        [companies]
    );

    const clients = useMemo(
        () => companies.filter(c => c.type === '건설사'),
        [companies]
    );

    // Initialize assignment state whenever companies change
    useEffect(() => {
        const initial: ConstructorAssignmentState = {};
        constructors.forEach(constructorCompany => {
            if (!constructorCompany.id) return;
            initial[constructorCompany.id] = constructorCompany.assignedClientCompanyIds || [];
        });
        setAssignments(initial);
    }, [constructors]);

    const allAssignedClientIds = useMemo(() => {
        const set = new Set<string>();
        Object.values(assignments).forEach(list => {
            list.forEach(id => set.add(id));
        });
        return set;
    }, [assignments]);

    const unassignedClients = useMemo(
        () => clients.filter(c => c.id && !allAssignedClientIds.has(c.id)),
        [clients, allAssignedClientIds]
    );

    const getAssignedClientsForConstructor = (constructorId: string): Company[] => {
        const ids = assignments[constructorId] || [];
        if (ids.length === 0) return [];
        return clients.filter(client => client.id && ids.includes(client.id));
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveClientId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveClientId(null);

        if (!over) return;

        const clientId = active.id as string;
        const overId = over.id as string;

        if (!clientId) return;

        if (overId === 'unassigned') {
            setAssignments(prev => {
                const next: ConstructorAssignmentState = {};
                Object.entries(prev).forEach(([cid, list]) => {
                    next[cid] = list.filter(id => id !== clientId);
                });
                return next;
            });
            return;
        }

        if (overId.startsWith('constructor-')) {
            const targetConstructorId = overId.replace('constructor-', '');
            setAssignments(prev => {
                const next: ConstructorAssignmentState = {};
                Object.entries(prev).forEach(([cid, list]) => {
                    next[cid] = list.filter(id => id !== clientId);
                });
                if (!next[targetConstructorId]) {
                    next[targetConstructorId] = [];
                }
                if (!next[targetConstructorId].includes(clientId)) {
                    next[targetConstructorId].push(clientId);
                }
                return next;
            });
        }
    };

    const handleSaveAssignments = async () => {
        try {
            setSaving(true);

            const updates = constructors.map(async (constructorCompany) => {
                if (!constructorCompany.id) return;
                const clientIds = assignments[constructorCompany.id] || [];
                await companyService.updateCompany(constructorCompany.id, {
                    assignedClientCompanyIds: clientIds,
                });
            });

            await Promise.all(updates);
            alert('시공사-건설사 배정이 저장되었습니다.');

            // Reload companies to sync state
            const data = await companyService.getCompanies();
            setCompanies(data);
        } catch (error) {
            console.error('Failed to save constructor-client assignments', error);
            alert('배정 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const activeClient = activeClientId
        ? clients.find(c => c.id === activeClientId)
        : undefined;

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50 max-w-[1800px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faLink} className="text-indigo-600" />
                        <span>시공사-건설사 회사 배정</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        왼쪽의 건설사를 오른쪽 시공사 카드로 드래그하여 배정하거나, 카드 밖으로 빼서 미배정 상태로 만들 수 있습니다.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm text-sm font-medium"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        뒤로 가기
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveAssignments}
                        disabled={saving || loading}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {saving ? '저장 중...' : '배정 저장'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                    회사 데이터를 불러오는 중...
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                        {/* Left: Unassigned Clients */}
                        <div className="w-full lg:w-80 flex-shrink-0">
                            <DroppableUnassigned
                                clients={unassignedClients}
                                searchTerm={searchTerm}
                                onSearchChange={setSearchTerm}
                            />
                        </div>

                        {/* Right: Constructors */}
                        <div className="flex-1 flex flex-col">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    시공사 목록 ({constructors.length}개)
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                                {constructors.map(constructorCompany => (
                                    <DroppableConstructor
                                        key={constructorCompany.id}
                                        constructorCompany={constructorCompany}
                                        clients={getAssignedClientsForConstructor(constructorCompany.id!)}
                                    />
                                ))}
                                {constructors.length === 0 && (
                                    <div className="col-span-full text-center text-slate-400 text-sm py-10">
                                        시공사로 등록된 회사가 없습니다. 회사 등록 관리에서 시공사 회사를 먼저 추가해 주세요.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DragOverlay>
                        {activeClient ? (
                            <DraggableClient client={activeClient} isOverlay />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}
        </div>
    );
};

export default ConstructorClientAssignmentPage;
