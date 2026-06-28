import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBriefcase,
    faBuilding,
    faBullhorn,
    faCode,
    faCrown,
    faHelmetSafety,
    faMagnifyingGlass,
    faSitemap,
    faUserTie,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { OrgNode, useOrganizationTree } from './hooks/useOrganizationTree';
import { officeStaffService, type OfficeStaff } from '../../services/officeStaffService';
import logoConstruction from '../../assets/logo_construction.jpg';
import './CheongyeonOrgChartPage.css';

type DepartmentKey = 'construction' | 'management' | 'sales' | 'development';

type TeamView = {
    id: string;
    name: string;
    leaderName: string;
    leaderRole: string;
    memberCount: number;
    siteNames: string[];
    status: string;
    workers: OrgNode[];
    source?: OrgNode;
};

type DepartmentView = {
    key: DepartmentKey;
    title: string;
    subtitle: string;
    description: string;
    icon: any;
    color: string;
    stat: string;
    helper: string;
    tasks: string[];
};

const normalize = (value: unknown): string => String(value ?? '').trim();

const CONSTRUCTION_TEAM_ORDER = [
    '이재욱팀',
    '김봉수팀',
    '김세흔팀',
    '김진민팀',
    '김군회팀',
    '김덕기팀',
    '박상국팀',
    '김동혁팀',
    '임효재팀',
    '심진섭팀',
] as const;

const MANAGEMENT_TASKS = ['사무', '회계', '세무 업무', '출력관리'];
const SALES_TASKS = ['자재', '현장 영업', '거래처 응대', '수주 지원'];
const DEVELOPMENT_TASKS = ['ERP 시스템 설계', '업무 자동화', '데이터 연동', '운영 개선'];

const normalizeTeamName = (name: unknown): string => normalize(name).replace(/\s+/g, '').replace(/팀$/, '');

const getConstructionTeamOrder = (name: unknown): number => {
    const teamName = normalizeTeamName(name);
    const index = CONSTRUCTION_TEAM_ORDER.findIndex((item) => normalizeTeamName(item) === teamName);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
};

const isActiveOfficeStaff = (staff: OfficeStaff): boolean => {
    const status = normalize(staff.status).toLowerCase();
    return staff.isActive !== false && !['퇴사', 'inactive', '출입금지'].includes(status);
};

const matchesOfficeDepartment = (staff: OfficeStaff, keywords: string[]): boolean => {
    const department = normalize(staff.department);
    if (department) return keywords.some((keyword) => department.includes(keyword));

    const fallbackText = [staff.role, staff.memo].map(normalize).join(' ');
    return keywords.some((keyword) => fallbackText.includes(keyword));
};

const isCheongyeonName = (name: unknown): boolean => {
    const text = normalize(name).toLowerCase();
    return text.includes('청연') || text.includes('cheongyeon') || text.includes('chungyun');
};

const formatNumber = (value: number): string => Number(value || 0).toLocaleString('ko-KR');

const getNodeTypeLabel = (node: OrgNode): string => {
    const rawType = normalize(node.data?.type);
    if (rawType) return rawType;
    if (node.type === 'company') return '회사';
    if (node.type === 'team') return '팀';
    return '구성원';
};

const getWorkerRole = (worker?: OrgNode): string => {
    if (!worker) return '리더';
    return (
        normalize(worker.data?.role) ||
        normalize(worker.data?.position) ||
        normalize(worker.data?.rank) ||
        '구성원'
    );
};

const getWorkerImage = (worker?: OrgNode): string => {
    if (!worker) return '';
    return (
        normalize(worker.data?.profileImageUrl) ||
        normalize(worker.data?.photoURL) ||
        normalize(worker.data?.imageUrl) ||
        normalize(worker.data?.avatarUrl)
    );
};

const getTeamWorkers = (team: OrgNode): OrgNode[] =>
    team.children.filter((child) => child.type === 'worker');

