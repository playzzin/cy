export type SortDirection = 'asc' | 'desc';

export interface TableSortState<T> {
  key: keyof T | string;
  direction: SortDirection;
}

export interface TableViewOptions<T> {
  search?: string;
  searchFields?: Array<keyof T | string>;
  sort?: TableSortState<T> | null;
  page?: number;
  pageSize?: number;
}

export interface TableViewResult<T> {
  rows: T[];
  filteredRows: T[];
  totalRows: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();

const readPath = (row: any, path: keyof any | string): unknown => {
  const key = String(path);
  if (!key.includes('.')) return row?.[key];
  return key.split('.').reduce((value, segment) => value?.[segment], row);
};

export const filterTableRows = <T extends Record<string, any>>(
  rows: T[],
  search: string,
  fields: Array<keyof T | string>
): T[] => {
  const term = normalize(search);
  if (!term) return rows;

  return rows.filter((row) => {
    const values = fields.length > 0 ? fields.map((field) => readPath(row, field)) : Object.values(row);
    return values.some((value) => normalize(value).includes(term));
  });
};

export const sortTableRows = <T extends Record<string, any>>(
  rows: T[],
  sort?: TableSortState<T> | null
): T[] => {
  if (!sort?.key) return rows;

  const directionFactor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = readPath(a, sort.key);
    const right = readPath(b, sort.key);

    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * directionFactor;
    }

    return normalize(left).localeCompare(normalize(right), 'ko-KR', { numeric: true }) * directionFactor;
  });
};

export const paginateTableRows = <T>(
  rows: T[],
  page = 1,
  pageSize = rows.length || 1
): Pick<TableViewResult<T>, 'rows' | 'page' | 'pageSize' | 'pageCount'> => {
  const normalizedPageSize = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / normalizedPageSize));
  const normalizedPage = Math.min(Math.max(1, page), pageCount);
  const start = (normalizedPage - 1) * normalizedPageSize;

  return {
    rows: rows.slice(start, start + normalizedPageSize),
    page: normalizedPage,
    pageSize: normalizedPageSize,
    pageCount,
  };
};

export const buildTableView = <T extends Record<string, any>>(
  rows: T[],
  options: TableViewOptions<T> = {}
): TableViewResult<T> => {
  const filteredRows = sortTableRows(
    filterTableRows(rows, options.search ?? '', options.searchFields ?? []),
    options.sort
  );
  const paginated = paginateTableRows(filteredRows, options.page, options.pageSize);

  return {
    ...paginated,
    filteredRows,
    totalRows: filteredRows.length,
  };
};
