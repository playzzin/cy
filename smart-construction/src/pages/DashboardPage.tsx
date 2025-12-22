import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { manpowerService } from '../services/manpowerService';
import { siteService } from '../services/siteService';
import { teamService } from '../services/teamService';
import { dailyReportService } from '../services/dailyReportService';
import { companyService } from '../services/companyService';
import ProfileSetup from '../components/auth/ProfileSetup';
import WeatherWidget from '../components/widgets/WeatherWidget';
import { storage } from '../config/firebase';
import { ref, getDownloadURL, getMetadata } from 'firebase/storage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers, faBuilding, faClipboardList, faHardHat,
  faArrowRight, faChartLine, faCalendarCheck, faFileInvoiceDollar,
  faDatabase, faCog, faSpinner, faHandHoldingDollar, faShieldHalved, faRightLeft,
  faSignature, faPen, faFileSignature, faUserPen, faFileExcel, faMoneyBillTrendUp,
  faPaperPlane, faListCheck
} from '@fortawesome/free-solid-svg-icons';

const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [linkedWorker, setLinkedWorker] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoIsVideo, setLogoIsVideo] = useState<boolean>(false);
  const [stats, setStats] = useState({
    workers: { total: 0, active: 0 },
    sites: { total: 0, active: 0 },
    teams: { total: 0 },
    reports: { today: 0, thisMonth: 0, todayManDay: 0, thisMonthManDay: 0 },
    support: { inbound: 0, outbound: 0, total: 0 },
    recentReports: [] as any[]
  });

  useEffect(() => {
    const initDashboard = async () => {
      if (!currentUser?.uid) {
        setLoading(false);
        return;
      }

      try {
        // 1. Load Logo Video/Image
        try {
          // Try fetching uploaded company logo first
          const customLogoRef = ref(storage, 'settings/company_logo');
          const customUrl = await getDownloadURL(customLogoRef);

          // Fetch metadata to determine if it is a video (since path lacks extension)
          try {
            const metadata = await getMetadata(customLogoRef);
            if (metadata.contentType?.startsWith('video/')) {
              setLogoIsVideo(true);
            } else {
              setLogoIsVideo(false);
            }
          } catch (metaError) {
            // If metadata fetch fails, fallback to URL check
            setLogoIsVideo(customUrl.toLowerCase().includes('.mp4'));
          }

          setLogoUrl(customUrl);
        } catch (error) {
          // Fallback to default video
          try {
            const logoRef = ref(storage, 'logo_cy.mp4');
            const url = await getDownloadURL(logoRef);
            setLogoUrl(url);
            setLogoIsVideo(true); // Default logo is always video
          } catch (defaultError) {
            console.log("Default logo not found, showing placeholder.");
            setLogoUrl(''); // Ensure empty to show placeholder
          }
        }

        // 2. Check Linked Worker
        const worker = await manpowerService.getWorkerByUid(currentUser.uid);
        setLinkedWorker(worker);

        // 3. Fetch Stats Data
        const [workersData, sitesData, teamsData, reportsData, companiesData] = await Promise.all([
          manpowerService.getWorkersPaginated(1000),
          siteService.getSites(),
          teamService.getTeams(),
          dailyReportService.getAllReports(),
          companyService.getCompanies()
        ]);

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const thisMonthStr = todayStr.substring(0, 7);

        // Identify My Company (Default to '청연' or first one)
        const myCompany = companiesData.find(c => c.name.includes('청연')) || companiesData[0];
        const myCompanyId = myCompany?.id;

        // Calculate Support Man-days for This Month
        let inboundManDay = 0;
        let outboundManDay = 0;

        if (myCompanyId) {
          const thisMonthReports = reportsData.filter(r => r.date.startsWith(thisMonthStr));
          const siteMap = new Map(sitesData.map(s => [s.id, s]));
          const teamMap = new Map(teamsData.map(t => [t.id, t]));

          thisMonthReports.forEach(report => {
            const site = siteMap.get(report.siteId);
            const team = teamMap.get(report.teamId);

            if (site && team) {
              const manDay = Number(report.totalManDay) || 0;

              // Inbound: My Site, Other Team (Received Support)
              if (site.companyId === myCompanyId && team.companyId !== myCompanyId) {
                inboundManDay += manDay;
              }
              // Outbound: Other Site, My Team (Sent Support)
              if (site.companyId !== myCompanyId && team.companyId === myCompanyId) {
                outboundManDay += manDay;
              }
            }
          });
        }

        setStats({
          workers: {
            total: workersData.workers.length,
            active: workersData.workers.filter(w => w.status === '재직').length
          },
          sites: {
            total: sitesData.length,
            active: sitesData.filter(s => s.status === 'active').length
          },
          teams: {
            total: teamsData.length
          },
          reports: {
            today: reportsData.filter(r => r.date === todayStr).length,
            thisMonth: reportsData.filter(r => r.date.startsWith(thisMonthStr)).length,
            todayManDay: reportsData.filter(r => r.date === todayStr).reduce((sum, r) => sum + (Number(r.totalManDay) || 0), 0),
            thisMonthManDay: reportsData.filter(r => r.date.startsWith(thisMonthStr)).reduce((sum, r) => sum + (Number(r.totalManDay) || 0), 0)
          },
          support: {
            inbound: inboundManDay,
            outbound: outboundManDay,
            total: inboundManDay + outboundManDay
          },
          recentReports: reportsData
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5)
        });

      } catch (error) {
        console.error("Dashboard data load failed", error);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-brand-600 mb-4" />
          <p className="text-slate-500 font-medium">시스템 데이터를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  // if (!linkedWorker) {
  //   return (
  //     <div className="p-8 bg-slate-50 min-h-screen">
  //       <ProfileSetup onComplete={() => window.location.reload()} />
  //     </div>
  //   );
  // }

  const displayWorker = linkedWorker || { name: '관리자', role: '최고관리자' };

  return (
    <div className="min-h-screen bg-slate-50 font-['Pretendard']">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-6">
              {logoUrl ? (
                logoIsVideo ? (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-32 h-32 rounded-xl object-cover shadow-lg"
                  >
                    <source src={logoUrl} type="video/mp4" />
                  </video>
                ) : (
                  <img
                    src={logoUrl}
                    alt="Company Logo"
                    className="w-32 h-32 rounded-xl object-contain bg-white/10 backdrop-blur-sm shadow-lg"
                  />
                )
              ) : (
                <div className="w-32 h-32 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-3xl">청연</span>
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold mb-2">청연ENG ERP</h1>
                <p className="text-slate-300">Smart Construction Management System</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-medium">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
              <p className="text-slate-400 text-sm">환영합니다, {displayWorker.name}님</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-16">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {/* Workers Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <FontAwesomeIcon icon={faUsers} className="text-2xl text-blue-600" />
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">실시간</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium mb-1">총 등록 작업자</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800">{stats.workers.total}</span>
              <span className="text-sm text-slate-400">명</span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between text-sm">
              <span className="text-slate-500">현재 재직</span>
              <span className="font-medium text-slate-800">{stats.workers.active}명</span>
            </div>
          </div>

          {/* Sites Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <FontAwesomeIcon icon={faBuilding} className="text-2xl text-green-600" />
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">진행중</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium mb-1">관리 현장</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800">{stats.sites.total}</span>
              <span className="text-sm text-slate-400">개소</span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between text-sm">
              <span className="text-slate-500">활성 현장</span>
              <span className="font-medium text-slate-800">{stats.sites.active}개소</span>
            </div>
          </div>

          {/* Teams Card - 운영팀 */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <FontAwesomeIcon icon={faHardHat} className="text-2xl text-purple-600" />
              </div>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Teams</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium mb-1">운영 팀</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800">{stats.teams.total}</span>
              <span className="text-sm text-slate-400">팀</span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between text-sm">
              <span className="text-slate-500">시스템 등록</span>
              <span className="font-medium text-slate-800">완료</span>
            </div>
          </div>

          {/* Reports Card - 오늘의 공수 */}
          <div
            onClick={() => {
              const todayStr = new Date().toISOString().split('T')[0];
              navigate(`/reports/daily?tab=list&date=${todayStr}`);
            }}
            className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-all cursor-pointer group hover:border-orange-200"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="p-3 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                <FontAwesomeIcon icon={faClipboardList} className="text-2xl text-orange-600" />
              </div>
              <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full group-hover:bg-orange-100">Today</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium mb-1 group-hover:text-orange-600 transition-colors">오늘 총공수</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800 group-hover:text-orange-600 transition-colors">{stats.reports.todayManDay}</span>
              <span className="text-sm text-slate-400">공</span>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between text-sm">
              <span className="text-slate-500">이번 달 누적</span>
              <span className="font-medium text-slate-800">{stats.reports.thisMonthManDay}공</span>
            </div>
          </div>

          {/* Support Man-days Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="p-3 bg-teal-50 rounded-lg">
                <FontAwesomeIcon icon={faRightLeft} className="text-2xl text-teal-600" />
              </div>
              <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded-full">이번 달</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium mb-1">지원 현황</h3>
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">지원 공수</span>
                <span className="font-bold text-slate-800 text-lg">{(stats.support.inbound + stats.support.outbound).toFixed(1)}공</span>
              </div>
              <div className="w-full h-px bg-slate-100 my-1"></div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">지원온거</span>
                <span className="font-bold text-teal-600">+{stats.support.inbound.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">지원간거</span>
                <span className="font-bold text-orange-600">-{stats.support.outbound.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faChartLine} className="text-brand-600" />
                빠른 실행
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Row 1 */}
                <button
                  onClick={() => navigate('/reports/daily?tab=input')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-brand-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-brand-100 transition-colors">
                    <FontAwesomeIcon icon={faCalendarCheck} className="text-brand-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">일보 작성</h3>
                  <p className="text-xs text-slate-500">오늘의 작업 내용 기록</p>
                </button>

                <button
                  onClick={() => navigate('/database/manpower-db')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                    <FontAwesomeIcon icon={faDatabase} className="text-blue-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">통합 DB</h3>
                  <p className="text-xs text-slate-500">인력 및 현장 데이터 관리</p>
                </button>

                <button
                  onClick={() => navigate('/payroll/support-team')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-green-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-100 transition-colors">
                    <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-green-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">지원팀 지급</h3>
                  <p className="text-xs text-slate-500">메뉴가 막혀도 여기서 바로 이동</p>
                </button>

                <button
                  onClick={() => navigate('/settings')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-slate-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-slate-100 transition-colors">
                    <FontAwesomeIcon icon={faCog} className="text-slate-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">시스템 설정</h3>
                  <p className="text-xs text-slate-500">환경설정 및 백업</p>
                </button>

                {/* Row 2 - Signature Tools */}
                <button
                  onClick={() => navigate('/payroll/signature-generator')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
                    <FontAwesomeIcon icon={faSignature} className="text-indigo-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">서명 생성기</h3>
                  <p className="text-xs text-slate-500">자동 서명 생성 및 직접 입력</p>
                </button>

                <button
                  onClick={() => navigate('/payroll/wage-payment')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
                    <FontAwesomeIcon icon={faHandHoldingDollar} className="text-emerald-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">급여 지급</h3>
                  <p className="text-xs text-slate-500">급여 대장 및 지급 현황</p>
                </button>

                <button
                  onClick={() => navigate('/payroll/delegation-letter')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-rose-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-rose-100 transition-colors">
                    <FontAwesomeIcon icon={faFileSignature} className="text-rose-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">위임장</h3>
                  <p className="text-xs text-slate-500">본인대리인 급여수령 위임장</p>
                </button>

                <button
                  onClick={() => navigate('/dashboard/site-status')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-purple-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
                    <FontAwesomeIcon icon={faBuilding} className="text-purple-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">현장 현황</h3>
                  <p className="text-xs text-slate-500">현장별 실시간 현황판</p>
                </button>

                <button
                  onClick={() => navigate('/payroll/support-claim')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-violet-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-violet-100 transition-colors">
                    <FontAwesomeIcon icon={faFileExcel} className="text-violet-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">지원비 명세서</h3>
                  <p className="text-xs text-slate-500">일용노무비 지급명세서 작성</p>
                </button>

                <button
                  onClick={() => navigate('/payroll/monthly-wage')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-orange-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-orange-100 transition-colors">
                    <FontAwesomeIcon icon={faListCheck} className="text-orange-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">월급제 집계</h3>
                  <p className="text-xs text-slate-500">월급제 인원 공수 · 지급 관리</p>
                </button>

                <button
                  onClick={() => navigate('/payroll/advance-payment?tab=register')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-amber-100 transition-colors">
                    <FontAwesomeIcon icon={faMoneyBillTrendUp} className="text-amber-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">가불 · 공제</h3>
                  <p className="text-xs text-slate-500">가불 등록 및 공제 현황</p>
                </button>

                <button
                  onClick={() => navigate('/payroll/kakao-notification')}
                  className="p-6 bg-white rounded-xl border border-slate-200 hover:border-cyan-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-cyan-100 transition-colors">
                    <FontAwesomeIcon icon={faPaperPlane} className="text-cyan-600 text-lg" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">알림톡 발송</h3>
                  <p className="text-xs text-slate-500">급여/공지 알림톡 빠른 전송</p>
                </button>
              </div>
            </section>

            {/* Recent Activity */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">최근 일보 활동</h2>
                <button
                  onClick={() => navigate('/reports/daily?tab=list')}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                >
                  전체보기 <FontAwesomeIcon icon={faArrowRight} />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {stats.recentReports.length > 0 ? (
                  stats.recentReports.map((report, index) => (
                    <div key={index} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                          {report.date.substring(5, 10)}
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-800">{report.siteName}</h4>
                          <p className="text-xs text-slate-500">{report.teamName} • 작업자 {report.workers.length}명</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md font-medium">
                          {report.totalManDay} 공수
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    등록된 일보 내역이 없습니다.
                  </div>
                )}
              </div>
            </section>
          </div>



          {/* Side Panel */}
          <div className="space-y-6">
            {/* Weather Widget */}
            <div className="h-80">
              <WeatherWidget />
            </div>

            {/* System Status */}
            <div className="bg-slate-800 rounded-xl p-6 text-white shadow-lg">
              <h3 className="font-bold text-lg mb-4">시스템 상태</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 text-sm">서버 연결</span>
                  <span className="flex items-center gap-2 text-xs font-medium bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    정상
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 text-sm">데이터베이스</span>
                  <span className="flex items-center gap-2 text-xs font-medium bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    연결됨
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 text-sm">마지막 백업</span>
                  <span className="text-xs text-slate-400">오늘 03:00 AM</span>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-slate-700">
                <button
                  onClick={() => navigate('/manual')}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                >
                  사용자 매뉴얼 확인
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
