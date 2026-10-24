import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DevUserPreview, { choosePreviewAccount, type PreviewAccount } from './DevUserPreview';
import { previewMenuAllowsPath, previewMenuContainsPath } from './DevPreviewRouteGuard';
const mockCall = jest.fn();
jest.mock('firebase/functions', () => ({ httpsCallable: (_functions: unknown, name: string) => (data: unknown) => mockCall(name, data) }));
jest.mock('../../config/firebase', () => ({ functions: {} }));
const accounts: PreviewAccount[] = [
    { uid: 'a', displayName: '검증 팀장 A', positionIds: ['lead'], scopeLabel: 'A팀', linked: true, additionalPositions: [] },
    { uid: 'b', displayName: '검증 팀장 B', positionIds: ['lead'], scopeLabel: 'B팀', linked: true, additionalPositions: [] },
    { uid: 'c', displayName: '검증 작업자', positionIds: ['worker'], scopeLabel: '본인', linked: true, additionalPositions: [] },
];
beforeEach(() => { sessionStorage.clear(); mockCall.mockReset(); Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => 'frame-test' } }); });
it('chooses a remembered or unique account, never an arbitrary account', () => {
    expect(choosePreviewAccount(accounts, 'lead')).toBe('');
    expect(choosePreviewAccount(accounts, 'lead', 'b')).toBe('b');
    expect(choosePreviewAccount(accounts, 'worker')).toBe('c');
    expect(choosePreviewAccount(accounts, 'missing')).toBe('');
});
it('removes the previous frame immediately and ignores a stale session response', async () => {
    let resolveA: (value: any) => void = () => undefined;
    mockCall.mockImplementation((name, data) => name === 'getDevPreviewAccounts' ? Promise.resolve({ data: { accounts } })
        : data.targetUid === 'a' ? new Promise(resolve => { resolveA = resolve; })
            : Promise.resolve({ data: { token: 'fixture', expiresAt: Date.now() / 1000 + 600, target: { uid: 'b', displayName: '검증 팀장 B' } } }));
    render(<DevUserPreview actorUid="dev" positionId="lead" path="/dashboard" positions={[{ id: 'lead', name: '팀장', color: '', icon: '' }]} onPosition={() => undefined} onPath={() => undefined} onExit={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: '검증 팀장 A · A팀' }));
    fireEvent.click(screen.getByRole('button', { name: '이 사용자로 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '검증 팀장 B · B팀' }));
    fireEvent.click(screen.getByRole('button', { name: '이 사용자로 보기' }));
    await screen.findByTitle('검증 팀장 B 사용자 화면');
    await act(async () => { resolveA({ data: { token: 'old', expiresAt: Date.now() / 1000 + 600, target: { uid: 'a', displayName: '검증 팀장 A' } } }); });
    await waitFor(() => expect(screen.queryByTitle('검증 팀장 A 사용자 화면')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '검증 팀장 A · A팀' }));
    expect(screen.getByTitle('검증 팀장 B 사용자 화면')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '이 사용자로 보기' }));
    expect(screen.queryByTitle('검증 팀장 B 사용자 화면')).toBeNull();
});

it('keeps the active session when refreshing the directory', async () => {
    mockCall.mockImplementation(name => name === 'getDevPreviewAccounts' ? Promise.resolve({ data: { accounts: accounts.map(account => ({ ...account })) } })
        : Promise.resolve({ data: { token: 'fixture', expiresAt: Date.now() / 1000 + 600, target: { uid: 'a', displayName: '검증 팀장 A' } } }));
    render(<DevUserPreview actorUid="dev" positionId="lead" path="/dashboard" positions={[{ id: 'lead', name: '팀장', color: '', icon: '' }]} onPosition={() => undefined} onPath={() => undefined} onExit={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: '검증 팀장 A · A팀' }));
    fireEvent.click(screen.getByRole('button', { name: '이 사용자로 보기' }));
    const frame = await screen.findByTitle('검증 팀장 A 사용자 화면');
    fireEvent.click(screen.getByRole('button', { name: '사용자 목록 새로고침' }));
    await screen.findByRole('button', { name: '검증 팀장 A · A팀' });
    expect(screen.getByTitle('검증 팀장 A 사용자 화면')).toBe(frame);
    expect(mockCall.mock.calls.filter(([name]) => name === 'createDevPreviewSession')).toHaveLength(1);
});
it('checks the menu path and required tab without granting hidden pages', () => {
    const menu = [{ text: '근무', path: '/work?tab=mine' }, { text: '숨김', path: '/secret', hide: true }];
    expect(previewMenuContainsPath(menu, '/work?tab=mine&month=2026-10')).toBe(true);
    expect(previewMenuContainsPath(menu, '/work?tab=all')).toBe(false);
    expect(previewMenuContainsPath(menu, '/secret')).toBe(false);
});

it('keeps the material editor reachable from registration without exposing other removed pages', () => {
    for (const route of ['/materials/inbound', '/materials/outbound']) {
        const menu = [{ text: '등록', path: route }];
        expect(previewMenuContainsPath(menu, '/materials/transactions')).toBe(false);
        expect(previewMenuAllowsPath(menu, '/materials/transactions/')).toBe(true);
        for (const removed of ['/materials/transactions-by-site-date', '/materials/inventory', '/materials/inventory-by-site', '/materials/logs']) {
            expect(previewMenuAllowsPath(menu, removed)).toBe(false);
        }
    }
});
it('does not grant the material editor from a hidden registration menu or unrelated menu', () => {
    expect(previewMenuAllowsPath([{ text: '입고', path: '/materials/inbound', hide: true }], '/materials/transactions')).toBe(false);
    expect(previewMenuAllowsPath([{ text: '자재', path: '/materials/master' }], '/materials/transactions')).toBe(false);
    expect(previewMenuAllowsPath([], '/materials/transactions')).toBe(false);
});
