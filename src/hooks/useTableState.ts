import React from 'react';
import {
  buildTableView,
  type TableSortState,
  type TableViewOptions,
} from '../utils/tableState';

export const useTableState = <T extends Record<string, any>>(
  rows: T[],
  options: Omit<TableViewOptions<T>, 'search' | 'sort' | 'page'> & {
    initialSearch?: string;
    initialSort?: TableSortState<T> | null;
    initialPage?: number;
  } = {}
) => {
  const [search, setSearch] = React.useState(options.initialSearch ?? '');
  const [sort, setSort] = React.useState<TableSortState<T> | null>(options.initialSort ?? null);
  const [page, setPage] = React.useState(options.initialPage ?? 1);
  const pageSize = options.pageSize ?? 20;

  React.useEffect(() => {
    setPage(1);
  }, [search, sort?.key, sort?.direction, pageSize]);

  const view = React.useMemo(
    () => buildTableView(rows, {
      search,
      searchFields: options.searchFields,
      sort,
      page,
      pageSize,
    }),
    [rows, search, options.searchFields, sort, page, pageSize]
  );

  const toggleSort = React.useCallback((key: keyof T | string) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }, []);

  return {
    ...view,
    search,
    setSearch,
    sort,
    setSort,
    toggleSort,
    page: view.page,
    setPage,
  };
};
