import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { investmentShares, revenueSources } from './allianceBusinessPlan';
import type { Role } from './allianceNetwork';
import { MotionBeam, MotionPulse } from './AllianceMotionEffects';
import './AllianceOrbit.css';

export type Flow = 'idle' | 'in' | 'out' | 'both';
export type Station = { note: string; flow: Flow };
export type Stations = Record<Role, Station>;

// Read clockwise from twelve o'clock. Each role keeps the same quarter in every drawing.
const radius = 75;
const polar = (cx: number, cy: number, r: number, angle: number) => {
    const radians = (angle - 90) * Math.PI / 180;
    return [cx + r * Math.cos(radians), cy + r * Math.sin(radians)];
};
const arc = (cx: number, cy: number, r: number, a: number, b: number) =>
    'M' + polar(cx, cy, r, a).join(',') + ' A' + [r, r, 0, 0, 1].join(' ') + ' ' + polar(cx, cy, r, b).join(',');

function Signals({ d, flow, rim = false, delay = 0 }: { d: string; flow: Flow; rim?: boolean; delay?: number }) {
    return <>{(['in', 'out'] as const).map(direction => (flow === direction || flow === 'both') &&
        <MotionBeam key={direction} d={d} reverse={direction === 'out'} crisp={!rim}
            delay={delay - (direction === 'out' ? 1.1 : 0)} duration={rim ? 3.6 : 2.8} />)}</>;
}

export default function AllianceOrbit({ title, caption, description, stations, split = false, income = false }: {
    title: string; caption: string; description: string; stations: Stations; split?: boolean; income?: boolean;
}) {
    const uid = useId().replace(/:/g, '');
    const ref = useRef<SVGSVGElement>(null);
    const [portrait, setPortrait] = useState(false);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const fit = () => { const width = el.getBoundingClientRect().width; if (width > 0) setPortrait(width < 405); };
        fit();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', fit);
            return () => window.removeEventListener('resize', fit);
        }
        const observer = new ResizeObserver(fit);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    const cx = portrait ? 160 : 220, cy = portrait ? 144 : 133;
    return <svg ref={ref} className="ai-orbit" data-portrait={portrait} data-income={income} viewBox={portrait ? '0 0 320 288' : '0 0 440 267'} role="img" aria-labelledby={uid + '-title'}>
        <title id={uid + '-title'}>{description}</title>
        <defs>{investmentShares.map(({ key, color }) => <marker key={key} id={uid + '-' + key} orient="auto-start-reverse"
            viewBox="0 0 8 8" refX="6.4" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse">
            <path d="M1 1 L6.5 4 L1 7" fill="none" stroke={income ? '#f4c887' : color} strokeWidth="1.65" strokeLinejoin="round" /></marker>)}</defs>
        <circle className="ai-orbit-aura" cx={cx} cy={cy} r="89" />
        <circle className="ai-orbit-register" cx={cx} cy={cy} r="95" />
        <circle className="ai-orbit-scan" cx={cx} cy={cy} r="102" pathLength="100" />
        <g className="ai-orbit-ticks" aria-hidden="true">{Array.from({ length: 16 }, (_, i) =>
            <path key={i} d={'M' + polar(cx, cy, 102, i * 22.5).join(' ') + ' L' + polar(cx, cy, i % 4 ? 104 : 108, i * 22.5).join(' ')} />)}</g>
        <g key={title + portrait} className="ai-orbit-arrival"><MotionPulse x={cx} y={cy} r={88} /><MotionPulse x={cx} y={cy} r={84} delay={.38} /></g>
        <circle className="ai-orbit-guide" cx={cx} cy={cy} r="59" />
        {investmentShares.map(({ key, role, share, color }, i) => {
            const source = revenueSources[i];
            const { note, flow } = income ? { note: source.note, flow: 'in' as Flow } : stations[key];
            const right = i < 2, top = i === 0 || i === 3;
            const sx = right ? 1 : -1, sy = top ? -1 : 1, angle = i * 90;
            const rim = arc(cx, cy, 87, angle + 5, angle + 85);
            const tx = cx + sx * (portrait ? 100 : 118), ty = cy + sy * (portrait ? 87 : 82);
            const spoke = 'M' + tx + ' ' + ty + ' Q' + (cx + sx * 87) + ' ' + ty + ' ' + polar(cx, cy, 83, angle + 45).join(' ');
            const x = cx + sx * (portrait ? 103 : 156), y = cy + sy * (portrait ? 110 : 82);
            const marker = 'url(#' + uid + '-' + key + ')';
            const inner = 'M' + polar(cx, cy, 63, angle + 45).join(' ') + ' L' + polar(cx, cy, 46, angle + 45).join(' ');
            return <g key={key} className="ai-orbit-station" data-role={income ? undefined : key} data-source={income ? source.id : undefined} data-flow={flow}
                style={{ '--station': income ? '#f4c887' : color } as React.CSSProperties}>
                <path className="ai-orbit-sector" d={arc(cx, cy, radius, angle + 2.4, angle + 87.6)} />
                <path className="ai-orbit-rail" d={rim} />
                <path className="ai-orbit-spoke" d={spoke} markerEnd={flow === 'in' || flow === 'both' ? marker : undefined}
                    markerStart={flow === 'out' || flow === 'both' ? marker : undefined} />
                {flow !== 'idle' && <path className="ai-orbit-inner-link" d={inner} markerEnd={flow !== 'out' ? marker : undefined} markerStart={flow !== 'in' ? marker : undefined} />}
                <g key={title + flow}><Signals d={rim} flow={flow} rim delay={-i * .6} /><Signals d={spoke} flow={flow} delay={-i * .6} /><Signals d={inner} flow={flow} delay={-i * .6 - .6} /></g>
                <circle className="ai-orbit-port" cx={tx} cy={ty} r="2" />
                <text className="ai-orbit-role" x={x} y={y - 6}>{income ? source.label : role}</text>
                <text className={split ? 'ai-orbit-share' : 'ai-orbit-note'} x={x} y={y + (split ? 18 : 14)}>{split ? share + '%' : note}</text>
            </g>;
        })}
        <text className="ai-orbit-caption" x={cx} y={cy - 7}>{caption}</text>
        <text className="ai-orbit-title" x={cx} y={cy + 16}>{title}</text>
    </svg>;
}
