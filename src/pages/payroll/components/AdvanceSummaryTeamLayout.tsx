import React from 'react';

export type AdvanceSummaryLayout = 'compact' | 'wide';

export default function AdvanceSummaryTeamLayout({ mode, children }: { mode: AdvanceSummaryLayout; children: React.ReactNode }) {
    const columns = Math.min(3, Math.max(1, React.Children.count(children)));
    return <div className="as-team-viewport" role="region" aria-label="팀별 가불목록 가로 보기" tabIndex={0}>
        <div className={`as-team-grid as-team-grid-${mode}`} role="group" aria-label="팀별 가불목록"
            style={{ '--as-excel-columns': columns } as React.CSSProperties}>{children}</div>
    </div>;
}
