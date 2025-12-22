import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFlask, faBuilding, faUserGroup, faHelmetSafety, faMapLocationDot, faFileLines, faTrash, faCheck } from '@fortawesome/free-solid-svg-icons';
import { companyService } from '../../services/companyService';
import { teamService } from '../../services/teamService';
import { manpowerService } from '../../services/manpowerService';
import { siteService } from '../../services/siteService';
import { dailyReportService } from '../../services/dailyReportService';

const TestDataGeneratorPage: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const addLog = (message: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
    };

    const generateCompanies = async () => {
        setLoading(true);
        addLog("회사 데이터 생성 시작...");
        try {
            const companies = [
                {
                    name: "전국건설",
                    businessNumber: "123-45-67890",
                    ceoName: "김대표",
                    address: "서울시 강남구",
                    code: "C001",
                    phone: "02-111-1111",
                    type: "건설사" as const,
                    siteName: "본사",
                    siteManager: "김관리",
                    status: "active" as const
                },
                {
                    name: "청연ENG",
                    businessNumber: "234-56-78901",
                    ceoName: "이대표",
                    address: "경기도 성남시",
                    code: "C002",
                    phone: "031-222-2222",
                    type: "건설사" as const,
                    siteName: "경기지사",
                    siteManager: "이관리",
                    status: "active" as const
                },
                {
                    name: "미래건설",
                    businessNumber: "345-67-89012",
                    ceoName: "박대표",
                    address: "인천시 송도",
                    code: "C003",
                    phone: "032-333-3333",
                    type: "건설사" as const,
                    siteName: "인천지사",
                    siteManager: "박관리",
                    status: "active" as const
                }
            ];

            for (const company of companies) {
                await companyService.addCompany(company);
                addLog(`회사 생성: ${company.name} (${company.type})`);
            }
            addLog("회사 데이터 생성 완료!");
        } catch (error) {
            addLog(`오류 발생: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const generateTeams = async () => {
        setLoading(true);
        addLog("팀 데이터 생성 시작...");
        try {
            const companies = await companyService.getCompanies();
            const constructionCompanies = companies.filter(c => c.type === '건설사');

            if (constructionCompanies.length === 0) {
                addLog("오류: '건설사' 타입의 회사가 없습니다.");
                setLoading(false);
                return;
            }

            // 1. 일반 시공팀 생성
            for (let i = 0; i < 6; i++) {
                const company = constructionCompanies[i % constructionCompanies.length];
                const teamName = `[${company.name}] ${i + 1}팀`;
                const leaderName = `[${company.name}] ${i + 1}팀장`;

                await teamService.addTeam({
                    name: teamName,
                    leaderName: leaderName,
                    leaderId: "temp_id",
                    companyId: company.id,
                    companyName: company.name,
                    type: "시공팀",
                    memberCount: 0
                });
                addLog(`시공팀 생성: ${teamName}`);
            }

            // 2. 지원팀 생성 (모든 건설사 대상)
            for (const company of constructionCompanies) {
                // 각 회사별로 1~2개 지원팀 생성
                for (let i = 1; i <= 2; i++) {
                    const teamName = `[${company.name}] 지원${i}팀`;
                    const leaderName = `[${company.name}] 지원${i}팀장`;

                    await teamService.addTeam({
                        name: teamName,
                        leaderName: leaderName,
                        leaderId: "temp_id",
                        companyId: company.id,
                        companyName: company.name,
                        type: "지원팀",
                        memberCount: 0
                    });
                    addLog(`지원팀 생성: ${teamName}`);
                }
            }

            addLog("팀 데이터 생성 완료!");
        } catch (error) {
            addLog(`오류 발생: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const generateSites = async () => {
        setLoading(true);
        addLog("현장 데이터 생성 시작...");
        try {
            const companies = await companyService.getCompanies();
            if (companies.length === 0) {
                addLog("오류: 회사가 없습니다.");
                setLoading(false);
                return;
            }

            const teams = await teamService.getTeams();
            const siteLocations = [
                { name: "서울 아파트", address: "서울시 강남구", code: "S001" },
                { name: "부산 항만", address: "부산시 해운대구", code: "S002" },
                { name: "인천 공항", address: "인천시 중구", code: "S003" },
                { name: "대구 스타디움", address: "대구시 수성구", code: "S004" },
                { name: "광주 쇼핑몰", address: "광주시 서구", code: "S005" },
                { name: "대전 과학단지", address: "대전시 유성구", code: "S006" }
            ];

            for (let i = 0; i < siteLocations.length; i++) {
                const location = siteLocations[i];
                const company = companies[i % companies.length];
                const siteName = `[${company.name}] ${location.name}`;

                // 책임 팀 배정
                let responsibleTeamId = '';
                let responsibleTeamName = '';
                if (teams.length > 0) {
                    const companyTeams = teams.filter(t => t.companyId === company.id);
                    const targetTeams = companyTeams.length > 0 ? companyTeams : teams;
                    const randomTeam = targetTeams[Math.floor(Math.random() * targetTeams.length)];
                    responsibleTeamId = randomTeam.id || '';
                    responsibleTeamName = randomTeam.name;
                }

                await siteService.addSite({
                    name: siteName,
                    address: location.address,
                    code: location.code,
                    status: "active",
                    startDate: "2024-01-01",
                    endDate: "2025-12-31",
                    companyId: company.id,
                    companyName: company.name,
                    responsibleTeamId: responsibleTeamId,
                    responsibleTeamName: responsibleTeamName
                });
                addLog(`현장 생성: ${siteName}`);
            }
            addLog("현장 데이터 생성 완료!");
        } catch (error) {
            addLog(`오류 발생: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const generateWorkers = async () => {
        setLoading(true);
        addLog("작업자 데이터 생성 시작...");
        try {
            const teams = await teamService.getTeams();
            if (teams.length === 0) {
                addLog("오류: 팀이 없습니다.");
                setLoading(false);
                return;
            }

            let totalWorkers = 0;
            for (const team of teams) {
                // 팀 타입에 따라 작업자 타입 결정
                const isSupportTeam = team.type === '지원팀';

                // 각 팀당 10명 생성
                for (let i = 1; i <= 10; i++) {
                    const role = i === 1 ? "팀장" : "작업자";
                    const workerName = `${team.name} ${role} ${i === 1 ? '' : i - 1}`.trim();

                    await manpowerService.addWorker({
                        name: workerName,
                        idNumber: `900101-1${String(i).padStart(6, '0')}`,
                        contact: `010-1234-${String(totalWorkers).padStart(4, '0')}`,
                        address: "서울시 어딘가",
                        role: role,
                        teamId: team.id,
                        teamName: team.name,
                        status: "재직",
                        unitPrice: 150000 + (i * 1000),
                        // 팀이 지원팀이면 작업자도 지원팀, 아니면 팀소속
                        teamType: isSupportTeam ? "지원팀" : "팀소속",
                        salaryModel: "일급제"
                    }, false);
                    totalWorkers++;
                }
                addLog(`팀 [${team.name}] 작업자 10명 생성 (${isSupportTeam ? '지원팀' : '일반팀'})`);
            }
            addLog(`총 ${totalWorkers}명 작업자 데이터 생성 완료!`);
        } catch (error) {
            addLog(`오류 발생: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const generateDailyReports = async (scenario: string) => {
        setLoading(true);
        addLog(`일보 데이터 생성 시작 (시나리오: ${scenario})...`);
        try {
            const sites = await siteService.getSites();
            const teams = await teamService.getTeams();
            const workers = await manpowerService.getWorkers();

            if (sites.length === 0 || teams.length === 0 || workers.length === 0) {
                addLog("오류: 현장, 팀, 또는 작업자 데이터가 없습니다.");
                setLoading(false);
                return;
            }

            const constructionTeams = teams.filter(t => t.type === '시공팀');
            const supportTeams = teams.filter(t => t.type === '지원팀');

            let count = 0;
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth() + 1; // 1월은 0이므로 +1

            // 지난 30일간의 데이터 생성
            for (let d = 30; d >= 0; d--) {
                const date = new Date(year, month - 1, today.getDate() - d);
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const dayOfWeek = date.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일

                let dailyWeather = "맑음";
                if (scenario === 'rain' && Math.random() < 0.4) { // 장마 시나리오에서 40% 확률로 비
                    dailyWeather = "비";
                }

                // 시나리오에 따른 작업 여부 결정
                let shouldWork = true;
                if (scenario === 'standard' && dayOfWeek === 0) { // 기본 시나리오: 일요일 휴무
                    shouldWork = false;
                }
                if (dailyWeather === '비' && Math.random() < 0.7) { // 비 오는 날 70% 확률로 작업 안함
                    shouldWork = false;
                }

                if (!shouldWork) {
                    // addLog(`${dateStr}: 휴무 또는 우천으로 작업 없음.`);
                    continue;
                }

                // 각 현장에 대해 일보 생성
                for (const site of sites) {
                    // 현장 책임 팀 투입
                    const responsibleTeam = teams.find(t => t.id === site.responsibleTeamId);
                    if (responsibleTeam) {
                        const teamWorkers = workers.filter(w => w.teamId === responsibleTeam.id);
                        if (teamWorkers.length > 0) {
                            const numWorkers = Math.floor(Math.random() * (teamWorkers.length / 2)) + Math.ceil(teamWorkers.length / 2); // 절반 이상 투입
                            const selectedWorkers = teamWorkers.slice(0, numWorkers);

                            let manDay = 1; // 기본 1공수
                            if (scenario === 'full' && Math.random() < 0.5) manDay = 1.5; // 풀가동 시 50% 확률로 1.5공수
                            if (scenario === 'rain') manDay = 0.5; // 장마 시 0.5공수

                            const mappedWorkers = selectedWorkers.map(w => ({
                                workerId: w.id,
                                name: w.name,
                                role: w.role,
                                unitPrice: w.unitPrice,
                                manDay: manDay
                            }));

                            await dailyReportService.addReport({
                                date: dateStr,
                                siteId: site.id!,
                                siteName: site.name,
                                teamId: responsibleTeam.id!,
                                teamName: responsibleTeam.name,
                                writerId: 'system',
                                totalManDay: mappedWorkers.reduce((s, w) => s + w.manDay, 0),
                                totalAmount: mappedWorkers.reduce((s, w) => s + (w.unitPrice || 0) * w.manDay, 0),
                                weather: dailyWeather,
                                workContent: `${responsibleTeam.name} 일반 시공`,
                                workers: mappedWorkers as any[]
                            });
                            count++;
                        }
                    }

                    // 시나리오에 따라 지원팀 랜덤 투입
                    if (supportTeams.length > 0 && Math.random() < (scenario === 'finish' ? 0.8 : 0.2)) { // 마감 시나리오에서 80%, 그 외 20% 확률
                        const supportTeam = supportTeams[Math.floor(Math.random() * supportTeams.length)];
                        const supportWorkers = workers.filter(w => w.teamId === supportTeam.id);

                        if (supportWorkers.length > 0) {
                            const numSupportWorkers = Math.floor(Math.random() * (supportWorkers.length / 2)) + 1; // 1명 이상 절반까지
                            const selectedSupportWorkers = supportWorkers.slice(0, numSupportWorkers);

                            let manDay = 1;
                            if (scenario === 'finish' && Math.random() < 0.7) manDay = 1.5; // 마감 시 70% 확률로 1.5공수

                            const mappedSupportWorkers = selectedSupportWorkers.map(w => ({
                                workerId: w.id,
                                name: w.name,
                                role: w.role,
                                unitPrice: w.unitPrice,
                                manDay: manDay
                            }));

                            await dailyReportService.addReport({
                                date: dateStr,
                                siteId: site.id!,
                                siteName: site.name,
                                teamId: supportTeam.id!,
                                teamName: supportTeam.name,
                                writerId: 'system',
                                totalManDay: mappedSupportWorkers.reduce((s, w) => s + w.manDay, 0),
                                totalAmount: mappedSupportWorkers.reduce((s, w) => s + (w.unitPrice || 0) * w.manDay, 0),
                                weather: dailyWeather,
                                workContent: scenario === 'finish' ? '마감 긴급 지원' : '긴급 지원 작업',
                                workers: mappedSupportWorkers as any[]
                            });
                            count++;
                        }
                    }
                }
                if (d % 10 === 0) addLog(`${d}일 전 (시나리오: ${scenario}) 생성 중...`);
            }

            addLog(`총 ${count}개 일보 데이터 생성 완료 (${scenario} 모드)!`);
        } catch (error) {
            addLog(`오류 발생: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const clearAllData = async () => {
        if (!window.confirm("일보 데이터를 제외한 모든 기본 데이터(회사/팀/현장/작업자)를 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다.)")) return;

        setLoading(true);
        addLog("데이터 초기화(일보 제외) 시작...");
        try {
            // 1. 일보 삭제 (사용자 요청으로 제외)
            /* 
            const reports = await dailyReportService.getAllReports();
            addLog(`일보 데이터 ${reports.length}개 삭제 중...`);

            const reportIds = reports.map(r => r.id!).filter(id => id);
            if (reportIds.length > 0) {
                await dailyReportService.deleteReports(reportIds);
            }
            addLog(`일보 데이터 ${reports.length}개 삭제 완료`);
            */
            addLog("일보 데이터 삭제 건너뜀 (보존)");

            // 2. 작업자 삭제
            const workers = await manpowerService.getWorkers();
            const workerIds = workers.map(w => w.id!).filter(id => id);
            if (workerIds.length > 0) {
                // 500개씩 끊어서 삭제
                for (let i = 0; i < workerIds.length; i += 500) {
                    const chunk = workerIds.slice(i, i + 500);
                    await manpowerService.deleteWorkers(chunk);
                }
            }
            addLog(`작업자 데이터 ${workers.length}개 삭제 완료`);

            // 3. 현장 삭제
            const sites = await siteService.getSites();
            for (const site of sites) {
                if (site.id) await siteService.deleteSite(site.id);
            }
            addLog(`현장 데이터 ${sites.length}개 삭제 완료`);

            // 4. 팀 삭제
            const teams = await teamService.getTeams();
            for (const team of teams) {
                if (team.id) await teamService.deleteTeam(team.id);
            }
            addLog(`팀 데이터 ${teams.length}개 삭제 완료`);

            // 5. 회사 삭제
            const companies = await companyService.getCompanies();
            for (const company of companies) {
                if (company.id) await companyService.deleteCompany(company.id);
            }
            addLog(`회사 데이터 ${companies.length}개 삭제 완료`);

            addLog("기본 데이터 초기화 완료 (일보 데이터는 보존됨)!");
        } catch (error) {
            addLog(`오류 발생: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3 mb-2">
                    <FontAwesomeIcon icon={faFlask} className="text-brand-600" />
                    테스트 데이터 생성기 v2.0
                </h1>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                        <FontAwesomeIcon icon={faCheck} /> 사용 가이드
                    </h3>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li><strong>기본 데이터 삭제</strong> 버튼을 눌러 회사/팀/현장/작업자 데이터를 초기화합니다. (일보 데이터는 유지됩니다)</li>
                        <li><strong>1. 회사 생성</strong>부터 <strong>4. 작업자 생성</strong>까지 순서대로 버튼을 클릭합니다.</li>
                        <li>각 단계가 완료될 때까지 기다려주세요. (로그 창 확인)</li>
                        <li>모든 생성이 완료되면 <strong>통합 현황판</strong> 메뉴에서 데이터를 확인하세요.</li>
                    </ol>
                    <p className="mt-2 text-xs text-blue-600">
                        * 지원팀 테스트를 위해 '지원팀' 타입의 팀과 작업자가 자동으로 생성되며,
                        일보 생성 시 랜덤하게 지원팀이 현장에 투입되는 시나리오가 포함되어 있습니다.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* 1. 회사 생성 */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <FontAwesomeIcon icon={faBuilding} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">1. 회사 데이터</h3>
                            <p className="text-xs text-slate-500">3개 회사 생성</p>
                        </div>
                    </div>
                    <button
                        onClick={generateCompanies}
                        disabled={loading}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
                    >
                        회사 생성
                    </button>
                </div>

                {/* 2. 팀 생성 */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <FontAwesomeIcon icon={faUserGroup} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">2. 팀 데이터</h3>
                            <p className="text-xs text-slate-500">시공팀 6개 + 지원팀 2개</p>
                        </div>
                    </div>
                    <button
                        onClick={generateTeams}
                        disabled={loading}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 transition-colors"
                    >
                        팀 생성
                    </button>
                </div>

                {/* 3. 현장 생성 */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <FontAwesomeIcon icon={faMapLocationDot} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">3. 현장 데이터</h3>
                            <p className="text-xs text-slate-500">6개 현장 생성</p>
                        </div>
                    </div>
                    <button
                        onClick={generateSites}
                        disabled={loading}
                        className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 transition-colors"
                    >
                        현장 생성
                    </button>
                </div>

                {/* 4. 작업자 생성 */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                            <FontAwesomeIcon icon={faHelmetSafety} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">4. 작업자 데이터</h3>
                            <p className="text-xs text-slate-500">팀별 10명 (지원팀 포함)</p>
                        </div>
                    </div>
                    <button
                        onClick={generateWorkers}
                        disabled={loading}
                        className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-300 transition-colors"
                    >
                        작업자 생성
                    </button>
                </div>

                {/* 5. 일보 생성 */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <FontAwesomeIcon icon={faFileLines} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">5. 일보 데이터</h3>
                            <p className="text-xs text-slate-500">다양한 시나리오 테스트</p>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="text-xs font-bold text-slate-500 mb-1 block">테스트 시나리오 선택</label>
                        <select
                            className="w-full text-sm border-slate-200 rounded-lg focus:ring-purple-500 focus:border-purple-500 mb-2"
                            id="scenario-select"
                            defaultValue="standard"
                        >
                            <option value="standard">📅 [기본] 월 25일 가동 (일요일 휴무)</option>
                            <option value="full">🔥 [골조] 풀가동 (휴일 없음/야근)</option>
                            <option value="rain">☔ [장마] 우천 다발 (공수 저조)</option>
                            <option value="finish">✨ [마감] 지원팀 집중 투입</option>
                        </select>
                    </div>

                    <button
                        onClick={async () => {
                            const scenario = (document.getElementById('scenario-select') as HTMLSelectElement).value;
                            await generateDailyReports(scenario);
                        }}
                        disabled={loading}
                        className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 transition-colors"
                    >
                        일보 생성
                    </button>
                </div>

                {/* 초기화 */}
                <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                            <FontAwesomeIcon icon={faTrash} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">기본 데이터 삭제</h3>
                            <p className="text-xs text-slate-500">회사/팀/현장/작업자 삭제</p>
                        </div>
                    </div>
                    <button
                        onClick={clearAllData}
                        disabled={loading}
                        className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-300 transition-colors"
                    >
                        삭제 (일보 제외)
                    </button>
                </div>
            </div>

            {/* 로그 영역 */}
            <div className="bg-slate-900 rounded-xl p-6 text-slate-300 font-mono text-sm h-96 overflow-y-auto shadow-inner">
                <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <span className="font-bold text-white">System Logs</span>
                    <button onClick={() => setLogs([])} className="text-xs hover:text-white">Clear Logs</button>
                </div>
                <div className="space-y-1">
                    {logs.length === 0 && <span className="text-slate-600 italic">대기 중...</span>}
                    {logs.map((log, index) => (
                        <div key={index} className="break-all">
                            <span className="text-green-500 mr-2">➜</span>
                            {log}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TestDataGeneratorPage;
