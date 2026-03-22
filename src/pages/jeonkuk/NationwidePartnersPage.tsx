import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowTrendUp,
    faBuilding,
    faCircleCheck,
    faClock,
    faMapLocationDot,
    faSearch,
    faTriangleExclamation,
    faUsers,
    faWaveSquare
} from '@fortawesome/free-solid-svg-icons';
import SouthKorea from '@svg-maps/south-korea';
import 'react-svg-map/lib/index.css';
import { useMasterData } from '../../contexts/MasterDataContext';
import { dailyReportService, type DailyReport } from '../../services/dailyReportService';
import './NationwidePartnersPage.css';

type SiteStatus = '운영중' | '확장중' | '점검필요';

interface RegionMeta {
    id: string;
    code: string;
    name: string;
    shortName: string;
    aliases: string[];
    hubLabel: string;
}

interface SiteSummary {
    id: string;
    name: string;
    code: string;
    address: string;
    companyName: string;
    partnerName: string;
    responsibleTeamName: string;
    workers: number;
    recentManDay: number;
    totalManDay: number;
    reportCount: number;
    issueCount: number;
    status: SiteStatus;
    siteType: string;
    regionId: string;
}

interface RegionSummary {
    id: string;
    code: string;
    name: string;
    shortName: string;
    hubLabel: string;
    siteCount: number;
    activeSites: number;
    workers: number;
    recentManDay: number;
    issueCount: number;
    sites: SiteSummary[];
}

interface MapLocation {
    id: string;
    name: string;
    path: string;
}

const REGION_META: Record<string, RegionMeta> = {
    seoul: { id: 'seoul', code: 'KR-11', name: '서울특별시', shortName: '서울', aliases: ['서울특별시', '서울'], hubLabel: '수도권 프리미엄 협력망' },
    busan: { id: 'busan', code: 'KR-26', name: '부산광역시', shortName: '부산', aliases: ['부산광역시', '부산'], hubLabel: '남부권 광역 대응 센터' },
    daegu: { id: 'daegu', code: 'KR-27', name: '대구광역시', shortName: '대구', aliases: ['대구광역시', '대구'], hubLabel: '산업단지 기술지원 축' },
    incheon: { id: 'incheon', code: 'KR-28', name: '인천광역시', shortName: '인천', aliases: ['인천광역시', '인천'], hubLabel: '항만·공항 협력사 벨트' },
    gwangju: { id: 'gwangju', code: 'KR-29', name: '광주광역시', shortName: '광주', aliases: ['광주광역시', '광주'], hubLabel: '호남 기술지원 센터' },
    daejeon: { id: 'daejeon', code: 'KR-30', name: '대전광역시', shortName: '대전', aliases: ['대전광역시', '대전'], hubLabel: 'R&D 및 특수설비 대응' },
    ulsan: { id: 'ulsan', code: 'KR-31', name: '울산광역시', shortName: '울산', aliases: ['울산광역시', '울산'], hubLabel: '중공업 특화 파트너 존' },
    gyeonggi: { id: 'gyeonggi', code: 'KR-41', name: '경기도', shortName: '경기', aliases: ['경기도', '경기'], hubLabel: '안산 본부 연계 핵심 운영권역' },
    gangwon: { id: 'gangwon', code: 'KR-42', name: '강원특별자치도', shortName: '강원', aliases: ['강원특별자치도', '강원도', '강원'], hubLabel: '산악·관광권 유지보수' },
    'north-chungcheong': { id: 'north-chungcheong', code: 'KR-43', name: '충청북도', shortName: '충북', aliases: ['충청북도', '충북'], hubLabel: '내륙 제조·물류 중심지' },
    'south-chungcheong': { id: 'south-chungcheong', code: 'KR-44', name: '충청남도', shortName: '충남', aliases: ['충청남도', '충남'], hubLabel: '서해안 제조 벨트' },
    'north-jeolla': { id: 'north-jeolla', code: 'KR-45', name: '전북특별자치도', shortName: '전북', aliases: ['전북특별자치도', '전라북도', '전북'], hubLabel: '농공단지 지원 권역' },
    'south-jeolla': { id: 'south-jeolla', code: 'KR-46', name: '전라남도', shortName: '전남', aliases: ['전라남도', '전남'], hubLabel: '항만·에너지 운영 거점' },
    'north-gyeongsang': { id: 'north-gyeongsang', code: 'KR-47', name: '경상북도', shortName: '경북', aliases: ['경상북도', '경북'], hubLabel: '생산 네트워크 동부축' },
    'south-gyeongsang': { id: 'south-gyeongsang', code: 'KR-48', name: '경상남도', shortName: '경남', aliases: ['경상남도', '경남'], hubLabel: '제조 클러스터 서포트' },
    jeju: { id: 'jeju', code: 'KR-49', name: '제주특별자치도', shortName: '제주', aliases: ['제주특별자치도', '제주도', '제주'], hubLabel: '관광권 맞춤 운영' },
    sejong: { id: 'sejong', code: 'KR-50', name: '세종특별자치시', shortName: '세종', aliases: ['세종특별자치시', '세종'], hubLabel: '행정/공공시설 대응' }
};

