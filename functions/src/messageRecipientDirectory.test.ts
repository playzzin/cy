import { strict as assert } from 'assert';
import { test } from 'node:test';
import { messageRecipientDirectoryRow } from './messageRecipientDirectory';

test('수신자 디렉터리는 연락처·금융정보·타 팀 연결 없이 허용 필드만 반환한다', () => {
    const row = messageRecipientDirectoryRow({ id: 'recipient', status: 'active', displayName: '수신자', role: 'user',
        linkedWorkerIds: ['own-worker', 'foreign-worker'], email: 'private@example.invalid', phoneNumber: 'private',
        bankAccount: 'private', linkedCompanyIds: ['private'], secret: 'private' }, ['own-worker']);
    assert.deepEqual(row, { uid: 'recipient', displayName: '수신자', role: 'user', position: '', department: '', status: 'active', linkedWorkerIds: ['own-worker'] });
});

test('미승인·정지·비활성 계정은 수신자 디렉터리에 노출하지 않는다', () => {
    for (const status of ['pending', 'suspended', 'rejected', undefined]) assert.equal(messageRecipientDirectoryRow({ id: 'recipient', status }, []), null);
    assert.equal(messageRecipientDirectoryRow({ id: 'recipient', status: 'active', isActive: false }, []), null);
});
