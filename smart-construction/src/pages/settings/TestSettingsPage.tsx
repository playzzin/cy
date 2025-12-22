import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faUsers, faBuilding, faUserGroup, faArrowLeft, faTrash, faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { siteService, Site } from '../../services/siteService';
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';

// --- Interfaces ---
interface TestCompanyData {
    name: string;
    code: string;
    ceoName: string;
    businessNumber: string;
    type: '건설사' | '협력사';
}

interface TestWorkerData {
    name: string;
    idNumber: string;
    contact: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    address: string;
    role: string;
    unitPrice: number;
}

interface TestTeamData {
    name: string;
    leaderName: string;
    leaderId: string;
    companyId: string;
    companyName: string;
}

interface TestSiteData {
    name: string;
    responsibleTeamId: string;
    responsibleTeamName: string;
}

const TestSettingsPage: React.FC = () => {
    const navigate = useNavigate();

    // --- State ---
    const [companies, setCompanies] = useState<Company[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);

    const [testCompanies, setTestCompanies] = useState<TestCompanyData[]>([]);
    const [testWorkers, setTestWorkers] = useState<TestWorkerData[]>([]);
    const [testTeams, setTestTeams] = useState<TestTeamData[]>([]);
    const [testSites, setTestSites] = useState<TestSiteData[]>([]);
    const [testReports, setTestReports] = useState<DailyReport[]>([]);

    const [loading, setLoading] = useState(false);

    // Generation Counts
    const [counts, setCounts] = useState({
        company: 3,
        worker: 10,
        team: 3,
        site: 3,
        report: 30
    });

    // --- Fetch Data ---
    const fetchData = async () => {
        try {
            const [c, w, t, s] = await Promise.all([
                companyService.getCompanies(),
                manpowerService.getWorkers(),
                teamService.getTeams(),
                siteService.getSites()
            ]);
            setCompanies(c);
            setWorkers(w);
            setTeams(t);
            setSites(s);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- Generators ---

    // 1. Company Generator
    const generateTestCompanies = () => {
        setLoading(true);
        const newCompanies: TestCompanyData[] = [];
        const types: ('건설사' | '협력사')[] = ['건설사', '협력사'];

        for (let i = 0; i < counts.company; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const name = type === '건설사'
                ? `(주)${['태양', '대한', '한국', '미래', '청연'][Math.floor(Math.random() * 5)]}건설`
                : `${['김', '이', '박', '최'][Math.floor(Math.random() * 4)]}반장 협력사`;

            newCompanies.push({
                name: `${name}_${Math.floor(Math.random() * 1000)}`,
                code: Math.random().toString(36).substr(2, 6).toUpperCase(),
                ceoName: `대표${i}`,
                businessNumber: `${Math.floor(Math.random() * 999)}-${Math.floor(Math.random() * 99)}-${Math.floor(Math.random() * 99999)}`,
                type
            });
        }
        setTestCompanies(newCompanies);
        setLoading(false);
    };

    const registerCompanies = async () => {
        if (testCompanies.length === 0) return;
        setLoading(true);
        try {
            for (const c of testCompanies) {
                await companyService.addCompany({
                    ...c,
                    address: '서울시 강남구',
                    phone: '02-1234-5678',
                    email: 'test@example.com'
                });
            }
            alert(`${testCompanies.length}개 회사 등록 완료`);
            setTestCompanies([]);
            fetchData();
        } catch (e) {
            console.error(e);
            alert('회사 등록 실패');
        } finally {
            setLoading(false);
        }
    };

    // 2. Worker Generator
    const generateTestWorkers = () => {
        setLoading(true);
        const newWorkers: TestWorkerData[] = [];
        const surnames = ['김', '이', '박', '최', '정'];
        const names = ['민수', '철수', '영희', '지훈', '서준'];

        for (let i = 0; i < counts.worker; i++) {
            newWorkers.push({
                name: `${surnames[Math.floor(Math.random() * surnames.length)]}${names[Math.floor(Math.random() * names.length)]}`,
                idNumber: '900101-1234567',
                contact: `010-${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
                bankName: '국민은행',
                accountNumber: '123-456-789012',
                accountHolder: '예금주',
                address: '서울시',
                role: '조공',
                unitPrice: 150000
            });
        }
        setTestWorkers(newWorkers);
        setLoading(false);
    };

    const registerWorkers = async () => {
        if (testWorkers.length === 0) return;
        setLoading(true);
        try {
            for (const w of testWorkers) {
                await manpowerService.addWorker({
                    ...w,
                    email: '',
                    teamType: '',
                    teamName: '',
                    status: 'active',
                    salaryModel: '일급'
                });
            }
            alert(`${testWorkers.length}명 작업자 등록 완료`);
            setTestWorkers([]);
            fetchData();
        } catch (e) {
            console.error(e);
            alert('작업자 등록 실패');
        } finally {
            setLoading(false);
        }
    };

    // 3. Team Generator (Links to Company & Worker)
    const generateTestTeams = () => {
        if (companies.length === 0 || workers.length === 0) {
            alert('회사와 작업자 데이터가 먼저 필요합니다.');
            return;
        }
        setLoading(true);
        const newTeams: TestTeamData[] = [];

        for (let i = 0; i < counts.team; i++) {
            const company = companies[Math.floor(Math.random() * companies.length)];
            const leader = workers[Math.floor(Math.random() * workers.length)];

            newTeams.push({
                name: `${leader.name}팀_${Math.floor(Math.random() * 100)}`,
                leaderName: leader.name,
                leaderId: leader.id!,
                companyId: company.id!,
                companyName: company.name
            });
        }
        setTestTeams(newTeams);
        setLoading(false);
    };

    const registerTeams = async () => {
        if (testTeams.length === 0) return;
        setLoading(true);
        try {
            for (const t of testTeams) {
                await teamService.addTeam({
                    ...t,
                    type: '협력사', // Using '협력사' as team type for consistency, though Team type is string
                    memberCount: 1
                });
            }
            alert(`${testTeams.length}개 팀 등록 완료`);
            setTestTeams([]);
            fetchData();
        } catch (e) {
            console.error(e);
            alert('팀 등록 실패');
        } finally {
            setLoading(false);
        }
    };

    // 4. Site Generator (Links to Team)
    const generateTestSites = () => {
        if (teams.length === 0) {
            alert('팀 데이터가 먼저 필요합니다.');
            return;
        }
        setLoading(true);
        const newSites: TestSiteData[] = [];
        const locations = ['서울', '경기', '인천', '부산'];

        for (let i = 0; i < counts.site; i++) {
            const team = teams[Math.floor(Math.random() * teams.length)];
            const loc = locations[Math.floor(Math.random() * locations.length)];

            newSites.push({
                name: `${loc} 현장_${Math.floor(Math.random() * 100)}`,
                responsibleTeamId: team.id!,
                responsibleTeamName: team.name
            });
        }
        setTestSites(newSites);
        setLoading(false);
    };

    const registerSites = async () => {
        if (testSites.length === 0) return;
        setLoading(true);
        try {
            for (const s of testSites) {
                await siteService.addSite({
                    ...s,
                    code: Math.random().toString(36).substr(2, 5).toUpperCase(),
                    address: '주소 미정',
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    status: 'active',
                    responsibleTeamId: s.responsibleTeamId,
                    responsibleTeamName: s.responsibleTeamName
                });
            }
            alert(`${testSites.length}개 현장 등록 완료`);
            setTestSites([]);
            fetchData();
        } catch (e) {
            console.error(e);
            alert('현장 등록 실패');
        } finally {
            setLoading(false);
        }
    };

    // 5. Daily Report Generator
    const generateTestReports = () => {
        if (sites.length === 0 || teams.length === 0 || workers.length === 0) {
            alert('현장, 팀, 작업자 데이터가 모두 필요합니다.');
            return;
        }
        setLoading(true);
        const newReports: DailyReport[] = [];

        const startDate = new Date('2025-09-01').getTime();
        const endDate = new Date().getTime();

        for (let i = 0; i < counts.report; i++) {
            const site = sites[Math.floor(Math.random() * sites.length)];
            // Find team assigned to this site or random
            const team = teams.find(t => t.id === site.responsibleTeamId) || teams[0];

            // Random Date between 2025-09-01 and Today
            const randomDate = new Date(startDate + Math.random() * (endDate - startDate));
            const dateStr = randomDate.toISOString().split('T')[0];

            // Random workers
            const reportWorkers: DailyReportWorker[] = [];
            const workerCount = Math.floor(Math.random() * 5) + 1;

            for (let j = 0; j < workerCount; j++) {
                const w = workers[Math.floor(Math.random() * workers.length)];
                reportWorkers.push({
                    workerId: w.id!,
                    name: w.name,
                    role: w.role || '작업자',
                    status: 'attendance',
                    manDay: 1,
                    workContent: '작업내용',
                    teamId: team.id!,
                    unitPrice: w.unitPrice || 150000,
                    salaryModel: w.teamType === '지원팀' ? '지원팀'
                        : w.teamType === '용역팀' ? '용역팀'
                            : w.salaryModel || '일급제'
                });
            }

            newReports.push({
                date: dateStr,
                siteId: site.id!,
                siteName: site.name,
                teamId: team.id!,
                teamName: team.name,
                responsibleTeamId: site.responsibleTeamId || '',
                responsibleTeamName: site.responsibleTeamName || '',
                writerId: 'test',
                workers: reportWorkers,
                totalManDay: workerCount
            });
        }
        setTestReports(newReports);
        setLoading(false);
    };

    const registerReports = async () => {
        if (testReports.length === 0) return;
        setLoading(true);
        try {
            await dailyReportService.addReportsBatch(testReports);
            alert(`${testReports.length}개 일보 등록 완료`);
            setTestReports([]);
        } catch (e) {
            console.error(e);
            alert('일보 등록 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto bg-slate-50 min-h-screen font-['Pretendard']">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-800">
                    <FontAwesomeIcon icon={faArrowLeft} size="lg" />
                </button>
                <h1 className="text-2xl font-bold text-slate-800">테스트 데이터 생성기</h1>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 shadow-sm">
                <h3 className="text-blue-800 font-bold mb-3 flex items-center gap-2 text-lg">
                    <FontAwesomeIcon icon={faExclamationCircle} />
                    사용 가이드 (필독)
                </h3>
                <p className="text-blue-700 mb-4">
                    데이터 간의 연결 관계를 위해 반드시 <strong>아래 순서대로</strong> 진행해주세요.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {[
                        { step: 1, title: '회사 데이터', desc: '시공팀/건설사 생성' },
                        { step: 2, title: '작업자 데이터', desc: '팀장 후보 생성' },
                        { step: 3, title: '팀 데이터', desc: '회사-팀장 연결' },
                        { step: 4, title: '현장 데이터', desc: '담당팀 연결' },
                        { step: 5, title: '일보 데이터', desc: '최종 테스트 데이터' },
                    ].map((item, idx) => (
                        <div key={idx} className="bg-white p-3 rounded border border-blue-100 flex flex-col items-center text-center">
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mb-2">
                                {item.step}
                            </div>
                            <div className="font-bold text-blue-900 text-sm">{item.title}</div>
                            <div className="text-xs text-blue-600 mt-1">{item.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Company */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
                            회사 데이터
                        </h2>
                        <span className="text-sm text-slate-500">현재: {companies.length}개</span>
                    </div>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="number"
                            value={counts.company}
                            onChange={e => setCounts({ ...counts, company: +e.target.value })}
                            className="w-20 border rounded px-2"
                        />
                        <button onClick={generateTestCompanies} className="bg-slate-100 px-3 py-1 rounded hover:bg-slate-200">생성</button>
                        <button onClick={registerCompanies} disabled={testCompanies.length === 0} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">등록</button>
                    </div>
                    {testCompanies.length > 0 && (
                        <div className="bg-slate-50 p-2 rounded text-xs max-h-32 overflow-y-auto">
                            {testCompanies.map((c, i) => <div key={i}>{c.name} ({c.type})</div>)}
                        </div>
                    )}
                </div>

                {/* 2. Worker */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">2</span>
                            작업자 데이터
                        </h2>
                        <span className="text-sm text-slate-500">현재: {workers.length}명</span>
                    </div>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="number"
                            value={counts.worker}
                            onChange={e => setCounts({ ...counts, worker: +e.target.value })}
                            className="w-20 border rounded px-2"
                        />
                        <button onClick={generateTestWorkers} className="bg-slate-100 px-3 py-1 rounded hover:bg-slate-200">생성</button>
                        <button onClick={registerWorkers} disabled={testWorkers.length === 0} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50">등록</button>
                    </div>
                    {testWorkers.length > 0 && (
                        <div className="bg-slate-50 p-2 rounded text-xs max-h-32 overflow-y-auto">
                            {testWorkers.map((w, i) => <div key={i}>{w.name}</div>)}
                        </div>
                    )}
                </div>

                {/* 3. Team */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">3</span>
                            팀 데이터
                        </h2>
                        <span className="text-sm text-slate-500">현재: {teams.length}개</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">* 회사와 작업자(팀장)가 연결됩니다.</p>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="number"
                            value={counts.team}
                            onChange={e => setCounts({ ...counts, team: +e.target.value })}
                            className="w-20 border rounded px-2"
                        />
                        <button onClick={generateTestTeams} className="bg-slate-100 px-3 py-1 rounded hover:bg-slate-200">생성</button>
                        <button onClick={registerTeams} disabled={testTeams.length === 0} className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:opacity-50">등록</button>
                    </div>
                    {testTeams.length > 0 && (
                        <div className="bg-slate-50 p-2 rounded text-xs max-h-32 overflow-y-auto">
                            {testTeams.map((t, i) => <div key={i}>{t.name} (팀장: {t.leaderName}, 회사: {t.companyName})</div>)}
                        </div>
                    )}
                </div>

                {/* 4. Site */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs">4</span>
                            현장 데이터
                        </h2>
                        <span className="text-sm text-slate-500">현재: {sites.length}개</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">* 담당 팀이 연결됩니다.</p>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="number"
                            value={counts.site}
                            onChange={e => setCounts({ ...counts, site: +e.target.value })}
                            className="w-20 border rounded px-2"
                        />
                        <button onClick={generateTestSites} className="bg-slate-100 px-3 py-1 rounded hover:bg-slate-200">생성</button>
                        <button onClick={registerSites} disabled={testSites.length === 0} className="bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 disabled:opacity-50">등록</button>
                    </div>
                    {testSites.length > 0 && (
                        <div className="bg-slate-50 p-2 rounded text-xs max-h-32 overflow-y-auto">
                            {testSites.map((s, i) => <div key={i}>{s.name} (담당: {s.responsibleTeamName})</div>)}
                        </div>
                    )}
                </div>

                {/* 5. Daily Report */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">5</span>
                            일보 데이터 (테스트용)
                        </h2>
                        <span className="text-sm text-slate-500">생성 대기: {testReports.length}건</span>
                    </div>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="number"
                            value={counts.report}
                            onChange={e => setCounts({ ...counts, report: +e.target.value })}
                            className="w-20 border rounded px-2"
                        />
                        <button onClick={generateTestReports} className="bg-slate-100 px-3 py-1 rounded hover:bg-slate-200">생성</button>
                        <button onClick={registerReports} disabled={testReports.length === 0} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50">등록</button>
                    </div>
                    {testReports.length > 0 && (
                        <div className="bg-slate-50 p-2 rounded text-xs max-h-32 overflow-y-auto">
                            {testReports.map((r, i) => <div key={i}>{r.date} / {r.siteName} / {r.teamName} / {r.workers.length}명</div>)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TestSettingsPage;
