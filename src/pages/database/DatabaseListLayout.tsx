import React, { useId, useState } from 'react';
import './DatabaseListLayout.css';

interface Column {
    key: string;
    label: string;
}

export function useDatabaseListLayout(
    columns: Column[],
    visibleColumns: string[],
    detailKeys: string[],
    weights: Record<string, number>,
) {
    const id = useId();
    const [twoLine, setTwoLine] = useState(true);
    const visible = columns.filter(column => visibleColumns.includes(column.key));
    const groups = [
        visible.filter(column => column.key !== 'manage' && !detailKeys.includes(column.key)),
        visible.filter(column => detailKeys.includes(column.key)),
    ].filter(group => group.length > 0);
    const positions = new Map(groups.flatMap((group, row) => {
        const total = group.reduce((sum, column) => sum + (weights[column.key] ?? 1), 0);
        return group.map(column => [column.key, {
            row,
            width: `${(weights[column.key] ?? 1) / total * 100}%`,
        }] as const);
    }));
    return {
        id, twoLine, setTwoLine, positions,
        columns: twoLine ? [...groups.flat(), ...visible.filter(column => column.key === 'manage')] : visible,
        hasActions: visible.some(column => column.key === 'manage'),
        className: `database-list-table ${twoLine ? 'database-list-table--two-line' : 'database-list-table--standard'}`,
    };
}

type Layout = ReturnType<typeof useDatabaseListLayout>;

export function DatabaseListViewToggle({ layout }: { layout: Layout }) {
    return <div className="database-list-view-toggle" role="group" aria-label="목록 보기 방식">
        <button type="button" aria-pressed={layout.twoLine} onClick={() => layout.setTwoLine(true)}>두 줄 보기</button>
        <button type="button" aria-pressed={!layout.twoLine} onClick={() => layout.setTwoLine(false)}>표 보기</button>
    </div>;
}

export function DatabaseListHeading({ layout, title, hint }: { layout: Layout; title: string; hint: string }) {
    if (!layout.twoLine) return null;
    return <th className="database-list-heading" aria-hidden="true">
        <span>{title}</span><span className="database-list-heading-hint">{hint}</span>
        {layout.hasActions && <span className="database-list-actions-heading">관리</span>}
    </th>;
}

export function DatabaseListCell({ column, layout, className, children }: {
    column: Column;
    layout: Layout;
    className?: string;
    children: React.ReactNode;
}) {
    const position = layout.positions.get(column.key);
    return <td
        className={`${className ?? ''} database-list-cell`}
        headers={`${layout.id}-${column.key}`}
        data-column={column.key}
        data-detail-row={layout.twoLine && position && position.row > 0 ? true : undefined}
        style={layout.twoLine && position ? { flexBasis: position.width } : undefined}
    >
        {layout.twoLine ? <>
            <span className="database-list-field-label" aria-hidden="true">{column.label}</span>
            <div className="database-list-field-value">{children}</div>
        </> : children}
    </td>;
}
