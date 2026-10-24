export type ResourceStatusChange =
    | { kind: 'site'; id: string; status: 'active' | 'completed' }
    | { kind: 'worker'; id: string; status: '재직' | '퇴사'; isActive?: boolean };

const eventName = 'smart-construction:master-data-changed';

export function notifyResourceStatusChange(change: ResourceStatusChange): void {
    window.dispatchEvent(new CustomEvent(eventName, {
        detail: { sites: change.kind === 'site', workers: change.kind === 'worker', resourceStatus: change },
    }));
}

export function subscribeResourceStatusChange(listener: (change: ResourceStatusChange) => void): () => void {
    const onChange = (event: Event) => {
        const change = (event as CustomEvent<{ resourceStatus?: ResourceStatusChange }>).detail?.resourceStatus;
        if (change) listener(change);
    };
    window.addEventListener(eventName, onChange);
    return () => window.removeEventListener(eventName, onChange);
}
