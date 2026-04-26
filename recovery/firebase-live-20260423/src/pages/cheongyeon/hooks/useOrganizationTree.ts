import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from '../../../utils/swal';
import { companyService } from '../../../services/companyService';
import { teamService } from '../../../services/teamService';
import { manpowerService } from '../../../services/manpowerService';

// Data Types
export type NodeType = 'company' | 'team' | 'worker';

export interface OrgNode {
    id: string;
    type: NodeType;
    name: string;
    parentId: string | null;
    children: OrgNode[];
    data?: any; // Original Data
    isExpanded?: boolean;
}

export interface DragItem {
    id: string;
    type: NodeType;
    parentId: string | null;
}

export const useOrganizationTree = () => {
    // Raw Data State
    const [companies, setCompanies] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [workers, setWorkers] = useState<any[]>([]);

    // Loading State
    const [loading, setLoading] = useState(true);

    // UI State
    const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

    // 1. Fetch Data from Services
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [companiesData, teamsData, workersData] = await Promise.all([
                companyService.getCompanies(),
                teamService.getTeams(),
                manpowerService.getWorkers()
            ]);

            setCompanies(companiesData);
            setTeams(teamsData);
            setWorkers(workersData);
        } catch (error) {
            console.error("Failed to load organization data:", error);
            // toast.error("조직도 데이터를 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        loadData();
    }, [loadData]);

    // 2. Build Tree Structure (Memoized)
    const treeData = useMemo(() => {
        const rootNodes: OrgNode[] = [];

        // Sort Companies: '시공사' first, then '협력사', then others
        const sortedCompanies = [...companies].sort((a, b) => {
            const getRank = (type: string) => {
                if (type === '시공사') return 0;
                if (type === '협력사') return 1;
                return 2;
            };
            const rankA = getRank(a.type);
            const rankB = getRank(b.type);
            if (rankA !== rankB) return rankA - rankB;
            return a.name.localeCompare(b.name);
        });

        // 1. Create Company Nodes (Root Level)
        const companyNodes: OrgNode[] = sortedCompanies.map(comp => ({
            id: comp.id,
            type: 'company',
            name: comp.name,
            parentId: null,
            children: [] as OrgNode[],
            data: comp,
            isExpanded: expandedNodeIds.has(comp.id)
        }));

        // 2. Create Team Nodes and Attach to Companies
        const teamNodes: OrgNode[] = [];
        const unassignedTeams: OrgNode[] = [];

        teams.forEach(team => {
            const node: OrgNode = {
                id: team.id,
                type: 'team',
                name: team.name,
                parentId: team.companyId || null,
                children: [] as OrgNode[],
                data: team,
                isExpanded: expandedNodeIds.has(team.id)
            };
            teamNodes.push(node);

            if (team.companyId) {
                const parent = companyNodes.find(c => c.id === team.companyId);
                if (parent) {
                    parent.children.push(node);
                } else {
                    unassignedTeams.push(node);
                }
            } else {
                unassignedTeams.push(node);
            }
        });

        // 3. Attach Workers to Teams
        const unassignedWorkers: OrgNode[] = [];

        workers.forEach(worker => {
            const isActive = worker.status !== '퇴사' && worker.status !== 'inactive' && worker.status !== '출입금지';
            if (!isActive) return; // Filter out inactive

            const node: OrgNode = {
                id: worker.id,
                type: 'worker',
                name: worker.name,
                parentId: worker.teamId || null,
                children: [] as OrgNode[],
                data: worker,
                isExpanded: false
            };

            if (worker.teamId) {
                const parent = teamNodes.find(t => t.id === worker.teamId);
                if (parent) {
                    parent.children.push(node);
                } else {
                    unassignedWorkers.push(node);
                }
            } else {
                unassignedWorkers.push(node);
            }
        });

        // 4. Final Assembly
        // Add assigned companies to root
        rootNodes.push(...companyNodes);

        // Add unassigned teams group if any
        if (unassignedTeams.length > 0) {
            rootNodes.push({
                id: 'unassigned-teams',
                type: 'company',
                name: '미배정 팀',
                parentId: null,
                children: unassignedTeams,
                isExpanded: expandedNodeIds.has('unassigned-teams')
            });
        }

        // Add unassigned workers group if any
        if (unassignedWorkers.length > 0) {
            rootNodes.push({
                id: 'unassigned-workers',
                type: 'team',
                name: '미배정 인원',
                parentId: null,
                children: unassignedWorkers,
                isExpanded: expandedNodeIds.has('unassigned-workers')
            });
        }

        return rootNodes;
    }, [companies, teams, workers, expandedNodeIds]);

    // 3. Actions
    const toggleNode = useCallback((nodeId: string) => {
        setExpandedNodeIds(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        const allIds = new Set<string>();
        companies.forEach(c => c.id && allIds.add(c.id));
        teams.forEach(t => t.id && allIds.add(t.id));
        allIds.add('unassigned-teams');
        allIds.add('unassigned-workers');
        setExpandedNodeIds(allIds);
    }, [companies, teams]);

    const collapseAll = useCallback(() => {
        setExpandedNodeIds(new Set());
    }, []);

    const moveWorker = async (workerId: string, targetTeamId: string | null) => {
        try {
            await manpowerService.updateWorker(workerId, {
                teamId: targetTeamId || undefined
            });
            await loadData();
            toast.success('이동 완료');
        } catch (error) {
            console.error("Move failed:", error);
            toast.error('이동 실패');
        }
    };

    const refresh = useCallback(() => {
        loadData();
    }, [loadData]);

    return {
        treeData,
        loading,
        toggleNode,
        expandAll,
        collapseAll,
        moveWorker,
        refresh
    };
};
