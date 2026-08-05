import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faChevronLeft,
  faChevronRight,
  faEyeSlash,
  faGlobe,
  faLock,
  faSearch,
} from '@fortawesome/free-solid-svg-icons';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { useTableState } from '../../hooks/useTableState';
import {
  buildPermissionMatrix,
  type PermissionMatrixRole,
  type PermissionMatrixRow,
} from '../../features/permission-matrix/permissionMatrix';
import type { SiteDataType } from '../../types/menu';

interface PermissionMatrixPanelProps {
  menuData: SiteDataType | null;
  roles: PermissionMatrixRole[];
  selectedSite?: string;
}

const roleBadgeColors: Record<string, string> = {
  gray: 'bg-slate-100 text-slate-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  slate: 'bg-slate-100 text-slate-700',
  red: 'bg-red-100 text-red-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  pink: 'bg-pink-100 text-pink-700',
};

export const PermissionMatrixPanel: React.FC<PermissionMatrixPanelProps> = ({
  menuData,
  roles,
  selectedSite,
}) => {
  const [includeHidden, setIncludeHidden] = React.useState(false);
  const matrix = React.useMemo(
    () => buildPermissionMatrix(menuData, roles, { selectedSite, includeHidden }),
    [menuData, roles, selectedSite, includeHidden]
  );

  const table = useTableState<PermissionMatrixRow>(matrix.rows, {
    searchFields: ['label', 'menuPath', 'route', 'siteName', 'allowedRoleLabels'],
    initialSort: { key: 'menuPath', direction: 'asc' },
    pageSize: 12,
  });

  const columns = React.useMemo<DataTableColumn<PermissionMatrixRow>[]>(() => [
    {
      key: 'menuPath',
      header: '메뉴',
      sortable: true,
      className: 'min-w-[260px]',
      render: (row) => (
        <div className="min-w-0" style={{ paddingLeft: `${Math.min(row.depth, 4) * 14}px` }}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">{row.label}</span>
            {row.hidden && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                <FontAwesomeIcon icon={faEyeSlash} /> 숨김
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-xs text-slate-400">{row.route || row.menuPath}</div>
        </div>
      ),
    },
    {
      key: 'mode',
      header: '범위',
      sortable: true,
      className: 'w-[120px]',
      render: (row) => row.mode === 'global' ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
          <FontAwesomeIcon icon={faGlobe} /> 전체
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
          <FontAwesomeIcon icon={faLock} /> 제한
        </span>
      ),
    },
    {
      key: 'allowedRoleLabels',
      header: '허용 직책',
      sortable: true,
      className: 'min-w-[180px]',
      render: (row) => (
        <span className="line-clamp-2 text-xs font-medium text-slate-600">
          {row.allowedRoleLabels || '허용 직책 없음'}
        </span>
      ),
    },
    ...roles.map((role) => ({
      key: `role:${role.id}`,
      header: role.label,
      className: 'w-[92px] text-center whitespace-nowrap',
      render: (row: PermissionMatrixRow) => (
        <span
          title={`${role.label} ${row.accessByRole[role.id] ? '접근 가능' : '접근 제한'}`}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            row.accessByRole[role.id]
              ? roleBadgeColors[role.color || ''] || 'bg-indigo-100 text-indigo-700'
              : 'bg-slate-100 text-slate-300'
          }`}
        >
          {row.accessByRole[role.id] ? <FontAwesomeIcon icon={faCheck} /> : <FontAwesomeIcon icon={faLock} />}
        </span>
      ),
    })),
  ], [roles]);

  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800">권한 매트릭스</h3>
          <p className="mt-1 text-xs text-slate-500">
            전체 {matrix.rows.length}개 메뉴 중 전체 공개 {matrix.globalCount}개, 직책 제한 {matrix.restrictedCount}개
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block min-w-[260px]">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            <input
              value={table.search}
              onChange={(event) => table.setSearch(event.target.value)}
              placeholder="메뉴, 경로, 직책 검색"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(event) => setIncludeHidden(event.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            숨김 포함
          </label>
        </div>
      </div>

      {matrix.roleSummaries.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          {matrix.roleSummaries.slice(0, 6).map((summary) => (
            <div key={summary.roleId} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="truncate text-xs font-bold text-slate-600">{summary.roleLabel}</div>
              <div className="mt-1 text-sm font-extrabold text-slate-900">{summary.coverageRate}%</div>
              <div className="text-[11px] text-slate-400">허용 {summary.allowedCount} / 제한 {summary.restrictedCount}</div>
            </div>
          ))}
        </div>
      )}

      <DataTable
        rows={table.rows}
        columns={columns}
        getRowKey={(row) => row.id}
        sort={table.sort}
        onSort={table.toggleSort}
        emptyText="조건에 맞는 메뉴 권한이 없습니다."
        className="max-h-[520px] overflow-auto"
      />

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {table.totalRows}개 결과, {table.page} / {table.pageCount} 페이지
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.setPage(table.page - 1)}
            disabled={table.page <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="이전 페이지"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button
            type="button"
            onClick={() => table.setPage(table.page + 1)}
            disabled={table.page >= table.pageCount}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="다음 페이지"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>
    </section>
  );
};
