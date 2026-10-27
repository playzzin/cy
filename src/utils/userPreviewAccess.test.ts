import { canPreviewUsers } from './userPreviewAccess';

const positions = [{ id: 'custom-dev', name: 'DEV' }, { id: 'custom-ceo', name: 'CEO' }, { id: 'leader', name: '팀장' }];

it.each(['DEV', 'developer', '개발자', 'CEO', ' ceo ', 'pos_ceo', '대표', '대표이사', '사장', 'pos_custom-ceo', 'custom-dev'])('%s 직책은 미리보기를 사용할 수 있다', position => {
    expect(canPreviewUsers({ status: 'active', position }, positions)).toBe(true);
});

it.each(['role', 'position', 'systemRole', 'roles', 'additionalPositions'])('%s의 CEO 직책도 인정한다', field => {
    expect(canPreviewUsers({ status: 'active', [field]: ['roles', 'additionalPositions'].includes(field) ? ['pos_custom-ceo'] : 'CEO' }, positions)).toBe(true);
});

it.each([
    null, { status: 'active', role: 'admin', position: 'leader' },
    { status: 'suspended', position: 'CEO' }, { position: 'DEV' },
    { status: 'active', position: 'custom-unknown' },
])('미리보기 직책이 없는 계정이나 비활성 계정은 차단한다: %j', profile => {
    expect(canPreviewUsers(profile, positions)).toBe(false);
});
