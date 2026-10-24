import { act, renderHook, waitFor } from '@testing-library/react';
import { useMenuEditorPersistence } from './useMenuEditorPersistence';
import { menuServiceV11 } from '../../../services/menuServiceV11';
import type { SiteDataType } from '../../../types/menu';

jest.mock('../../../services/menuServiceV11', () => ({ menuServiceV11: {
    subscribe: jest.fn(), getMenuConfig: jest.fn(), saveMenuConfig: jest.fn(),
} }));

const initial = (): SiteDataType => ({
    pos_dev: { name: 'DEV', icon: '', menu: [{ id: 'dev', text: '개발' }] },
    pos_leader: { name: '팀장', icon: '', menu: [{ id: 'report', text: '일보' }] },
});
const copy = <T,>(data: T): T => JSON.parse(JSON.stringify(data));
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
let receive: (data: SiteDataType) => void;
let server: SiteDataType;
beforeEach(() => {
    jest.clearAllMocks();
    server = initial();
    (menuServiceV11.subscribe as jest.Mock).mockImplementation(callback => { receive = callback; callback(copy(server)); return jest.fn(); });
    (menuServiceV11.getMenuConfig as jest.Mock).mockImplementation(async () => copy(server));
    (menuServiceV11.saveMenuConfig as jest.Mock).mockImplementation(async data => { server = copy(data); receive(copy(server)); return copy(server); });
});

it('저장 중에 도착한 더 최신 변경을 놓치지 않고 실행 취소는 내 변경만 되돌린다', async () => {
    const pending = deferred<SiteDataType>();
    (menuServiceV11.saveMenuConfig as jest.Mock).mockImplementationOnce(() => pending.promise);
    const { result } = renderHook(useMenuEditorPersistence);
    const local = initial(); local.pos_leader.menu[0].text = '내 수정';
    act(() => result.current.updateMenuData(local));
    await waitFor(() => expect(menuServiceV11.saveMenuConfig).toHaveBeenCalledTimes(1));
    const remote = copy(local); remote.pos_dev.menu[0].text = '다른 창 수정';
    server = remote;
    await act(async () => { receive(remote); pending.resolve(local); });
    await waitFor(() => expect(result.current.menuData?.pos_dev.menu[0].text).toBe('다른 창 수정'));
    act(() => result.current.handleUndo());
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    expect(result.current.menuData?.pos_leader.menu[0].text).toBe('일보');
    expect(server.pos_dev.menu[0].text).toBe('다른 창 수정');
});

it('트랜잭션이 합친 다른 직책 변경을 실행 취소·다시 실행에서도 보존한다', async () => {
    (menuServiceV11.saveMenuConfig as jest.Mock).mockImplementationOnce(async data => {
        server = copy(data); server.pos_dev.menu[0].text = '외부 수정'; receive(server); return copy(server);
    });
    const { result } = renderHook(useMenuEditorPersistence);
    const local = initial(); local.pos_leader.menu[0].text = '내 수정';
    act(() => result.current.updateMenuData(local));
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    act(() => result.current.handleUndo());
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    expect(server.pos_leader.menu[0].text).toBe('일보');
    expect(server.pos_dev.menu[0].text).toBe('외부 수정');
    act(() => result.current.handleRedo());
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    expect(server.pos_leader.menu[0].text).toBe('내 수정');
    expect(server.pos_dev.menu[0].text).toBe('외부 수정');
});

it('앞선 저장이 실패하면 후속 수정도 전송하지 않고 미저장 내용을 유지한다', async () => {
    const pending = deferred<SiteDataType>();
    (menuServiceV11.saveMenuConfig as jest.Mock).mockImplementationOnce(() => pending.promise);
    const { result } = renderHook(useMenuEditorPersistence);
    const first = initial(); first.pos_leader.menu[0].text = '실패할 수정';
    act(() => result.current.updateMenuData(first));
    const second = copy(first); second.pos_dev.menu[0].text = '후속 수정';
    act(() => result.current.updateMenuData(second));
    await act(async () => pending.reject(new Error('저장 충돌')));
    await waitFor(() => expect(result.current.saveStatus).toBe('error'));
    expect(menuServiceV11.saveMenuConfig).toHaveBeenCalledTimes(1);
    expect(result.current.menuData).toEqual(second);
    await act(async () => { await result.current.reloadLatestMenus(); });
    expect(result.current.menuData).toEqual(initial());
    act(() => result.current.updateMenuData(first));
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    expect(menuServiceV11.saveMenuConfig).toHaveBeenCalledTimes(2);
});

it('최신 메뉴 불러오기 중에 수정한 내용을 오래된 조회 응답으로 덮어쓰지 않는다', async () => {
    const load = deferred<SiteDataType>();
    (menuServiceV11.getMenuConfig as jest.Mock).mockImplementationOnce(() => load.promise);
    const { result } = renderHook(useMenuEditorPersistence);
    let reload!: Promise<boolean>;
    act(() => { reload = result.current.reloadLatestMenus(); });
    const newer = initial(); newer.pos_leader.menu[0].text = '조회 중 수정';
    act(() => result.current.updateMenuData(newer));
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    await act(async () => { load.resolve(initial()); expect(await reload).toBe(false); });
    expect(result.current.menuData).toEqual(newer);
});

it('같은 메뉴가 외부에서 바뀌면 충돌하는 실행 취소 기록을 폐기한다', async () => {
    const { result } = renderHook(useMenuEditorPersistence);
    const local = initial(); local.pos_leader.menu[0].text = '내 수정';
    act(() => result.current.updateMenuData(local));
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));
    const remote = initial(); remote.pos_leader.menu[0].text = '다른 사람 최종 수정';
    act(() => receive(remote));
    expect(result.current.history.past).toEqual([]);
    expect(result.current.menuData).toEqual(remote);
});

it('첫 구독 실패를 노출하고 재조회 실패 시 재시도 상태와 오류를 유지한다', async () => {
    (menuServiceV11.subscribe as jest.Mock).mockImplementation((_callback, options) => { options.onError(new Error('연결 오류')); return jest.fn(); });
    const { result } = renderHook(useMenuEditorPersistence);
    expect(result.current.menuData).toBeNull();
    expect(result.current.saveStatus).toBe('error');
    (menuServiceV11.getMenuConfig as jest.Mock).mockRejectedValueOnce(new Error('다시 실패'));
    await act(async () => { expect(await result.current.reloadLatestMenus()).toBe(false); });
    expect(result.current.saveError).toBe('다시 실패');
    expect(result.current.isReloading).toBe(false);
});