const getTeamLeader = (team: OrgNode): OrgNode | undefined => {
    const leaderName = normalize(team.data?.leaderName);
    const workers = getTeamWorkers(team);
    if (leaderName) {
        const byName = workers.find((worker) => normalize(worker.name) === leaderName);
        if (byName) return byName;
    }

    return workers.find((worker) => {
        const label = `${getWorkerRole(worker)} ${normalize(worker.data?.rank)}`;
        return /팀장|반장|소장|리더|leader|manager/i.test(label);
    }) || workers[0];
};

const getTeamSites = (team: OrgNode): string[] => {
    const values = [
        team.data?.siteName,
        team.data?.siteNames,
        team.data?.assignedSiteNames,
        team.data?.currentSiteName,
    ];

    const result = new Set<string>();
    values.forEach((value) => {
        if (Array.isArray(value)) {
            value.map(normalize).filter(Boolean).forEach((item) => result.add(item));
            return;
        }
        const text = normalize(value);
        if (text) result.add(text);
    });

    return Array.from(result).slice(0, 3);
};

const getTeamStatus = (team: OrgNode): string => {
    const status = normalize(team.data?.status);
    if (!status || status === 'active') return '운영중';
    if (status === 'inactive') return '대기';
    return status;
};

const flattenCompanies = (treeData: OrgNode[]): OrgNode[] =>
    treeData.filter((node) => node.type === 'company');

const flattenTeams = (companies: OrgNode[]): OrgNode[] =>
    companies.flatMap((company) => company.children.filter((child) => child.type === 'team'));

const flattenWorkers = (teams: OrgNode[]): OrgNode[] =>
    teams.flatMap((team) => getTeamWorkers(team));

const buildTeamView = (team: OrgNode): TeamView => {
    const leader = getTeamLeader(team);

    return {
        id: team.id,
        name: team.name,
        leaderName: normalize(team.data?.leaderName) || leader?.name || '리더 미지정',
        leaderRole: getWorkerRole(leader),
        memberCount: getTeamWorkers(team).length,
        siteNames: getTeamSites(team),
        status: getTeamStatus(team),
        workers: getTeamWorkers(team)
            .sort((left, right) => left.name.localeCompare(right.name, 'ko'))
            .slice(0, 6),
        source: team,
    };
};

const getOfficeStaffKey = (staff: OfficeStaff, index: number, departmentKey: DepartmentKey): string =>
    normalize(staff.id) || normalize(staff.legacyId) || `${departmentKey}-${normalize(staff.name) || index}`;

const officeStaffToOrgNode = (staff: OfficeStaff, index: number, departmentKey: DepartmentKey): OrgNode => ({
    id: getOfficeStaffKey(staff, index, departmentKey),
    type: 'worker',
    name: normalize(staff.name) || '이름 미등록',
    parentId: `office-${departmentKey}`,
    children: [],
    data: staff,
    isExpanded: false,
});

const getOfficeLeader = (members: OrgNode[]): OrgNode | undefined =>
    members.find((member) => /대표|이사|실장|부장|팀장|리더|manager/i.test(getWorkerRole(member))) || members[0];

const buildOfficeTeamView = (
    departmentKey: DepartmentKey,
    name: string,
    staffRows: OfficeStaff[],
    departmentLabel: string,
    tasks: string[],
): TeamView => {
    const members = staffRows
        .map((staff, index) => officeStaffToOrgNode(staff, index, departmentKey))
        .sort((left, right) => left.name.localeCompare(right.name, 'ko'));
    const leader = getOfficeLeader(members);

    return {
        id: `office-${departmentKey}`,
        name,
        leaderName: leader?.name || '담당자 미지정',
        leaderRole: leader ? getWorkerRole(leader) : departmentLabel,
        memberCount: members.length,
        siteNames: tasks,
        status: `${departmentLabel} / 사무실직원`,
        workers: members,
    };
};

