import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import TeamEquipmentStatusPage from './TeamEquipmentStatusPage';
import { teamService } from '../../services/teamService';
import { manpowerService } from '../../services/manpowerService';
import { supportSharedDataService as storage } from '../../services/supportSharedDataService';

jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('../../services/supportSharedDataService', () => ({ supportSharedDataService: { load: jest.fn(), save: jest.fn() } }));

const legacyState = () => ({
    items: [{ id: 'impact', name: '임팩' }, { id: 'skill', name: '스킬' }, { id: 'legacy-other', name: '기타' }],
    rows: {
        main: { id: 'main', quantities: { impact: 2, skill: 1, 'legacy-other': 4 }, note: '본팀 메모' },
        parent: { id: 'parent', quantities: { impact: 3, skill: 2, 'legacy-other': 6 }, note: '', useForemanTotals: true,
            foremen: [{ id: 'foreman_a', name: '검증 반장', quantities: { impact: 3, skill: 2, 'legacy-other': 6 }, note: '하위 메모' }] },
        hidden: { id: 'hidden', quantities: { impact: 10, skill: 0, 'legacy-other': 0 }, note: '보존할 다른 팀' },
    },
});
let saved: any;
beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('team_equipment_inventory_firestore_migrated_v1', 'done');
    saved = legacyState();
    (teamService.getTeams as jest.Mock).mockResolvedValue([
        { id: 'main', name: '검증 본팀', type: '시공팀', color: '#047857' },
        { id: 'parent', name: '이재욱팀', type: '시공팀', color: '#2563eb' },
        { id: 'hidden', name: '관리팀', type: '관리팀' },
    ]);
    (manpowerService.getWorkers as jest.Mock).mockResolvedValue([]);
    (storage.load as jest.Mock).mockImplementation(async () => saved);
    (storage.save as jest.Mock).mockImplementation(async (_, value) => { saved = value; });
});
afterEach(() => jest.restoreAllMocks());
const mount = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TeamEquipmentStatusPage /></MemoryRouter>);
const ready = () => screen.findByRole('spinbutton', { name: '검증 본팀 임팩 수량' });
const openRename = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: '장비 항목 관리' }));
    fireEvent.click(screen.getByRole('button', { name: `${name} 이름 수정` }));
    return screen.getByRole('textbox', { name: `${name} 장비 이름` });
};

test('본팀과 하위팀은 별도 표에 표시하며 기타 수량을 함마로 보존한다', async () => {
    mount(); await ready();
    const main = screen.getByRole('region', { name: '본팀 장비 현황' });
    const children = screen.getByRole('region', { name: '하위팀 장비 현황' });
    expect(within(main).getAllByRole('table')).toHaveLength(1);
    expect(within(main).queryByText('검증 반장')).not.toBeInTheDocument();
    expect(within(children).getByText('검증 반장')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '검증 본팀 함마 수량' })).toHaveValue(4);
    expect(screen.getByRole('spinbutton', { name: '검증 본팀 기타 수량' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: '이재욱팀 검증 반장 함마 수량' })).toHaveValue(6);
    expect(screen.getByLabelText('함마 전체 수량')).toHaveTextContent('10');
    expect(storage.save).not.toHaveBeenCalled();
});

test('하위팀 수량 변경은 본팀과 전체 합계에 한 번 반영되고 저장 후 복원된다', async () => {
    const view = mount(); await ready();
    fireEvent.change(screen.getByRole('spinbutton', { name: '이재욱팀 검증 반장 함마 수량' }), { target: { value: '9' } });
    expect(screen.getByLabelText('이재욱팀 함마 합계')).toHaveTextContent('9');
    expect(screen.getByLabelText('함마 전체 수량')).toHaveTextContent('13');
    fireEvent.click(screen.getByRole('button', { name: '이재욱팀 하위팀 저장' }));
    await waitFor(() => expect(storage.save).toHaveBeenCalled());
    expect(saved.catalogVersion).toBe(2);
    expect(saved.rows.parent.foremen[0].quantities['legacy-other']).toBe(9);
    expect(saved.rows.hidden.note).toBe('보존할 다른 팀');
    view.unmount(); mount(); await ready();
    expect(screen.getByRole('spinbutton', { name: '이재욱팀 검증 반장 함마 수량' })).toHaveValue(9);
    expect(screen.getByRole('spinbutton', { name: '검증 본팀 기타 수량' })).toHaveValue(0);
});

