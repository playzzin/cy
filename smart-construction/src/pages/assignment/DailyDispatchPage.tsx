import React, { useState, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    useDroppable,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faTruck, faUser, faSearch, faSave, faCopy, faHardHat, faList, faThLarge, faTimes } from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { dispatchService, DispatchAssignment } from '../../services/dispatchService';

// --- Types ---
type DraggableType = 'worker' | 'vehicle';

interface DraggableItemData {
    id: string;
    type: DraggableType;
    data: any; // Worker or Vehicle object
    origin: 'sidebar' | 'site';
    siteId?: string;
}

// --- Components ---

// 1. Worker Chip (Compact for List View)
const WorkerChip = ({ worker, isOverlay = false, onDelete }: { worker: Worker, isOverlay?: boolean, onDelete?: () => void }) => {
    // Color Coding Logic based on salaryModel
    let bgColor = 'bg-white';
    let borderColor = 'border-slate-200';
    let textColor = 'text-slate-800';
    let salaryBadge = '';
    let salaryBadgeColor = '';

    // Determine salaryModel display
    const salaryModel = worker.salaryModel || (worker.teamType === '지원팀' ? '지원팀' : worker.teamType === '용역팀' ? '용역팀' : '일급제');

    if (salaryModel === '월급제') {
        bgColor = 'bg-purple-50';
        borderColor = 'border-purple-200';
        textColor = 'text-purple-700';
        salaryBadge = '월';
        salaryBadgeColor = 'bg-purple-500 text-white';
    } else if (salaryModel === '지원팀') {
        bgColor = 'bg-green-50';
        borderColor = 'border-green-200';
        textColor = 'text-green-700';
        salaryBadge = '지';
        salaryBadgeColor = 'bg-green-500 text-white';
    } else if (salaryModel === '용역팀') {
        bgColor = 'bg-orange-50';
        borderColor = 'border-orange-200';
        textColor = 'text-orange-700';
        salaryBadge = '용';
        salaryBadgeColor = 'bg-orange-500 text-white';
    } else { // 일급제 (default)
        bgColor = 'bg-blue-50';
        borderColor = 'border-blue-200';
        textColor = 'text-blue-700';
        salaryBadge = '일';
        salaryBadgeColor = 'bg-blue-500 text-white';
    }

    return (
        <div className={`px-2 py-1 rounded shadow-sm border ${bgColor} ${borderColor} ${textColor} text-xs font-bold flex items-center gap-2 cursor-grab hover:shadow-md transition-all select-none whitespace-nowrap`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${salaryBadgeColor}`}>
                {salaryBadge}
            </span>
            <span>{worker.name}</span>
            {onDelete && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-400 hover:text-red-500 ml-1">
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            )}
        </div>
    );
};

// 2. Sortable Item Wrapper
const SortableItem = ({ id, data, type, origin, siteId, onDelete }: DraggableItemData & { onDelete?: () => void }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: id,
        data: { type, data, origin, siteId }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="inline-block mr-1 mb-1">
            {type === 'worker' ? (
                <WorkerChip worker={data} onDelete={onDelete} />
            ) : (
                <div className="px-2 py-1 bg-slate-100 rounded border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-grab">
                    <FontAwesomeIcon icon={faTruck} className="text-slate-500" />
                    {data.number}
                </div>
            )}
        </div>
    );
};

// 3. Site Row (List View Item)
const SiteRow = ({ site, workers, vehicles, onRemoveWorker }: { site: Site, workers: Worker[], vehicles: any[], onRemoveWorker: (workerId: string) => void }) => {
    const { setNodeRef } = useDroppable({
        id: site.id!,
        data: { type: 'site', site }
    });

    // Find Team Leader
    const teamLeader = workers.find(w => w.role === '팀장');

    return (
        <tr className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
            {/* Site Info */}
            <td className="p-3 align-top w-64">
                <div className="font-bold text-slate-800">{site.name}</div>
                <div className="text-xs text-slate-500 mt-1">{site.address || '-'}</div>
            </td>

            {/* Team Leader */}
            <td className="p-3 align-top w-32">
                {teamLeader ? (
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">
                            팀
                        </span>
                        {teamLeader.name}
                    </div>
                ) : (
                    <span className="text-xs text-slate-400">-</span>
                )}
            </td>

            {/* Assigned Workers (Droppable Area) */}
            <td ref={setNodeRef} className="p-3 align-top">
                <div className="min-h-[40px] p-2 rounded bg-slate-100/50 border border-slate-200 border-dashed flex flex-wrap gap-1">
                    <SortableContext items={[...workers.map(w => w.id!), ...vehicles.map(v => v.id)]} strategy={horizontalListSortingStrategy}>
                        {workers.map(w => (
                            <SortableItem
                                key={w.id!}
                                id={w.id!}
                                type="worker"
                                data={w}
                                origin="site"
                                siteId={site.id}
                                onDelete={() => onRemoveWorker(w.id!)}
                            />
                        ))}
                        {vehicles.map(v => (
                            <SortableItem
                                key={v.id!}
                                id={v.id!}
                                type="vehicle"
                                data={v}
                                origin="site"
                                siteId={site.id}
                                onDelete={() => onRemoveWorker(v.id!)} // Reuse remove handler for now or add specific one
                            />
                        ))}
                    </SortableContext>
                    {workers.length === 0 && vehicles.length === 0 && (
                        <span className="text-xs text-slate-400 italic self-center ml-2">인원/차량 배정 (드래그)</span>
                    )}
                </div>
            </td>

            {/* Count */}
            <td className="p-3 align-top w-20 text-center font-bold text-slate-600">
                {workers.length}명 / {vehicles.length}대
            </td>
        </tr>
    );
};

// --- Main Page ---
const DailyDispatchPage: React.FC = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [sites, setSites] = useState<Site[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [assignments, setAssignments] = useState<Record<string, { workers: Worker[], vehicles: any[] }>>({});
    const [unassignedWorkers, setUnassignedWorkers] = useState<Worker[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeItem, setActiveItem] = useState<any>(null);

    // Vehicle Support
    const [activeTab, setActiveTab] = useState<'worker' | 'vehicle'>('worker');
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [unassignedVehicles, setUnassignedVehicles] = useState<any[]>([]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        loadData();
    }, [date]);

    const loadData = async () => {
        // Dynamic import to avoid circular dependency issues if any, though not strictly needed here
        const vehicleModule = await import('../../services/vehicleService').catch(() => ({ vehicleService: { getVehicles: async () => [] } }));

        const [sitesData, workersData, vehiclesData] = await Promise.all([
            siteService.getSites(),
            manpowerService.getWorkers(),
            vehicleModule.vehicleService.getVehicles()
        ]);
        setSites(sitesData);
        setAllWorkers(workersData);
        setVehicles(vehiclesData);

        const dispatchData = await dispatchService.getDispatchByDate(date);

        const newAssignments: Record<string, { workers: Worker[], vehicles: any[] }> = {};
        const assignedWorkerIds = new Set<string>();
        const assignedVehicleIds = new Set<string>();

        if (dispatchData) {
            dispatchData.assignments.forEach(a => {
                const siteWorkers = workersData.filter(w => a.workerIds.includes(w.id!));
                const siteVehicles = vehiclesData.filter((v: any) => a.vehicleIds?.includes(v.id));

                siteWorkers.forEach(w => assignedWorkerIds.add(w.id!));
                siteVehicles.forEach((v: any) => assignedVehicleIds.add(v.id));

                newAssignments[a.siteId] = {
                    workers: siteWorkers,
                    vehicles: siteVehicles
                };
            });
        }

        sitesData.forEach(site => {
            if (!newAssignments[site.id!]) {
                newAssignments[site.id!] = { workers: [], vehicles: [] };
            }
        });

        setAssignments(newAssignments);
        setUnassignedWorkers(workersData.filter(w => !assignedWorkerIds.has(w.id!)));
        setUnassignedVehicles(vehiclesData.filter((v: any) => !assignedVehicleIds.has(v.id)));
    };

    const handleSave = async () => {
        const dispatchAssignments: DispatchAssignment[] = Object.entries(assignments).map(([siteId, data]) => ({
            siteId,
            siteName: sites.find(s => s.id === siteId)?.name || '',
            workerIds: data.workers.map(w => w.id!),
            vehicleIds: data.vehicles.map(v => v.id)
        })).filter(a => a.workerIds.length > 0 || a.vehicleIds.length > 0);

        await dispatchService.saveDispatch(date, dispatchAssignments);
        alert('저장되었습니다.');
    };

    const handleCopyPreviousDay = async () => {
        if (!window.confirm('전일(어제) 배정 내역을 불러오시겠습니까? 현재 작성 중인 내용은 덮어씌워집니다.')) return;

        const yesterday = new Date(date);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const prevData = await dispatchService.getDispatchByDate(yesterdayStr);
        if (!prevData) {
            alert('전일 배정 내역이 없습니다.');
            return;
        }

        // Apply previous data
        const newAssignments: Record<string, { workers: Worker[], vehicles: any[] }> = {};
        const assignedWorkerIds = new Set<string>();
        const assignedVehicleIds = new Set<string>();

        prevData.assignments.forEach(a => {
            const siteWorkers = allWorkers.filter(w => a.workerIds.includes(w.id!));
            const siteVehicles = vehicles.filter(v => a.vehicleIds?.includes(v.id));

            siteWorkers.forEach(w => assignedWorkerIds.add(w.id!));
            siteVehicles.forEach(v => assignedVehicleIds.add(v.id));

            newAssignments[a.siteId] = {
                workers: siteWorkers,
                vehicles: siteVehicles
            };
        });

        // Fill remaining sites
        sites.forEach(site => {
            if (!newAssignments[site.id!]) {
                newAssignments[site.id!] = { workers: [], vehicles: [] };
            }
        });

        setAssignments(newAssignments);
        setUnassignedWorkers(allWorkers.filter(w => !assignedWorkerIds.has(w.id!)));
        setUnassignedVehicles(vehicles.filter(v => !assignedVehicleIds.has(v.id)));
    };

    // --- Drag Handlers ---
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        setActiveItem(active.data.current?.data);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveItem(null);

        if (!over) return;

        const activeData = active.data.current as DraggableItemData;
        const overId = over.id as string;

        let targetContainerId = overId;
        if (over.data.current?.type === 'site') {
            targetContainerId = overId;
        } else if (over.data.current?.siteId) {
            targetContainerId = over.data.current.siteId;
        } else if (overId === 'sidebar-droppable' || over.data.current?.origin === 'sidebar') {
            targetContainerId = 'sidebar';
        }

        const sourceContainerId = activeData.origin === 'sidebar' ? 'sidebar' : activeData.siteId!;

        if (sourceContainerId === targetContainerId) return;

        if (activeData.type === 'worker') {
            const worker = activeData.data as Worker;

            // Remove from Source
            if (sourceContainerId === 'sidebar') {
                setUnassignedWorkers(prev => prev.filter(w => w.id !== worker.id));
            } else {
                setAssignments(prev => ({
                    ...prev,
                    [sourceContainerId]: {
                        ...prev[sourceContainerId],
                        workers: prev[sourceContainerId].workers.filter(w => w.id !== worker.id)
                    }
                }));
            }

            // Add to Target
            if (targetContainerId === 'sidebar') {
                setUnassignedWorkers(prev => [worker, ...prev]);
            } else {
                setAssignments(prev => ({
                    ...prev,
                    [targetContainerId]: {
                        ...prev[targetContainerId],
                        workers: [...prev[targetContainerId].workers, worker]
                    }
                }));
            }
        } else if (activeData.type === 'vehicle') {
            const vehicle = activeData.data;

            // Remove from Source
            if (sourceContainerId === 'sidebar') {
                setUnassignedVehicles(prev => prev.filter(v => v.id !== vehicle.id));
            } else {
                setAssignments(prev => ({
                    ...prev,
                    [sourceContainerId]: {
                        ...prev[sourceContainerId],
                        vehicles: prev[sourceContainerId].vehicles.filter(v => v.id !== vehicle.id)
                    }
                }));
            }

            // Add to Target
            if (targetContainerId === 'sidebar') {
                setUnassignedVehicles(prev => [vehicle, ...prev]);
            } else {
                setAssignments(prev => ({
                    ...prev,
                    [targetContainerId]: {
                        ...prev[targetContainerId],
                        vehicles: [...prev[targetContainerId].vehicles, vehicle]
                    }
                }));
            }
        }
    };

    const handleRemoveWorker = (siteId: string, itemId: string) => {
        // Try to find in workers first
        const worker = allWorkers.find(w => w.id === itemId);
        if (worker) {
            setAssignments(prev => ({
                ...prev,
                [siteId]: {
                    ...prev[siteId],
                    workers: prev[siteId].workers.filter(w => w.id !== itemId)
                }
            }));
            setUnassignedWorkers(prev => [worker, ...prev]);
            return;
        }

        // Try vehicles
        const vehicle = vehicles.find(v => v.id === itemId);
        if (vehicle) {
            setAssignments(prev => ({
                ...prev,
                [siteId]: {
                    ...prev[siteId],
                    vehicles: prev[siteId].vehicles.filter(v => v.id !== itemId)
                }
            }));
            setUnassignedVehicles(prev => [vehicle, ...prev]);
        }
    };

    const filteredUnassigned = unassignedWorkers.filter(w =>
        w.name.includes(searchTerm) || w.teamName?.includes(searchTerm)
    );
    const filteredVehicles = unassignedVehicles.filter(v => v.number.includes(searchTerm));

    return (
        <div className="flex h-full max-w-[1920px] mx-auto overflow-hidden bg-white">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                {/* Left Sidebar: Resources */}
                <div className="w-72 border-r border-slate-200 flex flex-col h-full shrink-0 z-10 bg-slate-50">
                    <div className="p-4 border-b border-slate-200 bg-white">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-lg text-slate-800">
                                {activeTab === 'worker' ? `대기 인원 (${filteredUnassigned.length})` : `대기 차량 (${filteredVehicles.length})`}
                            </h2>
                            <div className="flex bg-slate-100 rounded p-1">
                                <button
                                    onClick={() => setActiveTab('worker')}
                                    className={`px-2 py-1 rounded text-xs font-bold ${activeTab === 'worker' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                                >
                                    <FontAwesomeIcon icon={faUser} />
                                </button>
                                <button
                                    onClick={() => setActiveTab('vehicle')}
                                    className={`px-2 py-1 rounded text-xs font-bold ${activeTab === 'vehicle' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                                >
                                    <FontAwesomeIcon icon={faTruck} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-100 p-2 rounded border border-slate-200 mb-3">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-400" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full text-sm font-bold text-slate-700 bg-transparent focus:outline-none"
                            />
                        </div>

                        <div className="relative">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3">
                        <SortableContext items={activeTab === 'worker' ? filteredUnassigned.map(w => w.id!) : filteredVehicles.map(v => v.id!)} strategy={verticalListSortingStrategy}>
                            <div id="sidebar-droppable" className="min-h-[200px] flex flex-col gap-1">
                                {activeTab === 'worker' ? (
                                    filteredUnassigned.map(worker => (
                                        <div key={worker.id} className="w-full">
                                            <SortableItem
                                                id={worker.id!}
                                                type="worker"
                                                data={worker}
                                                origin="sidebar"
                                            />
                                        </div>
                                    ))
                                ) : (
                                    filteredVehicles.map(vehicle => (
                                        <div key={vehicle.id} className="w-full">
                                            <SortableItem
                                                id={vehicle.id!}
                                                type="vehicle"
                                                data={vehicle}
                                                origin="sidebar"
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </SortableContext>
                    </div>

                    <div className="p-4 border-t border-slate-200 bg-white space-y-2">
                        <button
                            onClick={handleCopyPreviousDay}
                            className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition flex items-center justify-center gap-2 text-sm"
                        >
                            <FontAwesomeIcon icon={faCopy} />
                            전일 복사
                        </button>
                        <button
                            onClick={handleSave}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            저장하기
                        </button>
                    </div>
                </div>

                {/* Main Content: List View */}
                <div className="flex-1 overflow-y-auto bg-white">
                    <div className="p-6">
                        <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <FontAwesomeIcon icon={faList} className="text-slate-600" />
                            일일 배차 현황 (목록형)
                        </h1>

                        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3 font-bold text-slate-600 text-sm w-64">현장 정보</th>
                                        <th className="p-3 font-bold text-slate-600 text-sm w-32">책임자</th>
                                        <th className="p-3 font-bold text-slate-600 text-sm">배정 인원 / 차량</th>
                                        <th className="p-3 font-bold text-slate-600 text-sm w-20 text-center">합계</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sites.map(site => (
                                        <SiteRow
                                            key={site.id}
                                            site={site}
                                            workers={assignments[site.id!]?.workers || []}
                                            vehicles={assignments[site.id!]?.vehicles || []}
                                            onRemoveWorker={(itemId) => handleRemoveWorker(site.id!, itemId)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Drag Overlay */}
                <DragOverlay>
                    {activeId && activeItem ? (
                        <div className="opacity-90 rotate-3 scale-105">
                            {activeItem.number ? (
                                <div className="px-2 py-1 bg-slate-100 rounded border border-slate-300 text-xs font-bold flex items-center gap-1">
                                    <FontAwesomeIcon icon={faTruck} className="text-slate-500" />
                                    {activeItem.number}
                                </div>
                            ) : (
                                <WorkerChip worker={activeItem} isOverlay />
                            )}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default DailyDispatchPage;
