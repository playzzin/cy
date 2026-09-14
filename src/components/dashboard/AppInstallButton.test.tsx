import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppInstallButton } from './AppInstallButton';
import { promptPwaInstall } from '../../pwaInstallPrompt';

jest.mock('../../pwaInstallPrompt', () => ({
    promptPwaInstall: jest.fn(),
    getPwaInstallStatus: () => 'waiting',
    subscribeToInstallPrompt: () => () => {},
}));
const mockPromptPwaInstall = promptPwaInstall as jest.MockedFunction<typeof promptPwaInstall>;

const navigatorKeys = ['userAgent', 'platform', 'maxTouchPoints'] as const;
const descriptors = navigatorKeys.map((key) => Object.getOwnPropertyDescriptor(navigator, key));

const setDevice = (userAgent: string, platform = 'Win32', maxTouchPoints = 0) => {
    Object.defineProperties(navigator, {
        userAgent: { configurable: true, value: userAgent },
        platform: { configurable: true, value: platform },
        maxTouchPoints: { configurable: true, value: maxTouchPoints },
    });
};

beforeEach(() => {
    mockPromptPwaInstall.mockReset();
    mockPromptPwaInstall.mockResolvedValue('unavailable');
});

afterEach(() => {
    navigatorKeys.forEach((key, index) => {
        const descriptor = descriptors[index];
        if (descriptor) Object.defineProperty(navigator, key, descriptor);
        else Reflect.deleteProperty(navigator, key);
    });
});

describe('AppInstallButton downloads', () => {
    it('opens the browser install prompt directly on Windows and keeps APK download separate', async () => {
        setDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.0.0 Safari/537.36');
        mockPromptPwaInstall.mockResolvedValue('accepted');
        render(<AppInstallButton />);
        const button = screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' });
        expect(button).not.toHaveAttribute('href');
        expect(button).not.toHaveAttribute('download');
        expect(within(button).getByText('바탕화면에')).toBeInTheDocument();
        expect(within(button).getByText('추가')).toBeInTheDocument();
        fireEvent.click(button);
        expect(mockPromptPwaInstall).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(button).not.toBeDisabled());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        const apkLink = screen.getByRole('link', { name: '청연ENG ERP APK 설치' });
        expect(apkLink).toHaveAttribute('href', '/downloads/cheongyeon-erp.apk');
        expect(apkLink).toHaveAttribute('download', 'cheongyeon-erp.apk');
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('shows desktop installation help only when the browser cannot open its install prompt', async () => {
        setDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.0.0 Safari/537.36');
        render(<AppInstallButton />);
        const button = screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' });
        fireEvent.click(button);
        const dialog = await screen.findByRole('dialog', { name: '바탕화면에 추가' });
        expect(within(dialog).getByText('Chrome 또는 Edge에서 현재 페이지를 엽니다.')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: '청연ENG ERP 바탕화면에 추가' })).not.toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: '확인' }));
        await waitFor(() => expect(button).toHaveFocus());
    });

    it('leaves the desktop add button available without showing help after the user cancels installation', async () => {
        setDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.0.0 Safari/537.36');
        mockPromptPwaInstall.mockResolvedValue('dismissed');
        render(<AppInstallButton />);
        const button = screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' });
        fireEvent.click(button);
        await waitFor(() => expect(button).not.toBeDisabled());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it.each([
        'Mozilla/5.0 (Linux; Android 14) Chrome/140.0 Mobile Safari/537.36',
        'Mozilla/5.0 (Linux; Android 15) SamsungBrowser/27.0 Chrome/140.0 Safari/537.36',
    ])('keeps Android APK download separate from home screen addition: %s', async (userAgent) => {
        setDevice(userAgent, 'Linux', 1);
        render(<AppInstallButton />);
        const link = screen.getByRole('link', { name: '청연ENG ERP APK 설치' });
        expect(link).toHaveAttribute('href', '/downloads/cheongyeon-erp.apk');
        expect(link).toHaveAttribute('download', 'cheongyeon-erp.apk');
        expect(within(link).getByText('APK 설치')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /SMS/ })).not.toBeInTheDocument();
        const homeButton = screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' });
        expect(homeButton).not.toHaveAttribute('href');
        fireEvent.click(homeButton);
        const dialog = await screen.findByRole('dialog', { name: 'Android 홈 화면 추가' });
        expect(mockPromptPwaInstall).toHaveBeenCalledTimes(1);
        expect(within(dialog).getByText('브라우저 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택합니다.')).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: '확인' }));
        await waitFor(() => expect(homeButton).toHaveFocus());
    });

    it.each(['accepted', 'dismissed'] as const)('uses the Android home screen prompt without downloading an APK: %s', async (outcome) => {
        setDevice('Mozilla/5.0 (Linux; Android 14) Chrome/140.0 Mobile Safari/537.36', 'Linux', 1);
        mockPromptPwaInstall.mockResolvedValue(outcome);
        render(<AppInstallButton />);
        const button = screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' });
        fireEvent.click(button);
        await waitFor(() => expect(button).not.toBeDisabled());
        expect(mockPromptPwaInstall).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: '청연ENG ERP APK 설치' })).toHaveAttribute('href', '/downloads/cheongyeon-erp.apk');
    });

    it('offers home screen instructions when the Android install prompt fails', async () => {
        setDevice('Mozilla/5.0 (Linux; Android 14) Chrome/140.0 Mobile Safari/537.36', 'Linux', 1);
        mockPromptPwaInstall.mockRejectedValue(new Error('Prompt unavailable'));
        render(<AppInstallButton />);
        fireEvent.click(screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' }));
        expect(await screen.findByRole('dialog', { name: 'Android 홈 화면 추가' })).toBeInTheDocument();
    });

    it.each([
        ['Mozilla/5.0 (iPhone) AppleWebKit Safari/604.1', 'iPhone', 1],
        ['Mozilla/5.0 (Macintosh) AppleWebKit Safari/605.1', 'MacIntel', 5],
    ])('keeps an unsupported APK off iPhone/iPad and offers its home screen option: %s', async (userAgent, platform, touchPoints) => {
        setDevice(String(userAgent), String(platform), Number(touchPoints));
        render(<AppInstallButton />);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        const button = screen.getByRole('button', { name: '청연ENG ERP 바탕화면에 추가' });
        fireEvent.click(button);
        const dialog = screen.getByRole('dialog', { name: 'iPhone · iPad 홈 화면 추가' });
        expect(within(dialog).getByText('“홈 화면에 추가”를 선택합니다.')).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: '확인' }));
        await waitFor(() => expect(button).toHaveFocus());
    });
});
