import type { CSSProperties } from 'react';

// Use the saved team color; a neutral fallback never invents a team's identity.
export function teamAccommodationStyle(value?: string): CSSProperties {
    const hex = (value || '').trim().replace(/^#/, '');
    const full = /^[\da-f]{3}$/i.test(hex) ? hex.split('').map(char => char + char).join('') : hex;
    const color = /^[\da-f]{6}$/i.test(full) ? `#${full}` : '#64748b';
    return { '--ta-team-color': color, '--ta-team-soft': `${color}12`, '--ta-team-line': `${color}38` } as CSSProperties;
}

export function openRealAccommodationSession() {
    const url = new URL(window.location.href);
    url.searchParams.set('devAdmin', '0');
    // Full navigation is required to restart AuthProvider's Firebase observer.
    window.location.replace(url.toString());
}