test('장비 이름 저장은 기존 ID·전체 팀 기록을 보존하고 미저장 수량을 함께 저장하지 않는다', async () => {
    const view = mount(); await ready();
    fireEvent.change(screen.getByRole('spinbutton', { name: '검증 본팀 함마 수량' }), { target: { value: '99' } });
    fireEvent.change(openRename('함마'), { target: { value: '충전 함마' } });
    fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));
    await screen.findByRole('button', { name: '충전 함마 이름 수정' });
    expect(saved.items.find((item: any) => item.name === '충전 함마').id).toBe('legacy-other');
    expect(saved.rows.main.quantities['legacy-other']).toBe(4);
    expect(saved.rows.parent.foremen[0].quantities['legacy-other']).toBe(6);
    expect(saved.rows.hidden.note).toBe('보존할 다른 팀');
    expect(screen.getByRole('spinbutton', { name: '검증 본팀 충전 함마 수량' })).toHaveValue(99);
    expect(screen.getByText('1팀 변경 · 저장 필요')).toBeInTheDocument();
    view.unmount(); mount(); await ready();
    expect(screen.getByRole('spinbutton', { name: '검증 본팀 충전 함마 수량' })).toHaveValue(4);
});

test('중복 이름과 빈 이름을 거부하고 한글 조합 Enter로 저장하지 않는다', async () => {
    mount(); await ready();
    const input = openRename('함마');
    fireEvent.change(input, { target: { value: '스킬' } });
    fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));
    expect(screen.getByText('이미 등록된 장비 이름입니다.')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));
    expect(screen.getByText('장비명을 입력하세요.')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '새 함마' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(storage.save).not.toHaveBeenCalled();
});

test('이름 저장 실패 시 기존 이름과 수량을 유지하고 다시 시도할 수 있다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (storage.save as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    mount(); await ready();
    fireEvent.change(openRename('함마'), { target: { value: '충전 함마' } });
    fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));
    await screen.findByText('장비 이름을 저장하지 못했습니다. 목록을 확인하고 다시 시도해 주세요.');
    expect(screen.getByRole('spinbutton', { name: '검증 본팀 함마 수량' })).toHaveValue(4);
    expect(screen.getByRole('textbox', { name: '함마 장비 이름' })).toHaveValue('충전 함마');
    fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));
    await screen.findByRole('button', { name: '충전 함마 이름 수정' });
});

test('사용자가 추가하거나 삭제한 항목은 저장 후 재접속해도 그대로 유지된다', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const view = mount(); await ready();
    fireEvent.click(screen.getByRole('button', { name: '장비 항목 관리' }));
    fireEvent.change(screen.getByRole('textbox', { name: '장비 항목 추가' }), { target: { value: '충전기' } });
    fireEvent.click(screen.getByRole('button', { name: '항목 추가' }));
    await screen.findByRole('button', { name: '충전기 이름 수정' });
    fireEvent.click(screen.getByRole('button', { name: '배터리 삭제' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '배터리 삭제' })).not.toBeInTheDocument());
    view.unmount(); mount(); await ready();
    expect(screen.getByRole('spinbutton', { name: '검증 본팀 충전기 수량' })).toHaveValue(0);
    expect(screen.queryByRole('spinbutton', { name: '검증 본팀 배터리 수량' })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '검증 본팀 함마 수량' })).toHaveValue(4);
});

test('공용 데이터 조회 실패 시 이름·수량 저장과 항목 변경을 차단한다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (storage.load as jest.Mock).mockRejectedValue(new Error('offline'));
    mount(); await ready();
    expect(screen.getByRole('alert')).toHaveTextContent('공용 DB를 불러오지 못해');
    expect(screen.getByRole('button', { name: '전체 저장' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: '검증 본팀 임팩 수량' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '장비 항목 관리' }));
    expect(screen.getByRole('button', { name: '함마 이름 수정' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '항목 추가' })).toBeDisabled();
    expect(storage.save).not.toHaveBeenCalled();
});
