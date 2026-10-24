import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoStep } from './transferGuideSimulation';

// @guide-sync 모션 변경은 TransferGuideSimulator.css의 커서 이동/클릭 시간과 함께 맞춘다.
// focus 시간은 커서 이동보다 길게, act는 클릭 애니메이션과 맞추며 --sim-speed를 동일 적용한다.
// useTransferGuidePlayback.test.ts에서 정지/속도/탭 전환 후 남은 시간을 검증하고,
// TransferGuideSimulator.test.tsx에서 클릭이 끝나기 전 결과가 적용되지 않는지 확인한다.
export type GuidePhase = 'focus' | 'act' | 'result';
const nextPhase: Record<GuidePhase, GuidePhase> = { focus: 'act', act: 'result', result: 'focus' };

export function guidePhaseDuration(step: DemoStep, phase: GuidePhase) {
    if (phase === 'focus') return 1050;
    if (phase === 'act') return 420;
    // Give detailed calculations and longer instructions time to be read.
    return Math.max(step.action.type === 'detail' ? 4200 : 2600, Math.min(4500, step.label.length * 65));
}

export function guideResultTarget(step: DemoStep) {
    const action = step.action;
    switch (action.type) {
        case 'detail': return `detail-content-${action.id}`;
        case 'add': return `row-${action.id}`;
        case 'addSelected': case 'remove': case 'retry': case 'compare': case 'confirmRestore': case 'applyMemo': return 'basket';
        case 'loadPayroll': return 'candidates';
        case 'export': case 'save': case 'backup': case 'applyResults': return 'feedback';
        case 'restore': return 'restore-confirmation';
        case 'loadResults': return 'result-mapping';
        case 'matchResults': return 'result-table';
        case 'stage': return action.value === 'preview' ? 'preview' : 'basket';
        default: return step.target;
    }
}

/** A pausable clock: no state changes until the demonstrated click has finished. */
export default function useTransferGuidePlayback(script: DemoStep[]) {
    const [frame, setFrame] = useState({ index: 0, phase: 'focus' as GuidePhase, revision: 0 });
    const [playing, setPlaying] = useState(false);
    const [finished, setFinished] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    const [hidden, setHidden] = useState(document.hidden);
    const [scrollPaused, setScrollPaused] = useState(false);
    const clock = useRef({ key: '', remaining: 0 });
    const running = playing && !hidden;

    useEffect(() => {
        const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        const preference = () => { setReduced(!!media?.matches); if (media?.matches) setPlaying(false); };
        const visibility = () => setHidden(document.hidden);
        media?.addEventListener('change', preference);
        document.addEventListener('visibilitychange', visibility);
        return () => { media?.removeEventListener('change', preference); document.removeEventListener('visibilitychange', visibility); };
    }, []);

    useEffect(() => {
        const key = `${frame.revision}:${frame.index}:${frame.phase}`;
        if (clock.current.key !== key) clock.current = { key, remaining: guidePhaseDuration(script[frame.index], frame.phase) };
        if (!running) return;
        const started = performance.now();
        const timer = window.setTimeout(() => {
            if (frame.phase === 'result' && frame.index === script.length - 1) {
                setFinished(true); setPlaying(false);
            } else {
                setFrame(previous => ({ ...previous, index: previous.index + (previous.phase === 'result' ? 1 : 0), phase: nextPhase[previous.phase] }));
            }
        }, clock.current.remaining / speed);
        return () => {
            window.clearTimeout(timer);
            clock.current.remaining = Math.max(0, clock.current.remaining - (performance.now() - started) * speed);
        };
    }, [frame, running, script, speed]);

    const pause = useCallback((byScroll = false) => { setPlaying(false); setScrollPaused(byScroll); }, []);
    const reset = () => {
        setPlaying(false); setFinished(false); setScrollPaused(false);
        setFrame(previous => ({ index: 0, phase: 'focus', revision: previous.revision + 1 }));
    };
    const seek = (index: number) => {
        setPlaying(false); setFinished(false); setScrollPaused(false);
        setFrame(previous => ({ index: Math.max(0, Math.min(script.length - 1, index)), phase: 'result', revision: previous.revision + 1 }));
    };
    const toggle = () => {
        setScrollPaused(false);
        if (finished) {
            setFinished(false);
            setFrame(previous => ({ index: 0, phase: 'focus', revision: previous.revision + 1 }));
        }
        setPlaying(value => !value);
    };
    const replayScene = () => {
        setFinished(false); setScrollPaused(false); setPlaying(true);
        setFrame(previous => ({ ...previous, phase: 'focus', revision: previous.revision + 1 }));
    };
    return { ...frame, playing, running, finished, speed, setSpeed, reduced, hidden, scrollPaused, pause, reset, seek, toggle, replayScene };
}
