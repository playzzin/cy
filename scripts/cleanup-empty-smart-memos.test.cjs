const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isEmptyMemo } = require('./cleanup-empty-smart-memos.cjs');

test('accepts only empty content with default or missing titles', () => {
    for (const title of [undefined, '', '  ', '새 메모', '새 체크리스트', '제목 없음', 'New Memo', 'Quick Note']) {
        assert.equal(isEmptyMemo({ title, content: ' \n ', checklistItems: [], tags: [] }), true);
    }
    assert.equal(isEmptyMemo({ title: '새 체크리스트', checklistItems: [{ id: 'blank', text: ' ', isChecked: false }] }), true);
});

test('preserves quick notes with content, tags, attachments or pinning', () => {
    for (const extra of [{ content: '업무 내용' }, { tags: ['important'] }, { files: ['file'] }, { isPinned: true }]) {
        assert.equal(isEmptyMemo({ title: 'Quick Note', content: '', ...extra }), false);
    }
});

test('preserves user titles, body, checklists, comments, attachments and pinned notes', () => {
    for (const extra of [
        { title: '회의 준비' }, { content: '회의 내용' }, { isPinned: true },
        { checklistItems: [{ text: '확인할 항목' }] },
        { checklistItems: [{ text: '', isChecked: true }] },
        { checklistItems: [{ text: '', comments: [{ text: '댓글' }] }] },
        { checklistItems: [{ text: '', unknown: '내용' }] },
        { attachments: ['file'] }, { images: ['image'] }, { tags: ['중요'] }, { content: {} }
    ]) assert.equal(isEmptyMemo({ title: '새 메모', content: '', ...extra }), false);
});
