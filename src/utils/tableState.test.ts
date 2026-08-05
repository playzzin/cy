import { buildTableView, filterTableRows, sortTableRows } from './tableState';

const rows = [
  { id: '1', name: '강남 현장', team: { name: 'A팀' }, amount: 20 },
  { id: '2', name: '서초 현장', team: { name: 'B팀' }, amount: 5 },
  { id: '3', name: '마포 현장', team: { name: 'A팀' }, amount: 100 },
];

describe('tableState', () => {
  it('filters by selected fields and nested paths', () => {
    expect(filterTableRows(rows, 'A팀', ['team.name']).map((row) => row.id)).toEqual(['1', '3']);
    expect(filterTableRows(rows, '서초', ['name']).map((row) => row.id)).toEqual(['2']);
  });

  it('sorts numeric and text columns', () => {
    expect(sortTableRows(rows, { key: 'amount', direction: 'asc' }).map((row) => row.id)).toEqual(['2', '1', '3']);
    expect(sortTableRows(rows, { key: 'name', direction: 'desc' }).map((row) => row.id)).toEqual(['2', '3', '1']);
  });

  it('builds a paginated table view', () => {
    const view = buildTableView(rows, {
      search: '현장',
      searchFields: ['name'],
      sort: { key: 'amount', direction: 'desc' },
      page: 1,
      pageSize: 2,
    });

    expect(view.totalRows).toBe(3);
    expect(view.pageCount).toBe(2);
    expect(view.rows.map((row) => row.id)).toEqual(['3', '1']);
  });
});
