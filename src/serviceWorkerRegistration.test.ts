import { waitFor } from '@testing-library/react';
import { registerServiceWorker } from './serviceWorkerRegistration';

const workerDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
const readyDescriptor = Object.getOwnPropertyDescriptor(document, 'readyState');
const workerUrl = new URL('/pwa-development-worker.js', window.location.origin).href;
let loadListenerSpy: jest.SpyInstance;
let documentListenerSpy: jest.SpyInstance;
let register: jest.Mock;
let update: jest.Mock;
let getRegistrations: jest.Mock;
const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
    update = jest.fn().mockResolvedValue(undefined);
    register = jest.fn().mockResolvedValue({ update });
    getRegistrations = jest.fn().mockResolvedValue([]);
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: { register, getRegistrations, controller: null },
    });
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
    loadListenerSpy = jest.spyOn(window, 'addEventListener');
    documentListenerSpy = jest.spyOn(document, 'addEventListener');
});

afterEach(() => {
    for (const [type, listener, options] of loadListenerSpy.mock.calls) {
        window.removeEventListener(type, listener, options);
    }
    for (const [type, listener, options] of documentListenerSpy.mock.calls) {
        document.removeEventListener(type, listener, options);
    }
    documentListenerSpy.mockRestore();
    loadListenerSpy.mockRestore();
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    if (workerDescriptor) Object.defineProperty(navigator, 'serviceWorker', workerDescriptor);
    else Reflect.deleteProperty(navigator, 'serviceWorker');
    if (readyDescriptor) Object.defineProperty(document, 'readyState', readyDescriptor);
    else Reflect.deleteProperty(document, 'readyState');
});

it('registers a network-only PWA worker in development even after the load event', async () => {
    registerServiceWorker();
    await waitFor(() => expect(register).toHaveBeenCalledWith(workerUrl, { updateViaCache: 'none' }));
    expect(update).toHaveBeenCalledTimes(1);
});

it('keeps the active development PWA worker on subsequent page loads', async () => {
    const unregister = jest.fn();
    getRegistrations.mockResolvedValue([{ active: { scriptURL: workerUrl }, unregister }]);
    registerServiceWorker();
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(unregister).not.toHaveBeenCalled();
});

it('replaces old caching workers so local changes remain visible', async () => {
    const unregister = jest.fn().mockResolvedValue(true);
    getRegistrations.mockResolvedValue([{ active: { scriptURL: new URL('/service-worker.js', window.location.origin).href }, unregister }]);
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(unregister).toHaveBeenCalledTimes(1);
});

it('registers the production worker when the page has already loaded', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    registerServiceWorker();
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith('/service-worker.js', { updateViaCache: 'none' });
});

it('registers the production worker once when the page finishes loading', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event('load'));
    expect(register).toHaveBeenCalledTimes(1);
});

it('rechecks updates on reconnect and throttles repeated tab switches', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    try {
        registerServiceWorker();
        await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
        document.dispatchEvent(new Event('visibilitychange'));
        expect(update).toHaveBeenCalledTimes(1);
        dateSpy.mockReturnValue(1700000060000);
        document.dispatchEvent(new Event('visibilitychange'));
        await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
        window.dispatchEvent(new Event('online'));
        await waitFor(() => expect(update).toHaveBeenCalledTimes(3));
    } finally {
        dateSpy.mockRestore();
        if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
        else Reflect.deleteProperty(document, 'visibilityState');
    }
});
