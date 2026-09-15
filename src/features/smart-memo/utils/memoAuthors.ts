export type MemoAuthor = {
    uid: string;
    displayName: string;
    email: string;
};

const textValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const authorKey = (value: string) => value.includes('@') ? value.trim().toLowerCase() : value.trim();

export const buildMemoAuthorLookup = (
    users: { id: string; data: Record<string, unknown> }[]
): Map<string, MemoAuthor> => {
    const authors = new Map<string, MemoAuthor>();
    users.forEach(({ id, data }) => {
        const author = {
            uid: textValue(data.uid) || id,
            displayName: textValue(data.displayName),
            email: textValue(data.email)
        };
        [id, author.uid, author.email].filter(Boolean).forEach(key => authors.set(authorKey(key), author));
    });
    return authors;
};

export const getMemoAuthor = (userId: string, authors: Map<string, MemoAuthor>) => {
    const author = authors.get(authorKey(userId));
    const label = author?.displayName || author?.email || (userId.includes('@') ? userId : `사용자 ID: ${userId || '미기록'}`);
    return {
        label,
        description: author?.displayName && author.email ? `${author.displayName} (${author.email})` : label,
        searchText: `${label} ${author?.email || ''} ${userId}`.toLowerCase()
    };
};

export const memoAuthorFilterValue = (userId: string, authors: Map<string, MemoAuthor>) =>
    `author:${authors.get(authorKey(userId))?.uid || authorKey(userId)}`;

export const buildMemoAuthorOptions = (memos: { userId: string }[], authors: Map<string, MemoAuthor>) => {
    const options = new Map<string, { value: string; label: string; count: number }>();
    const addAuthor = (userId: string) => {
        const value = memoAuthorFilterValue(userId, authors);
        if (!options.has(value)) {
            const author = authors.get(authorKey(userId));
            const label = getMemoAuthor(userId, authors).description;
            options.set(value, {
                value, count: 0,
                label: author?.displayName && !author.email ? `${label} (${author.uid})` : label
            });
        }
        return options.get(value)!;
    };
    authors.forEach(author => addAuthor(author.uid));
    memos.forEach(memo => { addAuthor(memo.userId).count++; });
    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'ko-KR'));
};
