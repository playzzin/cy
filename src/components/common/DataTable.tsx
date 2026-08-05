import React from 'react';
import type { TableSortState } from '../../utils/tableState';

export interface DataTableColumn<T> {
  key: keyof T | string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T, index: number) => string;
  sort?: TableSortState<T> | null;
  onSort?: (key: keyof T | string) => void;
  emptyText?: string;
  className?: string;
}

const readPath = (row: any, path: keyof any | string): React.ReactNode => {
  const key = String(path);
  if (!key.includes('.')) return row?.[key] ?? '';
  return key.split('.').reduce((value, segment) => value?.[segment], row) ?? '';
};

export const DataTable = <T extends Record<string, any>>({
  rows,
  columns,
  getRowKey,
  sort,
  onSort,
  emptyText = '표시할 데이터가 없습니다.',
  className = '',
}: DataTableProps<T>) => (
  <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs font-extrabold uppercase text-slate-500">
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              return (
                <th key={String(column.key)} className={`px-4 py-3 ${column.className || ''}`}>
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort?.(column.key)}
                      className="inline-flex items-center gap-1 font-extrabold text-slate-600 hover:text-slate-900"
                    >
                      {column.header}
                      <span className="text-[10px] text-slate-400">
                        {active ? (sort?.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-10 text-center font-bold text-slate-400" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={getRowKey(row, index)} className="transition hover:bg-slate-50">
                {columns.map((column) => (
                  <td key={String(column.key)} className={`px-4 py-3 text-slate-700 ${column.className || ''}`}>
                    {column.render ? column.render(row) : readPath(row, column.key)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);
