import { useCallback, useEffect, useRef, useState } from 'react';
import { companyService } from '../../../services/companyService';
import { teamService } from '../../../services/teamService';
import { manpowerService } from '../../../services/manpowerService';
import { siteService } from '../../../services/siteService';
import { companyFirestoreService } from '../../../services/companyFirestoreService';
import { teamFirestoreService } from '../../../services/teamFirestoreService';
import { siteFirestoreService } from '../../../services/siteFirestoreService';
import type { OrganizationData } from '../organizationModel';

export const useOrganizationTree = () => {
    const [data, setData] = useState<OrganizationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [siteError, setSiteError] = useState('');
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const sequence = useRef(0);
    const mounted = useRef(false);
    const previous = useRef<OrganizationData | null>(null);

    const loadData = useCallback(async (force = false) => {
        const request = ++sequence.current;
        setLoading(true);
        setError('');
        const [companies, teams, workers, sites] = await Promise.allSettled([
            force ? companyFirestoreService.getCompanies() : companyService.getCompanies(),
            force ? teamFirestoreService.getTeams() : teamService.getTeams(),
            manpowerService.getWorkers(force),
            force ? siteFirestoreService.getSites() : siteService.getSites(),
        ]);
        if (!mounted.current || request !== sequence.current) return;
        if (companies.status === 'rejected' || teams.status === 'rejected' || workers.status === 'rejected') {
            setError(previous.current
                ? '조직 정보를 갱신하지 못했습니다. 마지막으로 조회한 정보를 표시합니다.'
                : '조직 정보를 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.');
        } else {
            const next: OrganizationData = {
                companies: companies.value, teams: teams.value, workers: workers.value,
                sites: sites.status === 'fulfilled' ? sites.value : previous.current?.sites || [],
            };
            previous.current = next;
            setData(next);
            setSiteError(sites.status === 'rejected' ? '현장 정보를 불러오지 못했습니다. 현장 연결과 배정 인원은 다시 조회한 뒤 확인해 주세요.' : '');
            setUpdatedAt(new Date());
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        mounted.current = true;
        void loadData();
        return () => { mounted.current = false; sequence.current++; };
    }, [loadData]);

    const refresh = useCallback(() => { void loadData(true); }, [loadData]);
    return { data, loading, error, siteError, updatedAt, refresh };
};
