import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DevUserPreview, { choosePreviewAccount, type PreviewAccount } from './DevUserPreview';
import { previewMenuContainsPath } from './DevPreviewRouteGuard';
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
    render(<DevUserPreview actorUid="dev" positionId="lead" path="/dashboard" positions={[{ id: 'lead', name: '팀장', color: '', icon: '' }]} siteData={{ pos_lead: { name: '팀장', icon: '', menu: [] } }} onPosition={() => undefined} onPath={() => undefined} onExit={() => undefined} />);
    await screen.findByRole('option', { name: '검증 팀장 A · A팀' });
    fireEvent.change(screen.getByLabelText('보기 기준'), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText('보기 기준'), { target: { value: 'b' } });
    await screen.findByTitle('검증 팀장 B 사용자 화면');
    resolveA({ data: { token: 'old', expiresAt: Date.now() / 1000 + 600, target: { uid: 'a', displayName: '검증 팀장 A' } } });
    await waitFor(() => expect(screen.queryByTitle('검증 팀장 A 사용자 화면')).toBeNull());
    fireEvent.change(screen.getByLabelText('보기 기준'), { target: { value: '' } });
    expect(screen.queryByTitle('검증 팀장 B 사용자 화면')).toBeNull();
});
it('checks the menu path and required tab without granting hidden pages', () => {
    const menu = [{ text: '근무', path: '/work?tab=mine' }, { text: '숨김', path: '/secret', hide: true }];
    expect(previewMenuContainsPath(menu, '/work?tab=mine&month=2026-10')).toBe(true);
    expect(previewMenuContainsPath(menu, '/work?tab=all')).toBe(false);
    expect(previewMenuContainsPath(menu, '/secret')).toBe(false);
});
