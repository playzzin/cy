import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faFileInvoiceDollar, faShareNodes, faUsers } from '@fortawesome/free-solid-svg-icons';

const PAYROLL_ISSUE_TABS = [
    {
        path: '/payroll/taxinvoice/issue-list',
        label: '세금계산서 발행리스트',
        icon: faFileInvoiceDollar,
        iconClassName: 'bg-slate-100 text-slate-600'
    },
    {
        path: '/payroll/support-team',
        label: '외부지원간곳',
        icon: faUsers,
        iconClassName: 'bg-amber-50 text-amber-700'
    },
    {
        path: '/payroll/support-team-incoming',
        label: '외부지원온곳',
        icon: faShareNodes,
        iconClassName: 'bg-orange-50 text-orange-700'
    },
    {
        path: '/payroll/support-team-internal',
        label: '내부지원간곳',
        icon: faUsers,
        iconClassName: 'bg-sky-50 text-sky-700'
    },
    {
        path: '/payroll/support-team-internal-incoming',
        label: '내부지원온곳',
        icon: faShareNodes,
        iconClassName: 'bg-indigo-50 text-indigo-700'
    },
    {
        path: '/payroll/support-client-site',
        label: '현장별 지원 정산',
        icon: faBuilding,
        iconClassName: 'bg-emerald-50 text-emerald-700'
    }
];

const PayrollIssueTopTabs: React.FC = () => (
    <nav
        aria-label="세금계산서 및 지원 정산 화면"
        className="min-w-0 shrink-0 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-1.5 font-['Pretendard','Noto_Sans_KR','Malgun_Gothic',sans-serif] shadow-sm"
    >
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
            {PAYROLL_ISSUE_TABS.map((tab) => (
                <NavLink
                    key={tab.path}
                    to={tab.path}
                    end
                    className={({ isActive }) => `group flex min-h-[56px] min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-sm font-bold leading-5 tracking-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:gap-2.5 sm:px-3 ${
                        isActive
                            ? 'border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-900/15'
                            : 'border-transparent bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950'
                    }`}
                >
                    {({ isActive }) => <>
                        <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${isActive ? 'bg-white/15 text-white' : tab.iconClassName}`}>
                            <FontAwesomeIcon icon={tab.icon} />
                        </span>
                        <span className="min-w-0 break-keep">{tab.label}</span>
                        {isActive && <span aria-hidden="true" className="ml-auto hidden h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300 sm:block" />}
                    </>}
                </NavLink>
            ))}
        </div>
    </nav>
);

export default PayrollIssueTopTabs;
