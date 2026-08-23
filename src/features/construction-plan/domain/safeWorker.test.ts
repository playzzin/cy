import { toSafeWorkerDto, toSafeWorkerDtos } from './safeWorker';

describe('safe worker projection', () => {
  it('whitelists plan fields and excludes identity, payroll, bank and address data', () => {
    const safe = toSafeWorkerDto({
      id: 'worker-1',
      name: '홍길동',
      role: '반장',
      rank: '기술자',
      teamId: 'team-1',
      teamName: '시공1팀',
      siteId: 'site-1',
      status: '재직',
      profileImageUrl: 'https://example.test/photo.png',
      contact: '010-0000-0000',
      idNumber: 'sensitive-id',
      address: 'sensitive-address',
      accountNumber: 'sensitive-account',
      unitPrice: 999999,
    });

    expect(safe).toEqual({
      id: 'worker-1',
      name: '홍길동',
      role: '반장',
      position: '기술자',
      teamId: 'team-1',
      teamName: '시공1팀',
      siteId: 'site-1',
      status: 'active',
      photoUrl: 'https://example.test/photo.png',
    });
    expect(Object.keys(safe ?? {})).not.toEqual(expect.arrayContaining([
      'idNumber', 'address', 'accountNumber', 'unitPrice', 'contact',
    ]));
  });

  it('only exposes contact when explicitly requested and drops unusable rows', () => {
    expect(toSafeWorkerDto({ id: 'w-1', name: '김작업', contact: '010-1111-2222' }, { includeContact: true }))
      .toEqual(expect.objectContaining({ contact: '010-1111-2222', status: 'unknown' }));
    expect(toSafeWorkerDtos([null, {}, { id: 'w-2', name: '이작업' }])).toHaveLength(1);
  });
});
