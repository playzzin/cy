import React from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faFileInvoiceDollar, faShareNodes, faUsers } from '@fortawesome/free-solid-svg-icons';

const PAYROLL_ISSUE_TABS = [
    {
        path: '/payroll/taxinvoice/issue-list',
        label: '세금계산서 발행리스트',
        icon: faFileInvoiceDollar
    },
    {
        path: '/payroll/support-team',
        label: '외부지원간곳',
        icon: faUsers,
        isSupportTab: true,
        activeClassName: 'bg-amber-600 text-white shadow-sm shadow-amber-200',
        idleClassName: 'bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-950'
    },
    {
        path: '/payroll/support-team-incoming',
        label: '외부지원온곳',
        icon: faShareNodes,
        isSupportTab: true,
        activeClassName: 'bg-orange-600 text-white shadow-sm shadow-orange-200',
        idleClassName: 'bg-orange-50 text-orange-800 hover:bg-orange-100 hover:text-orange-950'
    },
    {
        path: '/payroll/support-team-internal',
        label: '내부지원간곳',
        icon: faUsers,
        isSupportTab: true,
        activeClassName: 'bg-sky-600 text-white shadow-sm shadow-sky-200',
        idleClassName: 'bg-sky-50 text-sky-800 hover:bg-sky-100 hover:text-sky-950'
    },
    {
        path: '/payroll/support-team-internal-incoming',
        label: '내부지원온곳',
        icon: faShareNodes,
        isSupportTab: true,
        activeClassName: 'bg-indigo-600 text-white shadow-sm shadow-indigo-200',
        idleClassName: 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 hover:text-indigo-950'
    },
    {
        path: '/payroll/support-client-site',
        label: '현장별 지원 정산',
        icon: faBuilding,
        isSupportTab: true,
        activeClassName: 'bg-emerald-600 text-white shadow-sm shadow-emerald-200',
        idleClassName: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950'
    }
];

const PayrollIssueTopTabs: React.FC = () => (
    <nav
        aria-label="세금계산서 및 지원 정산 화면"
        className="min-w-0 shrink-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 font-['Pretendard','Noto_Sans_KR','Malgun_Gothic',sans-serif] shadow-sm"
    >
        <div className="flex min-w-max items-center gap-1">
            {PAYROLL_ISSUE_TABS.map((tab) => (
                <NavLink
                    key={tab.path}
                    to={tab.path}
                    end
                    className={({ isActive }) => `inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-base font-black leading-5 tracking-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                        isActive
                            ? (tab.activeClassName ?? 'bg-slate-900 text-white shadow-sm')
                            : (tab.idleClassName ?? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                    }`}
                >
                    <FontAwesomeIcon icon={tab.icon} />
                    {tab.label}
                </NavLink>
            ))}
        </div>
    </nav>
);

export default PayrollIssueTopTabs;
