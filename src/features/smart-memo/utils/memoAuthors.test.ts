import { buildMemoAuthorLookup, buildMemoAuthorOptions, getMemoAuthor, memoAuthorFilterValue } from './memoAuthors';

it('resolves both UID and legacy email ownership to the account name', () => {
    const authors = buildMemoAuthorLookup([
        { id: 'account-document', data: { uid: 'author-uid', displayName: ' 김메모 ', email: 'memo@example.test' } }
    ]);
    for (const userId of ['account-document', 'author-uid', 'MEMO@example.test']) {
        expect(getMemoAuthor(userId, authors)).toEqual(expect.objectContaining({
            label: '김메모', description: '김메모 (memo@example.test)'
        }));
    }
});

it('retains the recorded identifier when the account is missing instead of guessing a name', () => {
    const authors = new Map();
    expect(getMemoAuthor('missing-user', authors).label).toBe('사용자 ID: missing-user');
    expect(getMemoAuthor('legacy@example.test', authors).label).toBe('legacy@example.test');
    expect(getMemoAuthor('', authors).label).toBe('사용자 ID: 미기록');
});

it('groups UID, account document and legacy email under one selectable user', () => {
    const authors = buildMemoAuthorLookup([
        { id: 'document', data: { uid: 'owner', displayName: '김메모', email: 'memo@example.test' } },
        { id: 'empty', data: { displayName: '김메모', email: 'empty@example.test' } }
    ]);
    const memos = ['document', 'owner', 'MEMO@example.test', 'missing', ''].map(userId => ({ userId }));
    const options = buildMemoAuthorOptions(memos, authors);
    expect(options).toHaveLength(4);
    expect(options).toEqual(expect.arrayContaining([
        { value: 'author:owner', label: '김메모 (memo@example.test)', count: 3 },
        { value: 'author:empty', label: '김메모 (empty@example.test)', count: 0 },
        { value: 'author:missing', label: '사용자 ID: missing', count: 1 },
        { value: 'author:', label: '사용자 ID: 미기록', count: 1 }
    ]));
    expect(memoAuthorFilterValue('MEMO@example.test', authors)).toBe('author:owner');
});
