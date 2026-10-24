import * as fs from 'fs';
import * as path from 'path';
import { SYSTEM_COLLECTIONS } from '../constants/collectionConfig';
import { canAccessErpCollection, getErpCollectionAccessPolicy } from './erpAccessPolicy';

const collection = 'delegated_receipt_claims';

it.each(['admin', 'PAYROLL_MANAGER', 'finance', '급여담당', '경리'])('%s 역할은 위임금 조회와 확인을 수행할 수 있다', role => {
  expect(canAccessErpCollection([role], collection, 'read')).toBe(true);
  expect(canAccessErpCollection([role], collection, 'write')).toBe(true);
});

it.each(['user', 'office_staff', 'SITE_MANAGER', 'support_manager', 'audit', ''])('%s 역할에 위임금 접근을 부여하지 않는다', role => {
  expect(canAccessErpCollection([role], collection, 'read')).toBe(false);
  expect(canAccessErpCollection([role], collection, 'write')).toBe(false);
});

it('전용 컬렉션은 재무 정책과 시스템 목록에 한 번만 등록된다', () => {
  expect(getErpCollectionAccessPolicy(collection)?.read).toEqual(['admin', 'payroll', 'finance']);
  expect(getErpCollectionAccessPolicy(collection)?.write).toEqual(['admin', 'payroll', 'finance']);
  expect(SYSTEM_COLLECTIONS.filter(item => item.id === collection)).toHaveLength(1);
});

it('서버 재무 분류에 등록하여 일반 사용자 fallback 접근을 차단한다', () => {
  const rules = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
  const financeBody = rules.match(/function isFinanceCollection\(collectionId\)\s*\{([\s\S]*?)\n {4}\}/)?.[1];
  const lockedBody = rules.match(/function isLockedCollection\(collectionId\)\s*\{([\s\S]*?)\n {4}\}/)?.[1];
  expect(financeBody).toContain(`'${collection}'`);
  expect(lockedBody).toContain('isFinanceCollection(collectionId)');
  expect(rules).toContain('allow read, write: if hasActiveUserProfile() && !isLockedCollection(collectionId);');
});
