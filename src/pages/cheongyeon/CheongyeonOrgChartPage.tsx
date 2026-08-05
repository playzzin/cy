import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faBolt,
    faBuilding,
    faCircle,
    faCrosshairs,
    faHelmetSafety,
    faLocationDot,
    faMagnifyingGlass,
    faSitemap,
    faUserGroup,
    faUserTie,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { OrgNode, useOrganizationTree } from './hooks/useOrganizationTree';
import { siteService, type Site } from '../../services/siteService';
import './CheongyeonOrgChartPage.css';

type DetailFocus = 'worker' | 'site';

type TeamSummary = {
    id: string;
    name: string;
    leader?: OrgNode;
    leaderName: string;
    leaderRole: string;
    members: OrgNode[];
    sites: string[];
    status: string;
};

type ConnectorPath = {
    id: string;
    d: string;
};

const normalize = (value: unknown): string => String(value ?? '').trim();

const formatNumber = (value: number): string => Number(value || 0).toLocaleString('ko-KR');

const isCheongyeonName = (name: unknown): boolean => {
    const text = normalize(name).toLowerCase();
    return text.includes('청연') || text.includes('cheongyeon') || text.includes('chungyeon');
};

const getWorkerRole = (worker?: OrgNode): string => (
    normalize(worker?.data?.role)
    || normalize(worker?.data?.position)
    || normalize(worker?.data?.rank)
    || '직무 미등록'
);

const getWorkerImage = (worker?: OrgNode): string => (
    normalize(worker?.data?.profileImageUrl)
    || normalize(worker?.data?.photoURL)
    || normalize(worker?.data?.imageUrl)
    || normalize(worker?.data?.avatarUrl)
);

const isForeman = (worker: OrgNode): boolean => /반장|foreman/i.test(getWorkerRole(worker));

const getTeamLeader = (team: OrgNode, members: OrgNode[]): OrgNode | undefined => {
    const configuredLeaderId = normalize(team.data?.leaderId);
    const configuredLeaderName = normalize(team.data?.leaderName);

    return members.find((member) => normalize(member.id) === configuredLeaderId)
        || members.find((member) => normalize(member.name) === configuredLeaderName)
        || members.find((member) => /팀장|대표|부장|소장|리더|leader|manager/i.test(getWorkerRole(member)))
        || members[0];
};

const toTeamSummary = (team: OrgNode, siteRows: Site[]): TeamSummary => {
    const members = team.children
        .filter((child) => child.type === 'worker')
        .sort((left, right) => {
            const priority = Number(isForeman(right)) - Number(isForeman(left));
            return priority || left.name.localeCompare(right.name, 'ko');
        });
    const leader = getTeamLeader(team, members);
    const registeredSites = Array.isArray(team.data?.siteNames) ? team.data.siteNames : [];
    const linkedSites = siteRows
        .filter((site) => (
            normalize(site.responsibleTeamId) === normalize(team.id)
            || normalize(site.responsibleTeamName) === normalize(team.name)
        ))
        .map((site) => normalize(site.name));
    const sites = Array.from(new Set([
        normalize(team.data?.assignedSiteName),
        ...registeredSites.map(normalize),
        ...linkedSites,
        ...members.map((member) => normalize(member.data?.siteName)),
    ].filter(Boolean)));

    return {
        id: team.id,
        name: normalize(team.name) || '이름 없는 팀',
        leader,
        leaderName: normalize(team.data?.leaderName) || leader?.name || '리더 미정',
        leaderRole: getWorkerRole(leader),
        members,
        sites,
        status: normalize(team.data?.status) || 'active',
    };
};

const PersonAvatar: React.FC<{ person?: OrgNode; className?: string }> = ({ person, className = '' }) => {
    const image = getWorkerImage(person);
    const name = normalize(person?.name) || '?';

    if (image) {
        return <img src={image} alt={`${name} 프로필`} className={`object-cover ${className}`} />;
    }

    return (
        <span className={`org-avatar-fallback ${className}`} aria-label={`${name} 프로필`}>
            {name.slice(0, 1)}
        </span>
    );
};

