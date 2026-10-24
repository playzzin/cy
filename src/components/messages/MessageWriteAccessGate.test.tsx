import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MessageWriteAccessGate from './MessageWriteAccessGate';
const mockAccess = { loading: false, canSend: false };
jest.mock('../../hooks/useMessageAccess', () => ({ useMessageAccess: () => mockAccess }));
const page = (path: string) => <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
    <Route path="/messages" element={<div>받은 메시지함</div>} />
    <Route path="/messages/:mode" element={<MessageWriteAccessGate><div>작성 및 관리 화면</div></MessageWriteAccessGate>} />
</Routes></MemoryRouter>;
beforeEach(() => { mockAccess.loading = false; mockAccess.canSend = false; });
it.each(['compose', 'settings', 'automation-logs'])('redirects a read-only direct visit to %s to the inbox', async mode => {
    render(page('/messages/' + mode));
    expect(await screen.findByText('받은 메시지함')).toBeInTheDocument();
    expect(screen.queryByText('작성 및 관리 화면')).not.toBeInTheDocument();
});
it('does not render protected children until mockAccess has loaded', () => {
    mockAccess.loading = true;
    render(page('/messages/compose'));
    expect(screen.getByRole('status')).toHaveTextContent('권한');
    expect(screen.queryByText('작성 및 관리 화면')).not.toBeInTheDocument();
});
it('allows accounts that retain write mockAccess', () => {
    mockAccess.canSend = true;
    render(page('/messages/compose'));
    expect(screen.getByText('작성 및 관리 화면')).toBeInTheDocument();
});