const isConstructionTeamView = (team: TeamView): boolean => {
    const teamName = normalizeTeamName(team.name);
    if (CONSTRUCTION_TEAM_ORDER.some((name) => normalizeTeamName(name) === teamName)) return true;

    const type = normalize(team.source?.data?.type);
    return ['시공팀', '시공사팀', '직영팀', '본팀'].includes(type);
};

const CheongyeonOrgChartPage: React.FC = () => {
    const { treeData, loading } = useOrganizationTree();
    const [activeDepartment, setActiveDepartment] = useState<DepartmentKey>('construction');
    const [query, setQuery] = useState('');
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);

    useEffect(() => {
        document.body.classList.add('cheongyeon-org-codeit-theme');
        return () => document.body.classList.remove('cheongyeon-org-codeit-theme');
    }, []);

    useEffect(() => {
        let mounted = true;

        officeStaffService.getOfficeStaff()
            .then((rows) => {
                if (mounted) setOfficeStaffRows(rows);
            })
            .catch((error) => {
                console.error('[CheongyeonOrgChartPage] Failed to load office staff:', error);
            });

        return () => {
            mounted = false;
        };
    }, []);

    const companies = useMemo(() => flattenCompanies(treeData), [treeData]);

    const primaryCompany = useMemo(() => {
        return companies.find((company) => isCheongyeonName(company.name)) || companies[0] || null;
    }, [companies]);

    const allTeams = useMemo(() => flattenTeams(companies), [companies]);
    const teamViews = useMemo(() => allTeams.map(buildTeamView), [allTeams]);
    const allWorkers = useMemo(() => flattenWorkers(allTeams), [allTeams]);

    const constructionTeamViews = useMemo(() => {
        return teamViews
            .filter(isConstructionTeamView)
            .sort((left, right) => {
                const leftOrder = getConstructionTeamOrder(left.name);
                const rightOrder = getConstructionTeamOrder(right.name);
                if (leftOrder !== rightOrder) return leftOrder - rightOrder;
                return left.name.localeCompare(right.name, 'ko');
            });
    }, [teamViews]);

    const activeOfficeStaffRows = useMemo(
        () => officeStaffRows.filter(isActiveOfficeStaff),
        [officeStaffRows]
    );

    const managementStaff = useMemo(
        () => activeOfficeStaffRows.filter((staff) => matchesOfficeDepartment(staff, ['관리부', '관리팀', '관리'])),
        [activeOfficeStaffRows]
    );

    const salesStaff = useMemo(
        () => activeOfficeStaffRows.filter((staff) => matchesOfficeDepartment(staff, ['영업부', '영업팀', '영업'])),
        [activeOfficeStaffRows]
    );

    const developmentStaff = useMemo(
        () => activeOfficeStaffRows.filter((staff) => matchesOfficeDepartment(staff, ['개발부', '개발팀', '개발', '전산', 'ERP', '시스템'])),
        [activeOfficeStaffRows]
    );

    const departmentTeamViews = useMemo<Record<DepartmentKey, TeamView[]>>(() => ({
        construction: constructionTeamViews,
        management: [buildOfficeTeamView('management', '관리팀', managementStaff, '관리부', MANAGEMENT_TASKS)],
        sales: [buildOfficeTeamView('sales', '영업팀', salesStaff, '영업부', SALES_TASKS)],
        development: [buildOfficeTeamView('development', '개발팀', developmentStaff, '개발팀', DEVELOPMENT_TASKS)],
    }), [constructionTeamViews, developmentStaff, managementStaff, salesStaff]);

    const selectedDepartmentTeams = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const departmentFiltered = departmentTeamViews[activeDepartment] || [];

        if (!normalizedQuery) return departmentFiltered;

        return departmentFiltered.filter((team) => {
            const text = [
                team.name,
                team.leaderName,
                team.leaderRole,
                team.status,
                team.siteNames.join(' '),
                team.workers.map((worker) => `${worker.name} ${getWorkerRole(worker)}`).join(' '),
            ].join(' ').toLowerCase();
            return text.includes(normalizedQuery);
        });
    }, [activeDepartment, departmentTeamViews, query]);

    const departments = useMemo<DepartmentView[]>(() => [
        {
            key: 'construction',
            title: '시공팀',
            subtitle: 'Construction Team',
            description: '현장 시공팀을 지정된 순서대로 정리하고, 팀장과 투입 인원을 빠르게 확인합니다.',
            icon: faHelmetSafety,
            color: '#4f7cff',
            stat: `${formatNumber(constructionTeamViews.length)}팀`,
            helper: `${formatNumber(constructionTeamViews.reduce((sum, team) => sum + team.memberCount, 0))}명`,
            tasks: ['현장 시공', '팀별 투입관리', '작업 진행 확인'],
        },
        {
            key: 'management',
            title: '관리팀',
            subtitle: 'Administration',
            description: '사무실 관리부 직원을 기준으로 사무, 회계, 세무 업무와 출력관리를 담당합니다.',
            icon: faBriefcase,
            color: '#7c3aed',
            stat: `${formatNumber(managementStaff.length)}명`,
            helper: '관리부 사무실직원',
            tasks: MANAGEMENT_TASKS,
        },
        {
            key: 'sales',
            title: '영업팀',
            subtitle: 'Sales',
            description: '사무실 영업부 직원을 기준으로 자재, 현장, 영업 업무를 연결합니다.',
            icon: faBullhorn,
            color: '#00b894',
            stat: `${formatNumber(salesStaff.length)}명`,
            helper: '영업부 사무실직원',
            tasks: SALES_TASKS,
        },
        {
            key: 'development',
            title: '개발팀',
            subtitle: 'ERP Development',
            description: 'ERP 전반 시스템 설계와 업무 프로세스 자동화, 데이터 연동을 담당합니다.',
            icon: faCode,
            color: '#ff8a00',
            stat: developmentStaff.length > 0 ? `${formatNumber(developmentStaff.length)}명` : 'ERP',
            helper: '시스템 설계',
            tasks: DEVELOPMENT_TASKS,
        },
    ], [constructionTeamViews, developmentStaff.length, managementStaff.length, salesStaff.length]);

    const activeDepartmentMeta = departments.find((item) => item.key === activeDepartment) || departments[0];
    const ceoName = normalize(primaryCompany?.data?.ceoName) || normalize(primaryCompany?.data?.representativeName) || '대표';
    const companyName = primaryCompany?.name || '청연이엔지';

    if (loading) {
        return (
            <div className="cheongyeon-org-codeit-page flex min-h-screen items-center justify-center bg-white text-[#333236]">
                <div className="text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[8px] bg-[#f6f5ff] text-[#7c3aed]">
                        <FontAwesomeIcon icon={faSitemap} className="text-2xl" />
                    </div>
                    <p className="text-sm font-black tracking-[0.18em] text-[#7a8191]">ORGANIZATION LOADING</p>
                </div>
            </div>
        );
    }

    return (
        <div className="cheongyeon-org-codeit-page min-h-screen bg-white text-[#333236]">
            <div className="bg-[#080c16] px-4 py-3 text-center text-sm font-semibold text-white">
                조직 구조를 더 짧은 주기로 보고, 팀 배치를 더 빠르게 파악하세요
            </div>

            <section className="bg-[#f7f8fb] px-5 py-16 md:px-8">
                <div className="mx-auto max-w-[1180px]">
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                        <div className="rounded-[8px] border border-[#e2e5ee] bg-white p-7 shadow-[0_18px_45px_rgba(21,27,45,0.05)]">
                            <div className="flex items-center gap-4">
                                <img src={logoConstruction} alt="청연이엔지 로고" className="h-16 w-16 rounded-[8px] object-cover" />
                                <div className="min-w-0 text-left">
                                    <div className="text-sm font-bold text-[#7a8191]">Chief Executive Officer</div>
                                    <div className="mt-1 truncate text-3xl font-black text-[#24242a]">{ceoName}</div>
                                    <div className="mt-1 truncate text-sm font-bold text-[#4f7cff]">{companyName}</div>
                                </div>
                            </div>

                            <div className="mt-7 grid grid-cols-3 gap-3">
                                {[
                                    { label: '회사', value: formatNumber(companies.length) },
                                    { label: '팀', value: formatNumber(teamViews.length) },
                                    { label: '인원', value: formatNumber(allWorkers.length) },
                                ].map((item) => (
                                    <div key={item.label} className="rounded-[8px] border border-[#eef0f6] bg-[#f7f8fb] px-3 py-4 text-center">
                                        <div className="text-2xl font-black text-[#24242a]">{item.value}</div>
                                        <div className="mt-1 text-xs font-bold text-[#7a8191]">{item.label}</div>
                                    </div>
                                ))}
                            </div>

                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                            {departments.map((department) => (
                                <button
                                    key={department.key}
                                    type="button"
                                    onClick={() => setActiveDepartment(department.key)}
                                    className={`rounded-[8px] border p-5 text-left transition ${
                                        activeDepartment === department.key
                                            ? 'border-[#4f7cff] bg-white shadow-[0_18px_45px_rgba(79,124,255,0.14)]'
                                            : 'border-[#e2e5ee] bg-white hover:border-[#bfc9e5]'
                                    }`}
                                >
                                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[8px] text-lg text-white" style={{ backgroundColor: department.color }}>
                                        <FontAwesomeIcon icon={department.icon} />
                                    </div>
                                    <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a8191]">{department.subtitle}</div>
                                    <div className="mt-1 text-xl font-black text-[#24242a]">{department.title}</div>
                                    <div className="mt-4 text-2xl font-black" style={{ color: department.color }}>{department.stat}</div>
                                    <div className="mt-1 text-xs font-bold text-[#7a8191]">{department.helper}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-5 py-16 md:px-8">
                <div className="mx-auto max-w-[1180px]">
                    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                        <div>
                            <p className="text-base font-extrabold text-[#4f7cff]">{activeDepartmentMeta.subtitle}</p>
                            <h2 className="mt-3 text-3xl font-black text-[#24242a] md:text-5xl">
                                {activeDepartmentMeta.title}
                            </h2>
                            <p className="mt-4 max-w-[640px] text-base leading-7 text-[#656b7a]">
                                {activeDepartmentMeta.description}
                            </p>
                            <div className="mt-5 flex max-w-[720px] flex-wrap gap-2">
                                {activeDepartmentMeta.tasks.map((task) => (
                                    <span key={task} className="rounded-[8px] bg-[#eef4ff] px-3 py-1.5 text-xs font-black text-[#4f7cff]">
                                        {task}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="relative w-full md:w-[360px]">
                            <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8d94a3]" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="팀, 리더, 구성원 검색"
                                className="h-12 w-full rounded-[8px] border border-[#dfe3ef] bg-white pl-11 pr-4 text-sm font-bold outline-none focus:border-[#4f7cff]"
                            />
                        </div>
                    </div>

                    {selectedDepartmentTeams.length > 0 ? (
                        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {selectedDepartmentTeams.map((team, index) => {
                                const leader = team.source ? getTeamLeader(team.source) : team.workers[0];
                                const leaderImage = getWorkerImage(leader);
                                return (
                                    <article key={team.id} className="rounded-[8px] border border-[#e2e5ee] bg-white p-6 shadow-[0_18px_45px_rgba(21,27,45,0.05)]">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-sm font-black text-[#4f7cff]">{String(index + 1).padStart(2, '0')}</div>
                                                <h3 className="mt-2 truncate text-2xl font-black text-[#24242a]">{team.name}</h3>
                                                <div className="mt-1 text-sm font-bold text-[#7a8191]">{team.status}</div>
                                            </div>
                                            <div className="rounded-[8px] bg-[#f6f5ff] px-3 py-2 text-sm font-black text-[#7c3aed]">
                                                {formatNumber(team.memberCount)}명
                                            </div>
                                        </div>

                                        <div className="mt-6 flex items-center gap-3 rounded-[8px] border border-[#eef0f6] bg-[#f7f8fb] p-4">
                                            {leaderImage ? (
                                                <img src={leaderImage} alt={team.leaderName} className="h-12 w-12 rounded-[8px] object-cover" />
                                            ) : (
                                                <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#4f7cff] text-lg font-black text-white">
                                                    {team.leaderName.slice(0, 1)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="truncate text-base font-black text-[#24242a]">{team.leaderName}</div>
                                                <div className="truncate text-sm font-bold text-[#7a8191]">{team.leaderRole}</div>
                                            </div>
                                        </div>

                                        <div className="mt-5 flex flex-wrap gap-2">
                                            {team.siteNames.length > 0 ? team.siteNames.map((siteName) => (
                                                <span key={siteName} className="rounded-[8px] bg-[#eef4ff] px-3 py-1 text-xs font-black text-[#4f7cff]">
                                                    {siteName}
                                                </span>
                                            )) : (
                                                <span className="rounded-[8px] bg-[#f0f2f6] px-3 py-1 text-xs font-black text-[#7a8191]">
                                                    현장 연결 대기
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-6 border-t border-[#eef0f6] pt-5">
                                            <div className="mb-3 text-sm font-black text-[#24242a]">구성원</div>
                                            <div className="space-y-2">
                                                {team.workers.length > 0 ? team.workers.map((worker) => (
                                                    <div key={worker.id} className="flex items-center justify-between gap-3 text-sm">
                                                        <span className="truncate font-extrabold text-[#333236]">{worker.name}</span>
                                                        <span className="flex-shrink-0 font-bold text-[#7a8191]">{getWorkerRole(worker)}</span>
                                                    </div>
                                                )) : (
                                                    <div className="rounded-[8px] bg-[#f7f8fb] px-4 py-3 text-sm font-bold text-[#7a8191]">
                                                        등록된 구성원이 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="mt-10 rounded-[8px] border border-[#e2e5ee] bg-[#f7f8fb] p-10 text-center">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] bg-white text-[#4f7cff]">
                                <FontAwesomeIcon icon={faUsers} />
                            </div>
                            <p className="text-xl font-black text-[#24242a]">표시할 팀이 없습니다</p>
                            <p className="mt-3 text-base text-[#656b7a]">검색어를 지우거나 다른 조직 영역을 선택해 주세요.</p>
                        </div>
                    )}
                </div>
            </section>

            <section className="bg-[#111827] px-5 py-16 text-white md:px-8">
                <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-5 md:grid-cols-3">
                    {[
                        { icon: faCrown, label: '대표', value: ceoName, helper: companyName },
                        { icon: faBuilding, label: '조직 단위', value: `${formatNumber(companies.length)}개`, helper: '회사 및 협력사' },
                        { icon: faUserTie, label: '운영 리더', value: `${formatNumber(teamViews.length)}명`, helper: '팀 리더 기준' },
                    ].map((item) => (
                        <div key={item.label} className="rounded-[8px] border border-[#273244] bg-[#182133] p-7">
                            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#4f7cff] text-xl">
                                <FontAwesomeIcon icon={item.icon} />
                            </div>
                            <div className="text-sm font-bold text-[#aab6c8]">{item.label}</div>
                            <div className="mt-2 text-3xl font-black">{item.value}</div>
                            <div className="mt-2 text-sm font-semibold text-[#c7d0df]">{item.helper}</div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default CheongyeonOrgChartPage;
