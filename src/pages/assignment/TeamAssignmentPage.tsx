import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faUserGroup, faBuilding, faSave, faPlus, faSearch, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { companyService, Company } from '../../services/companyService';
import TeamForm from '../../components/manpower/TeamForm';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    DragStartEvent,
    DragEndEvent,
    useSensor,
    useSensors,
    PointerSensor,
    TouchSensor,
    closestCenter
} from '@dnd-kit/core';

interface TeamAssignmentData {
    teamId: string;
    teamName: string;
    assignedWorkers: string[];
}

// --- Draggable Worker Component ---
interface DraggableWorkerProps {
    worker: Worker;
    isOverlay?: boolean;
}

const DraggableWorker: React.FC<DraggableWorkerProps> = ({ worker, isOverlay }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: worker.id || '',
        data: { worker }
    });

    const style = {
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`
                flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm 
                ${isOverlay ? 'border-blue-500 shadow-lg scale-105 z-50' : 'border-gray-200 hover:border-blue-300'}
                transition-all duration-200
            `}
        >
            <div className="flex items-center gap-3">
                <div className="text-gray-400 cursor-grab active:cursor-grabbing">
                    <FontAwesomeIcon icon={faGripVertical} />
                </div>
                <div>
                    <div className="font-medium text-gray-800">{worker.name}</div>
                    <div className="text-xs text-gray-500">{worker.role}</div>
                </div>
            </div>
            <div className={`text-xs px-2 py-1 rounded-full ${worker.status === '재직' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                {worker.status}
            </div>
        </div>
    );
};

// --- Droppable Container Component (Team Card) ---
interface DroppableTeamProps {
    team: Team;
    assignedWorkers: Worker[];
    onRemoveWorker: (workerId: string) => void;
}

const DroppableTeam: React.FC<DroppableTeamProps> = ({ team, assignedWorkers, onRemoveWorker }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `team-${team.id}`,
        data: { type: 'team', teamId: team.id }
    });

    return (
        <div
            ref={setNodeRef}
            className={`
                bg-white rounded-xl border-2 transition-colors duration-200 flex flex-col h-full
                ${isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
            `}
        >
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faUserGroup} className="text-blue-600" />
                        {team.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{team.type}</p>
                </div>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {assignedWorkers.length}명
                </span>
            </div>

            {/* Worker List */}
            <div className="p-4 flex-1 min-h-[150px] space-y-2">
                {assignedWorkers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg p-4">
                        <p>작업자를 드래그하여 배정하세요</p>
                    </div>
                ) : (
                    assignedWorkers.map(worker => (
                        <DraggableWorker key={worker.id} worker={worker} />
                    ))
                )}
            </div>
        </div>
    );
};

// --- Droppable Unassigned Area ---
interface DroppableUnassignedProps {
    workers: Worker[];
    searchTerm: string;
    onSearchChange: (term: string) => void;
}

const DroppableUnassigned: React.FC<DroppableUnassignedProps> = ({ workers, searchTerm, onSearchChange }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'unassigned',
        data: { type: 'unassigned' }
    });

    const filteredWorkers = workers.filter(w =>
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-200px)] sticky top-6">
            <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                    <FontAwesomeIcon icon={faUsers} className="text-gray-600" />
                    미배정 작업자
                    <span className="ml-auto bg-gray-200 text-gray-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                        {workers.length}명
                    </span>
                </h3>
                <div className="relative">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="이름 검색..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            <div
                ref={setNodeRef}
                className={`flex-1 overflow-y-auto p-4 space-y-2 transition-colors ${isOver ? 'bg-gray-100' : ''}`}
            >
                {filteredWorkers.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm py-8">
                        {searchTerm ? '검색 결과가 없습니다.' : '미배정 작업자가 없습니다.'}
                    </p>
                ) : (
                    filteredWorkers.map(worker => (
                        <DraggableWorker key={worker.id} worker={worker} />
                    ))
                )}
            </div>
        </div>
    );
};

const TeamAssignmentPage: React.FC = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]); // All workers loaded from DB
    const [companies, setCompanies] = useState<Company[]>([]);
    const [assignments, setAssignments] = useState<TeamAssignmentData[]>([]); // Current assignment state
    const [loading, setLoading] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isTeamRegistrationOpen, setIsTeamRegistrationOpen] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null); // For DragOverlay

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor)
    );

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [teamsData, workersData, companiesData] = await Promise.all([
                teamService.getTeams(),
                manpowerService.getWorkers(),
                companyService.getCompanies()
            ]);
            setTeams(teamsData);
            setAllWorkers(workersData);
            setCompanies(companiesData);

            // Initialize assignments from DB data
            const initialAssignments = teamsData.map(team => ({
                teamId: team.id || '',
                teamName: team.name,
                assignedWorkers: team.assignedWorkers || []
            }));
            setAssignments(initialAssignments);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    // Helper to get workers currently assigned to a specific team
    const getAssignedWorkers = (teamId: string) => {
        const assignment = assignments.find(a => a.teamId === teamId);
        if (!assignment) return [];
        return allWorkers.filter(w => assignment.assignedWorkers.includes(w.id || ''));
    };

    // Helper to get workers NOT assigned to any team (in the current UI state)
    const getUnassignedWorkers = () => {
        const allAssignedIds = assignments.flatMap(a => a.assignedWorkers);
        return allWorkers.filter(w => !allAssignedIds.includes(w.id || ''));
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const workerId = active.id as string;
        const overId = over.id as string;

        // 1. Dropped in Unassigned Area
        if (overId === 'unassigned') {
            setAssignments(prev => prev.map(a => ({
                ...a,
                assignedWorkers: a.assignedWorkers.filter(id => id !== workerId)
            })));
            return;
        }

        // 2. Dropped in a Team
        if (overId.startsWith('team-')) {
            const targetTeamId = overId.replace('team-', '');

            setAssignments(prev => {
                // Remove from any other team first
                const cleaned = prev.map(a => ({
                    ...a,
                    assignedWorkers: a.assignedWorkers.filter(id => id !== workerId)
                }));

                // Add to target team
                return cleaned.map(a => {
                    if (a.teamId === targetTeamId) {
                        return {
                            ...a,
                            assignedWorkers: [...a.assignedWorkers, workerId]
                        };
                    }
                    return a;
                });
            });
        }
    };

    const handleSaveAssignments = async () => {
        setLoading(true);
        let successCount = 0;
        let errorCount = 0;

        try {
            // 1. Reset all workers to unassigned first (optional, but safer for consistency)
            // Actually, we can just update workers based on current assignments.
            // But to be safe and handle "unassigned" correctly, we should iterate all workers.

            // Strategy:
            // - For each team, update team.assignedWorkers and team.memberCount.
            // - For each worker, update worker.teamId and worker.teamName.

            // Create a map of workerId -> teamId for O(1) lookup
            const workerTeamMap = new Map<string, { id: string, name: string }>();
            assignments.forEach(a => {
                a.assignedWorkers.forEach(wid => {
                    workerTeamMap.set(wid, { id: a.teamId, name: a.teamName });
                });
            });

            // Update Workers
            const workerUpdates = allWorkers.map(async (worker) => {
                if (!worker.id) return;

                const assignedTeam = workerTeamMap.get(worker.id);
                const newTeamId = assignedTeam ? assignedTeam.id : '';
                const newTeamName = assignedTeam ? assignedTeam.name : '';

                // Only update if changed
                if (worker.teamId !== newTeamId || worker.teamName !== newTeamName) {
                    try {
                        await manpowerService.updateWorker(worker.id, {
                            ...worker,
                            teamId: newTeamId,
                            teamName: newTeamName
                        });
                        successCount++;
                    } catch (e) {
                        console.error(`Failed to update worker ${worker.name}`, e);
                        errorCount++;
                    }
                }
            });

            // Update Teams
            const teamUpdates = assignments.map(async (assignment) => {
                try {
                    await teamService.updateTeam(assignment.teamId, {
                        assignedWorkers: assignment.assignedWorkers,
                        memberCount: assignment.assignedWorkers.length
                    });
                } catch (e) {
                    console.error(`Failed to update team ${assignment.teamName}`, e);
                    errorCount++;
                }
            });

            await Promise.all([...workerUpdates, ...teamUpdates]);

            alert(`저장 완료!`);
            await fetchData(); // Refresh data
        } catch (error) {
            console.error("Save failed:", error);
            alert("저장에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const filteredTeams = teams.filter(team => {
        if (selectedCompanyId && team.companyId !== selectedCompanyId) return false;
        return true;
    });

    const activeWorker = activeId ? allWorkers.find(w => w.id === activeId) : null;

    return (
        <div className="p-6 max-w-[1800px] mx-auto">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                {/* Header & Controls */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faUserGroup} className="text-blue-600" />
                            팀 배정 관리
                        </h1>
                        <p className="text-gray-600 mt-1">드래그 앤 드롭으로 작업자를 팀에 배정하세요.</p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200">
                            <FontAwesomeIcon icon={faBuilding} className="text-gray-400" />
                            <select
                                value={selectedCompanyId}
                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                                className="border-none focus:ring-0 text-sm bg-transparent min-w-[150px]"
                            >
                                <option value="">전체 회사</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => setIsTeamRegistrationOpen(true)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            팀 등록
                        </button>

                        <button
                            onClick={handleSaveAssignments}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2 disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            {loading ? '저장 중...' : '변경사항 저장'}
                        </button>
                    </div>
                </div>

                {isTeamRegistrationOpen && (
                    <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <TeamForm
                            teams={teams}
                            workers={allWorkers}
                            companies={companies}
                            onSave={() => {
                                fetchData();
                                setIsTeamRegistrationOpen(false);
                            }}
                            onCancel={() => setIsTeamRegistrationOpen(false)}
                        />
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Panel: Unassigned Workers */}
                    <div className="w-full lg:w-80 flex-shrink-0">
                        <DroppableUnassigned
                            workers={getUnassignedWorkers()}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                        />
                    </div>

                    {/* Right Panel: Teams Grid */}
                    <div className="flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                            {filteredTeams.map(team => (
                                <DroppableTeam
                                    key={team.id}
                                    team={team}
                                    assignedWorkers={getAssignedWorkers(team.id || '')}
                                    onRemoveWorker={(workerId) => {
                                        // Helper to remove without drag
                                        setAssignments(prev => prev.map(a => {
                                            if (a.teamId === team.id) {
                                                return { ...a, assignedWorkers: a.assignedWorkers.filter(id => id !== workerId) };
                                            }
                                            return a;
                                        }));
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <DragOverlay>
                    {activeWorker ? (
                        <DraggableWorker worker={activeWorker} isOverlay />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default TeamAssignmentPage;
