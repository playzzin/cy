import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import { getInstallPrompt, getPwaInstallStatus, promptPwaInstall, setupPwaInstallPromptCapture } from './pwaInstallPrompt';

const bootstrap = readFileSync(join(process.cwd(), 'public/pwa-install-capture.js'), 'utf8');
let listenerSpy: jest.SpyInstance;

beforeEach(() => {
    delete window.__cyPwaInstallState;
    listenerSpy = jest.spyOn(window, 'addEventListener');
    runInNewContext(bootstrap, { window, Set });
});

afterEach(() => {
    for (const [type, listener, options] of listenerSpy.mock.calls) {
        if (type === 'beforeinstallprompt' || type === 'appinstalled') {
            window.removeEventListener(type, listener, options);
        }
    }
    listenerSpy.mockRestore();
    delete window.__cyPwaInstallState;
});

const dispatchInstallEvent = () => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    const prompt = jest.fn().mockResolvedValue(undefined);
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }) });
    window.dispatchEvent(event);
    return { event, prompt };
};

it('retains a browser install event delivered before the application initializes', async () => {
    const { event, prompt } = dispatchInstallEvent();
    setupPwaInstallPromptCapture();
    expect(event.defaultPrevented).toBe(true);
    expect(getInstallPrompt()).toBe(event);
    expect(getPwaInstallStatus()).toBe('ready');
    expect(listenerSpy.mock.calls.filter(([type]) => type === 'beforeinstallprompt')).toHaveLength(1);
    expect(await promptPwaInstall()).toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
});

it('preserves the pending event when the application module is reloaded', () => {
    const { event } = dispatchInstallEvent();
    jest.isolateModules(() => {
        const reloaded = require('./pwaInstallPrompt');
        reloaded.setupPwaInstallPromptCapture();
        expect(reloaded.getInstallPrompt()).toBe(event);
    });
    runInNewContext(bootstrap, { window, Set });
    expect(getInstallPrompt()).toBe(event);
    expect(listenerSpy.mock.calls.filter(([type]) => type === 'beforeinstallprompt')).toHaveLength(1);
});

it('waits for appinstalled before reporting that installation finished', async () => {
    dispatchInstallEvent();
    await promptPwaInstall();
    expect(getPwaInstallStatus()).toBe('waiting');
    window.dispatchEvent(new Event('appinstalled'));
    expect(getPwaInstallStatus()).toBe('installed');
    expect(getInstallPrompt()).toBeNull();
});
