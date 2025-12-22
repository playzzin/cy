import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserTie, faArrowLeft, faSave, faSearch, faUser, faBars, faGripVertical, faCircle } from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { positionService, Position } from '../../services/positionService';
import { UserRole } from '../../types/roles';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, DragStartEvent, useSensor, useSensors, PointerSensor, closestCenter, rectIntersection } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface PositionAssignment {
    workerId: string;
    workerName: string;
    currentRole: string;
    newRole: string;
    teamName: string;
    teamId: string;
    unitPrice: number;
    uid?: string;
}

// --- Components ---

// Worker Item (Draggable Source from Right Panel OR Member in Left Panel)
const DraggableWorker = ({
    assignment,
    color = 'gray',
    isOverlay = false,
    isCompact = false
}: {
    assignment: PositionAssignment,
    color?: string,
    isOverlay?: boolean,
    isCompact?: boolean
}) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: assignment.workerId,
        data: { assignment }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`
                bg-white border text-sm font-medium text-slate-700
                transition-all cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-indigo-300
                ${isCompact
                    ? `p-2 rounded border-l-4 border-l-${color}-500 border-slate-200 mb-2 flex justify-between items-center`
                    : 'p-3 rounded-lg border-slate-200 flex items-center gap-3 shadow-sm'
                }
                ${isOverlay ? 'shadow-xl scale-105 z-50 w-60 rotate-2' : ''}
            `}
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-${color}-100 text-${color}-600 text-xs font-bold flex-shrink-0`}>
                    {assignment.workerName.slice(0, 1)}
                </div>
                <div className="truncate">
                    <span className="font-semibold text-slate-800">{assignment.workerName}</span>
                    <span className="text-xs text-slate-400 ml-1">
                        {assignment.teamName ? `(${assignment.teamName})` : ''}
                    </span>
                </div>
            </div>

            {/* Show Badge if Changed */}
            <div className="flex items-center gap-1">
                {assignment.currentRole !== assignment.newRole && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        변경
                    </span>
                )}
                {!isCompact && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap bg-${color}-50 text-${color}-600 border border-${color}-100`}>
                        {assignment.newRole}
                    </span>
                )}
            </div>
        </div>
    );
};

