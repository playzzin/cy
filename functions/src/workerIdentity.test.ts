import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    buildWorkerPhoneLookupValues,
    normalizeWorkerPhone,
} from './workerIdentity';

test('한국 휴대전화번호 형식을 동일한 숫자로 정규화한다', () => {
    assert.equal(normalizeWorkerPhone('010-1234-5678'), '01012345678');
    assert.equal(normalizeWorkerPhone('+82 10-1234-5678'), '01012345678');
    assert.ok(buildWorkerPhoneLookupValues('01012345678').includes('010-1234-5678'));
});
