import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppInstallButton } from './AppInstallButton';
import { getInstallPrompt, setupPwaInstallPromptCapture } from '../../pwaInstallPrompt';

beforeAll(() => {
    setupPwaInstallPromptCapture();
});

beforeEach(() => {
    window.__cyPwaInstallState!.installed = false;
    window.__cyPwaInstallState!.deferredPrompt = null;
});

afterEach(() => {
    window.dispatchEvent(new Event('appinstalled'));
});

it('calls the captured browser prompt during the desktop click and prevents duplicate requests', async () => {
    let resolveChoice!: (choice: { outcome: 'accepted'; platform: string }) => void;
    const userChoice = new Promise((resolve) => { resolveChoice = resolve; });
    const prompt = jest.fn().mockResolvedValue(undefined);
    const installEvent = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(installEvent, { prompt, userChoice });
    window.dispatchEvent(installEvent);

    expect(installEvent.defaultPrevented).toBe(true);
    render(<AppInstallButton />);
    const button = screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' });
    expect(button).not.toHaveAttribute('download');
    expect(prompt).not.toHaveBeenCalled();

    fireEvent.click(button);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(getInstallPrompt()).toBeNull();
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(prompt).toHaveBeenCalledTimes(1);

    await act(async () => {
        resolveChoice({ outcome: 'accepted', platform: 'web' });
        await userChoice;
    });
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '청연ENG ERP APK 설치' }))
        .toHaveAttribute('href', '/downloads/cheongyeon-erp.apk');
});

it('recovers with desktop instructions if the browser rejects its installation prompt', async () => {
    const prompt = jest.fn().mockRejectedValue(new Error('Installation is not available'));
    const installEvent = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(installEvent, {
        prompt,
        userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });
    window.dispatchEvent(installEvent);
    render(<AppInstallButton />);
    const button = screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' });
    fireEvent.click(button);

    expect(await screen.findByRole('dialog', { name: '바탕화면에 추가' })).toBeInTheDocument();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(button).not.toBeDisabled();
});

it('turns a late native install event into a usable PWA install button while help is open', async () => {
    render(<AppInstallButton />);
    const button = screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' });
    fireEvent.click(button);
    await screen.findByRole('dialog', { name: '바탕화면에 추가' });
    expect(screen.queryByRole('button', { name: 'PWA 바로가기 설치' })).not.toBeInTheDocument();

    const prompt = jest.fn().mockResolvedValue(undefined);
    const installEvent = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(installEvent, {
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    act(() => { window.dispatchEvent(installEvent); });
    fireEvent.click(screen.getByRole('button', { name: 'PWA 바로가기 설치' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('shows an installed PWA as installed instead of asking the user to wait', () => {
    render(<AppInstallButton />);
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    const button = screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' });
    expect(button).toHaveAttribute('data-install-state', 'installed');
    fireEvent.click(button);
    expect(screen.getByText(/청연ENG ERP PWA가 설치되었습니다/)).toBeInTheDocument();
    expect(screen.queryByText('설치 버튼이 나타나지 않을 때')).not.toBeInTheDocument();
});