const STATUS_OPTIONS: Array<SiteStatus | '전체'> = ['전체', '운영중', '확장중', '점검필요'];

const normalizeText = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, '');

const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getRecentRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    return {
        startDate: formatDate(start),
        endDate: formatDate(end)
    };
};

const resolveRegionId = (...values: Array<unknown>): string | null => {
    const candidates = values
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .map((value) => normalizeText(value))
        .filter(Boolean);

    for (const candidate of candidates) {
        for (const region of Object.values(REGION_META)) {
            if (region.aliases.some((alias) => candidate.startsWith(normalizeText(alias)) || candidate.includes(normalizeText(alias)))) {
                return region.id;
            }
        }
    }

    return null;
};

const determineStatus = (recentManDay: number, issueCount: number, isActive: boolean): SiteStatus => {
    if (issueCount > 0) return '점검필요';
    if (recentManDay > 0 || isActive) return '운영중';
    return '확장중';
};

const NationwidePartnersPage: React.FC = () => {
    const { companies, teams, sites, loading: masterLoading } = useMasterData();
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<SiteStatus | '전체'>('전체');
    const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
    const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadReports = async () => {
            setReportsLoading(true);

            try {
                const range = getRecentRange();
                const reportData = await dailyReportService.getReports(range);
                if (mounted) {
                    setReports(reportData);
                }
            } catch (error) {
                console.error('[NationwidePartnersPage] Failed to load reports:', error);
            } finally {
                if (mounted) {
                    setReportsLoading(false);
                }
            }
        };

        loadReports();

        return () => {
            mounted = false;
        };
    }, []);

    const siteSummaries = useMemo(() => {
        const reportsById = new Map<string, DailyReport[]>();
        const reportsBySiteId = new Map<string, DailyReport[]>();
        reports.forEach((report) => {
            const teamId = String(report.teamId || '');
            const siteId = String(report.siteId || '');
            if (teamId) {
                reportsById.set(teamId, [...(reportsById.get(teamId) || []), report]);
            }
            if (siteId) {
                reportsBySiteId.set(siteId, [...(reportsBySiteId.get(siteId) || []), report]);
            }
        });

        const companyById = new Map(companies.map((company) => [String(company.id || ''), company]));
        const teamById = new Map(teams.map((team) => [String(team.id || ''), team]));

        return sites
            .filter((site) => Boolean(site.id))
            .map((site) => {
                const siteId = String(site.id || '');
                const relatedReports = reportsBySiteId.get(siteId) || [];
                const responsibleTeamId = String(site.responsibleTeamId || '');
                const responsibleTeam = teamById.get(responsibleTeamId);
                const company = companyById.get(String(site.companyId || ''));
                const partner = companyById.get(String(site.partnerId || ''));
                const reportsByTeam = reportsById.get(responsibleTeamId) || [];
                const teamWorkers = Number(responsibleTeam?.memberCount || 0);

                const reportWorkers = relatedReports.reduce((acc, report) => {
                    const workers = Array.isArray(report.workers) ? report.workers.length : 0;
                    return acc + workers;
                }, 0);

                const recentManDay = relatedReports.reduce((acc, report) => acc + Number(report.totalManDay || 0), 0);
                const issueCount = (!responsibleTeamId || (site.status === 'active' && relatedReports.length === 0)) ? 1 : 0;
                const regionId = resolveRegionId(site.address, company?.address, partner?.address) || 'gyeonggi';

                return {
                    id: siteId,
                    name: site.name || '이름 미등록 현장',
                    code: site.code || '-',
                    address: site.address || '주소 미등록',
                    companyName: company?.name || '-',
                    partnerName: site.partnerName || partner?.name || '-',
                    responsibleTeamName: site.responsibleTeamName || responsibleTeam?.name || '-',
                    workers: Math.max(teamWorkers, reportWorkers),
                    recentManDay,
                    totalManDay: Number(site.totalManDay || 0),
                    reportCount: relatedReports.length,
                    issueCount,
                    status: determineStatus(recentManDay, issueCount, site.status === 'active'),
                    siteType: String(site.siteType || responsibleTeam?.type || '일반 현장'),
                    regionId
                } as SiteSummary;
            })
            .filter((item) => {
                if (item.reportCount > 0) return true;
                if (item.totalManDay > 0) return true;
                if (item.status === '운영중') return true;
                return item.responsibleTeamName !== '-' || reportsById.get(String(item.id || ''))?.length;
            });
    }, [companies, reports, sites, teams]);

    const filteredSites = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();

        return siteSummaries.filter((site) => {
            const regionName = REGION_META[site.regionId]?.name || '';
            const matchesStatus = statusFilter === '전체' || site.status === statusFilter;
            const matchesSearch = !search ||
                site.name.toLowerCase().includes(search) ||
                site.address.toLowerCase().includes(search) ||
                site.companyName.toLowerCase().includes(search) ||
                site.partnerName.toLowerCase().includes(search) ||
                site.responsibleTeamName.toLowerCase().includes(search) ||
                regionName.toLowerCase().includes(search);

            return matchesStatus && matchesSearch;
        });
    }, [searchTerm, siteSummaries, statusFilter]);

    const regionSummaries = useMemo(() => {
        const grouped = new Map<string, RegionSummary>();

        Object.values(REGION_META).forEach((region) => {
            grouped.set(region.id, {
                id: region.id,
                code: region.code,
                name: region.name,
                shortName: region.shortName,
                hubLabel: region.hubLabel,
                siteCount: 0,
                activeSites: 0,
                workers: 0,
                recentManDay: 0,
                issueCount: 0,
                sites: []
            });
        });

        filteredSites.forEach((site) => {
            const region = grouped.get(site.regionId);
            if (!region) return;

            region.sites.push(site);
            region.siteCount += 1;
            if (site.status === '운영중') {
                region.activeSites += 1;
            }
            region.workers += site.workers;
            region.recentManDay += site.recentManDay;
            region.issueCount += site.issueCount;
        });

        return Array.from(grouped.values());
    }, [filteredSites]);

    useEffect(() => {
        if (!selectedRegionId) return;
        const exists = regionSummaries.some((region) => region.id === selectedRegionId);
        if (!exists) {
            setSelectedRegionId(null);
        }
    }, [regionSummaries, selectedRegionId]);

    const selectedRegion = selectedRegionId
        ? regionSummaries.find((region) => region.id === selectedRegionId)
        : undefined;

    const summary = useMemo(() => {
        return filteredSites.reduce((acc, site) => {
            acc.siteCount += 1;
            acc.workers += site.workers;
            if (site.status === '운영중') {
                acc.activeSites += 1;
            }
            acc.recentManDay += site.recentManDay;
            acc.issueCount += site.issueCount;
            return acc;
        }, {
            siteCount: 0,
            workers: 0,
            activeSites: 0,
            recentManDay: 0,
            issueCount: 0
        });
    }, [filteredSites]);

    const topSites = useMemo(() => {
        return [...filteredSites]
            .sort((a, b) => {
                if (b.recentManDay !== a.recentManDay) return b.recentManDay - a.recentManDay;
                if (b.totalManDay !== a.totalManDay) return b.totalManDay - a.totalManDay;
                return b.workers - a.workers;
            })
            .slice(0, 5);
    }, [filteredSites]);

    const locationClassName = (locationId: string) => {
        const region = regionSummaries.find((item) => item.id === locationId);
        const classes = ['nationwide-map-location'];
        const isSelected = locationId === selectedRegionId;

        if (isSelected) {
            classes.push('is-selected');
        } else if (!region || region.siteCount === 0) {
            classes.push('is-empty');
        } else {
            classes.push('has-data');
        }

        if (hoveredRegionId === locationId) {
            classes.push('is-hover');
        }

        return classes.join(' ');
    };

    const handleLocationClick = (locationId: string) => {
        const nextId = String(locationId || '');
        if (REGION_META[nextId]) {
            setSelectedRegionId((prev) => (prev === nextId ? null : nextId));
        }
    };

    const koreaMap = SouthKorea as { viewBox: string; locations: MapLocation[] };

    const orderedLocations = useMemo(() => {
        // Metropolitan cities and special cities should stay above larger provinces
        // so they remain clickable even when polygons are adjacent/overlapping.
        const smallRegionIds = new Set([
            'seoul',
            'busan',
            'daegu',
            'incheon',
            'gwangju',
            'daejeon',
            'ulsan',
            'sejong'
        ]);

        return koreaMap.locations
            .map((location, index) => ({ location, index }))
            .sort((a, b) => {
                const aIsSelected = a.location.id === selectedRegionId;
                const bIsSelected = b.location.id === selectedRegionId;
                if (aIsSelected !== bIsSelected) {
                    return aIsSelected ? 1 : -1;
                }

                const aIsHovered = a.location.id === hoveredRegionId;
                const bIsHovered = b.location.id === hoveredRegionId;
                if (aIsHovered !== bIsHovered) {
                    return aIsHovered ? 1 : -1;
                }

                const aIsSmall = smallRegionIds.has(a.location.id);
                const bIsSmall = smallRegionIds.has(b.location.id);
                if (aIsSmall !== bIsSmall) {
                    return aIsSmall ? 1 : -1;
                }

                return a.index - b.index;
            })
            .map((entry) => entry.location);
    }, [koreaMap.locations, hoveredRegionId, selectedRegionId]);

    const isLoading = masterLoading || reportsLoading;

    return (
        <div className="nationwide-page">
            <section className="nationwide-hero">
                <div>
                    <p className="nationwide-eyebrow">전국 현장 운영망</p>
                    <h1>전국 현장 지도</h1>
                    <p className="nationwide-subtitle">
                        Firebase 회사·팀·현장·일보 데이터를 바탕으로 현장을 권역별로 묶어 보여줍니다. 실제 대한민국 SVG 폴리곤을 클릭하면 지역별 현장 운영 상세가 즉시 갱신됩니다.
                    </p>
                </div>
                <div className="nationwide-hero-badge">
                    <FontAwesomeIcon icon={faWaveSquare} /> 최근 30일 운영 분석
                </div>
            </section>

            <section className="nationwide-summary-grid">
                <article className="nationwide-summary-card">
                    <span className="nationwide-summary-label">현장 수</span>
                    <strong>{summary.siteCount}개소</strong>
                    <span><FontAwesomeIcon icon={faBuilding} /> 실제 Firebase 현장 데이터 기준</span>
                </article>
                <article className="nationwide-summary-card">
                    <span className="nationwide-summary-label">투입 가능 인력</span>
                    <strong>{summary.workers.toLocaleString()}명</strong>
                    <span><FontAwesomeIcon icon={faUsers} /> 팀 인원 합산</span>
                </article>
                <article className="nationwide-summary-card">
                    <span className="nationwide-summary-label">활성 현장</span>
                    <strong>{summary.activeSites}개소</strong>
                    <span><FontAwesomeIcon icon={faMapLocationDot} /> 운영중 상태 기준</span>
                </article>
                <article className="nationwide-summary-card warning">
                    <span className="nationwide-summary-label">최근 30일 공수</span>
                    <strong>{summary.recentManDay.toLocaleString()} MD</strong>
                    <span><FontAwesomeIcon icon={faTriangleExclamation} /> 점검 필요 {summary.issueCount}건</span>
                </article>
            </section>

            <section className="nationwide-layout">
                <div className="nationwide-map-shell">
                    <div className="nationwide-toolbar">
                        <label className="nationwide-search">
                            <FontAwesomeIcon icon={faSearch} />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="현장명, 주소, 회사/팀, 지역명 검색"
                            />
                        </label>
                        <div className="nationwide-status-chips">
                            {STATUS_OPTIONS.map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    className={statusFilter === status ? 'active' : ''}
                                    onClick={() => setStatusFilter(status)}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="nationwide-map-stage">
                        <div className="nationwide-map-heading">
                            <div>
                                <strong>안산 본부 기준 전국 운영권</strong>
                                <p>지도 폴리곤 클릭으로 권역별 현장, 책임팀, 최근 공수를 탐색합니다.</p>
                            </div>
                            <span className="nationwide-hq-pill">HQ 안산</span>
                        </div>

                        <div className="nationwide-svg-wrap">
                            <svg
                                viewBox={koreaMap.viewBox}
                                className="nationwide-south-korea-map"
                                role="img"
                                aria-label="대한민국 권역 지도"
                            >
                                {orderedLocations.map((location) => {
                                    const region = regionSummaries.find((item) => item.id === location.id);
                                    const aria = `${REGION_META[location.id]?.name || location.name} 현장 ${region?.siteCount || 0}개소`;
                                    return (
                                        <g key={location.id}>
                                            <path
                                                d={location.path}
                                                className="nationwide-map-hit-area"
                                                aria-label={aria}
                                                onClick={() => handleLocationClick(location.id)}
                                                onMouseEnter={() => setHoveredRegionId(location.id)}
                                                onMouseLeave={() => setHoveredRegionId(null)}
                                            />
                                            <path
                                                d={location.path}
                                                className={locationClassName(location.id)}
                                                pointerEvents="none"
                                            />
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>

                        <div className="nationwide-region-chip-grid">
                            {regionSummaries.map((region) => (
                                <button
                                    key={region.id}
                                    type="button"
                                    className={`nationwide-region-chip ${selectedRegionId === region.id ? 'active' : ''}`}
                                    onClick={() => setSelectedRegionId((prev) => (prev === region.id ? null : region.id))}
                                >
                                    <span>{region.shortName}</span>
                                    <strong>{region.siteCount}</strong>
                                </button>
                            ))}
                        </div>

                        <div className="nationwide-map-footnote">
                            지도 데이터: SVG Maps South Korea, CC BY 4.0. 운영 지표는 Firebase 회사, 팀, 현장, 일보 데이터를 실시간 조합합니다.
                        </div>
                    </div>
                </div>

                <aside className="nationwide-sidebar">
                    {!selectedRegion && (
                        <div className="nationwide-empty nationwide-empty-select">
                            지도의 지역을 클릭하면 원본처럼 해당 지역만 활성화되고 상세 정보가 표시됩니다.
                        </div>
                    )}

                    {selectedRegion && (
                        <>
                            <div className="nationwide-region-card">
                                <div className="nationwide-region-card-top">
                                    <div>
                                        <p className="nationwide-region-code">{selectedRegion.code}</p>
                                        <h2>{selectedRegion.name}</h2>
                                        <p>{selectedRegion.hubLabel}</p>
                                    </div>
                                    <div className="nationwide-trend-pill">
                                        <FontAwesomeIcon icon={faArrowTrendUp} /> {selectedRegion.recentManDay.toLocaleString()} MD
                                    </div>
                                </div>

                                <div className="nationwide-region-stats">
                                    <div>
                                        <span>현장</span>
                                        <strong>{selectedRegion.siteCount}개소</strong>
                                    </div>
                                    <div>
                                        <span>활성 현장</span>
                                        <strong>{selectedRegion.activeSites}개소</strong>
                                    </div>
                                    <div>
                                        <span>투입 인력</span>
                                        <strong>{selectedRegion.workers.toLocaleString()}명</strong>
                                    </div>
                                    <div>
                                        <span>점검 필요</span>
                                        <strong>{selectedRegion.issueCount}건</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="nationwide-partner-list">
                                <div className="nationwide-section-title">
                                    <h3>권역 현장 상세</h3>
                                    <span>{selectedRegion.sites.length}개소</span>
                                </div>

                                {isLoading && <div className="nationwide-empty">운영 데이터를 불러오는 중입니다.</div>}
                                {!isLoading && selectedRegion.sites.length === 0 && (
                                    <div className="nationwide-empty">선택한 권역에 표시할 현장 데이터가 없습니다.</div>
                                )}

                                {!isLoading && selectedRegion.sites.map((site) => (
                                    <article key={site.id} className={`nationwide-partner-item status-${site.status}`}>
                                        <div className="nationwide-partner-head">
                                            <div>
                                                <strong>{site.name}</strong>
                                                <p>{site.siteType}</p>
                                            </div>
                                            <span className="nationwide-status-badge">{site.status}</span>
                                        </div>
                                        <div className="nationwide-partner-stats">
                                            <span><FontAwesomeIcon icon={faUsers} /> 인력 {site.workers}명</span>
                                            <span><FontAwesomeIcon icon={faBuilding} /> 책임팀 {site.responsibleTeamName}</span>
                                            <span><FontAwesomeIcon icon={faBuilding} /> 협력사 {site.partnerName}</span>
                                            <span><FontAwesomeIcon icon={faWaveSquare} /> 최근 {site.recentManDay.toLocaleString()} MD</span>
                                            <span><FontAwesomeIcon icon={faClock} /> 일보 {site.reportCount}건</span>
                                        </div>
                                        <div className="nationwide-partner-contact-row">
                                            <span><FontAwesomeIcon icon={faBuilding} /> 원청 {site.companyName}</span>
                                            <span><FontAwesomeIcon icon={faMapLocationDot} /> {site.address}</span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="nationwide-ranking-card">
                        <div className="nationwide-section-title compact">
                            <h3>상위 현장 랭킹</h3>
                            <span>최근 30일 공수 기준</span>
                        </div>
                        <ol>
                            {topSites.map((site, index) => (
                                <li key={site.id}>
                                    <div>
                                        <strong>{index + 1}. {site.name}</strong>
                                        <p>{REGION_META[site.regionId]?.name || '-'}</p>
                                    </div>
                                    <span>{site.recentManDay.toLocaleString()} MD</span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="nationwide-ops-card">
                        <div className="nationwide-section-title compact">
                            <h3>운영 체크포인트</h3>
                        </div>
                        <ul>
                            <li><FontAwesomeIcon icon={faCircleCheck} /> 점검 필요는 활성 현장 중 책임팀 미지정 건수입니다.</li>
                            <li><FontAwesomeIcon icon={faCircleCheck} /> 최근 공수는 최근 30일 일보의 totalManDay 합산입니다.</li>
                            <li><FontAwesomeIcon icon={faCircleCheck} /> 현장 권역은 현장 주소를 기준으로 자동 분류합니다.</li>
                        </ul>
                    </div>
                </aside>
            </section>
        </div>
    );
};

export default NationwidePartnersPage;