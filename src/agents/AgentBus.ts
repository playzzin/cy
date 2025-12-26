import { AgentEvent, AgentEventType } from './types';

type Listener = (event: AgentEvent) => void;

export class AgentBus {
    private listeners: Partial<Record<AgentEventType, Listener[]>> = {};

    public publish(event: AgentEvent): void {
        const listeners = this.listeners[event.type];
        if (!listeners || listeners.length === 0) return;
        listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[AgentBus] listener failed', error);
            }
        });
    }

    public subscribe(type: AgentEventType, listener: Listener): () => void {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type]!.push(listener);
        return () => {
            this.listeners[type] = this.listeners[type]!.filter(l => l !== listener);
        };
    }
}
