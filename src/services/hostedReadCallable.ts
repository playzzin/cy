import { httpsCallable, httpsCallableFromURL, type HttpsCallableOptions } from 'firebase/functions';
import { functions } from '../config/firebase';
import { hostedReadUrl, type HostedReadFunction } from '../config/teamScopedReadEndpoint';

export function hostedReadCallable<Request, Result>(name: HostedReadFunction, options?: HttpsCallableOptions) {
    const url = typeof window === 'undefined' ? undefined : hostedReadUrl(window.location, name);
    if (url) return httpsCallableFromURL<Request, Result>(functions, url, options);
    return options ? httpsCallable<Request, Result>(functions, name, options) : httpsCallable<Request, Result>(functions, name);
}
