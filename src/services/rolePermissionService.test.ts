import { waitFor } from '@testing-library/react';

jest.mock('./firestoreCrudCompat', () => ({
    listSystemConfigs: jest.fn(),
    createSystemConfig: jest.fn(),
    updateSystemConfig: jest.fn(),
}));
jest.mock('./positionService', () => ({
    positionService: { getPositions: jest.fn().mockResolvedValue([{ name: '검증 직책', systemRole: '일반' }]) },
}));
jest.mock('./menuServiceV11', () => ({ menuServiceV11: { subscribe: jest.fn(() => jest.fn()) } }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));

test.each([
    [[]],
    [[{ id: 'permissions', data: JSON.stringify({ '검증 직책': { '검증 메뉴': true } }) }]],
])('사이드바 권한은 설정 한 건만 읽고 기본값을 저장하지 않는다 (%j)', async rows => {
    let loaded!: {
        list: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        subscribe: jest.Mock;
        service: typeof import('./rolePermissionService').rolePermissionService;
    };
    jest.isolateModules(() => {
        const compat = jest.requireMock('./firestoreCrudCompat');
        const { menuServiceV11 } = jest.requireMock('./menuServiceV11');
        compat.listSystemConfigs.mockResolvedValue({ data: { systemConfigs: rows } });
        loaded = {
            list: compat.listSystemConfigs,
            create: compat.createSystemConfig,
            update: compat.updateSystemConfig,
            subscribe: menuServiceV11.subscribe,
            service: require('./rolePermissionService').rolePermissionService,
        };
    });

    await waitFor(() => expect(loaded.subscribe).toHaveBeenCalledTimes(1));
    expect(loaded.list).toHaveBeenCalledTimes(1);
    expect(loaded.list).toHaveBeenCalledWith({ configId: 'permissions' });
    expect(loaded.service.hasAccess('검증 직책', '검증 메뉴')).toBe(rows.length > 0);
    expect(loaded.create).not.toHaveBeenCalled();
    expect(loaded.update).not.toHaveBeenCalled();
});