const CheongyeonOrgChartPage: React.FC = () => {
    const { treeData, loading } = useOrganizationTree();
    const [query, setQuery] = useState('');
    const [siteRows, setSiteRows] = useState<Site[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
    const [selectedSiteName, setSelectedSiteName] = useState('');
    const [detailFocus, setDetailFocus] = useState<DetailFocus>('worker');
    const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([]);
    const networkRef = useRef<HTMLDivElement | null>(null);
    const commandNodeRef = useRef<HTMLDivElement | null>(null);
    const teamNodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    useEffect(() => {
        document.body.classList.add('cheongyeon-org-codeit-theme');
        return () => document.body.classList.remove('cheongyeon-org-codeit-theme');
    }, []);

    useEffect(() => {
        let mounted = true;

        siteService.getSites()
            .then((rows) => {
                if (mounted) setSiteRows(rows);
            })
            .catch((error) => {
                console.error('[CheongyeonOrgChartPage] Failed to load site data:', error);
            });

        return () => { mounted = false; };
    }, []);

    const companies = useMemo(
        () => treeData.filter((node) => node.type === 'company'),
        [treeData]
    );

    const primaryCompany = useMemo(
        () => companies.find((company) => isCheongyeonName(company.name)) || companies[0] || null,
        [companies]
    );

    const teamSummaries = useMemo(() => {
        const primaryTeams = primaryCompany?.children.filter((node) => node.type === 'team') || [];
        const sourceTeams = primaryTeams.length > 0
            ? primaryTeams
            : companies.flatMap((company) => company.children.filter((node) => node.type === 'team'));

        return sourceTeams
            .map((team) => toTeamSummary(team, siteRows))
            .sort((left, right) => left.name.localeCompare(right.name, 'ko'));
    }, [companies, primaryCompany, siteRows]);

    const visibleTeams = useMemo(() => {
        const searchTerm = query.trim().toLowerCase();
        if (!searchTerm) return teamSummaries;

        return teamSummaries.filter((team) => [
            team.name,
            team.leaderName,
            team.leaderRole,
            ...team.sites,
            ...team.members.map((member) => `${member.name} ${getWorkerRole(member)}`),
        ].join(' ').toLowerCase().includes(searchTerm));
    }, [query, teamSummaries]);

    const selectedTeam = useMemo(
        () => teamSummaries.find((team) => team.id === selectedTeamId) || null,
        [selectedTeamId, teamSummaries]
    );

    const selectedWorker = useMemo(() => {
        if (!selectedTeam) return null;
        return selectedTeam.members.find((member) => member.id === selectedWorkerId)
            || selectedTeam.leader
            || selectedTeam.members[0]
            || null;
    }, [selectedTeam, selectedWorkerId]);

    const selectedSite = useMemo(() => {
        if (!selectedTeam) return '';
        return selectedTeam.sites.includes(selectedSiteName)
            ? selectedSiteName
            : selectedTeam.sites[0] || '';
    }, [selectedSiteName, selectedTeam]);

    const selectedSiteWorkers = useMemo(() => {
        if (!selectedTeam || !selectedSite) return [];
        return selectedTeam.members.filter((member) => normalize(member.data?.siteName) === selectedSite);
    }, [selectedSite, selectedTeam]);

    const selectedSiteInfo = useMemo(() => {
        if (!selectedTeam || !selectedSite) return null;
        return siteRows.find((site) => (
            normalize(site.name) === selectedSite
            && (
                normalize(site.responsibleTeamId) === selectedTeam.id
                || normalize(site.responsibleTeamName) === selectedTeam.name
            )
        )) || null;
    }, [selectedSite, selectedTeam, siteRows]);

    const totalMembers = useMemo(
        () => teamSummaries.reduce((sum, team) => sum + team.members.length, 0),
        [teamSummaries]
    );

    const totalSites = useMemo(
        () => new Set(teamSummaries.flatMap((team) => team.sites)).size,
        [teamSummaries]
    );

    const updateConnectors = useCallback(() => {
        const surface = networkRef.current;
        const commandNode = commandNodeRef.current;
        if (!surface || !commandNode) {
            setConnectorPaths([]);
            return;
        }

        const surfaceBounds = surface.getBoundingClientRect();
        const commandBounds = commandNode.getBoundingClientRect();
        const startX = commandBounds.left - surfaceBounds.left + (commandBounds.width / 2);
        const startY = commandBounds.bottom - surfaceBounds.top - 2;

        const nextPaths = visibleTeams.flatMap((team) => {
            const teamNode = teamNodeRefs.current[team.id];
            if (!teamNode) return [];

            const teamBounds = teamNode.getBoundingClientRect();
            const endX = teamBounds.left - surfaceBounds.left + (teamBounds.width / 2);
            const endY = teamBounds.top - surfaceBounds.top + 4;
            const controlY = startY + Math.max(42, (endY - startY) * 0.44);

            return [{
                id: team.id,
                d: `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`,
            }];
        });

        setConnectorPaths(nextPaths);
    }, [visibleTeams]);

    useLayoutEffect(() => {
        const frame = window.requestAnimationFrame(updateConnectors);
        const surface = networkRef.current;
        const resizeObserver = typeof ResizeObserver === 'undefined' || !surface
            ? null
            : new ResizeObserver(updateConnectors);

        if (surface) resizeObserver?.observe(surface);
        window.addEventListener('resize', updateConnectors);

        return () => {
            window.cancelAnimationFrame(frame);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateConnectors);
        };
    }, [updateConnectors]);

    const selectTeam = (team: TeamSummary) => {
        setSelectedTeamId(team.id);
        setSelectedWorkerId(team.leader?.id || team.members[0]?.id || null);
        setSelectedSiteName(team.sites[0] || '');
        setDetailFocus('worker');
    };

    if (loading) {
        return (
            <div className="cheongyeon-org-codeit-page org-loading-page">
                <div className="org-loading-mark"><FontAwesomeIcon icon={faSitemap} /></div>
                <p>ORGANIZATION NETWORK LOADING</p>
            </div>
        );
    }

    const companyName = normalize(primaryCompany?.name) || '청연ENG';

    return (
        <div className="cheongyeon-org-codeit-page">
            <main className="org-grid-background">
                <section className="org-network-hero">
                    <div className="org-shell">
                        <div className="org-hero-topline">
                            <span><FontAwesomeIcon icon={faBolt} /> LIVE ORGANIZATION</span>
                            <span className="org-hero-live-dot"><FontAwesomeIcon icon={faCircle} /> LIVE</span>
                        </div>
                        <div className="org-hero-heading-row">
                            <div>
                                <p className="org-hero-overline">CHUNG YEON ENG · FIELD COMMAND</p>
                                <h1>움직이는 조직을<br /><span>한눈에 연결합니다.</span></h1>
                                <p className="org-hero-description">
                                    팀을 선택하면 작업자와 담당 현장의 연결 정보를 바로 확인할 수 있습니다.
                                </p>
                            </div>
                            <div className="org-hero-kpis" aria-label="조직 현황">
                                <div><span>ACTIVE TEAMS</span><strong>{formatNumber(teamSummaries.length)}</strong></div>
                                <div><span>CONNECTED CREW</span><strong>{formatNumber(totalMembers)}</strong></div>
                                <div><span>FIELD SITES</span><strong>{formatNumber(totalSites)}</strong></div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="org-network-section" aria-labelledby="organization-network-title">
                    <div className="org-shell org-network-shell">
                        <div className="org-network-heading">
                            <div>
                                <p>ORGANIZATION MAP</p>
                                <h2 id="organization-network-title">팀 중심 <span>운영 네트워크</span></h2>
                            </div>
                            <label className="org-search-field">
                                <FontAwesomeIcon icon={faMagnifyingGlass} />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="팀 · 작업자 · 담당 현장 검색"
                                    aria-label="팀, 작업자 또는 담당 현장 검색"
                                />
                            </label>
                        </div>

                        {visibleTeams.length > 0 ? (
                            <div className="org-network-surface" ref={networkRef}>
                                <svg className="org-connector-layer" aria-hidden="true">
                                    <defs>
                                        <linearGradient id="org-connector-gradient" x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stopColor="#8d7dff" />
                                            <stop offset="55%" stopColor="#39dcff" />
                                            <stop offset="100%" stopColor="#68f3be" />
                                        </linearGradient>
                                    </defs>
                                    {connectorPaths.map((path, index) => (
                                        <g key={path.id}>
                                            <path className="org-connector-base" d={path.d} />
                                            <path
                                                className="org-connector-light"
                                                d={path.d}
                                                style={{ animationDelay: `${index * 170}ms` }}
                                            />
                                        </g>
                                    ))}
                                </svg>

                                <div className="org-command-wrap">
                                    <div className="org-command-node" ref={commandNodeRef}>
                                        <span className="org-command-orbit org-command-orbit-one" />
                                        <span className="org-command-orbit org-command-orbit-two" />
                                        <span className="org-command-icon"><FontAwesomeIcon icon={faBuilding} /></span>
                                        <div>
                                            <span>COMMAND CENTER</span>
                                            <strong>{companyName}</strong>
                                        </div>
                                        <em>{formatNumber(visibleTeams.length)} TEAM LINKED</em>
                                    </div>
                                </div>

                                <div className="org-team-grid">
                                    {visibleTeams.map((team, index) => {
                                        const foremen = team.members.filter(isForeman).length;
                                        const isSelected = team.id === selectedTeamId;
                                        const primarySite = team.sites[0] || '담당 현장 미등록';

                                        return (
                                            <button
                                                key={team.id}
                                                ref={(element) => { teamNodeRefs.current[team.id] = element; }}
                                                type="button"
                                                className={`org-team-node ${isSelected ? 'is-selected' : ''}`}
                                                style={{ animationDelay: `${Math.min(index, 12) * 65}ms` }}
                                                onClick={() => selectTeam(team)}
                                                aria-pressed={isSelected}
                                            >
                                                <span className="org-team-node-index">{String(index + 1).padStart(2, '0')}</span>
                                                <span className="org-team-node-pulse" />
                                                <span className="org-team-node-status">{team.status === 'active' ? '운영 중' : team.status}</span>
                                                <strong>{team.name}</strong>
                                                <span className="org-team-node-lead"><FontAwesomeIcon icon={faUserTie} /> {team.leaderName}</span>
                                                <span className="org-team-node-site"><FontAwesomeIcon icon={faLocationDot} /> {primarySite}</span>
                                                <span className="org-team-node-metrics">
                                                    <span><FontAwesomeIcon icon={faUsers} /> {formatNumber(team.members.length)}명</span>
                                                    <span><FontAwesomeIcon icon={faHelmetSafety} /> 반장 {formatNumber(foremen)}</span>
                                                </span>
                                                <span className="org-team-node-action">상세 연결 보기 <FontAwesomeIcon icon={faArrowRight} /></span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="org-no-results">
                                <FontAwesomeIcon icon={faSitemap} />
                                <strong>연결된 팀을 찾지 못했습니다.</strong>
                                <span>검색어를 지우거나 다른 팀, 작업자, 현장명으로 다시 찾아보세요.</span>
                            </div>
                        )}

                        <section className={`org-inspector ${selectedTeam ? 'is-open' : ''}`} aria-live="polite">
                            {selectedTeam ? (
                                <>
                                    <div className="org-inspector-summary">
                                        <span>TEAM INSPECTOR</span>
                                        <h3>{selectedTeam.name}</h3>
                                        <p>{selectedTeam.leaderName} 리더가 이끄는 {formatNumber(selectedTeam.members.length)}명 운영 단위입니다.</p>
                                        <div className="org-inspector-stat-row">
                                            <span><FontAwesomeIcon icon={faUserGroup} /> 작업자 {formatNumber(selectedTeam.members.length)}명</span>
                                            <span><FontAwesomeIcon icon={faCrosshairs} /> 담당 현장 {formatNumber(selectedTeam.sites.length)}곳</span>
                                        </div>
                                    </div>

                                    <div className="org-inspector-list-wrap">
                                        <div className="org-inspector-list-heading">
                                            <span>작업자</span>
                                            <small>클릭하여 상세 확인</small>
                                        </div>
                                        <div className="org-inspector-chip-list">
                                            {selectedTeam.members.length > 0 ? selectedTeam.members.map((member) => (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    className={`org-person-chip ${selectedWorker?.id === member.id && detailFocus === 'worker' ? 'is-active' : ''}`}
                                                    onClick={() => {
                                                        setSelectedWorkerId(member.id);
                                                        setDetailFocus('worker');
                                                    }}
                                                >
                                                    <PersonAvatar person={member} className="org-person-chip-avatar" />
                                                    <span><strong>{member.name}</strong><em>{getWorkerRole(member)}</em></span>
                                                </button>
                                            )) : <p className="org-inspector-empty">등록된 작업자가 없습니다.</p>}
                                        </div>
                                    </div>

                                    <div className="org-inspector-list-wrap">
                                        <div className="org-inspector-list-heading">
                                            <span>담당 현장</span>
                                            <small>클릭하여 현장 정보 확인</small>
                                        </div>
                                        <div className="org-inspector-chip-list org-site-chip-list">
                                            {selectedTeam.sites.length > 0 ? selectedTeam.sites.map((site) => (
                                                <button
                                                    key={site}
                                                    type="button"
                                                    className={`org-site-chip ${selectedSite === site && detailFocus === 'site' ? 'is-active' : ''}`}
                                                    onClick={() => {
                                                        setSelectedSiteName(site);
                                                        setDetailFocus('site');
                                                    }}
                                                >
                                                    <FontAwesomeIcon icon={faLocationDot} />
                                                    <span>{site}</span>
                                                    <FontAwesomeIcon icon={faArrowRight} />
                                                </button>
                                            )) : <p className="org-inspector-empty">담당 현장이 등록되지 않았습니다.</p>}
                                        </div>
                                    </div>

                                    <div className="org-focus-card">
                                        {detailFocus === 'worker' && selectedWorker ? (
                                            <>
                                                <div className="org-focus-person">
                                                    <PersonAvatar person={selectedWorker} className="org-focus-avatar" />
                                                    <div><span>WORKER DETAIL</span><strong>{selectedWorker.name}</strong><em>{getWorkerRole(selectedWorker)}</em></div>
                                                </div>
                                                <div className="org-focus-detail-grid">
                                                    <span><small>소속 팀</small><strong>{selectedTeam.name}</strong></span>
                                                    <span><small>현재 담당 현장</small><strong>{normalize(selectedWorker.data?.siteName) || selectedTeam.sites[0] || '현장 미등록'}</strong></span>
                                                    <span><small>근무 상태</small><strong>{normalize(selectedWorker.data?.status) || '재직'}</strong></span>
                                                </div>
                                            </>
                                        ) : detailFocus === 'site' && selectedSite ? (
                                            <>
                                                <div className="org-focus-person org-focus-site-title">
                                                    <span className="org-focus-site-icon"><FontAwesomeIcon icon={faLocationDot} /></span>
                                                    <div><span>SITE DETAIL</span><strong>{selectedSite}</strong><em>{selectedTeam.name} 담당 현장</em></div>
                                                </div>
                                                <div className="org-focus-detail-grid">
                                                    <span><small>담당 팀</small><strong>{selectedTeam.name}</strong></span>
                                                    <span><small>현장 배정 작업자</small><strong>{formatNumber(selectedSiteWorkers.length || selectedTeam.members.length)}명</strong></span>
                                                    <span><small>현장 주소</small><strong>{normalize(selectedSiteInfo?.address) || '주소 미등록'}</strong></span>
                                                    <span><small>운영 상태</small><strong>{normalize(selectedSiteInfo?.status) === 'active' || selectedTeam.status === 'active' ? '운영 중' : normalize(selectedSiteInfo?.status) || selectedTeam.status}</strong></span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="org-focus-empty">작업자 또는 담당 현장을 선택해 상세 정보를 확인하세요.</div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="org-inspector-placeholder">
                                    <span><FontAwesomeIcon icon={faCrosshairs} /></span>
                                    <div><strong>팀을 선택해 연결 정보를 확인하세요.</strong><p>작업자와 담당 현장은 팀을 선택한 뒤 각각 클릭해서 상세하게 볼 수 있습니다.</p></div>
                                </div>
                            )}
                        </section>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default CheongyeonOrgChartPage;
