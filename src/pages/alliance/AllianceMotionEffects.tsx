import React from 'react';
import './AllianceMotionEffects.css';

/** The same normalized path carries a soft trail and its bright leading edge. */
export function MotionBeam({ d, reverse = false, delay = 0, duration = 3.2, color = 'var(--station, #ccebdd)', crisp = false }: {
    d: string; reverse?: boolean; delay?: number; duration?: number; color?: string; crisp?: boolean;
}) {
    return <g className="ai-motion-beam" data-reverse={reverse} data-crisp={crisp} aria-hidden="true"
        style={{ '--beam-color': color, '--beam-delay': delay + 's', '--beam-duration': duration + 's' } as React.CSSProperties}>
        <path className="ai-beam-bloom" d={d} pathLength="100" />
        <path className="ai-beam-trail" d={d} pathLength="100" />
        <path className="ai-beam-head" d={d} pathLength="100" />
    </g>;
}

export function MotionPulse({ x, y, r, delay = 0, color = 'var(--scene, #d4e9cf)' }: {
    x: number; y: number; r: number; delay?: number; color?: string;
}) {
    return <circle className="ai-motion-pulse" cx={x} cy={y} r={r} aria-hidden="true"
        style={{ '--pulse-color': color, '--pulse-delay': delay + 's' } as React.CSSProperties} />;
}

const frame = 'M6 1 H94 Q99 1 99 6 V94 Q99 99 94 99 H6 Q1 99 1 94 V6 Q1 1 6 1 Z';
export function CardBeam({ active }: { active: boolean }) {
    return active ? <>
        <svg className="ai-card-beam-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <MotionBeam d={frame} color="var(--card-color)" duration={5.8} crisp />
        </svg>
        <span className="ai-card-gloss" aria-hidden="true" />
    </> : null;
}