// Position Drop Zone (Left Panel)
const PositionBox = ({ position, members }: { position: Position, members: PositionAssignment[] }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: position.name, // Accept drops based on Position Name
    });

    return (
        <div
            ref={setNodeRef}
            className={`
                flex flex-col rounded-xl border-2 transition-all h-full min-h-[120px] bg-slate-50
                ${isOver ? `border-${position.color || 'gray'}-500 bg-${position.color || 'gray'}-50 ring-2 ring-${position.color}-200` : `border-slate-200`}
            `}
        >
            {/* Header */}
            <div className={`p-3 border-b border-slate-200 bg-white rounded-t-xl flex justify-between items-center sticky top-0 z-10`}>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-${position.color || 'gray'}-500`}></div>
                    <span className="font-bold text-slate-800">{position.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full bg-${position.color || 'gray'}-100 text-${position.color || 'gray'}-700 font-bold`}>
                    {members.length}명
                </span>
            </div>

            {/* Members List */}
            <div className="p-2 flex-1 space-y-2 overflow-y-auto max-h-[300px]">
                {members.length > 0 ? (
                    members.map(member => (
                        <DraggableWorker
                            key={member.workerId}
                            assignment={member}
                            color={position.color}
                            isCompact={true}
                        />
                    ))
                ) : (
                    <div className="text-center py-8 text-xs text-slate-400 italic">
                        배정된 인원 없음
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Page ---

const PositionAssignmentPage: React.FC = () => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [assignments, setAssignments] = useState<PositionAssignment[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [workersData, teamsData, positionsData] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                positionService.getPositions()
            ]);
            setWorkers(workersData);
            setTeams(teamsData);

            // Auto-add "실장" if missing (One-time fix logic)
            let finalPositions = positionsData;
            if (!positionsData.find(p => p.name === '실장')) {
                const newPosId = await positionService.addPosition({
                    name: '실장',
                    rank: 1.5,
                    color: 'indigo',
                    description: '총괄 관리자',
                    isDefault: true,
                    systemRole: UserRole.ADMIN // Default system role for '실장'
                });
                finalPositions = await positionService.getPositions(); // Reload
            }

            setPositions(finalPositions);

            // Initialize assignments
            const initialAssignments = workersData.map(worker => ({
                workerId: worker.id || '',
                workerName: worker.name,
                currentRole: worker.rank || worker.role || '신규자', // Prefer rank, fallback to role
                newRole: worker.rank || worker.role || '신규자',
                teamName: worker.teamName || '',
                teamId: worker.teamId || '',
                unitPrice: worker.unitPrice || 0,
                uid: worker.uid // Store UID for sync
            }));
            setAssignments(initialAssignments);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over) {
            const workerId = active.id as string;
            // The droppable ID is the Position Name (e.g., '팀장', '작업반장')
            const targetRole = over.id as string;

            // Check if dropped on a valid position container
            if (positions.some(p => p.name === targetRole)) {
                setAssignments(prev => prev.map(a =>
                    a.workerId === workerId ? { ...a, newRole: targetRole } : a
                ));
            }
        }
        setActiveId(null);
    };

    const handleSaveAssignments = async () => {
        setLoading(true);
        let successCount = 0;
        let errorCount = 0;
        const changedAssignments = assignments.filter(a => a.currentRole !== a.newRole);

        try {
            // Import userService for sync
            const { userService } = await import('../../services/userService');
            const { doc, updateDoc } = await import('firebase/firestore');
            const { db } = await import('../../config/firebase');

            for (const assignment of changedAssignments) {
                try {
                    const worker = workers.find(w => w.id === assignment.workerId);
                    if (worker && worker.id) {
                        // 1. Update Worker Rank (Site Position)
                        await manpowerService.updateWorker(worker.id, {
                            ...worker,
                            rank: assignment.newRole, // Update Rank
                            // role: assignment.newRole // Optional: Keep role separate for permissions? Let's treat them distinct now.
                        });

                        // 2. Sync to User Position (if linked)
                        // Using assignment.uid or worker.uid
                        const targetUid = assignment.uid || worker.uid;
                        if (targetUid) {
                            const userRef = doc(db, 'users', targetUid);
                            await updateDoc(userRef, {
                                position: assignment.newRole
                            });
                        }

                        successCount++;
                    }
                } catch (error) {
                    errorCount++;
                    console.error("Error saving assignment:", error);
                }
            }

            if (successCount > 0) {
                alert(`저장 완료: ${successCount}건 성공 (프로필 직책 동기화 포함)`);
                await fetchData();
            } else if (errorCount === 0) {
                alert('변경된 내용이 없습니다.');
            }
        } catch (error) {
            console.error(error);
            alert('저장 중 오류 발생');
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredAssignments = assignments.filter(assignment => {
        const matchesSearch = assignment.workerName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTeam = !selectedTeam || assignment.teamName === selectedTeam;
        return matchesSearch && matchesTeam;
    });

    const activeAssignment = activeId ? assignments.find(a => a.workerId === activeId) : null;
    const activePositionColor = activeAssignment
        ? (positions.find(p => p.name === activeAssignment.newRole)?.color || 'gray')
        : 'gray';
    const changedCount = assignments.filter(a => a.currentRole !== a.newRole).length;

    return (
        <div className="p-6 h-[calc(100vh-64px)] flex flex-col bg-slate-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faUserTie} className="text-indigo-600" />
                        직책 배정 관리
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        오른쪽의 작업자를 왼쪽의 직책 박스로 드래그하여 배정하세요.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.history.back()}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm text-sm font-medium"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        뒤로 가기
                    </button>
                    <button
                        onClick={handleSaveAssignments}
                        disabled={loading || changedCount === 0}
                        className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-md disabled:opacity-50 disabled:bg-slate-400 text-sm"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {loading ? '저장 중...' : `변경사항 저장 (${changedCount})`}
                    </button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={rectIntersection} // Better for overlapping containers
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 overflow-hidden">

                    {/* Left Panel: Positions (Targets) */}
                    <div className="col-span-5 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
                        <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
                            직책 현황 ({positions.length})
                        </div>
                        {positions.map(position => {
                            const members = assignments.filter(a => a.newRole === position.name);
                            return (
                                <PositionBox
                                    key={position.id}
                                    position={position}
                                    members={members}
                                />
                            );
                        })}
                        {/* Fallback for Unassigned/Unknown Roles if needed, but '신규자' should cover it if in positions list */}
                    </div>

                    {/* Right Panel: Personnel (Source) */}
                    <div className="col-span-7 lg:col-span-8 xl:col-span-9 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                        {/* Filters */}
                        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
                            <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[150px] bg-white text-slate-700"
                            >
                                <option value="">전체 팀</option>
                                {teams.map(team => (
                                    <option key={team.id} value={team.name}>{team.name}</option>
                                ))}
                            </select>

                            <div className="relative flex-1 max-w-md">
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="작업자 검색..."
                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                />
                            </div>

                            <div className="ml-auto text-sm text-slate-500">
                                총 {filteredAssignments.length}명
                            </div>
                        </div>

                        {/* Grid of Workers */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {filteredAssignments.map(assignment => {
                                    // Find color for this worker's CURRENT assigned role
                                    const rolePos = positions.find(p => p.name === assignment.newRole);
                                    const color = rolePos ? rolePos.color : 'gray';

                                    return (
                                        <DraggableWorker
                                            key={assignment.workerId}
                                            assignment={assignment}
                                            color={color}
                                        />
                                    );
                                })}
                                {filteredAssignments.length === 0 && (
                                    <div className="col-span-full py-20 text-center text-slate-400">
                                        검색 결과가 없습니다.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                <DragOverlay>
                    {activeAssignment ? (
                        <DraggableWorker
                            assignment={activeAssignment}
                            color={activePositionColor}
                            isOverlay={true}
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default PositionAssignmentPage;
