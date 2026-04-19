import React from 'react';

const Dashboard3Page: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh' }} className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-6xl font-extrabold text-slate-400 dark:text-slate-600 mb-6">🚧</div>
      <h1 className="text-3xl font-bold text-slate-700 dark:text-slate-200 mb-2">공사중입니다</h1>
      <p className="text-lg text-slate-500 dark:text-slate-400 mb-8">해당 페이지는 현재 준비 중입니다.<br/>빠른 시일 내에 오픈될 예정입니다.</p>
      <div className="text-xs text-slate-400">Dashboard3 / Under Construction</div>
    </div>
  );
};

export default Dashboard3Page;
