import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { companyService, Company } from '../services/companyService';
import { teamService, Team } from '../services/teamService';
import { siteService, Site } from '../services/siteService';

interface MasterDataContextType {
    // 데이터
    companies: Company[];
    teams: Team[];
    sites: Site[];

    // 로딩 상태
    loading: boolean;

    // 새로고침 함수
    refreshCompanies: () => Promise<void>;
    refreshTeams: () => Promise<void>;
    refreshSites: () => Promise<void>;
    refreshAll: () => Promise<void>;

    // 필터된 데이터 (시공사/협력사만)
    validCompanies: Company[];
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

    // 전체 새로고침
    const refreshAll = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([
                refreshCompanies(),
                refreshTeams(),
                refreshSites()
            ]);
        } finally {
            setLoading(false);
        }
    }, [refreshCompanies, refreshTeams, refreshSites]);

    // 앱 시작 시 데이터 로드
    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    // 시공사/협력사만 필터링
    const validCompanies = companies.filter(
        c => c.type === '시공사' || c.type === '협력사'
    );

    const value = {
        companies,
        teams,
        sites,
        loading,
        refreshCompanies,
        refreshTeams,
        refreshSites,
        refreshAll,
        validCompanies
    };

    return (
        <MasterDataContext.Provider value={value}>
            {children}
        </MasterDataContext.Provider>
    );
}
