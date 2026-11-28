import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import './TeamMobileUI.css';

const TeamMobileContext = createContext(false);
export const TEAM_MOBILE_QUERY = '(max-width: 768px)';

/** Presentation only. Authorization continues to come from the existing route/services. */
export function TeamMobileProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
    const [printing, setPrinting] = useState(false);
    useEffect(() => {
        if (!enabled) return;
        const beforePrint = () => flushSync(() => setPrinting(true));
        const afterPrint = () => flushSync(() => setPrinting(false));
        window.addEventListener('beforeprint', beforePrint);
        window.addEventListener('afterprint', afterPrint);
        return () => {
            window.removeEventListener('beforeprint', beforePrint);
            window.removeEventListener('afterprint', afterPrint);
        };
    }, [enabled]);
    useEffect(() => {
        if (!enabled) return;
        const root = document.documentElement;
        const previous = root.getAttribute('data-team-mobile');
        root.setAttribute('data-team-mobile', 'true');
        return () => {
            if (previous === null) root.removeAttribute('data-team-mobile');
            else root.setAttribute('data-team-mobile', previous);
        };
    }, [enabled]);
    return <TeamMobileContext.Provider value={enabled && !printing}>{children}</TeamMobileContext.Provider>;
}

export const useTeamPresentation = () => useContext(TeamMobileContext);

export function useTeamMobile() {
    const enabled = useTeamPresentation();
    const [narrow, setNarrow] = useState(() => enabled && (window.matchMedia?.(TEAM_MOBILE_QUERY)?.matches ?? window.innerWidth <= 768));
    useEffect(() => {
        if (!enabled) return;
        const media = window.matchMedia?.(TEAM_MOBILE_QUERY);
        if (!media) return;
        const update = () => setNarrow(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, [enabled]);
    return enabled && narrow;
}

export function TeamPageActions({ children }: { children: React.ReactNode }) {
    const mobile = useTeamMobile();
    const disclosure = useRef<HTMLDetailsElement>(null);
    if (!mobile) return <>{children}</>;
    return <details className="tm-page-actions" ref={disclosure} onKeyDown={event => {
        if (event.key === 'Escape' && disclosure.current) {
            disclosure.current.open = false;
            disclosure.current.querySelector('summary')?.focus();
        }
    }}>
        <summary>더보기 <span aria-hidden="true">⌄</span></summary>
        <div className="tm-page-actions__items" onClick={event => {
            if ((event.target as HTMLElement).closest('button, a') && disclosure.current) disclosure.current.open = false;
        }}>{children}</div>
    </details>;
}

/** Native details keeps children mounted, including draft inputs and loaded documents. */
export function TeamMobileDisclosure({ title, children, defaultOpen = false, summary, onOpenChange }: {
    title: string; children: React.ReactNode; defaultOpen?: boolean; summary?: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
}) {
    const mobile = useTeamMobile();
    if (!mobile) return <>{children}</>;
    return <details className="tm-disclosure" open={defaultOpen || undefined} onToggle={event => onOpenChange?.(event.currentTarget.open)}>
        <summary><span>{title}</span>{summary && <span className="tm-disclosure__summary">{summary}</span>}</summary>
        <div className="tm-disclosure__body">{children}</div>
    </details>;
}

export type TeamRequestView = 'entry' | 'history';
export function useTeamRequestTabs(historyId: string, enabled = true, owner?: string) {
    const mobile = useTeamMobile();
    const active = mobile && enabled;
    const [view, setView] = useState<TeamRequestView>(() => window.location.hash === `#${historyId}` ? 'history' : 'entry');
    const id = useId();
    useEffect(() => {
        setView(window.location.hash === `#${historyId}` ? 'history' : 'entry');
    }, [historyId, owner]);
    useEffect(() => {
        const onHash = () => { if (window.location.hash === `#${historyId}`) setView('history'); };
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, [historyId]);
    const showHistory = useCallback(() => {
        setView('history');
        if (active) requestAnimationFrame(() => {
            const panel = document.getElementById(historyId);
            panel?.focus({ preventScroll: true });
            panel?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
        });
    }, [active, historyId]);
    return {
        active, view, id, historyId, setView, showHistory,
        panel: (panelView: TeamRequestView) => ({
            ...(active ? { role: 'tabpanel', 'aria-labelledby': `${id}-${panelView}-tab`, tabIndex: -1 } : {}),
            hidden: active && view !== panelView,
        }),
    };
}

export function TeamRequestTabs({ tabs, disabled = false }: {
    tabs: ReturnType<typeof useTeamRequestTabs>; disabled?: boolean;
}) {
    if (!tabs.active) return null;
    return <div className="tm-request-tabs" role="tablist" aria-label="신청 화면" onKeyDown={event => {
        if (disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'entry' : event.key === 'End' ? 'history' : tabs.view === 'entry' ? 'history' : 'entry';
        tabs.setView(next);
        document.getElementById(`${tabs.id}-${next}-tab`)?.focus();
    }}>
        {(['entry', 'history'] as const).map(view => <button key={view} type="button" role="tab"
            id={`${tabs.id}-${view}-tab`} aria-controls={view === 'history' ? tabs.historyId : `${tabs.id}-entry`}
            aria-selected={tabs.view === view} tabIndex={tabs.view === view ? 0 : -1}
            disabled={disabled} onClick={() => tabs.setView(view)}>{view === 'entry' ? '신청하기' : '신청 내역'}</button>)}
    </div>;
}

export function TeamMobileSummary({ label, value, children }: {
    label: string; value: React.ReactNode; children?: React.ReactNode;
}) {
    return <section className="tm-summary" aria-label={label}>
        <div className="tm-summary__primary"><span>{label}</span><strong>{value}</strong></div>
        {children && <div className="tm-summary__secondary">{children}</div>}
    </section>;
}
