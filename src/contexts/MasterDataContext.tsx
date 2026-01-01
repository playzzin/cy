import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { companyService, Company } from '../services/companyService';
import { teamService, Team } from '../services/teamService';
import { siteService, Site } from '../services/siteService';
import { positionService, Position } from '../services/positionService';

export interface PositionStyle {
    color: string;
    icon: string;
}

interface MasterDataContextType {
    // 데이터
    companies: Company[];
    teams: Team[];
    sites: Site[];
    positions: Position[];

    // 로딩 상태
    loading: boolean;

    // 새로고침 함수
    refreshCompanies: () => Promise<void>;
    refreshTeams: () => Promise<void>;
    refreshSites: () => Promise<void>;
    refreshPositions: () => Promise<void>;
    refreshAll: () => Promise<void>;

    // 필터된 데이터 (시공사/협력사만)
    validCompanies: Company[];

    // 헬퍼 함수
    resolvePositionStyle: (roleName: string) => PositionStyle;
}

const MasterDataContext = createContext<MasterDataContextType | null>(null);

export function useMasterData() {
    const context = useContext(MasterDataContext);
    if (!context) {
        throw new Error('useMasterData must be used within a MasterDataProvider');
    }
    return context;
}

export function MasterDataProvider({ children }: { children: React.ReactNode }) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);

    // 회사 로드
    const refreshCompanies = useCallback(async () => {
        try {
            const data = await companyService.getCompanies();
            setCompanies(data);
        } catch (error) {
            console.error('회사 데이터 로드 실패:', error);
        }
    }, []);

    // 팀 로드
    const refreshTeams = useCallback(async () => {
        try {
            const data = await teamService.getTeams();
            setTeams(data);
        } catch (error) {
            console.error('팀 데이터 로드 실패:', error);
        }
    }, []);

    // 현장 로드
    const refreshSites = useCallback(async () => {
        try {
            const data = await siteService.getSites();
            setSites(data);
        } catch (error) {
            console.error('현장 데이터 로드 실패:', error);
        }
    }, []);

    // 직책 로드
    const refreshPositions = useCallback(async () => {
        try {
            const data = await positionService.getPositions();
            setPositions(data);
        } catch (error) {
            console.error('직책 데이터 로드 실패:', error);
        }
    }, []);

    // 전체 새로고침
    const refreshAll = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([
                refreshCompanies(),
                refreshTeams(),
                refreshSites(),
                refreshPositions()
            ]);
        } finally {
            setLoading(false);
        }
    }, [refreshCompanies, refreshTeams, refreshSites, refreshPositions]);

    // 앱 시작 시 데이터 로드
    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    // 시공사/협력사만 필터링
    const validCompanies = companies.filter(
        c => c.type === '시공사' || c.type === '협력사'
    );

    // 직책 스타일 해결 Helper
    const resolvePositionStyle = useCallback((roleName: string): PositionStyle => {
        const found = positions.find(p => p.name === roleName);
        if (found) {
            return {
                color: found.color,
                icon: found.iconKey || found.icon || 'fa-user'
            };
        }
        // Fallback for unknown roles
        return { color: 'gray', icon: 'fa-user' };
    }, [positions]);

    const value = {
        companies,
        teams,
        sites,
        positions,
        loading,
        refreshCompanies,
        refreshTeams,
        refreshSites,
        refreshPositions,
        refreshAll,
        validCompanies,
        resolvePositionStyle
    };

    return (
        <MasterDataContext.Provider value={value}>
            {children}
        </MasterDataContext.Provider>
    );
}
